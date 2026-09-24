# Diet Planner — Architecture Audit

> READ-ONLY audit. No application source files are being refactored here. This document lives on `architecture-audit`; `main` is not modified.

## Goal

Build a reliable map of the current frontend before refactoring. Every function/file must eventually be classified as `KEEP`, `MOVE`, `MERGE`, `DELETE`, or `REVIEW`, with dependencies understood first.

## Target architecture

```text
js/
├── core/          # auth, access, shared application contracts
├── services/      # database/domain operations
├── components/    # reusable UI behavior
├── utils/         # pure helpers, validation, formatting, clinical calculations
└── pages/         # page-specific orchestration/rendering

css/
├── core/          # variables, base, layout
├── components/    # reusable component styles
└── pages/         # page-specific styles
```

This is a target, not a command to split everything. A function moves only when its responsibility and dependencies are verified.

---

# 1. Cross-cutting JavaScript findings

- `auth-access.js` mixes authentication, access/subscription state, and routing/UI.
- Patient CRUD is repeated across patient, patient-profile, nutrition-support, and admin.
- Subscription logic is repeated across auth/access, profile, subscription pages, and admin.
- Visit is a domain container: assessment + calculator + gram diet + exchange diet. Do not force it into one service.
- Diet/food/visit modules commonly mix UI, state, Supabase calls, and clinical calculations.
- Toast, modal/confirm, date formatting, HTML escaping, and numeric helpers are repeated.
- Pure clinical equations are mixed with DOM/database orchestration.
- Existing IIFEs protect local state but do not by themselves provide architectural separation.
- `data-action` / event delegation already appears in several modules and should generally be preserved.
- Supabase RPCs, Functions, Triggers and RLS are contracts; map them before moving database operations.

---

# 2. Page / JS domain map

## Auth / recovery

### `auth-access.js`
Responsibilities: Supabase auth, session, profile/role, subscription/access checks, routing. Candidate split: `core/supabase.js`, `core/auth.js`, `core/access.js`, `core/subscription.js`.

### `forgot-password.html`
Password recovery form, direct Supabase client, `resetPasswordForEmail`, inline status UI. Candidate: `pages/forgot-password.js` + shared `core/supabase.js`. Keep independent of normal subscription guards.

### `update-password.html`
Recovery session, `PASSWORD_RECOVERY`, password validation, `updateUser`. Candidate: `pages/update-password.js` + auth/recovery service + validation utility.

### `privacy.html`
Static content only. No page JS required.

## Patients

### `patient.js`
Patient list/search/form/CRUD/access. Candidate service: `services/patients.js`; page remains orchestration/UI.

### `patient-profile.js`
Patient profile, visits, weight/finance/support links and patient-specific operations. Strong overlap with patient and visit services.

### `weight.js`
`weight_logs` CRUD, BMI summary, chart, delete modal, access/write checks. Candidates: `services/weight.js`, `utils/nutrition/bmi.js`, shared modal/toast.

## Visits

### `visit.js`
Main visit orchestration and assessment. It is the container for multiple visit subdomains.

### `visit-calculator.js`
Energy equations, TDEE/macros, patient/weight/plan loading and persistence, UI. Pure `schofieldBMR()`-style logic is a candidate for `utils/nutrition/energy.js`; persistence overlaps nutrition-plan services.

### `visit-diet-plan.js`
Gram diet: foods, nutrition plans, days/meals/items, gram/household calculations, persistence and UI. Candidate shared service: `services/nutrition-plans.js`; food access: `services/foods.js`.

### `visit-exchange-plan.js`
Exchange reference/calculation, `exchange_values`, plan/day/meal/item persistence. Candidate `services/exchange-plans.js` plus `utils/nutrition/exchanges.js`. Plan persistence should overlap the gram-plan service rather than be duplicated.

## Diet / Food

### `diet.js`
Diet library/page logic, filtering, templates and access. Candidate domain service around diet templates.

### `food.js`
Food library/table/exchange operations. Candidate `services/foods.js`.

## Nutrition support

### `nutritionsupport.js`
Nutrition-support library/domain UI and database operations.

