



## 6. Phase Completion Rules

At the end of every phase:

1. Run the relevant tests.
2. Run TypeScript checks.
3. Run linting.
4. Run the production build when applicable.
5. Fix errors introduced by the current phase.
6. Report exactly what was implemented.
7. List changed and created source files.
8. List tests and their actual results.
9. List remaining issues or limitations.
10. Identify any manual steps required from the user.
11. Update `specifications.md` only if a requirement or confirmed technical decision has changed.

Do not report a test as passed unless it was actually executed.

Do not claim a feature works if it has only been visually implemented.

**STOP after completing the requested phase. Wait for the user to review and explicitly request the next phase.**

---

# FILE 2 — rules.md

# Permanent Development Rules

These rules apply to every phase and every modification.

## 1. Communication

- The user is not required to understand programming details.
- Explain important decisions in clear, simple language.
- The application interface must be Arabic-first and fully RTL.
- Keep technical code identifiers and database naming conventions in English.
- Do not overwhelm the user with unnecessary technical explanations.
- Ask only essential clarification questions.

## 2. Phase Discipline

- Read `rules.md`, `goals.md`, and `specifications.md` before every phase.
- Implement only the explicitly requested phase.
- Never proceed automatically.
- Never expand scope without a strong reason.
- Do not rewrite completed modules unnecessarily.
- Preserve working functionality.
- Inspect existing code before modifying it.

## 3. Simplicity & Usability

- Prioritize usability over visual complexity.
- Use clear Arabic labels.
- Use readable typography.
- Keep important actions obvious.
- Avoid unnecessary nested menus.
- Use confirmation dialogs for destructive or irreversible operations.
- Provide useful empty states and error messages.
- Use loading indicators when operations take time.
- Prevent accidental repeated clicks without making the interface feel unresponsive.
- Do not make every screen crowded with cards and statistics.
- Optimize common workflows for speed.

## 4. Arabic & RTL

- Use RTL consistently across the application.
- Ensure Arabic text is rendered correctly.
- Handle mixed Arabic and English content correctly.
- Keep numbers, serial numbers, barcodes, and technical identifiers readable.
- Make invoices suitable for Arabic printing.
- Avoid layout overflow and misaligned tables.

## 5. Architecture & Data Separation

- Accessories data must remain local and independent.
- MSS data must remain a separate business domain.
- Do not mix their products, inventory, sales, invoices, or financial calculations.
- Shared UI components are allowed.
- Shared business data is not allowed unless explicitly specified.
- Do not introduce a traditional remote application server if the approved architecture can safely use Tauri and Supabase.

## 6. Database Integrity

- Use database constraints for critical business rules.
- Use transactions for operations involving multiple related records.
- Never trust frontend calculations for financial or inventory-critical operations.
- Validate all input on the trusted side.
- Prevent duplicate invoice submissions.
- Prevent duplicate synchronization.
- Use immutable financial snapshots for finalized sales.
- Never silently delete finalized financial records.
- Keep operation history traceable.
- Use appropriate indexes and foreign keys.
- Avoid destructive schema changes unless explicitly required and reviewed.

## 7. MSS Synchronization

- Every business operation must have a stable UUID.
- Synchronization must be idempotent.
- Preserve pending operations.
- Never silently discard conflicts.
- Never assume the two shops always have internet connectivity.
- Distinguish selling branch from stock-source branch.
- Distinguish shared catalog information from physical inventory.
- Display synchronization status clearly.
- Do not promise impossible double-sale prevention while both devices are offline.

## 8. Financial Accuracy

- Store monetary values using an appropriate precise representation.
- Avoid floating-point arithmetic for financial calculations.
- Save original prices and actual transaction prices separately.
- Save discounts explicitly.
- Save cost snapshots at sale time.
- Calculate gross profit from actual sale price minus cost.
- Treat returns and cancellations as traceable reversals.
- Do not assume an MSS profit-sharing percentage.

## 9. Security

- Never hardcode secrets in source code.
- Never expose Supabase service-role credentials to the frontend.
- Apply Row Level Security where appropriate.
- Validate permissions on trusted operations.
- Do not assume that no-login operation removes the need for security.
- Protect local database files and backup operations from accidental damage.
- Never commit private updater signing keys.

