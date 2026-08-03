// ============================================================================
// EventBus 单元测试
// ============================================================================

import { EventBus } from '../../src/core/EventBus';
import { GameEvent, GameEventType } from '../../src/core/types';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  // --- 基本发布订阅 ---

  test('should call handler when event is emitted', () => {
    const handler = jest.fn();
    eventBus.on('StateChanged', handler);

    const event: GameEvent = {
      eventType: 'StateChanged',
      data: { key: 'value' },
    };
    eventBus.emit(event);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });

  test('should call all handlers registered for the same event type', () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();
    eventBus.on('CardPlayed', handler1);
    eventBus.on('CardPlayed', handler2);

    const event: GameEvent = {
      eventType: 'CardPlayed',
      sourcePlayerId: 'player-1',
      data: {},
    };
    eventBus.emit(event);

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  test('should NOT call handlers registered for different event types', () => {
    const handlerA = jest.fn();
    const handlerB = jest.fn();
    eventBus.on('CardPlayed', handlerA);
    eventBus.on('TurnStarted', handlerB);

    const event: GameEvent = {
      eventType: 'CardPlayed',
      data: {},
    };
    eventBus.emit(event);

    expect(handlerA).toHaveBeenCalledTimes(1);
    expect(handlerB).not.toHaveBeenCalled();
  });

  // --- 无处理器时 ---

  test('should not throw when emitting event with no handlers', () => {
    const event: GameEvent = {
      eventType: 'GameStarted',
      data: {},
    };
    expect(() => eventBus.emit(event)).not.toThrow();
  });

  // --- clear ---

  test('should remove all handlers after clear()', () => {
    const handler = jest.fn();
    eventBus.on('StateChanged', handler);
    eventBus.clear();

    const event: GameEvent = {
      eventType: 'StateChanged',
      data: {},
    };
    eventBus.emit(event);

    expect(handler).not.toHaveBeenCalled();
  });

  // --- 事件数据完整性 ---

  test('should pass event data correctly to handler', () => {
    const handler = jest.fn();
    eventBus.on('DamageDealt', handler);

    const event: GameEvent = {
      eventType: 'DamageDealt',
      sourcePlayerId: 'attacker',
      sourceCardInstanceId: 'inst-5-a1b2',
      data: { amount: 2, targetPlayerId: 'defender' },
    };
    eventBus.emit(event);

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'DamageDealt',
        sourcePlayerId: 'attacker',
        sourceCardInstanceId: 'inst-5-a1b2',
        data: { amount: 2, targetPlayerId: 'defender' },
      })
    );
  });

  // --- 同步执行 ---

  test('handlers should execute synchronously', () => {
    const calls: string[] = [];
    eventBus.on('PhaseChanged', () => {
      calls.push('handler');
    });

    calls.push('before-emit');
    eventBus.emit({ eventType: 'PhaseChanged', data: {} });
    calls.push('after-emit');

    expect(calls).toEqual(['before-emit', 'handler', 'after-emit']);
  });

  // --- 占位测试 (Batch 0 required) ---

  test('placeholder: Batch 0 infrastructure is operational', () => {
    expect(true).toBe(true);
  });
});
