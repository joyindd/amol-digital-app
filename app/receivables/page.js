'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/db';
import { money, fmtDate, num } from '../../lib/calc';
import { waLink } from '../../lib/docText';

const BUCKETS = ['0-30', '31-60', '61-90', '90+'];

export default function ReceivablesPage() {
  const [rows, setRows] = useState([]);
  const [bucket, setBucket] = useState('all');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase()
        .from('v_receivables').select('*').order('age_days', { ascending: false });
      if (error) setErr(error.message);
      setRows(data || []);
      setLoading(false);
    })();
  }, []);

  const byBucket = useMemo(() => {
    const t = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    rows.forEach((r) => { t[r.bucket] = (t[r.bucket] || 0) + num(r.balance); });
    return t;
  }, [rows]);

  const total = rows.reduce((t, r) => t + num(r.balance), 0);
  const shown = bucket === 'all' ? rows : rows.filter((r) => r.bucket === bucket);

  function reminder(r) {
    return `नमस्कार ${r.customer_name},\n\nबिल ${r.invoice_no} (दिनांक ${fmtDate(r.invoice_date)}) ची बाकी रक्कम ${money(r.balance)} आहे.\nकृपया सोयीनुसार भरणा करावा.\n\nधन्यवाद.`;
  }

  return (
    <div className="shell">
      <h1 className="page">Who owes me</h1>
      {err && <div className="err">{err}</div>}

      <section className="card">
        <h2>Outstanding <span>एकूण येणे बाकी</span></h2>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-.02em' }}>{money(total)}</div>
        <div className="btnrow" style={{ marginTop: 14 }}>
          <button className={'btn ' + (bucket === 'all' ? '' : 'ghost')} onClick={() => setBucket('all')}>
            All ({rows.length})
          </button>
          {BUCKETS.map((b) => (
            <button key={b} className={'btn ' + (bucket === b ? '' : 'ghost')} onClick={() => setBucket(b)}>
              {b} days · {money(byBucket[b] || 0)}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Call list <span>oldest and largest first</span></h2>
        {loading ? <p className="note">Loading…</p> : shown.length === 0 ? (
          <p className="note">Nothing outstanding. </p>
        ) : (
          <table className="list">
            <thead>
              <tr>
                <th>Customer</th><th>Bill</th><th>Date</th><th className="right">Days</th>
                <th className="right">Balance</th><th />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.invoice_id}>
                  <td>
                    {r.customer_name}
                    {r.phone ? <div className="note" style={{ margin: 0 }}>{r.phone}</div> : null}
                  </td>
                  <td><Link href={`/invoices/${r.invoice_id}`}>{r.invoice_no}</Link></td>
                  <td>{fmtDate(r.invoice_date)}</td>
                  <td className="right">{r.age_days}</td>
                  <td className="right"><b>{money(r.balance)}</b></td>
                  <td className="right">
                    {r.phone && (
                      <a className="btn line" style={{ textDecoration: 'none', minHeight: 34, padding: '5px 12px' }}
                         href={waLink(r.phone, reminder(r))} target="_blank" rel="noreferrer">
                        Remind
                      </a>
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
