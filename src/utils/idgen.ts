// ============================================================================
// Union Arena Digital — Instance ID Generator
// ============================================================================
// 为运行时卡牌实例生成唯一 ID。
// 格式: inst-{counter}-{random4hex}
// ============================================================================

let counter = 0;

/**
 * 生成唯一的运行时实例 ID。
 * 格式: "inst-{递增序号}-{4位随机十六进制}"
 */
export function generateInstanceId(): string {
  counter++;
  const randomHex = Math.floor(Math.random() * 0xffff)
    .toString(16)
    .padStart(4, '0');
  return `inst-${counter}-${randomHex}`;
}

/**
 * 重置计数器（仅供测试使用）。
 */
export function resetInstanceCounter(): void {
  counter = 0;
}
