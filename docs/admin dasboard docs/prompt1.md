# COMPU MSS — ADMIN SYSTEM
## Phase 1: Foundation & Admin Dashboard Architecture

### 1. Project Context

We are extending the existing **Compu MSS System** by building a separate, independent Admin Dashboard.

**Existing repository:**
`https://github.com/AhmedSaber45/MSS-System`

**Local project path:**
`C:\Users\Administrator\Desktop\System`

**Existing desktop application stack:**
- Tauri v2
- React
- TypeScript
- Vite
- SQLite
- Supabase
- Existing Offline-First architecture with local persistence and Outbox synchronization.

The application currently contains two independent business modules:

1. **Accessories**
2. **Compu MSS**

The new Admin Dashboard must manage access to these modules, users, and the organizational structure without mixing their data or business logic.

### 2. Mandatory First Steps

Before changing anything:

1. Read all project instructions and relevant documentation:
   - `AGENTS.md`
   - `rules.md`
   - `goals.md`
   - Any other project-specific instruction files.
2. Inspect the complete repository structure.
3. Inspect the existing Supabase schema, migrations, RLS policies, Edge Functions, and database relationships.
4. Inspect the current authentication and synchronization implementation.
5. Inspect the existing SQLite schema and identify which data belongs to Accessories and which belongs to Compu MSS.
6. Inspect existing store, branch, warehouse, device, and inventory relationships.
7. Review the existing UI design system and follow it where applicable.
8. Read and follow the official Unslop guidelines:
   `https://github.com/heydamir/unslop`

Do not assume that the existing database architecture works in a particular way without verifying the actual implementation.

Create a concise architecture assessment before implementation, documenting:
- What already exists.
- What can safely be reused.
- What needs to be added.
- Any architectural conflicts.
- Any risks to existing data or offline synchronization.

Then proceed with Phase 1 implementation. Do not stop after producing an audit.

---

### 3. Main Objective

Create a completely separate Admin Dashboard inside a new folder at the root of the repository:

`admin-dashboard/`

This dashboard must:

- Be independent from the Tauri desktop application's UI.
- Have its own frontend structure and configuration.
- Be suitable for deployment to Vercel or another serverless hosting platform.
- Connect securely to the existing Supabase project.
- Avoid requiring me to manage a VPS or a permanently running traditional backend server.
- Use Supabase Edge Functions or another suitable serverless mechanism when privileged server-side operations are necessary.
- Never expose privileged credentials in browser code.

The dashboard should be deployable independently without affecting the desktop application.

Do not move or restructure the existing desktop application just to accommodate this dashboard.

### 4. Technology and Architecture Decisions

First inspect the existing project and Supabase setup.

Choose a compatible frontend stack for the new dashboard. Prefer:

- Next.js with TypeScript if it fits the existing repository and deployment requirements.
- Tailwind CSS.
- Lucide icons.
- Supabase client for permitted public/client operations.
- Supabase Edge Functions for privileged operations requiring secure server-side execution.

The Admin Dashboard must not contain a Supabase service-role key in:
- Client-side JavaScript.
- Public environment variables.
- Browser bundles.
- Git-tracked files.

Never use a service-role key as a substitute for proper RLS policies.

If a privileged serverless function is required, keep its secrets exclusively in the secure server-side environment.

Do not introduce an unnecessary backend server, VPS, Docker infrastructure, or paid third-party service.

### 5. Admin Dashboard Design

Create a professional, modern, dark-first dashboard consistent with the existing Compu MSS visual identity.

Preferred design direction:

- Primary blue: `#3c83f6`
- Secondary blue: `#2563eb`
- Main background: `#0b0e14`
- Typography: Inter
- Lucide React icons.
- Clean spacing, restrained borders, readable tables, clear hierarchy.
- Responsive layout for desktop and mobile.
- Professional Arabic-friendly interface, with proper RTL support where Arabic is displayed.

The interface should feel like a real business administration platform, not a generic template.

Create the following main navigation sections:

1. Overview
2. Users Management
3. Stores & Warehouses
4. Inventory Management (initial foundation only)
5. Inventory Transfers (placeholder for a later phase)
6. Activity & Audit Log
7. System Settings

For this phase, implement the functional foundation of the dashboard and the sections that belong to user and organizational management. Do not implement actual device transfers yet.

### 6. Admin Access and Security Foundation

