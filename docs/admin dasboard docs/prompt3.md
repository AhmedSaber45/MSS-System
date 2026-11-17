# COMPU MSS — ADMIN SYSTEM
## Phase 3: Desktop Authentication, Secure Sessions & Offline Authorization

### 1. Phase Context

This is Phase 3 of the Compu MSS Admin System project.

The goal is to integrate the administrative user accounts and module permissions into the existing Tauri desktop application.

**Repository:**
`https://github.com/AhmedSaber45/MSS-System`

**Project path:**
`C:\Users\Administrator\Desktop\System`

**Existing desktop stack:**
- Tauri v2
- React 19
- TypeScript
- Vite
- SQLite
- Supabase
- Existing Offline-First architecture.
- Existing local persistence and Outbox synchronization.

**Admin Dashboard:**
`admin-dashboard/`

Before implementation, inspect the actual results of Phase 1 and Phase 2.

Read:
- `AGENTS.md`
- `rules.md`
- `goals.md`
- Relevant architecture documentation.
- `admin-dashboard/README.md`
- Phase 1 and Phase 2 implementation reports.
- Existing authentication and Supabase integration.
- Existing SQLite schema.
- Existing Outbox and synchronization implementation.
- Tauri permissions and capabilities.

Inspect current Git status and preserve all existing user changes.

Follow:
`https://github.com/heydamir/unslop`

Do not assume the previous phases were implemented exactly as originally planned. Use their actual implementation and documented contracts.

### 2. Main Objective

Implement a secure desktop login and authorization system using the accounts created through the Admin Dashboard.

The login experience must work as follows:

**First launch:**
- The user sees a professional login screen.
- The user enters a username and access code.
- The desktop application verifies the credentials securely with the trusted server-side authentication mechanism.
- If authentication succeeds, the user enters the application with the permissions assigned by the administrator.

**Subsequent launches:**
- The application checks whether a previously authenticated local session exists.
- If the session is still valid according to the locally cached authorization policy, the application can enter automatically without requesting credentials again.
- When online, the application revalidates the session and current account permissions.
- If credentials, account status, or permissions have changed, the application must apply the appropriate restrictions.

The system must preserve existing offline functionality.

### 3. Login Screen

Create a professional login screen consistent with the existing Compu MSS design system.

Requirements:

- Dark-first design.
- Existing blue color identity.
- Clean and modern layout.
- Proper responsive behavior.
- Clear validation messages.
- Loading state during authentication.
- Disabled submit button while processing.
- No unnecessary decorative elements.
- No public registration link.
- No email/password registration flow.

Login fields:

1. Username.
2. Access Code.

Access code field requirements:

- Mask input by default.
- Provide an optional show/hide control.
- Do not persist the entered code.
- Clear sensitive fields after successful authentication.
- Clear sensitive fields when appropriate after authentication failure.
- Never log the code.

The login screen must handle:

- Invalid credentials.
- Disabled accounts.
- Network errors.
- Rate limiting.
- Server errors.
- Expired or revoked sessions.
- Unsupported or outdated client versions, if the existing architecture requires version checks.

Do not reveal whether a username exists.

Use generic authentication failure messages where appropriate.

### 4. Secure Authentication Flow

Use the authentication contract established in Phase 2.

Do not independently recreate access-code verification in the frontend.

The authentication flow must be:

1. User enters username and access code.
2. Desktop application sends the credentials through the approved secure authentication operation.
3. Trusted server-side code verifies the credentials.
4. The server checks account status.
5. The server checks current module permissions.
6. The server checks the user's authorized store/warehouse memberships.
7. The server issues an appropriately secured session.
8. The desktop application receives only the information necessary to establish its session.

Never:
- Download credential hashes to the desktop.
- Compare access codes locally.
- Store access codes in plaintext.
- Put access codes in URLs.
- Include credentials in logs.
- Expose Supabase service-role credentials in the desktop application.

If Phase 2 did not provide a secure authentication endpoint or session mechanism, implement the missing backend dependency safely before integrating it.

Any new database changes must follow the migration requirements in Section 15.

### 5. Secure Local Session Storage

The desktop application must persist the authenticated session securely.

Inspect Tauri v2 capabilities and available secure storage options.

Prefer Windows OS-protected credential storage, such as Windows Credential Manager or an appropriately maintained Tauri secure-storage integration.

Do not store sensitive authentication tokens in:
- Plaintext JSON files.
- `localStorage`.
- `sessionStorage`.
- Unencrypted SQLite columns.
- Browser cookies accessible to arbitrary frontend scripts.
- Application logs.

