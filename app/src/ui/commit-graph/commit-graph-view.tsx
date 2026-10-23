import * as React from 'react'
import memoizeOne from 'memoize-one'
import { Repository } from '../../models/repository'
import { Commit } from '../../models/commit'
import { Branch } from '../../models/branch'
import { Tip, TipState } from '../../models/tip'
import { CommitGraphScope, ICommitGraphState } from '../../models/commit-graph'
import { Emoji } from '../../lib/emoji'
import { layoutCommitGraph } from '../../lib/commit-graph/layout'
import { getCommitGraphRefs } from '../../lib/commit-graph/refs'
import { Dispatcher } from '../dispatcher'
import { List } from '../lib/list'
import { Select } from '../lib/select'
import { ThrottledScheduler } from '../lib/throttled-scheduler'
import { Resizable } from '../resizable'
import {
  DefaultCommitGraphListWidth,
  getCommitGraphListWidth,
  setCommitGraphListWidth,
} from '../../lib/commit-graph/state'
import { CommitGraphRow } from './commit-graph-row'
import {
  CommitGraphLaneWidth,
  CommitGraphRowHeight,
} from './commit-graph-lanes'

/** Lanes beyond this count are clipped to keep room for the descriptions. */
const MaxVisibleLanes = 20

/** Load more commits when the last visible row is this close to the end. */
const CloseToBottomThreshold = 50

/** The narrowest the graph list can be resized to. */
const MinimumListWidth = 360

/** The width kept for the commit details next to the graph list. */
const MinimumDetailsWidth = 400

interface ICommitGraphViewProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly graphState: ICommitGraphState
  readonly commitLookup: Map<string, Commit>
  readonly branches: ReadonlyArray<Branch>
  readonly localTags: Map<string, string> | null
  readonly tip: Tip
  readonly selectedSHAs: ReadonlyArray<string>
  readonly emoji: Map<string, Emoji>
  readonly preferAbsoluteDates: boolean

  /** The repository section tabs, rendered in the header. */
  readonly tabs: JSX.Element

  /** The width of the tabs area, matching the repository sidebar. */
  readonly tabsWidth: number

  /** The details of the selected commit, rendered next to the graph. */
  readonly details: JSX.Element
}

interface ICommitGraphViewState {
  /** The width of the graph list, the details take the remaining space. */
  readonly listWidth: number
}

/**
 * A full-width view of the repository history drawn as a graph, with the
 * details of the selected commit next to it.
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
    this.state = { listWidth: getCommitGraphListWidth() }
  }

  public render() {
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
          <Resizable
            id="commit-graph-list-pane"
            width={this.state.listWidth}
            minimumWidth={MinimumListWidth}
            maximumWidth={Math.max(
              MinimumListWidth,
              window.innerWidth - MinimumDetailsWidth
            )}
            onResize={this.onListResize}
            onReset={this.onListWidthReset}
            description="Commit graph"
          >
            <div className="commit-graph-list">
              {this.renderColumnHeaders()}
              {this.renderList()}
            </div>
          </Resizable>
          <div className="commit-graph-details">{this.props.details}</div>
        </div>
      </div>
    )
  }

  private onListResize = (listWidth: number) => {
    this.setState({ listWidth })
    setCommitGraphListWidth(listWidth)
  }

  private onListWidthReset = () => {
    this.onListResize(DefaultCommitGraphListWidth)
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
    return this.props.selectedSHAs.flatMap(sha => {
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
