# Diet Planner — Architecture Audit

> **Audit mode:** READ-ONLY analysis. No application source files are being refactored in this document.
>
> The audit is maintained on the `architecture-audit` branch. `main` is not being modified.

## Purpose

This file is the central map for understanding the current Diet Planner frontend before refactoring. The goal is to identify responsibilities, dependencies, duplication, and safe future boundaries.

## Target Architecture

```text
js/
├── core/          # authentication, access, shared application state/contracts
├── services/      # database/domain operations
├── components/    # reusable UI behavior
├── utils/         # pure helpers, formatting, validation, calculations
└── pages/         # page-specific orchestration and rendering

css/
├── core/          # variables, base, layout
├── components/    # reusable UI styles
└── pages/         # page-specific styles
```

The target is a destination, not a reason to split files blindly. A function moves only when its responsibility and dependencies are understood.

---

# Audit 01 — `index.html` + `js/auth-access.js`

`auth-access.js` currently combines three domains: authentication, access/subscription logic, and index-page routing/UI.

Important functions identified: `clearAccessCache`, `getToday`, `isIndexPage`, `showAuthMessage`, `setBusy`, `isStrongPassword`, `getCurrentUser`, `getUserRole`, `hasActiveSubscription`, `canAddPatient`, `canWrite`, `hasFeature`, `getAccessStatus`, `checkUserAccess`, `checkSession`, `loginUser`, `registerUser`, `loginWithGoogle`, `logoutUser`, `initializeIndex`.

Future candidates: `core/auth.js`, `core/access.js`, `core/subscription.js`, plus a thin `pages/index.js`.

**Important:** `auth-access.js` is a major refactoring candidate, but no behavior should change until all consumers are mapped.

---

# Audit 02 — `app.html` + `js/app-dashboard.js`

Primarily dashboard/navigation UI.

Functions include dashboard loading, `renderAccountName`, `renderAdminCard`, `addLockStyles`, `lockCard`, `bindLockedCard`, `showLockedMessage`, `renderFeatureCards`, `logoutUser`, `initializeDashboard`, and `start`.

Findings:
- Direct profile/Supabase query exists in page code.
- Lock CSS is injected from JavaScript.
- Local locked-message behavior may duplicate a shared Toast.
- `renderFeatureCards` uses a `Map` to avoid repeated feature checks.
- Event handling uses listeners rather than inline handlers.

Future candidates: profile service, feature-card component, shared toast, CSS component styles.

---

# Audit 03 — `visit.html` + visit modules

`visit.html` is a container for four substantial domains:

```text
Visit
├── Assessment
├── Energy / Macro Calculator
├── Gram-based Diet Plan
└── Exchange-based Diet Plan
```

Loaded modules include `visit.js`, `visit-calculator.js`, `visit-diet-plan.js`, and `visit-exchange-plan.js`.

## `visit.js`

Combines visit loading, access checks, assessment CRUD, BMI/labs, modal behavior, module navigation, printing, and action dispatch.

Important functions include `refreshVisitWriteAccess`, `formatVisitDate`, `loadVisit`, `toggleModule`, `calculateBMI`, `renderLabs`, `escapeHtml`, `loadAssessment`, `saveAssessment`, `resolveAction`, `executeActivePrint`, and event/print lifecycle handlers.

Future candidates: `services/visits.js`, assessment service, `core/access.js`, `utils/date.js`, `utils/security.js`, shared modal.

## `visit-calculator.js`

Mixes clinical calculations with patient/visit queries and DOM updates.

Important calculations include `schofieldBMR`, `calculateSelectedEnergy`, `calculateTDEE`, `calculateSchofield`, and `updateTargetAndMacros`.

Strong candidate: pure equations in `utils/nutrition/`, data loading in services, orchestration in page module.

## `visit-diet-plan.js`

IIFE with contained state. Combines food loading, diet-plan persistence, day/meal/item state, rendering, calculations, modals, and access checks.

Strong candidates: `services/foods.js`, `services/diets.js`, shared modal/toast, nutrition/formatting utilities.

## `visit-exchange-plan.js`

IIFE with exchange-plan state, database queries, exchange calculations, rendering, and access checks.

Strong candidates: diet/exchange service plus pure exchange calculations in nutrition utilities.

### Visit dependency map

```text
visit.html
├── auth-access.js
├── visit.js
├── visit-calculator.js
├── visit-diet-plan.js
└── visit-exchange-plan.js
```

