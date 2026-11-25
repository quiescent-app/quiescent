export const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_PROFILE_IMAGE_BYTES = 10 * 1024 * 1024;

export interface ProfileImageDraft {
  file: File;
  previewUrl: string;
}
