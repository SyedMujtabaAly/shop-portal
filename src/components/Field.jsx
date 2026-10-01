/**
 * A labelled form input. Every form in the app uses this, so labels, spacing,
 * error styling and hint text stay identical everywhere without repeating CSS.
 */
export default function Field({
  label,
  hint,
  error,
  type = 'text',
  value,
  onChange,
  autoFocus,
  disabled,
  placeholder,
  autoComplete = 'off'
}) {
  return (
    <label className={`field${error ? ' field--error' : ''}`}>
      <span className="field__label">{label}</span>
      <input
        className="field__input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={autoComplete}
        spellCheck={false}
      />
      {error ? (
        <span className="field__error">{error}</span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </label>
  );
}
