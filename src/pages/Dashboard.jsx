import { useEffect, useState } from 'react';
import AppHeader from '../components/AppHeader.jsx';
import Sales from './Sales.jsx';
import Users from './Users.jsx';
import Catalog from './Catalog.jsx';
import Purchases from './Purchases.jsx';
import Udhaar from './Udhaar.jsx';
import Warehouse from './Warehouse.jsx';
import DayBook from './DayBook.jsx';
import Reports from './Reports.jsx';
import Settings from './Settings.jsx';
import Contacts from './Contacts.jsx';
import UdhaarAlerts from '../components/UdhaarAlerts.jsx';
import ThetaXBadge from '../components/ThetaXBadge.jsx';
import Activity from './Activity.jsx';
import Diagnostics from './Diagnostics.jsx';
import ChangePassword from '../components/ChangePassword.jsx';
import { formatPaisa } from '../lib/format.js';

/**
 * The shell every logged-in user sees. Holds which tab is open and renders it.
 *
 * Each admin-only tab is guarded twice: the header does not draw it for a
 * worker, and the render below checks the role again. Neither is the real
 * defence — that is in the main process — but a worker should never see a
 * half-loaded owner screen if a tab id is ever set by mistake.
 */
export default function Dashboard({ shopName, user, onLoggedOut }) {
  const [tab, setTab] = useState('home');
  // Set when the owner clicks a name in the dashboard reminder panel, so the
  // udhaar page can open straight onto that person's payment form.
  const [udhaarParty, setUdhaarParty] = useState(null);

  async function logout() {
    await window.api.auth.logout();
    onLoggedOut();
  }

  const canView = user.role === 'admin' || user.role === 'owner';
  const readOnly = user.role === 'owner';

  return (
    <div className="app portal-shell">
      <AppHeader shopName={shopName} user={user} tab={tab} onTab={setTab} onLogout={logout} />

      <main className="app__body">
        {tab === 'home' && (
          <HomeTab
            user={user}
            onGoToSale={() => setTab('sales')}
            onOpenUdhaar={(party) => {
              setUdhaarParty(party || null);
              setTab('udhaar');
            }}
          />
        )}
        {tab === 'sales' && <Sales user={user} readOnly={readOnly} />}
        {tab === 'catalog' && canView && <Catalog readOnly={readOnly} />}
        {tab === 'purchases' && canView && <Purchases readOnly={readOnly} />}
        {tab === 'warehouse' && canView && <Warehouse />}
        {tab === 'udhaar' && canView && <Udhaar initialParty={udhaarParty} readOnly={readOnly} />}
        {tab === 'daybook' && canView && <DayBook readOnly={readOnly} />}
        {tab === 'reports' && canView && <Reports />}
        {tab === 'customers' && canView && <Contacts kind="customer" readOnly={readOnly} />}
        {tab === 'suppliers' && canView && <Contacts kind="supplier" readOnly={readOnly} />}
        {tab === 'users' && canView && <Users me={user} readOnly={readOnly} />}
        {tab === 'settings' && canView && <Settings readOnly={readOnly} />}
        {tab === 'activity' && canView && <Activity />}
        {tab === 'diagnostics' && canView && <Diagnostics />}
      </main>

      <footer className="app__footer">
        <ThetaXBadge />
      </footer>
    </div>
  );
}

/**
 * Today at a glance. Deliberately small for now — the full dashboard with
 * udhaar reminders and low-stock alerts arrives in Phase 6.
 */
