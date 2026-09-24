# Diet Planner — Architecture Audit

> **Audit mode:** READ-ONLY analysis of the existing application.
>
> **Important:** No application code has been changed. This document is being built on the `architecture-audit` branch so the `main` branch remains untouched.

## Target Architecture

```text
pages/
js/
├── core/
├── services/
├── components/
├── utils/
└── pages/
css/
├── core/
├── components/
└── pages/
assets/
```

The target is not being applied yet. We are first mapping the current codebase.

---

# Audit 01 — `index.html`

## 1. Page responsibility

`index.html` is the authentication entry page. Its visible responsibilities are:

- Login form.
- Registration form.
- Google login button.
- Switching between login/register tabs.
- Displaying authentication messages.
- Linking to password recovery and privacy policy.
- Loading the shared authentication/access script.
- Loading page-specific CSS and the shared theme script.

The HTML itself does **not** contain inline `onclick` handlers for the authentication buttons. The buttons use IDs/data attributes and are wired from JavaScript.

## 2. DOM elements used by JavaScript

| Element | Purpose | Used by |
|---|---|---|
| `authMessage` | Authentication feedback | `showAuthMessage()` |
| `loginForm` | Login form | Tab switching |
| `loginEmail` | Login email input | `loginUser()` |
| `loginPassword` | Login password input | `loginUser()` |
| `loginButton` | Login action | `initializeIndex()` |
| `googleLoginButton` | Google OAuth | `initializeIndex()` |
| `registerForm` | Registration form | Tab switching |
| `registerName` | Registration name | `registerUser()` |
| `registerEmail` | Registration email | `registerUser()` |
| `registerPassword` | Registration password | `registerUser()` |
| `registerButton` | Registration action | `initializeIndex()` |
| `[data-auth-tab]` | Login/register tab controls | `initializeIndex()` |
| `.auth-form` | Forms switched by tabs | `initializeIndex()` |

## 3. Direct dependencies

```text
index.html
│
├── Supabase JS CDN
├── Google Fonts
├── Font Awesome
├── css/index.css
├── css/theme.css
├── js/theme.js
└── js/auth-access.js
```

### Important architectural observation

`index.html` directly loads `js/auth-access.js`, which currently contains both:

- shared authentication/access functionality, and
- page-specific UI behavior for `index.html`.

This does **not** mean it should be changed now. It is an item for the later refactoring phase.

---

# Direct JS dependency — `js/auth-access.js`

This file is shared infrastructure and therefore will be audited as a separate Core candidate later. For this page audit, only its relationship with `index.html` is recorded.

## Functions identified in the current file

### `clearAccessCache()`
- Responsibility: clears cached user/role access information.
- Category candidate: `core/access`.
- Called by: `logoutUser()`.
- UI dependency: none.

### `getToday()`
- Responsibility: returns today's date in `YYYY-MM-DD` format.
- Category candidate: `utils` or subscription/access utility.
- Called by: `hasActiveSubscription()` fallback.

### `isIndexPage()`
- Responsibility: determines whether the current URL is the index page.
- Category candidate: page/router utility rather than pure Core.
- Called by: `initializeIndex()`.
- Observation: this is specifically tied to `index.html`.

### `showAuthMessage(message, type)`
- Responsibility: writes an authentication message into `#authMessage`.
- Category candidate: page/UI component utility.
- Called by authentication and access-routing functions.
- Observation: DOM-specific; therefore not a pure Core function.

### `setBusy(button, busy, text)`
- Responsibility: changes button disabled state/text during async actions.
- Category candidate: UI utility/component helper.
- DOM dependency: yes.

### `isStrongPassword(password)`
- Responsibility: validates password strength.
- Category candidate: validation utility.
- DOM dependency: no.

### `getCurrentUser()`
- Responsibility: reads the current Supabase session and returns the session user.
- Category candidate: `core/auth`.
- Database/API dependency: Supabase Auth.

### `getUserRole(userId)`
- Responsibility: reads the user's role from `profiles`, with a small in-memory cache.
- Category candidate: `core/access`.
- Database dependency: `profiles` table.

