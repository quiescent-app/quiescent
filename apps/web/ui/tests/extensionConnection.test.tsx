import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext, type AuthContextType } from "../src/auth/AuthContext";
import { connectExtension } from "../src/auth/connectExtension";
import LoginPage from "../src/pages/LoginPage";
import SignupPage from "../src/pages/SignupPage";

vi.mock("../src/auth/connectExtension", () => ({ connectExtension: vi.fn() }));

const extensionId = "a".repeat(32);

function renderAuth(path: string, status: AuthContextType["status"] = "unauthenticated") {
  const login = vi.fn().mockResolvedValue(undefined);
  const signUp = vi.fn().mockResolvedValue(undefined);
  const context: AuthContextType = {
    status,
    user: null,
    login,
    signUp,
    logout: vi.fn().mockResolvedValue(undefined),
  };
  const view = render(
    <AuthContext.Provider value={context}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/library" element={<p>Library</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return { ...view, context, login, signUp };
}

beforeEach(() => {
  vi.mocked(connectExtension).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("extension auth handoff", () => {
  it("preserves the extension ID between login and signup", () => {
    renderAuth(`/login?extensionId=${extensionId}`);
    expect(screen.getByRole("link", { name: "Create an account" }).getAttribute("href"))
      .toBe(`/signup?extensionId=${extensionId}`);
  });

  it.each(["login", "signup"])("connects after %s", async (page) => {
    const auth = renderAuth(`/${page}?extensionId=${extensionId}`);
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: page === "login" ? "Sign in" : "Create account" }));
    await waitFor(() => expect(page === "login" ? auth.login : auth.signUp).toHaveBeenCalledOnce());

    auth.context.status = "authenticated";
    auth.rerender(
      <AuthContext.Provider value={{ ...auth.context }}>
        <MemoryRouter initialEntries={[`/${page}?extensionId=${extensionId}`]}>
          <Routes>
            <Route path={`/${page}`} element={page === "login" ? <LoginPage /> : <SignupPage />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>,
    );
    await waitFor(() => expect(connectExtension).toHaveBeenCalledWith(extensionId));
    expect(await screen.findByText("Extension connected")).toBeTruthy();
  });

  it("connects an already signed in user", async () => {
    renderAuth(`/login?extensionId=${extensionId}`, "authenticated");
    await waitFor(() => expect(connectExtension).toHaveBeenCalledWith(extensionId));
  });
});
