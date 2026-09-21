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
  const refresh = async () => {
    const data = await api("/api/bootstrap");
    setBoot(data);
    const theme = data.user?.theme || localStorage.getItem("duys-theme") || "dark";
    document.documentElement.setAttribute("data-theme", theme);
  };
  useEffect(() => {
    refresh().catch(() => {}).finally(() => setLoading(false));
  }, []);
  const setTheme = (t: string) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("duys-theme", t);
    setBoot((b) => (b ? { ...b, user: b.user ? { ...b.user, theme: t } : null } : b));
  };
  return <Ctx.Provider value={{ boot, loading, refresh, setTheme }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
