import { Router } from "express";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync } from "fs";
import path from "path";
import { verifyToken, verifyClient } from "../services/verify";
import { createError } from "../services/error";
import { getVersionInfo, makeID } from "../services/functions";
import log from "../services/logger";
import config from "../services/config";
import User from "../database/user";
import Profile from "../database/profile";
import Friends from "../database/friends";
import Arena from "../database/arena";
import type { AuthenticatedRequest } from "../types";
import crypto from "crypto";

const router = Router();


const CLIENT_SETTINGS_DIR = path.join(process.cwd(), "ClientSettings");
if (!existsSync(CLIENT_SETTINGS_DIR)) mkdirSync(CLIENT_SETTINGS_DIR, { recursive: true });



router.get("/fortnite/api/v2/versioncheck/*", (req, res) => {
    res.json({ type: "NO_UPDATE" });
});



router.get("/waitingroom/api/waitingroom", (req, res) => {
    res.status(204).end();
});


router.get("/fortnite/api/cloudstorage/system", (req, res) => {
    const dir = path.join(process.cwd(), "data", "CloudStorage");
    const cloudFiles: any[] = [];

    if (existsSync(dir)) {
        readdirSync(dir).forEach(name => {
            if (name.toLowerCase().endsWith(".ini")) {
                const content = readFileSync(path.join(dir, name));
                const stats = statSync(path.join(dir, name));
                cloudFiles.push({
                    uniqueFilename: name,
                    filename: name,
                    hash: crypto.createHash("sha1").update(content as any).digest("hex"),
                    hash256: crypto.createHash("sha256").update(content as any).digest("hex"),
                    length: content.length,
                    contentType: "application/octet-stream",
                    uploaded: stats.mtime,
                    storageType: "S3",
                    storageIds: {},
                    doNotCache: true
                });
            }
        });
    }

    res.json(cloudFiles);
});

router.get("/fortnite/api/cloudstorage/system/config", (req, res) => {
    res.json([]);
});

router.get("/fortnite/api/cloudstorage/system/:file", (req, res) => {
    if (req.params.file.includes("..") || req.params.file.includes("~")) return res.status(404).end();
    const file = path.join(process.cwd(), "data", "CloudStorage", path.basename(req.params.file));
    if (existsSync(file)) return res.status(200).type("application/octet-stream").send(readFileSync(file));
    res.status(200).end();
});


router.get("/fortnite/api/cloudstorage/user/:accountId", verifyToken as any, (req: AuthenticatedRequest, res) => {
    const accountId = req.user.accountId;
    const userDir = path.join(CLIENT_SETTINGS_DIR, accountId);

    if (!existsSync(userDir)) {
        return res.json([]);
    }

    const files = readdirSync(userDir);
    const result = files.map(filename => {
        const filePath = path.join(userDir, filename);
        const stats = statSync(filePath);
        const content = readFileSync(filePath);
        const hash = crypto.createHash("sha1").update(content as any).digest("hex");
        const sha256 = crypto.createHash("sha256").update(content as any).digest("hex");

        return {
            uniqueFilename: filename,
            filename,
            hash,
            hash256: sha256,
            length: stats.size,
            contentType: "application/octet-stream",
            uploaded: stats.mtime.toISOString(),
            storageType: "S3",
            storageIds: {},
            accountId
        };
    });

    res.json(result);
});

router.get("/fortnite/api/cloudstorage/user/:accountId/:file", verifyToken as any, (req: AuthenticatedRequest, res) => {
    const accountId = req.user.accountId;
    const filename = req.params.file;
    const filePath = path.join(CLIENT_SETTINGS_DIR, accountId, filename);

    if (!existsSync(filePath)) {
        return res.status(200).type("application/octet-stream").send(Buffer.alloc(0));
    }

    const content = readFileSync(filePath);
    res.status(200).type("application/octet-stream").send(content);
});

router.put("/fortnite/api/cloudstorage/user/:accountId/:file", verifyToken as any, (req: AuthenticatedRequest, res) => {
    const accountId = req.user.accountId;
    const filename = req.params.file;
    const userDir = path.join(CLIENT_SETTINGS_DIR, accountId);

    if (!existsSync(userDir)) mkdirSync(userDir, { recursive: true });
    if (filename.toLowerCase() !== "clientsettings.sav") return res.status(204).end();

    const filePath = path.join(userDir, "ClientSettings.Sav");

    const chunks: any[] = [];
    req.on("data", (chunk: any) => chunks.push(chunk));
    req.on("end", () => {
        const body = Buffer.concat(chunks);
        if (body.length === 0) return res.status(204).end();
        if (body.length >= 400000) return res.status(403).json({ error: "File size must be less than 400kb." });
        writeFileSync(filePath, body as any);
        res.status(204).end();
    });
});



router.get("/lightswitch/api/service/bulk/status", (req, res) => {
    res.json([{
        serviceInstanceId: "fortnite",
        status: "UP",
        message: "Fortnite is online",
        maintenanceUri: null,
        overrideCatalogIds: ["a7f138b2e51945ffbfdacc1af0541053"],
        allowedActions: ["PLAY", "DOWNLOAD"],
        banned: false,
        launcherInfoDTO: { appName: "Fortnite", catalogItemId: "4fe75bbc5a674f4f9b356b5c90567da5", namespace: "fn" }
    }]);
});

router.get("/lightswitch/api/service/Fortnite/status", (req, res) => {
    res.json({
        serviceInstanceId: "fortnite",
        status: "UP",
        message: "Fortnite is online",
        maintenanceUri: null,
        overrideCatalogIds: ["a7f138b2e51945ffbfdacc1af0541053"],
        allowedActions: ["PLAY", "DOWNLOAD"],
        banned: false,
        launcherInfoDTO: { appName: "Fortnite", catalogItemId: "4fe75bbc5a674f4f9b356b5c90567da5", namespace: "fn" }
    });
});


