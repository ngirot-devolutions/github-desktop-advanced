import { describe, it } from 'node:test'
import assert from 'node:assert'
import {
  CommitGraphScope,
  ICommitGraphFilter,
  ICommitGraphRefInfo,
  ICommitGraphRefs,
} from '../../../src/models/commit-graph'
import {
  getCommitGraphRevisions,
  ICommitGraphRevisionsInput,
} from '../../../src/lib/commit-graph/revisions'
import { EmptyCommitGraphFilter } from '../../../src/lib/commit-graph/state'

const now = new Date('2026-10-23T12:00:00Z')
const recent = new Date('2026-10-20T00:00:00Z')
const old = new Date('2025-06-01T00:00:00Z')

const info = (
  ref: string,
  date: Date = recent,
  upstream: string | null = null
): ICommitGraphRefInfo => ({ ref, sha: ref, date, upstream })

const repositoryRefs: ICommitGraphRefs = {
  headSha: 'refs/heads/feature',
  headRef: 'refs/heads/feature',
  refs: [
    info('refs/heads/main', recent, 'refs/remotes/origin/main'),
    info('refs/heads/feature', recent, 'refs/remotes/origin/feature'),
    info('refs/heads/old', old),
    info('refs/remotes/origin/main', recent),
    info('refs/remotes/origin/feature', old),
    info('refs/remotes/origin/stale', old),
    info('refs/remotes/github-desktop-someone/main', recent),
    info('refs/tags/v1', old),
  ],
}

function revisions(
  scope: CommitGraphScope,
  overrides: Partial<ICommitGraphRevisionsInput> = {}
) {
  return getCommitGraphRevisions({
    scope,
    filter: EmptyCommitGraphFilter,
    refs: repositoryRefs,
    defaultBranchRef: 'refs/heads/main',
    now,
    ...overrides,
  })
}

describe('getCommitGraphRevisions', () => {
  it('includes every branch, tracked or not, and every tag for all branches', () => {
    assert.deepStrictEqual(revisions('all-branches'), [
      'HEAD',
      'refs/heads/main',
      'refs/heads/feature',
      'refs/heads/old',
      'refs/remotes/origin/main',
      'refs/remotes/origin/feature',
      'refs/remotes/origin/stale',
      'refs/tags/v1',
    ])
  })

  it('includes local branches and their upstreams for local branches', () => {
    assert.deepStrictEqual(revisions('local-branches'), [
      'HEAD',
      'refs/heads/main',
      'refs/remotes/origin/main',
      'refs/heads/feature',
      'refs/remotes/origin/feature',
      'refs/heads/old',
    ])
  })

  it('includes the current and default branches and their upstreams', () => {
    assert.deepStrictEqual(revisions('current-and-default'), [
      'HEAD',
      'refs/heads/feature',
      'refs/remotes/origin/feature',
      'refs/heads/main',
      'refs/remotes/origin/main',
    ])
  })

  it('only includes HEAD for the current branch', () => {
    assert.deepStrictEqual(revisions('current-branch'), ['HEAD'])
  })

  it('includes recently updated branches and the current one for active branches', () => {
    assert.deepStrictEqual(revisions('active-branches'), [
      'HEAD',
      'refs/heads/feature',
      'refs/remotes/origin/feature',
      'refs/heads/main',
      'refs/remotes/origin/main',
    ])
  })

  it('leaves hidden refs out, including HEAD when its branch is hidden', () => {
    const filter: ICommitGraphFilter = {
      hiddenRefs: ['refs/heads/feature', 'refs/remotes/origin/stale'],
      soloRefs: [],
    }

    assert.deepStrictEqual(revisions('all-branches', { filter }), [
      'refs/heads/main',
      'refs/heads/old',
      'refs/remotes/origin/main',
      'refs/remotes/origin/feature',
      'refs/tags/v1',
    ])
  })

  it('only includes soloed refs, ignoring the scope and hidden refs', () => {
    const filter: ICommitGraphFilter = {
      hiddenRefs: ['refs/heads/old'],
      soloRefs: ['refs/heads/old', 'refs/heads/deleted'],
    }

    assert.deepStrictEqual(revisions('current-branch', { filter }), [
      'refs/heads/old',
    ])
  })

  it('ignores soloed refs that no longer exist', () => {
    const filter: ICommitGraphFilter = {
      hiddenRefs: [],
      soloRefs: ['refs/heads/deleted'],
    }

    assert.deepStrictEqual(revisions('current-branch', { filter }), ['HEAD'])
  })

  it('falls back to HEAD when everything is hidden', () => {
    const filter: ICommitGraphFilter = {
      hiddenRefs: ['refs/heads/feature'],
      soloRefs: [],
    }

    assert.deepStrictEqual(revisions('current-branch', { filter }), ['HEAD'])
  })
})
