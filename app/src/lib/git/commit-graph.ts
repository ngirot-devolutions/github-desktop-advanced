import { Repository } from '../../models/repository'
import { Commit } from '../../models/commit'
import { CommitGraphScope } from '../../models/commit-graph'
import { getCommits } from './log'

/**
 * Get a batch of commits to display in the commit graph.
 *
 * Commits are returned in date order, which guarantees that children are
 * listed before their parents, as required by the graph layout.
 *
 * @param scope - Whether to include every branch, remote branch and tag, or
 *                only the history reachable from HEAD.
 */
export function getCommitGraphCommits(
  repository: Repository,
  scope: CommitGraphScope,
  limit: number,
  skip: number
): Promise<ReadonlyArray<Commit>> {
  const refArgs =
    scope === 'all-branches' ? ['--branches', '--remotes', '--tags'] : []

  return getCommits(repository, 'HEAD', limit, skip, [
    '--date-order',
    ...refArgs,
  ])
}
