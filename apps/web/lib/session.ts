"use client";

export type User = {
  userId: string;
  organizationId: string;
  email: string;
  fullName: string;
  role: "management" | "resident" | "prospect" | "broker" | "inssnapp_admin";
};

export async function fetchSession(): Promise<User | null> {
  try {
    const res = await fetch("/api/auth/me");
    if (!res.ok) return null;
    const data = await res.json();
    return data.user as User;
  } catch {
    return null;
  }
}
