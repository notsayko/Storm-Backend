const store = new Map<string, { value: string; expiry?: number }>();

class KV {
    async get(key: string): Promise<string | undefined> {
        const entry = store.get(key);
        if (!entry) return undefined;
        if (entry.expiry && Date.now() > entry.expiry) {
            store.delete(key);
            return undefined;
        }
        return entry.value;
    }

    async set(key: string, value: string): Promise<boolean> {
        store.set(key, { value });
        return true;
    }

    async setTTL(key: string, value: string, ttlMs: number): Promise<boolean> {
        store.set(key, { value, expiry: Date.now() + ttlMs });
        return true;
    }
}

export default new KV();
