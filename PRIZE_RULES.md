# PRIZE_RULES.md — Cal Hacks 13.0 prize rules reference

Source: Haiku research pass over https://hive.hackberkeley.org/prizes, /resources, /faq, the SpaceXSI starter pack PDF, and cursor.com/docs. Read-only; nothing was signed up for or submitted. Researched Fri Oct 23, 2026. **Re-check the prizes page before submitting; several rows say "TBD" or "Coming soon".**

Where this conflicts with PROGRESS.md or MASTER_PROMPT.md, this file reflects the live site. Decide changes in PROGRESS.md Decisions; don't edit this file except to correct a fact (add a dated line).

---

## 1. Cursor + Grok — SpaceXAI / SpaceXSI (read first)

**Track: "Make it Legendary with SpaceXAI"** — prize: custom Cursor mechanical keyboard (every member of the winning team).
Rules as listed on the prizes page:
- Project **must be built with Cursor**. "The more you use Cursor, the more you're likely to win."
- **Must also use the Grok Imagine or Voice API in the project.** ⚠ Not in our plan yet. The starter PDF does not mention it; treat as required until the booth says otherwise.
- Bonus: use **Grok Bot** for project planning and team collaboration.

**Second track: MLH "Build Your Hackathon A-Team with SpaceXSI"** — mechanical keyboard per winning team member. To qualify:
- Use Cursor as the core AI coding agent and integrate Grok Bot automation into the workflow.
- In the project description, describe how both Cursor and Grok Bot are used.
- Submit the project and **opt in to the "Make it Legendary with SpaceXSI" raffle**.
- Raffle: everyone who submits is entered for a Cursor Owala water bottle.

