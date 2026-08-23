import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public/icons', { recursive: true });

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#7c3aed"/>
  <path d="M120 340 L190 340 L220 260 L260 400 L300 220 L330 340 L392 340"
    stroke="white" stroke-width="26" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;

const targets = [
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/icon-512.png', size: 512 },
  { file: 'public/icons/maskable-512.png', size: 512, padded: true },
  { file: 'public/icons/apple-touch-icon.png', size: 180 },
];

for (const t of targets) {
  const base = sharp(Buffer.from(svg)).resize(t.padded ? Math.round(t.size * 0.7) : t.size);
  if (t.padded) {
    await base
      .extend({
        top: Math.round(t.size * 0.15),
        bottom: Math.round(t.size * 0.15),
        left: Math.round(t.size * 0.15),
        right: Math.round(t.size * 0.15),
        background: '#7c3aed',
      })
      .png()
      .toFile(t.file);
  } else {
    await base.png().toFile(t.file);
  }
  console.log('wrote', t.file);
}
