# Diet Planner — Architecture Audit

> **Audit mode:** READ-ONLY analysis. No application code is being refactored in this document.
>
> The audit is maintained on the `architecture-audit` branch. `main` is not being modified.

## Target Architecture

```text
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
```

The target architecture is a destination only. We are mapping the current application first.

---

# Audit 01 — `index.html` + `js/auth-access.js`

## Page responsibility

Authentication entry page: login, registration, Google OAuth, auth messages, tab switching and authentication bootstrap.

## Important functions identified

| Function | Current responsibility | Target candidate |
|---|---|---|
| `clearAccessCache()` | Clears access cache | core/access |
| `getToday()` | Current date string | utils/date or subscription utility |
| `isIndexPage()` | Detects index page | pages/index |
| `showAuthMessage()` | Writes auth message to DOM | component/page UI |
| `setBusy()` | Button loading state | component/UI utility |
| `isStrongPassword()` | Password validation | utils/validation |
| `getCurrentUser()` | Supabase current session user | core/auth |
| `getUserRole()` | Reads role from profiles | core/access |
| `hasActiveSubscription()` | Subscription access check + fallback query | core/subscription/access |
| `canAddPatient()` | Patient quota RPC | core/access/service |
| `canWrite()` | Write permission check | core/access |
| `hasFeature()` | Feature RPC | core/access |
| `getAccessStatus()` | Auth/access snapshot | core/access |
| `checkUserAccess()` | Index routing based on role/subscription | pages/index/router |
| `checkSession()` | Reads Supabase session | core/auth; compare with getCurrentUser |
| `loginUser()` | DOM + Supabase login + routing | pages/index + auth service |
| `registerUser()` | DOM + validation + signup + routing | pages/index + auth service |
| `loginWithGoogle()` | OAuth + UI | pages/index + auth service |
| `logoutUser()` | Sign out + redirect | core/auth + page routing |
| `initializeIndex()` | Index event/bootstrap logic | pages/index |

## Preliminary finding

`auth-access.js` currently combines Authentication + Access/Subscription + Index-page UI/routing. This is the strongest early candidate for later separation, but **no change should be made until the full dependency map is complete**.

---

# Audit 02 — `app.html` + `js/app-dashboard.js`

## Page responsibility

Authenticated dashboard/navigation page. It mainly presents navigation cards and feature locks.

## Functions identified

| Function | Responsibility | Target candidate |
|---|---|---|
| `hideLoading()` | Hide dashboard loading state | components/loading or page UI |
| `renderAccountName()` | Reads `profiles.full_name` and renders account name | services/profile + page UI |
| `renderAdminCard()` | Show/hide admin card | page UI |
| `addLockStyles()` | Inject feature-lock CSS | components/style; later CSS |
| `lockCard()` | Apply locked state/overlay | components/feature-card |
| `bindLockedCard()` | Lock click behavior | components/feature-card |
| `showLockedMessage()` | Local notification for locked feature | components/toast candidate |
| `renderFeatureCards()` | Feature checks + lock unavailable cards | page controller + feature component |
| `logoutUser()` | Delegate logout to shared access API | page event handler |
| `initializeDashboard()` | Dashboard bootstrap | pages/app |
| `start()` | Attach events + start initialization | pages/app bootstrap |

## Positive observations

- Dashboard delegates access decisions to `window.DietPlannerAccess`.
- `renderFeatureCards()` caches duplicate feature checks with a `Map`.
- Event handling uses `addEventListener()` rather than inline `onclick`.

## Candidate issues for later review

- Direct `profiles` query inside page code.
- CSS injected from JavaScript.
- Local `showLockedMessage()` may duplicate a shared Toast component.

---

# Audit 03 — `visit.html` + visit modules

## Page responsibility

`visit.html` is a **container page** for several clinical/nutrition modules within one patient visit:

```text
Visit
├── Assessment
├── Energy / Macro Calculator
├── Gram-based Diet Plan
└── Exchange-based Diet Plan
```

It loads:

```text
js/auth-access.js
js/visit.js
js/visit-calculator.js
js/visit-diet-plan.js
js/visit-exchange-plan.js
```

The HTML uses `data-action` attributes for static actions, but there are still dynamically generated inline `onclick` handlers inside some modules. This is recorded only; **not a fix yet**.

---

## 03-A — `js/visit.js`

### Functions identified

