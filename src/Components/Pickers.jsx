import { CATEGORY_COLORS, CATEGORY_ICONS } from "../lib/options";
import { getIcon } from "../lib/icons";
import "./ModalForms.css";

/** Fixed palette swatch row — used by categories, accounts and savings goals. */
export function ColorPicker({ value, onChange, label = "Ngjyra" }) {
  return (
    <div>
      <div className="fcp-picker-label">{label}</div>
      <div className="fcp-swatches">
        {CATEGORY_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            className={`fcp-swatch${value === color ? " active" : ""}`}
            style={{ background: color }}
            onClick={() => onChange(color)}
            aria-label={`Zgjidh ngjyrën ${color}`}
          />
        ))}
      </div>
    </div>
  );
}

/** Icon name picker. Names are persisted (not components) and rendered through `getIcon`. */
export function IconPicker({ value, onChange, label = "Ikona" }) {
  return (
    <div>
      <div className="fcp-picker-label">{label}</div>
      <div className="fcp-icon-picker">
        {CATEGORY_ICONS.map((name) => {
          const Icon = getIcon(name);
          return (
            <button
              key={name}
              type="button"
              className={`fcp-icon-btn${value === name ? " active" : ""}`}
              onClick={() => onChange(name)}
              title={name}
              aria-label={`Zgjidh ikonën ${name}`}
            >
              <Icon size={16} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
