import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "../src/pages/LoginPage";
import SignupPage from "../src/pages/SignupPage";

const mocks = vi.hoisted(() => ({ login: vi.fn(), signUp: vi.fn() }));
vi.mock("../src/auth/useAuth", () => ({ useAuth: () => ({ ...mocks, logout: vi.fn() }) }));

function CurrentPath() {
  const location = useLocation();
  return <p data-testid="path">{location.pathname}</p>;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("authentication pages", () => {
  it("submits login credentials and returns to the requested protected page", async () => {
    mocks.login.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: { pathname: "/account" } } }]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/account" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);

    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith({
      email: "reader@example.com",
      password: "correct-password",
    }));
    expect((await screen.findByTestId("path")).textContent).toBe("/account");
  });

  it("shows the API error on login", async () => {
    mocks.login.mockRejectedValue(new Error("Invalid email or password"));
    render(<MemoryRouter><LoginPage /></MemoryRouter>);

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "wrong-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);

    expect((await screen.findByRole("alert")).textContent).toBe("Invalid email or password");
  });

  it("creates an account and routes to the library", async () => {
    mocks.signUp.mockResolvedValue(undefined);
    render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/library" element={<CurrentPath />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "reader@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct-password" } });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);

    expect((await screen.findByTestId("path")).textContent).toBe("/library");
    expect(mocks.signUp).toHaveBeenCalledWith({ email: "reader@example.com", password: "correct-password" });
  });
});
