import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import App from "../src/popup/App";

afterEach(() => {
  cleanup();
});

describe("App", () => {
  it("renders the Quiescent heading", () => {
    render(<App />);

    const heading = screen.getByRole("heading", {
      level: 1,
      name: "Quiescent",
    });

    expect(heading).toBeDefined();
  });

  it("renders the Quiescent redirect button", () => {
    render(<App />);

    const button = screen.getByRole("button", {
      name: "Click to go to Quiescent",
    });

    expect(button).toBeDefined();
  });
});
