import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "../src/App";
import AuthProvider from "../src/auth/AuthProvider";
import { login, refreshSession } from "../src/service/auth.service";

vi.mock("../src/auth/authEvents", () => ({
  subscribeToAuthLoss: vi.fn(() => () => undefined),
}));

vi.mock("../src/auth/tokenStore", () => ({
  clearAccessToken: vi.fn(),
}));

vi.mock("../src/service/auth.service", () => ({
  refreshSession: vi.fn().mockResolvedValue(null),
  login: vi.fn(),
  signUp: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../src/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

const session = {
  accessToken: "mock-access-token",
  user: {
    id: "reader",
    email: "reader@example.com",
    displayName: null,
    createdAt: "2026-11-18",
    updatedAt: "2026-11-18",
  },
};

function CurrentLocation() {
  const { pathname, search, hash } = useLocation();
  return <output aria-label="Current location">{pathname}{search}{hash}</output>;
}

function renderApp(path = "/") {
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
        <CurrentLocation />
      </AuthProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.spyOn(window, "scrollTo").mockImplementation(() => undefined);
  vi.stubEnv("VITE_CHROME_WEB_STORE_URL", "");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("App", () => {
  it("exposes the prototype's section and call-to-action destinations", () => {
    renderApp();

    expect(screen.getByRole("link", { name: "Save" })).toHaveAttribute("href", "/#save");
    expect(screen.getByRole("link", { name: "Read" })).toHaveAttribute("href", "/#read");
    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute("href", "/library");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/signin");

    const startLinks = screen.getAllByRole("link", { name: "Get started" });
    expect(startLinks).toHaveLength(2);
    startLinks.forEach((link) => expect(link).toHaveAttribute("href", "/signin"));

    screen.getAllByRole("link", { name: "Add to Chrome" }).forEach((link) => {
      expect(link).toHaveAttribute("href", "https://chromewebstore.google.com/search/Quiescent");
      expect(link).toHaveAttribute("target", "_blank");
    });
  });

  it("opens the policy from the landing footer and returns focus there on close", async () => {
    renderApp("/?ref=footer");

    const trigger = screen.getByRole("button", { name: "Privacy Policy" });
    fireEvent.click(trigger);

    const dialog = await screen.findByRole("dialog", { name: "Privacy Policy" });
    expect(within(dialog).getByRole("heading", { name: "What we collect" })).toBeInTheDocument();
    expect(screen.getByLabelText("Current location", { selector: "output" })).toHaveTextContent("/?ref=footer");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close", exact: true }));

    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it("requires consent before signing in and returns the reader to the requested library URL", async () => {
    vi.mocked(login).mockResolvedValueOnce(session);
    renderApp("/library?sort=recent#reading");

    await screen.findByRole("heading", { name: "Welcome to Quiescent" });
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/signin");
    expect(screen.queryByRole("button", { name: /google/i })).not.toBeInTheDocument();

    const submit = screen.getByRole("button", { name: "Sign in" });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: session.user.email } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "test-password" } });
    fireEvent.click(submit);
    expect(login).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("checkbox", { name: /agree to the privacy policy/i }));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    await waitFor(() => expect(screen.getByLabelText("Current location")).toHaveTextContent("/library?sort=recent#reading"));
    expect(login).toHaveBeenCalledWith({ email: session.user.email, password: "test-password" });
  });

  it("moves focus to the selected privacy section", () => {
    renderApp("/privacy");

    fireEvent.click(screen.getByRole("link", { name: "Security" }));

    expect(screen.getByLabelText("Current location")).toHaveTextContent("/privacy#security");
    expect(screen.getByRole("heading", { name: "Security" })).toHaveFocus();
    expect(screen.getByRole("link", { name: "Security" })).toHaveAttribute("aria-current", "location");
    fireEvent.click(screen.getByRole("link", { name: "Quiescent home" }));
    expect(screen.getByRole("heading", { name: "Read deeply in a noisy world.", level: 1 })).toBeInTheDocument();
  });

  it("routes signed-in readers directly to their library", async () => {
    vi.mocked(refreshSession).mockResolvedValueOnce(session);
    renderApp();

    const [openLibrary] = await screen.findAllByRole("link", { name: "Open your library" });
    fireEvent.click(openLibrary);
    expect(screen.getByLabelText("Current location")).toHaveTextContent("/library");
  });
});