## 10. Backups & Updates

- Separate application files from business data.
- Application updates must not overwrite business databases.
- Backups must be restorable and validated.
- Never claim a backup is valid without checking it.
- Do not run destructive database migrations without a clear explanation.
- Always provide complete SQL migration files when Supabase changes are needed.
- Identify exact migration paths.
- Never claim a manual SQL migration was executed by you.

## 11. Code Quality

- Use TypeScript safely.
- Avoid unnecessary `any`.
- Keep components focused and maintainable.
- Avoid duplicating business logic.
- Separate UI, data access, and business rules.
- Handle errors explicitly.
- Do not hide errors with empty catch blocks.
- Avoid unnecessary dependencies.
- Keep the application buildable after each phase.

## 12. Completion & Honesty

- Execute relevant tests.
- Report actual results.
- Distinguish implemented features from placeholders.
- Identify known limitations.
- Do not claim success based only on code generation.
- Do not modify permanent requirements without recording the decision in `specifications.md`.
- Stop after the requested phase.

---

# FILE 3 — goals.md

# Product Goals & Business Vision

## 1. Main Goal

Create one simple Windows application that manages two related but operationally separate business activities.

The application must be suitable for daily use by shop employees without requiring technical knowledge.

The user should be able to understand the basic workflow within approximately ten minutes.

## 2. Business Structure

### A. Accessories Shop

- Belongs to the user's own shop operation.
- Works completely offline.
- Uses local SQLite storage.
- Must continue working even if Supabase or the internet is unavailable.
- Manages products, purchases, stock, sales, invoices, returns, reports, and backups.

### B. MSS Business

- A shared business between two physical shops.
- Both shops use the same catalog and business information.
- Each shop has its own physical inventory.
- Both shops can view availability in both locations.
- MSS sales and profits are shared at the business level.
- The shop that executes the sale is recorded separately from the shop where the sold device was stored.
- Supports offline work and synchronization.

## 3. Primary Product Goals

1. Simple Arabic interface.
2. Fast product search.
3. Accurate stock tracking.
4. Accurate sales and profit calculations.
5. Clear printable invoices.
6. Reliable local storage.
7. Reliable MSS synchronization.
8. Safe backups and restoration.
9. Automatic application updates.
10. No unnecessary operating costs where practical.

## 4. Usage Requirements

- One computer in each shop.
- Two installations in total.
- No user accounts or passwords in the initial version.
- No serial-number licensing system.
- No subscription fees for using the application itself.
- Internet is required for MSS cloud synchronization and updates, not for local accessories operations.
- The installed application must remain usable when the internet is unavailable.

## 5. User Experience Goals

- Clear navigation.
- Simple forms.
- Large readable controls.
- Minimal unnecessary steps.
- Useful search and filters.
- Clear status indicators.
- Friendly error messages.
- No confusing technical terminology in the interface.
- Professional but practical appearance.

## 6. Business Accuracy Goals

The application must never confuse:

- Product model with physical inventory unit.
- Selling branch with stock-source branch.
- List price with actual sale price.
- Revenue with profit.
- Shared MSS profit with branch sales performance.
- Reserved inventory with available inventory.
- Pending synchronization with confirmed cloud synchronization.

## 7. Reliability Goals

- No silent data loss.
- No duplicate financial transactions.
- No accidental deletion of finalized invoices.
- No loss of business data during software updates.
- Recoverable local data through backups.
- Transparent handling of synchronization conflicts.
- Honest reporting of limitations.

## 8. Cost Goals

Prefer free or low-cost infrastructure:
- Open-source desktop technologies.
- SQLite for local data.
- Supabase within available plan limits.
- GitHub Releases for application distribution.

Do not assume that free cloud service tiers have unlimited capacity or guaranteed permanent availability.

The application must be designed so infrastructure can be upgraded later without rebuilding the entire system.

## 9. Long-Term Vision

Build a dependable internal business tool that can grow gradually.