### `hasActiveSubscription(userId)`
- Responsibility: determines whether a user has active subscription access.
- Current dependencies:
  - `getUserRole()`
  - Supabase RPC `has_active_subscription`
  - fallback query against `subscriptions`
  - `getToday()`
- Category candidate: `core/subscription` / access layer.
- Important observation: this function currently contains both primary RPC logic and a UI-oriented fallback query. This needs later architectural review, not immediate modification.

### `canAddPatient(userId)`
- Responsibility: checks patient quota through RPC `can_add_patient`.
- Category candidate: access/subscription feature service.

### `canWrite(userId)`
- Responsibility: determines whether writing is allowed by checking active subscription.
- Current dependency: `hasActiveSubscription()`.
- Category candidate: `core/access`.

### `hasFeature(userId, featureKey)`
- Responsibility: checks a feature through RPC `has_feature`.
- Category candidate: `core/access` / feature-access layer.

### `getAccessStatus()`
- Responsibility: creates a page-level access snapshot containing authentication state, user and role.
- Current dependencies:
  - `getCurrentUser()`
  - `getUserRole()`
- Category candidate: `core/access`.

### `checkUserAccess(session)`
- Responsibility: routes a successfully authenticated user from `index.html` based on role/subscription.
- Current dependencies:
  - `getUserRole()`
  - `hasActiveSubscription()`
  - `showAuthMessage()`
  - browser navigation
- Category candidate: page/router access flow, not pure Core.
- Important observation: this is one of the functions where shared access logic and page-specific routing are currently mixed.

### `checkSession()`
- Responsibility: reads the current Supabase session.
- Category candidate: `core/auth`.
- Note: overlaps conceptually with `getCurrentUser()` and requires later review for duplication.

### `loginUser()`
- Responsibility: reads login inputs, validates presence, performs Supabase password login, updates UI state, then routes the user.
- Current dependencies:
  - DOM
  - `setBusy()`
  - `showAuthMessage()`
  - Supabase Auth
  - `checkUserAccess()`
- Category candidate after refactoring: page controller + auth service/core interaction.
- Observation: currently mixes UI handling, authentication, and routing.

### `registerUser()`
- Responsibility: reads registration inputs, validates them, performs Supabase signup, updates UI and routes when a session exists.
- Current dependencies:
  - DOM
  - `isStrongPassword()`
  - `setBusy()`
  - `showAuthMessage()`
  - Supabase Auth
  - `checkUserAccess()`
- Category candidate after refactoring: page controller + auth service/core interaction.
- Observation: currently mixes UI, validation, authentication and routing.

### `loginWithGoogle()`
- Responsibility: starts Google OAuth and updates the button/message UI on failure.
- Current dependencies:
  - DOM
  - Supabase OAuth
  - `showAuthMessage()`
- Category candidate after refactoring: auth service/core + page UI controller.

### `logoutUser()`
- Responsibility: clears access cache, signs out, and navigates to `index.html`.
- Current dependencies:
  - `clearAccessCache()`
  - Supabase Auth
  - browser navigation
- Category candidate: auth core/service plus page routing.

### `initializeIndex()`
- Responsibility: initializes index-page event listeners and handles OAuth callback detection/processing.
- Current dependencies:
  - DOM event listeners
  - `isIndexPage()`
  - `loginUser()`
  - `registerUser()`
  - `loginWithGoogle()`
  - `checkUserAccess()`
  - `checkSession()`
- Category candidate: `pages/index.js`.
- Observation: this is clearly page-specific logic currently living inside the shared `auth-access.js` file.

## Public API currently exposed

`window.DietPlannerAccess` exposes:

- `supabaseClient`
- `getCurrentUser`
- `getUserRole`
- `hasActiveSubscription`
- `canAddPatient`
- `canWrite`
- `hasFeature`
- `getAccessStatus`
- `logout`

This global API is an important architectural dependency and will be mapped against the other pages before any refactoring.

---

# Preliminary dependency map for `index.html`

