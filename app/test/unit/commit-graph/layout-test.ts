import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  ICommitGraphNode,
  layoutCommitGraph,
} from '../../../src/lib/commit-graph/layout'

const node = (sha: string, ...parentSHAs: string[]): ICommitGraphNode => ({
  sha,
  parentSHAs,
})

describe('layoutCommitGraph', () => {
  it('returns an empty layout for no commits', () => {
    assert.deepStrictEqual(layoutCommitGraph([]), { rows: [], columnCount: 0 })
  })

  it('draws a linear history in a single column', () => {
    const { rows, columnCount } = layoutCommitGraph([
      node('c', 'b'),
      node('b', 'a'),
      node('a'),
    ])

    assert.strictEqual(columnCount, 1)
    assert.deepStrictEqual(
      rows.map(r => r.column),
      [0, 0, 0]
    )
    assert.deepStrictEqual(rows[0].top, [])
    assert.deepStrictEqual(rows[0].bottom, [{ from: 0, to: 0, color: 0 }])
    assert.deepStrictEqual(rows[1].top, [{ from: 0, to: 0, color: 0 }])
    assert.deepStrictEqual(rows[2].bottom, [])
    assert(rows.every(r => r.color === 0 && !r.isMerge))
  })

  it('opens a lane for the second parent of a merge and closes it at the fork point', () => {
    const { rows, columnCount } = layoutCommitGraph([
      node('merge', 'main', 'feature'),
      node('main', 'base'),
      node('feature', 'base'),
      node('base'),
    ])

    const [merge, main, feature, base] = rows

    assert.strictEqual(columnCount, 2)
    assert.strictEqual(merge.isMerge, true)
    assert.deepStrictEqual(merge.bottom, [
      { from: 0, to: 0, color: 0 },
      { from: 0, to: 1, color: 1 },
    ])

    assert.strictEqual(main.column, 0)
    assert.deepStrictEqual(main.top, [
      { from: 0, to: 0, color: 0 },
      { from: 1, to: 1, color: 1 },
    ])

    assert.strictEqual(feature.column, 1)
    assert.strictEqual(feature.color, 1)

    assert.strictEqual(base.column, 0)
    assert.deepStrictEqual(base.top, [
      { from: 0, to: 0, color: 0 },
      { from: 1, to: 0, color: 1 },
    ])
    assert.deepStrictEqual(base.bottom, [])
  })

  it('connects a merge parent to an existing lane instead of opening a new one', () => {
    const { rows } = layoutCommitGraph([
      node('tip', 'shared'),
      node('merge', 'other', 'shared'),
      node('other', 'shared'),
      node('shared'),
    ])

    const merge = rows[1]
    assert.strictEqual(merge.column, 1)
    assert.deepStrictEqual(merge.bottom, [
      { from: 0, to: 0, color: 0 },
      { from: 1, to: 1, color: 1 },
      { from: 1, to: 0, color: 0 },
    ])
  })

  it('gives each branch tip its own lane and color', () => {
    const { rows } = layoutCommitGraph([
      node('feature-2', 'feature-1'),
      node('main-2', 'main-1'),
      node('feature-1', 'main-1'),
      node('main-1'),
    ])

    assert.deepStrictEqual(
      rows.map(r => [r.column, r.color]),
      [
        [0, 0],
        [1, 1],
        [0, 0],
        [0, 0],
      ]
    )
    assert.deepStrictEqual(rows[3].top, [
      { from: 0, to: 0, color: 0 },
      { from: 1, to: 0, color: 1 },
    ])
  })

  it('keeps the lane open when the parent is not loaded yet', () => {
    const { rows } = layoutCommitGraph([node('a', 'not-loaded')])
    assert.deepStrictEqual(rows[0].bottom, [{ from: 0, to: 0, color: 0 }])
  })

  it('reuses columns freed by lanes that ended', () => {
    const { rows, columnCount } = layoutCommitGraph([
      node('a', 'x'),
      node('b', 'y'),
      node('c', 'z'),
      node('y'),
      node('new-tip', 'x'),
    ])

    assert.deepStrictEqual(
      rows.map(r => r.column),
      [0, 1, 2, 1, 1]
    )
    assert.strictEqual(columnCount, 3)
  })

  it('draws root commits without lines below them', () => {
    const { rows } = layoutCommitGraph([node('a'), node('b')])

    assert.deepStrictEqual(
      rows.map(r => [r.column, r.bottom.length]),
      [
        [0, 0],
        [0, 0],
      ]
    )
  })
})