Potential future additions may include:
- Expense management.
- More branches.
- More detailed analytics.
- Advanced supplier management.
- Additional printing formats.
- Improved stock transfer workflows.

Do not implement future features unless they are included in the active phase or explicitly approved.

---

# FILE 4 — specifications.md

# Functional & Technical Specifications

## 1. Application Architecture

### Desktop

- Tauri 2.
- React.
- TypeScript.
- Tailwind CSS.
- Lucide React.

### Local Storage

- SQLite.
- Local database accessed through trusted Tauri/Rust operations.
- Database files must be stored separately from installed application binaries.

### MSS Cloud

- Supabase.
- PostgreSQL.
- Row Level Security.
- Trusted server-side validation through approved Supabase mechanisms.

### Updates

- Tauri Updater.
- Signed updates.
- GitHub Releases.
- Private signing credentials must remain private.

## 2. Application Sections

The application contains two independent sections:

1. Accessories Shop.
2. MSS Business.

The navigation must make the active section clear.

## 3. Accessories Shop — Functional Requirements

### Products

Each product should support:
- Product name.
- Product code.
- Barcode.
- Purchase cost.
- Default selling price.
- Available quantity.
- Low-stock threshold.
- Optional category.
- Optional description.
- Creation and modification timestamps.

### Purchases

Support:
- Purchase records.
- Purchase items.
- Quantities.
- Unit costs.
- Purchase totals.
- Supplier information where appropriate.
- Inventory increases after confirmed purchases.

### Sales

Support:
- Product search.
- Barcode scanning.
- Cart management.
- Quantity editing.
- Item discounts.
- Invoice discounts where appropriate.
- Actual selling price.
- Invoice totals.
- Stock deduction.
- Invoice number.
- Date and time.
- Printable invoice.

### Financial Snapshots

For each finalized sale item, save:
- Original selling price.
- Discount.
- Actual selling price.
- Cost at time of sale.
- Quantity.

Gross profit is calculated from the actual sale amount minus the saved cost.

### Returns & Cancellation

- Do not delete finalized invoices.
- Record cancellation or return operations.
- Preserve the original invoice.
- Correct inventory and financial reporting through traceable reversals.

### Inventory

Support:
- Current quantities.
- Low-stock alerts.
- Out-of-stock alerts.
- Stock adjustments.
- Adjustment reasons.
- Inventory movement history.

### Reports

Support:
- Daily sales.
- Weekly sales.
- Monthly sales.
- Revenue.
- Cost.
- Gross profit.
- Product performance.
- Inventory status.
- Return and cancellation summaries.

### Backup

Support:
- Manual backup.
- Automatic backup.
- Configurable backup retention.
- Restore from backup.
- Backup validation.
- Export to external storage.

Accessories must remain usable without an internet connection.

## 4. MSS — Shared Business Specifications

### Business Structure

- Two physical shops.
- Shared business catalog.
- Separate physical stock at each shop.
- Shared visibility of both shops' stock.
- Shared MSS financial reporting.

### Catalog Models

Each model can include:
- Brand.
- Model name.
- Category.
- Processor.
- RAM.
- Storage.
- Screen size.
- Other technical specifications.
- Default shared list price.
- Optional controlled price override.

### Individual Physical Units

Each laptop or monitor must have its own inventory record.

Required fields:
- Unique unit ID.
- Serial number.
- Catalog model ID.
- Specifications when unit-specific.
- Purchase cost.
- List price.
- Purchase date.
- Physical condition.
- Stock location.
- Current status.
- Creation and modification timestamps.

Serial numbers must be unique.

### Inventory Status

Supported statuses:
- Available.
- Reserved.
- Sold.
- Under maintenance.
- Returned.

### Physical Locations

Each unit belongs to one physical stock location at a time.

The system must display:
- Shop 1 quantity.
- Shop 2 quantity.
- Combined display total.

The combined total is for visibility only. It must never erase the distinction between physical stock locations.

### Sales Attribution

Every MSS sale must record separately:

- Selling branch: The branch that actually executed the sale.
- Stock-source branch: The branch where the sold device was physically stored before sale.

