'use client';

import { useEffect, useState } from 'react';
import { supabase, getOrg } from '../../lib/db';
import { UNITS } from '../../lib/calc';

const blank = { name_en: '', name_mr: '', size: '', rate: '', unit: 'per_unit', remarks: '' };

export default function RatesPage() {
  const [org, setOrg] = useState(null);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blank);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function load(orgId) {
    const { data, error } = await supabase()
      .from('rate_items').select('*').eq('org_id', orgId).order('sort_order');
    if (error) setErr(error.message);
    setRows(data || []);
  }

  useEffect(() => { (async () => { const o = await getOrg(); setOrg(o); if (o) await load(o.id); })(); }, []);

  async function add() {
    setErr(''); setBusy(true);
    try {
      if (!form.name_en.trim()) throw new Error('Enter the item name.');
      const { error } = await supabase().from('rate_items').insert({
        org_id: org.id, name_en: form.name_en.trim(), name_mr: form.name_mr || null,
        size: form.size || null, rate: parseFloat(form.rate) || 0, unit: form.unit,
        remarks: form.remarks || null, sort_order: (rows.length ? rows[rows.length - 1].sort_order : 0) + 1,
      });
      if (error) throw error;
      setForm(blank);
      await load(org.id);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function updateRate(id, rate) {
    await supabase().from('rate_items').update({ rate: parseFloat(rate) || 0 }).eq('id', id);
    await load(org.id);
  }

  async function toggle(id, active) {
    await supabase().from('rate_items').update({ active: !active }).eq('id', id);
    await load(org.id);
  }

  return (
    <div className="shell">
      <h1 className="page">Rate card</h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 14 }}>
        This is the dropdown list that fills a quotation line. Change a rate here and every new quotation uses it —
        bills already made keep the old rate.
      </p>
      {err && <div className="err">{err}</div>}

      <section className="card">
        <h2>Add an item <span>नवीन दर</span></h2>
        <div className="grid g3">
          <div className="field"><label>Item name (English)</label>
            <input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
          <div className="field"><label>Name in Marathi</label>
            <input value={form.name_mr} onChange={(e) => setForm({ ...form, name_mr: e.target.value })} /></div>
          <div className="field"><label>Size</label>
            <input value={form.size} placeholder="10 x 4 ft" onChange={(e) => setForm({ ...form, size: e.target.value })} /></div>
          <div className="field"><label>Rate ₹</label>
            <input type="number" step="any" min="0" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} /></div>
          <div className="field"><label>Unit</label>
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>
              {UNITS.map((u) => <option key={u.value} value={u.value}>{u.en}</option>)}
            </select></div>
          <div className="field"><label>Remarks</label>
            <input value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
        </div>
        <button className="btn" style={{ marginTop: 12 }} onClick={add} disabled={busy}>Add to rate card</button>
      </section>

      <section className="card">
        <h2>Current rates <span>{rows.length} items</span></h2>
        <table className="list">
          <thead>
            <tr><th>Item</th><th>Size</th><th>Unit</th><th className="right">Rate ₹</th><th>Remarks</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ opacity: r.active ? 1 : 0.45 }}>
                <td>{r.name_en}{r.name_mr ? <div className="note" style={{ margin: 0 }}>{r.name_mr}</div> : null}</td>
                <td>{r.size || '-'}</td>
                <td>{UNITS.find((u) => u.value === r.unit)?.en}</td>
                <td className="right">
                  <input type="number" step="any" min="0" defaultValue={r.rate} style={{ maxWidth: 120, textAlign: 'right' }}
                    onBlur={(e) => updateRate(r.id, e.target.value)} />
                </td>
                <td>{r.remarks || ''}</td>
                <td className="right">
                  <button className="btn ghost" style={{ minHeight: 32, padding: '4px 10px' }} onClick={() => toggle(r.id, r.active)}>
                    {r.active ? 'Hide' : 'Show'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
