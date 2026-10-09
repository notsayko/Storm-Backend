import { MessageEmbed, CommandInteraction } from "discord.js";
import { v4 as uuidv4 } from "uuid";
import User from "../../database/user";
import Profile from "../../database/profile";
import log from "../../services/logger";
import config from "../../services/config";
const DONATE_AMOUNTS = [100, 500, 1000, 2500, 5000, 10000];

export const commandInfo = {
    name: "donate",
    description: "Give V-Bucks to a player (admin only).",
    options: [
        {
            name: "recipient",
            description: "The Discord user to donate V-Bucks to.",
            type: 6,
            required: true
        },
        {
            name: "amount",
            description: "Amount of V-Bucks to give.",
            type: 4,
            required: true,
            choices: DONATE_AMOUNTS.map(a => ({ name: `${a.toLocaleString()} V-Bucks`, value: a }))
        }
    ]
};

export async function execute(interaction: CommandInteraction): Promise<void> {
    try {
        await interaction.deferReply({ ephemeral: true });

        if (!config.moderators.includes(interaction.user.id)) {
            await interaction.editReply({ content: "You do not have permission to use this command." });
            return;
        }

        const recipientUser = interaction.options.getUser("recipient", true);
        const amount = interaction.options.get("amount", true).value as number;

        if (interaction.user.id === recipientUser.id) {
            await interaction.editReply({ content: "You cannot donate V-Bucks to yourself." });
            return;
        }

        if (!DONATE_AMOUNTS.includes(amount)) {
            await interaction.editReply({ content: "Invalid donation amount." });
            return;
        }

        const recipient = await User.findOne({ discordId: recipientUser.id });
        if (!recipient) {
            await interaction.editReply({ content: `${recipientUser.username} does not have a registered game account.` });
            return;
        }

        const recipientProfile: any = await Profile.findOne({ accountId: (recipient as any).accountId });
        if (!recipientProfile || !recipientProfile.profiles) {
            await interaction.editReply({ content: "Could not find the recipient game profile. They need to log in-game at least once." });
            return;
        }

        const core = recipientProfile.profiles["common_core"] || { items: {}, rvn: 1, commandRevision: 1 };
        const profile0 = recipientProfile.profiles["profile0"] || { items: {} };

        if (!core.items) core.items = {};
        if (!profile0.items) profile0.items = {};

        if (!core.items["Currency:MtxPurchased"]) {
            core.items["Currency:MtxPurchased"] = { templateId: "Currency:MtxPurchased", quantity: 0, attributes: {} };
        }
        if (!profile0.items["Currency:MtxPurchased"]) {
            profile0.items["Currency:MtxPurchased"] = { templateId: "Currency:MtxPurchased", quantity: 0, attributes: {} };
        }

        core.items["Currency:MtxPurchased"].quantity += amount;
        profile0.items["Currency:MtxPurchased"].quantity += amount;

        const giftId = uuidv4();
        core.items[giftId] = {
            templateId: "GiftBox:GB_MakeGood",
            attributes: {
                fromAccountId: "[Administrator]",
                lootList: [{ itemType: "Currency:MtxGiveaway", itemGuid: "Currency:MtxGiveaway", quantity: amount }],
                params: { userMessage: `Admin donated ${amount} V-Bucks to you!` },
                giftedOn: new Date().toISOString()
            },
            quantity: 1
        };

        core.rvn = (core.rvn || 0) + 1;
        core.commandRevision = (core.commandRevision || 0) + 1;

        await Profile.updateOne(
            { accountId: (recipient as any).accountId },
            { $set: { "profiles.common_core": core, "profiles.profile0.items.Currency:MtxPurchased.quantity": profile0.items["Currency:MtxPurchased"].quantity } }
        );

        try {
            const dmEmbed = new MessageEmbed()
                .setTitle("V-Bucks Received")
                .setDescription(`An admin donated **${amount.toLocaleString()} V-Bucks** to you.`)
                .setColor("#00d4ff")
                .setThumbnail("https://i.imgur.com/yLbihQa.png")
                .setFooter({ text: "Storm Backend" })
                .setTimestamp();
            await recipientUser.send({ embeds: [dmEmbed] });
        } catch (_) {}

        const embed = new MessageEmbed()
            .setTitle("Donation Successful")
            .setDescription(`Donated **${amount.toLocaleString()} V-Bucks** to **${(recipient as any).username}**.`)
            .setColor("#00d4ff")
            .setThumbnail("https://i.imgur.com/yLbihQa.png")
            .setFooter({ text: "Storm Backend"})
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
        log.error("Donate command error:", err?.message || err?.stack || JSON.stringify(err));
        if (!interaction.replied) {
            await interaction.editReply({ content: "An error occurred while processing the donation." });
        }
    }
}
