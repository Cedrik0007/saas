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

  // Get primary field for card title (first non-empty field)
  const getCardTitle = (row, columns) => {
    for (const col of columns) {
      const value = row[col];
      if (value && value !== "-" && value !== "N/A") {
        if (typeof value === "object" && value !== null && value.render) {
          return `${col}: Details`;
        }
        return `${col}: ${value}`;
      }
    }
    return "View Details";
  };

  // Mobile card layout with accordion
  if (isMobile) {
    return (
      <div className="mobile-table-cards">
        {rows.map((row, rowIndex) => {
          const isExpanded = expandedCards.has(rowIndex);
          const cardTitle = getCardTitle(row, columns);
          
          return (
            <div 
              key={`mobile-row-${rowIndex}`} 
              className={`mobile-table-card ${isExpanded ? 'expanded' : ''}`}
            >
              <div 
                className="mobile-table-card-header"
                onClick={() => toggleCard(rowIndex)}
              >
                <div className="mobile-table-card-title">{cardTitle}</div>
                <div
                  className="mobile-table-card-toggle"
                  style={{
                    fontSize: "0.9rem",
                    color: "#5a31ea",
                    fontWeight: "600",
                    lineHeight: "1",
                    transition: "transform 0.2s ease",
                    transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                    display: "inline-block",
                  }}
                >
                  <i className="fa-solid fa-angle-down" />
                </div>
              </div>
              <div className="mobile-table-card-content">
                {columns.map((col) => {
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

                  return (
                    <div key={`${col}-${rowIndex}`} className="mobile-table-row">
                      <div className="mobile-table-label">{col}</div>
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





