### `nutritionsupport-patient.js`
EN + TPN, patient context, support days CRUD, calculations, UI state and printing. This is a large domain module. Candidate separation: page orchestration + `services/nutrition-support.js` + clinical utilities (`enteral.js`, `tpn.js`, `glucose.js`) only after all consumers are mapped.

## Admin / subscriptions

### `admin.js`
Admin access, plans, subscriptions, doctors, patient counts, requests, modals/toasts. Candidate services: `subscriptions.js`, `subscription-plans.js`, `profiles.js`; page remains orchestration.

### `subscription_plans.js`
Plans, active/pending subscription, free trial, payment proof, `create_subscription()` RPC, cancellation/replacement. Strong candidate for `services/subscriptions.js` + `services/subscription-plans.js`.

### `subscription_plans_index.js`
Repeats much of subscription lookup/submission/replacement logic from `subscription_plans.js`. This is confirmed duplication and should eventually share the same subscription service.

### `profile.js`
Profile + subscription display/selection/edit/logout. Subscription checks overlap core/service logic.

## Other domains

### `finance.js`
Finance CRUD/rendering + write-access checks. Repeats access orchestration and date helpers. Candidate `services/finance.js` + `utils/date.js`.

### `notifications.js`
Derives notifications from finance/subscription data. Date helpers overlap finance. Keep notification rendering separate from shared date logic.

### `feedback.js`
Feedback CRUD, rating UI, profile/display-name lookup, confirmation and rendering. Candidate `services/feedback.js` + shared components/helpers.

### `article.js`
Article CRUD, search/filter, rich editor/table editor, sanitization. `safe()` is security-sensitive; do not move blindly to generic utils until all HTML-sanitization consumers are mapped.

### `products.js`
Categories/subcategories/products/formulas, filters, CRUD, admin UI, parallel loading. Candidate `services/products.js` and category service if reuse is demonstrated.

### `about.js`
About sections CRUD, editor, admin UI. Candidate `services/about.js`. Rich editor should remain local unless another consumer appears.

### `theme.js`
One coherent global responsibility: light/dark theme, system preference, storage, `[data-theme]`, meta theme color, toggle, public `window.DietPlannerTheme`. This module is already close to the desired architecture; keep it cohesive.

---

# 3. CSS audit

## `theme.css`
Global theme/token layer with `:root`, dark mode, broad Tailwind utility overrides, forms, tables, modals and shared UI. It also contains Quick Calculator selectors such as `.qc-panel`, `.iv-line-row`, `.qc-result`, `.highlight-box`; these are candidates for page CSS after cascade verification.

**Do not remove global utility overrides blindly.** Test light/dark/responsive behavior and script/style order first.

## `food.css`
Mostly page-specific: food/exchange tables, horizontal scroll, sticky first column, modal/spinner/focus and responsive behavior. It repeats some global `box-sizing`, body and input rules. Candidate `css/pages/food.css` with shared rules moved only after consumer/cascade checks.

## `visit.css`
Large composite stylesheet: assessment, embedded calculator, gram diet, exchange plan, responsive and print rules. Multiple labeled original style blocks show incremental accumulation. Embedded scopes such as `.embedded-calculator`, `.embedded-diet-plan`, `.exchange-plan-module` should be preserved. Print rules are a real responsibility, not dead code merely because they are large.

Candidate staged target:

```text
css/pages/visit.css
css/pages/visit-calculator.css
css/pages/visit-diet-plan.css
css/pages/visit-exchange-plan.css
css/components/print.css
```

## `quickcalc.css`
Coherent Quick Calculator stylesheet with useful `--qc-*` variables, responsive rules and calculator-specific UI. It repeats global body/input/focus rules and locally imports Google Fonts; review these during global typography/base cleanup. Keep calculator-specific variables local unless reused.

## `nutritionsupport-patient.css`
Large dedicated Nutrition Support Patient stylesheet (~30 KB). It defines its own theme tokens, EN/TPN visual identities, patient header, support-day UI, tabs, tables, clinical callouts, glucose controls, delete modal, print behavior and many Tailwind overrides. It is a **domain stylesheet**, not automatically spaghetti. Main future concern is duplicated global base rules (`body`, `input/select/textarea`, `box-sizing`, font import) and the mixing of page, component and print concerns.

Candidate staged target:

