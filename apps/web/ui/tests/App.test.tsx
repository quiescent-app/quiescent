import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import App from "../src/App";
import AuthProvider from "../src/auth/AuthProvider";

vi.mock("../src/auth/authApi", () => ({
  refreshSession: vi.fn().mockResolvedValue(null),
  subscribeToAuthLoss: vi.fn(() => () => undefined),
  clearAccessToken: vi.fn(),
  login: vi.fn(),
  signUp: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../src/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

describe("App", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <MemoryRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(container).toBeTruthy();
  });
});
