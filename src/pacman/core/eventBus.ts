import type { EventPayloads, GameEvent } from "../gameEvents.js";

/**
 * Type-safe event bus for Pacman game.
 * Ensures compile-time checking of event names and payloads.
 */
class EventBus {
  // Partial record ensures we don't need to initialize every event key at startup
  private listeners: Partial<Record<GameEvent, Array<(payload: any) => void>>> = {};

  /**
   * Subscribe to an event.
   * The handler's payload type is automatically inferred from the event name.
   */
  public on<K extends GameEvent>(
    event: K,
    handler: (payload: EventPayloads[K]) => void
  ): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(handler);
  }

  /**
   * Unsubscribe a specific handler.
   */
  public off<K extends GameEvent>(
    event: K,
    handler: (payload: EventPayloads[K]) => void
  ): void {
    const handlers = this.listeners[event];
    if (!handlers) return;

    this.listeners[event] = handlers.filter((h) => h !== handler);
  }

  /**
   * Emit an event.
   * TypeScript will enforce the correct object structure for the payload.
   */
  public emit<K extends GameEvent>(
    event: K,
    ...args: EventPayloads[K] extends void ? [] : [EventPayloads[K]]
  ): void {
    const handlers = this.listeners[event];
    if (!handlers) return;

    const payload = args[0];
    handlers.forEach((h) => h(payload));
  }

  /**
   * Remove all listeners for a specific event, or all events if none specified.
   */
  public removeAllListeners(event?: GameEvent): void {
    if (event) {
      delete this.listeners[event];
    } else {
      this.listeners = {};
    }
  }
}

export const eventBus = new EventBus();