| Function | Responsibility | Target candidate |
|---|---|---|
| `showError()` | Page error UI | pages/visit |
| `refreshVisitWriteAccess()` | Access check | core/access |
| `formatVisitDate()` | Date formatting | utils/date |
| `loadVisit()` | Visit + patient context + header rendering | services/visits + pages/visit |
| `toggleModule()` | Switch visit modules | pages/visit |
| `setAssessmentSaveLabel()` | Assessment button UI | pages/visit/component |
| `setAssessmentEditMode()` | Lock/unlock assessment fields | pages/visit |
| `editAssessment()` | Enter assessment edit mode | pages/visit |
| `deleteAssessment()` | Open assessment delete modal | pages/visit |
| `closeDeleteAssessmentModal()` | Close modal | components/modal |
| `confirmDeleteAssessment()` | Delete assessment row | services/assessment |
| `calculateBMI()` | BMI calculation | utils/calculations |
| `renderLabs()` | Render lab list | pages/visit/component |
| `escapeHtml()` | HTML escaping | utils/security |
| `addLab()` | Add local lab draft | pages/visit |
| `deleteLab()` | Open lab delete confirmation | pages/visit |
| `closeDeleteLabModal()` | Close lab modal | components/modal |
| `handleDeleteModalBackdrop()` | Modal backdrop behavior | components/modal |
| `confirmDeleteLab()` | Remove lab from local state | pages/visit |
| `handleLabModalKeydown()` | Escape key handling | components/modal |
| `setAssessmentForm()` | Map DB assessment into form | pages/visit |
| `loadAssessment()` | Read assessment row | services/assessment |
| `saveAssessment()` | Access check + write assessment | services/assessment + page controller |
| `backToPatient()` | Navigate to patient profile | pages/visit/router |
| `resolveAction()` | Resolve action path to window function | utility/action dispatcher |
| `executeActivePrint()` | Delegate print to active module | pages/visit |
| `bindPrintLifecycle()` | afterprint cleanup | pages/visit |
| `bindStaticActions()` | Delegated click/input/keyup dispatcher | pages/visit/event layer |

### Important architecture finding

`visit.js` contains page infrastructure **and a complete Assessment feature**. It is therefore a major later refactoring candidate.

---

## 03-B — `js/visit-calculator.js`

| Function | Responsibility | Target candidate |
|---|---|---|
| `calcShowToast()` | Calculator-specific toast | components/toast |
| `selectEnergyEquation()` | Select Mifflin/Schofield + update UI | pages/visit/calculator |
| `updateSchofieldGroupHint()` | Update age-group UI | pages/visit/calculator |
| `calculateSelectedEnergy()` | Calculate BMR/TDEE | utils/calculations + page UI |
| `schofieldBMR()` | Schofield equation | utils/calculations |
| `calculateTDEE()` | Compatibility wrapper | legacy compatibility |
| `calculateSchofield()` | Compatibility wrapper | legacy compatibility |
| `updateTargetAndMacros()` | Target calories + macro calculation/rendering | utils/calculations + page UI |
| `loadCalculatorPatientData()` | Auth + patient/visit/weight/plan queries + form population | services + page controller |

### Important findings

- Pure clinical calculations are mixed with DOM and Supabase code.
- `schofieldBMR()` is a strong pure-function candidate for `utils/calculations.js`.
- `calcShowToast()` duplicates notification logic.
- `loadCalculatorPatientData()` is an orchestration-heavy function and should later be split.
- Compatibility aliases should be preserved until all callers are mapped.

---

## 03-C — `js/visit-diet-plan.js`

This module is isolated in an IIFE, which is a positive containment mechanism for internal state.

| Function | Responsibility | Target candidate |
|---|---|---|
| `num()` | Numeric normalization | utils |
| `cloneDays()` | Deep clone day state | utils |
| `showToast()` | Diet-module notification | components/toast |
| `openConfirmModal()` | Open confirmation UI | components/modal |
| `closeConfirmModal()` | Close confirmation UI | components/modal |
| `scaleHouseholdMeasure()` | Scale household measure by grams | utils/nutrition |
| `formatHouseholdNumber()` | Format household number | utils/formatting |
| `currentUser()` | Current authenticated user | core/auth |
| `canWriteVisitData()` | Write access check | core/access |
| `loadPatient()` | Resolve patient/visit context | services/patients/visits |
| `loadFoods()` | Load foods | services/foods |
| `loadPlan()` | Load plan/days/meals/items | services/diets |
| `updateTargets()` | Render targets | page UI |
| `isDayEditing()` | Read day edit state | page state |
| `setDayEditMode()` | Lock/unlock day fields | page state |
| `editDay()` | Enter day edit mode | page state |
| `saveDay()` | Persist one day | services/diets + page state |
| `addNewDay()` | Add local day | page state |
| `toggleDayCollapse()` | Collapse/expand day | page UI |
| `updateDayTitle()` | Update title | page state |
| `updateDayNotes()` | Update notes | page state |
| `updateMealName()` | Update meal name | page state |
| `moveMeal()` | Reorder meals | page state |
| `deleteDay()` | Delete day + persistence | services/diets + page UI |
| `openAddMealModal()` | Open meal modal | components/modal |
| `closeAddMealModal()` | Close meal modal | components/modal |
| `confirmCreateMeal()` | Create local meal | page state |
| `deleteMeal()` | Delete meal | page state/components |
| `openFoodModal()` | Open food selector | component/page UI |

