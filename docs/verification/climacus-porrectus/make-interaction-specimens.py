"""Focused review artwork and standalone interaction demo; no app imports."""
from pathlib import Path
import json
from html import escape
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent
RECIPES = json.loads((OUT/'specimen-recipes.json').read_text())

def recipe(kind,a,b):
    return next(r for r in RECIPES if r['kind']==kind and r['intervals']==[a,b])

def path(d,attrs=''):
    return f'<path d="{d}" {attrs}/>'

def target(r,n,attrs):
    if 'hitShapes' in r:
        return path(r['hitShapes'][n],attrs)
    return '<rect '+ ' '.join(f'{k}="{v}"' for k,v in r['hitBounds'][n].items())+' '+attrs+'/>'

def text(x,y,s,size=14):
    return f'<text x="{x}" y="{y}" font-size="{size}">{escape(s)}</text>'

def ink(r):
    return '<g fill="#191919" pointer-events="none" aria-hidden="true">'+''.join(path(d) for d in r['ink'])+'</g>'

def diagram(r,n,state,scale=3,old=False):
    s=ink(r)
    if old:
        a,b=r['intervals'];t=12*(a-b)-6
        if b==1:t-=2
        bounds=r['hitBounds'][0].copy()
        bottom=bounds['y']+bounds['height']
        bounds['y']=min(-14,t-6);bounds['height']=bottom-bounds['y']
        s+='<rect '+' '.join(f'{k}="{v}"' for k,v in bounds.items())+' fill="#999" fill-opacity=".08" stroke="#888" stroke-dasharray="2 1" stroke-width=".5"/>'
    if state in ('pointer','focus','both'):
        attrs='fill="#1e64d2" fill-opacity=".15" stroke="#1e64d2" stroke-width="3" vector-effect="non-scaling-stroke"' if state!='pointer' else 'fill="#1e64d2" fill-opacity=".06" stroke="#1e64d2" stroke-width=".5" stroke-dasharray="2 1"'
        s+=target(r,n,attrs+' pointer-events="none" aria-hidden="true"')
    if state in ('selection','both'):
        s+=path(r['selections'][n],'fill="none" stroke="#c22f26" stroke-width="2.5" vector-effect="non-scaling-stroke" pointer-events="none" aria-hidden="true"')
    return s

parts=[text(24,32,'Interaction refinement · PROPOSAL ONLY',23),text(24,58,'Blue = pointer/focus region. Red = selected-note contour. Black engraving is unchanged.'),text(24,82,'Dashed gray = superseded Porrectus target. Focus follows the actual hit shape; no extra rectangle.')]
for row,(a,b) in enumerate([(1,3),(2,4)]):
    r=recipe('Porrectus',a,b);y=245+row*295
    parts.append(text(24,y-130,f'Porrectus ({a},{b}) · fixed top y=-14',18))
    for x,n,state,label in [(60,0,'pointer','Note 1 target · old extent in gray'),(340,0,'both','Note 1 selected + focused'),(630,2,'focus','Note 3 focused · independent')]:
        parts.append(f'<g transform="translate({x} {y}) scale(3)">'+diagram(r,n,state,old=x==60)+'</g>')
        parts.append(text(x,y+130,label,12))
r=recipe('Climacus',1,1)
parts.append(text(24,715,'Climacus (1,1) · middle note · polygonal focus',18))
for x,state,label in [(65,'selection','Selection only'),(350,'focus','Keyboard focus only'),(635,'both','Selection + keyboard focus')]:
    parts.append(f'<g transform="translate({x} 790) scale(3)">'+diagram(r,1,state)+'</g>')
    parts.append(text(x,930,label,13))
parts.append(text(24,985,'Native and reduced scale · middle Climacus note focused',16))
for x,scale in [(100,1),(360,.55)]:
    parts.append(f'<g transform="translate({x} 1020) scale({scale})">'+diagram(r,1,'both')+'</g>')
    parts.append(text(x,1080,f'{scale}×'))
parts.append(text(24,1120,'Target paths are aria-hidden, nonfocusable children. Only each named parent button enters the tab order.',12))
svg='<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1150" viewBox="0 0 960 1150"><title>Climacus and Porrectus selection and focus proposal</title><rect width="960" height="1090" fill="#fffdf8"/><g font-family="sans-serif">'+''.join(parts)+'</g></svg>'
ET.fromstring(svg)
(OUT/'interaction-details.svg').write_text(svg+'\n')

# Actual keyboard focus lives on named groups. Child targets remain decorative
# to accessibility APIs while participating in SVG pointer hit testing.
html=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Neume interaction review</title>', '''<style>
body{font:16px system-ui;margin:24px;background:#fffdf8;color:#191919}main{max-width:960px}section{margin:24px 0}svg{width:min(100%,720px);height:auto;border:1px solid #ddd} .note{outline:none;cursor:pointer}.hit{fill:transparent;pointer-events:fill}.note:focus-visible .hit{fill:rgb(30 100 210 / 15%);stroke:#1e64d2;stroke-width:3;vector-effect:non-scaling-stroke}.selection{fill:none;stroke:#c22f26;stroke-width:2.5;vector-effect:non-scaling-stroke;pointer-events:none}.note[aria-pressed="false"] .selection{display:none}button{font:inherit;padding:8px}small{display:block}
</style><main><h1>Interaction review only</h1><p>Tab between notes. Enter, Space or click selects a note. Blue follows keyboard focus; red follows selection. This standalone specimen does not implement editing or whole-neume commands.</p><button id="start">Start keyboard review here</button><p id="instructions">Three named note buttons per example, in musical order. Arrow-key editing is outside this specimen.</p>''']
for index,(kind,a,b) in enumerate([('Porrectus',1,3),('Porrectus',2,4),('Climacus',1,1)]):
    r=recipe(kind,a,b)
    html.append(f'<section><h2>{kind} ({a},{b})</h2><svg viewBox="-25 -48 180 115" aria-label="{kind} interaction specimen">'+ink(r))
    labels=['first','second','third'] if kind=='Porrectus' else ['highest','middle','lowest']
    for n in range(3):
        html.append(f'<g class="note" role="button" tabindex="0" aria-label="Select {labels[n]} note of {kind.lower()}" aria-describedby="instructions" aria-pressed="false" data-case="{index}" data-note="{n}">')
        html.append(target(r,n,'class="hit" aria-hidden="true" focusable="false"'))
        html.append(path(r['selections'][n],'class="selection" aria-hidden="true" focusable="false"'))
        html.append('</g>')
    html.append('</svg><small>Target children are hidden from accessibility APIs. Focus remains on the named parent button.</small></section>')
html.append('''<output id="status" aria-live="polite">No note selected.</output></main><script>
function select(note){document.querySelectorAll('.note').forEach(n=>n.setAttribute('aria-pressed',String(n===note)));document.querySelector('#status').textContent=note.getAttribute('aria-label').replace('Select ','Selected ')}
document.querySelectorAll('.note').forEach(note=>{note.addEventListener('click',()=>select(note));note.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select(note)}})})
</script></html>''')
(OUT/'interaction-demo.html').write_text('\n'.join(html)+'\n')
