/**
 * 阿福 AFU — AI 协作管家
 * 正式对话系统：SSE 流式 + 任务契约 + 多 Agent + 交接卡
 */
(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════
     State
     ═══════════════════════════════════════════════════════ */
  var sessionId = null;
  var currentContract = null;
  var contractConfirmed = false;
  var hasStarted = false;
  var isStreaming = false;
  var importedContext = '';
  var currentModule = 'auto';
  var clarifyRound = 0;
  var accumulatedDimensions = {};

  /* ═══════════════════════════════════════════════════════
     Init
     ═══════════════════════════════════════════════════════ */
  function init() {
    document.getElementById('userInput').focus();
    document.getElementById('chatArea').addEventListener('click', function(e) {
      if (e.target === this) document.getElementById('userInput').focus();
    });
  }

  /* ═══════════════════════════════════════════════════════
     Turn Navigation (right sidebar)
     ═══════════════════════════════════════════════════════ */
  var turnCount = 0;
  var pendingUserMsg = null;   // wait for afu reply before creating a turn node
  var turnObserver = null;

  function initTurnObserver() {
    if (turnObserver) return;
    turnObserver = new IntersectionObserver(function(entries) {
      var best = null;
      entries.forEach(function(e) {
        if (e.isIntersecting && (!best || e.intersectionRatio > best.intersectionRatio)) {
          best = e;
        }
      });
      if (best) {
        var turnIdx = best.target.getAttribute('data-turn');
        if (turnIdx !== null) highlightTurnNode(parseInt(turnIdx));
      }
    }, { threshold: [0, 0.3, 0.6, 1] });
  }

  function addTurnNode(userText, afuText) {
    initTurnObserver();
    turnCount++;
    var idx = turnCount;
    var shortLabel = userLabel(userText);

    // Create turn node in nav
    var list = document.getElementById('turnNavList');
    if (!list) return;
    var btn = document.createElement('button');
    btn.className = 'turn-node';
    btn.id = 'turnNode' + idx;
    btn.innerHTML =
      '<span class="turn-line-top"></span>' +
      '<span class="turn-line-bottom"></span>' +
      '<span class="turn-dot"></span>' +
      '<span class="turn-label">' + escapeHtml(shortLabel) + '</span>' +
      '<span class="turn-tooltip">第' + idx + '轮 · ' + escapeHtml(shortLabel) + '</span>';
    btn.onclick = function() { scrollToTurn(idx); };
    list.appendChild(btn);

    // Tag the afu message div (last child of messages) with data-turn
    var msgs = document.getElementById('messages');
    if (msgs) {
      var afuMsgs = msgs.querySelectorAll('.msg-afu');
      var lastAfu = afuMsgs[afuMsgs.length - 1];
      if (lastAfu) {
        lastAfu.setAttribute('data-turn', idx);
        turnObserver.observe(lastAfu);
      }
    }
    // Also tag user bubbles
    var userMsgs = document.getElementById('messages').querySelectorAll('.msg-user');
    var lastUser = userMsgs[userMsgs.length - 1];
    if (lastUser) lastUser.setAttribute('data-turn', idx);

    highlightTurnNode(idx);
  }

  function highlightTurnNode(idx) {
    document.querySelectorAll('.turn-node').forEach(function(n) {
      n.classList.remove('active');
    });
    var node = document.getElementById('turnNode' + idx);
    if (node) node.classList.add('active');
  }

  function scrollToTurn(idx) {
    var el = document.querySelector('.msg-afu[data-turn="' + idx + '"]');
    if (!el) el = document.querySelector('.msg-user[data-turn="' + idx + '"]');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      highlightTurnNode(idx);
    }
  }

  function userLabel(text) {
    // Generate a short label from user input
    var t = (text || '').replace(/\s+/g, ' ').trim();
    if (t.length <= 12) return t;
    // Take first 10 chars + ...
    return t.substring(0, 10) + '…';
  }

  /* ═══════════════════════════════════════════════════════
     Contract Sidebar
     ═══════════════════════════════════════════════════════ */
  function renderContract(contract) {
    if (!contract || !contract.goal) return;
    currentContract = contract;

    var empty = document.getElementById('contractEmpty');
    var card = document.getElementById('contractCard');
    if (empty) empty.style.display = 'none';
    if (card) card.style.display = 'flex';

    setText('ccGoal', contract.goal || '');
    var scope = contract.scope || {};
    setList('ccScopeIn', scope.in || scope.in_ || []);
    setList('ccScopeOut', scope.out || []);
    setList('ccConstraints', contract.constraints || []);
    toggleSection('ccConstraintsSection', contract.constraints);
    setListCheck('ccAcceptance', contract.acceptance || []);
    toggleSection('ccAcceptanceSection', contract.acceptance);
    setListWarn('ccRisks', contract.risks || []);
    toggleSection('ccRisksSection', contract.risks);

    var deliv = contract.deliverables || {};
    var parts = [];
    if (deliv.format) parts.push('格式: ' + deliv.format);
    if (deliv.artifacts && deliv.artifacts.length) parts.push('产物: ' + deliv.artifacts.join(', '));
    setText('ccDeliverables', parts.join(' · '));
    toggleSection('ccDeliverablesSection', parts.length > 0);

    var conf = contract.confidence || 0;
    var pct = Math.round(conf * 100);
    setText('ccConfPct', pct + '%');
    var bar = document.getElementById('ccConfBar');
    if (bar) bar.style.width = pct + '%';

    var status = contract.status || (contract.confirmed_by_user ? 'confirmed' : 'draft');
    updateContractStatus(status);

    var actions = document.getElementById('ccActions');
    if (actions) {
      actions.style.display = (contract.confirmed_by_user || contractConfirmed) ? 'none' : 'flex';
    }
  }

  function updateContractStatus(status) {
    var el = document.getElementById('ccStatus');
    if (!el) return;
    var badge = el.querySelector('.cc-status-badge');
    if (!badge) { badge = document.createElement('span'); badge.className = 'cc-status-badge'; el.appendChild(badge); }
    badge.className = 'cc-status-badge ' + (status || 'draft');
    badge.textContent = status === 'confirmed' ? '已确认' : status === 'executing' ? '执行中…' : status === 'completed' ? '已完成' : '草稿';
  }

  window.confirmContract = async function () {
    if (!currentContract || !sessionId) return;
    try {
      var resp = await fetch('/api/chat/' + sessionId + '/contract/confirm', { method: 'POST' });
      if (resp.ok) {
        var data = await resp.json();
        contractConfirmed = true;
        currentContract = data.contract;
        updateContractStatus('confirmed');
        var actions = document.getElementById('ccActions');
        if (actions) actions.style.display = 'none';
        var bar = document.getElementById('ccConfBar');
        if (bar) bar.style.width = '100%';
        setText('ccConfPct', '100%');
      }
    } catch (e) {
      contractConfirmed = true;
      if (currentContract) { currentContract.confirmed_by_user = true; currentContract.status = 'confirmed'; }
      updateContractStatus('confirmed');
      var actions = document.getElementById('ccActions');
      if (actions) actions.style.display = 'none';
    }
  };

  window.modifyContract = function () {
    makeEditable('ccGoal', 'goal', 'text');
    makeEditableList('ccScopeIn', 'scope.in');
    makeEditableList('ccScopeOut', 'scope.out');
    makeEditableList('ccConstraints', 'constraints');
    makeEditableList('ccAcceptance', 'acceptance');
    makeEditableList('ccRisks', 'risks');
    var btn = document.getElementById('ccBtnModify');
    if (btn) {
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><polyline points="20 6 9 17 4 12"/></svg><span>保存修改</span>';
      btn.onclick = saveContractEdits;
    }
    updateContractStatus('draft');
    contractConfirmed = false;
  };

  function makeEditable(elId, field, type) {
    var el = document.getElementById(elId);
    if (!el || !currentContract) return;
    var value = type === 'text' ? (currentContract.goal || '') : '';
    el.innerHTML = '<input class="cc-edit" id="edit_' + field + '" value="' + escapeAttr(value) + '" placeholder="输入' + field + '...">';
  }

  function makeEditableList(elId, field) {
    var el = document.getElementById(elId);
    if (!el || !currentContract) return;
    var items = [];
    if (field === 'scope.in') items = (currentContract.scope || {}).in || (currentContract.scope || {}).in_ || [];
    else if (field === 'scope.out') items = (currentContract.scope || {}).out || [];
    else if (field === 'constraints') items = currentContract.constraints || [];
    else if (field === 'acceptance') items = currentContract.acceptance || [];
    else if (field === 'risks') items = currentContract.risks || [];
    var html = '<textarea class="cc-edit cc-edit-ta" id="edit_' + field + '" placeholder="每行一项">' + items.join('\n') + '</textarea>';
    html += '<p class="cc-edit-hint">每行一项，修改后点"保存修改"</p>';
    el.innerHTML = html;
  }

  async function saveContractEdits() {
    if (!currentContract || !sessionId) return;
    var updates = {};
    var goalEl = document.getElementById('edit_goal');
    if (goalEl) updates.goal = goalEl.value.trim();
    var scopeInEl = document.getElementById('edit_scope.in');
    var scopeOutEl = document.getElementById('edit_scope.out');
    if (scopeInEl || scopeOutEl) {
      updates.scope = {};
      if (scopeInEl) updates.scope['in'] = scopeInEl.value.split('\n').filter(function(s) { return s.trim(); });
      if (scopeOutEl) updates.scope.out = scopeOutEl.value.split('\n').filter(function(s) { return s.trim(); });
    }
    ['constraints', 'acceptance', 'risks'].forEach(function(f) {
      var el = document.getElementById('edit_' + f);
      if (el) updates[f] = el.value.split('\n').filter(function(s) { return s.trim(); });
    });
    try {
      var resp = await fetch('/api/chat/' + sessionId + '/contract/update', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates)
      });
      if (resp.ok) { var data = await resp.json(); currentContract = data.contract; renderContract(currentContract); }
    } catch (e) {
      if (updates.goal) currentContract.goal = updates.goal;
      if (updates.scope) currentContract.scope = updates.scope;
      ['constraints', 'acceptance', 'risks'].forEach(function(f) { if (updates[f]) currentContract[f] = updates[f]; });
      renderContract(currentContract);
    }
    var btn = document.getElementById('ccBtnModify');
    if (btn) {
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg><span>修改</span>';
      btn.onclick = modifyContract;
    }
  }

  function escapeAttr(s) { if (!s) return ''; return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  /* ═══════════════════════════════════════════════════════
     Send Message → SSE Backend
     ═══════════════════════════════════════════════════════ */
  window.sendMessage = function () {
    if (isStreaming) return;
    var input = document.getElementById('userInput');
    var text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';

    if (!hasStarted) { hasStarted = true; hideEmptyState(); }

    appendUserMessage(text);
    setSendDisabled(true);
    isStreaming = true;

    var body = JSON.stringify({
      message: text,
      session_id: sessionId || null,
      module: currentModule,
      background: '',
      extra_context: importedContext || '',
      clarify_round: clarifyRound,
      dimensions: accumulatedDimensions
    });

    importedContext = '';  // consume once

    fetch('/api/chat/stream?v=2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body
    }).then(function(response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      handleSSEStream(response);
    }).catch(function(err) {
      console.error('[Chat] fetch failed:', err);
      appendAfuMessage('连接失败，请稍后重试。');
      setSendDisabled(false);
      isStreaming = false;
    });
  };

  function setSendDisabled(disabled) {
    var btn = document.getElementById('sendBtn');
    if (btn) {
      btn.disabled = disabled;
      btn.style.opacity = disabled ? '0.25' : '';
    }
  }

  /* ═══════════════════════════════════════════════════════
     SSE Stream Reader
     ═══════════════════════════════════════════════════════ */
  function handleSSEStream(response) {
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var currentEvent = 'message';

    function processChunk() {
      reader.read().then(function(result) {
        if (result.done) {
          setSendDisabled(false);
          isStreaming = false;
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i];
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            var dataStr = line.slice(6);
            try {
              var data = JSON.parse(dataStr);
              // The EventSourceResponse puts the full dict including event/data wrapper on data: line
              // So we need to check both cases
              if (data.event && data.data !== undefined) {
                // sse-starlette format: data: {"event": "...", "data": {...}}
                handleSSEPayload(data.event, data.data);
              } else {
                // Direct format: event: xxx\n data: {...}
                handleSSEPayload(currentEvent, data);
              }
            } catch(e) {
              // skip unparseable
            }
          }
        }
        processChunk();
      }).catch(function(err) {
        console.error('[SSE] read error:', err);
        appendAfuMessage('连接中断，请重试。');
        setSendDisabled(false);
        isStreaming = false;
      });
    }
    processChunk();
  }

  /* ═══════════════════════════════════════════════════════
     SSE Event Handlers
     ═══════════════════════════════════════════════════════ */
  var toolIndicatorEl = null;
  var streamingMsgEl = null;
  var streamingContent = '';

  function handleSSEPayload(eventType, data) {
    switch (eventType) {
      case 'session':
        sessionId = data.session_id;
        currentModule = data.module || 'auto';
        break;

      case 'thinking':
        // Agent is processing — could show a spinner
        break;

      case 'contract':
        if (data.contract && data.contract.goal) {
          renderContract(data.contract);
        }
        break;

      case 'token':
        // Token-level streaming — append to current message
        if (!streamingMsgEl) {
          streamingMsgEl = createStreamingMessage();
          streamingContent = '';
        }
        streamingContent += data.content || '';
        updateStreamingContent(streamingContent);
        break;

      case 'tool_start':
        if (!toolIndicatorEl) {
          toolIndicatorEl = createToolIndicator();
        }
        updateToolIndicator(toolIndicatorEl, data.tool_name || 'unknown', 'running');
        break;

      case 'tool_end':
        if (toolIndicatorEl) {
          updateToolIndicator(toolIndicatorEl, data.tool_name || 'unknown', 'done');
          setTimeout(function() {
            if (toolIndicatorEl) { toolIndicatorEl.remove(); toolIndicatorEl = null; }
          }, 1500);
        }
        break;

      case 'clarify':
        finalizeStreaming();
        appendAfuMessage(data.message || '');
        clarifyRound = (clarifyRound || 0) + 1;
        break;

      case 'execute':
        finalizeStreaming();
        appendAfuMessage(data.message || '');
        clarifyRound = 0;
        break;

      case 'multi_agent_perspective':
        appendPerspectiveCard(data);
        break;

      case 'multi_agent_synthesis':
        finalizeStreaming();
        appendAfuMessage(data.synthesis || '');
        break;

      case 'error':
        finalizeStreaming();
        appendAfuMessage('出错了：' + (data.detail || '未知错误'));
        break;

      case 'done':
        setSendDisabled(false);
        isStreaming = false;
        finalizeStreaming();
        if (data.tokens_used > 0) {
          console.log('[Chat] done. tokens:', data.tokens_used);
        }
        break;
    }
  }

  function finalizeStreaming() {
    if (streamingMsgEl) {
      var contentEl = streamingMsgEl.querySelector('.msg-content');
      if (contentEl) contentEl.innerHTML = simpleMarkdown(streamingContent);
      streamingMsgEl = null;
      streamingContent = '';
    }
  }

  /* ═══════════════════════════════════════════════════════
     DOM Builders
     ═══════════════════════════════════════════════════════ */
  function createStreamingMessage() {
    var container = document.getElementById('messages');
    var div = document.createElement('div');
    div.className = 'msg msg-afu msg-streaming';
    var row = document.createElement('div');
    row.className = 'msg-row';
    row.innerHTML =
      '<div class="msg-avatar"><img src="source/alfred.jpg" alt="阿福"></div>' +
      '<div class="msg-body">' +
        '<div class="msg-sender">阿福 <span class="msg-role">输入中…</span></div>' +
        '<div class="msg-content"></div>' +
      '</div>';
    div.appendChild(row);
    container.appendChild(div);
    scrollDown();
    return div;
  }

  function updateStreamingContent(text) {
    if (!streamingMsgEl) return;
    var contentEl = streamingMsgEl.querySelector('.msg-content');
    if (contentEl) contentEl.innerHTML = simpleMarkdown(text);
    scrollDown();
  }

  function createToolIndicator() {
    var container = document.getElementById('messages');
    var div = document.createElement('div');
    div.className = 'msg msg-tool';
    div.innerHTML = '<div class="tool-indicator"><span class="tool-spinner"></span><span class="tool-name"></span></div>';
    container.appendChild(div);
    scrollDown();
    return div;
  }

  function updateToolIndicator(el, name, state) {
    var nameEl = el.querySelector('.tool-name');
    var spinnerEl = el.querySelector('.tool-spinner');
    if (nameEl) nameEl.textContent = name;
    if (state === 'done') {
      el.classList.add('tool-done');
      if (spinnerEl) spinnerEl.style.display = 'none';
    }
  }

  function appendUserMessage(text) {
    var container = document.getElementById('messages');
    var div = document.createElement('div');
    div.className = 'msg msg-user';
    div.innerHTML = '<div class="msg-bubble">' + escapeHtml(text) + '</div>';
    container.appendChild(div);
    pendingUserMsg = text;
    scrollDown();
  }

  function appendAfuMessage(text) {
    var container = document.getElementById('messages');
    var div = document.createElement('div');
    div.className = 'msg msg-afu';
    var row = document.createElement('div');
    row.className = 'msg-row';
    row.innerHTML =
      '<div class="msg-avatar"><img src="source/alfred.jpg" alt="阿福"></div>' +
      '<div class="msg-body">' +
        '<div class="msg-sender">阿福</div>' +
        '<div class="msg-content">' + simpleMarkdown(text) + '</div>' +
      '</div>';
    div.appendChild(row);

    var copyRow = document.createElement('div');
    copyRow.className = 'copy-row';
    var copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg><span>复制</span>';
    copyBtn.onclick = function () { window.copyMessage(copyBtn, text); };
    copyRow.appendChild(copyBtn);
    div.appendChild(copyRow);

    container.appendChild(div);

    // Turn node: user message + this afu reply = one turn
    if (pendingUserMsg) {
      addTurnNode(pendingUserMsg, text);
      pendingUserMsg = null;
    }
    scrollDown();
  }

  /* ═══════════════════════════════════════════════════════
     Multi-Agent Perspective Cards
     ═══════════════════════════════════════════════════════ */
  function appendPerspectiveCard(data) {
    var container = document.getElementById('messages');
    var div = document.createElement('div');
    div.className = 'msg msg-afu msg-perspective';
    div.id = 'perspective-' + data.key;
    div.style.borderLeft = '2px solid ' + (data.color || '#555');
    var row = document.createElement('div');
    row.className = 'msg-row';
    row.innerHTML =
      '<div class="msg-avatar"><span style="font-size:1.5rem;line-height:40px;display:block;text-align:center">' + (data.icon || '🤖') + '</span></div>' +
      '<div class="msg-body">' +
        '<div class="msg-sender"><span style="color:' + (data.color || '') + '">' + (data.label || data.key) + '</span>' +
        ' <span class="msg-role">' + (data.elapsed_ms || 0) + 'ms</span></div>' +
        '<div class="msg-content msg-content-rich">' + simpleMarkdown(data.output || '') + '</div>' +
      '</div>';
    div.appendChild(row);
    container.appendChild(div);
    scrollDown();
  }

  /* ═══════════════════════════════════════════════════════
     Handover Card — Download / Import
     ═══════════════════════════════════════════════════════ */
  var downloadFormat = 'md';
  var selectedFile = null;

  window.selectFormat = function (fmt) {
    downloadFormat = fmt;
    var mdEl = document.getElementById('mfMd');
    var jsonEl = document.getElementById('mfJson');
    var btn = document.getElementById('btnDoDownload');
    if (mdEl) mdEl.classList.toggle('active', fmt === 'md');
    if (jsonEl) jsonEl.classList.toggle('active', fmt === 'json');
    if (btn) btn.disabled = false;
  };

  window.doDownload = async function () {
    var btn = document.getElementById('btnDoDownload');
    if (!sessionId) { alert('请先发送一条消息开始对话'); return; }
    if (btn) { btn.disabled = true; btn.textContent = '生成中…'; }
    try {
      var resp = await fetch('/api/sessions/' + sessionId + '/handover/download?format=' + downloadFormat);
      if (!resp.ok) { var err = await resp.json().catch(function() { return {}; }); throw new Error(err.detail || 'HTTP ' + resp.status); }
      var blob = await resp.blob();
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      var disposition = resp.headers.get('Content-Disposition') || '';
      var fnameMatch = disposition.match(/filename="?(.+?)"?$/);
      a.download = fnameMatch ? fnameMatch[1] : 'alfred_handover.' + downloadFormat;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
      closeModal('modalDownload');
    } catch (e) { alert('下载失败：' + e.message); }
    if (btn) { btn.disabled = false; btn.textContent = '下载'; }
  };

  window.handleDragOver = function (e) { e.preventDefault(); e.stopPropagation(); };
  window.handleDrop = function (e) { e.preventDefault(); e.stopPropagation(); var files = e.dataTransfer.files; if (files.length > 0) setImportFile(files[0]); };
  window.handleFileSelect = function (e) { if (e.target.files.length > 0) setImportFile(e.target.files[0]); };

  function setImportFile(file) {
    selectedFile = file;
    var hint = document.getElementById('uploadHint');
    var btn = document.getElementById('btnDoImport');
    if (hint) hint.textContent = '已选择: ' + file.name + ' (' + formatSize(file.size) + ')';
    if (btn) btn.disabled = false;
    var area = document.getElementById('uploadArea');
    if (area) area.classList.add('has-file');
  }

  window.doImport = async function () {
    if (!selectedFile) return;
    var btn = document.getElementById('btnDoImport');
    if (btn) { btn.disabled = true; btn.textContent = '导入中…'; }
    try {
      var form = new FormData(); form.append('file', selectedFile);
      var resp = await fetch('/api/sessions/import', { method: 'POST', body: form });
      if (!resp.ok) { var err = await resp.json().catch(function() { return {}; }); throw new Error(err.detail || 'HTTP ' + resp.status); }
      var result = await resp.json();
      closeModal('modalImport');
      if (result.context_text) {
        importedContext = result.context_text;
        var input = document.getElementById('userInput');
        if (input) { input.value = '继续上次的项目工作'; autoResize(input); }
        appendAfuMessage(
          '**已加载项目交接卡**\n\n' +
          (result.handover.current_goal ? '上次目标：' + result.handover.current_goal + '\n\n' : '') +
          '告诉我你想继续什么，我会基于上次的进度推进。'
        );
        if (!hasStarted) { hasStarted = true; hideEmptyState(); }
      }
    } catch (e) { alert('导入失败：' + e.message); }
    if (btn) { btn.disabled = false; btn.textContent = '导入'; }
  };

  var _origOpenModal = window.openModal;
  window.openModal = function (id) {
    if (id === 'modalImport') {
      selectedFile = null;
      var hint = document.getElementById('uploadHint');
      var btn = document.getElementById('btnDoImport');
      var area = document.getElementById('uploadArea');
      var fileInput = document.getElementById('fileInput');
      if (hint) hint.textContent = '支持 .md / .json 格式';
      if (btn) btn.disabled = true;
      if (area) area.classList.remove('has-file');
      if (fileInput) fileInput.value = '';
    }
    if (id === 'modalDownload') {
      downloadFormat = 'md';
      var btn2 = document.getElementById('btnDoDownload');
      if (btn2) btn2.disabled = true;
      var mdEl = document.getElementById('mfMd');
      var jsonEl = document.getElementById('mfJson');
      if (mdEl) mdEl.classList.remove('active');
      if (jsonEl) jsonEl.classList.remove('active');
    }
    _origOpenModal(id);
  };

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  /* ═══════════════════════════════════════════════════════
     Helpers
     ═══════════════════════════════════════════════════════ */
  function hideEmptyState() {
    var es = document.getElementById('emptyState');
    var msgs = document.getElementById('messages');
    if (es) es.style.display = 'none';
    if (msgs) msgs.style.display = 'block';
  }

  function setText(id, text) { var el = document.getElementById(id); if (el) el.textContent = text || ''; }

  function setList(id, items) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '';
    (items || []).forEach(function(item) { var li = document.createElement('li'); li.textContent = item; el.appendChild(li); });
  }

  function setListCheck(id, items) { setList(id, items); var el = document.getElementById(id); if (el) el.className = 'cc-list cc-list-check'; }
  function setListWarn(id, items) { setList(id, items); var el = document.getElementById(id); if (el) el.className = 'cc-list cc-list-warn'; }

  function toggleSection(id, items) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.display = (items && items.length > 0) ? '' : 'none';
  }

  /* ═══════════════════════════════════════════════════════
     Markdown rendering
     ═══════════════════════════════════════════════════════ */
  function simpleMarkdown(text) {
    if (!text) return '';
    var html = escapeHtml(text);
    // code blocks
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>');
    // inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // tables
    html = html.replace(/(\n\|.*\|(?:\n\|[-| :]*\|)?(?:\n\|.*\|)+)/g, function(m) {
      var rows = m.trim().split('\n');
      var out = '<table class="msg-table">';
      for (var i = 0; i < rows.length; i++) {
        var cells = rows[i].split('|').filter(function(c) { return c.trim(); });
        if (i === 1 && /^[-| :]+$/.test(rows[i].replace(/\|/g, ''))) continue;
        var tag = (i === 0) ? 'th' : 'td';
        out += '<tr>';
        cells.forEach(function(c) { out += '<' + tag + '>' + c.trim() + '</' + tag + '>'; });
        out += '</tr>';
      }
      return out + '</table>';
    });
    // bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // headers
    html = html.replace(/^#### (.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^## (.+)$/gm, '<h3>$1</h3>');
    // hr
    html = html.replace(/^---$/gm, '<hr>');
    // newlines
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    return '<p>' + html + '</p>';
  }

  function scrollDown() {
    var area = document.getElementById('chatArea');
    if (area) area.scrollTop = area.scrollHeight;
  }

  function escapeHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  /* ═══════════════════════════════════════════════════════
     Keyboard / Modal / Copy
     ═══════════════════════════════════════════════════════ */
  window.useExample = function (text) {
    var input = document.getElementById('userInput');
    input.value = text;
    input.focus();
    autoResize(input);
    window.sendMessage();
  };

  window.handleKey = function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      window.sendMessage();
    }
  };

  window.autoResize = function (el) {
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  };

  window.openModal = function (id) {
    var el = document.getElementById(id);
    if (el) el.classList.add('active');
  };

  window.closeModal = function (id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove('active');
  };

  window.closeModalBg = function (e) {
    if (e.target.classList.contains('modal-overlay')) {
      e.target.classList.remove('active');
    }
  };

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(function (m) { m.classList.remove('active'); });
    }
  });

  window.copyMessage = function (btn, text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { showCopied(btn); }).catch(function () { fallbackCopy(btn, text); });
    } else { fallbackCopy(btn, text); }
  };

  function fallbackCopy(btn, text) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); showCopied(btn); } catch (e) {}
    document.body.removeChild(ta);
  }

  function showCopied(btn) {
    var orig = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>已复制</span>';
    setTimeout(function () { btn.classList.remove('copied'); btn.innerHTML = orig; }, 1800);
  }

  init();
})();
