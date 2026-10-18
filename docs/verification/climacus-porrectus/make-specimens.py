"""Review artwork only; no application imports. Run with Python 3.

Reference outlines are embedded in reference-outlines.json, extracted from
Greciliae 6.1.0 using FreeType without hinting. Project paths are independent.
"""

from pathlib import Path
import json
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
ROWS = [(1, 1), (1, 2), (2, 1), (2, 2), (1, 3), (3, 1), (2, 4), (4, 2), (5, 5), (6, 2)]
NAMES = ['', 'One', 'Two', 'Three', 'Four', 'Five']
REF = json.loads((OUT / 'reference-outlines.json').read_text())


def path(d, **attrs):
    return '<path d="' + d + '" ' + ' '.join(f'{k.replace("_", "-")}="{v}"' for k, v in attrs.items()) + '/>'


def text(x, y, s, size=13):
    return f'<text x="{x}" y="{y}" font-size="{size}">{s}</text>'


def crown(x, y):
    return f'M{x},{y-4} C{x},{y-5.4} {x+3},{y-6} {x+6},{y-6} C{x+9},{y-6} {x+12},{y-5.4} {x+12},{y-4}'


def underside(x, y):
    return f'V{y+5.6} C{x+12},{y+5.9} {x+11.85},{y+6} {x+11.6},{y+6} C{x+9.8},{y+6} {x+8},{y+4.8} {x+6},{y+4.8} C{x+4},{y+4.8} {x+2.2},{y+6} {x+.4},{y+6} C{x+.15},{y+6} {x},{y+5.9} {x},{y+5.6}'


def box(x, y, w, h):
    return dict(x=x, y=y, width=w, height=h)


def clip_polygon(points, nx, ny, limit, keep_less=True):
    result = []
    for a, b in zip(points, points[1:] + points[:1]):
        da, db = nx*a[0]+ny*a[1]-limit, nx*b[0]+ny*b[1]-limit
        inside_a = da <= 0 if keep_less else da >= 0
        inside_b = db <= 0 if keep_less else db >= 0
        if inside_a:
            result.append(a)
        if inside_a != inside_b:
            t = da/(da-db)
            result.append((a[0]+t*(b[0]-a[0]), a[1]+t*(b[1]-a[1])))
    return result


def polygon_path(points):
    return 'M'+' L'.join(f'{x},{y}' for x,y in points)+' Z'


