/**
 * Build script: runs Vite build for each entry point separately.
 * IIFE format requires single-input builds, so we invoke three times.
 */

import { build } from 'vite';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { cpSync, mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const entries = [
  { name: 'content', path: 'src/content/index.ts', emptyOutDir: true },
  { name: 'background', path: 'src/background/index.ts', emptyOutDir: false },
  { name: 'popup', path: 'src/popup/popup.ts', emptyOutDir: false },
];

for (const entry of entries) {
  console.log(`\nBuilding ${entry.name}...`);
  await build({
    root,
    configFile: false,
    build: {
      outDir: 'dist',
      emptyOutDir: entry.emptyOutDir,
      rollupOptions: {
        input: { [entry.name]: resolve(root, entry.path) },
        output: {
          entryFileNames: '[name].js',
          format: 'iife',
        },
      },
      target: 'chrome120',
      minify: false,
    },
  });
}

// Copy static assets
console.log('\nCopying static assets...');
mkdirSync(resolve(root, 'dist'), { recursive: true });
cpSync(resolve(root, 'src/manifest.json'), resolve(root, 'dist/manifest.json'));
cpSync(resolve(root, 'src/styles/content.css'), resolve(root, 'dist/content.css'));
cpSync(resolve(root, 'src/popup/popup.html'), resolve(root, 'dist/popup.html'));
try {
  cpSync(resolve(root, 'assets/icons'), resolve(root, 'dist/icons'), { recursive: true });
} catch {
  // icons not created yet
}

console.log('\nBuild complete! Load dist/ as unpacked extension in Chrome.');
