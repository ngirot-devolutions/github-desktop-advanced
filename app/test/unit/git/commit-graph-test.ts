import { describe, it } from 'node:test'
import assert from 'node:assert'
import { exec } from 'dugite'
import { getCommitGraphCommits } from '../../../src/lib/git/commit-graph'
import { setupEmptyRepository } from '../../helpers/repositories'
import {
  createBranch,
  makeCommit,
  switchTo,
} from '../../helpers/repository-scaffolding'

describe('git/commit-graph', () => {
  describe('getCommitGraphCommits', () => {
    it('includes other branches and tags only with the all-branches scope', async t => {
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

      const all = await getCommitGraphCommits(repository, 'all-branches', 10, 0)
      const current = await getCommitGraphCommits(
        repository,
        'current-branch',
        10,
        0
      )

      assert.deepStrictEqual(all.map(c => c.summary).sort(), [
        'base',
        'on feature',
        'on master',
      ])
      assert.deepStrictEqual(
        current.map(c => c.summary),
        ['on master', 'base']
      )
      assert.deepStrictEqual(all.find(c => c.summary === 'on feature')?.tags, [
        'feature-tag',
      ])
    })

    it('lists children before their parents and supports paging', async t => {
      const repository = await setupEmptyRepository(t)
      for (const i of [1, 2, 3]) {
        await makeCommit(repository, {
          commitMessage: `commit ${i}`,
          entries: [{ path: 'file.md', contents: `${i}` }],
        })
      }

      const firstPage = await getCommitGraphCommits(
        repository,
        'all-branches',
        2,
        0
      )
      const secondPage = await getCommitGraphCommits(
        repository,
        'all-branches',
        2,
        2
      )

      assert.deepStrictEqual(
        [...firstPage, ...secondPage].map(c => c.summary),
        ['commit 3', 'commit 2', 'commit 1']
      )
    })

    it('returns no commits for an unborn repository', async t => {
      const repository = await setupEmptyRepository(t)
      const commits = await getCommitGraphCommits(
        repository,
        'all-branches',
        10,
        0
      )
      assert.deepStrictEqual(commits, [])
    })
  })
})
