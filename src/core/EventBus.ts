// ============================================================================
// Union Arena Digital — EventBus (Batch 0 极简版)
// ============================================================================
// 同步事件发布/订阅。
// B0 不实现 off() 和优先级 — 优先级在 B3 AbilityQueue 中独立管理。
// ============================================================================

import { GameEvent, GameEventType } from './types';

type EventHandler = (event: GameEvent) => void;

export class EventBus {
  private handlers: Map<GameEventType, EventHandler[]> = new Map();

  /**
   * 注册事件处理器。同一 eventType 可注册多个 handler。
   */
  on(eventType: GameEventType, handler: EventHandler): void {
    const existing = this.handlers.get(eventType);
    if (existing) {
      existing.push(handler);
    } else {
      this.handlers.set(eventType, [handler]);
    }
  }

  /**
   * 发布事件。同步调用所有已注册的处理器。
   */
  emit(event: GameEvent): void {
    const handlers = this.handlers.get(event.eventType);
    if (!handlers || handlers.length === 0) {
      return;
    }
    for (const handler of handlers) {
      handler(event);
    }
  }

  /**
   * 清空所有处理器（用于测试 teardown）。
   */
  clear(): void {
    this.handlers.clear();
  }
}
