import { Route, Routes } from "react-router-dom";
import { api } from "./api";
import { AppShell } from "./components/AppShell";
import {
  ChannelView,
  ChannelsPage,
  ClaimDUYS,
  EarnPage,
  ExplorePage,
  HomePage,
  LeaderboardPage,
  LegalPage,
  LivePage,
  LiveRoomPage,
  LoginPage,
  MessagesPage,
  NotificationsPage,
  PostDetail,
  ProfilePage,
  ReferralPage,
  SearchPage,
  SettingsPage,
  ShopPage,
  StartDm,
  StoriesPage,
  SwapPage,
  VerificationPage,
  WalletPage,
  AdminAnalytics,
  AdminBlockchain,
  AdminBroadcast,
  AdminEconomy,
  AdminEntity,
  AdminFeatures,
  AdminFinance,
  AdminOverview,
  AdminReports,
  AdminSettings,
  AdminShell,
  AdminSubscriptions,
  AdminTable,
  AdminUserDetail,
  AdminUsers,
  AdminVerifications,
} from "./pages";
import { useAuth } from "./auth";

function GoogleCallback() {
  const { refresh } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (code) {
    api("/api/auth/google/callback", { method: "POST", body: JSON.stringify({ code }) })
      .then(async (d) => {
        if (d.needsUsername) {
          const username = window.prompt("Choose a username") || "";
          await api("/api/auth/google/setup", {
            method: "POST",
            body: JSON.stringify({ ...d.google, googleId: d.google.id, username, displayName: d.google.name, avatarUrl: d.google.picture }),
          });
        }
        await refresh();
        window.location.href = "/";
      })
      .catch(() => {
        window.location.href = "/auth/login";
      });
  }
  return <p>Signing in…</p>;
}

export function App() {
  const del = (base: string) => [{
    label: "Delete",
    style: "btn-danger",
    call: (r: any) => api(`${base}/${r.id}/delete`, { method: "POST", body: "{}" }),
  }] as { label: string; style?: string; call: (r: any) => Promise<unknown> }[];
  return (
    <Routes>
      <Route path="/auth/login" element={<LoginPage />} />
      <Route path="/auth/google/callback" element={<GoogleCallback />} />
      <Route path="/legal/:page" element={<LegalPage />} />
      <Route path="/admin" element={<AdminShell />}>
        <Route index element={<AdminOverview />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="users/:id" element={<AdminUserDetail />} />
        <Route path="posts" element={<AdminTable title="Posts" path="/api/admin/posts" actions={del("/api/admin/posts")} />} />
        <Route path="comments" element={<AdminTable title="Comments" path="/api/admin/comments" actions={del("/api/admin/comments")} />} />
        <Route path="stories" element={<AdminTable title="Stories" path="/api/admin/stories" actions={del("/api/admin/stories")} />} />
        <Route path="live" element={<AdminTable title="Live" path="/api/admin/live" actions={[{ label: "End", call: (r: any) => api(`/api/admin/live/${r.id}/end`, { method: "POST", body: "{}" }) }]} />} />
        <Route path="channels" element={<AdminTable title="Channels" path="/api/admin/channels" actions={del("/api/admin/channels")} />} />
        <Route path="groups" element={<AdminTable title="Groups" path="/api/admin/groups" actions={del("/api/admin/groups")} />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="verifications" element={<AdminVerifications />} />
        <Route path="entity-verifications" element={<AdminEntity />} />
        <Route path="finance" element={<AdminFinance />} />
        <Route path="subscriptions" element={<AdminSubscriptions />} />
        <Route path="economy" element={<AdminEconomy />} />
        <Route path="blockchain" element={<AdminBlockchain />} />
        <Route path="boosts" element={<AdminTable title="Boosts" path="/api/admin/boosts" actions={[{ label: "Cancel", call: (r: any) => api(`/api/admin/boosts/${r.id}/cancel`, { method: "POST", body: "{}" }) }]} />} />
        <Route path="broadcast" element={<AdminBroadcast />} />
        <Route path="settings" element={<AdminSettings />} />
        <Route path="features" element={<AdminFeatures />} />
        <Route path="activity" element={<AdminTable title="Activity" path="/api/admin/activity" />} />
        <Route path="content" element={<AdminTable title="Content" path="/api/admin/content" />} />
      </Route>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/posts/:id" element={<PostDetail />} />
        <Route path="/u/:username" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/channels" element={<ChannelsPage />} />
        <Route path="/channels/c/:handle" element={<ChannelView />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/messages/:convId" element={<MessagesPage />} />
        <Route path="/messages/start/:username" element={<StartDm />} />
        <Route path="/wallet" element={<WalletPage />} />
        <Route path="/wallet/swap" element={<SwapPage />} />
        <Route path="/wallet/claim" element={<ClaimDUYS />} />
        <Route path="/earn" element={<EarnPage />} />
        <Route path="/referral" element={<ReferralPage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path="/verification" element={<VerificationPage />} />
        <Route path="/live" element={<LivePage />} />
        <Route path="/live/:id" element={<LiveRoomPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/shop/:username" element={<ShopPage />} />
        <Route path="/stories/:username" element={<StoriesPage />} />
      </Route>
    </Routes>
  );
}