router.get("/account/api/public/account/:accountId", verifyToken as any, (req: AuthenticatedRequest, res) => {
    if (!req.user) return res.status(401).json({ error: "Unauthorized" });
    res.json({
        id: req.user.accountId,
        displayName: req.user.username,
        name: req.user.username,
        email: `[hidden]@storm.dev`,
        failedLoginAttempts: 0,
        lastLogin: new Date().toISOString(),
        numberOfDisplayNameChanges: 0,
        ageGroup: "UNKNOWN",
        headless: false,
        country: "US",
        lastName: "Storm",
        preferredLanguage: "en",
        canUpdateDisplayName: false,
        tfaEnabled: false,
        emailVerified: true,
        minorVerified: false,
        minorExpected: false,
        minorStatus: "NOT_MINOR",
        cabinedMode: false,
        hasHashedEmail: false
    });
});

router.get("/account/api/public/account", verifyToken as any, (req: AuthenticatedRequest, res) => {
    const accountIds = (req.query.accountId as string[] | string) || [];
    const ids = Array.isArray(accountIds) ? accountIds : [accountIds];

    const response = ids.map(id => ({
        id,
        displayName: "",
        externalAuths: {}
    }));

    Promise.all(ids.map(id => User.findOne({ accountId: id }).lean())).then(users => {
        res.json(users.map((u: any, i) => ({
            id: ids[i],
            displayName: u?.username || "",
            externalAuths: {}
        })));
    }).catch(() => res.json(response));
});


router.get("/friends/api/v1/:accountId/summary", verifyToken as any, (req: AuthenticatedRequest, res) => {
    res.json({ friends: [], incoming: [], outgoing: [], suggested: [], blocklist: [], settings: { acceptInvites: "public" } });
});

router.get("/friends/api/public/friends/:accountId", verifyToken as any, (req, res) => {
    res.json([]);
});

router.get("/friends/api/v1/:accountId/blocklist", verifyToken as any, (req, res) => {
    res.json([]);
});

router.get("/friends/api/public/blocklist/:accountId", verifyToken as any, (req, res) => {
    res.json([]);
});

router.get("/friends/api/public/list/fortnite/:accountId/recentPlayers", verifyToken as any, (req, res) => {
    res.json([]);
});


router.get("/content/api/pages/fortnite-game", (req, res) => {
    const contentPagesPath = path.join(process.cwd(), "data", "contentpages.json");
    if (existsSync(contentPagesPath)) {
        try {
            const contentpages = JSON.parse(readFileSync(contentPagesPath, "utf-8"));
            return res.json(contentpages);
        } catch (e) {
            log.error("contentpages.json parse error:", e);
        }
    }

    const memory = getVersionInfo(req);
    res.json({
        _title: "Fortnite Game",
        _activeDate: "2023-01-01T00:00:00.000Z",
        lastModified: new Date().toISOString(),
        _locale: "en-US",
        battleroyalenews: { news: { motds: [], messages: [] } },
        savetheworldnews: { news: { motds: [], messages: [] } },
        tournamentinformation: { tournament_info: { tournaments: [] } },
        subgameselectdata: {},
        dynamicbackgrounds: { backgrounds: { backgrounds: [{ stage: `season${memory.season}`, backgroundimage: "" }] } },
        shopSections: {},
        specialoffervideo: { bSpecialOfferEnabled: "false" }
    });
});


router.get("/fortnite/api/storefront/v2/catalog", (req, res) => {
    log.debug("Catalog endpoint hit");
    const catalogPath = path.join(process.cwd(), "data", "catalog.json");
    const shopPath = path.join(process.cwd(), "data", "shop.json");

    let catalog: any = { refreshIntervalHrs: 24, dailyPurchaseHrs: 24, expiration: "9999-12-31T23:59:59.999Z", storefronts: [{ name: "BRDailyStorefront", catalogEntries: [] }, { name: "BRWeeklyStorefront", catalogEntries: [] }] };
    if (existsSync(catalogPath)) {
        try { catalog = JSON.parse(readFileSync(catalogPath, "utf-8")); } catch {}
    }

    let dailyIdx = catalog.storefronts.findIndex((p: any) => p.name === "BRDailyStorefront");
    let featuredIdx = catalog.storefronts.findIndex((p: any) => p.name === "BRWeeklyStorefront");
    if (dailyIdx === -1) { catalog.storefronts.unshift({ name: "BRDailyStorefront", catalogEntries: [] }); dailyIdx = 0; featuredIdx = catalog.storefronts.findIndex((p: any) => p.name === "BRWeeklyStorefront"); }
    if (featuredIdx === -1) { catalog.storefronts.push({ name: "BRWeeklyStorefront", catalogEntries: [] }); featuredIdx = catalog.storefronts.length - 1; }

    if (existsSync(shopPath)) {
        try {
            const shopConfig = JSON.parse(readFileSync(shopPath, "utf-8"));

            const todayAtMidnight = new Date();
            todayAtMidnight.setHours(24, 0, 0, 0);
            const isoDate = new Date(todayAtMidnight.getTime() - 60000).toISOString();

            for (const value in shopConfig) {
                if (!Array.isArray(shopConfig[value].itemGrants)) continue;
                if (shopConfig[value].itemGrants.length === 0) continue;

                const isDaily = value.toLowerCase().startsWith("daily");

                const CatalogEntry: any = {
                    devName: "",
                    offerId: "",
                    fulfillmentIds: [],
                    dailyLimit: -1,
                    weeklyLimit: -1,
                    monthlyLimit: -1,
                    categories: [],
                    prices: [{
                        currencyType: "MtxCurrency",
                        currencySubType: "",
                        regularPrice: shopConfig[value].price,
                        finalPrice: shopConfig[value].price,
                        saleExpiration: isoDate,
                        basePrice: shopConfig[value].price
                    }],
                    meta: { SectionId: isDaily ? "Daily" : "Featured", TileSize: isDaily ? "Small" : "Normal" },
                    matchFilter: "",
                    filterWeight: 0,
                    appStoreId: [],
                    requirements: [],
                    offerType: "StaticPrice",
                    giftInfo: { bIsEnabled: true, forcedGiftBoxTemplateId: "", purchaseRequirements: [], giftRecordIds: [] },
                    refundable: true,
                    metaInfo: [
                        { key: "SectionId", value: isDaily ? "Daily" : "Featured" },
                        { key: "TileSize", value: isDaily ? "Small" : "Normal" }
                    ],
                    displayAssetPath: "",
                    itemGrants: [],
                    sortPriority: isDaily ? -1 : 0,
                    catalogGroupPriority: 0
                };

                for (const itemGrant of shopConfig[value].itemGrants) {
                    if (typeof itemGrant !== "string" || itemGrant.length === 0) continue;
                    CatalogEntry.itemGrants.push({ templateId: itemGrant, quantity: 1 });
                }

                if (CatalogEntry.itemGrants.length > 0) {
                    const uniqueIdentifier = crypto.createHash("sha1").update(`${JSON.stringify(shopConfig[value].itemGrants)}_${shopConfig[value].price}`).digest("hex");
                    CatalogEntry.devName = uniqueIdentifier;
                    CatalogEntry.offerId = uniqueIdentifier;

                    const i = isDaily ? dailyIdx : featuredIdx;
                    catalog.storefronts[i].catalogEntries.push(CatalogEntry);
                }
            }
        } catch (err) {
            log.error("Failed to parse shop.json:", err);
        }
    }

    log.debug(`Catalog: ${catalog.storefronts[dailyIdx].catalogEntries.length} daily, ${catalog.storefronts[featuredIdx].catalogEntries.length} featured items`);
    res.json(catalog);
});

