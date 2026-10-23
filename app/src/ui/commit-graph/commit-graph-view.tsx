import * as React from 'react'
import memoizeOne from 'memoize-one'
import { Repository } from '../../models/repository'
import { Commit } from '../../models/commit'
import { Branch } from '../../models/branch'
import { Tip, TipState } from '../../models/tip'
import { Account } from '../../models/account'
import { ImageDiffType } from '../../models/diff'
import { CommittedFileChange } from '../../models/status'
import { CommitGraphScope, ICommitGraphState } from '../../models/commit-graph'
import { ICommitSelection } from '../../lib/app-state'
import { Emoji } from '../../lib/emoji'
import { layoutCommitGraph } from '../../lib/commit-graph/layout'
import { getCommitGraphRefs } from '../../lib/commit-graph/refs'
import {
  DefaultCommitGraphDetailsWidth,
  getCommitGraphDetailsWidth,
  setCommitGraphDetailsWidth,
} from '../../lib/commit-graph/state'
import { Dispatcher } from '../dispatcher'
import { List } from '../lib/list'
import { Select } from '../lib/select'
import { ThrottledScheduler } from '../lib/throttled-scheduler'
import { Resizable } from '../resizable'
import { CommitGraphRow } from './commit-graph-row'
import { CommitGraphDetails } from './commit-graph-details'
import { CommitGraphDiff } from './commit-graph-diff'
import {
  CommitGraphLaneWidth,
  CommitGraphRowHeight,
} from './commit-graph-lanes'

/** Lanes beyond this count are clipped to keep room for the descriptions. */
const MaxVisibleLanes = 20

/** Load more commits when the last visible row is this close to the end. */
const CloseToBottomThreshold = 50

/** The narrowest the commit details panel can be resized to. */
const MinimumDetailsWidth = 300

/** The width always kept for the graph next to the commit details. */
const MinimumGraphWidth = 400

interface ICommitGraphViewProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly graphState: ICommitGraphState
  readonly commitLookup: Map<string, Commit>
  readonly branches: ReadonlyArray<Branch>
  readonly localTags: Map<string, string> | null
  readonly tip: Tip
  readonly commitSelection: ICommitSelection
  readonly emoji: Map<string, Emoji>
  readonly accounts: ReadonlyArray<Account>
  readonly preferAbsoluteDates: boolean
  readonly imageDiffType: ImageDiffType
  readonly hideWhitespaceInDiff: boolean
  readonly showSideBySideDiff: boolean

  /** The repository section tabs, rendered in the header. */
  readonly tabs: JSX.Element

  /** The width of the tabs area, matching the repository sidebar. */
  readonly tabsWidth: number

  readonly onOpenInExternalEditor: (path: string) => void
  readonly onOpenBinaryFile: (fullPath: string) => void
  readonly onOpenSubmodule: (fullPath: string) => void
  readonly onChangeImageDiffType: (type: ImageDiffType) => void
  readonly onDiffOptionsOpened: () => void
}

interface ICommitGraphViewState {
  /** The width of the commit details panel on the right. */
  readonly detailsWidth: number

  /** Whether the diff of the selected file is shown in place of the graph. */
  readonly isDiffOpen: boolean
}

/**
 * A full-width view of the repository history drawn as a graph, with the
 * details of the selected commit in a panel on the right.
 *
 * Clicking a file in the details shows its diff in place of the graph, until
 * the diff is closed or another commit is selected.
 */
export class CommitGraphView extends React.Component<
  ICommitGraphViewProps,
  ICommitGraphViewState
