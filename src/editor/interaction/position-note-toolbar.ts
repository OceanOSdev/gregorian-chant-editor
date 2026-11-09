/** Client-coordinate bounds, never engraving or semantic document data. */
export interface NoteToolbarBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface NoteToolbarPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
}

/** Keep a nonmodal panel inside the visible viewport and outside its note. */
export function positionNoteToolbar(
  note: NoteToolbarBounds,
  viewport: NoteToolbarBounds,
  size: { width: number; height: number },
): NoteToolbarPosition | null {
  const margin = 8;
  const gap = 8;
  const left = viewport.left + margin;
  const right = viewport.right - margin;
  const top = viewport.top + margin;
  const bottom = viewport.bottom - margin;
  const width = Math.min(size.width, right - left);
  if (width <= 0 || bottom <= top) return null;
  const x = Math.max(
    left,
    Math.min(right - width, (note.left + note.right - width) / 2),
  );
  const above = Math.max(0, Math.min(bottom, note.top - gap) - top);
  const below = Math.max(0, bottom - Math.max(top, note.bottom + gap));
  const height = Math.min(size.height, bottom - top);
  if (above >= height)
    return {
      left: x,
      top: Math.min(bottom, note.top - gap) - height,
      width,
      maxHeight: height,
    };
  if (below >= height)
    return {
      left: x,
      top: Math.max(top, note.bottom + gap),
      width,
      maxHeight: height,
    };
  const y = Math.max(
    top,
    Math.min(bottom - height, (note.top + note.bottom - height) / 2),
  );
  if (right - note.right - gap >= width)
    return { left: note.right + gap, top: y, width, maxHeight: height };
  if (note.left - gap - left >= width)
    return { left: note.left - gap - width, top: y, width, maxHeight: height };
  // Short/zoomed viewports get a scrollable panel, rather than covered notation.
  if (Math.max(above, below) < 40) return null;
  return above >= below
    ? { left: x, top, width, maxHeight: above }
    : { left: x, top: note.bottom + gap, width, maxHeight: below };
}
