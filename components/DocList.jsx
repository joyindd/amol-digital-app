'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../lib/db';
import EditableTable from './EditableTable';
import { money, fmtDate, num } from '../lib/calc';

export default function DocList({ kind }) {
  const isInv = kind === 'invoice';
  const table = isInv ? 'invoices' : 'quotations';
  const noCol = isInv ? 'invoice_no' : 'quote_no';
  const dateCol = isInv ? 'invoice_date' : 'quote_date';
  const path = isInv ? '/invoices' : '/quotations';
  const title = isInv ? 'Bills' : 'Quotations';

  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase()
        .from(table).select('*').order(dateCol, { ascending: false }).limit(200);
      if (error) setErr(error.message);
      setRows(data || []);
      setLoading(false);
    })();
  }, [table, dateCol]);

  const shown = rows.filter((r) => {
    const s = (r.customer_name + ' ' + r[noCol]).toLowerCase();
    return s.includes(q.toLowerCase());
  });

  const thisMonth = rows.filter((r) => (r[dateCol] || '').slice(0, 7) === new Date().toISOString().slice(0, 7));
  const billedMonth = thisMonth.reduce((t, r) => t + num(r.grand_total), 0);
  const outstanding = isInv ? rows.reduce((t, r) => t + (num(r.grand_total) - num(r.paid_amount)), 0) : 0;

  return (
    <div className="shell">
      <h1 className="page">{title}</h1>
      {err && <div className="err">{err}</div>}

      {isInv && !loading && (
        <section className="card">
          <div className="grid g3">
            <div>
              <div className="note" style={{ margin: 0 }}>Billed this month</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{money(billedMonth)}</div>
            </div>
            <div>
              <div className="note" style={{ margin: 0 }}>Bills this month</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{thisMonth.length}</div>
            </div>
            <div>
              <div className="note" style={{ margin: 0 }}>Still outstanding</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: outstanding > 0.5 ? 'var(--red)' : 'var(--ok)' }}>
                {money(outstanding)}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="btnrow" style={{ marginBottom: 14 }}>
        <Link className="btn" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} href={`${path}/new`}>
          + New {isInv ? 'bill' : 'quotation'}
        </Link>
        <input style={{ maxWidth: 280 }} placeholder="Search name or number" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {isInv && (
        <section className="card">
          <h2>Quick edit <span>header fields — open a bill to change its lines</span></h2>
          <EditableTable
            table="invoices"
            select="id,invoice_no,invoice_date,customer_name,customer_phone,discount,extra_charge,grand_total,paid_amount,verify_status,notes,created_at"
            order={{ column: 'invoice_date', ascending: false }}
            searchKeys={['invoice_no', 'customer_name']}
            columns={[
              { key: 'invoice_no', label: 'Bill no.', type: 'text', width: 150 },
              { key: 'invoice_date', label: 'Date', type: 'date', width: 140 },
              { key: 'customer_name', label: 'Customer', type: 'text', width: 200 },
              { key: 'customer_phone', label: 'Phone', type: 'text', width: 130 },
              { key: 'discount', label: 'Discount', type: 'number', align: 'right', width: 100 },
              { key: 'extra_charge', label: 'Fitting', type: 'number', align: 'right', width: 100 },
              { key: 'grand_total', label: 'Total', type: 'readonly', align: 'right', width: 110,
                render: (r) => <span className="ro" style={{ textAlign: 'right' }}>{money(r.grand_total)}</span> },
              { key: 'paid_amount', label: 'Paid', type: 'readonly', align: 'right', width: 110,
                render: (r) => <span className="ro" style={{ textAlign: 'right' }}>{money(r.paid_amount)}</span> },
              { key: 'verify_status', label: 'Checked', type: 'select', width: 140,
                options: [{ v: 'open', l: 'Confirmed due' }, { v: 'unverified', l: 'Not checked' },
                          { v: 'settled', l: 'Settled' }, { v: 'written_off', l: 'Written off' }] },
              { key: 'notes', label: 'Note', type: 'text' },
              { key: 'id', label: 'Open', type: 'readonly', width: 80,
                render: (r) => <Link href={`/invoices/${r.id}`}>Open</Link> },
            ]}
          />
        </section>
      )}

      <section className="card">
        {loading ? <p className="note">Loading…</p> : shown.length === 0 ? (
          <p className="note">Nothing here yet.</p>
        ) : (
          <table className="list">
            <thead>
              <tr>
                <th>Number</th><th>Date</th><th>Customer</th>
                <th className="right">Total</th>
                {isInv && <th className="right">Balance</th>}
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const bal = num(r.grand_total) - num(r.paid_amount);
                return (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => { window.location.href = `${path}/${r.id}`; }}>
                    <td><Link href={`${path}/${r.id}`}>{r[noCol]}</Link></td>
                    <td>{fmtDate(r[dateCol])}</td>
                    <td>{r.customer_name || '-'}</td>
                    <td className="right">{money(r.grand_total)}</td>
                    {isInv && <td className="right">{money(bal)}</td>}
                    <td>
                      <span className={'tag ' + (isInv ? (bal <= 0.5 ? 'paid' : num(r.paid_amount) > 0 ? 'part' : 'due') : '')}>
                        {r.status}
                      </span>
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
