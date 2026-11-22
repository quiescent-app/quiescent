import { ImagePlus, LoaderCircle, Pencil, UserRound } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { useBlocker } from "react-router-dom";

import { ApiError } from "@/api/apiClient";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteProfileImage, getProfileImage, uploadProfileImage } from "@/service/profile.service";
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
  const editFocus = useRef<"name" | "photo">("name");
  const inputRef = useRef<HTMLInputElement>(null);
  const chooseButtonRef = useRef<HTMLButtonElement>(null);
  const [draftName, setDraftName] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
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

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) previewPhoto(file);
  }

  function previewPhoto(file: File) {
    if (!isEditing) startEditing("photo");
    if (!PHOTO_TYPES.includes(file.type)) {
      setPhotoError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size === 0 || file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Choose a non-empty image no larger than 10 MiB.");
      return;
    }

    setPhotoError("");
    setSaveError("");
    setStatus("");
    setRemovePhoto(false);
    setPhoto({ file, previewUrl: URL.createObjectURL(file) });
  }

  function handlePhotoDrag(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = isSaving ? "none" : "copy";
    if (!isSaving) setIsDraggingPhoto(true);
  }

  function dropPhoto(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setIsDraggingPhoto(false);
    const file = event.dataTransfer.files[0];
    if (!isSaving && file) previewPhoto(file);
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
          <div
            role="group"
            aria-labelledby="profile-photo-label"
            className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-4 py-4 motion-safe:transition-colors sm:gap-x-5 sm:px-6 sm:py-5 ${
              isDraggingPhoto ? "bg-sidebar-accent ring-2 ring-inset ring-sidebar-ring" : "bg-sidebar/55"
            }`}
            onDragOver={handlePhotoDrag}
            onDragLeave={(event) => {
              if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
                setIsDraggingPhoto(false);
              }
            }}
            onDrop={dropPhoto}
          >
            <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-full border border-sidebar-border bg-sidebar-accent text-sidebar-foreground sm:row-span-2 sm:size-20">
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
              ) : savedImageUrl && !removePhoto && !imageLoadError ? (
                <img
                  src={savedImageUrl}
                  alt="Profile picture"
                  className="size-full object-cover"
                  onError={() => setImageLoadError("Could not load your profile picture.")}
                />
              ) : (
                <UserRound role="img" aria-label="No profile picture" className="size-7 sm:size-8" strokeWidth={1.5} />
              )}
            </div>

            <div className="min-w-0">
              <p id="profile-photo-label" className="text-sm font-semibold text-sidebar-foreground">
                Profile picture
              </p>
              <p id="profile-photo-formats" className="mt-1 text-sm text-sidebar-foreground/80">
                {isDraggingPhoto ? "Drop your image here." : (
                  <>
                    <span className="hidden sm:inline">Drag and drop or choose a file. </span>
                    JPEG, PNG or WebP up to 10 MiB.
                  </>
                )}
              </p>
            </div>

            <input
              ref={inputRef}
              type="file"
              aria-label="Profile picture file"
              accept={PHOTO_TYPES.join(",")}
              hidden
              disabled={isSaving}
              onChange={selectPhoto}
            />
            <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 sm:col-span-1 sm:col-start-2">
              <Button
                ref={chooseButtonRef}
                type="button"
                variant="outline"
                className="min-h-11 px-3.5"
                disabled={isSaving}
                aria-describedby="profile-photo-formats"
                onClick={() => inputRef.current?.click()}
              >
                <ImagePlus aria-hidden="true" />
                {photo ? "Choose another" : savedImageUrl && !removePhoto ? "Change picture" : "Choose picture"}
              </Button>
              {isEditing && photo && (
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11 px-3"
                  disabled={isSaving}
                  onClick={() => {
                    setPhoto(null);
                    setPhotoError("");
                    setSaveError("");
                    chooseButtonRef.current?.focus();
                  }}
                >
                  Clear selection
                </Button>
              )}
              {isEditing && savedImageUrl && !photo && (
                <Button
                  type="button"
                  variant={removePhoto ? "outline" : "ghost"}
                  className={`min-h-11 px-3 ${removePhoto ? "" : "text-destructive hover:text-destructive"}`}
                  disabled={isSaving}
                  onClick={() => {
                    setRemovePhoto(!removePhoto);
                    setPhotoError("");
                    setSaveError("");
                    setStatus("");
                  }}
                >
                  {removePhoto ? "Undo removal" : "Remove profile picture"}
                </Button>
              )}
            </div>

            <div role="status" className="col-span-2 -mt-1 text-sm wrap-anywhere text-sidebar-foreground empty:sr-only sm:col-span-1 sm:col-start-2">
              {photo && <>Selected: {photo.file.name}</>}
              {removePhoto && "Your profile picture will be removed when you save."}
            </div>
            {photoError && (
              <p role="alert" className="col-span-2 text-sm text-destructive sm:col-span-1 sm:col-start-2">{photoError}</p>
            )}
            {imageLoadError && !photo && !removePhoto && (
              <div className="col-span-2 flex flex-wrap items-center gap-x-3 sm:col-span-1 sm:col-start-2">
                <p role="alert" className="text-sm text-destructive">{imageLoadError}</p>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  disabled={isSaving}
                  onClick={() => {
                    setSavedImageUrl(null);
                    setImageLoadError("");
                    setImageVersion((version) => version + 1);
                  }}
                >
                  Retry loading
                </Button>
              </div>
            )}
          </div>

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
