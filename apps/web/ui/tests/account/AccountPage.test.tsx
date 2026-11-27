import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import routes from "../../src/App";
import { AuthContext } from "../../src/auth/AuthContext";
import AuthProvider from "../../src/auth/AuthProvider";
import { setAccessToken } from "../../src/auth/tokenStore";
import { TooltipProvider } from "../../src/components/ui/tooltip";
import { useIsMobile } from "../../src/hooks/use-mobile";
import AccountPage from "../../src/pages/account/AccountPage";

vi.mock("../../src/hooks/use-mobile", () => ({ useIsMobile: vi.fn(() => false) }));

const uploadUrl = "https://s3.example.com/upload";
const savedImageUrl = "https://s3.example.com/current-image";
const replacementImageUrl = "https://s3.example.com/replacement-image";
const originalUser = {
  id: "profile-user",
  email: "reader@example.com",
  displayName: "Reader",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const updateName = vi.fn<(displayName: string) => Promise<void>>();
const fetchMock = vi.fn<typeof fetch>();
const createObjectURL = vi.fn<(file: Blob) => string>();
const revokeObjectURL = vi.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => { resolve = settle; });
  return { promise, resolve };
}

function AccountSession({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(originalUser);
  return (
    <AuthContext.Provider value={{
      user,
      status: "authenticated",
      login: vi.fn(),
      signUp: vi.fn(),
      logout: vi.fn(),
      async updateProfile(displayName) {
        await updateName(displayName);
        setUser((current) => ({ ...current, displayName }));
      },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

async function openAccountRoute(initialEntries = ["/account"]) {
  const router = createMemoryRouter(routes, { initialEntries });
  render(
    <AuthProvider>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </AuthProvider>,
  );
  await screen.findByRole("heading", { name: "Account", level: 1 });
  return router;
}

function AccountRoute() {
  return <AccountSession><AccountPage /></AccountSession>;
}

function openEditor() {
  const router = createMemoryRouter([{ path: "/", element: <AccountRoute /> }]);
  render(<RouterProvider router={router} />);
  fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
  return screen.getByRole("button", { name: "Save profile" });
}

function choosePhoto() {
  const photo = new File(["test image"], "photo.png", { type: "image/png" });
  fireEvent.change(screen.getByLabelText("Profile picture file"), { target: { files: [photo] } });
  return photo;
}

async function getRemoteImage(url: string) {
  return waitFor(() => {
    const image = document.querySelector(`img[src="${url}"]`);
    if (!image) throw new Error(`Image element missing for ${url}`);
    return image;
  });
}

describe("Account profile saving", () => {
  let completed: boolean;
  let uploadFails: boolean;
  let deleteFails: boolean;
  let rejectSession: boolean;
  let nextImageResponse: Promise<Response> | undefined;
  let pendingUpload: Promise<Response> | undefined;

  beforeEach(() => {
    vi.mocked(useIsMobile).mockReturnValue(false);
    completed = false;
    uploadFails = false;
    deleteFails = false;
    rejectSession = false;
    nextImageResponse = undefined;
    pendingUpload = undefined;
    let previewCount = 0;
    createObjectURL.mockReset().mockImplementation(() =>
      ++previewCount === 1 ? "blob:photo-preview" : `blob:photo-preview-${previewCount}`,
    );
    revokeObjectURL.mockClear();
    updateName.mockReset().mockResolvedValue(undefined);
    setAccessToken("account-access-token");
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    });
    vi.stubGlobal("fetch", fetchMock.mockReset().mockImplementation(async (input, init) => {
      if (input === uploadUrl) return pendingUpload ?? new Response(null, { status: uploadFails ? 503 : 204 });

      const path = new URL(String(input)).pathname;
      if (path.endsWith("/auth/refresh") && rejectSession) return new Response(null, { status: 401 });
      if (path.endsWith("/auth/refresh") || path.endsWith("/auth/login")) {
        return Response.json({ user: originalUser, accessToken: "account-access-token" });
      }
      if (path.endsWith("/auth/logout")) return new Response(null, { status: 204 });
      if (path.endsWith("/profile-image/uploads")) {
        if (rejectSession) return new Response(null, { status: 401 });
        return Response.json({
          id: "upload-id",
          target: {
            url: uploadUrl,
            fields: { key: "pending/id", policy: "signed-policy", "x-amz-meta-declared-size": "10" },
          },
        }, { status: 201 });
      }
      if (path.endsWith("/profile-image/uploads/upload-id/complete")) {
        completed = true;
        return Response.json({ id: "upload-id" });
      }
      if (path.endsWith("/profile-image")) {
        if (init?.method === "DELETE") {
          if (deleteFails) return new Response(null, { status: 503 });
          completed = false;
          return new Response(null, { status: 204 });
        }
        if (nextImageResponse) {
          const response = nextImageResponse;
          nextImageResponse = undefined;
          return response;
        }
        return Response.json({ image: completed ? { url: savedImageUrl } : null });
      }
      throw new Error(`Unexpected request to ${path}`);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    setAccessToken(null);
  });

  it("guards an unsaved photo when navigating away from the Account route", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const router = createMemoryRouter(routes, { initialEntries: ["/account"] });
    render(
      <AccountSession>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </AccountSession>,
    );
    await screen.findByRole("heading", { name: "Account", level: 1 });
    choosePhoto();
    const library = screen.getByRole("link", { name: "Library" });

    fireEvent.click(library);
    expect(confirm).toHaveBeenCalledOnce();
    expect(router.state.location.pathname).toBe("/account");
    expect(screen.getByAltText("Selected profile picture preview")).toBeInTheDocument();

    fireEvent.click(library);
    await waitFor(() => expect(router.state.location.pathname).toBe("/library"));
    expect(screen.queryByAltText("Selected profile picture preview")).not.toBeInTheDocument();
  });

  it("keeps the draft on canceled logout and calls logout only after confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const router = await openAccountRoute();
    choosePhoto();
    const logout = screen.getByRole("button", { name: "Log out" });

    fireEvent.click(logout);
    expect(confirm).toHaveBeenCalledWith("Discard your unsaved profile changes?");
    expect(router.state.location.pathname).toBe("/account");
    expect(screen.getByAltText("Selected profile picture preview")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/auth/logout"))).toBe(false);

    fireEvent.click(logout);
    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/auth/logout"))).toHaveLength(1);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:photo-preview");
  });

  it("logs out from a clean editor without confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm");
    await openAccountRoute();
    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each(["Library", "Back", "Log out"])("blocks %s during a pending save and shows the wait message", async (attempt) => {
    const confirm = vi.spyOn(window, "confirm");
    const router = await openAccountRoute(["/library", "/account"]);
    const upload = deferred<Response>();
    pendingUpload = upload.promise;
    choosePhoto();
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await screen.findByText("Uploading profile picture…");

    if (attempt === "Back") await act(() => router.navigate(-1));
    else fireEvent.click(screen.getByRole(attempt === "Library" ? "link" : "button", { name: attempt }));

    expect(await screen.findByText("Saving your profile. Please wait.")).toHaveAttribute("role", "status");
    expect(router.state.location.pathname).toBe("/account");
    expect(confirm).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith("/auth/logout"))).toBe(false);

    upload.resolve(new Response(null, { status: 204 }));
    expect(await screen.findByText("Profile picture saved.")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/account");
    fireEvent.click(screen.getByRole("link", { name: "Library" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/library"));
  });

  it("dismisses the mobile sidebar so the save status is visible after a logout attempt", async () => {
    vi.mocked(useIsMobile).mockReturnValue(true);
    await openAccountRoute();
    const upload = deferred<Response>();
    pendingUpload = upload.promise;
    choosePhoto();
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Toggle Sidebar" }));
    fireEvent.click(await screen.findByRole("button", { name: "Log out" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Sidebar" })).not.toBeInTheDocument());
    expect(screen.getByText("Saving your profile. Please wait.")).toBeVisible();
    upload.resolve(new Response(null, { status: 204 }));
    expect(await screen.findByText("Profile picture saved.")).toBeInTheDocument();
  });

  it("redirects on failed session refresh and returns to a fresh editor after sign-in", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const router = await openAccountRoute();
    choosePhoto();
    rejectSession = true;
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));

    expect(await screen.findByRole("heading", { name: "Welcome back" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/login");
    expect(confirm).not.toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:photo-preview");

    rejectSession = false;
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: originalUser.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Account", level: 1 })).toBeInTheDocument();
    expect(screen.queryByAltText("Selected profile picture preview")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
  });

  it("opens the editor with a photo preview when a file is dropped on the read view", () => {
    const router = createMemoryRouter([{ path: "/", element: <AccountRoute /> }]);
    render(<RouterProvider router={router} />);
    expect(screen.getByRole("button", { name: "Choose picture" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
    const file = new File(["test image"], "drop.png", { type: "image/png" });

    fireEvent.drop(screen.getByRole("group", { name: "Profile picture" }), {
      dataTransfer: { types: ["Files"], files: [file] },
    });

    expect(screen.getByAltText("Selected profile picture preview")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save profile" })).toBeEnabled();
  });

  it("enables Save for a photo-only edit and publishes it before displaying the saved image", async () => {
    const save = openEditor();
    expect(save).toBeDisabled();

    const photo = choosePhoto();
    expect(screen.getByAltText("Selected profile picture preview")).toHaveAttribute("src", "blob:photo-preview");
    expect(save).toBeEnabled();
    const refresh = deferred<Response>();
    nextImageResponse = refresh.promise;
    fireEvent.click(save);
    expect(screen.getByRole("button", { name: "Choose another" })).toBeDisabled();
    choosePhoto();
    expect(createObjectURL).toHaveBeenCalledOnce();

    expect(await screen.findByText("Profile picture saved.")).toBeInTheDocument();
    expect(screen.getByAltText("Profile picture")).toHaveAttribute("src", "blob:photo-preview");
    expect(revokeObjectURL).not.toHaveBeenCalled();
    const changePicture = screen.getByRole("button", { name: "Change picture" });
    expect(changePicture).toBeDisabled();
    choosePhoto();
    fireEvent.drop(screen.getByRole("group", { name: "Profile picture" }), {
      dataTransfer: { types: ["Files"], files: [new File(["new image"], "new.png", { type: "image/png" })] },
    });
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Save profile" })).not.toBeInTheDocument();
    refresh.resolve(Response.json({ image: { url: savedImageUrl } }));
    const remoteImage = await getRemoteImage(savedImageUrl);
    expect(remoteImage).not.toBeVisible();
    expect(screen.getByAltText("Profile picture")).toHaveAttribute("src", "blob:photo-preview");
    fireEvent.load(remoteImage);
    expect(screen.getByAltText("Profile picture")).toHaveAttribute("src", savedImageUrl);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:photo-preview");
    expect(changePicture).toBeEnabled();
    expect(updateName).not.toHaveBeenCalled();

    const prepare = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/profile-image/uploads"));
    expect(prepare?.[1]?.body).toBe(JSON.stringify({ contentType: photo.type, sizeBytes: photo.size }));
    const upload = fetchMock.mock.calls.find(([url]) => url === uploadUrl)?.[1];
    expect(upload).toMatchObject({ method: "POST", credentials: "omit" });
    expect(upload?.headers).toBeUndefined();
    expect(Array.from((upload?.body as FormData).keys())).toEqual(["key", "policy", "x-amz-meta-declared-size", "file"]);
    expect((upload?.body as FormData).get("x-amz-meta-declared-size")).toBe(String(photo.size));
    expect((upload?.body as FormData).get("file")).toBe(photo);
    const completion = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/complete"));
    expect(completion?.[1]).toMatchObject({ method: "POST" });
    expect(completion?.[1]?.body).toBeUndefined();
  });

  it("keeps a replacement preview through refresh and image failures and retries loading", async () => {
    completed = true;
    const save = openEditor();
    expect(await screen.findByAltText("Profile picture")).toHaveAttribute("src", savedImageUrl);
    choosePhoto();
    const refresh = deferred<Response>();
    nextImageResponse = refresh.promise;
    fireEvent.click(save);
    expect(await screen.findByText("Profile picture saved.")).toBeInTheDocument();
    expect(screen.getByAltText("Profile picture")).toHaveAttribute("src", "blob:photo-preview");

    refresh.resolve(new Response(null, { status: 503 }));
    const retry = await screen.findByRole("button", { name: "Retry loading" });
    expect(screen.getByAltText("Profile picture")).toHaveAttribute("src", "blob:photo-preview");
    nextImageResponse = Promise.resolve(Response.json({ image: { url: replacementImageUrl } }));
    fireEvent.click(retry);
    fireEvent.error(await getRemoteImage(replacementImageUrl));
    expect(screen.getByAltText("Profile picture")).toHaveAttribute("src", "blob:photo-preview");
    expect(revokeObjectURL).not.toHaveBeenCalled();

    nextImageResponse = Promise.resolve(Response.json({ image: { url: replacementImageUrl } }));
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));
    fireEvent.load(await getRemoteImage(replacementImageUrl));
    expect(screen.getByAltText("Profile picture")).toHaveAttribute("src", replacementImageUrl);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:photo-preview");
  });

  it("clears the local avatar on removal and ignores a stale refresh", async () => {
    const save = openEditor();
    choosePhoto();
    const refresh = deferred<Response>();
    nextImageResponse = refresh.promise;
    fireEvent.click(save);
    expect(await screen.findByText("Profile picture saved.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Edit profile" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove profile picture" }));
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    expect(await screen.findByText("Profile picture removed.")).toBeInTheDocument();
    await act(() => refresh.resolve(Response.json({ image: { url: savedImageUrl } })));

    expect(screen.getByRole("img", { name: "No profile picture" })).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:photo-preview");
  });

  it("validates the draft, revokes replaced previews, and restores focus on discard", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const save = openEditor();
    const name = screen.getByLabelText("Display name");
    expect(name).toHaveFocus();
    fireEvent.change(name, { target: { value: "#" } });
    fireEvent.click(save);
    expect(screen.getByRole("alert")).toHaveTextContent("Use 1–40 characters");
    expect(name).toHaveFocus();

    choosePhoto();
    choosePhoto();
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith("blob:photo-preview");
    expect(revokeObjectURL.mock.invocationCallOrder[0]).toBeLessThan(createObjectURL.mock.invocationCallOrder[1]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenLastCalledWith("blob:photo-preview-2");
    expect(screen.getByRole("button", { name: "Edit profile" })).toHaveFocus();
  });

  it("keeps the selected photo for retry when the name saves and the upload fails", async () => {
    uploadFails = true;
    const save = openEditor();
    fireEvent.change(screen.getByLabelText("Display name"), { target: { value: "New Reader" } });
    choosePhoto();
    fireEvent.click(save);

    expect(await screen.findByText("Could not save your profile picture. Try again.")).toBeInTheDocument();
    expect(screen.getByText("Display name saved.")).toBeInTheDocument();
    expect(screen.getByAltText("Selected profile picture preview")).toBeInTheDocument();
    expect(completed).toBe(false);
    expect(updateName).toHaveBeenCalledExactlyOnceWith("New Reader");

    uploadFails = false;
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByText("Profile picture saved.")).toBeInTheDocument());
    expect(updateName).toHaveBeenCalledTimes(1);
  });

  it("offers a fresh image URL when the saved preview fails to load", async () => {
    completed = true;
    openEditor();
    fireEvent.error(await screen.findByAltText("Profile picture"));

    expect(screen.getByText("Could not load your profile picture.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }));

    expect(await screen.findByAltText("Profile picture")).toHaveAttribute("src", savedImageUrl);
    expect(screen.queryByText("Could not load your profile picture.")).not.toBeInTheDocument();
  });

  it("lets the user undo removal and only deletes the saved photo after Save", async () => {
    completed = true;
    const save = openEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Remove profile picture" }));

    expect(screen.getByText("Your profile picture will be removed when you save.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "No profile picture" })).toBeInTheDocument();
    expect(save).toBeEnabled();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "DELETE")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Undo removal" }));
    expect(screen.getByAltText("Profile picture")).toHaveAttribute("src", savedImageUrl);
    expect(save).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Remove profile picture" }));
    fireEvent.click(save);
    expect(await screen.findByText("Profile picture removed.")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "No profile picture" })).toBeInTheDocument();
    const deletion = fetchMock.mock.calls.find(([, init]) => init?.method === "DELETE");
    expect(String(deletion?.[0])).toMatch(/\/users\/me\/profile-image$/);
    expect(new Headers(deletion?.[1]?.headers).get("Authorization")).toBe("Bearer account-access-token");
    expect(updateName).not.toHaveBeenCalled();
  });

  it("keeps the removal pending when the API rejects deletion", async () => {
    completed = true;
    deleteFails = true;
    const save = openEditor();
    fireEvent.click(await screen.findByRole("button", { name: "Remove profile picture" }));
    fireEvent.click(save);

    expect(await screen.findByText("Could not remove your profile picture. Try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo removal" })).toBeEnabled();
    expect(save).toBeEnabled();
    expect(completed).toBe(true);

    deleteFails = false;
    fireEvent.click(save);
    expect(await screen.findByText("Profile picture removed.")).toBeInTheDocument();
  });
});
