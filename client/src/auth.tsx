import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";

export type Me = {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  points: number;
  verifiedBadge: string;
  isAdmin: boolean;
  theme: string;
};

type Boot = {
  appName: string;
  user: Me | null;
  unreadNotifications: number;
  unreadMessages: number;
  announcementEnabled: boolean;
  announcementText: string;
  googleEnabled: boolean;
  vapidPublic: string;
  postCharLimit: number;
};

type AuthContext = {
  boot: Boot | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setTheme: (t: string) => void;
};

const Ctx = createContext<AuthContext>({
  boot: null,
  loading: true,
  refresh: async () => {},
  setTheme: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Boot | null>(null);
  const [loading, setLoading] = useState(true);
  const getTheme = (): string => {
    try { return localStorage.getItem("duys-theme") ?? "dark"; } catch { return "dark"; }
  };
  const refresh = async () => {
    try {
      const data = await api("/api/bootstrap");
      setBoot(data);
      const theme = data.user?.theme || getTheme();
      document.documentElement.setAttribute("data-theme", theme);
    } catch (ex) {
      // Bootstrap failed — set boot to a fallback with user=null so AppShell's
      // redirect-to-login logic runs instead of hanging on PageLoading forever.
      const error = ex as Error & { data?: { appName?: string } };
      setBoot({
        appName: error.data?.appName || "DUYS",
        user: null,
        unreadNotifications: 0,
        unreadMessages: 0,
        announcementEnabled: false,
        announcementText: "",
        googleEnabled: false,
        vapidPublic: "",
        postCharLimit: 1000,
      });
      document.documentElement.setAttribute("data-theme", getTheme());
    }
  };
  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);
  const setTheme = (t: string) => {
    try { localStorage.setItem("duys-theme", t); } catch { /* ignore */ }
    document.documentElement.setAttribute("data-theme", t);
    setBoot((b) => (b ? { ...b, user: b.user ? { ...b.user, theme: t } : null } : b));
  };
  return <Ctx.Provider value={{ boot, loading, refresh, setTheme }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
