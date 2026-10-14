# PocketSend frontend

React + TypeScript + Tailwind CSS (v3) + Vite. Fonts: Plus Jakarta Sans (interface) and Space Mono (figures).

## How it works

An organizer signs in with their email (a one-time code is emailed to them) and creates a payment group. The server asks
Kora to open a **virtual account number for that group**. Anyone pays by making a normal bank transfer to that number.
Kora tells the server (webhook), the payment is saved in the database, and it appears on the organizer's dashboard, marked
**Full** or **Partial** (with the amount still remaining) for fixed-amount groups. The organizer withdraws to their own bank
account, protected by a second emailed code. There is no payment link and no payer page.

This is two programs:

| Folder | What it is |
| --- | --- |
| `/` (this folder) | The React app (Vite, TypeScript, Tailwind) |
| `server/` | The API: sign in codes, database, Kora, webhooks, withdrawals. **Setup guide: `server/README.md`** |

## Run it

```bash
# terminal 1: the API (needs a database and a Kora sandbox key, see server/README.md)
cd server && npm install && cp .env.example .env   # fill in .env
npm run dev

# terminal 2: the React app
npm install
npm run dev        # http://localhost:5173  (forwards /api to the server on port 3001)
```

There is no dummy data. Everything on screen comes from the database. In development, a dashed card on the dashboard asks
Kora's sandbox to send a test transfer to the group's account (the server needs `DEV_TOOLS=true`).

## How Full and Partial are decided (`src/lib/stats.ts`, `paymentCoverage`)

- Only for **fixed-amount** groups. Open-amount groups have nothing to compare against, so no indicator is shown.
- Payments are walked oldest to newest, adding up each sender's confirmed payments (grouped by `payerKey`).
- After a payment, if that sender's total has reached the group amount it is **Full**. Otherwise it is **Partial**,
  and the row shows the amount remaining and how much they have paid so far.
- Pending and failed payments do not count until they are confirmed.
- Your server should ideally send this already worked out, then delete the function.

## Where to change things

| To change | Edit |
| --- | --- |
| Colours (light and dark) | CSS variables at the top of `src/index.css` |
| Fonts | `index.html` (link) and `fontFamily` in `tailwind.config.js` |
| Breakpoints (sidebar appears at 900px) | `screens` in `tailwind.config.js` |
| Buttons, fields, tags, dialogs | `src/components/ui/` |
| Dashboard pieces | `src/components/dashboard/` |
| Money and date formatting | `src/lib/format.ts` (all amounts are integer kobo) |
| Every call to the server | `src/data/api.ts` (the only file that does it) |
| Server behaviour | `server/src/` (see `server/README.md`) |

## Structure

```
src/
  components/ui/ layout/ dashboard/ group/   Interface pieces
  pages/         SignIn, NewGroup, Dashboard, AppIndex, NotFound
  state/         theme, auth (asks the server who is signed in), groups (loads and refreshes from the server every 8 seconds)
  data/api.ts    The API client
  lib/           format, words, stats, limits, cn
server/
  src/           app, routes, kora client, ledger, otp, mailer, config
  migrations/    SQL schema
  test/          37 tests
```

## Still to build

- The server's webhook needs a public URL in Kora's dashboard (or use the sync button while developing).
- Group settings (pause, close), withdrawal history page, payment filters and search, receipts, CSV export.
- A cleanup job for old sessions and codes, and real rate limiting if you run more than one server.
