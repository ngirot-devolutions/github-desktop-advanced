import * as React from 'react'
import { Repository } from '../../models/repository'
import { CommittedFileChange } from '../../models/status'
import { IDiff, ImageDiffType } from '../../models/diff'
import { Dispatcher } from '../dispatcher'
import { DiffHeader } from '../diff/diff-header'
import { SeamlessDiffSwitcher } from '../diff/seamless-diff-switcher'
import { Button } from '../lib/button'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'

interface ICommitGraphDiffProps {
  readonly repository: Repository
  readonly dispatcher: Dispatcher
  readonly file: CommittedFileChange
  readonly diff: IDiff | null
  readonly imageDiffType: ImageDiffType
  readonly hideWhitespaceInDiff: boolean
  readonly showSideBySideDiff: boolean
  readonly onOpenBinaryFile: (fullPath: string) => void
  readonly onOpenSubmodule: (fullPath: string) => void
  readonly onChangeImageDiffType: (type: ImageDiffType) => void
  readonly onDiffOptionsOpened: () => void

  /** Called when the user closes the diff to go back to the graph. */
  readonly onClose: () => void
}

/**
 * The diff of a file of the selected commit, shown in place of the graph
 * until the user closes it.
 */
export class CommitGraphDiff extends React.Component<ICommitGraphDiffProps> {
  public render() {
    const { file, diff } = this.props

    return (
      // The keydown handler only lets Escape close the diff.
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions
      <div
        className="commit-graph-diff diff-container"
        onKeyDown={this.onKeyDown}
      >
        <div className="commit-graph-diff-header">
          <DiffHeader
            diff={diff}
            path={file.path}
            status={file.status}
            showSideBySideDiff={this.props.showSideBySideDiff}
            onShowSideBySideDiffChanged={this.onShowSideBySideDiffChanged}
            hideWhitespaceInDiff={this.props.hideWhitespaceInDiff}
            onHideWhitespaceInDiffChanged={this.onHideWhitespaceInDiffChanged}
            onDiffOptionsOpened={this.props.onDiffOptionsOpened}
          />
          <Button
            className="commit-graph-diff-close"
            onClick={this.props.onClose}
            ariaLabel="Close diff and show the graph"
            tooltip="Close diff (Esc)"
          >
            <Octicon symbol={octicons.x} />
          </Button>
        </div>
        <SeamlessDiffSwitcher
          repository={this.props.repository}
          imageDiffType={this.props.imageDiffType}
          file={file}
          diff={diff}
          readOnly={true}
          hideWhitespaceInDiff={this.props.hideWhitespaceInDiff}
          showDiffCheckMarks={false}
          showSideBySideDiff={this.props.showSideBySideDiff}
          onOpenBinaryFile={this.props.onOpenBinaryFile}
          onChangeImageDiffType={this.props.onChangeImageDiffType}
          onHideWhitespaceInDiffChanged={this.onHideWhitespaceInDiffChanged}
          onOpenSubmodule={this.props.onOpenSubmodule}
        />
      </div>
    )
  }

  private onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && !event.defaultPrevented) {
      event.preventDefault()
      this.props.onClose()
    }
  }

  private onShowSideBySideDiffChanged = (showSideBySideDiff: boolean) => {
    this.props.dispatcher.onShowSideBySideDiffChanged(showSideBySideDiff)
  }

  private onHideWhitespaceInDiffChanged = (hideWhitespaceInDiff: boolean) => {
    return this.props.dispatcher.onHideWhitespaceInHistoryDiffChanged(
      hideWhitespaceInDiff,
      this.props.repository,
      this.props.file
    )
  }
}
