import mongoose from "mongoose";

const ArenaSchema = new mongoose.Schema(
    {
        accountId: { type: String, required: true, unique: true },
        hype: { type: Number, default: 0 },
        division: { type: Number, default: 0 }
    },
    { collection: "arena" }
);

export default mongoose.model("Arena", ArenaSchema);
