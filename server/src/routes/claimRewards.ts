// POST /api/claim-rewards — canonical watch-to-earn claim endpoint.
//
// All logic lives in services/claims.ts so this route and the legacy
// POST /api/wallet/claim-tokens alias cannot drift apart.
import { Router } from "express";
import { requireAuth } from "../session.js";
import { handleClaim } from "../services/claims.js";

export const claimRouter = Router();

claimRouter.post("/claim-rewards", requireAuth, handleClaim);
