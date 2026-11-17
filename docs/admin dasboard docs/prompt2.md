# COMPU MSS — ADMIN SYSTEM
## Phase 2: User Management, Access Codes & Module Permissions

### 1. Phase Context

This is Phase 2 of the Compu MSS Admin System project.

The project already has a separate Admin Dashboard foundation planned and implemented in Phase 1.

**Repository:**
`https://github.com/AhmedSaber45/MSS-System`

**Project path:**
`C:\Users\Administrator\Desktop\System`

**Admin Dashboard location:**
`admin-dashboard/`

Before implementation, inspect the actual Phase 1 implementation and its final report. Do not assume every planned feature was completed exactly as specified.

Read:
- `AGENTS.md`
- `rules.md`
- `goals.md`
- `admin-dashboard/README.md`
- Relevant architecture and security documentation.
- Existing Supabase migrations and Edge Functions.
- Phase 1 implementation and test results.

Also inspect current Git status and preserve all existing user changes.

Follow the official Unslop guidelines:
`https://github.com/heydamir/unslop`

**Important:** Phase 2 must extend Phase 1, not replace it or rebuild it unnecessarily.

If Phase 1 contains an unresolved issue that blocks this phase, identify it and resolve only the necessary dependency safely before continuing.

---

### 2. Phase Objective

Implement a complete and secure user-management and authorization system inside the Admin Dashboard.

The administrator must be able to create and manage desktop application users and determine exactly which modules each user can access.

The system must support:

1. Creating users.
2. Assigning usernames.
3. Creating and changing access codes.
4. Enabling and disabling accounts.
5. Assigning Accessories and/or Compu MSS permissions.
6. Managing user-to-store/warehouse access.
7. Revoking access securely.
8. Tracking important account and permission changes.
9. Providing a secure foundation for the desktop authentication system in Phase 3.

This is not a public customer registration system.

Only authorized administrators can manage these accounts.

---

### 3. User Account Model

Implement the following account attributes, adapting them to the actual Phase 1 schema where appropriate:

- Unique user ID.
- Display name.
- Username.
- Secure access-code hash.
- Account status: active or disabled.
- Assigned module permissions.
- Assigned store/warehouse memberships.
- Created timestamp.
- Updated timestamp.
- Last successful login timestamp.
- Credential version or security version.
- Permission version or equivalent change-tracking mechanism.

Do not create duplicate tables or fields if equivalent structures already exist.

Use a clear distinction between:

- The administrator identity that controls the dashboard.
- The desktop application users created by that administrator.

A desktop application user must never automatically become an administrator.

Do not allow normal desktop users to access administrative operations.

---

### 4. Username Management

Implement secure username handling.

Requirements:

- Username must be unique.
- Define and enforce a consistent normalization policy.
- Avoid duplicate usernames caused by capitalization differences.
- Trim unnecessary whitespace.
- Reject invalid or empty usernames.
- Use database constraints to guarantee uniqueness.
- Prevent users from changing their own username unless explicitly supported by a future approved feature.

The administrator must be able to:

- Create a username.
- Edit an existing username.
- Search by username.
- View the username in the user table.

Changing a username must not break historical transaction records or user identity references.

Use stable user IDs for all database relationships.

---

### 5. Access Code Management

The access code is the secret credential used by the desktop user during login.

The administrator must be able to:

- Set an initial access code when creating an account.
- Change an existing account's access code.
- Reset an access code when necessary.
- Never retrieve or display the previous access code.

#### Security requirements

1. Never store plaintext access codes.
2. Never return access-code hashes to the browser.
3. Never compare access codes in frontend code.
4. Never store access codes in browser local storage.
5. Never log access codes in application logs or audit logs.
6. Never expose access codes through error messages.
7. Never put access codes in URLs or query parameters.

Use a secure password-hashing implementation.

