import type { StormConfig } from "../types";

function parseRoleBundles(raw: string): Record<string, string> {
    const bundles: Record<string, string> = {};
    if (!raw) return bundles;
    for (const entry of raw.split(",")) {
        const trimmed = entry.trim();
        if (!trimmed) continue;
        const firstColon = trimmed.indexOf(":");
        if (firstColon === -1) continue;
        const roleId = trimmed.substring(0, firstColon);
        const bundle = trimmed.substring(firstColon + 1);
        bundles[roleId] = bundle;
    }
    return bundles;
}

function parseReasons(raw: string): Record<string, number> {
    const reasons: Record<string, number> = {};
    if (!raw) return reasons;
    for (const entry of raw.split(",")) {
        const [key, val] = entry.trim().split(":");
        if (key && val) reasons[key] = parseInt(val, 10);
    }
    return reasons;
}

function parseModerators(raw: string): string[] {
    if (!raw) return [];
    return raw.split(",").map(s => s.trim()).filter(Boolean);
}

function parseGameServers(raw: string): string[] {
    if (!raw) return [];
    return raw.split(",").map(s => s.trim()).filter(Boolean);
}

export function loadConfig(): StormConfig {
    return {
        moderators: parseModerators(process.env.MODERATORS || ""),
        discord: {
            bUseDiscordBot: process.env.ENABLE_DISCORD_BOT === "true",
            bot_token: process.env.BOT_TOKEN || "",
            bEnableInGamePlayerCount: process.env.ENABLE_PLAYER_COUNT === "true"
        },
        roleBundles: parseRoleBundles(process.env.ROLE_BUNDLES || ""),
        mongodb: {
            database: process.env.MONGO_URI || "mongodb://127.0.0.1/Storm"
        },
        chat: { EnableGlobalChat: false },
        bEnableDebugLogs: process.env.ENABLE_DEBUG_LOGS === "true",
        bEnableFormattedLogs: true,
        bEnableRebootUser: process.env.ENABLE_REBOOT_USER === "true",
        bEnableCrossBans: process.env.ENABLE_CROSS_BANS === "true",
        port: parseInt(process.env.PORT || "3551", 10),
        Api: {
            bApiKey: process.env.API_KEY || "",
            reasons: parseReasons(process.env.API_REASONS || "Kill:25,Win:50")
        },
        matchmakerIP: process.env.MATCHMAKER_IP || "127.0.0.1:80",
        gameServerIP: parseGameServers(process.env.GAME_SERVER_IP || ""),
        bEnableOnlyOneVersionJoinable: process.env.ENABLE_VERSION_LOCK === "true",
        bVersionJoinable: parseInt(process.env.VERSION_JOINABLE || "2", 10),
        bEnableBackendStatus: false,
        bBackendStatusChannelId: "",
        bEnableHTTPS: false,
        ssl: { cert: "", key: "" },
        bEnableCalderaService: false,
        bGameVersion: "",
        bCalderaServicePort: 5000
    };
}

const config = loadConfig();
export default config;
