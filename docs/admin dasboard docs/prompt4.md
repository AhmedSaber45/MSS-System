# COMPU MSS — ADMIN SYSTEM
## Phase 4: Stores, Warehouses & Partner Management

### 1. Phase Context

This is Phase 4 of the Compu MSS Admin System project.

The objective is to implement complete organizational management for stores, warehouses, partners, and user-to-store relationships.

**Repository:**
`https://github.com/AhmedSaber45/MSS-System`

**Project path:**
`C:\Users\Administrator\Desktop\System`

**Admin Dashboard:**
`admin-dashboard/`

The existing system includes:
- Tauri v2 desktop application.
- React and TypeScript.
- SQLite local persistence.
- Supabase cloud database.
- Offline-first synchronization.
- Accessories and Compu MSS as separate business modules.
- Administrative users and permissions.
- Desktop authentication and session management.

Before implementation, inspect the actual results of Phases 1, 2, and 3.

Read:
- `AGENTS.md`
- `rules.md`
- `goals.md`
- `admin-dashboard/README.md`
- Relevant architecture documentation.
- Previous phase implementation reports.
- Current Supabase schema and migrations.
- Current store, branch, warehouse, and inventory relationships.
- Current authentication and warehouse authorization implementation.
- Existing synchronization and Outbox logic.

Inspect Git status and preserve all existing changes.

Follow:
`https://github.com/heydamir/unslop`

Do not assume that a previous phase was completed exactly as planned. Work with the actual implemented architecture.

---

### 2. Main Objective

Build a complete Stores & Warehouses management system inside the Admin Dashboard.

The administrator must be able to manage the business's physical locations and organizational structure without being forced to associate inventory permanently with individual people.

The system must support:

1. Creating stores and warehouses.
2. Editing their information.
3. Activating and deactivating locations.
4. Managing users and partners associated with each location.
5. Allowing multiple users to access one location when authorized.
6. Moving a partner from one organizational arrangement to another without deleting historical information.
7. Merging multiple stores into one unified store/warehouse.
8. Preserving historical transactions, invoices, device records, and audit trails.
9. Preparing the organizational model for Phase 5 inventory transfers.

The actual inventory transfer implementation is reserved for Phase 5.

### 3. Critical Architecture Rule: Users Are Not Warehouses

Keep these entities independent:

**User**
- Represents a person or login identity.
- Has a username and access code.
- Has module permissions.
- Has authorized store/warehouse memberships.

**Store**
- Represents a business location or shop.
- May be operated by one or more partners/users.
- Has its own identity and historical records.

**Warehouse**
- Represents a physical or logical inventory location.
- Owns or holds stock independently of user identities.

If the existing application uses a combined branch/store/warehouse concept, inspect it carefully and document the actual semantics before changing anything.

Do not introduce duplicate organizational entities just because the existing naming differs.

The key requirement is that inventory ownership and location must not depend on the continued existence of a particular user's account.

If the existing data model already treats branches as inventory locations, reuse and extend that model safely.

### 4. Stores & Warehouses Data Model

Inspect the existing schema and implement the minimum required model.

A location may include:

- Unique ID.
- Display name.
- Unique code/reference where appropriate.
- Location type.
- Optional description.
- Optional address.
- Active/inactive status.
- Created timestamp.
- Updated timestamp.
- Archived timestamp if applicable.
- Optional parent or successor location reference if required for a merge.

Use stable IDs.

Do not use editable names as primary relationship identifiers.

Avoid unnecessary complexity such as introducing a full ERP organizational hierarchy unless the existing business model requires it.

#### Location types

Support the actual types required by the application, such as:

- Store/shop.
- Warehouse.
- Combined store and warehouse.

Do not force a distinction that conflicts with existing inventory logic.

### 5. User and Partner Membership Management

Implement a flexible relationship between users and stores/warehouses.

Requirements:

- Multiple users may be assigned to the same location.
- A user may be assigned to multiple locations if explicitly authorized.
- Memberships must be independently manageable.
- A user's module permissions must still be respected.
- Warehouse access must not automatically grant access to unrelated locations.

The administrator must be able to:

- View all users associated with a location.
- Assign an existing user.
- Remove a user's membership.
- Change a user's assigned location.
- View all locations associated with a user.
- Identify inactive or archived memberships.

Do not create a new login account automatically whenever a new store is created.

