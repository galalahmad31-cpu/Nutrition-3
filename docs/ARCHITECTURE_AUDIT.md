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

# Audit 04 — `patient.html` + `js/patient.js`

## Page responsibility

Patient directory page: list the authenticated user's patient records, search, open a patient profile, create a patient, and delete a patient.

`patient.html` loads the shared `auth-access.js`, the page-specific `patient.js`, and theme/CSS resources. The page uses `data-action` attributes for most UI actions and does not use inline `onclick` in the static HTML.

## Functions identified

| Function | Responsibility | Target candidate |
|---|---|---|
| `$()` | DOM lookup helper | utils/dom or page helper |
| `escapeHtml()` | HTML escaping | utils/security |
| `showStatus()` | Page status/notification UI | components/toast/status |
| `showLoadError()` | Render patient-load error | pages/patient |
| `refreshAccess()` | Reads access status, active subscription and patient quota | core/access; page controller |
| `updateWriteControls()` | Enable/disable add-patient UI and access message | pages/patient |
| `loadPatients()` | Supabase query for patients | services/patients |
| `renderPatients()` | Filter and render patient list | pages/patient |
| `openPatient()` | Navigate to patient profile | pages/patient/router |
| `openAddPatientModal()` | Open add-patient modal + access guard | page controller + components/modal |
| `closeAddPatientModal()` | Close/reset add-patient modal | components/modal |
| `createPatient()` | Validate input + insert patient + navigate | services/patients + page controller |
| `askDelete()` | Prepare delete confirmation | page controller |
| `closeDeleteModal()` | Close delete modal | components/modal |
| `deletePatient()` | Delete patient row + update local state | services/patients + page controller |
| `handleClick()` | Delegated action dispatcher | pages/patient/event layer |
| `bindEvents()` | Bind page events | pages/patient |
| `init()` | Page bootstrap | pages/patient |

## Important architecture findings

1. `patient.js` is already using an IIFE, so its state is contained rather than exported globally.
2. `loadPatients()`, `createPatient()`, and `deletePatient()` directly access Supabase. These are strong `services/patients.js` candidates.
3. `refreshAccess()` calls several shared access APIs and also updates page state. The access calls belong in Core; the orchestration can remain in the page controller.
4. `showStatus()` is a page-local notification system and should later be compared with the existing Toast implementations before extracting a shared component.
5. `escapeHtml()` is duplicated conceptually with the same helper already identified in `visit.js`; this is a strong utility-extraction candidate.
6. Modal open/close logic is repeated and is a candidate for `components/modal.js`, but behavior should not be changed during audit.
7. The page uses delegated `data-action` handling, which is architecturally cleaner than adding inline `onclick` handlers.

## Patient dependency map

```text
patient.html
│
├── auth-access.js
│    └── authentication/access/subscription APIs
│
└── patient.js
     ├── refreshAccess()
     │    └── DietPlannerAccess
     │
     ├── loadPatients()
     │    └── Supabase → patients
     │
     ├── renderPatients()
     │    └── DOM/state
     │
     ├── createPatient()
     │    └── Supabase → patients
     │
     └── deletePatient()
          └── Supabase → patients
```

## Preliminary assessment

`patient.js` is **not yet a clean Service/Page separation**, but it is relatively understandable: the main architectural problem is that database operations, access orchestration, UI rendering, and modal behavior live in the same module. It is a good candidate for incremental extraction rather than a full rewrite.

---

# Audit 05 — `diet.html` + `js/diet.js`

## Page responsibility

Diet-template/library management: load foods and diet templates, create/edit/duplicate/delete diet templates, edit days/meals/items, calculate nutritional totals, and render the editor.

## Functions identified by responsibility

| Area | Functions / logic | Target candidate |
|---|---|---|
| Access/auth | `getSession()` and access checks | core/auth + core/access |
| Data loading | `loadFoods()`, `loadDiets()`, `openDiet()` | services/foods + services/diets |
| Persistence | `saveDietTemplateViaRpc()`, `save()`, delete/duplicate logic | services/diets |
| State | diets, foods, day, editing id, selected food | pages/diet state |
| Calculations | `calcTotals()`, `scaleHouseholdMeasure()`, `formatHouseholdNumber()` | utils/nutrition + utils/formatting |
| Rendering | `renderDiets()`, `renderSummary()`, `renderDay()`, `mealHTML()` | pages/diet |
| UI | `toggleEditor()`, confirmation/modal handlers | components/modal + pages/diet |
| Events | click/change/submit handlers | pages/diet/event layer |

