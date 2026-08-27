import Cropper from 'cropperjs'

export const DEFAULT_IMAGE_CROPPER_TEMPLATE = `
  <cropper-canvas>
    <cropper-image></cropper-image>
    <cropper-shade hidden></cropper-shade>
    <cropper-handle action="select" plain></cropper-handle>
    <cropper-selection initial-coverage="1" movable resizable outlined>
      <cropper-handle action="move" theme-color="rgba(255, 255, 255, 0.35)"></cropper-handle>
      <cropper-handle action="n-resize"></cropper-handle>
      <cropper-handle action="e-resize"></cropper-handle>
      <cropper-handle action="s-resize"></cropper-handle>
      <cropper-handle action="w-resize"></cropper-handle>
      <cropper-handle action="ne-resize"></cropper-handle>
      <cropper-handle action="nw-resize"></cropper-handle>
      <cropper-handle action="se-resize"></cropper-handle>
      <cropper-handle action="sw-resize"></cropper-handle>
    </cropper-selection>
  </cropper-canvas>
`

export class ImageCropper {
  constructor(template = DEFAULT_IMAGE_CROPPER_TEMPLATE) {
    this.template = template
    this.cropper = null
    this.image = null
    this.container = null
    this.selection = null
    this.selectionChangeHandler = null
    this.constrainingSelection = false
  }

  start({ image, container, template } = {}) {
    this.destroy()
    if (!image || !container) {
      return null
    }
    this.image = image
    this.container = container
    this.cropper = new Cropper(image, {
      container,
      template: template || this.template,
    })
    return this.cropper
  }

  destroy() {
    if (this.selection && this.selectionChangeHandler) {
      this.selection.removeEventListener('change', this.selectionChangeHandler)
    }
    this.cropper?.destroy?.()
    this.cropper = null
    this.image = null
    this.container = null
    this.selection = null
    this.selectionChangeHandler = null
    this.constrainingSelection = false
  }

  getSelection() {
    return this.cropper?.getCropperSelection?.() || null
  }

  getSelectionSnapshot(selection = this.getSelection()) {
    if (!selection) {
      return null
    }
    return {
      x: Number(selection.x || 0),
      y: Number(selection.y || 0),
      width: Number(selection.width || 0),
      height: Number(selection.height || 0),
    }
  }

  getSelectionBounds(selection = this.getSelection()) {
    const canvas = selection?.parentElement
    return {
      width: Number(canvas?.clientWidth || canvas?.offsetWidth || 0),
      height: Number(canvas?.clientHeight || canvas?.offsetHeight || 0),
    }
  }

  constrainSelectionSnapshot(snapshot, selection = this.getSelection()) {
    if (!snapshot) {
      return null
    }
    const bounds = this.getSelectionBounds(selection)
    const width = Math.min(
      Math.max(0, Number(snapshot.width) || 0),
      bounds.width,
    )
    const height = Math.min(
      Math.max(0, Number(snapshot.height) || 0),
      bounds.height,
    )
    return {
      x: Math.min(Math.max(0, Number(snapshot.x) || 0), bounds.width - width),
      y: Math.min(Math.max(0, Number(snapshot.y) || 0), bounds.height - height),
      width,
      height,
    }
  }

  bindSelectionBounds(selection = this.getSelection()) {
    if (!selection) {
      return
    }
    this.selection = selection
    this.selectionChangeHandler = (event) => {
      if (this.constrainingSelection) {
        return
      }
      const next = this.constrainSelectionSnapshot(event.detail, selection)
      if (
        !next ||
        (next.x === event.detail.x &&
          next.y === event.detail.y &&
          next.width === event.detail.width &&
          next.height === event.detail.height)
      ) {
        return
      }
      event.preventDefault()
      this.constrainingSelection = true
      selection.$change(
        next.x,
        next.y,
        next.width,
        next.height,
        selection.aspectRatio,
        true,
      )
      this.constrainingSelection = false
    }
    selection.addEventListener('change', this.selectionChangeHandler)
  }

  async ready(initialSelection = null) {
    const image = this.cropper?.getCropperImage?.()
    await image?.$ready?.()
    const selection = this.getSelection()
    if (!selection) {
      return null
    }
    this.bindSelectionBounds(selection)
    const next = this.constrainSelectionSnapshot(
      initialSelection || this.getSelectionSnapshot(selection),
      selection,
    )
    if (next) {
      selection.$change(
        next.x,
        next.y,
        next.width,
        next.height,
        selection.aspectRatio,
        true,
      )
    }
    return selection
  }

  isSelectionChanged(
    initialSelection,
    selection = this.getSelection(),
    threshold = 0.5,
  ) {
    const current = this.getSelectionSnapshot(selection)
    if (!current || !initialSelection) {
      return false
    }
    return (
      Math.abs(current.x - initialSelection.x) > threshold ||
      Math.abs(current.y - initialSelection.y) > threshold ||
      Math.abs(current.width - initialSelection.width) > threshold ||
      Math.abs(current.height - initialSelection.height) > threshold
    )
  }

  getExportSize(
    selection = this.getSelection(),
    { fallbackWidth = 0, fallbackHeight = 0, fallbackImage = null } = {},
  ) {
    const renderedWidth =
      this.image?.getBoundingClientRect?.().width ||
      this.image?.clientWidth ||
      Number(fallbackWidth) ||
      0
    const renderedHeight =
      this.image?.getBoundingClientRect?.().height ||
      this.image?.clientHeight ||
      Number(fallbackHeight) ||
      0
    const naturalWidth = Number(
      this.image?.naturalWidth || fallbackImage?.naturalWidth || renderedWidth,
    )
    const naturalHeight = Number(
      this.image?.naturalHeight ||
        fallbackImage?.naturalHeight ||
        renderedHeight,
    )
    const scaleX =
      renderedWidth > 0 && naturalWidth > 0 ? naturalWidth / renderedWidth : 1
    const scaleY =
      renderedHeight > 0 && naturalHeight > 0
        ? naturalHeight / renderedHeight
        : 1

    return {
      width: Math.max(1, Math.round(Number(selection?.width || 0) * scaleX)),
      height: Math.max(1, Math.round(Number(selection?.height || 0) * scaleY)),
    }
  }

  async exportSelection(selection = this.getSelection(), options = {}) {
    if (!selection?.$toCanvas) {
      return null
    }
    const { width, height } =
      Number(options.width) > 0 && Number(options.height) > 0
        ? options
        : this.getExportSize(selection, options)
    return selection.$toCanvas({ width, height })
  }
}
