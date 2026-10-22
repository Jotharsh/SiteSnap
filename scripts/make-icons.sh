#!/bin/bash
# Generates every icon size the app needs from ONE 1024x1024 source image.
#
#   scripts/make-icons.sh [source.png]        (default: icons/source-1024.png)
#
# Needs either `sips` (built into macOS) or ImageMagick (`magick` or `convert`).
#
# The source should be a full-bleed square with NO transparency and NO rounded corners: phones add their own
# rounding. Keep the important artwork inside the central 80% so the "maskable" icon is not cropped.
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="${1:-icons/source-1024.png}"
[ -f "$SRC" ] || { echo "error: $SRC not found" >&2; exit 1; }

if command -v sips >/dev/null 2>&1; then
    TOOL=sips
    DIMS="$(sips -g pixelWidth -g pixelHeight "$SRC" | awk '/pixel(Width|Height)/{printf "%s ", $2}')"
elif command -v magick >/dev/null 2>&1; then
    TOOL=magick
    DIMS="$(magick identify -format '%w %h' "$SRC")"
elif command -v convert >/dev/null 2>&1; then
    TOOL=convert
    DIMS="$(identify -format '%w %h' "$SRC")"
else
    echo "error: install ImageMagick (brew install imagemagick / apt install imagemagick), or run this on a Mac." >&2
    exit 1
fi
set -- $DIMS
[ "$1" = "1024" ] && [ "$2" = "1024" ] || { echo "error: $SRC must be exactly 1024x1024 (it is ${1}x${2})" >&2; exit 1; }

resize() {   # resize <pixels> <output>
    case "$TOOL" in
        sips)    sips -z "$1" "$1" "$SRC" --out "$2" >/dev/null ;;
        magick)  magick "$SRC" -filter Lanczos -resize "${1}x${1}" "$2" ;;
        convert) convert "$SRC" -filter Lanczos -resize "${1}x${1}" "$2" ;;
    esac
    echo "  $2 (${1}x${1})"
}

mkdir -p icons
echo "Generating icons from $SRC with $TOOL:"
resize 192 icons/icon-192.png                # manifest, "any"
resize 512 icons/icon-512.png                # manifest, "any"
resize 512 icons/icon-maskable-512.png       # manifest, "maskable" (same art: it is already inside the safe zone)
resize 180 icons/apple-touch-icon.png        # iPhone / iPad home screen
resize 32  icons/favicon-32.png              # browser tab
echo "Done."
