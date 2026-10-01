import { useEffect, useState } from 'react';
import Field from '../components/Field.jsx';
import SubTabs from '../components/SubTabs.jsx';
import ConfirmBar from '../components/ConfirmBar.jsx';
import { formatPaisa } from '../lib/format.js';

/**
 * SETTINGS — everything the owner can change without a developer.
 *
 * Three groups, because they are used at completely different moments:
 *   Shop      once, at setup, and whenever the phone number changes
 *   Bills     rarely
 *   Backup    ideally every week, which is why it is the loudest section
 */
export default function Settings({ readOnly = false }) {
  const [tab, setTab] = useState('shop');

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">Settings</h1>
        {readOnly && <span className="text-muted">(view only)</span>}
      </div>

      <SubTabs
        tabs={[
          { id: 'shop', label: 'Shop details' },
          { id: 'bills', label: 'Bills & udhaar' },
          ...(!readOnly ? [{ id: 'security', label: 'Security' }] : []),
          ...(!readOnly ? [{ id: 'backup', label: 'Backup' }] : [])
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'shop' && <ShopSettings readOnly={readOnly} />}
      {tab === 'bills' && <BillSettings readOnly={readOnly} />}
      {tab === 'security' && !readOnly && <SecuritySettings />}
      {tab === 'backup' && !readOnly && <Backup />}
    </div>
  );
}

function useSettings() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  async function load() {
    const res = await window.api.settings.get();
    if (res.ok) setData(res.data);
    else setError(res.message);
  }

  useEffect(() => {
    load();
  }, []);

  return { data, setData, error, setError, reload: load };
}

function ShopSettings({ readOnly = false }) {
  const { data, error, setError, reload } = useSettings();
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        shop_name: data.shopName,
        shop_address: data.shopAddress,
        shop_phone: data.shopPhone
      });
    }
  }, [data]);

  if (!form) return <div className="panel text-muted">Loading…</div>;

  async function save(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await window.api.settings.set(form);
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setNotice('Saved. New bills will show these details.');
    reload();
  }

  return (
    <form className="panel" onSubmit={save}>
      <h2 className="panel__title">Shop details</h2>
      <p className="text-muted">
        These are printed at the top of every customer bill and on every report.
      </p>

      {error && <div className="callout callout--error">{error}</div>}
      {notice && <div className="callout callout--ok">{notice}</div>}

      <div className="grid-2">
        <Field
          label="Shop name"
          value={form.shop_name}
          onChange={(v) => setForm((f) => ({ ...f, shop_name: v }))}
          disabled={busy}
        />
        <Field
          label="Phone"
          value={form.shop_phone}
          onChange={(v) => setForm((f) => ({ ...f, shop_phone: v }))}
          disabled={busy}
          placeholder="0300-1234567"
        />
      </div>
      <Field
        label="Address"
        value={form.shop_address}
        onChange={(v) => setForm((f) => ({ ...f, shop_address: v }))}
        disabled={busy}
        placeholder="Main Bazaar Road, Lahore"
      />

      {!readOnly && (
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save shop details'}
        </button>
      )}
    </form>
  );
}

