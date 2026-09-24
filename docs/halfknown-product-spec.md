# Halfknown — social discovery product specification

**Status:** Current direction, web prototype implemented 2026-09-23
**Audience:** Adults 18+ in an international community
**Promise:** Discover people, build mutual connections, and share what makes you interesting. Friendship, collaboration, and attraction can all begin here.

## Product principles

1. People can browse and follow without paying. A private conversation requires a mutual connection and ordinary messages are free.
2. Every gender can discover people, build an audience, show abilities, and eventually earn through optional support. No gender is treated as the default product or default payer.
3. Character groups make first contact playful and give future community events a theme. They never claim to verify a person's identity, age, or gender.
4. A public Discover profile is opt-in. Existing anonymous accounts stay hidden until their owner chooses otherwise.
5. Gifts are appreciation, not a toll to reach another person. No per-message coins or paid friendship requests.

## First web release

### Entry and identity

- A visitor chooses one of six illustrated identities across human, animal, alien, goblin, and vampire groups; selects optional interests and a self-described gender; confirms 18+; accepts the policies; and decides whether to appear in Discover.
- A temporary guest account starts without email. The owner can attach a new email through a six-digit verification code and retain the same profile, connections, showcase, and messages.
- An email already attached to another account requires signing in to that account. Guest identities are not silently merged.
- A visitor chooses a unique username during entry. Existing members can change theirs in My space; older generated aliases remain until changed. The avatar may be changed within the assigned character group. Real photos and identity verification are future features, not simulated in the current UI.

### Discover and profiles

- Discover lists only active, opt-in profiles and excludes the viewer and anyone blocked in either direction.
- People can search aliases and introductions and filter by interest or character group. No gender preference or paywall is present yet.
- A profile shows the character, alias, introduction, intentions, interests, follower count, and up to six showcase items.
- The owner may edit their username, introduction, character, intentions, interests, and visibility. Gender changes and independent age verification need a separate future flow.

### Relationships and chat

- Follow is one-way. Either person can request a connection; the recipient accepts, or a reciprocal request accepts it implicitly.
- Only accepted connections can exchange direct messages. Messages are retained server-side and fetched on a short interval in the current web prototype.
- A person can block or report a profile. Reporting stores the reason, details, and recent direct-message evidence for moderation, then blocks. Blocking also removes follows and the connection and ends an active random chat between that pair.
- Quick Meet remains available as a secondary private random text-chat path using the existing queue. Either participant may request to keep in touch while the chat is active; mutual requests create an accepted connection.

### Showcase

- People can share up to six text items labeled talent, project, or interest. This is the first step toward earning from their abilities and personality.
- Showcase entries are descriptive only. No booking, sales, payment, gift, or withdrawal is implied by an item.

## Visual direction

The default appearance is light and warm: cream foundations, charcoal text, red action and attraction cues, blue connection and community areas. Fraunces provides expressive editorial headings; Nunito Sans carries interface text. The group portraits use hand-painted character art. The interface avoids glossy effects, tech-dashboard language, decorative stars, and fake member cards.

The current character art is stored in `web/public/images/halfknown-characters.png` and `web/public/images/halfknown-creators.png`. Avatar IDs map to a group and a portrait crop. Event membership later needs its own recorded group snapshot so changing an avatar does not rewrite past event results.

## Money and creator path

The working prototype has **no real-money features**. A later release may introduce optional gifts on profiles, showcases, and live sessions, plus boosts or subscriptions. Before accepting money, implement a proper wallet ledger, payment reconciliation, refunds and chargebacks, fraud checks, regional taxes/consumer disclosures, creator eligibility, payout rules, and moderation. Gift balances must never be represented as withdrawable income until those systems exist.

Creators of any gender should be able to qualify through transparent, published rules. Payment should reward audience interest or contribution, not private message volume or fabricated romantic attention.

## Release order

1. Stabilize the web discovery loop: entry, profile, discovery, follow, mutual connection, message, showcase, safety, and email recovery.
2. Improve inbox speed with push or WebSocket updates, notifications, search ranking, profile quality, and moderation tools.
3. Package the responsive experience for Android after web usage confirms the navigation and account model. Native device features and app-store checks are separate work.
4. Add verified profiles and optional real photos with clear consent and review rules.
5. Add paid gifting and creator payouts after the ledger and trust systems are ready.
6. Add live rooms and streams. Reels follow only if the community can sustain useful short-form content and moderation.

## Public launch work

The local build is a prototype. Public launch requires final policies, age-assurance decisions, moderation staffing and appeals, retention/deletion controls, abuse and spam limits, deliverable email, backups, PostgreSQL/Redis deployment and load testing, production monitoring, and accessibility review.
