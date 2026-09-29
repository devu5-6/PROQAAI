export type QueueStatus = "waiting" | "called" | "served" | "no_show";

export type QueueId = "general" | "vaccination" | "billing";

export interface Queue {
  id: QueueId;
  name: string;
}

/** All 14 fields the PM wants visible, per the stakeholder request. */
export interface Customer {
  id: string;
  name: string;
  position: number;
  status: QueueStatus;
  /** Minutes since the customer joined the queue. */
  waitMins: number;
  checkedInAt: string;
  phone: string;
  email: string;
  visitReason: string;
  notes: string;
  createdBy: string;
  ticketNumber: string;
  dateOfBirth: string;
  language: string;
}

export interface QueueSnapshot {
  queueId: QueueId;
  /** Ordered list; index 0 is the head of the queue. */
  customers: Customer[];
  updatedAt: string;
}

export type QueueActionKind =
  | "call_next"
  | "serve"
  | "no_show"
  | "move_queue";

export interface QueueActionResponse {
  ok: true;
  queue: QueueSnapshot;
}

export interface ApiError {
  ok: false;
  error: string;
}

export type QueueResult = QueueActionResponse | ApiError;