function BillSettings({ readOnly = false }) {
  const { data, error, setError, reload } = useSettings();
  const [form, setForm] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) {
      setForm({
        invoice_prefix: data.invoicePrefix,
        purchase_prefix: data.purchasePrefix,
        due_soon_days: String(data.dueSoonDays),
        tax_enabled: data.taxEnabled ? '1' : '0',
        tax_percent: String(data.taxPercent),
        payment_channels: (data.paymentChannels || []).join(', '),
        cash_opening_paisa: String(data.cashOpeningPaisa || 0)
      });
    }
  }, [data]);

  if (!form) return <div className="panel text-muted">Loading…</div>;

  async function save(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);

    const res = await window.api.settings.set({
      ...form,
      // Stored as a comma-separated list; tidy up whatever the owner typed.
      payment_channels: form.payment_channels
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .join(',')
    });

    setBusy(false);
    if (!res.ok) return setError(res.message);
    setNotice('Saved.');
    reload();
  }

  return (
    <form className="panel" onSubmit={save}>
      <h2 className="panel__title">Bills &amp; udhaar</h2>

      {error && <div className="callout callout--error">{error}</div>}
      {notice && <div className="callout callout--ok">{notice}</div>}

      <div className="grid-3">
        <Field
          label="Sale bill prefix"
          value={form.invoice_prefix}
          onChange={(v) => setForm((f) => ({ ...f, invoice_prefix: v }))}
          disabled={busy}
          hint="e.g. INV- gives INV-000001"
        />
        <Field
          label="Purchase bill prefix"
          value={form.purchase_prefix}
          onChange={(v) => setForm((f) => ({ ...f, purchase_prefix: v }))}
          disabled={busy}
          hint="e.g. PUR-"
        />
        <Field
          label="Warn me this many days before udhaar is due"
          type="number"
          value={form.due_soon_days}
          onChange={(v) => setForm((f) => ({ ...f, due_soon_days: v }))}
          disabled={busy}
        />
      </div>

      <h3 className="panel__subtitle">Payment services</h3>
      <Field
        label="Services you accept, separated by commas"
        value={form.payment_channels}
        onChange={(v) => setForm((f) => ({ ...f, payment_channels: v }))}
        disabled={busy}
        hint="These appear in the dropdown on sales, purchases, payments and expenses"
      />

      <h3 className="panel__subtitle">Cash</h3>
      <Field
        label="Cash the shop started with (Rs)"
        type="number"
        value={String(Number(form.cash_opening_paisa || 0) / 100)}
        onChange={(v) =>
          setForm((f) => ({ ...f, cash_opening_paisa: String(Math.round(Number(v || 0) * 100)) }))
        }
        disabled={busy}
        hint="Only used until the first day is closed. After that the count carries forward."
      />

      <h3 className="panel__subtitle">Tax</h3>
      <label className="field checkbox">
        <input
          type="checkbox"
          checked={form.tax_enabled === '1'}
          onChange={(e) => setForm((f) => ({ ...f, tax_enabled: e.target.checked ? '1' : '0' }))}
          disabled={busy}
        />
        <span>
          Show tax on bills
          <span className="field__hint">
            Off. Turn this on only if the shop starts charging GST — it adds a tax line to every
            new bill.
          </span>
        </span>
      </label>

      {form.tax_enabled === '1' && (
        <div className="grid-3">
          <Field
            label="Tax %"
            type="number"
            value={form.tax_percent}
            onChange={(v) => setForm((f) => ({ ...f, tax_percent: v }))}
            disabled={busy}
          />
        </div>
      )}

      {!readOnly && (
        <button className="btn btn--primary" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      )}
    </form>
  );
}

/**
 * Regenerate the recovery key — the only way to reset a forgotten password
 * on offline software. Admin only.
 */
function SecuritySettings() {
  const [newKey, setNewKey] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function regenerate() {
    setError(null);
    setBusy(true);
    const res = await window.api.auth.setRecoveryKey();
    setBusy(false);
    if (!res.ok) return setError(res.message);
    setNewKey(res.data);
  }

  return (
    <div className="panel">
      <h2 className="panel__title">Recovery key</h2>
      <p className="text-muted">
        The recovery key lets anyone reset their password from the login screen. It was shown
        once when the software was first set up. If you have lost it, generate a new one below —
        the old key will stop working immediately.
      </p>

      {error && <div className="callout callout--error">{error}</div>}

      {newKey ? (
        <>
          <div className="callout callout--warn">
            <strong>Write this down and keep it safe</strong>
            <p>This is the only time it will be shown.</p>
          </div>
          <div style={{
            textAlign: 'center', padding: '20px', margin: '16px 0',
            background: 'var(--c-bg-raised, #f5f5f5)', borderRadius: 8,
            border: '2px dashed var(--c-warn-border, #ffe082)',
            fontSize: '2rem', fontFamily: 'monospace', letterSpacing: '0.3em'
          }}>
            {newKey}
          </div>
          <button className="btn" onClick={() => setNewKey(null)}>Done</button>
        </>
      ) : (
        <button className="btn btn--primary" onClick={regenerate} disabled={busy}>
          {busy ? 'Generating…' : 'Generate new recovery key'}
        </button>
      )}
    </div>
  );
}

/**
 * The most important screen in the software, and the one nobody will look at
 * until the day they need it. Worded accordingly.
 */
