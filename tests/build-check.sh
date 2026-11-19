#!/usr/bin/env bash
# Builds the site with Jekyll (GitHub Pages' version) and checks the output. Usage: bash tests/build-check.sh
set -euo pipefail
cd "$(dirname "$0")/.."
JEKYLL="${JEKYLL:-$(command -v jekyll || echo "$HOME/.gem/ruby/2.6.0/bin/jekyll")}"
OUT=/tmp/site-build
fail() { echo "FAIL: $*"; exit 1; }
has() { grep -q -- "$2" "$OUT/$1" || fail "$1 lacks '$2'"; }

"$JEKYLL" build -q -d "$OUT" || fail "jekyll build"

# layout, header, footer
has index.html 'x.com/RdKarlsson'
has index.html 'href="/research.html"'
has index.html 'then tests pairs of variables for independence, one at a time'  # hero caption wording
# no leftovers from the old design
if grep -rlE 'DM Sans|2563eb|fonts\.googleapis' "$OUT" --include='*.html' --include='*.css' >/dev/null; then fail "old design leftovers"; fi
# design notes and tests are not published
[ ! -e "$OUT/docs" ] || fail "docs/ published"
[ ! -e "$OUT/tests" ] || fail "tests/ published"
[ -f "$OUT/fonts/texgyrepagella-regular.otf" ] || fail "font missing"
# unused files removed from the repo
for f in files/CV.pdf files/slides/detect-confounding.pdf img/rickard_photo.jpeg .htaccess; do [ ! -e "$f" ] || fail "$f still exists"; done

# second half of the home page: full name as the page heading, with a link to research
grep -q '<h1 class="me">Rickard Karlsson</h1>' "$OUT/index.html" || fail "home lacks the name heading"
[ "$(grep -c 'href="/research.html"' "$OUT/index.html")" -ge 2 ] || fail "home lacks a research link below the hero"

# research page: publications kept, Software section added, one header and footer
has research.html 'arxiv.org/abs/2205.13935'
has research.html '<h3>Software</h3>'
has research.html 'causal-falsify'
has research.html 'rct-checker'
has research.html 'arxiv.org/abs/2607.10470'      # ECCV 2026 optical flow paper
has research.html 'EXPObench: Benchmarking'       # full published title
has research.html '2026 (forthcoming)'            # Biometrics
has research.html 'uuid:6870dd1e-557a-462c-ae2e-2f7bb1204bdc'  # PhD thesis
[ "$(grep -c '<header' "$OUT/research.html")" = 1 ] || fail "research.html header count"
[ "$(grep -c '<footer' "$OUT/research.html")" = 1 ] || fail "research.html footer count"

# no blog for now: no page, no links to it; the note for agents is there
[ ! -e "$OUT/blog.html" ] || fail "blog.html still published"
if grep -rl 'blog' "$OUT" --include='*.html' --include='*.txt' >/dev/null; then fail "a page still mentions the blog"; fi
has llms.txt 'rickardkarlsson.com'

echo "BUILD OK"
