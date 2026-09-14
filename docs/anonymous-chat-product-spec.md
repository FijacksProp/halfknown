# halfknown — Anonymous Personality-First Matching Platform

## Product Requirements and Architecture Specification

**Status:** Product definition approved in principle; backend foundation implemented, full MVP pending  
**Platform:** Responsive web application / Progressive Web App (PWA)  
**Audience:** Adults aged 18 and over  
**Primary uses:** Dating, flirting, friendship, and casual conversation  
**Name:** halfknown

### Agreed direction and current build status

- International audience, adults 18+, with English as the initial interface language. Friendship, conversation, and dating receive equal care, with a slight romantic emphasis.
- Playful and youthful, balanced with mature, intimate, safety-focused interactions. The planned visual palette is white, red, black, and blue.
- Illustrated fictional humans, animals, aliens, and other creatures. Initial character artwork will be AI-generated in a later session; the current system uses placeholder avatar identifiers.
- Django is the backend foundation. Standard Next.js/React/TypeScript is the frontend target. The existing `web/` implementation uses Vinext and now integrates onboarding with Django locally; it is not yet an installable PWA. The prior hosted preview is not connected to the backend.
- Implemented: email-code authentication, private account/profile separation, adult birth-date validation, matching preferences, blocks, mutual eligibility rules, and authenticated account WebSockets. Local onboarding supports profile creation after verification, returning sign-in, session-based recovery, preference editing, and logout. Character assets remain placeholders and development disclosures are not final launch policies.
- Not yet implemented: live matching queues, person-to-person messaging, progressive reveal, reporting/moderator workflows, payments, or production deployment. Email verification proves inbox access, not identity or age.

This document describes the intended product, not a claim that all listed features work today. See [the backend API contract](backend-api.md) and [setup instructions](../README.md) for implementation details.

---

## 1. Executive summary

This product is an adult-only, personality-first matching platform where people meet through conversation before revealing their real-world identity. It combines two experiences:

1. **Open Chat** quickly connects users who are comfortable speaking with any mutually eligible person currently available.
2. **Compatible Match** connects users using mutual gender, age, intention, language, location, interest, and safety preferences.

Every conversation begins with an anonymous alias and illustrated avatar. Users reveal personal information progressively and only when both participants explicitly agree. Users are anonymous to one another at first, but the platform privately verifies accounts and maintains controls needed to prevent abuse.

The first release will be a responsive website and installable PWA. Native applications can follow after the product demonstrates healthy retention, manageable moderation demand, and a repeatable local-growth strategy.

### Core promise

> Meet the mind before seeing the face.

### Primary outcome

Help every new user have a safe, respectful conversation they genuinely want to continue.

---

## 2. Problem statement

Most dating products encourage rapid, appearance-led evaluation. Random-chat products create immediate interaction but often suffer from weak intent alignment, harassment, sexual content, bots, scams, and low-quality conversations. Conventional social networks introduce public identity, popularity metrics, and reputational pressure before a genuine conversation begins.

This product occupies the space between those categories:

- More intentional and accountable than random stranger chat
- Less appearance-driven than traditional dating applications
- More private than conventional social media
- Faster than lengthy matchmaking questionnaires
- Safer than fully unverified anonymous communication

Anonymity is a temporary social mechanism, not permission to behave without consequences.

---

## 3. Product principles

### 3.1 Conversation before appearance

Initial matching emphasizes shared interests, intentions, personality, and conversation style. Photographs are not visible before mutual consent.

### 3.2 Mutual compatibility

No feature or algorithm may override another person's gender, age, location, block, or safety preferences.

### 3.3 Anonymous but accountable

People can hide their real-world identity from matches, but the platform verifies accounts, prevents repeated abuse, and preserves evidence required to investigate valid reports.

### 3.4 Progressive trust

Users reveal information in independent stages. Revealing a first name does not automatically reveal a photograph, voice, exact location, or contact details.

### 3.5 Fast, meaningful onboarding

Registration should feel like the beginning of the experience, not paperwork. Initially collect only information required for eligibility, safety, and useful matches.

### 3.6 Safety as a product surface

Safety controls must be visible within matching and conversations, not hidden in settings or legal pages.

### 3.7 Monetize convenience, not consent

Core communication, safety, basic matching preferences, and gender compatibility remain free. Premium features can increase convenience, customization, or eligible introductions, but never sell access to an unwilling person or a particular gender.

