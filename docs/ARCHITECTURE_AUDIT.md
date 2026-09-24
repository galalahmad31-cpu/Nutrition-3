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

# Audits 01–29

The audits recorded cover the main HTML/JS modules, visit submodules, patient/diet/food/nutrition-support domains, admin/subscription/profile/finance/notifications, utility-like modules, and authentication/recovery pages. The detailed findings below are the current architectural map.

## Cross-cutting JS findings

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

## CSS Audit — `css/theme.css`

### Role

`theme.css` acts as a global theme layer. It defines CSS variables under `:root`, dark-mode overrides under `html[data-theme="dark"]`, and broad overrides for common Tailwind utility classes, forms, tables, modals, buttons, and shared UI elements.

### Findings

- The CSS-variable approach is a useful single source of truth for the application's visual tokens.
- Dark mode is explicitly scoped by `[data-theme="dark"]`, matching the existing `theme.js` contract.
- The file is broader than a pure theme/token file: it contains rules for specific Quick Calculator classes such as `.qc-panel`, `.iv-line-row`, `.qc-result`, and `.highlight-box`.
- Those calculator-specific rules are candidates for `css/pages/quickcalc.css` after checking cascade/order dependencies.
- Global Tailwind utility overrides should not be removed blindly; each override needs a usage/cascade check because the current application may rely on them for consistent light/dark presentation.
- Theme and CSS architecture must be audited together with `theme.js` and script/style loading order.

### Candidate target

```text
css/core/variables.css
css/core/base.css
css/components/*.css
css/pages/quickcalc.css
```

Do not split rules merely by selector name; preserve cascade behavior and verify every affected page.

## CSS Audit — `css/food.css`

### Role

Page-specific food/exchange library styling: responsive tables, horizontal scrolling, sticky first column, modal background, spinner, focus styles, exchange table formatting, and tab states.

### Findings

- The file is mostly page-specific and is a reasonable candidate for `css/pages/food.css`.
- It repeats global rules such as `*{box-sizing:border-box}`, `body` typography/background, and input focus behavior. These should be compared against `theme.css`, `tailwind.css`, and other page CSS before centralizing.
- The sticky first table column and mobile horizontal-scroll behavior are intentional page behavior and should remain local.
- `.spinner` and generic modal/focus rules may be reusable, but extraction should wait until all consumers are identified.

Source reviewed: `main/css/food.css`.

## CSS Audit — `css/visit.css`

### Role

`visit.css` is a large composite stylesheet covering the Visit page, assessment sections, embedded calculator, embedded diet plan, exchange-plan workspace, print output, and responsive behavior.

### Findings

- The file contains multiple labeled "Original style block" sections, indicating incremental accumulation rather than a clean layer structure.
- It contains several distinct domains in one stylesheet: assessment, calculator, gram diet, exchange plan, module cards, and print layout.
- The print rules are substantial and should be treated as a separate responsibility during refactoring; they should not be deleted just because they are long.
- Embedded modules are intentionally scoped with selectors such as `.embedded-calculator`, `.embedded-diet-plan`, and `.exchange-plan-module`; preserve these scopes to avoid collisions.
- Some global-looking rules such as `body` styling and generic print selectors (`textarea,input,select`, `.shadow-*`) can affect unrelated content when this stylesheet is loaded. Their cascade impact must be tested before moving them.
- The file is the strongest CSS candidate for staged decomposition, but only after the embedded module boundaries and print dependencies are mapped.

### Candidate target

```text
css/pages/visit.css
css/pages/visit-calculator.css
css/pages/visit-diet-plan.css
css/pages/visit-exchange-plan.css
css/components/print.css
```

These are candidates, not an instruction to split immediately.

## CSS Audit — `css/quickcalc.css`

### Role

Dedicated Quick Calculator styling: page shell, calculator cards, per-calculator accent variables, panels, results, dynamic IV rows, form controls, desktop layouts, and responsive layouts.

### Findings

- The file has a coherent page/domain responsibility and is already much closer to the desired `css/pages/quickcalc.css` boundary.
- It uses scoped CSS variables (`--qc-accent`, `--qc-soft`, `--qc-border`, `--qc-strong`) to give each calculator a restrained accent without duplicating entire style blocks. This should be preserved.
- It repeats global `body`, input, focus, and `box-sizing` rules that overlap with other CSS. These are candidates for comparison/centralization, not automatic deletion.
- Responsive behavior is explicit and reasonably localized to the calculator domain.
- `@import` for Google Fonts inside the page stylesheet is a deployment/performance concern and should be considered when the global typography strategy is reviewed.