The dashboard is an administrative tool, not a public registration website.

Design a secure administrative access mechanism.

Requirements:

- Only authorized administrators can access the dashboard.
- No public administrator registration.
- No public access to user management or administrative data.
- Enforce authorization on the server/database side, not only through frontend route protection.
- Protect administrative operations with appropriate server-side checks.
- Apply Supabase RLS policies to all relevant tables.
- Prevent anonymous users from reading sensitive administrative information.
- Do not trust frontend-supplied roles, permissions, or user IDs without server-side validation.

Inspect whether the existing Supabase project already has a secure administrative identity mechanism.

Reuse it if appropriate. If not, implement a secure approach that does not compromise the existing desktop application.

Do not assume that a normal Supabase Auth account automatically has administrative privileges.

### 7. Core Data Model

Design the administrative data model around these concepts:

#### A. Organization

The company/organization owning the system.

Initially, the system may operate under one organization: Compu MSS.

The design should avoid unnecessary multi-tenant complexity, but must not prevent future expansion.

#### B. Users

An application user represents a person or shop account that is allowed to use one or more modules.

Required conceptual fields:

- Unique user ID.
- Display name.
- Username.
- Secure access-code credential hash.
- Active/disabled status.
- Assigned module permissions.
- Associated store or warehouse where applicable.
- Created timestamp.
- Updated timestamp.
- Last successful authentication timestamp where available.

Important:

These are not conventional customer accounts and do not require public email/password registration.

The intended desktop login experience will use:

- Username.
- Access code.

The administrator creates these credentials.

The administrator can change the access code at any time.

The access code must never be stored in plaintext.

Use a suitable password-hashing algorithm such as Argon2id or bcrypt through a secure server-side implementation.

Do not implement insecure client-side hashing as the security mechanism.

Include appropriate brute-force protection and rate limiting in the authentication architecture.

Do not expose access-code hashes through dashboard queries or API responses.

#### C. Module Permissions

The system must support these permission combinations:

- Accessories only.
- Compu MSS only.
- Both modules.

Design permissions so that they can be extended in the future.

Do not implement permissions as a frontend-only visibility setting.

The future desktop application must enforce permissions across:
- Navigation.
- Pages.
- Data retrieval.
- Mutations.
- Invoices.
- Reports.
- Exports.
- Other sensitive operations.

Phase 1 must establish the authoritative permission model and expose it safely to authorized administrative operations.

Do not modify all desktop application screens in this phase.

#### D. Stores and Warehouses

A user may be associated with a store, warehouse, or another organizational unit.

The inventory must ultimately belong to a physical store/warehouse, not to a person or user account.

This distinction is essential.

The system must support scenarios such as:

- Mahmoud Masoud operates one shop.
- Ayman operates another shop.
- Mohamed Fahim operates another shop.
- Two or more partners later decide to operate from one shared location.
- A partner leaves.
- A new partner joins.
- A new user account is created for a merged store.

Do not permanently bind inventory ownership to individual users.

Create a flexible store/warehouse model with appropriate status and relationships.

Potential fields:

- ID.
- Name.
- Code or reference.
- Type.
- Address or description (optional).
- Active/disabled status.
- Created timestamp.
- Updated timestamp.

Avoid deleting stores that have historical transactions or inventory relationships.

Use deactivation and preserve historical references.

#### E. User-Store Relationships

Do not assume that every store has exactly one user forever.

Design the relationship so that multiple authorized users can potentially access the same store, subject to permissions.

If the existing system already has a branch/store structure, inspect and reuse it where appropriate instead of creating duplicate concepts.

---

### 8. Users Management Interface

Build a functional Users Management section.

Administrators should be able to:

- View existing users.
- Search users.
- Create a user.
- Edit a user's display name and username.
- Assign module permissions.
- Associate a user with a store or warehouse.
- Change the user's access code.
- Disable a user.
- Reactivate a disabled user.

The create/edit user interface should be clear and straightforward.

When creating a user, the administrator should be able to specify:

- Display name.
- Username.
- Initial access code.
- Allowed modules.
- Associated store/warehouse.
- Account status.

Validation requirements:

- Username must be unique according to the chosen normalization policy.
- Empty or invalid access codes must be rejected.
- Module permissions must be explicit.
- Disabled users must not be allowed to authenticate.
- Changing an access code must invalidate previously issued sessions once the desktop authentication phase is implemented.
- Permission changes must be detectable by future desktop sessions.

