import { apiRequest } from "@/api/apiClient";

const profileImagePath = "users/me/profile-image";

interface ProfileImageUpload {
  id: string;
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
  // Request an upload URL from the server
  const { id, target } = await apiRequest<ProfileImageUpload>(`${profileImagePath}/uploads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
  });

  // Prepare the form data for the upload to S3
  const form = new FormData();
  for (const [name, value] of Object.entries(target.fields)) {
    form.append(name, value);
  }
  form.append("file", file);

  // Send the form data to the S3 upload URL
  const response = await fetch(target.url, { method: "POST", body: form, credentials: "omit" });
  if (!response.ok) throw new Error("Profile picture upload failed");

  // Notify the server that the upload is complete
  await apiRequest(`${profileImagePath}/uploads/${id}/complete`, {
    method: "POST",
  });
}

export function deleteProfileImage(): Promise<void> {
  return apiRequest<void>(profileImagePath, { method: "DELETE" });
}
