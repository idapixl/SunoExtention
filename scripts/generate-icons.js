/**
 * Generate PNG extension icons from the SVG source.
 * Requires: npm install sharp (run once, not a project dependency)
 *
 * Usage: node scripts/generate-icons.js
 *
 * If sharp is not available, you can manually convert assets/icons/icon.svg
 * to PNG at sizes 16, 32, 48, 128 using any image tool.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const sizes = [16, 32, 48, 128];

async function main() {
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.log('sharp not installed. Install it with: npm install -g sharp');
    console.log('Or manually convert assets/icons/icon.svg to PNG at sizes:', sizes.join(', '));
    process.exit(1);
  }

  const svgPath = resolve(root, 'assets/icons/icon.svg');
  const svgBuffer = readFileSync(svgPath);
  const outDir = resolve(root, 'assets/icons');
  mkdirSync(outDir, { recursive: true });

  for (const size of sizes) {
    const outPath = resolve(outDir, `icon-${size}.png`);
    await sharp(svgBuffer).resize(size, size).png().toFile(outPath);
    console.log(`Generated ${outPath}`);
  }

  console.log('Done! Run npm run build to include icons in dist/.');
}

main();
