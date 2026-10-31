# Built-in image generation prompts

Generated using the built-in `image_gen` tool, not the API/CLI fallback. All selected outputs were copied into `apps/web/public/assets/`; original returned PNGs remain alongside runtime exports. Normalization uses `scripts/normalize-assets.mjs`. The manifest records output IDs, roles, sizes, and anchors.

## Hall — opaque background

Reference: `docs/reference/temple-concept.png` (visual direction only). Transparent background: false.

```text
Use case: stylized-concept. Production game background asset, portrait 9:16. Reference image supplied is a visual reference only: use the main golden Buddhist temple scene, ignore ALL interface panels, text, people, thumbnails and blue UI. Create an original cohesive painted 2.5D Vietnamese Buddhist temple hall, frontal slightly elevated view, elaborate dark carved teak arches and columns with restrained antique gold ornament, hanging warm amber lanterns on both sides, deep dark sacred central alcove occupying upper half, empty raised altar platform around 45% height. IMPORTANT: no Buddha statue, no flowers in the center; leave space for a separate altar sprite. Lower half is a broad long red prayer carpet with ornate gold borders and symmetrical pale stone floor lanes, clear unobstructed room for animated visitors. Realistic spatial perspective, rich atmospheric depth, museum-quality handpainted animation background, deep burnt umber shadows, luminous amber highlights, warm restrained palette, visually detailed upper architecture and quieter floor. The central altar will later be added around x50%, y37%. Entire hall fills frame edge to edge. No people, no interface, NO words, letters, signs, logos, numbers or watermarks. Output portrait image ideally 1080x1920 or equivalent 9:16.
```

## Altar — transparent layer

References: approved generated `temple-hall.png`, then user concept. Transparent background: true.

```text
Use case: stylized-concept. Asset type: isolated game altar layer. Input reference image 1 is the approved golden Vietnamese temple hall and defines palette/lighting; input image 2 is user's concept reference. Make one coherent ornate golden seated Buddha altar assembly, straight-on view, serene respectful gilded seated Buddha with detailed round golden mandorla, lotus throne, slightly broad antique gold carved base, symmetrical pink lotus flowers and small brass offering bowls, censer, lit candles at lower sides. Museum-quality painted 2.5D animation background aesthetic matching the warm amber hall, deep gold details and bright central gold face, elegant and highly detailed. Full assembly entirely visible, silhouette from top of halo down to bottom pedestal, roughly square-to-portrait composition 4:5. Transparent background, actual alpha. No wall, no floor, no rectangular background, no scene, no people, no user interface, no text or watermarks, no cast shadow outside base. Object fills 85% of output with safe margins. This independent layer will be displayed about 620 pixels wide over the central empty niche in the reference hall.
```

## Visitors — transparent pose family

Reference: approved generated `temple-hall.png`, for lighting/style. Transparent background: true.

```text
Use case: stylized-concept. Asset type: game character pose atlas. Input reference shows golden temple and is only palette and art-style reference. Transparent sprite sheet, EXACTLY 4 equal columns and 2 equal rows, 8 cells total, landscape aspect ratio 2:1. Two small stylized Vietnamese adult temple visitors seen from BEHIND facing away toward an altar, handpainted 2.5D animation style, proportions about 3.5 heads tall, offwhite/light gray traditional modest temple robes, black hair, warm golden rim light. Row 1 is the SAME woman with black hair in a bun in all four cells. Row 2 is the SAME man with short black hair in all four cells. Column 1: standing upright with hands together. Column 2: seated kneeling upright on heels in prayer. Column 3: kneeling and deeply bowing forward with head lowered near floor. Column 4: kneeling upright offering a small pink lotus held forward. Each entire figure is isolated, separate, centered inside its equal cell with at least 40 pixels transparent gutter. Ground baseline is identical at bottom of each cell regardless of pose, standing is taller than kneeling. Consistent head size, body volume, hair, clothing, rear view, lighting, and brush treatment across poses. Do not add a sheet grid, labels, text, cast floor shadows, frame, mats, floor, altar, scene or watermark. Real alpha transparent background. Prefer 2048x1024 or equivalent 2:1 image.
```

The generated grid was treated as a candidate, then split by equal cells, alpha bounds inspected, shared row scale applied, and each ground point aligned to y=490 in 512×512 frames. The final atlas is 2048×1024. Actual alpha and decoded texture size are reported in `docs/qa/assets.json`. Scene captures show the family in the real renderer.
