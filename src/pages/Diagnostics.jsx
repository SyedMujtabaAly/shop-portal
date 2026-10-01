import { useEffect, useState } from 'react';
import SelfTestPanel from '../components/SelfTestPanel.jsx';

/**
 * Admin-only technical page. This is where the Phase 0/1 placeholder screen
 * ended up: data folder, database state, version info, and the self-test.
 *
 * Kept in the shipped app on purpose — when the shop calls with a problem,
 * this page answers most of the questions without a site visit.
 */
export default function Diagnostics() {
  const [folder, setFolder] = useState(null);
  const [db, setDb] = useState(null);
  const [app, setApp] = useState(null);

  useEffect(() => {
    window.api.dataFolder.status().then((r) => r.ok && setFolder(r.data));
    window.api.db.info().then((r) => r.ok && setDb(r.data));
    window.api.app.info().then((r) => r.ok && setApp(r.data));
  }, []);

  return (
    <div className="page">
      <div className="page__head">
        <h1 className="page__title">Diagnostics</h1>
      </div>

      <div className="panel">
        <h2 className="panel__title">Storage</h2>
        <dl className="kv">
          <dt>Data folder</dt>
          <dd>
            <code className="path">{folder?.folder}</code>
          </dd>
          <dt>Database file</dt>
          <dd>
            <code className="path">{folder?.dbPath}</code>
          </dd>
          {db?.open && (
            <>
              <dt>Schema version</dt>
              <dd>
                v{db.migrations?.availableVersion} · {db.migrations?.appliedCount}/
                {db.migrations?.totalCount} migrations applied
              </dd>
              <dt>Safety settings</dt>
              <dd>
                foreign keys {db.foreignKeys ? 'ON' : 'OFF'} · journal {db.journalMode} ·
                synchronous {db.synchronous}
              </dd>
            </>
          )}
          {app && (
            <>
              <dt>Version</dt>
              <dd>
                v{app.version} · Electron {app.electron} · Chrome {app.chrome}
              </dd>
            </>
          )}
        </dl>

        <button className="btn" onClick={() => window.api.dataFolder.openInExplorer()}>
          Open data folder
        </button>
      </div>

      <div className="panel">
        <h2 className="panel__title">Database self-test</h2>
        <SelfTestPanel />
      </div>

      <div className="callout">
        <strong>How to back up</strong>
        <p className="text-muted">
          Close the software completely, then copy the whole data folder to a USB drive. That folder
          is the entire shop — database and every bill photo.
        </p>
      </div>
    </div>
  );
}
