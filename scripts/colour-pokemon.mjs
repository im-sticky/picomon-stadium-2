// Generates public/sprites/pokemon/<id>/{front,back}.png by colouring Polished
// Crystal's grayscale gfx/pokemon/*/ pics with their normal (non-shiny) palette,
// and data/pokemon-sprites.ts with each front pic's animation.
// Same approach as colour-icons.mjs: the PNGs' 4 gray shades are palette slots
// (white, light, dark, black); normal.pal holds the two middle colours.
// Only the Pokémon in data/pokemon/ are included.
//
// front.png is a vertical strip of square frames; frame 0 is the resting pic.
// anim.asm is the animation played when the Pokémon appears, anim_idle.asm the
// shorter one played after it on the stats screen. Their setrepeat/dorepeat
// loops are unrolled here so the front end can play each as a flat list.
//
// To rerun, clone Polished Crystal (only this folder is needed):
//   git clone --depth 1 --filter=blob:none --sparse https://github.com/Rangi42/polishedcrystal.git /tmp/polishedcrystal
//   git -C /tmp/polishedcrystal sparse-checkout set gfx/pokemon
// then from the repo root:
//   node scripts/colour-pokemon.mjs /tmp/polishedcrystal
//
// Usage: node scripts/colour-pokemon.mjs <polishedcrystal dir> [out dir] [scale]
// Defaults: out dir public/sprites/pokemon, scale 2 (matches public/sprites/pokemon-icons).
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [pcDir, outDir = "public/sprites/pokemon", scaleArg = "2"] = process.argv.slice(2);
if (!pcDir) throw new Error("usage: node scripts/colour-pokemon.mjs <polishedcrystal dir> [out dir] [scale]");
const scale = Number(scaleArg);
const tsOut = "data/pokemon-sprites.ts";

// Our species ids (Showdown ids, from data/pokemon/<id>.ts).
const ids = fs.readdirSync("data/pokemon")
  .filter((f) => f.endsWith(".ts") && f !== "index.ts" && f !== "types.ts")
  .map((f) => f.replace(/\.ts$/, ""))
  .sort();

// Showdown id -> Polished Crystal folder, where they differ. Arbok's default
// form is its Johto pattern.
const FOLDERS = {
  arbok: "arbok_johto", farfetchd: "farfetch_d", hooh: "ho_oh",
  mrmime: "mr__mime", porygonz: "porygon_z",
};

// Form folders (e.g. gyarados_plain) hold the form's front pic and anims; the
// base folder (gyarados) holds what the forms share, like the back pic.
function find(id, file) {
  const folder = FOLDERS[id] || id;
  const base = folder.replace(/_johto$/, "");
  for (const dir of [`${folder}_plain`, folder, base]) {
    const p = path.join(pcDir, "gfx/pokemon", dir, file);
    if (fs.existsSync(p)) return p;
  }
  throw new Error(`no ${file} for ${id}`);
}

// White gaps fully enclosed by the Pokémon's outline (between limbs, coils,
// branches) that the edge flood fill can't reach. Picked by eye, since eye
// whites and white markings look the same by the numbers. Each entry is
// [x, y, size]: the top-left pixel of the gap in a 1x frame and its pixel
// count, so it's only cleared in frames where that exact gap appears.
const GAPS = {
  ambipom: {
    front: [[47, 27, 108], [16, 28, 83], [47, 26, 111], [16, 28, 90], [16, 27, 90], [46, 27, 120]],
    back: [[27, 16, 11], [22, 21, 31]],
  },
  arbok: { front: [[15, 42, 11], [41, 29, 124], [43, 18, 168]] },
  corsola: { front: [[36, 16, 17]] },
  dodrio: { front: [[36, 41, 46]] },
  heracross: { front: [[13, 18, 34]] },
  honchkrow: { front: [[34, 45, 14], [34, 45, 15]] },
  houndoom: { front: [[24, 13, 30], [24, 14, 25], [24, 13, 28]] },
  kingler: { front: [[32, 16, 19]] },
  leafeon: { front: [[33, 26, 25], [33, 27, 19], [37, 16, 66]] },
  mewtwo: { front: [[30, 16, 12]] },
  persian: { back: [[7, 28, 36]] },
  raichu: { front: [[39, 17, 119]] },
  sudowoodo: { front: [[16, 15, 22], [32, 19, 16]], back: [[33, 23, 30], [12, 34, 10]] },
  sunflora: { front: [[23, 28, 14]] },
};

