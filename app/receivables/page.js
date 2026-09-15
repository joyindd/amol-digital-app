'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase, getOrg } from '../../lib/db';
import { money, fmtDate, num, today } from '../../lib/calc';
import { waLink } from '../../lib/docText';

const BUCKETS = ['0-30', '31-60', '61-90', '90+'];
const MODES = [
  { v: 'cash', l: 'Cash' }, { v: 'upi', l: 'UPI' }, { v: 'bank', l: 'Bank' },
  { v: 'cheque', l: 'Cheque' }, { v: 'personal_account', l: 'Personal a/c' },
];

export default function RecoveryPage() {
  const [org, setOrg] = useState(null);
  const [rows, setRows] = useState([]);
  const [events, setEvents] = useState({});
  const [view, setView] = useState('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('old');
  const [openRow, setOpenRow] = useState(null);
  const [panel, setPanel] = useState('pay');
  const [pay, setPay] = useState({ amount: '', mode: 'cash', date: today(), reference: '' });
  const [promise, setPromise] = useState({ date: '', amount: '', note: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase().from('v_receivables').select('*');
    if (error) setErr(error.message);
    setRows(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { (async () => { setOrg(await getOrg()); await load(); })(); }, [load]);

  async function loadEvents(invoiceId) {
    const { data } = await supabase()
      .from('recovery_events').select('*').eq('invoice_id', invoiceId)
      .order('event_at', { ascending: false }).limit(10);
    setEvents((e) => ({ ...e, [invoiceId]: data || [] }));
  }

  const totals = useMemo(() => {
    const t = { all: 0, '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0, due: 0, never: 0, unchecked: 0, uncheckedCount: 0 };
    rows.forEach((r) => {
      const b = num(r.balance);
      if (r.verify_status === 'unverified') { t.unchecked += b; t.uncheckedCount += 1; return; }
      t.all += b;
      t[r.bucket] = (t[r.bucket] || 0) + b;
      if (r.follow_up_due) t.due += b;
      if (!r.last_reminded_at) t.never += b;
    });
    return t;
  }, [rows]);

  const shown = useMemo(() => {
    let list = rows.slice().filter((r) => r.verify_status !== 'unverified');
    if (view === 'due') list = list.filter((r) => r.follow_up_due);
    else if (view === 'never') list = list.filter((r) => !r.last_reminded_at);
    else if (BUCKETS.includes(view)) list = list.filter((r) => r.bucket === view);
    if (q.trim()) {
      const s = q.toLowerCase();
      list = list.filter((r) => (r.customer_name + ' ' + r.invoice_no + ' ' + (r.phone || '')).toLowerCase().includes(s));
    }
    list.sort((a, b) => (sort === 'big' ? num(b.balance) - num(a.balance) : b.age_days - a.age_days));
    return list;
  }, [rows, view, q, sort]);

  function reminderText(r) {
    return `नमस्कार ${r.customer_name},\n\nबिल ${r.invoice_no} (दिनांक ${fmtDate(r.invoice_date)}) ची बाकी रक्कम ${money(r.balance)} आहे.\nकृपया सोयीनुसार भरणा करावा.\n\n${org?.name_mr || org?.name || ''}\n${org?.phone || ''}`;
  }

  async function markReminded(r) {
    try {
      await supabase().from('invoices').update({
        last_reminded_at: new Date().toISOString(),
        reminder_count: num(r.reminder_count) + 1,
      }).eq('id', r.invoice_id);
      await supabase().from('recovery_events').insert({
        org_id: org.id, invoice_id: r.invoice_id, customer_id: r.customer_id,
        kind: 'reminder', note: 'WhatsApp reminder sent',
      });
      await load();
      if (events[r.invoice_id]) await loadEvents(r.invoice_id);
    } catch (e) { setErr(e.message || String(e)); }
  }

  async function savePayment(r) {
    setErr(''); setBusy(true);
    try {
      if (num(pay.amount) <= 0) throw new Error('Enter the amount received.');
      const { error } = await supabase().from('payments').insert({
        org_id: org.id, invoice_id: r.invoice_id, customer_id: r.customer_id,
        pay_date: pay.date, amount: num(pay.amount), mode: pay.mode,
        reference: pay.reference || null,
      });
      if (error) throw error;
      await supabase().from('recovery_events').insert({
        org_id: org.id, invoice_id: r.invoice_id, customer_id: r.customer_id,
        kind: 'note', note: `Received ${money(pay.amount)}`,
      });
      setOpenRow(null);
      await load();
    } catch (e) { setErr(e.message || String(e)); } finally { setBusy(false); }
  }

  async function savePromise(r) {
    setErr(''); setBusy(true);
    try {
      if (!promise.date) throw new Error('Pick the date they promised.');
      await supabase().from('invoices').update({
        follow_up_date: promise.date, follow_up_note: promise.note || null,
      }).eq('id', r.invoice_id);
      await supabase().from('recovery_events').insert({
        org_id: org.id, invoice_id: r.invoice_id, customer_id: r.customer_id,
        kind: 'promise', note: promise.note || null,
        promised_date: promise.date, promised_amount: num(promise.amount) || null,
      });
      setOpenRow(null);
      await load();
    } catch (e) { setErr(e.message || String(e)); } finally { setBusy(false); }
  }

  async function clearFollowUp(r) {
    await supabase().from('invoices').update({ follow_up_date: null, follow_up_note: null }).eq('id', r.invoice_id);
    await load();
  }

  function openPanel(r, which) {
    const same = openRow === r.invoice_id && panel === which;
    setOpenRow(same ? null : r.invoice_id);
    setPanel(which);
    if (!same) {
      setPay({ amount: String(Math.round(num(r.balance))), mode: 'cash', date: today(), reference: '' });
      setPromise({ date: '', amount: String(Math.round(num(r.balance))), note: '' });
      if (which === 'history') loadEvents(r.invoice_id);
    }
  }

  const tile = (label, value, key) => (
    <button key={key} className={'btn ' + (view === key ? '' : 'ghost')} onClick={() => setView(key)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2, textAlign: 'left', padding: '10px 14px' }}>
      <span style={{ fontSize: 12, fontWeight: 600, opacity: 0.75 }}>{label}</span>
      <span style={{ fontSize: 17, fontWeight: 700 }}>{money(value)}</span>
    </button>
  );

  return (
    <div className="shell">
      <h1 className="page">Recovery</h1>
      {err && <div className="err">{err}</div>}

      <section className="card">
        <h2>Money outside <span>येणे बाकी</span></h2>
        <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-.02em', marginBottom: 6 }}>
          {money(totals.all)}
          <span className="note" style={{ display: 'inline', marginLeft: 10, fontSize: 14 }}>
            confirmed, across {shown.length} bills
          </span>
        </div>
        {totals.uncheckedCount > 0 && (
          <p className="note" style={{ marginTop: 0, marginBottom: 12 }}>
            Another <b>{money(totals.unchecked)}</b> across {totals.uncheckedCount} old bills has not been checked
            with the owner yet, so it is kept out of this figure.{' '}
            <Link href="/verify">Go through them</Link>
          </p>
        )}
        <div className="btnrow">
          {tile('All', totals.all, 'all')}
          {BUCKETS.map((b) => tile(b + ' days', totals[b] || 0, b))}
          {tile('Follow-up due', totals.due, 'due')}
          {tile('Never chased', totals.never, 'never')}
        </div>
      </section>

      <section className="card">
        <h2>Call list <span>{shown.length} bills</span></h2>
        <div className="btnrow" style={{ marginBottom: 12 }}>
          <input style={{ maxWidth: 260 }} placeholder="Search name, number, phone" value={q} onChange={(e) => setQ(e.target.value)} />
          <select style={{ maxWidth: 210 }} value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="old">Oldest first</option>
            <option value="big">Largest amount first</option>
          </select>
        </div>

        {loading ? <p className="note">Loading…</p> : shown.length === 0 ? (
          <p className="note">Nothing here. Either everyone has paid, or no bills are raised yet.</p>
        ) : (
          <table className="list">
            <thead>
              <tr>
                <th>Customer</th><th>Bill</th><th className="right">Days</th>
                <th className="right">Balance</th><th>Follow-up</th><th>Last chased</th><th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.invoice_id} style={{ background: r.follow_up_due ? '#FFF8E6' : undefined }}>
                  <td>
                    {r.customer_id ? <Link href={`/customers/${r.customer_id}`}>{r.customer_name}</Link> : r.customer_name}
                    {r.phone ? <div className="note" style={{ margin: 0 }}>{r.phone}</div> : null}
                  </td>
                  <td>
                    <Link href={`/invoices/${r.invoice_id}`}>{r.invoice_no}</Link>
                    <div className="note" style={{ margin: 0 }}>{fmtDate(r.invoice_date)}</div>
                  </td>
                  <td className="right">
                    <span className={'tag ' + (r.bucket === '90+' ? 'due' : r.bucket === '0-30' ? '' : 'part')}>{r.age_days}</span>
                  </td>
                  <td className="right">
                    <b>{money(r.balance)}</b>
                    <div className="note" style={{ margin: 0 }}>of {money(r.grand_total)}</div>
                  </td>
                  <td>
                    {r.follow_up_date ? (
                      <>
                        <b>{fmtDate(r.follow_up_date)}</b>
                        {r.follow_up_note ? <div className="note" style={{ margin: 0 }}>{r.follow_up_note}</div> : null}
                        <button className="btn danger" style={{ minHeight: 26, padding: '2px 8px', marginTop: 4 }}
                          onClick={() => clearFollowUp(r)}>clear</button>
                      </>
                    ) : <span className="note" style={{ margin: 0 }}>—</span>}
                  </td>
                  <td>
                    {r.last_reminded_at ? (
                      <>{fmtDate(r.last_reminded_at.slice(0, 10))}
                        <div className="note" style={{ margin: 0 }}>{r.reminder_count}x</div></>
                    ) : <span className="note" style={{ margin: 0 }}>never</span>}
                  </td>
                  <td className="right" style={{ whiteSpace: 'nowrap' }}>
                    {r.phone && (
                      <a className="btn line" style={{ textDecoration: 'none', minHeight: 32, padding: '4px 10px', marginRight: 6 }}
                        href={waLink(r.phone, reminderText(r))} target="_blank" rel="noreferrer"
                        onClick={() => markReminded(r)}>Remind</a>
                    )}
                    <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px', marginRight: 6 }} onClick={() => openPanel(r, 'pay')}>Payment</button>
                    <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px', marginRight: 6 }} onClick={() => openPanel(r, 'promise')}>Promise</button>
                    <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px' }} onClick={() => openPanel(r, 'history')}>History</button>

                    {openRow === r.invoice_id && (
                      <div style={{ textAlign: 'left', background: '#F7F9FC', border: '1px solid var(--line)', borderRadius: 8, padding: 12, marginTop: 10, whiteSpace: 'normal' }}>
                        {panel === 'pay' && (
                          <>
                            <div className="grid g4">
                              <div className="field"><label>Amount ₹</label>
                                <input type="number" min="0" step="any" value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} /></div>
                              <div className="field"><label>Mode</label>
                                <select value={pay.mode} onChange={(e) => setPay({ ...pay, mode: e.target.value })}>
                                  {MODES.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
                                </select></div>
                              <div className="field"><label>Date</label>
                                <input type="date" value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></div>
                              <div className="field"><label>Reference</label>
                                <input value={pay.reference} onChange={(e) => setPay({ ...pay, reference: e.target.value })} /></div>
                            </div>
                            <button className="btn" style={{ marginTop: 10 }} onClick={() => savePayment(r)} disabled={busy}>Record payment</button>
                          </>
                        )}
                        {panel === 'promise' && (
                          <>
                            <div className="grid g3">
                              <div className="field"><label>Promised to pay on</label>
                                <input type="date" value={promise.date} onChange={(e) => setPromise({ ...promise, date: e.target.value })} /></div>
                              <div className="field"><label>Amount promised ₹</label>
                                <input type="number" min="0" step="any" value={promise.amount} onChange={(e) => setPromise({ ...promise, amount: e.target.value })} /></div>
                              <div className="field"><label>Note</label>
                                <input value={promise.note} placeholder="spoke to owner, after Diwali" onChange={(e) => setPromise({ ...promise, note: e.target.value })} /></div>
                            </div>
                            <button className="btn" style={{ marginTop: 10 }} onClick={() => savePromise(r)} disabled={busy}>Save follow-up</button>
                          </>
                        )}
                        {panel === 'history' && (
                          (events[r.invoice_id] || []).length === 0
                            ? <p className="note" style={{ margin: 0 }}>No chasing recorded yet.</p>
                            : (events[r.invoice_id] || []).map((e) => (
                                <div key={e.id} style={{ fontSize: 14, padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                                  <b>{fmtDate(e.event_at.slice(0, 10))}</b> — {e.kind}
                                  {e.promised_date ? ` · promised ${fmtDate(e.promised_date)}` : ''}
                                  {e.note ? ` · ${e.note}` : ''}
                                </div>
                              ))
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
