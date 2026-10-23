import * as React from 'react'
import { Repository } from '../../models/repository'
import { Commit } from '../../models/commit'
import { CommittedFileChange } from '../../models/status'
import { Account } from '../../models/account'
import { Emoji } from '../../lib/emoji'
import { IChangesetData } from '../../lib/git'
import { Dispatcher } from '../dispatcher'
import { ExpandableCommitSummary } from '../history/expandable-commit-summary'
import { FileList } from '../history/file-list'
import { UnreachableCommitsTab } from '../history/unreachable-commits-dialog'
import {
  DefaultCommitGraphSummaryHeight,
  getCommitGraphSummaryHeight,
  setCommitGraphSummaryHeight,
} from '../../lib/commit-graph/state'
import { CommitGraphSplitter } from './commit-graph-splitter'

/** The smallest height of the commit summary. */
const MinimumSummaryHeight = 60

/** The height always kept for the header, the file list and the window chrome. */
const ReservedHeight = 260

interface ICommitGraphDetailsProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly emoji: Map<string, Emoji>
  readonly accounts: ReadonlyArray<Account>
  readonly selectedCommits: ReadonlyArray<Commit>
  readonly shasInDiff: ReadonlyArray<string>
  readonly changesetData: IChangesetData
  readonly selectedFile: CommittedFileChange | null

  /** The width of the panel, used to lay out the file paths. */
  readonly width: number

  /** Called when the user clicks or selects a file to see its diff. */
  readonly onOpenFile: (file: CommittedFileChange) => void

  /** Called to open a file (relative to the repository) in the editor. */
  readonly onOpenInExternalEditor: (path: string) => void
}

interface ICommitGraphDetailsState {
  readonly isExpanded: boolean

  /**
   * The height of the commit summary. It stays the same when another commit
   * is selected, so that the file list doesn't move around.
   */
  readonly summaryHeight: number
}

/**
 * The details of the commit selected in the graph: its summary, description
 * and the list of files it changed.
 */
export class CommitGraphDetails extends React.Component<
  ICommitGraphDetailsProps,
  ICommitGraphDetailsState
> {
  public constructor(props: ICommitGraphDetailsProps) {
    super(props)
    this.state = {
      isExpanded: false,
      summaryHeight: getCommitGraphSummaryHeight(),
    }
  }

  public componentDidUpdate(prevProps: ICommitGraphDetailsProps) {
    const previous = prevProps.selectedCommits.map(c => c.sha).join()
    const current = this.props.selectedCommits.map(c => c.sha).join()

    if (previous !== current && this.state.isExpanded) {
      this.setState({ isExpanded: false })
    }
  }

  public render() {
    const { selectedCommits } = this.props

    if (selectedCommits.length === 0) {
      return (
        <div className="commit-graph-details blankslate">
          No commit selected
        </div>
      )
    }

    const maximumSummaryHeight = Math.max(
      MinimumSummaryHeight,
      window.innerHeight - ReservedHeight
    )

    return (
      <div className="commit-graph-details">
        <div
          className="commit-graph-summary"
          style={{
            height: Math.min(this.state.summaryHeight, maximumSummaryHeight),
          }}
        >
          <ExpandableCommitSummary
            selectedCommits={selectedCommits}
            shasInDiff={this.props.shasInDiff}
            changesetData={this.props.changesetData}
            emoji={this.props.emoji}
            repository={this.props.repository}
            onExpandChanged={this.onExpandChanged}
            isExpanded={this.state.isExpanded}
            onHighlightShas={this.onHighlightShas}
            showUnreachableCommits={this.showUnreachableCommits}
            accounts={this.props.accounts}
          />
        </div>
        <CommitGraphSplitter
          height={this.state.summaryHeight}
          minimumHeight={MinimumSummaryHeight}
          maximumHeight={maximumSummaryHeight}
          label="Resize commit summary"
          onResize={this.onSummaryResize}
          onReset={this.onSummaryHeightReset}
        />
        {this.renderFileList()}
      </div>
    )
  }

  private renderFileList() {
    const { files } = this.props.changesetData
    if (files.length === 0) {
      return <div className="commit-graph-no-files">No files in commit</div>
    }

    return (
      <>
        <div className="file-list-header">
          {files.length} changed {files.length === 1 ? 'file' : 'files'}
        </div>
        <FileList
          files={files}
          selectedFile={this.props.selectedFile}
          onSelectedFileChanged={this.props.onOpenFile}
          onRowClick={this.onRowClick}
          onRowDoubleClick={this.onRowDoubleClick}
          // -1 for the left hand side border
          availableWidth={this.props.width - 1}
        />
      </>
    )
  }

  private onRowClick = (row: number) => {
    const file = this.props.changesetData.files[row]
    if (file !== undefined) {
      this.props.onOpenFile(file)
    }
  }

  private onRowDoubleClick = (row: number) => {
    const file = this.props.changesetData.files[row]
    if (file !== undefined) {
      this.props.onOpenInExternalEditor(file.path)
    }
  }

  private onSummaryResize = (summaryHeight: number) => {
    this.setState({ summaryHeight })
    setCommitGraphSummaryHeight(summaryHeight)
  }

  private onSummaryHeightReset = () => {
    this.onSummaryResize(DefaultCommitGraphSummaryHeight)
  }

  private onExpandChanged = (isExpanded: boolean) => {
    this.setState({ isExpanded })
  }

  private onHighlightShas = (shasToHighlight: ReadonlyArray<string>) => {
    this.props.dispatcher.updateShasToHighlight(
      this.props.repository,
      shasToHighlight
    )
  }

  private showUnreachableCommits = (selectedTab: UnreachableCommitsTab) => {
    this.props.dispatcher.showUnreachableCommits(selectedTab)
  }
}