Prefer Argon2id with appropriate parameters, or a suitable bcrypt implementation if the existing Supabase Edge Runtime constraints make Argon2id impractical.

The hashing and verification must happen in a trusted server-side environment.

Do not use a fast unsalted SHA-256 hash as a password-storage solution.

If access codes are short numeric codes, account for their low entropy:

- Enforce sensible minimum length and complexity rules.
- Apply strict rate limiting.
- Apply progressive delays or temporary lockouts.
- Record failed authentication attempts safely.
- Avoid revealing whether a username exists during authentication.
- Prevent brute-force attempts across repeated requests.

Do not invent a weak custom cryptographic scheme.

#### Changing an access code

Whenever an administrator changes a user's access code:

- Generate a new secure credential hash.
- Increment the credential/security version.
- Revoke or invalidate all previously issued sessions through the session architecture.
- Record the event in the audit log without storing the new code.
- Make the change detectable by the desktop application during its next successful online verification.

Do not claim that an offline device can detect an access-code change before reconnecting.

---

### 6. Module Permissions

Implement the two main module permissions.

**Accessories**
- Allows access to the Accessories module only.

**Compu MSS**
- Allows access to the Compu MSS module only.

**Both**
- Allows access to both modules.

The permissions model must support future expansion without requiring a complete redesign.

Use explicit, authoritative permissions in the database.

Do not use a single frontend-only boolean or rely on hidden navigation links as security.

#### Required behavior

| User permission | Accessories | Compu MSS |
|---|---|---|
| Accessories only | Allowed | Denied |
| Compu MSS only | Denied | Allowed |
| Both | Allowed | Allowed |
| Disabled account | Denied | Denied |

The server/database must enforce relevant authorization rules wherever cloud data or privileged operations are accessed.

The desktop application will receive and enforce these permissions in Phase 3.

Do not modify all desktop pages in this phase.

#### Permission changes

When the administrator changes module permissions:

- Persist the new permissions.
- Increment the permission version.
- Record the change in the audit log.
- Make the change detectable by the desktop application.
- Ensure that future authentication checks return the latest permissions.

Do not silently retain outdated permissions after a successful online revalidation.

---

### 7. Store and Warehouse Memberships

Connect users to the existing Stores & Warehouses model created in Phase 1.

Requirements:

- A user may be associated with one or more authorized stores/warehouses if the architecture supports it.
- Do not bind inventory directly to the user account.
- Do not create duplicate warehouse records.
- Do not delete historical membership relationships that are referenced by historical transactions.
- Preserve stable IDs.

The administrator should be able to:

- Assign a user to a store or warehouse.
- Change the user's assigned store or warehouses.
- Remove access to a store/warehouse.
- View the user's current assignments.

The actual enforcement of warehouse-level access must be implemented wherever applicable in the cloud authorization layer.

Do not accidentally grant a user access to all warehouses because a membership record is missing or because a frontend filter was omitted.

If a user has no valid warehouse assignment, handle that state explicitly and securely.

Do not implement warehouse merging or inventory transfers in this phase.

---

### 8. Users Management UI

Complete the Users Management interface.

The main users table should display:

- Display name.
- Username.
- Account status.
- Allowed modules.
- Assigned store/warehouse.
- Creation date.
- Last login where available.
- Available actions.

Add:

- Search.
- Status filters.
- Module filters.
- Store/warehouse filters.
- Clear empty states.
- Loading states.
- Error states.
- Confirmation dialogs for sensitive actions.

#### Create User Modal

The administrator should be able to enter:

- Display name.
- Username.
- Initial access code.
- Confirm access code.
- Module permissions.
- Store/warehouse assignment.
- Initial account status.

Validate everything before submitting.

The access code and confirmation fields must never be persisted in frontend storage or retained unnecessarily after the operation.

After successful creation:

- Clear the sensitive input fields.
- Show a clear success message.
- Refresh the users list.
- Record the administrative event.