### Candidate target

```text
css/pages/quickcalc.css
css/core/base.css
```

Keep calculator-specific variables and layout in the page stylesheet unless another consumer is found.

---

# Current CSS conclusions

```text
Global/theme layer
    ↓
Tailwind/generated utility layer
    ↓
Page CSS
    ↓
Embedded module CSS
    ↓
Print/responsive overrides
```

The current application does not have a clean separation of these layers everywhere. In particular, `theme.css` contains some page-specific Quick Calculator rules, while `visit.css` contains several embedded modules and print rules. This is a refactoring opportunity, but not evidence that the current application is broken.

### CSS rules for future refactoring

1. Do not remove a duplicated-looking CSS rule until its consumers and cascade order are verified.
2. Do not move Tailwind utility overrides without testing light/dark and responsive states.
3. Keep print styles isolated conceptually even if they remain in one file initially.
4. Preserve scoped embedded-module selectors to prevent cross-page collisions.
5. Move global design tokens to `variables.css`; move true global resets/base rules to `base.css`; keep page behavior in page styles.
6. Avoid creating a CSS file for every small selector. Split by stable responsibility/domain.

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

It handles stored preference, system preference, `[data-theme]`, `color-scheme`, theme-color meta, toggle creation, storage synchronization, and the public `window.DietPlannerTheme` API.

## Findings

This module is already close to the desired architecture. It is isolated, has a narrow public API, and does not contain unrelated business logic.

**Recommendation for refactoring:** keep it as one shared Core/UI module rather than splitting it into many small files.

The remaining issue is CSS integration: `[data-theme]` styles and Tailwind/page styles must be verified for cascade conflicts.

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
- `updateTargetAndMacros()` mixes calculation and DOM rendering; the pure calculation portion should be separable without changing page behavior.
- It directly accesses `patients`, `weight_logs`, and `nutrition_plans`, creating overlap with other visit/diet modules.
- It consumes `window.visitContext` when embedded in `visit.html`, which is a useful existing boundary. Preserve that contract during refactoring.
- It contains a local toast implementation; compare with shared toast infrastructure.
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

- The IIFE protects module state, but the module still combines domain data access, state, calculations, UI, and persistence.
- `loadFoods()` directly accesses `foods`; candidate for `services/foods.js`.
- `loadPlan()` directly orchestrates `nutrition_plans`, `plan_days`, `plan_meals`, and `plan_items`; candidate for a diet-plan service/repository boundary.
- `scaleHouseholdMeasure()` and `formatHouseholdNumber()` are pure enough to consider for a nutrition/measurements utility after comparison with other modules.
- Toast and confirmation logic duplicate shared UI infrastructure.
- `canWriteVisitData()` delegates to `DietPlannerAccess`, which is preferable to duplicating the subscription policy itself. Keep this delegation pattern while extracting.
- Temporary local IDs for unsaved days/meals must be preserved during persistence refactoring.

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

- Exchange reference data and calculation functions are domain logic and should not be moved merely because they are not UI code.
- `findPlans()` and `ensureExchangePlan()` directly access `nutrition_plans`, overlapping with the gram-based diet module and visit calculator.
- `loadExchangeValues()` directly accesses `exchange_values`.
- `loadDays()` directly accesses `plan_days`, `plan_meals`, and `plan_items`, overlapping with `visit-diet-plan.js`.
- `canWriteExchangePlan()` delegates the write decision to `DietPlannerAccess`; preserve this boundary.
- The module uses `data-xaction` event delegation, which is a good existing pattern.
- Status/toast and formatting helpers are repeated.

### Candidate target

```text
pages/visit-exchange-plan.js
services/nutrition-plans.js
services/exchange-plans.js
utils/nutrition/exchanges.js
components/toast.js
components/confirm.js
```

The strongest architectural opportunity is to share the nutrition-plan persistence layer while keeping gram/exchange clinical rules separate.

---

# Audit 27 — `forgot-password.html`

## Responsibilities

```text
Password recovery
├── Supabase client creation
├── email input/validation
├── resetPasswordForEmail()
├── status message UI
└── form event handling
```

## Findings

- The page creates a second Supabase client directly inside inline JavaScript instead of using the application's shared core layer.
- The recovery redirect is hard-coded to the Vercel `update-password.html` URL; this is a deployment/configuration concern.
- `showMessage()` is a page-local notification helper.
- Inline script is an exception to the desired `pages/*.js` structure.
- The recovery page should remain independent from normal subscription/access guards.

