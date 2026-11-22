import "@testing-library/jest-dom/vitest";

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "../src/auth/AuthContext";
import { setAccessToken } from "../src/auth/tokenStore";
import AccountPage from "../src/pages/AccountPage";

const uploadUrl = "https://s3.example.com/upload";
const savedImageUrl = "https://s3.example.com/current-image";
const originalUser = {
  id: "profile-user",
  email: "reader@example.com",
  displayName: "Reader",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};
const updateName = vi.fn<(displayName: string) => Promise<void>>();
const fetchMock = vi.fn<typeof fetch>();

function AccountRoute() {
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
      <AccountPage />
    </AuthContext.Provider>
  );
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

describe("Account profile saving", () => {
  let completed: boolean;
  let uploadFails: boolean;
  let deleteFails: boolean;

  beforeEach(() => {
    completed = false;
    uploadFails = false;
    deleteFails = false;
    updateName.mockReset().mockResolvedValue(undefined);
    setAccessToken("account-access-token");
    vi.stubGlobal("URL", class extends URL {
      static createObjectURL() { return "blob:photo-preview"; }
      static revokeObjectURL() {}
    });
    vi.stubGlobal("fetch", fetchMock.mockReset().mockImplementation(async (input, init) => {
      if (input === uploadUrl) return new Response(null, { status: uploadFails ? 503 : 204 });

      const path = new URL(String(input)).pathname;
      if (path.endsWith("/profile-image/uploads")) {
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
        return Response.json({ image: completed ? { url: savedImageUrl } : null });
      }
      throw new Error(`Unexpected request to ${path}`);
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    setAccessToken(null);
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
    fireEvent.click(save);

    expect(await screen.findByText("Profile picture saved.")).toBeInTheDocument();
    expect(await screen.findByAltText("Profile picture")).toHaveAttribute("src", savedImageUrl);
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
