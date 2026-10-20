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

## Building screens in the app

Home and the Lobby are built (`app/page.tsx`, `app/home-form.tsx`,
`app/room/[code]/`). Reuse their shared pieces for new screens rather than
restyling from scratch.

`app/ui/`, styled by `app/ui/crystal.module.css`:

| Component | Use |
|---|---|
| `Stage` | The fixed 1200×900 screen, centred in the window. Pass a `className` for the screen's own padding and layout. |
| `Frame` | Crystal double-line frame. `as` renders it as `div`, `section`, `form` or `span`. |
| `Button` | Crystal button with the ▶ cursor. `primary` gives the dark version. Defaults to `type="button"`. |
| `MessageBox` | The two-line message box. Takes a `Message` (`[line1, line2]`) and a `role` (`status` by default, `alert` for errors). |
| `Field`, `SectionLabel` | Framed text input, and the 16px grey section label. `SectionLabel` with `htmlFor` renders a real `<label>`. |
| `VisuallyHidden` | Text for screen readers only (e.g. the room code, whose letter cells are `aria-hidden`). |

The colours are CSS variables in `app/globals.css` (`--bg`, `--ink`, `--text-2`,
`--placeholder`, `--hover`, `--p1`, `--p2`). Press Start 2P is loaded with
`next/font/google` in `app/layout.tsx`.

Gotchas:
- **CSS module order isn't guaranteed.** To override a shared class from a screen's
  own module, use element plus class (`input.code`, `button.startButton`) so the
  override wins whatever order the stylesheets load in.
- **Next keeps earlier routes alive in `<Activity>`.** A hidden screen keeps its
  state, so reset things like a busy flag in an effect cleanup (see
  `home-form.tsx`). Page-wide DOM queries also find the hidden screen's elements.
- **Unbuilt screens:** a button that leads to a screen that doesn't exist yet gets
  no action. Don't add stub pages.

## Screens and flow

```
Home ──HOST──▶ Lobby (waiting) ──P2 joins──▶ Lobby (full) ──START BATTLE──▶
Type select ──winner picks FIRST/SECOND──▶ Draft ──click a Pokémon──▶ Detail
Detail ──RENT──▶ Draft (with the rental) · Detail ──BACK──▶ Draft
Draft complete ──host clicks START BATTLE──▶ Battle order ──both locked in, 2s──▶ Battle
Home ──JOIN──▶ Lobby (full)
```

| Board | File | What it shows |
|---|---|---|
| 0a Host or join | `Home.dc.html` | Name field, HOST, room code field, JOIN, message box |
| 0b Join error | `HomeError.dc.html` | `Home` with `error="not-found"` |
| 0c Waiting room | `Lobby.dc.html` | Room code cells, COPY, players list with empty P2 |
| 0d Both players in | `LobbyFull.dc.html` | `Lobby` with `full`: both players, START BATTLE |
| 1a Type select | `Main.dc.html` | Grass/Water/Fire rock-paper-scissors, VS, message box |
| 1b Type result | `Result.dc.html` | `Main` with `p1="fire" p2="grass"`: the host wins, FIRST/SECOND |
| 2a Draft | `Draft.dc.html` | Scrolling 9-column Pokémon grid, team slots, hover info box |
| 2b Pokémon detail | `Detail.dc.html` | Sprite, types, ability, moves, stats, move box, RENT/BACK |
| 2c Draft after rentals | `DraftRented.dc.html` | `Draft` with P1 and P2 rentals shown as pokéballs |
| 2e Draft complete | `DraftDone.dc.html` | `Draft` with all 12 picks made: START BATTLE in the bottom box |
| 2f Detail, view only | `DetailRented.dc.html` | `Detail` with `viewOnly` and `rentedBy="GOLD"`: opened from a team slot, BACK only |
| 3a Choose your order | `TeamOrder.dc.html` | Both teams in columns, pick your battle order into the pokéball slots |
| 3b Locked in | `TeamOrderLocked.dc.html` | `TeamOrder` with your full order chosen and the opponent 4 of 6 in |

The `b`/`c`/`d` boards that import another file are the same screen in a different
state, not separate screens.

## Screen behaviour

**Player names:** screens never say "Player 1" / "Player 2". They show the names
the players entered on Home, in uppercase (GOLD and SILVER in the designs). Player
1 is always the host and Player 2 the guest. That still decides column and strip
sides (host on the left), the red/blue player colours and the snake order.