### 3.8 Healthy engagement

Progress systems reward profile completion, reliability, respectful conduct, and meaningful exchanges—not compulsive swiping, message volume, rejection, or popularity.

---

## 4. Audience and launch market

### 4.1 Initial audience

The audience is adults aged 18 and over internationally, with a youthful tone rather than an upper age restriction, who:

- Are tired of appearance-first matching
- Prefer conversation before sharing photographs
- Identify as introverted, thoughtful, private, or socially curious
- Want dating, flirting, friendship, or casual conversation
- Are comfortable using a pseudonym during an initial interaction

### 4.2 Geographic strategy

Design for an international audience from the start. Concentrate early acquisition around language communities, shared interests, and scheduled launch sessions to create matching density. This is a growth strategy, not a single-country product restriction. Public availability still depends on supported moderation languages and local launch requirements; never imply users are available where the pool is empty.

### 4.3 Intentions

The platform supports:

- Dating
- Flirting
- Friendship
- Casual conversation

Users may select multiple intentions. A match is eligible only when both users share at least one active intention. The shared intention is visible before both accept.

---

## 5. Experience architecture

### 5.1 Primary journey

```text
Landing page
    |
    v
Quick, playful onboarding
    |
    v
Passwordless verification
    |
    v
Home
    |
    +-----------------------------+
    |                             |
    v                             v
Open Chat                 Compatible Match
    |                             |
    +-------------+---------------+
                  |
                  v
          Mutual invitation
                  |
                  v
        Anonymous conversation
                  |
                  v
          Private vibe check
                  |
        +---------+----------+
        |                    |
        v                    v
Mutual continuation     Conversation ends
        |
        v
Progressive identity reveal
        |
        v
Saved connection
```

### 5.2 Conversation lifecycle

```text
Queued
  -> Invitation sent
  -> Both users accept
  -> Anonymous conversation starts
  -> Continuation becomes available
  -> Each user decides privately
     -> Both continue: connection created
     -> One or both decline: conversation closes neutrally
     -> Safety concern: block/report flow begins
```

The platform must not reveal that a specific person rejected the user. Use a neutral closure message:

> This conversation has ended. Thanks for showing up authentically.

---

## 6. Information architecture

### 6.1 Public pages

- Landing page
- How it works
- Safety center
- Community guidelines
- Privacy policy
- Terms of service
- Contact/support
- Sign in
- Create account

### 6.2 Authenticated pages

- Home
- Open Chat setup
- Compatible Match setup
- Matching queue
- Match invitation
- Conversation room
- Connections
- Activity and notifications
- Anonymous profile
- Private account settings
- Matching preferences
- Privacy and safety settings
- Blocked accounts
- Subscription and billing
- Help and support
- Account export and deletion

### 6.3 Internal pages

- Operations overview
- User search and account review
- Report queue and report detail
- Moderation action history
- Appeals queue
- Safety analytics
- Matching-pool health
- Subscription and payment support
- Feature flags
- Audit logs

### 6.4 Navigation

Mobile navigation contains Home, Match, Connections, Activity, and Profile. Desktop uses a left navigation rail, central work area, and optional right panel for active conversations, matching status, or safety information.

---

## 7. Registration and onboarding

### 7.1 Objective

The required path should take approximately 45–60 seconds and use friendly questions, cards, selections, and animation rather than a long form.

### 7.2 Eligibility

Collect:

- Date of birth
- Confirmation that the user is at least 18
- Country or region
- Acceptance of Terms of Service
- Acceptance of Community Guidelines

Public profiles expose an age or age range, never a full date of birth.

### 7.3 Intention

Prompt: **What kind of connection are you open to?**

Users choose at least one of Dating, Flirting, Friendship, or Casual conversation.

### 7.4 Identity and preferences

Collect:

- Gender
- Pronouns, optional
- Whether gender is initially visible
- Genders the user is comfortable matching with
- Preferred age range
- Primary and additional languages
- Approximate area
- Maximum distance, when location matching is enabled

Basic gender matching is free. Preferences are applied mutually; one-sided compatibility is insufficient.

### 7.5 Personality setup

Initially require:

- Three to five interests
- Conversation style
- Social energy
- One short prompt response

