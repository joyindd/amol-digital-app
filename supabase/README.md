# Database

The schema is already applied to the Supabase project
`alhakjlbmkbdxuouiygv` (region ap-south-1, Mumbai). Nothing needs to be run
for the app to work — this folder exists so the structure is written down.

## Tables

| Table | Holds |
|---|---|
| `orgs` | the shop itself (name, place, phone, GST number) |
| `org_members` | which signed-in users belong to the shop, and their role |
| `profiles` | staff details, one row per login |
| `customers` | customer master |
| `rate_items` | the rate card that fills the dropdown in a quotation line |
| `quotations` + `quotation_lines` | quotations |
| `invoices` + `invoice_lines` | bills. Lines are **copied** from the quotation, never linked, so changing a rate later never changes an old bill |
| `payments` | money received, by mode (cash, bank, UPI, cheque, personal account) |
| `recovery_events` | every chase, promise, call and visit against a bill |
| `doc_counters` | the running number per financial year |

## Views

- `v_receivables` — every unpaid bill with balance, age in days and a
  0-30 / 31-60 / 61-90 / 90+ bucket. This is the "Who owes me" screen.
- `v_customer_balance` — billed, received and outstanding per customer.
- `v_customer_ledger` — bills and payments merged into one dated list, used by
  the customer statement screen.

Invoices also carry `follow_up_date`, `follow_up_note`, `last_reminded_at` and
`reminder_count`, which drive the Recovery screen's filters, plus `is_legacy`,
`verify_status`, `verified_at`, `verified_by` and `verify_note` for checking
imported bills against the owner's memory.

`settle_invoice(invoice, action, amount, date, note, mode)` does a check in one
call — the money entry, the status change and the history line together.
Actions: `received`, `pending`, `writeoff`.

## Functions

- `next_doc_no(org, type, date)` — issues `QTN/2026-27/0001` and
  `INV/2026-27/0001`. Runs inside the database, so two people billing at the
  same second cannot produce the same number.
- `calc_line_amount(...)` — the one rule for a line amount: per sq.ft uses
  area x quantity x rate, lump sum uses the rate alone, everything else uses
  quantity x rate.
- Triggers recalculate every header total from its lines on any change, so a
  wrong total cannot be saved even if someone edits the page in the browser.
- `handle_new_user()` — on signup, creates the profile row, and makes the very
  first account the owner of the shop.

## Security

Row level security is on for all eleven tables. A row is only visible to a
signed-in user who is a member of that shop (`is_member(org_id)`). The
publishable key in the browser can therefore read nothing on its own.

## Adding staff later

The first signup becomes owner automatically. For everyone after that, they
sign up, then you run this once in the Supabase SQL editor:

```sql
insert into org_members (org_id, user_id, role)
select (select id from orgs limit 1), id, 'biller'
from auth.users where email = 'their-email@example.com';
```

Roles: `owner`, `biller`, `designer`, `staff`.