### Home (`Home.dc.html`)
- Name field: 1–10 characters, shown uppercase. The cap is 10 so the longest
  name fits at 32px in every title and the type-select centre gap (the app's
  `lib/names.ts` currently allows 12 and needs lowering to match).
- Room code field: 4 characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (matches
  `lib/codes.ts`).
- HOST (dark primary button) validates the name, then creates a room.
- Battle size: three radio options under HOST: 3V3, 4V4 and 6V6 (6V6 selected
  by default). They sit on one 32px row, 24px apart, grouped as "Battle size" for
  screen readers.
  - Each radio is a 24px pixel square with a 3px ink border. Checked fills it
    with ink inside a 3px light inset.
  - The host's choice sets how many Pokémon each player sends into battle, which
    is the number of slots on the Battle order screen. It doesn't change the
    draft: each player always drafts 6.
  - The form's padding and gaps are 30/24px (not 36px) so the extra row fits.
- JOIN (submit, so Enter joins) validates the name and code, then joins.
- The message box at the bottom shows the hint or the error:
  - default: "Enter your name, then host a / room or join one with a code."
  - no name: "Enter a name. / It can be 1-10 characters."
  - wrong code length: "Enter a 4-character / room code."
  - unknown room: "Room not found. / Check the code and try again."
  - room full (from the server, no design copy): "Room is full." with a blank
    second line
  - any other failure: "Something went wrong. / Try again."
- The name field is limited to 10 characters and the code field to 4.

### Lobby (`Lobby.dc.html`)
- Waiting: title "WAITING ROOM", the code as four framed 96×120 letter cells, and a
  COPY button that copies the code and shows "COPIED!" for 1.5s. The app shows
  "COPIED!" only once the copy succeeds. COPY is 300px wide so it fits "COPIED!"
  without resizing.
- Players list: the host's name with a HOST tag, then the guest's name, shown as
  `- - - - - -` until someone joins. There are no P1/P2 labels.
- Message: "Send this code to a friend. / Waiting for an opponent..."
- Full: title "ROOM <code>", the COPY button is hidden, and the guest's name is shown.
  - Host: the message reads "Both players connected! / Ready to battle?" and a
    dark START BATTLE button (420px) sits centred below the message box. It has no
    action yet because the type battle screen doesn't exist.
  - Guest: no START BATTLE button. The message reads "Both players connected! /
    Waiting for <host name>..." (app copy; the design only shows the host's view).

### Type select (`Main.dc.html`)
- Each column is headed with that player's name. Your column (the host's, with a
  red YOU tag) is clickable. Hovering an option gives it a light grey background.
  Picking one frames it and dims the others.
- The opponent's column stays dimmed until both have picked, then their choice is
  framed. The centre shows `VS` → `. . .` (waiting) → the winner's name
  above `WINS!` (both 32px), or `DRAW!`. The centre gap is 336px, which fits the
  10-character name cap at 32px.
- Option frames are a fixed 288×156 so they're the same size whatever the label.
- Rules: Grass beats Water, Water beats Fire, Fire beats Grass.
- The winner chooses the draft order. If you win, FIRST (dark) and SECOND (light)
  buttons (216×108) appear on the right of the message box, beside "<A> beats <B>! /
  Pick FIRST or SECOND?". If the opponent wins, the message reads "<guest name> is
  choosing the order...". A draw shows an AGAIN button that resets.

### Draft (`Draft.dc.html`)
- Title: "<NAME>'S CHOICE" with the name of whoever's turn it is.
- Team strip: six 64px slots per player (P1 left, P2 right). Picked slots show the
  Pokémon's icon, empty slots a faint pokéball. The centre shows picks left this turn.
  - Drafted Pokémon in either team strip are clickable (hover gives a light grey
    background). Clicking one opens its Detail screen in a view-only state (board
    2f). That works during the draft and after it's complete, for both players'
    picks. In view-only:
    - the title reads "RENTED BY <NAME>" in place of "<NAME>'S CHOICE"
    - RENT is removed, and BACK is the only button (returning to the draft)
    - everything else on Detail (moves, stats toggle, ability, move box) works as
      normal
    - the design file's `viewOnly` and `rentedBy` props drive this state.
