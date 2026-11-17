# COMPU MSS — ADMIN SYSTEM
## Phase 5: Inventory Management, Stock Transfers & Synchronization

### 1. Phase Context

This is Phase 5 of the Compu MSS Admin System project.

The objective is to implement a complete and secure inventory transfer system inside the independent Admin Dashboard.

**Repository:**
`https://github.com/AhmedSaber45/MSS-System`

**Project path:**
`C:\Users\Administrator\Desktop\System`

**Admin Dashboard:**
`admin-dashboard/`

Existing architecture:

- Tauri v2 desktop application.
- React and TypeScript.
- SQLite local persistence.
- Supabase cloud database.
- Existing Offline-First architecture.
- Existing Outbox synchronization.
- Accessories and Compu MSS as separate modules.
- Centralized user authentication and module permissions.
- Store/warehouse management.
- Store merge functionality.

Before implementation, inspect the actual completed results of Phases 1–4.

Read:
- `AGENTS.md`
- `rules.md`
- `goals.md`
- `admin-dashboard/README.md`
- All relevant architecture documentation.
- Previous phase implementation reports.
- Existing Supabase schema and migrations.
- Existing inventory and device tables.
- Existing purchase, sales, reservation, and movement logic.
- Existing branch/store/warehouse relationships.
- Existing synchronization and Outbox implementation.
- Existing session and authorization mechanisms.

Inspect current Git status and preserve all user changes.

Follow:
`https://github.com/heydamir/unslop`

Do not assume the existing inventory model is simple or that every inventory item is represented in the same way. Understand the actual implementation before designing transfer operations.

### 2. Main Objective

Build a complete inventory management and transfer workflow in the Admin Dashboard.

The administrator must be able to:

1. View inventory across all authorized stores and warehouses.
2. Inspect stock quantities and individual devices.
3. Select one or more devices for transfer.
4. Transfer all eligible inventory from one location to another.
5. Transfer selected product groups or quantities where supported.
6. Preview transfers before confirmation.
7. Track transfer status.
8. Review complete transfer history.
9. Identify failed, pending, or conflicting transfers.
10. Preserve purchase costs, serial numbers, device history, reservations, and historical records.
11. Prevent duplicate inventory or a device appearing in two locations simultaneously.
12. Support safe synchronization with the existing desktop application.

This phase must implement actual working transfer operations, not merely UI mockups.

### 3. Critical Inventory Ownership Rules

The following rules are mandatory.

**A. Every physical inventory item must have one authoritative current location.**

A device must not appear as available stock in two different warehouses simultaneously.

**B. Inventory belongs to a store/warehouse, not to a login user.**

User identity and inventory location must remain independent.

**C. Historical records must remain immutable.**

A transfer changes the current location of eligible stock. It must not rewrite historical purchases, sales, invoices, or previous movements.

**D. Transfer does not mean sale or purchase.**

Moving stock between locations must not:
- Create a sales invoice.
- Create a purchase invoice.
- Increase company-wide stock.
- Decrease company-wide stock.
- Generate artificial revenue or profit.
- Change the original purchase cost.
- Change the original purchase date.

**E. Accessories and Compu MSS remain separate.**

The transfer system in this phase must operate on the Compu MSS inventory model only unless an independently verified Accessories transfer requirement already exists and has been explicitly approved.

Do not combine the two modules' inventory tables or business logic.

### 4. Inventory Overview

Build a functional Inventory Management section in the Admin Dashboard.

The overview should allow the administrator to inspect:

- Total inventory across locations.
- Available stock.
- Reserved stock.
- Sold or consumed stock where relevant.
- Stock by store/warehouse.
- Stock by product.
- Individual serialized devices.
- Transfers currently in progress.
- Recently completed transfers.
- Failed or pending transfers.

Only display figures that can be derived reliably from the existing database.

Do not invent stock totals or calculate quantities using inconsistent sources.

#### Filters

Provide filters for:

- Store/warehouse.
- Product.
- Category, if supported.
- Availability/status.
- Serialized vs non-serialized inventory, if applicable.
- Transfer status.
- Date range.

Provide search by:
- Device serial number.
- Product name.
- Product code.
- Existing device identifier.

Use pagination or an efficient loading strategy for large inventories.

Do not load every device record into the browser unnecessarily.

### 5. Device and Stock Eligibility

Before implementing transfers, inspect the actual status model.

Determine which records represent:

- Available devices.
- Reserved devices.
- Sold devices.
- Returned devices.
- Damaged devices.
- Under-maintenance devices.
- Cancelled or deleted records.
- Other application-specific statuses.

Implement transfer eligibility based on actual business rules.