Never display an existing access code.

When changing an access code, show an input for the new code only.

Do not create a public registration page.

### 9. Stores & Warehouses Management Interface

Build a functional Stores & Warehouses section.

Administrators should be able to:

- View all stores and warehouses.
- Create a new store/warehouse.
- Edit its basic information.
- Activate or deactivate it.
- Search and filter the list.
- View associated users.

Do not implement inventory transfers or bulk device movement in this phase.

Do not delete historical store records.

### 10. Inventory Management Foundation

Create the initial Inventory Management navigation and a basic administrative overview if the existing schema already exposes reliable inventory information.

However:

- Do not invent inventory records.
- Do not migrate local Accessories data into Supabase.
- Do not alter inventory ownership.
- Do not change the existing Compu MSS stock structure without a documented reason.
- Do not implement device transfer operations in this phase.

If reliable inventory data is not yet available through the existing architecture, create a clearly identified foundation/placeholder and document the missing dependency for Phase 5.

### 11. Audit Log Foundation

Create an administrative audit log foundation.

Record important administrative events such as:

- User created.
- User details changed.
- Access code changed.
- User disabled or reactivated.
- Module permissions changed.
- Store/warehouse created.
- Store/warehouse updated.
- Store/warehouse deactivated.
- Administrative settings changed.

Each event should contain, where appropriate:

- Event ID.
- Actor/admin ID.
- Event type.
- Target entity type.
- Target entity ID.
- Timestamp.
- Relevant non-sensitive metadata.

Never log:
- Plaintext access codes.
- Passwords.
- Authentication tokens.
- Service-role credentials.
- Sensitive secrets.

Audit logs must be protected against unauthorized modification or deletion.

### 12. Existing Accessories Data — Critical Restriction

The current Accessories module may rely on local SQLite persistence.

Do not assume its data is already available in Supabase.

During this phase:

1. Identify the current Accessories data storage.
2. Identify whether any Accessories information is already synchronized to Supabase.
3. Document what would be required for future centralized multi-user access.
4. Do not upload or migrate local Accessories data.
5. Do not modify Accessories business logic.
6. Do not change its existing database schema unless strictly necessary for a clearly documented Phase 1 dependency.

The eventual module permissions must protect Accessories independently from Compu MSS.

Do not accidentally expose Accessories data to Compu MSS-only users or vice versa.

### 13. Existing Offline-First Architecture — Critical Restriction

The Compu MSS desktop application currently supports working with locally cached information when internet connectivity is unavailable, followed by automatic synchronization when connectivity returns.

This behavior is essential and must remain intact.

In Phase 1:

- Do not replace the existing Outbox architecture.
- Do not modify synchronization behavior unnecessarily.
- Do not delete or reset local SQLite databases.
- Do not clear pending Outbox operations.
- Do not introduce a requirement that the desktop application must be online for every operation.
- Do not change existing conflict-resolution behavior.
- Do not make cloud permissions dependent on an online-only UI check.

Design the administrative authorization model so Phase 2 can implement locally cached authorization and revalidation.

Document the intended behavior:

- When online, the desktop application obtains authoritative account status and permissions.
- When offline, it can continue under the last successfully validated and locally cached authorization, subject to a carefully designed security policy.
- When connectivity returns, it revalidates the account and permissions.
- If an account is disabled, its access code is changed, or its permissions are revoked, the desktop application must detect that change and invalidate or restrict the session.
- Server-side revocation cannot be detected instantly while the device is disconnected. Do not claim otherwise.

Do not implement the desktop offline session logic in Phase 1.

### 14. Database Migrations and Supabase Requirements

If database changes are needed:

- Inspect the current schema first.
- Reuse existing tables and relationships whenever appropriate.
- Avoid duplicate tables for concepts that already exist.
- Preserve all existing data.
- Preserve existing RLS behavior unless a verified security improvement requires a change.
- Do not disable RLS as a workaround.
- Do not expose sensitive tables to anonymous access.
- Use appropriate indexes, constraints, foreign keys, and uniqueness rules.
- Make migrations safe and repeatable where possible.

**Mandatory migration deliverable:**

Create one complete, consolidated, safe SQL migration file containing all database changes required by Phase 1.

