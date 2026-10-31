# Screen numbers, URL bar view buttons and Save screen now (for DOM Studio 1.0.18)

One patch to the app source, made against the 1.0.18 sources (`renderer/app.js`,
`renderer/index.html`, `renderer/styles.css`). It applies cleanly with `git am`.

## What changes

**Every recorded screen has a number.** Each card in the recording panel
shows its number in the recording. It is the same number as its card in the
flow strip and in the preview: 1, 2, 3, and a loading card after screen 2 is
2.1. A page that is still saving shows the number it is about to get, in an
outlined pill.

**The right panel and the flow strip list screens in the same order.** The
panel used to keep the order captures *started* in, and the strip the order
screens were *saved* in. A page whose save was held back sat above a screen
saved before it. That happened when its phone was still capturing, or when its
row was pointed at a newer frame of the page. Now both follow the saved order.
A screen whose row was lost while it waited still gets a row, so the panel
never misses a screen the strip shows.

**The URL bar's view buttons change the stage.** The three buttons in the URL
bar (Desktop + mobile, Desktop, Mobile) are now View as from the recording
panel:

- Picking Desktop shows the desktop only, and View as follows. Picking View as
  → Mobile lights the Mobile button.
- The buttons show in every view, not only side by side, so you can switch
  back. Tablet is only in View as; no URL bar button is lit then.
- They used to pick which side the URL bar drives while both were showing
  ("manual sides"). Manual sides is still used inside the app, when a
  re-record's desktop and phone links differ. To put one side on the other's
  page, use ⋯ → Send link.

**Refresh screen is now Save screen now.** It shows on a card that is still
saving. One press saves the card exactly as both sides look at that moment,
whatever it was waiting on:

- **Still settling** (a hero word that keeps cycling, a demo that types itself
  out): both sides are snapped now.
- **Waiting on its phone** ("Capturing mobile…"): the phone is snapped as it is.
  So is the desktop again, if it is still on that page. Before, Refresh sent
  the card back to "Saving…" and queued its new frame behind the same phone
  wait, so nothing was saved.
- **Held behind an earlier card that is waiting on its phone**: that card is
  saved first, then this one.
- **Its page is no longer open**: the card is removed, and a message says to
  open the page again.

If the phone isn't showing the page within 4 s, the desktop is saved and a
message says to use Re-record → Mobile on the card. Later frames of the same page (a fill, a
reload, a second load) don't write over a screen saved this way.

**Cards no longer read "Saving…" forever.** Leave a page before its card is
saved and come back to a page that already has one: the left page's card used
to stay on "Saving…" for the rest of the recording. Its job was cancelled when
the page was left. Now the card is dropped as soon as the next page starts
saving. A card whose capture is already in (waiting on its phone, or behind an
earlier card) stays.

## Apply

From the root of the DOM Studio source (the folder with `main.js`,
`guest-preload.js` and `renderer/`):

```sh
git am /path/to/0001-save-screen-now.patch
```

If `git am` stops because the source has moved on since 1.0.18, run
`git am --abort` and apply it again with `git am -3`.

## Check it on tryprofound.com

1. Run the app, open https://www.tryprofound.com in split view and start
   recording.
2. The first card is numbered 1, the same as its card in the flow strip.
3. While the card reads "Saving…" or "Capturing mobile…", press **Save screen
   now**. It should be saved, with its phone, within a second. The card's name
   shows the hero word that was on screen when you pressed.
4. Click through a couple of pages. The panel and the flow strip should show
   the same numbers in the same order.
5. In the URL bar, press the Desktop button: the stage shows the desktop only
   and View as moves to Desktop. Press Desktop + mobile to go back.

## What was tested

The original and patched apps ran unpacked under Electron 33.4.11 on Linux
(Xvfb). tryprofound.com itself can't be reached from the test environment, so
`harness/site-profound.js` copies how it behaves:

- a hero word that cycles with a blur every 1.2 s, and a demo prompt that
  types itself out every 70 ms, so the page never goes quiet;
- a cookie dialog, and tracking params removed with `replaceState`;
- optionally, a page that reloads itself once (`?reload=1`);
- optionally, a phone build that keeps reloading (`?phoneloop=1`), so its
  card sticks on "Capturing mobile…".

| Check | 1.0.18 | Patched |
| --- | --- | --- |
| Card stuck on "Capturing mobile…", press the card's button | Refresh screen sends it back to "Saving…" and nothing is saved in 22 s (2 of 4 runs; the other 2 saved on their own before the press) | Saved with mobile 252–289 ms after the press (8 of 8 runs) |
| Press while the page is still settling | Saved 255–290 ms after the press | Saved 254–271 ms after the press |
| Second page held behind a stuck first page, press on the second | Nothing saved in 30 s; both cards read "Saving…" (1 run) | Both saved, with mobile, 318–515 ms after the press (7 of 7 runs) |
| Next page after Save screen now | (first page never saves) | Saved in 6.5 s, the same as a page with no press |
| Leave a page before it saves, come back to a recorded page | The left page's card reads "Saving…" for good (15 s and counting) | Card dropped within 1 s |
| Panel order and numbers vs the flow strip | Separate orders; numbers only in the strip | Same order, same numbers (1, 2) |
| URL bar buttons | Only side by side; they pick which side the bar drives | In every view; switch the stage and follow View as both ways |
| Page that never goes still, no press | First screen saved at 6.4 s | 6.4 s |
| Page that reloads itself once, no press | 5.1 s | 5.1 s |
| The 1.0.17 harness's onboarding-steps and regression scenarios (step URLs, Uber-style modal, back through steps) | — | Same results as 1.0.18 |

Not tested: the real tryprofound.com, a signed Mac build, re-record sessions,
and Save screen now on a card whose page was left before the next page opened.
That last case is handled in the code but not run.

Seen in passing, and not changed by this patch: after View as → Tablet →
Desktop, the desktop page fills only the top part of the stage until it
reloads. 1.0.18 does the same.

`harness/` holds the scripts behind the table. Run `npm install` in that
folder, then run each with the app source folder as the argument (on Linux,
prefix with `xvfb-run -a`):

- `node scenario-profound.js <app>` records the page and prints the panel as
  it changes. Add `--click` to press the card's button. `CLICK_WHEN=mobile`
  waits for "Capturing mobile…" before pressing. `PHONELOOP=1` and `RELOAD=1`
  turn on the stand-in's reload modes.
- `node scenario-walk.js <app>` runs the two-page cases and the URL bar
  buttons.
- `node scenario-deadrow.js <app>` leaves a page before it saves.