Default rules:

**Eligible:**
- Available stock that is physically present in the source location.
- Other statuses only when the existing business rules explicitly allow transfer.

**Not eligible by default:**
- Sold devices.
- Devices already transferred elsewhere.
- Devices reserved for a customer or an active order.
- Damaged or unavailable devices.
- Devices already involved in another pending transfer.
- Records with unresolved ownership/location conflicts.

Do not allow an administrator to transfer an ineligible device merely because the frontend displays it.

The trusted backend operation must recheck eligibility at execution time.

If a reservation can legitimately move between locations, implement it only if the existing reservation model supports a safe, explicit workflow. Otherwise block it and explain why.

### 6. Transfer Types

Support the following transfer workflows.

#### A. Individual Device Transfer

The administrator selects:

- Source store/warehouse.
- Destination store/warehouse.
- Individual device by serial number or stable device ID.

The interface must show:

- Product name.
- Serial number.
- Current location.
- Current status.
- Original purchase cost where authorized.
- Eligibility status.

The administrator confirms the transfer.

After successful execution, the device must belong to the destination location only.

#### B. Selected Devices Transfer

Allow the administrator to select multiple eligible devices.

Requirements:

- Multi-selection.
- Search and filtering.
- Selection count.
- Clear list of selected devices.
- Validation of every selected device.
- Transfer preview.
- Confirmation before execution.

If any device becomes ineligible before execution, do not silently transfer only an unexpected subset.

Use an explicit policy:

- Either reject the entire transfer and explain the conflicting devices.
- Or allow partial completion only when the administrator explicitly confirms a clearly presented partial-transfer result.

Prefer all-or-nothing execution for a single confirmed transfer operation.

#### C. Product Group or Quantity Transfer

If the current inventory schema supports non-serialized stock quantities, allow transferring a specified quantity of a product from one location to another.

Requirements:

- Show available quantity.
- Validate requested quantity.
- Prevent negative stock.
- Prevent transferring more than available stock.
- Preserve the original cost basis and stock valuation rules.
- Record source and destination quantities.
- Keep the total company-wide quantity unchanged.

If the current inventory model is entirely serialized, do not invent a second stock model merely to support quantity transfers. Document that limitation and implement transfers using the actual model.

#### D. Transfer All Eligible Inventory

Allow the administrator to select a source and destination and request transfer of all eligible inventory.

Before confirmation, display a detailed preview:

- Number of eligible devices.
- Number of excluded devices.
- Exclusion reasons.
- Product groups.
- Quantities per product where applicable.
- Total eligible items.
- Relevant stock valuation if reliably available.

Do not include sold, reserved, damaged, or otherwise ineligible devices by default.

The administrator must explicitly confirm the complete transfer.

If the source contains stock that cannot be transferred, clearly explain that the operation moves only eligible stock.

Never describe the result as an empty source location if excluded stock remains.

### 7. Transfer Workflow

Implement a guided transfer process.

#### Step 1 — Select Source

The administrator selects the source store/warehouse.

Validate:
- Source exists.
- Source is active or otherwise eligible under the documented policy.
- Administrator has permission to perform the operation.
- Source has eligible inventory.

#### Step 2 — Select Destination

The administrator selects the destination store/warehouse.

Validate:
- Destination exists.
- Destination is active.
- Destination differs from source.
- Administrator is authorized to operate on both locations.

Do not allow invalid source/destination combinations.

#### Step 3 — Select Transfer Scope

Allow:
- Individual devices.
- Multiple selected devices.
- Product quantities where supported.
- All eligible inventory.

#### Step 4 — Preview

Display:

- Source.
- Destination.
- Selected products/devices.
- Quantities.
- Device serial numbers where relevant.
- Excluded records and reasons.
- Original cost information where appropriate.
- Any detected conflicts.

The preview must be based on fresh authoritative data.

#### Step 5 — Confirmation

Require an explicit confirmation.

For large transfers, show a clear warning explaining the number of affected items and the irreversible historical record implications.

Prevent accidental double-click submissions.

#### Step 6 — Execute

Execute the transfer through a trusted server-side operation.

The operation must be atomic or use a safe transaction-based design.

#### Step 7 — Result

Show:

- Transfer reference.
- Source and destination.
- Number of successfully transferred items.
- Any exclusions or failures.
- Timestamp.
- Administrator who performed the operation.

Provide a link to the transfer details and history.

### 8. Transfer Data Model and History

Inspect the existing movement/history model first.

Reuse it if it can safely represent transfers.

If not, implement a dedicated transfer structure.

A transfer should have:

