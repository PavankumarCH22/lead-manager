import { useAuth } from './auth.jsx';
import AuthPage from './pages/AuthPage.jsx';
import LeadsPage from './pages/LeadsPage.jsx';

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="center muted">Loading…</div>;
  return user ? <LeadsPage /> : <AuthPage />;
}
