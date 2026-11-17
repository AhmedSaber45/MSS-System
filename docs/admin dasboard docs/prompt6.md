# PHASE 6 — FINAL SECURITY AUDIT, INTEGRATION, DEPLOYMENT & END-TO-END VERIFICATION

## 1. Mission & Execution Rules

Perform the final comprehensive audit, integration, hardening, and verification of the entire Admin Dashboard and Compu MSS desktop authentication/authorization ecosystem implemented across Phases 1–5.

This is an implementation phase, not a report-only review.

You must:
- Inspect the complete repository and all implementation work from Phases 1–5.
- Read `AGENTS.md`, `rules.md`, `goals.md`, and all relevant project documentation.
- Inspect current Git status and preserve all valid existing changes.
- Identify incomplete, inconsistent, or incorrectly implemented requirements.
- Fix confirmed critical and high-severity issues.
- Fix medium-severity issues when safely possible without introducing regressions.
- Run actual tests and builds instead of assuming that code works.
- Never claim that a security issue is fixed without verifying the fix.

Do not blindly rewrite working code or redesign unrelated application sections.

The objective is to make the system production-ready to the greatest extent verifiable, without making unrealistic claims that any application is completely unhackable.

---

## 2. Complete Architecture Integration Audit

Verify that all components work together correctly:

1. Independent `admin-dashboard/` application.
2. Supabase database and RLS policies.
3. Supabase Edge Functions or other approved server-side operations.
4. Admin authentication and bootstrap process.
5. Desktop username/access-code authentication.
6. Secure local desktop session storage.
7. Module-level permissions.
8. Stores and warehouses management.
9. User-to-warehouse memberships.
10. Inventory management.
11. Inventory transfer operations.
12. Audit logs.
13. Desktop offline-first functionality.
14. Existing Outbox synchronization and conflict resolution.

Verify that all identifiers, relationships, authorization rules, and API contracts are consistent across these components.

Do not introduce a second source of truth for data already managed by the existing architecture.

---

## 3. Comprehensive Security Audit

Conduct a threat-model-driven security audit of the complete system.

### A. Authentication & Session Security

Verify:
- Admin authentication cannot be bypassed.
- Desktop access codes are verified server-side.
- Password/access-code hashes never reach the client.
- No plaintext credentials are stored locally or remotely.
- Session tokens are sufficiently protected.
- Session expiration and revocation work correctly.
- Credential changes invalidate previous sessions.
- Disabled accounts cannot authenticate.
- Permission changes are enforced after revalidation.
- Brute-force protection and rate limiting are effective.
- Login errors do not reveal sensitive account information.

### B. Authorization & Privilege Escalation

Test:
- Normal desktop users cannot access admin functionality.
- Desktop users cannot create or modify other users.
- Users cannot grant themselves additional permissions.
- Accessories-only users cannot access Compu MSS data.
- Compu MSS-only users cannot access Accessories functionality.
- Users cannot access warehouses outside their assigned permissions.
- Users cannot execute unauthorized inventory transfers.
- IDs and request parameters cannot be manipulated to access another user's data.

Check every relevant server-side operation, not just frontend navigation.

### C. Supabase & Database Security

Review every relevant table, function, trigger, and policy.

Verify:
- RLS is enabled wherever required.
- Policies follow least-privilege principles.
- No overly permissive `USING (true)` or `WITH CHECK (true)` policies exist without a justified public-use case.
- SECURITY DEFINER functions have safe `search_path` settings.
- Function execution privileges are restricted appropriately.
- Sensitive tables cannot be modified through unauthorized direct client requests.
- Admin-only operations cannot be invoked by ordinary authenticated users.
- Database constraints protect critical business invariants.
- Historical records are not accidentally deleted or rewritten.
- Audit records cannot be modified by ordinary users.

Pay special attention to policies that may appear secure but can be bypassed through alternative API operations.

### D. Secrets & Configuration

Search the entire repository and Git history where practical for:
- Supabase service-role keys.
- Private API keys.
- Access codes.
- Hardcoded credentials.
- Exposed tokens.
- Sensitive environment variables.

Ensure:
- No service-role key is bundled into the browser application.
- No service-role key is embedded in the Tauri desktop application.
- No secrets are exposed through public Vercel environment variables.
- `.env` files and build artifacts are handled correctly.
- Example environment files contain placeholders only.
- Logs and error messages never expose credentials or session tokens.

