import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  ICommitGraphRefInfo,
  ICommitGraphRefs,
} from '../../../src/models/commit-graph'
import { getCommitGraphRefs } from '../../../src/lib/commit-graph/refs'

const info = (
  ref: string,
  sha: string,
  upstream: string | null = null
): ICommitGraphRefInfo => ({ ref, sha, date: null, upstream })

const onMain = (
  refs: ReadonlyArray<ICommitGraphRefInfo>
): ICommitGraphRefs => ({
  headSha: 'aaa',
  headRef: 'refs/heads/main',
  refs,
})

describe('getCommitGraphRefs', () => {
  it('returns no labels before the refs are loaded', () => {
    assert.strictEqual(getCommitGraphRefs(null).size, 0)
  })

  it('groups branches and tags by commit, current branch first', () => {
    const labels = getCommitGraphRefs(
      onMain([
        info('refs/tags/v1.0', 'aaa'),
        info('refs/remotes/origin/main', 'aaa'),
        info('refs/heads/feature', 'bbb'),
        info('refs/heads/main', 'aaa'),
      ])
    )

    assert.deepStrictEqual(labels.get('aaa'), [
      { name: 'main', kind: 'head', ref: 'refs/heads/main' },
      { name: 'origin/main', kind: 'remote', ref: 'refs/remotes/origin/main' },
      { name: 'v1.0', kind: 'tag', ref: 'refs/tags/v1.0' },
    ])
    assert.deepStrictEqual(labels.get('bbb'), [
      { name: 'feature', kind: 'local', ref: 'refs/heads/feature' },
    ])
  })

  it('merges a local branch with its upstream when they are in sync', () => {
    const labels = getCommitGraphRefs(
      onMain([
        info('refs/heads/main', 'aaa', 'refs/remotes/origin/main'),
        info('refs/remotes/origin/main', 'aaa'),
        info('refs/heads/feature', 'bbb', 'refs/remotes/origin/feature'),
        info('refs/remotes/origin/feature', 'ccc'),
      ])
    )

    assert.deepStrictEqual(labels.get('aaa'), [
      {
        name: 'main',
        kind: 'head',
        ref: 'refs/heads/main',
        upstream: { name: 'origin/main', ref: 'refs/remotes/origin/main' },
      },
    ])
    assert.deepStrictEqual(labels.get('bbb'), [
      { name: 'feature', kind: 'local', ref: 'refs/heads/feature' },
    ])
    assert.deepStrictEqual(labels.get('ccc'), [
      {
        name: 'origin/feature',
        kind: 'remote',
        ref: 'refs/remotes/origin/feature',
      },
    ])
  })

  it('labels a detached HEAD', () => {
    const labels = getCommitGraphRefs({
      headSha: 'ccc',
      headRef: null,
      refs: [],
    })

    assert.deepStrictEqual(labels.get('ccc'), [
      { name: 'HEAD', kind: 'head', ref: 'HEAD' },
    ])
  })

  it('leaves out the remotes used internally for forks', () => {
    const labels = getCommitGraphRefs(
      onMain([info('refs/remotes/github-desktop-someone/main', 'aaa')])
    )

    assert.strictEqual(labels.size, 0)
  })
})
