import { Branch } from '../../models/branch'
import { CommitGraphScope, ICommitGraphState } from '../../models/commit-graph'
import { Tip, TipState } from '../../models/tip'
import { getNumber, setNumber } from '../local-storage'

const commitGraphScopeKey = 'commit-graph-scope'
const commitGraphListWidthKey = 'commit-graph-list-width'

/** The default width of the graph list in the commit graph view. */
export const DefaultCommitGraphListWidth = 720

/** The number of commits loaded in the graph per batch. */
export const CommitGraphBatchSize = 300

/** Read the scope last chosen by the user, defaulting to all branches. */
export function getCommitGraphScopePreference(): CommitGraphScope {
  try {
    return localStorage.getItem(commitGraphScopeKey) === 'current-branch'
      ? 'current-branch'
      : 'all-branches'
  } catch {
    return 'all-branches'
  }
}

/** Remember the scope chosen by the user for newly opened repositories. */
export function setCommitGraphScopePreference(scope: CommitGraphScope) {
  try {
    localStorage.setItem(commitGraphScopeKey, scope)
  } catch {
    // Not being able to persist the preference is not worth bothering the user.
  }
}

/** Read the width of the graph list last chosen by the user. */
export function getCommitGraphListWidth(): number {
  return getNumber(commitGraphListWidthKey, DefaultCommitGraphListWidth)
}

/** Remember the width of the graph list. */
export function setCommitGraphListWidth(width: number) {
  setNumber(commitGraphListWidthKey, width)
}

export function getInitialCommitGraphState(): ICommitGraphState {
  return {
    scope: getCommitGraphScopePreference(),
    commitSHAs: [],
    isLoading: false,
    hasMore: true,
    refsSignature: null,
  }
}

/**
 * Compute a signature of the refs the graph depends on.
 *
 * Two signatures are equal when HEAD, the branches and the tags point at the
 * same commits, in which case the graph doesn't need to be reloaded.
 */
export function getCommitGraphRefsSignature(
  scope: CommitGraphScope,
  tip: Tip,
  branches: ReadonlyArray<Branch>,
  tags: ReadonlyMap<string, string> | null
): string {
  const head =
    tip.kind === TipState.Valid
      ? `${tip.branch.name}@${tip.branch.tip.sha}`
      : tip.kind === TipState.Detached
      ? tip.currentSha
      : tip.kind

  const refs =
    scope === 'all-branches'
      ? [
          ...branches.map(b => `${b.ref}@${b.tip.sha}`),
          ...[...(tags ?? [])].map(([name, sha]) => `tag:${name}@${sha}`),
        ].sort()
      : []

  return [scope, head, ...refs].join('\n')
}