function Backup() {
  const [info, setInfo] = useState(null);
  const [candidate, setCandidate] = useState(null);
  const [confirmText, setConfirmText] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await window.api.backup.preview();
    if (res.ok) setInfo(res.data);
    else setError(res.message);
  }

  useEffect(() => {
    load();
  }, []);

  async function makeBackup() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await window.api.backup.now();
    setBusy(false);
    if (!res.ok) return setError(res.message);
    if (res.data.saved) {
      setNotice(
        `Backup saved to ${res.data.filePath} — ${res.data.photoCount} photo(s), ${Math.round(res.data.bytes / 1024)} KB.`
      );
    }
  }

  async function pickRestore() {
    setError(null);
    setNotice(null);
    const res = await window.api.backup.choose();
    if (!res.ok) return setError(res.message);
    if (!res.data.chosen) return;
    setCandidate(res.data);
    setConfirmText('');
  }

  async function doRestore() {
    setError(null);
    setRestoring(true);
    const res = await window.api.backup.restore({
      filePath: candidate.filePath,
      confirmText
    });
    setRestoring(false);
    if (!res.ok) return setError(res.message);
    setCandidate(null);
    setDone(res.data);
  }

  if (done) {
    return (
      <div className="panel">
        <div className="callout callout--ok">
          <strong>Restore finished</strong>
          <p>
            The shop's data has been replaced from the backup. Your previous data was saved first
            to <code className="path">{done.safetyCopy}</code>, so nothing is lost either way.
          </p>
        </div>
        <p>The software must start again to load the restored database.</p>
        <button className="btn btn--primary" onClick={() => window.api.app.restart()}>
          Restart now
        </button>
      </div>
    );
  }

  return (
    <>
      {error && <div className="callout callout--error">{error}</div>}
      {notice && <div className="callout callout--ok">{notice}</div>}

      <div className="panel">
        <h2 className="panel__title">Back up the shop</h2>
        <p className="text-muted">
          Everything the shop has is in one folder: the database and every bill photo. If this
          laptop is lost or stops working and there is no copy, the accounts are gone.
        </p>

        {info && (
          <div className="cards cards--3">
            <div className="card-stat">
              <span className="card-stat__label">Database</span>
              <span className="card-stat__value">{Math.round(info.databaseBytes / 1024)} KB</span>
            </div>
            <div className="card-stat">
              <span className="card-stat__label">Bill photos</span>
              <span className="card-stat__value">{info.photoCount}</span>
            </div>
            <div className="card-stat">
              <span className="card-stat__label">Backup size</span>
              <span className="card-stat__value">
                {Math.round(info.totalBytes / 1024)} KB
              </span>
            </div>
          </div>
        )}

        <div className="callout">
          <strong>Do this once a week</strong>
          <p>
            Plug in a USB drive, press the button below, and save the file onto the drive. Keep the
            last few — a backup that lives only on this laptop protects you from a mistake, not
            from a theft or a dead disk.
          </p>
        </div>

        <div className="btn-row">
          <button className="btn btn--primary" onClick={makeBackup} disabled={busy}>
            {busy ? 'Working…' : 'Back up now'}
          </button>
          <button className="btn" onClick={() => window.api.backup.openFolder()}>
            Open data folder
          </button>
        </div>

        {info && (
          <p className="text-muted text-small" style={{ marginTop: 10 }}>
            Data folder: <code className="path">{info.folder}</code>
          </p>
        )}
      </div>

      <div className="panel">
        <h2 className="panel__title">Restore from a backup</h2>
        <div className="callout callout--warn">
          <strong>This replaces everything currently in the software</strong>
          <p>
            Only use this on a new laptop, or if the data here has been lost or damaged. Your
            current data is copied aside first, so a mistake can still be undone — but the shop
            must not be used until the restore is finished.
          </p>
        </div>

        {!candidate ? (
          <button className="btn" onClick={pickRestore}>
            Choose a backup file…
          </button>
        ) : (
          <>
            <table className="table">
              <tbody>
                <tr>
                  <td>File</td>
                  <td>
                    <code className="path">{candidate.filePath}</code>
                  </td>
                </tr>
                <tr>
                  <td>Made by this software</td>
                  <td>{candidate.isOurs ? 'Yes' : 'Cannot tell — no backup information inside'}</td>
                </tr>
                {candidate.manifest && (
                  <>
                    <tr>
                      <td>Shop</td>
                      <td>{candidate.manifest.shopName}</td>
                    </tr>
                    <tr>
                      <td>Taken on</td>
                      <td>{new Date(candidate.manifest.createdAt).toLocaleString()}</td>
                    </tr>
                  </>
                )}
                <tr>
                  <td>Database</td>
                  <td>{Math.round(candidate.databaseBytes / 1024)} KB</td>
                </tr>
                <tr>
                  <td>Bill photos</td>
                  <td>{candidate.photoCount}</td>
                </tr>
              </tbody>
            </table>

            <ConfirmBar
              title="Replace all current data with this backup?"
              message="Type RESTORE below, then press the button. Your current data will be copied aside first."
              confirmLabel={restoring ? 'Restoring…' : 'Restore now'}
              busy={restoring || confirmText.trim().toUpperCase() !== 'RESTORE'}
              onConfirm={doRestore}
              onCancel={() => setCandidate(null)}
            />

            <Field
              label="Type RESTORE to confirm"
              value={confirmText}
              onChange={setConfirmText}
              disabled={restoring}
              placeholder="RESTORE"
            />
          </>
        )}
      </div>
    </>
  );
}
