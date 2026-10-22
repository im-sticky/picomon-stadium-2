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

const to8 = (v) => (v << 3) | (v >> 2);
const WHITE = [31, 31, 31];
const BLACK = [0, 0, 0];

// Colour a grayscale strip of square frames. Each frame's white background is
// flood-filled from its own edges to transparent, so whites inside the
// Pokémon (eyes, markings) stay.
async function colour(src, palette, dest) {
  const { data, info } = await sharp(src).greyscale().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  if (h % w) throw new Error(`${src} is not a strip of square frames`);
  const shade = (p) => 3 - Math.round(data[p * info.channels] / 85);

  const clear = new Uint8Array(w * h);
  for (let top = 0; top < h; top += w) {
    const stack = [];
    for (let i = 0; i < w; i++) {
      stack.push(top * w + i, (top + w - 1) * w + i, (top + i) * w, (top + i) * w + w - 1);
    }
    while (stack.length) {
      const p = stack.pop();
      if (clear[p] || shade(p) !== 0) continue;
      clear[p] = 1;
      const x = p % w;
      const y = Math.floor(p / w);
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (y > top) stack.push(p - w);
      if (y < top + w - 1) stack.push(p + w);
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
  const front = await colour(find(id, "front.png"), palette, path.join(outDir, id, "front.png"));
  const back = await colour(find(id, "back.png"), palette, path.join(outDir, id, "back.png"));
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
