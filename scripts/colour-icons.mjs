// Generates public/sprites/pokemon-icons/ by colouring Polished Crystal's grayscale
// gfx/icons/*.png with their in-game overworld icon palettes (normal, daytime).
// The PNGs' 4 gray shades are palette slots; the game picks a colour per
// species in data/pokemon/overworld_icon_pals.asm.
//
// To rerun, clone Polished Crystal (only these folders are needed):
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/Rangi42/polishedcrystal.git /tmp/polishedcrystal
//   git -C /tmp/polishedcrystal sparse-checkout set data constants gfx
// then from the repo root:
//   node scripts/colour-icons.mjs /tmp/polishedcrystal
//
// Usage: node scripts/colour-icons.mjs <polishedcrystal dir> [out dir] [scale]
// Defaults: out dir public/sprites/pokemon-icons, scale 2 (matches public/sprites/pokemon).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [pcDir, outDir = "public/sprites/pokemon-icons", scaleArg = "2"] = process.argv.slice(2);
if (!pcDir) throw new Error("usage: node scripts/colour-icons.mjs <polishedcrystal dir> [out dir] [scale]");
const scale = Number(scaleArg);
const read = (p) => fs.readFileSync(path.join(pcDir, p), "utf8");

// Daytime colours from gfx/icons/icons.pal / npc_sprites.pal (5-bit RGB).
const TAN = [31, 19, 10];
const MAIN = {
  RED: [31, 7, 1], BLUE: [10, 9, 31], GREEN: [7, 23, 3], PURPLE: [18, 4, 18],
  BROWN: [15, 10, 3], GRAY: [13, 13, 13], PINK: [31, 10, 11], TEAL: [3, 23, 21],
  YELLOW: [25, 25, 0], ORANGE: [31, 13, 0], AZURE: [4, 18, 31],
  WHITE: [20, 20, 20], BLACK: [10, 10, 10], TAN,
};
const to8 = (v) => (v << 3) | (v >> 2);

// Expand a table file into its rows, resolving `rept N - 1 ... endr` blocks.
function expand(text, lineRe, reptCounts) {
  const rows = [];
  let rept = null;
  for (const line of text.split("\n")) {
    const r = line.match(/^rept (NUM_\w+) - 1/);
    if (r) { rept = { n: reptCounts[r[1]], body: [] }; continue; }
    if (rept && line.startsWith("endr")) {
      for (let i = 0; i < rept.n; i++) rows.push(...rept.body);
      rept = null;
      continue;
    }
    const m = line.match(lineRe);
    if (m) (rept ? rept.body : rows).push({ value: m[1], comment: (m[2] || "").trim() });
  }
  return rows;
}

const miniText = read("data/pokemon/mini_icon_pointers.asm");
// Only count the cosmetic-form rows (after the NUM_SPECIES block).
const formsText = miniText.split("assert_table_length NUM_SPECIES\n")[1];
const count = (re) => (formsText.match(re) || []).length;
const reptCounts = {
  NUM_UNOWN: count(/mini_icon Unown[A-Z]\w*/g),
  NUM_ARBOK: count(/mini_icon Arbok ;/g),
  NUM_PIKACHU: count(/mini_icon Pikachu\w* ;/g),
  NUM_MAGIKARP: 13, // NUM_MAGIKARP is 14 (constants/pokemon_constants.asm)
};

const icons = expand(miniText, /^\tmini_icon (\w+)\s*(?:;(.*))?$/, reptCounts);
const pals = expand(
  read("data/pokemon/overworld_icon_pals.asm"),
  /^\ticonpal (\w+), \w+\s*(?:;(.*))?$/, // first arg = normal (non-shiny)
  reptCounts,
);
if (icons.length !== pals.length) {
  throw new Error(`table mismatch: ${icons.length} icons vs ${pals.length} palettes`);
}

// Icon label -> png file, from gfx/minis_icons.asm. Stacked labels
// (e.g. PikachuIcon:: / PikachuFlyIcon:: on their own lines) share the next INCBIN.
const labelToFile = {};
let pendingLabels = [];
for (const line of read("gfx/minis_icons.asm").split("\n")) {
  const label = line.match(/^(\w+)Icon::/);
  if (!label) { pendingLabels = []; continue; }
  pendingLabels.push(label[1]);
  const file = line.match(/INCBIN "gfx\/icons\/(\w+)\.2bpp/);
  if (file) {
    for (const l of pendingLabels) labelToFile[l] = file[1];
    pendingLabels = [];
  }
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const jobs = new Map(); // out name -> { file, colour }
const firstColour = {};
icons.forEach((icon, i) => {
  const file = labelToFile[icon.value];
  if (!file) throw new Error(`no icon file for ${icon.value}`);
  const [light, dark] = pals[i].value.replace(/^PAL_MON_/, "").split("_");
  if (light !== "TAN" || !MAIN[dark]) throw new Error(`unexpected palette ${pals[i].value}`);
  if (!(file in firstColour)) {
    firstColour[file] = dark;
    jobs.set(file, { file, dark });
  } else if (firstColour[file] !== dark) {
    // Same graphic, different colour (e.g. red Gyarados): emit a variant.
    jobs.set(`${file}_${slug(icon.comment || dark)}`, { file, dark });
  }
});

fs.mkdirSync(outDir, { recursive: true });
for (const [outName, { file, dark }] of jobs) {
  // Shade 0 (white) is transparent on GBC sprites; 1 = tan, 2 = main colour, 3 = black.
  const palette = [null, TAN, MAIN[dark], [0, 0, 0]].map((c) => c && c.map(to8));
  const { data, info } = await sharp(path.join(pcDir, "gfx/icons", `${file}.png`))
    .greyscale().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0; p < info.width * info.height; p++) {
    const colour = palette[3 - Math.round(data[p * info.channels] / 85)];
    if (colour) out.set([...colour, 255], p * 4);
  }
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize(info.width * scale, info.height * scale, { kernel: "nearest" })
    .png().toFile(path.join(outDir, `${outName}.png`));
}
console.log(`wrote ${jobs.size} icons to ${outDir}`);
