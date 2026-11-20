import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getToken, setToken, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(getToken()));

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    if (!getToken()) return;
    api
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, [logout]);

  const authenticate = async (fn, body) => {
    const { token, user } = await fn(body);
    setToken(token);
    setUser(user);
  };

  const value = {
    user,
    loading,
    login: (body) => authenticate(api.login, body),
    signup: (body) => authenticate(api.signup, body),
    logout,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
