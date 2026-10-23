/** The minimal information about a commit needed to lay out the graph. */
export interface ICommitGraphNode {
  readonly sha: string
  readonly parentSHAs: ReadonlyArray<string>
}

/** A line segment drawn in one half of a graph row. */
export interface ICommitGraphEdge {
  /** The column the segment starts from. */
  readonly from: number

  /** The column the segment ends at. */
  readonly to: number

  /** The color index of the lane this segment belongs to. */
  readonly color: number
}

/** Everything needed to draw the graph for a single commit row. */
export interface ICommitGraphRow {
  readonly sha: string

  /** The column in which the commit node is drawn. */
  readonly column: number

  /** The color index of the commit node. */
  readonly color: number

  /** Whether the commit has more than one parent. */
  readonly isMerge: boolean

  /** Segments from the top edge of the row to its vertical middle. */
  readonly top: ReadonlyArray<ICommitGraphEdge>

  /** Segments from the vertical middle of the row to its bottom edge. */
  readonly bottom: ReadonlyArray<ICommitGraphEdge>
}

/** The result of laying out a list of commits as a graph. */
export interface ICommitGraphLayout {
  readonly rows: ReadonlyArray<ICommitGraphRow>

  /** The maximum number of columns used by any row. */
  readonly columnCount: number
}

/**
 * Lay out a list of commits as a graph of lanes.
 *
 * The commits must be ordered so that children always come before their
 * parents (`git log --date-order` or `--topo-order`). Parents that are not part
 * of the list (e.g. not loaded yet) keep their lane open until the end of the
 * list.
 *
 * Each lane keeps its column for as long as it is alive, which keeps lines
 * straight and the layout stable when more commits are appended.
 */
export function layoutCommitGraph(
  commits: ReadonlyArray<ICommitGraphNode>
): ICommitGraphLayout {
  // The SHA each column is waiting for, or null when the column is free.
  let lanes: ReadonlyArray<string | null> = []
  let laneColors: ReadonlyArray<number> = []
  let nextColor = 0
  let columnCount = 0

  const rows = new Array<ICommitGraphRow>()

  for (const commit of commits) {
    const existingColumn = lanes.indexOf(commit.sha)
    const column =
      existingColumn !== -1 ? existingColumn : firstFreeColumn(lanes)
    const color =
      existingColumn !== -1 ? laneColors[existingColumn] : nextColor++

    const top = lanes.flatMap((sha, c) =>
      sha === null
        ? []
        : [
            {
              from: c,
              to: sha === commit.sha ? column : c,
              color: laneColors[c],
            },
          ]
    )

    // Lanes converging into this commit end here.
    const nextLanes = lanes.map(sha => (sha === commit.sha ? null : sha))
    const nextColors = [...laneColors]
    const fromNode = new Array<ICommitGraphEdge>()
    // Columns whose lane starts at this commit's node.
    const startedAtNode = new Set<number>()

    const [firstParent, ...otherParents] = commit.parentSHAs

    setLane(nextLanes, nextColors, column, firstParent ?? null, color)
    if (firstParent !== undefined) {
      fromNode.push({ from: column, to: column, color })
      startedAtNode.add(column)
    }

    for (const parent of otherParents) {
      const parentColumn = nextLanes.indexOf(parent)
      if (parentColumn !== -1) {
        fromNode.push({
          from: column,
          to: parentColumn,
          color: nextColors[parentColumn],
        })
      } else {
        const newColumn = firstFreeColumn(nextLanes)
        const newColor = nextColor++
        setLane(nextLanes, nextColors, newColumn, parent, newColor)
        fromNode.push({ from: column, to: newColumn, color: newColor })
        startedAtNode.add(newColumn)
      }
    }

    const passingThrough = nextLanes.flatMap((sha, c) =>
      sha === null || startedAtNode.has(c)
        ? []
        : [{ from: c, to: c, color: nextColors[c] }]
    )

    columnCount = Math.max(
      columnCount,
      lanes.length,
      nextLanes.length,
      column + 1
    )

    rows.push({
      sha: commit.sha,
      column,
      color,
      isMerge: commit.parentSHAs.length > 1,
      top,
      bottom: [...passingThrough, ...fromNode],
    })

    const length = trimmedLength(nextLanes)
    lanes = nextLanes.slice(0, length)
    laneColors = nextColors.slice(0, length)
  }

  return { rows, columnCount }
}

function firstFreeColumn(lanes: ReadonlyArray<string | null>) {
  const free = lanes.indexOf(null)
  return free !== -1 ? free : lanes.length
}

function setLane(
  lanes: Array<string | null>,
  colors: Array<number>,
  column: number,
  sha: string | null,
  color: number
) {
  while (lanes.length <= column) {
    lanes.push(null)
    colors.push(0)
  }
  lanes[column] = sha
  colors[column] = color
}

/** The length of the lanes once trailing free columns are removed. */
function trimmedLength(lanes: ReadonlyArray<string | null>) {
  let length = lanes.length
  while (length > 0 && lanes[length - 1] === null) {
    length--
  }
  return length
}
