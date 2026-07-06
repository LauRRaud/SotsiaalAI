# Route Review Tracker

> Status: internal working document.
>
> This file is a route-by-route review tracker, not a user-facing or evergreen
> system overview.

Date: 2026-03-07

Purpose:
- Every route is reviewed for behavior, dependencies, error handling, and launch risks.
- Translation cleanup is only one part; functional review is mandatory for each route.

Review status legend:
- `PENDING`: not reviewed yet
- `MONITOR`: reviewed, but needs follow-up/observability or broader integration checks
- `OK`: reviewed and production-ready for current scope
- `FIX`: blocking issue found and needs fix

## App Routes
| Route | File | Status | Notes |
| --- | --- | --- | --- |
| `/` | `app/page.js` | MONITOR | reviewed: home route metadata key-based; role-card/login gate flow in `HomePage` is stable but animation-heavy; `LoginModal` tab focus is trapped inside modal; root metadata description copy aligned to two-assistant wording; footer logos marked decorative for SR and card aria labels shortened; OTP step visual layout simplified (no nested inner panels, compact code input, improved CTA/link spacing); OTP expiry error now renders below code input; home-card chat entry now preserves active locale prefix |
| `/admin/analytics` | `app/admin/analytics/page.jsx` | MONITOR | reviewed: session+admin guard + analytics dashboard i18n key migration; signin callback and non-admin fallback redirects are now locale-safe |
| `/admin/rag` | `app/admin/rag/page.jsx` | MONITOR | reviewed: session+admin guard + wrapper + `RagAdminPanel` key-based i18n pass; signin callback/non-admin fallback and back-link targets are now locale-safe |
| `/join` | `app/join/page.jsx` | MONITOR | reviewed: invite accept flow, auth gate, localized API error resolving via `resolveApiMessage`; post-accept chat navigation now preserves active locale prefix |
| `/kasutusjuhend` | `app/kasutusjuhend/page.jsx` | MONITOR | reviewed: policy-layout guide page with localized section content; internal guide links are now locale-safe (`/en`/`/ru`) via HTML href localization |
| `/kasutustingimused` | `app/kasutustingimused/page.js` | MONITOR | reviewed: metadata key-based + policy body from i18n rich text sections; internal rich-text links are locale-safe via shared RichText href localization |
| `/privaatsustingimused` | `app/privaatsustingimused/page.js` | MONITOR | reviewed: metadata key-based + legal links rendered via controlled rich-text replacements; internal rich-text links are locale-safe via shared RichText href localization |
| `/profiil` | `app/profiil/page.js` | MONITOR | reviewed: metadata key-based + profile shell/orbital actions delegate to `/api/profile` with key-resolved errors; unauth profile no longer auto-opens login modal when arriving from email verification success (`reason=email-verified`); mobile orbital back action now reuses profile back logic (no forced `/profiil` redirect from embedded profile view) |
| `/registreerimine` | `app/registreerimine/page.js` | MONITOR | reviewed: registration wizard flow + `/api/register` integration; fixed PIN input sanitization regex and locale-aware API error resolving; submit loading moved to separate on-page loader and submit-step status card text sizing increased; submitting loader now uses compact glass-style card (loader above text) for visual consistency with login modal; ET verification-email body copy corrected in locale catalog |
| `/room/[roomId]` | `app/room/[roomId]/page.jsx` | MONITOR | room-mode behavior reviewed; continue E2E checks |
| `/rooms` | `app/rooms/page.js` | MONITOR | room list UI/flow reviewed; locale-safe back navigation + room-entry links now preserve active locale prefix; `/rooms -> /ruum` server redirect is locale-safe |
| `/ruum` | `app/ruum/page.js` | MONITOR | rooms redirect/entry path reviewed; continue E2E checks |
| `/taasta-parool` | `app/taasta-parool/page.jsx` | MONITOR | reviewed: forgot-PIN reset-request page sends reset email via `UnustasinParooliBody` (`POST /api/auth/password/reset`) |
| `/taasta-parool/[token]` | `app/taasta-parool/[token]/page.jsx` | MONITOR | reviewed: metadata moved to locale key lookup; reset form validates PIN and calls password reset PUT route |
| `/tellimus` | `app/tellimus/page.js` | MONITOR | reviewed: activation now calls `/api/subscription/init` and opens MakeCommerce recurring iframe checkout; callback-state UX is in place; unauthenticated mode now supports verification-entry flow (`reason=email-verified`) with login modal over subscription page |
| `/uuenda-epost` | `app/uuenda-epost/page.js` | MONITOR | reviewed: profile email update flow via `/api/profile` with current PIN verification and localized API error handling; unauthenticated direct-entry now shows login gate + modal (`suppressRedirect`) and refreshes in-place after auth |
| `/uuenda-pin` | `app/uuenda-pin/page.js` | MONITOR | reviewed: authenticated in-session PIN update UI (`current PIN + new PIN + confirm`) via `PUT /api/profile`; return-to-profile flow preserved with `?return=profile`; unauthenticated direct-entry now shows login gate + modal (`suppressRedirect`); metadata now prefers dedicated PIN-update semantics over reset-request copy |
| `/vestlus` | `app/vestlus/page.js` | MONITOR | chat page behavior reviewed; keep regression checks active; sidebar room/conversation navigation and auth callback path now preserve active locale prefix |