## Important findings

1. `diet.js` mixes Page + State + Rendering + Calculations + Supabase + Access + Persistence.
2. `save()` is orchestration-heavy: validation → totals/payload construction → RPC persistence → local state/UI updates.
3. `saveDietTemplateViaRpc()` delegates persistence to the database RPC `save_diet_template`; the RPC must be mapped before refactoring this layer.
4. The file uses an IIFE, which protects internal state but does not separate responsibilities.
5. Some handlers use direct `.onclick` assignment; record for later event-layer normalization only.

## Preliminary target

```text
pages/diet.js
    ├── state
    ├── rendering
    └── event orchestration

services/diets.js
    ├── load diets
    ├── save/duplicate/delete
    └── RPC calls

services/foods.js
    └── food queries

utils/nutrition.js
    └── pure diet calculations
```

---

# Audit 06 — `quickcalc.html` + `js/quickcalc.js`

## Page responsibility

Standalone quick clinical calculator page containing several nutrition calculations and dynamic calculator sections.

## Functions identified

| Function | Responsibility | Target candidate |
|---|---|---|
| `addIVLine()` | Add dynamic IV calculation row | pages/quickcalc |
| `removeIVLine()` | Remove dynamic row | pages/quickcalc |
| `toggleQuickAccordion()` | UI accordion | pages/quickcalc/component |
| `toggleDexMode()` | Toggle dextrose mode | pages/quickcalc |
| `calculateQuickGIR()` | GIR calculation | utils/nutrition/gir |
| `calculateDextrosePrep()` | Dextrose preparation calculation | utils/nutrition/dextrose |
| `calculateFormulaConcentration()` | Formula concentration calculation | utils/nutrition/formula |
| `calculateBreastmilkFortification()` | Breastmilk fortification calculation | utils/nutrition/fortification |
| `convertDensityToKcalPerMl()` | Density conversion | utils/nutrition |
| `initializeQuickCalculatorAccess()` | Access initialization | core/access + page bootstrap |
| event listeners | Calculator interaction/validation | pages/quickcalc |

## Important findings

1. Clinical calculations are mixed with DOM manipulation and validation.
2. Pure equations are strong candidates for small testable utility modules.
3. The file contains wrapper/override logic around `calculateFormulaConcentration()`; this should be mapped before removing or merging anything.
4. Event delegation is used for several dynamic calculator controls, which is a positive pattern.

## Preliminary target

```text
pages/quickcalc.js
    ├── inputs
    ├── rendering
    └── orchestration

utils/nutrition/
    ├── gir.js
    ├── dextrose.js
    ├── formula-concentration.js
    └── fortification.js
```

No calculation is to be rewritten during the audit; formulas will be compared and tested separately during refactoring.

---

# Audit 07 — `food.html` + `js/food.js`

## Page responsibility

Food library page with two tabs: foods and food exchanges. Supports searching/filtering, displaying nutrition values, and CRUD operations for user-created custom foods.

## Functions identified

| Function | Responsibility | Target candidate |
|---|---|---|
| `$()` | DOM lookup | utils/dom |
| `num()` | Numeric normalization | utils/formatting |
| `toast()` | Local toast implementation | components/toast |
| `esc()` | HTML escaping | utils/security |
| `loadExchanges()` | Query `food_exchanges` | services/foods/exchanges |
| `renderExchanges()` | Filter/render exchanges | pages/food |
| `switchTab()` | Toggle food/exchange sections | pages/food |
| `loadFoods()` | Query `foods` | services/foods |
| `render()` | Filter/render foods and stats | pages/food |
| `openModal()` | Open/reset food form | components/modal + pages/food |
| `closeModal()` | Close food form | components/modal |
| `closeDeleteConfirm()` | Close delete modal | components/modal |
| `openDeleteConfirm()` | Prepare delete confirmation | components/modal + pages/food |
| `init()` | Access check + initial loading | pages/food + core/access |
| CRUD handlers | Insert/update/delete custom foods | services/foods |

## Important findings

1. Food CRUD is directly implemented inside the page module; this is a clear `services/foods.js` candidate.
2. `toast()` and `esc()` are page-local implementations of responsibilities already found elsewhere.
3. Modal logic is duplicated again.
4. The page uses event delegation for edit/delete rows, which is a good pattern to preserve.
5. Access is obtained through `window.DietPlannerAccess`, which is consistent with the shared access layer.

## Preliminary target

```text
services/foods.js
    ├── list foods
    ├── create custom food
    ├── update custom food
    └── delete custom food

services/food-exchanges.js
    └── list exchange values

pages/food.js
    ├── filtering
    ├── rendering
    ├── tabs
    └── UI orchestration
```

