import { describe, expect, it } from "vitest";

import App from "../src/popup/App";

describe("App", () => {
  it("renders the Quiescent heading", () => {
    const element = App();

    expect(element.type).toBe("h1");
    expect(element.props.children).toBe("Quiescent");
  });
});
