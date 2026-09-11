'use client';

import { money, trimNum, unitLabel, fmtDate, addDays, lineAmount, num } from '../lib/calc';

const W = {
  mr: { quotation: 'कोटेशन', invoice: 'बिल', no: 'क्रमांक', date: 'दिनांक', customer: 'ग्राहक',
        sr: 'अ.क्र.', item: 'तपशील', size: 'साईज', qty: 'नग', rate: 'दर', unit: 'युनिट', rem: 'शेरा', amount: 'रक्कम',
        sub: 'एकूण', extra: 'फिटिंग / वाहतूक', disc: 'सूट', gst: 'जीएसटी', grand: 'एकूण देय रक्कम',
        adv: 'आगाऊ रक्कम', bal: 'उर्वरित रक्कम', paid: 'जमा रक्कम', due: 'बाकी रक्कम',
        del: 'डिलिव्हरी', valid: 'हा दर', validEnd: 'पर्यंत लागू आहे.', thanks: 'धन्यवाद!' },
  en: { quotation: 'QUOTATION', invoice: 'INVOICE', no: 'No.', date: 'Date', customer: 'Customer',
        sr: 'Sr.', item: 'Item description', size: 'Size', qty: 'Qty', rate: 'Rate', unit: 'Unit', rem: 'Remarks', amount: 'Amount',
        sub: 'Subtotal', extra: 'Fitting / transport', disc: 'Discount', gst: 'GST', grand: 'Total payable',
        adv: 'Advance', bal: 'Balance', paid: 'Received', due: 'Balance due',
        del: 'Delivery', valid: 'Valid till', validEnd: '.', thanks: 'Thank you!' },
};

export default function PrintSheet({ doc, lines, org, kind, sum }) {
  const lang = doc.lang === 'en' ? 'en' : 'mr';
  const t = W[lang];
  const shown = lines.filter((l) => l.item_name || lineAmount(l) > 0);
  if (!shown.length) return <div id="printSheet" />;
  const shopName = lang === 'mr' ? org?.name_mr || org?.name : org?.name || org?.name_mr;
  const paid = num(doc.paid_amount);

  return (
    <div id="printSheet">
      <div className="ps-head">
        <h3>{shopName}</h3>
        <div className="ps-sub">
          {[org?.place, org?.phone].filter(Boolean).join('  |  ')}
          {org?.gstin ? <><br />GST {org.gstin}</> : null}
        </div>
      </div>
      <div className="ps-meta">
        <div>
          <b>{kind === 'invoice' ? t.invoice : t.quotation}</b><br />
          {doc.doc_no ? <>{t.no} {doc.doc_no}<br /></> : null}
          {t.date}: {fmtDate(doc.doc_date)}
        </div>
        <div style={{ textAlign: 'right' }}>
          {doc.customer_name ? <b>{t.customer}: {doc.customer_name}</b> : null}
          {doc.customer_phone ? <><br />{doc.customer_phone}</> : null}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>{t.sr}</th><th>{t.item}</th><th>{t.size}</th><th className="r">{t.qty}</th>
            <th className="r">{t.rate}</th><th>{t.unit}</th><th>{t.rem}</th><th className="r">{t.amount}</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((l, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{lang === 'mr' && l.item_name_mr ? l.item_name_mr : l.item_name}</td>
              <td>{l.size || '-'}</td>
              <td className="r">
                {l.unit === 'per_sqft' && num(l.sqft) > 0
                  ? trimNum(num(l.sqft) * (num(l.qty) || 1)) + ' sq.ft'
                  : trimNum(num(l.qty) || 1)}
              </td>
              <td className="r">{money(l.rate)}</td>
              <td>{unitLabel(l.unit, lang)}</td>
              <td>{l.remarks || ''}</td>
              <td className="r">{money(lineAmount(l))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="ps-tot">
        <div><span>{t.sub}</span><span>{money(sum.sub)}</span></div>
        {num(doc.extra_charge) > 0 && <div><span>{t.extra}</span><span>{money(doc.extra_charge)}</span></div>}
        {num(doc.discount) > 0 && <div><span>{t.disc}</span><span>- {money(doc.discount)}</span></div>}
        {doc.gst_enabled && <div><span>{t.gst} {trimNum(doc.gst_rate)}%</span><span>{money(sum.gst)}</span></div>}
        <div className="big"><span>{t.grand}</span><span>{money(sum.grand)}</span></div>
        {kind === 'invoice' && paid > 0 && (
          <>
            <div><span>{t.paid}</span><span>{money(paid)}</span></div>
            <div className="big"><span>{t.due}</span><span>{money(sum.grand - paid)}</span></div>
          </>
        )}
      </div>

      <div className="ps-foot">
        {kind !== 'invoice' && num(doc.advance_pct) > 0 && (
          <>{t.adv} ({trimNum(doc.advance_pct)}%): {money(sum.advance)} &nbsp;|&nbsp; {t.bal}: {money(sum.balance)}<br /></>
        )}
        {kind !== 'invoice' && num(doc.delivery_days) > 0 && (
          <>{t.del}: {fmtDate(addDays(doc.doc_date, doc.delivery_days))}<br /></>
        )}
        {kind !== 'invoice' && num(doc.valid_days) > 0 && (
          <>{t.valid} {fmtDate(addDays(doc.doc_date, doc.valid_days))}{lang === 'mr' ? ' ' + t.validEnd : t.validEnd}<br /></>
        )}
        {doc.notes ? <>{doc.notes}<br /></> : null}
        <br />{t.thanks}
      </div>
    </div>
  );
}
