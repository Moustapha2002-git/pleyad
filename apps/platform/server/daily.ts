/**
 * Daily.co integration — private, token-secured video rooms.
 * The API key lives only here (server-side); the browser only ever receives a
 * short-lived join token for one specific room.
 */
const API = "https://api.daily.co/v1";

export function dailyConfigured() {
  return Boolean(process.env.DAILY_API_KEY && process.env.DAILY_DOMAIN);
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.DAILY_API_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Create the room if it doesn't already exist (idempotent). Private + no lobby. */
export async function ensureRoom(name: string) {
  const res = await fetch(`${API}/rooms`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name,
      privacy: "private",
      properties: {
        enable_prejoin_ui: false,
        enable_knocking: false,
        enable_network_ui: true,
        exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24, // room self-destructs in ~24h
      },
    }),
  });
  if (res.ok) return;
  // 400/409 "already exists" is fine — the room persists between calls.
  const text = await res.text();
  if (res.status === 409 || text.includes("already exists")) return;
  throw new Error(`Daily room error ${res.status}: ${text}`);
}

/** A short-lived token that lets exactly this user into exactly this room. */
export async function createMeetingToken(room: string, userName: string) {
  const res = await fetch(`${API}/meeting-tokens`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      properties: {
        room_name: room,
        user_name: userName,
        is_owner: true, // 1:1 — both may fully control; no lobby wait
        // No exp on the token: the room itself expires, and omitting exp avoids
        // clock-skew rejections between our host and Daily's servers.
      },
    }),
  });
  if (!res.ok) throw new Error(`Daily token error ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { token: string };
  return data.token;
}

/** Full join URL for the current user, or null if Daily isn't configured. */
export async function getJoinUrl(room: string, userName: string) {
  if (!dailyConfigured()) return null;
  await ensureRoom(room);
  const token = await createMeetingToken(room, userName);
  return `https://${process.env.DAILY_DOMAIN}/${room}?t=${token}`;
}
