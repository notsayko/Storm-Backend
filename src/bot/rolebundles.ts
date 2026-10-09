import { readFileSync } from "fs";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import User from "../database/user";
import Profile from "../database/profile";
import log from "../services/logger";
import config from "../services/config";
import type { GuildMember } from "discord.js";

async function giveVbucks(profile: any, amount: number): Promise<void> {
    const core = profile.profiles["common_core"];
    const p0 = profile.profiles["profile0"];

    if (!core.items["Currency:MtxPurchased"]) core.items["Currency:MtxPurchased"] = { templateId: "Currency:MtxPurchased", quantity: 0, attributes: {} };
    if (!p0.items["Currency:MtxPurchased"]) p0.items["Currency:MtxPurchased"] = { templateId: "Currency:MtxPurchased", quantity: 0, attributes: {} };

    core.items["Currency:MtxPurchased"].quantity += amount;
    p0.items["Currency:MtxPurchased"].quantity += amount;

    const giftId = uuidv4();
    core.items[giftId] = {
        templateId: "GiftBox:GB_MakeGood",
        attributes: { fromAccountId: "[RoleBundle]", lootList: [{ itemType: "Currency:MtxGiveaway", itemGuid: "Currency:MtxGiveaway", quantity: amount }], params: { userMessage: `Role reward: ${amount} V-Bucks` }, giftedOn: new Date().toISOString() },
        quantity: 1
    };
    core.rvn += 1; core.commandRevision += 1;

    await Profile.updateOne({ accountId: profile.accountId }, { $set: { "profiles.common_core": core, "profiles.profile0.items.Currency:MtxPurchased.quantity": p0.items["Currency:MtxPurchased"].quantity } });
}

async function giveFullLocker(profile: any): Promise<void> {
    const allItems = JSON.parse(readFileSync(path.join(process.cwd(), "data/profiles/allathena.json"), "utf8"));
    const current = profile.profiles?.athena?.items || {};
    const loadouts: Record<string, any> = {};
    for (const k in current) {
        if (k.includes("loadout") || current[k]?.templateId?.startsWith("CosmeticLocker:")) loadouts[k] = current[k];
    }
    await Profile.updateOne({ accountId: profile.accountId }, { $set: { "profiles.athena.items": { ...allItems.items, ...loadouts } } });
}

async function giveOgPack(profile: any): Promise<void> {
    const allItems = JSON.parse(readFileSync(path.join(process.cwd(), "data/profiles/allathena.json"), "utf8"));
    const ogIds = [
        "AthenaCharacter:CID_039_Athena_Commando_F_Disco", "AthenaCharacter:CID_035_Athena_Commando_M_Medieval",
        "AthenaCharacter:CID_032_Athena_Commando_M_Medieval", "AthenaCharacter:CID_033_Athena_Commando_F_Medieval",
        "AthenaCharacter:CID_028_Athena_Commando_F", "AthenaCharacter:CID_017_Athena_Commando_M",
        "AthenaCharacter:CID_030_Athena_Commando_M_Halloween", "AthenaCharacter:CID_029_Athena_Commando_F_Halloween",
        "AthenaPickaxe:Pickaxe_Lockjaw", "AthenaPickaxe:Pickaxe_ID_013_Teslacoil",
        "AthenaGlider:Glider_Warthog", "AthenaGlider:Umbrella_Snowflake",
        "AthenaDance:EID_Floss", "AthenaDance:EID_TakeTheL", "AthenaDance:EID_BestMates",
        "AthenaDance:EID_Hype", "AthenaDance:EID_GoodVibes", "AthenaDance:EID_RideThePony_Athena"
    ];
    const keys = Object.keys(allItems.items);
    const ogItems: Record<string, any> = {};
    for (const id of ogIds) { const k = keys.find(x => x.toLowerCase() === id.toLowerCase()); if (k) ogItems[k] = allItems.items[k]; }
    await Profile.updateOne({ accountId: profile.accountId }, { $set: { "profiles.athena.items": { ...(profile.profiles?.athena?.items || {}), ...ogItems } } });
}

export async function grantBundleForRole(roleId: string, discordId: string): Promise<{ granted: boolean; bundle: string | null; message: string }> {
    const bundles = config.roleBundles || {};
    const bundle = bundles[roleId];
    if (!bundle) return { granted: false, bundle: null, message: "No bundle configured for this role." };

    const user: any = await User.findOne({ discordId });
    if (!user) return { granted: false, bundle, message: "Discord account not linked." };

    const profile: any = await Profile.findOne({ accountId: user.accountId });
    if (!profile || !profile.profiles) return { granted: false, bundle, message: "Game profile not initialized. Player needs to log in-game first." };

    if (bundle === "full") { await giveFullLocker(profile); log.backend(`Role bundle: Full Locker to ${user.username}`); return { granted: true, bundle, message: `Full Locker granted to ${user.username}.` }; }
    if (bundle === "og") { await giveOgPack(profile); log.backend(`Role bundle: OG Pack to ${user.username}`); return { granted: true, bundle, message: `OG Pack granted to ${user.username}.` }; }
    if (bundle.startsWith("vbucks:")) {
        const amt = parseInt(bundle.split(":")[1], 10);
        if (isNaN(amt) || amt <= 0) return { granted: false, bundle, message: `Invalid V-Bucks amount for role ${roleId}.` };
        await giveVbucks(profile, amt);
        log.backend(`Role bundle: ${amt} V-Bucks to ${user.username}`);
        return { granted: true, bundle, message: `${amt} V-Bucks granted to ${user.username}.` };
    }
    return { granted: false, bundle, message: `Unknown bundle type: ${bundle}` };
}

export async function processRolesForMember(member: GuildMember): Promise<void> {
    const bundles = config.roleBundles || {};
    for (const roleId of Object.keys(bundles)) {
        if (member.roles.cache.has(roleId)) {
            const res = await grantBundleForRole(roleId, member.id);
            if (res.granted) log.backend(`Auto role bundle: ${res.message}`);
        }
    }
}
