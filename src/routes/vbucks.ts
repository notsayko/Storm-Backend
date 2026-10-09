import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import User from "../database/user";
import Profile from "../database/profile";
import log from "../services/logger";
import config from "../services/config";

const router = Router();

router.get("/api/storm/vbucks", async (req, res) => {
    const { apikey, username, reason } = req.query as Record<string, string>;

    if (!apikey || apikey !== config.Api.bApiKey) {
        return res.status(401).json({ code: "401", error: "Invalid or missing API key." });
    }
    if (!username) {
        return res.status(400).json({ code: "400", error: "Missing username." });
    }
    if (!reason) {
        return res.status(400).json({ code: "400", error: "Missing reason." });
    }

    const validReasons = config.Api.reasons;
    const addValue = validReasons[reason];

    if (addValue === undefined) {
        return res.status(400).json({ code: "400", error: `Invalid reason. Allowed: ${Object.keys(validReasons).join(", ")}.` });
    }

    try {
        const user = await User.findOne({ username_lower: username.trim().toLowerCase() });
        if (!user) return res.status(200).json({ message: "User not found." });

        const filter = { accountId: user.accountId };
        const updatedProfile = await Profile.findOneAndUpdate(
            filter,
            { $inc: { "profiles.common_core.items.Currency:MtxPurchased.quantity": addValue } },
            { new: true }
        );

        if (!updatedProfile) return res.status(404).json({ code: "404", error: "Profile not found." });

        await Profile.updateOne(filter, { $inc: { "profiles.profile0.items.Currency:MtxPurchased.quantity": addValue } });

        const common_core = (updatedProfile as any).profiles.common_core;
        const newQty = common_core.items["Currency:MtxPurchased"].quantity;

        const giftId = uuidv4();
        common_core.items[giftId] = {
            templateId: "GiftBox:GB_MakeGood",
            attributes: {
                fromAccountId: "[Administrator]",
                lootList: [{ itemType: "Currency:MtxGiveaway", itemGuid: "Currency:MtxGiveaway", quantity: addValue }],
                params: { userMessage: "Thx for playing Storm!" },
                giftedOn: new Date().toISOString()
            },
            quantity: 1
        };

        common_core.rvn += 1;
        common_core.commandRevision += 1;

        await Profile.updateOne(filter, { $set: { "profiles.common_core": common_core } });

        return res.status(200).json({
            profileRevision: common_core.rvn,
            profileCommandRevision: common_core.commandRevision,
            newQuantity: newQty
        });
    } catch (err) {
        log.error("VBucks API error:", err);
        return res.status(500).json({ code: "500", error: "Server error." });
    }
});

export default router;
