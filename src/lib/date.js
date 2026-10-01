export function toIso(date) { const d = date instanceof Date ? date : new Date(date); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
export const todayIso = () => toIso(new Date());
export const addDays = (value, days) => { const d = new Date(`${value}T00:00:00`); d.setDate(d.getDate() + days); return toIso(d); };
export const monthStart = (value = todayIso()) => `${value.slice(0, 7)}-01`;
export function monthRange(value = todayIso()) { const start = monthStart(value); const d = new Date(`${start}T00:00:00`); d.setMonth(d.getMonth() + 1, 0); return { from: start, to: toIso(d) }; }