function HomeTab({ user, onGoToSale, onOpenUdhaar }) {
  const [today, setToday] = useState(null);
  const [stock, setStock] = useState(null);
  const canView = user.role === 'admin' || user.role === 'owner';

  useEffect(() => {
    window.api.sales.today().then((r) => r.ok && setToday(r.data));
    if (canView) {
      window.api.reports.warehouse().then((r) => r.ok && setStock(r.data));
    }
  }, []);

  return (
    <div className="page page--wide portal-home">
      <div className="page__head portal-welcome">
        <div>
          <div className="portal-kicker">TODAY'S PULSE</div>
          <h1 className="page__title">Good to see you, {user.fullName.split(' ')[0]}</h1>
          <p className="text-muted">Here’s what is happening across your shop today.</p>
        </div>
        <button className="btn btn--primary btn--big" onClick={onGoToSale}>
          ＋ Create sale
        </button>
      </div>

      {today && (
        <div className="cards portal-metrics">
          <div className="card-stat">
            <span className="card-stat__label">{canView ? "Today's orders" : 'Your orders today'}</span>
            <span className="card-stat__value">{today.count}</span>
          </div>
          <div className="card-stat card-stat--good">
            <span className="card-stat__label">Today's sales</span>
            <span className="card-stat__value">Rs {formatPaisa(today.totalPaisa)}</span>
          </div>
          {canView ? (
            <div className="card-stat card-stat--good">
              <span className="card-stat__label">Today's profit</span>
              <span className="card-stat__value">Rs {formatPaisa(today.profitPaisa || 0)}</span>
            </div>
          ) : (
            <div className="card-stat">
              <span className="card-stat__label">Cash received</span>
              <span className="card-stat__value">Rs {formatPaisa(today.paidPaisa)}</span>
            </div>
          )}
          <div className={`card-stat ${today.outstandingPaisa > 0 ? 'card-stat--due' : ''}`}>
            <span className="card-stat__label">Given on udhaar today</span>
            <span className="card-stat__value">Rs {formatPaisa(today.outstandingPaisa)}</span>
          </div>
        </div>
      )}

      {/* The daily udhaar reminder — the owner's first look every morning. */}
      {canView && <UdhaarAlerts onOpen={onOpenUdhaar} />}

      {/* --- Shop inventory overview --- */}
      {canView && stock && (
        <>
          <h2 style={{ margin: '24px 0 12px' }}>Shop inventory</h2>
          <div className="cards">
            <div className="card-stat card-stat--good">
              <span className="card-stat__label">Stock value (cost)</span>
              <span className="card-stat__value">Rs {formatPaisa(stock.totals.grandCostPaisa)}</span>
            </div>
            <div className="card-stat">
              <span className="card-stat__label">Stock value (sale)</span>
              <span className="card-stat__value">Rs {formatPaisa(stock.totals.grandSaleValuePaisa)}</span>
            </div>
            <div className="card-stat">
              <span className="card-stat__label">Products in shop</span>
              <span className="card-stat__value">{stock.items.length}</span>
            </div>
            {stock.totals.grandDamageMl > 0 && (
              <div className="card-stat" style={{ borderLeftColor: '#c0392b' }}>
                <span className="card-stat__label">Total damaged (all time)</span>
                <span className="card-stat__value" style={{ color: '#c0392b' }}>Yes</span>
              </div>
            )}
          </div>

          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Product</th>
                <th>Supplier</th>
                <th className="num">In stock</th>
                <th className="num">Damaged</th>
                <th className="num">Cost value</th>
              </tr>
            </thead>
            <tbody>
              {stock.items.map((r) => (
                <tr key={r.id} className={r.stockMl <= 0 ? 'is-muted' : ''}>
                  <td><strong>{r.companyName}</strong> — {r.productName}</td>
                  <td>{r.supplierName}</td>
                  <td className="num" style={{ fontWeight: 600 }}>{r.stockText}</td>
                  <td className="num" style={r.totalDamageMl > 0 ? { color: '#c0392b', fontWeight: 600 } : {}}>
                    {r.totalDamageMl > 0 ? r.totalDamageText : '—'}
                  </td>
                  <td className="num">{formatPaisa(r.costValuePaisa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="callout callout--ok">
        <strong>
          You are signed in as{' '}
          {user.role === 'admin' ? 'the administrator' : user.role === 'owner' ? 'the shop owner (view only)' : 'a worker'}
        </strong>
        <p className="text-muted">
          {user.role === 'admin'
            ? 'You have full control: stock, prices, reports, expenses, and user accounts.'
            : user.role === 'owner'
            ? 'You can see all tabs and data but cannot create, edit or delete anything.'
            : 'You can record sales and print bills. Stock, prices and reports are with the owner.'}
        </p>
      </div>

      {/*
        A quiet nudge, not a nag. The admin will never think about backups until
        the day he needs one, so the dashboard mentions it once.
      */}
      {user.role === 'admin' && (
        <div className="callout callout--warn">
          <strong>Keep a copy of your shop</strong>
          <p>
            Everything is on this one laptop. Open <strong>Settings → Backup</strong> once a week
            and save a copy onto a USB drive.
          </p>
        </div>
      )}

      <ChangePassword />
    </div>
  );
}
