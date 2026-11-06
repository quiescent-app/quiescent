import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import App from "../src/App";

vi.mock("../src/hooks/use-mobile", () => ({
  useIsMobile: () => false,
}));

describe("App", () => {
  it("renders without crashing", () => {
    const { container } = render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(container).toBeTruthy();
  });
});
