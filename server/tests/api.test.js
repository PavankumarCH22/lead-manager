import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createDb } from '../src/db.js';
import { createApp } from '../src/app.js';

const config = { jwtSecret: 'test-secret-test-secret', jwtExpiresIn: '1h', corsOrigin: '*', rateLimit: false };

const validLead = (over = {}) => ({
  name: 'Asha Patel',
  email: 'asha@example.com',
  phone: '+91 98765 43210',
  company: 'Acme Pvt Ltd',
  source: 'Website',
  status: 'New',
  ...over,
});

let app;

// Fresh in-memory DB per test keeps tests independent.
beforeEach(() => {
  app = createApp(createDb(':memory:'), config);
});

async function signup(email = 'sales@example.com') {
  const res = await request(app).post('/api/auth/signup').send({ name: 'Sam Sales', email, password: 'password123' });
  assert.equal(res.status, 201);
  return res.body.token;
}
const auth = (token) => ({ Authorization: `Bearer ${token}` });

describe('auth', () => {
  test('signup then login returns a token', async () => {
    await signup();
    const res = await request(app).post('/api/auth/login').send({ email: 'sales@example.com', password: 'password123' });
    assert.equal(res.status, 200);
    assert.ok(res.body.token);
  });

  test('rejects duplicate email, weak password and bad credentials', async () => {
    await signup();
    const dup = await request(app).post('/api/auth/signup').send({ name: 'X', email: 'SALES@example.com', password: 'password123' });
    assert.equal(dup.status, 409);

    const weak = await request(app).post('/api/auth/signup').send({ name: 'X', email: 'new@example.com', password: 'short' });
    assert.equal(weak.status, 400);
    assert.ok(weak.body.details.password);

    const bad = await request(app).post('/api/auth/login').send({ email: 'sales@example.com', password: 'wrong-password' });
    assert.equal(bad.status, 401);
  });

  test('leads endpoints require a valid token', async () => {
    assert.equal((await request(app).get('/api/leads')).status, 401);
    assert.equal((await request(app).get('/api/leads').set(auth('garbage'))).status, 401);
  });
});

describe('leads CRUD', () => {
  test('create, read, update status, delete', async () => {
    const token = await signup();

    const created = await request(app).post('/api/leads').set(auth(token)).send(validLead());
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'New');
    const id = created.body.id;

    const fetched = await request(app).get(`/api/leads/${id}`).set(auth(token));
    assert.equal(fetched.body.email, 'asha@example.com');

    const updated = await request(app).put(`/api/leads/${id}`).set(auth(token)).send(validLead({ status: 'Qualified' }));
    assert.equal(updated.status, 200);
    assert.equal(updated.body.status, 'Qualified');

    assert.equal((await request(app).delete(`/api/leads/${id}`).set(auth(token))).status, 204);
    assert.equal((await request(app).get(`/api/leads/${id}`).set(auth(token))).status, 404);
  });

  test('backend validation returns field-level errors', async () => {
    const token = await signup();
    const res = await request(app)
      .post('/api/leads')
      .set(auth(token))
      .send({ name: '', email: 'not-an-email', phone: 'abc', company: '', source: 'Nope', status: 'Weird' });
    assert.equal(res.status, 400);
    for (const field of ['name', 'email', 'phone', 'company', 'source', 'status']) {
      assert.ok(res.body.details[field], `expected error for ${field}`);
    }
  });

  test('invalid id and unknown lead', async () => {
    const token = await signup();
    assert.equal((await request(app).get('/api/leads/abc').set(auth(token))).status, 400);
    assert.equal((await request(app).delete('/api/leads/9999').set(auth(token))).status, 404);
  });

  test('malformed JSON gives a 400, not a crash', async () => {
    const token = await signup();
    const res = await request(app).post('/api/leads').set(auth(token)).set('Content-Type', 'application/json').send('{bad json');
    assert.equal(res.status, 400);
  });
});