#### Edit User Modal

Allow editing:

- Display name.
- Username.
- Module permissions.
- Store/warehouse assignments.
- Account status.

Do not display the existing access code.

Provide a separate Change Access Code action.

#### Change Access Code Modal

Require:

- New access code.
- Confirm new access code.

Do not request or display the old code.

After successful change:

- Clear both fields.
- Show confirmation.
- Explain that existing sessions will need revalidation.
- Record the event safely.

#### Disable User

When disabling an account:

- Show a confirmation dialog.
- Explain that the account will no longer be allowed to authenticate.
- Update the authoritative account status.
- Increment the relevant security/version value.
- Revoke sessions where supported.
- Record the action.

Do not delete the account.

Allow administrators to reactivate an account later.

---

### 9. Administrative API and Server-Side Operations

All sensitive account-management operations must be executed through trusted server-side operations.

Use the existing Phase 1 architecture where possible.

Suitable operations may include:

- Creating a desktop user.
- Updating a user.
- Changing an access code.
- Disabling/reactivating an account.
- Updating module permissions.
- Updating warehouse memberships.
- Revoking user sessions.

Use Supabase Edge Functions or another compatible secure serverless mechanism when required.

For every privileged operation:

1. Authenticate the administrator.
2. Verify administrative privileges server-side.
3. Validate all input server-side.
4. Apply the requested operation atomically where possible.
5. Record the audit event.
6. Return only safe, necessary information.

Never trust an admin flag or role supplied by the frontend.

Never allow a normal desktop user's credentials to invoke administrative operations.

Do not expose service-role credentials to the browser.

If a server-side operation requires elevated database access, isolate it inside the trusted server-side function and validate the caller before performing the operation.

---

### 10. Session and Revocation Foundation

Phase 3 will implement the actual Tauri desktop authentication and session lifecycle.

In this phase, establish the necessary backend foundations.

The account system must support:

- Active/disabled status checks.
- Credential version checks.
- Permission version checks.
- Session revocation or equivalent invalidation.
- Last successful authentication tracking.
- A way to identify whether an existing session is still valid.

A successful online authentication in Phase 3 must be able to retrieve:

- Stable user ID.
- Current account status.
- Current module permissions.
- Current authorized store/warehouse memberships.
- Credential/security version.
- Permission version.
- Session validity information.

Do not expose password hashes or other secret credential material in these responses.

If a session table or revocation mechanism is needed, implement it with appropriate expiry and security protections.

Do not implement the desktop's local secure session storage yet.

---

### 11. Audit Log Integration

Extend the Phase 1 audit log to record all important user-management events.

At minimum:

- User created.
- Username changed.
- Display name changed.
- Access code changed.
- Account disabled.
- Account reactivated.
- Module permissions changed.
- Store/warehouse access assigned.
- Store/warehouse access removed.
- Session revoked, where applicable.

Each event should identify:

- Administrator who performed the operation.
- Target user.
- Event type.
- Timestamp.
- Relevant before/after metadata when safe.

Never include:
- Plaintext access codes.
- Credential hashes.
- Access tokens.
- Refresh tokens.
- Service-role keys.

Ensure that ordinary desktop users cannot read or modify administrative audit logs.

---

### 12. Database and Migration Safety

Inspect the existing Phase 1 schema before making changes.

Reuse its existing tables, relationships, and policies.

Do not create duplicate user, permission, store, or audit tables.

If database changes are needed:

- Use foreign keys.
- Use suitable indexes.
- Enforce username uniqueness at database level.
- Use safe constraints.
- Preserve existing data.
- Preserve historical records.
- Avoid destructive schema changes.
- Maintain RLS.
- Verify that policies do not accidentally grant broad access.

**Mandatory deliverable:**

Create one complete, consolidated SQL migration file for all Phase 2 database changes.

It must include every required change in one ordered file, including any relevant:

