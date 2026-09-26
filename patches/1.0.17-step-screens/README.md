# Step URLs, Send link and fast saving (for DOM Studio 1.0.17)

`0001-record-step-wizards.patch` changes the app source. It was made against
the 1.0.17 sources (`main.js`, `guest-preload.js`, `renderer/`) and applies
cleanly to them with `git am`.

## What changes

**Send link is always available.** In the ⋯ menu, both "Send link" items stay
on whenever desktop and mobile are both showing a page. They used to grey out
when the two sides "looked like the same page". That check ignored the query
string, so `onboarding-v2?…&step=menu` and `…&step=choose-package` counted as
the same page. Hovering an item shows the link it will send.

**Step URLs are recorded as screens.** When a page keeps the same path and
moves only a query param (DoorDash onboarding: `?step=welcome` → `?step=menu`
→ `?step=choose-package`), every step is now its own screen, on desktop and
mobile, with no "Record as new screen". The phone is moved to the desktop's
step when a mirrored click leaves it behind.

- Params that count by default: `step`, `stage`, `phase` and names built on
  them (`currentStep`, `onboarding_step`, `step_id`), plus `screen`.
- Everything else in the query is still the same screen, as before: modals
  (`?mod=quickView`), filters, tracking tags.

**URL changes panel (recording inspector, under the screen list).** It lists
every URL change on either side, what moved (`step store → menu`), and
whether it made a new screen.

- Click **+ tab** on a row, or type a name after **+**, to make that param
  create screens for this recording only. The view already on screen is saved
  right away.
- Click **×** on a chip to stop a param creating screens.
- Every new recording starts from the defaults.

**Saving no longer waits for loading states.**

- Short pages are saved as soon as they are still, instead of waiting 10 s.
- Spinners and skeletons hold a save for 2.5 s at most, and a busy page for
  3 s.
- Clicking a page that is still settling saves it on the spot.
- Loading frames are captured only when a screen is marked Loading.
- The phone is not pulled off a page while it is capturing it.
- Stop saves as soon as the page confirms its last events are in, instead of
  after a fixed 8 s.

**Project rules.** `.claude/rules/recording.md` writes these rules down so
later changes keep them. Claude Code loads the file automatically.

## Apply

From the root of the DOM Studio source (the folder with `main.js`,
`guest-preload.js` and `renderer/`):

```sh
git am /path/to/0001-record-step-wizards.patch
# if the source has moved on since 1.0.17:
git apply --3way /path/to/0001-record-step-wizards.patch
```

## Check it on the real onboarding

1. Run the app, open your onboarding link in split view, and start recording.
2. Click through a few steps. Each step should appear as a screen with its
   mobile version (the card shows `· step=…`). Opening a help modal should
   not add one.
3. If the two sides end up on different steps, ⋯ → Send link moves either
   side.
4. Stop. The save should start within a second or so, not after 8 s.

## What was tested

The patched app ran under Electron 33.4.11 against local pages that copy the
onboarding flow: `pushState` steps, a `?modal=` dialog, a step whose button is
labelled differently on desktop and mobile, `?tab=` sub-views, DoorDash-sized
short steps, and an Uber-style store where the desktop opens items with
`?mod=quickView` and the phone uses its own route.

| Check | 1.0.17 | Patched |
| --- | --- | --- |
| 4 onboarding steps clicked through | 1 screen saved | 4 screens, each with mobile, about 1.3 s after the click |
| Short steps at one click every 2.5 s | 1 screen, with the wrong step's content | 5 of 5, each saved before the next click |
| Phone when a mirrored click misses | stays on the old step | follows the desktop's step |
| ⋯ → Send link, sides on different steps | disabled | enabled |
| `?modal=help` dialog | no screen | no screen |
| `?tab=` views | no screen | no screen by default; one per tab after **+ tab** |
| Uber-style `?mod=quickView` and phone route | no screen, phone stays on its route | same |
| Back through recorded steps | steps not recorded | no duplicate screens |
| Stop → saved | 8.2 s | 0.26 s |

The real DoorDash onboarding was not run: it needs a signed-in store.

`harness/` holds the scripts behind this table. Run `npm install` in that
folder, then `node scenario-steps.js /path/to/dom-studio-source`. On Linux,
prefix it with `xvfb-run -a`. The other checks are `scenario-params`,
`scenario-sparse`, `scenario-regress` and `scenario-typed`.
