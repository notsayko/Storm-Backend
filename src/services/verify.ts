import jwt from "jsonwebtoken";
import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types";
import User from "../database/user";
import { createError } from "./error";
import { updateTokens, dateAddHours } from "./tokens";

export async function verifyToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const authErr = () => createError(
        "errors.com.epicgames.common.authorization.authorization_failed",
        `Authorization failed for ${req.originalUrl}`,
        [req.originalUrl], 1032, undefined, 401, res
    );

    if (!req.headers["authorization"] || !req.headers["authorization"].startsWith("bearer eg1~")) {
        authErr();
        return;
    }

    const token = req.headers["authorization"].replace("bearer eg1~", "");

    try {
        const decoded: any = jwt.decode(token);
        if (!(globalThis as any).accessTokens.find((i: any) => i.token === `eg1~${token}`)) {
            throw new Error("Invalid token.");
        }

        if (dateAddHours(new Date(decoded.creation_date), decoded.hours_expire).getTime() <= Date.now()) {
            throw new Error("Expired access token.");
        }

        req.user = await User.findOne({ accountId: decoded.sub }).lean();

        if (req.user.banned) {
            createError(
                "errors.com.epicgames.account.account_not_active",
                "You have been permanently banned from Fortnite.",
                [], -1, undefined, 400, res
            );
            return;
        }

        next();
    } catch {
        const accessIndex = (globalThis as any).accessTokens.findIndex((i: any) => i.token === `eg1~${token}`);
        if (accessIndex !== -1) {
            (globalThis as any).accessTokens.splice(accessIndex, 1);
            updateTokens();
        }
        authErr();
    }
}

export async function verifyClient(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    const authErr = () => createError(
        "errors.com.epicgames.common.authorization.authorization_failed",
        `Authorization failed for ${req.originalUrl}`,
        [req.originalUrl], 1032, undefined, 401, res
    );

    if (!req.headers["authorization"] || !req.headers["authorization"].startsWith("bearer eg1~")) {
        authErr();
        return;
    }

    const token = req.headers["authorization"].replace("bearer eg1~", "");

    try {
        const decoded: any = jwt.decode(token);
        const findAccess = (globalThis as any).accessTokens.find((i: any) => i.token === `eg1~${token}`);

        if (!findAccess && !(globalThis as any).clientTokens.find((i: any) => i.token === `eg1~${token}`)) {
            throw new Error("Invalid token.");
        }

        if (dateAddHours(new Date(decoded.creation_date), decoded.hours_expire).getTime() <= Date.now()) {
            throw new Error("Expired token.");
        }

        if (findAccess) {
            req.user = await User.findOne({ accountId: decoded.sub }).lean();
            if (req.user.banned) {
                createError(
                    "errors.com.epicgames.account.account_not_active",
                    "You have been permanently banned from Fortnite.",
                    [], -1, undefined, 400, res
                );
                return;
            }
        }

        next();
    } catch {
        const accessIndex = (globalThis as any).accessTokens.findIndex((i: any) => i.token === `eg1~${token}`);
        if (accessIndex !== -1) (globalThis as any).accessTokens.splice(accessIndex, 1);

        const clientIndex = (globalThis as any).clientTokens.findIndex((i: any) => i.token === `eg1~${token}`);
        if (clientIndex !== -1) (globalThis as any).clientTokens.splice(clientIndex, 1);

        if (accessIndex !== -1 || clientIndex !== -1) updateTokens();
        authErr();
    }
}
