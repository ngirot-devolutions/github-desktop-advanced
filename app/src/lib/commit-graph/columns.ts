/** The columns of the commit graph list. */
export type CommitGraphColumnId =
  | 'refs'
  | 'graph'
  | 'description'
  | 'author'
  | 'date'
  | 'sha'

/** The default order of the columns, branches and tags first. */
export const DefaultCommitGraphColumns: ReadonlyArray<CommitGraphColumnId> = [
  'refs',
  'graph',
  'description',
  'author',
  'date',
  'sha',
]

/** The title of each column, as shown in its header. */
export const CommitGraphColumnTitles: Record<CommitGraphColumnId, string> = {
  refs: 'Branch / Tag',
  graph: 'Graph',
  description: 'Description',
  author: 'Author',
  date: 'Date',
  sha: 'Commit',
}

const columnsKey = 'commit-graph-columns'

/**
 * Move a column to the position currently occupied by another one.
 *
 * Moving a column to the right places it after the target, moving it to the
 * left places it before the target, like dragging a tab.
 */
export function moveCommitGraphColumn(
  columns: ReadonlyArray<CommitGraphColumnId>,
  column: CommitGraphColumnId,
  target: CommitGraphColumnId
): ReadonlyArray<CommitGraphColumnId> {
  const from = columns.indexOf(column)
  const to = columns.indexOf(target)

  if (from === -1 || to === -1 || from === to) {
    return columns
  }

  const without = columns.filter(c => c !== column)
  return [...without.slice(0, to), column, ...without.slice(to)]
}

/**
 * Parse a stored column order, falling back to the default order unless it
 * contains every column exactly once.
 */
export function parseCommitGraphColumns(
  value: string | null
): ReadonlyArray<CommitGraphColumnId> {
  if (value === null) {
    return DefaultCommitGraphColumns
  }

  try {
    const parsed: unknown = JSON.parse(value)
    const isValid =
      Array.isArray(parsed) &&
      parsed.length === DefaultCommitGraphColumns.length &&
      DefaultCommitGraphColumns.every(c => parsed.includes(c))

    return isValid ? parsed : DefaultCommitGraphColumns
  } catch {
    return DefaultCommitGraphColumns
  }
}

/** Read the column order last chosen by the user. */
export function getCommitGraphColumnsPreference() {
  try {
    return parseCommitGraphColumns(localStorage.getItem(columnsKey))
  } catch {
    return DefaultCommitGraphColumns
  }
}

/** Remember the column order chosen by the user. */
export function setCommitGraphColumnsPreference(
  columns: ReadonlyArray<CommitGraphColumnId>
) {
  try {
    localStorage.setItem(columnsKey, JSON.stringify(columns))
  } catch {
    // Not being able to persist the preference is not worth bothering the user.
  }
}
