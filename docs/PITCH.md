# Pitch plan (about 2:57 video; 3 min live + 2 min Q&A)

Deck: `docs/presentation/Chartitable.pptx` (6 slides; closing slide has the "built with" logo strip). Video: `video/` (see its README). Updated Sat Oct 24, late afternoon. Framing: **donor retention in one platform, two sides**: donors see their impact on the charity's own site; charities get a dashboard showing who to thank and who has gone quiet. Honesty caveats are deliberately **not** in the spoken script (they live in the Q&A list below); the product itself still labels estimates on screen.

## Script (Lead = A, Teammate = B) — video v3, about 2:57
| Scene | Who | Say |
|---|---|---|
| Slide 1 | A | "Hi, we're the Chartitable team. This is Chartitable. Not charitable, chart-it-able. If your donation does good, you should be able to chart it. Not with an actual chart. We checked, nobody wants a chart. It's a pun. We're very proud of it." |
| Extra slide: the same page twice (not in the .pptx; PNG in docs/presentation) | A | "Here's me giving to a small food pantry the normal way. Day one, I give twenty five dollars and feel great. A month later I go back, and it's the exact same page. Same photo, same Donate Now button." |
| Slide 2 | A | "So where did my money go? Did it help? Did it buy a pizza for the intern? I'll never know. Black hole." |
| Slide 3 | B | "It's not just me. Charities struggle with donor retention: less than half of donors ever give again, forty three percent. In a single year, billions in giving were lost to donors who left or gave less. Small pantries have no fundraising staff to write back, so the bucket leaks." |
| Slide 4 | B | "Chartitable closes the loop. It's donor retention in one platform, with two sides. Donors see what their giving did, on the charity's own website. Charities get a dashboard showing who to thank and who has gone quiet. Claude writes the stories." |
| Slide 5 | A | "Okay, let me show you. Same donation, now with Chartitable." |
| Stranger, then donate as Mira (email typed, shown as dots) | A | "Same pantry. First I'm a stranger, so it's just their normal site. Now I give twenty five dollars, and add my email. When I land back on the site, it thanks me by name." |
| One week later (notification) | A | "A week later, the pantry has been busy. When my share of what they've done crosses a milestone, I get a note." |
| Personalized page | A | "I click through, and the page rearranged itself around me: what the pantry did since I gave, and my share. All from one line of script on the charity's own website." |
| Live update | A | "Now watch. Staff post that they served eighty meals. I don't reload anything. In a few seconds the page shows it, and my share moves." |
| Give again | A | "And if I want to give again, it's one click, and it welcomes me back." |
| Dashboard | A | "Now the charity's side. One view shows who needs a thank-you, who has gone quiet, what was spent, and what a meal costs. One click marks a donor thanked." |
| Before / after card | A | "Before: a page that never changes, and a black hole where your money goes. After: a page that shows what happened, and what to do next." |
| Slide 6 | B | "Donors stay when they can see the impact, and charities can reach out before they leave. Chartitable makes your giving chart-it-able. Thank you. Please clap. Please fund us." |

Notes: the donor in the stranger-then-donate scene is named Mira so the later email and pages are about the same person (the later scenes use the seeded Mira profile, whose first gift shows an earlier date).

## Live demo order (panel `/staff/demo`, readiness green, Reset demo first)
1. Window A (private): Cinderwell as a first-time visitor → Donate → $25 → "Thank you".
2. Mira's Cinderwell tab already open: panel button **Served 80 meals** → her tab updates in ~6 s.
3. On Mira's tab click Give again (stop at the welcome-back page; never submit as Mira before step 2).
4. `/dashboard/` (live data, PIN): Overview → See who → Mark thanked.
5. Reset demo afterwards. Do not rehearse step 2 more than once between resets.

## Held for Q&A (kept out of the pitch on purpose)
- **Pooled gifts and estimates:** we credit a proportional share and label it an estimate; we never claim a specific dollar. Staff log the facts.
- **The fact-checker:** Claude only sees a facts payload we build; a deterministic checker rejects any number, name or percentage not in it, any unlabeled estimate and pressure language, then a plain template takes over.
- **Test mode and fictional data:** payments, charities and donors are all fictional/test.
- **Dashboard:** it shows who to thank and who has gone quiet and marks donors thanked; it does not send outreach yet. Next step: drafting outreach, checked by the same fact-checker. Its data comes from the same backend; staff login is a demo PIN.
- **Privacy:** donor links carry only an opaque signed token; no names or emails in URLs. Known risk: tokens last 30 days and show in host logs.
- **Backend (for the Convex table):** Convex is the whole backend: database, file storage for staff photos, scheduled milestone checks, HTTP endpoints the embed calls, and actions that call Claude and send the email. Live updates are the page checking every few seconds, not a Convex subscription.
- **Why Claude:** it writes the donor-facing words, so trust is the risk; the checker is the backbone, not an add-on.
- **How a charity installs it:** one script tag and marked regions on their existing site; no redesign, no generated images.
- **Not built:** real payments, real auth, production deployment (it runs on a development deployment), Cartesia voice.
- **Business model:** decide before presenting.
- **Meta theme:** the product connects small charities and their donors after the gift.

## Checklist
- [ ] Team name in the script. (Slide 3's "CapCut.com" watermark and "Activate Windows" notice are intentional jokes; the 43.3% source has been checked.)
- [ ] One real milestone email rehearsed and confirmed in the inbox (one was sent during the video recording).
- [ ] `npm run demo:check` green; Reset demo done; windows laid out as above.
- [ ] Practice with videos 2 and 3 in `video/out/`, then present over `5-final-silent.mp4` or live.
- [ ] After presenting: Reset demo.
