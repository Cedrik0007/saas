import { statusClass } from "../statusClasses";
import { useEffect, useMemo, useState } from "react";

const normalizeColumnName = (columnName) => {
  if (typeof columnName === "string") {
    return columnName.trim().toLowerCase();
  }
  return String(columnName ?? "").trim().toLowerCase();
};

export function Table({
  columns,
  rows,
  sortConfig: controlledSortConfig,
  onSortChange,
  sortableColumns = null,
  defaultSortColumn = null,
  defaultSortDirection = "asc",
}) {
  const [isMobile, setIsMobile] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState(null); // For modal popup
  const [internalSortConfig, setInternalSortConfig] = useState(() => {
    if (defaultSortColumn) {
      return { column: defaultSortColumn, direction: defaultSortDirection };
    }
    return { column: null, direction: "asc" };
  });

  const allowedSortableColumns = useMemo(() => {
    if (Array.isArray(sortableColumns) && sortableColumns.length > 0) {
      return sortableColumns;
    }
    return columns;
  }, [columns, sortableColumns]);

  const isControlledSort = Boolean(controlledSortConfig) && typeof onSortChange === "function";
  const sortConfig = isControlledSort ? controlledSortConfig : internalSortConfig;

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
    const nameColumns = ["Name", "Member Name", "Member", "User", "Donor Name", "Source"];
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

  // Helper functions for sorting (must be defined before conditional return)
  const getAlignmentForColumn = (col) => {
    const numericColumns = [
      "Amount",
      "Balance",
      "Outstanding",
      "Total",
      "Collected",
      "Expected",
      "Avg per Member",
      "Transactions",
      "Donation",
      "Donations",
      "Invoice #",
    ];

    if (col === "Status" || col === "Actions") return "center";
    if (numericColumns.includes(col)) return "right";
    return "left";
  };

  const getComparableValue = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "number") return value;
    if (typeof value === "string") {
      // Try numeric (strip currency symbols/commas)
      const numeric = parseFloat(value.replace(/[^0-9.-]/g, "") || "NaN");
      if (!isNaN(numeric)) return numeric;
      return value.toLowerCase();
    }
    return value;
  };

  const handleSort = (column) => {
    if (!allowedSortableColumns.includes(column)) {
      return;
    }

    if (isControlledSort) {
      const nextDirection = sortConfig?.column === column && sortConfig?.direction === "asc" ? "desc" : "asc";
      onSortChange({ column, direction: nextDirection });
      return;
    }

    setInternalSortConfig((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === "asc" ? "desc" : "asc" };
      }
      return { column, direction: "asc" };
    });
  };

  // Sort rows - MUST be called before any conditional return
  const sortedRows = useMemo(() => {
    if (isControlledSort) {
      return rows;
    }
    if (!sortConfig.column) return rows;
    const col = sortConfig.column;
    const dir = sortConfig.direction === "asc" ? 1 : -1;

    return [...rows].sort((a, b) => {
      const aValRaw = a[col];
      const bValRaw = b[col];

      // For custom renderers, don't attempt to sort (keep original order)
      if (
        (typeof aValRaw === "object" && aValRaw !== null && aValRaw.render) ||
        (typeof bValRaw === "object" && bValRaw !== null && bValRaw.render)
      ) {
        return 0;
      }

      const aVal = getComparableValue(aValRaw);
      const bVal = getComparableValue(bValRaw);

      if (aVal < bVal) return -1 * dir;
      if (aVal > bVal) return 1 * dir;
      return 0;
    });
  }, [rows, sortConfig]);

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
    const selectedRow = selectedCardIndex !== null ? sortedRows[selectedCardIndex] : null;
    
    return (
      <>
        <div className="mobile-table-cards">
          {sortedRows.map((row, rowIndex) => {
            const name = getName(row, columns) || "View Details";
            const statusInfo = getStatusInfo(row, columns);
            const keyMetric = getKeyMetric(row, columns);
            
            return (
              <div 
                key={`mobile-row-${rowIndex}`} 
                className={`mobile-table-card ${statusInfo.borderClass}`}
                style={row._rowStyle || {}}
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
    <table className="data-table">
      <thead>
        <tr>
          {columns.map((col) => {
            const align = getAlignmentForColumn(col);
            const isColumnSortable = allowedSortableColumns.includes(col);
            const isSorted = sortConfig?.column === col;
            const sortIndicator = isSorted ? (sortConfig.direction === "asc" ? "▲" : "▼") : null;

            return (
              <th
                key={col}
                onClick={isColumnSortable ? () => handleSort(col) : undefined}
                style={{
                  textAlign: align,
                  cursor: isColumnSortable ? "pointer" : "default",
                  whiteSpace: "nowrap",
                  userSelect: isColumnSortable ? "none" : "auto",
                }}
                aria-sort={isSorted ? (sortConfig.direction === "asc" ? "ascending" : "descending") : "none"}
              >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    {col}
                    {isSorted && sortIndicator && <span style={{ fontSize: "0.75rem" }}>{sortIndicator}</span>}
                  </span>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((row, rowIndex) => {
          // Check if row has red status pills
          let hasRedStatus = false;
          const statusValue = row["Status"];
          
          if (statusValue) {
            if (typeof statusValue === "object" && statusValue !== null && statusValue.render) {
              const renderedStatus = statusValue.render();
              if (typeof renderedStatus === "object" && renderedStatus?.props) {
                const className = renderedStatus.props.className || "";
                const children = renderedStatus.props.children;
                hasRedStatus = className.includes("badge-overdue") || 
                              className.includes("badge-unpaid") ||
                              (typeof children === "string" && (
                                children.toLowerCase().includes("overdue") ||
                                children.toLowerCase().includes("unpaid") ||
                                children.toLowerCase().includes("rejected")
                              ));
              }
            } else if (typeof statusValue === "string") {
              hasRedStatus = statusValue === "Overdue" || 
                            statusValue === "Unpaid" || 
                            statusValue === "Rejected" ||
                            statusClass[statusValue]?.includes("badge-overdue") ||
                            statusClass[statusValue]?.includes("badge-unpaid");
            }
          }
          
          // Merge row style with status-based background, avoiding conflict between background and backgroundColor
          const rowBackgroundColor = hasRedStatus ? "#fef2f2" : (row._rowStyle?.backgroundColor || undefined);
          const rowStyle = {
            ...(row._rowStyle || {}),
            ...(rowBackgroundColor ? { backgroundColor: rowBackgroundColor } : {})
          };

          const rowNonInteractiveColumns = Array.isArray(row._nonInteractiveColumns) && row._nonInteractiveColumns.length > 0
            ? new Set(
                row._nonInteractiveColumns
                  .map((columnName) => normalizeColumnName(columnName))
                  .filter(Boolean)
              )
            : null;

          const rowClassNames = ["data-table__row"];
          if (row._onRowClick) {
            rowClassNames.push("data-table__row--clickable");
          }
          
          const handleRowClick = (event) => {
            if (!row._onRowClick) return;
            if (event.defaultPrevented) return;
            row._onRowClick(event, row);
          };

          return (
            <tr 
              key={`${row.id ?? rowIndex}-${rowIndex}`}
              style={rowStyle}
              className={rowClassNames.join(" ")}
              onClick={row._onRowClick ? handleRowClick : undefined}
            >
              {columns.map((col) => {
                const value = row[col];
                const align = getAlignmentForColumn(col);
                const normalizedColumnName = normalizeColumnName(col);
                const isActionColumn = normalizedColumnName === "actions" || normalizedColumnName === "action";
                const isSelectionColumn =
                  normalizedColumnName === "select" ||
                  normalizedColumnName === "selection" ||
                  normalizedColumnName === "checkbox";
                const isNonInteractiveColumn =
                  isActionColumn ||
                  isSelectionColumn ||
                  (rowNonInteractiveColumns?.has(normalizedColumnName) ?? false);
                const cellClassNames = ["data-table__cell"];
                if (isNonInteractiveColumn) {
                  cellClassNames.push("data-table__cell--static");
                }

                if (typeof value === "object" && value !== null && value.render) {
                  const renderedValue = value.render();
                  
                  return (
                    <td
                      key={`${col}-render-${rowIndex}`}
                      className={cellClassNames.join(" ")}
                      data-label={col}
                      style={{ 
                        textAlign: align, 
                        verticalAlign: "middle"
                      }}
                    >
                      {renderedValue}
                    </td>
                  );
                }
                
                const isStatus =
                  typeof value === "string" && statusClass[value] && col === "Status";
                
                return (
                  <td
                    key={`${col}-${rowIndex}`}
                    className={cellClassNames.join(" ")}
                    data-label={col}
                    style={{ 
                      textAlign: align, 
                      verticalAlign: "middle"
                    }}
                  >
                    {isStatus ? (
                      <span className={statusClass[value]}>{value}</span>
                    ) : (
                      value
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}





