```text
index.html
    │
    └── auth-access.js
          │
          ├── Authentication
          │    ├── getCurrentUser()
          │    ├── checkSession()
          │    ├── loginUser()
          │    ├── registerUser()
          │    ├── loginWithGoogle()
          │    └── logoutUser()
          │
          ├── Access
          │    ├── getUserRole()
          │    ├── hasActiveSubscription()
          │    ├── canAddPatient()
          │    ├── canWrite()
          │    ├── hasFeature()
          │    └── getAccessStatus()
          │
          └── Index-specific behavior
               ├── isIndexPage()
               ├── showAuthMessage()
               ├── setBusy()
               ├── checkUserAccess()
               └── initializeIndex()
```

## First findings — NOT fixes

1. `auth-access.js` is carrying multiple responsibilities: authentication, access/subscription logic, and index-page UI/event logic.
2. `getCurrentUser()` and `checkSession()` appear conceptually overlapping and should be compared before deciding whether they are actually duplicated.
3. `hasActiveSubscription()` combines an RPC check with a fallback direct table query; the reason and security boundary should be documented before changing it.
4. `checkUserAccess()` contains routing behavior specific to `index.html`; this is a candidate for the future `pages/index.js` layer.
5. `showAuthMessage()` and `setBusy()` are DOM/UI helpers and therefore are not ideal candidates for the final `core` layer.
6. The current page uses `addEventListener()` rather than inline `onclick`, which is consistent with the separation approach we discussed.
7. No code has been changed as part of this audit.

---

# Audit 02 — `app.html` + `js/app-dashboard.js`

## 1. Page responsibility

`app.html` is the authenticated application dashboard. Its primary responsibility is **navigation/presentation**, not database logic.

It renders cards linking to application areas such as:

- Patients (`patient.html`)
- Food library (`food.html`)
- Food products (`products.html`)
- Diet library (`diet.html`)
- Nutrition support (`nutritionsupport.html`)
- Quick calculator (`quickcalc.html`)
- Patient finances (`finance.html`)
- Notifications (`notifications.html`)
- Articles (`article.html`)
- Profile (`profile.html`)
- Feedback (`feedback.html`)
- About (`about.html`)
- Admin (`admin.html`)

Some cards carry `data-feature` attributes (`product`, `article`) for feature-based UI locking. The admin card is initially hidden and is controlled by JavaScript. fileciteturn10file0

## 2. Direct dependencies

```text
app.html
│
├── Supabase JS CDN
├── Google Fonts
├── Font Awesome
├── css/tailwind.css
├── css/app.css
├── css/theme.css
├── js/theme.js
├── js/auth-access.js
└── js/app-dashboard.js
```

The important JS relationship is:

```text
app.html
   │
   ├── auth-access.js
   │       ↓
   │   window.DietPlannerAccess
   │
   └── app-dashboard.js
```

`app-dashboard.js` therefore assumes `auth-access.js` has already loaded. fileciteturn10file0 fileciteturn11file0

## 3. Functions in `app-dashboard.js`

### `hideLoading()`
- Responsibility: hides the dashboard loading screen and makes the document visible.
- DOM dependency: yes.
- Category candidate: `components/loading` or page UI helper.

### `renderAccountName(user)`
- Responsibility: retrieves `profiles.full_name` and displays the user's name, with metadata/email fallbacks.
- Dependencies:
  - DOM (`doctorName`)
  - `window.DietPlannerAccess.supabaseClient`
  - `profiles` table
- Category candidate after refactoring: dashboard page controller + profile service/data access.
- Important observation: this function performs a direct Supabase query from the dashboard page layer.

### `renderAdminCard(isAdmin)`
- Responsibility: shows/hides the admin navigation card.
- DOM dependency: yes.
- Category candidate: page UI helper.

### `addLockStyles()`
- Responsibility: dynamically injects CSS used by locked feature cards.
- DOM dependency: yes (`document.head`).
- Category candidate: component/style layer.
- Observation: the component's CSS currently lives inside JavaScript rather than a dedicated CSS component file.

### `lockCard(card)`
- Responsibility: marks a feature card as locked and adds its visual lock overlay.
- DOM dependency: yes.
- Category candidate: reusable feature-card component/helper.

### `bindLockedCard(card)`
- Responsibility: attaches a click listener that prevents navigation and shows a locked-feature message when the card is locked.
- DOM/event dependency: yes.
- Category candidate: component behavior.
- Important observation: uses `addEventListener`, not inline `onclick`.

