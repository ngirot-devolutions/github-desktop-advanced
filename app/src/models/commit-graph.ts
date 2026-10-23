/**
 * Which refs the commit graph should include.
 *
 *  - 'all-branches'   : HEAD plus every local branch, remote branch and tag.
 *  - 'current-branch' : only the history reachable from HEAD.
 */
export type CommitGraphScope = 'all-branches' | 'current-branch'

/** The state of the commit graph view for a repository. */
export interface ICommitGraphState {
  /** Which refs are included in the graph. */
  readonly scope: CommitGraphScope

  /**
   * The SHAs of the commits loaded in the graph, in display order (children
   * always before their parents). Commits can be looked up in
   * `IRepositoryState.commitLookup`.
   */
  readonly commitSHAs: ReadonlyArray<string>

  /** Whether a batch of commits is currently being loaded. */
  readonly isLoading: boolean

  /** Whether more commits may be loaded by scrolling further down. */
  readonly hasMore: boolean

  /**
   * A signature of the refs (HEAD, branches, tags) the graph was loaded with.
   * Used to avoid reloading the graph when nothing has changed.
   */
  readonly refsSignature: string | null
}
