import * as React from 'react'
import classNames from 'classnames'
import { clamp } from '../../lib/clamp'

/** The number of pixels the keyboard arrows move the splitter by. */
const KeyboardStep = 10

interface ICommitGraphSplitterProps {
  /**
   * 'horizontal' : a bar resizing the height of the pane above it.
   * 'vertical'   : a handle resizing the width of the element on its left.
   */
  readonly orientation: 'horizontal' | 'vertical'

  /** The current size (height or width) of the resized element. */
  readonly size: number
  readonly minimumSize: number
  readonly maximumSize: number

  /** Describes the element being resized to screen reader users. */
  readonly label: string

  readonly onResize: (size: number) => void

  /** Called when the user double clicks the splitter. */
  readonly onReset: () => void
}

/**
 * A splitter resizing an element by dragging it with the mouse, or with the
 * arrow keys when focused.
 */
export class CommitGraphSplitter extends React.Component<ICommitGraphSplitterProps> {
  private start: number | null = null
  private startSize: number | null = null

  public componentWillUnmount() {
    this.stopDragging()
  }

  public render() {
    const keys =
      this.props.orientation === 'horizontal' ? 'up and down' : 'left and right'

    return (
      <button
        // Prevent form submission with this button
        type="button"
        className={classNames('commit-graph-splitter', this.props.orientation)}
        aria-label={`${this.props.label}, use the ${keys} arrow keys`}
        onMouseDown={this.onMouseDown}
        onDoubleClick={this.props.onReset}
        onKeyDown={this.onKeyDown}
      />
    )
  }

  private resize(size: number) {
    const { minimumSize, maximumSize } = this.props
    this.props.onResize(clamp(size, minimumSize, maximumSize))
  }

  private position(event: MouseEvent | React.MouseEvent) {
    return this.props.orientation === 'horizontal'
      ? event.clientY
      : event.clientX
  }

  private onMouseDown = (event: React.MouseEvent<HTMLButtonElement>) => {
    this.start = this.position(event)
    this.startSize = this.props.size
    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('mouseup', this.stopDragging)

    // Don't let a draggable parent (e.g. a column header) start dragging.
    event.preventDefault()
    event.stopPropagation()
  }

  private onMouseMove = (event: MouseEvent) => {
    if (this.start !== null && this.startSize !== null) {
      this.resize(this.startSize + this.position(event) - this.start)
      event.preventDefault()
    }
  }

  private stopDragging = () => {
    this.start = null
    this.startSize = null
    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('mouseup', this.stopDragging)
  }

  private onKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const [decrease, increase] =
      this.props.orientation === 'horizontal'
        ? ['ArrowUp', 'ArrowDown']
        : ['ArrowLeft', 'ArrowRight']

    if (event.key === decrease) {
      this.resize(this.props.size - KeyboardStep)
      event.preventDefault()
    } else if (event.key === increase) {
      this.resize(this.props.size + KeyboardStep)
      event.preventDefault()
    }
  }
}
