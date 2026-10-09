import { Router } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import type { AuthenticatedRequest } from "../types";
import { createError } from "../services/error";
import { getVersionInfo, makeID, decodeBase64, UpdateTokens, registerUser } from "../services/functions";
import { createClientToken, createAccessToken, createRefreshToken, dateAddHours } from "../services/tokens";
import { verifyToken } from "../services/verify";
import User from "../database/user";
import log from "../services/logger";
import config from "../services/config";

const router = Router();

router.get("/epic/id/v2/sdk/accounts", async (req: AuthenticatedRequest, res) => {
    const user = await User.findOne({ accountId: req.query.accountId, banned: false }).lean();
    if (!user) return createError(
        "errors.com.epicgames.account.account_not_found",
        `Sorry, we couldn't find an account for ${req.query.accountId}`,
        [req.query.accountId as string], 18007, undefined, 404, res
    );
    res.json([{
        accountId: user.accountId,
        displayName: user.username,
        preferredLanguage: "en",
        linkedAccounts: [],
        cabinedMode: false,
        empty: false
    }]);
});

router.post("/account/api/oauth/token", async (req: AuthenticatedRequest, res) => {
    const memory = getVersionInfo(req);

    let clientId: string;
    try {
        const parts = decodeBase64(req.headers["authorization"]!.split(" ")[1]).split(":");
        if (!parts[1]) throw new Error("invalid client id");
        clientId = parts[0];
    } catch {
        return createError(
            "errors.com.epicgames.common.oauth.invalid_client",
            "It appears that your Authorization header may be invalid or not present.",
            [], 1011, "invalid_client", 400, res
        );
    }

    switch (req.body.grant_type) {
        case "client_credentials": {
            const ip = req.ip || "unknown";
            const idx = (globalThis as any).clientTokens.findIndex((i: any) => i.ip === ip);
            if (idx !== -1) (globalThis as any).clientTokens.splice(idx, 1);

            const token = createClientToken(clientId, req.body.grant_type, ip, 4);
            UpdateTokens();

            const decoded: any = jwt.decode(token);
            return res.json({
                access_token: `eg1~${token}`,
                expires_in: Math.round((dateAddHours(new Date(decoded.creation_date), decoded.hours_expire).getTime() - Date.now()) / 1000),
                expires_at: dateAddHours(new Date(decoded.creation_date), decoded.hours_expire).toISOString(),
                token_type: "bearer",
                client_id: clientId,
                internal_client: true,
                client_service: "fortnite"
            });
        }

        case "password": {
            if (!req.body.username || !req.body.password) {
                return createError("errors.com.epicgames.common.oauth.invalid_request", "Username/password is required.", [], 1013, "invalid_request", 400, res);
            }

            const { username: email, password } = req.body;
            const rebootRegex = /@projectreboot\.dev$/;
            const isReboot = rebootRegex.test(email);

            if (isReboot && config.bEnableRebootUser) {
                let found = await User.findOne({ email: email.toLowerCase() });
                if (!found) {
                    await registerUser(null, `reboot_${email.split("@")[0]}`, email, password);
                    found = await User.findOne({ email: email.toLowerCase() });
                }
                req.user = found;
            } else {
                req.user = await User.findOne({ email: email.toLowerCase() }).lean();
            }

            if (!req.user) {
                return createError("errors.com.epicgames.account.invalid_account_credentials", "Your e-mail and/or password are incorrect.", [], 18031, "invalid_grant", 400, res);
            }
            if (!isReboot && !(await bcrypt.compare(password, req.user.password))) {
                return createError("errors.com.epicgames.account.invalid_account_credentials", "Your e-mail and/or password are incorrect.", [], 18031, "invalid_grant", 400, res);
            }
            break;
        }

        case "refresh_token": {
            if (!req.body.refresh_token) {
                return createError("errors.com.epicgames.common.oauth.invalid_request", "Refresh token is required.", [], 1013, "invalid_request", 400, res);
            }

            const refreshIdx = (globalThis as any).refreshTokens.findIndex((i: any) => i.token === req.body.refresh_token);
            const obj = (globalThis as any).refreshTokens[refreshIdx];

            try {
                if (refreshIdx === -1) throw new Error("Invalid refresh token.");
                const decoded: any = jwt.decode(req.body.refresh_token.replace("eg1~", ""));
                if (dateAddHours(new Date(decoded.creation_date), decoded.hours_expire).getTime() <= Date.now()) {
                    throw new Error("Expired refresh token.");
                }
            } catch {
                if (refreshIdx !== -1) {
                    (globalThis as any).refreshTokens.splice(refreshIdx, 1);
                    UpdateTokens();
                }
                return createError("errors.com.epicgames.account.auth_token.invalid_refresh_token", `Sorry the refresh token is invalid`, [req.body.refresh_token], 18036, "invalid_grant", 400, res);
            }

            req.user = await User.findOne({ accountId: obj.accountId }).lean();
            break;
        }

        case "exchange_code": {
            if (!req.body.exchange_code) {
                return createError("errors.com.epicgames.common.oauth.invalid_request", "Exchange code is required.", [], 1013, "invalid_request", 400, res);
            }

            const idx = (globalThis as any).exchangeCodes.findIndex((i: any) => i.exchange_code === req.body.exchange_code);
            if (idx === -1) {
                return createError("errors.com.epicgames.account.oauth.exchange_code_not_found", "Sorry the exchange code you supplied was not found.", [], 18057, "invalid_grant", 400, res);
            }

            const exchange = (globalThis as any).exchangeCodes[idx];
            (globalThis as any).exchangeCodes.splice(idx, 1);
            req.user = await User.findOne({ accountId: exchange.accountId }).lean();
            break;
        }

        default:
            return createError("errors.com.epicgames.common.oauth.unsupported_grant_type", `Unsupported grant type: ${req.body.grant_type}`, [], 1016, "unsupported_grant_type", 400, res);
    }

    // Ban check
    if (req.user.banned) {
        if (req.user.bannedUntil && new Date(req.user.bannedUntil) < new Date()) {
            await User.updateOne({ accountId: req.user.accountId }, { $set: { banned: false, bannedUntil: null, banReason: null } });
        } else {
            const msg = req.user.banReason
                ? `You have been banned. Reason: ${req.user.banReason}`
                : "You have been permanently banned from Fortnite.";
            return createError("errors.com.epicgames.account.account_not_active", msg, [], -1, undefined, 400, res);
        }
    }

    if (config.bEnableOnlyOneVersionJoinable && memory.build !== config.bVersionJoinable) {
        return createError("errors.com.epicgames.version_not_supported", "This version is blocked.", [], -1, undefined, 400, res);
    }

    // Evict old session
    const refreshIdx = (globalThis as any).refreshTokens.findIndex((i: any) => i.accountId === req.user.accountId);
    if (refreshIdx !== -1) (globalThis as any).refreshTokens.splice(refreshIdx, 1);

    const accessIdx = (globalThis as any).accessTokens.findIndex((i: any) => i.accountId === req.user.accountId);
    if (accessIdx !== -1) {
        (globalThis as any).accessTokens.splice(accessIdx, 1);
        const xmppClient = (globalThis as any).Clients?.find((i: any) => i.accountId === req.user.accountId);
        if (xmppClient) xmppClient.client.close();
    }

    const deviceId = makeID().replace(/-/g, "");
    const accessToken = createAccessToken(req.user, clientId!, req.body.grant_type, deviceId, 8);
    const refreshToken = createRefreshToken(req.user, clientId!, req.body.grant_type, deviceId, 24);
    UpdateTokens();

    const decodedAccess: any = jwt.decode(accessToken);
    const decodedRefresh: any = jwt.decode(refreshToken);

    res.json({
        access_token: `eg1~${accessToken}`,
        expires_in: Math.round((dateAddHours(new Date(decodedAccess.creation_date), decodedAccess.hours_expire).getTime() - Date.now()) / 1000),
        expires_at: dateAddHours(new Date(decodedAccess.creation_date), decodedAccess.hours_expire).toISOString(),
        token_type: "bearer",
        refresh_token: `eg1~${refreshToken}`,
        refresh_expires: Math.round((dateAddHours(new Date(decodedRefresh.creation_date), decodedRefresh.hours_expire).getTime() - Date.now()) / 1000),
        refresh_expires_at: dateAddHours(new Date(decodedRefresh.creation_date), decodedRefresh.hours_expire).toISOString(),
        account_id: req.user.accountId,
        client_id: clientId,
        internal_client: true,
        client_service: "fortnite",
        displayName: req.user.username,
        app: "fortnite",
        in_app_id: req.user.accountId,
        device_id: deviceId
    });
});

