import { apiRequest } from "@/api/apiClient";
import type { AuthUser } from "@/types/auth";

export function updateProfile(displayName: string): Promise<AuthUser> {
  return apiRequest<AuthUser>("users/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
}

const profileImagePath = "users/me/profile-image";

interface ProfileImageUpload {
  id: string;
  uploadToken: string;
  target: {
    url: string;
    fields: Record<string, string>;
  };
}

export async function getProfileImage(signal?: AbortSignal): Promise<{ url: string } | null> {
  const { image } = await apiRequest<{ image: { url: string } | null }>(profileImagePath, { signal });
  return image;
}

export async function uploadProfileImage(file: File): Promise<void> {
  const { id, uploadToken, target } = await apiRequest<ProfileImageUpload>(`${profileImagePath}/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
  });

  const form = new FormData();
  for (const [name, value] of Object.entries(target.fields)) {
    form.append(name, value);
  }
  form.append("file", file);

  const response = await fetch(target.url, { method: "POST", body: form, credentials: "omit" });
  if (!response.ok) throw new Error("Profile picture upload failed");

  await apiRequest(`${profileImagePath}/uploads/${encodeURIComponent(id)}/complete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uploadToken }),
  });
}

export function deleteProfileImage(): Promise<void> {
  return apiRequest<void>(profileImagePath, { method: "DELETE" });
}
