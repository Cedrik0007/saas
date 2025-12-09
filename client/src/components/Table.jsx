import { statusClass } from "../statusClasses";
import { useEffect, useState } from "react";

export function Table({ columns, rows }) {
  const [isMobile, setIsMobile] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null); // For modal popup

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close modal when clicking outside or pressing escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && selectedCardIndex !== null) {
        setSelectedCardIndex(null);
      }
    };
    if (selectedCardIndex !== null) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [selectedCardIndex]);

  // Get name from row (prioritize name columns)
  const getName = (row, columns) => {
    const nameColumns = ["Name", "Member", "User", "Donor Name", "Source"];
    for (const nameCol of nameColumns) {
      if (columns.includes(nameCol)) {
        const value = row[nameCol];
        if (value && value !== "-" && value !== "N/A") {
          if (typeof value === "object" && value !== null && value.render) {
            continue;
          }
          return value;
        }
      }
    }
    return null;
  };

  // Get status value and determine border color class
  const getStatusInfo = (row, columns) => {
    if (!columns.includes("Status")) return { status: null, borderClass: "" };
    
    const statusValue = row["Status"];
    let statusText = null;
    
    if (typeof statusValue === "object" && statusValue !== null && statusValue.render) {
      // Try to extract text from rendered status
      const rendered = statusValue.render();
      if (typeof rendered === "string") {
        statusText = rendered;
      } else if (rendered?.props?.children) {
        statusText = rendered.props.children;
      }
    } else if (statusValue) {
      statusText = statusValue;
    }

    if (!statusText || statusText === "-" || statusText === "N/A") {
      return { status: null, borderClass: "" };
    }

    const statusLower = statusText.toLowerCase();
    let borderClass = "mobile-card-border-default";
    
    if (statusLower.includes("active") || statusLower.includes("paid") || statusLower.includes("completed")) {
      borderClass = "mobile-card-border-success";
    } else if (statusLower.includes("pending")) {
      borderClass = "mobile-card-border-warning";
    } else if (statusLower.includes("inactive") || statusLower.includes("overdue") || statusLower.includes("rejected")) {
      borderClass = "mobile-card-border-danger";
    }

    return { status: statusText, borderClass, statusValue };
  };

  // Get key metric to display in header (Balance, Amount, etc.)
  const getKeyMetric = (row, columns) => {
    const metricColumns = ["Balance", "Amount"];
    for (const metricCol of metricColumns) {
      if (columns.includes(metricCol)) {
        const value = row[metricCol];
        if (value && value !== "-" && value !== "N/A" && value !== "$0") {
          if (typeof value === "object" && value !== null && value.render) {
            continue;
          }
          return { label: metricCol, value };
        }
      }
    }
    return null;
  };

  // Check if row has actions available
  const hasActions = (row, columns) => {
    return columns.includes("Actions") && row["Actions"] !== null && row["Actions"] !== undefined;
  };

  // Helper function to render modal content
  const renderModalContent = (row, rowIndex, columns, onCloseModal) => {
    const name = getName(row, columns);
    const keyMetric = getKeyMetric(row, columns);
    
    return columns.map((col) => {
      const nameColumns = ["Name", "Member", "User", "Donor Name", "Source"];
      const isNameColumn = nameColumns.includes(col);
      if (isNameColumn && name) {
        return null;
      }
      
      const value = row[col];
      let displayValue;
      
      if (typeof value === "object" && value !== null && value.render) {
        displayValue = value.render();
      } else {
        const isStatus = typeof value === "string" && statusClass[value] && col === "Status";
        displayValue = isStatus ? (
          <span className={statusClass[value]}>{value}</span>
        ) : (
          value
        );
      }

      if (!displayValue && displayValue !== 0 && displayValue !== "$0") return null;
      
      if (keyMetric && col === keyMetric.label) return null;

      if (col === "Actions") {
        const actions = row[col];
        if (typeof actions === "object" && actions !== null && actions.render) {
          return (
            <div 
              key={`${col}-${rowIndex}`} 
              className="mobile-card-modal-row mobile-card-modal-row-actions"
              onClick={(e) => {
                // If a button was clicked, close the modal after a short delay
                if (e.target.tagName === "BUTTON" || e.target.closest("button")) {
                  setTimeout(() => {
                    onCloseModal();
                  }, 150);
                }
              }}
            >
              <div className="mobile-card-modal-label">{col}</div>
              <div className="mobile-card-modal-value">{actions.render()}</div>
            </div>
          );
        }
      }

      const getFieldIcon = (fieldName) => {
        const iconMap = {
          "Email": "fa-envelope",
          "WhatsApp": "fa-phone",
          "Phone": "fa-phone",
          "Balance": "fa-wallet",
          "Amount": "fa-dollar-sign",
          "Date": "fa-calendar",
          "Due Date": "fa-calendar-alt",
          "Period": "fa-calendar-week",
          "Method": "fa-credit-card",
          "Reference": "fa-hashtag",
          "Status": "fa-info-circle",
          "Type": "fa-tag",
          "Details": "fa-file-alt",
          "ID": "fa-id-card",
          "Invoice #": "fa-file-invoice",
        };
        return iconMap[fieldName] || null;
      };

      const fieldIcon = getFieldIcon(col);

      return (
        <div key={`${col}-${rowIndex}`} className="mobile-card-modal-row">
          <div className="mobile-card-modal-label">
            {fieldIcon && <i className={`fas ${fieldIcon}`} style={{ marginRight: "6px", color: "#5a31ea", fontSize: "0.75rem" }}></i>}
            {col}
          </div>
          <div className="mobile-card-modal-value">{displayValue}</div>
        </div>
      );
    });
  };

  // Mobile card layout with modal popup
  if (isMobile) {
    const selectedRow = selectedCardIndex !== null ? rows[selectedCardIndex] : null;
    
    return (
      <>
        <div className="mobile-table-cards">
          {rows.map((row, rowIndex) => {
            const name = getName(row, columns) || "View Details";
            const statusInfo = getStatusInfo(row, columns);
            const keyMetric = getKeyMetric(row, columns);
            
            return (
              <div 
                key={`mobile-row-${rowIndex}`} 
                className={`mobile-table-card ${statusInfo.borderClass}`}
                onClick={() => setSelectedCardIndex(rowIndex)}
              >
                <div className="mobile-table-card-header">
                  <div className="mobile-table-card-header-content">
                    <div className="mobile-table-card-title-section">
                      <div className="mobile-table-card-title">{name}</div>
                      {keyMetric && (
                        <div className="mobile-table-card-metric">
                          {keyMetric.label === "Balance" && <i className="fas fa-wallet" style={{ fontSize: "0.75rem", marginRight: "4px", color: "#666" }}></i>}
                          {keyMetric.label === "Amount" && <i className="fas fa-dollar-sign" style={{ fontSize: "0.75rem", marginRight: "4px", color: "#666" }}></i>}
                          <span>{keyMetric.value}</span>
                        </div>
                      )}
                    </div>
                    <div className="mobile-table-card-header-right">
                      {statusInfo.status && (
                        <div className="mobile-table-card-status">
                          {typeof statusInfo.statusValue === "object" && statusInfo.statusValue !== null && statusInfo.statusValue.render ? (
                            statusInfo.statusValue.render()
                          ) : (
                            <span className={statusClass[statusInfo.status] || "badge"}>{statusInfo.status}</span>
                          )}
                        </div>
                      )}
                      <div className="mobile-table-card-arrow">
                        <i className="fa-solid fa-chevron-right" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal Popup for Card Details */}
        {selectedCardIndex !== null && selectedRow && (
          <div 
            className="mobile-card-modal-overlay"
            onClick={() => setSelectedCardIndex(null)}
          >
            <div 
              className="mobile-card-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mobile-card-modal-header">
                <div className="mobile-card-modal-title-section">
                  <div className="mobile-card-modal-title">
                    {getName(selectedRow, columns) || "Details"}
                  </div>
                  {getKeyMetric(selectedRow, columns) && (
                    <div className="mobile-card-modal-metric">
                      {getKeyMetric(selectedRow, columns).label === "Balance" && <i className="fas fa-wallet" style={{ fontSize: "0.75rem", marginRight: "4px", color: "#666" }}></i>}
                      {getKeyMetric(selectedRow, columns).label === "Amount" && <i className="fas fa-dollar-sign" style={{ fontSize: "0.75rem", marginRight: "4px", color: "#666" }}></i>}
                      <span>{getKeyMetric(selectedRow, columns).value}</span>
                    </div>
                  )}
                </div>
                <button
                  className="mobile-card-modal-close"
                  onClick={() => setSelectedCardIndex(null)}
                  aria-label="Close"
                >
                  <i className="fa-solid fa-times" />
                </button>
              </div>
              
              <div className="mobile-card-modal-content">
                {renderModalContent(selectedRow, selectedCardIndex, columns, () => setSelectedCardIndex(null))}
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // Desktop table layout
  return (
    <table>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={col}>{col}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={`${row.id ?? rowIndex}-${rowIndex}`}>
            {columns.map((col) => {
              const value = row[col];
              if (typeof value === "object" && value !== null && value.render) {
                return <td key={`${col}-render-${rowIndex}`} data-label={col}>{value.render()}</td>;
              }
              const isStatus =
                typeof value === "string" && statusClass[value] && col === "Status";
              return (
                <td key={`${col}-${rowIndex}`} data-label={col}>
                  {isStatus ? (
                    <span className={statusClass[value]}>{value}</span>
                  ) : (
                    value
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}





























