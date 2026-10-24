# Charity and food pantry home pages: structural and tonal reference

Date: 2026-10-24 (Sat). Lane B. Researched by a Haiku agent for the `/frontend` refinement.
Status: **observed** unless marked inferred. Structural and tonal reference only. D5: never copy code, copy, images, logos, palettes or names. No real organization name may appear in our product pages; naming them in this note is fine.

## Method and limits

- Read with gstack's headless browser (`$B`); WebFetch not used. Pages were scrolled to trigger lazy content, then read through the DOM and computed styles; counters read after a 3-second wait.
- No screenshots were taken, so photography, hero imagery and visual weight are **not** observed visually; only media counts and types were measured. Close this gap with a screenshot pass before relying on photo findings.
- Section order is DOM order, not pixel order. Hidden menu items may appear.
- Color: only counts of unique computed colors and specific button backgrounds were measured. No palette values recorded.

## Site records

### 1. Feeding America (national)
- https://www.feedingamerica.org/
- Section order: nav (hunger info, food programs, take action, about, donate) → hero → find-food tiles (find food, SNAP help, meal programs) → make-a-difference tiles (donate, advocate, fundraise, volunteer) → long-term hunger feature → local opportunities → "we unite communities" → impact counter band → working-together block → "$1 = 10 meals" tier → closing join block → footer.
- Hero: text-led, 4-word headline plus a 7-word subline; one large media element.
- Donate: about 15 donate/give controls including duplicates; bold filled nav button; footer link for managing an existing gift.
- Numbers: large numeral + unit + label, "+" used as a lower bound; no visible as-of date, source line or estimate language.
- Type: heavy display over a neutral system sans; extreme scale contrast. 16 unique computed colors.
- Footer: street address, toll-free number, careers, manage-gift link.
- Tone (paraphrased): plain promise of food today for a stronger future; short verb-first tiles.
- Trust: scale numbers, address, phone and a manage-gift link read as credible; CTA repetition and enterprise tile grids read as generic.

### 2. charity: water (international)
- https://www.charitywater.org/
- Section order: header with one warm-filled Give button → hero containing the donation module → "why water" with four themes → stat block → lives-changed line → "your donation makes a difference" (100% model) → impact-to-date band → six take-action cards → email signup → footer columns.
- Hero: 11-word headline; the donation module sits in the hero (monthly/once toggle, amount chips, join button).
- Donate: about 7 give actions; one saturated accent used only for give buttons; secondary ways to give are quiet tiles and text links.
- Numbers: full integers with commas under a "to date" heading; per-gift claims hedged ("on average", "around"); a card explains that private donors cover operating costs. No as-of date seen on to-date figures.
- Type: serif display headline (regular weight) with a humanist/geometric sans body; moderate scale contrast; editorial and warm. 29 unique computed colors; pale warm card backgrounds.
- Tone (paraphrased): short "X changes everything" headlines; gift translated to people helped, with a hedge word.
- Trust: explaining where money goes, hedged per-gift language and "to date" framing feel honest; amount chips make the ask concrete. The dense card grid is the most generic part.

### 3. San Francisco-Marin Food Bank (regional)
- https://www.sfmfoodbank.org/
- Section order: cookie banner → header (search, language, about, get involved, ways to give, find food, donate) → hero → annual hunger report card → food locator → benefits enrollment → "food bank 101" → updates → how-you-can-help (volunteer, donate, start a drive) → community story with a match offer → newsletter → footer.
- Hero: 8-word headline, then a paragraph on food insecurity and federal benefit cuts.
- Donate: header button in one fill, mid-page donate in a different fill (two donate colors on one page); once/monthly dropdown; match offer.
- Numbers: own survey credited by name and year; one statewide stat with no date in captured text.
- Type: serif headline (regular) with a humanist sans body; civic and editorial. 30 unique computed colors.
- Footer: two county addresses.
- Tone (paraphrased): policy-forward and urgent.
- Trust: dated self-survey, two physical sites and a food locator are credible; cookie banner first, two donate colors and urgency weaken the calm.

### 4. Oregon Food Bank (regional)
- https://www.oregonfoodbank.org/
- Section order: header → hero with a zip-code food finder → find free food (network/access) → join-us advocacy/newsletter → community-led change → five-question "how can you help" quiz → news (incl. benefits help in another language) → stay connected → footer mission statement.
- Hero: 5-word headline plus "no one should go hungry" subhead and the zip search.
- Donate: neutral charcoal header button; about 5 donate controls; restrained. A typo was observed in hero copy (not re-verified).
- Numbers: none on the home page; it leads with access, not totals.
- Type: one sans family, very heavy (900) headline around 71px; utilitarian and institutional. 11 unique computed colors.
- Tone (paraphrased): plain, direct, service-first; states up front that no proof of income or documentation is needed.
- Trust: zip finder in the hero and the no-proof statement are the strongest access-first patterns in the set; heavy weight reduces warmth.

