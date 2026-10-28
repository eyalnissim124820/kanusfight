# BEN — The Cocky Barber

Character-concept prototype sprite pack for a 2D side-view fighting game.

## Deliverables

- 68 PNG frames in 26 animation folders (`sprites/<animation>/<animation>_NN.png`).
- Each sprite is 1024 x 1024 pixels on a flat #00FF00 chroma green background.
- `preview_contact_sheet.png`: all 68 frames at a glance.
- `manifest.json`: list of frames, suggested animation rates, frame provenance, and design notes.
- `example_*.png`: a few 1:1 sprites to inspect.

## Character

Tall, lean, shirtless barber with wavy light-brown hair, short facial hair, silver earrings, brown leather barber apron, oversize blue jeans, black-and-white sneakers, and professional scissors. His poses have a cocky, teasing attitude.

**Signature special — Denim Lance:** the material of his jeans stretches into a stiff fabric-covered striking extension. It is the trousers themselves, never a stick or object emerging from inside them.

**Finisher — Perfect Cut:** charged professional scissors.

## Production limitations

These are concept sprites derived from AI-drawn contact sheets, rather than individual frames created at native 1024px resolution. They were separated, green-keyed, scaled, and a few missing intermediary frames were approximated. Color and body pose may vary, some frame edges may contain small artifacts, and interpolation is not motion-captured or hand-animated. Review poses, polish in-betweens, align hitboxes/origins, and inspect chroma-key edges before use in a shipped game.

Suggested floor pivot: approx. (512, 1000) px for standing sprites. Arial/jump frame origins retain additional vertical offsets.
