/**
 * Full-screen loading state. Used whenever the UI is waiting on the
 * main process and has nothing meaningful to show yet.
 */
export default function Loading({ label = 'Loading…' }) {
  return (
    <div className="centered-page">
      <div className="loading">
        <div className="loading__spinner" />
        <p className="text-muted">{label}</p>
      </div>
    </div>
  );
}
