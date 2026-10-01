import { useCallback, useEffect, useState } from 'react';
import FirstRunSetup from './pages/FirstRunSetup.jsx';
import AdminSetup from './pages/AdminSetup.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Loading from './components/Loading.jsx';
import UpdateBar from './components/UpdateBar.jsx';

/**
 * The startup gate.
 *
 * Same idea as the desktop app: ask the backend a few questions in order and
 * render whatever the answer calls for.
 *
 *   1. Is there a writable data folder?   no -> FirstRunSetup (in practice
 *      this never triggers in the web edition — the backend auto-provisions
 *      a data folder on first start, see backend/services/dataFolder.js)
 *   2. Did the database open?             no -> error card
 *   3. Does an owner account exist?       no -> AdminSetup
 *   4. Is someone signed in?              no -> Login
 *                                         yes -> Dashboard
 */
export default function App() {
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const folderRes = await window.api.dataFolder.status();
      if (!folderRes.ok) {
        setError(folderRes.message || 'Could not read the data folder settings.');
        return;
      }

      const folder = folderRes.data;
      if (!folder.ready) {
        setState({ folder, db: null, auth: null });
        setError(null);
        return;
      }

      await window.api.db.open();

      const dbRes = await window.api.db.info();
      const authRes = await window.api.auth.status();

      setState({ folder, db: dbRes.ok ? dbRes.data : null, auth: authRes.ok ? authRes.data : null });
      setError(null);
    } catch (err) {
      setError(err?.message || 'The portal could not start.');
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (error) {
    return (
      <>
        <UpdateBar />
        <div className="centered-page">
          <div className="card card--narrow">
            <h1 className="card__title">Startup problem</h1>
            <p className="text-muted">{error}</p>
            <button className="btn btn--primary" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      </>
    );
  }

  if (!state) {
    return (
      <>
        <UpdateBar />
        <Loading label="Starting…" />
      </>
    );
  }

  // 1 — data folder
  if (!state.folder.ready) {
    return (
      <>
        <UpdateBar />
        <FirstRunSetup status={state.folder} onDone={refresh} />
      </>
    );
  }

  // 2 — database
  if (!state.db || !state.db.open) {
    return (
      <>
        <UpdateBar />
        <div className="centered-page">
          <div className="card card--narrow">
            <h1 className="card__title">Database could not be opened</h1>
            <p className="text-muted">
              {state.db?.error?.message || 'The shop database could not be opened.'}
            </p>
            <p className="text-muted text-small">
              The data folder is <code className="path">{state.folder.folder}</code>
            </p>
            <button className="btn btn--primary" onClick={refresh}>
              Try again
            </button>
          </div>
        </div>
      </>
    );
  }

  const shopName = state.auth?.shopName;

  // 3 — owner account
  if (!state.auth?.adminCreated) {
    return (
      <>
        <UpdateBar />
        <AdminSetup shopName={shopName} onDone={refresh} />
      </>
    );
  }

  // 4 — signed in?
  if (!state.auth?.user) {
    return (
      <>
        <UpdateBar />
        <Login shopName={shopName} onLoggedIn={refresh} />
      </>
    );
  }

  return (
    <>
      <UpdateBar />
      <Dashboard shopName={shopName} user={state.auth.user} onLoggedOut={refresh} />
    </>
  );
}
