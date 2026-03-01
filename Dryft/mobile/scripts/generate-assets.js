#!/usr/bin/env node

/**
 * Asset Generation Script for Drift Mobile App
 *
 * This script generates placeholder assets for development.
 * Replace these with proper branded assets before production.
 *
 * Usage: node scripts/generate-assets.js
 *
 * For production assets, you'll need:
 * - icon.png: 1024x1024 app icon
 * - splash.png: 1284x2778 splash screen
 * - adaptive-icon.png: 1024x1024 Android adaptive icon foreground
 * - notification-icon.png: 96x96 notification icon (white on transparent)
 * - favicon.png: 48x48 web favicon
 */

const fs = require('fs');
const path = require('path');

// Minimal 1x1 purple PNG (base64)
// This is a valid PNG file, just 1 pixel
const PURPLE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

// Minimal 1x1 transparent PNG (base64)
const TRANSPARENT_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
  'base64'
);

// Minimal WAV file (silent, 1 sample)
const SILENT_WAV = Buffer.from([
  0x52, 0x49, 0x46, 0x46, // "RIFF"
  0x24, 0x00, 0x00, 0x00, // File size - 8
  0x57, 0x41, 0x56, 0x45, // "WAVE"
  0x66, 0x6D, 0x74, 0x20, // "fmt "
  0x10, 0x00, 0x00, 0x00, // Subchunk1 size (16)
  0x01, 0x00,             // Audio format (1 = PCM)
  0x01, 0x00,             // Num channels (1)
  0x44, 0xAC, 0x00, 0x00, // Sample rate (44100)
  0x88, 0x58, 0x01, 0x00, // Byte rate
  0x02, 0x00,             // Block align
  0x10, 0x00,             // Bits per sample (16)
  0x64, 0x61, 0x74, 0x61, // "data"
  0x00, 0x00, 0x00, 0x00, // Subchunk2 size (0)
]);

const assetsDir = path.join(__dirname, '..', 'assets');
const soundsDir = path.join(assetsDir, 'sounds');

const assets = [
  { name: 'icon.png', data: PURPLE_PIXEL_PNG, desc: '1024x1024 app icon' },
  { name: 'splash.png', data: PURPLE_PIXEL_PNG, desc: '1284x2778 splash screen' },
  { name: 'adaptive-icon.png', data: PURPLE_PIXEL_PNG, desc: '1024x1024 Android adaptive icon' },
  { name: 'notification-icon.png', data: TRANSPARENT_PIXEL_PNG, desc: '96x96 notification icon' },
  { name: 'favicon.png', data: PURPLE_PIXEL_PNG, desc: '48x48 web favicon' },
];

const sounds = [
  { name: 'notification.wav', data: SILENT_WAV, desc: 'Notification sound' },
  { name: 'match.wav', data: SILENT_WAV, desc: 'Match sound' },
];

console.log('🎨 Generating placeholder assets for Drift...\n');

// Ensure directories exist
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}
if (!fs.existsSync(soundsDir)) {
  fs.mkdirSync(soundsDir, { recursive: true });
}

// Generate image assets
console.log('📷 Image Assets:');
assets.forEach(({ name, data, desc }) => {
  const filePath = path.join(assetsDir, name);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, data);
    console.log(`  ✅ Created ${name} (${desc})`);
  } else {
    console.log(`  ⏭️  Skipped ${name} (already exists)`);
  }
});

// Generate sound assets
console.log('\n🔊 Sound Assets:');
sounds.forEach(({ name, data, desc }) => {
  const filePath = path.join(soundsDir, name);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, data);
    console.log(`  ✅ Created ${name} (${desc})`);
  } else {
    console.log(`  ⏭️  Skipped ${name} (already exists)`);
  }
});

console.log('\n✨ Done! Remember to replace placeholders with real assets before production.\n');

console.log('Asset Requirements:');
console.log('──────────────────────────────────────────────────────────────');
console.log('icon.png           1024x1024   Main app icon');
console.log('splash.png         1284x2778   Splash screen (iPhone 14 Pro Max)');
console.log('adaptive-icon.png  1024x1024   Android adaptive icon foreground');
console.log('notification-icon  96x96       White icon on transparent background');
console.log('favicon.png        48x48       Web favicon');
console.log('notification.wav   -           Push notification sound');
console.log('match.wav          -           New match celebration sound');
console.log('──────────────────────────────────────────────────────────────\n');
