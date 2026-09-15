'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/db';
import { money, num } from '../lib/calc';

/**
 * Inline-editable table over one database table.
 * Click a cell, type, tab or click away — it saves. No save button.
 *
 * columns: [{ key, label, type: 'text'|'number'|'date'|'select'|'readonly',
 *             options:[{v,l}], width, align, render(row) }]
 */
export default function EditableTable({
  table,
  columns,
  select = '*',
  order = { column: 'created_at', ascending: false },
  filter,                 // (query) => query
  newDefaults = {},       // defaults for the add row
  limit = 500,
  onChanged,
  searchKeys = [],
  totalKeys = [],
}) {
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState(newDefaults);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savedCell, setSavedCell] = useState(null);

  const load = useCallback(async () => {
    let query = supabase().from(table).select(select).order(order.column, { ascending: order.ascending }).limit(limit);
    if (filter) query = filter(query);
    const { data, error } = await query;
    if (error) setErr(error.message);
    setRows(data || []);
    setLoading(false);
  }, [table, select, order.column, order.ascending, limit, filter]);

  useEffect(() => { load(); }, [load]);

  async function saveCell(row, key, value) {
    const before = row[key];
    const clean = value === '' ? null : value;
    if (String(before ?? '') === String(clean ?? '')) return;
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [key]: clean } : r)));
    const { error } = await supabase().from(table).update({ [key]: clean }).eq('id', row.id);
    if (error) {
      setErr(error.message);
      setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, [key]: before } : r)));
      return;
    }
    setSavedCell(row.id + key);
    setTimeout(() => setSavedCell(null), 900);
    await load();
    if (onChanged) onChanged();
  }

  async function addRow() {
    setErr(''); setBusy(true);
    try {
      const payload = { ...newDefaults, ...draft };
      Object.keys(payload).forEach((k) => { if (payload[k] === '') payload[k] = null; });
      const { error } = await supabase().from(table).insert(payload);
      if (error) throw error;
      setDraft(newDefaults);
      await load();
      if (onChanged) onChanged();
    } catch (e) { setErr(e.message || String(e)); } finally { setBusy(false); }
  }

  async function removeRow(row) {
    if (!window.confirm('Delete this row permanently?')) return;
    const { error } = await supabase().from(table).delete().eq('id', row.id);
    if (error) { setErr(error.message); return; }
    await load();
    if (onChanged) onChanged();
  }

  const shown = useMemo(() => {
    if (!q.trim() || !searchKeys.length) return rows;
    const s = q.toLowerCase();
    return rows.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(s)));
  }, [rows, q, searchKeys]);

  const totals = useMemo(() => {
    const t = {};
    totalKeys.forEach((k) => { t[k] = shown.reduce((s, r) => s + num(r[k]), 0); });
    return t;
  }, [shown, totalKeys]);

  function cell(row, c) {
    if (c.render) return c.render(row);
    if (c.type === 'readonly') return <span className="ro">{row[c.key] ?? ''}</span>;
    const common = {
      defaultValue: row[c.key] ?? '',
      onBlur: (e) => saveCell(row, c.key, e.target.value),
      className: savedCell === row.id + c.key ? 'saved' : '',
    };
    if (c.type === 'select') {
      return (
        <select {...common} onChange={(e) => saveCell(row, c.key, e.target.value)}>
          <option value="">—</option>
          {c.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      );
    }
    if (c.type === 'number') return <input type="number" step="any" inputMode="decimal" style={{ textAlign: 'right' }} {...common} />;
    if (c.type === 'date') return <input type="date" {...common} />;
    return <input {...common} />;
  }

  function draftCell(c) {
    if (c.type === 'readonly') return <span className="ro" />;
    const v = draft[c.key] ?? '';
    const set = (val) => setDraft({ ...draft, [c.key]: val });
    if (c.type === 'select') {
      return (
        <select value={v} onChange={(e) => set(e.target.value)}>
          <option value="">—</option>
          {c.options.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      );
    }
    if (c.type === 'number') return <input type="number" step="any" inputMode="decimal" style={{ textAlign: 'right' }} value={v} onChange={(e) => set(e.target.value)} />;
    if (c.type === 'date') return <input type="date" value={v} onChange={(e) => set(e.target.value)} />;
    return <input value={v} placeholder={c.label} onChange={(e) => set(e.target.value)} />;
  }

  return (
    <div>
      {err && <div className="err">{err}</div>}
      {searchKeys.length > 0 && (
        <input style={{ maxWidth: 300, marginBottom: 10 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      )}
      <div className="tablewrap">
        <table className="grid">
          <thead>
            <tr>
              {columns.map((c) => <th key={c.key} style={{ width: c.width, textAlign: c.align || 'left' }}>{c.label}</th>)}
              <th style={{ width: 70 }} />
            </tr>
          </thead>
          <tbody>
            <tr className="newrow">
              {columns.map((c) => <td key={c.key}>{draftCell(c)}</td>)}
              <td>
                <button className="btn" style={{ minHeight: 34, padding: '4px 12px' }} onClick={addRow} disabled={busy}>
                  Add
                </button>
              </td>
            </tr>
            {loading ? (
              <tr><td colSpan={columns.length + 1}><span className="note">Loading…</span></td></tr>
            ) : shown.map((row) => (
              <tr key={row.id}>
                {columns.map((c) => <td key={c.key} style={{ textAlign: c.align || 'left' }}>{cell(row, c)}</td>)}
                <td>
                  <button className="btn danger" style={{ minHeight: 30, padding: '2px 8px' }} onClick={() => removeRow(row)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {totalKeys.length > 0 && (
              <tr className="totalrow">
                {columns.map((c, i) => (
                  <td key={c.key} style={{ textAlign: c.align || 'left' }}>
                    {i === 0 ? `${shown.length} rows` : totalKeys.includes(c.key) ? money(totals[c.key]) : ''}
                  </td>
                ))}
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="note">Click any box, change it, then click away — it saves by itself. The top row adds a new record.</p>
    </div>
  );
}
