import { LoaderCircle, Pencil } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, type SubmitEvent } from "react";
import { useBlocker, useOutletContext } from "react-router-dom";

import { ApiError } from "@/api/apiClient";
import { useAuth } from "@/auth/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RegisterLogoutGuard } from "@/layout";
import { deleteProfileImage, uploadProfileImage } from "@/service/profileImage.service";
import type { AuthUser } from "@/types/auth";

import { ProfileImageField } from "../../components/custom/ProfileImageField";
import { initialProfileEditor, profileEditorReducer } from "./profileEditor";
import { useProfileAvatar } from "../../hooks/useProfileAvatar";

const PROFILE_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_PROFILE_IMAGE_BYTES = 10 * 1024 * 1024;
const DISPLAY_NAME_HINT =
  "Use 1–40 characters: letters, numbers, spaces, periods, underscores, or hyphens.";
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
  const localPreview = useRef<string | null>(null); // temporary preview URL for the profile image before it is uploaded.
  const [editor, dispatch] = useReducer(profileEditorReducer, initialProfileEditor);
  const {
    draftName,
    photo,
    removePhoto,
    photoError,
    nameError,
    saveError,
    isSaving
  } = editor;
  const status = editor.leaveBlocked ? "Saving your profile. Please wait." : editor.status;
  const avatar = useProfileAvatar();
  const registerLogoutGuard = useOutletContext<RegisterLogoutGuard | null>();

  const savedName = user.displayName ?? "";
  const isEditing = draftName !== null;
  const nameChanged = isEditing && draftName !== savedName;
  const imageChanged = photo !== null || removePhoto;
  const hasChanges = nameChanged || imageChanged;
  const previewUrl = photo?.previewUrl ?? avatar.localUrl;
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    isSaving || (hasChanges && currentLocation.pathname !== nextLocation.pathname),
  );

  // Determine if the user can leave the page without saving changes.
  const allowLeave = useCallback(() => {
    // If the user is currently saving changes, block leaving the page.
    if (isSaving) {
      dispatch({ type: "leaveBlocked" });
      return false;
    }

    // If there are unsaved changes, ask the user to confirm before leaving the page.
    return !hasChanges || window.confirm("Discard your unsaved profile changes?");
  }, [hasChanges, isSaving]);

  // Register the logout guard with the allowLeave function.
  // This ensures that the user is warned before leaving the page if there are unsaved changes.
  useLayoutEffect(() => registerLogoutGuard?.(allowLeave), [registerLogoutGuard, allowLeave]);

  // Handle navigation blocking within the application.
  useEffect(() => {
    if (blocker.state !== "blocked") return;
    if (allowLeave()) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [allowLeave, blocker]);

  // Handle navigation away from the page.
  useEffect(() => {
    if (!hasChanges && !isSaving) return;

    function warnBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = true;
    }

    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasChanges, isSaving]);

  // function to cleanup the temporary preview URL when it is no longer needed.
  const releasePreview = useCallback(() => {
    if (localPreview.current === null) return;
    URL.revokeObjectURL(localPreview.current);
    localPreview.current = null;
  }, []);

  // Automatically clean up the temporary preview URL when it changes or when the component unmounts.
  useEffect(() => {
    if (localPreview.current !== previewUrl) releasePreview();
  }, [previewUrl, releasePreview]);

  // Clean up the temporary preview URL when the component unmounts.
  useEffect(() => releasePreview, [releasePreview]);

  // Handle focus management when entering or exiting edit mode.
  useLayoutEffect(() => {
    if (isEditing) {
      const field = editFocus.current === "photo" ? chooseButtonRef : nameRef;
      field.current?.focus({ preventScroll: true });
    } else if (restoreEditFocus.current) {
      const button = editFocus.current === "photo" && !chooseButtonRef.current?.disabled
        ? chooseButtonRef : editButtonRef;
      button.current?.focus({ preventScroll: true });
      restoreEditFocus.current = false;
    }
  }, [isEditing]);

  function startEditing(focus: "name" | "photo") {
    if (isSaving) return;
    editFocus.current = focus;
    dispatch({ type: "startEdit", name: savedName });
  }

  function previewPhoto(file: File) {
    if (isSaving || avatar.localUrl) return;
    if (!isEditing) startEditing("photo");
    if (!PROFILE_IMAGE_TYPES.includes(file.type)) {
      dispatch({ type: "photoRejected", error: "Choose a JPEG, PNG, or WebP image." });
      return;
    }
    if (file.size === 0 || file.size > MAX_PROFILE_IMAGE_BYTES) {
      dispatch({ type: "photoRejected", error: "Choose a non-empty image no larger than 10 MiB." });
      return;
    }

    releasePreview();
    const url = URL.createObjectURL(file);
    localPreview.current = url;
    dispatch({ type: "selectPhoto", photo: { file, previewUrl: url } });
  }

  async function saveProfile(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!hasChanges || isSaving) return;

    const name = draftName?.normalize("NFC").trim() ?? "";

    // Validate the display name if it has changed.
    if (nameChanged) {
      const length = Array.from(name).length;
      if (length < 1 || length > 40 || !/^[\p{L}\p{N} ._-]+$/u.test(name)) {
        dispatch({ type: "nameRejected", error: DISPLAY_NAME_HINT });
        nameRef.current?.focus();
        return;
      }
    }

    const imageStatus = photo
      ? "Uploading profile picture…"
      : removePhoto
        ? "Removing profile picture…"
        : "";
    dispatch({ type: "saveStarted", status: nameChanged ? "Saving display name…" : imageStatus });
    let nameSaved = false;
    try {
      // Save the display name first if it has changed.
      if (nameChanged) {
        await updateProfile(name);
        dispatch({ type: "nameSaved", name });
        nameSaved = true;
      }

      if (nameSaved && imageChanged) dispatch({ type: "saveProgress", status: imageStatus });

      // Save or remove the profile picture
      if (photo) {
        await uploadProfileImage(photo.file);
        avatar.acceptUpload(photo.previewUrl);
      } else if (removePhoto) {
        await deleteProfileImage();
        avatar.remove();
      }

      restoreEditFocus.current = true;

      let success: string;
      if (nameSaved && imageChanged) {
        success = "Profile saved.";
      } else if (removePhoto) {
        success = "Profile picture removed.";
      } else if (photo) {
        success = "Profile picture saved.";
      } else {
        success = "Display name saved.";
      }
      dispatch({ type: "saveSucceeded", status: success });
    } catch (error) {
      const nameStageFinished = !nameChanged || nameSaved;
      const imageFailed = imageChanged && nameStageFinished;

      let errorMessage: string;

      if (error instanceof ApiError && [400, 413, 415].includes(error.status)) {
        errorMessage = error.message;
      } else if (imageFailed) {
        if (removePhoto) {
          errorMessage = "Could not remove your profile picture. Try again.";
        } else {
          errorMessage = "Could not save your profile picture. Try again.";
        }
      } else {
        errorMessage = "Could not save your display name. Try again.";
      }

      dispatch({
        type: "saveFailed",
        status: nameSaved ? "Display name saved." : "",
        error: errorMessage,
      });
    }
  }

  return (
    <div className="min-w-0 flex-1 bg-sidebar/25 px-4 pt-5 pb-14 sm:px-8 sm:pt-11">
      <div className="mx-auto w-full max-w-[44rem]">
        <header className="border-b border-sidebar-border pb-4 sm:pb-5">
          <h1 className="font-serif text-4xl leading-tight tracking-tight text-sidebar-foreground sm:text-[2.625rem]">
            Account
          </h1>
        </header>

        <section className="mt-5 sm:mt-6" aria-labelledby="profile-heading">
          <div className="overflow-hidden rounded-2xl border border-sidebar-border bg-card text-card-foreground">
            <div className="flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-sidebar-border bg-sidebar/65 px-4 py-2.5 sm:px-5">
              <h2 id="profile-heading" className="font-serif text-2xl leading-tight text-sidebar-foreground">
                {isEditing ? "Edit profile" : "Profile"}
              </h2>
              {!isEditing && (
                <Button
                  ref={editButtonRef}
                  type="button"
                  className="min-h-11 gap-2 bg-sidebar-primary px-3.5 text-sidebar-primary-foreground focus-visible:ring-sidebar-ring/60 hover:bg-sidebar-accent-foreground dark:hover:bg-sidebar-primary/80"
                  onClick={() => startEditing("name")}
                >
                  <Pencil aria-hidden="true" />
                  Edit profile
                </Button>
              )}
            </div>

            <form aria-busy={isSaving} onSubmit={saveProfile}>
              <div className="grid min-w-0 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
                <ProfileImageField
                  accept={PROFILE_IMAGE_TYPES.join(",")}
                  chooseButtonRef={chooseButtonRef}
                  isEditing={isEditing}
                  isSaving={isSaving}
                  photo={photo}
                  localImageUrl={avatar.localUrl}
                  remoteImageUrl={avatar.remoteUrl}
                  removePhoto={removePhoto}
                  photoError={photoError}
                  imageLoadError={avatar.error}
                  onSelect={previewPhoto}
                  onClear={() => dispatch({ type: "clearPhoto" })}
                  onToggleRemoval={() => dispatch({ type: "toggleRemoval" })}
                  onInvalidPreview={(previewUrl) => dispatch({ type: "invalidPreview", previewUrl })}
                  onImageLoaded={avatar.imageLoaded}
                  onImageLoadError={avatar.imageFailed}
                  onRetry={avatar.refresh}
                />

                <div className="flex min-w-0 items-center border-t border-sidebar-border px-4 py-3.5 sm:px-5 lg:border-t-0 lg:border-l">
                  {isEditing ? (
                    <div className="w-full max-w-md space-y-2">
                      <label htmlFor="display-name" className="block text-sm font-semibold">Display name</label>
                      <Input
                        ref={nameRef}
                        id="display-name"
                        autoComplete="nickname"
                        value={draftName}
                        disabled={isSaving}
                        aria-describedby={nameError ? "display-name-error" : "display-name-hint"}
                        aria-invalid={Boolean(nameError)}
                        className="min-h-11 border-sidebar-border bg-background focus-visible:border-sidebar-ring focus-visible:ring-sidebar-ring/40"
                        onChange={(event) => dispatch({ type: "changeName", name: event.currentTarget.value })}
                      />
                      {nameError ? (
                        <p id="display-name-error" role="alert" className="text-sm text-destructive">{nameError}</p>
                      ) : (
                        <p id="display-name-hint" className="text-sm text-muted-foreground">{DISPLAY_NAME_HINT}</p>
                      )}
                    </div>
                  ) : (
                    <dl className="min-w-0">
                      <dt className="text-sm font-medium text-muted-foreground">Display name</dt>
                      <dd className="mt-1 font-serif text-2xl leading-tight wrap-anywhere text-sidebar-foreground">
                        {user.displayName ?? "Not set"}
                      </dd>
                    </dl>
                  )}
                </div>
              </div>

              {isEditing && (
                <div className="flex flex-col gap-3 border-t border-sidebar-border bg-sidebar/35 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  {saveError && <p role="alert" className="min-w-0 text-sm text-destructive">{saveError}</p>}
                  <div className="ml-auto flex flex-wrap justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      className="min-h-11 px-4"
                      disabled={isSaving}
                      onClick={() => {
                        if (!allowLeave()) return;
                        restoreEditFocus.current = true;
                        dispatch({ type: "discard" });
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="min-h-11 bg-sidebar-primary px-4 text-sidebar-primary-foreground focus-visible:ring-sidebar-ring/60 hover:bg-sidebar-accent-foreground dark:hover:bg-sidebar-primary/80"
                      disabled={isSaving || !hasChanges}
                    >
                      {isSaving && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
                      {isSaving ? "Saving…" : "Save profile"}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>

          <p role="status" className={status ? "mt-3 text-sm font-medium text-sidebar-foreground" : "sr-only"}>
            {status}
          </p>
        </section>

        <section className="mt-7 sm:mt-8" aria-labelledby="account-details-heading">
          <h2 id="account-details-heading" className="font-serif text-2xl leading-tight text-sidebar-foreground">Account details</h2>
          <dl className="mt-4 grid grid-cols-1 gap-x-8 border-y border-sidebar-border text-sm sm:grid-cols-2">
            <div className="min-w-0 border-b border-sidebar-border py-3.5 sm:py-4">
              <dt className="font-medium text-muted-foreground">Email address</dt>
              <dd className="mt-1 wrap-anywhere text-card-foreground">{user.email}</dd>
            </div>
            <div className="min-w-0 border-b border-sidebar-border py-3.5 sm:py-4">
              <dt className="font-medium text-muted-foreground">Account ID</dt>
              <dd className="mt-1 wrap-anywhere text-card-foreground">{user.id}</dd>
            </div>
            <div className="border-b border-sidebar-border py-3.5 sm:border-b-0 sm:py-4">
              <dt className="font-medium text-muted-foreground">Created</dt>
              <dd className="mt-1 text-card-foreground"><time dateTime={user.createdAt}>{dateFormat.format(new Date(user.createdAt))}</time></dd>
            </div>
            <div className="py-3.5 sm:py-4">
              <dt className="font-medium text-muted-foreground">Last updated</dt>
              <dd className="mt-1 text-card-foreground"><time dateTime={user.updatedAt}>{dateFormat.format(new Date(user.updatedAt))}</time></dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
