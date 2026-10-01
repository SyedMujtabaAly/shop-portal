const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
export const formatPaisa = (value = 0) => number.format(Number(value || 0) / 100);
export const paisaToRupees = (value = 0) => String(Number(value || 0) / 100);
export function formatDate(value) { if (!value) return '—'; const date = new Date(`${String(value).slice(0, 10)}T00:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
export function formatDateTime(value) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
export function formatStock(ml = 0) { const value = Number(ml || 0); return value >= 1000 ? `${number.format(value / 1000)} L` : `${number.format(value)} ml`; }