If the existing application has a secure storage abstraction, reuse and improve it rather than introducing a competing system.

Store only the minimum session information necessary.

A local session may include:

- Session identifier or appropriately protected tokens.
- User ID.
- Credential/security version.
- Permission version.
- Last successful online validation timestamp.
- Authorized module permissions.
- Authorized store/warehouse memberships.
- Session expiry or offline policy metadata.

Do not store the access code.

Ensure that tokens are protected against accidental exposure through frontend debugging, logging, error reporting, or developer tools.

Use short-lived access tokens and an appropriate refresh/revalidation strategy where supported by the chosen authentication architecture.

Refresh tokens must be protected as secrets.

### 6. Automatic Login on Subsequent Launches

Implement automatic session restoration.

On startup:

1. Check secure local storage for an existing session.
2. If no session exists, show the login screen.
3. If a session exists, validate its local structure and integrity.
4. Determine whether the device is online.
5. If online, perform server-side session revalidation.
6. If offline, apply the last-known authorization policy described below.
7. Initialize the application with the correct user and module permissions.

Do not show the main application before authorization initialization finishes.

Prevent a temporary flash of unauthorized modules or sensitive data during startup.

Display an appropriate loading screen while checking the session.

Do not repeatedly prompt for credentials when a valid session can be restored.

### 7. Permission Enforcement Across the Desktop Application

This is a critical security requirement.

The permissions assigned through the Admin Dashboard must actually control access inside the desktop application.

Support:

- Accessories only.
- Compu MSS only.
- Both modules.

Do not merely hide the module navigation items.

Implement a centralized authorization layer that can be reused by:

- Application routing.
- Sidebar navigation.
- Page entry.
- Data-loading functions.
- Mutations and business operations.
- Reports.
- Invoices.
- Exports.
- Sensitive actions.

The authorization checks must use the authenticated user's authoritative session state.

#### Expected behavior

**Accessories-only user:**
- Can enter Accessories.
- Cannot enter Compu MSS.
- Cannot load Compu MSS data through direct routes or internal calls.

**Compu MSS-only user:**
- Can enter Compu MSS.
- Cannot enter Accessories.
- Cannot load Accessories data through direct routes or internal calls.

**Both-modules user:**
- Can access both modules.

**Disabled or revoked user:**
- Cannot continue using protected functionality after revocation is detected.
- Must be redirected to an appropriate restricted or login state.

Do not rely on frontend navigation visibility as the security boundary.

Protect sensitive cloud operations server-side through the existing authorization model.

### 8. Accessories and Compu MSS Data Separation

Preserve the existing independent architecture.

The two modules must remain separate in:

- Database queries.
- Business logic.
- Services.
- Reports.
- Invoices.
- Inventory operations.
- Permissions.

A user with permission for one module must not access the other module's data through:
- Direct navigation.
- Manually entered routes.
- Reused UI components.
- Internal service calls.
- Cached data.
- Background synchronization.

Do not assume Accessories data is cloud-hosted.

Inspect its actual local SQLite persistence and preserve it.

For Accessories-only users, avoid triggering unnecessary Compu MSS data synchronization.

For Compu MSS-only users, avoid loading or exposing Accessories data.

For users with both permissions, preserve existing behavior while maintaining separation.

Do not migrate Accessories data to Supabase in this phase.

### 9. Offline Authorization Policy

Preserving offline operation is mandatory.

When the user has previously authenticated successfully and the internet becomes unavailable, the desktop application should continue to work using its last successfully validated local authorization state.

However, offline authorization must be time-bounded and explicit.

Implement an offline session policy with a clearly defined maximum offline authorization period.

Use a conservative default of **7 days since the last successful online validation**, unless the existing system or a documented security requirement justifies a different value.

The value must be centrally configurable in a safe manner.

Do not allow the desktop client to extend its own authorization period simply by changing its local clock or editing local storage.

Use available OS-protected timestamps or another appropriate anti-tampering mechanism where practical.

Document the limitations of offline time validation.

#### Offline startup

If:
- A previously authenticated session exists.
- The last successful online validation is within the allowed offline period.
- The locally cached session is structurally valid.
- The local authorization data is intact.

Then:
- Allow access to the modules included in the cached permissions.
- Allow existing offline-first functionality.
- Preserve local SQLite operations.
- Preserve pending Outbox records.
- Display a subtle offline indicator.