- Grid: 9 columns of 108px cells with 96px sprites, spread evenly across the
  width left of the scrollbar (each cell centred in an equal column), in a
  432px-tall box (4 rows visible) that scrolls vertically, since the real pool
  will be much larger. Hover
  gives a light grey background and fills the info box. Click opens Detail.
- Scrollbar: a custom, classic-style bar (the browser's own is hidden), aligned to
  the right edge of the grid area: 36px wide, 12px gap from the grid, 432px tall.
  - Up/down buttons (36×36) and the thumb are solid `#181818` with no border, and a
    touch of shading: a 3px `#585858` highlight on the top and left edges only. The
    buttons have light pixel ▲/▼ arrows.
  - Track: a 3px checkerboard dither of `#181818` and `#585858`, no border.
  - Up/down scroll one row (108px). Clicking the track pages up or down, and the
    thumb can be dragged. Its size follows how much of the list is visible
    (min 36px).
  - The scroll box stays keyboard-focusable, and the bar is hidden from screen
    readers because the box scrolls natively.
- Rented Pokémon become a 96px pokéball: red for P1, blue for P2. They can be hovered
  ("Rented by <NAME>.") but not opened.
- Info box: two columns, vertically centred, 48px apart.
  - Left (308px, the width of two type badges), stacked 8px apart:
    1. a 32px pokéball (`icon-pokeballball.png` at 2×) 12px left of the 24px
       name. Certain Pokémon show a Master Ball (`icon-masterball.png`, same size
       and place) instead; the design marks Dragonite, Tyranitar and Zapdos as
       samples.
    2. the type badges
    3. the ability name (16px), e.g. "Overgrow"
    4. the held item: 32px `icon-item.png` and the 16px item name, as on Detail
  - Right (the rest of the width): the four moves in a 2×2 grid (36px column gap,
    16px row gap). Each move shows its 24px name with `PP x/x` (16px)
    right-aligned underneath, as on Detail.
  - For a rented Pokémon, the right column shows "Rented by <NAME>." in place of
    the moves. The left column stays the same.
  - Heights: the left stack is 140px and the moves 128px, inside the box's 176px
    inner height.
- Snake order over 12 picks: `P1, P2, P2, P1, P1, P2, P2, P1, P1, P2, P2, P1`.
- Draft complete (all 12 picks made): the title reads "DRAFT COMPLETE", and both
  team strips are full.
  - The grid stays visible but is locked: unrented Pokémon can't be opened, and
    hovering no longer fills the info box.
  - The hint line is hidden but keeps its space.
  - The bottom box holds a single centred START BATTLE primary button (384×108)
    instead of the info. The host clicks it to move both players to the battle
    order screen.

### Battle order (`TeamOrder.dc.html`)
- Laid out like Type select: title "CHOOSE YOUR POKéMON ORDER", then two 480px
  columns, your team (host) on the left and the opponent's on the right
  (mirrored), and the message box at the bottom.
- Each column is headed with the player's name (yours with the red YOU tag). Below
  the name is a row of faded pokéball slots, like the draft's team strip (64px
  slots, 32px `icon-pokeballball.png` at 20% opacity, 8px gaps). P2's balls are
  tinted blue.
- The number of slots is the battle size the host picked on Home: 3, 4 or 6. Each
  player always drafted 6, so the list below always has 6 Pokémon and you pick
  your first 3, 4 or 6 in order. A full row of 6 is 424px and fits the column
  comfortably. In the prototype the board reads the host's Home choice (handed
  over through `localStorage` key `picomon.battleSize`, since boards don't share
  state); its `count` prop overrides that. The app keeps the size on the room.
- Under the slots is that player's drafted team (all 6) as a vertical list: rows
  66px tall with a 64px icon and the 24px name, 4px apart.
- Your rows are buttons (light grey hover, no arrow). Clicking one puts its icon
  in your next empty slot, and that row becomes disabled (30% opacity). The first
  slot is the lead. The opponent's rows are display only.
- Message box:
  - while choosing: "Choose the order of your team." with a blank second
    line
  - once every slot is filled: "Locked in!" / "Waiting to start...", and all your
    rows are disabled
- Dev notes:
  - When the opponent chooses a Pokémon, fill their next slot with the solid
    (full-opacity) pokéball, never their Pokémon's sprite, so you can see their
    progress but not their order.
  - Once both players have locked in, the battle starts 2 seconds later.