router.get("/fortnite/api/storefront/v2/keychain", (req, res) => {
    const keychainPath = path.join(process.cwd(), "data", "keychain.json");
    if (existsSync(keychainPath)) {
        try { return res.json(JSON.parse(readFileSync(keychainPath, "utf-8"))); } catch {}
    }
    res.json([]);
});

router.get("/catalog/api/shared/bulk/offers", (req, res) => {
    res.json({});
});


router.post("/fortnite/api/game/v2/profile/:accountId/dedicated_server/:command", async (req: AuthenticatedRequest, res) => {
    try {
        const profileId = (req.query.profileId as string) || "athena";
        const accountId = req.params.accountId;
        const userProfile: any = await Profile.findOne({ accountId });

        const profile = userProfile?.profiles?.[profileId] || { items: {}, stats: { attributes: {} }, rvn: 1, commandRevision: 1 };
        const rvn = profile.rvn || 1;

        res.json({
            profileRevision: rvn,
            profileId,
            profileChangesBaseRevision: rvn,
            profileChanges: [{
                changeType: "fullProfileUpdate",
                profile: {
                    _id: accountId,
                    created: userProfile?.created || new Date().toISOString(),
                    updated: new Date().toISOString(),
                    rvn,
                    wipeNumber: 1,
                    accountId,
                    profileId,
                    version: "storm_backend",
                    items: profile.items || {},
                    stats: { attributes: profile.stats?.attributes || {} },
                    commandRevision: profile.commandRevision || 1
                }
            }],
            profileCommandRevision: profile.commandRevision || 1,
            serverTime: new Date().toISOString(),
            responseVersion: 1
        });
    } catch (err) {
        log.error("Dedicated server profile query error:", err);
        res.json({
            profileRevision: 1,
            profileId: req.query.profileId || "athena",
            profileChangesBaseRevision: 1,
            profileChanges: [],
            profileCommandRevision: 1,
            serverTime: new Date().toISOString(),
            responseVersion: 1
        });
    }
});

