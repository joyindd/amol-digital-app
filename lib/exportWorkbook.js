'use client';

import * as XLSX from 'xlsx';
import { supabase } from './db';

async function grab(table, select = '*', order) {
  const out = [];
  let from = 0;
  const step = 1000;
  for (;;) {
    let q = supabase().from(table).select(select).range(from, from + step - 1);
    if (order) q = q.order(order, { ascending: true });
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < step) break;
    from += step;
  }
  return out;
}

const sheet = (wb, name, rows) => {
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name.slice(0, 31));
};

export async function exportWorkbook() {
  const wb = XLSX.utils.book_new();

  const [customers, invoices, invLines, payments, allocs, expenses, receivables, ledgerCust, quotes, rates, monthly] =
    await Promise.all([
      grab('v_customer_balance', '*'),
      grab('invoices', 'invoice_no,invoice_date,customer_name,customer_phone,sub_total,discount,extra_charge,gst_enabled,gst_rate,gst_amount,grand_total,paid_amount,status,verify_status,is_legacy,notes,legacy_ref', 'invoice_date'),
      grab('invoice_lines', 'invoice_id,sr,item_name,size,qty,rate,unit,amount,remarks'),
      grab('payments', 'pay_date,amount,mode,received_by_name,counterparty,reference,notes,is_advance,invoice_id,customer_id,legacy_row', 'pay_date'),
      grab('payment_allocations', 'payment_id,invoice_id,amount'),
      grab('expenses', 'expense_date,category,vendor,description,amount,gst_amount,mode,paid_by,bill_ref,notes', 'expense_date'),
      grab('v_receivables', '*'),
      grab('v_customer_ledger', '*'),
      grab('quotations', 'quote_no,quote_date,customer_name,grand_total,status', 'quote_date'),
      grab('rate_items', 'name_en,name_mr,size,rate,unit,remarks,active', 'sort_order'),
      grab('v_monthly', '*'),
    ]);

  sheet(wb, 'Customers', customers);
  sheet(wb, 'Bills', invoices);
  sheet(wb, 'Bill Lines', invLines);
  sheet(wb, 'Collections', payments);
  sheet(wb, 'Allocations', allocs);
  sheet(wb, 'Expenses', expenses);
  sheet(wb, 'Outstanding', receivables);
  sheet(wb, 'Ledger', ledgerCust);
  sheet(wb, 'Quotations', quotes);
  sheet(wb, 'Rate Card', rates);
  sheet(wb, 'Month Summary', monthly);

  const d = new Date();
  const p = (n) => (n < 10 ? '0' + n : n);
  XLSX.writeFile(wb, `AmolDigital_${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.xlsx`);
}