If a secret has previously been committed, report the exposure and provide the required rotation steps. Removing it from the latest source code alone does not invalidate an exposed secret.

### E. Application & API Security

Inspect relevant components for:
- SQL injection.
- Cross-site scripting (XSS).
- CSRF where applicable.
- Open redirects.
- IDOR.
- Insecure direct object access.
- Unsafe file uploads.
- Input-validation bypasses.
- CORS misconfiguration.
- Missing security headers.
- Insecure token handling.
- Information disclosure.
- Improper error handling.
- Race conditions and duplicate operations.

Review Content Security Policy and other security headers for compatibility with the actual application.

Review dependency vulnerabilities and remove or update unsafe dependencies only when compatibility can be preserved.

### F. Offline Security

Verify:
- Cached permissions are handled according to the agreed offline policy.
- The seven-day authorization validity limit is enforced.
- The system does not treat a network failure as proof that an account is disabled.
- Expired authorization does not delete business data.
- Pending Outbox operations are preserved.
- Pending operations cannot silently switch to another user's identity.
- Reconnection refreshes authorization and permissions.
- Revoked or changed credentials are detected after reconnection.
- Stale permissions cannot authorize new cloud operations indefinitely.

Document the unavoidable limitation that a device disconnected from the internet cannot instantly know that an administrator revoked access.

---

## 4. Inventory & Transfer Integrity Verification

Perform an end-to-end audit of all inventory and warehouse operations.

Verify:
- Every inventory item belongs to the correct warehouse/location.
- A serialized device cannot exist in two active warehouse locations simultaneously.
- Transfers are atomic.
- Duplicate transfer requests are safely handled.
- Idempotency protections work.
- Concurrent transfers cannot create inconsistent inventory.
- Sold, reserved, damaged, and otherwise ineligible devices cannot be transferred through unauthorized paths.
- Purchase cost and original acquisition information remain unchanged.
- Device serial numbers and identifiers remain unchanged.
- Historical sales, movements, reservations, and seller references remain intact.
- Transfers do not create fake sales, purchases, revenue, or profit.
- Store merges do not silently transfer inventory.
- Inventory balances remain correct before and after transfers.

Test both successful and failed transactions.

A failed transfer must not leave partially updated inventory.

---

## 5. Accessories & Compu MSS Isolation Audit

This is a critical requirement.

Verify that Accessories and Compu MSS remain independent business modules.

### Accessories
- Existing local SQLite data remains intact.
- Existing Accessories workflows continue working.
- Existing products, sales, purchases, invoices, returns, reports, and backups are unaffected.
- Module authorization is enforced without requiring migration of Accessories business data to Supabase.
- No Compu MSS inventory operation modifies Accessories records.

### Compu MSS
- Existing Supabase integration continues working.
- Offline-first functionality remains intact.
- Outbox operations and synchronization continue working.
- Warehouse and transfer changes do not break existing sales or reservations.
- Module authorization is enforced throughout the application.

Test all four permission combinations:
1. Accessories only.
2. Compu MSS only.
3. Both modules.
4. Disabled account / no valid access.

Do not assume hiding a module in the sidebar is sufficient authorization.

---

## 6. Audit Log & Administrative Traceability

Verify that important administrative operations produce reliable audit records, including:

- User creation.
- User deactivation/reactivation.
- Access-code changes.
- Permission changes.
- Warehouse creation and modification.
- Membership changes.
- Warehouse merges.
- Inventory transfers.
- Failed or rejected privileged operations where appropriate.

Each record should contain appropriate information such as:
- Actor ID.
- Action.
- Target entity.
- Timestamp.
- Relevant metadata.
- Success/failure status where applicable.

Ensure sensitive values such as plaintext access codes and session tokens are never logged.

Verify that normal users cannot alter or delete administrative audit records.

---

## 7. End-to-End Testing

Run real automated tests covering complete user workflows.

### Admin Dashboard

Test:
- Admin login.
- User creation.
- Username validation.
- Access-code creation and changes.
- Account activation/deactivation.
- Module permission assignment.
- Warehouse creation and editing.
- Membership assignment.
- Warehouse merge preview and execution.
- Inventory inspection.
- Individual device transfer.
- Multiple-device transfer.
- Eligible inventory transfer.
- Transfer history.
- Audit log visibility.
- Unauthorized access attempts.

### Desktop Application

