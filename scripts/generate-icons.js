import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 512x512 Master SVG Design with iOS-style squircle background, glowing gradients, and medical heartbeat-drop
const masterSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Background Gradient: Deep Clinical Teal & Slate -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#042f2e" />
      <stop offset="50%" stop-color="#0f3d3a" />
      <stop offset="100%" stop-color="#0d5f57" />
    </linearGradient>

    <!-- Pulse Glow Linear Gradient -->
    <linearGradient id="pulseGrad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="50%" stop-color="#2dd4bf" />
      <stop offset="100%" stop-color="#34d399" />
    </linearGradient>

    <!-- Drop Glow Gradient -->
    <linearGradient id="dropGrad" x1="20%" y1="0%" x2="80%" y2="100%">
      <stop offset="0%" stop-color="#14b8a6" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#064e3b" stop-opacity="0.6" />
    </linearGradient>

    <!-- Radial Glow Behind the Symbol -->
    <radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#2dd4bf" stop-opacity="0.4" />
      <stop offset="60%" stop-color="#14b8a6" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#042f2e" stop-opacity="0" />
    </radialGradient>

    <!-- Subtle Drop Shadow Filter for Depth -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#2dd4bf" flood-opacity="0.5" />
    </filter>

    <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="16" flood-color="#000000" flood-opacity="0.4" />
    </filter>
  </defs>

  <!-- Background: Rounded App Squircle -->
  <rect width="512" height="512" rx="115" fill="url(#bgGrad)" />

  <!-- Subtle Inner Border Highlight -->
  <rect x="2" y="2" width="508" height="508" rx="113" fill="none" stroke="#2dd4bf" stroke-opacity="0.25" stroke-width="4" />

  <!-- Radial Halo Glow -->
  <circle cx="256" cy="265" r="190" fill="url(#halo)" />

  <!-- Central Medical Drop Shape Silhouette (Subtle Backing) -->
  <path
    d="M 256 95
       C 256 95 365 240 365 330
       C 365 390 316 438 256 438
       C 196 438 147 390 147 330
       C 147 240 256 95 256 95 Z"
    fill="url(#dropGrad)"
    stroke="#2dd4bf"
    stroke-opacity="0.4"
    stroke-width="3"
    filter="url(#softShadow)"
  />

  <!-- Subtle Inner Drop Light Specular -->
  <path
    d="M 256 128
       C 256 128 340 250 340 325
       C 340 348 333 370 320 388"
    fill="none"
    stroke="#ffffff"
    stroke-opacity="0.22"
    stroke-width="4"
    stroke-linecap="round"
  />

  <!-- High-Precision Clinical Heartbeat / Glucose Wave (Iconic ECG Pulse) -->
  <path
    d="M 120 315
       L 190 315
       L 215 275
       L 240 365
       L 272 175
       L 302 345
       L 325 315
       L 392 315"
    fill="none"
    stroke="url(#pulseGrad)"
    stroke-width="22"
    stroke-linecap="round"
    stroke-linejoin="round"
    filter="url(#glow)"
  />

  <!-- Glowing Terminal Pulse Node -->
  <circle cx="392" cy="315" r="11" fill="#34d399" />
  <circle cx="392" cy="315" r="5" fill="#ffffff" />
</svg>`;

// Save Master SVG in public directory
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), masterSvg, 'utf-8');
console.log('Saved public/favicon.svg');

async function generateAll() {
  const svgBuffer = Buffer.from(masterSvg);

  // 1. Apple Touch Icon 180x180 (iPhone Home Screen)
  await sharp(svgBuffer)
    .resize(180, 180)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png (180x180)');

  // Precomposed variant for older iOS devices
  await sharp(svgBuffer)
    .resize(180, 180)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'apple-touch-icon-precomposed.png'));

  // 2. Favicons 32x32 and 16x16
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon-32x32.png'));
  console.log('Generated favicon-32x32.png');

  await sharp(svgBuffer)
    .resize(16, 16)
    .png()
    .toFile(path.join(publicDir, 'favicon-16x16.png'));
  console.log('Generated favicon-16x16.png');

  // 3. Android / PWA Icons: 192x192 & 512x512
  await sharp(svgBuffer)
    .resize(192, 192)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('Generated icon-192.png');

  await sharp(svgBuffer)
    .resize(512, 512)
    .png({ quality: 100 })
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('Generated icon-512.png');

  // 4. ICO file (32x32 PNG renamed/compatible with standard ICO)
  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('Generated favicon.ico');

  // 5. Web App Manifest for iOS & Android
  const manifest = {
    name: 'GlucoTrack — Дневник самоконтроля диабета',
    short_name: 'GlucoTrack',
    description: 'Клинический дневник самоконтроля сахарного диабета: учет глюкозы крови, болюса, базала и ХЕ',
    start_url: '/',
    display: 'standalone',
    background_color: '#090d16',
    theme_color: '#0f766e',
    orientation: 'portrait',
    icons: [
      {
        src: '/favicon-32x32.png',
        sizes: '32x32',
        type: 'image/png'
      },
      {
        src: '/apple-touch-icon.png',
        sizes: '180x180',
        type: 'image/png'
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ]
  };

  fs.writeFileSync(
    path.join(publicDir, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf-8'
  );
  console.log('Saved public/manifest.json');
}

generateAll().catch(console.error);