def recipe(kind, a, b):
    if kind == 'Climacus':
        # Horizontal center increments: ordinary tight descent, third, wider.
        h = 18 if a == 1 else 24 if a == 2 else 30
        k = 10.5 if b == 1 else 19.5 if b == 2 else 27
        anchors = [(6, 0), (6+h, 12*a), (6+h+k, 12*(a+b))]
        head = crown(0, 0) + underside(0, 0) + ' Z'
        # Right-side Virga stem; traced with the head as one contour.
        virga = crown(0, 0) + ' V27 H10.5 V5.9 C9,5.7 8,4.8 6,4.8 C4,4.8 2.2,6 .4,6 C.15,6 0,5.9 0,5.6 Z'
        heads = [head]
        for cx, cy in anchors[1:]:
            heads.append(f'M{cx-7},{cy} L{cx-1},{cy-10} L{cx+7},{cy-1} L{cx+1},{cy+10} Z')
        bounds = box(0, -6, anchors[2][0]+7, 12*(a+b)+16)
        # Initial head/stem versus diamond: disjoint horizontal ownership.
        c1 = (12 + anchors[1][0]-7)/2
        hits = [box(-6, -12, c1+6, 45), {}, {}]
        # A diagonal half-plane separates the inclinatums without clipping
        # their tips. Rectangle-only ownership cannot do that for tight b=1.
        nx, ny = 11/6, 1
        split = sum(nx*cx+ny*cy for cx,cy in anchors[1:])/2
        hit_shapes = [f'M-6,-12 H{c1} V33 H-6 Z']
        for i,(cx,cy) in enumerate(anchors[1:]):
            poly = [(cx-11,cy),(cx-1,cy-16),(cx+11,cy-1),(cx+1,cy+16)]
            poly = clip_polygon(poly,1,0,c1,False)
            poly = clip_polygon(poly,nx,ny,split,i==0)
            hit_shapes.append(polygon_path(poly))
            xs,ys=zip(*poly)
            hits[i+1]=box(min(xs),min(ys),max(xs)-min(xs),max(ys)-min(ys))
        return dict(ink=[virga, *heads[1:]], selections=heads, anchors=anchors, bounds=bounds, hitBounds=hits, hitShapes=hit_shapes, lyricAnchorX=6, advanceX=bounds['width']+33)
    u, v = 12*a, 12*(a-b)
    # Approximate width growth of the reference; adjacent final ascent needs
    # a broader ribbon. Values are project metrics, never copied outlines.
    w = 34 + 8*(a-1) + (4 if b == 1 else 0)
    z = w-12
    top = v-8 if b == 1 else v-6
    stem = 27 if a <= 2 else 39 if a == 3 else 45
    upper = f'M0,-8 C{.27*w},8 {.60*w},{u-12} {z},{u-5}'
    hook = f'C{w-7},{u-3} {w-3},{u-3} {w-1.5},{u-6}'
    lower = f'C{.60*w},{u+4} {.25*w},16 1.5,6'
    terminal = f'M{z},{top+2} C{z},{top+.6} {z+3},{top} {z+6},{top} C{z+9},{top} {w},{top+.6} {w},{top+2} V{v+6} H{w-1.5} Q{w-7},{v+3} {z},{v+4} Z'
    # Trace one outline. No overlapped head/connector paint operations.
    d = upper + hook + f' V{v+6} Q{w-7},{v+3} {z},{v+4} V{top+2} C{z},{top+.6} {z+3},{top} {z+6},{top} C{z+9},{top} {w},{top+.6} {w},{top+2} V{u+6} Q{w},{u+9} {w-3},{u+9} L{z},{u+7} ' + lower + f' V{stem} H0 Z'
    # Shared ribbon partition, not fictitious square heads. The left region
    # owns the long sweep; the second owns its lower right toe.
    first = upper + f' L{z},{u+7} ' + lower + ' L0,6 Z'
    second = f'M{z},{u-5} ' + hook + f' L{w},{u-6} V{u+6} Q{w},{u+9} {w-3},{u+9} L{z},{u+7} Z'
    split = (u+v)/2
    # Left ribbon never rises above -8; terminal height must not enlarge its
    # target. Retain six units of top padding independent of the final pitch.
    hits = [box(-6, -14, z+6, max(stem+6, u+15)+14), box(z, split, 18, u+15-split), box(z, top-6, 18, split-(top-6))]
    bounds = box(0, min(-8, top), w, max(stem, u+9)-min(-8, top))
    return dict(ink=[d], selections=[first, second, terminal], anchors=[(6,0),(w-6,u),(w-6,v)], bounds=bounds, hitBounds=hits, lyricAnchorX=6, advanceX=w+33)


def reference(kind, a, b, anchors):
    scale = 12/157.5
    if kind == 'Porrectus':
        if a > 5 or b > 5:
            return text(-8, 0, 'No sampled glyph', 7)
        name = f'Porrectus{NAMES[a]}{NAMES[b]}Nothing'
        return path(REF[name]['d'], transform=f'translate(0 6) scale({scale} {-scale})')
    # Authentic component outlines, but explicitly not a full TeX reference.
    s = path(REF['Virga']['d'], transform=f'translate(0 6) scale({scale} {-scale})')
    for cx, cy in anchors[1:]:
        s += path(REF['DescendensPunctumInclinatum']['d'], transform=f'translate({cx-7} {cy+6}) scale({scale} {-scale})')
    return s


def placeholder(ys):
    s = ''
    for i in (0, 1):
        s += f'<rect x="{(i+1)*12+.5}" y="{min(ys[i:i+2])-1.5}" width="3" height="{abs(ys[i+1]-ys[i])+3}"/>'
    for i,y in enumerate(ys):
        s += f'<rect x="{i*12}" y="{y-5.5}" width="15" height="11" rx="1"/>'
    return s