**Key finding:** one HTML page can legitimately contain several domains. We should not force all its logic into one page JS file.

---

# Audit 04 — `patient.html` + `js/patient.js`

Patient directory combines UI, access, Supabase CRUD, state, modal behavior, search/filtering, and events.

Important functions include `$`, `escapeHtml`, `showStatus`, `refreshAccess`, `updateWriteControls`, `loadPatients`, `renderPatients`, `openPatient`, `openAddPatientModal`, `createPatient`, `askDelete`, `closeDeleteModal`, `deletePatient`, `handleClick`, `bindEvents`, and `init`.

Findings:
- Patient queries and CRUD are direct Supabase operations: strong `services/patients.js` candidate.
- `escapeHtml` is duplicated across pages.
- Modal/status behavior is repeated.
- Delegated `data-action` events are a positive pattern to preserve.

---

# Audit 05 — `diet.html` + `js/diet.js`

`diet.js` combines access, Supabase/data operations, state, calculations, rendering, modal/UI, and persistence.

The `save()` flow spans validation → calculations → payload construction → RPC → local state update → render → feedback.

The module uses an IIFE, which is a positive containment mechanism.

Persistence calls the `save_diet_template` RPC; the database contract must be preserved during future extraction.

Strong future candidates: `services/diets.js`, nutrition calculations, shared modal/toast, page controller.

---

# Audit 06 — `quickcalc.html` + `js/quickcalc.js`

Combines dynamic UI, nutrition calculations, validation, events, and access initialization.

Important calculations include GIR, dextrose preparation, formula concentration, and breastmilk fortification.

A wrapper replaces `calculateFormulaConcentration` after preserving the original function. This layering should be reviewed before refactoring.

Uses data attributes/event delegation, which should be preserved.

Future candidates: `utils/nutrition/gir.js`, `dextrose.js`, `formula-concentration.js`, with page UI remaining in the page module.

---

# Audit 07 — `food.html` + `js/food.js`

Combines access, food/exchange Supabase CRUD, state, rendering, UI/modals, validation/formatting, events, and initialization.

Strong candidate: `services/foods.js` + page controller.

Repeated local helpers include `toast`, `esc`, and `num`; compare all implementations before consolidating.

CSS dependencies include Tailwind/theme/page styles and require a separate CSS audit.

---

# Audit 08 — `patient-profile.html` + `js/patient-profile.js`

Patient profile functionality overlaps patient management and support workflows.

Important architectural finding: patient CRUD/profile concerns are distributed across multiple files. This strengthens the case for a shared `services/patients.js`, while keeping profile-specific rendering/orchestration in the page module.

---

# Audit 09 — `nutritionsupport.html` + `js/nutritionsupport.js`

Combines access checks, patient loading/CRUD, rendering, modals, events, and initialization.

Functions include access refresh/write checks, patient loading, save/delete patient operations, rendering, modal controls, event binding, and initialization.

Strong finding: patient CRUD/access concerns are repeated here and in patient/profile modules.

Future candidate: shared patient service; compare support-specific access with central access before extraction.

---

# Audit 10 — `nutritionsupport-patient.html` + `js/nutritionsupport-patient.js`

Large nutrition-support feature containing:

```text
UI / interaction
├── EN accordion
├── patient header
├── glucose input/mode controls
└── TPN mode controls

Calculations
├── calorie-based calculations
├── TPN
├── glucose
└── EN/nutrition-support calculations

Data / state
├── patient context
├── nutrition-support days
├── EN state
└── TPN state

Other
├── CRUD
├── printing/report generation
└── event handling
```

Important finding: not all calculations should automatically become generic utilities. Clinical-domain calculations may deserve a nutrition-specific module/service after their inputs/outputs are mapped.

The `nutrition_support_days` database contract must be audited together with this frontend module before extraction.

---

# Audit 11 — `about.html` + `js/about.js`

Combines content management, admin access, database CRUD for `about_sections`, editor behavior, rendering, state, and events.

Uses `data-action`/`data-cmd` event delegation.

Contains `escapeHtml` and rich-editor/table editing behavior.

Future candidate: `services/about.js` plus page-specific editor orchestration. Do not create a generic rich-editor component unless another page actually needs it.

Security note: HTML sanitization is security-sensitive and must not be moved into a generic utility without comparing all trust boundaries.

---

# Audit 12 — `article.js`

