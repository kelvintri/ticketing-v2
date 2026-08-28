import bcrypt from "bcryptjs";
import { error, type RequestEvent } from "@sveltejs/kit";
import { jwtVerify, SignJWT, type JWTPayload } from "jose";
import { createDatabase, type Database } from "./db";
import { runtimeConfig } from "./runtime";

export interface AuthContext {
  agentId: string;
  email: string;
  name: string;
  role: "AGENT" | "ADMIN";
}

type AgentRow = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: "AGENT" | "ADMIN";
  active: number | boolean;
  createdAt: string;
};

type ActiveAgentRow = Pick<AgentRow, "id" | "active">;

function secretFor(platform: App.Platform | undefined): Uint8Array {
  const secret = runtimeConfig(platform).jwtSecret;
  if (!secret) {
    throw error(503, "JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(secret);
}

export async function readTokenAuth(
  request: Request,
  platform: App.Platform | undefined
): Promise<AuthContext> {
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) throw error(401, "Missing bearer token");

  let payload: JWTPayload;
  try {
    payload = (await jwtVerify(token, secretFor(platform))).payload;
  } catch {
    throw error(401, "Invalid or expired token");
  }
  if (!payload.sub) throw error(401, "Invalid token payload");

  return {
    agentId: payload.sub,
    email: typeof payload.email === "string" ? payload.email : "",
    name: typeof payload.name === "string" ? payload.name : "",
    role: payload.role === "ADMIN" ? "ADMIN" : "AGENT"
  };
}

export async function authenticate(event: RequestEvent): Promise<{ db: Database; auth: AuthContext }> {
  const auth = await readTokenAuth(event.request, event.platform);
  const db = createDatabase(event.platform);
  const agent = await db
    .prepare("SELECT id, active FROM Agent WHERE id = ? LIMIT 1")
    .bind(auth.agentId)
    .first<ActiveAgentRow>();
  if (!agent || !(agent.active === true || agent.active === 1)) {
    throw error(401, "Invalid or expired token");
  }

  return { db, auth };
}


export async function login(event: RequestEvent, email: string, password: string) {
  const db = createDatabase(event.platform);
  const agent = await db
    .prepare(
      "SELECT id, email, name, passwordHash, role, active, createdAt FROM Agent WHERE email = ? LIMIT 1"
    )
    .bind(email.toLowerCase())
    .first<AgentRow>();

  if (!agent || !(agent.active === true || agent.active === 1) || !(await bcrypt.compare(password, agent.passwordHash))) {
    throw error(401, "Email atau password salah");
  }

  const config = runtimeConfig(event.platform);
  const token = await new SignJWT({
    sub: agent.id,
    email: agent.email,
    name: agent.name,
    role: agent.role
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(config.jwtExpiresIn)
    .sign(secretFor(event.platform));

  return {
    token,
    agent: { id: agent.id, name: agent.name, email: agent.email, role: agent.role }
  };
}
