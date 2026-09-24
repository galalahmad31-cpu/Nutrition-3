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

# Audit status

- [x] `index.html` structure mapped
- [x] Direct dependencies mapped
- [x] Direct relationship with `auth-access.js` mapped
- [ ] Full `auth-access.js` audit as shared Core candidate
- [ ] `app.html`
- [ ] `visit.html`
- [ ] `patients.html`
- [ ] `diet.html`
- [ ] `food.html`
- [ ] Remaining application pages
- [ ] CSS architecture audit
- [ ] Final dependency graph
- [ ] Final target mapping
- [ ] Refactoring plan

**Rule:** No refactoring begins until the audit is complete and reviewed.
