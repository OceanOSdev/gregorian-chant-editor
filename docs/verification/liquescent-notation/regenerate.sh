#!/usr/bin/env sh
# Stage 10A liquescent research: reproduce the evidence in a scratch directory.
#
# Usage: sh regenerate.sh <empty-output-dir> [liberusualis.pdf] [GregorioRef.pdf]
#
# 1. Downloads the GregoBase #4577 GABC and the two 480x675 source scans
#    (Completorium O.P., Suarez, 1949, pp. 119-120) and the higher-resolution
#    annotated copy of the same pages attached to Gregorio issue #1, then crops
#    every liquescent occurrence. Crops are NOT committed: redistribution rights
#    for the 1949 scan are unknown, so they are regenerated locally on demand.
# 2. Renders comparison.tex (Greciliae default vs [op]) with Gregorio 6.0.0.
# 3. Optionally crops the Liber Usualis table (PDF page 22) and the
#    GregorioRef 6.0.0 font-table cells if those PDFs are supplied.
#
# Requires curl, ImageMagick (convert/montage), and for step 2 a working
# GregorioTeX 6.0.0 + LuaLaTeX installation (set TEXMFHOME if needed).
set -eu
out=${1:?output directory}
here=$(cd "$(dirname "$0")" && pwd)
mkdir -p "$out" && cd "$out"

curl -fsSL -o salve-4577.gabc 'https://gregobase.selapa.net/download.php?format=gabc&id=4577'
curl -fsSL -o p119.png https://gregobase.selapa.net/sources/13/132.png
curl -fsSL -o p120.png https://gregobase.selapa.net/sources/13/133.png
curl -fsSL -o issue1.png \
  https://cloud.githubusercontent.com/assets/213117/3530702/3e55bfd6-07a7-11e4-9d56-114f022d145a.png
curl -fsSL -o issue1-op-render.png \
  https://cloud.githubusercontent.com/assets/421318/8586622/ca511996-25be-11e5-9b9f-cb8a4b1c6e6f.png

# Crops from the issue #1 copy (1514x1108, both pages side by side).
crop() { convert issue1.png -colorspace Gray -crop "$1" +repage -filter Lanczos -resize 600% "$2"; }
crop 70x60+635+555 L1-ad-1-p119.png      # Ad (d/fg~), end of system 2
crop 70x60+490+675 L2-ad-2-p119.png      # Ad (d/fg~), system 3
crop 70x50+640+815 L3-eia-p119.png       # E- (fg>), end of system 4
crop 60x60+75+925 L4-ergo-p119.png       # er- (gh~), start of system 5
crop 110x60+590+925 L5-misericor-p119.png # cor- (.../hg~), end of system 5
crop 120x60+1290+380 L6-dulcis-p120.png  # dul- (gf~), system 3
crop 75x60+1380+265 S1-osten-p120.png    # ten (GABC c): single-note figure
crop 75x65+820+515 S2-virgo-p120.png     # Vir (GABC d): single-note figure
crop 120x60+1040+500 R-ordinary-pes-p119.png # ordinary stacked pes for scale
montage L1-*.png L2-*.png L4-*.png L3-*.png -tile 4x1 -geometry +6+6 ascending.png
montage L5-*.png L6-*.png S1-*.png S2-*.png -tile 4x1 -geometry +6+6 descending.png
convert issue1-op-render.png -crop 80x80+570+190 +repage -resize 400% op-render-ad.png
convert issue1-op-render.png -crop 70x70+1155+355 +repage -resize 500% op-render-eia.png

# Stage 10B: print (top) above the editor's own engraving (bottom), from the
# committed browser screenshot crop editor-in-score-1440.png.
pc() { convert "$1" -resize x300 -bordercolor white -border 6 "$2"; }
pc L1-ad-1-p119.png P-ad.png
pc L3-eia-p119.png P-eia.png
pc L4-ergo-p119.png P-ergo.png
convert L5-misericor-p119.png -crop 230x300+330+0 +repage -resize x300 P-cor.png
convert L6-dulcis-p120.png -crop 230x300+120+0 +repage -resize x300 P-dul.png
ec() { convert "$here/editor-in-score-1440.png" -crop "$1" +repage -filter Lanczos -resize 400% -bordercolor white -border 6 "$2"; }
ec 70x90+100+40 E-ad.png
ec 70x90+360+40 E-eia.png
ec 60x90+460+40 E-ergo.png
ec 60x90+545+40 E-cor.png
ec 60x90+645+40 E-dul.png
montage -label '%t' P-ad.png P-eia.png P-ergo.png P-cor.png P-dul.png \
  E-ad.png E-eia.png E-ergo.png E-cor.png E-dul.png \
  -tile 5x2 -geometry 300x300+8+8 print-vs-editor.png

# Gregorio comparison.
cp "$here/pairs.gabc" "$here/salve-excerpt.gabc" "$here/comparison.tex" \
  "$here/intervals.gabc" "$here/intervals.tex" .
if command -v lualatex >/dev/null 2>&1; then
  for tex in comparison intervals; do
    lualatex --interaction=nonstopmode --shell-escape $tex.tex >/dev/null
    lualatex --interaction=nonstopmode --shell-escape $tex.tex >/dev/null
  done
  pdftoppm -r 170 -png -singlefile comparison.pdf gregorio-roman-vs-op
  convert gregorio-roman-vs-op.png -trim +repage gregorio-roman-vs-op.png
  pdftoppm -r 150 -png -singlefile intervals.pdf gregorio-intervals
  convert gregorio-intervals.png -trim +repage gregorio-intervals.png
fi

if [ "${2:-}" ]; then
  pdftoppm -f 22 -l 22 -r 500 -png -singlefile "$2" liber-p22
  convert liber-p22.png -crop 1200x880+230+500 +repage -resize 70% liber-pxxij-liquescent-table.png
fi
if [ "${3:-}" ]; then
  # GregorioRef 6.0.0, appendix A.1 (pp. 276, 280) and A.2 Dominican (pp. 292, 296).
  for p in 276 280 292 296; do pdftoppm -f $p -l $p -r 200 -png -singlefile "$3" gregorioref-p$p; done
fi
echo "Evidence regenerated in $out"