- Unique transfer ID.
- Human-readable transfer reference.
- Source location ID.
- Destination location ID.
- Created by administrator ID.
- Created timestamp.
- Status.
- Transfer scope/type.
- Item count or quantity summary.
- Optional reason or notes.
- Confirmation metadata.
- Completion timestamp.
- Failure details where appropriate.
- Idempotency key.

Individual transfer items should preserve:

- Transfer ID.
- Device ID or product ID.
- Serial number snapshot where appropriate.
- Quantity where supported.
- Original source location.
- Destination location.
- Original cost basis.
- Previous status.
- Resulting status.
- Item-level result.

The exact schema must follow the actual existing inventory model.

#### Transfer statuses

Use explicit statuses appropriate to the implementation, such as:

- Draft.
- Pending.
- Processing.
- Completed.
- Failed.
- Cancelled.
- Requires review.

Do not use ambiguous status values.

A completed transfer must have a verifiable inventory movement record.

A failed transfer must not leave partially updated stock.

If the system uses a pending approval or in-transit concept, implement it only when supported by the actual operational workflow. Do not introduce an unnecessary approval process that blocks ordinary transfers.

### 9. Atomicity, Concurrency and Idempotency

This is a critical security and data-integrity requirement.

The backend must protect against:

- Double-click submissions.
- Network retries.
- Simultaneous transfers of the same device.
- Two administrators transferring the same stock.
- Stale frontend inventory data.
- Duplicate transfer requests.
- Partial database updates.

Use:

- Database transactions.
- Appropriate row-level locking or equivalent concurrency controls.
- Unique constraints.
- Idempotency keys.
- Authoritative stock validation at execution time.

A transfer must never succeed twice because the same request was retried.

For serialized devices, enforce one current location per device.

For quantity-based inventory, ensure stock decrements and increments are atomic.

If a transfer cannot complete fully, roll back all related inventory updates.

Do not implement multi-step frontend writes that independently update source and destination stock.

The trusted server-side operation must control the entire transfer.

### 10. Preserve Device History and Purchase Cost

A transfer must preserve the original device identity and history.

For serialized devices:

- Keep the original device ID.
- Keep the serial number unchanged.
- Keep the original purchase record.
- Keep the original purchase cost.
- Keep the original purchase date.
- Preserve previous movement records.
- Preserve sales history.
- Preserve reservations and status rules.
- Update only the current location through the correct inventory movement mechanism.

For quantity-based stock:

- Preserve the correct original cost basis.
- Respect the existing costing method.
- Do not reset cost to zero.
- Do not use the destination's current purchase price as a replacement for historical cost.
- Do not artificially increase or decrease total inventory valuation.

If stock from different purchase costs is tracked in batches or layers, preserve those layers or use the existing costing method correctly.

Do not introduce a new costing methodology in this phase.

### 11. Store Merge Integration

Integrate transfers with the organizational merge functionality implemented in Phase 4.

When a store is merged into another store:

- Do not automatically move inventory.
- Show the source location's remaining stock.
- Allow the administrator to initiate a separate inventory transfer.
- Keep the source location available for historical reference.
- Do not archive or finalize a source location in a way that makes legitimate inventory inaccessible.

If a location has remaining inventory, the interface should clearly show its status.

Where the existing business process requires a source location to be closed after transfer, allow that only after verifying that no eligible or blocked stock remains and all relevant dependencies have been resolved.

Do not automatically delete or hide the source inventory records.

### 12. Admin Dashboard UI

Build the Inventory Management and Inventory Transfers sections.

#### Inventory Management

Include:

- Global inventory overview.
- Per-location inventory.
- Product-level stock view.
- Individual device list.
- Device details.
- Status filters.
- Search.
- Pagination.
- Clear stock availability indicators.

#### Inventory Transfers

Include:

- Create transfer action.
- Transfer type selection.
- Source/destination selection.
- Device/product selection.
- Preview screen.
- Confirmation dialog.
- Transfer result.
- Transfer history.
- Transfer details.
- Failed transfer/review states.

#### Transfer History Table

Display:

- Transfer reference.
- Date.
- Source location.
- Destination location.
- Transfer type.
- Number of items.
- Created by.
- Status.
- Actions.

Allow searching and filtering by:
- Reference.
- Source.
- Destination.
- Status.
- Date range.
- Device serial number where supported.

Do not display sensitive user credentials or unrelated personal information.

### 13. Authorization and Security

Every inventory operation must be protected server-side.

For every request:

1. Authenticate the administrator.
2. Verify the required administrative permissions.
3. Verify access to both source and destination.
4. Validate the transfer scope.
5. Validate every selected device or quantity.
6. Verify current stock and status.
7. Check that no conflicting transfer exists.
8. Execute the transaction atomically.
9. Record the audit event.
10. Return a safe result.