## API Routes
| File | Status | Notes |
| --- | --- | --- |
| `app/api/admin/analytics/events/route.js` | MONITOR | reviewed: admin-gated event log listing, locale-aware key-first errors, guarded DB failure response |
| `app/api/admin/analytics/summary/route.js` | MONITOR | reviewed: admin-gated KPI aggregates, locale-aware key-first errors, guarded DB failure response; includes payment pipeline KPI summary + threshold-based billing alerts from payment events |
| `app/api/admin/analytics/users/route.js` | MONITOR | reviewed: admin-gated per-user analytics (usage, estimated cost, limits, paid amount) using chat logs + analyze usage + subscription/payment joins; user email is masked by default (`ADMIN_ANALYTICS_SHOW_FULL_EMAILS=false`); supports admin bulk actions: selected-user delete (self/admin protected) and bulk email send (selected/all) |
| `app/api/admin/analytics/payment-alerts/dispatch/route.js` | MONITOR | reviewed: admin/cron-key gated external dispatch for critical payment alerts with dedupe, optional dry-run, and signed webhook delivery |
| `app/api/auth/login-resend-otp/route.js` | MONITOR | reviewed: resend flow uses token+IP rate limits and key-first localized errors; behavior remains dependent on in-memory limiter |
| `app/api/auth/login-step1/route.js` | MONITOR | reviewed: invalid credentials now return aligned `401` for both missing-user and wrong-PIN paths (reduced enumeration signal); locale-aware key-first errors |
| `app/api/auth/login-step2/route.js` | MONITOR | reviewed: OTP verification + trusted-device cookie issuance + token/IP rate limits; locale-aware key-first errors |
| `app/api/auth/password/reset/route.js` | MONITOR | reviewed: reset-request + token-PUT flow uses token/IP rate limits, locale-aware key-first errors, and locale-preserving reset-link generation (`/en|/ru` prefix via `localizePath`) |
| `app/api/chat/analyze-file/route.js` | MONITOR | reviewed: multipart/MIME/quota/subscription guard flow is in place; error payloads now return localized `message` values (key-first contract preserved); upload `maxChunks` is now server-clamped (`CHAT_ANALYZE_MAX_CHUNKS`) |
| `app/api/chat/analyze-usage/route.js` | MONITOR | reviewed: authenticated quota-read endpoint with rate limit; error payloads now return localized `message` values (key-first contract preserved) |
| `app/api/chat/conversations/[id]/messages/route.js` | MONITOR | reviewed: message listing is ownership-scoped, archived conversation safe, cursor pagination bounded, and route-level rate limits are applied |
| `app/api/chat/conversations/[id]/route.js` | MONITOR | reviewed: read/archive/restore flow is ownership/admin guarded, archived handling is explicit, and route-level rate limits + DB-offline degraded responses exist |
| `app/api/chat/conversations/route.js` | MONITOR | reviewed: list/create flow is rate-limited and ownership-scoped; server now enforces non-admin conversation role from session (prevents request-body role spoofing) |
| `app/api/chat/route.js` | MONITOR | reviewed: core chat pipeline enforces auth/subscription gate, room sponsorship exceptions, rate limits, and SSE/non-stream paths; gate error payload now consistently includes `messageKey`; document context now uses query-aware chunk selection + role-based char/chunk budgets (instead of prefix-only slice); monthly per-user usage-budget gate is applied before response generation; new natural mode-selection gate now asks the user to confirm whether the turn should become information/guidance, document drafting, help request, or help offer before routing deeper |
| `app/api/chat/run/route.js` | MONITOR | reviewed: run-state read endpoint is ownership/admin scoped, rate-limited, and returns bounded conversation history with DB-offline fallback |
| `app/api/invites/[id]/accept/route.js` | MONITOR | reviewed: token accept flow, billing/sponsorship gating, room member upsert, localized key-based failures |
| `app/api/invites/[id]/resend/route.js` | MONITOR | reviewed: moderator/owner access, token rotation resend, localized key-based failures |
| `app/api/invites/[id]/revoke/route.js` | MONITOR | reviewed: moderator/owner revoke access, localized key-based failures |
| `app/api/invites/route.js` | MONITOR | reviewed: invite list/create, room bootstrap path, sponsorship checks, i18n email template usage |
| `app/api/profile/route.js` | MONITOR | reviewed: profile read/update/delete, current PIN verification path, email-verify dispatch via i18n templates |
| `app/api/rag/[...path]/route.js` | MONITOR | reviewed: proxy now admin-only, locale-aware key-first preflight errors, rate-limit + timeout/error guards |
| `app/api/rag/selftest/route.js` | MONITOR | reviewed: admin self-test flow (RAG list/search + OpenAI check), locale-aware step labels/errors |
| `app/api/register/route.js` | MONITOR | reviewed: rate-limited registration, PIN/email validation, verify-token + email dispatch via i18n keys |
| `app/api/rooms/[roomId]/leave/route.js` | MONITOR | reviewed: leave flow is membership-scoped and blocks owner self-leave; leftAt soft-exit behavior is explicit |
| `app/api/rooms/[roomId]/members/route.js` | MONITOR | reviewed: member listing is membership/admin scoped and returns role-aware room-member summaries |
| `app/api/rooms/[roomId]/messages/[msgId]/route.js` | MONITOR | reviewed: delete flow enforces role-based delete rights (admin/owner/moderator/member-own-message) with soft-delete + SSE delete event |
| `app/api/rooms/[roomId]/messages/route.js` | MONITOR | reviewed: read/send flow enforces membership+subscription sponsorship rules, bounded cursor paging, and room-message POST rate limiting via shared limiter; sponsored access now requires active sponsored or self-paid subscription, not only room membership metadata |
| `app/api/rooms/[roomId]/messages/stream/route.js` | MONITOR | reviewed: SSE stream enforces membership/subscription access on connect and periodic recheck with keepalive and cleanup handling; sponsored access is revalidated against current subscription state |
| `app/api/rooms/[roomId]/read/route.js` | MONITOR | reviewed: read-marker update is membership/admin scoped and respects sponsored membership subscription policy |
| `app/api/rooms/[roomId]/route.js` | MONITOR | reviewed: room delete is owner/admin guarded and returns stable not-found/forbidden semantics |
| `app/api/rooms/route.js` | MONITOR | reviewed: room listing is auth-scoped, role-aware (admin/all vs member), and includes unread/member count aggregation; sponsored rooms are hidden again after sponsored access expires if no own active plan exists |
| `app/api/stt/route.js` | MONITOR | reviewed: authenticated STT now also enforces subscription gate, rate limits, audio MIME/size validation, localized key-first error payloads, emits `stt_request` usage events for admin cost analytics, and checks monthly usage-budget before provider call |
| `app/api/subscription/route.js` | MONITOR | reviewed: read/cancel path stable; direct POST activation is disabled by default (`SUBSCRIPTION_ALLOW_DIRECT_ACTIVATION` override only); returns sponsored subscription metadata for Tellimus ending-soon / expired notices |
| `app/api/subscription/init/route.js` | MONITOR | reviewed: authenticated payment init creates `Payment(INITIATED)` and returns recurring iframe setup (`transactionId`, `publishableKey`, `scriptUrl`); emits structured lifecycle logs |
| `app/api/subscription/callback/route.js` | MONITOR | reviewed: provider return redirect maps callback status to localized `/tellimus` state; callback event logging is enabled |
| `app/api/subscription/webhook/route.js` | MONITOR | reviewed: MAC-check + idempotent payment status updates + subscription activation on `PAID`; side-effects for `REFUNDED/CANCELED/FAILED` are explicit policy envs; webhook verification uses `MAKSEKESKUS_API_KEY`; structured webhook event logs + owner email notifications enabled (`PAYMENT_OWNER_EMAIL`); sponsored invite webhook now preserves invite role metadata and blocks paying for already-active subscribers upstream |
| `app/api/tts/route.js` | MONITOR | reviewed: authenticated TTS now also enforces subscription gate, rate limits, provider fallback (Google/OpenAI), localized key-first error payloads, emits `tts_request` usage events for admin cost analytics, and checks monthly usage-budget before synthesis |
| `app/api/verify-email/route.js` | MONITOR | reviewed: link verification GET + resend POST, token lifecycle cleanup, localized messageKey errors; success redirect now uses localized `/tellimus?reason=email-verified` UX flow |

