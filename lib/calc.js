// One place where all the money maths lives. The database repeats these rules,
// so a wrong number cannot be saved even if someone edits the page.

export const UNITS = [
  { value: 'per_unit',  en: 'Per Unit',  mr: 'प्रति नग' },
  { value: 'per_board', en: 'Per Board', mr: 'प्रति बोर्ड' },
  { value: 'per_sqft',  en: 'Per sq.ft', mr: 'प्रति चौ.फूट' },
  { value: 'per_trip',  en: 'Per Trip',  mr: 'प्रति फेरी' },
  { value: 'per_day',   en: 'Per Day',   mr: 'प्रति दिवस' },
  { value: 'per_month', en: 'Per Month', mr: 'प्रति महिना' },
  { value: 'lump_sum',  en: 'Lump sum',  mr: 'एकरकमी' },
];

export function unitLabel(unit, lang) {
  const u = UNITS.find((x) => x.value === unit);
  if (!u) return unit;
  return lang === 'mr' ? u.mr : u.en;
}

export function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

export function money(n) {
  return '\u20B9' + Math.round(num(n)).toLocaleString('en-IN');
}

export function trimNum(n) {
  return String(Math.round(num(n) * 100) / 100);
}

// "20 x 30 ft" / "8x10" / "36 x 24 inch"  ->  square feet for ONE piece
export function areaOf(sizeText, roundUp = true) {
  if (!sizeText) return 0;
  const s = String(sizeText).toLowerCase().replace(/,/g, '');
  const m = s.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/);
  if (!m) return 0;
  let w = parseFloat(m[1]);
  let h = parseFloat(m[2]);
  if (/in|inch|"/.test(s)) { w /= 12; h /= 12; }
  const a = w * h;
  return roundUp ? Math.ceil(a) : Math.round(a * 100) / 100;
}

export function lineAmount(line) {
  const qty = num(line.qty) > 0 ? num(line.qty) : 1;
  if (line.unit === 'per_sqft') return round2(num(line.sqft) * qty * num(line.rate));
  if (line.unit === 'lump_sum') return round2(num(line.rate));
  return round2(qty * num(line.rate));
}

export function round2(n) {
  return Math.round(num(n) * 100) / 100;
}

export function totals(doc, lines) {
  const sub = round2(lines.reduce((t, l) => t + lineAmount(l), 0));
  const taxable = Math.max(0, sub + num(doc.extra_charge) - num(doc.discount));
  const gst = doc.gst_enabled ? round2((taxable * num(doc.gst_rate)) / 100) : 0;
  const grand = round2(taxable + gst);
  const advPct = num(doc.advance_pct);
  const advance = round2((grand * advPct) / 100);
  return { sub, taxable, gst, grand, advance, balance: round2(grand - advance) };
}

export function fmtDate(d) {
  if (!d) return '';
  const x = typeof d === 'string' ? new Date(d + 'T00:00:00') : d;
  if (Number.isNaN(x.getTime())) return '';
  const p = (n) => (n < 10 ? '0' + n : String(n));
  return `${p(x.getDate())}/${p(x.getMonth() + 1)}/${x.getFullYear()}`;
}

export function addDays(dateStr, days) {
  const x = new Date(dateStr + 'T00:00:00');
  if (Number.isNaN(x.getTime())) return '';
  x.setDate(x.getDate() + num(days));
  return x;
}

export function today() {
  const n = new Date();
  const p = (v) => (v < 10 ? '0' + v : String(v));
  return `${n.getFullYear()}-${p(n.getMonth() + 1)}-${p(n.getDate())}`;
}

export function emptyLine(sr = 1) {
  return { sr, item_name: '', item_name_mr: '', size: '', sqft: null, qty: 1, rate: '', unit: 'per_unit', remarks: '' };
}