### `showLockedMessage()`
- Responsibility: creates/reuses a fixed notification element and temporarily displays the unavailable-feature message.
- DOM dependency: yes.
- Category candidate: `components/toast` or notification component.
- Important observation: this is effectively a local Toast-like implementation and should later be compared with the project's existing `toast.js` if one exists.

### `renderFeatureCards(userId, isAdmin)`
- Responsibility: evaluates feature access for dashboard cards and locks unavailable features.
- Dependencies:
  - `window.DietPlannerAccess.hasFeature()`
  - DOM feature cards
  - `addLockStyles()`
  - `bindLockedCard()`
  - `lockCard()`
- Category candidate: page controller + feature-access UI component.
- Positive observation: it caches each distinct feature check within the operation using a `Map`, avoiding repeated checks for the same feature.

### `logoutUser()`
- Responsibility: disables the logout button and delegates logout to the centralized access API.
- Dependency: `window.DietPlannerAccess.logout()`.
- Category candidate: page event handler.
- Good separation observation: the dashboard does not directly call Supabase Auth for logout.

### `initializeDashboard()`
- Responsibility: initializes dashboard state, gets access status, renders account/admin/feature UI, and handles initialization errors.
- Dependencies:
  - `hideLoading()`
  - `window.DietPlannerAccess.getAccessStatus()`
  - `renderAccountName()`
  - `renderAdminCard()`
  - `renderFeatureCards()`
- Category candidate: `pages/app.js` or dashboard page controller.
- Important observation: it correctly treats `auth-access.js` as the access layer and does not perform its own routing.

### `start()`
- Responsibility: attaches the logout event and starts dashboard initialization.
- Category candidate: page bootstrap/entry function.

## 4. Public API

`app-dashboard.js` exposes:

```text
window.DietPlannerDashboard
├── init → initializeDashboard
└── logout → logoutUser
```

This public API is small and page-specific. It should not be considered Core merely because it is attached to `window`.

## 5. Dependency map

```text
app.html
    │
    ├── auth-access.js
    │       └── window.DietPlannerAccess
    │
    └── app-dashboard.js
            │
            ├── getAccessStatus()
            │       └── auth-access.js
            │
            ├── renderAccountName()
            │       └── Supabase → profiles
            │
            ├── renderAdminCard()
            │
            ├── renderFeatureCards()
            │       └── hasFeature()
            │              └── Supabase RPC
            │
            ├── lockCard()
            ├── bindLockedCard()
            ├── showLockedMessage()
            └── logoutUser()
                    └── DietPlannerAccess.logout()
```

## 6. Architecture observations — NOT fixes

1. `app.html` is comparatively clean as a dashboard HTML page: most behavior is moved to `app-dashboard.js` rather than embedded inline.
2. `app-dashboard.js` is mostly page/UI logic, which fits the eventual `js/pages/` layer.
3. `renderAccountName()` is an exception: it contains direct data access to `profiles`. In the target architecture this is a candidate for a profile service, but we will not move it yet.
4. `showLockedMessage()` duplicates the conceptual role of a Toast component. This should be compared with any existing `toast.js` before deciding what to extract.
5. `addLockStyles()` injects component CSS from JavaScript. The target architecture suggests moving reusable feature-card styling into CSS/components, but this is a later refactoring decision.
6. `renderFeatureCards()` has reasonable local caching of repeated feature checks; this should be preserved unless a later service-level cache makes it unnecessary.
7. `app-dashboard.js` correctly depends on the shared access API instead of recreating authentication/subscription logic.
8. No application code was changed during this audit.

---

# Audit status

- [x] `index.html` structure mapped
- [x] `app.html` structure mapped
- [x] `app-dashboard.js` mapped
- [x] Direct relationships with `auth-access.js` recorded
- [ ] Full `auth-access.js` audit as shared Core candidate
- [ ] `visit.html`
- [ ] `patients.html` / current patient page(s)
- [ ] `diet.html` / current diet page(s)
- [ ] `food.html` / current food page(s)
- [ ] Remaining application pages
- [ ] CSS architecture audit
- [ ] Final dependency graph
- [ ] Final target mapping
- [ ] Refactoring plan

**Rule:** No refactoring begins until the audit is complete and reviewed.
