import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../src/popup/App";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

  it("opens the Quiescent web app in a new tab when the button is clicked", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(<App />);

    const button = screen.getByRole("button", {
      name: "Click to go to Quiescent",
    });

    fireEvent.click(button);

    expect(openSpy).toHaveBeenCalledWith("http://localhost:5173", "_blank");
  });
});
