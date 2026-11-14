#!/bin/sh
# Regenerate gregorio-cases.png and gregorio-marked.png from the committed
# GABC sources. Evidence tooling only; not an application dependency.
#
# Prerequisites (versions used for the committed images):
#   gregorio 6.0.0 (`gregorio --version`), a GregorioTeX 6.0.0 TeX tree whose
#   version matches the binary, LuaLaTeX (TeX Live), pdftoppm (Poppler) and
#   ImageMagick 6 `convert`.
#
# Configuration:
#   GREGORIOTEX_TEXMF  TEXMF root containing tex/luatex/gregoriotex for 6.0.0.
#                      Unset: use the TeX installation's own GregorioTeX.
#   GREGORIO           gregorio executable (default: gregorio).
#   OUT                output directory (default: a new temporary directory).
#
# Usage, from the repository root:
#   GREGORIOTEX_TEXMF=/path/to/texmf sh docs/verification/compound-directional-neumes/regenerate-gregorio.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
out=${OUT:-$(mktemp -d "${TMPDIR:-/tmp}/chant-9b3-gregorio-XXXXXX")}
gregorio_bin=${GREGORIO:-gregorio}
mkdir -p "$out"
cp "$here/cases.gabc" "$here/marked.gabc" "$here/comparison.tex" "$out/"
cd "$out"
if [ -n "${GREGORIOTEX_TEXMF:-}" ]; then
  TEXMFHOME=$GREGORIOTEX_TEXMF
  export TEXMFHOME
fi
"$gregorio_bin" --version | head -n 1
"$gregorio_bin" cases.gabc
"$gregorio_bin" marked.gabc
# Two passes settle GregorioTeX's line metrics.
lualatex -interaction=nonstopmode comparison.tex >/dev/null || true
lualatex -interaction=nonstopmode comparison.tex >build.log
pdftoppm -r 260 -png comparison.pdf hi
# Page 1: unmarked rows (TR, PF/SF, CR) then the first marked row (TR);
# page 2: the remaining marked rows (PF, SF, CR).
convert hi-1.png -crop 3481x700+0+60 +repage -resize 55% gregorio-cases.png
convert hi-1.png -crop 3481x330+0+880 +repage -trim +repage \
  -bordercolor white -border 12 -resize 55% marked-1.png
convert hi-2.png -trim +repage -bordercolor white -border 12 -resize 55% \
  marked-2.png
convert marked-1.png marked-2.png -background white -gravity west -append \
  gregorio-marked.png
echo "Wrote $out/gregorio-cases.png and $out/gregorio-marked.png"
