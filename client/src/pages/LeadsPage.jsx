import { useCallback, useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Dashboard from '../components/Dashboard.jsx';
import LeadForm from '../components/LeadForm.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import StatusBadge from '../components/StatusBadge.jsx';

const PAGE_SIZE = 10;
const COLUMNS = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'company', label: 'Company', sortable: true },
  { key: 'email', label: 'Contact' },
  { key: 'source', label: 'Source', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'created_at', label: 'Added', sortable: true },
];

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function LeadsPage() {
  const { user, logout } = useAuth();
  const [meta, setMeta] = useState({ statuses: [], sources: [] });
  const [stats, setStats] = useState(null);
  const [result, setResult] = useState({ data: [], total: 0, totalPages: 1 });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState({ key: 'created_at', order: 'desc' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | lead
  const [deleting, setDeleting] = useState(null);
  const [toast, setToast] = useState('');

  const debouncedQuery = useDebounced(query);

  const loadStats = useCallback(() => api.stats().then(setStats).catch(() => {}), []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setResult(
        await api.listLeads({ q: debouncedQuery, status, sort: sort.key, order: sort.order, page, limit: PAGE_SIZE })
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, status, sort, page]);

  useEffect(() => {
    api.meta().then(setMeta).catch((err) => setError(err.message));
    loadStats();
  }, [loadStats]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Any filter change returns to page 1
  useEffect(() => setPage(1), [debouncedQuery, status, sort]);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const refresh = () => {
    loadLeads();
    loadStats();
  };

  const onSaved = (_lead, wasEdit) => {
    setEditing(null);
    flash(wasEdit ? 'Lead updated' : 'Lead added');
    refresh();
  };

  const confirmDelete = async () => {
    await api.deleteLead(deleting.id);
    setDeleting(null);
    flash('Lead deleted');
    // If we removed the last row on this page, step back a page.
    if (result.data.length === 1 && page > 1) setPage(page - 1);
    else refresh();
    loadStats();
  };

  const toggleSort = (key) =>
    setSort((s) => (s.key === key ? { key, order: s.order === 'asc' ? 'desc' : 'asc' } : { key, order: 'asc' }));

  const hasFilters = Boolean(debouncedQuery || status);

  return (
    <div className="container">
      <header className="topbar">
        <h1>Lead Manager</h1>
        <div className="topbar-right">
          <span className="muted hide-sm">{user.name}</span>
          <button className="btn" onClick={logout}>Log out</button>
        </div>
      </header>

      <Dashboard stats={stats} activeStatus={status} onSelect={setStatus} />

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search by name, email or company…"
          aria-label="Search leads"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {meta.statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={() => setEditing('new')}>+ Add lead</button>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error} <button className="link" onClick={refresh}>Retry</button>
        </div>
      )}

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  aria-sort={sort.key === c.key ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {c.sortable ? (
                    <button className="th-btn" onClick={() => toggleSort(c.key)}>
                      {c.label}
                      <span className="sort-ind">{sort.key === c.key ? (sort.order === 'asc' ? '▲' : '▼') : ''}</span>
                    </button>
                  ) : (
                    c.label
                  )}
                </th>
              ))}
              <th className="right">Actions</th>
            </tr>
          </thead>
          <tbody className={loading ? 'dim' : ''}>
            {result.data.map((l) => (
              <tr key={l.id}>
                <td data-label="Name"><strong>{l.name}</strong></td>
                <td data-label="Company">{l.company}</td>
                <td data-label="Contact">
                  <div>{l.email}</div>
                  <div className="muted small">{l.phone}</div>
                </td>
                <td data-label="Source">{l.source}</td>
                <td data-label="Status"><StatusBadge status={l.status} /></td>
                <td data-label="Added">{new Date(l.created_at.replace(' ', 'T') + 'Z').toLocaleDateString()}</td>
                <td className="right nowrap">
                  <button className="btn btn-sm" onClick={() => setEditing(l)}>Edit</button>{' '}
                  <button className="btn btn-sm btn-danger-outline" onClick={() => setDeleting(l)}>Delete</button>
                </td>
              </tr>
            ))}
            {!loading && !error && result.data.length === 0 && (
              <tr>
                <td colSpan={COLUMNS.length + 1} className="empty">
                  {hasFilters ? 'No leads match your search.' : 'No leads yet — add your first one.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="pager">
        <span className="muted">
          {result.total} lead{result.total === 1 ? '' : 's'}
        </span>
        <div>
          <button className="btn btn-sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span className="page-ind">Page {page} of {result.totalPages}</span>
          <button className="btn btn-sm" disabled={page >= result.totalPages} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      </footer>

      {editing && (
        <LeadForm
          lead={editing === 'new' ? null : editing}
          meta={meta}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title="Delete lead?"
          message={`This will permanently delete ${deleting.name} (${deleting.company}). This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
