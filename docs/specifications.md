# Functional & Technical Specifications

## 1. Application Overview

The application is a Windows desktop business management system containing two independent business sections:

1. Accessories Shop.
2. MSS Business.

The application must prioritize data accuracy, reliability, simplicity, and offline capabilities.

The interface must be Arabic-first with complete RTL support.

---

## 2. Technical Architecture

### 2.1 Desktop Application

- Framework: Tauri 2.
- Frontend: React.
- Language: TypeScript.
- Styling: Tailwind CSS.
- Icons: Lucide React.
- Desktop backend: Rust.
- Target platform: Windows.

The result must be a genuine desktop application with native desktop capabilities.

### 2.2 Local Database

- Database: SQLite.
- Access: Trusted Rust/Tauri database operations.
- Local data must persist independently of application updates.
- Store database files outside the installation directory.

### 2.3 MSS Cloud Database

- Platform: Supabase.
- Database: PostgreSQL.
- Security: Row Level Security.
- Sensitive operations must use trusted validation and database logic.

### 2.4 Automatic Updates

- Tauri Updater.
- Signed update packages.
- GitHub Releases distribution.
- Private signing credentials must never be committed to a public repository.

---

# PART A — APPLICATION STRUCTURE

## 3. Main Navigation

The application must contain two clearly separated sections:

### Accessories Shop

- Dashboard.
- Products.
- Purchases.
- Inventory.
- Sales.
- Invoices.
- Returns.
- Reports.
- Operation History.
- Backup & Restore.

### MSS Business

- Dashboard.
- Product Catalog.
- Inventory.
- Sales.
- Reservations.
- Invoices.
- Returns.
- Device Movements.
- Reports.
- Synchronization Status.

The navigation must clearly indicate which business section is currently active.

Do not mix the two sections' business records.

---

# PART B — ACCESSORIES SHOP

## 4. Accessories Products

Each product must support:

| Field | Description |
|---|---|
| Product ID | Unique identifier |
| Product Name | Product display name |
| Product Code | Internal code |
| Barcode | Optional barcode |
| Category | Optional product category |
| Purchase Cost | Default purchase cost |
| Selling Price | Default selling price |
| Quantity | Current available stock |
| Low Stock Threshold | Alert threshold |
| Description | Optional notes |
| Created At | Creation timestamp |
| Updated At | Last modification timestamp |

### Required Operations

- Add products.
- Edit products.
- Search products.
- Filter products.
- View product details.
- Scan barcodes using standard USB barcode scanners.
- Display low-stock products.
- Display out-of-stock products.

A barcode scanner that behaves like a keyboard must work without requiring specialized hardware integration.

## 5. Accessories Purchases

Purchase records must support:

- Purchase number.
- Purchase date.
- Optional supplier.
- Purchased products.
- Quantities.
- Unit purchase costs.
- Item totals.
- Purchase total.
- Optional notes.

Confirming a purchase must update inventory safely.

All related database updates must occur within a transaction.

## 6. Accessories Inventory

The inventory module must support:

- Current product quantities.
- Low-stock alerts.
- Out-of-stock alerts.
- Stock increases.
- Stock decreases.
- Manual stock adjustments.
- Adjustment reasons.
- Inventory movement history.

Inventory changes must be traceable.

Do not allow invalid quantities or unexplained inventory modifications.

## 7. Accessories Sales

### Point of Sale

The sales interface must support:

- Searching by product name.
- Searching by product code.
- Searching by barcode.
- Adding products to a cart.
- Removing products.
- Editing quantities.
- Applying item-level discounts.
- Applying invoice-level discounts where appropriate.
- Displaying subtotals.
- Displaying discounts.
- Displaying the final amount.
- Confirming the sale.
- Generating an invoice.

### Financial Data

Every finalized sale item must preserve:

- Product ID.
- Quantity.
- Original selling price.
- Discount.
- Actual selling price.
- Cost snapshot.
- Final line total.

Historical prices must not change when the product's current selling price changes.

### Inventory

Confirming a sale must deduct the sold quantity safely.

The sale and its inventory changes must be committed together.

Prevent duplicate submissions and accidental repeated sales.

## 8. Accessories Invoices

Invoices must support:

- Unique invoice number.
- Date and time.
- Product details.
- Quantities.
- Original prices.
- Discounts.
- Actual prices.
- Total amount.
- Appropriate business information.

Provide Arabic invoice layouts suitable for:

- A4 printing.
- Thermal receipt printing where supported.

The user must be able to view and print finalized invoices.

## 9. Accessories Returns & Cancellation

- Never permanently delete finalized invoices.
- Record returns as separate operations.
- Preserve references to the original sale.
- Record returned quantities and amounts.
- Restore inventory only according to the actual returned condition and applicable business rules.
- Support invoice cancellation through traceable reversal records.
- Preserve the full operation history.

## 10. Accessories Reports

Provide reports for:

