import { money, trimNum, unitLabel, fmtDate, addDays, totals, lineAmount, num } from './calc';

const T = {
  mr: {
    quotation: 'कोटेशन', invoice: 'बिल',
    docNo: 'क्रमांक', date: 'दिनांक', customer: 'ग्राहक', gst: 'जीएसटी क्र.',
    sqft: 'चौ.फूट', sub: 'एकूण', extra: 'फिटिंग / वाहतूक', disc: 'सूट', gstL: 'जीएसटी',
    grand: 'एकूण देय रक्कम', adv: 'आगाऊ रक्कम', bal: 'उर्वरित रक्कम',
    paid: 'जमा रक्कम', due: 'बाकी रक्कम',
    del: 'डिलिव्हरी', days: 'दिवसांत', valid: 'हा दर', validEnd: 'पर्यंत लागू आहे.',
    thanks: 'धन्यवाद!',
  },
  en: {
    quotation: 'QUOTATION', invoice: 'INVOICE',
    docNo: 'No.', date: 'Date', customer: 'Customer', gst: 'GST no.',
    sqft: 'sq.ft', sub: 'Subtotal', extra: 'Fitting / transport', disc: 'Discount', gstL: 'GST',
    grand: 'Total payable', adv: 'Advance', bal: 'Balance',
    paid: 'Received', due: 'Balance due',
    del: 'Delivery', days: 'days', valid: 'This rate is valid till', validEnd: '.',
    thanks: 'Thank you!',
  },
};

function itemName(l, lang) {
  return lang === 'mr' && l.item_name_mr ? l.item_name_mr : l.item_name || '-';
}

function block(doc, lines, org, lang, kind) {
  const t = T[lang];
  const sum = totals(doc, lines);
  const o = [];
  const shopName = lang === 'mr' ? org?.name_mr || org?.name : org?.name || org?.name_mr;
  if (shopName) o.push('*' + shopName + '*');
  const head = [org?.place, org?.phone].filter(Boolean).join(' | ');
  if (head) o.push(head);
  if (org?.gstin) o.push(t.gst + ' ' + org.gstin);
  o.push('------------------------');
  o.push('*' + (kind === 'invoice' ? t.invoice : t.quotation) + '*');
  if (doc.doc_no) o.push(t.docNo + ' ' + doc.doc_no);
  o.push(t.date + ': ' + fmtDate(doc.doc_date));
  if (doc.customer_name) o.push(t.customer + ': ' + doc.customer_name);
  if (doc.customer_phone) o.push(doc.customer_phone);
  o.push('');

  lines.forEach((l, i) => {
    o.push(`${i + 1}) ${itemName(l, lang)}`);
    const amt = lineAmount(l);
    if (l.unit === 'per_sqft' && num(l.sqft) > 0) {
      const totalArea = num(l.sqft) * (num(l.qty) || 1);
      o.push(`   ${l.size || ''} | ${trimNum(totalArea)} ${t.sqft}`);
      o.push(`   ${money(l.rate)} x ${trimNum(totalArea)} ${t.sqft} = ${money(amt)}`);
    } else if (l.unit === 'lump_sum') {
      o.push(`   ${unitLabel(l.unit, lang)} = ${money(amt)}`);
    } else {
      const bits = [];
      if (l.size) bits.push(l.size);
      bits.push(`${trimNum(num(l.qty) || 1)} x ${money(l.rate)} (${unitLabel(l.unit, lang)})`);
      o.push('   ' + bits.join(' | '));
      o.push('   = ' + money(amt));
    }
    if (l.remarks) o.push(`   (${l.remarks})`);
  });

  o.push('');
  o.push('------------------------');
  if (lines.length > 1 || num(doc.extra_charge) > 0 || num(doc.discount) > 0 || doc.gst_enabled) {
    o.push(t.sub + ': ' + money(sum.sub));
  }
  if (num(doc.extra_charge) > 0) o.push(t.extra + ': ' + money(doc.extra_charge));
  if (num(doc.discount) > 0) o.push(t.disc + ': - ' + money(doc.discount));
  if (doc.gst_enabled) o.push(`${t.gstL} ${trimNum(doc.gst_rate)}%: ${money(sum.gst)}`);
  o.push('*' + t.grand + ': ' + money(sum.grand) + '*');
  o.push('------------------------');

  if (kind === 'invoice') {
    const paid = num(doc.paid_amount);
    if (paid > 0) {
      o.push(t.paid + ': ' + money(paid));
      o.push('*' + t.due + ': ' + money(sum.grand - paid) + '*');
    }
  } else {
    if (num(doc.advance_pct) > 0) {
      o.push(`${t.adv} (${trimNum(doc.advance_pct)}%): ${money(sum.advance)}`);
      o.push(t.bal + ': ' + money(sum.balance));
    }
    if (num(doc.delivery_days) > 0) {
      o.push(`${t.del}: ${fmtDate(addDays(doc.doc_date, doc.delivery_days))} (${trimNum(doc.delivery_days)} ${t.days})`);
    }
    if (num(doc.valid_days) > 0) {
      const v = fmtDate(addDays(doc.doc_date, doc.valid_days));
      o.push(lang === 'mr' ? `${t.valid} ${v} ${t.validEnd}` : `${t.valid} ${v}${t.validEnd}`);
    }
  }
  if (doc.notes) { o.push(''); o.push(doc.notes); }
  o.push('');
  o.push(t.thanks);
  return o.join('\n');
}

export function buildText(doc, lines, org, kind) {
  const shown = lines.filter((l) => l.item_name || lineAmount(l) > 0);
  if (!shown.length) return '';
  const lang = doc.lang || 'mr';
  if (lang === 'both') {
    return block(doc, shown, org, 'mr', kind) + '\n\n========================\n\n' + block(doc, shown, org, 'en', kind);
  }
  return block(doc, shown, org, lang, kind);
}

export function waLink(phone, text) {
  const clean = String(phone || '').replace(/\D/g, '');
  const n = clean.length === 10 ? '91' + clean : clean;
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