### Detail (`Detail.dc.html`)
- Top row: 128px sprite, then the name with the type badges below it (no ball icon
  here; that's on the draft info box).
- Ability (top right): 480px wide, so its left edge lines up with the STATS column
  below. It has an "ABILITY" heading styled like MOVES/STATS, then the ability name
  (24px, 32px line height) and its description (16px, 24px line height).
  - Widths: sprite 128 + name block 320 (FERALIGATR, the longest name) + ability
    480 + two 24px gaps = 976px of the frame's 1020px inner width.
  - The top row is 128px tall, which fits a description of up to 2 lines (about 30
    characters per line). A longer description would make the row taller.
- Moves (left): each row shows the name with `PP x/x` right-aligned underneath.
  Hover, focus or click selects it (grey background).
- Stats (right): a LV.50 / BASE toggle. LV.50 is the default and sits on the left.
  - LV.50: `HP 155/155` with the HP bar (216px wide, right-aligned), then the other
    stats as label/value rows. Stat formula (same in Gen 3–6) at level 50, 31 IVs, 0 EVs, neutral
    nature: HP = ⌊(2B+31)·50/100⌋+60, others = ⌊(2B+31)·50/100⌋+5.
  - BASE: label, value and a coloured bar (bar length = value / 160), plus a total.
- Held item (top row, under the type badges): `icon-item.png` at 2× (32px) with
  the item name in 16px, 12px apart, on a 32px row. The name block's rows are 8px
  apart so name, badges and item fit the 128px sprite height.
  - The held item is per-Pokémon data. Each Pokémon in the pool has its own held
    item, and the name shown is that Pokémon's item. Items don't have to be unique;
    several Pokémon can hold the same one. Every Pokémon has an item, so the row is
    always shown.
  - The designs show "Rocky Helmet" for every Pokémon only as a placeholder. Don't
    hard-code it. The same applies to the item row in the draft info box.
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

Type badge colours (white text). These are the agreed type colours; use them for
every type badge:

| Type | Colour | Type | Colour |
|---|---|---|---|
| BUG | `#94bc4a` | GROUND | `#cc9f4f` |
| DARK | `#736c75` | ICE | `#70cbd4` |
| DRAGON | `#6a7baf` | NORMAL | `#aab09f` |
| ELECTRIC | `#e5c531` | POISON | `#b468b7` |
| FAIRY | `#e397d1` | PSYCHIC | `#e5709b` |
| FIGHTING | `#cb5f48` | ROCK | `#b2a061` |
| FIRE | `#ea7a3c` | STEEL | `#89a1b0` |
| FLYING | `#7da6de` | WATER | `#539ae2` |
| GHOST | `#846ab6` | ??? | `#81a596` |
| GRASS | `#71c558` | | |

The `???` type is the badge for an unknown or typeless move or Pokémon.

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

**Button**: a Crystal frame, at least 240×108, with 24px centred text that doesn't
wrap. Padding is 36px top and bottom and 60px each side.
- Hover/focus: every button shows a ▶ cursor 30px from its left edge, positioned
  absolutely so the text stays centred (on primary buttons the cursor is light).
  Keyboard focus also gets a `#E8E8E8` fill, except on primary buttons, which stay
  dark.
- The cursor must never overlap the label, and showing it must never resize the
  button. The 60px side padding clears the cursor (30px in, 24px wide, 6px gap),
  and the cursor is only hidden with `visibility`, never removed from the page.
- Primary (RENT, HOST, FIRST, START BATTLE): `background:#181818; color:#F8F8F8;
  box-shadow: inset 0 0 0 3px #181818, inset 0 0 0 6px #F8F8F8`.
- Longer labels widen the button and keep the 108px height. A 4-letter label fits
  240px, START BATTLE is 420px (the canvas shows 384px, but the label can't be
  centred at that width without running under the cursor), and COPY is fixed at
  300px for "COPIED!". If a button's label changes, size it for the longest label
  so it doesn't jump.
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
| icon-masterball.png | `1232bfea6d5fbe714ce6f5a04bb1772c` |
| icon-item.png | `304d19156319bb03d1ef9b08ad02f23e` |

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
| | | | 41 | zapdos.png | `3caaf4f1640a8b9d31be5b3059e23bf2` |

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
