#!/usr/bin/env bash
# Requires: ImageMagick (convert)
set -e
SRC="assets/icons/icon-source.svg"
OUTDIR="assets/icons"
[ -f "$SRC" ] || { echo "Missing $SRC"; exit 1; }
convert -background none "$SRC" -resize 192x192 "$OUTDIR/icon-192.png"
convert -background none "$SRC" -resize 512x512 "$OUTDIR/icon-512.png"
echo "Generated icon-192.png and icon-512.png"