import type { EventHandler } from "../types.js";

class EventBus {
  private listeners: Map<string, EventHandler[]> = new Map();

  constructor() {}

  public on(event: string, handler: EventHandler) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(handler);
  }

  public off(event: string, handler: EventHandler) {
    const handlers = this.listeners.get(event);

    if (!handlers) return;

    this.listeners.set(
      event,
      handlers.filter((h) => h !== handler)
    );
  }

  public emit(event: string, payload?: any) {
    const handlers = this.listeners.get(event);

    if (!handlers) return;

    handlers.forEach((h) => h(payload));
  }
}

export const eventBus = new EventBus();
