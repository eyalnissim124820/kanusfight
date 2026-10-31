# Eyal – Complete Fighting Game Sprite Pack

**26 required animation scenarios, 68 individual frames**.

Every frame is delivered as one **1024 × 1024 RGB PNG**, with a standardized solid chroma-key green **#00FF00** background. Images are grouped by scenario in `sprites/<animation>/` and ordered with `_01`, `_02`, etc.

## Character

Eyal: thin build, bald head, full dark beard, round glasses, white T-shirt with four-color flower artwork, loose charcoal jeans, white high-top sneakers. His special attack is `laptopMeditation`, where he sits cross-legged with a laptop and releases blue-white lightning toward the right side of the screen.

## Contents

- `sprites/`: all 68 full-size images in the 26 animation folders.
- `manifest.json`: exact scenario IDs, frame counts, frame order, and suggested FPS.
- `animation_index.csv`: flat list of the 68 filenames with scenario descriptions.
- `preview_contact_sheet.png`: indexed visual overview.

## Usage and limitations

This is an AI-illustrated **concept/prototype** pack, not a frame-by-frame manually rigged or hand-polished production animation. The 38 later frames were cropped and enlarged from generated multi-pose sheets, and may contain softer details, 3/4-view poses, or alignment differences from the original 30 frames. All sprites have the same canvas size and are right-facing by design, but hitboxes, animation blending, ground registration, color spill, and some motion transitions should be manually checked before shipping a game. The chroma has been normalized to #00FF00 for easier keying.
