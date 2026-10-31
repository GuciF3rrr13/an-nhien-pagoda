import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
const root = new URL("../apps/web/public/assets/", import.meta.url);
const source = await sharp(new URL("visitors-source.png", root).pathname)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const { width, height, channels } = source.info;
const cellW = Math.floor(width / 4),
  cellH = Math.floor(height / 2),
  frames = [];
for (let row = 0; row < 2; row++) {
  const bounds = [];
  for (let col = 0; col < 4; col++) {
    let minX = cellW,
      minY = cellH,
      maxX = 0,
      maxY = 0;
    for (let y = 0; y < cellH; y++)
      for (let x = 0; x < cellW; x++)
        if (
          source.data[
            ((row * cellH + y) * width + col * cellW + x) * channels + 3
          ] > 32
        ) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
    if (maxY <= minY) throw new Error(`Missing visitor frame ${row}:${col}`);
    bounds.push({
      left: col * cellW + minX,
      top: row * cellH + minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    });
  }
  const scale = 448 / Math.max(...bounds.map((b) => b.height));
  for (let col = 0; col < 4; col++) {
    const b = bounds[col],
      w = Math.round(b.width * scale),
      h = Math.round(b.height * scale);
    const image = await sharp(source.data, { raw: source.info })
      .extract(b)
      .resize(w, h)
      .png()
      .toBuffer();
    const tile = await sharp({
      create: {
        width: 512,
        height: 512,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([
        { input: image, left: Math.round((512 - w) / 2), top: 490 - h },
      ])
      .png()
      .toBuffer();
    frames.push({ input: tile, left: col * 512, top: row * 512 });
  }
}
await sharp({
  create: {
    width: 2048,
    height: 1024,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(frames)
  .png()
  .toFile(new URL("visitors.png", root).pathname);
await sharp(new URL("temple-hall.png", root).pathname)
  .resize(1080, 1920, { fit: "fill" })
  .webp({ quality: 90 })
  .toFile(new URL("temple-hall.webp", root).pathname);
await sharp(new URL("altar.png", root).pathname)
  .resize({ width: 880 })
  .webp({ quality: 92, alphaQuality: 100 })
  .toFile(new URL("altar.webp", root).pathname);
const reports = [];
for (const [file, requireAlpha] of [
  ["temple-hall.webp", false],
  ["altar.webp", true],
  ["visitors.png", true],
]) {
  const img = sharp(new URL(file, root).pathname),
    meta = await img.metadata(),
    stats = await img.stats();
  const alpha = meta.hasAlpha ? stats.channels.at(-1) : null;
  if (requireAlpha && (!alpha || alpha.min !== 0 || alpha.max !== 255))
    throw new Error(`${file}: missing useful alpha`);
  reports.push({
    file,
    width: meta.width,
    height: meta.height,
    hasAlpha: meta.hasAlpha,
    alphaRange: alpha ? [alpha.min, alpha.max] : null,
    decodedBytes: meta.width * meta.height * (meta.hasAlpha ? 4 : 3),
  });
}
await mkdir(new URL("../docs/qa/", import.meta.url), { recursive: true });
await writeFile(
  new URL("../docs/qa/assets.json", import.meta.url),
  JSON.stringify(reports, null, 2) + "\n",
);
console.log(JSON.stringify(reports, null, 2));
