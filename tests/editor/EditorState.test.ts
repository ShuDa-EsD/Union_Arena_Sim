// ============================================================================
// EditorState — undo/redo 与 dirty 追踪独立测试
// ============================================================================

import { CardEditorEngine } from '../../editor/CardEditorEngine';
import { createTestCharacter } from '../fixtures/test_cards';

describe('EditorState — dirty 追踪', () => {
  const engine = new CardEditorEngine();

  test('importCard 后 dirty = false', () => {
    const state = engine.importCard(createTestCharacter({ cardId: 'D-1' }));
    expect(state.dirty).toBe(false);
    expect(state.isNew).toBe(false);
  });

  test('createTemplate 新建卡 dirty = true', () => {
    const state = engine.createTemplate('Character');
    expect(state.dirty).toBe(true);
    expect(state.isNew).toBe(true);
  });

  test('编辑字段后 dirty = true', () => {
    let state = engine.importCard(createTestCharacter({ cardId: 'D-2' }));
    state = engine.updateField(state, 'cardName', 'Changed');
    expect(state.dirty).toBe(true);
  });

  test('undo 回到已保存快照后 dirty = false', () => {
    let state = engine.importCard(createTestCharacter({ cardId: 'D-3' }));
    state = engine.updateField(state, 'cardName', 'Changed');
    expect(state.dirty).toBe(true);
    state = engine.undo(state);
    expect(state.dirty).toBe(false);
  });

  test('新建卡 undo 后仍 dirty = true（尚未保存）', () => {
    let state = engine.createTemplate('Character');
    state = engine.updateField(state, 'cardName', 'Warrior');
    expect(state.dirty).toBe(true);
    state = engine.undo(state);
    expect(state.dirty).toBe(true);
  });
});

describe('EditorState — undo / redo', () => {
  const engine = new CardEditorEngine();

  test('初始无 undo/redo', () => {
    const state = engine.createTemplate('Character');
    expect(engine.canUndo(state)).toBe(false);
    expect(engine.canRedo(state)).toBe(false);
  });

  test('编辑后可 undo，undo 后可 redo', () => {
    let state = engine.importCard(createTestCharacter({ cardId: 'U-1' }));
    state = engine.updateField(state, 'cardName', 'A');
    state = engine.updateField(state, 'cardName', 'B');
    expect(state.card.cardName).toBe('B');
    expect(engine.canUndo(state)).toBe(true);

    state = engine.undo(state);
    expect(state.card.cardName).toBe('A');
    expect(engine.canRedo(state)).toBe(true);

    state = engine.redo(state);
    expect(state.card.cardName).toBe('B');
    expect(engine.canRedo(state)).toBe(false);
  });

  test('空栈 undo/redo 返回原状态（不报错）', () => {
    let state = engine.createTemplate('Event');
    const before = state;
    state = engine.undo(state);
    expect(state).toBe(before);
    state = engine.redo(state);
    expect(state).toBe(before);
  });

  test('新编辑清空 redo 栈', () => {
    let state = engine.importCard(createTestCharacter({ cardId: 'U-2' }));
    state = engine.updateField(state, 'cardName', 'A');
    state = engine.undo(state);
    expect(engine.canRedo(state)).toBe(true);
    state = engine.updateField(state, 'cardName', 'C');
    expect(engine.canRedo(state)).toBe(false);
    expect(state.card.cardName).toBe('C');
  });

  test('undo 栈深度等于编辑次数', () => {
    let state = engine.importCard(createTestCharacter({ cardId: 'U-3' }));
    state = engine.updateField(state, 'cardName', '1');
    state = engine.updateField(state, 'cardName', '2');
    state = engine.updateField(state, 'cardName', '3');
    expect(state.undoStack).toHaveLength(3);
  });

  test('undo 使用深拷贝快照，不影响当前状态', () => {
    let state = engine.importCard(createTestCharacter({ cardId: 'U-4', cardName: 'Original' }));
    state = engine.updateField(state, 'cardName', 'Edited');
    state = engine.undo(state);
    expect(state.card.cardName).toBe('Original');
    // 快照是深拷贝，原状态中的对象不被后续编辑污染
    expect(state.undoStack).toHaveLength(0);
  });
});
