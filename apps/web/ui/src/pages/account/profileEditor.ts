import type { ProfileImageDraft } from "../../components/custom/ProfileImageField";

type ProfileEditor = {
  draftName: string | null;
  photo: ProfileImageDraft | null;
  removePhoto: boolean;
  photoError: string;
  nameError: string;
  saveError: string;
  status: string;
  isSaving: boolean;
  leaveBlocked: boolean;
};

export const initialProfileEditor: ProfileEditor = {
  draftName: null,
  photo: null,
  removePhoto: false,
  photoError: "",
  nameError: "",
  saveError: "",
  status: "",
  isSaving: false,
  leaveBlocked: false,
};

type ProfileEditorAction =
  | { type: "startEdit" | "changeName" | "nameSaved"; name: string }
  | { type: "selectPhoto"; photo: ProfileImageDraft }
  | { type: "photoRejected" | "nameRejected"; error: string }
  | { type: "invalidPreview"; previewUrl: string }
  | { type: "clearPhoto" | "toggleRemoval" | "leaveBlocked" | "discard" }
  | { type: "saveStarted" | "saveProgress" | "saveSucceeded"; status: string }
  | { type: "saveFailed"; status: string; error: string };

export function profileEditorReducer(state: ProfileEditor, action: ProfileEditorAction): ProfileEditor {
  switch (action.type) {
    case "startEdit":
      return { ...initialProfileEditor, draftName: action.name };
    case "changeName":
      return { ...state, draftName: action.name, nameError: "", saveError: "", status: "" };
    case "selectPhoto":
      return { ...state, photo: action.photo, removePhoto: false, photoError: "", saveError: "", status: "" };
    case "photoRejected":
      return { ...state, photoError: action.error };
    case "nameRejected":
      return { ...state, nameError: action.error };
    case "invalidPreview":
      if (state.isSaving || state.photo?.previewUrl !== action.previewUrl) return state;
      return { ...state, photo: null, photoError: "This image could not be opened. Choose another image." };
    case "clearPhoto":
      return { ...state, photo: null, photoError: "", saveError: "" };
    case "toggleRemoval":
      return { ...state, removePhoto: !state.removePhoto, photoError: "", saveError: "", status: "" };
    case "saveStarted":
      return { ...state, isSaving: true, saveError: "", status: action.status, leaveBlocked: false };
    case "saveProgress":
      return { ...state, status: action.status };
    case "nameSaved":
      return { ...state, draftName: action.name };
    case "leaveBlocked":
      return { ...state, leaveBlocked: true };
    case "saveSucceeded":
      return { ...initialProfileEditor, status: action.status };
    case "saveFailed":
      return { ...state, isSaving: false, leaveBlocked: false, status: action.status, saveError: action.error };
    case "discard":
      return initialProfileEditor;
  }
}
