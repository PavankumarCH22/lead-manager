import { Router } from 'express';
import { HttpError } from '../middleware.js';
import { validateLead, STATUSES, SOURCES } from '../validation.js';

const SORTABLE = { name: 'name', company: 'company', status: 'status', source: 'source', created_at: 'created_at' };

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new HttpError(400, 'Invalid lead id');
  return id;
};

// Escape LIKE wildcards so a search for "50%" matches literally.
const likeTerm = (q) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export function leadsRoutes(db) {
  const router = Router();

  const findOwned = (id, userId) => {
    const lead = db.prepare('SELECT * FROM leads WHERE id = ? AND user_id = ?').get(id, userId);
    // 404 (not 403) so users cannot probe for other users' lead ids.
    if (!lead) throw new HttpError(404, 'Lead not found');
    return lead;
  };

  router.get('/meta', (_req, res) => res.json({ statuses: STATUSES, sources: SOURCES }));

  // Dashboard: total leads per status
  router.get('/stats', (req, res) => {
    const rows = db
      .prepare('SELECT status, COUNT(*) AS count FROM leads WHERE user_id = ? GROUP BY status')
      .all(req.user.id);
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    rows.forEach((r) => (byStatus[r.status] = r.count));
    res.json({ total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus });
  });

  // List with search, status filter, sorting and pagination
  router.get('/', (req, res) => {
    const { q = '', status = '', sort = 'created_at', order = 'desc' } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));

    if (status && !STATUSES.includes(status)) throw new HttpError(400, `Invalid status filter. Use one of: ${STATUSES.join(', ')}`);

    const where = ['user_id = @userId'];
    const params = { userId: req.user.id };
    if (status) {
      where.push('status = @status');
      params.status = status;
    }
    if (String(q).trim()) {
      where.push("(name LIKE @q ESCAPE '\\' OR email LIKE @q ESCAPE '\\' OR company LIKE @q ESCAPE '\\')");
      params.q = likeTerm(String(q).trim());
    }

    // Column name comes from a whitelist, never from raw input.
    const sortCol = SORTABLE[sort] || 'created_at';
    const sortDir = String(order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const whereSql = where.join(' AND ');

    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM leads WHERE ${whereSql}`).get(params);
    const data = db
      .prepare(`SELECT * FROM leads WHERE ${whereSql} ORDER BY ${sortCol} ${sortDir}, id DESC LIMIT @limit OFFSET @offset`)
      .all({ ...params, limit, offset: (page - 1) * limit });

    res.json({ data, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) });
  });

  router.get('/:id', (req, res) => {
    res.json(findOwned(parseId(req.params.id), req.user.id));
  });

  router.post('/', (req, res) => {
    const { errors, value } = validateLead(req.body);
    if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO leads (user_id, name, email, phone, company, source, status)
         VALUES (@userId, @name, @email, @phone, @company, @source, @status)`
      )
      .run({ ...value, userId: req.user.id });

    res.status(201).json(findOwned(lastInsertRowid, req.user.id));
  });

  router.put('/:id', (req, res) => {
    const id = parseId(req.params.id);
    findOwned(id, req.user.id);

    const { errors, value } = validateLead(req.body);
    if (Object.keys(errors).length) throw new HttpError(400, 'Validation failed', errors);

    db.prepare(
      `UPDATE leads SET name=@name, email=@email, phone=@phone, company=@company,
         source=@source, status=@status, updated_at=datetime('now')
       WHERE id=@id AND user_id=@userId`
    ).run({ ...value, id, userId: req.user.id });

    res.json(findOwned(id, req.user.id));
  });

  router.delete('/:id', (req, res) => {
    const id = parseId(req.params.id);
    findOwned(id, req.user.id);
    db.prepare('DELETE FROM leads WHERE id = ? AND user_id = ?').run(id, req.user.id);
    res.status(204).end();
  });

  return router;
}
