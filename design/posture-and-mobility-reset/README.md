# Posture and Mobility Reset — design canvas

Working files for the design canvas behind the live
[/posture](https://www.movemindful.com/posture) page.

**Canvas:** https://claude.ai/artifact/BNwKwzksmENNbEJWeqsbsF

This is the *original* canvas the live page was built from (see commit
`1eddd50`, "Built from the approved design canvas"). The separate
impulse-buyer explorations live in [`../posture-reset-impulse`](../posture-reset-impulse).

## Artboards

| File | Frame | Notes |
| --- | --- | --- |
| `Main.dc.html` | 1440 × 7200 | Landing page — desktop |
| `MainCopy.dc.html` | 1440 × 7200 | Duplicate of the desktop board, for hand edits |
| `Mobile.dc.html` | 390 × 9200 | Landing page — mobile |

`canvas.json` holds the frame positions and the three sticky notes.
Images live in `images/` and are referenced from the artboards by bare
filename (`<img src="practice-hero.jpg">`).

## Which board is the spec

`MainCopy.dc.html` — the *(copy)* board. Its reworked copy shipped to the live
page on 2026-09-16: "classes" rather than "routines" throughout, Class 1-5
rather than Day 1-5, both calls to action in the buyer's own words, and the
lineup moved above the Recognition section.

`Main.dc.html` is the original board, kept as history. `Mobile.dc.html` still
carries the **pre-rework copy** and is the one board now out of step with both
its sibling and production.

## Known drift from the live page

Deliberate, in both directions:

- **Price.** The copy board writes **$27** into the fourth quick-facts card.
  The live page reads it from RevenueCat, because a number typed into a page
  outlives the price it describes — this canvas spent weeks advertising $29.99
  after the product had moved on, which is the argument in one sentence.
- **Hero media.** Live plays a Mux video loop; the boards show a still. Live
  wins here by decision, not by accident.
- **Second hero paragraph.** On the boards, not on the live page — dropped
  2026-09-02 and deliberately left off during the 09-16 rework.
- **Calls to action.** The boards word them separately — "YES! I'M READY TO
  IMPROVE MY POSTURE & MOBILITY" up top, "YES! I'M READY TO GET STARTED" at
  the foot. Live says **"YES I'M READY TO START!"** in both places: one button,
  one set of words, so a buyer who scrolls past the first and takes the second
  is clicking the same thing rather than something subtly reworded.
- **Hero CTA placement.** The boards put it between the copy and the hero
  media; live puts it *below* the loop. The video is what does the convincing,
  so the ask comes after someone has watched it.
- **Hero eyebrow.** The boards open with a lilac pill reading "Posture &
  Mobility Reset" above the headline. Live has no pill, and its `<h1>` reads
  "Posture & Mobility Reset" rather than the boards' "Posture and Mobility
  Reset" — so the line the pill duplicated is now the headline itself.
- **Class slugs.** Titles read "Class N"; the URLs stay `/posture/day-N`,
  because those are public links already in circulation.
- Day photos on the boards are stand-ins, not the real class frames.
- The boards carry their own nav and footer; the live page uses neither.
- The numbered section pills are an annotation device and are not content.

## Rebuilding the canvas

Files here are a mirror of the published payload, not its build input — the
artboards live inside the artifact itself, in the `<script id="appifact-doc">`
block, and saving in the editor republishes the whole page. Keep them in step
by hand after editing either side.

To change the canvas from here:

1. `Artifact action:"read"` the URL above. It saves ~3MB of HTML, nearly all of
   it editor code; the design is `content.files` in that script block.
2. Edit the artboard string **inside that saved file** and republish it with
   `Artifact action:"publish"` plus `url`. Do not rebuild the payload from the
   files in this folder — the block carries editor state that is not mirrored
   here, and a re-seeded copy silently drops it.
3. Copy the changed artboards back into this folder so the two agree.

Targeting one board takes care: `Main.dc.html` and `MainCopy.dc.html` share
long stretches of identical markup. Anchor on something only the copy board
has — its section wrappers carry `position: relative` for the pills — and
assert the match is unique before replacing.

There is no `design` skill helper for this, and `DesignSync` is unrelated: it
serves claude.ai design-*system* projects, not canvas artifacts.