Never trust:
- Frontend stock quantities.
- Frontend device status.
- Frontend location IDs without validation.
- Client-provided purchase cost.
- Client-provided administrator identity.
- Client-provided transfer status.

Do not allow normal desktop users to execute administrative transfer operations.

Use Supabase RLS appropriately.

If privileged database operations require elevated access, isolate them in a trusted Edge Function or equivalent secure server-side mechanism.

Never expose service-role credentials in the browser or desktop client.

### 14. Audit Logging

Record all transfer-related events.

At minimum:

- Transfer created.
- Transfer confirmed.
- Transfer started.
- Transfer completed.
- Transfer failed.
- Transfer cancelled.
- Transfer requires review.
- Individual item transferred.
- Quantity movement recorded.

Include:
- Actor/admin ID.
- Transfer ID.
- Source location.
- Destination location.
- Timestamp.
- Item count or quantity summary.
- Safe failure reason where applicable.

Do not allow ordinary users to modify or delete audit records.

Do not log access codes, tokens, or other secrets.

Transfer history must remain available even if a source store is later archived.

### 15. Offline and Synchronization Strategy

The Admin Dashboard uses Supabase as its authoritative cloud source.

The existing desktop application has its own offline-first local SQLite and Outbox architecture.

Do not assume the Admin Dashboard can directly update a disconnected desktop device.

Implement a clear synchronization strategy.

#### Centralized transfer execution

Transfers initiated from the Admin Dashboard should be committed to the authoritative cloud inventory through the trusted server-side transaction.

When desktop clients reconnect:

1. They detect the updated cloud inventory.
2. They retrieve the relevant movement records.
3. They update local inventory consistently.
4. They preserve historical movement information.
5. They resolve conflicts according to the existing synchronization model.

#### Pending desktop operations

A desktop device may contain pending Outbox operations created before an administrator transfers inventory.

Before implementing transfer synchronization, inspect the existing Outbox model and define how these operations interact.

Requirements:

- Never silently discard pending operations.
- Never upload stale operations in a way that duplicates or reverses a completed transfer.
- Never overwrite a newer authoritative inventory state with stale local stock.
- Never attribute an operation to a different user.
- Never change historical transaction ownership.
- Preserve original operation IDs and idempotency behavior.

If an offline device tries to sell or reserve a device that has already been transferred elsewhere:

- The server must reject the conflicting operation.
- The local application must preserve the pending operation for review.
- The user must receive a clear explanation.
- The system must provide a safe recovery path.

Do not silently delete the pending sale or reservation.

#### Synchronization ordering

Define a deterministic strategy for ordering:

- Inventory transfers.
- Sales.
- Reservations.
- Purchases.
- Returns.
- Other inventory movements.

Use authoritative timestamps, versions, sequence numbers, or the existing synchronization mechanism as appropriate.

Do not assume client device timestamps are reliable.

### 16. Accessories Module Restriction

This phase is for Compu MSS inventory.

Do not modify Accessories inventory.

Do not:
- Add Accessories stock to Compu MSS totals.
- Reuse Compu MSS transfer logic against Accessories tables.
- Change Accessories stock ownership.
- Change Accessories purchase or sales workflows.
- Migrate Accessories data to Supabase.

Keep all module-specific inventory logic separate.

### 17. Database and Migration Requirements

Inspect the current schema before making changes.

Reuse existing inventory and movement tables wherever safe.

Avoid duplicate representations of the same stock.

If database changes are required:

- Preserve existing records.
- Preserve device IDs.
- Preserve serial numbers.
- Preserve purchase costs.
- Preserve historical references.
- Add necessary constraints and indexes.
- Implement transaction-safe transfer functions.
- Implement idempotency protection.
- Maintain RLS.
- Ensure concurrency safety.
- Avoid destructive migrations.

**Mandatory deliverable:**

Create one complete, consolidated SQL migration file containing all Phase 5 database changes.

It must include all required:
- Tables.
- Columns.
- Constraints.
- Indexes.
- Functions.
- Triggers.
- RLS policies.
- Transfer execution functions.
- Idempotency mechanisms.
- Any required synchronization metadata.

The migration must:

1. Be compatible with the actual existing schema.
2. Be ordered correctly.
3. Be reviewed for syntax and dependency issues.
4. Preserve existing data.
5. Be safe to execute in the Supabase SQL Editor in one go.
6. Include any required rollback or recovery guidance where safe and applicable.

Provide the exact file path.

Do not claim the migration has been executed unless it actually has been executed and verified.

