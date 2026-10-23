import { describe, it } from 'node:test'
import assert from 'node:assert'
import { Branch, BranchType } from '../../../src/models/branch'
import { Tip, TipState } from '../../../src/models/tip'
import { getCommitGraphRefsSignature } from '../../../src/lib/commit-graph/state'

const main = new Branch(
  'main',
  null,
  { sha: 'aaa' },
  BranchType.Local,
  'refs/heads/main'
)
const tip: Tip = { kind: TipState.Valid, branch: main }

describe('getCommitGraphRefsSignature', () => {
  it('is stable regardless of the order of branches and tags', () => {
    const feature = new Branch(
      'feature',
      null,
      { sha: 'bbb' },
      BranchType.Local,
      'refs/heads/feature'
    )

    assert.strictEqual(
      getCommitGraphRefsSignature(
        'all-branches',
        tip,
        [main, feature],
        new Map([
          ['v1', 'aaa'],
          ['v2', 'bbb'],
        ])
      ),
      getCommitGraphRefsSignature(
        'all-branches',
        tip,
        [feature, main],
        new Map([
          ['v2', 'bbb'],
          ['v1', 'aaa'],
        ])
      )
    )
  })

  it('changes when a branch moves', () => {
    const moved = new Branch(
      'main',
      null,
      { sha: 'ccc' },
      BranchType.Local,
      'refs/heads/main'
    )

    assert.notStrictEqual(
      getCommitGraphRefsSignature('all-branches', tip, [main], null),
      getCommitGraphRefsSignature('all-branches', tip, [moved], null)
    )
  })

  it('ignores other branches when only the current branch is shown', () => {
    const other = new Branch(
      'other',
      null,
      { sha: 'ddd' },
      BranchType.Local,
      'refs/heads/other'
    )

    assert.strictEqual(
      getCommitGraphRefsSignature('current-branch', tip, [main], null),
      getCommitGraphRefsSignature('current-branch', tip, [main, other], null)
    )
  })
})
