# Halfknown — random text chat product specification

**Status:** Legacy Quick Meet specification. The current product direction is [social discovery](halfknown-product-spec.md).
**Audience:** Adults aged 18 and over  
**Launch surface:** Mobile-first responsive web app / future PWA
**Core format:** Anonymous, random, private, one-to-one text chat

## Product promise

Halfknown connects an adult with one randomly selected adult who is online now. There is no public profile catalogue, swiping, compatibility score, popularity system, or free demographic filter. A person can talk, report a problem, leave the queue, or press **Next** to draw again.

> One stranger. One conversation. No audience.

## First-release journey

1. Open Halfknown in a mobile or desktop browser.
2. Confirm 18+ status, choose a privately stored gender, and accept the data and community notices.
3. Receive a temporary alias and illustrated identity. No email is required for this guest session.
4. Press **Start random chat** and enter the single global queue.
5. Connect immediately when another eligible adult is available.
6. Chat, press **Next**, block, report, or leave.

The person left behind after a skip, leave, or disconnect is returned to the queue automatically when still present. Recently ended pairs are not matched again for ten minutes.

## Free and premium boundaries

The free product includes random text chat across all genders, unlimited ordinary conversations subject to abuse/rate limits, Next, block, and report.

The first plausible premium features are gender preference, broad region preference, translation, queue priority during busy periods, additional anonymous identities, and an ad-free experience. Premium preferences narrow the eligible queue; they must never promise a verified gender or guaranteed instant match. Payments and premium filtering are not implemented yet.

Do not place basic safety controls, ordinary messaging, or the core random queue behind payment. The free population provides the liquidity that makes every queue useful.

## Matching rules

The server, not the client, owns queue and conversation state. The launch queue:

- pairs two distinct, active, session-authenticated adult identities at random from a bounded FIFO candidate band;
- ignores gender, age-range, interest, language, and intention scoring;
- honors blocks in both directions;
- prevents double booking with a database-backed serialization gate;
- expires users who stop sending heartbeats;
- excludes recently ended pairs for ten minutes; and
- never uses fabricated users or silently relaxes a paid filter.

Random matching is a simpler product, not an uncoordinated implementation. Reservation locking, presence leases, idempotency, abuse limits, and stale-request protection remain mandatory.

## Identity and account model

Guests receive a server-side user record tied to their session cookie. Their internal placeholder email is never returned to the browser or shown to another user. Clearing cookies or ending the session can make a guest identity unrecoverable.

Existing verified-email accounts remain supported for returning users. A future account-saving flow may attach an email to a guest identity, but it must verify ownership and safely merge or upgrade the account rather than creating parallel identities.

“Anonymous” means anonymous to the stranger, not invisible to Halfknown. The service still processes session, safety, message, block, and report data. Self-declared gender is not identity verification, and 18+ confirmation is not independent age assurance.

## Conversation and safety behavior

- A match opens immediately; there is no two-party invitation step.
- **Next** ends the current chat and puts both recently present people back into the queue, prioritizing the person who pressed Next for the next draw.
- **Leave** stops the initiating user and returns the present peer to the queue.
- Disconnect expiry removes the absent user and returns a still-present peer to the queue.
- Block prevents the pair from matching again.
- Report stores its reason, optional details, and the latest 20 messages for staff review, then blocks.
- Messages are stored server-side and are not end-to-end encrypted.

The interface must keep Next, Leave, Block, and Report understandable and reachable on small screens. It must not imply that gender is verified, messages disappear, video is available, or moderation happens instantly.

## Visual direction

The visual identity is late-night, private, youthful, and controlled:

- near-black charcoal foundations rather than pure black;
- warm red for primary action and attraction;
- electric blue for connection and system state;
- soft cream text instead of harsh white;
- restrained illustrated anonymous identities;
- subtle texture and asymmetry, with minimal neon.

The experience should feel intimate and trustworthy, not like a casino, an explicit-content site, or a generic AI-generated dating landing page.

## Release sequence

1. Stabilize guest-first random text chat and moderation.
2. Validate queue availability, conversation starts, repeat use, skip rates, and reports.
3. Add installable PWA behavior and notifications where browser support is reliable.
4. Implement account saving and a real subscription entitlement system.
5. Introduce premium filters only after queue size can support them.
6. Consider voice after text moderation is operational. Video comes later because it requires materially stronger moderation, WebRTC infrastructure, privacy controls, and abuse response.

## Public-launch gates

Production launch still requires a hosted single-origin frontend/backend, PostgreSQL and Redis multi-worker tests, load testing, verified email delivery, reviewed policies, retention/deletion rules, age-assurance decisions, device/IP abuse controls, moderation staffing, appeals, monitoring, and backup restoration tests.
