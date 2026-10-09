import { MessageEmbed, CommandInteraction } from "discord.js";
import { readFileSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import User from "../../database/user";
import Profile from "../../database/profile";
import log from "../../services/logger";
import config from "../../services/config";

export const commandInfo = {
    name: "add",
    description: "Give a user cosmetic packs or V-Bucks.",
    options: [
        {
            name: "pack",
            description: "The pack or currency to give",
            required: true,
            type: 3,
            choices: [
                { name: "Full Locker", value: "full" },
                { name: "OG Pack", value: "og" },
                { name: "V-Bucks", value: "vbucks" },
                { name: "Single Item", value: "item" }
            ]
        },
        { name: "user", description: "The user to give the pack to", required: true, type: 6 },
        { name: "amount", description: "V-Bucks amount (if V-Bucks selected)", required: false, type: 4 },
        { name: "itemname", description: "Item name (if Single Item selected)", required: false, type: 3 }
    ]
};

export async function execute(interaction: CommandInteraction): Promise<void> {
    if (!config.moderators.includes(interaction.user.id)) {
        await interaction.reply({ content: "You do not have moderator permissions.", ephemeral: true });
        return;
    }

    await interaction.deferReply({ ephemeral: true });

    const pack = interaction.options.get("pack", true).value as string;
    const selectedUser = interaction.options.getUser("user", true);
    const amount = interaction.options.get("amount")?.value as number | undefined;
    const itemname = interaction.options.get("itemname")?.value as string | undefined;

    try {
        const targetUser: any = await User.findOne({ discordId: selectedUser.id });
        if (!targetUser) { await interaction.editReply({ content: "That user does not own an account." }); return; }

        const profile: any = await Profile.findOne({ accountId: targetUser.accountId });
        if (!profile) { await interaction.editReply({ content: "That user does not have a profile." }); return; }

        if (pack === "item") {
            if (!itemname) { await interaction.editReply({ content: "Please provide an item name." }); return; }

            const response = await (globalThis as any).fetch(`https://fortnite-api.com/v2/cosmetics/br/search?name=${encodeURIComponent(itemname)}`);
            const json: any = await response.json();

            if (json.status !== 200 || !json.data) {
                await interaction.editReply({ content: `Could not find the item "${itemname}".` });
                return;
            }

            const itemData = json.data;
            const allItemsRaw = readFileSync(path.join(process.cwd(), "data/profiles/allathena.json"), "utf8");
            const allItems = JSON.parse(allItemsRaw);
            const allItemKeys = Object.keys(allItems.items);
            const foundKey = allItemKeys.find(k => k.toLowerCase().includes(itemData.id.toLowerCase()));

            if (!foundKey) {
                await interaction.editReply({ content: `Item "${itemData.name}" found on API but not in backend database.` });
                return;
            }

            const cosmetic = allItems.items[foundKey];
            const athena = profile.profiles.athena;
            const common_core = profile.profiles.common_core;

            athena.items[foundKey] = cosmetic;

            const purchaseId = uuidv4();
            common_core.items[purchaseId] = {
                templateId: "GiftBox:GB_MakeGood",
                attributes: {
                    fromAccountId: "[Administrator]",
                    lootList: [{ itemType: cosmetic.templateId, itemGuid: cosmetic.templateId, quantity: 1 }],
                    params: { userMessage: `Gifted ${itemData.name} from Storm Backend!` },
                    giftedOn: new Date().toISOString()
                },
                quantity: 1
            };

            common_core.rvn += 1; common_core.commandRevision += 1;
            athena.rvn += 1; athena.commandRevision += 1;

            await Profile.updateOne({ accountId: targetUser.accountId }, { $set: { "profiles.athena": athena, "profiles.common_core": common_core } });

            const embed = new MessageEmbed()
                .setTitle("Item Granted")
                .setDescription(`Successfully gave **${itemData.name}** to **${selectedUser.username}**.`)
                .setThumbnail(itemData.images.icon)
                .setColor("GREEN")
                .setFooter({ text: "Storm Backend", iconURL: "https://i.imgur.com/2RImwlb.png" })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        if (pack === "vbucks") {
            if (!amount || amount <= 0) { await interaction.editReply({ content: "Please provide a valid V-Bucks amount." }); return; }

            const common_core = profile.profiles["common_core"];
            const profile0 = profile.profiles["profile0"];

            if (!common_core.items["Currency:MtxPurchased"]) common_core.items["Currency:MtxPurchased"] = { templateId: "Currency:MtxPurchased", quantity: 0, attributes: {} };
            if (!profile0.items["Currency:MtxPurchased"]) profile0.items["Currency:MtxPurchased"] = { templateId: "Currency:MtxPurchased", quantity: 0, attributes: {} };

            common_core.items["Currency:MtxPurchased"].quantity += amount;
            profile0.items["Currency:MtxPurchased"].quantity += amount;

            const purchaseId = uuidv4();
            common_core.items[purchaseId] = {
                templateId: "GiftBox:GB_MakeGood",
                attributes: {
                    fromAccountId: "[Administrator]",
                    lootList: [{ itemType: "Currency:MtxGiveaway", itemGuid: "Currency:MtxGiveaway", quantity: amount }],
                    params: { userMessage: "Gifted V-Bucks from Storm Backend!" },
                    giftedOn: new Date().toISOString()
                },
                quantity: 1
            };

            common_core.rvn += 1; common_core.commandRevision += 1;

            await Profile.updateOne({ accountId: targetUser.accountId }, { $set: { "profiles.common_core": common_core, "profiles.profile0.items.Currency:MtxPurchased.quantity": profile0.items["Currency:MtxPurchased"].quantity } });

            const embed = new MessageEmbed()
                .setTitle("V-Bucks Added")
                .setDescription(`Added **${amount.toLocaleString()}** V-Bucks to **${selectedUser.username}**'s account.`)
                .setThumbnail("https://i.imgur.com/yLbihQa.png")
                .setColor("GREEN")
                .setFooter({ text: "Storm Backend", iconURL: "https://i.imgur.com/2RImwlb.png" })
                .setTimestamp();
            await interaction.editReply({ embeds: [embed] });
            return;
        }

        // Full / OG pack logic
        const allItemsRaw = readFileSync(path.join(process.cwd(), "data/profiles/allathena.json"), "utf8");
        const allItems = JSON.parse(allItemsRaw);
        if (!allItems) { await interaction.editReply({ content: "Failed to parse allathena.json" }); return; }

        let itemsToGive: Record<string, any> = {};

        if (pack === "full") {
            itemsToGive = { ...allItems.items };
            const currentItems = profile.profiles.athena.items || {};
            for (const key in currentItems) {
                if (key.includes("loadout") || currentItems[key]?.templateId?.startsWith("CosmeticLocker:")) {
                    itemsToGive[key] = currentItems[key];
                }
            }
        } else if (pack === "og") {
            const ogIds = [
                "AthenaCharacter:CID_039_Athena_Commando_F_Disco",
                "AthenaCharacter:CID_035_Athena_Commando_M_Medieval",
                "AthenaCharacter:CID_032_Athena_Commando_M_Medieval",
                "AthenaCharacter:CID_033_Athena_Commando_F_Medieval",
                "AthenaCharacter:CID_028_Athena_Commando_F",
                "AthenaCharacter:CID_017_Athena_Commando_M",
                "AthenaCharacter:CID_030_Athena_Commando_M_Halloween",
                "AthenaCharacter:CID_029_Athena_Commando_F_Halloween",
                "AthenaPickaxe:Pickaxe_Lockjaw",
                "AthenaPickaxe:Pickaxe_ID_013_Teslacoil",
                "AthenaGlider:Glider_Warthog",
                "AthenaGlider:Umbrella_Snowflake",
                "AthenaDance:EID_Floss",
                "AthenaDance:EID_TakeTheL",
                "AthenaDance:EID_BestMates",
                "AthenaDance:EID_Hype",
                "AthenaDance:EID_GoodVibes",
                "AthenaDance:EID_RideThePony_Athena"
            ];
            const allItemKeys = Object.keys(allItems.items);
            for (const id of ogIds) {
                const key = allItemKeys.find(k => k.toLowerCase() === id.toLowerCase());
                if (key) itemsToGive[key] = allItems.items[key];
            }
            itemsToGive = { ...profile.profiles.athena.items, ...itemsToGive };
        }

        await Profile.updateOne({ accountId: targetUser.accountId }, { $set: { "profiles.athena.items": itemsToGive } });

        const embed = new MessageEmbed()
            .setTitle(`${pack === "full" ? "Full Locker" : "OG Pack"} Added`)
            .setDescription(`Added the **${pack === "full" ? "Full Locker" : "OG Pack"}** to **${selectedUser.username}**'s account.`)
            .setColor("GREEN")
            .setFooter({ text: "Storm Backend", iconURL: "https://i.imgur.com/2RImwlb.png" })
            .setTimestamp();
        await interaction.editReply({ embeds: [embed] });

    } catch (err) {
        log.error("Add command error:", err);
        await interaction.editReply({ content: "An error occurred while processing the request." });
    }
}
