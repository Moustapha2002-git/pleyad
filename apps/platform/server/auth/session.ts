import { SignJWT, jwtVerify } from "jose";

// Session tokens are stateless signed JWTs (HS256). No session table in Phase 1;
// rotation/refresh can be layered on later without changing callers.
const getSecret = () => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
};

export async function createSessionToken(userId: number): Promise<string> {
  return new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return typeof payload.uid === "number" ? payload.uid : null;
  } catch {
    return null;
  }
}
