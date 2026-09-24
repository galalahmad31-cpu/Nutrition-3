# Diet Planner — Architecture Audit

> **Audit mode:** READ-ONLY analysis. No application source code is being refactored in this document.
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

# Audits 01–20

The audits already recorded cover `index/auth-access`, `app-dashboard`, the complete visit feature and its modules, patient and patient-profile, diet, quick calculator, food, nutrition-support, nutrition-support-patient, about, article, products, finance, profile, notifications, subscription pages, and admin.

The main findings from those audits are:

- `auth-access.js` mixes authentication, access/subscription logic, and index-page routing/UI.
- Patient CRUD is repeated across patient, patient-profile, nutrition-support, and admin workflows.
- Subscription logic is repeated across auth/access, profile, subscription pages, and admin.
- Visit is a container for several substantial domains and should not be forced into one giant page module.
- Diet/food/visit modules mix UI, state, Supabase operations, and clinical calculations.
- Toast, modal/confirm, date formatting, HTML escaping, and numeric helpers are repeatedly implemented.
- Pure clinical equations are mixed with DOM/database orchestration.
- Existing IIFEs contain state but do not by themselves create architectural separation.
- `data-action`/event delegation is already used in several places and should be preserved where practical.
- Supabase RPCs and RLS are part of the contract and must be mapped before moving database logic.

---

# Audit 21 — `js/feedback.js`

## Responsibilities

```text
Feedback
├── own feedback state
├── rating UI
├── CRUD
├── display-name lookup
├── rendering
├── delete confirmation
└── event delegation
```

## Findings

- Positive: the module explicitly depends on `DietPlannerAccess` rather than recreating authentication setup.
- `getDisplayName()` directly queries `profiles`; candidate for a profile service if this lookup is shared.
- `loadFeedbacks()`, `saveFeedback()`, and `performDeleteFeedback()` directly access `app_feedback`; candidate for `services/feedback.js`.
- `escapeHtml()` and `formatDate()` duplicate shared concerns.
- Status UI and confirmation modal behavior are local implementations that should be compared with the eventual shared components.
- Owner/admin checks in the UI are not a security boundary; RLS must remain authoritative.

### Candidate target

```text
services/feedback.js
pages/feedback.js
components/toast.js / components/confirm.js
utils/security.js
utils/date.js
```

---

# Audit 22 — `js/weight.js`

## Responsibilities

```text
Weight tracking
├── access/write checks
├── patient lookup
├── weight_logs CRUD
├── BMI summary
├── table rendering
├── chart rendering
├── delete modal
└── toast
```

## Findings

- `refreshWriteAccess()` repeats page-level access orchestration already present in other pages.
- `loadPage()`, `addWeightEntry()`, and delete logic directly access `patients` and `weight_logs`.
- `showToast()`, `escapeHtml()`, and `formatDate()` duplicate shared helpers.
- BMI calculation is sufficiently pure to be considered for a nutrition/clinical calculation utility after all BMI consumers are mapped.
- Chart construction should remain page/component-specific unless another page uses the same chart behavior.
- The dynamically created delete modal is another example of repeated modal infrastructure.

### Candidate target

```text
services/weight.js
pages/weight.js
utils/nutrition/bmi.js
components/modal.js
components/toast.js
```

---

# Audit 23 — `js/theme.js`

## Responsibility

`theme.js` has one coherent responsibility: global light/dark mode.

It handles:

```text
stored preference
system preference
[data-theme]
color-scheme meta
theme-color meta
toggle creation
storage synchronization
window.DietPlannerTheme API
```

## Findings

This module is already close to the desired architecture. It is isolated, has a narrow public API, and does not contain unrelated business logic.

**Recommendation for refactoring:** keep it as one shared Core/UI module rather than splitting it into many small files.

The remaining issue is not JavaScript responsibility but CSS integration: the CSS audit must verify that `[data-theme]` styles are consistent and do not fight Tailwind/page styles.

---

# Updated cross-module duplication map

## Access

```text
patient.js
patient-profile.js
nutrition support
finance.js
weight.js
other feature pages
        ↓
page-level access wrappers
        ↓
DietPlannerAccess
```

Future direction:

```text
core/auth.js
core/access.js
core/subscription.js
        ↓
page controllers
```

## Patients

```text
patient.js
patient-profile.js
nutritionsupport.js
admin.js
weight.js
```

Likely domain boundary:

```text
services/patients.js
```

## Subscriptions

```text
auth-access.js
profile.js
subscription_plans.js
subscription_plans_index.js
admin.js
finance.js
```

Likely boundaries:

```text
core/subscription.js
services/subscriptions.js
services/subscription-plans.js
```

## UI infrastructure

Repeated implementations exist for:

```text
Toast
Modal
Confirm
Loading/status
Locked feature message
```

Likely shared components:

```text
components/toast.js
components/modal.js
components/confirm.js
components/loading.js
```

The final component API must be based on actual behavior, not just names.

## Utilities

Repeated helpers include:

```text
escapeHtml / esc
formatDate / formatISODate / todayISO
num
DOM lookup
```

Potential utilities:

```text
utils/date.js
utils/security.js
utils/formatting.js
utils/dom.js
utils/nutrition/*
```

Security-sensitive sanitization remains a separate review item.

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
   │ diets       │       │ confirm      │       │ security    │
   │ foods       │       │ loading      │       │ nutrition   │
   │ subscriptions│      └───────┬──────┘       └──────┬──────┘
   └──────┬──────┘               │                     │
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

# Refactoring rules

1. No big-bang rewrite.
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

## JavaScript modules audited

```text
✓ auth/access + index
✓ dashboard
✓ visit
✓ visit-calculator
✓ visit-diet-plan
✓ visit-exchange-plan
✓ patient
✓ patient-profile
✓ diet
✓ quickcalc
✓ food
✓ nutrition support
✓ nutrition-support-patient
✓ about
✓ article
✓ products
✓ finance
✓ profile
✓ notifications
✓ subscription_plans
✓ subscription_plans_index
✓ admin
✓ feedback
✓ weight
✓ theme
```

## Still required before the final architecture

```text
□ Enumerate every HTML/CSS/JS file from the repository tree
□ Inspect remaining page modules such as authentication/password pages
□ Audit every HTML script-loading order
□ Audit all CSS and Tailwind/theme/page-style interactions
□ Audit global window dependencies
□ Inventory Supabase RPCs/functions used by the frontend
□ Inventory relevant RLS policies/triggers and map them to services
□ Build verified dependency graph
□ Produce KEEP / MOVE / MERGE / DELETE / REVIEW table
□ Produce staged refactoring plan
```

## Current status

**AUDIT ONLY. Application source code has not been refactored.**

The next step is the repository-wide inventory and CSS/backend-contract audit. Only after that should we start moving files toward `core / services / components / utils / pages`.