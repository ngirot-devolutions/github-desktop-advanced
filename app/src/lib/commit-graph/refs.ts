import { ICommitGraphRefs } from '../../models/commit-graph'
import {
  getGraphRefs,
  isLocalBranchRef,
  isRemoteBranchRef,
  isTagRef,
  shortRefName,
} from './revisions'

/** The kind of ref shown as a label next to a commit in the graph. */
export type CommitGraphRefKind = 'head' | 'local' | 'remote' | 'tag'

/** A label shown next to a commit in the graph. */
export interface ICommitGraphRef {
  readonly name: string
  readonly kind: CommitGraphRefKind

  /** The full name of the ref (e.g. `refs/heads/main`), or `HEAD`. */
  readonly ref: string

  /**
   * The upstream of a local branch when it points at the same commit. Both
   * are shown as a single label.
   */
  readonly upstream?: {
    readonly name: string
    readonly ref: string
  }
}

const kindOrder: ReadonlyArray<CommitGraphRefKind> = [
  'head',
  'local',
  'remote',
  'tag',
]

/**
 * Group the refs pointing at commits by commit SHA.
 *
 * The checked out branch (or a detached HEAD) is reported with the `head`
 * kind. A local branch and its upstream pointing at the same commit are
 * merged into a single label. Labels are sorted by kind and then by name.
 */
export function getCommitGraphRefs(
  repositoryRefs: ICommitGraphRefs | null
): ReadonlyMap<string, ReadonlyArray<ICommitGraphRef>> {
  const labels = new Map<string, Array<ICommitGraphRef>>()

  if (repositoryRefs === null) {
    return labels
  }

  const add = (sha: string, label: ICommitGraphRef) => {
    const existing = labels.get(sha)
    if (existing === undefined) {
      labels.set(sha, [label])
    } else {
      existing.push(label)
    }
  }

  const { headRef, headSha } = repositoryRefs
  if (headRef === null && headSha !== null) {
    add(headSha, { name: 'HEAD', kind: 'head', ref: 'HEAD' })
  }

  const refs = getGraphRefs(repositoryRefs)
  const shaByRef = new Map(refs.map(r => [r.ref, r.sha]))

  // Upstreams merged into the label of their local branch.
  const mergedUpstreams = new Set<string>()

  for (const { ref, sha, upstream } of refs) {
    if (!isLocalBranchRef(ref)) {
      continue
    }

    const isInSync = upstream !== null && shaByRef.get(upstream) === sha
    if (isInSync) {
      mergedUpstreams.add(upstream)
    }

    add(sha, {
      name: shortRefName(ref),
      kind: ref === headRef ? 'head' : 'local',
      ref,
      ...(isInSync
        ? { upstream: { name: shortRefName(upstream), ref: upstream } }
        : {}),
    })
  }

  for (const { ref, sha } of refs) {
    if (isRemoteBranchRef(ref) && !mergedUpstreams.has(ref)) {
      add(sha, { name: shortRefName(ref), kind: 'remote', ref })
    } else if (isTagRef(ref)) {
      add(sha, { name: shortRefName(ref), kind: 'tag', ref })
    }
  }

  for (const shaLabels of labels.values()) {
    shaLabels.sort(
      (a, b) =>
        kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) ||
        a.name.localeCompare(b.name)
    )
  }

  return labels
}
