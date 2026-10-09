import mongoose from "mongoose";

const ProfileSchema = new mongoose.Schema(
    {
        created: { type: Date, required: true },
        accountId: { type: String, required: true, unique: true },
        profiles: { type: Object, required: true }
    },
    { collection: "profiles" }
);

export default mongoose.model("Profile", ProfileSchema);
