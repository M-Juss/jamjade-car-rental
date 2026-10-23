import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// The website header asset is the source for all application branding.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = path.join(root, 'web-frontend/public/JamJadeLogo-solid.png');
const mobile = path.join(root, 'mobile-frontend/assets/images');
const transparent = { r: 0, g: 0, b: 0, alpha: 0 };
const { data, info } = await sharp(source).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const theme = await fs.readFile(path.join(root, 'web-frontend/src/app/globals.css'), 'utf8');
const primary = theme.match(/--primary:\s*#([\da-f]{6})\s*;/i)?.[1];
if (!primary) throw new Error('The primary theme color must be a six-digit hex value.');
const rgb = [0, 2, 4].map(offset => Number.parseInt(primary.slice(offset, offset + 2), 16));

// Keep every alpha value and the original silhouette; branding uses one solid color.
for (let i = 0; i < data.length; i += 4) {
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
}
const logo = await sharp(data, { raw: info }).png().toBuffer();
await fs.writeFile(source, logo);
let left = info.width;
let top = info.height;
let right = 0;
let bottom = 0;

// Remove only transparent margins when exporting square platform icons.
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 0) {
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
}
const mark = await sharp(logo)
  .extract({ left, top, width: right - left + 1, height: bottom - top + 1 })
  .png()
  .toBuffer();

async function canvas(size, width, background, radius = 0) {
  const resized = await sharp(mark).resize({ width }).png().toBuffer();
  const metadata = await sharp(resized).metadata();
  const image = sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{
      input: resized,
      left: Math.round((size - metadata.width) / 2),
      top: Math.round((size - metadata.height) / 2),
    }])
    .png();
  if (!radius) return image.toBuffer();

  // Browser icons keep a white tile, with transparent softly rounded corners.
  const mask = Buffer.from(`<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="white"/></svg>`);
  return sharp(await image.toBuffer())
    .composite([{ input: mask, blend: 'dest-in' }])
    .png().toBuffer();
}

await fs.copyFile(source, path.join(mobile, 'JamJadeLogo-solid.png'));
await fs.copyFile(source, path.join(root, 'backend/public/images/JamJadeLogo-solid.png'));
const icon = await canvas(1024, 800, '#FFFFFF');
await fs.writeFile(path.join(mobile, 'icon.png'), icon);

// Keep the full silhouette inside Android's adaptive icon safe area.
const foreground = await canvas(1024, 580, transparent);
await fs.writeFile(path.join(mobile, 'android-icon-foreground.png'), foreground);
const { data: monochrome, info: monoInfo } = await sharp(foreground)
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
for (let i = 0; i < monochrome.length; i += 4) {
  monochrome[i] = monochrome[i + 1] = monochrome[i + 2] = 255;
}
await sharp(monochrome, { raw: monoInfo }).png()
  .toFile(path.join(mobile, 'android-icon-monochrome.png'));

const favicon = await canvas(64, 52, '#FFFFFF', 8);
await fs.writeFile(path.join(mobile, 'favicon.png'), favicon);
await fs.writeFile(path.join(root, 'web-frontend/src/app/icon.png'), favicon);
await sharp(icon).resize(180, 180).png()
  .toFile(path.join(root, 'web-frontend/src/app/apple-icon.png'));

// ICO directory entries point to PNG images at each browser icon size.
const sizes = [16, 32, 48];
const buffers = await Promise.all(sizes.map(size => canvas(size, Math.round(size * 52 / 64), '#FFFFFF', size / 8)));
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
buffers.forEach((buffer, i) => {
  const entry = 6 + 16 * i;
  header[entry] = header[entry + 1] = sizes[i];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(buffer.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += buffer.length;
});
await fs.writeFile(path.join(root, 'web-frontend/src/app/favicon.ico'), Buffer.concat([header, ...buffers]));
console.log('Synced website, mobile, and booking PDF logos and exported matching platform icons.');
