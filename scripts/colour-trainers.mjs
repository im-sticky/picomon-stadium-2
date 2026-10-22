// Generates public/sprites/trainers/ by colouring Polished Crystal's grayscale
// gfx/trainers/*.png with each trainer's battle palette (gfx/trainers/*.pal).
// Same approach as colour-icons.mjs: the PNGs' 4 gray shades are palette slots
// (white, light, dark, black); the .pal file holds the two middle colours.
// Only the gym leaders, Elite Four, Champion and a few extras (see TRAINERS) are coloured.
//
// To rerun, clone Polished Crystal (only this folder is needed):
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/Rangi42/polishedcrystal.git /tmp/polishedcrystal
//   git -C /tmp/polishedcrystal sparse-checkout set gfx/trainers
// then from the repo root:
//   node scripts/colour-trainers.mjs /tmp/polishedcrystal
//
// Usage: node scripts/colour-trainers.mjs <polishedcrystal dir> [out dir] [scale]
// Defaults: out dir public/sprites/trainers, scale 2 (matches public/sprites/pokemon-icons).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [pcDir, outDir = "public/sprites/trainers", scaleArg = "2"] = process.argv.slice(2);
if (!pcDir) throw new Error("usage: node scripts/colour-trainers.mjs <polishedcrystal dir> [out dir] [scale]");
const scale = Number(scaleArg);

// Polished Crystal file -> out name. The Champion's pic is Lance.
const TRAINERS = {
  // Johto gym leaders
  falkner: "falkner", bugsy: "bugsy", whitney: "whitney", morty: "morty",
  chuck: "chuck", jasmine: "jasmine", pryce: "pryce", clair: "clair",
  // Kanto gym leaders
  brock: "brock", misty: "misty", lt_surge: "lt_surge", erika: "erika",
  janine: "janine", sabrina: "sabrina", blaine: "blaine", blue: "blue",
  // Elite Four + Champion
  will: "will", koga: "koga", bruno: "bruno", karen: "karen", champion: "lance",
  // Kanto Elite Four and Red
  lorelei: "lorelei", agatha: "agatha", red: "red",
  // Others
  giovanni: "giovanni", carrie: "kris", cal: "gold", rival1: "silver",
};

const to8 = (v) => (v << 3) | (v >> 2);
const WHITE = [31, 31, 31];
const BLACK = [0, 0, 0];

fs.mkdirSync(outDir, { recursive: true });
for (const [file, outName] of Object.entries(TRAINERS)) {
  const pal = [...fs.readFileSync(path.join(pcDir, "gfx/trainers", `${file}.pal`), "utf8")
    .matchAll(/RGB (\d+), (\d+), (\d+)/g)].map((m) => m.slice(1).map(Number));
  if (pal.length !== 2) throw new Error(`expected 2 colours in ${file}.pal`);
  const palette = [WHITE, ...pal, BLACK].map((c) => c.map(to8));

  const { data, info } = await sharp(path.join(pcDir, "gfx/trainers", `${file}.png`))
    .greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const shade = (p) => 3 - Math.round(data[p * info.channels] / 85);

  // Trainer pics sit on an opaque white background; flood-fill it from the
  // edges to transparent so whites inside the figure (eyes, clothes) stay.
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
    .png().toFile(path.join(outDir, `${outName}.png`));
}
console.log(`wrote ${Object.keys(TRAINERS).length} trainers to ${outDir}`);
