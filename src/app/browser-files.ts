export function downloadText(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function fileStem(title: string) {
  return (
    title
      .replace(/[^\p{L}\p{N}_-]+/gu, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'chant'
  );
}

/** Export only painted notation. Never leak selection, hit targets or editor UI. */
export function scoreSvgSource(source: SVGSVGElement, title: string): string {
  const svg = source.cloneNode(true) as SVGSVGElement;
  svg
    .querySelectorAll(
      '.score__placement-preview, .score__placement-context, .score__note-selection, .score__neume-selection, .score__note-hit-target, .score__lyric-focus-cue, .score__move-target, .score__move-hit-target, .score__move-caption, foreignObject, .editor-sr-only, title, desc',
    )
    .forEach((node) => node.remove());
  svg.querySelectorAll('*').forEach((node) => {
    for (const attr of [...node.attributes]) {
      if (
        attr.name.startsWith('aria-') ||
        attr.name.startsWith('data-') ||
        ['tabindex', 'role'].includes(attr.name)
      )
        node.removeAttribute(attr.name);
    }
  });
  svg.removeAttribute('class');
  svg.removeAttribute('role');
  svg.removeAttribute('tabindex');
  for (const attr of [...svg.attributes])
    if (attr.name.startsWith('aria-')) svg.removeAttribute(attr.name);
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('color', '#201d19');
  svg.setAttribute('width', String(source.viewBox.baseVal.width));
  svg.setAttribute('height', String(source.viewBox.baseVal.height));
  const style = document.createElementNS(svg.namespaceURI, 'style');
  style.textContent =
    '.score__staff-line{stroke:currentColor;stroke-width:1.5}.score__ink,.score__clef{fill:currentColor}.score__lyric,.score__hyphen{fill:currentColor;font-family:Georgia,"Times New Roman",serif}';
  svg.prepend(style);
  const heading = document.createElementNS(svg.namespaceURI, 'title');
  heading.textContent = title;
  svg.prepend(heading);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    new XMLSerializer().serializeToString(svg)
  );
}