Article domain combines:

```text
CRUD
Search/filter
Rich-text editor
Table editor
Access control
Toast/confirm UI
HTML sanitization
Supabase
```

Important helpers include `safe()` and `escapeHtml()`.

Security finding: sanitization deserves a dedicated, clearly named security boundary rather than being treated as an ordinary formatting helper.

Future candidate: `services/articles.js` + page controller + shared modal/toast; security utility only after comparing every HTML injection path.

---

# Audit 13 — `products.js`

Combines product categories, subcategories, products, formulas, search/filter, CRUD, admin UI, and Supabase.

Uses `Promise.all()` to load related datasets concurrently.

Future candidates: `services/products.js` and possibly a category service, with page-specific rendering remaining in the page module.

Do not split into many files merely because it is possible; split around stable responsibilities.

---

# Audit 14 — `finance.js`

Finance page contains data loading, finance CRUD, access checks, rendering, date helpers, and UI.

Important access functions include `refreshFinanceWriteAccess`, `canWriteFinance`, and `applyFinanceWriteAccessUI`.

It also contains date helpers such as `todayISO`, `formatISODate`, `addDays`, and `addMonths`.

Finding: page-level access logic overlaps the central `DietPlannerAccess` layer; date helpers overlap other pages. Strong candidates: `core/access.js` and `utils/date.js` after consumer mapping.

---

# Audit 15 — `profile.js`

Profile domain combines profile data, subscription display, subscription selection, profile editing, access checks, and logout.

It contains local subscription-state checks such as `isActive` and subscription-selection logic.

Finding: subscription logic is distributed across profile, plan pages, and `auth-access.js`. This is a major candidate for one subscription service/core boundary.

---

# Audit 16 — `notifications.js`

Notifications are derived from finance/subscription data rather than stored as independent notification rows.

Conceptual flow:

```text
patient_finances
      ↓
buildNotifications()
      ↓
due/overdue/subscription conditions
      ↓
render()
```

The module also contains date helpers overlapping `finance.js`.

Future candidate: shared `utils/date.js`; notification derivation remains page/domain logic unless reused elsewhere.

---

# Audit 17 — `subscription_plans.js`

Subscription domain includes plan loading/rendering, active/pending subscription state, free-trial checks, payment-proof upload/replacement, subscription creation, and cancellation.

Uses `create_subscription` RPC rather than a simple client-side insert.

This is a real domain boundary and should eventually have a shared subscription service.

---

# Audit 18 — `subscription_plans_index.js`

Duplicates substantial subscription behavior found in `subscription_plans.js`, including active/pending subscription checks, free-trial state, submission, and payment-proof replacement.

Strongest current evidence for:

```text
services/subscriptions.js
```

with both subscription pages acting as consumers.

---

# Audit 19 — `admin.js`

Admin page is a full domain surface, combining:

```text
Admin access
Plans
Subscriptions
Doctors/profiles
Patient counts
CRUD
Feature configuration
Modal
Toast
State
Supabase
```

`loadAll()` orchestrates multiple datasets including plans, subscriptions, profiles, and patients.

`PLAN_FEATURES` is important because it overlaps frontend feature/access concepts already present in `auth-access.js` and subscription plan data.

Future candidates:
- `pages/admin.js` for orchestration/UI
- `services/subscriptions.js`
- `services/subscription-plans.js`
- `services/profiles.js`
- `core/access.js`
- shared modal/toast

The admin page should not become the source of truth for security; RLS/database policies remain authoritative.

---

# Audit 20 — Remaining shared/application files identified in repository

The current repository tree also contains shared/domain modules such as:

```text
js/
├── auth-access.js
├── app-dashboard.js
├── visit.js
├── visit-calculator.js
├── visit-diet-plan.js
├── visit-exchange-plan.js
├── patient.js
├── patient-profile.js
├── diet.js
├── quickcalc.js
├── food.js
├── nutritionsupport.js
├── nutritionsupport-patient.js
├── article.js
├── products.js
├── finance.js
├── notifications.js
├── profile.js
├── subscription_plans.js
├── subscription_plans_index.js
├── admin.js
├── feedback.js
├── theme.js
└── weight.js
```

`feedback.js`, `theme.js`, and `weight.js` remain explicit audit targets before the JavaScript inventory can be considered complete.

---

# Cross-file dependency findings

## 1. Authentication / Access

Repeated across many pages:

