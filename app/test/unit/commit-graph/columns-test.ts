import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  DefaultCommitGraphColumns,
  moveCommitGraphColumn,
  parseCommitGraphColumns,
} from '../../../src/lib/commit-graph/columns'

describe('moveCommitGraphColumn', () => {
  const columns = DefaultCommitGraphColumns

  it('puts the branches and tags first by default', () => {
    assert.deepStrictEqual(columns, [
      'refs',
      'graph',
      'description',
      'author',
      'date',
      'sha',
    ])
  })

  it('places a column moved to the right after the target', () => {
    assert.deepStrictEqual(
      moveCommitGraphColumn(columns, 'refs', 'description'),
      ['graph', 'description', 'refs', 'author', 'date', 'sha']
    )
  })

  it('places a column moved to the left before the target', () => {
    assert.deepStrictEqual(moveCommitGraphColumn(columns, 'sha', 'graph'), [
      'refs',
      'sha',
      'graph',
      'description',
      'author',
      'date',
    ])
  })

  it('returns the same order when moving a column onto itself', () => {
    assert.strictEqual(moveCommitGraphColumn(columns, 'date', 'date'), columns)
  })
})

describe('parseCommitGraphColumns', () => {
  it('reads a valid stored order', () => {
    const stored = ['graph', 'refs', 'description', 'author', 'date', 'sha']
    assert.deepStrictEqual(
      parseCommitGraphColumns(JSON.stringify(stored)),
      stored
    )
  })

  it('falls back to the default order for missing or invalid values', () => {
    for (const value of [
      null,
      'not json',
      '["graph"]',
      '["refs","refs","description","author","date","sha"]',
      '{"refs":1}',
    ]) {
      assert.strictEqual(
        parseCommitGraphColumns(value),
        DefaultCommitGraphColumns,
        `${value}`
      )
    }
  })
})
