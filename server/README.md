# PocketSend server

Node + Express + TypeScript + Postgres. It does five things:

1. **Email one-time-code sign in** (no passwords).
2. **Creates a Kora virtual account for each payment group** (sandbox).
3. **Records payments** when Kora's webhook says a transfer arrived.
4. **Pays out withdrawals** through Kora, protected by a second emailed code.
5. **Keeps a ledger** so a group can never withdraw more than it collected.

## Quick start (about 15 minutes)

```bash
cd server
npm install
cp .env.example .env      # then fill it in, steps below
npm run dev               # applies the database migration, then starts on http://localhost:3001
```

In a second terminal, from the project root: `npm install` then `npm run dev`, and open http://localhost:5173.
The React app forwards `/api` to the server by itself (see `vite.config.ts`), so there is no CORS to set up.

### 1. Database

Any Postgres works. The quickest free options:

- **Neon** (neon.tech) or **Supabase** (supabase.com): create a project and copy its connection string into `DATABASE_URL`.
- **Local**: install Postgres, `createdb pocketsend`, and use `postgres://youruser:yourpassword@localhost:5432/pocketsend`.

Tables are created automatically when the server starts (`migrations/001_init.sql`). `npm run migrate` does the same on its own.

### 2. Sign-in emails

With no `SMTP_*` settings, codes are **printed in the server terminal**, which is enough to develop with.
To send real email, fill in `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` and `MAIL_FROM` from any provider that
gives you SMTP details. Options that work for a hackathon:

- **Gmail**: turn on 2-step verification, create an "App password", use `smtp.gmail.com`, port 587, your address and that app password.
- **Brevo**, **Resend** or **Mailgun**: create an account, verify a sender address or domain, and copy their SMTP settings.
  Check each one's limits: some only let you email your own address until a domain is verified.

Messages sent from a free mailbox often land in spam, so tell testers to look there.

### 3. Kora sandbox

1. Log in to the Kora dashboard and **switch to Test mode**.
2. Settings > API Configuration: copy the **secret key** (`sk_test_...`) into `KORA_SECRET_KEY`. It never goes in the React app.
3. Keep `KORA_ENV=sandbox` and `KORA_VBA_BANK_CODE=000`.
4. **Webhook URL** (Settings > API Configuration): Kora must be able to reach your server, so on your own computer you need a tunnel,
   for example `cloudflared tunnel --url http://localhost:3001` or `ngrok http 3001`. Set the webhook URL to
   `https://<your-tunnel>/api/webhooks/kora`. It must be public and must not need a login.
   **You can skip this while building**: `POST /api/groups/:id/sync` (used by the dev button) pulls payments straight from Kora.
5. **Payout IP whitelisting** (Settings > Security > IP Whitelisting): Kora's docs say to whitelist the public IP of the server that
   requests payouts. Check whether sandbox requires it. If payouts are refused, add your public IP.

### 4. Try it

1. Sign in (the code appears in the server terminal).
2. Create a group. In the sandbox use the test BVN `22222222222`.
3. Use the dashed **Send a sandbox transfer** card (development only). Kora credits the virtual account, and the payment appears.
4. Withdraw. Use bank **United Bank for Africa (033)** and account **0000000000** for a successful sandbox payout.
   Bank **035** with `0000000000` fails, and **011** with `9999999999` is an invalid account (from Kora's test data).

## Tests

```bash
npm test          # 37 tests on an in-memory Postgres, with Kora replaced by a stand-in
npm run typecheck
```

They cover sign-in codes (lockout, expiry, single use), group creation (BVN never stored), webhooks (signature, duplicates,
verification), and withdrawals (code required, no double payout, no overspending, Kora timeouts).
`npm run fake-webhook -- <account number> 5000` sends a correctly signed fake payment to your local server (needs `SKIP_CHARGE_VERIFY=true`).

## How the money logic works

- **Kora pays out from one pooled merchant balance, not from each virtual account** (virtual accounts hold no money).
  So the server keeps its own ledger per group: `available = confirmed payments - Kora's pay-in fee - withdrawals that are processing or successful`.
  A failed withdrawal stops counting, so it gives the money back.
- **A withdrawal is written to the database first (inside a transaction that locks the group), and only then sent to Kora.**
  A crash can never pay money that was not recorded, and two simultaneous requests cannot spend the same money.
- **A timeout or a 5xx from Kora is never treated as a failed payout**, because Kora may have paid. The withdrawal stays "processing"
  until Kora's webhook or the reconcile job (every minute) learns the real result. Only a clear 4xx rejection marks it failed.
- **Webhooks**: the signature (HMAC SHA256 of the `data` object with your secret key) is checked, the charge is confirmed with Kora's
  charge query before it is recorded, the payment reference is unique so repeats are ignored, and anything unexpected returns an error so Kora retries (for up to 72 hours).
- **The BVN** is required by Kora to open a virtual account. It is sent to Kora and never written to the database or logs.
- **Sender identity**: Kora's webhook gives the sender's name, bank and a masked account number, so a payer is identified by bank + last 4 digits + name.

## Things to confirm in the sandbox (I could not test these against the real Kora)

The server is tested against a stand-in built from Kora's documentation, so these are the places where the real API might differ:

- The payout-status path `GET /merchant/api/v1/transactions/:reference` (marked in `src/kora.ts`).
- The `currency` value for bank account resolve (the docs show country codes such as `NG`).
- The `Authorization: Bearer <secret key>` header format.
- Whether the sandbox merchant balance is topped up when you credit a virtual account (payouts come from that balance).
- Whether virtual-account transactions include a timestamp (payments found by sync use the time they were noticed).
- Whether sandbox payouts need IP whitelisting.
- Who pays Kora's pay-in fee. Here the group bears it (it is deducted from what can be withdrawn). Change `getBalances` in `src/ledger.ts` if you decide otherwise.

## Before real money

- Check the licensing and compliance position: you would be holding other people's money. Ask a qualified person before going live.
- Get your own Kora account approved for live mode, then use `sk_live_` with `KORA_ENV=live`, a real `KORA_VBA_BANK_CODE`, and your real payout fee in `PAYOUT_FEE_RESERVE_KOBO`.
- Serve the app and API over HTTPS on the same domain (the session cookie becomes `Secure` when `NODE_ENV=production`).
- Set `DEV_TOOLS=false` and `SKIP_CHARGE_VERIFY=false` (the server will not start in production otherwise) and configure real SMTP.
- The in-memory rate limiter works for one server. Use your host's or Redis-based limiting when you run more.
- Expired sessions and old one-time codes stay in the database. Add a small cleanup job.
