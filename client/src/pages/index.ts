// Barrel re-export: every page component, split per feature by scripts/split-pages.mjs.
// App.tsx imports user + admin routes from here.

// auth
export { LoginPage } from "./auth/LoginPage";
// feed
export { HomePage } from "./feed/HomePage";
export { ExplorePage } from "./feed/ExplorePage";
export { SearchPage } from "./feed/SearchPage";
// posts
export { PostDetail } from "./posts/PostDetail";
// profile
export { ProfilePage } from "./profile/ProfilePage";
export { SettingsPage } from "./profile/SettingsPage";
// channels
export { ChannelsPage } from "./channels/ChannelsPage";
export { ChannelView } from "./channels/ChannelView";
// messages
export { MessagesPage } from "./messages/MessagesPage";
export { StartDm } from "./messages/StartDm";
// wallet
export { WalletPage } from "./wallet/WalletPage";
export { SwapPage } from "./wallet/SwapPage";
export { ClaimDUYS } from "./wallet/ClaimDUYS";
// earn / referral / leaderboard / verification
export { EarnPage } from "./earn/EarnPage";
export { ReferralPage } from "./referral/ReferralPage";
export { LeaderboardPage } from "./leaderboard/LeaderboardPage";
export { VerificationPage } from "./verification/VerificationPage";
// live
export { LivePage } from "./live/LivePage";
export { LiveRoomPage } from "./live/LiveRoomPage";
// notifications / shop / legal / stories
export { NotificationsPage } from "./notifications/NotificationsPage";
export { ShopPage } from "./shop/ShopPage";
export { LegalPage } from "./legal/LegalPage";
export { StoriesPage } from "./stories/StoriesPage";

// admin
export { AdminShell } from "./admin/AdminShell";
export { AdminOverview } from "./admin/AdminOverview";
export { AdminAnalytics } from "./admin/AdminAnalytics";
export { AdminUsers } from "./admin/AdminUsers";
export { AdminUserDetail } from "./admin/AdminUserDetail";
export { AdminTable } from "./admin/AdminTable";
export { AdminEconomy } from "./admin/AdminEconomy";
export { AdminSettings } from "./admin/AdminSettings";
export { AdminBroadcast } from "./admin/AdminBroadcast";
export { AdminFeatures } from "./admin/AdminFeatures";
export { AdminVerifications } from "./admin/AdminVerifications";
export { AdminEntity } from "./admin/AdminEntity";
export { AdminSubscriptions } from "./admin/AdminSubscriptions";
export { AdminReports } from "./admin/AdminReports";
export { AdminFinance } from "./admin/AdminFinance";
export { AdminBlockchain } from "./admin/AdminBlockchain";