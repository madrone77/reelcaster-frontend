#!/usr/bin/env bash
#
# Build one Meta video ad: your footage underneath, the spot's overlay on top.
#
#   scripts/make-ad-video.sh <clip> <spot-slug> [format] [seconds] [out]
#
#   scripts/make-ad-video.sh boat.mov possession-point-b18acd 4x5 12 possession.mp4
#
# format defaults to 4x5 (1080x1350, the tallest thing Meta shows in feed).
# 1x1 and 9x16 are the other two. Seconds defaults to 12.
#
# The overlay comes from the running app, so point OVERLAY_BASE at whichever
# instance you trust:
#
#   OVERLAY_BASE=http://localhost:3014 scripts/make-ad-video.sh ...
#   OVERLAY_BASE=https://www.reelcaster.com scripts/make-ad-video.sh ...
#
# Footage is cropped to fill, never letterboxed: a black bar in a feed reads as
# a mistake. Shoot wider than you need and expect the sides or the top to go.
set -euo pipefail

CLIP="${1:?usage: make-ad-video.sh <clip> <spot-slug> [format] [seconds] [out]}"
SLUG="${2:?missing spot slug}"
FORMAT="${3:-4x5}"
SECONDS_OUT="${4:-12}"
OUT="${5:-${SLUG}-${FORMAT}.mp4}"
OVERLAY_BASE="${OVERLAY_BASE:-http://localhost:3014}"

case "$FORMAT" in
  4x5)  W=1080; H=1350 ;;
  1x1)  W=1080; H=1080 ;;
  9x16) W=1080; H=1920 ;;
  *) echo "format must be 4x5, 1x1 or 9x16" >&2; exit 1 ;;
esac

command -v ffmpeg >/dev/null || { echo "ffmpeg not installed: brew install ffmpeg" >&2; exit 1; }
[ -f "$CLIP" ] || { echo "no such clip: $CLIP" >&2; exit 1; }

OVERLAY="$(mktemp -t rc-overlay).png"
trap 'rm -f "$OVERLAY"' EXIT

URL="${OVERLAY_BASE}/api/ad-overlay/${SLUG}?format=${FORMAT}"
CODE=$(curl -sS -o "$OVERLAY" -w '%{http_code}' "$URL")
[ "$CODE" = "200" ] || { echo "overlay fetch failed ($CODE) from $URL" >&2; exit 1; }

# -stream_loop -1 so a clip shorter than the target simply repeats rather than
# ending early; -t cuts it back to length. The scale/crop pair fills the frame
# and takes the overflow off the centre.
#
# yuv420p and +faststart are not optional for Meta: other pixel formats show up
# as a black video in Ads Manager's preview, and without faststart the moov
# atom sits at the end of the file and playback stalls on first watch.
#
# A silent AAC track is added because some placements reject a video with no
# audio stream at all.
ffmpeg -y -loglevel error \
  -stream_loop -1 -i "$CLIP" \
  -i "$OVERLAY" \
  -f lavfi -t "$SECONDS_OUT" -i anullsrc=channel_layout=stereo:sample_rate=44100 \
  -filter_complex "\
    [0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,\
crop=${W}:${H},setsar=1,fps=30[bg];\
    [bg][1:v]overlay=0:0:format=auto[v]" \
  -map "[v]" -map 2:a \
  -t "$SECONDS_OUT" \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart \
  -c:a aac -b:a 128k -shortest \
  "$OUT"

echo "$OUT  ($(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "$OUT"), ${SECONDS_OUT}s)"