If the cached authorization has expired:
- Do not allow unlimited offline access.
- Show a clear message that online verification is required.
- Do not delete local business data.
- Do not delete pending Outbox operations.
- Do not silently clear unsynchronized records.

#### Important limitation

If an administrator disables an account or revokes permissions while a device is disconnected, the device cannot know about that change until it reconnects.

Do not claim that remote revocation is instantaneous while offline.

### 10. Reconnection and Automatic Revalidation

When connectivity returns:

1. Detect reconnection using a reliable network-state mechanism.
2. Revalidate the current session with the server.
3. Retrieve current account status.
4. Retrieve current module permissions.
5. Retrieve current store/warehouse memberships.
6. Compare the authoritative values with the cached values.
7. Apply changes safely.
8. Resume existing synchronization behavior.

Handle these cases:

**Case A — No changes**
- Continue working.
- Update the last successful online validation timestamp.
- Refresh the session according to the security policy.

**Case B — Permission changed**
- Immediately update accessible modules after successful revalidation.
- Prevent access to newly unauthorized modules.
- Stop protected operations that are no longer allowed.
- Do not delete local business data or pending Outbox records.

**Case C — Account disabled**
- Invalidate the session.
- Prevent further authenticated operations.
- Return the user to the login screen or a clear restricted state.
- Preserve all local data and pending synchronization records.

**Case D — Access code changed**
- Detect the credential/security version change.
- Invalidate the old session.
- Require the user to log in again with the new access code.

**Case E — Session revoked**
- Invalidate the local session.
- Require authentication again.

**Case F — Server temporarily unavailable**
- Do not treat a server error as proof that the account has been disabled.
- Apply the offline authorization policy.
- Preserve pending data.
- Retry safely with reasonable backoff.

### 11. Session Expiration and Logout

Implement:

- Manual logout.
- Secure session expiration.
- Server-side session revocation where supported.
- Local secure credential/session cleanup.
- Safe handling of expired refresh tokens.
- Handling of invalid or corrupted session storage.

When logging out:

- Revoke the server session if online and supported.
- Remove protected local session credentials.
- Clear in-memory authentication state.
- Return to the login screen.
- Do not delete the user's SQLite business data.
- Do not clear pending Outbox operations.

A failed server-side logout must not leave the application pretending the user is authenticated locally.

If offline logout occurs, invalidate the local session immediately and queue any safe revocation operation only if the existing architecture supports it.

Do not queue or persist raw authentication secrets.

### 12. Background Sync and User Authorization

Integrate authentication with the existing Compu MSS synchronization engine carefully.

Before executing protected cloud operations:

- Verify that a valid authenticated session exists.
- Verify that the user has the relevant module permission.
- Verify store/warehouse access where required.
- Use the appropriate authenticated identity.

Do not break the existing Outbox workflow.

Pending operations created while offline must not be discarded merely because the session later becomes invalid.

When a disabled or unauthorized user reconnects:

- Preserve pending operations locally.
- Do not silently upload operations under another user's identity.
- Do not bypass server-side authorization.
- Provide a clear state explaining why synchronization is blocked.
- Define a safe administrative recovery path for legitimate pending data.

Do not rewrite historical actor IDs or transaction ownership to make synchronization succeed.

Do not silently attribute old operations to a different user.

If the current Outbox design lacks enough information to safely associate operations with their original actor, document the gap and implement the smallest safe extension required.

### 13. Authenticated User Context

Create a centralized, typed authenticated-user context.

It should provide, as appropriate:

- User ID.
- Display name.
- Username.
- Active account state.
- Module permissions.
- Authorized store/warehouse memberships.
- Credential version.
- Permission version.
- Session state.
- Online/offline verification state.

Avoid duplicating authorization logic in individual pages.

Do not expose sensitive tokens through ordinary React component props or debugging output.

Ensure that components cannot accidentally treat a missing authentication context as full access.

Use a secure default-deny policy.

### 14. User Interface Integration

Integrate the authenticated user into the existing application layout.

Where appropriate, display:
- Current user display name.
- Authorized module access.
- Current online/offline state.
- Logout action.

Do not unnecessarily redesign the existing desktop UI.

Keep the existing dashboard, sidebar, tables, and business workflows intact.

Only modify the components necessary for:
- Login.
- Session restoration.
- Authorization.
- User context.
- Offline/revalidation indicators.
- Logout.

Make sure the application does not briefly render unauthorized screens while authentication is initializing.

### 15. Database and Migration Requirements

