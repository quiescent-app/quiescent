import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import App from "../src/App";
import AuthProvider from "../src/auth/AuthProvider";

vi.mock("../src/service/api.service", () => ({
  subscribeToAuthLoss: vi.fn(() => () => undefined),
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