router.post("/fortnite/api/game/v2/profile/:accountId/client/:command", verifyToken as any, async (req: AuthenticatedRequest, res) => {
    try {
        const profileId = (req.query.profileId as string) || "athena";
        const command = req.params.command;
        const userProfile: any = await Profile.findOne({ accountId: req.user.accountId });

        if (command === "EquipBattleRoyaleCustomization" || command === "SetCosmeticLockerSlot") {
            const profiles = userProfile?.profiles;
            if (!profiles?.athena) {
                return res.json({ profileRevision: 1, profileId, profileChangesBaseRevision: 1, profileChanges: [], profileCommandRevision: 1, serverTime: new Date().toISOString(), responseVersion: 1 });
            }

            const athena = profiles.athena;
            if (!athena.stats) athena.stats = { attributes: {} };
            if (!athena.stats.attributes) athena.stats.attributes = {};

            const ApplyProfileChanges: any[] = [];

            if (command === "EquipBattleRoyaleCustomization") {
                const slotName = req.body?.slotName;
                const itemToSlot = req.body?.itemToSlot || "";
                const indexWithinSlot = req.body?.indexWithinSlot || 0;

                if (slotName) {
                    const key = `favorite_${slotName.toLowerCase()}`;
                    if (Array.isArray(athena.stats.attributes[key])) {
                        athena.stats.attributes[key][indexWithinSlot] = itemToSlot;
                    } else {
                        athena.stats.attributes[key] = itemToSlot;
                    }
                    ApplyProfileChanges.push({ changeType: "statModified", name: key, value: athena.stats.attributes[key] });
                }
            }

            if (command === "SetCosmeticLockerSlot") {
                const lockerItem = req.body?.lockerItem;
                const category = req.body?.category;
                const itemToSlot = req.body?.itemToSlot || "";
                const slotIndex = req.body?.slotIndex || 0;

                if (lockerItem && athena.items[lockerItem] && category) {
                    const locker = athena.items[lockerItem];
                    if (locker.attributes?.locker_slots_data?.slots?.[category]) {
                        if (!locker.attributes.locker_slots_data.slots[category].items) {
                            locker.attributes.locker_slots_data.slots[category].items = [];
                        }
                        locker.attributes.locker_slots_data.slots[category].items[slotIndex] = itemToSlot;
                        ApplyProfileChanges.push({ changeType: "itemAttrChanged", itemId: lockerItem, attributeName: "locker_slots_data", attributeValue: locker.attributes.locker_slots_data });
                    }
                }
            }

            athena.rvn = (athena.rvn || 0) + 1;
            athena.commandRevision = (athena.commandRevision || 0) + 1;
            await Profile.updateOne({ accountId: req.user.accountId }, { $set: { "profiles.athena": athena } });

            return res.json({
                profileRevision: athena.rvn,
                profileId: "athena",
                profileChangesBaseRevision: athena.rvn - 1,
                profileChanges: ApplyProfileChanges,
                profileCommandRevision: athena.commandRevision,
                serverTime: new Date().toISOString(),
                responseVersion: 1
            });
        }

        if (command === "MarkItemSeen") {
            const profiles = userProfile?.profiles;
            const profile = profiles?.[profileId];
            if (!profile) {
                return res.json({ profileRevision: 1, profileId, profileChangesBaseRevision: 1, profileChanges: [], profileCommandRevision: 1, serverTime: new Date().toISOString(), responseVersion: 1 });
            }

            const ApplyProfileChanges: any[] = [];
            const itemIds = req.body?.itemIds || [];
            for (const itemId of itemIds) {
                if (profile.items[itemId]) {
                    profile.items[itemId].attributes.item_seen = true;
                    ApplyProfileChanges.push({ changeType: "itemAttrChanged", itemId, attributeName: "item_seen", attributeValue: true });
                }
            }

            profile.rvn = (profile.rvn || 0) + 1;
            profile.commandRevision = (profile.commandRevision || 0) + 1;
            await Profile.updateOne({ accountId: req.user.accountId }, { $set: { [`profiles.${profileId}`]: profile } });

            return res.json({
                profileRevision: profile.rvn,
                profileId,
                profileChangesBaseRevision: profile.rvn - 1,
                profileChanges: ApplyProfileChanges,
                profileCommandRevision: profile.commandRevision,
                serverTime: new Date().toISOString(),
                responseVersion: 1
            });
        }

        if (command === "PurchaseCatalogEntry") {
            const profiles = userProfile?.profiles;
            if (!profiles || !profiles.common_core || !profiles.athena) {
                return res.json({ profileRevision: 1, profileId, profileChangesBaseRevision: 1, profileChanges: [], profileCommandRevision: 1, serverTime: new Date().toISOString(), responseVersion: 1 });
            }

            const offerId = req.body?.offerId;
            const common_core = profiles.common_core;
            const athena = profiles.athena;
            const profile0 = profiles.profile0 || { items: {} };
            const shopPath2 = path.join(process.cwd(), "data", "shop.json");
            let offerItems: string[] = [];
            let offerPrice = 0;

            if (existsSync(shopPath2)) {
                const shopConfig = JSON.parse(readFileSync(shopPath2, "utf-8"));
                for (const key in shopConfig) {
                    if (!shopConfig[key].itemGrants) continue;
                    const hash = crypto.createHash("sha1").update(`${JSON.stringify(shopConfig[key].itemGrants)}_${shopConfig[key].price}`).digest("hex");
                    if (hash === offerId) {
                        offerItems = shopConfig[key].itemGrants;
                        offerPrice = shopConfig[key].price;
                        break;
                    }
                }
            }

            if (offerItems.length === 0) {
                return res.status(400).json({ error: "Offer not found" });
            }
            if (!common_core.items["Currency:MtxPurchased"]) {
                common_core.items["Currency:MtxPurchased"] = { templateId: "Currency:MtxPurchased", quantity: 0, attributes: {} };
            }
            if (common_core.items["Currency:MtxPurchased"].quantity < offerPrice) {
                return res.status(400).json({ error: "Not enough V-Bucks" });
            }
            common_core.items["Currency:MtxPurchased"].quantity -= offerPrice;
            if (profile0.items?.["Currency:MtxPurchased"]) {
                profile0.items["Currency:MtxPurchased"].quantity = common_core.items["Currency:MtxPurchased"].quantity;
            }
            const lootList: any[] = [];
            const athenaChanges: any[] = [];
            for (const templateId of offerItems) {
                const itemId = makeID().replace(/-/g, "");
                athena.items[itemId] = { templateId, attributes: { item_seen: false, variants: [], favorite: false }, quantity: 1 };
                lootList.push({ itemType: templateId, itemGuid: itemId, itemProfile: "athena", quantity: 1 });
                athenaChanges.push({ changeType: "itemAdded", itemId, item: athena.items[itemId] });
            }

            common_core.rvn = (common_core.rvn || 0) + 1;
            common_core.commandRevision = (common_core.commandRevision || 0) + 1;
            athena.rvn = (athena.rvn || 0) + 1;
            athena.commandRevision = (athena.commandRevision || 0) + 1;

            await Profile.updateOne({ accountId: req.user.accountId }, {
                $set: {
                    "profiles.common_core": common_core,
                    "profiles.athena": athena,
                    "profiles.profile0.items.Currency:MtxPurchased.quantity": common_core.items["Currency:MtxPurchased"].quantity
                }
            });

            const ApplyProfileChanges: any[] = [
                { changeType: "itemQuantityChanged", itemId: "Currency:MtxPurchased", quantity: common_core.items["Currency:MtxPurchased"].quantity }
            ];

            return res.json({
                profileRevision: common_core.rvn,
                profileId: "common_core",
                profileChangesBaseRevision: common_core.rvn - 1,
                profileChanges: ApplyProfileChanges,
                multiUpdate: [{
                    profileRevision: athena.rvn,
                    profileId: "athena",
                    profileChangesBaseRevision: athena.rvn - 1,
                    profileChanges: athenaChanges,
                    profileCommandRevision: athena.commandRevision
                }],
                notifications: [{
                    type: "CatalogPurchase",
                    primary: true,
                    lootResult: { items: lootList }
                }],
                profileCommandRevision: common_core.commandRevision,
                serverTime: new Date().toISOString(),
                responseVersion: 1
            });
        }

        if (command === "RemoveGiftBox") {
            const profile = userProfile?.profiles?.[profileId] || userProfile?.profiles?.common_core;
            if (!profile || !profile.items) {
                return res.json({ profileRevision: 1, profileId, profileChangesBaseRevision: 1, profileChanges: [], profileCommandRevision: 1, serverTime: new Date().toISOString(), responseVersion: 1 });
            }

            const ApplyProfileChanges: any[] = [];
            if (typeof req.body?.giftBoxItemId === "string" && profile.items[req.body.giftBoxItemId]) {
                delete profile.items[req.body.giftBoxItemId];
                ApplyProfileChanges.push({ changeType: "itemRemoved", itemId: req.body.giftBoxItemId });
            }
            if (Array.isArray(req.body?.giftBoxItemIds)) {
                for (const id of req.body.giftBoxItemIds) {
                    if (typeof id === "string" && profile.items[id] && profile.items[id].templateId?.startsWith("GiftBox:")) {
                        delete profile.items[id];
                        ApplyProfileChanges.push({ changeType: "itemRemoved", itemId: id });
                    }
                }
            }
            if (ApplyProfileChanges.length > 0) {
                profile.rvn = (profile.rvn || 0) + 1;
                profile.commandRevision = (profile.commandRevision || 0) + 1;
                await Profile.updateOne({ accountId: req.user.accountId }, { $set: { [`profiles.${profileId}`]: profile } });
            }
            return res.json({
                profileRevision: profile.rvn || 1,
                profileId,
                profileChangesBaseRevision: (profile.rvn || 1) - 1,
                profileChanges: ApplyProfileChanges,
                profileCommandRevision: profile.commandRevision || 1,
                serverTime: new Date().toISOString(),
                responseVersion: 1
            });
        }
        const defaultAthenaStats = {
            use_random_loadout: false,
            past_seasons: [],
            season_match_boost: 0,
            loadouts: ["sandbox_loadout"],
            mfa_reward_claimed: true,
            rested_xp_overflow: 0,
            current_mtx_platform: "EpicPC",
            last_xp_interaction: new Date().toISOString(),
            quest_manager: { dailyLoginInterval: "2017-01-01T00:00:00.000Z", dailyQuestRerolls: 1 },
            book_level: 1,
            season_num: 19,
            book_xp: 0,
            creative_dynamic_xp: {},
            season: { numWins: 0, numHighBracket: 0, numLowBracket: 0 },
            lifetime_wins: 0,
            party_assist_quest: "",
            purchased_battle_pass_tier_offers: [],
            rested_xp_exchange: 1,
            level: 1,
            rested_xp: 0,
            rested_xp_mult: 1,
            accountLevel: 1,
            rested_xp_cumulative: 0,
            xp: 0,
            active_loadout_index: 0,
            favorite_character: "AthenaCharacter:CID_001_Athena_Commando_F_Default",
            favorite_backpack: "",
            favorite_pickaxe: "AthenaPickaxe:DefaultPickaxe",
            favorite_glider: "AthenaGlider:DefaultGlider",
            favorite_skydivecontrail: "",
            favorite_dance: ["", "", "", "", "", ""],
            favorite_musicpack: "",
            favorite_loading: "",
            favorite_itemwraps: ["", "", "", "", "", "", ""],
            banner_icon: "standardbanner15",
            banner_color: "defaultcolor1",
            survey_data: {},
            personal_offers: {},
            intro_game_played: true,
            import_friends_claimed: {},
            mtx_purchase_history: { refundsUsed: 0, refundCredits: 3, purchases: [] },
            allowed_to_send_gifts: true,
            gift_history: {},
            allowed_to_receive_gifts: true
        };

        const defaultItems: Record<string, any> = {
            "sandbox_loadout": {
                templateId: "CosmeticLocker:CosmeticLocker_Athena",
                attributes: {
                    locker_slots_data: {
                        slots: {
                            Character: { items: ["AthenaCharacter:CID_001_Athena_Commando_F_Default"] },
                            Backpack: { items: [""] },
                            Pickaxe: { items: ["AthenaPickaxe:DefaultPickaxe"] },
                            Glider: { items: ["AthenaGlider:DefaultGlider"] },
                            SkyDiveContrail: { items: [""] },
                            Dance: { items: ["", "", "", "", "", ""] },
                            LoadingScreen: { items: [""] },
                            MusicPack: { items: [""] },
                            ItemWrap: { items: ["", "", "", "", "", "", ""] }
                        }
                    },
                    use_count: 0,
                    banner_icon_template: "standardbanner15",
                    banner_color_template: "defaultcolor1",
                    locker_name: "Storm",
                    item_seen: true,
                    favorite: false
                },
                quantity: 1
            },
            "AthenaCharacter:CID_001_Athena_Commando_F_Default": {
                templateId: "AthenaCharacter:CID_001_Athena_Commando_F_Default",
                attributes: { item_seen: true, variants: [], favorite: false },
                quantity: 1
            },
            "AthenaPickaxe:DefaultPickaxe": {
                templateId: "AthenaPickaxe:DefaultPickaxe",
                attributes: { item_seen: true, variants: [], favorite: false },
                quantity: 1
            },
            "AthenaGlider:DefaultGlider": {
                templateId: "AthenaGlider:DefaultGlider",
                attributes: { item_seen: true, variants: [], favorite: false },
                quantity: 1
            }
        };

        if (!userProfile || !userProfile.profiles) {
            return res.json({
                profileRevision: 1,
                profileId,
                profileChangesBaseRevision: 1,
                profileChanges: [{
                    changeType: "fullProfileUpdate",
                    profile: {
                        _id: req.user.accountId,
                        created: new Date().toISOString(),
                        updated: new Date().toISOString(),
                        rvn: 1,
                        wipeNumber: 1,
                        accountId: req.user.accountId,
                        profileId,
                        version: "storm_backend",
                        items: profileId === "athena" ? defaultItems : {},
                        stats: { attributes: profileId === "athena" ? defaultAthenaStats : {} },
                        commandRevision: 1
                    }
                }],
                profileCommandRevision: 1,
                serverTime: new Date().toISOString(),
                responseVersion: 1
            });
        }

        const profile = userProfile.profiles[profileId] || { items: {}, stats: { attributes: {} }, rvn: 1, commandRevision: 1 };
        const rvn = profile.rvn || 1;
        let items = profile.items || {};
        let statsAttrs = profile.stats?.attributes || {};
        if (profileId === "athena") {
            if (!items || Object.keys(items).length === 0) {
                items = defaultItems;
            }
            if (!statsAttrs || Object.keys(statsAttrs).length === 0) {
                statsAttrs = defaultAthenaStats;
            }
            if (!statsAttrs.favorite_character) statsAttrs.favorite_character = "AthenaCharacter:CID_001_Athena_Commando_F_Default";
            if (!statsAttrs.favorite_pickaxe) statsAttrs.favorite_pickaxe = "AthenaPickaxe:DefaultPickaxe";
            if (!statsAttrs.favorite_glider) statsAttrs.favorite_glider = "AthenaGlider:DefaultGlider";
            if (!statsAttrs.favorite_dance) statsAttrs.favorite_dance = ["", "", "", "", "", ""];
            if (!statsAttrs.favorite_itemwraps) statsAttrs.favorite_itemwraps = ["", "", "", "", "", "", ""];
            if (!statsAttrs.active_loadout_index && statsAttrs.active_loadout_index !== 0) statsAttrs.active_loadout_index = 0;
            if (!statsAttrs.loadouts) statsAttrs.loadouts = ["sandbox_loadout"];
            if (!statsAttrs.banner_icon) statsAttrs.banner_icon = "standardbanner15";
            if (!statsAttrs.banner_color) statsAttrs.banner_color = "defaultcolor1";
        }

        res.json({
            profileRevision: rvn,
            profileId,
            profileChangesBaseRevision: rvn,
            profileChanges: [{
                changeType: "fullProfileUpdate",
                profile: {
                    _id: req.user.accountId,
                    created: userProfile.created || new Date().toISOString(),
                    updated: new Date().toISOString(),
                    rvn,
                    wipeNumber: 1,
                    accountId: req.user.accountId,
                    profileId,
                    version: "storm_backend",
                    items,
                    stats: { attributes: statsAttrs },
                    commandRevision: profile.commandRevision || 1
                }
            }],
            profileCommandRevision: profile.commandRevision || 1,
            serverTime: new Date().toISOString(),
            responseVersion: 1
        });
    } catch (err) {
        log.error("MCP profile error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});


router.get("/fortnite/api/receipts/v1/account/:accountId/receipts", verifyToken as any, (req, res) => {
    res.json([]);
});
router.get("/fortnite/api/stats/accountId/:accountId/bulk/window/alltime", verifyToken as any, (req, res) => {
    res.json([]);
});
router.post("/fortnite/api/feedback/*", (req, res) => {
    res.status(200).json({});
});
router.post("/datarouter/api/v1/public/data", async (req, res) => {
    try {
        const userIdParam = req.query.UserID as string;
        const accountId = userIdParam ? userIdParam.split("|")[1] || "" : "";
        const events = req.body?.Events;

        if (Array.isArray(events) && events.length > 0 && accountId) {
            const user = await User.findOne({ accountId });
            if (user) {
                for (const event of events) {
                    const { EventName, ProviderType, PlayerKilledPlayerEventCount } = event;
                    if (EventName && ProviderType === "Client") {
                        const kills = Number(PlayerKilledPlayerEventCount) || 0;

                        if (EventName === "Athena.ClientWonMatch") {
                            await Arena.updateOne({ accountId }, { $inc: { hype: 25 } }, { upsert: true });
                        } else if (EventName === "Combat.AthenaClientEngagement") {
                            if (kills > 0) {
                                await Arena.updateOne({ accountId }, { $inc: { hype: kills * 7 } }, { upsert: true });
                            }
                        } else if (EventName === "Combat.ClientPlayerDeath") {
                            const arenaData: any = await Arena.findOne({ accountId });
                            if (arenaData && arenaData.division >= 4) {
                                await Arena.updateOne({ accountId }, { $inc: { hype: -20 } });
                            }
                        }
                    }
                }
            }
        }
    } catch (err) {
        log.error("Datarouter error:", err);
    }

    res.status(204).end();
});


router.get("/fortnite/api/game/v2/enabled_features", (req, res) => {
    res.json([]);
});

router.get("/entitlement/api/account/:accountId/entitlements", verifyToken as any, (req, res) => {
    res.json([]);
});

router.get("/affiliate/api/public/affiliates/slug/:slug", (req, res) => {
    res.json({
        id: makeID(),
        slug: req.params.slug,
        displayName: req.params.slug,
        status: "ACTIVE",
        verified: true
    });
});

router.post("/fortnite/api/game/v2/creative/discovery/surface/:accountId", (req, res) => {
    log.debug("Discovery surface endpoint hit");
    const discoveryPath = path.join(process.cwd(), "data", "discovery.json");
    if (existsSync(discoveryPath)) {
        try {
            const data = JSON.parse(readFileSync(discoveryPath, "utf-8"));
            return res.json(data);
        } catch (e) { log.error("Discovery JSON parse error:", e); }
    }
    res.json({ Panels: [], TestCohorts: [], ModeSets: {} });
});

router.post("/api/v1/discovery/surface/:hash", (req, res) => {
    const discoveryPath = path.join(process.cwd(), "data", "discovery.json");
    if (existsSync(discoveryPath)) {
        try { return res.json(JSON.parse(readFileSync(discoveryPath, "utf-8"))); } catch {}
    }
    res.json({ Panels: [], TestCohorts: [], ModeSets: {} });
});

router.post("/api/v2/discovery/surface/:hash", (req, res) => {
    const discoveryPath = path.join(process.cwd(), "data", "discovery.json");
    if (existsSync(discoveryPath)) {
        try { return res.json(JSON.parse(readFileSync(discoveryPath, "utf-8"))); } catch {}
    }
    res.json({ Panels: [], TestCohorts: [], ModeSets: {} });
});

router.post("/discovery/surface/:hash", (req, res) => {
    const discoveryPath = path.join(process.cwd(), "data", "discovery.json");
    if (existsSync(discoveryPath)) {
        try { return res.json(JSON.parse(readFileSync(discoveryPath, "utf-8"))); } catch {}
    }
    res.json({ Panels: [], TestCohorts: [], ModeSets: {} });
});

router.get("/fortnite/api/discovery/accessToken/:branch", (req, res) => {
    res.json({ branchName: req.params.branch, appId: "Fortnite", token: "stormbackendtoken" });
});

router.post("/links/api/fn/mnemonic", (req, res) => {
    log.debug("Links mnemonic POST hit");
    const discoveryPath = path.join(process.cwd(), "data", "discovery.json");
    if (existsSync(discoveryPath)) {
        try {
            const discovery = JSON.parse(readFileSync(discoveryPath, "utf-8"));
            const arr = (discovery.Panels?.[0]?.Pages?.[0]?.results || []).map((r: any) => r.linkData);
            return res.json(arr);
        } catch {}
    }
    res.json([]);
});

router.get("/links/api/fn/mnemonic/:playlist/related", (req, res) => {
    log.debug(`Links mnemonic related: ${req.params.playlist}`);
    const discoveryPath = path.join(process.cwd(), "data", "discovery.json");
    const response: any = { parentLinks: [], links: {} };
    if (existsSync(discoveryPath)) {
        try {
            const discovery = JSON.parse(readFileSync(discoveryPath, "utf-8"));
            const results = discovery.Panels?.[0]?.Pages?.[0]?.results || [];
            for (const r of results) {
                if (r.linkData?.mnemonic === req.params.playlist) {
                    response.links[req.params.playlist] = r.linkData;
                }
            }
        } catch {}
    }
    res.json(response);
});

router.get("/links/api/fn/mnemonic/:mnemonic", (req, res) => {
    log.debug(`Links mnemonic GET: ${req.params.mnemonic}`);
    const discoveryPath = path.join(process.cwd(), "data", "discovery.json");
    if (existsSync(discoveryPath)) {
        try {
            const discovery = JSON.parse(readFileSync(discoveryPath, "utf-8"));
            const results = discovery.Panels?.[0]?.Pages?.[0]?.results || [];
            for (const r of results) {
                if (r.linkData?.mnemonic === req.params.mnemonic) return res.json(r.linkData);
            }
        } catch {}
    }
    res.status(404).json({});
});

router.get("/eulatracking/api/shared/agreements/fn*", (req, res) => {
    res.status(204).end();
});

router.get("/fortnite/api/game/v2/privacy/account/:accountId", verifyToken as any, (req, res) => {
    res.json({ accountId: req.params.accountId, optOutOfPublicLeaderboards: false });
});


router.get("/party/api/v1/Fortnite/user/:accountId", verifyToken as any, (req, res) => {
    res.json({ current: [], pending: [], invites: [], pings: [] });
});


router.get("/fortnite/api/calendar/v1/timeline", (req, res) => {
    const memory = getVersionInfo(req);
    const now = new Date().toISOString();

    res.json({
        channels: {
            "client-matchmaking": { states: [], cacheExpire: "9999-12-31T23:59:59.999Z" },
            "client-events": {
                states: [{
                    validFrom: "2020-01-01T00:00:00.000Z",
                    activeEvents: [
                        { eventType: `EventFlag.Season${memory.season}`, activeUntil: "9999-12-31T23:59:59.999Z", activeSince: "2020-01-01T00:00:00.000Z" },
                        { eventType: `EventFlag.LobbySeason${memory.season}`, activeUntil: "9999-12-31T23:59:59.999Z", activeSince: "2020-01-01T00:00:00.000Z" },
                        { eventType: "EventFlag.Arena", activeUntil: "9999-12-31T23:59:59.999Z", activeSince: "2020-01-01T00:00:00.000Z" }
                    ],
                    state: {
                        activeStorefronts: [],
                        eventNamedWeights: {},
                        seasonNumber: memory.season,
                        seasonTemplateId: `AthenaSeason:athenaseason${memory.season}`,
                        matchXpBonusPoints: 0,
                        seasonBegin: "2020-01-01T00:00:00.000Z",
                        seasonEnd: "9999-12-31T23:59:59.999Z",
                        seasonDisplayedEnd: "9999-12-31T23:59:59.999Z",
                        weeklyStoreEnd: "9999-12-31T23:59:59.999Z",
                        stwEventStoreEnd: "9999-12-31T23:59:59.999Z",
                        stwWeeklyStoreEnd: "9999-12-31T23:59:59.999Z",
                        dailyStoreEnd: "9999-12-31T23:59:59.999Z"
                    }
                }],
                cacheExpire: "9999-12-31T23:59:59.999Z"
            },
            "client-companionapi": { states: [], cacheExpire: "9999-12-31T23:59:59.999Z" }
        },
        cacheIntervalMins: 10,
        currentTime: now
    });
});


router.get("/account/api/public/account/:accountId/externalAuths", verifyToken as any, (req, res) => {
    res.json([]);
});


router.get("/v1/avatar/fortnite/ids", (req, res) => {
    res.json([]);
});


router.get("/eulatracking/api/public/agreements/fn/account/:accountId", (req, res) => {
    res.status(204).end();
});


router.get("/content-controls/:accountId", (req, res) => {
    res.json({});
});

router.get("/content-controls/:accountId/rules/namespaces/:namespace", (req, res) => {
    res.json([]);
});


router.get("/sdk/v1/default", (req, res) => {
    res.json({});
});


router.get("/socialban/api/public/v1/:accountId", (req, res) => {
    res.json({ bans: [], warnings: [] });
});


router.get("/presence/api/v1/_/:accountId/last-online", (req, res) => {
    res.json({});
});


router.get("/api/v2/interactions/latest/*", (req, res) => {
    res.json([]);
});

router.get("/api/v2/interactions/aggregated/*", (req, res) => {
    res.json([]);
});


router.put("/profile/play_region", (req, res) => {
    res.status(204).end();
});

router.put("/profile/languages", (req, res) => {
    res.status(204).end();
});

router.put("/profile/privacy_settings", (req, res) => {
    res.status(204).end();
});


router.get("/region", (req, res) => {
    res.json({ continent: { code: "EU" }, country: { iso_code: "US" } });
});


router.get("/statsproxy/api/statsv2/account/:accountId", (req, res) => {
    res.json([]);
});


router.get("/friends/api/v1/:accountId/recent/fortnite", (req, res) => {
    res.json([]);
});


router.get("/party/api/v1/Fortnite/user/:accountId/notifications/undelivered/count", verifyToken as any, (req, res) => {
    res.json({ undelivered: 0 });
});


router.post("/api/v1/assets/Fortnite/:version/:cl", (req, res) => {
    if (req.body && req.body.hasOwnProperty("FortCreativeDiscoverySurface") && req.body.FortCreativeDiscoverySurface === 0) {
        const assetsPath = path.join(process.cwd(), "data", "discovery_api_assets.json");
        if (existsSync(assetsPath)) {
            try { return res.json(JSON.parse(readFileSync(assetsPath, "utf-8"))); } catch {}
        }
    }
    res.json({
        FortCreativeDiscoverySurface: {
            meta: { promotion: req.body?.FortCreativeDiscoverySurface || 0 },
            assets: {}
        }
    });
});


router.get("/api/v1/events/Fortnite/download/:accountId", verifyToken as any, async (req: AuthenticatedRequest, res) => {
    const accountId = req.params.accountId;

    try {
        let arenaData = await Arena.findOne({ accountId });
        const hypePoints = arenaData ? (arenaData as any).hype : 0;
        const division = arenaData ? (arenaData as any).division : 0;

        const eventsPath = path.join(process.cwd(), "data", "eventlistactive.json");
        if (!existsSync(eventsPath)) {
            return res.json({ player: { accountId, persistentScores: { Hype: 0 }, tokens: [] }, events: [], templates: [] });
        }

        const events = JSON.parse(readFileSync(eventsPath, "utf-8"));

        events.player = {
            accountId,
            gameId: "Fortnite",
            persistentScores: { Hype: hypePoints },
            tokens: [`ARENA_S24_Division${division + 1}`]
        };

        res.json(events);
    } catch (err) {
        log.error("Error fetching Arena data:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.get("/api/v1/events/Fortnite/:eventId/history/:accountId", (req, res) => {
    res.json({ events: [], paging: { count: 0, total: 0 } });
});

router.get("/fortnite/api/game/v2/br-inventory/account/:accountId", verifyToken as any, (req, res) => {
    res.json({ stash: { globalcash: 0 } });
});


router.get("/content/api/pages/fortnite-game/tournamentinformation", (req, res) => {
    const contentPagesPath = path.join(process.cwd(), "data", "contentpages.json");
    if (existsSync(contentPagesPath)) {
        try {
            const cp = JSON.parse(readFileSync(contentPagesPath, "utf-8"));
            if (cp.tournamentinformation) return res.json(cp.tournamentinformation);
        } catch {}
    }
    res.json({ tournament_info: { tournaments: [] } });
});

router.get("/content/api/pages/*", (req, res) => {
    const contentPagesPath = path.join(process.cwd(), "data", "contentpages.json");
    if (existsSync(contentPagesPath)) {
        try { return res.json(JSON.parse(readFileSync(contentPagesPath, "utf-8"))); } catch {}
    }
    res.json({});
});

router.get("/fortnite/api/matchmaking/session/findPlayer/*", (req, res) => {
    res.status(200).end();
});

router.get("/fortnite/api/game/v2/matchmakingservice/ticket/player/:accountId", verifyToken as any, async (req: AuthenticatedRequest, res) => {
    const bucketId = (req.query.bucketId as string) || "";
    if (!bucketId || bucketId.split(":").length !== 4) {
        return res.status(400).end();
    }

    const playlist = bucketId.split(":")[3];
    const matchmakerIP = config.matchmakerIP;
    await (globalThis as any).kv.set(`playerPlaylist:${req.user.accountId}`, playlist);
    (globalThis as any).buildUniqueId = (globalThis as any).buildUniqueId || {};
    (globalThis as any).buildUniqueId[req.user.accountId] = bucketId.split(":")[0];
    const host = (req.headers.host || "127.0.0.1:2086").split(":")[0];
    const mmPort = (config.matchmakerIP || "0.0.0.0:80").split(":").pop() || "80";

    res.json({
        serviceUrl: `ws://${host}:${mmPort}`,
        ticketType: "mms-player",
        payload: req.user.matchmakingId,
        signature: "account"
    });
});

router.get("/fortnite/api/game/v2/matchmaking/account/:accountId/session/:sessionId", (req, res) => {
    res.json({
        accountId: req.params.accountId,
        sessionId: req.params.sessionId,
        key: "none"
    });
});

router.get("/fortnite/api/matchmaking/session/:sessionId", verifyToken as any, async (req: AuthenticatedRequest, res) => {
    const playlist = await (globalThis as any).kv.get(`playerPlaylist:${req.user.accountId}`) || "playlist_defaultsolo";
    const gameServers: string[] = config.gameServerIP;
    let selectedServer = gameServers.find((s: string) => s.split(":")[2]?.toLowerCase() === playlist.toLowerCase());
    if (!selectedServer) selectedServer = gameServers[0] || "127.0.0.1:7777:playlist_defaultsolo";

    const serverParts = selectedServer.split(":");
    const serverIp = serverParts[0];
    const serverPort = parseInt(serverParts[1]) || 7777;
    const serverPlaylist = serverParts[2] || playlist;

    const buildId = (globalThis as any).buildUniqueId?.[req.user.accountId] || "0";

    res.json({
        id: req.params.sessionId,
        ownerId: makeID().replace(/-/g, "").toUpperCase(),
        ownerName: "[DS]fortnite-storm-server",
        serverName: "[DS]fortnite-storm-server",
        serverAddress: serverIp,
        serverPort: serverPort,
        maxPublicPlayers: 220,
        openPublicPlayers: 175,
        maxPrivatePlayers: 0,
        openPrivatePlayers: 0,
        attributes: {
            REGION_s: "EU",
            GAMEMODE_s: "FORTATHENA",
            ALLOWBROADCASTING_b: true,
            SUBREGION_s: "GB",
            DCID_s: "FORTNITE-STORM-SERVER",
            tenant_s: "Fortnite",
            MATCHMAKINGPOOL_s: "Any",
            STORMSHIELDDEFENSETYPE_i: 0,
            HOTFIXVERSION_i: 0,
            PLAYLISTNAME_s: serverPlaylist,
            SESSIONKEY_s: makeID().replace(/-/g, "").toUpperCase(),
            TENANT_s: "Fortnite",
            BEACONPORT_i: 15009
        },
        publicPlayers: [],
        privatePlayers: [],
        totalPlayers: 45,
        allowJoinInProgress: false,
        shouldAdvertise: false,
        isDedicated: false,
        usesStats: false,
        allowInvites: false,
        usesPresence: false,
        allowJoinViaPresence: true,
        allowJoinViaPresenceFriendsOnly: false,
        buildUniqueId: buildId,
        lastUpdated: new Date().toISOString(),
        started: false
    });
});

router.post("/fortnite/api/matchmaking/session/*/join", (req, res) => {
    res.status(204).end();
});

router.post("/fortnite/api/matchmaking/session/matchMakingRequest", (req, res) => {
    res.json([]);
});

router.post("/api/v1/fortnite-br/surfaces/motd/target", (req, res) => {
    res.json({ contentItems: [] });
});

router.post("/api/v1/fortnite-br/surfaces/motd/interactions", (req, res) => {
    res.json({});
});


router.put("/profiles", (req, res) => {
    res.status(204).end();
});


router.patch("/friends/api/v1/:accountId/settings", (req, res) => {
    res.status(204).end();
});


router.get("/unknown", (req, res) => {
    res.json({ status: "ok" });
});

export default router;
