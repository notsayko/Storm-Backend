import type { WebSocket } from "ws";
import { makeID, sleep } from "../services/functions";
import log from "../services/logger";

interface QueuePlayer {
    ws: WebSocket;
    ticketId: string;
    matchId: string;
    sessionId: string;
    state: string;
}

let queue: QueuePlayer[] = [];
let matchTimer: ReturnType<typeof setInterval> | null = null;
let countdown = 10;

export default async function handleMatchmaking(ws: WebSocket): Promise<void> {
    const ticketId = makeID().replace(/-/g, "");
    const matchId = makeID().replace(/-/g, "");
    const sessionId = makeID().replace(/-/g, "");

    const player: QueuePlayer = { ws, ticketId, matchId, sessionId, state: "Connecting" };
    queue.push(player);
    log.backend(`Matchmaker: player queued. Total: ${queue.length}`);

    if (queue.length === 1) countdown = 10;
    else countdown = Math.max(0, countdown - 3);

    ws.on("close", () => {
        queue = queue.filter(p => p.ws !== ws);
        log.backend(`Matchmaker: player left. Total: ${queue.length}`);
    });

    ws.on("error", () => {
        queue = queue.filter(p => p.ws !== ws);
    });

    try { ws.send(JSON.stringify({ payload: { state: "Connecting" }, name: "StatusUpdate" })); } catch {}
    await sleep(500);
    try { ws.send(JSON.stringify({ payload: { totalPlayers: 1, connectedPlayers: 1, state: "Waiting" }, name: "StatusUpdate" })); } catch {}
    await sleep(500)
    player.state = "Queued";
    sendQueued(ws, ticketId, queue.length, countdown);
    startMatchmakingTimer();
}

function startMatchmakingTimer(): void {
    if (matchTimer) return;

    matchTimer = setInterval(() => {
        if (queue.length === 0) { clearInterval(matchTimer!); matchTimer = null; return; }

        if (countdown > 0) {
            countdown--;
            queue.forEach(p => {
                if (p.state === "Queued") sendQueued(p.ws, p.ticketId, queue.length, countdown);
            });
        } else {
            const players = [...queue];
            queue = [];
            clearInterval(matchTimer!);
            matchTimer = null;

            players.forEach(async (p) => {
                // SessionAssignment
                try { p.ws.send(JSON.stringify({ payload: { matchId: p.matchId, state: "SessionAssignment" }, name: "StatusUpdate" })); } catch {}
                await sleep(2000);
                // Play
                try { p.ws.send(JSON.stringify({ payload: { matchId: p.matchId, sessionId: p.sessionId, joinDelaySec: 1 }, name: "Play" })); } catch {}
            });
        }
    }, 1000);
}

function sendQueued(ws: WebSocket, ticketId: string, queuedPlayers: number, estimatedWaitSec: number): void {
    try {
        ws.send(JSON.stringify({
            payload: { ticketId, queuedPlayers, estimatedWaitSec, status: {}, state: "Queued" },
            name: "StatusUpdate"
        }));
    } catch {}
}
