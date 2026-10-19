# Picomon Stadium screen designs

Reference for building the app's screens. The designs are a Pokémon Crystal–style
mockup canvas. Its source lives in `design/canvas/project/` (one `.dc.html` file per
screen) and the live canvas is https://claude.ai/artifact/QDjonW53pXDkLC9z2h2WRo
(needs the owner's claude.ai sign-in).

## How to read the design files

Each `.dc.html` file is a self-contained prototype in the canvas's own format:

- `<helmet><style>`: shared classes for the frame, buttons, badges and so on.
- The markup inside `<x-dc>`: layout, with exact sizes as inline styles.
- `<script type="text/x-dc">` → `renderVals()`: state, hover/click handlers, copy
  and validation messages, and derived values.

The format is a prototype format, so don't copy it into the app:

- `{{name}}` is a lookup into `renderVals()`, `<sc-for>` is a loop and `<sc-if>` is
  a conditional.
- `<a href="Other.dc.html">` stands in for navigating to another screen.
- `/_blob/<id>` is the canvas's uploaded copy of a sprite. The real files are in
  `public/sprites/` (see [Sprite map](#sprite-map)).
- Some timers fake the other player's actions for the prototype. They are marked
  "Prototype only" in the code.

Rebuild screens as Next.js/React components that match the layout, sizes, colours
and interactions. Read the Next.js note in `AGENTS.md` before writing code.

## Screens and flow

```
Home ──HOST──▶ Lobby (waiting) ──P2 joins──▶ Lobby (full) ──START BATTLE──▶
Type select ──winner picks FIRST/SECOND──▶ Draft ──click a Pokémon──▶ Detail
Detail ──RENT──▶ Draft (with the rental) · Detail ──BACK──▶ Draft
Home ──JOIN──▶ Lobby (full)
```

| Board | File | What it shows |
|---|---|---|
| 0a Host or join | `Home.dc.html` | Name field, HOST, room code field, JOIN, message box |
| 0b Join error | `HomeError.dc.html` | `Home` with `error="not-found"` |
| 0c Waiting room | `Lobby.dc.html` | Room code cells, COPY, players list with empty P2 |
| 0d Both players in | `LobbyFull.dc.html` | `Lobby` with `full`: both players, START BATTLE |
| 1a Type select | `Main.dc.html` | Grass/Water/Fire rock-paper-scissors, VS, message box |
| 1b Type result | `Result.dc.html` | `Main` with `p1="fire" p2="grass"`: P1 wins, FIRST/SECOND |
| 2a Draft | `Draft.dc.html` | 10×4 Pokémon grid, team slots, hover info box |
| 2b Pokémon detail | `Detail.dc.html` | Sprite, types, ability, moves, stats, move box, RENT/BACK |
| 2c Draft after rentals | `DraftRented.dc.html` | `Draft` with P1 and P2 rentals shown as pokéballs |

The `b`/`c`/`d` boards that import another file are the same screen in a different
state, not separate screens.

## Screen behaviour

### Home (`Home.dc.html`)
- Name field: 1–12 characters, shown uppercase. Room code field: 4 characters from
  `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (matches `lib/codes.ts`).
- HOST (dark primary button) validates the name, then creates a room.
- JOIN (submit, so Enter joins) validates the name and code, then joins.
- The message box at the bottom shows the hint or the error:
  - default: "Enter your name, then host a / room or join one with a code."
  - no name: "Enter a name. / It can be 1-12 characters."
  - wrong code length: "Enter a 4-character / room code."
  - unknown room: "Room not found. / Check the code and try again."

### Lobby (`Lobby.dc.html`)
- Waiting: title "WAITING ROOM", the code as four framed 96×120 letter cells, and a
  COPY button that copies the code and shows "COPIED!" for 1.5s.
- Players list: `P1 <name> HOST`, and P2 as `- - - - - -` until someone joins.
- Message: "Send this code to a friend. / Waiting for PLAYER 2..."
- Full: title "ROOM <code>", the COPY button is hidden, and P2's name is shown.
  The message reads "Both players connected! / Ready to battle?" and a 384px-wide
  dark START BATTLE button sits centred below the message box.

### Type select (`Main.dc.html`)
- Your column (P1) is clickable. Hovering an option gives it a light grey background.
  Picking one frames it and dims the others.
- The opponent's column stays dimmed until both have picked, then their choice is
  framed. The centre shows `VS` → `. . .` (waiting) → `P1 WINS!` / `P2 WINS!` /
  `DRAW!`.
- Option frames are a fixed 288×156 so they're the same size whatever the label.
- Rules: Grass beats Water, Water beats Fire, Fire beats Grass.
- The winner chooses the draft order. If you win, FIRST (dark) and SECOND (light)
  buttons (216×108) appear on the right of the message box, beside "<A> beats <B>! /
  Pick FIRST or SECOND?". If the opponent wins, the message reads "PLAYER 2 is
  choosing the order...". A draw shows an AGAIN button that resets.

### Draft (`Draft.dc.html`)
- Title: "PLAYER n'S CHOICE" for whoever's turn it is.
- Team strip: six 64px slots per player (P1 left, P2 right). Picked slots show the
  Pokémon's icon, empty slots a faint pokéball. The centre shows picks left this turn.
- Grid: 40 Pokémon, 10×4, 108px cells with 96px sprites. Hover gives a light grey
  background and fills the info box. Click opens Detail.
- Rented Pokémon become a 96px pokéball: red for P1, blue for P2. They can be hovered
  ("Rented by PLAYER n.") but not opened.
- Info box: name with type badges on the right, then four moves in two columns.
- Snake order over 12 picks: `P1, P2, P2, P1, P1, P2, P2, P1, P1, P2, P2, P1`.

### Detail (`Detail.dc.html`)
- Top row: 128px sprite, name, type badges. On the right is the ability, with an
  "ABILITY" heading styled like MOVES/STATS and the name and description under it.
- Moves (left): each row shows the name with `PP x/x` right-aligned underneath.
  Hover, focus or click selects it (grey background).
- Stats (right): a LV.50 / BASE toggle. LV.50 is the default and sits on the left.
  - LV.50: `HP 155/155` with the HP bar (216px wide, right-aligned), then the other
    stats as label/value rows. Gen 4 formula at level 50, 31 IVs, 0 EVs, neutral
    nature: HP = ⌊(2B+31)·50/100⌋+60, others = ⌊(2B+31)·50/100⌋+5.
  - BASE: label, value and a coloured bar (bar length = value / 160), plus a total.
- Move box (bottom): category icon, type badge and `90P/100%` (power `---` for status
  moves) on one line, with the effect text below.
- Buttons: RENT (dark) and BACK, centred.

## Style tokens

### Type and scale
- Font: **Press Start 2P** (Google Fonts), `-webkit-font-smoothing: none`.
- Scale: 1 Game Boy pixel = 3 CSS px. Screens are 1200×900.
- Text sizes: 40px (home title), 32px (screen titles), 24px (body, message box, list
  items), 16px (section labels, badges, small text), 12px (HP bar label).
- Line heights: 48px for body text (Crystal's double-spaced rows), 32px for labels.
- Section labels (MOVES, STATS, ABILITY, NAME, ROOM CODE, PLAYERS): 16px uppercase,
  `#585858`.

### Colours
| Use | Value |
|---|---|
| Background | `#F8F8F8` |
| Ink (text, frame lines) | `#181818` |
| Secondary text | `#585858` |
| Placeholder / empty | `#A8A8A8` |
| Hover / focus fill | `#E8E8E8` |
| Player 1 | `#C03028` |
| Player 2 | `#2860B8` |

Type badge colours (white text):

| Type | Colour | Type | Colour |
|---|---|---|---|
| NORMAL | `#6E6E4E` | FLYING | `#6050B0` |
| FIRE | `#B8461A` | PSYCHIC | `#B82E62` |
| WATER | `#2F68C0` | BUG | `#5F6E10` |
| GRASS | `#2F7D3F` | ROCK | `#756628` |
| ELECTRIC | `#8C6E00` | GHOST | `#56468A` |
| ICE | `#2A7F7F` | DRAGON | `#4A30B8` |
| FIGHTING | `#A02820` | DARK | `#4A3A30` |
| POISON | `#8A3A8A` | STEEL | `#5E5E7A` |
| GROUND | `#80622A` | | |

Base stat bar colour by value:

| Value | Colour |
|---|---|
| 50 and below | `#E04030` red |
| 51–80 | `#F08830` orange |
| 81–110 | `#F0C830` yellow |
| 111–135 | `#40A848` green |
| above 135 | `#48B8E8` light blue |

### Components

**Crystal frame** (text boxes, panels, fields, code cells): a thick outer line, a gap,
then a thin inner line.
```css
border: 6px solid #181818;
border-radius: 6px;
box-shadow: inset 0 0 0 3px #F8F8F8, inset 0 0 0 6px #181818;
```
The inner line takes up the first 6px inside the border, so leave padding beyond that.

**Message box**: a Crystal frame, 30px 42px padding, two 24px lines at 48px line
height, min-height 168px. Prompts and errors go here, Crystal style.

**Button**: a Crystal frame, 240×108 (36px vertical / 24px horizontal padding),
24px centred text.
- Hover/focus: every button shows a ▶ cursor 30px from its left edge, positioned
  absolutely so the text stays centred (on primary buttons the cursor is light).
  Keyboard focus also gets a `#E8E8E8` fill.
- Primary (RENT, HOST, FIRST, START BATTLE): `background:#181818; color:#F8F8F8;
  box-shadow: inset 0 0 0 3px #181818, inset 0 0 0 6px #F8F8F8`.
- Wider labels widen the button and keep the 108px height (START BATTLE is 384px).
- Watch the CSS reset: an `a.btn { padding:0; border:0 }` rule outranks `.btn`
  and silently strips the padding and frame.

**▶ cursor**: an 8×8 pixel SVG, drawn at 24px.
```html
<svg width="24" height="24" viewBox="0 0 8 8" shape-rendering="crispEdges">
  <path d="M1 0h1v1h1v1h1v1h1v1h-1v1h-1v1h-1v1h-1z" fill="#181818"/>
</svg>
```

**Pixel-notched shapes** (type badges, the stat toggle, the HP bar): no outline, flat
fill, and one square block cut from each corner, matching the physical/special/status
icons.
```css
/* n = 4px for badges and the toggle, 3px for the HP bar */
clip-path: polygon(n 0, calc(100% - n) 0, calc(100% - n) n, 100% n,
  100% calc(100% - n), calc(100% - n) calc(100% - n), calc(100% - n) 100%,
  n 100%, n calc(100% - n), 0 calc(100% - n), 0 n, n n);
```
- Type badge: 148×28 (fits ELECTRIC/FIGHTING), 16px text centred, 28px line height.
  Next to a category icon, add a 4px bottom margin so the two line up (the icon art
  has 4px of empty space under it).
- Stat toggle: 28px tall, 10px side padding, 16px text. Unselected `#E8E8E8` on ink,
  selected ink on `#F8F8F8`.

**HP bar** (Crystal party screen style): 18px tall, `#181818` body with 3px notches.
On the left is a 12px "HP" label in `#F8B830`, then a 12px `#F8F8F8` track notched at
the right end, filled with `#40C048`.

**Selection and hover**
- Type options: hover gives a `#E8E8E8` background. Selected gets the Crystal frame.
  Others dim to 30% opacity.
- Draft cells and move rows: hover/selected gives a `#E8E8E8` background, no frame.
- Arrows: the ▶ cursor appears only inside buttons on hover/focus, never beside list
  items, type options or grid cells.

**Sprites**: `image-rendering: pixelated`, always at whole-number scales.
- Pokémon icons are 32×64 with two stacked animation frames. Show the top 32×32 in an
  `overflow:hidden` box: 96px in the grid, 64px in team slots, 128px on Detail.
- Type badges (`badge-*.png`) at 96px, pokéballs at 64–96px.
- Category icons are 32×16 shown at 64×32.
- The P2 pokéball is `pokeball.png` with `filter: hue-rotate(235deg)`.

## Sprite map

The design files reference sprites by canvas id. These are the matching repo files.

`public/sprites/misc/`:

| File | Id |
|---|---|
| badge-grass.png | `f56afe274514d342db8ca1be4dab8000` |
| badge-water.png | `34c9cdb7a33410bb98ae3b85477c9bbb` |
| badge-fire.png | `07561f08e88c6b9e56b03480cd904247` |
| pokeball.png | `fb383c33e038829411911e9eeb755646` |
| icon-pokeballball.png | `42adad1d7cf5061d3889e683f8adb86c` |
| icon-physical.png | `5e334b67f3a33e0aef7c6d7e44195045` |
| icon-special.png | `3ee4588b90c265212c90acc7ed0ffd95` |
| icon-status.png | `87ab199033fd3769fffdeae0ead39fa6` |
| icon-masterball.png | `1232bfea6d5fbe714ce6f5a04bb1772c` (not used yet) |

`public/sprites/pokemon-icons/` (the draft pool, in grid order):

| # | File | Id | # | File | Id |
|---|---|---|---|---|---|
| 1 | venusaur.png | `306822b5b874f91ba29da9143239f925` | 21 | meganium.png | `438fe50b84f72d8409bc5be6cf2c8445` |
| 2 | charizard.png | `fdc9afe1d3ee4535cc58e8d64c0fa82d` | 22 | typhlosion.png | `2ab5b35c6562ee9bc002398db8d93170` |
| 3 | blastoise.png | `17fbd00ba256194c1bb6229c837a8236` | 23 | feraligatr.png | `75811f7abf5913a3a1bffc651f321e80` |
| 4 | raichu.png | `12116b3c1ed02964fdf7c7c0ee361067` | 24 | ampharos.png | `89dfb3749bef90e99fe2979f7d693155` |
| 5 | nidoking.png | `dd91d63bbe065beedf1c16e774194570` | 25 | azumarill.png | `1b280762d3f2ec9199baaf6a45f05f97` |
| 6 | nidoqueen.png | `d0f4d67ce2240135666373a17189d0b6` | 26 | espeon.png | `6eb54a67a386c80b42172697faba72c4` |
| 7 | ninetales.png | `6911748f92ca0e1d5708851baa1fc098` | 27 | umbreon.png | `d9c40340fac330e0c4397407caca7eab` |
| 8 | arcanine.png | `b549b068a760cfac423e61bdb5d2cc64` | 28 | scizor.png | `f337c3d1d07de7d7ad52748ab67cf8c1` |
| 9 | alakazam.png | `c25458a95948aa9045b1bac83777ada4` | 29 | heracross.png | `0146f56a29d76e01016c2451d5bb7439` |
| 10 | machamp.png | `56adfc606d626b7878b3ec711b09a538` | 30 | skarmory.png | `50b4118af0ef5eace503910fe0569056` |
| 11 | gengar.png | `f777e20e17c63332aea4dab6a5721cbb` | 31 | houndoom.png | `c9919cdba2800d9e86121f0b58dc9972` |
| 12 | golem.png | `aa3e27dcb0e5c43b7904ea7a974b0638` | 32 | kingdra.png | `0595b79dd88b11df378d507e44c0937b` |
| 13 | slowbro.png | `0c62d17a0b81ef5fc1c9e628b9ccf156` | 33 | donphan.png | `75bfa2b8c623b76c29c81cd6e68931fe` |
| 14 | starmie.png | `22b72198a1d859b518905519db5f43af` | 34 | blissey.png | `17d01c5943b4048a5277bba5019196e1` |
| 15 | jynx.png | `84208ea82876e1dc4525a2a2ddcf32c6` | 35 | tyranitar.png | `a0c6aad3e5c4a34d09bd20acb400ca99` |
| 16 | gyarados.png | `db7415dad60d2c609f07bc348686093b` | 36 | crobat.png | `18c3d603516c234bded3b21bc7fd617c` |
| 17 | lapras.png | `30e03c98871bfb829d5c337179f2ab46` | 37 | steelix.png | `33edfe3e3a41ce86f9743189bc6e0f23` |
| 18 | snorlax.png | `8eca4cdf0e562954f2b141182ad432f5` | 38 | politoed.png | `5b5da011ebe735480619db9be738fddf` |
| 19 | dragonite.png | `70fdd9aa41dfbf01ce9085c9ee344623` | 39 | mantine.png | `4895dd543ff02fa462a8b9bedbf4a551` |
| 20 | aerodactyl.png | `80dddd5a92082476f68d053262f6fda3` | 40 | miltank.png | `b90aa033e69727c1872aecaa302dd7bb` |

The PICO-8 sprites in `public/sprites/pokemon/` (01–38) were uploaded to the canvas
early on but are no longer used.

## What's placeholder

- The draft pool is a sample, and the actual pool is still to be decided.
- Only Venusaur has moves, an ability and stats. Other Pokémon show `[MOVE]`.
- Player names (GOLD, SILVER) and the room code (K7QM) are samples.
- Both FIRST and SECOND go to the same draft board. A board where P2 drafts first
  doesn't exist yet.
- The designs are fixed 1200×900. Scaling to the window, and phone layouts, haven't
  been designed.
- The designs are still in progress, so check `git log design/` for the latest.
