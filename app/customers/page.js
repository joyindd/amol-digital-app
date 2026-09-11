'use client';

import { useEffect, useState } from 'react';
import { supabase, getOrg } from '../../lib/db';
import { money, num, fmtDate } from '../../lib/calc';

export default function CustomersPage() {
  const [org, setOrg] = useState(null);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', place: '', gstin: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const { data, error } = await supabase().from('v_customer_balance').select('*').order('name');
    if (error) setErr(error.message);
    setRows(data || []);
    setLoading(false);
  }

  useEffect(() => { (async () => { setOrg(await getOrg()); await load(); })(); }, []);

  async function add() {
    setErr(''); setBusy(true);
    try {
      if (!form.name.trim()) throw new Error('Enter a name.');
      const { error } = await supabase().from('customers').insert({
        org_id: org.id, name: form.name.trim(), phone: form.phone || null,
        place: form.place || null, gstin: form.gstin || null,
      });
      if (error) throw error;
      setForm({ name: '', phone: '', place: '', gstin: '' });
      await load();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  const shown = rows.filter((r) => (r.name + ' ' + (r.phone || '')).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="shell">
      <h1 className="page">Customers</h1>
      {err && <div className="err">{err}</div>}

      <section className="card">
        <h2>Add a customer <span>नवीन ग्राहक</span></h2>
        <div className="grid g4">
          <div className="field"><label>Name</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          <div className="field"><label>Place</label>
            <input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} /></div>
          <div className="field"><label>GST number</label>
            <input value={form.gstin} onChange={(e) => setForm({ ...form, gstin: e.target.value })} /></div>
        </div>
        <button className="btn" style={{ marginTop: 12 }} onClick={add} disabled={busy}>Add customer</button>
      </section>

      <section className="card">
        <h2>All customers <span>{rows.length}</span></h2>
        <input style={{ maxWidth: 300, marginBottom: 12 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        {loading ? <p className="note">Loading…</p> : (
          <table className="list">
            <thead>
              <tr>
                <th>Name</th><th>Phone</th><th className="right">Billed</th>
                <th className="right">Received</th><th className="right">Balance</th><th>Last bill</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.customer_id}>
                  <td>{r.name}</td>
                  <td>{r.phone || ''}</td>
                  <td className="right">{money(r.total_billed)}</td>
                  <td className="right">{money(r.total_received)}</td>
                  <td className="right"><b>{num(r.balance) > 0.5 ? money(r.balance) : '—'}</b></td>
                  <td>{r.last_bill_date ? fmtDate(r.last_bill_date) : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
