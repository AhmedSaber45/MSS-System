        # Product Goals & Business Vision

## 1. Main Goal

Build one professional, reliable, and easy-to-use Windows desktop application for managing two separate business operations:

1. **Accessories Shop:** A fully local management system that works independently without an internet connection.
2. **MSS Business:** A shared business management system used by two physical shops, with cloud synchronization and offline capabilities.

The application must be simple enough for a shop employee to learn its basic workflows within approximately ten minutes.

The priority is reliable daily business operations, not unnecessary technical complexity.

## 2. Business Structure

### A. Accessories Shop

This section belongs exclusively to the user's accessories shop.

Its main characteristics:

- Completely local operation.
- Uses a local SQLite database.
- Works without internet.
- Does not depend on Supabase.
- Manages accessories products, purchases, inventory, sales, invoices, returns, reports, and backups.
- Must continue working even if the MSS cloud service is unavailable.

### B. MSS Business

MSS is a small shared business between two physical shops.

Its main characteristics:

- Both shops share the same business catalog.
- Each shop owns and maintains its own physical stock.
- Both shops can view the stock availability of both locations.
- Sales can be executed by either shop, regardless of where the sold device is physically stored.
- The selling branch and stock-source branch must be recorded separately.
- MSS profits are shared at the business level.
- Both installations synchronize business data through the cloud.
- The system supports offline operation and later synchronization.

## 3. Application Usage Requirements

- One Windows computer in each shop.
- Two installations in total.
- No user accounts or passwords in the initial version.
- No application serial-number licensing.
- No subscription fee for using the application.
- Accessories operations must not require internet access.
- MSS cloud synchronization requires internet connectivity.
- The application must remain usable during internet outages.
- Application updates should be delivered automatically when connectivity is available.
- Existing business data must remain intact after application updates.

## 4. Primary Business Goals

### Accessories Shop

The system should make it easy to:

- Manage products and their prices.
- Record purchases.
- Track available quantities.
- Process sales quickly.
- Apply discounts.
- Print invoices.
- Handle returns.
- Monitor low-stock and out-of-stock products.
- Understand actual revenue and gross profit.
- Review historical operations.
- Create and restore backups.

### MSS Business

The system should make it easy to:

- Maintain a shared catalog of laptop and monitor models.
- Track every physical device individually using its serial number.
- Know which shop physically holds each device.
- View both shops' stock availability.
- Sell devices from either shop's stock.
- Record the branch responsible for each sale.
- Negotiate selling prices and preserve the actual transaction details.
- Reserve devices.
- Record returns and physical transfers.
- View shared MSS revenue, costs, and gross profit.
- Synchronize operations safely between the two shops.

## 5. User Experience Goals

The application should feel straightforward and predictable.

### Interface

- Arabic-first interface.
- Full RTL support.
- Clear and consistent navigation.
- Readable typography.
- Large, accessible controls.
- Professional but practical visual design.
- Consistent terminology.
- Minimal unnecessary animations and visual distractions.

### Daily Usage

- Product search should be fast.
- Common operations should require as few steps as reasonably possible.
- Forms should contain only relevant fields.
- Important actions should be easy to find.
- Tables should be clear and easy to scan.
- Errors should explain what happened and how to proceed.
- Loading and synchronization states should be visible.
- Employees should not need programming or accounting knowledge to use normal workflows.

## 6. Data Accuracy Goals

The system must always preserve the distinction between the following concepts:

1. A catalog model and an individual physical device.
2. The shop that owns or stores a device and the shop that sells it.
3. The original list price and the actual negotiated selling price.
4. Revenue and gross profit.
5. A reservation and an available device.
6. A pending offline operation and a confirmed synchronized operation.
7. Branch sales performance and shared MSS profit.

Incorrect financial or inventory information is more harmful than an incomplete visual feature. Accuracy must always take priority.

## 7. Reliability Goals

The application must aim to provide:

- No silent data loss.
- No accidental duplicate sales.
- No duplicate serial numbers.
- No silent loss of pending synchronization operations.
- No accidental deletion of finalized invoices.
- Reliable local database persistence.
- Safe backups and restoration.
- Data preservation during application updates.
- Clear conflict detection and resolution.
- Accurate historical financial records.

## 8. Cost Goals

Prefer free or low-cost infrastructure wherever practical:

- Open-source development tools.
- Tauri for the desktop application.
- SQLite for local storage.
- Supabase within available plan limits.
- GitHub Releases for update distribution.

Do not introduce paid third-party services without explaining why they are necessary.

Do not assume that free hosting or database plans provide unlimited capacity or guaranteed permanent availability.

The architecture should allow infrastructure upgrades later without requiring a complete rewrite.

## 9. Financial Reporting Goals

### Accessories

Provide accurate reports for:
- Total sales.
- Revenue.
- Cost of goods sold.
- Gross profit.
- Discounts.
- Returns.
- Inventory value where supported.

### MSS

Provide shared business reports for:
- Total revenue.
- Device acquisition costs.
- Gross profit.
- Returns and reversals.
- Sales by executing branch.
- Inventory by physical location.

Branch sales reports are operational reports. They do not represent individual ownership of MSS profits.

Do not implement an assumed 50/50 profit distribution.

## 10. Long-Term Vision

Build a dependable internal business tool that can grow gradually.

Potential future improvements include:
- Expense management.
- More branches.
- More advanced analytics.
- Improved supplier management.
- Additional invoice formats.
- More detailed stock transfer workflows.
- Additional reporting capabilities.

These are future possibilities, not automatic requirements for the first version.

Do not implement features outside the active phase without explicit approval from the user.

## 11. Definition of Success

The project is successful when:

- Both business sections work reliably.
- Accessories remains fully functional offline.
- MSS data is shared correctly between both shops.
- Individual laptops and monitors are tracked accurately.
- Sales and stock attribution are correct.
- Financial calculations are trustworthy.
- Backups can be restored.
- Updates preserve business data.
- The interface is understandable to non-technical employees.
- The system can be used for real daily business operations.