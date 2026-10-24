# Seed data
ALL DATA IS FICTIONAL: invented charities and donors, no real people or organizations (D5).
`donor_a01` is the demo donor (one $25 gift to `demo-pantry-a`). Emails are null until the lead sets demo inboxes.
Once Convex is linked (`npx convex dev`): `npx convex run seed:load` (optional arg `{"now": <ms>}`).
The loader upserts by `key`, so running it twice creates no duplicates. Placeholder photos live in `seed/photos/`.
