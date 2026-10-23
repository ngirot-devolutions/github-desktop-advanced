import { ForkedRemotePrefix } from '../../models/remote'
import {
  CommitGraphScope,
  ICommitGraphFilter,
  ICommitGraphRefInfo,
  ICommitGraphRefs,
} from '../../models/commit-graph'

/** Branches without commits for longer than this are not "active". */
export const ActiveBranchMaxAgeInDays = 30

const DayInMilliseconds = 24 * 60 * 60 * 1000

/** Everything needed to decide which refs the graph shows. */
export interface ICommitGraphRevisionsInput {
  readonly scope: CommitGraphScope
  readonly filter: ICommitGraphFilter
  readonly refs: ICommitGraphRefs

  /** The full name of the default branch (e.g. `refs/heads/main`), if known. */
  readonly defaultBranchRef: string | null

  readonly now: Date
}

/**
 * The full names of the refs (plus `HEAD`) whose history is drawn in the
 * graph, according to the scope and the branches hidden or soloed by the user.
 */
export function getCommitGraphRevisions(
  input: ICommitGraphRevisionsInput
): ReadonlyArray<string> {
  const { filter } = input
  const refs = getGraphRefs(input.refs)
  const known = new Set(refs.map(r => r.ref))

  const soloRefs = filter.soloRefs.filter(r => known.has(r))
  if (soloRefs.length > 0) {
    return unique(soloRefs)
  }

  const { headRef } = input.refs
  const hidden = new Set(filter.hiddenRefs)
  const isHeadHidden = headRef !== null && hidden.has(headRef)

  const revisions = unique([
    ...(isHeadHidden ? [] : ['HEAD']),
    ...getScopeRefs(input, refs),
  ]).filter(r => !hidden.has(r))

  return revisions.length > 0 ? revisions : ['HEAD']
}

/** The refs that make sense in the graph (no internal fork remotes). */
export function getGraphRefs(
  refs: ICommitGraphRefs
): ReadonlyArray<ICommitGraphRefInfo> {
  return refs.refs.filter(
    r => !r.ref.startsWith(`refs/remotes/${ForkedRemotePrefix}`)
  )
}

function getScopeRefs(
  input: ICommitGraphRevisionsInput,
  refs: ReadonlyArray<ICommitGraphRefInfo>
): ReadonlyArray<string> {
  const byRef = new Map(refs.map(r => [r.ref, r]))
  const withUpstream = (ref: string | null) => {
    const info = ref === null ? undefined : byRef.get(ref)
    if (info === undefined) {
      return []
    }
    return info.upstream !== null && byRef.has(info.upstream)
      ? [info.ref, info.upstream]
      : [info.ref]
  }

  const branches = refs.filter(r => !isTagRef(r.ref))

  switch (input.scope) {
    case 'all-branches':
      return refs.map(r => r.ref)
    case 'local-branches':
      return branches
        .filter(r => isLocalBranchRef(r.ref))
        .flatMap(r => withUpstream(r.ref))
    case 'active-branches': {
      const since =
        input.now.getTime() - ActiveBranchMaxAgeInDays * DayInMilliseconds
      const active = branches.filter(r => (r.date?.getTime() ?? 0) >= since)
      return [...withUpstream(input.refs.headRef), ...active.map(r => r.ref)]
    }
    case 'current-and-default':
      return [
        ...withUpstream(input.refs.headRef),
        ...withUpstream(input.defaultBranchRef),
      ]
    case 'current-branch':
      return []
  }
}

export function isLocalBranchRef(ref: string) {
  return ref.startsWith('refs/heads/')
}

export function isRemoteBranchRef(ref: string) {
  return ref.startsWith('refs/remotes/')
}

export function isTagRef(ref: string) {
  return ref.startsWith('refs/tags/')
}

/** A ref name without its `refs/heads/`, `refs/remotes/` or `refs/tags/` prefix. */
export function shortRefName(ref: string) {
  return ref.replace(/^refs\/(heads|remotes|tags)\//, '')
}

function unique(values: ReadonlyArray<string>) {
  return [...new Set(values)]
}