Potential conversation styles include playful, thoughtful, deep, lighthearted, adventurous, and supportive.

Prompt examples:

- A subject I could discuss for hours is...
- My ideal unplanned day would be...
- Something small that always improves my mood is...
- I connect best with people who...
- A harmless opinion I will defend forever is...

Collect additional details progressively after the first session.

### 7.6 Anonymous identity

Generate:

- A pseudonymous alias such as `QuietComet`
- An illustrated avatar
- A base color theme

Allow several shuffles and minor customization. Do not use generated photographs of realistic people. Screen aliases for offensive content and contact information.

### 7.7 Verification

Use a passwordless email magic link or six-digit code. Users may finish onboarding and preview Home before verification, but must verify before joining a queue, accepting an invitation, or sending a message.

Possible future trust options:

- Phone verification
- Selfie/liveness verification
- Photograph verification

Private verification details never appear in the anonymous profile.

### 7.8 Returning sign-in

Use email magic link, OTP, or passkey when supported. Traditional passwords are not required for the MVP.

---

## 8. Home experience

Home prioritizes action rather than passive scrolling.

Required sections:

- Personalized greeting
- Open Chat entry point
- Compatible Match entry point
- Active conversations
- Pending mutual decisions
- Daily conversation prompt
- Upcoming matching events
- Anonymous-avatar progress
- Relevant safety notices

New users see a concise explanation and a recommended first action. Never display fabricated online counts, profiles, or activity.

Presence labels should be approximate: Available now, Recently active, or Away. Do not expose exact activity timestamps.

---

## 9. Open Chat

### 9.1 Purpose

Open Chat provides fast, low-pressure conversation for people who explicitly agree to meet any mutually eligible person regardless of gender. It is primarily for friendship and casual topic-based conversation. Dating or flirting applies only when both users select that shared intention.

### 9.2 Session setup

Ask for:

- Active intention
- Language
- One or more topics
- Time available
- Maximum acceptable age difference

### 9.3 Hard eligibility

- Both opted into Open Chat
- Shared intention
- Compatible language
- Mutually acceptable age boundaries
- No block relationship
- No recent duplicate match
- Both accounts allowed to match
- Neither exceeds the concurrent-conversation limit

Gender is not a selection filter in Open Chat. Users requiring gender compatibility use Compatible Match.

### 9.4 Selection

Use weighted randomness based on waiting time, shared topics, reliability, recent match diversity, safety status, and session duration.

### 9.5 Anti-search controls

- Limit rapid skips
- Add cooldowns after repeated abandonment
- Do not reveal gender immediately
- Do not allow unlimited invitations
- Record patterns of instant exits

---

## 10. Compatible Match

### 10.1 Purpose

Compatible Match is the primary dating, flirting, and intentional-friendship experience. It produces a surprise match from a mutually eligible pool instead of an appearance-based catalogue.

### 10.2 Session setup

Ask for active intention, desired conversation energy, available time, and an optional topic. Suggested time choices are five minutes, fifteen minutes, or open-ended.

### 10.3 Hard filters

- Mutual gender compatibility
- Mutual age compatibility
- Shared active intention
- Language compatibility
- Location boundary, if enabled
- Accounts in good standing
- No block relationship
- No incompatible safety restriction
- Available conversation capacity

### 10.4 Soft ranking

- Shared interests
- Conversation-style fit
- Waiting time
- Invitation responsiveness
- Conversation completion
- Positive private feedback
- Recent match diversity
- Prior encounters

### 10.5 Selection model

1. Build the eligible pool.
2. Calculate a quality score.
3. Add waiting-time fairness.
4. Remove risky or repetitive candidates.
5. Randomly select from the highest-quality eligible band.

This preserves surprise while protecting compatibility and fairness.

### 10.6 Invitation

Show alias, illustrated avatar, shared intention, shared interests, one prompt response, and conversation duration. Do not show a photograph, exact location, contact information, full birth date, or exact activity history.

Both participants accept within a short reservation period such as 45 seconds. If either declines or times out, return the other to the queue without revealing who declined.

### 10.7 No-match state

Offer users the ability to:

- Wait in the background
- Receive a notification when an eligible match becomes available
- Create an asynchronous introduction
- Switch to Open Chat
- Join a scheduled matching event

Never create fake profiles or simulated users to conceal low liquidity.

---

## 11. Conversation room