> {
  private readonly loadChangedFilesScheduler = new ThrottledScheduler(200)

  private getLayout = memoizeOne(
    (commitSHAs: ReadonlyArray<string>, commitLookup: Map<string, Commit>) =>
      layoutCommitGraph(
        commitSHAs.map(sha => ({
          sha,
          parentSHAs: commitLookup.get(sha)?.parentSHAs ?? [],
        }))
      )
  )

  private getRefs = memoizeOne(getCommitGraphRefs)

  public constructor(props: ICommitGraphViewProps) {
    super(props)
    this.state = {
      detailsWidth: getCommitGraphDetailsWidth(),
      isDiffOpen: false,
    }
  }

  public componentDidUpdate(prevProps: ICommitGraphViewProps) {
    const previous = prevProps.commitSelection.shas.join()
    const current = this.props.commitSelection.shas.join()

    if (previous !== current && this.state.isDiffOpen) {
      this.setState({ isDiffOpen: false })
    }
  }

  public render() {
    const diff = this.renderDiff()

    return (
      <div className="commit-graph-view">
        <div className="commit-graph-header">
          <div
            className="commit-graph-tabs"
            style={{ width: this.props.tabsWidth }}
          >
            {this.props.tabs}
          </div>
          <div className="commit-graph-toolbar">{this.renderScopeSelect()}</div>
        </div>
        <div className="commit-graph-body">
          <div className="commit-graph-main">
            {diff}
            {/* Kept mounted while the diff is open to preserve the scroll position */}
            <div className="commit-graph-list" hidden={diff !== null}>
              {this.renderColumnHeaders()}
              {this.renderList()}
            </div>
          </div>
          <Resizable
            id="commit-graph-details-pane"
            handlePosition="left"
            width={this.state.detailsWidth}
            minimumWidth={MinimumDetailsWidth}
            maximumWidth={Math.max(
              MinimumDetailsWidth,
              window.innerWidth - MinimumGraphWidth
            )}
            onResize={this.onDetailsResize}
            onReset={this.onDetailsWidthReset}
            description="Commit details"
          >
            {this.renderDetails()}
          </Resizable>
        </div>
      </div>
    )
  }

  private renderDetails() {
    const { commitSelection, commitLookup } = this.props
    const selectedCommits = commitSelection.shas.flatMap(sha => {
      const commit = commitLookup.get(sha)
      return commit === undefined ? [] : [commit]
    })

    return (
      <CommitGraphDetails
        repository={this.props.repository}
        dispatcher={this.props.dispatcher}
        emoji={this.props.emoji}
        accounts={this.props.accounts}
        selectedCommits={selectedCommits}
        shasInDiff={commitSelection.shasInDiff}
        changesetData={commitSelection.changesetData}
        selectedFile={this.state.isDiffOpen ? commitSelection.file : null}
        width={this.state.detailsWidth}
        onOpenFile={this.onOpenFile}
        onOpenInExternalEditor={this.props.onOpenInExternalEditor}
      />
    )
  }

  private renderDiff() {
    const { file, diff } = this.props.commitSelection
    if (!this.state.isDiffOpen || file === null) {
      return null
    }

    return (
      <CommitGraphDiff
        repository={this.props.repository}
        dispatcher={this.props.dispatcher}
        file={file}
        diff={diff}
        imageDiffType={this.props.imageDiffType}
        hideWhitespaceInDiff={this.props.hideWhitespaceInDiff}
        showSideBySideDiff={this.props.showSideBySideDiff}
        onOpenBinaryFile={this.props.onOpenBinaryFile}
        onOpenSubmodule={this.props.onOpenSubmodule}
        onChangeImageDiffType={this.props.onChangeImageDiffType}
        onDiffOptionsOpened={this.props.onDiffOptionsOpened}
        onClose={this.onCloseDiff}
      />
    )
  }

  private onOpenFile = (file: CommittedFileChange) => {
    const current = this.props.commitSelection.file
    if (current === null || current.id !== file.id) {
      this.props.dispatcher.changeFileSelection(this.props.repository, file)
    }
    this.setState({ isDiffOpen: true })
  }

  private onCloseDiff = () => {
    this.setState({ isDiffOpen: false })
  }

  private onDetailsResize = (detailsWidth: number) => {
    this.setState({ detailsWidth })
    setCommitGraphDetailsWidth(detailsWidth)
  }

  private onDetailsWidthReset = () => {
    this.onDetailsResize(DefaultCommitGraphDetailsWidth)
  }

  private renderScopeSelect() {
    return (
      <Select
        label="Show"
        className="commit-graph-scope"
        value={this.props.graphState.scope}
        onChange={this.onScopeChanged}
      >
        <option value="all-branches">All branches</option>
        <option value="current-branch">Current branch</option>
      </Select>
    )
  }

  private renderColumnHeaders() {
    return (
      <div className="commit-graph-row commit-graph-column-headers">
        <div
          className="commit-graph-cell graph"
          style={{ width: this.graphWidth }}
        >
          Graph
        </div>
        <div className="commit-graph-cell description">Description</div>
        <div className="commit-graph-cell author">Author</div>
        <div className="commit-graph-cell date">Date</div>
        <div className="commit-graph-cell sha">Commit</div>
      </div>
    )
  }

  private renderList() {
    const { commitSHAs, isLoading } = this.props.graphState

    if (commitSHAs.length === 0) {
      return (
        <div className="commit-graph-empty">
          {isLoading ? 'Loading commits…' : 'No commits to display'}
        </div>
      )
    }

    return (
      <List
        rowCount={commitSHAs.length}
        rowHeight={CommitGraphRowHeight}
        rowRenderer={this.renderRow}
        selectedRows={this.selectedRows}
        selectionMode="single"
        onSelectedRowChanged={this.onSelectedRowChanged}
        onScroll={this.onScroll}
        getRowAriaLabel={this.getRowAriaLabel}
        ariaLabel="Commit graph"
        invalidationProps={{
          commitSHAs,
          branches: this.props.branches,
          localTags: this.props.localTags,
          tip: this.props.tip,
          preferAbsoluteDates: this.props.preferAbsoluteDates,
        }}
      />
    )
  }

  private renderRow = (index: number) => {
    const { commitSHAs } = this.props.graphState
    const sha = commitSHAs[index]
    const commit = this.props.commitLookup.get(sha)
    const row = this.layout.rows[index]

    if (commit === undefined || row === undefined) {
      return null
    }

    return (
      <CommitGraphRow
        key={sha}
        commit={commit}
        row={row}
        refs={this.refsBySha.get(sha) ?? []}
        graphWidth={this.graphWidth}
        isHead={sha === this.headSHA}
        emoji={this.props.emoji}
        preferAbsoluteDates={this.props.preferAbsoluteDates}
      />
    )
  }

  private getRowAriaLabel = (index: number) => {
    const sha = this.props.graphState.commitSHAs[index]
    const commit = this.props.commitLookup.get(sha)
    if (commit === undefined) {
      return undefined
    }

    const refs = (this.refsBySha.get(sha) ?? []).map(r => r.name)
    const refsText = refs.length > 0 ? ` (${refs.join(', ')})` : ''
    return `${commit.summary}${refsText}, by ${commit.author.name}, ${commit.shortSha}`
  }

  private get layout() {
    return this.getLayout(
      this.props.graphState.commitSHAs,
      this.props.commitLookup
    )
  }

  private get refsBySha() {
    return this.getRefs(
      this.props.branches,
      this.props.localTags,
      this.props.tip
    )
  }

  private get graphWidth() {
    const lanes = Math.min(
      Math.max(this.layout.columnCount, 1),
      MaxVisibleLanes
    )
    return lanes * CommitGraphLaneWidth + CommitGraphLaneWidth / 2
  }

  private get headSHA() {
    const { tip } = this.props
    return tip.kind === TipState.Valid
      ? tip.branch.tip.sha
      : tip.kind === TipState.Detached
      ? tip.currentSha
      : null
  }

  private get selectedRows() {
    const { commitSHAs } = this.props.graphState
    return this.props.commitSelection.shas.flatMap(sha => {
      const index = commitSHAs.indexOf(sha)
      return index === -1 ? [] : [index]
    })
  }

  private onScopeChanged = (event: React.FormEvent<HTMLSelectElement>) => {
    const scope: CommitGraphScope =
      event.currentTarget.value === 'current-branch'
        ? 'current-branch'
        : 'all-branches'

    this.props.dispatcher.setCommitGraphScope(this.props.repository, scope)
  }

  private onSelectedRowChanged = (row: number) => {
    const sha = this.props.graphState.commitSHAs[row]
    if (sha === undefined) {
      return
    }

    const { dispatcher, repository } = this.props
    dispatcher.changeCommitSelection(repository, [sha], true)
    this.loadChangedFilesScheduler.queue(() => {
      dispatcher.loadChangedFilesForCurrentSelection(repository)
    })
  }

  private onScroll = (scrollTop: number, clientHeight: number) => {
    const { commitSHAs, hasMore, isLoading } = this.props.graphState
    const lastVisibleRow = Math.ceil(
      (scrollTop + clientHeight) / CommitGraphRowHeight
    )

    if (
      hasMore &&
      !isLoading &&
      commitSHAs.length - lastVisibleRow <= CloseToBottomThreshold
    ) {
      this.props.dispatcher.loadNextCommitGraphBatch(this.props.repository)
    }
  }
}
