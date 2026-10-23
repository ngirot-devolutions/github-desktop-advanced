import * as React from 'react'
import classNames from 'classnames'
import { Commit } from '../../models/commit'
import { Emoji } from '../../lib/emoji'
import { ICommitGraphRow } from '../../lib/commit-graph/layout'
import { ICommitGraphRef } from '../../lib/commit-graph/refs'
import { RichText } from '../lib/rich-text'
import { RelativeTime } from '../relative-time'
import { formatDate } from '../../lib/format-date'
import { CommitGraphLanes, laneClass } from './commit-graph-lanes'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import { TooltippedContent } from '../lib/tooltipped-content'

/** The maximum number of ref labels displayed before collapsing the rest. */
const MaxVisibleRefs = 3

interface ICommitGraphRowProps {
  readonly commit: Commit
  readonly row: ICommitGraphRow
  readonly refs: ReadonlyArray<ICommitGraphRef>
  readonly graphWidth: number
  readonly isHead: boolean
  readonly emoji: Map<string, Emoji>
  readonly preferAbsoluteDates: boolean
}

/** A single commit in the commit graph: lanes, refs, summary and metadata. */
export class CommitGraphRow extends React.PureComponent<ICommitGraphRowProps> {
  public render() {
    const { commit, row, graphWidth, isHead } = this.props
    const hasEmptySummary = commit.summary.length === 0

    return (
      <div className="commit-graph-row">
        <div className="commit-graph-cell graph" style={{ width: graphWidth }}>
          <CommitGraphLanes row={row} width={graphWidth} isHead={isHead} />
        </div>
        <div className="commit-graph-cell description">
          {this.renderRefs()}
          <RichText
            className={classNames('summary', {
              'empty-summary': hasEmptySummary,
            })}
            emoji={this.props.emoji}
            text={hasEmptySummary ? 'Empty commit message' : commit.summary}
            renderUrlsAsLinks={false}
          />
        </div>
        <div className="commit-graph-cell author">{commit.author.name}</div>
        <div className="commit-graph-cell date">{this.renderDate()}</div>
        <div className="commit-graph-cell sha">{commit.shortSha}</div>
      </div>
    )
  }

  private renderRefs() {
    const { refs, row } = this.props
    if (refs.length === 0) {
      return null
    }

    const visible = refs.slice(0, MaxVisibleRefs)
    const hidden = refs.slice(MaxVisibleRefs)

    return (
      <span className="commit-graph-refs">
        {visible.map(ref => (
          <span
            key={`${ref.kind}:${ref.name}`}
            className={classNames(
              'commit-graph-ref',
              ref.kind,
              laneClass(row.color)
            )}
          >
            {ref.kind === 'tag' && <Octicon symbol={octicons.tag} />}
            {ref.name}
          </span>
        ))}
        {hidden.length > 0 && (
          <TooltippedContent
            tagName="span"
            className="commit-graph-ref more"
            tooltip={hidden.map(r => r.name).join(', ')}
          >
            +{hidden.length}
          </TooltippedContent>
        )}
      </span>
    )
  }

  private renderDate() {
    const { date } = this.props.commit.author
    return this.props.preferAbsoluteDates ? (
      formatDate(date)
    ) : (
      <RelativeTime date={date} />
    )
  }
}
