export interface Agent {
  id: string;
  name: string;
  email: string;
  role: "AGENT" | "ADMIN";
}

export interface LoginResponse {
  token: string;
  agent: Agent;
}

export interface Ticket {
  id: string;
  code: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  source?: "MANUAL" | "TELEGRAM";
  createdAt: string;
  firstResponseAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  slaFirstResponseDueAt?: string | null;
  slaResolutionDueAt?: string | null;
  slaFirstResponseBreached?: boolean;
  slaResolutionBreached?: boolean;
  rating?: number | null;
  ratingComment?: string | null;
  category: { id: string; name: string };
  user: { id: string; name: string; department: string | null };
  agent: { id: string; name: string; email: string } | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  department: string | null;
  joinCode: string | null;
  telegramChatId: string | null;
  createdAt: string;
  _count: { tickets: number };
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function getToken(): string | null {
  return typeof localStorage === "undefined" ? null : localStorage.getItem("ticket_token");
}

export function setToken(token: string | null): void {
  if (typeof localStorage === "undefined") return;
  if (token) localStorage.setItem("ticket_token", token);
  else localStorage.removeItem("ticket_token");
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`/api${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (typeof body?.error === "string") message = body.error;
    } catch {
      // Keep the status-based fallback message.
    }
    if (response.status === 401) setToken(null);
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
