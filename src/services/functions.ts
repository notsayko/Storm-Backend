import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcrypt";
import { readFileSync } from "fs";
import type { VersionMemory } from "../types";
import User from "../database/user";
import Profile from "../database/profile";
import Friends from "../database/friends";
import Arena from "../database/arena";
import log from "./logger";
import { updateTokens } from "./tokens";

// @ts-ignore - profile manager
const profileManager = {
    createProfiles: (accountId: string) => ({
        athena: {
            items: {
                "sandbox_loadout": {
                    templateId: "CosmeticLocker:CosmeticLocker_Athena",
                    attributes: {
                        locker_slots_data: { slots: { Character: { items: ["AthenaCharacter:CID_001_Athena_Commando_F_Default"] }, Backpack: { items: [""] }, Pickaxe: { items: ["AthenaPickaxe:DefaultPickaxe"] }, Glider: { items: ["AthenaGlider:DefaultGlider"] }, SkyDiveContrail: { items: [""] }, Dance: { items: ["","","","","",""] }, LoadingScreen: { items: [""] }, MusicPack: { items: [""] }, ItemWrap: { items: ["","","","","","",""] } } },
                        use_count: 0, banner_icon_template: "standardbanner15", banner_color_template: "defaultcolor1", locker_name: "Storm", item_seen: true, favorite: false
                    },
                    quantity: 1
                },
                "AthenaCharacter:CID_001_Athena_Commando_F_Default": { templateId: "AthenaCharacter:CID_001_Athena_Commando_F_Default", attributes: { item_seen: true, variants: [], favorite: false }, quantity: 1 },
                "AthenaPickaxe:DefaultPickaxe": { templateId: "AthenaPickaxe:DefaultPickaxe", attributes: { item_seen: true, variants: [], favorite: false }, quantity: 1 },
                "AthenaGlider:DefaultGlider": { templateId: "AthenaGlider:DefaultGlider", attributes: { item_seen: true, variants: [], favorite: false }, quantity: 1 }
            },
            stats: { attributes: { favorite_character: "AthenaCharacter:CID_001_Athena_Commando_F_Default", favorite_pickaxe: "AthenaPickaxe:DefaultPickaxe", favorite_glider: "AthenaGlider:DefaultGlider", favorite_dance: ["","","","","",""], favorite_itemwraps: ["","","","","","",""], active_loadout_index: 0, loadouts: ["sandbox_loadout"], banner_icon: "standardbanner15", banner_color: "defaultcolor1", level: 1, xp: 0, accountLevel: 1, season_num: 19 } },
            rvn: 1, commandRevision: 1
        },
        common_core: {
            items: { "Currency:MtxPurchased": { templateId: "Currency:MtxPurchased", attributes: { platform: "EpicPC" }, quantity: 0 } },
            stats: { attributes: { allowed_to_send_gifts: true, allowed_to_receive_gifts: true, gift_history: {}, mfa_reward_claimed: true, mtx_purchase_history: { refundsUsed: 0, refundCredits: 3, purchases: [] } } },
            rvn: 1, commandRevision: 1
        },
        profile0: {
            items: { "Currency:MtxPurchased": { templateId: "Currency:MtxPurchased", attributes: { platform: "EpicPC" }, quantity: 0 } },
            stats: { attributes: {} },
            rvn: 1, commandRevision: 1
        },
        creative: { items: {}, stats: { attributes: {} }, rvn: 1, commandRevision: 1 },
        collections: { items: {}, stats: { attributes: {} }, rvn: 1, commandRevision: 1 }
    })
};

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function makeID(): string {
    return uuidv4();
}

export function decodeBase64(str: string): string {
    return Buffer.from(str, "base64").toString();
}

export function getVersionInfo(req: any): VersionMemory {
    const memory: VersionMemory = { season: 0, build: 0.0, CL: "0", lobby: "" };

    if (req.headers["user-agent"]) {
        let CL = "";

        try {
            let buildID = req.headers["user-agent"].split("-")[3].split(",")[0];
            if (!Number.isNaN(Number(buildID))) CL = buildID;
            else {
                buildID = req.headers["user-agent"].split("-")[3].split(" ")[0];
                if (!Number.isNaN(Number(buildID))) CL = buildID;
            }
        } catch {
            try {
                const buildID = req.headers["user-agent"].split("-")[1].split("+")[0];
                if (!Number.isNaN(Number(buildID))) CL = buildID;
            } catch {}
        }

        try {
            let build = req.headers["user-agent"].split("Release-")[1].split("-")[0];
            if (build.split(".").length === 3) {
                const v = build.split(".");
                build = v[0] + "." + v[1] + v[2];
            }
            memory.season = Number(build.split(".")[0]);
            memory.build = Number(build);
            memory.CL = CL;
            memory.lobby = `LobbySeason${memory.season}`;
            if (Number.isNaN(memory.season)) throw new Error();
        } catch {
            if (Number(CL) < 3724489) {
                memory.season = 0; memory.build = 0.0; memory.CL = CL; memory.lobby = "LobbySeason0";
            } else if (Number(CL) <= 3790078) {
                memory.season = 1; memory.build = 1.0; memory.CL = CL; memory.lobby = "LobbySeason1";
            } else {
                memory.season = 2; memory.build = 2.0; memory.CL = CL; memory.lobby = "LobbyWinterDecor";
            }
        }
    }

    return memory;
}

export function UpdateTokens(): void {
    updateTokens();
}

export async function registerUser(discordId: string | null, username: string, email: string, plainPassword: string): Promise<{ message: string; status: number }> {
    email = email.toLowerCase();

    if (!username || !email || !plainPassword) {
        return { message: "Username, email, or password is required.", status: 400 };
    }

    if (discordId && (await User.findOne({ discordId }))) {
        return { message: "You already created an account!", status: 400 };
    }

    if (await User.findOne({ email })) {
        return { message: "Email is already in use.", status: 400 };
    }

    const accountId = makeID().replace(/-/g, "");
    const matchmakingId = makeID().replace(/-/g, "");

    const emailFilter = /^([a-zA-Z0-9_.\-])+@(([a-zA-Z0-9\-])+\.)+([a-zA-Z0-9]{2,4})+$/;
    if (!emailFilter.test(email)) {
        return { message: "You did not provide a valid email address.", status: 400 };
    }
    if (username.length >= 25) {
        return { message: "Your username must be less than 25 characters long.", status: 400 };
    }
    if (username.length < 3) {
        return { message: "Your username must be at least 3 characters long.", status: 400 };
    }
    if (plainPassword.length >= 128) {
        return { message: "Your password must be less than 128 characters long.", status: 400 };
    }
    if (plainPassword.length < 4) {
        return { message: "Your password must be at least 4 characters long.", status: 400 };
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 10);

    try {
        const user = await User.create({
            created: new Date().toISOString(),
            discordId: discordId || null,
            accountId,
            username,
            username_lower: username.toLowerCase(),
            email,
            password: hashedPassword,
            matchmakingId
        });

        await Profile.create({
            created: user.created,
            accountId: user.accountId,
            profiles: profileManager.createProfiles(user.accountId)
        });
        await Friends.create({ created: user.created, accountId: user.accountId });
        await Arena.create({ accountId: user.accountId, hype: 0, division: 0 });
    } catch (err: any) {
        log.error("Error during user registration:", err);
        if (err.code === 11000) {
            return { message: "Username or email is already in use.", status: 400 };
        }
        return { message: "An unknown error has occurred, please try again later.", status: 400 };
    }

    return { message: `Successfully created an account with the username ${username}`, status: 200 };
}

export function MakeID(): string {
    return makeID();
}
