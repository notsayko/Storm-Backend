import { Router } from "express";
import Arena from "../database/arena";
import User from "../database/user";
import log from "../services/logger";

const router = Router();

// GET /api/storm/leaderboard/arena
router.get("/api/storm/leaderboard/arena", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const page = Math.max(parseInt(req.query.page as string) || 1, 1);
        const skip = (page - 1) * limit;

        const total = await Arena.countDocuments({ hype: { $gt: 0 } });

        const arenaData = await Arena.find({ hype: { $gt: 0 } })
            .sort({ hype: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        const entries = await Promise.all(
            arenaData.map(async (entry: any, index: number) => {
                const user: any = await User.findOne({ accountId: entry.accountId }).lean();
                return {
                    rank: skip + index + 1,
                    accountId: entry.accountId,
                    username: user?.username || "Unknown",
                    hype: entry.hype,
                    division: entry.division || 0
                };
            })
        );

        res.json({
            leaderboard: entries,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
        });
    } catch (err) {
        log.error("Leaderboard error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/storm/leaderboard/arena/:accountId
router.get("/api/storm/leaderboard/arena/:accountId", async (req, res) => {
    try {
        const { accountId } = req.params;
        const playerData: any = await Arena.findOne({ accountId }).lean();

        if (!playerData) {
            return res.status(404).json({ error: "Player not found" });
        }

        const user: any = await User.findOne({ accountId }).lean();
        const rank = await Arena.countDocuments({ hype: { $gt: playerData.hype } }) + 1;

        res.json({ rank, accountId, username: user?.username || "Unknown", hype: playerData.hype, division: playerData.division || 0 });
    } catch (err) {
        log.error("Leaderboard player error:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// GET /api/storm/onlineplayers
router.get("/api/onlineplayers", (req, res) => {
    const clients = (globalThis as any).Clients || [];
    res.json({
        count: clients.length,
        players: clients.map((c: any) => ({
            accountId: c.accountId,
            displayName: c.displayName || c.accountId
        }))
    });
});

export default router;