## Reviewed Scope So Far
- Chat stack: `app/api/chat/*`, `app/api/rooms/*`, `app/api/stt/route.js`, `app/api/tts/route.js`
- Auth reset and OTP stack: `app/api/auth/password/reset/route.js`, `app/api/auth/login-step1/route.js`, `app/api/auth/login-step2/route.js`, `app/api/auth/login-resend-otp/route.js`
- Registration and email verification: `app/api/register/route.js`, `app/api/verify-email/route.js`
- Account and billing core: `app/api/profile/route.js`, `app/api/subscription/route.js`, `app/api/subscription/init/route.js`, `app/api/subscription/callback/route.js`, `app/api/subscription/webhook/route.js`
- Invites stack: `app/api/invites/route.js`, `app/api/invites/[id]/accept/route.js`, `app/api/invites/[id]/resend/route.js`, `app/api/invites/[id]/revoke/route.js`
- Admin and RAG ops APIs: `app/api/admin/analytics/events/route.js`, `app/api/admin/analytics/summary/route.js`, `app/api/admin/analytics/users/route.js`, `app/api/admin/analytics/payment-alerts/dispatch/route.js`, `app/api/rag/[...path]/route.js`, `app/api/rag/selftest/route.js`
- Admin route shells: `app/admin/analytics/page.jsx`, `app/admin/rag/page.jsx`
- Admin analytics UI: `components/admin/AnalyticsDashboard.jsx`, `app/admin/analytics/AdminAnalyticsClient.jsx` (includes payment pipeline KPI cards + payment event filters + per-user cost/limit table + user selection/delete + bulk email composer)
- Admin RAG UI: `components/admin/RagAdminPanel.jsx`, `app/admin/rag/RagAdminClient.jsx`
- Chat frontend integration: `components/alalehed/ChatBody.jsx`, `components/alalehed/chat/ChatBodyView.jsx`, `components/chat/hooks/*`, `components/ChatSidebar.jsx`, `components/LoginModal.jsx`
- App route pass (home/invite/profile/reset/subscription): `app/page.js`, `app/join/page.jsx`, `app/profiil/page.js`, `app/taasta-parool/[token]/page.jsx`, `app/tellimus/page.js`, `components/HomePage.jsx`, `components/alalehed/ProfiilBody.jsx`, `components/alalehed/UnustasinParooliBody.jsx`, `app/taasta-parool/[token]/ResetPasswordForm.jsx`, `components/alalehed/TellimusBody.jsx`
- App route pass (registration/reset/email/legal/guide): `app/registreerimine/page.js`, `app/taasta-parool/page.jsx`, `app/uuenda-pin/page.js`, `app/uuenda-epost/page.js`, `app/kasutustingimused/page.js`, `app/privaatsustingimused/page.js`, `app/kasutusjuhend/page.jsx`, `components/alalehed/RegistreerimineBody.jsx`, `components/alalehed/UnustasinParooliBody.jsx`, `components/alalehed/UuendaEpostiBody.jsx`, `components/alalehed/KasutustingimusedBody.jsx`, `components/alalehed/PrivaatsusBody.jsx`, `components/alalehed/KasutusjuhendBody.jsx`

## Next Review Order
1. Run Maksekeskus sandbox E2E in real provider environment and attach evidence (`docs/payment-maksekeskus-sandbox-e2e.md`, `npm run payments:maksekeskus:e2e`)
2. Set GitHub scheduler secrets for `POST /api/admin/analytics/payment-alerts/dispatch` (`PAYMENT_ALERT_DISPATCH_BASE_URL`, `PAYMENT_ALERT_DISPATCH_KEY`) and validate webhook sink delivery end-to-end
