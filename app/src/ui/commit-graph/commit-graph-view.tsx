import * as React from 'react'
import memoizeOne from 'memoize-one'
import classNames from 'classnames'
import { Repository } from '../../models/repository'
import { Commit } from '../../models/commit'
import { Account } from '../../models/account'
import { GitHubRepository } from '../../models/github-repository'
import { ImageDiffType } from '../../models/diff'
import { CommittedFileChange } from '../../models/status'
import {
  CommitGraphScope,
  ICommitGraphFilter,
  ICommitGraphState,
} from '../../models/commit-graph'
import { ICommitSelection } from '../../lib/app-state'
import { Emoji } from '../../lib/emoji'
import { layoutCommitGraph } from '../../lib/commit-graph/layout'
import {
  getCommitGraphRefs,
  ICommitGraphRef,
} from '../../lib/commit-graph/refs'
import {
  DefaultCommitGraphDetailsWidth,
  EmptyCommitGraphFilter,
  getCommitGraphColumnWidth,
  getCommitGraphDetailsWidth,
  setCommitGraphColumnWidth,
  setCommitGraphDetailsWidth,
} from '../../lib/commit-graph/state'
import {
  ActiveBranchMaxAgeInDays,
  shortRefName,
} from '../../lib/commit-graph/revisions'
import {
  CommitGraphColumnId,
  CommitGraphColumnTitles,
  DefaultCommitGraphColumns,
  getCommitGraphColumnsPreference,
  moveCommitGraphColumn,
  setCommitGraphColumnsPreference,
} from '../../lib/commit-graph/columns'
import { IMenuItem, showContextualMenu } from '../../lib/menu-item'
import { Dispatcher } from '../dispatcher'
import { List } from '../lib/list'
import { Select } from '../lib/select'
import { ThrottledScheduler } from '../lib/throttled-scheduler'
import { Resizable } from '../resizable'
import { CommitGraphRow } from './commit-graph-row'
import { CommitGraphDetails } from './commit-graph-details'
import { CommitGraphDiff } from './commit-graph-diff'
import { CommitGraphSplitter } from './commit-graph-splitter'
import { Button } from '../lib/button'
import { TooltippedContent } from '../lib/tooltipped-content'
import {
  CommitGraphLaneWidth,
  CommitGraphRowHeight,
} from './commit-graph-lanes'

/**
 * Until the user resizes the graph column, it fits this many lanes at most to
 * keep room for the descriptions.
 */
const MaxAutoVisibleLanes = 10

/** The narrowest and widest the graph column can be resized to. */
const MinimumGraphColumnWidth = 40
const MaximumGraphColumnWidth = 1200

/** The room always kept for the descriptions when widening the graph. */
const MinimumDescriptionWidth = 200

/** The width of the fixed size columns, as set in the stylesheet. */
const FixedColumnWidths: Record<CommitGraphColumnId, number> = {
  refs: 180,
  graph: 0,
  description: 0,
  author: 130,
  date: 100,
  sha: 92,
}

