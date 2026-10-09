import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { readFileSync, writeFileSync, existsSync } from "fs";
import type { TokenEntry } from "../types";

const TOKENS_PATH = "./data/tokens.json";

function loadTokens(): { accessTokens: TokenEntry[]; refreshTokens: TokenEntry[]; clientTokens: TokenEntry[] } {
    if (!existsSync(TOKENS_PATH)) {
        return { accessTokens: [], refreshTokens: [], clientTokens: [] };
    }
    return JSON.parse(readFileSync(TOKENS_PATH, "utf-8"));
}

const tokens = loadTokens();
for (const tokenType of Object.keys(tokens) as Array<keyof typeof tokens>) {
    tokens[tokenType] = tokens[tokenType].filter((entry) => {
        try {
            const decoded: any = jwt.decode(entry.token.replace("eg1~", ""));
            if (!decoded) return false;
            const expiry = new Date(decoded.creation_date);
            expiry.setHours(expiry.getHours() + decoded.hours_expire);
            return expiry.getTime() > Date.now();
        } catch {
            return false;
        }
    });
}

(globalThis as any).accessTokens = tokens.accessTokens;
(globalThis as any).refreshTokens = tokens.refreshTokens;
(globalThis as any).clientTokens = tokens.clientTokens;
(globalThis as any).exchangeCodes = [];
(globalThis as any).JWT_SECRET = uuidv4();

export function updateTokens(): void {
    writeFileSync(TOKENS_PATH, JSON.stringify({
        accessTokens: (globalThis as any).accessTokens,
        refreshTokens: (globalThis as any).refreshTokens,
        clientTokens: (globalThis as any).clientTokens
    }, null, 2));
}

export function createClientToken(clientId: string, grantType: string, ip: string, expiresIn: number): string {
    const token = jwt.sign({
        p: Buffer.from(uuidv4()).toString("base64"),
        clsvc: "fortnite",
        t: "s",
        mver: false,
        clid: clientId,
        ic: true,
        am: grantType,
        jti: uuidv4().replace(/-/g, ""),
        creation_date: new Date(),
        hours_expire: expiresIn
    }, (globalThis as any).JWT_SECRET, { expiresIn: `${expiresIn}h` });

    (globalThis as any).clientTokens.push({ ip, token: `eg1~${token}` });
    return token;
}

export function createAccessToken(user: any, clientId: string, grantType: string, deviceId: string, expiresIn: number): string {
    const token = jwt.sign({
        app: "fortnite",
        sub: user.accountId,
        dvid: deviceId,
        mver: false,
        clid: clientId,
        dn: user.username,
        am: grantType,
        p: Buffer.from(uuidv4()).toString("base64"),
        iai: user.accountId,
        sec: 1,
        clsvc: "fortnite",
        t: "s",
        ic: true,
        jti: uuidv4().replace(/-/g, ""),
        creation_date: new Date(),
        hours_expire: expiresIn
    }, (globalThis as any).JWT_SECRET, { expiresIn: `${expiresIn}h` });

    (globalThis as any).accessTokens.push({ accountId: user.accountId, token: `eg1~${token}` });
    return token;
}

export function createRefreshToken(user: any, clientId: string, grantType: string, deviceId: string, expiresIn: number): string {
    const token = jwt.sign({
        sub: user.accountId,
        dvid: deviceId,
        t: "r",
        clid: clientId,
        am: grantType,
        jti: uuidv4().replace(/-/g, ""),
        creation_date: new Date(),
        hours_expire: expiresIn
    }, (globalThis as any).JWT_SECRET, { expiresIn: `${expiresIn}h` });

    (globalThis as any).refreshTokens.push({ accountId: user.accountId, token: `eg1~${token}` });
    return token;
}

export function dateAddHours(date: Date, hours: number): Date {
    const d = new Date(date);
    d.setHours(d.getHours() + hours);
    return d;
}
