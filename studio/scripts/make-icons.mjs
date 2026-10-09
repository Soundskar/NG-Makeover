// Builds the home-screen icons from public/favicon.svg.
// Run after changing the icon: node scripts/make-icons.mjs

import sharp from 'sharp';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url));
const out = (name) => new URL(`../public/${name}`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');

await sharp(svg, { density: 300 }).resize(192, 192).png().toFile(out('icon-192.png'));
await sharp(svg, { density: 300 }).resize(512, 512).png().toFile(out('icon-512.png'));

// Maskable: Android crops icons into circles and squircles, so the artwork
// sits inside the middle 80% on a full-bleed background.
const inner = await sharp(svg, { density: 300 }).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: '#000000' } })
  .composite([{ input: inner, gravity: 'center' }])
  .png()
  .toFile(out('icon-512-maskable.png'));

console.log('icons written');
