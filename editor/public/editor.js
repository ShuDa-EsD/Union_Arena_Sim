// ============================================================================
// Union Arena Card Editor — Frontend (Vanilla JS, zero deps)
// ============================================================================
// 浏览器端只负责：UI 展示、用户输入、调用服务器 API、展示结果。
// 所有卡牌规则（验证/关键词展开/保存）都在服务器端 CardEditorEngine/CardSystem。
// ============================================================================

const state = {
  schema: null,       // { cardTypes, energyColors, fields }
  keywords: [],       // [{ name, description }]
  cards: [],          // [{ cardId, cardName, cardType, source }]
  card: null,         // 当前编辑中的卡牌对象
  undoStack: [],      // 撤销栈（JSON 快照）
  redoStack: [],      // 重做栈
  dirty: false,
};

// ===== 通用工具 =====

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function setPath(obj, path, value) {
  const parts = path.split('.');
  let node = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (node[k] == null || typeof node[k] !== 'object') node[k] = {};
    node = node[k];
  }
  node[parts[parts.length - 1]] = value;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function status(msg) {
  const el = document.getElementById('status');
  el.textContent = msg + (state.dirty ? '  •  unsaved changes' : '');
}

// ===== 服务器 API =====

async function api(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    const list = data && (data.errors || data.message);
    const msg = Array.isArray(list) ? list.join('; ') : (list || res.statusText);
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return data;
}

// ===== 状态操作 =====

function pushHistory() {
  state.undoStack.push(deepClone(state.card));
  state.redoStack = [];
}

function setField(fieldKey, value) {
  if (!state.card) return;
  pushHistory();
  const next = deepClone(state.card);
  if (value === null && !fieldKey.includes('.')) {
    delete next[fieldKey];
  } else {
    setPath(next, fieldKey, value);
  }
  state.card = next;
  state.dirty = true;
  refreshSidePanels();
  updateUndoButtons();
}

function updateUndoButtons() {
  document.getElementById('btn-undo').disabled = state.undoStack.length === 0;
  document.getElementById('btn-redo').disabled = state.redoStack.length === 0;
}

// ===== 服务器往返 =====

async function refreshCardList() {
  const { cards } = await api('GET', '/api/cards');
  state.cards = cards;
  const ul = document.getElementById('card-list');
  ul.innerHTML = '';
  cards.forEach((c) => {
    const li = document.createElement('li');
    li.textContent = `${c.cardId} — ${c.cardName}`;
    li.title = `source: ${c.source}`;
    li.addEventListener('click', () => loadCard(c.cardId));
    ul.appendChild(li);
  });
}

async function loadCard(cardId) {
  try {
    const card = await api('GET', '/api/cards/' + encodeURIComponent(cardId));
    state.card = card;
    state.undoStack = [];
    state.redoStack = [];
    state.dirty = false;
    renderForm();
    refreshSidePanels();
    updateUndoButtons();
    status(`Loaded ${cardId}`);
  } catch (e) {
    status('Load failed: ' + e.message);
  }
}

async function newCard(type) {
  try {
    const card = await api('GET', '/api/template?cardType=' + encodeURIComponent(type));
    state.card = card;
    state.undoStack = [];
    state.redoStack = [];
    state.dirty = false;
    renderForm();
    refreshSidePanels();
    updateUndoButtons();
    status(`New ${type} card created (fill required fields)`);
  } catch (e) {
    status('Create failed: ' + e.message);
  }
}

async function refreshSidePanels() {
  if (!state.card) { renderPreview(null); renderValidation(null); return; }
  try {
    const [expanded, validation] = await Promise.all([
      api('POST', '/api/preview', state.card),
      api('POST', '/api/validate', state.card),
    ]);
    renderPreview(expanded);
    renderValidation(validation);
  } catch (e) {
    status('Server error: ' + e.message);
  }
}

// ===== 渲染 =====

function renderForm() {
  const empty = document.getElementById('form-empty');
  const fieldsDiv = document.getElementById('form-fields');
  if (!state.card || !state.schema) {
    empty.hidden = false;
    fieldsDiv.hidden = true;
    return;
  }
  empty.hidden = true;
  fieldsDiv.hidden = false;
  fieldsDiv.innerHTML = '';

  const fields = state.schema.fields.filter((f) => f.cardTypes.includes(state.card.cardType));
  fields.forEach((f) => {
    let el;
    if (f.fieldKey === 'keywords') el = renderKeywordsField(f);
    else if (f.type === 'energy-list') el = renderEnergyField(f);
    else if (f.type === 'ability-list') el = renderAbilitiesField(f);
    else if (f.type === 'ability') el = renderTriggerField(f);
    else if (f.type === 'raid') el = renderRaidField(f);
    else el = renderSimpleField(f);
    fieldsDiv.appendChild(el);
  });
}

