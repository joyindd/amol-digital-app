# Amol Digital — Billing & Quotations

Quotations, bills, payments and recovery for Amol Digital Flex Printer,
Manchar. Next.js on Vercel, Supabase Postgres behind it.

The database is already built and live. This folder is the app that sits on
top of it.

---

## Getting it online (about 15 minutes, no coding)

### 1. Put this folder on GitHub

If you have Git installed:

```bash
cd amol-digital
git init
git add .
git commit -m "First version"
```

Then create an empty repository on github.com (make it **private**) and follow
the two lines GitHub shows you for "push an existing repository".

No Git? On github.com create the private repository, click **uploading an
existing file**, and drag everything in this folder in. Do not upload
`node_modules` — it isn't here anyway.

### 2. Import into Vercel

1. Go to vercel.com and sign in with the same GitHub account.
2. **Add New → Project**, pick the repository, click **Import**.
3. Before clicking Deploy, open **Environment Variables** and add these two:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://alhakjlbmkbdxuouiygv.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_kPNePEzYI1N67vpq3CJfEw_RR3bQRQI` |

4. Click **Deploy**. In two or three minutes you get a URL like
   `amol-digital.vercel.app`. That is the shop's system.

Vercel's free Hobby plan is for personal, non-commercial use only. A shop
billing system is commercial, so move the project to a Pro team ($20/month)
once it is in real use.

### 3. Allow the login to work

In the Supabase dashboard: **Authentication → URL Configuration**. Set **Site
URL** to your new Vercel URL and add it under **Redirect URLs**. Without this,
sign-in works locally but not on the live site.

### 4. Create your account first

Open the URL, choose **Create an account**, and sign up with your email. The
first account becomes the owner of the shop. Everyone who signs up after that
sees nothing until you add them (see `supabase/README.md`).

If Supabase asks for email confirmation and you would rather skip it while
testing: **Authentication → Providers → Email**, turn off *Confirm email*.

### 5. A custom address (optional)

In Vercel → **Settings → Domains**, add something like
`billing.amoldigital.in` and point the DNS record where Vercel tells you.

---

## Running it on your own laptop first (optional)

Needs Node.js 18 or newer from nodejs.org.

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open http://localhost:3000

---

## What each screen does

**Quotations** — the table you already know. Pick an item from the rate list
and the name, size, rate and unit fill in; or choose "Custom item" and type
your own. Rate charged per unit, per board, per sq.ft (it reads `20 x 30 ft`
and works out the area), per trip for transport, per day for labour, per month
for hoarding rent, or lump sum for miscellaneous. Save, then Copy text, Make
image, Print/PDF, or Open in WhatsApp. **Make bill from this** copies the
whole quotation into a bill.

**Bills** — the same screen plus a payments section. Record cash, bank, UPI,
cheque, or money that landed in your personal account. Balance updates
immediately.

**Who owes me** — every unpaid bill, oldest and largest first, split into
0-30 / 31-60 / 61-90 / 90+ days. Each row has a **Remind** button that opens
WhatsApp with a Marathi reminder already written.

**Customers** — everyone, with total billed, total received and balance.

**Rate card** — change a rate and every new quotation uses it. Bills already
raised keep the rate they were made with.

## About the PDF

Print/PDF uses your browser's own print window, so Marathi prints correctly
without any font setup. On a laptop: Ctrl+P → Save as PDF. On Android Chrome:
menu → Share → Print → Save as PDF.

## Things worth knowing

- Nothing is calculated on trust. Line amounts and totals are recalculated
  inside the database on every save.
- Document numbers follow the Indian financial year and are issued by the
  database, so duplicates are impossible.
- The publishable key above is meant to be public. It grants nothing on its
  own — row level security means data only opens up after you sign in.
