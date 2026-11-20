import { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { validateLead } from '../validation.js';
import Field from './Field.jsx';

const EMPTY = { name: '', email: '', phone: '', company: '', source: '', status: 'New' };

// Modal form used for both adding and editing a lead.
export default function LeadForm({ lead, meta, onClose, onSaved }) {
  const isEdit = Boolean(lead);
  const [values, setValues] = useState(lead ? { ...EMPTY, ...lead } : EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const firstRef = useRef(null);

  useEffect(() => {
    firstRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = validateLead(values);
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      const { name, email, phone, company, source, status } = values;
      const body = { name, email, phone, company, source, status };
      const saved = isEdit ? await api.updateLead(lead.id, body) : await api.createLead(body);
      onSaved(saved, isEdit);
    } catch (err) {
      setErrors(err.details || {}); // show server-side field errors inline
      setFormError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="card modal" onSubmit={submit} noValidate role="dialog" aria-modal="true" aria-labelledby="lead-form-title">
        <h2 id="lead-form-title">{isEdit ? 'Edit lead' : 'Add lead'}</h2>
        {formError && <div className="alert alert-error" role="alert">{formError}</div>}

        <div className="grid-2">
          <Field label="Name *" name="name" error={errors.name}>
            <input id="name" name="name" ref={firstRef} value={values.name} onChange={set} maxLength={100} />
          </Field>
          <Field label="Company *" name="company" error={errors.company}>
            <input id="company" name="company" value={values.company} onChange={set} maxLength={100} />
          </Field>
          <Field label="Email *" name="email" error={errors.email}>
            <input id="email" name="email" type="email" value={values.email} onChange={set} />
          </Field>
          <Field label="Phone *" name="phone" error={errors.phone}>
            <input id="phone" name="phone" type="tel" value={values.phone} onChange={set} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Source *" name="source" error={errors.source}>
            <select id="source" name="source" value={values.source} onChange={set}>
              <option value="">Select source…</option>
              {meta.sources.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Status" name="status" error={errors.status}>
            <select id="status" name="status" value={values.status} onChange={set}>
              {meta.statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
        </div>

        <div className="actions">
          <button type="button" className="btn" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : isEdit ? 'Save changes' : 'Add lead'}
          </button>
        </div>
      </form>
    </div>
  );
}
