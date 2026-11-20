# Security Specification (`security_spec.md`)

Target Firebase Project: `sulsul-proposal-2`  
Collections Secured: `/users/{userId}`, `/admins/{userId}`, `/suggestions/{suggestionId}`, `/suggestions/{suggestionId}/comments/{commentId}`

## 1. Data Invariants

1. **Authentication, Email Verification & Employee-ID Password Auth**:
   - Standard external/OAuth accounts require `request.auth != null && request.auth.token.email_verified == true`.
   - Internal plant Employee-ID accounts signed in with Firebase Email/Password (`sign_in_provider == 'password'`) are accepted ONLY when `request.auth.token.email` strictly matches `^[a-z0-9_\-]{2,32}@sulsul\.brewery$` (17..47 chars).
   - Bootstrapped administrator recognition (`isBootstrappedAdmin()`) STRICTLY requires `request.auth.token.email_verified == true && request.auth.token.email == 'joonwn@gmail.com'` — unverified password accounts can NEVER spoof an admin email.
   - Unauthenticated access is denied everywhere via a global catch-all `match /{document=**} { allow read, write: if false; }`.
2. **PII Isolation & F-01 Password Onboarding**: `/users/{userId}` stores `email`, `phone`, and optional `isFirstLogin` boolean. Only the document owner (`request.auth.uid == userId`) or an administrator (`isAdmin()`) may read or update it. Non-admins cannot self-assign `role == 'ADMIN'` on create (limited to `['WORKER', 'PART_LEADER', 'TEAM_LEADER']`, none of which confer Firestore `isAdmin()` privileges) and cannot modify `role` on update. Owners may update `isFirstLogin` only alongside safe profile fields (`displayName`, `phone`, `process`, `workerId`, `isFirstLogin`, `updatedAt`).
3. **Suggestion Ownership & Immutability**:
   - Every `/suggestions/{suggestionId}` document must have `id == suggestionId` matching `^[a-zA-Z0-9_\-]+$`, `ownerUid == request.auth.uid` on create, and `createdAt == request.time`, `updatedAt == request.time`.
   - Non-admin creators may only create suggestions with `status == 'PENDING'`.
   - `id`, `ownerUid`, and `createdAt` are immutable after creation.
   - Once a suggestion reaches a terminal state (`COMPLETED` or `REJECTED`), non-admins are blocked from making any further updates. Only verified admins may override terminal states.
4. **Master Gate for Comments Subcollection**:
   - A `/suggestions/{suggestionId}/comments/{commentId}` document cannot be created or read unless the parent `/suggestions/{suggestionId}` document exists (`exists()`/`get()`) and the caller is either the parent suggestion's `ownerUid` or an admin.
   - `parentOwnerUid` must strictly match the parent suggestion document's `ownerUid`, and `authorUid` must match `request.auth.uid`.
5. **Bounded Strings & Arrays**: Every string field has strict `.size()` limits matching `firebase-blueprint.json`; `quickTags` is bounded to at most 10 entries with first-element type/size guarding.
6. **Zero-Cost Secure List Queries**: `allow list` rules explicitly evaluate `resource.data` against `request.auth.uid` (or bootstrapped verified admin email `joonwn@gmail.com`) without calling `get()` or `exists()`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return `PERMISSION_DENIED`)

1. **Unauthenticated Suggestion Create**: `auth = null`, creating `/suggestions/SUG-2026-999` -> DENIED (Auth gate).
2. **Unverified Admin Email Spoofing (Password Provider or External)**: `auth = { uid: 'attacker', email: 'joonwn@gmail.com', email_verified: false, sign_in_provider: 'password' }`, reading `/users/victim` -> DENIED (`isBootstrappedAdmin()` strictly requires `email_verified == true` and `isEmployeePasswordAuth()` rejects non-`@sulsul.brewery` domains).
3. **Self-Assigned Admin Role Escalation**: Employee-ID user (`240301@sulsul.brewery`) creating `/users/{uid}` with `role: 'ADMIN'` -> DENIED (Self-registration strictly excludes `'ADMIN'`, and Firestore `isAdmin()` depends exclusively on verified bootstrapped admin or `/admins/{uid}`).
4. **PII Cross-User Read**: Verified user `uidA` attempting `get` on `/users/uidB` -> DENIED (Owner/Admin only).
5. **Path Variable ID Poisoning**: Creating `/suggestions/bad$id/with..spaces` or 200-char ID -> DENIED (`isValidId()` regex & length check).
6. **Identity Spoofing on Suggestion Create**: Verified user `uidA` creating `/suggestions/SUG-2026-100` with `ownerUid: 'uidB'` -> DENIED (`incoming().ownerUid == request.auth.uid`).
7. **Shadow Field Injection ("Ghost Field")**: Creating `/suggestions/SUG-2026-101` with extra key `isVerifiedAdmin: true` -> DENIED (`hasOnly()` strict key check).
8. **Client Timestamp Forgery**: Creating `/suggestions/SUG-2026-102` with client-forged `createdAt` != `request.time` -> DENIED (Strict server timestamp check).
9. **Workflow State Shortcutting by Worker**: Verified non-admin creating a suggestion directly with `status: 'COMPLETED'` or updating `status` from `'PENDING'` to `'COMPLETED'` -> DENIED (Non-admins restricted to allowed field actions).
10. **Terminal State Mutation by Non-Admin**: Suggestion owner attempting to edit `title`/`description` after `status == 'COMPLETED'` -> DENIED (Terminal state lock).
11. **Array Size / Value Poisoning**: Updating `quickTags` with 15 elements or a non-string element -> DENIED (Total array guarding).
12. **Orphaned Comment Write / Cross-Suggestion Comment Injection**: Creating `/suggestions/NON_EXISTENT/comments/c1` or commenting on another user's suggestion as a non-admin -> DENIED (Master Gate `get()` check on parent suggestion).
