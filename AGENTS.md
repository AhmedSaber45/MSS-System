# AGENTS.md — AS System Repository Instructions

## MANDATORY: Read and Obey `RULE.md` Before Every Task

**Every AI agent, developer, automation, script, and test runner operating on this repository MUST read and strictly obey [`RULE.md`](RULE.md) BEFORE starting any task.**

- **Authoritative Policy**: [`RULE.md`](RULE.md) is the permanent, mandatory Production Data Protection Policy for AS System. It is **mandatory, not advisory**.
- **Full Scope**: It applies to ALL code changes, tests, builds, scripts, migrations, browser automations, and releases — including UI-only, styling, promotional image, and refactoring tasks.
- **Zero Exceptions**: Never bypass `RULE.md` for convenience. Never create, seed, modify, or delete records in production Supabase databases or the user's real local SQLite databases.
- **Strict Isolation Gate**: Before running any test, script, or migration that could interact with a database, verify the target endpoint, credentials, and isolation. If isolation cannot be proven with certainty, **STOP** and do not execute the risky operation.
- **End-of-Task Reporting**: Always report actual database/test isolation verification as required by `RULE.md` (Rule 10).