The file must:
- Include all required table, column, index, constraint, function, trigger, and RLS policy changes.
- Be ordered correctly.
- Avoid destructive operations.
- Be reviewed for compatibility with the current schema.
- Be checked for syntax and dependency issues as far as possible.
- Be ready to execute in the Supabase SQL Editor in one go.

Provide the exact file path.

Do not claim the migration has been executed in Supabase unless it actually has been executed and verified.

If the existing project already has migration conventions, follow them and identify the single consolidated SQL file clearly.

### 15. Deployment Preparation

Prepare the Admin Dashboard for independent deployment to Vercel.

Requirements:

- Separate build configuration where needed.
- Correct environment variable documentation.
- Secure environment variable handling.
- No hardcoded secrets.
- No dependency on the Tauri desktop runtime.
- No requirement to run a local backend server permanently.
- Clear setup and deployment instructions.

Create or update:

`admin-dashboard/README.md`

Document:
- Local development setup.
- Required environment variables.
- Supabase configuration.
- Secure deployment steps.
- How to apply the consolidated SQL migration.
- Any required Edge Function deployment steps.
- What remains intentionally unimplemented until later phases.

Do not deploy anything or modify production configuration without explicit approval.

### 16. Testing and Quality Assurance

Before declaring Phase 1 complete:

Run the relevant checks for both the existing desktop project and the new Admin Dashboard.

At minimum:

- TypeScript checks.
- Lint.
- Production build.
- Relevant unit/integration tests.
- Database migration review.
- RLS policy review.
- Authorization tests.
- Input validation tests.
- User creation/editing/disable flows.
- Store/warehouse CRUD tests.
- Audit event tests.
- Tests ensuring access-code hashes are never returned to the client.
- Tests ensuring unauthorized users cannot perform administrative operations.

Also verify that the existing desktop project still builds and that its existing core functionality has not been broken by Phase 1 changes.

Do not silently skip failing checks.

If a check cannot be run, explain why.

### 17. Scope Restrictions — Do Not Implement Yet

The following are explicitly reserved for later phases:

- Tauri desktop login screen.
- Desktop session persistence.
- Desktop authorization enforcement across all pages.
- Automatic logout after remote account or permission changes.
- Offline authorization cache implementation.
- Changes to desktop authentication flow.
- Device inventory transfers.
- Individual device transfer.
- Bulk selected-device transfer.
- Transfer all eligible stock.
- Transfer history and detailed transfer workflows.
- Partner/store merging workflows.
- Advanced inventory synchronization changes.

You may prepare compatible database foundations where necessary, but do not implement these features now.

Do not redesign unrelated parts of the desktop application.

Do not add unrelated features.

### 18. Phase 1 Completion Criteria

Phase 1 is complete only when:

1. The independent `admin-dashboard/` project exists.
2. The dashboard runs locally.
3. Its production build succeeds.
4. Secure administrative access is implemented.
5. Users Management works.
6. Module permission assignments are persisted securely.
7. Stores & Warehouses management works.
8. Audit logging foundation works.
9. The database migration file is complete and reviewed.
10. RLS and authorization protections are verified.
11. Existing Accessories and Compu MSS functionality remains intact.
12. No existing local data or pending synchronization operations were lost.
13. Deployment documentation is complete.

### 19. Final Report

When finished, provide a detailed but concise report containing:

1. Architecture assessment and decisions.
2. New files and folders created.
3. Existing files modified.
4. Database tables and policies added or changed.
5. Exact path of the consolidated SQL migration.
6. Edge Functions created, if any.
7. Admin Dashboard features implemented.
8. Security measures implemented.
9. Tests executed and their results.
10. Build results.
11. Any unresolved issues or limitations.
12. Exact instructions for running the dashboard locally.
13. What must be reviewed or approved before Phase 2.

Clearly distinguish between:
- Implemented and tested.
- Implemented but not fully verified.
- Prepared for a later phase.
- Not implemented.

---

## STRICT PHASE GATE

**STOP AFTER PHASE 1.**

Do not start Phase 2 or implement any functionality reserved for later phases.

Do not interpret this document as authorization to complete the entire project.

After Phase 1 is complete:

- Stop all implementation work.
- Provide the final report.
- List any decisions that require my approval.
- Leave the repository in a clean, buildable state.
- Wait for my explicit instruction before proceeding to Phase 2.

I will review the implementation and approve the next phase separately.

