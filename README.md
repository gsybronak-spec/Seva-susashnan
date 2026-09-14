# GSYB Event Registration & Attendance Portal

**Gujarat State Yog Board**
*Under Sports, Youth and Cultural Activities Department*

A campaign-based event registration and attendance management platform for
physical Yoga & Meditation camps (Yog ane Dhyan Shibir) — registration,
unique participant IDs, digital ID cards with QR codes, QR/manual check-in
with duplicate prevention, attendance, attendance-gated certificates and
CSV/Excel-friendly exports.

## Architecture

```
Gujarat State Yog Board          (organization — global branding, src/lib/brand.ts)
  └── Campaigns                  (e.g. Seva Sushasan Abhiyan — first-class entity)
        └── Events               (e.g. Yog ane Dhyan Shibir — per-event forms, dates, venue)
              └── Registrations  (participants with unique IDs + QR tokens)
                    └── Attendance (check-ins; UNIQUE(event_id, registration_number))
                          └── Certificates (attendance-gated, verifiable)
```

- Global identity (GSYB name, department line, logo, colors) lives in
  `src/lib/brand.ts` + `src/styles.css` + `public/logo-gsyb.png`.
- Campaign-level branding (title, slogan, logo, banner, colors) is configured
  per campaign in **Admin → Campaigns** and NEVER affects the global identity
  or other campaigns.
- Campaign image uploads go to the public `campaign-media` Supabase Storage
  bucket.

## Routes

| Route | Purpose |
|---|---|
| `/` | GSYB homepage with Campaigns section + open events |
| `/campaigns` | Public campaign listing |
| `/campaigns/{slug}` | Campaign page (theme, events, register CTA) |
| `/campaigns/{slug}/register` | Campaign registration (event form builder) |
| `/admin` | Admin console: Dashboard, Campaigns, Events, Check-In, Certificates, Settings, Admins |
| `/admin/checkin` | QR camera scan + manual check-in (mobile-first for event staff) |
| `/idcard` | Participant digital ID card (QR, print/PDF) |
| `/certificate` | Participant certificate lookup & download |
| `/verify/{cert}` | Public certificate verification |

## Quick start

```bash
npm install

cp .env.example .env   # fill in your Supabase project's values

npm run dev            # vite dev server (port 8080)
```

## Database setup (fresh Supabase project)

1. Create a new project at https://supabase.com (any region).
2. Copy `.env.example` → `.env` and fill in URL + keys
   (Settings → API in the Supabase dashboard).
3. Apply the schema **in one shot**:

   ```sql
   -- paste the full contents into the Supabase SQL editor and run,
   -- or use the Supabase CLI:
   supabase db push
   ```

   File: `supabase/migrations/0001_init_consolidated.sql`

   It creates the `campaigns`, `events`, `registrations`, `attendance`,
   `certificate_issues`, `districts` (34 Gujarat districts seeded), admin
   user tables, functions/triggers (participant-ID sequences, referral
   graph, certificate numbering), the public `campaign-media` storage
   bucket, all unique constraints (including duplicate-check-in prevention
   via `UNIQUE(event_id, registration_number)`), and seeds the initial
   **Seva Sushasan Abhiyan** campaign with a starter event.
4. First admin login: `/admin` with username `superadmin` and the
   `ADMIN_PASSWORD` you set in `.env` — you will be forced to set a real
   password immediately.

## Environment variables

See `.env.example`. Required:

| Variable | Where | Notes |
|---|---|---|
| `SUPABASE_URL` | server (secret) | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | server (secret) | Service-role key — never exposed |
| `SUPABASE_PUBLISHABLE_KEY` | server | Anon/publishable key |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` | client | Same values, safe to expose |
| `SESSION_SECRET` | server (secret) | Admin session signing (`openssl rand -base64 48`) |
| `ADMIN_PASSWORD` | server (secret) | First-time superadmin bootstrap only |
| `ADMIN_RESET_KEY` | server (secret) | Optional super-admin recovery key |

Never commit real values — `.env` is git-ignored.

## Deployment

### Vercel (configured)

`vite.config.ts` pins the Nitro preset to `vercel`; `npm run build` emits the
Vercel build-output bundle to `.vercel/output/` (serverless function
`__server` + static assets). Deploy either by importing the repo in the
Vercel dashboard (build command `npm run build`) or via CLI
(`npx vercel --prod`). Set every variable from `.env.example` in
Vercel → Settings → Environment Variables.

### Other targets

Change `nitro.preset` in `vite.config.ts` (e.g. `"cloudflare-module"`,
`"node-server"`) — Nitro supports all major hosts.

## Scripts

| Command | Action |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build (Vercel output) |
| `npm run lint` | ESLint |
| `node scripts/generate-admin-hash.mjs` | Generate a scrypt hash to seed an admin manually |

## Security notes

- All participant/attendance/certificate writes go through server functions
  with Zod validation and admin-session authorization; the client is never
  trusted for attendance status.
- Duplicate check-in is impossible at the database level.
- QR codes contain only a random per-participant token — no personal data.
- Row Level Security is enabled on all tables; the app talks to Supabase
  with the service-role key server-side only.
