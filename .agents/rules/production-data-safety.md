---
trigger: always_on
---

# Mandatory Production Data Protection Policy (`RULE.md`)

**STATUS: ABSOLUTELY MANDATORY — NO EXCEPTIONS**

1. **Read [`RULE.md`](../../RULE.md) before starting EVERY task** in this repository.
2. Treat `RULE.md` as **mandatory, not advisory**, across all code changes, tests, builds, scripts, migrations, and releases (including UI-only tasks).
3. **Never bypass `RULE.md` for convenience.** Never insert, seed, update, delete, truncate, or clean up test/demo data in production Supabase databases or the user's real local SQLite databases.
4. **Always verify database target and test isolation before execution.** If isolation cannot be proven with certainty, **STOP** and do not execute the operation; use mocked tests or static analysis instead.
5. **If an accidental production write is suspected**, stop immediately, preserve logs/evidence, do NOT run automated cleanup, and report to the user.
6. **At the end of every task**, report whether database-connected tests were executed, which database environment was used, whether production credentials were accessed, whether any production write occurred, and whether test isolation was verified.
