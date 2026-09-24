# Diet Planner — Architecture Audit

> **Audit mode:** READ-ONLY analysis. No application source code is being refactored in this document.
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

# Audit 24 — `js/visit-calculator.js`

## Responsibilities

```text
Visit calculator
├── patient/visit context
├── energy equations
│   ├── Mifflin-St Jeor
│   └── Schofield
├── TDEE / target calories
├── macro calculation
├── patient/weight/plan loading
├── plan persistence
├── UI updates
├── toast
└── event handling
```

## Findings

- The module mixes clinical calculations with DOM operations and Supabase access.
- `schofieldBMR()` is a pure clinical calculation and is a strong candidate for `utils/nutrition/energy.js` after all consumers are mapped.
- `updateTargetAndMacros()` mixes calculation and DOM rendering; the pure calculation portion should be separable without changing the page behavior.
- The module directly accesses `patients`, `weight_logs`, and `nutrition_plans`, creating overlap with other visit/diet modules.
- It consumes `window.visitContext` when embedded in `visit.html`, which is a useful existing boundary. Preserve that contract during refactoring.
- It contains a local `calcShowToast()` implementation; compare with shared toast infrastructure.
- Compatibility aliases such as `calculateTDEE()` and `calculateSchofield()` indicate existing callers/UI references; preserve them temporarily if functions are extracted.

### Candidate target

```text
pages/visit-calculator.js
services/nutrition-plans.js
services/patients.js
utils/nutrition/energy.js
utils/nutrition/macros.js
components/toast.js
```

The exact split must wait until all visit modules and their shared contracts are mapped.

---

# Audit 25 — `js/visit-diet-plan.js`

## Responsibilities

```text
Gram-based diet plan
├── visit/patient context
├── food library loading
├── nutrition plan loading
├── plan/day/meal/item state
├── day editing
├── meal editing
├── food selection
├── gram calculations
├── household-measure scaling
├── plan persistence
├── confirmations/toast
└── rendering/events
```

## Findings

- The IIFE protects module state, which is useful, but the module still combines domain data access, state, calculations, UI, and persistence.
- `loadFoods()` directly accesses `foods`; candidate for `services/foods.js`.
- `loadPlan()` directly orchestrates `nutrition_plans`, `plan_days`, `plan_meals`, and `plan_items`; candidate for a diet-plan service/repository boundary.
- `scaleHouseholdMeasure()` and `formatHouseholdNumber()` are pure enough to consider for `utils/nutrition/measurements.js` after comparison with other modules.
- `showToast()` and confirmation logic duplicate shared UI infrastructure.
- `canWriteVisitData()` delegates to `DietPlannerAccess`, which is preferable to duplicating the subscription policy itself. Keep this delegation pattern while extracting.
- The module creates temporary local IDs for unsaved days/meals. This behavior must be preserved during any persistence refactor.

### Candidate target

```text
pages/visit-diet-plan.js
services/nutrition-plans.js
services/foods.js
utils/nutrition/measurements.js
components/toast.js
components/confirm.js
```

---

# Audit 26 — `js/visit-exchange-plan.js`

## Responsibilities

```text
Exchange-based diet plan
├── exchange reference definitions
├── target macro state
├── exchange calculations
├── nutrition-plan creation/loading
├── exchange_values persistence
├── day/meal/item loading
├── day editing
├── rendering
├── access checks
├── toast/status
└── event delegation
```

## Findings

- The exchange reference data (`G`) and calculation functions (`manual`, `calc`, `total`) are domain logic and should not be moved merely because they are not UI code. They are candidates for a dedicated nutrition/exchange utility or service after validation.
- `findPlans()` and `ensureExchangePlan()` directly access `nutrition_plans`; this overlaps with the gram-based diet module and visit calculator.
- `loadExchangeValues()` directly accesses `exchange_values`.
- `loadDays()` directly accesses `plan_days`, `plan_meals`, and `plan_items`, overlapping with `visit-diet-plan.js`.
- `canWriteExchangePlan()` correctly delegates the write decision to `DietPlannerAccess`; preserve this boundary.
- The module uses `data-xaction` event delegation, which is a good existing pattern.
- It has its own status/toast handling and repeated formatting helpers.

### Candidate target

```text
pages/visit-exchange-plan.js
services/nutrition-plans.js
services/exchange-plans.js
utils/nutrition/exchanges.js
components/toast.js
components/confirm.js
```

The strongest architectural opportunity is to share the **nutrition plan persistence layer** between gram-based and exchange-based plans while keeping their clinical calculation/domain rules separate.

---

# New dependency observations from visit modules

```text
visit.html
   ├── visit.js
   ├── visit-calculator.js
   ├── visit-diet-plan.js
   └── visit-exchange-plan.js
          │
          ├── DietPlannerAccess
          ├── patients
          ├── patient_visits
          ├── nutrition_plans
          ├── plan_days
          ├── plan_meals
          ├── plan_items
          ├── foods
          └── exchange_values
```

This is a significant domain boundary. Instead of creating separate database implementations in every module, the eventual architecture should consider a shared `nutrition-plans` service/repository while keeping calculator/diet/exchange rules in their own domain modules.

---

# Updated audit status

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