- Daily sales.
- Weekly sales.
- Monthly sales.
- Custom date ranges.
- Total revenue.
- Cost of goods sold.
- Gross profit.
- Discounts.
- Returns.
- Best-selling products.
- Low-stock products.
- Inventory status.

Financial reports must use actual transaction snapshots.

## 11. Accessories Backup & Restore

Support:

- Manual backup.
- Automatic scheduled backup.
- Configurable retention count.
- Backup timestamps.
- Backup file validation.
- Restore from a selected backup.
- Exporting backups to USB or another external drive.

Before restoration:
- Explain that the current database will be replaced.
- Require explicit confirmation.
- Protect the current database with a backup where possible.
- Verify the restored database integrity.

Accessories operations must never depend on internet connectivity.

---

# PART C — MSS BUSINESS

## 12. MSS Business Structure

MSS is a shared business operated by two physical shops.

The system must distinguish:

- Shared business catalog.
- Individual physical inventory units.
- Shop 1 physical stock.
- Shop 2 physical stock.
- Selling branch.
- Stock-source branch.
- Shared business revenue and profit.

The two shops do not have one physically shared inventory.

Each shop has its own physical devices, but both can see the availability of both locations.

## 13. MSS Product Catalog

The catalog represents product models, not individual physical devices.

Each catalog model should support:

| Field | Description |
|---|---|
| Model ID | Unique model identifier |
| Brand | Manufacturer |
| Model Name | Model name |
| Category | Laptop or monitor, etc. |
| Processor | CPU information |
| RAM | Memory specifications |
| Storage | Storage specifications |
| Screen Size | Display size |
| Specifications | Additional details |
| Default List Price | Shared default selling price |
| Created At | Creation timestamp |
| Updated At | Last modification timestamp |

Additional specifications may be introduced when needed.

### Pricing Rules

- The default list price is normally shared.
- A controlled price override may be allowed when necessary.
- The seller can negotiate the final price during a sale.
- Historical sales must preserve their original price snapshots.

## 14. MSS Individual Inventory Units

Every physical laptop or monitor must have its own inventory record.

A model may have multiple physical units, but each unit must be tracked independently.

### Required Fields

| Field | Description |
|---|---|
| Unit ID | Unique physical unit identifier |
| Serial Number | Unique device serial number |
| Model ID | Linked catalog model |
| Purchase Cost | Acquisition cost |
| List Price | Applicable list price |
| Purchase Date | Acquisition date |
| Physical Condition | Cosmetic/physical condition |
| Stock Location | Shop 1 or Shop 2 |
| Status | Current unit status |
| Created At | Creation timestamp |
| Updated At | Last modification timestamp |

Additional device-specific specifications may be stored when appropriate.

### Serial Number Rules

- Serial numbers must be unique.
- Prevent duplicate serial numbers at the database level.
- Validate serial numbers before saving.
- Preserve serial numbers in invoices and inventory history.

### Supported Unit Statuses

- Available.
- Reserved.
- Sold.
- Under Maintenance.
- Returned.

## 15. MSS Inventory Screen

The inventory screen must show stock separately for both shops.

Example:

| Model | Shop 1 | Shop 2 | Total |
|---|---:|---:|---:|
| Lenovo T480 | 0 | 3 | 3 |
| Dell Latitude 5420 | 2 | 0 | 2 |

The combined total is a display calculation only.

Never use the combined total as a substitute for physical location records.

Users must be able to inspect individual units and their serial numbers.

## 16. MSS Sales Attribution & Stock Source

This is a critical business rule.

Every MSS sale must record two separate branch references:

1. Selling Branch.
2. Stock-Source Branch.

### Example

A laptop is physically stored at Shop 2.

A customer purchases it through Shop 1.

The system must:

- Attribute the sale to Shop 1.
- Deduct the device from Shop 2's stock.
- Preserve the device serial number.
- Mark the device as sold.
- Record the actual sale price.
- Record the discount.
- Preserve the original list price.
- Preserve the purchase cost snapshot.

A physical transfer is NOT required merely because one shop sold a device stored at the other shop.

Only record a physical transfer when the device was actually moved.

## 17. MSS Sales Pricing

For every finalized sale, preserve:

- Original list price snapshot.
- Discount amount or approved discount representation.
- Actual sale price.
- Purchase cost snapshot.
- Selling branch.
- Stock-source branch.
- Device serial number.
- Sale date and time.

The actual sale price is the basis for revenue and gross profit calculations.

Never recalculate historical sales using current catalog prices.

## 18. MSS Reservations

The system must allow a physical device to be reserved.

A reservation must:

- Reference an individual device.
- Record its reservation status.
- Record relevant reservation information.
- Make the reserved state visible to both shops after synchronization.
- Prevent normal online sale of a reserved unit.

Reservations must be handled carefully when a shop is offline.

If a reservation is created while offline, it must be marked as pending until confirmed by the shared system.

## 19. MSS Returns & Cancellations