### 11.1 Header

Display alias, avatar, shared intention, duration, safety menu, and an end-conversation action.

### 11.2 MVP features

- Text messages
- Emoji reactions
- Reply to message
- Typing indicator
- Configurable read receipts
- Conversation prompts
- Block
- Report
- End conversation

### 11.3 Deferred features

Do not include image uploads, video, files, unrestricted links, payments, live location, or disappearing report evidence in the MVP. Voice features can follow after moderation and consent controls mature.

### 11.4 Prompts

Prompts appear only when conversation slows or both users request one. They can be dismissed for the conversation.

Examples:

- What is something you could teach someone?
- What makes you immediately comfortable around another person?
- Spontaneous adventure or carefully planned weekend?
- You both selected music. What song describes your week?

### 11.5 Limits

Limit simultaneous new conversations, detect repeatedly accepted but ignored invitations, and add temporary cooldowns for disruptive behavior. Explain limits as quality controls.

---

## 12. Vibe check and continuation

The private vibe check becomes available after roughly five active minutes or a minimum number of messages from both people.

Each user privately chooses:

- Continue anonymously
- Save as a connection
- Request a specific reveal
- End the conversation

The selection remains private until both make compatible choices.

Optional private feedback asks whether the other person was respectful, matched the stated intention, and would be welcome in a future match. This influences quality and safety but never becomes a public score.

If continuation is not mutual, close neutrally, do not reveal who declined, allow archiving, and retain report evidence according to policy.

---

## 13. Progressive reveal

### Level 0: Anonymous

- Alias
- Illustrated avatar
- Age or age range
- Broad region, optional
- Interests
- Conversation style
- Shared intention
- Selected prompt responses
- Non-numerical trust indicators

### Level 1: Personal profile

Individually revealable:

- First name
- Exact age
- General area
- Expanded biography
- Additional prompts
- Gender and pronouns, if hidden initially

### Level 2: Media

Individually revealable:

- Profile photograph
- Voice introduction
- Photograph-verification indicator

Media is scanned for prohibited content and abuse signals before display.

### Level 3: External connection

Users may mutually exchange a phone number, social profile, or external messaging handle. Before doing so, show concise privacy and scam warnings, particularly about money, cryptocurrency, gift cards, financial assistance, or account access.

Every reveal category is independent. Explain that already viewed or copied information cannot be recovered.

---

## 14. Connections

A connection is created only when both users agree.

Categories:

- Anonymous connections
- Partially revealed connections
- Fully revealed connections
- Archived conversations
- Pending mutual decisions

Controls:

- Mute
- Archive
- End connection
- Block
- Report
- Review reveal permissions
- Delete the local conversation view

Do not include follower counts, public connection counts, or popularity rankings.

---

## 15. Profile system

### 15.1 Anonymous profile

- Alias and avatar
- Age or age range
- Broad location
- Intentions
- Interests
- Conversation style
- Short biography
- Prompt responses
- Trust indicators

### 15.2 Private account profile

- Email and birth date
- Verification state
- Authentication methods
- Active sessions and devices
- Subscription state
- Privacy preferences
- Block list
- Moderation and appeal state

Private identity data should be logically and, where practical, physically separated from anonymous-profile data.

### 15.3 Trust indicators

- Email verified
- Phone verified
- Photo verified
- Established member
- Consistently respectful

Do not expose a numerical trust score or allow behavioral trust to be purchased.

---

## 16. Gamification

Gamification makes positive participation enjoyable without encouraging addiction or popularity contests.

### 16.1 Avatar progression

An avatar can begin as a spark, seed, creature, or constellation and evolve through profile completion, reliable participation, respectful conversation, positive private feedback, event participation, and account age in good standing.

### 16.2 Unlocks

- Avatar accessories
- Color palettes
- Backgrounds
- Profile themes
- Prompt packs
- Seasonal collectibles

### 16.3 Private milestones

- First completed profile
- First meaningful conversation
- First mutual continuation
- First mutual reveal
- First week in good standing
- First themed event

### 16.4 Prohibited mechanics

Do not reward or publicly rank raw message volume, total matches, rejection, hours online, appearance votes, popularity, or stressful daily streaks.

---

## 17. Gender matching and pool balance

### 17.1 Core rule

Gender preferences are free. Compatible Match requires mutual preference compatibility. Open Chat ignores gender only because every participant opted into that mode.

