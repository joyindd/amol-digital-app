'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, getOrg, getRateItems, getCustomers, nextDocNo, findOrCreateCustomer } from '../lib/db';
import { UNITS, areaOf, lineAmount, totals, money, trimNum, num, today, emptyLine } from '../lib/calc';
import { buildText, waLink } from '../lib/docText';
import { makeImage } from '../lib/docImage';
import PrintSheet from './PrintSheet';
import Payments from './Payments';

const COLS = {
  quotation: { table: 'quotations', lines: 'quotation_lines', fk: 'quotation_id', no: 'quote_no', date: 'quote_date', path: '/quotations' },
  invoice:   { table: 'invoices',   lines: 'invoice_lines',   fk: 'invoice_id',   no: 'invoice_no', date: 'invoice_date', path: '/invoices' },
};

function blankDoc() {
  return {
    doc_no: '', doc_date: today(), customer_id: null, customer_name: '', customer_phone: '',
    lang: 'mr', extra_charge: '', discount: '', gst_enabled: false, gst_rate: 18,
    advance_pct: 50, delivery_days: 3, valid_days: 7, notes: '', status: null, paid_amount: 0,
  };
}

export default function DocEditor({ kind, id }) {
  const C = COLS[kind];
  const router = useRouter();
  const isNew = id === 'new';

  const [org, setOrg] = useState(null);
  const [rates, setRates] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [doc, setDoc] = useState(blankDoc());
  const [lines, setLines] = useState([emptyLine(1)]);
  const [docId, setDocId] = useState(isNew ? null : id);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imgUrl, setImgUrl] = useState(null);
  const [copied, setCopied] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const o = await getOrg();
        setOrg(o);
        if (o) {
          setRates(await getRateItems(o.id));
          setCustomers(await getCustomers(o.id));
        }
        if (!isNew) {
          const { data: d, error } = await supabase().from(C.table).select('*').eq('id', id).single();
          if (error) throw error;
          setDoc({
            doc_no: d[C.no], doc_date: d[C.date], customer_id: d.customer_id,
            customer_name: d.customer_name || '', customer_phone: d.customer_phone || '',
            lang: d.lang, extra_charge: d.extra_charge, discount: d.discount,
            gst_enabled: d.gst_enabled, gst_rate: d.gst_rate,
            advance_pct: d.advance_pct ?? 50, delivery_days: d.delivery_days ?? 3,
            valid_days: d.valid_days ?? 7, notes: d.notes || '',
            status: d.status, paid_amount: d.paid_amount ?? 0,
          });
          const { data: ls } = await supabase().from(C.lines).select('*').eq(C.fk, id).order('sr');
          setLines(ls && ls.length ? ls : [emptyLine(1)]);
        }
        loaded.current = true;
      } catch (e) {
        setErr(e.message || String(e));
      }
    })();
  }, [C.date, C.fk, C.lines, C.no, C.table, id, isNew]);

  const sum = useMemo(() => totals(doc, lines), [doc, lines]);
  const text = useMemo(() => buildText(doc, lines, org, kind), [doc, lines, org, kind]);

  function setField(k, v) { setDoc((d) => ({ ...d, [k]: v })); setSaved(false); }

  function setLine(i, patch) {
    setLines((ls) => ls.map((l, k) => {
      if (k !== i) return l;
      const next = { ...l, ...patch };
      if ('size' in patch || 'unit' in patch) {
        next.sqft = next.unit === 'per_sqft' ? areaOf(next.size) : null;
      }
      return next;
    }));
    setSaved(false);
  }

  function applyPreset(i, value) {
    if (value === '') return;
    if (value === 'custom') {
      setLine(i, { item_name: '', item_name_mr: '', size: '', rate: '', remarks: '', sqft: null });
      return;
    }
    const r = rates.find((x) => x.id === value);
    if (!r) return;
    setLine(i, {
      item_name: r.name_en, item_name_mr: r.name_mr || '', size: r.size || '',
      rate: r.rate ? r.rate : '', unit: r.unit, remarks: r.remarks || '',
      sqft: r.unit === 'per_sqft' ? areaOf(r.size) : null,
      qty: num(lines[i].qty) > 0 ? lines[i].qty : 1,
    });
  }

  function addLine() { setLines((ls) => [...ls, emptyLine(ls.length + 1)]); }
  function delLine(i) { setLines((ls) => (ls.length > 1 ? ls.filter((_, k) => k !== i) : ls)); }

  async function save() {
    setErr(''); setBusy(true);
    try {
      const keep = lines.filter((l) => l.item_name || lineAmount(l) > 0);
      if (!keep.length) throw new Error('Add at least one item before saving.');
      const customerId = doc.customer_id || (await findOrCreateCustomer(org.id, doc.customer_name, doc.customer_phone));

      const header = {
        org_id: org.id,
        [C.date]: doc.doc_date,
        customer_id: customerId,
        customer_name: doc.customer_name || '',
        customer_phone: doc.customer_phone || null,
        lang: doc.lang,
        extra_charge: num(doc.extra_charge),
        discount: num(doc.discount),
        gst_enabled: doc.gst_enabled,
        gst_rate: num(doc.gst_rate),
        notes: doc.notes || null,
      };
      if (kind === 'quotation') {
        header.advance_pct = num(doc.advance_pct);
        header.delivery_days = num(doc.delivery_days);
        header.valid_days = num(doc.valid_days);
      }

      let theId = docId;
      if (!theId) {
        header[C.no] = await nextDocNo(org.id, kind, doc.doc_date);
        const { data, error } = await supabase().from(C.table).insert(header).select('id,' + C.no).single();
        if (error) throw error;
        theId = data.id;
        setDocId(theId);
        setField('doc_no', data[C.no]);
      } else {
        const { error } = await supabase().from(C.table).update(header).eq('id', theId);
        if (error) throw error;
      }

      await supabase().from(C.lines).delete().eq(C.fk, theId);
      const payload = keep.map((l, i) => ({
        [C.fk]: theId, sr: i + 1,
        item_name: l.item_name || '-', item_name_mr: l.item_name_mr || null,
        size: l.size || null, sqft: l.unit === 'per_sqft' ? num(l.sqft) : null,
        qty: num(l.qty) > 0 ? num(l.qty) : 1, rate: num(l.rate), unit: l.unit,
        remarks: l.remarks || null,
      }));
      const { error: le } = await supabase().from(C.lines).insert(payload);
      if (le) throw le;

      const { data: fresh } = await supabase().from(C.table).select('paid_amount,status').eq('id', theId).single();
      if (fresh) setDoc((d) => ({ ...d, paid_amount: fresh.paid_amount ?? 0, status: fresh.status }));

      setSaved(true);
      if (isNew) router.replace(`${C.path}/${theId}`);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function convertToBill() {
    setErr(''); setBusy(true);
    try {
      const invNo = await nextDocNo(org.id, 'invoice', today());
      const { data: inv, error } = await supabase().from('invoices').insert({
        org_id: org.id, invoice_no: invNo, invoice_date: today(), quotation_id: docId,
        customer_id: doc.customer_id, customer_name: doc.customer_name,
        customer_phone: doc.customer_phone || null, lang: doc.lang,
        extra_charge: num(doc.extra_charge), discount: num(doc.discount),
        gst_enabled: doc.gst_enabled, gst_rate: num(doc.gst_rate), notes: doc.notes || null,
      }).select('id').single();
      if (error) throw error;
      const payload = lines.filter((l) => l.item_name || lineAmount(l) > 0).map((l, i) => ({
        invoice_id: inv.id, sr: i + 1, item_name: l.item_name || '-', item_name_mr: l.item_name_mr || null,
        size: l.size || null, sqft: l.unit === 'per_sqft' ? num(l.sqft) : null,
        qty: num(l.qty) > 0 ? num(l.qty) : 1, rate: num(l.rate), unit: l.unit, remarks: l.remarks || null,
      }));
      await supabase().from('invoice_lines').insert(payload);
      await supabase().from('quotations').update({ status: 'converted' }).eq('id', docId);
      router.push('/invoices/' + inv.id);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true); setTimeout(() => setCopied(false), 2200);
    } catch {
      setErr('Copy blocked by the browser. Select the preview text and copy it by hand.');
    }
  }

  function showImage() {
    const c = makeImage(doc, lines, org, kind);
    if (c) setImgUrl(c.toDataURL('image/png'));
  }

  const title = kind === 'invoice' ? 'Bill' : 'Quotation';
  const paid = num(doc.paid_amount);

  return (
    <div className="shell">
      <h1 className="page">
        {docId ? `${title} ${doc.doc_no}` : `New ${title.toLowerCase()}`}
        {kind === 'invoice' && docId && (
          <span className={'tag ' + (paid >= sum.grand - 0.5 ? 'paid' : paid > 0 ? 'part' : 'due')} style={{ marginLeft: 10 }}>
            {paid >= sum.grand - 0.5 ? 'Paid' : paid > 0 ? 'Part paid' : 'Unpaid'}
          </span>
        )}
      </h1>

      {err && <div className="err">{err}</div>}
      {saved && <div className="okmsg">Saved.</div>}

      <section className="card">
        <h2>Customer <span>ग्राहक</span></h2>
        <div className="grid g4">
          <div className="field">
            <label htmlFor="cn">Customer name<b>ग्राहकाचे नाव</b></label>
            <input id="cn" list="custlist" value={doc.customer_name}
              onChange={(e) => {
                const v = e.target.value;
                const match = customers.find((c) => c.name === v);
                setDoc((d) => ({ ...d, customer_name: v, customer_id: match ? match.id : null,
                  customer_phone: match?.phone || d.customer_phone }));
                setSaved(false);
              }} />
            <datalist id="custlist">
              {customers.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>
          <div className="field">
            <label htmlFor="cp">Phone<b>मोबाईल नंबर</b></label>
            <input id="cp" value={doc.customer_phone} onChange={(e) => setField('customer_phone', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="dd">Date<b>दिनांक</b></label>
            <input id="dd" type="date" value={doc.doc_date} onChange={(e) => setField('doc_date', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="lg">Language<b>भाषा</b></label>
            <select id="lg" value={doc.lang} onChange={(e) => setField('lang', e.target.value)}>
              <option value="mr">मराठी</option>
              <option value="en">English</option>
              <option value="both">दोन्ही / Both</option>
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Items <span>{lines.length} lines</span></h2>
        <div className="tablewrap">
          <table className="items">
            <colgroup>
              <col style={{ width: 52 }} /><col style={{ width: '26%' }} /><col style={{ width: '13%' }} />
              <col style={{ width: '8%' }} /><col style={{ width: '11%' }} /><col style={{ width: '13%' }} />
              <col style={{ width: '16%' }} /><col style={{ width: '13%' }} />
            </colgroup>
            <thead>
              <tr>
                <th>Sr.</th><th>Item description</th><th>Size</th><th>Qty / Trips</th>
                <th>Rate ₹</th><th>Unit</th><th>Remarks</th><th className="right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="sr">
                    <span>{i + 1}</span>
                    {lines.length > 1 && <button type="button" onClick={() => delLine(i)} title="Remove">×</button>}
                  </td>
                  <td data-label="Item description">
                    <select className="preset" value="" onChange={(e) => applyPreset(i, e.target.value)}>
                      <option value="">— choose from rate list —</option>
                      {rates.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name_en}{r.size ? '  ·  ' + r.size : ''}{r.rate > 0 ? '  ·  ₹' + r.rate : '  ·  type the rate'}
                        </option>
                      ))}
                      <option value="custom">Custom item (type your own)</option>
                    </select>
                    <input value={l.item_name} placeholder="Type the item name"
                      onChange={(e) => setLine(i, { item_name: e.target.value, item_name_mr: '' })} />
                  </td>
                  <td data-label="Size">
                    <input value={l.size || ''} placeholder="10 x 4 ft" onChange={(e) => setLine(i, { size: e.target.value })} />
                    {l.unit === 'per_sqft' && (
                      <span className="hint">{num(l.sqft) > 0 ? trimNum(l.sqft) + ' sq.ft each' : 'type like 10 x 4 ft'}</span>
                    )}
                  </td>
                  <td data-label="Qty / Trips">
                    <input type="number" inputMode="decimal" min="0" step="any" value={l.qty}
                      onChange={(e) => setLine(i, { qty: e.target.value })} />
                  </td>
                  <td data-label="Rate ₹">
                    <input type="number" inputMode="decimal" min="0" step="any" value={l.rate}
                      onChange={(e) => setLine(i, { rate: e.target.value })} />
                  </td>
                  <td data-label="Unit">
                    <select value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })}>
                      {UNITS.map((u) => <option key={u.value} value={u.value}>{u.en}</option>)}
                    </select>
                  </td>
                  <td data-label="Remarks">
                    <input value={l.remarks || ''} onChange={(e) => setLine(i, { remarks: e.target.value })} />
                  </td>
                  <td data-label="Amount" className="amt">{money(lineAmount(l))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button className="btn ghost" style={{ width: '100%', marginTop: 12 }} onClick={addLine}>+ Add one more item</button>
      </section>

      <section className="card">
        <h2>Charges and tax <span>दर व कर</span></h2>
        <div className="check">
          <input id="gst" type="checkbox" checked={doc.gst_enabled} onChange={(e) => setField('gst_enabled', e.target.checked)} />
          <label htmlFor="gst" style={{ margin: 0, fontSize: 15 }}>Add GST</label>
        </div>
        <div className="grid g3">
          {doc.gst_enabled && (
            <div className="field">
              <label htmlFor="gr">GST %<b>जीएसटी टक्के</b></label>
              <input id="gr" type="number" step="0.5" min="0" value={doc.gst_rate} onChange={(e) => setField('gst_rate', e.target.value)} />
            </div>
          )}
          <div className="field">
            <label htmlFor="ex">Fitting / transport ₹<b>फिटिंग, वाहतूक</b></label>
            <input id="ex" type="number" min="0" step="any" value={doc.extra_charge} onChange={(e) => setField('extra_charge', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="di">Discount ₹<b>सूट</b></label>
            <input id="di" type="number" min="0" step="any" value={doc.discount} onChange={(e) => setField('discount', e.target.value)} />
          </div>
          {kind === 'quotation' && (
            <>
              <div className="field">
                <label htmlFor="ad">Advance %<b>आगाऊ रक्कम</b></label>
                <input id="ad" type="number" min="0" max="100" value={doc.advance_pct} onChange={(e) => setField('advance_pct', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="de">Delivery in days<b>किती दिवसात</b></label>
                <input id="de" type="number" min="0" value={doc.delivery_days} onChange={(e) => setField('delivery_days', e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="va">Rate valid for days<b>दर किती दिवस</b></label>
                <input id="va" type="number" min="0" value={doc.valid_days} onChange={(e) => setField('valid_days', e.target.value)} />
              </div>
            </>
          )}
        </div>
        <div className="field" style={{ marginTop: 11 }}>
          <label htmlFor="no">Note at the end<b>शेवटी लिहायची सूचना</b></label>
          <textarea id="no" value={doc.notes} onChange={(e) => setField('notes', e.target.value)} />
        </div>
      </section>

      <section className="card">
        <h2>What the customer sees <span>ग्राहकाला जाणारा मजकूर</span></h2>
        <div className="proof">
          <div className="msg">
            {text
              ? text.split('\n').map((ln, i) => (
                  <div key={i}>{ln.replace(/\*/g, '')}</div>
                ))
              : <span className="note">Add an item to see the message.</span>}
          </div>
          <div className="totalbar">
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-70)' }}>Total payable</div>
              <div className="note" style={{ marginTop: 4 }}>
                {doc.gst_enabled ? `includes ${trimNum(doc.gst_rate)}% GST ${money(sum.gst)}` : ''}
                {kind === 'invoice' && paid > 0 ? `   ·   received ${money(paid)}` : ''}
              </div>
            </div>
            <div className="num">{money(sum.grand)}</div>
          </div>
        </div>

        <div className="btnrow" style={{ marginTop: 12 }}>
          <button className="btn" onClick={save} disabled={busy}>{busy ? 'Working…' : docId ? 'Save changes' : `Save ${title.toLowerCase()}`}</button>
          <button className={'btn line' + (copied ? ' done' : '')} onClick={copyText} disabled={!text}>
            {copied ? 'Copied' : 'Copy text'}
          </button>
          <button className="btn line" onClick={showImage} disabled={!text}>Make image</button>
          <button className="btn line" onClick={() => window.print()} disabled={!text}>Print / PDF</button>
          {doc.customer_phone && text && (
            <a className="btn line" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}
               href={waLink(doc.customer_phone, text)} target="_blank" rel="noreferrer">
              Open in WhatsApp
            </a>
          )}
          {kind === 'quotation' && docId && (
            <button className="btn ghost" onClick={convertToBill} disabled={busy}>Make bill from this</button>
          )}
        </div>
        <p className="note">Save first if you changed something — the printed copy uses what is on screen.</p>
      </section>

      {kind === 'invoice' && docId && (
        <Payments invoiceId={docId} orgId={org?.id} customerId={doc.customer_id} grandTotal={sum.grand}
          onChange={async () => {
            const { data } = await supabase().from('invoices').select('paid_amount,status').eq('id', docId).single();
            if (data) setDoc((d) => ({ ...d, paid_amount: data.paid_amount, status: data.status }));
          }} />
      )}

      {imgUrl && (
        <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) setImgUrl(null); }}>
          <div className="ovbox">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imgUrl} alt="Document" />
            <p className="note">On a phone, press and hold the image to send it on WhatsApp.</p>
            <div className="btnrow" style={{ marginTop: 12 }}>
              <a className="btn" style={{ textDecoration: 'none', flex: 1, textAlign: 'center' }}
                 href={imgUrl} download={`${kind}-${doc.doc_no || 'draft'}.png`}>Download image</a>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setImgUrl(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <PrintSheet doc={doc} lines={lines} org={org} kind={kind} sum={sum} />
    </div>
  );
}
