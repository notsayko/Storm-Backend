import { MessageEmbed, CommandInteraction } from "discord.js";
import User from "../../database/user";
import { UpdateTokens } from "../../services/functions";
import log from "../../services/logger";
import config from "../../services/config";

export const commandInfo = {
    name: "ban",
    description: "Ban a user from the backend by their username.",
    options: [
        { name: "username", description: "Target username.", required: true, type: 3 },
        { name: "duration", description: "Duration (e.g., 1h, 2h, 1d, 7d). Leave empty for permanent.", required: false, type: 3 },
        { name: "reason", description: "Reason for the ban.", required: false, type: 3 }
    ]
};

export async function execute(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    if (!config.moderators.includes(interaction.user.id)) {
        await interaction.editReply({ content: "You do not have moderator permissions." });
        return;
    }

    const username = interaction.options.get("username", true).value as string;
    const durationStr = interaction.options.get("duration")?.value as string | undefined;
    const reason = (interaction.options.get("reason")?.value as string) || "No reason provided";

    const targetUser: any = await User.findOne({ username_lower: username.toLowerCase() });
    if (!targetUser) {
        await interaction.editReply({ content: "The account username you entered does not exist." });
        return;
    }

    let banExpires: Date | null = null;
    let durationDisplay = "permanently";

    if (durationStr) {
        const match = durationStr.match(/^(\d+)([hdm])$/);
        if (!match) {
            await interaction.editReply({ content: "Invalid duration format. Use e.g., 1h, 2d, 30m." });
            return;
        }
        const amount = parseInt(match[1]);
        const unit = match[2];
        banExpires = new Date();

        if (unit === "h") { banExpires.setHours(banExpires.getHours() + amount); durationDisplay = `for ${amount} hour(s)`; }
        else if (unit === "d") { banExpires.setDate(banExpires.getDate() + amount); durationDisplay = `for ${amount} day(s)`; }
        else if (unit === "m") { banExpires.setMinutes(banExpires.getMinutes() + amount); durationDisplay = `for ${amount} minute(s)`; }
    }

    if (targetUser.banned && !targetUser.banExpires) {
        await interaction.editReply({ content: "This account is already permanently banned." });
        return;
    }

    await targetUser.updateOne({ $set: { banned: true, banExpires, banReason: reason } });

    const refreshIdx = (globalThis as any).refreshTokens.findIndex((i: any) => i.accountId === targetUser.accountId);
    if (refreshIdx !== -1) (globalThis as any).refreshTokens.splice(refreshIdx, 1);

    const accessIdx = (globalThis as any).accessTokens.findIndex((i: any) => i.accountId === targetUser.accountId);
    if (accessIdx !== -1) {
        (globalThis as any).accessTokens.splice(accessIdx, 1);
        const xmpp = (globalThis as any).Clients?.find((c: any) => c.accountId === targetUser.accountId);
        if (xmpp) xmpp.client.close();
    }

    if (accessIdx !== -1 || refreshIdx !== -1) UpdateTokens();

    let dmStatus = "";
    if (targetUser.discordId) {
        try {
            const discordUser = await interaction.client.users.fetch(targetUser.discordId);
            const banEmbed = new MessageEmbed()
                .setTitle("Account Banned")
                .setDescription(`Your account **${targetUser.username}** has been banned from Storm Backend.`)
                .setColor("#ff0000")
                .addFields(
                    { name: "Reason", value: reason, inline: true },
                    { name: "Duration", value: durationDisplay, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: "Storm Backend", iconURL: "https://i.imgur.com/2RImwlb.png" });

            if (banExpires) banEmbed.addField("Expires on", banExpires.toUTCString());
            await discordUser.send({ embeds: [banEmbed] });
            dmStatus = " (User notified via DM)";
        } catch {
            dmStatus = " (Could not DM user)";
        }
    }

    await interaction.editReply({ content: `Successfully banned **${targetUser.username}** ${durationDisplay}.${dmStatus}` });
}
