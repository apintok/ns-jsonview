import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SOURCE = process.argv[2] || 'icon.svg';
const OUTPUT_DIR = process.argv[3] || 'public/icon';
const SIZES = [16, 32, 48, 96, 128];

async function generateIcons() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const sourceBuffer = fs.readFileSync(SOURCE);

  for (const size of SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `${size}.png`);
    await sharp(sourceBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toFile(outputPath);
    console.log(`Generated: ${outputPath} (${size}x${size})`);
  }

  console.log('\nAll icons generated successfully.');
}

generateIcons().catch((error) => {
  console.error(error);
  process.exit(1);
});