---

# Audit 08 — `patient-profile.html` + `js/patient-profile.js`

## Page responsibility

Patient profile page: load one patient, display/edit patient data, list visits, add/delete visits, and link to weight tracking.

## Functions identified

| Function | Responsibility | Target candidate |
|---|---|---|
| `setLink()` | Build patient-specific navigation links | pages/patient-profile/router |
| `showError()` | Render page error state | pages/patient-profile |
| `getUserForWrite()` | Resolve current write user from state | core/auth/page controller |
| `refreshWriteAccess()` | Refresh access/subscription state | core/access + page controller |
| `updateWriteControls()` | Enable/disable edit/add-visit controls | pages/patient-profile |
| `canWrite()` | Local write-access decision | core/access candidate |
| `loadPatient()` | Query patient + initialize profile | services/patients + page controller |
| `loadVisits()` | Query/render patient visits | services/visits + page UI |
| `escapeHtml()` | HTML escaping | utils/security |
| `formatVisitDate()` | Date formatting | utils/date |
| `deleteVisit()` | Confirm and delete visit | services/visits + page UI |
| `addVisit()` | Determine next visit number and insert visit | services/visits + page controller |
| `fillPatientData()` | Map patient data to form | pages/patient-profile |
| `setEditing()` | Toggle patient form edit mode | pages/patient-profile |
| `enableEditing()` | Enter edit mode after access check | pages/patient-profile |
| `cancelEditing()` | Restore original values and exit edit mode | pages/patient-profile |
| `savePatient()` | Validate/build payload/update patient | services/patients + page controller |

## Important findings

1. Patient and visit database operations are mixed directly into the page controller.
2. `escapeHtml()` and `formatVisitDate()` duplicate utilities identified elsewhere.
3. Access state is partly delegated to `DietPlannerAccess`, but the page also maintains its own `isAdmin` and subscription state.
4. Visit numbering is calculated in the client before insert; this should be reviewed against database constraints/RPC behavior later, because concurrency can make client-side `max + 1` fragile.
5. The page uses `addEventListener()` for dynamically created visit delete buttons, which is a positive pattern.
6. SweetAlert is used directly for confirmation/feedback; during component extraction we should decide whether SweetAlert remains a shared UI dependency or is wrapped by a modal/confirm service.

## Preliminary target

```text
services/patients.js
services/visits.js

pages/patient-profile.js
    ├── profile rendering/editing
    ├── access orchestration
    └── navigation

utils/security.js
utils/date.js

components/confirm.js  (or modal adapter)
```

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
10. `patient.js` demonstrates a cleaner event pattern using `data-action` delegation, which can serve as a reference when reviewing older modules.
11. The actual repository uses names such as `patient.html`, `diet.html`, `quickcalc.html`, and `food.html`; the earlier conceptual names `patients.html`, `diet-plan.html`, `calculator.html`, and `food-library.html` are target concepts, not current filenames.
12. `patient-profile.js` introduces a second layer of visit management that overlaps conceptually with `visit.js`; this relationship needs to be mapped before extracting `services/visits.js`.
13. Client-side access checks are UI guards only; final authorization must remain enforced by Supabase RLS/policies.

---

# Audit status

- [x] `index.html`
- [x] `app.html`
- [x] `visit.html`
- [x] `visit.js`
- [x] `visit-calculator.js`
- [x] `visit-diet-plan.js`
- [x] `visit-exchange-plan.js`
- [x] `patient.html`
- [x] `diet.html`
- [x] `quickcalc.html`
- [x] `food.html`
- [x] `patient-profile.html`
- [ ] `nutritionsupport.html`
- [ ] `nutritionsupport-patient.html`
- [ ] `admin.html`
- [ ] `article.html`
- [ ] `feedback.html`
- [ ] `finance.html`
- [ ] `products.html`
- [ ] `profile.html`
- [ ] `notifications.html`
- [ ] `subscription_plans.html`
- [ ] `subscription_plans_index.html`
- [ ] `about.html`
- [ ] `forgot-password.html`
- [ ] `update-password.html`
- [ ] `privacy.html`
- [ ] `weight.html`
- [ ] Remaining application pages actually present in repository
- [ ] Full standalone `auth-access.js` audit
- [ ] CSS architecture audit
- [ ] Final dependency graph
- [ ] Final target mapping
- [ ] Refactoring plan

**Rule:** No refactoring begins until the audit is complete and reviewed.
