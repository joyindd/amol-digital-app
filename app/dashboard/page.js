'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/db';
import { money, num, fmtDate } from '../../lib/calc';
import { exportWorkbook } from '../../lib/exportWorkbook';

export default function DashboardPage() {
  const [d, setD] = useState(null);
  const [buckets, setBuckets] = useState({});
  const [top, setTop] = useState([]);
  const [months, setMonths] = useState([]);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: dash } = await supabase().from('v_dashboard').select('*').limit(1).maybeSingle();
      setD(dash);
      const { data: rec } = await supabase().from('v_receivables').select('bucket,balance,customer_name,customer_id,invoice_no,age_days');
      const b = {};
      (rec || []).forEach((r) => { b[r.bucket] = (b[r.bucket] || 0) + num(r.balance); });
      setBuckets(b);
      const byCust = {};
      (rec || []).forEach((r) => {
        const k = r.customer_id || r.customer_name;
        byCust[k] = byCust[k] || { name: r.customer_name, id: r.customer_id, bal: 0, bills: 0, oldest: 0 };
        byCust[k].bal += num(r.balance);
        byCust[k].bills += 1;
        byCust[k].oldest = Math.max(byCust[k].oldest, r.age_days);
      });
      setTop(Object.values(byCust).sort((x, y) => y.bal - x.bal).slice(0, 10));
      const { data: m } = await supabase().from('v_monthly').select('*').order('ym', { ascending: false }).limit(6);
      setMonths(m || []);
    } catch (e) { setErr(e.message || String(e)); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function download() {
    setErr(''); setBusy(true);
    try { await exportWorkbook(); }
    catch (e) { setErr(e.message || String(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="shell">
      <h1 className="page">Dashboard</h1>
      {err && <div className="err">{err}</div>}

      <div className="kpi" style={{ marginBottom: 14 }}>
        <div className="box red"><span>Outstanding (checked)</span><b>{money(d?.outstanding_confirmed || 0)}</b></div>
        <div className="box"><span>Not yet checked</span><b>{money(d?.outstanding_unchecked || 0)}</b></div>
        <div className="box"><span>Open bills</span><b>{(d?.open_bills || 0).toLocaleString('en-IN')}</b></div>
        <div className="box"><span>Billed this month</span><b>{money(d?.billed_month || 0)}</b></div>
        <div className="box ok"><span>Received this month</span><b>{money(d?.received_month || 0)}</b></div>
        <div className="box"><span>Spent this month</span><b>{money(d?.spent_month || 0)}</b></div>
        <div className="box"><span>Money on account</span><b>{money(d?.unapplied_credit || 0)}</b></div>
        <div className="box"><span>Customers</span><b>{(d?.customers || 0).toLocaleString('en-IN')}</b></div>
      </div>

      <div className="btnrow" style={{ marginBottom: 16 }}>
        <button className="btn" onClick={download} disabled={busy}>
          {busy ? 'Building workbook…' : 'Export everything to Excel'}
        </button>
        <button className="btn ghost" onClick={load}>Refresh</button>
        <Link className="btn ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} href="/collections">Record a collection</Link>
        <Link className="btn ghost" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }} href="/expenses">Record an expense</Link>
      </div>

      <section className="card">
        <h2>How old the money is <span>वयानुसार बाकी</span></h2>
        <div className="kpi">
          {['0-30', '31-60', '61-90', '90+'].map((k) => (
            <div className="box" key={k}><span>{k} days</span><b>{money(buckets[k] || 0)}</b></div>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Who owes the most <span>top 10</span></h2>
        <table className="list">
          <thead><tr><th>Customer</th><th className="right">Bills</th><th className="right">Oldest</th><th className="right">Balance</th></tr></thead>
          <tbody>
            {top.map((t, i) => (
              <tr key={i}>
                <td>{t.id ? <Link href={`/customers/${t.id}`}>{t.name}</Link> : t.name}</td>
                <td className="right">{t.bills}</td>
                <td className="right">{t.oldest} days</td>
                <td className="right"><b>{money(t.bal)}</b></td>
              </tr>
            ))}
            {!top.length && <tr><td colSpan={4}><span className="note">Nothing outstanding yet.</span></td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Last six months <span>महिन्यानुसार</span></h2>
        <table className="list">
          <thead><tr><th>Month</th><th className="right">Billed</th><th className="right">Received</th><th className="right">Spent</th><th className="right">Net</th></tr></thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.ym}>
                <td>{m.ym}</td>
                <td className="right">{money(m.billed)}</td>
                <td className="right">{money(m.received)}</td>
                <td className="right">{money(m.spent)}</td>
                <td className="right"><b>{money(num(m.received) - num(m.spent))}</b></td>
              </tr>
            ))}
            {!months.length && <tr><td colSpan={5}><span className="note">No activity recorded yet.</span></td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
