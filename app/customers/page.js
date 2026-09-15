'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, getOrg } from '../../lib/db';
import { money, num, fmtDate } from '../../lib/calc';
import EditableTable from '../../components/EditableTable';

const VERIFY = [
  { v: 'open', l: 'Confirmed due' }, { v: 'unverified', l: 'Not checked' },
  { v: 'settled', l: 'Settled' }, { v: 'written_off', l: 'Written off' },
];

export default function CustomersPage() {
  const [org, setOrg] = useState(null);
  const [bal, setBal] = useState([]);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');

  const loadBal = useCallback(async () => {
    const { data, error } = await supabase().from('v_customer_balance').select('*').order('balance', { ascending: false }).limit(500);
    if (error) setErr(error.message);
    setBal(data || []);
  }, []);

  useEffect(() => { (async () => { setOrg(await getOrg()); await loadBal(); })(); }, [loadBal]);
  if (!org) return <div className="shell"><p className="note">Loading…</p></div>;

  const shown = bal.filter((r) => (r.name + ' ' + (r.phone || '')).toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="shell">
      <h1 className="page">Customers</h1>
      {err && <div className="err">{err}</div>}

      <section className="card">
        <h2>Customer master <span>edit any box directly</span></h2>
        <EditableTable
          table="customers"
          select="id,name,name_mr,phone,place,group_name,gstin,verify_status,legacy_notes,created_at"
          order={{ column: 'name', ascending: true }}
          newDefaults={{ org_id: org.id, verify_status: 'open' }}
          searchKeys={['name', 'name_mr', 'phone', 'place', 'group_name']}
          onChanged={loadBal}
          columns={[
            { key: 'name', label: 'Name', type: 'text', width: 220 },
            { key: 'name_mr', label: 'Marathi name', type: 'text', width: 200 },
            { key: 'phone', label: 'Mobile', type: 'text', width: 130 },
            { key: 'place', label: 'Place', type: 'text', width: 140 },
            { key: 'group_name', label: 'Group', type: 'text', width: 170 },
            { key: 'gstin', label: 'GST no.', type: 'text', width: 150 },
            { key: 'verify_status', label: 'Checked', type: 'select', options: VERIFY, width: 140 },
            { key: 'id', label: 'Account', type: 'readonly', width: 90,
              render: (r) => <Link href={`/customers/${r.id}`}>Statement</Link> },
          ]}
        />
      </section>

      <section className="card">
        <h2>Balances <span>{bal.length} customers</span></h2>
        <input style={{ maxWidth: 300, marginBottom: 12 }} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <table className="list">
          <thead>
            <tr><th>Name</th><th>Phone</th><th className="right">Billed</th><th className="right">Received</th>
              <th className="right">On account</th><th className="right">Balance</th><th>Last bill</th></tr>
          </thead>
          <tbody>
            {shown.slice(0, 200).map((r) => (
              <tr key={r.customer_id}>
                <td><Link href={`/customers/${r.customer_id}`}>{r.name}</Link></td>
                <td>{r.phone || ''}</td>
                <td className="right">{money(r.total_billed)}</td>
                <td className="right">{money(r.total_received)}</td>
                <td className="right">{num(r.on_account) > 0.5 ? money(r.on_account) : ''}</td>
                <td className="right"><b>{num(r.balance) > 0.5 ? money(r.balance) : '—'}</b></td>
                <td>{r.last_bill_date ? fmtDate(r.last_bill_date) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
