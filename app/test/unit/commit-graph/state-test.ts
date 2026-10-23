import { describe, it } from 'node:test'
import assert from 'node:assert'
import { ICommitGraphRefs } from '../../../src/models/commit-graph'
import {
  EmptyCommitGraphFilter,
  getCommitGraphRefsSignature,
  parseCommitGraphFilter,
} from '../../../src/lib/commit-graph/state'

const refs = (
  shas: Record<string, string>,
  headSha: string = 'aaa'
): ICommitGraphRefs => ({
  headSha,
  headRef: 'refs/heads/main',
  refs: Object.entries(shas).map(([ref, sha]) => ({
    ref,
    sha,
    date: null,
    upstream: null,
  })),
})

describe('getCommitGraphRefsSignature', () => {
  const repository = refs({
    'refs/heads/main': 'aaa',
    'refs/heads/feature': 'bbb',
    'refs/heads/other': 'ccc',
  })

  it('is stable regardless of the order of the revisions', () => {
    assert.strictEqual(
      getCommitGraphRefsSignature(
        ['HEAD', 'refs/heads/main', 'refs/heads/feature'],
        repository
      ),
      getCommitGraphRefsSignature(
        ['refs/heads/feature', 'HEAD', 'refs/heads/main'],
        repository
      )
    )
  })

  it('changes when a shown ref moves', () => {
    const revisions = ['HEAD', 'refs/tags/v1']

    assert.notStrictEqual(
      getCommitGraphRefsSignature(revisions, refs({ 'refs/tags/v1': 'a' })),
      getCommitGraphRefsSignature(revisions, refs({ 'refs/tags/v1': 'b' }))
    )
  })

  it('changes when HEAD moves', () => {
    assert.notStrictEqual(
      getCommitGraphRefsSignature(['HEAD'], refs({}, 'aaa')),
      getCommitGraphRefsSignature(['HEAD'], refs({}, 'bbb'))
    )
  })

  it('ignores refs that are not shown', () => {
    assert.strictEqual(
      getCommitGraphRefsSignature(['HEAD'], repository),
      getCommitGraphRefsSignature(
        ['HEAD'],
        refs({ 'refs/heads/main': 'aaa', 'refs/heads/other': 'moved' })
      )
    )
  })

  it('changes when the shown refs change', () => {
    assert.notStrictEqual(
      getCommitGraphRefsSignature(['HEAD'], repository),
      getCommitGraphRefsSignature(['HEAD', 'refs/heads/feature'], repository)
    )
  })
})

describe('parseCommitGraphFilter', () => {
  it('reads hidden and soloed refs', () => {
    assert.deepStrictEqual(
      parseCommitGraphFilter(
        '{"hiddenRefs":["refs/heads/a"],"soloRefs":["refs/heads/b"]}'
      ),
      { hiddenRefs: ['refs/heads/a'], soloRefs: ['refs/heads/b'] }
    )
  })

  it('ignores invalid values', () => {
    assert.strictEqual(parseCommitGraphFilter(null), EmptyCommitGraphFilter)
    assert.strictEqual(
      parseCommitGraphFilter('not json'),
      EmptyCommitGraphFilter
    )
    assert.deepStrictEqual(
      parseCommitGraphFilter('{"hiddenRefs":[1,"refs/heads/a"],"soloRefs":3}'),
      { hiddenRefs: ['refs/heads/a'], soloRefs: [] }
    )
  })
})
