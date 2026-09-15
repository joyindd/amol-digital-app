'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/db';
import { money, fmtDate, num, today } from '../../lib/calc';

const MODES = [
  { v: 'cash', l: 'Cash' }, { v: 'upi', l: 'UPI' }, { v: 'bank', l: 'Bank' },
  { v: 'cheque', l: 'Cheque' }, { v: 'personal_account', l: 'Personal a/c' },
];

export default function VerifyPage() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('old');
  const [openRow, setOpenRow] = useState(null);
  const [form, setForm] = useState({ amount: '', mode: 'cash', date: today(), note: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [doneCount, setDoneCount] = useState(0);

  const load = useCallback(async () => {
    const { data, error } = await supabase()
      .from('invoices')
      .select('id,invoice_no,invoice_date,customer_id,customer_name,customer_phone,grand_total,paid_amount,verify_status,is_legacy')
      .eq('verify_status', 'unverified')
      .order('invoice_date')
      .limit(500);
    if (error) setErr(error.message);
    setRows((data || []).filter((r) => num(r.grand_total) - num(r.paid_amount) > 0.5));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => {
    let list = rows.slice();
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((r) => (r.customer_name + ' ' + r.invoice_no).toLowerCase().includes(s));
    }
    list.sort((a, b) => (sort === 'big'
      ? (num(b.grand_total) - num(b.paid_amount)) - (num(a.grand_total) - num(a.paid_amount))
      : new Date(a.invoice_date) - new Date(b.invoice_date)));
    return list;
  }, [rows, q, sort]);

  const pending = rows.reduce((t, r) => t + num(r.grand_total) - num(r.paid_amount), 0);

  async function act(r, action, amount) {
    setErr(''); setBusy(true);
    try {
      const { error } = await supabase().rpc('settle_invoice', {
        p_invoice: r.id,
        p_action: action,
        p_amount: amount === undefined ? null : num(amount),
        p_date: form.date || today(),
        p_note: form.note || null,
        p_mode: form.mode,
      });
      if (error) throw error;
      setRows((list) => list.filter((x) => x.id !== r.id));
      setDoneCount((c) => c + 1);
      setOpenRow(null);
      setForm({ amount: '', mode: 'cash', date: today(), note: '' });
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  function openFor(r) {
    const bal = num(r.grand_total) - num(r.paid_amount);
    setOpenRow(openRow === r.id ? null : r.id);
    setForm({ amount: String(Math.round(bal)), mode: 'cash', date: r.invoice_date, note: '' });
  }

  return (
    <div className="shell">
      <h1 className="page">Old bills to check</h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 14 }}>
        Bills brought in from the old books. Sit with Amol or the accountant, go down the list, and say what
        happened to each one. Nothing here counts as real outstanding money until it has been checked.
      </p>
      {err && <div className="err">{err}</div>}

      <section className="card">
        <h2>Waiting to be checked <span>तपासणी बाकी</span></h2>
        <div className="grid g3">
          <div>
            <div className="note" style={{ margin: 0 }}>Unchecked amount</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{money(pending)}</div>
          </div>
          <div>
            <div className="note" style={{ margin: 0 }}>Bills left</div>
            <div style={{ fontSize: 26, fontWeight: 700 }}>{rows.length}</div>
          </div>
          <div>
            <div className="note" style={{ margin: 0 }}>Checked in this sitting</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--ok)' }}>{doneCount}</div>
          </div>
        </div>
        <div className="btnrow" style={{ marginTop: 14 }}>
          <input style={{ maxWidth: 260 }} placeholder="Search name or bill number" value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ maxWidth: 220 }} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="old">Oldest first</option>
            <option value="big">Largest amount first</option>
          </select>
        </div>
      </section>

      <section className="card">
        <h2>The list <span>{shown.length} bills</span></h2>
        {loading ? <p className="note">Loading…</p> : shown.length === 0 ? (
          <p className="note">
            Nothing left to check. Old bills appear here after the historical import, and once checked they move
            to Recovery or close out.
          </p>
        ) : (
          <table className="list">
            <thead>
              <tr>
                <th>Bill</th><th>Date</th><th>Customer</th>
                <th className="right">Amount</th><th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const bal = num(r.grand_total) - num(r.paid_amount);
                return (
                  <tr key={r.id}>
                    <td><Link href={`/invoices/${r.id}`}>{r.invoice_no}</Link></td>
                    <td>{fmtDate(r.invoice_date)}</td>
                    <td>
                      {r.customer_id
                        ? <Link href={`/customers/${r.customer_id}`}>{r.customer_name}</Link>
                        : r.customer_name}
                      {r.customer_phone ? <div className="note" style={{ margin: 0 }}>{r.customer_phone}</div> : null}
                    </td>
                    <td className="right"><b>{money(bal)}</b></td>
                    <td className="right" style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn line" style={{ minHeight: 32, padding: '4px 10px', marginRight: 6 }}
                        onClick={() => act(r, 'received')} disabled={busy}>
                        Money received
                      </button>
                      <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px', marginRight: 6 }}
                        onClick={() => act(r, 'pending')} disabled={busy}>
                        Still due
                      </button>
                      <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px' }}
                        onClick={() => openFor(r)} disabled={busy}>
                        More…
                      </button>

                      {openRow === r.id && (
                        <div style={{ textAlign: 'left', background: '#F7F9FC', border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginTop: 10, whiteSpace: 'normal' }}>
                          <div className="grid g4">
                            <div className="field"><label>Amount received ₹</label>
                              <input type="number" min="0" step="any" value={form.amount}
                                onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                            <div className="field"><label>How it came in</label>
                              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                                {MODES.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                              </select></div>
                            <div className="field"><label>When (best guess is fine)</label>
                              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                            <div className="field"><label>Note</label>
                              <input value={form.note} placeholder="checked with Amol"
                                onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
                          </div>
                          <div className="btnrow" style={{ marginTop: 10 }}>
                            <button className="btn" onClick={() => act(r, 'received', form.amount)} disabled={busy}>
                              Save part payment
                            </button>
                            <button className="btn danger" onClick={() => act(r, 'writeoff')} disabled={busy}>
                              Write off — never coming
                            </button>
                          </div>
                          <p className="note">
                            A part payment leaves the rest showing in Recovery. A write-off closes the bill and is
                            recorded as an adjustment, so the CA can tell it apart from real collection.
                          </p>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
