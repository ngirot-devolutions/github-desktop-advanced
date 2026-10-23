import {
  CommitGraphScope,
  ICommitGraphFilter,
  ICommitGraphRefs,
  ICommitGraphState,
} from '../../models/commit-graph'
import { getNumber, setNumber } from '../local-storage'

const commitGraphScopeKey = 'commit-graph-scope'
const commitGraphDetailsWidthKey = 'commit-graph-details-width'
const commitGraphSummaryHeightKey = 'commit-graph-summary-height'
const commitGraphGraphWidthKey = 'commit-graph-graph-width'
const commitGraphFilterKeyPrefix = 'commit-graph-filter-'

/** The default height of the commit summary above the changed files. */
export const DefaultCommitGraphSummaryHeight = 180

/** The default width of the commit details panel in the commit graph view. */
export const DefaultCommitGraphDetailsWidth = 460

/** The number of commits loaded in the graph per batch. */
export const CommitGraphBatchSize = 300

/** A filter that neither hides nor soloes anything. */
export const EmptyCommitGraphFilter: ICommitGraphFilter = {
  hiddenRefs: [],
  soloRefs: [],
}

const commitGraphScopes: ReadonlyArray<CommitGraphScope> = [
  'all-branches',
  'local-branches',
  'active-branches',
  'current-and-default',
  'current-branch',
]

/** Read the scope last chosen by the user, defaulting to all branches. */
export function getCommitGraphScopePreference(): CommitGraphScope {
  try {
    const value = localStorage.getItem(commitGraphScopeKey)
    return commitGraphScopes.find(s => s === value) ?? 'all-branches'
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

/** Parse a stored filter, ignoring anything that isn't a list of strings. */
export function parseCommitGraphFilter(
  value: string | null
): ICommitGraphFilter {
  if (value === null) {
    return EmptyCommitGraphFilter
  }

  try {
    const parsed = JSON.parse(value)
    const strings = (v: unknown): ReadonlyArray<string> =>
      Array.isArray(v)
        ? v.filter((s): s is string => typeof s === 'string')
        : []

    return {
      hiddenRefs: strings(parsed?.hiddenRefs),
      soloRefs: strings(parsed?.soloRefs),
    }
  } catch {
    return EmptyCommitGraphFilter
  }
}

/** Read the branches hidden or soloed in the given repository. */
export function getCommitGraphFilterPreference(
  repositoryId: number
): ICommitGraphFilter {
  try {
    return parseCommitGraphFilter(
      localStorage.getItem(`${commitGraphFilterKeyPrefix}${repositoryId}`)
    )
  } catch {
    return EmptyCommitGraphFilter
  }
}

/** Remember the branches hidden or soloed in the given repository. */
export function setCommitGraphFilterPreference(
  repositoryId: number,
  filter: ICommitGraphFilter
) {
  try {
    localStorage.setItem(
      `${commitGraphFilterKeyPrefix}${repositoryId}`,
      JSON.stringify(filter)
    )
  } catch {
    // Not being able to persist the preference is not worth bothering the user.
  }
}

/** Read the width of the commit details panel last chosen by the user. */
export function getCommitGraphDetailsWidth(): number {
  return getNumber(commitGraphDetailsWidthKey, DefaultCommitGraphDetailsWidth)
}

/** Remember the width of the commit details panel. */
export function setCommitGraphDetailsWidth(width: number) {
  setNumber(commitGraphDetailsWidthKey, width)
}

/** Read the height of the commit summary last chosen by the user. */
export function getCommitGraphSummaryHeight(): number {
  return getNumber(commitGraphSummaryHeightKey, DefaultCommitGraphSummaryHeight)
}

/** Remember the height of the commit summary. */
export function setCommitGraphSummaryHeight(height: number) {
  setNumber(commitGraphSummaryHeightKey, height)
}

/**
 * Read the width of the graph column chosen by the user, or null when it
 * should fit the lanes automatically.
 */
export function getCommitGraphColumnWidth(): number | null {
  return getNumber(commitGraphGraphWidthKey) ?? null
}

/** Remember the width of the graph column, or null to fit the lanes. */
export function setCommitGraphColumnWidth(width: number | null) {
  if (width === null) {
    try {
      localStorage.removeItem(commitGraphGraphWidthKey)
    } catch {
      // Not being able to persist the preference is not worth bothering the user.
    }
  } else {
    setNumber(commitGraphGraphWidthKey, width)
  }
}

export function getInitialCommitGraphState(): ICommitGraphState {
  return {
    scope: getCommitGraphScopePreference(),
    filter: null,
    refs: null,
    revisions: [],
    commitSHAs: [],
    isLoading: false,
    hasMore: true,
    refsSignature: null,
  }
}

/**
 * Compute a signature of the refs the graph is drawn from.
 *
 * Two signatures are equal when the same refs point at the same commits, in
 * which case the graph doesn't need to be reloaded.
 */
export function getCommitGraphRefsSignature(
  revisions: ReadonlyArray<string>,
  refs: ICommitGraphRefs
): string {
  const shas = new Map(refs.refs.map(r => [r.ref, r.sha]))
  const head = `${refs.headRef ?? 'detached'}@${refs.headSha ?? 'unborn'}`

  return [
    head,
    ...revisions.map(r => `${r}@${r === 'HEAD' ? head : shas.get(r)}`).sort(),
  ].join('\n')
}
