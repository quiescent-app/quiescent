import { ImagePlus, UserRound } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent, type RefObject } from "react";

import { Button } from "@/components/ui/button";

import { PROFILE_IMAGE_TYPES, type ProfileImageDraft } from "./profileImage";

interface ProfileImageFieldProps {
  chooseButtonRef: RefObject<HTMLButtonElement | null>;
  isEditing: boolean;
  isSaving: boolean;
  photo: ProfileImageDraft | null;
  savedImageUrl: string | null;
  removePhoto: boolean;
  photoError: string;
  imageLoadError: string;
  onSelect: (file: File) => void;
  onClear: () => void;
  onToggleRemoval: () => void;
  onInvalidPreview: () => void;
  onImageLoadError: () => void;
  onRetry: () => void;
}

export function ProfileImageField({
  chooseButtonRef,
  isEditing,
  isSaving,
  photo,
  savedImageUrl,
  removePhoto,
  photoError,
  imageLoadError,
  onSelect,
  onClear,
  onToggleRemoval,
  onInvalidPreview,
  onImageLoadError,
  onRetry,
}: ProfileImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) onSelect(file);
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
    if (!isSaving && file) onSelect(file);
  }

  return (
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
            onError={onInvalidPreview}
          />
        ) : savedImageUrl && !removePhoto && !imageLoadError ? (
          <img
            src={savedImageUrl}
            alt="Profile picture"
            className="size-full object-cover"
            onError={onImageLoadError}
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
        accept={PROFILE_IMAGE_TYPES.join(",")}
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
              onClear();
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
            onClick={onToggleRemoval}
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
            onClick={onRetry}
          >
            Retry loading
          </Button>
        </div>
      )}
    </div>
  );
}