If multiple Edge Functions are required, document each one clearly; the SQL migration must still be consolidated into one file.

### 18. Testing Requirements

Implement meaningful automated tests.

#### Transfer Eligibility
- Available device can be transferred.
- Sold device cannot be transferred.
- Reserved device is rejected unless explicitly supported.
- Damaged/unavailable device is rejected by default.
- Device already in another pending transfer is rejected.
- Invalid source/destination is rejected.

#### Individual and Bulk Transfers
- Transfer one device.
- Transfer multiple devices.
- Transfer all eligible inventory.
- Transfer selected product quantities if supported.
- Reject quantities exceeding available stock.
- Handle excluded devices correctly.
- Verify no duplicate inventory is created.

#### Atomicity
- Simulate failure during transfer.
- Verify complete rollback.
- Retry the same request.
- Verify idempotency.
- Run concurrent transfer attempts for the same device.
- Verify only one transfer succeeds.

#### Financial and Historical Integrity
- Original purchase cost remains unchanged.
- Original purchase date remains unchanged.
- Device ID remains unchanged.
- Serial number remains unchanged.
- Historical invoices remain unchanged.
- Historical sales remain unchanged.
- Total company-wide inventory remains consistent.
- Inventory valuation remains consistent with the existing costing method.

#### Synchronization
- Desktop receives cloud transfer after reconnection.
- Existing Outbox operations are preserved.
- Stale local operations cannot reverse a newer transfer.
- Conflicting sales are safely rejected.
- Conflicting reservations are safely rejected.
- Duplicate synchronization requests do not duplicate transfers.
- Actor identity remains correct.

#### Authorization
- Unauthorized user cannot view protected inventory.
- Unauthorized user cannot initiate transfers.
- Unauthorized user cannot change source/destination.
- Normal desktop users cannot call administrative transfer operations.
- RLS prevents unauthorized data access.

#### Regression
- Store Management remains functional.
- User Management remains functional.
- Desktop authentication remains functional.
- Accessories module remains unchanged.
- Existing Compu MSS sales, purchases, reservations, returns, and reports remain accurate.

Run:
- TypeScript checks.
- Lint.
- Unit tests.
- Integration tests.
- Database function tests.
- Concurrency/idempotency tests where possible.
- Admin Dashboard production build.
- Desktop application build.

Do not ignore failing checks.

### 19. Documentation

Update:

`admin-dashboard/README.md`

Document:

- Inventory ownership model.
- Device transfer model.
- Quantity-based transfer behavior, if supported.
- Eligibility rules.
- Transfer statuses.
- Atomic execution mechanism.
- Idempotency strategy.
- Audit history.
- Purchase cost preservation.
- Offline synchronization behavior.
- Outbox conflict handling.
- Known limitations.
- Exact migration path.
- Edge Function deployment instructions.

Also document any desktop changes required for transfer synchronization.

### 20. Phase 5 Completion Criteria

Phase 5 is complete only when:

1. The administrator can inspect inventory across locations.
2. Individual device transfers work.
3. Multi-device transfers work.
4. All eligible inventory can be transferred safely.
5. Quantity-based transfers work if supported by the existing model.
6. Transfer preview and confirmation work.
7. Transfer history is complete.
8. Transfers are atomic.
9. Idempotency prevents duplicate execution.
10. Concurrent transfers cannot duplicate device ownership.
11. Purchase costs and historical data are preserved.
12. Total inventory remains consistent.
13. Offline synchronization is safe.
14. Pending Outbox operations are preserved.
15. Stale local operations cannot overwrite newer authoritative state.
16. Accessories remains unaffected.
17. Authorization and RLS are verified.
18. One consolidated SQL migration is ready and reviewed if required.
19. Relevant tests pass.
20. Admin Dashboard and desktop builds succeed.

---

## STRICT PHASE GATE

**STOP AFTER PHASE 5.**

Do not start Phase 6.

Do not implement unrelated business features.

Do not redesign existing sales, purchase, returns, or inventory workflows unless a minimal compatibility fix is strictly necessary for safe transfers.

After completion, provide:

1. Inventory architecture assessment.
2. Transfer data model.
3. Transfer types implemented.
4. Device eligibility rules.
5. Atomicity and idempotency implementation.
6. Purchase-cost and history preservation results.
7. Offline synchronization and Outbox strategy.
8. Conflict-handling behavior.
9. All created and modified files.
10. Exact SQL migration path.
11. Edge Functions created or modified.
12. Tests and build results.
13. Any remaining limitations or unresolved conflicts.

Leave the repository in a clean, buildable state.

Wait for my explicit approval before proceeding to Phase 6.