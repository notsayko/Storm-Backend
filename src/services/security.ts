import rateLimit from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types";

export const authLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "errors.com.epicgames.common.throttled",
        message: "Too many login attempts. Please wait 10 minutes before trying again.",
        numericErrorCode: 1041
    }
});

export const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "errors.com.epicgames.common.throttled",
        message: "Too many API requests. Please slow down.",
        numericErrorCode: 1041
    }
});

export const strictLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "errors.com.epicgames.common.throttled",
        message: "Too many requests to this endpoint. Please wait.",
        numericErrorCode: 1041
    }
});

export const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        error: "errors.com.epicgames.common.throttled",
        message: "Too many requests. Please slow down.",
        numericErrorCode: 1041
    }
});

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    res.removeHeader("X-Powered-By");
    next();
}

export function requestSizeGuard(req: Request, res: Response, next: NextFunction): void {
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    if (contentLength > 2 * 1024 * 1024) {
        res.status(413).json({
            error: "errors.com.epicgames.common.bad_request",
            message: "Request body too large.",
            numericErrorCode: 1001
        });
        return;
    }
    next();
}

export function ipNormalise(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
    req.realIp =
        (req.headers["cf-connecting-ip"] as string) ||
        (req.headers["x-real-ip"] as string) ||
        ((req.headers["x-forwarded-for"] as string) || "").split(",")[0].trim() ||
        req.ip;
    next();
}
