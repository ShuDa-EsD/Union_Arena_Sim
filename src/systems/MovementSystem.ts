// ============================================================================
// Union Arena Digital — MovementSystem (Batch 2)
// ============================================================================
// 移动验证 + 容量超限处理。
// B2 实现基础移动（能量线→前线），Step 关键词在 B5 加入。
// ============================================================================

import { GameState, StateChange, Zone } from '../core/types';

export class MovementSystem {
  /**
   * 验证移动合法性。
   */
  canMove(
    state: GameState,
    playerId: string,
    instanceId: string,
    from: Zone,
    to: Zone,
  ): { valid: boolean; error?: string } {
    const player = state.players[playerId];
    if (!player) return { valid: false, error: 'Player not found' };

    // 只能在能量线和前线之间移动
    if (from === 'FrontLine' && to === 'EnergyLine') {
      return { valid: false, error: 'Reverse movement requires Step keyword (B5)' };
    }
    if (from === 'EnergyLine' && to === 'FrontLine') {
      // 正向移动：允许
    } else {
      return { valid: false, error: `Cannot move from ${from} to ${to}` };
    }

    // 检查源区域是否有该卡
    const sourceZone = from === 'EnergyLine' ? player.energyLine : player.frontLine;
    const card = sourceZone.find((c) => c.instanceId === instanceId);
    if (!card) return { valid: false, error: `Card ${instanceId} not found in ${from}` };

    return { valid: true };
  }

  /**
   * 执行角色移动。
   * 目标满 4 张时：为要移入的角色移除目标线 1 张卡（进 Sideline）。
   */
  moveCharacter(
    state: GameState,
    playerId: string,
    instanceId: string,
    from: Zone,
    to: Zone,
  ): StateChange[] {
    const player = state.players[playerId];
    const changes: StateChange[] = [];

    // 目标区域容量检查
    const targetZone = to === 'FrontLine' ? player.frontLine : player.energyLine;
    if (targetZone.length >= 4) {
      // 容量超限：移除目标线最后 1 张卡到 Sideline
      const toRemove = targetZone[targetZone.length - 1];
      changes.push({
        type: 'MOVE_CARD',
        instanceId: toRemove.instanceId,
        from: to,
        to: 'Sideline',
        playerId,
      });
    }

    // 移动目标卡牌
    changes.push({
      type: 'MOVE_CARD',
      instanceId,
      from,
      to,
      playerId,
    });

    return changes;
  }
}
