import { describe, expect, it } from "vitest";

import { encodeSseEvent } from "./sse";

describe("encodeSseEvent", () => {
  it("serializes named JSON events in SSE format", () => {
    expect(encodeSseEvent("message.delta", { content: "hello" })).toBe(
      'event: message.delta\ndata: {"content":"hello"}\n\n',
    );
  });
});
