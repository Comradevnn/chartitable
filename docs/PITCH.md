# Pitch plan (3 min + 2 min Q&A)

Deck: `docs/presentation/Chartitable.pptx` (6 slides, made with Grok Bot). Script draft by the team; this file is the tightened version with the demo mapped to the presenter panel (`/staff/demo`). Written Sat Oct 24, ~2:40 PM PT. Devpost requires a 3-minute pitch and 2 minutes of questions, and a live or recorded demo.

## What changed from the draft, and why
1. **The demo must be about 80–90 seconds, not 3 minutes.** The panel's built-in "3-minute story" run sheet is the whole pitch's length. Use the cut below.
2. **Slide 5 bullet 3 ("the health page with updates and photos tied to your gift")** does not match the product: `/staff/health` is a staff ops page showing counts only. What you want to show is the **donor's own page** with the logged updates (photo tiles) and the labeled estimate, updating live after staff post "Served 80 meals". The health page stays out of the demo.
3. **"My money went somewhere, and I can see it."** is an overclaim under our own honesty rule (pooled gifts can't be traced per dollar). Say: "I can see what the pooled gifts did, and my share, labeled as an estimate."
4. **Add the Anthropic hooks (about 15 s total).** The track judges a *named community*, a *real problem*, *it works*, and *thoughtful use of Claude, including where it could go wrong*. The draft names none of these. Add one line on the community (small food pantries with no fundraising staff; the lead's lived grant-writing experience at a San Jose food bank) and one line on Claude and the guard (see Slide 4 and the close).
5. **Verify the 43.3% stat.** The slide cites "Fundraising Effectiveness Project, Q4 2025". Have someone open the source and confirm the number, period and wording ("less than half of donors give again") before presenting. If it can't be confirmed, say "less than half" and the source name only.
6. **Keep the jokes.** The tone is the deck's identity. Just make sure the serious beats (honesty, guard) land clearly right after a joke.

## Script with timings (target 2:55, leave slack)
**Slide 1 (0:00–0:15).** "Hi, we're [team]. This is Chartitable. Not 'charitable': chart-it-able. If your donation does good, you should be able to chart it. Not with an actual chart; we checked, nobody wants a chart. It's a pun. We're very proud of it."

**Slide 2 (0:15–0:40).** "So here's me giving to a small food pantry the normal way. I give $[X], I feel great. A month later I go back to the website and... nothing. Same photo, same Donate Now button. Where did my money go? Did it buy a pizza for the intern? I'll never know. Black hole." *(Add before or after:)* "Small pantries run on volunteers; none has a fundraising staff to write you back. I know because I've written their grants." *(Only say the last sentence if it's true to the lead's story.)*

**Slide 3 (0:40–1:00).** "And it's not just me. Less than half of donors ever give again: 43.3% in the latest U.S. data [confirm source]. The bucket leaks because donors never see what happened next."

**Slide 4 (1:00–1:15).** "Chartitable closes the loop. One line of script on the charity's own website, and when a donor comes back, the page changes for them: what the gifts did, their share, one next step. Claude writes the story, and a fact-checker rejects any number it wasn't given."

**Slide 5: DEMO (1:15–2:40, about 85 s).** "Okay, same donation, now with Chartitable." Beats below.

**Slide 6 (2:40–2:55).** "Donors stay when they can see the impact. Chartitable makes your giving chart-it-able. Everything you saw is labeled: records are facts, estimates say 'about', and if we don't know, we say less. Thank you. Please clap. Please fund us."

## Demo cut (about 85 s) mapped to the panel
Pre-stage before going on (5 minutes out): run `npm run demo:check` (or open `/staff/demo`, PIN, readiness green), click **Reset demo**, then open these:
- **Window A (private/incognito):** Cinderwell as a first-time visitor (button "first-time visitor"). Donate here only; donating in a normal window can overwrite Mira's stored token.
- **Window B (normal):** `/staff/demo` panel on one side; **Mira's Cinderwell tab** (named tab, "first impact") already open next to it.
- Keep the deck on the main screen; alt-tab to the demo at slide 5.

| Time | You say | You do | Expected |
|---|---|---|---|
| 0:00 | "Same pantry. First, a stranger visits." | Window A: first-time Cinderwell | Plain site, no personalization |
| 0:08 | "I give $25. Test mode, no real money." | Click Donate → $25 → submit | Redirect back; hero: "Thank you, [name]. Your gift is in." (about 15 s) |
| 0:28 | "Now I'm a returning donor. This is what the pantry's staff does." | Window B: panel → click **Served 80 meals** (Cinderwell) | Within ~6 s Mira's open tab shows "Just logged: 80 meals" (check whether the preset shows a photo tile; if not, say nothing about photos); her estimate moves from about 22 to about 26 meals, no reload |
| 0:55 | "Records are facts the staff logged. Estimates say 'about': pooled gifts, so we never claim a specific dollar." | Point at the labeled estimate card | Dashed estimate block with "estimate" wording |
| 1:05 | "Giving again takes one click, as the same donor." | On Mira's tab click **Give again** | Donate page: "Welcome back. Your last gift: $25 on [date]." $25 preselected (stop before submitting, or submit last) |
| 1:20 | "No black hole." | Back to slides | — |

Optional +10 s if time allows and the teammate's work is live: show `/dashboard/` (top donors, expenses, cost per meal labeled estimate). Otherwise mention it in Q&A.
Skipped on purpose (too long for 3 minutes): the milestone email (Mira's inbox receives it by itself after the 80-meal post; mention "and she gets an email" while the tab updates), Brindlecote (second site; use if a judge asks "does it work on another site?").
**After:** click **Reset demo**.

## If something goes wrong on stage
- **Tab doesn't update in 6 s:** reload Mira's tab once; narrate "live updates poll every few seconds."
- **Story shows as template (plain wording):** that's the guard's fallback working; say so: "this is the safety net: if Claude's text fails the fact check, we show a plain truthful one."
- **Network down:** play the backup recording (record one tonight: run this exact cut once, screen + voice).
- **Never** give again as Mira before the 80-meal beat; it shifts her numbers.

## Q&A crib (2 minutes; short answers)
- **How do you know what a gift did?** We don't, per dollar. Gifts are pooled, so we credit proportionally and label it an estimate; staff log the facts.
- **What stops Claude from making things up?** It only sees a facts payload we build; a deterministic checker rejects any number, name or percentage not in it, any unlabeled estimate and any pressure language, then a plain template takes over. Tests cover invented numbers and names.
- **Why Claude?** It writes the donor-facing words; the risk is trust, so the guard is the product's backbone, not an add-on.
- **How does a charity install it?** One script tag and a few marked regions on the site they already have; no redesign, no generated images.
- **Privacy?** Donor links carry only a signed, opaque token; no names or emails in URLs; test-mode payments; emails only to demo inboxes. Known risk: tokens last 30 days and appear in host logs.
- **What isn't done?** Real payments, real auth (demo PIN), production Convex (dev deployment), Cartesia voice. The dashboard is [live data / mock data: check before presenting].
- **Who is it for?** Small food pantries without fundraising staff, and their donors.
- **Business model?** [Decide: e.g., free for pantries, paid for larger charities. Answer honestly that it's a hackathon prototype.]
- **Meta theme ("closer together"):** the product connects small charities and their donors after the gift.

## Checklist before presenting
- [ ] 43.3% stat source confirmed (open the Fundraising Effectiveness Project page).
- [ ] Team name and $X filled in on the slides and script.
- [ ] `npm run demo:check` green; Reset demo done; windows laid out as above.
- [ ] One real milestone email send rehearsed (it has been proven by tests and a dry run, but check that the email actually arrives and its link opens the page).
- [ ] Backup video recorded (the demo cut above, with voice).
- [ ] Practice twice with a timer; target 2:50 total.
- [ ] After presenting: Reset demo.