```text
auth-access.js
      ↓
page-level access wrappers
      ↓
UI enable/disable decisions
```

The desired direction is:

```text
core/auth.js
core/access.js
core/subscription.js
        ↓
page controllers
```

The database/RLS layer remains the final security boundary.

## 2. Patients

Patient operations appear in:

```text
patient.js
patient-profile.js
nutritionsupport.js
admin.js
```

Likely future boundary:

```text
services/patients.js
```

## 3. Subscriptions

Subscription logic appears in:

```text
auth-access.js
profile.js
subscription_plans.js
subscription_plans_index.js
admin.js
```

Likely future boundary:

```text
services/subscriptions.js
core/subscription.js
```

The distinction must be deliberate: core answers shared access/state questions; service owns subscription-domain data operations.

## 4. Diets

Diet logic appears in:

```text
diet.js
visit-diet-plan.js
visit-exchange-plan.js
```

Future candidates include `services/diets.js` plus nutrition-specific pure calculations.

## 5. Foods

Food access/data appears in:

```text
food.js
diet.js
visit-diet-plan.js
```

Likely future boundary: `services/foods.js`.

## 6. UI components

Repeated concepts include:

```text
Toast
Modal
Confirm modal
Loading
Locked feature message
```

Likely components:

```text
components/toast.js
components/modal.js
components/loading.js
```

Only extract after comparing behavior so we do not accidentally change UX.

## 7. Utilities

Repeated helpers include:

```text
date formatting
number normalization
HTML escaping
formatting
cloning
nutrition calculations
```

Potential utility areas:

```text
utils/date.js
utils/formatting.js
utils/validation.js
utils/security.js
utils/nutrition/*
```

Security-sensitive helpers must remain explicit and reviewed.

---

# Preliminary dependency map

```text
                         ┌───────────────┐
                         │ Supabase/RLS  │
                         └───────┬───────┘
                                 │
                         ┌───────▼───────┐
                         │ Core          │
                         │ auth/access/  │
                         │ subscription  │
                         └───────┬───────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          │                      │                      │
   ┌──────▼──────┐       ┌───────▼──────┐       ┌──────▼──────┐
   │ Services    │       │ Components   │       │ Utils       │
   │ patients    │       │ toast        │       │ date        │
   │ visits      │       │ modal        │       │ validation  │
   │ diets       │       │ loading      │       │ security    │
   │ foods       │       └───────┬──────┘       │ nutrition   │
   │ subscriptions│              │              └──────┬──────┘
   └──────┬──────┘              │                     │
          └──────────────────────┼─────────────────────┘
                                 │
                         ┌───────▼───────┐
                         │ Page modules  │
                         │ visit/patient │
                         │ diet/food/... │
                         └───────────────┘
```

This is a **target dependency direction**, not a claim that the current code already follows it.

---

# Refactoring rules agreed for this project

1. **No big-bang rewrite.**
2. Audit first, refactor second.
3. One responsibility at a time.
4. Preserve database/RPC contracts.
5. Preserve public function names temporarily when callers still depend on them.
6. Do not duplicate access logic while extracting it; establish one source of truth.
7. Do not move clinical equations merely because they are mathematical; domain ownership matters.
8. Do not create components that are used only once unless they provide a real boundary.
9. Keep RLS/database authorization authoritative; frontend checks are UX/access guidance, not security.
10. After every extraction, test the affected page before continuing.
11. Keep commits small and reversible.
12. Do not modify `main` during the architecture refactor until the branch has been validated.

---

# Audit status

## Completed / mapped

```text
index/auth-access
app/dashboard
visit + visit modules
patient
patient-profile
nutrition-support
nutrition-support-patient
diet
quick calculator
food
about
articles
products
finance
profile
notifications
subscription plans
subscription plans index
admin
```

## Still to inspect before final dependency map

```text
feedback.js
theme.js
weight.js
remaining HTML files
remaining shared CSS/theme files
core/shared configuration
Supabase RPC/function/policy dependencies used by the frontend
```

## Next phase

1. Finish the remaining file inventory.
2. Audit CSS and shared theme files.
3. Audit Supabase contracts used by the frontend.
4. Build the final dependency graph.
5. Mark every significant function as `KEEP`, `MOVE`, `MERGE`, `DELETE`, or `REVIEW`.
6. Produce the staged refactoring plan.
7. Only then begin code movement.

**Current status: AUDIT ONLY — application source code has not been refactored.**