### 5. St. John de LaSalle Church, Community Care Food Pantry (small, Niagara Falls NY)
- https://stjohndelasalle.org/ and /food-pantry/ (parish site on WordPress.com)
- Home: nav → welcome paragraph → news and updates → footer (bulletin, schedule, online giving, readings). Text-led hero (inferred).
- Donate: transparent, low-weight nav link plus an online-giving note.
- Pantry page top billing, in order: ministry leader's name → location described relative to the church → phone → social follow line → weekly hours → paragraph on families receiving three days of food → partner-agency note → eligibility link → volunteer and drop-off instructions. What to bring and ID rules are **absent**.
- Numbers: none.
- Type: serif headings (~31px) with a matching sans body; traditional, warm, readable. Deep teal primary button.
- Tone (paraphrased): pastoral, treats the pantry as service, not a campaign.
- Trust: specific location, direct phone, named leader and a plain hours line are human and usable; hours are buried in prose and what-to-bring is missing.

### 6. First Baptist Church Milton FL, food pantry ministry (small)
- https://fbcmilton.nucleus.church/ and /foodpantry
- Home: nav → "glad you're here" hero with a learn-more button → a wall of ~15 cards (the pantry is one card) .
- Donate: "Give" nav link and button; no pantry-specific donate on home; low weight.
- Pantry page top billing: short about (location, volunteer-run) → upcoming hours as a date pattern ("first four Thursdays", a morning window) → how to help (drop off, give, serve) → questions/contact → office hours → footer with address, email, phone. What to bring and eligibility **absent**.
- Numbers: none.
- Type: large sans display with a geometric sans body; modern, generic church template.
- Trust: explicit hours pattern, full address, phone and email are concrete; the pantry is buried among 15 cards and the home page has no hours.

### 7. The Mission / Seeking Shelter (small multi-service, St. Mary's County MD)
- https://seekingshelter.com/
- Section order: header (donate, services, volunteer, leadership, mission, meal train, contact) → mission hero (county named) → dated benefit-dinner announcement → get support → give support → volunteer → faith call to action → email signup → footer with a pantry and donation-center heading.
- Donate: header, in-section and footer; moderate weight.
- Numbers: none.
- Type: one functional sans; template-like.
- Trust: county scope, a dated event and a clear get/give/volunteer triad are credible; generic template look; pantry hours and requirements not on home.

## Swapped or rejected
- Greater Chicago Food Depository: bot-verification page. Ecatholic-hosted pantry: bot-verification page. Texas County Food Pantry: domain did not resolve. Myrtle Avenue: a business district, not a pantry. Cape May County Food Pantry: no text returned.

## Synthesis: 10 principles for our fictional pantry site, donor letter-and-ledger page and staff tool

1. **Food-seekers first, donors second.** A "get food" path sits above the donate path. (Oregon Food Bank, Feeding America, St. John de LaSalle)
2. **Hours, address and phone above the fold, in a labeled block** (Open / Where / Call / What to bring), not buried in prose. (gaps on all three small pantries)
3. **Say what to bring and who qualifies, plainly**; a "no proof of income needed" style line lowers the barrier. (Oregon Food Bank positive; small pantries missing it)
4. **One donate color, used sparingly.** A single accent reserved for give actions. (charity: water positive; SF-Marin anti-pattern)
5. **Cap donate calls to about three**: header, one next to the proof, one at the close. (Feeding America anti-pattern; charity: water restraint)
6. **Every number gets a unit, an as-of date and a source; hedge computed ones ("about", "on average").** Matches our record/estimate rule. (charity: water, SF-Marin positive; Feeding America gap)
7. **Explain the money model once, in plain words, next to the ask**: what a gift buys and that gifts are pooled; no claims we can't stand behind. (charity: water)
8. **Human specifics over stock imagery**: a named contact, a real-seeming location detail, "run by volunteers". (St. John de LaSalle, First Baptist Milton) Photo style not observed visually; don't treat as settled.
9. **Warm type pairing**: a serif display (regular weight, ~40–46px H1) over a calm humanist sans body; moderate weight contrast. Single heavy display faces read institutional. (charity: water, SF-Marin, St. John de LaSalle vs Oregon Food Bank, Feeding America)
10. **One short headline plus one human sentence; three or four next steps, not a card wall.** No guilt, no urgency framing. (charity: water, Oregon Food Bank; Feeding America and First Baptist Milton card walls as anti-patterns)

## Follow-ups
- Screenshot pass of sites 1–4 for photography and visual weight.
- Re-verify the Oregon Food Bank hero typo before citing it anywhere.
- Confirm the label of charity: water's second impact figure.