Inspect the Phase 1 and Phase 2 database implementation.

Reuse the existing authentication and session architecture.

Do not create duplicate session tables or duplicate permission models.

If changes are required:

- Preserve existing data.
- Use safe constraints and indexes.
- Maintain RLS.
- Keep credential verification server-side.
- Keep token and session secrets inaccessible to clients.
- Ensure session revocation is reliable.
- Ensure permission and credential version checks are consistent.

**Mandatory migration deliverable:**

If Phase 3 requires database changes, create one complete, consolidated SQL migration file containing all Phase 3 database changes.

It must:
- Be compatible with the actual existing schema.
- Include all required tables, columns, constraints, indexes, functions, triggers, and RLS changes.
- Be reviewed for syntax and dependency correctness.
- Be safe to execute in the Supabase SQL Editor in one go.
- Preserve existing data.

Provide the exact file path.

Do not claim it has been executed unless it actually has been executed and verified.

If no database migration is required, explicitly state why.

### 16. Security Testing

Implement tests for:

#### Authentication
- Valid credentials.
- Invalid credentials.
- Disabled account.
- Invalid session.
- Expired session.
- Revoked session.
- Access-code change.
- Permission change.
- Server error.
- Rate-limited login.

#### Module Authorization
- Accessories-only user.
- Compu MSS-only user.
- Both-modules user.
- Direct unauthorized route access.
- Unauthorized service calls.
- Unauthorized data queries.
- Unauthorized mutations.
- Missing authentication context.

#### Offline Behavior
- First launch without internet.
- Existing valid offline session.
- Offline session within the allowed period.
- Offline session after expiration.
- Internet disconnection during operation.
- Internet reconnection.
- Server temporarily unavailable.
- Permission revoked while offline.
- Account disabled while offline.
- Access code changed while offline.

#### Synchronization
- Pending Outbox records survive logout.
- Pending records survive account invalidation.
- Unauthorized records are not uploaded.
- Existing valid records synchronize normally.
- No operations are silently attributed to another user.
- No duplicate operations are created during retries.

#### Regression
- Accessories local workflows still work.
- Compu MSS offline workflows still work.
- Existing SQLite data is preserved.
- Existing synchronization behavior remains intact.
- Existing invoices, inventory, and reports remain functional for authorized users.

Run:
- TypeScript checks.
- Lint.
- Unit tests.
- Integration tests.
- Tauri build.
- Production frontend build.

Do not ignore failed tests.

### 17. Documentation

Update the project documentation.

Document:

- Authentication architecture.
- Login flow.
- Session storage mechanism.
- Token lifecycle.
- Module permission enforcement.
- Offline authorization policy.
- Seven-day default offline authorization window.
- Reconnection and revalidation behavior.
- Session revocation.
- Outbox behavior when authentication is invalid.
- Any Windows-specific setup requirements.
- Any required Tauri plugins or permissions.

Explain the known limitations of offline revocation clearly.

### 18. Phase 3 Completion Criteria

Phase 3 is complete only when:

1. First-time login works using username and access code.
2. Access-code verification occurs securely server-side.
3. Local sessions are stored using OS-protected secure storage.
4. Automatic login works on subsequent launches when authorized.
5. Module permissions are enforced throughout the desktop application.
6. Unauthorized modules cannot be accessed through direct routes or internal calls.
7. Offline access works using the last verified permissions within the configured window.
8. Expired offline authorization is handled safely.
9. Reconnection triggers automatic revalidation.
10. Account, credential, permission, and session revocations are detected online.
11. Logout works safely.
12. Local business data and pending Outbox records are preserved.
13. No unauthorized synchronization occurs.
14. Existing Accessories and Compu MSS workflows remain intact.
15. Relevant tests and builds pass.

---

## STRICT PHASE GATE

**STOP AFTER PHASE 3.**

Do not start Phase 4.

Do not implement store/warehouse merging workflows yet.

Do not implement inventory transfers.

Do not automatically continue to the next phase.

After completion, provide:

1. Full authentication architecture summary.
2. Exact secure storage implementation used.
3. Exact login and session verification flow.
4. How module permissions are enforced.
5. Offline authorization behavior and its limitations.
6. Reconnection and revocation behavior.
7. Any Outbox changes.
8. All created and modified files.
9. Exact SQL migration path, if applicable.
10. Tests and build results.
11. Remaining security limitations.
12. Any decisions requiring my approval.

Leave the repository in a clean, buildable state.

Wait for my explicit approval before Phase 4.