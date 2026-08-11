/**
 * Standard domain event envelope — every event published via EventEmitter2
 * must conform to this shape.
 *
 * Why a generic wrapper?
 * - Consistent structure across all modules: correlationId, actorId, timestamps
 *   are always present, so event handlers never need to guess the shape.
 * - Maps 1:1 to the envelope schema in docs/03-event-storming.md §1.
 * - When we migrate to RabbitMQ in V2, this same envelope becomes the
 *   message body — zero refactoring needed.
 *
 * @see docs/03-event-storming.md §1 (Standard Event Envelope Schema)
 */
export interface DomainEventEnvelope<T = Record<string, unknown>> {
  /** Unique ID for this specific event instance (for idempotency / dedup) */
  eventId: string;

  /** The event name, e.g. 'room.created' — should match EventNames enum */
  eventName: string;

  /** The primary entity ID this event is about (e.g. roomId, expenseId) */
  aggregateId: string;

  /** The room this event occurred in (null for global events like auth) */
  roomId: string;

  /** The user who triggered this event */
  actorId: string;

  /** When the event occurred */
  occurredAt: string;

  /** Domain-specific event data — differs per event type */
  payload: T;

  /** Cross-cutting metadata for tracing and debugging */
  metadata: {
    correlationId: string;
    sourceModule: string;
  };
}
