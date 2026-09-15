'use client';

import { useEffect, useState } from 'react';
import { getOrg } from '../../lib/db';
import { today } from '../../lib/calc';
import EditableTable from '../../components/EditableTable';

const CATS = ['Flex roll / media', 'Ink', 'Frames / iron', 'Wood', 'Machine / spares', 'Vendor payment',
  'Labour', 'Fuel', 'Transport', 'Rent', 'Electricity', 'Phone / internet', 'Office', 'Other']
  .map((c) => ({ v: c, l: c }));
const MODES = [
  { v: 'cash', l: 'Cash' }, { v: 'upi', l: 'UPI' }, { v: 'bank', l: 'Bank / office' },
  { v: 'cheque', l: 'Cheque' }, { v: 'staff_account', l: 'Staff account' },
  { v: 'personal_account', l: 'Personal a/c' }, { v: 'party_adjustment', l: 'Party adjustment' },
];
const WHO = ['Kailas', 'Amol', 'Sanket', 'Office'].map((w) => ({ v: w, l: w }));

export default function ExpensesPage() {
  const [org, setOrg] = useState(null);
  useEffect(() => { (async () => setOrg(await getOrg()))(); }, []);
  if (!org) return <div className="shell"><p className="note">Loading…</p></div>;

  return (
    <div className="shell">
      <h1 className="page">Expenses</h1>
      <p className="note" style={{ marginTop: -8, marginBottom: 14 }}>
        Flex rolls, ink, frames, vendor payments, fuel, labour — whatever goes out. Keep the GST column filled
        where you have a proper bill and the CA can claim it.
      </p>
      <section className="card">
        <EditableTable
          table="expenses"
          select="id,expense_date,category,vendor,description,amount,gst_amount,mode,paid_by,bill_ref,notes,created_at"
          order={{ column: 'expense_date', ascending: false }}
          newDefaults={{ org_id: org.id, expense_date: today(), category: 'Flex roll / media', mode: 'cash', paid_by: 'Kailas' }}
          totalKeys={['amount', 'gst_amount']}
          searchKeys={['vendor', 'description', 'bill_ref', 'notes']}
          columns={[
            { key: 'expense_date', label: 'Date', type: 'date', width: 140 },
            { key: 'category', label: 'Head', type: 'select', options: CATS, width: 170 },
            { key: 'vendor', label: 'Paid to', type: 'text', width: 170 },
            { key: 'description', label: 'What for', type: 'text' },
            { key: 'amount', label: 'Amount', type: 'number', align: 'right', width: 110 },
            { key: 'gst_amount', label: 'GST', type: 'number', align: 'right', width: 90 },
            { key: 'mode', label: 'How paid', type: 'select', options: MODES, width: 140 },
            { key: 'paid_by', label: 'Paid by', type: 'select', options: WHO, width: 110 },
            { key: 'bill_ref', label: 'Bill no.', type: 'text', width: 120 },
          ]}
        />
      </section>
    </div>
  );
}