### 17.2 Why gender access is not paid

Charging users to choose a gender would create incompatible free matches, harm orientation and comfort requirements, resemble selling access to a gender, increase pressure on scarce groups, and reduce trust.

### 17.3 Pool-health controls

- Limit concurrent new conversations
- Rate-limit repeated invitations and instant exits
- Prioritize reliable participants
- Prevent unmanageable request queues
- Use scheduled matching windows
- Encourage but never force broader preferences
- Display honest wait states
- Concentrate launch activity in dense language/interest cohorts within the international audience

### 17.4 Premium fairness

Premium may provide more eligible introductions or notifications, but cannot override preferences, bypass safety restrictions, enable unsolicited messages, guarantee access to a demographic, or make free users invisible.

---

## 18. Trust and safety

### 18.1 Account controls

- Verification before chat
- New-account rate limits
- Device and network abuse signals
- Suspicious-login detection
- Session management
- Probation controls
- Temporary restrictions
- Permanent bans for serious or repeated violations
- Ban-evasion detection
- Documented appeals

### 18.2 Message risk detection

Detect or restrict:

- Threats and harassment
- Hate speech
- Non-consensual sexual content
- Sexual content involving minors
- Doxxing
- Copy-paste solicitation
- Payment, cryptocurrency, and gift-card requests
- Suspicious links
- Contact-detail harvesting
- Impersonation
- Spam and automation

Automated signals triage content. High-risk, ambiguous, and appealed cases require human review.

### 18.3 Reporting

Users select a reason, select relevant messages, add optional context, block immediately, and submit.

Report categories:

- Harassment
- Sexual content
- Hate or discrimination
- Scam or money request
- Suspected underage user
- Impersonation
- Threat or violence
- Private-information exposure
- Spam
- Other

### 18.4 Blocking

Blocking immediately stops messages, removes both users from each other's pool, prevents visibility where possible, preserves reported evidence, and does not identify who initiated it.

### 18.5 Location privacy

- Never expose coordinates
- Use broad areas or approximate distance
- Avoid continuous distance updates
- Prevent triangulation through repeated queries
- Let users disable location matching
- Separate coordinates from public profile data

### 18.6 Staff access

Staff access to messages and identity information is role-based, limited to legitimate needs, logged, reviewable, and revoked when no longer required.

---

## 19. Privacy and data governance

Clearly explain what is collected, what matches see, what staff can access, how moderation works, retention periods, deletion, and data-export rights.

Do not advertise end-to-end encryption if server-side moderation or report review requires message access. State accurately which data is encrypted in transit and at rest.

Data-minimization rules:

- Collect only what a feature requires
- Use broad location where possible
- Do not require a legal name for ordinary use
- Keep verification information private
- Limit analytics identifiers and retention
- Never sell private-conversation data

Define separate retention policies for active conversations, closed unreported conversations, report evidence, security logs, payments, staff audit logs, and deleted-account abuse-prevention records. Final periods require legal review in every launch market.

---

## 20. Notifications

Transactional notifications:

- Verification code or link
- Compatible match available
- Invitation expiring
- New connection message
- Mutual continuation
- Reveal accepted
- Security event
- Report or appeal update

Optional notifications:

- Matching event reminder
- Avatar reward
- Profile reminder
- Product news
- Promotional offer

Users separately control email, browser push, matching, messages, and marketing. Notifications must describe real events; never fabricate interest.

---

## 21. Monetization

### 21.1 Free foundation

- Registration and verification
- Anonymous profile
- Basic gender and age preferences
- Open Chat
- Reasonable Compatible Match allowance
- Messages with active matches
- Basic continuation and reveal
- Blocking, reporting, and all safety features

### 21.2 Premium subscription

- Additional compatible introductions
- Advanced interest/lifestyle filters
- Incognito mode
- Travel mode
- Undo a recent pass
- Reconnect with an expired conversation
- Background match notifications
- More avatar customization
- Premium themes and prompt decks
- Early event access

### 21.3 One-time purchases

- Seasonal avatar packs
- Profile themes
- Additional eligible introductions
- Specialized matching-event tickets

### 21.4 Restrictions

Never monetize safety tools, basic privacy, ordinary replies, access to a gender, preference bypasses, or private rejection decisions. Do not support payments, loans, gifts, cryptocurrency transfers, or financial requests between matches.

