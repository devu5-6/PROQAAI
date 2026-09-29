import type { QueueActionResponse, QueueId, QueueSnapshot } from "@/types";

const API_BASE = "/api/locations/1";

/** Typed JSON fetch that throws plain `Error`s with server messages on non-2xx. */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }
  // A 200 with a non-JSON body means the API layer is missing (e.g. the mock
  // worker did not intercept and the SPA fallback served index.html). Surface
  // that as a retryable service error instead of a JSON parse crash.
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    throw new Error("The queue service is unavailable right now. Please retry.");
  }
  return (await res.json()) as T;
}

export const api = {
  getQueue(queueId: QueueId, signal?: AbortSignal): Promise<QueueSnapshot> {
    return request<QueueSnapshot>(`/queue/${queueId}`, { signal });
  },

  async callNext(queueId: QueueId): Promise<QueueSnapshot> {
    const res = await request<QueueActionResponse>(`/queue/${queueId}/call-next`, {
      method: "POST",
    });
    return res.queue;
  },

  async serve(queueId: QueueId, customerId: string): Promise<QueueSnapshot> {
    const res = await request<QueueActionResponse>(
      `/queue/${queueId}/customers/${customerId}/serve`,
      { method: "POST" }
    );
    return res.queue;
  },

  async markNoShow(queueId: QueueId, customerId: string): Promise<QueueSnapshot> {
    const res = await request<QueueActionResponse>(
      `/queue/${queueId}/customers/${customerId}/no-show`,
      { method: "POST" }
    );
    return res.queue;
  },

  /**
   * Moving a customer touches two queues, so the response carries both
   * snapshots and the caller updates two cache entries.
   */
  moveCustomer(
    queueId: QueueId,
    customerId: string,
    to: QueueId
  ): Promise<{ from: QueueSnapshot; to: QueueSnapshot }> {
    return request(`/queue/${queueId}/customers/${customerId}/move?to=${to}`, {
      method: "POST",
    });
  },
};
