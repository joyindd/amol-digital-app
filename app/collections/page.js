'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase, getOrg, getCustomers } from '../../lib/db';
import { today, money, num } from '../../lib/calc';
import EditableTable from '../../components/EditableTable';

const MODES = [
  { v: 'cash', l: 'Cash' }, { v: 'upi', l: 'UPI' }, { v: 'bank', l: 'Bank / office' },
  { v: 'cheque', l: 'Cheque' }, { v: 'staff_account', l: 'Staff account' },
  { v: 'personal_account', l: 'Personal a/c' }, { v: 'party_adjustment', l: 'Party adjustment' },
  { v: 'adjustment', l: 'Write-off / adjustment' }, { v: 'unknown', l: 'Not recorded' },
];
const WHO = ['Kailas', 'Amol', 'Sanket', 'Office'];

export default function CollectionsPage() {
  const [org, setOrg] = useState(null);
  const [custs, setCusts] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => { (async () => {
    const o = await getOrg(); setOrg(o);
    if (o) setCusts(await getCustomers(o.id));
  })(); }, []);

  const custOptions = custs.map((c) => ({ v: c.id, l: c.name }));

  if (!org) return <div className="shell"><p className="note">Loading…</p></div>;

  return (
    <div className="shell">
      <h1 className="page">Collections</h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 14 }}>
        Every receipt, whether it sits against a bill or on the customer account. Leave the bill blank for money
        taken on account — attach it to a bill later from the customer statement.
      </p>
      <section className="card">
        <EditableTable
          table="payments"
          select="id,pay_date,customer_id,amount,mode,received_by_name,counterparty,reference,notes,is_advance,invoice_id,created_at"
          order={{ column: 'pay_date', ascending: false }}
          newDefaults={{ org_id: org.id, pay_date: today(), mode: 'cash', received_by_name: 'Kailas' }}
          totalKeys={['amount']}
          searchKeys={['reference', 'notes', 'counterparty', 'received_by_name']}
          onChanged={() => setTick(tick + 1)}
          columns={[
            { key: 'pay_date', label: 'Date', type: 'date', width: 140 },
            { key: 'customer_id', label: 'Customer', type: 'select', options: custOptions, width: 220 },
            { key: 'amount', label: 'Amount', type: 'number', align: 'right', width: 110 },
            { key: 'mode', label: 'How', type: 'select', options: MODES, width: 150 },
            { key: 'received_by_name', label: 'Taken by', type: 'select', options: WHO.map((w) => ({ v: w, l: w })), width: 120 },
            { key: 'counterparty', label: 'Party (adjustment)', type: 'text', width: 160 },
            { key: 'reference', label: 'Reference', type: 'text', width: 140 },
            { key: 'notes', label: 'Note', type: 'text' },
          ]}
        />
      </section>
    </div>
  );
}
