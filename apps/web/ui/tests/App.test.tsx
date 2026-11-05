import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import App from "../src/App";
import AuthProvider from "../src/auth/AuthProvider";

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