### Candidate target

```text
pages/forgot-password.js
core/supabase.js
utils/config.js
components/status-message.js
```

---

# Audit 28 — `update-password.html`

## Responsibilities

```text
Password update
├── Supabase client creation
├── recovery-session detection
├── PASSWORD_RECOVERY listener
├── password strength validation
├── confirmation validation
├── updateUser({ password })
└── status UI
```

## Findings

- It also creates its own Supabase client and keeps logic inline.
- `isStrongPassword()` is pure validation and can eventually move to `utils/validation.js` if reused.
- `updatePasswordStrength()` is UI-specific.
- `prepareRecoverySession()` and the `PASSWORD_RECOVERY` listener form an authentication/recovery contract that must be preserved exactly during extraction.
- Local `saving`/`recoveryReady` state does not need global state.

### Candidate target

```text
pages/update-password.js
core/supabase.js
core/auth.js or services/password-recovery.js
utils/validation.js
components/status-message.js
```

---

# Audit 29 — `privacy.html`

## Responsibility

Static privacy content with theme support and navigation.

## Findings

- No application business logic.
- It uses Tailwind/generated CSS plus page CSS plus theme CSS, so precedence should be checked during CSS audit.
- It does not need a page JavaScript module.
- Keep it static.

---

# Cross-cutting finding — authentication/recovery pages

```text
Normal application
index → auth/access → subscription → app

Password recovery
forgot-password → Supabase recovery email → update-password
```

The final architecture should keep recovery independent from subscription/access checks while avoiding unnecessary duplicate Supabase client construction.

---

# Current CSS conclusions

```text
Global/theme layer
    ↓
Tailwind/generated utility layer
    ↓
Page CSS
    ↓
Embedded module CSS
    ↓
Print/responsive overrides
```

### CSS-specific findings

1. `theme.css` is a global theme layer but also contains page-specific Quick Calculator selectors such as `.qc-panel`, `.iv-line-row`, `.qc-result`, and `.highlight-box`. These are candidates for page CSS after cascade verification.
2. `food.css` is mostly page-specific, but repeats global `box-sizing`, body typography/background, and input focus rules. These should be compared before centralization. fileciteturn126file0
3. `visit.css` is a large composite stylesheet containing assessment, embedded calculator, embedded gram diet, exchange plan, responsive rules, and substantial print rules. Its labeled "Original style block" sections show incremental accumulation. The embedded scopes should be preserved during staged decomposition. fileciteturn127file0
4. `quickcalc.css` is already a coherent page/domain stylesheet. Its `--qc-*` variables are useful and should be preserved. It nevertheless repeats global body/input rules and imports Google Fonts locally, both of which should be reviewed in the global CSS strategy. fileciteturn128file0
5. Do not interpret duplication as automatic deletion. Cascade order and page-specific behavior must be mapped first.

### Candidate CSS target

```text
css/
├── core/
│   ├── variables.css
│   ├── base.css
│   └── layout.css
├── components/
│   ├── buttons.css
│   ├── cards.css
│   ├── modal.css
│   ├── table.css
│   └── print.css
└── pages/
    ├── food.css
    ├── visit.css
    ├── visit-calculator.css
    ├── visit-diet-plan.css
    ├── visit-exchange-plan.css
    └── quickcalc.css
```

This is a target only. No CSS has been moved yet.

---

# Updated audit status

## JavaScript/page modules audited

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
✓ forgot-password (inline)
✓ update-password (inline)
✓ privacy (static)
```

## CSS audited so far

```text
✓ theme.css
✓ food.css
✓ visit.css
✓ quickcalc.css
```

## Still required before final architecture

```text
□ Enumerate every HTML/CSS/JS file from the repository tree
□ Inspect remaining page modules and script-loading order
□ Audit all HTML script-loading order
□ Audit remaining CSS and Tailwind/generated CSS interactions
□ Audit global window dependencies
□ Inventory Supabase RPCs/functions used by frontend
□ Inventory relevant RLS policies/triggers and map them to services
□ Build verified dependency graph
□ Produce KEEP / MOVE / MERGE / DELETE / REVIEW table
□ Produce staged refactoring plan
```

## Current status

**AUDIT ONLY. Application source code has not been refactored.**

The next step is the remaining repository inventory and CSS/backend-contract audit. Only after that should we start moving files toward `core / services / components / utils / pages`.
