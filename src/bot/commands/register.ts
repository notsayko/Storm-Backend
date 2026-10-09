import { CommandInteraction, MessageEmbed, TextChannel, PermissionString } from "discord.js";
import crypto from "crypto";
import User from "../../database/user";
import { registerUser } from "../../services/functions";
import log from "../../services/logger";

function generatePassword(): string {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const special = "!@#$%^&*";
    const all = upper + lower + digits + special;

    const pick = (s: string) => s[crypto.randomInt(s.length)];
    const base = pick(upper) + pick(lower) + pick(digits) + pick(special);
    const rest = Array.from({ length: 10 }, () => pick(all)).join("");

    return (base + rest)
        .split("")
        .sort(() => crypto.randomInt(3) - 1)
        .join("");
}

export const commandInfo = {
    name: "register",
    description: "Create your game account using your Discord username.",
};

export async function execute(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    const username = interaction.user.username;
    const discordId = interaction.user.id;
    const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, "")}@storm.dev`;
    const password = generatePassword();

    if (username.length < 3) {
        await interaction.editReply({ content: "Your Discord username is too short (minimum 3 characters)." });
        return;
    }

    if (username.length > 20) {
        await interaction.editReply({ content: "Your Discord username is too long (maximum 20 characters)." });
        return;
    }

    const existingDiscord = await User.findOne({ discordId });
    if (existingDiscord) {
        await interaction.editReply({ content: "You already have an account linked to your Discord." });
        return;
    }

    const existingUsername = await User.findOne({ username_lower: username.toLowerCase() });
    if (existingUsername) {
        await interaction.editReply({ content: "Your Discord username is already taken by another account. Contact an admin." });
        return;
    }

    const result = await registerUser(discordId, username, email, password);

    if (result.status >= 400) {
        await interaction.editReply({ content: `Registration failed: ${result.message}` });
        return;
    }

    const embed = new MessageEmbed()
        .setTitle("Account Created")
        .setColor("#5865F2")
        .setDescription("Here are your login credentials. **Keep them safe and do not share them.**")
        .addFields(
            { name: "Username", value: `\`${username}\``, inline: true },
            { name: "Email", value: `\`${email}\``, inline: true },
            { name: "Password", value: `||\`${password}\`||`, inline: true }
        )
        .setFooter({ text: "Project Storm" })
        .setTimestamp();

    let dmSent = false;
    try {
        await interaction.user.send({ embeds: [embed] });
        dmSent = true;
    } catch {
    }

    if (dmSent) {
        await interaction.editReply({ content: "Account created! Check your DMs for your credentials." });
        log.bot(`New account registered: ${username} (${interaction.user.tag})`);
        return;
    }

    const guild = interaction.guild;
    if (!guild) {
        await interaction.editReply({ content: "Account created but I couldn't send your credentials (DMs closed and no server context)." });
        return;
    }

    try {
        const ownerIds = process.env.OWNER_IDS
            ? process.env.OWNER_IDS.split(",").map((s) => s.trim()).filter(Boolean)
            : [];

        const permissionOverwrites: any[] = [
            { id: guild.roles.everyone.id, deny: ["VIEW_CHANNEL" as PermissionString] },
            { id: interaction.user.id, allow: ["VIEW_CHANNEL" as PermissionString, "READ_MESSAGE_HISTORY" as PermissionString] },
        ];

        for (const ownerId of ownerIds) {
            permissionOverwrites.push({
                id: ownerId,
                allow: ["VIEW_CHANNEL" as PermissionString, "READ_MESSAGE_HISTORY" as PermissionString],
            });
        }

        const channel = (await guild.channels.create(`credentials-${username}`, {
            type: "GUILD_TEXT",
            topic: `Private credentials for ${interaction.user.tag}`,
            permissionOverwrites,
        })) as TextChannel;

        await channel.send({
            content: `<@${interaction.user.id}> — your DMs are closed so your credentials are here. **Save them and ask an admin to delete this channel.**`,
            embeds: [embed],
        });

        await interaction.editReply({ content: `Account created! I couldn't DM you, so I created a private channel: <#${channel.id}>` });
        log.bot(`New account registered: ${username} (${interaction.user.tag}) — credentials sent to private channel`);
    } catch (err) {
        log.error("Failed to create credentials channel:", err);
        await interaction.editReply({ content: "Account created but I couldn't deliver your credentials. Contact an admin." });
    }
}
