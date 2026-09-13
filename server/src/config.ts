import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const bool = (k: string, d = false) => {
  const v = process.env[k];
  if (v == null) return d;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
};
const int = (k: string, d: number) => {
  const n = Number(process.env[k]);
  return Number.isFinite(n) ? n : d;
};
const float = (k: string, d: number) => {
  const n = Number(process.env[k]);
  return Number.isFinite(n) ? n : d;
};

export const config = {
  root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
  secret: process.env.SECRET_KEY || "dev-insecure-secret-change-me",
  nodeEnv: process.env.NODE_ENV || "development",
  debug: (process.env.NODE_ENV || "development") !== "production",
  appName: process.env.APP_NAME || "DUYS",
  appUrl: process.env.APP_URL || "http://localhost:5173",
  apiPort: int("API_PORT", 5000),
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  databaseUrl: process.env.DATABASE_URL || "",
  googleClientId: process.env.GOOGLE_CLIENT_ID || "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
  r2AccountId: process.env.R2_ACCOUNT_ID || "",
  r2AccessKey: process.env.R2_ACCESS_KEY_ID || "",
  r2Secret: process.env.R2_SECRET_ACCESS_KEY || "",
  r2Bucket: process.env.R2_BUCKET || "duys-media",
  r2PublicUrl: process.env.R2_PUBLIC_URL || "",
  r2PrivateBucket: process.env.R2_PRIVATE_BUCKET || "duys-private",
  localUploadDir: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..", "server", "uploads"),
  pointsAdReward: int("POINTS_AD_REWARD", 10),
  pointsReferralBonus: int("POINTS_REFERRAL_BONUS", 100),
  referralEarnPercent: float("REFERRAL_EARN_PERCENT", 0.01),
  vapidPublic: process.env.VAPID_PUBLIC_KEY || "",
  vapidPrivate: process.env.VAPID_PRIVATE_KEY || "",
  vapidSubject: process.env.VAPID_SUBJECT || "mailto:admin@duys.app",
  adminEmail: (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
  adminUsername: (process.env.ADMIN_USERNAME || "admin").replace(/^@/, "").toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD || "",
  bscRpc: process.env.BSC_RPC_URL || "https://bsc-dataseed.binance.org/",
  bscChainId: int("BSC_CHAIN_ID", 56),
  duysContract: process.env.DUYS_CONTRACT_ADDRESS || "",
  vaultAddress: process.env.VAULT_WALLET_ADDRESS || "",
  vaultKey: process.env.VAULT_PRIVATE_KEY || "",
  claimPointsPerToken: int("CLAIM_POINTS_PER_TOKEN", 10),
  claimMinPoints: int("CLAIM_MIN_POINTS", 100),
  claimMaxDaily: int("CLAIM_MAX_DAILY", 1),
  claimMaxDailyVerified: int("CLAIM_MAX_DAILY_VERIFIED", 3),
  usdtContract: process.env.USDT_CONTRACT_ADDRESS || "0x55d398326f99059fF775485246999027B3197955",
  usdtDecimals: int("USDT_DECIMALS", 18),
  swapSpread: float("SWAP_SPREAD_PERCENT", 2),
  swapMinUsdt: float("SWAP_MIN_USDT", 1),
  midRateUrl: process.env.MID_RATE_URL || "",
  midRateApiKey: process.env.MID_RATE_API_KEY || "",
  swapMidRateFallback: float("SWAP_MID_RATE_FALLBACK", 1), // DUYS per USDT when rate source is unreachable
  hypelabSlug: process.env.HYPELAB_PLACEMENT_SLUG || "",
  hypelabSigningSecret: process.env.HYPELAB_SIGNING_SECRET || "",
  walletConnectId: process.env.WALLETCONNECT_PROJECT_ID || "",
  stunUrls: (process.env.STUN_URLS || "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  turnUrl: process.env.TURN_URL || "",
  turnUser: process.env.TURN_USERNAME || "",
  turnCred: process.env.TURN_CREDENTIAL || "",
  faceWorkerUrl: process.env.FACE_WORKER_URL || "",
  postCharLimit: int("POST_CHAR_LIMIT", 500),
  postCharLimitVerified: int("POST_CHAR_LIMIT_VERIFIED", 1000),
  get r2Enabled() {
    return Boolean(this.r2AccountId && this.r2AccessKey && this.r2Secret);
  },
  get blockchainEnabled() {
    return Boolean(this.duysContract && this.vaultAddress && this.vaultKey);
  },
  get pushEnabled() {
    return Boolean(this.vapidPublic && this.vapidPrivate);
  },
  get iceServers() {
    const servers: { urls: string | string[]; username?: string; credential?: string }[] = [
      { urls: this.stunUrls },
    ];
    if (this.turnUrl) {
      servers.push({ urls: this.turnUrl, username: this.turnUser, credential: this.turnCred });
    }
    return servers;
  },
};
