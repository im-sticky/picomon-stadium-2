// Generates the weather icons in public/sprites/misc/ by colouring Polished
// Crystal's grayscale gfx/weather/*.png. Same approach as colour-icons.mjs: the
// PNGs' 4 gray shades are palette slots. The game picks each icon's palette in
// LoadWeatherIconSprite (engine/battle/core.asm) from the battle object palettes
// in gfx/battle_anims/battle_anims.pal.
//
// To rerun, clone Polished Crystal (only these folders are needed):
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/Rangi42/polishedcrystal.git /tmp/polishedcrystal
//   git -C /tmp/polishedcrystal sparse-checkout set gfx/weather gfx/battle_anims
// then from the repo root:
//   node scripts/colour-weather.mjs /tmp/polishedcrystal
//
// Usage: node scripts/colour-weather.mjs <polishedcrystal dir> [out dir] [scale]
// Defaults: out dir public/sprites/misc, scale 1 (matches the other misc icons).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [pcDir, outDir = "public/sprites/misc", scaleArg = "1"] = process.argv.slice(2);
if (!pcDir) throw new Error("usage: node scripts/colour-weather.mjs <polishedcrystal dir> [out dir] [scale]");
const scale = Number(scaleArg);

// battle_anims.pal lists gray, yellow, red, green, blue, brown (4 colours each).
const NAMES = ["gray", "yellow", "red", "green", "blue", "brown"];
const colours = [...fs.readFileSync(path.join(pcDir, "gfx/battle_anims/battle_anims.pal"), "utf8")
  .split("else")[0] // skip the MONOCHROME build
  .matchAll(/RGB (\d+), (\d+), (\d+)/g)].map((m) => m.slice(1).map(Number));
if (colours.length !== NAMES.length * 4) throw new Error(`expected ${NAMES.length * 4} colours in battle_anims.pal`);
const PALS = Object.fromEntries(NAMES.map((n, i) => [n, colours.slice(i * 4, i * 4 + 4)]));

// Weather icon -> palette, from LoadWeatherIconSprite.
const WEATHER = { rain: "blue", sun: "yellow", sandstorm: "brown", hail: "gray" };

const to8 = (v) => (v << 3) | (v >> 2);

fs.mkdirSync(outDir, { recursive: true });
for (const [file, pal] of Object.entries(WEATHER)) {
  const palette = PALS[pal].map((c) => c.map(to8));
  const { data, info } = await sharp(path.join(pcDir, "gfx/weather", `${file}.png`))
    .greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const shade = (p) => 3 - Math.round(data[p * info.channels] / 85);

  // Shade 0 (white) is transparent on GBC sprites, and in-game the icon sits on
  // the white battle background. Only clear the white reachable from the edges
  // so highlights inside the icon's border stay white on any background.
  const clear = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (clear[p] || shade(p) !== 0) continue;
    clear[p] = 1;
    const x = p % w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (p >= w) stack.push(p - w);
    if (p < w * (h - 1)) stack.push(p + w);
  }

  const out = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    if (!clear[p]) out.set([...palette[shade(p)], 255], p * 4);
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .resize(w * scale, h * scale, { kernel: "nearest" })
    .png().toFile(path.join(outDir, `weather-${file}.png`));
}
console.log(`wrote ${Object.keys(WEATHER).length} weather icons to ${outDir}`);
