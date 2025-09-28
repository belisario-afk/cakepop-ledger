#!/usr/bin/env bash
set -e
SRC="assets/icons/icon-source.svg"
OUT="assets/icons"
mkdir -p "$OUT"
convert -background none "$SRC" -resize 192x192 "$OUT/icon-192.png"
convert -background none "$SRC" -resize 512x512 "$OUT/icon-512.png"
convert -background none "$SRC" -resize 512x512 -gravity center -extent 512x512 "$OUT/icon-maskable-512.png"
echo "Generated icon-192.png, icon-512.png, icon-maskable-512.png"