function renderSimpleField(field) {
  const container = document.createElement('div');
  container.className = 'field';
  const label = document.createElement('label');
  label.textContent = field.label + (field.required ? ' *' : '');
  container.appendChild(label);

  let input;
  if (field.type === 'select') {
    input = document.createElement('select');
    const options = (field.validation && field.validation.options) || [];
    options.forEach((opt) => {
      const o = document.createElement('option');
      o.value = opt;
      o.textContent = opt;
      input.appendChild(o);
    });
  } else if (field.type === 'number') {
    input = document.createElement('input');
    input.type = 'number';
    if (field.validation && field.validation.step) input.step = String(field.validation.step);
  } else {
    input = document.createElement('input');
    input.type = 'text';
  }

  const current = getPath(state.card, field.fieldKey);
  if (field.type === 'tags') {
    input.value = Array.isArray(current) ? current.join(', ') : '';
  } else if (current !== undefined && current !== null) {
    input.value = current;
  }

  input.dataset.fieldKey = field.fieldKey;
  input.dataset.fieldType = field.type;

  input.addEventListener('input', () => {
    let value;
    if (field.type === 'tags') {
      value = input.value.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (field.type === 'number') {
      value = input.value === '' ? 0 : Number(input.value);
    } else {
      value = input.value;
    }
    setField(field.fieldKey, value);
  });

  // 切换 cardType 后需按新类型重新渲染表单字段
  if (field.fieldKey === 'cardType') {
    input.addEventListener('change', () => renderForm());
  }

  container.appendChild(input);
  return container;
}

function renderKeywordsField(field) {
  const container = document.createElement('div');
  container.className = 'field';
  const label = document.createElement('label');
  label.textContent = field.label;
  container.appendChild(label);

  const box = document.createElement('div');
  box.className = 'keyword-tags';
  const current = state.card.keywords || [];
  state.keywords.forEach((kw) => {
    const lbl = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = current.includes(kw.name);
    cb.addEventListener('change', () => {
      const next = cb.checked
        ? Array.from(new Set([...(state.card.keywords || []), kw.name]))
        : (state.card.keywords || []).filter((k) => k !== kw.name);
      setField('keywords', next);
    });
    lbl.appendChild(cb);
    lbl.appendChild(document.createTextNode(' ' + kw.name));
    lbl.title = kw.description;
    box.appendChild(lbl);
  });
  container.appendChild(box);
  return container;
}

function renderEnergyField(field) {
  const container = document.createElement('div');
  container.className = 'field';
  const label = document.createElement('label');
  label.textContent = field.label;
  container.appendChild(label);

  const list = document.createElement('div');
  container.appendChild(list);
  const energies = deepClone(state.card.energyGeneration || []);

  function commit() {
    setField('energyGeneration', deepClone(energies));
  }

  function draw() {
    list.innerHTML = '';
    energies.forEach((e, i) => {
      const row = document.createElement('div');
      const color = document.createElement('select');
      state.schema.energyColors.forEach((c) => {
        const o = document.createElement('option');
        o.value = c;
        o.textContent = c;
        color.appendChild(o);
      });
      color.value = e.color;
      const amt = document.createElement('input');
      amt.type = 'number';
      amt.value = e.amount;
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '✕';

      color.addEventListener('change', () => { e.color = color.value; commit(); });
      amt.addEventListener('input', () => { e.amount = Number(amt.value) || 0; commit(); });
      del.addEventListener('click', () => { energies.splice(i, 1); commit(); draw(); });

      row.append(color, amt, del);
      list.appendChild(row);
    });
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+ Energy';
    addBtn.addEventListener('click', () => {
      energies.push({ color: (state.schema.energyColors || ['白'])[0], amount: 1 });
      commit();
      draw();
    });
    list.appendChild(addBtn);
  }

  draw();
  return container;
}

function renderAbilitiesField(field) {
  const container = document.createElement('div');
  container.className = 'field';
  const label = document.createElement('label');
  label.textContent = field.label;
  container.appendChild(label);

  const list = document.createElement('div');
  container.appendChild(list);
  const abilities = deepClone(state.card.abilities || []);

  function commit() {
    setField('abilities', deepClone(abilities));
  }

  function draw() {
    list.innerHTML = '';
    abilities.forEach((ab, i) => {
      const box = document.createElement('div');
      box.className = 'ability-box';
      const header = document.createElement('div');
      header.className = 'ability-header';
      const title = document.createElement('strong');
      title.textContent = `Ability #${i + 1}`;
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = 'Remove';
      del.addEventListener('click', () => { abilities.splice(i, 1); commit(); draw(); });
      header.append(title, del);
      box.appendChild(header);

      const ta = document.createElement('textarea');
      ta.rows = 5;
      ta.value = JSON.stringify(ab, null, 2);
      ta.addEventListener('input', () => {
        try {
          const parsed = JSON.parse(ta.value);
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
          abilities[i] = parsed;
          ta.classList.remove('json-invalid');
          commit();
        } catch (e) {
          ta.classList.add('json-invalid');
        }
      });
      box.appendChild(ta);
      list.appendChild(box);
    });

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.textContent = '+ Add Ability';
    addBtn.addEventListener('click', () => {
      abilities.push({
        abilityId: `ABL-${abilities.length + 1}`,
        timing: 'WhenPlayed',
        costs: [],
        effects: [],
        isOptional: false,
      });
      commit();
      draw();
    });
    list.appendChild(addBtn);
  }

  draw();
  return container;
}

function renderTriggerField(field) {
  const container = document.createElement('div');
  container.className = 'field';
  const label = document.createElement('label');
  label.textContent = field.label;
  container.appendChild(label);

  const box = document.createElement('div');
  box.className = 'trigger-box';
  const hasTrigger = !!state.card.trigger;

  const enable = document.createElement('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = hasTrigger;
  enable.appendChild(cb);
  enable.appendChild(document.createTextNode(' Has Trigger'));
  box.appendChild(enable);

  const ta = document.createElement('textarea');
  ta.rows = 5;
  ta.hidden = !hasTrigger;
  if (hasTrigger) ta.value = JSON.stringify(state.card.trigger, null, 2);
  box.appendChild(ta);

  cb.addEventListener('change', () => {
    if (cb.checked) {
      const trigger = { abilityId: 'TRIG-1', timing: 'Trigger', costs: [], effects: [], isOptional: true };
      ta.value = JSON.stringify(trigger, null, 2);
      ta.hidden = false;
      setField('trigger', trigger);
    } else {
      ta.hidden = true;
      setField('trigger', null);
    }
  });

  ta.addEventListener('input', () => {
    try {
      const parsed = JSON.parse(ta.value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        ta.classList.remove('json-invalid');
        setField('trigger', parsed);
      } else {
        throw new Error('not an object');
      }
    } catch (e) {
      ta.classList.add('json-invalid');
    }
  });

  container.appendChild(box);
  return container;
}

function renderRaidField(field) {
  const container = document.createElement('div');
  container.className = 'field';
  const label = document.createElement('label');
  label.textContent = field.label;
  container.appendChild(label);

  const box = document.createElement('div');
  box.className = 'raid-box';
  const hasRaid = !!state.card.raid;

  const enable = document.createElement('label');
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = hasRaid;
  enable.appendChild(cb);
  enable.appendChild(document.createTextNode(' Has Raid'));
  box.appendChild(enable);

  const details = document.createElement('div');
  details.hidden = !hasRaid;
  box.appendChild(details);

  const typeRow = document.createElement('div');
  const typeLabel = document.createElement('label');
  typeLabel.textContent = 'Target Type ';
  const typeSel = document.createElement('select');
  ['Name', 'Affinity'].forEach((t) => {
    const o = document.createElement('option');
    o.value = t;
    o.textContent = t;
    typeSel.appendChild(o);
  });
  typeRow.append(typeLabel, typeSel);
  details.appendChild(typeRow);

  const valRow = document.createElement('div');
  const valLabel = document.createElement('label');
  valLabel.textContent = 'Target Value ';
  const valInput = document.createElement('input');
  valInput.type = 'text';
  valRow.append(valLabel, valInput);
  details.appendChild(valRow);

  const abRow = document.createElement('div');
  const abLabel = document.createElement('label');
  abLabel.textContent = 'raidAbilities (JSON array) ';
  const abTa = document.createElement('textarea');
  abTa.rows = 4;
  abRow.append(abLabel, abTa);
  details.appendChild(abRow);

  if (hasRaid && state.card.raid) {
    typeSel.value = (state.card.raid.targetSpecifier && state.card.raid.targetSpecifier.type) || 'Name';
    valInput.value = (state.card.raid.targetSpecifier && state.card.raid.targetSpecifier.value) || '';
    abTa.value = JSON.stringify(state.card.raid.raidAbilities || [], null, 2);
  }

  function buildRaid() {
    const targetSpecifier = { type: typeSel.value, value: valInput.value };
    let raidAbilities = [];
    try {
      const p = JSON.parse(abTa.value);
      if (Array.isArray(p)) raidAbilities = p;
      else { abTa.classList.add('json-invalid'); return null; }
    } catch (e) {
      abTa.classList.add('json-invalid');
      return null;
    }
    abTa.classList.remove('json-invalid');
    return { targetSpecifier, raidAbilities };
  }

  cb.addEventListener('change', () => {
    if (cb.checked) {
      details.hidden = false;
      const raid = buildRaid();
      if (raid) setField('raid', raid);
    } else {
      details.hidden = true;
      setField('raid', null);
    }
  });

  const sync = () => { if (cb.checked) { const raid = buildRaid(); if (raid) setField('raid', raid); } };
  typeSel.addEventListener('change', sync);
  valInput.addEventListener('input', sync);
  abTa.addEventListener('input', sync);

  container.appendChild(box);
  return container;
}

function renderValidation(result) {
  const v = document.getElementById('validation');
  if (!result) { v.innerHTML = '<span class="muted">No card loaded.</span>'; return; }
  if (result.valid) {
    v.innerHTML = '<div class="ok">✅ Valid</div>';
  } else {
    v.innerHTML = '<div class="error">❌ Invalid</div><ul>' +
      result.errors.map((e) => `<li>${escapeHtml(e)}</li>`).join('') + '</ul>';
  }
}

function renderPreview(expanded) {
  const p = document.getElementById('preview');
  if (!expanded) { p.innerHTML = '<span class="muted">No card loaded.</span>'; return; }
  let html = `<div class="preview-card">${escapeHtml(expanded.cardName || '(unnamed)')} [${escapeHtml(expanded.cardType)}]`;
  if (expanded.bp) html += ` BP ${expanded.bp.base}`;
  html += '</div>';
  html += `<div>Energy: ${escapeHtml(expanded.requiredEnergy ? `${expanded.requiredEnergy.color}×${expanded.requiredEnergy.amount}` : '—')}</div>`;
  if (expanded.keywords && expanded.keywords.length) {
    html += `<div>Keywords: ${expanded.keywords.map(escapeHtml).join(', ')}</div>`;
  }
  html += `<div>Abilities (${expanded.abilities.length}):</div>`;
  expanded.abilities.forEach((a) => {
    const fx = (a.effects || []).map((e) => e.effectType).join(', ') || '(no effects)';
    html += `<div class="preview-ability">• ${escapeHtml(a.timing || '(no timing)')}: ${escapeHtml(fx)}</div>`;
  });
  if (expanded.trigger) {
    html += `<div class="preview-ability">• Trigger: ${escapeHtml(expanded.trigger.timing || '')}</div>`;
  }
  p.innerHTML = html;
}

// ===== 保存 / 导出 / 撤销 / 重做 =====

async function save() {
  if (!state.card) { status('Nothing to save'); return; }
  try {
    const res = await api('POST', '/api/cards', state.card);
    state.dirty = false;
    status(`Saved → ${res.path}`);
    await refreshCardList();
  } catch (e) {
    status('Save failed: ' + e.message);
  }
}

function exportJson() {
  if (!state.card) { status('Nothing to export'); return; }
  const blob = new Blob([JSON.stringify(state.card, null, 2) + '\n'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = (state.card.cardId || 'card') + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  status('Exported JSON');
}

function undo() {
  if (!state.undoStack.length) return;
  state.redoStack.push(deepClone(state.card));
  state.card = state.undoStack.pop();
  renderForm();
  refreshSidePanels();
  updateUndoButtons();
  status('Undo');
}

function redo() {
  if (!state.redoStack.length) return;
  state.undoStack.push(deepClone(state.card));
  state.card = state.redoStack.pop();
  renderForm();
  refreshSidePanels();
  updateUndoButtons();
  status('Redo');
}

// ===== 初始化 =====

function wireEvents() {
  document.querySelectorAll('.new-type').forEach((btn) => {
    btn.addEventListener('click', () => newCard(btn.dataset.type));
  });
  document.getElementById('btn-refresh').addEventListener('click', refreshCardList);
  document.getElementById('btn-undo').addEventListener('click', undo);
  document.getElementById('btn-redo').addEventListener('click', redo);
  document.getElementById('btn-save').addEventListener('click', save);
  document.getElementById('btn-export').addEventListener('click', exportJson);
}

async function init() {
  try {
    state.schema = await api('GET', '/api/schema');
    state.keywords = (await api('GET', '/api/keywords')).keywords;
    wireEvents();
    await refreshCardList();
    status('Ready.');
  } catch (e) {
    status('Init failed: ' + e.message);
  }
}

init();
