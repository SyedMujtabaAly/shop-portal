/**
 * Second-level navigation inside a page, e.g. Products / Companies.
 * Keeps the top bar short instead of growing a tab for every table.
 */
export default function SubTabs({ tabs, value, onChange }) {
  return (
    <div className="subtabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`subtab${value === t.id ? ' is-active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {typeof t.count === 'number' && <span className="subtab__count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
