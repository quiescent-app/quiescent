import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AuthProvider from "../src/auth/AuthProvider";
import { useAuth } from "../src/auth/useAuth";

const mocks = vi.hoisted(() => ({
  refreshSession: vi.fn(),
  subscribeToAuthLoss: vi.fn(() => () => undefined),
  login: vi.fn(),
  signUp: vi.fn(),
  logout: vi.fn(),
  clearAccessToken: vi.fn(),
}));

vi.mock("../src/auth/authApi", () => mocks);

const session = {
  user: {
    id: "user-1",
    email: "reader@example.com",
    displayName: "Reader",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  accessToken: "memory-only-access-token",
};

function AuthProbe() {
  const auth = useAuth();
  return (
    <div>
      <p data-testid="status">{auth.status}</p>
      <p data-testid="user">{auth.user?.email ?? "no user"}</p>
      <button onClick={() => void auth.login({ email: "reader@example.com", password: "password" })}>
        Sign in
      </button>
      <button onClick={() => void auth.signUp({ email: "reader@example.com", password: "password" })}>
        Sign up
      </button>
      <button onClick={() => void auth.logout()}>Log out</button>
    </div>
  );
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuthProvider", () => {
  it("restores a session before marking the app authenticated", async () => {
    mocks.refreshSession.mockResolvedValue(session);
    render(<AuthProvider><AuthProbe /></AuthProvider>);

    expect(screen.getByTestId("status").textContent).toBe("loading");
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(screen.getByTestId("user").textContent).toBe("reader@example.com");
  });

  it("treats a failed restore as unauthenticated", async () => {
    mocks.refreshSession.mockResolvedValue(null);
    render(<AuthProvider><AuthProbe /></AuthProvider>);

    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(screen.getByTestId("user").textContent).toBe("no user");
  });

  it("enters the session after signup and clears it when logout fails", async () => {
    mocks.refreshSession.mockResolvedValue(null);
    mocks.signUp.mockResolvedValue(session);
    mocks.logout.mockRejectedValue(new Error("network failure"));
    render(<AuthProvider><AuthProbe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));

    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("authenticated"));
    expect(screen.getByTestId("user").textContent).toBe("reader@example.com");

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await waitFor(() => expect(screen.getByTestId("status").textContent).toBe("unauthenticated"));
    expect(mocks.clearAccessToken).toHaveBeenCalled();
  });
});
