import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { handlers } from "@/mocks/handlers";

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));

beforeEach(() => {
  // shouldAdvanceTime keeps MSW's delay() timers working in real time while
  // still letting tests advance the clock for polling/no-jump assertions.
  vi.useFakeTimers({ shouldAdvanceTime: true, advanceTimeDelta: 20 });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.useRealTimers();
});

afterAll(() => server.close());
