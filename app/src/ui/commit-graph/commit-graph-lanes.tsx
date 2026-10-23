import * as React from 'react'
import classNames from 'classnames'
import {
  ICommitGraphEdge,
  ICommitGraphRow,
} from '../../lib/commit-graph/layout'

/** The height of a row in the commit graph, in pixels. */
export const CommitGraphRowHeight = 28

/** The width of a single lane in the commit graph, in pixels. */
export const CommitGraphLaneWidth = 14

/** The number of distinct lane colors defined in the stylesheet. */
const LaneColorCount = 8

const NodeRadius = 4

interface ICommitGraphLanesProps {
  readonly row: ICommitGraphRow

  /** The width of the drawing area. Lanes beyond it are clipped. */
  readonly width: number

  /** Whether this commit is the one HEAD points to. */
  readonly isHead: boolean
}

/** Draws the lanes and the commit node of a single commit graph row. */
export class CommitGraphLanes extends React.PureComponent<ICommitGraphLanesProps> {
  public render() {
    const { row, width, isHead } = this.props
    const middle = CommitGraphRowHeight / 2

    const nodeClassName = classNames(
      'commit-graph-node',
      laneClass(row.color),
      {
        merge: row.isMerge,
        head: isHead,
      }
    )

    return (
      <svg
        className="commit-graph-lanes"
        width={width}
        height={CommitGraphRowHeight}
        aria-hidden="true"
      >
        {row.top.map((edge, i) => (
          <path
            key={`top-${i}`}
            className={classNames('commit-graph-edge', laneClass(edge.color))}
            d={edgePath(edge, 0, middle)}
          />
        ))}
        {row.bottom.map((edge, i) => (
          <path
            key={`bottom-${i}`}
            className={classNames('commit-graph-edge', laneClass(edge.color))}
            d={edgePath(edge, middle, CommitGraphRowHeight)}
          />
        ))}
        <circle
          className={nodeClassName}
          cx={laneCenter(row.column)}
          cy={middle}
          r={isHead ? NodeRadius + 1 : NodeRadius}
        />
      </svg>
    )
  }
}

/** The CSS class giving a lane its color. */
export function laneClass(color: number) {
  return `lane-color-${color % LaneColorCount}`
}

function laneCenter(column: number) {
  return column * CommitGraphLaneWidth + CommitGraphLaneWidth / 2
}

/** An SVG path going from the `from` lane at `y1` to the `to` lane at `y2`. */
function edgePath(edge: ICommitGraphEdge, y1: number, y2: number) {
  const x1 = laneCenter(edge.from)
  const x2 = laneCenter(edge.to)

  if (x1 === x2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }

  const ym = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${ym}, ${x2} ${ym}, ${x2} ${y2}`
}
