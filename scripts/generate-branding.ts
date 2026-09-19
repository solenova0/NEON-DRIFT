import { writeFile } from "node:fs/promises";
import sharp from "sharp";
import { THEME } from "../game/theme.ts";

const mark = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" fill="${THEME.palette.background}"/>
  <path d="M16 38V16h22M90 112h22V90" fill="none" stroke="${THEME.palette.orb}" stroke-width="4"/>
  <path d="M28 100V28h16l40 51V28h16v72H84L44 49v51Z" fill="${THEME.palette.primary}"/>
  <path d="m94 14 20 0 0 20Z" fill="${THEME.palette.secondary}"/>
</svg>`);

for (const [name, size] of [["icon.png", 64], ["apple-icon.png", 180]] as const) {
  const image = await sharp(mark).resize(size, size).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(new URL(`../app/${name}`, import.meta.url), image);
  console.log(`${name}: ${size}x${size}, ${image.length} bytes`);
}