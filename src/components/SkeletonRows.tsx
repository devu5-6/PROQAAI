export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="skeleton-row" key={i}>
          <div className="skeleton" style={{ width: 28, height: 20 }} />
          <div className="skeleton" style={{ width: 140 + (i % 3) * 30, height: 16 }} />
          <div className="skeleton" style={{ width: 90, height: 16 }} />
          <div className="skeleton" style={{ width: 64, height: 16 }} />
          <div className="skeleton" style={{ width: 200, height: 24 }} />
        </div>
      ))}
    </div>
  );
}
