/**
 * PlanTop — Flow builder kết hợp Clender × Upbain
 */
(() => {
  'use strict';

  // ── State ──
  let nodes = [];
  let connections = [];
  let customIdeas = [];
  let selectedNodeId = null;
  let selectedConnId = null;
  let connectingFrom = null;
  let dragState = null;
  let panState = null;
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let nodeIdCounter = 1;
  let connIdCounter = 1;
  let history = [];
  const MAX_HISTORY = 40;

  // ── DOM refs ──
  const $ = (sel) => document.querySelector(sel);
  const paletteClender = $('#paletteClender');
  const paletteUpbain = $('#paletteUpbain');
  const paletteCustom = $('#paletteCustom');
  const customEmpty = $('#customEmpty');
  const nodesLayer = $('#nodesLayer');
  const connectionsSvg = $('#connectionsSvg');
  const canvasWrap = $('#canvasWrap');
  const viewport = $('#viewport');
  const canvasHint = $('#canvasHint');
  const ideaInput = $('#ideaInput');
  const zoomLabel = $('#zoomLabel');

  // ── Init ──
  function init() {
    renderPalettes();
    bindEvents();
    loadFromStorage();
    applyTransform();
    updateStats();
  }

  function renderPalettes() {
    paletteClender.innerHTML = PALETTE.clender.map((item) => paletteItemHTML(item, 'clender')).join('');
    paletteUpbain.innerHTML = PALETTE.upbain.map((item) => paletteItemHTML(item, 'upbain')).join('');
    renderCustomPalette();
    bindPaletteDrag();
  }

  function paletteItemHTML(item, source, deletable = false) {
    return `
      <div class="palette-item ${source}" draggable="true"
           data-source="${source}" data-type="${item.type}"
           data-label="${esc(item.label)}" data-desc="${esc(item.desc)}" data-icon="${item.icon}">
        <span class="pi-icon">${item.icon}</span>
        <div class="pi-text">
          <div class="pi-label">${esc(item.label)}</div>
          <div class="pi-desc">${esc(item.desc)}</div>
        </div>
        ${deletable ? `<button class="pi-delete" data-id="${item.id}" title="Xóa">×</button>` : ''}
      </div>`;
  }

  function renderCustomPalette() {
    const items = customIdeas.map((idea) =>
      paletteItemHTML({ type: 'custom', icon: '✨', label: idea.label, desc: idea.desc || 'Ý tưởng tự tạo', id: idea.id }, 'custom', true)
    ).join('');
    paletteCustom.innerHTML = items || '<p class="empty-hint" id="customEmpty">Chưa có ý tưởng — nhập ở thanh trên</p>';
    bindPaletteDrag();
    bindCustomDelete();
  }

  function bindPaletteDrag() {
    document.querySelectorAll('.palette-item[draggable]').forEach((el) => {
      el.addEventListener('dragstart', onPaletteDragStart);
      el.addEventListener('dragend', () => el.classList.remove('dragging'));
    });
  }

  function bindCustomDelete() {
    paletteCustom.querySelectorAll('.pi-delete').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        customIdeas = customIdeas.filter((i) => i.id !== id);
        saveCustomIdeas();
        renderCustomPalette();
        toast('Đã xóa ý tưởng khỏi bảng gợi ý');
      });
    });
  }

  // ── Events ──
  function bindEvents() {
    $('#addIdeaBtn').addEventListener('click', addCustomIdea);
    ideaInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addCustomIdea(); });

    canvasWrap.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    canvasWrap.addEventListener('drop', onCanvasDrop);

    canvasWrap.addEventListener('mousedown', onCanvasMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    canvasWrap.addEventListener('wheel', onWheel, { passive: false });

    $('#zoomInBtn').addEventListener('click', () => setZoom(zoom * 1.15));
    $('#zoomOutBtn').addEventListener('click', () => setZoom(zoom / 1.15));
    $('#fitBtn').addEventListener('click', fitToView);
    $('#saveBtn').addEventListener('click', saveToStorage);
    $('#loadBtn').addEventListener('click', loadFromStorage);
    $('#exportBtn').addEventListener('click', exportJSON);
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', importJSON);
    $('#clearBtn').addEventListener('click', clearAll);
    $('#undoBtn').addEventListener('click', undo);

    $('#inspectorLabel').addEventListener('input', updateSelectedNode);
    $('#inspectorDesc').addEventListener('input', updateSelectedNode);
    $('#deleteNodeBtn').addEventListener('click', deleteSelectedNode);

    document.addEventListener('keydown', (e) => {
      if (e.target.matches('input, textarea')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedConnId) { deleteConnection(selectedConnId); return; }
        if (selectedNodeId) deleteSelectedNode();
      }
      if (e.key === 'Escape') cancelConnecting();
      if (e.key === ' ' && !panState) { e.preventDefault(); canvasWrap.classList.add('panning'); }
    });
    document.addEventListener('keyup', (e) => {
      if (e.key === ' ') canvasWrap.classList.remove('panning');
    });
  }

  function addCustomIdea() {
    const label = ideaInput.value.trim();
    if (!label) { toast('Vui lòng nhập ý tưởng'); return; }
    customIdeas.push({ id: `c${Date.now()}`, label, desc: 'Ý tưởng tự tạo' });
    ideaInput.value = '';
    saveCustomIdeas();
    renderCustomPalette();
    toast(`Đã thêm "${label}" vào bảng gợi ý`);
  }

  // ── Drag from palette ──
  function onPaletteDragStart(e) {
    const el = e.currentTarget;
    e.dataTransfer.setData('application/json', JSON.stringify({
      source: el.dataset.source,
      type: el.dataset.type,
      label: el.dataset.label,
      desc: el.dataset.desc,
      icon: el.dataset.icon,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }

  function onCanvasDrop(e) {
    e.preventDefault();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    const data = JSON.parse(raw);
    const pos = screenToCanvas(e.clientX, e.clientY);
    createNode({ ...data, x: pos.x - 80, y: pos.y - 30 });
  }

  // ── Node CRUD ──
  function createNode(data) {
    pushHistory();
    const node = {
      id: `n${nodeIdCounter++}`,
      source: data.source,
      type: data.type,
      icon: data.icon,
      label: data.label,
      desc: data.desc || '',
      x: data.x ?? 100,
      y: data.y ?? 100,
    };
    nodes.push(node);
    renderNode(node);
    hideHint();
    updateStats();
    selectNode(node.id);
    return node;
  }

  function renderNode(node) {
    let el = document.getElementById(node.id);
    if (!el) {
      el = document.createElement('div');
      el.id = node.id;
      el.className = `flow-node source-${node.source}`;
      nodesLayer.appendChild(el);

      el.innerHTML = `
        <div class="port port-in" data-port="in" title="Cổng vào"></div>
        <div class="node-header">
          <span class="node-icon">${node.icon}</span>
          <span class="node-label">${esc(node.label)}</span>
          <span class="node-type-badge">${node.source}</span>
        </div>
        <div class="node-desc">${esc(node.desc)}</div>
        <div class="port port-out" data-port="out" title="Cổng ra — click để nối"></div>`;

      el.querySelector('.port-in').addEventListener('mousedown', (e) => onPortClick(e, node.id, 'in'));
      el.querySelector('.port-out').addEventListener('mousedown', (e) => onPortClick(e, node.id, 'out'));
      el.addEventListener('mousedown', (e) => onNodeMouseDown(e, node.id));
      el.addEventListener('dblclick', (e) => { e.stopPropagation(); startInlineEdit(node.id); });
    } else {
      el.querySelector('.node-label').textContent = node.label;
      el.querySelector('.node-desc').textContent = node.desc;
      el.querySelector('.node-icon').textContent = node.icon;
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
    }
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;
  }

  function renderAllNodes() {
    nodesLayer.innerHTML = '';
    nodes.forEach(renderNode);
  }

  function deleteNode(id) {
    pushHistory();
    nodes = nodes.filter((n) => n.id !== id);
    connections = connections.filter((c) => c.from !== id && c.to !== id);
    const el = document.getElementById(id);
    if (el) el.remove();
    if (selectedNodeId === id) selectNode(null);
    renderConnections();
    updateStats();
    if (nodes.length === 0) showHint();
  }

  function deleteSelectedNode() {
    if (!selectedNodeId) return;
    deleteNode(selectedNodeId);
    toast('Đã xóa node');
  }

  function selectNode(id) {
    selectedNodeId = id;
    selectedConnId = null;
    document.querySelectorAll('.flow-node').forEach((el) => el.classList.toggle('selected', el.id === id));
    document.querySelectorAll('.conn-path').forEach((el) => el.classList.remove('selected'));
    updateInspector();
  }

  function updateInspector() {
    const empty = $('#inspectorEmpty');
    const content = $('#inspectorContent');
    if (!selectedNodeId) {
      empty.hidden = false;
      content.hidden = true;
      return;
    }
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    empty.hidden = true;
    content.hidden = false;
    $('#inspectorLabel').value = node.label;
    $('#inspectorDesc').value = node.desc;
    $('#inspectorSource').textContent = node.source;
    $('#inspectorType').textContent = node.type;
  }

  function updateSelectedNode() {
    const node = nodes.find((n) => n.id === selectedNodeId);
    if (!node) return;
    node.label = $('#inspectorLabel').value;
    node.desc = $('#inspectorDesc').value;
    renderNode(node);
    updateStats();
  }

  function startInlineEdit(id) {
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    const el = document.getElementById(id);
    const labelEl = el.querySelector('.node-label');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = node.label;
    input.style.cssText = 'width:100%;font-size:13px;font-weight:600;background:var(--bg-deep);border:1px solid var(--clender);border-radius:4px;padding:2px 6px;color:var(--text);';
    labelEl.replaceWith(input);
    input.focus();
    input.select();
    const finish = () => {
      node.label = input.value.trim() || node.label;
      renderNode(node);
      updateInspector();
      updateStats();
    };
    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur();
      if (e.key === 'Escape') { input.value = node.label; input.blur(); }
    });
  }

  // ── Connections ──
  function onPortClick(e, nodeId, port) {
    e.stopPropagation();
    e.preventDefault();
    if (port === 'out') {
      if (connectingFrom === nodeId) { cancelConnecting(); return; }
      connectingFrom = nodeId;
      document.getElementById(nodeId)?.classList.add('connecting');
      toast('Click cổng VÀO của node đích để nối');
    } else if (port === 'in' && connectingFrom) {
      if (connectingFrom !== nodeId) createConnection(connectingFrom, nodeId);
      cancelConnecting();
    }
  }

  function cancelConnecting() {
    if (connectingFrom) {
      document.getElementById(connectingFrom)?.classList.remove('connecting');
      connectingFrom = null;
    }
  }

  function createConnection(fromId, toId) {
    const exists = connections.some((c) => c.from === fromId && c.to === toId);
    if (exists) { toast('Kết nối đã tồn tại'); return; }
    if (wouldCreateCycle(fromId, toId)) { toast('Không thể tạo vòng lặp'); return; }
    pushHistory();
    const conn = { id: `c${connIdCounter++}`, from: fromId, to: toId };
    connections.push(conn);
    renderConnections();
    updateStats();
    toast('Đã nối 2 node');
  }

  function wouldCreateCycle(fromId, toId) {
    const visited = new Set();
    const dfs = (id) => {
      if (id === fromId) return true;
      if (visited.has(id)) return false;
      visited.add(id);
      return connections.filter((c) => c.from === id).some((c) => dfs(c.to));
    };
    return dfs(toId);
  }

  function deleteConnection(id) {
    pushHistory();
    connections = connections.filter((c) => c.id !== id);
    selectedConnId = null;
    renderConnections();
    updateStats();
    toast('Đã xóa kết nối');
  }

  function getPortPos(nodeId, port) {
    const el = document.getElementById(nodeId);
    if (!el) return { x: 0, y: 0 };
    const portEl = el.querySelector(`.port-${port}`);
    const nodeRect = { x: parseFloat(el.style.left), y: parseFloat(el.style.top) };
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    return {
      x: nodeRect.x + (port === 'out' ? w : 0),
      y: nodeRect.y + h / 2,
    };
  }

  function renderConnections() {
    connectionsSvg.querySelectorAll('.conn-path').forEach((p) => p.remove());
    connections.forEach((conn) => {
      const from = getPortPos(conn.from, 'out');
      const to = getPortPos(conn.to, 'in');
      const dx = Math.abs(to.x - from.x) * 0.5;
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${from.x} ${from.y} C ${from.x + dx} ${from.y}, ${to.x - dx} ${to.y}, ${to.x} ${to.y}`);
      path.setAttribute('class', 'conn-path');
      path.setAttribute('marker-end', 'url(#arrowhead)');
      path.dataset.id = conn.id;
      path.style.pointerEvents = 'stroke';
      path.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedConnId = conn.id;
        selectedNodeId = null;
        document.querySelectorAll('.flow-node').forEach((el) => el.classList.remove('selected'));
        document.querySelectorAll('.conn-path').forEach((el) => el.classList.toggle('selected', el.dataset.id === conn.id));
        toast('Nhấn Del để xóa kết nối');
      });
      connectionsSvg.appendChild(path);
    });
  }

  // ── Mouse interactions ──
  function onNodeMouseDown(e, nodeId) {
    if (e.target.classList.contains('port')) return;
    e.stopPropagation();
    selectNode(nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    const pos = screenToCanvas(e.clientX, e.clientY);
    dragState = { nodeId, offsetX: pos.x - node.x, offsetY: pos.y - node.y, moved: false };
    document.getElementById(nodeId)?.classList.add('dragging');
  }

  function onCanvasMouseDown(e) {
    if (e.button === 1 || (e.button === 0 && e.target === canvasWrap || e.target === viewport || e.target === connectionsSvg || e.target.closest('.canvas-hint'))) {
      if (e.button === 0 && !e.target.closest('.canvas-hint') && e.target !== canvasWrap && e.target !== viewport && e.target !== connectionsSvg) return;
      panState = { startX: e.clientX - panX, startY: e.clientY - panY };
      canvasWrap.classList.add('panning');
      return;
    }
    if (e.target === canvasWrap || e.target === viewport || e.target === connectionsSvg) {
      selectNode(null);
      cancelConnecting();
    }
  }

  function onMouseMove(e) {
    if (dragState) {
      const pos = screenToCanvas(e.clientX, e.clientY);
      const node = nodes.find((n) => n.id === dragState.nodeId);
      if (node) {
        if (!dragState.moved) { pushHistory(); dragState.moved = true; }
        node.x = pos.x - dragState.offsetX;
        node.y = pos.y - dragState.offsetY;
        renderNode(node);
        renderConnections();
      }
    }
    if (panState) {
      panX = e.clientX - panState.startX;
      panY = e.clientY - panState.startY;
      applyTransform();
    }
  }

  function onMouseUp() {
    if (dragState) {
      document.getElementById(dragState.nodeId)?.classList.remove('dragging');
      dragState = null;
      updateStats();
    }
    if (panState) {
      panState = null;
      canvasWrap.classList.remove('panning');
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const rect = canvasWrap.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newZoom = clamp(zoom * factor, 0.25, 2.5);
    panX = mx - (mx - panX) * (newZoom / zoom);
    panY = my - (my - panY) * (newZoom / zoom);
    zoom = newZoom;
    applyTransform();
  }

  // ── Transform ──
  function screenToCanvas(sx, sy) {
    const rect = canvasWrap.getBoundingClientRect();
    return { x: (sx - rect.left - panX) / zoom, y: (sy - rect.top - panY) / zoom };
  }

  function applyTransform() {
    viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  }

  function setZoom(z) {
    zoom = clamp(z, 0.25, 2.5);
    applyTransform();
  }

  function fitToView() {
    if (nodes.length === 0) { zoom = 1; panX = 0; panY = 0; applyTransform(); return; }
    const padding = 60;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((n) => {
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + 200);
      maxY = Math.max(maxY, n.y + 80);
    });
    const cw = canvasWrap.clientWidth;
    const ch = canvasWrap.clientHeight;
    const bw = maxX - minX + padding * 2;
    const bh = maxY - minY + padding * 2;
    zoom = clamp(Math.min(cw / bw, ch / bh), 0.25, 1.5);
    panX = (cw - bw * zoom) / 2 - minX * zoom + padding * zoom;
    panY = (ch - bh * zoom) / 2 - minY * zoom + padding * zoom;
    applyTransform();
  }

  // ── Stats & Summary ──
  function updateStats() {
    $('#statNodes').textContent = nodes.length;
    $('#statConns').textContent = connections.length;
    $('#flowSummary').textContent = buildFlowSummary();
  }

  function buildFlowSummary() {
    if (nodes.length === 0) return '(trống)';
    const lines = [];
    const roots = nodes.filter((n) => !connections.some((c) => c.to === n.id));
    const visited = new Set();

    function walk(id, depth) {
      if (visited.has(id)) return;
      visited.add(id);
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      const prefix = '  '.repeat(depth) + (depth > 0 ? '→ ' : '');
      lines.push(`${prefix}[${node.source}] ${node.label}`);
      connections.filter((c) => c.from === id).forEach((c) => walk(c.to, depth + 1));
    }

    if (roots.length === 0) nodes.forEach((n) => walk(n.id, 0));
    else roots.forEach((n) => walk(n.id, 0));

    nodes.filter((n) => !visited.has(n.id)).forEach((n) => {
      lines.push(`(riêng) [${n.source}] ${n.label}`);
    });

    return lines.join('\n');
  }

  // ── Persistence ──
  function getState() {
    return { nodes, connections, customIdeas, nodeIdCounter, connIdCounter, zoom, panX, panY };
  }

  function setState(state) {
    nodes = state.nodes || [];
    connections = state.connections || [];
    customIdeas = state.customIdeas || [];
    nodeIdCounter = state.nodeIdCounter || 1;
    connIdCounter = state.connIdCounter || 1;
    zoom = state.zoom ?? 1;
    panX = state.panX ?? 0;
    panY = state.panY ?? 0;
    renderCustomPalette();
    renderAllNodes();
    renderConnections();
    applyTransform();
    nodes.length ? hideHint() : showHint();
    updateStats();
    selectNode(null);
  }

  function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(getState()));
    toast('Đã lưu vào trình duyệt');
  }

  function loadFromStorage() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try { setState(JSON.parse(raw)); toast('Đã tải bản lưu'); }
    catch { toast('Lỗi khi tải dữ liệu'); }
  }

  function saveCustomIdeas() {
    const raw = localStorage.getItem(STORAGE_KEY);
    const state = raw ? JSON.parse(raw) : getState();
    state.customIdeas = customIdeas;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `plantop-flow-${Date.now()}.json`;
    a.click();
    toast('Đã xuất file JSON');
  }

  function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        pushHistory();
        setState(JSON.parse(reader.result));
        toast('Đã nhập JSON thành công');
      } catch { toast('File JSON không hợp lệ'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function clearAll() {
    if (!confirm('Xóa toàn bộ sơ đồ? Hành động này không thể hoàn tác.')) return;
    pushHistory();
    nodes = [];
    connections = [];
    renderAllNodes();
    renderConnections();
    showHint();
    updateStats();
    selectNode(null);
    toast('Đã xóa sơ đồ');
  }

  // ── History ──
  function pushHistory() {
    history.push(JSON.stringify(getState()));
    if (history.length > MAX_HISTORY) history.shift();
  }

  function undo() {
    if (!history.length) { toast('Không có gì để hoàn tác'); return; }
    const prev = history.pop();
    setState(JSON.parse(prev));
    toast('Đã hoàn tác');
  }

  // ── Helpers ──
  function showHint() { canvasHint.style.display = ''; }
  function hideHint() { canvasHint.style.display = 'none'; }

  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(el._timer);
    el._timer = setTimeout(() => { el.hidden = true; }, 2500);
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  init();
})();
