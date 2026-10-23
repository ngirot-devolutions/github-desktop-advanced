import { Branch, BranchType } from '../../models/branch'
import { Tip, TipState } from '../../models/tip'

/** The kind of ref shown as a label next to a commit in the graph. */
export type CommitGraphRefKind = 'head' | 'local' | 'remote' | 'tag'

/** A label shown next to a commit in the graph. */
export interface ICommitGraphRef {
  readonly name: string
  readonly kind: CommitGraphRefKind
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
 * kind. Labels are sorted by kind and then by name.
 */
export function getCommitGraphRefs(
  branches: ReadonlyArray<Branch>,
  tags: ReadonlyMap<string, string> | null,
  tip: Tip
): ReadonlyMap<string, ReadonlyArray<ICommitGraphRef>> {
  const currentBranch = tip.kind === TipState.Valid ? tip.branch.name : null
  const refs = new Map<string, Array<ICommitGraphRef>>()

  const add = (sha: string, ref: ICommitGraphRef) => {
    const existing = refs.get(sha)
    if (existing === undefined) {
      refs.set(sha, [ref])
    } else {
      existing.push(ref)
    }
  }

  if (tip.kind === TipState.Detached) {
    add(tip.currentSha, { name: 'HEAD', kind: 'head' })
  }

  for (const branch of branches) {
    if (
      branch.isDesktopForkRemoteBranch ||
      (branch.type === BranchType.Remote && branch.name.endsWith('/HEAD'))
    ) {
      continue
    }

    const kind =
      branch.type === BranchType.Remote
        ? 'remote'
        : branch.name === currentBranch
        ? 'head'
        : 'local'

    add(branch.tip.sha, { name: branch.name, kind })
  }

  for (const [name, sha] of tags ?? []) {
    add(sha, { name, kind: 'tag' })
  }

  for (const labels of refs.values()) {
    labels.sort(
      (a, b) =>
        kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind) ||
        a.name.localeCompare(b.name)
    )
  }

  return refs
}
