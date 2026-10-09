import { Client, Intents } from "discord.js";
import log from "../services/logger";
import User from "../database/user";
import { UpdateTokens } from "../services/functions";
import { processRolesForMember, grantBundleForRole } from "./rolebundles";
import config from "../services/config";

// Import commands
import * as donateCmd from "./commands/donate";
import * as banCmd from "./commands/ban";
import * as unbanCmd from "./commands/unban";
import * as addCmd from "./commands/add";
import * as registerCmd from "./commands/register";

const commands = [donateCmd, banCmd, unbanCmd, addCmd, registerCmd];
const commandMap = new Map<string, { execute: Function }>();
commands.forEach(cmd => commandMap.set(cmd.commandInfo.name, cmd));

const client = new Client({
    intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MEMBERS,
        Intents.FLAGS.GUILD_BANS,
        Intents.FLAGS.DIRECT_MESSAGES
    ]
});

(globalThis as any).discordClient = client;
(globalThis as any).botConnected = false;

client.once("ready", () => {
    (globalThis as any).botConnected = true;
    log.bot("Bot is up and running!");

    if (config.discord.bEnableInGamePlayerCount) {
        const updateStatus = () => {
            const count = (globalThis as any).Clients?.length || 0;
            client.user?.setActivity(`${count} In Lobby!`, { type: "WATCHING" });
        };
        updateStatus();
        setInterval(updateStatus, 10000);
    }

    const commandData = commands.map(cmd => cmd.commandInfo);
    client.application?.commands.set(commandData).then(() => {
        log.bot("Slash commands synchronized.");
    }).catch(err => {
        log.error(`Failed to sync commands: ${err}`);
    });
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isCommand()) return;
    const cmd = commandMap.get(interaction.commandName);
    if (cmd) {
        await cmd.execute(interaction);
    }
});

// Role bundles: auto-grant on member join and role update
client.on("guildMemberAdd", async (member) => {
    try { await processRolesForMember(member); } catch (err) { log.error("Role bundle error on join:", err); }
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
    try {
        const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
        if (addedRoles.size === 0) return;
        const bundles = config.roleBundles || {};
        for (const [roleId] of addedRoles) {
            if (bundles[roleId]) {
                const result = await grantBundleForRole(roleId, newMember.id);
                if (result.granted) {
                    log.backend(`Role update bundle: ${result.message}`);
                    try {
                        const user = await client.users.fetch(newMember.id);
                        await user.send({ content: `Your role reward has been applied: **${result.message}**` });
                    } catch (_) {}
                }
            }
        }
    } catch (err: any) { log.error("Role bundle error on update:", err?.message || err?.stack || JSON.stringify(err)); }
});

// Cross-bans
client.on("guildBanAdd", async (ban) => {
    if (!config.bEnableCrossBans) return;
    const memberBan = await ban.fetch();
    if (memberBan.user.bot) return;
    const userData: any = await User.findOne({ discordId: memberBan.user.id });
    if (userData && !userData.banned) {
        await userData.updateOne({ $set: { banned: true } });
        const rIdx = (globalThis as any).refreshTokens.findIndex((i: any) => i.accountId === userData.accountId);
        if (rIdx !== -1) (globalThis as any).refreshTokens.splice(rIdx, 1);
        const aIdx = (globalThis as any).accessTokens.findIndex((i: any) => i.accountId === userData.accountId);
        if (aIdx !== -1) {
            (globalThis as any).accessTokens.splice(aIdx, 1);
            const xmpp = (globalThis as any).Clients?.find((c: any) => c.accountId === userData.accountId);
            if (xmpp) xmpp.client.close();
        }
        if (aIdx !== -1 || rIdx !== -1) UpdateTokens();
        log.debug(`Cross-ban: ${memberBan.user.username} banned in-game.`);
    }
});

client.on("guildBanRemove", async (ban) => {
    if (!config.bEnableCrossBans) return;
    if (ban.user.bot) return;
    const userData: any = await User.findOne({ discordId: ban.user.id });
    if (userData && userData.banned) {
        await userData.updateOne({ $set: { banned: false } });
        log.debug(`Cross-ban: ${ban.user.username} unbanned in-game.`);
    }
});

// Start
if (!config.discord.bot_token || config.discord.bot_token.trim() === "") {
    log.error("Discord bot token not set. Add BOT_TOKEN to your .env file.");
    (globalThis as any).botConnected = false;
} else {
    client.login(config.discord.bot_token).catch(err => {
        log.error(`Discord login failed: ${err.message}`);
        (globalThis as any).botConnected = false;
    });
}

export default client;
