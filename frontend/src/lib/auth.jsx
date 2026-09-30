import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api, json } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/auth/current-user")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
    const handleSessionExpired = () => setUser(null);
    window.addEventListener("taskforge:session-expired", handleSessionExpired);
    return () => window.removeEventListener("taskforge:session-expired", handleSessionExpired);
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    async signIn(credentials) {
      const result = await api("/auth/login", json("POST", credentials));
      setUser(result.user);
      return result.user;
    },
    async signOut() {
      try { await api("/auth/logout", { method: "POST" }, false); }
      catch { /* Clear the local session even when the server token already expired. */ }
      finally { setUser(null); }
    },
    setUser,
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
