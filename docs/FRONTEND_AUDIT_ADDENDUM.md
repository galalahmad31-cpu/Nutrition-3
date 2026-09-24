# Frontend Audit Addendum

## Deep audit — `js/auth-access.js`

`auth-access.js` is currently the most important shared frontend contract. It creates the single Supabase client, handles password/Google auth, reads the profile role, checks subscription/features, exposes access helpers, and performs index-page routing. The file is therefore conceptually several future modules rather than one generic utility.

### Responsibilities found

```text
Supabase client
Authentication
Session
Profile role
Subscription access
Feature access
Patient quota
Index routing
Login/register UI
Google OAuth
Logout
```

### Important findings

1. **Single client is correct conceptually.** The application pages can consume the shared client through the access layer instead of creating their own client.
2. **Authentication and access are mixed.** `getCurrentUser()`, `loginUser()`, `registerUser()`, and `loginWithGoogle()` belong to authentication; `getUserRole()`, `hasActiveSubscription()`, `canAddPatient()`, `canWrite()`, and `hasFeature()` belong to access/subscription concerns.
3. **Routing is mixed into the same file.** `checkUserAccess()` and `initializeIndex()` are index-page orchestration and should eventually live outside the reusable authentication/access contract.
4. **`hasActiveSubscription()` has two paths:** the preferred `has_active_subscription` RPC and a direct `subscriptions` table fallback. This is useful as a UI resilience strategy, but it creates two representations of the same business rule. The backend audit must verify that both paths have identical semantics and that RLS cannot produce misleading UI results.
5. **Admin access is inferred from the profile role in the frontend.** This is acceptable for UI decisions only; database RLS must remain authoritative for protected writes.
6. **`canWrite()` currently derives write access from `hasActiveSubscription()`.** That means the exact business meaning of “write access” is coupled to subscription activity and admin handling. This must be compared with backend RLS and RPC rules before extraction.
7. **Feature checks are delegated to the `has_feature` RPC.** This is a strong candidate for a stable `core/access` contract because multiple pages can consume the same answer.
8. **Google OAuth redirect is hard-coded to `https://nutrition-3.vercel.app/index.html`.** This is a deployment coupling and is especially relevant to the GitHub Pages/Vercel architecture. It should eventually be centralized as configuration rather than duplicated/hard-coded.
9. **The publishable Supabase key is present in frontend source.** A Supabase publishable/anon key is designed to be exposed to the browser; security must therefore rely on Auth + RLS, not secrecy of this key. The backend audit must verify RLS rather than treating the key as a secret.
10. **The index page deliberately avoids automatic routing on every normal load.** The code comments document a prior mobile keyboard/focus problem and restrict automatic session routing to OAuth callback cases. This behavior should be preserved during refactoring unless explicitly redesigned and tested.
11. **Password-strength validation is duplicated conceptually with the password-recovery/update-password pages.** Candidate shared validation utility after all consumers are mapped.
12. **`showAuthMessage()` and `setBusy()` are page-specific UI helpers inside the shared access file.** They are not suitable as reusable core responsibilities.

### Target split

```text
js/core/supabase.js
    └── create/own the single Supabase client

js/core/auth.js
    ├── getCurrentUser
    ├── login
    ├── register
    ├── Google OAuth
    └── logout

js/core/access.js
    ├── getUserRole
    ├── getAccessStatus
    ├── hasFeature
    └── access contracts

js/core/subscription.js
    ├── hasActiveSubscription
    └── subscription access contract

js/pages/index.js
    ├── login/register UI binding
    └── post-auth routing

js/utils/validation.js
    └── password validation
```

This is a **target only**. No source code has been moved.

## Frontend security/architecture checks added to the audit

The final frontend audit must explicitly verify:

- No service-role or secret Supabase key is shipped to the browser.
- RLS, not frontend checks, protects database writes.
- `window.*` globals have documented owners and consumers.
- Every shared script is loaded before consumers that depend on it.
- Page scripts do not accidentally execute against missing DOM elements.
- Event handlers are not registered more than once when pages are initialized/reinitialized.
- Dynamic HTML uses appropriate escaping/sanitization; rich HTML paths remain explicitly reviewed.
- OAuth/password-recovery redirect URLs are deployment-safe.
- Tailwind source versus generated CSS is clearly identified.
- GitHub Pages and Vercel use the same expected asset paths or have deliberate configuration differences.
- Refactoring does not change clinical formulas or database authorization semantics.

## Audit status after this pass

The frontend audit is **not yet marked COMPLETE**. The JS architecture has been mapped at the domain level, but a final exhaustive pass still requires script/style loading order, remaining CSS files, global/window dependencies, and cross-file reference verification.

This addendum is intentionally separate until the existing `ARCHITECTURE_AUDIT.md` can be replaced safely with a complete merged version. No application source files were changed.