// The other way round for back pics: they're cropped by the image edge, so
// white parts of the Pokémon cut off at the edge (wings, fur, bellies) would
// be flood-filled away with the background. These stay white. Same [x, y, size]
// format as GAPS, also picked by eye.
const BACK_WHITES = {
  ampharos: [[21, 47, 3]],
  arcanine: [[43, 47, 1]],
  ariados: [[11, 47, 60]],
  articuno: [[38, 47, 31], [13, 47, 15], [1, 47, 1], [18, 47, 1]],
  azumarill: [[26, 47, 22], [15, 47, 15]],
  beedrill: [[15, 47, 49], [4, 47, 36], [10, 47, 22], [19, 47, 22], [2, 47, 7], [7, 47, 5], [12, 47, 3]],
  bellossom: [[23, 47, 45], [37, 47, 45], [11, 47, 43], [4, 47, 35], [9, 47, 1], [15, 47, 1], [21, 47, 1], [27, 47, 1]],
  blastoise: [[6, 47, 28], [11, 47, 1], [13, 47, 1], [42, 47, 1]],
  charizard: [[2, 47, 14], [25, 47, 7], [19, 47, 1], [21, 47, 1], [23, 47, 1]],
  corsola: [[6, 47, 16], [9, 47, 1], [11, 47, 1], [13, 47, 1]],
  delibird: [[1, 47, 72]],
  dewgong: [[5, 47, 287], [19, 47, 17], [32, 47, 2], [12, 47, 1], [14, 47, 1], [23, 47, 1]],
  donphan: [[4, 47, 5], [6, 47, 1]],
  dragonite: [[37, 47, 1], [39, 47, 1]],
  dunsparce: [[8, 47, 37]],
  electrode: [[34, 47, 32]],
  entei: [[2, 47, 225], [27, 47, 16], [33, 47, 14], [23, 47, 5], [11, 47, 1], [13, 47, 1], [15, 47, 1], [17, 47, 1], [19, 47, 1], [21, 47, 1], [39, 47, 1]],
  exeggutor: [[15, 47, 1], [17, 47, 1], [35, 47, 1], [37, 47, 1]],
  fearow: [[8, 47, 34], [2, 47, 14], [22, 47, 2], [6, 47, 1], [14, 47, 1], [16, 47, 1], [18, 47, 1], [20, 47, 1]],
  feraligatr: [[38, 47, 5], [45, 47, 2], [36, 47, 1]],
  flareon: [[4, 47, 369], [12, 47, 1], [25, 47, 1], [27, 47, 1]],
  glaceon: [[14, 47, 59], [24, 47, 1]],
  gyarados: [[1, 47, 1], [3, 47, 1]],
  heracross: [[2, 47, 3]],
  honchkrow: [[39, 47, 129]],
  hypno: [[2, 47, 1], [4, 47, 1], [6, 47, 1]],
  jolteon: [[30, 47, 227], [38, 47, 2], [16, 47, 1], [24, 47, 1], [26, 47, 1], [28, 47, 1], [34, 47, 1], [36, 47, 1]],
  jumpluff: [[1, 47, 14], [7, 47, 1], [0, 46, 1]],
  kabutops: [[38, 47, 43]],
  kangaskhan: [[2, 47, 4], [12, 47, 1]],
  kingdra: [[7, 47, 25], [2, 47, 3], [9, 47, 1], [11, 47, 1]],
  lapras: [[6, 47, 103], [23, 47, 8], [1, 47, 4], [28, 47, 1], [30, 47, 1]],
  lugia: [[8, 47, 149]],
  machamp: [[26, 47, 3], [32, 47, 1], [34, 47, 1], [36, 47, 1]],
  mamoswine: [[34, 47, 136]],
  marowak: [[7, 47, 21], [33, 47, 5], [11, 47, 1], [13, 47, 1]],
  meganium: [[3, 47, 1], [5, 47, 1], [7, 47, 1]],
  mewtwo: [[29, 47, 20], [1, 47, 14], [36, 47, 11], [10, 47, 9], [13, 47, 1]],
  moltres: [[2, 47, 156], [9, 47, 1]],
  mrmime: [[8, 47, 171], [40, 47, 7]],
  nidoqueen: [[5, 47, 1]],
  ninetales: [[7, 47, 39], [0, 47, 1], [18, 47, 1]],
  parasect: [[38, 47, 30]],
  pinsir: [[6, 47, 3]],
  quagsire: [[38, 47, 1]],
  raikou: [[15, 47, 1], [17, 47, 1], [19, 47, 1]],
  rapidash: [[6, 47, 162], [21, 47, 1], [23, 47, 1]],
  raticate: [[44, 47, 1]],
  sandslash: [[26, 47, 1], [28, 47, 1], [30, 47, 1], [32, 47, 1]],
  seaking: [[20, 47, 14], [1, 47, 28], [38, 47, 1]],
  shuckle: [[11, 47, 18], [37, 47, 5], [19, 47, 4], [28, 47, 2]],
  skarmory: [[23, 47, 17], [8, 47, 10], [13, 47, 1], [21, 47, 1], [27, 47, 1], [29, 47, 1]],
  slowbro: [[3, 47, 1], [5, 47, 1], [7, 47, 1]],
  slowking: [[20, 47, 49], [6, 47, 27], [37, 47, 15]],
  stantler: [[8, 47, 1], [10, 47, 1]],
  starmie: [[4, 47, 18], [17, 47, 1], [19, 47, 1]],
  steelix: [[1, 47, 5]],
  sudowoodo: [[29, 47, 8], [20, 47, 3]],
  suicune: [[19, 47, 10]],
  togekiss: [[6, 47, 205], [32, 47, 85], [4, 47, 1], [10, 47, 1], [12, 47, 1], [28, 47, 1], [30, 47, 1], [45, 47, 1]],
  victreebel: [[27, 47, 14], [12, 47, 1], [31, 47, 1], [33, 47, 1]],
  zapdos: [[9, 47, 16], [14, 47, 1], [16, 47, 1]],
};