- Tables.
- Columns.
- Constraints.
- Indexes.
- Functions.
- Triggers.
- RLS policies.
- Session/revocation structures.

The migration must be reviewed against the actual Phase 1 schema.

Provide the exact file path.

Test its syntax and dependencies as far as the available environment permits.

Do not claim it has been executed in Supabase unless it actually has been executed and verified.

Do not split the required Phase 2 migration into multiple files that I must execute separately.

---

### 13. Testing Requirements

Implement and run meaningful tests.

At minimum, verify:

#### User Management
- Create user successfully.
- Reject duplicate usernames.
- Reject invalid inputs.
- Edit user successfully.
- Disable user.
- Reactivate user.
- Preserve user ID and historical references.

#### Access Code Security
- Access code is hashed securely.
- Plaintext code is never returned.
- Credential hash is never returned to the frontend.
- Incorrect codes cannot authenticate.
- Changing the code invalidates previous sessions through the revocation/version mechanism.
- Rate limiting prevents repeated brute-force attempts.
- Error messages do not reveal sensitive account information.

#### Permissions
- Accessories-only user receives Accessories permission only.
- Compu MSS-only user receives Compu MSS permission only.
- Both-modules user receives both.
- Disabled user receives no active access.
- Permission changes increment the correct version.
- Unauthorized operations are rejected server-side.

#### Store/Warehouse Access
- Assign membership.
- Change membership.
- Remove membership.
- Prevent unauthorized warehouse access.
- Preserve historical relationships.

#### Audit Log
- All required administrative events are recorded.
- Sensitive credentials never appear in audit metadata.
- Unauthorized users cannot access audit records.

#### Regression
- Existing Admin Dashboard functionality still works.
- Existing Tauri desktop application still builds.
- Existing SQLite data is preserved.
- Existing Compu MSS synchronization and Outbox behavior remain intact.
- Accessories business logic remains unchanged.

Run:
- TypeScript checks.
- Lint.
- Unit tests.
- Relevant integration tests.
- Production build.

Do not hide or ignore failed checks.

---

### 14. Documentation

Update:

`admin-dashboard/README.md`

Document:

- User account model.
- Username normalization policy.
- Access-code hashing method.
- Rate-limiting approach.
- Module permission model.
- Store/warehouse membership model.
- Administrative server-side operations.
- Session and revocation foundations.
- New environment variables, if any.
- Edge Functions and deployment steps.
- Exact SQL migration path.

Document anything that Phase 3 must use without ambiguity.

---

### 15. Phase 2 Completion Criteria

Phase 2 is complete only when:

1. Administrators can create users.
2. Administrators can edit user information.
3. Administrators can set and change access codes securely.
4. Administrators can disable and reactivate users.
5. Module permissions work and persist correctly.
6. Store/warehouse memberships work.
7. Sensitive operations are protected server-side.
8. Access-code hashes are never exposed to clients.
9. Brute-force protections are implemented.
10. Session invalidation/version foundations work.
11. Audit logging captures all relevant changes.
12. One consolidated SQL migration is ready and reviewed.
13. All relevant tests pass.
14. The Admin Dashboard production build succeeds.
15. Existing desktop functionality remains intact.

---

## STRICT PHASE GATE

**STOP AFTER PHASE 2.**

Do not start Phase 3.

Do not implement the Tauri login screen or desktop session storage yet.

Do not implement the offline authorization cache yet.

Do not implement inventory transfers.

After completing Phase 2:

1. Provide a detailed implementation report.
2. List all created and modified files.
3. Provide the exact SQL migration path.
4. List all Edge Functions created or modified.
5. Report the access-code hashing and rate-limiting implementation.
6. Report all tests and build results.
7. Identify any unresolved security issues.
8. Explain the exact backend contract Phase 3 should use for desktop authentication.
9. Stop and wait for my explicit approval before proceeding.

**Do not begin the next phase automatically.**