**Access (starter pack PDF: https://drive.google.com/file/d/15YRK6uPOlHDAnc78oJOoUBQZ9cTHqCiL/view):**
1. Every attendee gets 1 month of X Premium (includes Cursor, Grok Bot, X, Grok). **Code is picked up in person at the SpaceXSI booth** — someone on site must collect it.
2. Download Grok Bot at https://x.ai/bot (Mac or Windows); sign in with the **same account as Cursor**.
3. Submit the project to "Make it Legendary" on Devpost.
- SpaceXSI workshop: **Fri Oct 23, 8:00 PM**. Help: SpaceXSI booth all weekend, or Cal Hacks Discord. On-site contact named in the PDF: Zach Carlo and Berkeley campus leads.

**Unknown / ask at the booth or workshop:**
- Is the Grok Imagine/Voice API requirement real and enforced?
- How does Grok Bot join a team chat or project? Any API or MCP access? (x.ai/bot returned HTTP 403 to the research agent.)
- What counts as "built with Cursor"? No minimum, screenshot, repo evidence, or Devpost field is specified anywhere.
- What proof backs the Grok Bot bonus?

**Cursor docs (cursor.com/docs):** supports plugins, skills, MCP servers, rules files; integrates with GitHub, GitLab, Azure DevOps, Bitbucket, JetBrains, Slack, Linear; third-party models from Anthropic, Google, OpenAI, xAI. No rule found against combining Cursor with other AI coding tools. No hackathon credits mentioned there.

**Do now (keep a paper trail):** Cursor screenshots, commits made from Cursor, notes of what Grok Bot did. The project description must say how both were used.

---

## 2. Anthropic / Claude
- Row: "Awarded by Anthropic", prize "**Coming soon!**", no dollar value. The site does **not** use the name "Claude for Public Benefit".
- Criteria on the row (paraphrased): (1) a named, specific community, not "students"; (2) a real problem the team has lived or heard firsthand; (3) it works — one thing done well beats a broad demo; (4) Claude does something that matters, and the team knows where it could go wrong for its users.
- No extra submission requirements. No Anthropic starter pack.
- Also: MLH "Best Use of Gen AI" lists Anthropic's API as eligible (prize "Assorted Prizes").

## 3. Figma
- No "Best Use of Figma". Only a row marked "**TBD**": Amazon gift cards + a session with the Figma Early Career Recruiting Team [to be scheduled]. Criteria are in a linked Google Doc that needs sign-in — **unknown**. No starter pack.

## 4. Convex
- "Best use of Convex": **$5,000 cash**. No criteria stated; sponsor blurb: "reactive backend platform… database, functions, workflow, sync, search, file storage." Assume it rewards meaningful use (realtime/reactive queries, file storage, scheduled functions, HTTP actions — we use all).
- Starter pack links to https://docs.convex.dev/home. Quickstarts: https://docs.convex.dev/quickstart/react.md , https://docs.convex.dev/quickstart/nextjs.md ; tutorial https://docs.convex.dev/tutorial/overview.md ; best practices https://docs.convex.dev/understanding/best-practices.md. No credits/promo codes seen.

## 5. Cartesia (stretch; voice)
- "Best Use of Cartesia": "Meta glasses (still TBD)". Judging 25% each: problem & originality · use of Cartesia (voice **core to the product**, clear/responsive/natural) · execution (main flow works, edge cases handled) · impact & responsibility (accessibility, privacy).
- Submission: working demo; **2-minute demo-first presentation** (one full user flow, then brief problem/build summary); short README (setup, Cartesia features used, known limitations); source access for judges; **no API keys/secrets in repo**; "a strong working prototype over a large unfinished idea". Other tools OK if README states what Cartesia contributes.
- Docs: https://docs.cartesia.ai , https://play.cartesia.ai . Starter pack is a Google Doc (sign-in required, contents unknown): https://docs.google.com/document/d/1lBbGq4zbjx4tcgYP2WmcHu6w_E_N39BC/edit
- ⚠ Voice must be core, not an add-on. Grok Voice (for SpaceXAI) and Cartesia compete for the same slot — pick one.

## 6. Vercel, Resend
- No prize or starter pack on the site. Unknown whether any perk applies.

## 7. Cal Hacks general rules (/faq)
- Submit via **Devpost** — "releasing soon" (fields not yet known). Known: team name, team location (table number), 2–3 sentence elevator pitch.
- Presentation **5 minutes or under**, judged at your table. (Our plan assumed 3 min + 2 min Q&A.)
- No previous work or prior hackathon submissions. Ideation before the event is fine; **all implementation during the hacking period**.
- Judging: impact, functionality, technical complexity, creativity.
- Not on the site: GitHub repo requirement, demo video requirement, winner announcement timing.
- General prizes: First–Third Overall, Most Creative, Most Technically Complex, Best People-First, Best Planet-First, Best Hardware, Best Beginner, Best Solo, Hacker's Choice (no separate criteria shown).

## 8. Other sponsors on the site (not in our plan)
- **Mana** ("Best Use of Mana", $5,000): needs 1–2 public Mana pages/chats linked in the submission and a demo moment where Mana changed the build. Criteria: Mana use 30%, usefulness 25%, originality 25%, execution 20%, +10 bonus if the project lives inside Mana. https://mana.space/a/calhacks
- **Factory** (Droid SDK; $2,000 + credits + swag): Droid SDK must be used in real product work, not as a coding helper; README explains how. Strictest rules on the list.
- **Hyphenate** ($8k/$5k/$3k): demo video opening with "their moment", live demo, one-line description of seats the system fills.
- **Bright Data**: must be essential to core product; disqualified for scraping behind logins/paywalls or mocked data in the demo.
- **CRS Credit API**: CRS sandbox, shown working live.
- Others with their own criteria: Meta, Microsoft, Visa, Coinbase x402, Apify, Fetch.ai, Creao AI, Atlassian, Bitdeer, Moss, Spacetime; MLH tracks (Gemini, ElevenLabs, Auth0, MongoDB, Snowflake, DigitalOcean, Vultr, Backboard, Tiger Data, Presage, Solana, Gen AI, .Tech, GoDaddy).

## 9. Starter packs on /resources
Listed: Canva, Factory, Fetch.ai, Creao AI, CRS Credit API, Hyphenate, Cartesia, Moss, Convex.dev, Apify, Atlassian, Context.dev, Mana, Bright Data, Bitdeer AI, Greptile, Visa, SpaceXSI.
**Not listed:** Anthropic, Figma, Cursor, Grok, Vercel, Resend.
Readable: SpaceXSI PDF (above), Convex docs, Greptile https://www.greptile.com/docs/introduction , Moss https://docs.moss.dev/docs , Bright Data https://github.com/ScrapeAlchemist/public-data-hackpack , Mana.
Behind Google sign-in (open in a signed-in browser and paste contents if useful): Canva, Factory, Hyphenate, Cartesia, Atlassian, Context.dev, Visa, Bitdeer AI, Apify.

---

## 10. Plan impacts (for the main chat to decide)
1. **Add a Grok Imagine/Voice API feature** if going for SpaceXAI — required per prizes page. Not in PROGRESS.md.
2. Someone on site **picks up the X Premium code**, then sign in to Grok Bot with the Cursor account. Go to the 8 PM workshop tonight and ask the unknowns in §1.
3. Document Cursor + Grok Bot usage as we go (screenshots, commits, notes) for the project description and the MLH track.
4. **Pitch length:** table judging is ≤5 min; Cartesia wants a 2-min demo-first flow. Update T15 and the pitch plan.
5. **Voice slot:** choose Grok Voice vs Cartesia (don't dilute — "core to the product" is the bar for both).
6. Anthropic row says "Coming soon" and Figma is "TBD" — criteria may change; re-check the prizes page Sat evening and Sun morning.
7. Devpost isn't released yet; field list unknown. Re-check before drafting T14.
8. README should state what each sponsor tool does (Cartesia/Factory ask for it; harmless for all).

---

## 11. Email addendum (Fri Oct 23, 2026, ~11:40 PM PT) — from calhacks-email-findings.md (14 Cal Hacks emails; secondhand Haiku report)
Corrections and additions to the sections above. Where they differ, these come from the organizers' own emails.
- **Anthropic prize (§2):** winning team gets **$5,000 in Claude credits, 1 year of Claude Max 20x, and Anthropic office hours**. Anthropic is a co-host. Saturday workshop "Building Agents & Multi-Agent Teams with Claude" (time not given; check Hacker Guide/Slack) and "Claude Corner" coffee chats. The email calls the track "Claude for Public Benefit", with the same four criteria.
- **Convex prize (§4):** emails list **hardware** (Teenage Engineering EP-133 K.O. II + Waveshare ESP32-S3 touch display), not "$5,000 cash" as the website row said. Treat the prize value as unclear.
- **Figma (§3):** track prizes total **$5K in Amazon gift cards**; Figma workshop was Fri Oct 23 (time not given). Criteria still unseen.
- **Cartesia (§5):** emails say "special prize, details later". Re-check the Hacker Guide/Slack before spending time on it.
- **SpaceXAI (§1):** emails only say "Make it Legendary": custom Cursor keyboard + Owala bottle, and X Premium for all attendees. **No mention of a Grok Imagine/Voice API requirement**, consistent with the starter PDF. Still ask at the booth.
- **Visa "Reimagining Shopping" ($5,000)** is a gen-AI personalized shopping/payments track. Not planned; Chartitable is closer to donor personalization than payments.
- **Venue/logistics:** personal hotspots and routers are prohibited (use venue Wi-Fi; details not given); sleeping area on site; government photo ID + Hacker Pass (Hackathons @ Berkeley app) needed for check-in, so Teammate 2 must be an accepted, confirmed hacker with the pass. Slack is mandatory (#0-ask-directors for support). Free hacker bus from BART (details TBD).
- **Sunday:** Devpost deadline 9:00 AM. Closing Ceremony by 4:00 PM, venue closes 4 PM; winners' photos 4–5 PM.
- **Still not in any source:** Devpost field list, team size limits, judging format, GitHub-repo and demo-video requirements. The emails point to the **Hacker Guide** (link only available inside the emails) and the Devpost link in "Pre-Event #3". Someone with that email should open both and paste the contents.

---

## 12. Devpost page (https://cal-hacks-13-0.devpost.com/) — read Fri Oct 23, ~11:55 PM PT from the lead's browser session
Official. Where this conflicts with §7 (website FAQ) or §11, **this section wins**.
- **Requirements (verbatim gist):** be at the venue by **Oct 25, 8 AM**; must have been accepted and checked in; submit with teammates by **Oct 25, 9 AM PST (hard deadline)**; **include an image of the project and a GitHub repository** for any code to be considered; all work during the hackathon; **3-minute pitch + 2 minutes of judge questions** (so the old plan stands; §7's "5 minutes" is wrong); a **pre-recorded or live demo**.
- **Judging criteria:** Application (feasible real-world use, who it helps), Intentionality (purposeful design for target users), Functionality (live demo runs smoothly; **include a clear video demo on Devpost** for sponsors judging asynchronously), Creativity, Technical Complexity.
- **Anthropic: no row on the Devpost prize list** (and none for Annapurna). Its prize and criteria exist only in the organizer emails (§11). Ask at the Anthropic booth how to enter the track.
- **General prizes that fit us:** Best People-First Social Impact Hack (Apple Watch SE 3 each), plus First–Third Overall, Most Creative, Most Technically Advanced, Hacker's Choice. Opt into everything relevant at submission.
- **Convex:** $1,308 cash + hardware. **Cartesia:** $1,516 cash + Meta glasses (TBD). **Figma:** five $1,000 tracks (Best Use Case of Figma, Figma Agent, Most Creative Use of Figma Agent, Best Design, Most Creative) with Amazon gift cards; criteria still unseen. **Visa Reimagining Shopping:** $5,000.
- **SpaceXSI "Make it Legendary":** $400 + keyboard. Page text: theme is **real space data** ("public datasets, decades of missions"); eligibility is **built with Cursor**; Grok Bot is a planning/collaboration bonus; everyone who submits is entered in the Owala raffle. **No Grok API requirement on the Devpost page** (the website row differs). Chartitable has no space data, so this track is a long shot; the raffle and MLH A-Team track are the realistic upside.
- **MLH Commit Fellowship category** appears on the page: opt in at submission and fill the supplemental form (a "working prototype with a team, a real problem worth solving" fits Chartitable).
- Page still has no explicit field list; fields appear when a project is started.

---

## 13. Meta track and Meta model API (Haiku pass, Sat Oct 24 ~2 AM PT; VERIFIED = page opened)
- **Track:** "Meta/Facebook: Bringing People Closer Together with AI". $0 cash; prize is an invitation to a Round 2 hackathon at Meta's Menlo Park campus (travel and accommodations provided, subject to eligibility and Meta's Round 2 Official Rules) plus a swag bag. VERIFIED.
- **Judging (Hive page, paraphrased):** how meaningfully the project strengthens human connection; how essential and well-integrated the AI is; originality; strength of the working demo. **No Meta model/API/SDK is required.** It is a theme. VERIFIED.
- **Unknown:** Meta Round 2 Official Rules (age, student status, location); no rules link on either site.
- **Participation rules (Devpost):** 18+, college students only, team of 2–4 (Hive FAQ says 1–4). Pitch 3 min + 2 min Q&A.
- **Meta's developer API:** the Llama API was replaced by "Meta Model API" (api.meta.ai/v1; OpenAI- and Anthropic-SDK compatible; JSON-schema structured output). Models are the Muse family (muse-spark-1.3 etc.), not Llama. Pay-as-you-go (~$1.25/M input, $4.25/M output for muse-spark-1.3); no free tier or hackathon credits found. **"Contributor" pricing is cheaper but prompts/outputs may be used to train Meta models: never use it with donor data.** The consumer "Meta AI" assistant is not a developer backend. VERIFIED except retirement date of Llama API (secondary source).
- **Multi-vendor:** no Cal Hacks text bars using another LLM alongside Claude for the Anthropic track (not stated either way).