router.get("/account/api/oauth/verify", verifyToken as any, (req: AuthenticatedRequest, res) => {
    const token = req.headers["authorization"]!.replace("bearer ", "");
    const decoded: any = jwt.decode(token.replace("eg1~", ""));
    res.json({
        token,
        session_id: decoded.jti,
        token_type: "bearer",
        client_id: decoded.clid,
        internal_client: true,
        client_service: "fortnite",
        account_id: req.user.accountId,
        expires_in: Math.round((dateAddHours(new Date(decoded.creation_date), decoded.hours_expire).getTime() - Date.now()) / 1000),
        expires_at: dateAddHours(new Date(decoded.creation_date), decoded.hours_expire).toISOString(),
        auth_method: decoded.am,
        display_name: req.user.username,
        app: "fortnite",
        in_app_id: req.user.accountId,
        device_id: decoded.dvid
    });
});

router.delete("/account/api/oauth/sessions/kill", (_req, res) => { res.status(204).end(); });

router.delete("/account/api/oauth/sessions/kill/:token", (req, res) => {
    const token = req.params.token;
    const accessIdx = (globalThis as any).accessTokens.findIndex((i: any) => i.token === token);
    if (accessIdx !== -1) {
        const obj = (globalThis as any).accessTokens[accessIdx];
        (globalThis as any).accessTokens.splice(accessIdx, 1);
        const xmpp = (globalThis as any).Clients?.find((i: any) => i.token === obj.token);
        if (xmpp) xmpp.client.close();
        const rIdx = (globalThis as any).refreshTokens.findIndex((i: any) => i.accountId === obj.accountId);
        if (rIdx !== -1) (globalThis as any).refreshTokens.splice(rIdx, 1);
    }
    const clientIdx = (globalThis as any).clientTokens.findIndex((i: any) => i.token === token);
    if (clientIdx !== -1) (globalThis as any).clientTokens.splice(clientIdx, 1);
    if (accessIdx !== -1 || clientIdx !== -1) UpdateTokens();
    res.status(204).end();
});

router.post("/auth/v1/oauth/token", (_req, res) => {
    res.json({
        access_token: "stormtoken",
        token_type: "bearer",
        expires_at: "9999-12-31T23:59:59.999Z",
        features: ["AntiCheat", "Connect", "Ecom"],
        organization_id: "stormtoken",
        product_id: "prod-fn",
        sandbox_id: "fn",
        deployment_id: "stormdeploymentid",
        expires_in: 3599
    });
});

export default router;
