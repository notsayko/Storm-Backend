import { Router } from "express";
import bcrypt from "bcrypt";
import User from "../database/user";
import log from "../services/logger";

const router = Router();

router.get("/api/launcher/login", async (req, res) => {
    const { email, password } = req.query as Record<string, string>;

    if (!email) return res.status(400).send("The email was not entered.");
    if (!password) return res.status(400).send("The password was not entered.");

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(404).send("User not found.");

        const match = await bcrypt.compare(password, (user as any).password);
        if (!match) return res.status(400).send("Invalid credentials.");

        return res.status(200).json({ username: (user as any).username });
    } catch (err) {
        log.error("Launcher API error:", err);
        return res.status(500).send("Internal server error.");
    }
});

export default router;
