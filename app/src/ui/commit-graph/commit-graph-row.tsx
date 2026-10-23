import * as React from 'react'
import classNames from 'classnames'
import { Commit } from '../../models/commit'
import { Account } from '../../models/account'
import { GitHubRepository } from '../../models/github-repository'
import { getAvatarUserFromAuthor } from '../../models/avatar'
import { Emoji } from '../../lib/emoji'
import { ICommitGraphRow } from '../../lib/commit-graph/layout'
import { ICommitGraphRef } from '../../lib/commit-graph/refs'
import { CommitGraphColumnId } from '../../lib/commit-graph/columns'
import { assertNever } from '../../lib/fatal-error'
import { formatDate } from '../../lib/format-date'
import { RichText } from '../lib/rich-text'
import { Avatar } from '../lib/avatar'
import { TooltippedContent } from '../lib/tooltipped-content'
import { RelativeTime } from '../relative-time'
import { Octicon } from '../octicons'
import * as octicons from '../octicons/octicons.generated'
import {
  CommitGraphAvatarSize,
  CommitGraphLanes,
  laneCenter,
  laneClass,
} from './commit-graph-lanes'

/** The maximum number of ref labels displayed before collapsing the rest. */
const MaxVisibleRefs = 2

interface ICommitGraphRowProps {
  readonly commit: Commit
  readonly row: ICommitGraphRow
  readonly refs: ReadonlyArray<ICommitGraphRef>
  readonly columns: ReadonlyArray<CommitGraphColumnId>
  readonly graphWidth: number
  readonly isHead: boolean
  readonly gitHubRepository: GitHubRepository | null
  readonly accounts: ReadonlyArray<Account>
  readonly emoji: Map<string, Emoji>
  readonly preferAbsoluteDates: boolean

  /** Whether some lanes are clipped because the graph column is too narrow. */
  readonly isGraphClipped: boolean

  /** Called when the user right clicks the branches and tags of the row. */
  readonly onRefsContextMenu: (
    refs: ReadonlyArray<ICommitGraphRef>,
    event: React.MouseEvent<HTMLDivElement>
  ) => void
}

/** A single commit in the commit graph, its cells in the order of `columns`. */
export class CommitGraphRow extends React.PureComponent<ICommitGraphRowProps> {
  public render() {
    return (
      <div className="commit-graph-row">
        {this.props.columns.map(this.renderCell)}
      </div>
    )
  }

  private renderCell = (column: CommitGraphColumnId) => {
    const { commit } = this.props

    switch (column) {
      case 'refs':
        return (
          <div
            key={column}
            className="commit-graph-cell refs"
            onContextMenu={this.onRefsContextMenu}
          >
            {this.renderRefs()}
          </div>
        )
      case 'graph':
        return (
          <div
            key={column}
            className={classNames('commit-graph-cell graph', {
              clipped: this.props.isGraphClipped,
            })}
            style={{ width: this.props.graphWidth }}
          >
            <CommitGraphLanes
              row={this.props.row}
              width={this.props.graphWidth}
              isHead={this.props.isHead}
            />
            {this.renderAvatar()}
          </div>
        )
      case 'description':
        return (
          <div key={column} className="commit-graph-cell description">
            {this.renderSummary()}
          </div>
        )
      case 'author':
        return (
          <div key={column} className="commit-graph-cell author">
            {commit.author.name}
          </div>
        )
      case 'date':
        return (
          <div key={column} className="commit-graph-cell date">
            {this.renderDate()}
          </div>
        )
      case 'sha':
        return (
          <div key={column} className="commit-graph-cell sha">
            {commit.shortSha}
          </div>
        )
      default:
        return assertNever(column, `Unknown column: ${column}`)
    }
  }

  private onRefsContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (this.props.refs.length > 0) {
      this.props.onRefsContextMenu(this.props.refs, event)
    }
  }

  private renderAvatar() {
    const { row, commit, isHead, graphWidth } = this.props
    const left = laneCenter(row.column) - CommitGraphAvatarSize / 2

    // Merge commits are drawn as a dot, and nodes in clipped lanes are hidden.
    if (row.isMerge || left + CommitGraphAvatarSize > graphWidth) {
      return null
    }

    return (
      <div
        className={classNames('commit-graph-avatar', laneClass(row.color), {
          head: isHead,
        })}
        style={{ left }}
      >
        <Avatar
          user={getAvatarUserFromAuthor(
            commit.author,
            this.props.gitHubRepository
          )}
          accounts={this.props.accounts}
          size={CommitGraphAvatarSize * 2}
          tooltip={false}
        />
      </div>
    )
  }

  private renderSummary() {
    const { commit } = this.props
    const hasEmptySummary = commit.summary.length === 0

    return (
      <RichText
        className={classNames('summary', { 'empty-summary': hasEmptySummary })}
        emoji={this.props.emoji}
        text={hasEmptySummary ? 'Empty commit message' : commit.summary}
        renderUrlsAsLinks={false}
      />
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
            <span className="commit-graph-ref-name">{ref.name}</span>
            {ref.upstream !== undefined && (
              <Octicon
                className="commit-graph-ref-upstream"
                symbol={octicons.cloud}
                title={`In sync with ${ref.upstream.name}`}
              />
            )}
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
