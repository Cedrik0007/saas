import { statusClass } from "../statusClasses";

export function Table({ columns, rows }) {
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
                return <td key={`${col}-render-${rowIndex}`}>{value.render()}</td>;
              }
              const isStatus =
                typeof value === "string" && statusClass[value] && col === "Status";
              return (
                <td key={`${col}-${rowIndex}`}>
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

























