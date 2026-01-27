import { useEffect, useId } from "react";

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  overlayClassName = "modal-overlay modal-overlay-high",
  overlayStyle,
  contentClassName = "card",
  contentStyle,
  ariaLabel,
}) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (onClose) onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: { width: "420px", maxWidth: "90vw" },
    md: { width: "560px", maxWidth: "92vw" },
    lg: { width: "900px", maxWidth: "95vw" },
  };

  const mergedContentStyle = {
    ...sizeStyles[size] || sizeStyles.md,
    ...contentStyle,
  };

  return (
    <div
      className={overlayClassName}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) {
          onClose();
        }
      }}
      style={overlayStyle}
    >
      <div
        className={contentClassName}
        style={mergedContentStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={!title ? (ariaLabel || "Modal dialog") : undefined}
      >
        {title && (
          <div
            style={{
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h3 id={titleId} style={{ margin: 0, fontSize: "1.2rem", fontWeight: 600, color: "#111" }}>
              {title}
            </h3>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "50%",
                  background: "#f3f4f6",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.2rem",
                  fontWeight: "bold",
                  color: "#666",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = "#e5e7eb";
                  e.target.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = "#f3f4f6";
                  e.target.style.transform = "scale(1)";
                }}
                aria-label="Close"
              >
                ×
              </button>
            )}
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
