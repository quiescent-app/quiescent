import { UserRound } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useBlocker } from "react-router-dom";

import { ApiError } from "@/api/apiClient";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AuthUser } from "@/types/auth";

const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
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
  const inputRef = useRef<HTMLInputElement>(null);
  const chooseButtonRef = useRef<HTMLButtonElement>(null);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [nameError, setNameError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [status, setStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const savedName = user.displayName ?? "";
  const isEditing = draftName !== null;
  const nameChanged = isEditing && draftName !== savedName;
  const hasChanges = nameChanged || photo !== null;
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

  useLayoutEffect(() => {
    if (isEditing) {
      nameRef.current?.focus();
    } else if (restoreEditFocus.current) {
      editButtonRef.current?.focus();
      restoreEditFocus.current = false;
    }
  }, [isEditing]);

  function finishEditing() {
    setDraftName(null);
    setPhoto(null);
    setPhotoError("");
    setNameError("");
    setSaveError("");
    restoreEditFocus.current = true;
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    if (!PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Choose a non-empty image no larger than 10 MiB.");
      return;
    }

    setPhotoError("");
    setPhoto({ file, previewUrl: URL.createObjectURL(file) });
  }

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nameChanged || isSaving) return;

    const name = draftName.normalize("NFC").trim();
    const length = Array.from(name).length;
    if (length < 1 || length > 40 || !/^[\p{L}\p{N} ._-]+$/u.test(name)) {
      setNameError(DISPLAY_NAME_HINT);
      nameRef.current?.focus();
      return;
    }

    setIsSaving(true);
    setSaveError("");
    setStatus("Saving display name…");
    try {
      await updateProfile(name);
      if (photo) {
        setDraftName(name);
      } else {
        finishEditing();
      }
      setStatus("Display name saved.");
    } catch (error) {
      setStatus("");
      setSaveError(
        error instanceof ApiError && error.status === 400
          ? error.message
          : "Could not save your display name. Try again.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl px-5 py-8 sm:px-10 sm:py-12">
      <h1 className="text-balance font-serif text-3xl text-sidebar-foreground">Account</h1>

      <section className="mt-8 border-t border-sidebar-border py-6" aria-labelledby="profile-heading">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="profile-heading" className="text-base font-semibold">Profile</h2>
          <Button
            ref={editButtonRef}
            type="button"
            variant="outline"
            aria-expanded={isEditing}
            className="min-h-11 px-4"
            onClick={() => {
              setStatus("");
              setDraftName(savedName);
            }}
            hidden={isEditing}
          >
            Edit profile
          </Button>
        </div>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground">
            {photo ? (
              <img
                key={photo.previewUrl}
                src={photo.previewUrl}
                alt="Selected profile picture preview"
                className="size-full object-cover"
                onError={() => {
                  setPhoto(null);
                  setPhotoError("This image could not be opened. Choose another image.");
                }}
              />
            ) : (
              <UserRound role="img" aria-label="No profile picture" className="size-9" strokeWidth={1.5} />
            )}
          </div>

          {isEditing ? (
            <form className="w-full min-w-0 space-y-5" onSubmit={saveName}>
              <div className="space-y-2">
                <label htmlFor="display-name" className="block text-sm font-medium">Display name</label>
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

              <div className="space-y-2" role="group" aria-labelledby="profile-photo-label">
                <p id="profile-photo-label" className="text-sm font-medium">Profile picture</p>
                <p id="profile-photo-formats" className="text-sm text-muted-foreground">
                  Preview a JPEG, PNG, or WebP image up to 10 MiB. Photo saving is unavailable.
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  aria-label="Profile picture file"
                  accept={PHOTO_TYPES.join(",")}
                  hidden
                  disabled={isSaving}
                  onChange={selectPhoto}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    ref={chooseButtonRef}
                    type="button"
                    variant="outline"
                    className="min-h-11 px-4"
                    disabled={isSaving}
                    aria-describedby="profile-photo-formats"
                    onClick={() => inputRef.current?.click()}
                  >
                    {photo ? "Choose another photo" : "Choose photo"}
                  </Button>
                  {photo && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 px-4"
                      disabled={isSaving}
                      onClick={() => {
                        setPhoto(null);
                        setPhotoError("");
                        chooseButtonRef.current?.focus();
                      }}
                    >
                      Clear selection
                    </Button>
                  )}
                </div>
                <div role="status" className="text-sm wrap-anywhere">
                  {photo && <>Selected: {photo.file.name}</>}
                </div>
                {photoError && <p role="alert" className="text-sm text-destructive">{photoError}</p>}
              </div>

              {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  className="min-h-11 bg-sidebar-primary px-4 text-sidebar-primary-foreground hover:bg-sidebar-accent-foreground"
                  disabled={isSaving || !nameChanged}
                >
                  {isSaving ? "Saving…" : "Save display name"}
                </Button>
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
              </div>
            </form>
          ) : (
            <dl className="min-w-0 self-start sm:pt-4">
              <dt className="text-sm text-muted-foreground">Display name</dt>
              <dd className="mt-1 text-lg font-medium wrap-anywhere">{user.displayName ?? "Not set"}</dd>
            </dl>
          )}
        </div>

        <p role="status" className={status ? "mt-4 text-sm text-sidebar-foreground" : "sr-only"}>
          {status}
        </p>
      </section>

      <section className="border-t border-sidebar-border py-6" aria-labelledby="account-details-heading">
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
