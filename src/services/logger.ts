function getTimestamp(): string {
    const now = new Date();
    return `${now.toLocaleDateString("en-US")} ${now.toLocaleTimeString()}`;
}

function formatLog(color: string, prefix: string, ...args: any[]): void {
    const msg = args.map(a => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    console.log(`${color}[${getTimestamp()}] ${prefix}\x1b[0m: ${msg}`);
}

export function backend(...args: any[]): void {
    formatLog("\x1b[32m", "Storm Backend", ...args);
}

export function bot(...args: any[]): void {
    formatLog("\x1b[33m", "Storm Bot", ...args);
}

export function xmpp(...args: any[]): void {
    formatLog("\x1b[34m", "Storm XMPP", ...args);
}

export function error(...args: any[]): void {
    formatLog("\x1b[31m", "Storm Error", ...args);
}

export function debug(...args: any[]): void {
    if (process.env.ENABLE_DEBUG_LOGS === "true") {
        formatLog("\x1b[35m", "Storm Debug", ...args);
    }
}

export function website(...args: any[]): void {
    formatLog("\x1b[36m", "Storm Website", ...args);
}

export default { backend, bot, xmpp, error, debug, website };
