import { money, trimNum, unitLabel, fmtDate, addDays, totals, lineAmount, num } from './calc';

const FONT = '"Segoe UI",system-ui,"Nirmala UI","Noto Sans Devanagari",Mangal,sans-serif';

const L10N = {
  mr: { quotation: 'कोटेशन', invoice: 'बिल', docNo: 'क्रमांक', date: 'दिनांक', customer: 'ग्राहक',
        sr: 'अ.क्र.', item: 'तपशील', size: 'साईज', qty: 'नग', rate: 'दर', amount: 'रक्कम', sqft: 'चौ.फूट',
        sub: 'एकूण', extra: 'फिटिंग / वाहतूक', disc: 'सूट', gst: 'जीएसटी', grand: 'एकूण देय रक्कम',
        adv: 'आगाऊ रक्कम', bal: 'उर्वरित रक्कम', paid: 'जमा रक्कम', due: 'बाकी रक्कम',
        del: 'डिलिव्हरी', valid: 'हा दर', validEnd: 'पर्यंत लागू आहे.', thanks: 'धन्यवाद!' },
  en: { quotation: 'QUOTATION', invoice: 'INVOICE', docNo: 'No.', date: 'Date', customer: 'Customer',
        sr: 'Sr.', item: 'Item description', size: 'Size', qty: 'Qty', rate: 'Rate', amount: 'Amount', sqft: 'sq.ft',
        sub: 'Subtotal', extra: 'Fitting / transport', disc: 'Discount', gst: 'GST', grand: 'Total payable',
        adv: 'Advance', bal: 'Balance', paid: 'Received', due: 'Balance due',
        del: 'Delivery', valid: 'Valid till', validEnd: '.', thanks: 'Thank you!' },
};

function wrap(ctx, text, maxW) {
  const words = String(text || '').split(/\s+/);
  const out = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { out.push(cur); cur = w; }
    else cur = test;
  }
  if (cur) out.push(cur);
  return out.length ? out : [''];
}

