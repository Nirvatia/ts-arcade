import type { EventPayloads, GameEvent } from "../shared/gameEvents.js";

type AllPayloads = EventPayloads[GameEvent];
type GenericHandler = (payload: AllPayloads) => void;

class EventBus {
  // We type the map value as a handler that can receive a union of all payloads.
  // This satisfies the compiler's internal variance checks perfectly.
  private listeners: Map<GameEvent, GenericHandler[]> = new Map();

  /**
   * Subscribe to an event.
   * Enforces that the handler precisely matches the specific event key.
   */
  public on<K extends GameEvent>(
    event: K,
    handler: (payload: EventPayloads[K]) => void,
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }

    this.listeners.get(event)!.push(handler as GenericHandler);
  }

  /**
   * Unsubscribe a specific handler.
   */
  public off<K extends GameEvent>(
    event: K,
    handler: (payload: EventPayloads[K]) => void,
  ): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    this.listeners.set(
      event,
      handlers.filter((h) => h !== (handler as GenericHandler)),
    );
  }

  /**
   * Emit an event.
   * Guarantees that only the correct payload structure can be sent for this key.
   */
  public emit<K extends GameEvent>(
    event: K,
    ...args: EventPayloads[K] extends void ? [] : [EventPayloads[K]]
  ): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;

    const payload = args[0] as AllPayloads;
    handlers.forEach((handler) => handler(payload));
  }

  /**
   * Remove all listeners for a specific event, or clear the whole bus.
   */
  public removeAllListeners(event?: GameEvent): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

export const eventBus = new EventBus();