Advertising is excluded from the MVP. Future ads must never appear inside private conversations or use private-message content for targeting.

---

## 22. Moderation console

### 22.1 Operations dashboard

- Online users by mode
- Eligible pool size by intention and broad demographic
- Matching wait percentiles
- Invitation acceptance
- Conversation completion
- Block/report rates
- High-risk activity
- Moderation queue age
- Service health

### 22.2 User review

Authorized staff can review account ID, verification, restrictions, sessions, device/abuse signals, reports, moderation decisions, appeals, and internal notes. Sensitive identity access requires elevated permission and an audit entry.

### 22.3 Report review

Show the reason, selected messages, limited surrounding context, automated risk signals, relevant user histories, available actions, and a required rationale.

### 22.4 Actions

- No action
- Warning
- Feature restriction
- Matching cooldown
- Temporary suspension
- Permanent ban
- Specialist escalation
- Appropriate legal/emergency escalation where required

Every action creates an audit record. Eligible decisions include a plain-language notice and appeal path, preferably reviewed by someone other than the original moderator.

---

## 23. Data model

### Identity and authentication

- `users`
- `private_user_profiles`
- `auth_identities`
- `sessions`
- `devices`
- `verification_attempts`
- `account_restrictions`

### Profiles and preferences

- `anonymous_profiles`
- `avatars`
- `avatar_items`
- `user_avatar_items`
- `interests`
- `user_interests`
- `profile_prompts`
- `user_prompt_answers`
- `match_preferences`
- `user_intentions`

### Matching

- `matching_sessions`
- `matching_queue_entries`
- `match_candidates`
- `match_invitations`
- `matches`
- `match_feedback`
- `matching_events`

### Conversations

- `conversations`
- `conversation_members`
- `messages`
- `message_reactions`
- `conversation_prompts`
- `conversation_prompt_events`
- `conversation_closures`

### Reveal and relationships

- `reveal_requests`
- `reveal_permissions`
- `revealed_profile_fields`
- `connections`
- `connection_events`

### Safety

- `blocks`
- `reports`
- `report_messages`
- `moderation_cases`
- `moderation_actions`
- `appeals`
- `risk_signals`
- `staff_audit_logs`

### Commercial and communications

- `subscription_plans`
- `subscriptions`
- `purchases`
- `entitlements`
- `notifications`
- `notification_preferences`

### Analytics

- `product_events`
- `experiments`
- `experiment_assignments`
- Aggregated matching-health tables

Analytics must use internal identifiers and never copy message bodies into general analytics systems.

---

## 24. Matching-engine design

### 24.1 Inputs

- Mode and intention
- Gender and mutual gender preferences
- Age and mutual age preferences
- Language
- Approximate location/distance
- Interests and conversation style
- Availability and conversation capacity
- Prior matches and blocks
- Account restrictions
- Reliability and safety signals

### 24.2 Hard-filter stage

Remove candidates who fail any eligibility condition. Never soften safety or mutual preference constraints because a pool is small.

### 24.3 Ranking stage

An explainable initial model:

```text
candidate_score =
    shared_interest_score
  + conversation_style_score
  + wait_time_fairness
  + reliability_score
  + match_diversity_score
  - recent_repeat_penalty
  - abandonment_risk_penalty
```

Weights are configurable and tested against conversation quality, not raw volume.

### 24.4 Selection and reservation

Randomly select from a high-quality eligible band. Atomically reserve both users, send invitations, create a conversation only after both accept, release reservations on decline/timeout, and apply a brief requeue delay. A user cannot be reserved for multiple new live conversations simultaneously unless that state is explicitly supported.

---

## 25. Technical architecture

### 25.1 Recommended MVP stack

Frontend:

- Standard Next.js with React (target; existing prototype uses Vinext)
- TypeScript
- Tailwind CSS
- Accessible component primitives
- PWA manifest and service worker (planned; not in the current prototype)

Backend:

- Django 5.2 LTS as the modular application backend
- Django REST Framework for versioned HTTP APIs
- Django Channels and Daphne for ASGI/WebSocket connections
- Celery for background jobs
- Django admin as an internal foundation; purpose-built moderation workflows remain necessary

Infrastructure:

