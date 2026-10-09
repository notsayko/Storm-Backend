import { MessageEmbed, CommandInteraction } from "discord.js";
import User from "../../database/user";
import config from "../../services/config";

export const commandInfo = {
    name: "unban",
    description: "Unban a user from the backend by their username.",
    options: [
        { name: "username", description: "Target username.", required: true, type: 3 }
    ]
};

export async function execute(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    if (!config.moderators.includes(interaction.user.id)) {
        await interaction.editReply({ content: "You do not have moderator permissions." });
        return;
    }

    const username = interaction.options.get("username", true).value as string;
    const targetUser: any = await User.findOne({ username_lower: username.toLowerCase() });

    if (!targetUser) {
        await interaction.editReply({ content: "The account username you entered does not exist." });
        return;
    }
    if (!targetUser.banned) {
        await interaction.editReply({ content: "This account is already unbanned." });
        return;
    }

    await targetUser.updateOne({ $set: { banned: false, banExpires: null, banReason: null } });

    let dmStatus = "";
    if (targetUser.discordId) {
        try {
            const discordUser = await interaction.client.users.fetch(targetUser.discordId);
            const embed = new MessageEmbed()
                .setTitle("Account Unbanned")
                .setDescription(`Your account **${targetUser.username}** has been unbanned from Storm Backend.`)
                .setColor("#56ff00")
                .addField("Status", "You can now log back into the game.", false)
                .setTimestamp()
                .setFooter({ text: "Storm Backend", iconURL: "https://i.imgur.com/2RImwlb.png" });
            await discordUser.send({ embeds: [embed] });
            dmStatus = " (User notified via DM)";
        } catch {
            dmStatus = " (Could not DM user)";
        }
    }

    await interaction.editReply({ content: `Successfully unbanned **${targetUser.username}**.${dmStatus}` });
}
