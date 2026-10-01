import { useEffect, useState } from 'react';

const FULL_GROUPS = [
  { label: 'Workspace', items: [
    { id: 'home', label: 'Overview', icon: '⌂' }, { id: 'sales', label: 'Sales', icon: '↗' },
    { id: 'purchases', label: 'Purchases', icon: '↙' }, { id: 'daybook', label: 'Day book', icon: '▤' }
  ]},
  { label: 'Inventory', items: [
    { id: 'catalog', label: 'Products & prices', icon: '◇' }, { id: 'warehouse', label: 'Warehouse', icon: '▦' },
    { id: 'udhaar', label: 'Credit ledger', icon: '◎' }
  ]},
  { label: 'Business', items: [
    { id: 'reports', label: 'Reports', icon: '⌁' }, { id: 'customers', label: 'Customers', icon: '♙' },
    { id: 'suppliers', label: 'Suppliers', icon: '♧' }
  ]},
  { label: 'Administration', items: [
    { id: 'users', label: 'Team members', icon: '♚' }, { id: 'activity', label: 'Activity log', icon: '◷' },
    { id: 'settings', label: 'Settings', icon: '⚙' }, { id: 'diagnostics', label: 'System status', icon: '◉' }
  ]}
];
const WORKER_GROUPS = [{ label: 'Workspace', items: [
  { id: 'home', label: 'Overview', icon: '⌂' }, { id: 'sales', label: 'Sales & billing', icon: '↗' }
]}];
const ROLE_LABELS = { admin: 'Administrator', owner: 'Owner · view only', user: 'Team member' };

export default function AppHeader({ shopName, user, tab, onTab, onLogout }) {
  const [open, setOpen] = useState(false);
  const [offline, setOffline] = useState(false);
  const groups = user.role === 'admin' || user.role === 'owner' ? FULL_GROUPS : WORKER_GROUPS;
  const active = groups.flatMap((group) => group.items).find((item) => item.id === tab);
  useEffect(() => setOpen(false), [tab]);
  useEffect(() => { const show = () => setOffline(true); window.addEventListener('portal:offline', show); return () => window.removeEventListener('portal:offline', show); }, []);

  return <>
    <header className="portal-topbar">
      <button className="mobile-menu" aria-label="Open navigation" onClick={() => setOpen(true)}>☰</button>
      <div><div className="portal-topbar__eyebrow">Shop portal</div><div className="portal-topbar__title">{active?.label || 'Overview'}</div></div>
      <div className="portal-topbar__actions"><span className={`live-pill${offline ? ' is-offline' : ''}`}><i /> {offline ? 'Preview workspace' : 'Business online'}</span><div className="portal-avatar">{user.fullName?.charAt(0)?.toUpperCase() || 'U'}</div></div>
    </header>
    {open && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}
    <aside className={`portal-sidebar${open ? ' is-open' : ''}`}>
      <div className="portal-brand">
        <div className="portal-brand__mark">S</div>
        <div className="portal-brand__copy"><strong>{shopName || 'Shopkeeper'}</strong><span>Management portal</span></div>
        <button className="sidebar-close" aria-label="Close navigation" onClick={() => setOpen(false)}>×</button>
      </div>
      <nav className="portal-nav" aria-label="Main navigation">
        {groups.map((group) => <div className="portal-nav__group" key={group.label}>
          <div className="portal-nav__label">{group.label}</div>
          {group.items.map((item) => <button key={item.id} className={`portal-nav__item${tab === item.id ? ' is-active' : ''}`} onClick={() => onTab(item.id)}>
            <span className="portal-nav__icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>{tab === item.id && <span className="portal-nav__active-dot" />}
          </button>)}
        </div>)}
      </nav>
      <div className="portal-user">
        <div className="portal-avatar portal-avatar--large">{user.fullName?.charAt(0)?.toUpperCase() || 'U'}</div>
        <div className="portal-user__copy"><strong>{user.fullName}</strong><span>{ROLE_LABELS[user.role] || user.role}</span></div>
        <button className="portal-signout" title="Sign out" aria-label="Sign out" onClick={onLogout}>↪</button>
      </div>
    </aside>
  </>;
}
