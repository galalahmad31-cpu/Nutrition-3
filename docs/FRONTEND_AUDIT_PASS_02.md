# Frontend Audit — Pass 02

This document records the next verified pass of the frontend audit. It does not modify application source code.

## 1. HTML / script loading

Verified `index.html` and `app.html` loading order.

```text
Supabase browser library
        ↓
theme.js (where used)
        ↓
auth-access.js
        ↓
page consumer (for example app-dashboard.js)
```

`app-dashboard.js` therefore depends on `DietPlannerAccess` being initialized before it runs. This order must be preserved during any refactor.

## 2. Global contracts

Important shared globals identified:

```text
window.DietPlannerAccess
window.DietPlannerTheme
window.visitContext
```

### Assessment

- `DietPlannerAccess`: high-coupling shared contract. Keep its public API stable even if its implementation is split into `core/auth`, `core/access`, `core/subscription`, and `core/supabase`.
- `DietPlannerTheme`: narrow, coherent shared contract. No reason to split it further at present.
- `visitContext`: domain bridge between `visit.html` and Visit submodules. Its shape should be documented before refactoring.

## 3. Event-handler audit

GitHub code-search queries for literal `onclick=` and the exact `addEventListener(` pattern returned no indexed matches. This is **not proof of absence** because code-search indexing can be incomplete. Critical files must still be inspected directly.

Existing modules already use event delegation / `data-action` style patterns. These should be retained where they are working rather than converted purely for style.

## 4. CSS — `nutritionsupport-patient.css`

This is a large page/domain stylesheet covering:

```text
EN / TPN identity
Patient information
Support days
Tables
Clinical callouts
Glucose controls
Modal
Responsive behavior
Print-related presentation
```

Findings:

- Own `:root` tokens overlap with global theme tokens.
- Global `body` and form selectors overlap with other page CSS.
- Several generic classes can collide if this stylesheet is loaded globally.
- EN/TPN-specific styling is a legitimate domain boundary and should not be split blindly.
- Google Fonts is imported locally; font loading should eventually be centralized.
- Candidate future boundaries are page CSS, shared clinical callouts only if reused, and global base rules only after consumer/cascade verification.

Source reviewed: `main/css/nutritionsupport-patient.css`. fileciteturn166file0

## 5. CSS — `nutritionsupport.css`

This stylesheet also contains multiple historical style blocks and a later phone/print refinement layer.

Important duplication targets:

```text
body / font-family
input, select, textarea
.table-custom
.bg-low-risk / bg-mod-risk / bg-high-risk
.infograph-step
.highlight-box
.monitoring-section
.component-select
LTR helpers
print rules
Google Fonts @import
```

These are **audit targets, not deletion candidates**. Consolidation must wait until selector scope, load order, dark mode, print output, and consumers are verified. fileciteturn168file0

## 6. Deployment / Tailwind audit

The frontend has two distinct deployment concerns:

```text
GitHub Pages
  → static asset paths + generated Tailwind CSS

Vercel
  → deployment URL + OAuth redirect
```

The hard-coded OAuth redirect in `auth-access.js` is a deployment coupling.

The remaining verification required is to map every HTML reference to `tailwind.css` and confirm whether the referenced file is source CSS, generated CSS, or a stale path. GitHub Pages and Vercel must not silently depend on different generated assets.

## 7. Architecture conclusion from this pass

The current frontend is not best described as "one giant spaghetti file". It is better described as a **working page-oriented application with several cross-cutting responsibilities duplicated across pages**.

The major boundaries to preserve during refactoring are:

```text
Core
  auth / access / subscription / Supabase client

Services
  database/domain operations

Components
  toast / modal / loading / shared UI

Utils
  pure calculations / validation / formatting

Pages
  DOM + page orchestration
```

The highest-risk refactoring area is `auth-access.js` because many pages depend on its public contract.

## 8. Completion status

Frontend audit is **NOT COMPLETE yet**.

Remaining verification:

```text
□ exhaustive HTML inventory
□ all CSS files
□ all script/style references
□ cross-file function references
□ complete global/window consumer map
□ Tailwind generated/source path verification
□ GitHub Pages/Vercel asset-path verification
□ duplicate function/component inventory
□ circular/hidden dependency check
□ final dependency graph
□ KEEP / MOVE / MERGE / DELETE / REVIEW matrix
□ final frontend completion mark
```

**No application source files were changed in this pass.**