```text
css/pages/nutrition-support-patient.css
css/components/print.css
css/components/modal.css
css/core/base.css
```

Do not extract the EN/TPN scoped rules until the HTML/JS selectors and print behavior are mapped.

## Other CSS files found in repository

```text
about.css
admin.css
app.css
article.css
diet.css
feedback.css
finance.css
food.css
forgot-password.css
index.css
notifications.css
nutritionsupport.css
nutritionsupport-patient.css
patient.css
patient-profile.css
privacy.css
profile.css
quickcalc.css
subscription_plans.css
subscription_plans_index.css
theme.css
update-password.css
visit.css
weight.css
tailwind-input.css
```

`tailwind-input.css` is only an input/source file and must be distinguished from the generated Tailwind output during the deployment audit.

---

# 4. Important architectural duplications

```text
Subscription
auth-access ─┐
profile ─────┼──> candidate services/subscriptions.js
plans ───────┤
plans_index ─┤
admin ───────┘

Nutrition plans
visit-calculator ─┐
visit-diet-plan ──┼──> candidate services/nutrition-plans.js
visit-exchange ───┘

Patients
patient ──────────┐
patient-profile ──┼──> candidate services/patients.js
nutrition support ┤
admin ────────────┘

Shared UI
local toast ──────┐
local modal ──────┼──> candidate components/
confirm helpers ──┘

Shared helpers
formatDate / date math / escapeHtml / numeric helpers
        ↓
 candidate utils/ (only after all consumers are mapped)
```

---

# 5. Rules for refactoring

1. Do not move a function just because it is long.
2. Pure calculation → candidate `utils`.
3. Database/domain operation → candidate `services`.
4. Reusable UI behavior → candidate `components`.
5. Page-specific orchestration/rendering → `pages`.
6. Authentication/access contract → `core`.
7. RLS is the security boundary; frontend access checks are UX/orchestration, not authorization.
8. Preserve public function names/aliases temporarily when HTML or other scripts may call them.
9. Do not change clinical formulas while performing architecture refactoring.
10. Do not change database schema, RLS, triggers or RPC behavior during frontend extraction unless separately audited and tested.
11. Test one architectural change at a time.
12. Every extraction must be followed by a search for old references.

---

# 6. Current target folder map

```text
js/
├── core/
│   ├── supabase.js
│   ├── auth.js
│   ├── access.js
│   └── subscription.js
├── services/
│   ├── patients.js
│   ├── nutrition-plans.js
│   ├── foods.js
│   ├── subscriptions.js
│   ├── subscription-plans.js
│   ├── finance.js
│   ├── weight.js
│   ├── feedback.js
│   ├── products.js
│   └── nutrition-support.js
├── components/
│   ├── navbar.js
│   ├── modal.js
│   ├── confirm.js
│   ├── toast.js
│   └── loading.js
├── utils/
│   ├── date.js
│   ├── validation.js
│   ├── security.js
│   └── nutrition/
│       ├── energy.js
│       ├── macros.js
│       ├── bmi.js
│       ├── tpn.js
│       ├── enteral.js
│       └── exchanges.js
└── pages/
    └── page-specific orchestration
```

This is **not yet implemented**. It is the architectural destination derived from the audit.

---

# 7. Remaining audit work

```text
✓ Main HTML/JS domains inventoried
✓ Visit submodules audited
✓ Subscription duplication identified
✓ Shared UI/helper duplication identified
✓ Main CSS domains audited
✓ Nutrition-support patient CSS audited

□ Enumerate every HTML + JS script/style loading order
□ Audit remaining CSS files for global/component duplication
□ Audit Tailwind source/generated/deployment chain
□ Audit window/global dependencies
□ Inventory Supabase tables used by frontend
□ Inventory RPCs
□ Inventory database Functions
□ Inventory Triggers
□ Inventory RLS policies
□ Map frontend access checks to backend enforcement
□ Build verified dependency graph
□ Final KEEP / MOVE / MERGE / DELETE / REVIEW table
□ Staged refactoring plan
```

## Status

**AUDIT ONLY. Application source code has not been refactored.**

The next stage is the backend contract audit: Supabase tables → RPCs → Functions → Triggers → RLS → frontend callers.
