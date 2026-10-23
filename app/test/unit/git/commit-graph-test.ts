import { describe, it } from 'node:test'
import assert from 'node:assert'
import { exec } from 'dugite'
import {
  getCommitGraphCommits,
  getCommitGraphRefs,
} from '../../../src/lib/git/commit-graph'
import { setupEmptyRepository } from '../../helpers/repositories'
import {
  createBranch,
  makeCommit,
  switchTo,
} from '../../helpers/repository-scaffolding'

describe('git/commit-graph', () => {
  describe('getCommitGraphCommits', () => {
    it('reads the history of the given refs only', async t => {
      const repository = await setupEmptyRepository(t)
      await makeCommit(repository, {
        commitMessage: 'base',
        entries: [{ path: 'README.md', contents: 'base' }],
      })
      await createBranch(repository, 'feature', 'HEAD')
      await switchTo(repository, 'feature')
      await makeCommit(repository, {
        commitMessage: 'on feature',
        entries: [{ path: 'feature.md', contents: 'feature' }],
      })
      await exec(['tag', 'feature-tag'], repository.path)
      await switchTo(repository, 'master')
      await makeCommit(repository, {
        commitMessage: 'on master',
        entries: [{ path: 'master.md', contents: 'master' }],
      })

      const all = await getCommitGraphCommits(
        repository,
        ['HEAD', 'refs/heads/feature'],
        10,
        0
      )
      const headOnly = await getCommitGraphCommits(repository, ['HEAD'], 10, 0)
      const featureOnly = await getCommitGraphCommits(
        repository,
        ['refs/tags/feature-tag'],
        10,
        0
      )

      assert.deepStrictEqual(all.map(c => c.summary).sort(), [
        'base',
        'on feature',
        'on master',
      ])
      assert.deepStrictEqual(
        headOnly.map(c => c.summary),
        ['on master', 'base']
      )
      assert.deepStrictEqual(
        featureOnly.map(c => c.summary),
        ['on feature', 'base']
      )
      assert.deepStrictEqual(all.find(c => c.summary === 'on feature')?.tags, [
        'feature-tag',
      ])
    })

    it('ignores refs that do not exist', async t => {
      const repository = await setupEmptyRepository(t)
      await makeCommit(repository, {
        commitMessage: 'only commit',
        entries: [{ path: 'README.md', contents: 'base' }],
      })

      const commits = await getCommitGraphCommits(
        repository,
        ['HEAD', 'refs/heads/deleted-branch'],
        10,
        0
      )

      assert.deepStrictEqual(
        commits.map(c => c.summary),
        ['only commit']
      )
    })

    it('lists children before their parents and supports paging', async t => {
      const repository = await setupEmptyRepository(t)
      for (const i of [1, 2, 3]) {
        await makeCommit(repository, {
          commitMessage: `commit ${i}`,
          entries: [{ path: 'file.md', contents: `${i}` }],
        })
      }

      const firstPage = await getCommitGraphCommits(repository, ['HEAD'], 2, 0)
      const secondPage = await getCommitGraphCommits(repository, ['HEAD'], 2, 2)

      assert.deepStrictEqual(
        [...firstPage, ...secondPage].map(c => c.summary),
        ['commit 3', 'commit 2', 'commit 1']
      )
    })

    it('returns no commits for an unborn repository', async t => {
      const repository = await setupEmptyRepository(t)
      const commits = await getCommitGraphCommits(repository, ['HEAD'], 10, 0)
      assert.deepStrictEqual(commits, [])
    })
  })

  describe('getCommitGraphRefs', () => {
    it('reads branches, tracked remote branches, tags and HEAD', async t => {
      const repository = await setupEmptyRepository(t)
      await makeCommit(repository, {
        commitMessage: 'base',
        entries: [{ path: 'README.md', contents: 'base' }],
      })
      const run = (args: string[]) => exec(args, repository.path)
      const head = (await run(['rev-parse', 'HEAD'])).stdout.trim()

      await createBranch(repository, 'feature', 'HEAD')
      await run(['tag', '-a', '-m', 'release', 'v1'])
      await run(['remote', 'add', 'origin', 'https://example.com/repo.git'])
      await run(['update-ref', 'refs/remotes/origin/master', head])
      await run([
        'symbolic-ref',
        'refs/remotes/origin/HEAD',
        'refs/remotes/origin/master',
      ])
      await run(['config', 'branch.master.remote', 'origin'])
      await run(['config', 'branch.master.merge', 'refs/heads/master'])

      const before = Date.now() - 60 * 1000
      const refs = await getCommitGraphRefs(repository)

      assert.strictEqual(refs.headSha, head)
      assert.strictEqual(refs.headRef, 'refs/heads/master')
      assert.deepStrictEqual(
        refs.refs.map(r => [r.ref, r.sha === head, r.upstream]),
        [
          ['refs/heads/feature', true, null],
          ['refs/heads/master', true, 'refs/remotes/origin/master'],
          ['refs/remotes/origin/master', true, null],
          // The annotated tag points at the tagged commit, not the tag object
          ['refs/tags/v1', true, null],
        ]
      )
      for (const { date } of refs.refs.filter(r => !r.ref.includes('tags'))) {
        assert.ok(date !== null && date.getTime() >= before)
      }
    })

    it('reports a detached HEAD', async t => {
      const repository = await setupEmptyRepository(t)
      await makeCommit(repository, {
        commitMessage: 'base',
        entries: [{ path: 'README.md', contents: 'base' }],
      })
      await exec(['checkout', '--detach'], repository.path)

      const refs = await getCommitGraphRefs(repository)
      assert.notStrictEqual(refs.headSha, null)
      assert.strictEqual(refs.headRef, null)
    })

    it('reports an unborn repository', async t => {
      const repository = await setupEmptyRepository(t)
      const refs = await getCommitGraphRefs(repository)

      assert.deepStrictEqual(refs, {
        headSha: null,
        headRef: 'refs/heads/master',
        refs: [],
      })
    })
  })
})