- PostgreSQL for durable data
- Redis for presence, queues, reservations, cooldowns, and rate limits
- WebSockets for messages, invitations, typing, and presence
- Object storage for avatars and future moderated media
- Background jobs for email, notifications, cleanup, and moderation
- Transactional email provider
- Error monitoring
- Privacy-conscious analytics

### 25.2 Architecture approach

Begin as a modular monolith with domains for Identity, Profiles, Matching, Conversations, Reveal/Connections, Trust/Safety, Notifications, Billing, and Administration. Split services only when scale, reliability, security boundaries, or team ownership justify the complexity.

Django is authoritative for authentication, consent, eligibility, and message access. PostgreSQL stores durable records; Redis carries transient cross-worker coordination and events, not the sole copy of chat history. Keep background email and moderation tasks out of the message-delivery path. Use a single browser origin with HTTP-only session cookies, CSRF-protected APIs, and explicit WebSocket origin validation.

The lightweight local mode uses SQLite and in-memory channels for functional development. The supplied Docker Compose configuration describes PostgreSQL, Redis, Django, Celery, and captured development email. Neither local tests nor this configuration constitute a production capacity benchmark.

### 25.3 Real-time events

- `presence.updated`
- `queue.joined`
- `queue.left`
- `match.invited`
- `match.accepted`
- `match.expired`
- `conversation.started`
- `message.created`
- `message.read`
- `typing.started`
- `typing.stopped`
- `reveal.requested`
- `reveal.accepted`
- `conversation.ended`

All events require server authorization. Clients never determine eligibility, reveal permission, or moderation state.

### 25.4 Security baseline

- TLS for all traffic
- Encryption at rest
- Secure HTTP-only same-site cookies
- Short-lived sessions
- CSRF protection
- Content Security Policy
- Input validation and output encoding
- Per-route/account rate limits
- Secrets outside source control
- Dependency monitoring
- Role-based staff access
- Protected audit records
- Account export/deletion workflows

---

## 26. Non-functional requirements

### Accessibility

- Target WCAG 2.2 AA
- Keyboard navigation and visible focus
- Screen-reader labels
- Sufficient contrast
- Reduced-motion support
- No color-only communication
- Accessible live announcements for invitations/messages

### Performance

- Fast mobile first load
- Optimized avatar assets
- Paginated conversation history
- Efficient reconnect after network loss
- Lazy-loaded nonessential dashboard content

### Reliability

- Idempotent message submission
- Duplicate-event protection
- Durable match/message creation
- Reconnect handling
- Queue-reservation expiry
- Alerts for elevated failures or report volume

### Internationalization

- UTC timestamps with local presentation
- Translated interface strings
- User language preferences
- Layouts that support text expansion
- Moderation coverage before enabling a language

---

## 27. Product analytics

### Acquisition and onboarding

- Landing-to-registration conversion
- Completion by onboarding step
- Verification completion
- Onboarding duration
- First matching-mode selection

### Matching

- Time to invitation
- Invitation acceptance/timeout/decline
- No-match rate
- Wait time by pool
- Repeat-match rate

### Conversation quality

- First-message send/response
- Conversations reaching five and ten mutual messages
- Active duration
- Prompt usage
- Mutual continuation
- Mutual reveal
- Connection creation

### Retention

- Day-one, day-seven, and day-thirty retention
- Returning users with active connections
- Weekly meaningful conversations per active user

### Safety

- Blocks/reports per 1,000 conversations
- Report categories
- Repeat-offender rate
- Moderation decision time
- Appeal outcomes
- Scam-link/payment-request detection
- Suspected underage accounts

### Monetization

- Trial starts and conversions
- Paid conversion
- Revenue per payer
- Subscription retention
- Refunds
- Premium feature usage

### North-star metric

> Weekly successful conversations: conversations in which both users participated meaningfully, no safety event occurred, and both chose to continue or gave positive private feedback.

Registrations, matches, and raw messages are supporting metrics, not the primary definition of success.

---

## 28. Delivery scope

### 28.1 Prototype

- Brand direction and landing page
- Playful onboarding
- Avatar generation/shuffle
- Home
- Both matching setups
- Invitation flow
- Conversation room
- Vibe check and reveal
- Block/report prototype

Validate comprehension, emotional appeal, and perceived safety before adding backend complexity.

### 28.2 MVP