recipes = []
for kind in ('Climacus', 'Porrectus'):
    parts = []
    cursor = 155
    for index,(a,b) in enumerate(ROWS):
        r = recipe(kind,a,b)
        recipes.append(dict(kind=kind, intervals=[a,b], **r))
        height = max(360, r['bounds']['height']*2.5+100)
        baseline = cursor + 55 - min(0,r['bounds']['y'])*2.5
        parts += [text(18,cursor+20,f'({a}, {b})',18)]
        if a > 5:
            parts += [text(18,cursor+43,'PROJECT',11), text(18,cursor+58,'EXTRAPOLATION',11)]
        elif kind == 'Climacus' and a == 5:
            parts += [text(18,cursor+43,'Spacing plateau',11),text(18,cursor+58,'project choice',11)]
        for x,scale,mode in [(165,1,'old'),(310,1,'new'),(455,1.5,'ref'),(655,2.5,'new'),(900,.55,'new')]:
            parts.append(f'<g transform="translate({x} {baseline}) scale({scale})">')
            # Alternate line/space placements. Every panel still has four lines.
            offset = 12 if index%2 else 0
            for sy in (-48,-24,0,24):
                parts.append(path(f'M-15,{sy} H100',stroke='#bdafa2',stroke_width='.65',fill='none'))
            parts.append(f'<g transform="translate(0 {offset})">')
            if mode == 'old':
                parts.append(placeholder([p[1] for p in r['anchors']]))
            elif mode == 'ref':
                parts.append(reference(kind,a,b,r['anchors']))
            else:
                for n,d in enumerate(r['ink']):
                    bounds = r['bounds']
                    parts.append(path(d, **{'data-project-ink': f'{kind}-{a}-{b}-{scale}-{n}'}))
                for n,(ax,ay) in enumerate(r['anchors']):
                    parts.append(f'<circle cx="{ax}" cy="{ay}" r=".7" fill="#078665"/>')
                    if scale == 2.5:
                        parts.append(text(ax+10,ay+1,str(n+1),5) if kind=='Porrectus' and n==1 else text(ax+2,ay-12,str(n+1),5))
                        parts.append(path(r['selections'][n],fill='none',stroke=['#1e78bd','#bf4c30','#9c429e'][n],stroke_width='.55'))
                parts.append(path('M6,12 V20',stroke='#078665',stroke_width='.6'))
            parts.append('</g></g>')
        parts.append(text(130,cursor+height-15,f'Paint bounds {r["bounds"]}; advance {r["advanceX"]}',11))
        cursor += height
    # Separate controls on separate copies; include the tight case explicitly.
    for a,b in [(1,1),(2,2)]:
        r=recipe(kind,a,b)
        parts += [text(24,cursor+25,f'Constituent selection / hit ownership · ({a},{b}), 3×',19)]
        for n in range(3):
            parts.append(f'<g transform="translate({90+n*305} {cursor+105}) scale(3)">')
            for d in r['ink']: parts.append(path(d))
            parts.append(path(r['selections'][n],fill='none',stroke='#227ac2',stroke_width='.8'))
            hit=r['hitBounds'][n]
            if 'hitShapes' in r:
                parts.append(path(r['hitShapes'][n],fill='#2785cc',fill_opacity='.06',stroke='#2785cc',stroke_width='.3',stroke_dasharray='2 1'))
            else:
                parts.append('<rect '+ ' '.join(f'{k}="{v}"' for k,v in hit.items())+' fill="#2785cc" fill-opacity=".06" stroke="#2785cc" stroke-width=".3" stroke-dasharray="2 1"/>')
            for j,(ax,ay) in enumerate(r['anchors']):
                parts.append(f'<circle cx="{ax}" cy="{ay}" r=".8" fill="#078665"/>')
                parts.append(text(ax,ay-13,str(j+1),5))
            parts += ['</g>',text(90+n*305,cursor+290,f'Note {n+1}: '+(['left ribbon','lower ribbon toe','upper terminal'][n] if kind=='Porrectus' else ['Virga head','first inclinatum','second inclinatum'][n]))]
        cursor += 350
    parts += [text(24,cursor,'1× = one SVG unit per CSS px at intrinsic width. Reduced = 0.55×. Zooming changes both.',12),text(24,cursor+23,'Green = nominal pitch / first-note lyric axis. Color contours = interaction only; no colored ink at rest.',12),text(24,cursor+46,'Reference: Greciliae 6.1.0 actual outlines; nominal-cell baseline +6; no font dependency.',12)]
    if kind=='Climacus':
        parts += [text(24,cursor+69,'Reference uses authentic components with PROJECT spacing: not full GregorioTeX output.',12)]
    height=cursor+100
    header=[f'<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="{height}" viewBox="0 0 1050 {height}">',f'<title>{kind}: engraving construction review</title>',f'<rect width="1050" height="{height}" fill="#fffdf8"/>','<g font-family="sans-serif" fill="#191919">',text(24,32,f'{kind} · PROPOSAL ONLY · 2026-10-18',23),text(24,58,'Intervals = staff-position steps, not semitones. Alternating first pitches on staff line / space.'),text(24,80,'No application changes. Wide ranges intentionally extend outside the four-line staff; no ledger lines.')]
    for x,label in [(140,'Placeholder 1×'),(290,'Proposal 1×'),(440,'Greciliae 1.5×'),(635,'Contour 2.5×'),(880,'Reduced 0.55×')]: header.append(text(x,120,label))
    output='\n'.join(header+parts+['</g></svg>'])
    ET.fromstring(output)
    (OUT/f'{kind.lower()}.svg').write_text(output+'\n')
(OUT/'specimen-recipes.json').write_text(json.dumps(recipes,indent=2)+'\n')
