# Permanent Development Rules

These rules are mandatory for every phase of the project. They must be followed alongside `goals.md` and `specifications.md`.

## 1. Mandatory Reading Before Every Phase

Before starting any implementation phase, you MUST:

1. Read the complete `rules.md`.
2. Read the complete `goals.md`.
3. Read the complete `specifications.md`.
4. Identify the requirements relevant to the requested phase.
5. Check the existing implementation before making changes.

Never assume that you remember the contents from a previous phase.

## 2. Strict Phase Execution

- Implement ONLY the phase explicitly requested by the user.
- Never start the next phase automatically.
- Never implement future-phase features early.
- Never skip required tasks within the active phase.
- Do not make unrelated changes.
- Do not refactor completed functionality unless necessary for the active phase.
- Preserve all previously completed and verified work.
- Stop immediately after completing the requested phase and wait for the user's review.

## 3. Repository Safety

- Inspect existing files before modifying them.
- Never delete or overwrite existing code without understanding its purpose.
- Avoid unnecessary restructuring.
- Keep the project organized and maintainable.
- Do not introduce unnecessary dependencies.
- Do not create unnecessary documentation files.
- Do not create duplicate implementations of existing functionality.
- Never modify environment secrets or overwrite user configuration without permission.

## 4. Arabic-First User Interface

The entire application interface must be Arabic-first.

- Use proper RTL layout.
- Use clear, natural Arabic labels.
- Use readable Arabic typography.
- Ensure mixed Arabic and English content is displayed correctly.
- Keep serial numbers, barcodes, technical specifications, and identifiers readable.
- Use consistent Arabic terminology throughout the application.
- Do not leave untranslated technical labels in user-facing screens.
- Keep error messages understandable to non-technical users.

## 5. Simplicity & Usability

The application is intended for daily use by shop employees with limited technical knowledge.

- Prioritize simplicity over unnecessary visual complexity.
- Keep common operations fast.
- Use clear navigation and predictable interactions.
- Avoid unnecessary nested menus.
- Use readable forms and tables.
- Group related information logically.
- Make primary actions visually obvious.
- Provide useful empty states.
- Display loading states when necessary.
- Provide clear success and error feedback.
- Prevent accidental repeated submissions.
- Do not disable buttons indefinitely.
- Use confirmation dialogs for destructive or irreversible actions.
- Avoid overcrowded dashboards.
- Maintain a consistent design system.

## 6. Architecture & Separation of Business Data

The application contains two separate business domains:

### Accessories Shop
- Local SQLite database.
- Completely independent from MSS cloud data.
- Must work without internet.
- Must not depend on Supabase for normal operations.

### MSS Business
- Shared business catalog and cloud data.
- Separate physical inventory for each shop.
- Local cached data for offline operation.
- Synchronization with Supabase.

Shared UI components are allowed, but business data and financial operations must remain separated.

Never mix:
- Accessories products with MSS models.
- Accessories inventory with MSS inventory.
- Accessories invoices with MSS invoices.
- Accessories revenue and profit with MSS financial reports.

## 7. Database Integrity

- Use appropriate primary keys and foreign keys.
- Add database constraints for important business rules.
- Use unique constraints where required.
- Validate all important inputs.
- Use database transactions for operations that modify multiple related records.
- Prevent negative or invalid inventory quantities.
- Prevent duplicate invoice submissions.
- Prevent duplicate synchronization operations.
- Preserve finalized financial records.
- Maintain an auditable history of important changes.
- Use database indexes for frequently searched fields.
- Avoid unnecessary schema complexity.

Never rely exclusively on frontend validation for business-critical operations.

## 8. Financial Accuracy

Financial calculations must be accurate and traceable.

- Use a precise monetary representation.
- Avoid floating-point arithmetic for financial values.
- Preserve the original list price at transaction time.
- Record discounts explicitly.
- Record the actual selling price.
- Preserve the purchase cost snapshot at the time of sale.
- Calculate gross profit from actual sale value minus the recorded cost.
- Handle returns and cancellations through traceable reversal records.
- Never rewrite historical transaction prices when product prices change.
- Never assume a profit-sharing percentage for MSS.
- Never treat branch sales attribution as individual ownership of MSS profit.

## 9. MSS Inventory & Sales Rules

