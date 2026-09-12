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

const Ctx = createContext<{
  boot: Boot | null;
  refresh: () => Promise<void>;
  setTheme: (t: string) => void;
}>({ boot: null, refresh: async () => {}, setTheme: () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Boot | null>(null);
  const refresh = async () => {
    const data = await api("/api/bootstrap");
    setBoot(data);
    const theme = data.user?.theme || localStorage.getItem("duys-theme") || "dark";
    document.documentElement.setAttribute("data-theme", theme);
  };
  useEffect(() => {
    refresh().catch(() => setBoot({ appName: "DUYS", user: null, unreadNotifications: 0, unreadMessages: 0, announcementEnabled: false, announcementText: "", googleEnabled: false, vapidPublic: "", postCharLimit: 500 }));
  }, []);
  const setTheme = (t: string) => {
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem("duys-theme", t);
    setBoot((b) => (b ? { ...b, user: b.user ? { ...b.user, theme: t } : null } : b));
  };
  return <Ctx.Provider value={{ boot, refresh, setTheme }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
