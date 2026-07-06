# Mobile CSS Ownership

`app/styles/mobile/index.css` is the only global mobile entry imported from `globals.css`.

- `../mobile.css` is the compatibility wrapper for the old mobile monolith. It imports owner files in cascade order.
- `chat-bootstrap.css` owns critical mobile chat composer anchoring keyed off the early `data-layout="mobile"` script; it is imported globally because it must run before route hydration.
- Android feature overrides are route-loaded from their own `features/<name>/index.css`; there is no global Android compatibility bundle.
- `subpage-title-system.css` is now a shared mobile header entrypoint. Its owner files live in `mobile/subpage-header/` and cover default tokens, workspace-family offsets, title/back/info placement, title fitting and account-modal sizing. Route-specific header offsets must stay beside the route feature: policy offsets in `features/policy/mobile-header.css`, service-map header controls in `features/service-map/mobile-header.css`, chat topnav title typography in `features/chat/mobile-topnav.css`, admin/RAG exceptions in `features/documents/admin-mobile-header.css`.
- `background-layer.css` owns shared mobile BackgroundLayer reveal and subpage transitions.
- `features/home/background.css` owns home-only mobile background geometry, cards and circular typography.
- `accessibility-modal-fields.css` owns accessibility modal fieldset spacing.
- `login-modal.css` and `login-otp-close.css` own login and OTP modal mobile placement.

- `mobile/touch-controls.css` is now a shared/accessibility compatibility entrypoint only. Register, invite and chat-analysis touch feedback live under `features/register/touch-controls.css`, `features/invite/touch-controls.css` and `features/chat/analysis-touch-controls.css`.
- LoginModal mobile sizing lives under `features/login/index.css` and is imported only by routes that render `LoginModal`; do not add it back to the global mobile chain.
- `modal-surfaces.css` now keeps only cross-feature mobile card tone tokens. Invite/register/auth mid-theme form field tones and modal surface geometry are route-owned through the matching `features/<name>/...` or component entrypoint.
- `interaction-surfaces.css` keeps only shared tap feedback, glass interaction primitives and base mobile page geometry. Do not add invite/account/login-specific selectors back to this global file; route-owned modal surfaces should rely on their feature entrypoint or shared primitives such as `.mobile-keep-desktop-glass-cards`.
- Chat mobile layout rules moved to `app/styles/features/chat/mobile.css`; the chat topnav title rule lives in `features/chat/mobile-topnav.css`; the chat vertical (shell + mobile + mono + hc overrides) is route-imported via `app/styles/features/chat/index.css`. Only `chat-bootstrap.css` stays global (pre-hydration requirement below).
- Policy mobile scroll geometry moved to `app/styles/features/policy/mobile.css`; policy header offsets live in `features/policy/mobile-header.css`; tall mobile bottom clearance lives in `features/policy/mobile-tall.css`. The policy vertical is route-imported via `app/styles/features/policy/index.css`.
- Profile orbit/dock mobile rules, including Android stack overrides, live under `app/styles/features/profile/`; the profile vertical is route-imported via `features/profile/index.css` on `/profiil` and `/vestlus`.
- Documents mobile rules moved to `app/styles/features/documents/mobile.css`; the whole documents vertical is route-imported via `app/styles/features/documents/index.css`.
- Service-map mobile rules live in `app/styles/features/service-map/mobile.css`, with mobile header controls in `mobile-header.css`; the whole feature vertical (desktop + mobile) is route-imported via `app/styles/features/service-map/index.css` and is no longer part of the shared mobile cascade.
- Component CSS modules keep their own mobile rules only when the rules are local to that component, for example rail direction, picker sizing, grid density or a feature form layout. They must not reposition shared mobile page chrome: back button, page title, info button, glass shell size or root background.

PWA `standalone`/`fullscreen` layout overrides are intentionally disabled. Installed PWA mode should inherit the normal mobile layout until a new PWA layer is rebuilt with a single owner.

Do not add new page-specific mobile overrides to `mobile.css`. Add a focused owner file under this folder, or keep the rule beside the owning route/component.

- `mobile/scroll-panels.css` keeps only shared primitives and generic workspace geometry. Documents, materials, covision and invite adapters are route-owned through `features/<name>/...` CSS entrypoints. Generic workspace-like scroll adapters are route-imported through `shared/mobile-workspace-scroll-adapters.css`.

`features/home/home-scroll.css` is home-route CSS only. Shared `.direct-scroll-surface` geometry belongs to `mobile/scroll-panels.css`.

## Home boundary

The former home-background compatibility bundle has been separated into two ownership paths:

### Global mobile chain

1. `mobile/background-layer.css` — shared BackgroundLayer reveal/subpage rules.
2. `mobile/interaction-surfaces.css` — shared touch feedback, glass effects and base page geometry.
3. `mobile/content-surfaces.css` — shared content width and background hit-testing.

### Home route

`features/home/background.css` is imported only by `features/home/index.css` and owns:

1. `features/home/background-mobile.css` — home background and browser-chrome geometry.
2. `features/home/cards-mobile.css` — home card flipping, motion, placement and contrast.
3. `features/home/circular-text-mobile.css` — home ring typography and visibility.

Do not import the home entrypoint from `mobile.css`.

- `features/accessibility/touch.css` owns only accessibility modal coarse-pointer spacing. Register and rooms coarse-pointer layout now live under their route-owned feature entrypoints.

- Home document/browser-chrome foundations moved to `features/home/mobile-foundations.css`; they are no longer part of the global mobile chain.
- Chat drawer close sizing moved to `features/chat/mobile.css`; shared `mobile/foundations.css` must not reference `drawer-close-btn--chat`.

- Home-only motion and `[data-page="home"]` BackgroundLayer pending-bends rules live under `features/home/`; the global mobile BackgroundLayer file must stay page-neutral except for shared `[data-bg-layer]` and `data-page="subpage"` contracts.
- Account settings modal sizing lives under `features/profile/account-modal.css`; it must not return to `mobile/subpage-header/`.

- Workspace-family dashboard/wellbeing header offsets and shadow suppression live in route-imported shared CSS: `shared/mobile-workspace-header-offsets.css` and `shared/mobile-workspace-shadow-surfaces.css`. Do not add `.workspace-dashboard-panel`, `.workspace-feature-panel` or `.wellbeing-page-surface` rules back to the global mobile panel/header files.
