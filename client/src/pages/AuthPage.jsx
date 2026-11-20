import { useState } from 'react';
import { useAuth } from '../auth.jsx';
import { validateAuth } from '../validation.js';
import Field from '../components/Field.jsx';

export default function AuthPage() {
  const { login, signup } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }));

  const toggle = () => {
    setIsSignup((s) => !s);
    setErrors({});
    setFormError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    const errs = validateAuth(values, isSignup);
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;

    setBusy(true);
    try {
      if (isSignup) await signup({ name: values.name, email: values.email, password: values.password });
      else await login({ email: values.email, password: values.password });
    } catch (err) {
      setErrors(err.details || {});
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-wrap">
      <form className="card auth-card" onSubmit={submit} noValidate>
        <h1>Lead Manager</h1>
        <p className="muted">{isSignup ? 'Create your account' : 'Sign in to manage your leads'}</p>

        {formError && <div className="alert alert-error" role="alert">{formError}</div>}

        {isSignup && (
          <Field label="Name" name="name" error={errors.name}>
            <input id="name" name="name" value={values.name} onChange={set} autoComplete="name" />
          </Field>
        )}
        <Field label="Email" name="email" error={errors.email}>
          <input id="email" name="email" type="email" value={values.email} onChange={set} autoComplete="email" />
        </Field>
        <Field label="Password" name="password" error={errors.password}>
          <input
            id="password"
            name="password"
            type="password"
            value={values.password}
            onChange={set}
            autoComplete={isSignup ? 'new-password' : 'current-password'}
          />
        </Field>

        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Please wait…' : isSignup ? 'Sign up' : 'Log in'}
        </button>
        <p className="muted center-text">
          {isSignup ? 'Already have an account?' : 'New here?'}{' '}
          <button type="button" className="link" onClick={toggle}>
            {isSignup ? 'Log in' : 'Create an account'}
          </button>
        </p>
      </form>
    </main>
  );
}
