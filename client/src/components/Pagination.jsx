export function Pagination({ 
  currentPage, 
  totalPages, 
  onPageChange, 
  pageSize, 
  onPageSizeChange,
  totalItems,
  pageSizeOptions = [5, 10, 20, 50, 100]
}) {
  // Always show pagination when there are items
  if (totalItems === 0) {
    return null; // Only hide if there are no items
  }

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "16px",
      padding: "16px",
      borderTop: "1px solid #e0e0e0",
      background: "#f9fafb"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "0.875rem", color: "#666" }}>
          Showing {startItem} to {endItem} of {totalItems} items
        </span>
        <label style={{ fontSize: "0.875rem", color: "#666", display: "flex", alignItems: "center", gap: "8px", whiteSpace: "nowrap" }}>
          <span>Items per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value));
              onPageChange(1); // Reset to first page when changing page size
            }}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid #e0e0e0",
              fontSize: "0.875rem",
              background: "#fff",
              cursor: "pointer",
              minWidth: "70px"
            }}
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>
      
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          onClick={() => onPageChange(1)}
          disabled={currentPage === 1}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #e0e0e0",
            background: currentPage === 1 ? "#f5f5f5" : "#fff",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
            color: currentPage === 1 ? "#999" : "#333",
            opacity: currentPage === 1 ? 0.5 : 1
          }}
        >
          « First
        </button>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #e0e0e0",
            background: currentPage === 1 ? "#f5f5f5" : "#fff",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
            color: currentPage === 1 ? "#999" : "#333",
            opacity: currentPage === 1 ? 0.5 : 1
          }}
        >
          ‹ Prev
        </button>
        
        <span style={{ fontSize: "0.875rem", color: "#666", padding: "0 8px" }}>
          Page {currentPage} of {totalPages}
        </span>
        
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #e0e0e0",
            background: currentPage === totalPages ? "#f5f5f5" : "#fff",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
            color: currentPage === totalPages ? "#999" : "#333",
            opacity: currentPage === totalPages ? 0.5 : 1
          }}
        >
          Next ›
        </button>
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={currentPage === totalPages}
          style={{
            padding: "8px 12px",
            borderRadius: "6px",
            border: "1px solid #e0e0e0",
            background: currentPage === totalPages ? "#f5f5f5" : "#fff",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
            color: currentPage === totalPages ? "#999" : "#333",
            opacity: currentPage === totalPages ? 0.5 : 1
          }}
        >
          Last »
        </button>
      </div>
    </div>
  );
}

