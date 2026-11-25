import { LoaderCircle, Pencil } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useBlocker } from "react-router-dom";

import { ApiError } from "@/api/apiClient";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteProfileImage, getProfileImage, uploadProfileImage } from "@/service/profileImage.service";
import type { AuthUser } from "@/types/auth";

import { ProfileImageField } from "./ProfileImageField";
import { MAX_PROFILE_IMAGE_BYTES, PROFILE_IMAGE_TYPES, type ProfileImageDraft } from "./profileImage";

const DISPLAY_NAME_HINT =
  "Use 1–40 characters: letters, numbers, spaces, periods, underscores, or hyphens.";
const DISCARD_CHANGES = "Discard your unsaved profile changes?";
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "long" });

export default function AccountPage() {
  const { user, updateProfile } = useAuth();
  if (!user) return null;

  return <AccountProfile key={user.id} user={user} updateProfile={updateProfile} />;
}

function AccountProfile({ user, updateProfile }: {
  user: AuthUser;
  updateProfile: (displayName: string) => Promise<void>;
}) {
  const nameRef = useRef<HTMLInputElement>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const restoreEditFocus = useRef(false);
  const editFocus = useRef<"name" | "photo">("name");
  const chooseButtonRef = useRef<HTMLButtonElement>(null);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [photo, setPhoto] = useState<ProfileImageDraft | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [savedImageUrl, setSavedImageUrl] = useState<string | null>(null);
  const [imageVersion, setImageVersion] = useState(0);
  const [imageLoadError, setImageLoadError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [nameError, setNameError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const savedName = user.displayName ?? "";
  const isEditing = draftName !== null;
  const nameChanged = isEditing && draftName !== savedName;
  const imageChanged = photo !== null || removePhoto;
  const hasChanges = nameChanged || imageChanged;
  const previewUrl = photo?.previewUrl;
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    (hasChanges || isSaving) && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (!isSaving && window.confirm(DISCARD_CHANGES)) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, isSaving]);

  useEffect(() => {
    if (!hasChanges && !isSaving) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = true;
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasChanges, isSaving]);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    const controller = new AbortController();
    void getProfileImage(controller.signal).then(
      (image) => {
        if (!controller.signal.aborted) setSavedImageUrl(image?.url ?? null);
      },
      () => {
        if (!controller.signal.aborted) setImageLoadError("Could not load your profile picture.");
      },
    );
    return () => controller.abort();
  }, [imageVersion]);

  useLayoutEffect(() => {
    if (isEditing) {
      const field = editFocus.current === "photo" ? chooseButtonRef : nameRef;
      field.current?.focus({ preventScroll: true });
    } else if (restoreEditFocus.current) {
      const button = editFocus.current === "photo" ? chooseButtonRef : editButtonRef;
      button.current?.focus({ preventScroll: true });
      restoreEditFocus.current = false;
    }
  }, [isEditing]);

  function startEditing(focus: "name" | "photo") {
    editFocus.current = focus;
    setStatus("");
    setDraftName(savedName);
  }

  function finishEditing() {
    setDraftName(null);
    setPhoto(null);
    setRemovePhoto(false);
    setPhotoError("");
    setNameError("");
    setSaveError("");
    restoreEditFocus.current = true;
  }

  function previewPhoto(file: File) {
    if (!isEditing) startEditing("photo");
    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      setPhotoError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size === 0 || file.size > MAX_PROFILE_IMAGE_BYTES) {
      setPhotoError("Choose a non-empty image no larger than 10 MiB.");
      return;
    }

    setPhotoError("");
    setSaveError("");
    setStatus("");
    setRemovePhoto(false);
    setPhoto({ file, previewUrl: URL.createObjectURL(file) });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasChanges || isSaving) return;

    const name = draftName?.normalize("NFC").trim() ?? "";
    if (nameChanged) {
      const length = Array.from(name).length;
      if (length < 1 || length > 40 || !/^[\p{L}\p{N} ._-]+$/u.test(name)) {
        setNameError(DISPLAY_NAME_HINT);
        nameRef.current?.focus();
        return;
      }
    }

    setIsSaving(true);
    setSaveError("");
    let nameSaved = false;
    try {
      if (nameChanged) {
        setStatus("Saving display name…");
        await updateProfile(name);
        setDraftName(name);
        nameSaved = true;
      }
      if (photo) {
        setStatus("Uploading profile picture…");
        await uploadProfileImage(photo.file);
        setImageVersion((version) => version + 1);
      } else if (removePhoto) {
        setStatus("Removing profile picture…");
        await deleteProfileImage();
      }
      if (imageChanged) {
        setSavedImageUrl(null);
        setImageLoadError("");
      }

      finishEditing();
      if (nameSaved && imageChanged) setStatus("Profile saved.");
      else if (removePhoto) setStatus("Profile picture removed.");
      else setStatus(photo ? "Profile picture saved." : "Display name saved.");
    } catch (error) {
      const imageFailed = imageChanged && (!nameChanged || nameSaved);
      const imageError = removePhoto
        ? "Could not remove your profile picture. Try again."
        : "Could not save your profile picture. Try again.";
      setStatus(nameSaved ? "Display name saved." : "");
      setSaveError(
        error instanceof ApiError && [400, 413, 415].includes(error.status)
          ? error.message
          : imageFailed ? imageError : "Could not save your display name. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-5 pt-5 pb-12 sm:px-10 sm:pt-12">
      <h1 className="text-balance font-serif text-3xl text-sidebar-foreground sm:text-4xl">Account</h1>

      <section className="mt-7 sm:mt-9" aria-labelledby="profile-heading">
        <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
          <h2 id="profile-heading" className="text-base font-semibold">Profile</h2>
          {!isEditing && (
            <Button
              ref={editButtonRef}
              type="button"
              variant="outline"
              className="min-h-11 px-3.5"
              onClick={() => startEditing("name")}
            >
              <Pencil aria-hidden="true" />
              Edit profile
            </Button>
          )}
        </div>

        <form
          className="overflow-hidden rounded-2xl border border-sidebar-border"
          aria-busy={isSaving}
          onSubmit={saveProfile}
        >
          <ProfileImageField
            chooseButtonRef={chooseButtonRef}
            isEditing={isEditing}
            isSaving={isSaving}
            photo={photo}
            savedImageUrl={savedImageUrl}
            removePhoto={removePhoto}
            photoError={photoError}
            imageLoadError={imageLoadError}
            onSelect={previewPhoto}
            onClear={() => {
              setPhoto(null);
              setPhotoError("");
              setSaveError("");
            }}
            onToggleRemoval={() => {
              setRemovePhoto(!removePhoto);
              setPhotoError("");
              setSaveError("");
              setStatus("");
            }}
            onInvalidPreview={() => {
              setPhoto(null);
              setPhotoError("This image could not be opened. Choose another image.");
            }}
            onImageLoadError={() => setImageLoadError("Could not load your profile picture.")}
            onRetry={() => {
              setSavedImageUrl(null);
              setImageLoadError("");
              setImageVersion((version) => version + 1);
            }}
          />

          <div className="border-t border-sidebar-border px-4 py-4 sm:px-6 sm:py-5">
            {isEditing ? (
              <div className="max-w-lg space-y-2">
                <label htmlFor="display-name" className="block text-sm font-semibold">Display name</label>
                <Input
                  ref={nameRef}
                  id="display-name"
                  autoComplete="nickname"
                  value={draftName}
                  disabled={isSaving}
                  aria-describedby={nameError ? "display-name-error" : "display-name-hint"}
                  aria-invalid={Boolean(nameError)}
                  className="min-h-11"
                  onChange={(event) => {
                    setDraftName(event.currentTarget.value);
                    setNameError("");
                    setSaveError("");
                    setStatus("");
                  }}
                />
                {nameError ? (
                  <p id="display-name-error" role="alert" className="text-sm text-destructive">{nameError}</p>
                ) : (
                  <p id="display-name-hint" className="text-sm text-muted-foreground">{DISPLAY_NAME_HINT}</p>
                )}
              </div>
            ) : (
              <dl className="min-w-0">
                <dt className="text-sm text-muted-foreground">Display name</dt>
                <dd className="mt-1 text-base font-medium wrap-anywhere">{user.displayName ?? "Not set"}</dd>
              </dl>
            )}
          </div>

          {isEditing && (
            <div className="flex flex-col gap-3 border-t border-sidebar-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              {saveError && <p role="alert" className="min-w-0 text-sm text-destructive">{saveError}</p>}
              <div className="ml-auto flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 px-4"
                  disabled={isSaving}
                  onClick={() => {
                    if (hasChanges && !window.confirm(DISCARD_CHANGES)) return;
                    finishEditing();
                    setStatus("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="min-h-11 bg-sidebar-primary px-4 text-sidebar-primary-foreground hover:bg-sidebar-accent-foreground"
                  disabled={isSaving || !hasChanges}
                >
                  {isSaving && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
                  {isSaving ? "Saving…" : "Save profile"}
                </Button>
              </div>
            </div>
          )}
        </form>

        <p role="status" className={status ? "mt-3 text-sm text-sidebar-foreground" : "sr-only"}>
          {status}
        </p>
      </section>

      <section className="mt-8 border-t border-sidebar-border pt-5 sm:mt-10" aria-labelledby="account-details-heading">
        <h2 id="account-details-heading" className="text-base font-semibold">Account details</h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2 sm:gap-x-8">
          <div className="min-w-0">
            <dt className="text-muted-foreground">Email address</dt>
            <dd className="mt-1 wrap-anywhere">{user.email}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-muted-foreground">Account ID</dt>
            <dd className="mt-1 wrap-anywhere">{user.id}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Created</dt>
            <dd className="mt-1"><time dateTime={user.createdAt}>{dateFormat.format(new Date(user.createdAt))}</time></dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Last updated</dt>
            <dd className="mt-1"><time dateTime={user.updatedAt}>{dateFormat.format(new Date(user.updatedAt))}</time></dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