const ScopeLabels: ReadonlyArray<[CommitGraphScope, string]> = [
  ['all-branches', 'All branches'],
  ['local-branches', 'Local branches'],
  [
    'active-branches',
    `Active branches (last ${ActiveBranchMaxAgeInDays} days)`,
  ],
  ['current-and-default', 'Current and default branches'],
  ['current-branch', 'Current branch'],
]

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
  readonly commitSelection: ICommitSelection
  readonly emoji: Map<string, Emoji>
  readonly accounts: ReadonlyArray<Account>
  readonly preferAbsoluteDates: boolean
  readonly imageDiffType: ImageDiffType
  readonly hideWhitespaceInDiff: boolean
  readonly showSideBySideDiff: boolean
  readonly gitHubRepository: GitHubRepository | null

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

  /** The order of the columns of the graph list. */
  readonly columns: ReadonlyArray<CommitGraphColumnId>

  /** The column whose header is being dragged, if any. */
  readonly draggedColumn: CommitGraphColumnId | null

  /**
   * The width of the graph column chosen by the user, or null to fit the
   * lanes automatically.
   */
  readonly graphColumnWidth: number | null
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
      columns: getCommitGraphColumnsPreference(),
      draggedColumn: null,
      graphColumnWidth: getCommitGraphColumnWidth(),
    }
  }

  public componentDidMount() {
    this.selectFirstCommitIfSelectionIsHidden()
  }

  public componentDidUpdate(prevProps: ICommitGraphViewProps) {
    const previous = prevProps.commitSelection.shas.join()
    const current = this.props.commitSelection.shas.join()

    if (previous !== current && this.state.isDiffOpen) {
      this.setState({ isDiffOpen: false })
    }

    this.selectFirstCommitIfSelectionIsHidden()
  }

  /**
   * The selection is shared with the History tab, which may select a commit
   * the graph doesn't show (e.g. when branches are soloed). Select the first
   * commit of the graph instead, so that the details match the graph.
   */
  private selectFirstCommitIfSelectionIsHidden() {
    const { commitSHAs, isLoading } = this.props.graphState
    const { shas } = this.props.commitSelection

    if (
      isLoading ||
      commitSHAs.length === 0 ||
      (shas.length > 0 && shas.every(sha => commitSHAs.includes(sha)))
    ) {
      return
    }

    const { dispatcher, repository } = this.props
    dispatcher.changeCommitSelection(repository, [commitSHAs[0]], true)
    dispatcher.loadChangedFilesForCurrentSelection(repository)
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
          <div className="commit-graph-toolbar">
            {this.renderFilterStatus()}
            {this.renderScopeSelect()}
          </div>
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
        {ScopeLabels.map(([scope, label]) => (
          <option key={scope} value={scope}>
            {label}
          </option>
        ))}
      </Select>
    )
  }

  private get filter(): ICommitGraphFilter {
    return this.props.graphState.filter ?? EmptyCommitGraphFilter
  }

  /** Tells the user when branches are soloed or hidden, and how to undo it. */
  private renderFilterStatus() {
    const { soloRefs, hiddenRefs } = this.filter

    if (soloRefs.length > 0) {
      return (
        <div className="commit-graph-filter-status">
          <TooltippedContent
            tagName="span"
            className="commit-graph-filter-label"
            tooltip={soloRefs.map(shortRefName).join(', ')}
          >
            Solo: {soloRefs.map(shortRefName).join(', ')}
          </TooltippedContent>
          <Button size="small" onClick={this.onExitSolo}>
            Exit solo
          </Button>
        </div>
      )
    }

    if (hiddenRefs.length > 0) {
      return (
        <div className="commit-graph-filter-status">
          <TooltippedContent
            tagName="span"
            className="commit-graph-filter-label"
            tooltip={hiddenRefs.map(shortRefName).join(', ')}
          >
            {hiddenRefs.length} hidden{' '}
            {hiddenRefs.length === 1 ? 'branch' : 'branches'}
          </TooltippedContent>
          <Button size="small" onClick={this.onShowAllHidden}>
            Show all
          </Button>
        </div>
      )
    }

    return null
  }

  private setFilter(filter: ICommitGraphFilter) {
    this.props.dispatcher.setCommitGraphFilter(this.props.repository, filter)
  }

  private onExitSolo = () => {
    this.setFilter({ ...this.filter, soloRefs: [] })
  }

  private onShowAllHidden = () => {
    this.setFilter({ ...this.filter, hiddenRefs: [] })
  }

  private onRefsContextMenu = (
    refs: ReadonlyArray<ICommitGraphRef>,
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.preventDefault()

    const { hiddenRefs, soloRefs } = this.filter
    const isSoloActive = soloRefs.length > 0

    const entries = refs
      .flatMap(r => [
        { name: r.name, ref: r.ref },
        ...(r.upstream ? [r.upstream] : []),
      ])
      .filter(r => r.ref !== 'HEAD')

    const refItems = entries.flatMap((r): ReadonlyArray<IMenuItem> => {
      const isSoloed = soloRefs.includes(r.ref)
      return [
        {
          label: `Hide ${r.name}`,
          action: () =>
            this.setFilter({
              hiddenRefs: [...hiddenRefs.filter(h => h !== r.ref), r.ref],
              soloRefs: soloRefs.filter(s => s !== r.ref),
            }),
        },
        {
          label: isSoloed
            ? `Remove ${r.name} from solo`
            : isSoloActive
            ? `Add ${r.name} to solo`
            : `Solo ${r.name}`,
          action: () =>
            this.setFilter({
              hiddenRefs,
              soloRefs: isSoloed
                ? soloRefs.filter(s => s !== r.ref)
                : [...soloRefs, r.ref],
            }),
        },
        { type: 'separator' },
      ]
    })

    const resetItems: ReadonlyArray<IMenuItem> = [
      ...(isSoloActive
        ? [{ label: 'Exit solo', action: this.onExitSolo }]
        : []),
      ...(hiddenRefs.length > 0
        ? [
            {
              label: `Show all hidden branches (${hiddenRefs.length})`,
              action: this.onShowAllHidden,
            },
          ]
        : []),
    ]

    const items = [...refItems, ...resetItems]
    if (items.length > 0 && items[items.length - 1].type === 'separator') {
      items.pop()
    }

    showContextualMenu(items)
  }

  private renderColumnHeaders() {
    return (
      <div
        className="commit-graph-row commit-graph-column-headers"
        onContextMenu={this.onColumnHeadersContextMenu}
      >
        {this.state.columns.map(this.renderColumnHeader)}
      </div>
    )
  }

  private renderColumnHeader = (column: CommitGraphColumnId) => {
    const isDragged = this.state.draggedColumn === column

    return (
      <div
        key={column}
        className={classNames('commit-graph-cell', column, {
          dragged: isDragged,
        })}
        style={column === 'graph' ? { width: this.graphWidth } : undefined}
        draggable={true}
        data-column={column}
        onDragStart={this.onColumnDragStart}
        onDragOver={this.onColumnDragOver}
        onDrop={this.onColumnDrop}
        onDragEnd={this.onColumnDragEnd}
      >
        {CommitGraphColumnTitles[column]}
        {column === 'graph' && this.renderGraphHeaderExtras()}
      </div>
    )
  }

  private renderGraphHeaderExtras() {
    const { hiddenLanes } = this

    return (
      <>
        {hiddenLanes > 0 && (
          <TooltippedContent
            tagName="span"
            className="commit-graph-hidden-lanes"
            tooltip={`${hiddenLanes} ${
              hiddenLanes === 1 ? 'lane is' : 'lanes are'
            } hidden, drag the edge of the column to widen it`}
          >
            +{hiddenLanes}
          </TooltippedContent>
        )}
        <CommitGraphSplitter
          orientation="vertical"
          size={this.graphWidth}
          minimumSize={MinimumGraphColumnWidth}
          maximumSize={this.maximumGraphWidth}
          label="Resize the graph column"
          onResize={this.onGraphColumnResize}
          onReset={this.onGraphColumnReset}
        />
      </>
    )
  }

  private onGraphColumnResize = (graphColumnWidth: number) => {
    this.setState({ graphColumnWidth })
    setCommitGraphColumnWidth(graphColumnWidth)
  }

  /** Go back to fitting the lanes automatically. */
  private onGraphColumnReset = () => {
    this.setState({ graphColumnWidth: null })
    setCommitGraphColumnWidth(null)
  }

  private getColumnFromEvent(event: React.DragEvent<HTMLDivElement>) {
    const column = event.currentTarget.dataset.column
    return this.state.columns.find(c => c === column) ?? null
  }

  private onColumnDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    const column = this.getColumnFromEvent(event)
    if (column !== null) {
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', column)
      this.setState({ draggedColumn: column })
    }
  }

  private onColumnDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (this.state.draggedColumn !== null) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    }
  }

  private onColumnDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const { draggedColumn } = this.state
    const target = this.getColumnFromEvent(event)

    if (draggedColumn !== null && target !== null) {
      event.preventDefault()
      this.setColumns(
        moveCommitGraphColumn(this.state.columns, draggedColumn, target)
      )
    }
    this.setState({ draggedColumn: null })
  }

  private onColumnDragEnd = () => {
    this.setState({ draggedColumn: null })
  }

  private onColumnHeadersContextMenu = (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    event.preventDefault()

    const { columns } = this.state
    const moveItems = columns.map((column, index): IMenuItem => {
      const label = CommitGraphColumnTitles[column]
      return {
        label: __DARWIN__ ? `Move ${label} Left` : `Move ${label} left`,
        enabled: index > 0,
        action: () =>
          this.setColumns(
            moveCommitGraphColumn(columns, column, columns[index - 1])
          ),
      }
    })

    showContextualMenu([
      ...moveItems,
      { type: 'separator' },
      {
        label: __DARWIN__ ? 'Reset Column Order' : 'Reset column order',
        enabled: columns !== DefaultCommitGraphColumns,
        action: () => this.setColumns(DefaultCommitGraphColumns),
      },
    ])
  }

  private setColumns(columns: ReadonlyArray<CommitGraphColumnId>) {
    this.setState({ columns })
    setCommitGraphColumnsPreference(columns)
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
          refs: this.props.graphState.refs,
          preferAbsoluteDates: this.props.preferAbsoluteDates,
          columns: this.state.columns,
          graphColumnWidth: this.state.graphColumnWidth,
          filter: this.props.graphState.filter,
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
        columns={this.state.columns}
        gitHubRepository={this.props.gitHubRepository}
        accounts={this.props.accounts}
        emoji={this.props.emoji}
        preferAbsoluteDates={this.props.preferAbsoluteDates}
        isGraphClipped={this.hiddenLanes > 0}
        onRefsContextMenu={this.onRefsContextMenu}
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
    return this.getRefs(this.props.graphState.refs)
  }

  private get graphWidth() {
    if (this.state.graphColumnWidth !== null) {
      return Math.min(this.state.graphColumnWidth, this.maximumGraphWidth)
    }

    const lanes = Math.min(
      Math.max(this.layout.columnCount, 1),
      MaxAutoVisibleLanes
    )
    return lanes * CommitGraphLaneWidth + CommitGraphLaneWidth / 2
  }

  /**
   * The widest the graph column can be without squeezing the description:
   * the list width minus the other columns and room for the description.
   */
  private get maximumGraphWidth() {
    const listWidth = window.innerWidth - this.state.detailsWidth
    const otherColumns = this.state.columns
      .filter(c => c !== 'graph' && c !== 'description')
      .reduce((sum, c) => sum + FixedColumnWidths[c], 0)

    return Math.max(
      MinimumGraphColumnWidth,
      Math.min(
        MaximumGraphColumnWidth,
        listWidth - otherColumns - MinimumDescriptionWidth
      )
    )
  }

  /** The number of lanes that don't fit in the graph column. */
  private get hiddenLanes() {
    const visible = Math.floor(this.graphWidth / CommitGraphLaneWidth)
    return Math.max(0, this.layout.columnCount - visible)
  }

  private get headSHA() {
    return this.props.graphState.refs?.headSha ?? null
  }

  private get selectedRows() {
    const { commitSHAs } = this.props.graphState
    return this.props.commitSelection.shas.flatMap(sha => {
      const index = commitSHAs.indexOf(sha)
      return index === -1 ? [] : [index]
    })
  }

  private onScopeChanged = (event: React.FormEvent<HTMLSelectElement>) => {
    const { value } = event.currentTarget
    const scope = ScopeLabels.find(([s]) => s === value)?.[0]

    if (scope !== undefined) {
      this.props.dispatcher.setCommitGraphScope(this.props.repository, scope)
    }
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
