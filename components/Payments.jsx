'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/db';
import { money, num, today, fmtDate } from '../lib/calc';

const MODES = [
  { v: 'cash', l: 'Cash' },
  { v: 'bank', l: 'Bank transfer' },
  { v: 'upi', l: 'UPI' },
  { v: 'cheque', l: 'Cheque' },
  { v: 'personal_account', l: 'My personal account' },
  { v: 'adjustment', l: 'Adjustment' },
];

export default function Payments({ invoiceId, orgId, customerId, grandTotal, onChange }) {
  const [rows, setRows] = useState([]);
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState('cash');
  const [payDate, setPayDate] = useState(today());
  const [reference, setReference] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase().from('payments').select('*').eq('invoice_id', invoiceId).order('pay_date');
    setRows(data || []);
  }, [invoiceId]);

  useEffect(() => { load(); }, [load]);

  const paid = rows.reduce((t, r) => t + num(r.amount), 0);

  async function add() {
    setErr(''); setBusy(true);
    try {
      if (num(amount) === 0) throw new Error('Enter the amount received.');
      const { error } = await supabase().from('payments').insert({
        org_id: orgId, invoice_id: invoiceId, customer_id: customerId,
        pay_date: payDate, amount: num(amount), mode, reference: reference || null,
      });
      if (error) throw error;
      setAmount(''); setReference('');
      await load();
      if (onChange) await onChange();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    await supabase().from('payments').delete().eq('id', id);
    await load();
    if (onChange) await onChange();
  }

  return (
    <section className="card">
      <h2>Payments received <span>जमा रक्कम</span></h2>
      {err && <div className="err">{err}</div>}

      {rows.length > 0 && (
        <table className="list" style={{ marginBottom: 14 }}>
          <thead>
            <tr><th>Date</th><th>Mode</th><th>Reference</th><th className="right">Amount</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.pay_date)}</td>
                <td>{MODES.find((m) => m.v === r.mode)?.l || r.mode}</td>
                <td>{r.reference || ''}</td>
                <td className="right">{money(r.amount)}</td>
                <td className="right">
                  <button className="btn danger" style={{ minHeight: 32, padding: '4px 10px' }} onClick={() => remove(r.id)}>Remove</button>
                </td>
              </tr>
            ))}
            <tr>
              <td colSpan={3}><b>Balance still due</b></td>
              <td className="right"><b>{money(grandTotal - paid)}</b></td>
              <td />
            </tr>
          </tbody>
        </table>
      )}

      <div className="grid g4">
        <div className="field">
          <label htmlFor="pa">Amount received ₹</label>
          <input id="pa" type="number" min="0" step="any" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pm">How it came in</label>
          <select id="pm" value={mode} onChange={(e) => setMode(e.target.value)}>
            {MODES.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
        </div>
        <div className="field">
          <label htmlFor="pd">Date</label>
          <input id="pd" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="pr">Reference (optional)</label>
          <input id="pr" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI ref, cheque no." />
        </div>
      </div>
      <button className="btn" style={{ marginTop: 12 }} onClick={add} disabled={busy}>Add payment</button>
    </section>
  );
}
