import { useCallback, useEffect, useRef, useState } from "react";

import { getProfileImage } from "@/service/profileImage.service";

const imageLoadError = "Could not load your profile picture.";
const emptyAvatar = { localUrl: null, remoteUrl: null, error: "" };


 /* returns an object containing the profile avatar state and methods to manage it.
 * localUrl: The URL of the locally uploaded profile image preview.
 * remoteUrl: The URL of the profile image fetched from the server.
 * error: An error message if loading the profile image fails.
 */
export function useProfileAvatar() {
  const [avatar, setAvatar] = useState<{
    localUrl: string | null;
    remoteUrl: string | null;
    error: string;
  }>(emptyAvatar);
  const request = useRef<AbortController | null>(null);

  // Load the profile image
  const load = useCallback(() => {
    // Only the latest request can update the avatar, even if an older response still arrives.
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    void getProfileImage(controller.signal).then(
      (image) => {
        if (controller.signal.aborted) return;
        setAvatar((current) => ({
          ...current,
          remoteUrl: image?.url ?? null,
          // An empty response after an upload leaves the preview visible and enables retry.
          error: !image && current.localUrl ? imageLoadError : "",
        }));
      },
      () => {
        if (controller.signal.aborted) return;
        setAvatar((current) => ({ ...current, error: imageLoadError }));
      },
    );
  }, []);

  // Load the profile image on component mount.
  // And abort any pending request on component unmount.
  useEffect(() => {
    load();
    return () => request.current?.abort();
  }, [load]);

  function refresh() {
    // Clear the remote URL so the image element can retry fetching the image.
    setAvatar((current) => ({ ...current, remoteUrl: null, error: "" }));
    load();
  }

  // Accept a new profile image upload.
  // This will update the local preview and trigger a new remote fetch.
  function acceptUpload(localUrl: string) {
    setAvatar({ localUrl, remoteUrl: null, error: "" });
    load();
  }

  // Remove the profile image and abort any pending request.
  function remove() {
    request.current?.abort();
    setAvatar(emptyAvatar);
  }

  function imageLoaded(remoteUrl: string) {
    // Keep the local preview until the browser has loaded the current remote image.
    setAvatar((current) => current.remoteUrl === remoteUrl && current.localUrl
      ? { ...current, localUrl: null }
      : current);
  }

  function imageFailed(remoteUrl: string) {
    setAvatar((current) => current.remoteUrl === remoteUrl
      ? { ...current, error: imageLoadError }
      : current);
  }

  return { ...avatar, acceptUpload, remove, refresh, imageLoaded, imageFailed };
}
