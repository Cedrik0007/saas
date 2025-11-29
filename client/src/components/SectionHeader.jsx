export function SectionHeader({ number, title, subtitle }) {
  return (
    <div className="section-header">
      <h2>
        {number} · {title}
      </h2>
      <p>{subtitle}</p>
    </div>
  );
}




