Test:
- First-launch login.
- Invalid credentials.
- Successful authentication.
- Automatic login after restart.
- Logout.
- Session invalidation after code changes.
- Session invalidation after account deactivation.
- Permission changes.
- Accessories-only access.
- Compu MSS-only access.
- Both-module access.
- Offline startup.
- Offline operation within the authorization validity period.
- Authorization expiry.
- Reconnection and permission refresh.
- Pending Outbox synchronization.
- Conflict handling.
- Preservation of unsynchronized data.

### Failure & Recovery Tests

Simulate:
- Network interruption.
- Supabase temporary unavailability.
- Duplicate requests.
- Concurrent inventory transfers.
- Invalid input.
- Expired sessions.
- Unauthorized API calls.
- Failed synchronization.
- Interrupted application startup.

Confirm that failures do not corrupt existing business data.

---

## 8. Production Readiness & Deployment

Prepare the Admin Dashboard for deployment to Vercel.

Verify:
- Production build succeeds.
- Environment variables are documented.
- Public and private variables are correctly separated.
- Supabase URLs and keys are configured safely.
- Authentication callbacks and allowed origins are correct.
- CORS and security headers are appropriate.
- No localhost-only configuration remains in production paths.
- No debug mode or development-only authentication bypass remains.
- Deployment does not expose privileged operations.

Prepare clear deployment documentation covering:

1. Required Supabase configuration.
2. Required environment variables.
3. Applying the approved SQL migration, if one is needed.
4. Deploying Supabase Edge Functions.
5. Creating or securing the initial admin account.
6. Connecting the Admin Dashboard to Vercel.
7. Configuring the production domain.
8. Verifying production authentication and permissions.
9. Initial backup and recovery recommendations.

Do not deploy to Vercel, execute production migrations, rotate live secrets, or make irreversible production changes without explicit approval.

---

## 9. Documentation & Final Deliverables

Update the project documentation to reflect the actual final implementation.

Provide:

- Final architecture overview.
- Authentication and authorization flow.
- Admin bootstrap instructions.
- Desktop session security explanation.
- Offline authorization policy.
- Module permission matrix.
- Warehouse and inventory relationship explanation.
- Transfer workflow documentation.
- Supabase security configuration.
- Vercel deployment guide.
- Environment variables reference.
- Backup and recovery guidance.
- Known limitations and operational risks.

Include a clear setup guide for a developer who clones the repository for the first time.

If Phase 6 requires database changes, create ONE complete, consolidated, safe SQL migration file ready to execute in Supabase SQL Editor.

For that migration:
- Include the exact file path.
- Ensure it is idempotent where appropriate.
- Validate dependencies and ordering.
- Check for destructive operations.
- Verify compatibility with the existing schema.
- Do not execute it.
- Do not claim that it has been applied.

Avoid unnecessary database changes if the existing schema already satisfies the requirements.

---

## 10. Final Verification & Acceptance Criteria

Before declaring the project ready, run all applicable checks:

- Admin Dashboard production build.
- Admin Dashboard lint.
- Admin Dashboard typecheck.
- Admin Dashboard automated tests.
- Desktop application typecheck.
- Desktop application lint.
- Desktop application tests.
- Desktop application production build.
- Database migration validation where applicable.
- Security regression tests.
- End-to-end workflow tests.

Do not hide failing tests or downgrade test coverage just to achieve a green result.

If any check cannot be run because of missing credentials, unavailable infrastructure, or external configuration, state that explicitly and provide the exact manual verification required.

### Final Report

Provide a detailed final report containing:

1. What was inspected.
2. What was implemented or corrected.
3. Security findings grouped by severity: Critical, High, Medium, Low.
4. Which findings were fixed and how they were verified.
5. Remaining risks and unresolved issues.
6. Test results with actual pass/fail counts.
7. Build and typecheck results.
8. Database migration file path, if created.
9. Required manual Supabase configuration.
10. Required Vercel deployment steps.
11. Any actions that still require my approval.

Use clear evidence, file paths, and test output wherever possible.

Do not report the application as production-ready while unresolved critical or high-severity issues remain.

---

## 11. Final Stop Gate

This is the final phase.

After completing all work:
- Preserve all existing valid project functionality.
- Do not start unrelated enhancements.
- Do not execute production deployment or database migrations without approval.
- Do not proceed with additional phases.
- Stop and wait for my review of the final report.

**The task is complete only when the implementation, verification, documentation, and final report are all finished.**