Do not delete a user merely because a partner leaves a store.

Do not delete a store merely because a partner leaves.

### 6. Partner and Store Scenarios

The implementation must support these real-world scenarios.

#### Scenario A — New partner/store

A new partner joins the business and starts operating a new shop.

The administrator should be able to:

1. Create the new store.
2. Assign an existing user or create a user through Users Management.
3. Associate the user with the new location.
4. Grant the appropriate module and location permissions.

Do not duplicate existing users unnecessarily.

#### Scenario B — Partner leaves

A partner leaves the business.

The administrator should be able to:

1. Remove or deactivate the user's access to the relevant location.
2. Disable the user's account if the person should no longer access the system.
3. Preserve all previous transactions and activity records.
4. Keep the location active if the shop continues operating.
5. Keep historical records associated with their original actor and location.

Do not rewrite historical records to show that another user performed the old transactions.

#### Scenario C — Existing store changes ownership or operators

If a store continues operating under different partners:

- Keep the same store identity if it remains the same physical and logical location.
- Update current user memberships.
- Preserve historical ownership/operator information where the existing schema supports it.
- Record the changes in the audit log.

Do not create a duplicate store simply because its operators changed.

#### Scenario D — Two or more partners merge into one store

This is an important supported scenario.

For example:

- Mahmoud Masoud has one store.
- Ayman has another store.
- Both decide to operate together from one unified store.

The administrator must be able to prepare a merge operation that:

1. Selects the existing source stores.
2. Creates or selects the destination store.
3. Shows the affected users.
4. Shows the affected warehouse relationships.
5. Shows the inventory and historical dependencies.
6. Shows the consequences before confirmation.
7. Allows the administrator to confirm or cancel.

After confirmation:

- The destination store becomes the active unified location.
- The appropriate users are assigned to it.
- The source locations are archived or marked as merged.
- Historical transactions remain linked to their original store IDs.
- Historical invoices remain unchanged.
- Historical actor IDs remain unchanged.
- Existing inventory is not silently reassigned or duplicated.
- The merge operation is recorded in the audit log.

**Important:** This phase may implement the organizational merge and safe membership updates, but it must not perform actual inventory transfers or rewrite inventory ownership as part of the merge.

Inventory movement must use the dedicated Phase 5 transfer workflow.

If a source location has stock, the interface must clearly identify that stock remains associated with its original inventory location until a separate approved transfer is completed.

Do not allow the administrator to mistakenly believe that merging two stores automatically transfers their stock.

### 7. Safe Store Merge Workflow

Implement a guided merge process.

#### Step 1 — Select source locations

Allow selecting two or more eligible source stores.

Do not allow:
- Selecting the same location more than once.
- Selecting an already archived location.
- Selecting an invalid location.
- Merging a location into itself.

#### Step 2 — Select destination

Allow:
- Creating a new unified location.
- Selecting an existing eligible destination location.

Validate that the destination is not one of the source locations.

#### Step 3 — Preview impact

Display:

- Source locations.
- Destination location.
- Users affected.
- Current memberships.
- Inventory balances by source location, if reliable data is available.
- Active reservations or other relevant dependencies if present.
- Historical records that will remain linked to source locations.
- Any restrictions that prevent the merge.

Clearly distinguish organizational changes from inventory movement.

#### Step 4 — Confirmation

Require an explicit confirmation.

Use a clear warning explaining that the operation changes the current organizational structure but does not automatically move inventory.

#### Step 5 — Execute safely

Execute the organizational merge as an atomic server-side operation where possible.

Requirements:

- Prevent partial merges.
- Preserve historical references.
- Update only current organizational relationships.
- Archive source locations.
- Keep destination active.
- Preserve all historical data.
- Write audit records.
- Make the operation idempotent or protect against duplicate submissions.

If the merge fails, leave the original structure intact.

Do not perform destructive changes to make the merge succeed.

### 8. Admin Dashboard UI

Complete the Stores & Warehouses section.

The main screen should provide:

- Total locations.
- Active locations.
- Archived locations.
- Total assigned users.
- Search.
- Type filter.
- Status filter.
- Location table or cards.

For each location, display where applicable:

- Name.
- Code.
- Type.
- Status.
- Associated users.
- Inventory summary if reliable.
- Created date.
- Actions.

Available actions:

- View details.
- Edit.
- Manage users.
- Activate/deactivate.
- Archive.
- Start merge workflow where eligible.

Build a clear location details page or drawer containing:

- Basic information.
- Assigned users.
- Relevant warehouse information.
- Activity history.
- Historical status information.

Keep the existing design language consistent with the rest of the Admin Dashboard.

Avoid unnecessary redesign of unrelated pages.

### 9. User Management Integration

Ensure that Users Management and Stores & Warehouses remain synchronized.

When an administrator edits a user's store assignments:

- The change must appear in the relevant location's user list.
- The user's effective warehouse access must be updated.
- The permission version or equivalent authorization version must change when appropriate.
- The audit log must record the operation.

When a location is deactivated or archived:

- New access to that location must be prevented according to the authorization model.
- Existing historical transactions must remain readable by appropriately authorized administrators.
- Do not automatically disable all associated user accounts unless that is explicitly requested.
- Do not automatically revoke access to unrelated locations.

Integrate with the session revalidation mechanism implemented in Phase 3.

### 10. Inventory Relationship Preservation

This is one of the most important parts of Phase 4.

Inspect how the current Compu MSS inventory represents:

- Branch or store ownership.
- Warehouse location.
- Device serial numbers.
- Device status.
- Reserved devices.
- Sold devices.
- Purchase cost.
- Purchase records.
- Seller/store references.
- Historical movements.
- Sales records.

Do not assume every device has a simple one-to-one relationship with a branch or user.

Preserve the actual existing business rules.

When changing organizational structure:

- Do not duplicate device records.
- Do not silently change device ownership.
- Do not change serial numbers.
- Do not change purchase costs.
- Do not alter sale history.
- Do not remove reservations.
- Do not change sold-device history.
- Do not rewrite historical seller information.

If the current schema uses a branch ID in a way that combines organizational identity with physical inventory ownership, document the conflict and design a safe compatibility strategy.

Do not perform a broad schema refactor without explicit justification.

### 11. Audit Log

Record all important organizational operations.

At minimum:

- Store created.
- Store details changed.
- Store activated.
- Store deactivated.
- Store archived.
- User assigned to location.
- User removed from location.
- User membership changed.
- Merge initiated.
- Merge completed.
- Merge cancelled or failed, where useful.

For merge events, include:

- Source location IDs.
- Destination location ID.
- Administrator ID.
- Timestamp.
- A safe summary of affected memberships.
- A reference to the merge operation.

Do not rewrite or delete historical audit records.

Do not log authentication secrets.

Audit events should be written as part of the relevant trusted server-side operation.

### 12. Security and Authorization

All organizational operations must be protected server-side.

For every sensitive operation:

1. Authenticate the administrator.
2. Verify administrative privileges.
3. Validate all source and destination IDs.
4. Verify that the requested operation is allowed.
5. Check related inventory and historical dependencies.
6. Execute the operation atomically where possible.
7. Write the audit event.
8. Return only safe information.

Do not trust frontend validation alone.

Ordinary desktop users must not be able to:
- Create stores.
- Archive stores.
- Merge stores.
- Modify other users' memberships.
- Bypass warehouse access restrictions.
- Change historical ownership records.

Maintain strict separation between Accessories and Compu MSS.

Do not accidentally apply Compu MSS warehouse operations to Accessories local data.

### 13. Offline and Synchronization Considerations

Preserve the current offline-first desktop architecture.

Phase 4 mainly changes centralized organizational data.

When the desktop application reconnects:

- Refresh authorized store/warehouse memberships.
- Apply location access changes safely.
- Respect session revalidation.
- Preserve existing local inventory data.
- Preserve pending Outbox records.
- Do not silently delete records associated with archived locations.
- Do not automatically move inventory because a location was merged.
- Do not upload old operations under a different actor.

If an offline device contains data for a location that has since been archived or merged:

- Preserve the local data.
- Detect the organizational change on reconnection.
- Apply the existing conflict-resolution rules.
- Clearly identify operations that require administrative resolution.
- Do not silently rewrite historical references.

Do not implement the actual inventory transfer synchronization workflow here. That belongs to Phase 5.

### 14. Database and Migration Requirements

Inspect all existing organizational tables before making changes.

Reuse existing structures where possible.

If schema changes are necessary:

- Preserve existing IDs.
- Preserve foreign-key relationships.
- Preserve historical references.
- Use soft archive/deactivation.
- Add suitable indexes and constraints.
- Prevent invalid merge relationships.
- Prevent circular or duplicate merge operations.
- Protect merge operations from concurrent execution.
- Maintain RLS.
- Avoid destructive migrations.

**Mandatory deliverable:**

Create one complete, consolidated SQL migration file containing all Phase 4 database changes.

Include all required:
- Tables.
- Columns.
- Constraints.
- Indexes.
- Functions.
- Triggers.
- RLS policy changes.
- Merge operation structures if needed.

The migration must be:
- Compatible with the actual current schema.
- Ordered correctly.
- Reviewed for syntax and dependencies.
- Safe to execute in the Supabase SQL Editor in one go.
- Designed to preserve existing records.

Provide its exact file path.

Do not claim that it has been executed unless it actually has been executed and verified.

If no migration is necessary, explain why.

### 15. Testing Requirements

Implement meaningful tests.

#### Store Management
- Create location.
- Edit location.
- Activate location.
- Deactivate location.
- Archive location.
- Reject duplicate or invalid locations.

#### Membership Management
- Assign user.
- Remove user.
- Assign multiple users to one location.
- Assign one user to multiple locations if supported.
- Prevent unauthorized location access.
- Verify module permissions remain independent.

#### Merge Workflow
- Merge two eligible locations.
- Merge multiple eligible locations.
- Create destination during merge.
- Select existing destination.
- Reject invalid source locations.
- Reject destination included among sources.
- Prevent duplicate submissions.
- Simulate a failed merge and verify rollback.
- Preserve source history.
- Preserve destination consistency.
- Verify inventory is not automatically transferred.

#### Historical Data
- Historical invoices remain unchanged.
- Historical sales remain unchanged.
- Historical user IDs remain unchanged.
- Historical store IDs remain unchanged.
- Device serials remain unchanged.
- Purchase costs remain unchanged.
- Reservations remain intact.
- Sold-device records remain intact.

#### Authorization
- Normal desktop user cannot merge locations.
- Normal desktop user cannot archive locations.
- Unauthorized administrator operations are rejected.
- RLS prevents unauthorized reads and writes.

#### Regression
- Users Management remains functional.
- Desktop authentication remains functional.
- Session revalidation remains functional.
- Offline workflows remain functional.
- Outbox data remains intact.
- Existing inventory reports remain accurate.

Run:
- TypeScript checks.
- Lint.
- Unit tests.
- Integration tests.
- Relevant database tests.
- Admin Dashboard production build.
- Desktop application build.

Do not ignore failures.

### 16. Documentation

Update:

`admin-dashboard/README.md`

Document:

- Store/warehouse data model.
- Difference between users and locations.
- Membership relationships.
- Archive/deactivation behavior.
- Partner lifecycle.
- Store merge workflow.
- Historical data preservation.
- Why a merge does not automatically move inventory.
- Authorization rules.
- Phase 5 dependencies.

### 17. Phase 4 Completion Criteria

Phase 4 is complete only when:

1. Stores and warehouses can be created and managed.
2. Multiple users can be associated with a location.
3. User memberships can be changed safely.
4. Inactive and archived locations are handled correctly.
5. Partner departure does not destroy historical information.
6. Store merging works safely.
7. Inventory is not accidentally moved or duplicated during a merge.
8. Historical transactions remain unchanged.
9. Audit events are recorded.
10. Authorization is enforced server-side.
11. Offline synchronization remains intact.
12. One consolidated SQL migration is ready and reviewed if required.
13. All relevant tests pass.
14. Both Admin Dashboard and desktop builds succeed.

---

## STRICT PHASE GATE

**STOP AFTER PHASE 4.**

Do not start Phase 5.

Do not implement inventory transfers.

Do not automatically move stock from source locations to a merged destination.

Do not implement unrelated inventory redesigns.

After completion, provide:

1. Architecture changes and decisions.
2. Store/warehouse model implemented.
3. User membership behavior.
4. Merge workflow and its safety rules.
5. How historical records are preserved.
6. How inventory ownership remains unchanged.
7. All created and modified files.
8. Exact SQL migration path, if applicable.
9. Security and authorization results.
10. Test and build results.
11. Any unresolved issues or limitations.
12. What Phase 5 must account for.

Leave the repository in a clean, buildable state.

Wait for my explicit approval before proceeding to Phase 5.