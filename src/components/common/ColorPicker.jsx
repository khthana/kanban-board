import { useRef } from 'react';
import { PRESET_COLORS } from '../../domain/colors';
import styles from './ColorPicker.module.css';

/**
 * Pastel swatch picker shared by column and label color editing.
 *
 * @param value      currently selected hex color, or null when no color is set
 * @param onChange   called with the new hex color (or null when cleared)
 * @param allowClear when true, renders a "✕" swatch that sets the color to null
 */
export default function ColorPicker({ value, onChange, allowClear = false }) {
  const colorInputRef = useRef(null);
  const isPreset = value != null && PRESET_COLORS.includes(value);
  const isCustom = value != null && !isPreset;

  return (
    <div className={styles.swatchRow}>
      {PRESET_COLORS.map(c => (
        <button
          key={c}
          type="button"
          data-swatch={c}
          className={`${styles.swatch} ${value === c ? styles.swatchSelected : ''}`}
          style={{ background: c }}
          onClick={() => onChange(c)}
          title={c}
          aria-label={`Color ${c}`}
        />
      ))}

      <button
        type="button"
        data-swatch="custom"
        className={`${styles.swatch} ${styles.swatchCustom} ${isCustom ? styles.swatchSelected : ''}`}
        style={isCustom ? { background: value } : {}}
        onClick={() => colorInputRef.current?.click()}
        title="Custom color"
        aria-label="Pick a custom color"
      >
        {!isCustom && '+'}
      </button>

      {allowClear && (
        <button
          type="button"
          data-swatch="clear"
          className={`${styles.swatch} ${styles.swatchClear} ${value === null ? styles.swatchSelected : ''}`}
          onClick={() => onChange(null)}
          title="No color"
          aria-label="Clear color"
        >✕</button>
      )}

      <input
        ref={colorInputRef}
        type="color"
        value={isCustom ? value : '#ffffff'}
        onChange={e => onChange(e.target.value)}
        className={styles.hiddenColorInput}
      />
    </div>
  );
}
