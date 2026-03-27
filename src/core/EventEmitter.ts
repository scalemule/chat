type Listener<T> = (data: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export class EventEmitter<EventMap extends Record<string, any>> {
  private listeners = new Map<keyof EventMap, Set<Listener<unknown>>>();

  on<K extends keyof EventMap>(event: K, callback: Listener<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as Listener<unknown>);
    return () => this.off(event, callback);
  }

  off<K extends keyof EventMap>(event: K, callback: Listener<EventMap[K]>): void {
    this.listeners.get(event)?.delete(callback as Listener<unknown>);
  }

  once<K extends keyof EventMap>(event: K, callback: Listener<EventMap[K]>): () => void {
    const wrapper = ((data: EventMap[K]) => {
      this.off(event, wrapper);
      callback(data);
    }) as Listener<EventMap[K]>;
    return this.on(event, wrapper);
  }

  emit<K extends keyof EventMap>(
    event: K,
    ...[data]: EventMap[K] extends void ? [] : [EventMap[K]]
  ): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(data as unknown);
        } catch (err) {
          console.error(`[ScaleMuleChat] Error in ${String(event)} listener:`, err);
        }
      }
    }
  }

  removeAllListeners(event?: keyof EventMap): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}