- Passwordless registration
- Adult eligibility gate
- Anonymous profiles
- Intentions/preferences
- Email verification
- Open Chat and Compatible Match
- Real-time text
- Prompts/reactions
- Mutual continuation
- Basic progressive reveal
- Connections
- Block/report
- Moderation console
- Notification settings
- Responsive PWA
- Core product/safety analytics

### 28.3 Post-MVP

- Optional phone verification
- Photo verification
- Voice introductions
- Matching events
- Expanded avatar progression
- Premium subscription
- Incognito and travel modes
- Improved scam detection
- Advanced compatibility signals

### 28.4 Later expansion

- Native applications
- Moderated media messaging
- Audio conversations
- Local events
- Group conversations
- Interest communities
- Specialized matching formats

### 28.5 Out of MVP scope

- Public feed and stories
- Video calls
- Live location
- Payments between users
- Anonymous public posting
- Public profile browsing
- Appearance voting
- Follower counts
- AI romantic companions

---

## 29. Launch readiness

Public launch requires:

- Terms of Service, Privacy Policy, and Community Guidelines
- Adult eligibility controls
- Email verification
- Block/report flows
- Moderator access and escalation procedures
- Abuse rate limiting
- Security logging
- Account deletion
- Support contact and incident owner
- Honest low-liquidity states
- Tested reservation logic
- Tested mobile chat
- Service and moderation monitoring

---

## 30. Key risks and mitigations

### Insufficient local users

**Risk:** Long waits and repeated matches.  
**Mitigation:** Launch densely, schedule events, support asynchronous introductions, and show honest wait states.

### Gender imbalance

**Risk:** Excessive pressure on one group and poor marketplace retention.  
**Mitigation:** Mutual eligibility, conversation limits, invitation controls, reliability weighting, focused acquisition, and no paid demographic access.

### Harassment and sexual content

**Risk:** User harm and an unsafe reputation.  
**Mitigation:** Verification, rate limits, text-first MVP, detection, blocking, fast reporting, human review, and escalating restrictions.

### Bots and romance scams

**Risk:** Manipulation, off-platform migration, and financial loss.  
**Mitigation:** Verification, automation detection, link restrictions, payment-language detection, warnings, device signals, and delayed external contact.

### False sense of anonymity

**Risk:** Sensitive disclosure based on incorrect assumptions.  
**Mitigation:** Clearly explain platform visibility, storage, reporting, moderation, and the limits of revoking shared information.

### Store-distribution restrictions

**Risk:** Native app rejection/removal because the product resembles random anonymous chat.  
**Mitigation:** Launch web-first, emphasize profiles and intentional matching, implement strong safeguards, and reassess store policies before submission.

### Over-monetization

**Risk:** Free users receive unusable matches and lose trust.  
**Mitigation:** Keep compatibility and communication free; monetize convenience and customization.

---

## 31. Open product decisions

1. Final logo, typography, and character art direction within the approved halfknown brand
2. First acquisition cohorts and launch availability within the international audience
3. Age-assurance approach beyond the agreed 18+ minimum and self-declared birth date
4. Gender and orientation taxonomy
5. Whether location is required
6. Whether Open Chat permits flirting at launch
7. Minimum interaction before vibe check
8. Simultaneous conversation limit
9. Message retention periods
10. Report-response targets
11. Initial premium entitlements
12. Whether asynchronous introductions enter the MVP
13. Initial languages and moderation coverage

---

## 32. Recommended decisions

- Build a responsive web application/PWA first.
- Position it as personality-first matching, not generic anonymous chat.
- Separate Open Chat and Compatible Match.
- Keep gender preferences free and mutual.
- Require private verification before chat.
- Use illustrated avatars, not synthetic photographs.
- Reveal identity progressively through mutual consent.
- Keep the MVP text-only.
- Build moderation and anti-scam systems alongside messaging.
- Design internationally and build density through focused adult acquisition cohorts.
- Monetize convenience, eligible introductions, and customization.
- Measure successful, safe conversations instead of message volume.

---

## 33. Product vision

The platform should feel mysterious without feeling dangerous, playful without feeling childish, and anonymous without feeling lawless. Its long-term advantage should come from conversation quality and a trustworthy reveal process—not an endless stream of strangers.

The ideal experience is simple:

> Two people arrive without photographs or social status, enjoy a genuine conversation, and independently decide that they would like to know one another better.
