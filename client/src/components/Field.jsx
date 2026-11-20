// Label + input/select + inline error, wired for accessibility.
export default function Field({ label, name, error, children }) {
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label htmlFor={name}>{label}</label>
      {children}
      {error && (
        <p className="error-text" id={`${name}-error`} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
