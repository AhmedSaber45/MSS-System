# RULE.md — MANDATORY PRODUCTION DATA PROTECTION POLICY

**STATUS: ABSOLUTELY MANDATORY — NO EXCEPTIONS**

These rules apply to EVERY developer, AI agent, automation, script, test runner, and tool operating on this repository.

---

### RULE 1 — NEVER CREATE TEST DATA IN PRODUCTION

It is strictly forbidden to create, insert, seed, generate, or write any of the following into real production databases:

- Fake data.
- Mock data.
- Demo data.
- Test records.
- Sample business records.
- Temporary testing records.
- Automatically generated business records.

This prohibition applies to both:

- Production Supabase databases.
- The user's real local SQLite databases.

---

### RULE 2 — NEVER MODIFY PRODUCTION DATA DURING TESTING

Never execute testing operations that can modify real business data.

Forbidden operations include:

- INSERT.
- UPDATE.
- DELETE.
- UPSERT.
- TRUNCATE.
- DROP.
- Database resets.
- Seed scripts.
- Test cleanup operations.
- Any indirect operation that creates, modifies, or deletes production records.

This applies to automated tests, E2E tests, browser automation, UI testing, scripts, migrations, development utilities, and manual testing.

---

### RULE 3 — MANDATORY TEST ISOLATION

All tests MUST use isolated environments, such as:

- Mocked API responses.
- Mocked Supabase clients.
- Temporary SQLite databases.
- In-memory databases.
- Dedicated disposable test environments.
- Explicitly verified non-production credentials and endpoints.

Never assume that a database is isolated just because a test is named `test`, `mock`, or `development`.

---

### RULE 4 — VERIFY DATABASE TARGET BEFORE EXECUTION

Before executing any test, script, migration, setup routine, or automation that could interact with a database:

1. Inspect the environment variables and configuration.
2. Identify the actual database endpoint and credentials being used.
3. Verify that the target is NOT production.
4. Verify that the database is isolated and disposable.
5. Verify that no production credentials or production database URLs are being used.

If isolation cannot be proven with certainty:

**DO NOT EXECUTE THE OPERATION.**

Use static analysis, mocked tests, or other safe verification methods instead.

---

### RULE 5 — NEVER CLEAN UP TEST DATA FROM PRODUCTION

Never use production deletion as a testing cleanup strategy.

Do not delete records simply because they appear to be test records.

This includes, without limitation:

- Invoices.
- Devices.
- Laptop models.
- Sales.
- Reservations.
- Expenses.
- Customers.
- Suppliers.
- Inventory records.
- Stock movements.
- Transfers.
- Pending offline operations.
- Any other business records.

Never assume that a record is fake based on its name, date, or contents.

---

### RULE 6 — PRESERVE ALL EXISTING BUSINESS DATA

The user's real business data is critical.

Preserve all existing records and relationships.

Never reset, truncate, recreate, or clean production databases as part of development, testing, debugging, or deployment.

Never discard pending MSS Outbox operations or unsynchronized offline data.

---

### RULE 7 — STOP IMMEDIATELY IF AN ACCIDENTAL PRODUCTION WRITE IS SUSPECTED

If an operation unexpectedly connects to production or accidentally writes to a production database:

1. Stop the current operation immediately.
2. Do not attempt automated cleanup.
3. Do not delete or modify any records to reverse the operation.
4. Preserve logs and available evidence.
5. Report exactly what happened.
6. Identify the affected database and operation if known.
7. Wait for explicit instructions from the user.

---

### RULE 8 — UI-ONLY TASKS ARE NOT EXEMPT

These rules apply even when the requested task appears to be:

- CSS or styling changes.
- React component changes.
- Frontend-only changes.
- UI improvements.
- Promotional image changes.
- Form changes.
- Table changes.
- Refactoring.
- Build operations.
- Release preparation.
- Performance optimization.

Do not run unnecessary database-connected tests for UI-only tasks.

---

### RULE 9 — DATABASE MIGRATIONS REQUIRE EXTRA CARE

Never apply a migration to production automatically during development or testing.

Inspect migration scripts and identify their effects before execution.

Use an isolated non-production database for migration testing.

Never reset or recreate the user's production database.

---

### RULE 10 — REPORT ACTUAL VERIFICATION

At the end of every task, report:

- Whether database-connected tests were executed.
- Which database environment was used.
- Whether production credentials were accessed.
- Whether any production write operation occurred.
- Whether test isolation was verified.
- Any tests skipped because isolation could not be guaranteed.

Never claim that production data was protected through verification unless the relevant checks were actually performed.
