// Total leads per status. Clicking a card filters the table by that status.
export default function Dashboard({ stats, activeStatus, onSelect }) {
  if (!stats) return null;
  return (
    <section className="stats" aria-label="Lead counts">
      <button className={`stat${!activeStatus ? ' active' : ''}`} onClick={() => onSelect('')}>
        <span className="stat-num">{stats.total}</span>
        <span className="stat-label">Total</span>
      </button>
      {Object.entries(stats.byStatus).map(([status, count]) => (
        <button
          key={status}
          className={`stat stat-${status.toLowerCase()}${activeStatus === status ? ' active' : ''}`}
          onClick={() => onSelect(activeStatus === status ? '' : status)}
        >
          <span className="stat-num">{count}</span>
          <span className="stat-label">{status}</span>
        </button>
      ))}
    </section>
  );
}