const to8 = (v) => (v << 3) | (v >> 2);
const WHITE = [31, 31, 31];
const BLACK = [0, 0, 0];

// Colour a grayscale strip of square frames. Each frame's white background is
// flood-filled from its own edges to transparent, so whites inside the
// Pokémon (eyes, markings) stay; then the frame's enclosed `gaps` are cleared.
// `whites` are edge-touching white areas to keep out of the flood fill.
async function colour(src, palette, dest, gaps = [], whites = []) {
  const { data, info } = await sharp(src).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  if (h % w) throw new Error(`${src} is not a strip of square frames`);
  const shade = (p) => 3 - Math.round(data[p * info.channels] / 85);

  const clear = new Uint8Array(w * h);
  const kept = new Uint8Array(w * h);
  // White pixels connected to the starting ones within one frame.
  const region = (top, starts) => {
    const seen = new Set();
    const stack = [...starts];
    while (stack.length) {
      const p = stack.pop();
      if (seen.has(p) || clear[p] || kept[p] || shade(p) !== 0) continue;
      seen.add(p);
      const x = p % w;
      const y = Math.floor(p / w);
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (y > top) stack.push(p - w);
      if (y < top + w - 1) stack.push(p + w);
    }
    return seen;
  };
  for (let top = 0; top < h; top += w) {
    for (const [x, y, size] of whites) {
      const white = region(top, [(top + y) * w + x]);
      if (white.size === size) for (const p of white) kept[p] = 1;
    }
    const edges = [];
    for (let i = 0; i < w; i++) {
      edges.push(top * w + i, (top + w - 1) * w + i, (top + i) * w, (top + i) * w + w - 1);
    }
    for (const p of region(top, edges)) clear[p] = 1;
    for (const [x, y, size] of gaps) {
      const gap = region(top, [(top + y) * w + x]);
      if (gap.size === size) for (const p of gap) clear[p] = 1;
    }
  }

  const out = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    if (!clear[p]) out.set([...palette[shade(p)], 255], p * 4);
  }
  await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .resize(w * scale, h * scale, { kernel: "nearest" })
    .png().toFile(dest);
  return { size: w, frames: h / w };
}