Always distinguish between:

- Product catalog model.
- Individual physical device.
- Physical stock location.
- Selling branch.
- Stock-source branch.
- Reservation status.
- Sale status.

Every individual laptop or monitor must have a unique serial number.

When a branch sells a device physically stored at the other branch:
- Attribute the sale to the branch that executed the sale.
- Deduct the device from its actual stock location.
- Record both branches separately.
- Do not require a physical transfer record unless the device was actually transferred.

A combined inventory total is for visibility only. It must not hide each shop's actual stock quantity.

## 10. Offline Operation & Synchronization

- The accessories section must remain fully functional without internet.
- MSS must support its approved offline workflows.
- Every synchronized business operation must have a stable UUID.
- Synchronization must be idempotent.
- Pending operations must remain safely stored.
- Retry failed synchronization attempts safely.
- Never silently discard conflicting operations.
- Never report a pending operation as synchronized.
- Make synchronization state visible to the user.
- Handle stale stock information carefully.

Do not promise guaranteed prevention of double-selling the same unit while both shops are disconnected.

When conflicts are detected:
- Preserve the original operation.
- Clearly explain the conflict.
- Provide a safe review or resolution workflow.
- Never silently overwrite another transaction.

## 11. Supabase Security

- Never expose the Supabase service-role key in frontend code.
- Never commit secrets.
- Apply appropriate Row Level Security policies.
- Validate sensitive operations through trusted logic.
- Do not trust client-supplied prices, costs, stock quantities, or permissions.
- Use secure database functions or trusted server-side operations where required.
- Do not assume that hiding an interface control provides security.

No-login operation is a user-experience requirement, not a reason to ignore database security.

## 12. SQL Migration Requirements

Whenever a phase requires Supabase schema or policy changes:

1. Create ONE complete, consolidated SQL migration file for the phase.
2. Include every required change in that file.
3. Review all operations for destructive effects.
4. Include required constraints, indexes, policies, and functions.
5. Verify consistency with the expected existing schema.
6. Check for duplicate object creation and migration-order problems.
7. Clearly identify the exact file path.
8. Explain what the user needs to execute manually in Supabase SQL Editor.

Never split one phase's required database migration into multiple incomplete SQL snippets unless technically unavoidable.

Never claim that the migration was executed. Only the user can execute it in their Supabase project.

## 13. Local Data Protection

- Store SQLite databases outside the application installation directory.
- Application updates must never overwrite business data.
- Avoid destructive database migrations.
- Backups must be validated.
- Restores must be handled carefully.
- Clearly warn the user before replacing existing data.
- Support external backup copies.
- Do not claim that a separate partition is a substitute for external backups.

## 14. Automatic Updates

- Use signed update packages.
- Keep private signing keys outside public repositories.
- Handle offline update checks gracefully.
- Do not force updates when the internet is unavailable.
- Preserve local data during updates.
- Verify database compatibility before migrations.
- Back up important data before risky migrations.
- Report update failures clearly.

## 15. Code Quality

- Use TypeScript safely.
- Avoid unnecessary `any`.
- Keep components focused.
- Separate UI from business logic and data access.
- Avoid duplicated business rules.
- Use clear naming.
- Handle errors explicitly.
- Never silently swallow errors.
- Avoid unnecessary abstractions.
- Use dependencies only when they provide clear value.
- Keep the project buildable after each phase.

## 16. Testing & Verification

At the end of each phase:

- Run relevant tests.
- Run TypeScript checks.
- Run linting.
- Run the production build when applicable.
- Fix issues introduced by the current phase.
- Verify important workflows manually when automated tests are insufficient.

Clearly distinguish:
- Implemented and tested.
- Implemented but not fully tested.
- UI-only placeholder.
- Not implemented.
- Blocked by an external action.

Never claim success without actual verification.

## 17. Phase Completion Report

After finishing the requested phase, provide a concise report containing:

1. What was implemented.
2. Important technical decisions.
3. Files created or modified.
4. Tests actually executed and their results.
5. Known issues and limitations.
6. Manual actions required from the user.
7. Whether the phase is ready for review.

Do not generate a separate report document.

**IMPORTANT: Stop after the requested phase. Do not begin another phase unless the user explicitly instructs you to do so.**