/**
 * Which refs the commit graph should include. HEAD is always included.
 *
 *  - 'all-branches'        : every local branch, remote branch and tag.
 *  - 'local-branches'      : local branches and their upstream branches.
 *  - 'active-branches'     : branches with a commit in the last 30 days.
 *  - 'current-and-default' : the current and the default branches, and their
 *                            upstream branches.
 *  - 'current-branch'      : only the history reachable from HEAD.
 */
export type CommitGraphScope =
  | 'all-branches'
  | 'local-branches'
  | 'active-branches'
  | 'current-and-default'
  | 'current-branch'

/** A branch or tag the graph can be drawn from. */
export interface ICommitGraphRefInfo {
  /** The full name of the ref, e.g. `refs/heads/main` or `refs/tags/v1`. */
  readonly ref: string

  /** The commit the ref points at (the tagged commit for annotated tags). */
  readonly sha: string

  /** The date of that commit, if known. */
  readonly date: Date | null

  /** The full name of the upstream of a local branch, if any. */
  readonly upstream: string | null
}

/** The refs of a repository, as read by the commit graph. */
export interface ICommitGraphRefs {
  /** The commit HEAD points at, or null in an unborn repository. */
  readonly headSha: string | null

  /** The full name of the checked out branch, or null when detached. */
  readonly headRef: string | null

  /** Every local branch, remote branch and tag. */
  readonly refs: ReadonlyArray<ICommitGraphRefInfo>
}

/** The branches and tags the user chose to hide or to solo in the graph. */
export interface ICommitGraphFilter {
  /** Full names of the refs left out of the graph. */
  readonly hiddenRefs: ReadonlyArray<string>

  /**
   * Full names of the refs to show exclusively. When not empty, the scope and
   * the hidden refs are ignored.
   */
  readonly soloRefs: ReadonlyArray<string>
}

/** The state of the commit graph view for a repository. */
export interface ICommitGraphState {
  /** Which refs are included in the graph. */
  readonly scope: CommitGraphScope

  /**
   * The branches hidden or soloed in this repository, or null until they
   * have been read from the user's preferences.
   */
  readonly filter: ICommitGraphFilter | null

  /** The refs of the repository when the graph was last loaded. */
  readonly refs: ICommitGraphRefs | null

  /** The refs the loaded commits were read from, used to load more. */
  readonly revisions: ReadonlyArray<string>

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
