import { Tooltip } from "./Tooltip.jsx";

/**
 * Reusable action icon button with consistent UX
 * @param {string} icon - Font Awesome icon class (e.g., "fa-trash", "fa-whatsapp")
 * @param {string} tooltip - Tooltip text
 * @param {function} onClick - Click handler
 * @param {string} variant - Color variant: "default", "whatsapp", "pdf", "delete"
 * @param {string} ariaLabel - Accessible label
 * @param {object} style - Additional inline styles
 */
export function ActionIcon({
  icon,
  tooltip,
  onClick,
  variant = "default",
  ariaLabel,
  style = {},
  disabled = false
}) {
  const handleClick = (e) => {
    if (!disabled && onClick) {
      onClick(e);
    }
  };

  // Determine icon class - WhatsApp is a brand icon (fab), others are solid (fas)
  const iconClass = icon === "fa-whatsapp" ? "fab" : "fas";
  const variantClass = variant ? ` ${variant}` : "";

  return (
    <Tooltip text={tooltip} position="top" delay={150}>
      <button
        type="button"
        onClick={handleClick}
        aria-label={ariaLabel || tooltip}
        disabled={disabled}
        className={`action-icon${variantClass}`}
        style={style}
      >
        <i className={`${iconClass} ${icon}`} aria-hidden="true" style={{ pointerEvents: "none" }}></i>
      </button>
    </Tooltip>
  );
}