### Important findings

- IIFE isolation is useful.
- State, rendering, calculations, modal handling and Supabase access are still mixed.
- This is a large feature module and should later become page controller + service + components.

---

## 03-D — `js/visit-exchange-plan.js`

This module is also isolated in an IIFE.

| Function/logic | Responsibility | Target candidate |
|---|---|---|
| `currentExchangeUser()` | Current authenticated user | core/auth |
| `canWriteExchangePlan()` | Write access | core/access |
| `ctx()` | Visit context | page context |
| `status()` | Render status | page UI |
| `vals()` | Resolve exchange nutritional values | utils/nutrition |
| `manual()` | Calculate manual exchange totals | utils/nutrition |
| `calc()` | Derive exchange counts from targets | utils/nutrition |
| `total()` | Calculate exchange totals | utils/nutrition |
| `setButtons()` | Button state | page UI |
| `updateDisplay()` | Update exchange table/totals | page UI |
| `render()` | Render exchange table/targets | page UI |
| `findPlans()` | Query nutrition plans | services/diets |
| `loadExchangeValues()` | Query exchange values | services/diets |
| `ensureExchangePlan()` | Auth/access + create/find plan | services/diets + page controller |
| `loadDays()` | Load plan days/meals/items | services/diets |
| `clone()` | Deep clone state | utils |
| `dayEditing()` | Read day edit state | page state |
| `renderDays()` | Render exchange days | page UI |

### Important findings

- Pure exchange calculations are mixed into the UI module.
- Database queries are mixed into rendering/state logic.
- IIFE isolation helps prevent global collisions but does not separate responsibilities.

---

# Visit-page dependency map

```text
visit.html
│
├── auth-access.js
│
├── visit.js
│    ├── patient_visits
│    ├── assessment
│    ├── access API
│    ├── Assessment state/UI
│    ├── module navigation
│    └── action dispatcher
│
├── visit-calculator.js
│    ├── patients
│    ├── weight_logs
│    ├── nutrition_plans
│    └── energy/macro calculations
│
├── visit-diet-plan.js
│    ├── foods
│    ├── nutrition_plans
│    ├── plan_days
│    ├── plan_meals
│    ├── plan_items
│    └── gram-plan state/rendering
│
└── visit-exchange-plan.js
     ├── nutrition_plans
     ├── exchange_values
     ├── plan_days/meals/items
     └── exchange calculations/rendering
```

## Strong preliminary observation

The visit feature is the clearest example so far of why we should **not** simply make one JS file per HTML page and put everything inside it. One HTML page contains four substantial domains. The eventual page controller should coordinate them without owning every database query and calculation.

---

# Cross-page findings so far

1. `auth-access.js` is currently a shared Core candidate but also contains index-page behavior.
2. Several modules directly query Supabase instead of using dedicated services.
3. Toast/notification logic is duplicated or locally implemented.
4. Modal logic is repeated across modules.
5. Pure calculations are mixed with DOM and database code.
6. IIFEs isolate state but do not by themselves create a clean architecture.
7. `visit.js` contains both page infrastructure and a full Assessment domain.
8. `schofieldBMR()` is a good example of a pure function surrounded by UI/data orchestration.
9. Inline `onclick` handlers still exist in dynamically generated visit-module HTML; this is recorded for later review, not changed now.
10. No application behavior has been changed by this audit.

---

# Audit status

- [x] `index.html`
- [x] `app.html`
- [x] `visit.html`
- [x] `visit.js`
- [x] `visit-calculator.js`
- [x] `visit-diet-plan.js`
- [x] `visit-exchange-plan.js`
- [ ] `patients.html`
- [ ] `diet-plan.html`
- [ ] `calculator.html`
- [ ] `food-library.html`
- [ ] Remaining application pages actually present in repository
- [ ] Full standalone `auth-access.js` audit
- [ ] CSS architecture audit
- [ ] Final dependency graph
- [ ] Final target mapping
- [ ] Refactoring plan

**Rule:** No refactoring begins until the audit is complete and reviewed.
