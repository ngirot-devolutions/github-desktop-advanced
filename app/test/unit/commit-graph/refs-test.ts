import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Branch, BranchType } from '../../../src/models/branch'
import { Tip, TipState } from '../../../src/models/tip'
import { getCommitGraphRefs } from '../../../src/lib/commit-graph/refs'

const local = (name: string, sha: string) =>
  new Branch(name, null, { sha }, BranchType.Local, `refs/heads/${name}`)

const remote = (name: string, sha: string) =>
  new Branch(name, null, { sha }, BranchType.Remote, `refs/remotes/${name}`)

const onBranch = (branch: Branch): Tip => ({ kind: TipState.Valid, branch })

describe('getCommitGraphRefs', () => {
  it('groups branches and tags by commit, current branch first', () => {
    const main = local('main', 'aaa')
    const refs = getCommitGraphRefs(
      [remote('origin/main', 'aaa'), local('feature', 'bbb'), main],
      new Map([['v1.0', 'aaa']]),
      onBranch(main)
    )

    assert.deepStrictEqual(refs.get('aaa'), [
      { name: 'main', kind: 'head' },
      { name: 'origin/main', kind: 'remote' },
      { name: 'v1.0', kind: 'tag' },
    ])
    assert.deepStrictEqual(refs.get('bbb'), [
      { name: 'feature', kind: 'local' },
    ])
  })

  it('labels a detached HEAD', () => {
    const refs = getCommitGraphRefs([], null, {
      kind: TipState.Detached,
      currentSha: 'ccc',
    })

    assert.deepStrictEqual(refs.get('ccc'), [{ name: 'HEAD', kind: 'head' }])
  })

  it('ignores symbolic remote HEAD refs', () => {
    const refs = getCommitGraphRefs([remote('origin/HEAD', 'aaa')], null, {
      kind: TipState.Unknown,
    })

    assert.strictEqual(refs.size, 0)
  })
})
