import { Repository } from '../../models/repository'
import { Commit } from '../../models/commit'
import {
  ICommitGraphRefInfo,
  ICommitGraphRefs,
} from '../../models/commit-graph'
import { getCommits } from './log'
import { git } from './core'

/**
 * Get a batch of commits to display in the commit graph.
 *
 * Commits are returned in date order, which guarantees that children are
 * listed before their parents, as required by the graph layout.
 *
 * @param revisions - The refs (or `HEAD`) to read the history from. They are
 *                    passed on stdin so that any number of branches fits, and
 *                    refs deleted in the meantime are ignored.
 */
export function getCommitGraphCommits(
  repository: Repository,
  revisions: ReadonlyArray<string>,
  limit: number,
  skip: number
): Promise<ReadonlyArray<Commit>> {
  return getCommits(
    repository,
    undefined,
    limit,
    skip,
    ['--date-order', '--ignore-missing', '--stdin'],
    revisions.map(r => `${r}\n`).join('')
  )
}

/**
 * Read HEAD and every local branch, remote branch and tag of the repository.
 *
 * Unlike the branches of the app state, remote branches tracked by a local
 * branch are included, so that the graph shows the commits to pull.
 */
export async function getCommitGraphRefs(
  repository: Repository
): Promise<ICommitGraphRefs> {
  const [refsResult, headResult, headRefResult] = await Promise.all([
    git(
      [
        'for-each-ref',
        '--format=%(refname)%00%(objectname)%00%(*objectname)%00%(committerdate:unix)%00%(upstream)%00%(symref)',
        'refs/heads',
        'refs/remotes',
        'refs/tags',
      ],
      repository.path,
      'getCommitGraphRefs'
    ),
    git(
      ['rev-parse', '--verify', '--quiet', 'HEAD'],
      repository.path,
      'getCommitGraphHead',
      {
        successExitCodes: new Set([0, 1]),
      }
    ),
    git(
      ['symbolic-ref', '--quiet', 'HEAD'],
      repository.path,
      'getCommitGraphHeadRef',
      {
        successExitCodes: new Set([0, 1]),
      }
    ),
  ])

  const headSha = headResult.exitCode === 0 ? headResult.stdout.trim() : null
  const headRef =
    headRefResult.exitCode === 0 ? headRefResult.stdout.trim() : null

  return {
    headSha: headSha === '' ? null : headSha,
    headRef: headRef === '' ? null : headRef,
    refs: parseCommitGraphRefs(refsResult.stdout),
  }
}

/**
 * Parse the output of `git for-each-ref` with the format used by
 * `getCommitGraphRefs`, leaving out symbolic refs such as `origin/HEAD`.
 */
export function parseCommitGraphRefs(
  output: string
): ReadonlyArray<ICommitGraphRefInfo> {
  return output.split('\n').flatMap(line => {
    const [ref, sha, peeledSha, timestamp, upstream, symref] = line.split('\0')

    if (!ref || !sha || symref) {
      return []
    }

    const seconds = parseInt(timestamp, 10)
    return [
      {
        ref,
        sha: peeledSha || sha,
        date: isNaN(seconds) ? null : new Date(seconds * 1000),
        upstream: upstream || null,
      },
    ]
  })
}
