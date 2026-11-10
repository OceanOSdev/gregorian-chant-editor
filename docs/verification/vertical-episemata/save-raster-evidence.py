"""Retain native screenshots and measured comparisons; no image synthesis.

Usage: python3 save-raster-evidence.py firefox|chromium repeated-before.json
repeated-after.json pater-before.json pater-after.json print-before-dir print-after-dir
Requires the same local ImageMagick/Poppler diagnostics as the browser record.
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

browser, *inputs = sys.argv[1:]
if browser not in ('firefox', 'chromium') or len(inputs) != 6:
    raise SystemExit(__doc__)
root = Path(__file__).resolve().parent
reports = [json.loads(Path(p).read_text()) for p in inputs[:4]]
print_before, print_after = map(Path, inputs[4:])
pater_vectors = [Path(p).parent / 'canonical-ink.json' for p in inputs[2:4]]
assert pater_vectors[0].read_bytes() == pater_vectors[1].read_bytes()

def run(*args):
    return subprocess.run(args, check=True, capture_output=True).stdout

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

for label, report in zip(('before', 'after'), reports[2:]):
    for result in report['results']:
        name = {'desktop': 'desktop', 'narrow': '320', 'ordinary-960': 'ordinary', 'lower-score': 'lower'}[result['config']['name']]
        shutil.copyfile(result['screenshot'], root / f'raster-{browser}-{name}-{label}.png')

# Check all actual print pages, not PDF metadata or a single selected page.
for directory, label in ((print_before, 'before'), (print_after, 'after')):
    run('pdftoppm', '-r', '96', '-png', str(directory / f'print-{label}.pdf'), str(directory / 'page'))
old_pages = sorted(print_before.glob('page-*.png'))
new_pages = sorted(print_after.glob('page-*.png'))
assert len(old_pages) == len(new_pages) > 0
page_hashes = []
for before, after in zip(old_pages, new_pages):
    assert digest(before) == digest(after)
    page_hashes.append(digest(after))
assert (print_before / 'vector-ink.json').read_bytes() == (print_after / 'vector-ink.json').read_bytes()
for directory, label in ((print_before, 'before'), (print_after, 'after')):
    shutil.copyfile(sorted(directory.glob('page-*.png'))[-1], root / f'raster-{browser}-print-{label}.png')
shutil.copyfile(print_after / 'print-after.pdf', root / f'raster-{browser}-print.pdf')

# Enlarged actual pixels supplement, rather than replace, native-size score captures.
before = next(r for r in reports[0]['results'] if r['config']['name'] == 'ordinary-960')
after = next(r for r in reports[1]['results'] if r['config']['name'] == 'ordinary-960')
selected = sorted(before['samples'], key=lambda s: (s['darkColumns'], s['pixelPhase']))
selected = selected[:3] + selected[-3:]
with tempfile.TemporaryDirectory(prefix='chant-raster-board-') as temp:
    tiles = []
    for index, sample in enumerate(selected):
        match = next(s for s in after['samples'] if s['id'] == sample['id'])
        pair = []
        for label, value in (('Before', sample), ('After', match)):
            output = Path(temp) / f'{index}-{label}.png'
            run('convert', value['crop'], '-filter', 'point', '-resize', '600%',
                '-background', 'white', '-gravity', 'center', '-extent', '180x340',
                '-fill', '#201d19', '-font', 'DejaVu-Sans', '-pointsize', '12',
                '-gravity', 'north', '-annotate', '+0+4', label, str(output))
            pair.append(str(output))
        tile = Path(temp) / f'tile-{index}.png'
        run('convert', *pair, '+append', '+repage', str(tile))
        tiles.append(str(tile))
    rows = []
    for index in range(0, 6, 2):
        row = Path(temp) / f'row-{index}.png'
        run('convert', *tiles[index:index+2], '+append', '+repage', str(row))
        rows.append(str(row))
    run('convert', *rows, '-append', '+repage', '-background', 'white', '-gravity', 'north',
        '-splice', '0x40', '-fill', '#201d19', '-font', 'DejaVu-Sans', '-pointsize', '12',
        '-annotate', '+0+12', f'{browser}: actual pixels at 6x; unchanged vector dimensions',
        str(root / f'raster-{browser}-phases.png'))

# Keep all-sample summaries and representative extrema, avoiding a bulky DOM dump.
fields = ('id', 'x', 'y', 'width', 'height', 'scale', 'shiftPixels', 'pixelPhase',
          'peakCoverage', 'integratedWidth', 'darkColumns', 'coverage')
for report in reports:
    for result in report['results']:
        result.pop('screenshot', None)
        samples = result['samples']
        result['sampleCount'] = len(samples)
        result['maxAbsoluteShiftPixels'] = max(abs(s['shiftPixels']) for s in samples)
        selected = samples[:2]
        for key in ('pixelPhase', 'peakCoverage', 'darkColumns', 'shiftPixels'):
            selected.extend((min(samples, key=lambda s: s[key]), max(samples, key=lambda s: s[key])))
        unique = {s['id']: s for s in selected}
        result['samples'] = [{key: s[key] for key in fields} for s in unique.values()]
        result['sourceInkAssertions'] = {'width': 1.5, 'height': 7, 'stroke': 'none',
                                        'opacity': 1, 'noHeadOrStaffOverlap': True}
summary = {
    'browser': browser,
    'paterCanonicalVectorAttributesIdentical': True,
    'paterVectorAttributesSha256': digest(pater_vectors[0]),
    'repeatedBefore': reports[0],
    'repeatedAfter': reports[1],
    'paterBefore': reports[2],
    'paterAfter': reports[3],
    'print': {'pagesIdentical': len(page_hashes), 'pageSha256': page_hashes,
              'canonicalVectorAttributesIdentical': True,
              'beforePrintShifts': json.loads((print_before / 'print-shifts.json').read_text()),
              'afterPrintShifts': json.loads((print_after / 'print-shifts.json').read_text())},
}
(root / f'raster-{browser}.json').write_text(json.dumps(summary, indent=2) + '\n')
print(f'{browser}: retained native-size pairs, phase crops, vector PDF and {len(page_hashes)} identical print pages')
