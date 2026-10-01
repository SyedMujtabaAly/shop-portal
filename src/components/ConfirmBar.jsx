/**
 * In-app confirmation for destructive actions.
 *
 * Replaces window.confirm(). Browser dialogs are unreliable inside Electron —
 * they can be suppressed entirely, which made the Delete button look broken:
 * the click did nothing, silently, with no error. An ordinary React panel is
 * predictable, testable, and matches the rest of the app.
 *
 * The confirm button is red and NOT the default focus, so nothing destructive
 * happens by pressing Enter out of habit.
 */
export default function ConfirmBar({
  title,
  message,
  confirmLabel = 'Delete permanently',
  busy,
  onConfirm,
  onCancel
}) {
  return (
    <div className="callout callout--error confirmbar">
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      <div className="btn-row confirmbar__actions">
        <button className="btn" onClick={onCancel} disabled={busy} autoFocus>
          Cancel
        </button>
        <button className="btn btn--danger-solid" onClick={onConfirm} disabled={busy}>
          {busy ? 'Deleting…' : confirmLabel}
        </button>
      </div>
    </div>
  );
}
