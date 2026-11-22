# Compu MSS — Public Inventory Viewer

A standalone, lightweight, read-only web application displaying live available devices across Compu MSS branches.

## Architecture & Isolation

- **Directory:** `public-mss-inventory/`
- **Framework:** Next.js (App Router), React, Tailwind CSS, TypeScript
- **Deployment:** Vercel (Root Directory: `public-mss-inventory`)
- **Backend:** Supabase PostgreSQL (Read-Only public view `vw_public_mss_inventory` and RPC)
- **Security:** Completely isolated. Uses only public anonymous key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`). Never exposes confidential fields (purchase costs, profit margins, serial numbers, customer data, internal audit logs).

## Development Setup

```bash
cd public-mss-inventory
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Production Build

```bash
cd public-mss-inventory
npm run build
npm run start
```

## Environment Variables

Configure in `.env.local` for local development, or in Vercel Project Settings for production:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Vercel Deployment Instructions

1. Connect the GitHub repository to Vercel.
2. In Project Settings > General:
   - **Root Directory:** `public-mss-inventory`
3. In Project Settings > Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy!
