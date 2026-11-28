import { ImagePlus, UserRound } from "lucide-react";
import { useRef, useState, type ChangeEvent, type DragEvent, type RefObject } from "react";

import { Button } from "@/components/ui/button";

export interface ProfileImageDraft {
  file: File;
  previewUrl: string;
}

interface ProfileImageFieldProps {
  accept: string;
  chooseButtonRef: RefObject<HTMLButtonElement | null>;
  isEditing: boolean;
  isSaving: boolean;
  photo: ProfileImageDraft | null;
  localImageUrl: string | null;
  remoteImageUrl: string | null;
  removePhoto: boolean;
  photoError: string;
  imageLoadError: string;
  onSelect: (file: File) => void;
  onClear: () => void;
  onToggleRemoval: () => void;
  onInvalidPreview: (previewUrl: string) => void;
  onImageLoaded: (remoteUrl: string) => void;
  onImageLoadError: (remoteUrl: string) => void;
  onRetry: () => void;
}

export function ProfileImageField({
  accept,
  chooseButtonRef,
  isEditing,
  isSaving,
  photo,
  localImageUrl,
  remoteImageUrl,
  removePhoto,
  photoError, // Error message if the photo selection or preview fails, like invalid file type or size
  imageLoadError, // Error message if the remote image fails to load
  onSelect,
  onClear,
  onToggleRemoval,
  onInvalidPreview,
  onImageLoaded,
  onImageLoadError,
  onRetry,
}: ProfileImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);
  const hasSavedImage = Boolean(localImageUrl || remoteImageUrl);
  const canChoosePhoto = !isSaving && !localImageUrl;
  const visibleLocalImage = removePhoto ? null : photo?.previewUrl ?? localImageUrl;
  const loadableRemoteImage = imageLoadError ? null : remoteImageUrl;

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (canChoosePhoto && file) onSelect(file);
  }

  function handlePhotoDrag(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = canChoosePhoto ? "copy" : "none";
    setIsDraggingPhoto(canChoosePhoto);
  }

  function dropPhoto(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    setIsDraggingPhoto(false);
    const file = event.dataTransfer.files[0];
    if (canChoosePhoto && file) onSelect(file);
  }

  return (
    <div
      role="group"
      aria-labelledby="profile-photo-label"
      className={`grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2.5 px-4 py-3.5 motion-safe:transition-colors sm:px-5 ${
        isDraggingPhoto ? "bg-sidebar-accent ring-2 ring-inset ring-sidebar-ring" : "bg-sidebar/30"
      }`}
      onDragOver={handlePhotoDrag}
      onDragLeave={(event) => {
        if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
          setIsDraggingPhoto(false);
        }
      }}
      onDrop={dropPhoto}
    >
      <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-full border border-sidebar-border bg-sidebar-accent text-sidebar-foreground min-[360px]:row-span-2 sm:size-16">
        {visibleLocalImage && (
          <img
            key={visibleLocalImage}
            src={visibleLocalImage}
            alt={photo ? "Selected profile picture preview" : "Profile picture"}
            className="size-full object-cover"
            onError={photo ? () => onInvalidPreview(photo.previewUrl) : undefined}
          />
        )}
        {loadableRemoteImage && (
          <img
            key={loadableRemoteImage}
            src={loadableRemoteImage}
            alt={visibleLocalImage || removePhoto ? "" : "Profile picture"}
            className="size-full object-cover"
            hidden={Boolean(visibleLocalImage) || removePhoto}
            onLoad={() => onImageLoaded(loadableRemoteImage)}
            onError={() => onImageLoadError(loadableRemoteImage)}
          />
        )}
        {(removePhoto || (!visibleLocalImage && !loadableRemoteImage)) && (
          <UserRound role="img" aria-label="No profile picture" className="size-7" strokeWidth={1.5} />
        )}
      </div>

      <div className="min-w-0">
        <p id="profile-photo-label" className="text-sm font-semibold text-sidebar-foreground">
          Profile picture
        </p>
        <p id="profile-photo-formats" className="mt-1 text-sm leading-snug text-sidebar-foreground/85">
          {isDraggingPhoto ? "Drop your image here." : "JPEG, PNG or WebP up to 10 MiB."}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        aria-label="Profile picture file"
        accept={accept}
        hidden
        disabled={!canChoosePhoto}
        onChange={selectPhoto}
      />
      <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-2 min-[360px]:col-span-1 min-[360px]:col-start-2">
        <Button
          ref={chooseButtonRef}
          type="button"
          variant="outline"
          className="min-h-11 gap-2 border-sidebar-border px-3.5 text-sidebar-foreground focus-visible:ring-sidebar-ring/60 hover:bg-sidebar-accent"
          disabled={!canChoosePhoto}
          aria-describedby="profile-photo-formats"
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus aria-hidden="true" />
          {photo ? "Choose another" : hasSavedImage && !removePhoto ? "Change picture" : "Choose picture"}
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
        {isEditing && hasSavedImage && !photo && (
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
        {localImageUrl && !removePhoto && !imageLoadError && "Your saved picture is loading. You can choose another once it loads."}
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
