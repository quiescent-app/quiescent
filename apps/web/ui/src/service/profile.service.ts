import { apiRequest } from "@/api/apiClient";
import type { AuthUser } from "@/types/auth";

export function updateProfile(displayName: string): Promise<AuthUser> {
  return apiRequest<AuthUser>("users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
}
