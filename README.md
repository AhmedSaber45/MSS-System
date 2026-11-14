# MSS System — Shop Management System (نظام إدارة المحلين)

> Complete desktop application built with **Tauri v2 + React 19 + TypeScript + Tailwind CSS**, featuring an independent local **SQLite** database for accessories, and a shared cloud **Supabase PostgreSQL** database for laptops and monitors (MSS).

[![Release & Update Pipeline](https://github.com/AhmedSaber45/MSS-System/actions/workflows/release.yml/badge.svg)](https://github.com/AhmedSaber45/MSS-System/actions/workflows/release.yml)
[![Tests Passing](https://img.shields.io/badge/tests-120%2F120%20passing-brightgreen.svg)](tests/)
[![Tauri v2](https://img.shields.io/badge/Tauri-v2-blue.svg)](https://v2.tauri.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Key Architecture & Highlights

- **Dual-Database Architecture (Rule 6):**
  - **Accessories Module:** 100% independent local SQLite database stored at `%APPDATA%\ShopManagementSystem\accessories.db`. Fast barcode POS, inventory, purchases, returns, and reports.
  - **MSS Module (Laptops & Monitors):** Centralized cloud Supabase PostgreSQL database shared between Shop 1 and Shop 2.
- **Offline-First Synchronization (Phase 09):**
  - Full local operation outbox with stable UUID v4 idempotency.
  - Automatic background synchronization upon reconnection.
  - Transparent `DOUBLE_SALE` conflict detection and preservation with manual resolution workflow (Rule 10 & 25).
- **Physical Device Tracking by Unique Serial (Phase 07):**
  - Track individual laptops and monitors with unique serial numbers, physical conditions, locations, and inter-branch transfers.
- **Cross-Branch Commercial Operations (Phase 08):**
  - Shop 1 can sell units physically stored in Shop 2 with automated location stock deduction and operational sales attribution.
  - Strict Rule 16 compliance: MSS gross profit is shared at the whole-business level and never attributed individually to the executing shop.
- **Executive Dashboard & Reports (Phase 10):**
  - Unified KPIs, date-range filtering, and distinct financial breakdown (Accessories vs MSS vs Combined).
- **Signed Tauri Updates & Windows Installer (Phase 11):**
  - Minisign signed releases via GitHub Releases with automated pre-update data safeguard backups.
  - NSIS and MSI installers targeting Windows currentUser.

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 20+ (Node.js 22+ recommended)
- Rust (Cargo) & MSVC Build Tools (for desktop Tauri builds)
- Git

### 2. Installation
```bash
git clone https://github.com/AhmedSaber45/MSS-System.git
cd MSS-System
npm install
```

### 3. Environment Setup
Copy the example environment file:
```bash
cp .env.example .env
```
Configure your Supabase credentials:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Supabase Database Schema
Execute the consolidated migration in your Supabase SQL Editor:
- File path: `supabase/migrations/master_consolidated_mss_schema.sql`

### 5. Running Development
```bash
# Frontend development
npm run dev

# Full Tauri Desktop application
npm run tauri:dev
```

### 6. Running Test Suites
```bash
# Run all 120 automated verification tests
node --experimental-strip-types --test --test-concurrency=1 tests/products.test.mjs tests/purchases_inventory.test.mjs tests/sales_invoices.test.mjs tests/returns_reports_backup.test.mjs tests/mss_catalog.test.mjs tests/mss_inventory.test.mjs tests/mss_sales_reservations_returns.test.mjs tests/mss_offline_sync.test.mjs tests/unified_dashboard_reports.test.mjs tests/updater_release.test.mjs tests/final_qa_security_reliability.test.mjs
```

### 7. Building for Production
```bash
npm run build
npm run tauri:build
```

---

## 📖 Documentation
- [Setup and User Guide (دليل التثبيت والاستخدام الشامل)](docs/SETUP_AND_USER_GUIDE.md)
- [System Architecture Rules (قواعد البنية البرمجية)](rules.md)
- [System Specifications (مواصفات النظام الكاملة)](specifications.md)