Example:

A laptop is stored at Shop 2, but the customer buys it from Shop 1.

The sale must:
- Be attributed to Shop 1.
- Deduct inventory from Shop 2.
- Preserve the laptop's serial number.
- Record the actual selling price and discount.
- Record the cost snapshot.

A physical stock transfer is not required merely because one branch sold a device stored at the other branch.

If a device is physically transferred, record a separate movement transaction.

### MSS Pricing

- The default selling price is normally shared.
- The seller may negotiate a different actual price.
- Save the original list price snapshot.
- Save the discount.
- Save the actual sale price.
- Save the cost snapshot.

### MSS Profit

Gross profit:

Actual sale price - Cost snapshot.

Profit reporting belongs to MSS as a shared business.

Branch sales reports are for operational performance and must not imply that the seller owns the profit.

Do not assume a 50/50 profit-sharing arrangement.

Profit distribution rules remain an external business agreement unless explicitly specified later.

### Reservations

- A unit can be reserved.
- The reservation must become visible to both shops after synchronization.
- Reserved units must not appear as normally available.
- Reservation records must identify the relevant unit and reservation status.
- Reservation conflicts must be handled transparently when devices have been offline.

### Returns

- Preserve the original sale.
- Record the return as a separate operation.
- Update unit status and inventory appropriately.
- Keep a complete audit trail.

### Transfers

- Record actual physical transfers between shops.
- Record source and destination branches.
- Preserve movement history.
- Do not create unnecessary transfer records when a sale occurs directly from the other shop's stock.

## 5. MSS Offline & Synchronization

### Offline Operation

Each installation must have local MSS data available for appropriate offline workflows.

### Outbox

Each local operation must have:
- Stable UUID.
- Operation type.
- Local timestamp.
- Payload.
- Synchronization status.
- Retry information where needed.

### Synchronization

Support:
- Automatic sync when connectivity returns.
- Manual sync trigger.
- Idempotent operations.
- Retry handling.
- Conflict detection.
- Pending operation visibility.
- Synchronized operation visibility.
- Conflict resolution.

### Important Consistency Rule

Offline devices may hold stale stock information.

It is technically impossible to guarantee that two disconnected devices will never sell the same physical unit.

Therefore:
- Clearly identify offline transactions as pending.
- Validate the serial number and reservation state when synchronizing.
- Never silently discard a conflicting transaction.
- Provide a clear review workflow.
- Preserve all transaction records.

## 6. Financial & Data Integrity

- Use precise monetary storage.
- Use transactions for related database updates.
- Use unique identifiers.
- Prevent duplicate serial numbers.
- Prevent duplicate invoice submissions.
- Prevent duplicate synchronization operations.
- Save finalized transaction snapshots.
- Preserve historical records.
- Use reversible operations instead of deleting finalized transactions.

## 7. Security

- No public exposure of Supabase service-role credentials.
- Apply RLS policies.
- Validate sensitive operations through trusted logic.
- Keep cloud and local business data separated.
- Protect update signing credentials.
- Avoid storing unnecessary personal data.

The initial product does not require login or employee accounts. Any future access-control requirement must be discussed before implementation.

## 8. Backup & Data Storage

- Store local databases outside the installation directory.
- Preserve business data during application updates.
- Support backup and restoration.
- Verify restored database integrity.
- Allow exporting backups to external drives.

Important: Storing data on a separate drive can protect against application reinstallation, but not against formatting or physical failure of that drive. External backups remain necessary.

## 9. Automatic Updates

- Signed update packages.
- Private signing key.
- GitHub Releases.
- Update checks with graceful offline behavior.
- No forced data deletion.
- Database compatibility checks.
- Safe backup before risky migrations.
- Clear update errors.

## 10. Initial Version Exclusions

Do not implement these unless explicitly approved:
- Expense management.
- Employee accounts and permissions.
- Payroll.
- Customer loyalty.
- Online payment gateway.
- E-commerce storefront.
- Advanced multi-branch management beyond the two MSS shops.
- Automated profit-sharing distribution.
- Complex accounting integrations.

These may be considered in future versions.