export function makeImage(doc, lines, org, kind) {
  const shown = lines.filter((l) => l.item_name || lineAmount(l) > 0);
  if (!shown.length) return null;
  const lang = doc.lang === 'en' ? 'en' : 'mr';
  const t = L10N[lang];
  const sum = totals(doc, shown);
  const W = 1080, dpr = 2, MAXH = 4200;

  const c = document.createElement('canvas');
  c.width = W * dpr; c.height = MAXH * dpr;
  const x = c.getContext('2d');
  x.scale(dpr, dpr);
  x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, MAXH);
  x.textBaseline = 'top';

  const shopName = lang === 'mr' ? org?.name_mr || org?.name : org?.name || org?.name_mr;
  x.fillStyle = '#101A2B'; x.fillRect(0, 0, W, 132);
  x.fillStyle = '#FFFFFF'; x.font = '700 36px ' + FONT;
  x.fillText(shopName || '', 44, 28);
  x.fillStyle = '#B9C6D6'; x.font = '400 19px ' + FONT;
  let sub = [org?.place, org?.phone].filter(Boolean).join('   |   ');
  if (org?.gstin) sub += (sub ? '   |   ' : '') + 'GST ' + org.gstin;
  x.fillText(sub, 44, 78);
  ['#0A7EA4', '#C2185B', '#F2B705', '#101A2B'].forEach((col, i) => {
    x.fillStyle = col; x.fillRect((i * W) / 4, 132, W / 4, 7);
  });

  let y = 168;
  x.fillStyle = '#101A2B'; x.font = '700 24px ' + FONT;
  x.fillText(kind === 'invoice' ? t.invoice : t.quotation, 44, y);
  x.font = '400 18px ' + FONT; x.fillStyle = '#3D4A5C';
  x.textAlign = 'right';
  const meta = [];
  if (doc.doc_no) meta.push(t.docNo + ' ' + doc.doc_no);
  meta.push(t.date + ': ' + fmtDate(doc.doc_date));
  meta.forEach((m, i) => x.fillText(m, W - 44, y + i * 26));
  x.textAlign = 'left';
  y += 62;
  if (doc.customer_name) {
    x.font = '600 20px ' + FONT; x.fillStyle = '#101A2B';
    x.fillText(t.customer + ': ' + doc.customer_name + (doc.customer_phone ? '  (' + doc.customer_phone + ')' : ''), 44, y);
    y += 34;
  }
  y += 8;

  const cx = { sr: 44, item: 92, size: 470, qty: 640, rate: 740, amt: 1036 };
  x.fillStyle = '#F0F3F7'; x.fillRect(44, y, W - 88, 42);
  x.strokeStyle = '#C6D0DB'; x.lineWidth = 1; x.strokeRect(44, y, W - 88, 42);
  x.fillStyle = '#3D4A5C'; x.font = '700 17px ' + FONT;
  x.fillText(t.sr, cx.sr + 8, y + 12);
  x.fillText(t.item, cx.item, y + 12);
  x.fillText(t.size, cx.size, y + 12);
  x.textAlign = 'right';
  x.fillText(t.qty, cx.qty + 50, y + 12);
  x.fillText(t.rate, cx.rate + 120, y + 12);
  x.fillText(t.amount, cx.amt, y + 12);
  x.textAlign = 'left';
  y += 42;

  shown.forEach((l, i) => {
    x.font = '600 19px ' + FONT;
    const name = lang === 'mr' && l.item_name_mr ? l.item_name_mr : l.item_name;
    const nameLines = wrap(x, name, 360);
    const remLines = l.remarks ? wrap(x, '(' + l.remarks + ')', 360) : [];
    const h = Math.max(46, 14 + nameLines.length * 25 + remLines.length * 22);
    if (i % 2 === 1) { x.fillStyle = '#FAFBFD'; x.fillRect(44, y, W - 88, h); }
    x.strokeStyle = '#DFE5EC'; x.strokeRect(44, y, W - 88, h);
    x.fillStyle = '#101A2B'; x.font = '400 18px ' + FONT;
    x.fillText(String(i + 1), cx.sr + 10, y + 13);
    x.font = '600 19px ' + FONT;
    nameLines.forEach((ln, k) => x.fillText(ln, cx.item, y + 12 + k * 25));
    if (remLines.length) {
      x.font = '400 16px ' + FONT; x.fillStyle = '#6B7787';
      remLines.forEach((ln, k) => x.fillText(ln, cx.item, y + 12 + nameLines.length * 25 + k * 22));
    }
    x.fillStyle = '#101A2B'; x.font = '400 18px ' + FONT;
    x.fillText(l.size || '-', cx.size, y + 13);
    x.textAlign = 'right';
    const qtyTxt = l.unit === 'per_sqft' && num(l.sqft) > 0
      ? trimNum(num(l.sqft) * (num(l.qty) || 1)) + ' ' + t.sqft
      : trimNum(num(l.qty) || 1);
    x.fillText(qtyTxt, cx.qty + 50, y + 13);
    x.fillText(money(l.rate), cx.rate + 120, y + 13);
    x.font = '700 19px ' + FONT;
    x.fillText(money(lineAmount(l)), cx.amt, y + 13);
    x.textAlign = 'left';
    y += h;
  });

  y += 18;
  const tx = W - 44, lx = 620;
  const row = (lbl, v, big) => {
    x.font = (big ? '700 24px ' : '400 19px ') + FONT;
    x.fillStyle = big ? '#101A2B' : '#3D4A5C';
    x.fillText(lbl, lx, y);
    x.textAlign = 'right'; x.fillText(v, tx, y); x.textAlign = 'left';
    y += big ? 38 : 30;
  };
  row(t.sub, money(sum.sub));
  if (num(doc.extra_charge) > 0) row(t.extra, money(doc.extra_charge));
  if (num(doc.discount) > 0) row(t.disc, '- ' + money(doc.discount));
  if (doc.gst_enabled) row(`${t.gst} ${trimNum(doc.gst_rate)}%`, money(sum.gst));
  x.strokeStyle = '#C2185B'; x.lineWidth = 3;
  x.beginPath(); x.moveTo(lx, y); x.lineTo(tx, y); x.stroke();
  y += 12;
  row(t.grand, money(sum.grand), true);
  if (kind === 'invoice' && num(doc.paid_amount) > 0) {
    row(t.paid, money(doc.paid_amount));
    row(t.due, money(sum.grand - num(doc.paid_amount)), true);
  }

  y += 10;
  x.fillStyle = '#3D4A5C'; x.font = '400 19px ' + FONT;
  const foot = [];
  if (kind !== 'invoice') {
    if (num(doc.advance_pct) > 0) foot.push(`${t.adv} (${trimNum(doc.advance_pct)}%): ${money(sum.advance)}     ${t.bal}: ${money(sum.balance)}`);
    if (num(doc.delivery_days) > 0) foot.push(`${t.del}: ${fmtDate(addDays(doc.doc_date, doc.delivery_days))}`);
    if (num(doc.valid_days) > 0) foot.push(`${t.valid} ${fmtDate(addDays(doc.doc_date, doc.valid_days))}${lang === 'mr' ? ' ' + t.validEnd : t.validEnd}`);
  }
  if (doc.notes) wrap(x, doc.notes, W - 120).forEach((ln) => foot.push(ln));
  foot.forEach((ln) => { x.fillText(ln, 44, y); y += 30; });
  y += 6;
  x.fillStyle = '#101A2B'; x.font = '600 20px ' + FONT;
  x.fillText(t.thanks, 44, y);
  y += 46;

  const out = document.createElement('canvas');
  const hh = Math.round(y * dpr);
  out.width = W * dpr; out.height = hh;
  out.getContext('2d').drawImage(c, 0, 0, W * dpr, hh, 0, 0, W * dpr, hh);
  return out;
}
