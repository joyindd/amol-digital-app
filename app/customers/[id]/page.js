'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase, getOrg } from '../../../lib/db';
import { money, fmtDate, num, today } from '../../../lib/calc';
import { waLink } from '../../../lib/docText';

const MODES = [
  { v: 'cash', l: 'Cash' }, { v: 'upi', l: 'UPI' }, { v: 'bank', l: 'Bank' },
  { v: 'cheque', l: 'Cheque' }, { v: 'personal_account', l: 'Personal a/c' },
];

export default function StatementPage({ params }) {
  const id = params.id;
  const [org, setOrg] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [open, setOpen] = useState([]);
  const [collect, setCollect] = useState({ amount: '', mode: 'cash', date: today(), reference: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data: c } = await supabase().from('customers').select('*').eq('id', id).single();
    setCustomer(c);
    const { data: l, error } = await supabase()
      .from('v_customer_ledger').select('*').eq('customer_id', id).order('entry_date');
    if (error) setErr(error.message);
    setLedger(l || []);
    const { data: o } = await supabase()
      .from('v_receivables').select('*').eq('customer_id', id).order('invoice_date');
    setOpen(o || []);
  }, [id]);

  useEffect(() => { (async () => { setOrg(await getOrg()); await load(); })(); }, [load]);

  const rows = useMemo(() => {
    let bal = 0;
    return ledger.map((e) => {
      bal += num(e.debit) - num(e.credit);
      return { ...e, running: bal };
    });
  }, [ledger]);

  const billed = ledger.reduce((t, e) => t + num(e.debit), 0);
  const received = ledger.reduce((t, e) => t + num(e.credit), 0);
  const balance = billed - received;

  // money received without naming a bill is spread over the oldest bills first
  async function collectMoney() {
    setErr(''); setBusy(true);
    try {
      let left = num(collect.amount);
      if (left <= 0) throw new Error('Enter the amount received.');
      const inserts = [];
      for (const b of open) {
        if (left <= 0) break;
        const take = Math.min(left, num(b.balance));
        inserts.push({
          org_id: org.id, invoice_id: b.invoice_id, customer_id: id,
          pay_date: collect.date, amount: take, mode: collect.mode,
          reference: collect.reference || null,
        });
        left -= take;
      }
      if (left > 0) {
        inserts.push({
          org_id: org.id, invoice_id: null, customer_id: id,
          pay_date: collect.date, amount: left, mode: collect.mode,
          reference: collect.reference || null, notes: 'advance / on account',
        });
      }
      const { error } = await supabase().from('payments').insert(inserts);
      if (error) throw error;
      setCollect({ amount: '', mode: 'cash', date: today(), reference: '' });
      await load();
    } catch (e) { setErr(e.message || String(e)); } finally { setBusy(false); }
  }

  function statementText() {
    const lines = [];
    lines.push('*' + (org?.name_mr || org?.name || '') + '*');
    if (org?.phone) lines.push(org.phone);
    lines.push('------------------------');
    lines.push('खाते उतारा / Statement');
    lines.push('ग्राहक: ' + (customer?.name || ''));
    lines.push('दिनांक: ' + fmtDate(today()));
    lines.push('');
    rows.forEach((e) => {
      lines.push(
        `${fmtDate(e.entry_date)}  ${e.kind === 'bill' ? 'बिल' : 'जमा'} ${e.ref}  ` +
        `${e.kind === 'bill' ? money(e.debit) : '- ' + money(e.credit)}`
      );
    });
    lines.push('');
    lines.push('एकूण बिल: ' + money(billed));
    lines.push('एकूण जमा: ' + money(received));
    lines.push('*बाकी रक्कम: ' + money(balance) + '*');
    lines.push('');
    lines.push('धन्यवाद!');
    return lines.join('\n');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(statementText());
      setCopied(true); setTimeout(() => setCopied(false), 2200);
    } catch { setErr('Copy blocked by the browser.'); }
  }

  if (!customer) return <div className="shell"><p className="note">Loading…</p></div>;

  return (
    <div className="shell">
      <h1 className="page">{customer.name}</h1>
      <p className="note" style={{ marginTop: -8 }}>
        {[customer.phone, customer.place, customer.gstin].filter(Boolean).join('  ·  ')}
      </p>
      {err && <div className="err">{err}</div>}

      <section className="card">
        <h2>Account <span>खाते</span></h2>
        <div className="grid g3">
          <div><div className="note" style={{ margin: 0 }}>Total billed</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{money(billed)}</div></div>
          <div><div className="note" style={{ margin: 0 }}>Total received</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{money(received)}</div></div>
          <div><div className="note" style={{ margin: 0 }}>Balance</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: balance > 0.5 ? 'var(--red)' : 'var(--ok)' }}>{money(balance)}</div></div>
        </div>
        <div className="btnrow" style={{ marginTop: 14 }}>
          <button className={'btn line' + (copied ? ' done' : '')} onClick={copy}>{copied ? 'Copied' : 'Copy statement'}</button>
          {customer.phone && (
            <a className="btn line" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
              href={waLink(customer.phone, statementText())} target="_blank" rel="noreferrer">Send on WhatsApp</a>
          )}
        </div>
      </section>

      {open.length > 0 && (
        <section className="card">
          <h2>Collect money <span>{open.length} bills open, oldest cleared first</span></h2>
          <div className="grid g4">
            <div className="field"><label>Amount received ₹</label>
              <input type="number" min="0" step="any" value={collect.amount} onChange={(e) => setCollect({ ...collect, amount: e.target.value })} /></div>
            <div className="field"><label>Mode</label>
              <select value={collect.mode} onChange={(e) => setCollect({ ...collect, mode: e.target.value })}>
                {MODES.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select></div>
            <div className="field"><label>Date</label>
              <input type="date" value={collect.date} onChange={(e) => setCollect({ ...collect, date: e.target.value })} /></div>
            <div className="field"><label>Reference</label>
              <input value={collect.reference} onChange={(e) => setCollect({ ...collect, reference: e.target.value })} /></div>
          </div>
          <button className="btn" style={{ marginTop: 12 }} onClick={collectMoney} disabled={busy}>
            {busy ? 'Saving…' : 'Record and split across bills'}
          </button>
          <p className="note">
            Open: {open.map((b) => `${b.invoice_no} ${money(b.balance)}`).join('  ·  ')}
          </p>
        </section>
      )}

      <section className="card">
        <h2>Statement <span>{rows.length} entries</span></h2>
        <table className="list">
          <thead>
            <tr><th>Date</th><th>Entry</th><th>Reference</th><th className="right">Bill</th><th className="right">Received</th><th className="right">Balance</th></tr>
          </thead>
          <tbody>
            {rows.map((e, i) => (
              <tr key={i}>
                <td>{fmtDate(e.entry_date)}</td>
                <td>{e.kind === 'bill' ? 'Bill' : 'Payment' + (e.mode ? ' · ' + (MODES.find((m) => m.v === e.mode)?.l || e.mode) : '')}</td>
                <td>{e.invoice_id ? <Link href={`/invoices/${e.invoice_id}`}>{e.ref}</Link> : e.ref}</td>
                <td className="right">{num(e.debit) > 0 ? money(e.debit) : ''}</td>
                <td className="right">{num(e.credit) > 0 ? money(e.credit) : ''}</td>
                <td className="right"><b>{money(e.running)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
