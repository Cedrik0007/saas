import { statusClass } from "../statusClasses";
import { useEffect, useState } from "react";

export function Table({ columns, rows }) {
  const [isMobile, setIsMobile] = useState(false);
  const [expandedCards, setExpandedCards] = useState(new Set());

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleCard = (index) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

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

  // Mobile card layout with accordion
  if (isMobile) {
    return (
      <div className="mobile-table-cards">
        {rows.map((row, rowIndex) => {
          const isExpanded = expandedCards.has(rowIndex);
          const name = getName(row, columns) || "View Details";
          const statusInfo = getStatusInfo(row, columns);
          const keyMetric = getKeyMetric(row, columns);
          const rowHasActions = hasActions(row, columns);
          
          return (
            <div 
              key={`mobile-row-${rowIndex}`} 
              className={`mobile-table-card ${isExpanded ? 'expanded' : ''} ${statusInfo.borderClass}`}
            >
              <div 
                className="mobile-table-card-header"
                onClick={() => toggleCard(rowIndex)}
              >
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
                    <div
                      className="mobile-table-card-toggle"
                    >
                      <i className="fa-solid fa-angle-down" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="mobile-table-card-content">
                {columns.map((col) => {
                  // Skip name column if it's the only thing (already in header)
                  // But show it if there are other details to display
                  const nameColumns = ["Name", "Member", "User", "Donor Name", "Source"];
                  const isNameColumn = nameColumns.includes(col);
                  if (isNameColumn && name) {
                    // Skip name column since it's already prominently displayed in header
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

                  // Skip empty values
                  if (!displayValue && displayValue !== 0 && displayValue !== "$0") return null;
                  
                  // Skip if it's the key metric already shown in header
                  if (keyMetric && col === keyMetric.label) return null;
                  
                  // Handle Actions column specially
                  if (col === "Actions") {
                    const actions = row[col];
                    if (typeof actions === "object" && actions !== null && actions.render) {
                      return (
                        <div key={`${col}-${rowIndex}`} className="mobile-table-row mobile-table-row-actions">
                          <div className="mobile-table-label">{col}</div>
                          <div className="mobile-table-value">{actions.render()}</div>
                        </div>
                      );
                    }
                  }

                  // Get icon for field type
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
                    <div key={`${col}-${rowIndex}`} className="mobile-table-row">
                      <div className="mobile-table-label">
                        {fieldIcon && <i className={`fas ${fieldIcon}`} style={{ marginRight: "6px", color: "#5a31ea", fontSize: "0.75rem" }}></i>}
                        {col}
                      </div>
                      <div className="mobile-table-value">{displayValue}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
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





























