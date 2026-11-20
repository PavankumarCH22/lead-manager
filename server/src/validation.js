export const STATUSES = ['New', 'Contacted', 'Qualified', 'Lost'];
export const SOURCES = ['Website', 'Referral', 'LinkedIn', 'Cold Call', 'Email Campaign', 'Event', 'Other'];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s\-()]{7,20}$/;

const clean = (v) => (typeof v === 'string' ? v.trim() : v);

/**
 * Validate a lead payload. Returns { errors, value }.
 * `errors` is an object keyed by field name; empty when valid.
 */
export function validateLead(body = {}) {
  const value = {
    name: clean(body.name),
    email: clean(body.email),
    phone: clean(body.phone),
    company: clean(body.company),
    source: clean(body.source),
    status: clean(body.status) || 'New',
  };
  const errors = {};

  if (!value.name) errors.name = 'Name is required';
  else if (value.name.length > 100) errors.name = 'Name must be 100 characters or fewer';

  if (!value.email) errors.email = 'Email is required';
  else if (!EMAIL_RE.test(value.email) || value.email.length > 254) errors.email = 'Enter a valid email address';

  if (!value.phone) errors.phone = 'Phone is required';
  else if (!PHONE_RE.test(value.phone)) errors.phone = 'Enter a valid phone number (7-20 digits, may include + - ( ))';

  if (!value.company) errors.company = 'Company is required';
  else if (value.company.length > 100) errors.company = 'Company must be 100 characters or fewer';

  if (!SOURCES.includes(value.source)) errors.source = `Source must be one of: ${SOURCES.join(', ')}`;
  if (!STATUSES.includes(value.status)) errors.status = `Status must be one of: ${STATUSES.join(', ')}`;

  return { errors, value };
}

export function validateSignup(body = {}) {
  const value = {
    name: clean(body.name),
    email: clean(body.email)?.toLowerCase?.(),
    password: typeof body.password === 'string' ? body.password : '',
  };
  const errors = {};
  if (!value.name) errors.name = 'Name is required';
  if (!value.email || !EMAIL_RE.test(value.email)) errors.email = 'Enter a valid email address';
  if (value.password.length < 8) errors.password = 'Password must be at least 8 characters';
  return { errors, value };
}

export function validateLogin(body = {}) {
  const value = {
    email: clean(body.email)?.toLowerCase?.(),
    password: typeof body.password === 'string' ? body.password : '',
  };
  const errors = {};
  if (!value.email) errors.email = 'Email is required';
  if (!value.password) errors.password = 'Password is required';
  return { errors, value };
}
