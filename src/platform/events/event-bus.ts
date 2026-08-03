export type DomainEvent<TPayload = Record<string, unknown>> = {
  id: string;
  type: string;
  organizationId: string;
  aggregateType: string;
  aggregateId: string;
  payload: TPayload;
  occurredAt: string;
  version: number;
};

export type EventHandler<TPayload = Record<string, unknown>> = (
  event: DomainEvent<TPayload>,
) => void | Promise<void>;

/** In-process event bus — persist to platform_events for cross-instance delivery. */
export class EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  subscribe(eventType: string, handler: EventHandler): () => void {
    const set = this.handlers.get(eventType) ?? new Set();
    set.add(handler as EventHandler);
    this.handlers.set(eventType, set);

    return () => set.delete(handler as EventHandler);
  }

  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers) return;

    await Promise.all(
      [...handlers].map(async (handler) => {
        try {
          await handler(event);
        } catch {
          // Handlers must not break publisher — logged at persistence layer
        }
      }),
    );
  }
}

export const platformEventBus = new EventBus();

export function createEventId(): string {
  return crypto.randomUUID();
}
