/**
 * A number plus a unit picker: carton / pack / litre / ml / kg / g.
 *
 * Volume products show: cartons, packs, litres, ml.
 * Weight products show: cartons, packs, kg, g.
 *
 * The owner types in whichever unit he happens to think in, exactly as he asked.
 * This component never converts anything — it hands `{ mode, qty }` straight to
 * the main process, which turns it into millilitres (or milligrams) using the
 * product's own pack size. Keeping the conversion on one side of the bridge is
 * what stops the screen and the database ever disagreeing.
 */
export default function QuantityInput({
  label,
  hint,
  value, // { mode, qty }
  onChange,
  disabled,
  preview, // optional string, e.g. "= 180 L"
  unitType // 'volume' | 'weight' — controls which loose units appear
}) {
  const { mode = 'carton', qty = '' } = value || {};
  const isWeight = unitType === 'weight';

  return (
    <div className="field">
      <span className="field__label">{label}</span>
      <div className="qty">
        <input
          className="field__input qty__number"
          type="number"
          min="0"
          step="any"
          value={qty}
          onChange={(e) => onChange({ mode, qty: e.target.value })}
          disabled={disabled}
          placeholder="0"
        />
        <select
          className="field__input qty__unit"
          value={mode}
          onChange={(e) => onChange({ mode: e.target.value, qty })}
          disabled={disabled}
        >
          <option value="carton">cartons</option>
          <option value="pack">packs</option>
          {isWeight ? (
            <>
              <option value="kg">kg</option>
              <option value="g">g</option>
            </>
          ) : (
            <>
              <option value="litre">litres</option>
              <option value="ml">ml</option>
            </>
          )}
        </select>
      </div>
      {preview ? (
        <span className="field__hint">{preview}</span>
      ) : hint ? (
        <span className="field__hint">{hint}</span>
      ) : null}
    </div>
  );
}
