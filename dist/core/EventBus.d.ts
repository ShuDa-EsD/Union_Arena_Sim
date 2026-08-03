import { GameEvent, GameEventType } from './types';
type EventHandler = (event: GameEvent) => void;
export declare class EventBus {
    private handlers;
    /**
     * 注册事件处理器。同一 eventType 可注册多个 handler。
     */
    on(eventType: GameEventType, handler: EventHandler): void;
    /**
     * 发布事件。同步调用所有已注册的处理器。
     */
    emit(event: GameEvent): void;
    /**
     * 清空所有处理器（用于测试 teardown）。
     */
    clear(): void;
}
export {};
//# sourceMappingURL=EventBus.d.ts.map