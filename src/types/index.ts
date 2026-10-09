import type { Request, Response, NextFunction } from "express";

export interface StormConfig {
    moderators: string[];
    discord: {
        bUseDiscordBot: boolean;
        bot_token: string;
        bEnableInGamePlayerCount: boolean;
    };
    roleBundles: Record<string, string>;
    mongodb: { database: string };
    chat: { EnableGlobalChat: boolean };
    bEnableDebugLogs: boolean;
    bEnableFormattedLogs: boolean;
    bEnableRebootUser: boolean;
    bEnableCrossBans: boolean;
    port: number;
    Api: {
        bApiKey: string;
        reasons: Record<string, number>;
    };
    matchmakerIP: string;
    gameServerIP: string[];
    bEnableOnlyOneVersionJoinable: boolean;
    bVersionJoinable: number;
    bEnableBackendStatus: boolean;
    bBackendStatusChannelId: string;
    bEnableHTTPS: boolean;
    ssl: { cert: string; key: string; ca?: string };
    bEnableCalderaService: boolean;
    bGameVersion: string;
    bCalderaServicePort: number;
    [key: string]: any;
}

export interface TokenEntry {
    accountId?: string;
    token: string;
    ip?: string;
}

export interface VersionMemory {
    season: number;
    build: number;
    CL: string;
    lobby: string;
}

export interface XmppClient {
    accountId: string;
    token: string;
    jid: string;
    client: { send: (data: string) => void; close: () => void };
    lastPresenceUpdate: { away: boolean; status: string };
}

export interface AuthenticatedRequest extends Request {
    user?: any;
    realIp?: string;
}

export type RouteHandler = (req: AuthenticatedRequest, res: Response, next?: NextFunction) => any;