describe('isolation between users', () => {
  test("a user cannot see, edit or delete another user's leads", async () => {
    const alice = await signup('alice@example.com');
    const bob = await signup('bob@example.com');

    const { body: lead } = await request(app).post('/api/leads').set(auth(alice)).send(validLead());

    const list = await request(app).get('/api/leads').set(auth(bob));
    assert.equal(list.body.total, 0);
    assert.equal((await request(app).get(`/api/leads/${lead.id}`).set(auth(bob))).status, 404);
    assert.equal((await request(app).put(`/api/leads/${lead.id}`).set(auth(bob)).send(validLead())).status, 404);
    assert.equal((await request(app).delete(`/api/leads/${lead.id}`).set(auth(bob))).status, 404);
    // still intact for the owner
    assert.equal((await request(app).get(`/api/leads/${lead.id}`).set(auth(alice))).status, 200);
  });
});

describe('search, filter, sort, pagination, stats', () => {
  async function seed(token) {
    const rows = [
      validLead({ name: 'Asha Patel', email: 'asha@acme.com', company: 'Acme', status: 'New' }),
      validLead({ name: 'Ben Carter', email: 'ben@globex.com', company: 'Globex', status: 'Contacted' }),
      validLead({ name: 'Chitra Rao', email: 'chitra@initech.com', company: 'Initech', status: 'Qualified' }),
      validLead({ name: 'Dev 100%', email: 'dev@umbrella.com', company: 'Umbrella', status: 'Lost' }),
      validLead({ name: 'Esha Shah', email: 'esha@acme.com', company: 'Acme', status: 'New' }),
    ];
    for (const r of rows) await request(app).post('/api/leads').set(auth(token)).send(r);
  }

  test('search by name/email/company (case-insensitive) and filter by status', async () => {
    const token = await signup();
    await seed(token);

    const byName = await request(app).get('/api/leads?q=ben').set(auth(token));
    assert.deepEqual(byName.body.data.map((l) => l.name), ['Ben Carter']);

    const byCompany = await request(app).get('/api/leads?q=ACME').set(auth(token));
    assert.equal(byCompany.body.total, 2);

    const byStatus = await request(app).get('/api/leads?status=New').set(auth(token));
    assert.equal(byStatus.body.total, 2);

    const both = await request(app).get('/api/leads?status=New&q=esha').set(auth(token));
    assert.equal(both.body.total, 1);

    const bad = await request(app).get('/api/leads?status=Bogus').set(auth(token));
    assert.equal(bad.status, 400);
  });

  test('LIKE wildcards in the search term are treated literally', async () => {
    const token = await signup();
    await seed(token);
    const res = await request(app).get('/api/leads').query({ q: '%' }).set(auth(token));
    assert.deepEqual(res.body.data.map((l) => l.name), ['Dev 100%']);
  });

  test('pagination and sorting', async () => {
    const token = await signup();
    await seed(token);

    const p1 = await request(app).get('/api/leads?limit=2&page=1&sort=name&order=asc').set(auth(token));
    assert.equal(p1.body.total, 5);
    assert.equal(p1.body.totalPages, 3);
    assert.deepEqual(p1.body.data.map((l) => l.name), ['Asha Patel', 'Ben Carter']);

    const p3 = await request(app).get('/api/leads?limit=2&page=3&sort=name&order=asc').set(auth(token));
    assert.deepEqual(p3.body.data.map((l) => l.name), ['Esha Shah']);

    // an unknown sort column falls back safely rather than reaching SQL
    const inj = await request(app).get('/api/leads').query({ sort: 'name; DROP TABLE leads' }).set(auth(token));
    assert.equal(inj.status, 200);
    assert.equal(inj.body.total, 5);
  });

  test('stats returns a count for every status, including zeros', async () => {
    const token = await signup();
    assert.deepEqual((await request(app).get('/api/leads/stats').set(auth(token))).body, {
      total: 0,
      byStatus: { New: 0, Contacted: 0, Qualified: 0, Lost: 0 },
    });
    await seed(token);
    const res = await request(app).get('/api/leads/stats').set(auth(token));
    assert.equal(res.body.total, 5);
    assert.deepEqual(res.body.byStatus, { New: 2, Contacted: 1, Qualified: 1, Lost: 1 });
  });
});