// Parse an anim script into a flat list of [frame, duration] steps.
// dorepeat N decrements the counter set by setrepeat and, unless it hits 0,
// jumps back to command N, so a loop body runs setrepeat times in total.
function parseAnim(file, frameCount) {
  const cmds = fs.readFileSync(file, "utf8").split("\n")
    .map((l) => l.replace(/;.*/, "").trim()).filter(Boolean)
    .map((l) => {
      const [op, ...args] = l.split(/[\s,]+/);
      return { op, args: args.map(Number) };
    });
  const steps = [];
  let repeat = 0;
  for (let i = 0; i < cmds.length;) {
    const { op, args } = cmds[i++];
    if (op === "endanim") return steps;
    if (op === "setrepeat") repeat = args[0];
    else if (op === "dorepeat") { if (--repeat > 0) i = args[0]; }
    else if (op === "frame" && args.length === 2) {
      if (args[0] >= frameCount) throw new Error(`${file}: frame ${args[0]} out of range`);
      steps.push([args[0], args[1]]);
    } else throw new Error(`${file}: unknown command ${op}`);
  }
  throw new Error(`${file}: no endanim`);
}

const entries = [];
for (const id of ids) {
  const pal = [...fs.readFileSync(find(id, "normal.pal"), "utf8")
    .matchAll(/RGB (\d+), (\d+), (\d+)/g)].map((m) => m.slice(1).map(Number));
  if (pal.length !== 2) throw new Error(`expected 2 colours in ${id} normal.pal`);
  const palette = [WHITE, ...pal, BLACK].map((c) => c.map(to8));

  fs.mkdirSync(path.join(outDir, id), { recursive: true });
  const front = await colour(find(id, "front.png"), palette, path.join(outDir, id, "front.png"), GAPS[id]?.front);
  const back = await colour(find(id, "back.png"), palette, path.join(outDir, id, "back.png"), GAPS[id]?.back, BACK_WHITES[id]);
  entries.push({
    id,
    size: front.size * scale,
    frames: front.frames,
    backSize: back.size * scale,
    anim: parseAnim(find(id, "anim.asm"), front.frames),
    idle: parseAnim(find(id, "anim_idle.asm"), front.frames),
  });
}

const steps = (s) => `[${s.map(([f, d]) => `[${f}, ${d}]`).join(", ")}]`;
fs.writeFileSync(tsOut, `// Generated by scripts/colour-pokemon.mjs from Polished Crystal. Do not edit.

/** One animation step: [frame index in front.png, duration in game frames]. */
export type PokemonAnimStep = [frame: number, duration: number];

export interface PokemonSprite {
  /** Vertical strip of square frames; frame 0 is the resting pic. */
  front: \`/sprites/pokemon/\${string}/front.png\`;
  back: \`/sprites/pokemon/\${string}/back.png\`;
  /** Width and height of one front frame, in px. Frames are 80, 96 or 112. */
  size: number;
  /** Number of frames in the front strip. */
  frames: number;
  /** Width and height of the back pic, in px. */
  backSize: number;
  /** Played once when the Pokémon appears, then the pic returns to frame 0. */
  anim: PokemonAnimStep[];
  /** Shorter animation the game plays after \`anim\` on the stats screen. */
  idle: PokemonAnimStep[];
}

/** Length of one game frame in ms (the Game Boy runs at about 59.73 fps). */
export const GAME_FRAME_MS = 1000 / 59.7275;

export const pokemonSprites: Record<string, PokemonSprite> = {
${entries.map((e) => `  ${/^[a-z]\w*$/.test(e.id) ? e.id : JSON.stringify(e.id)}: {
    front: "/sprites/pokemon/${e.id}/front.png",
    back: "/sprites/pokemon/${e.id}/back.png",
    size: ${e.size},
    frames: ${e.frames},
    backSize: ${e.backSize},
    anim: ${steps(e.anim)},
    idle: ${steps(e.idle)},
  },`).join("\n")}
};
`);
console.log(`wrote ${entries.length} Pokémon to ${outDir} and ${tsOut}`);