- Preserve the original sale.
- Create a separate return or cancellation operation.
- Reference the original invoice and device.
- Record the return reason where applicable.
- Update the unit status appropriately.
- Update inventory according to the actual returned device condition.
- Preserve complete history.
- Reverse financial calculations through traceable records.

## 20. MSS Physical Device Movements

When a device is physically transferred between the two shops, record:

- Device ID.
- Serial number.
- Source shop.
- Destination shop.
- Movement date.
- Movement status.
- Relevant notes.

The inventory location must be updated safely.

Do not create transfer records for devices that were simply sold by a different branch without physically moving beforehand.

## 21. MSS Financial Reporting

MSS profit is shared at the business level.

### Gross Profit Calculation

Actual Sale Price - Purchase Cost Snapshot.

Reports must distinguish:

- Total revenue.
- Device acquisition costs.
- Gross profit.
- Returns and reversals.
- Sales by selling branch.
- Stock quantities by physical location.

Branch sales attribution is for operational reporting.

It does not represent individual ownership of the shared business profit.

Do not assume a 50/50 distribution or implement automatic profit distribution.

Profit-sharing arrangements are outside the initial application scope unless explicitly specified later.

---

# PART D — OFFLINE & SYNCHRONIZATION

## 22. MSS Local Data

Each installation must maintain the local data required for approved offline workflows.

The local MSS storage must be separate from the Accessories database.

The application must clearly distinguish cached information from confirmed cloud information.

## 23. Synchronization Outbox

Every local MSS business operation intended for synchronization must have:

- Stable UUID.
- Operation type.
- Local creation timestamp.
- Operation payload.
- Synchronization status.
- Retry metadata where necessary.

Possible synchronization statuses:

- Pending.
- Syncing.
- Synced.
- Conflict.
- Failed / Needs Attention.

## 24. Synchronization Behavior

The application must:

- Synchronize automatically when connectivity returns.
- Provide a manual synchronization action.
- Prevent duplicate operations.
- Retry temporary failures safely.
- Preserve pending operations.
- Show synchronization progress and errors.
- Avoid silently overwriting newer cloud information.
- Use idempotency checks.
- Validate important business rules on the trusted side.

## 25. Offline Conflict Limitation

If both shops lose internet connectivity, both devices may temporarily have outdated stock information.

The application cannot guarantee that the same physical device will never be sold twice while both devices are disconnected.

Required behavior:

- Mark offline transactions as pending.
- Preserve the complete local operation.
- Revalidate serial number and reservation status when reconnecting.
- Detect conflicts.
- Never silently delete a conflicting transaction.
- Present the conflict clearly for review.
- Keep an auditable history of the resolution.

Do not claim real-time availability while disconnected.

---

# PART E — SECURITY & DATA PROTECTION

## 26. Supabase Security

- Never expose the service-role key to the frontend.
- Use Row Level Security.
- Validate sensitive operations through trusted logic.
- Protect shared MSS records from unauthorized modification.
- Use appropriate constraints and indexes.
- Do not rely on frontend-only validation.

The initial application does not require user accounts or employee passwords.

Do not introduce a login system without explicit approval.

## 27. Local Database Protection

- Keep business data outside the application installation directory.
- Preserve local databases during updates.
- Use safe database migrations.
- Validate backups before relying on them.
- Protect current data during restore operations.

## 28. Storage Limitations

A separate data directory or drive protects data from normal application updates and reinstallations.

It does not protect against:
- Formatting the data drive.
- Physical drive failure.
- Theft or physical damage.

External backup copies are required for stronger protection.

---

# PART F — AUTOMATIC UPDATES

## 29. Update Distribution

Use Tauri Updater with signed packages distributed through GitHub Releases.

Requirements:

- Private signing key.
- Signed update metadata.
- Version checking.
- Update download.
- Safe installation.
- Graceful handling of missing internet.
- Clear user feedback.

## 30. Data Preservation During Updates

Application updates must never overwrite business databases.

Before risky database migrations:
- Validate compatibility.
- Back up important data.
- Apply migrations safely.
- Verify the resulting database.

If an update fails, the existing business data must remain recoverable.

---

# PART G — INITIAL VERSION SCOPE

## 31. Features Included

The first version includes:

- Accessories products.
- Accessories purchases.
- Accessories inventory.
- Accessories sales.
- Accessories invoices.
- Accessories returns.
- Accessories reports.
- Accessories backups and restoration.
- MSS shared catalog.
- MSS individual device inventory.
- MSS serial-number tracking.
- MSS per-shop stock visibility.
- MSS sales.
- MSS reservations.
- MSS returns.
- MSS physical movements.
- MSS shared financial reports.
- MSS offline synchronization.
- Automatic application updates.

## 32. Features Excluded Unless Approved

Do not implement:

- Expense management.
- Employee accounts.
- Payroll.
- Customer loyalty.
- Online payment gateways.
- E-commerce storefront.
- Advanced accounting integrations.
- Automated profit-sharing distribution.
- Additional branches beyond the two initial MSS shops.

These may be considered later.

---

# END OF SPECIFICATIONS