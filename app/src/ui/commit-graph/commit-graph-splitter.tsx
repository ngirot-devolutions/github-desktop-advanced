import * as React from 'react'
import { clamp } from '../../lib/clamp'

/** The number of pixels the keyboard arrows move the splitter by. */
const KeyboardStep = 10

interface ICommitGraphSplitterProps {
  /** The current height of the pane above the splitter. */
  readonly height: number
  readonly minimumHeight: number
  readonly maximumHeight: number

  /** Describes the pane being resized to screen reader users. */
  readonly label: string

  readonly onResize: (height: number) => void

  /** Called when the user double clicks the splitter. */
  readonly onReset: () => void
}

/**
 * A horizontal bar resizing the height of the pane above it, by dragging it
 * with the mouse or with the up and down arrows when focused.
 */
export class CommitGraphSplitter extends React.Component<ICommitGraphSplitterProps> {
  private startY: number | null = null
  private startHeight: number | null = null

  public componentWillUnmount() {
    this.stopDragging()
  }

  public render() {
    return (
      <button
        // Prevent form submission with this button
        type="button"
        className="commit-graph-splitter"
        aria-label={`${this.props.label}, use the up and down arrow keys`}
        onMouseDown={this.onMouseDown}
        onDoubleClick={this.props.onReset}
        onKeyDown={this.onKeyDown}
      />
    )
  }

  private resize(height: number) {
    const { minimumHeight, maximumHeight } = this.props
    this.props.onResize(clamp(height, minimumHeight, maximumHeight))
  }

  private onMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    this.startY = event.clientY
    this.startHeight = this.props.height
    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('mouseup', this.stopDragging)
    event.preventDefault()
  }

  private onMouseMove = (event: MouseEvent) => {
    if (this.startY !== null && this.startHeight !== null) {
      this.resize(this.startHeight + event.clientY - this.startY)
      event.preventDefault()
    }
  }

  private stopDragging = () => {
    this.startY = null
    this.startHeight = null
    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('mouseup', this.stopDragging)
  }

  private onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowUp') {
      this.resize(this.props.height - KeyboardStep)
      event.preventDefault()
    } else if (event.key === 'ArrowDown') {
      this.resize(this.props.height + KeyboardStep)
      event.preventDefault()
    }
  }
}
