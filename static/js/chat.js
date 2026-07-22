/**
 * 阿福 AFU — AI 协作管家
 * 前端视觉演示：空状态 · 模拟对话 · 复制 · 弹窗
 * 本阶段不接入后端，不处理真实数据。
 */
(function () {
  'use strict';

  // Demo conversation — 静态消息对，展示视觉效果
  var demoMessages = [
    { role: 'user', text: '我想继续完善阿福的比赛设计稿，但现在思路比较散。' },
    { role: 'afu',  text: '当然。我们可以先确认这份设计稿需要向评委证明什么，再决定展示界面、交互流程还是技术架构。' },
    { role: 'user', text: '先从主要界面开始。' },
    { role: 'afu',  text: '明白。我会先围绕对话体验、项目记忆导入与摘要下载三个可见入口整理界面。' },
  ];

  var demoIndex = 0;
  var hasStarted = false;

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
     Send / Demo Flow
     ═══════════════════════════════════════════════════════ */
  window.sendMessage = function () {
    var input = document.getElementById('userInput');
    var text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';

    // 首次发送 → 隐藏空状态，显示消息区
    if (!hasStarted) {
      hasStarted = true;
      hideEmptyState();
    }

    // 显示用户消息
    appendUserMessage(text);

    // 模拟阿福回复（从 demo 队列取下一句）
    if (demoIndex < demoMessages.length) {
      var reply = demoMessages[demoIndex];
      // 跳过用户消息，找到阿福的回复
      while (demoIndex < demoMessages.length) {
        var next = demoMessages[demoIndex];
        demoIndex++;
        if (next.role === 'afu') {
          setTimeout(function() {
            appendAfuMessage(next.text);
          }, 600);
          return;
        }
      }
      // 队列用完，发一句兜底
      setTimeout(function() {
        appendAfuMessage('好的，我们继续。');
      }, 600);
      return;
    }

    // demo 用完后，静默（本阶段不接后端）
    setTimeout(function() {
      appendAfuMessage('（本阶段为前端视觉演示，对话内容为静态示例。）');
    }, 600);
  };

  function hideEmptyState() {
    var es = document.getElementById('emptyState');
    var msgs = document.getElementById('messages');
    if (es) es.style.display = 'none';
    if (msgs) msgs.style.display = 'block';
  }

  /* ═══════════════════════════════════════════════════════
     Example Questions
     ═══════════════════════════════════════════════════════ */
  window.useExample = function (text) {
    var input = document.getElementById('userInput');
    input.value = text;
    input.focus();
    autoResize(input);
    window.sendMessage();
  };

  /* ═══════════════════════════════════════════════════════
     Keyboard
     ═══════════════════════════════════════════════════════ */
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

  /* ═══════════════════════════════════════════════════════
     Modal
     ═══════════════════════════════════════════════════════ */
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

  // ESC 关闭弹窗
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(function (m) {
        m.classList.remove('active');
      });
    }
  });

  /* ═══════════════════════════════════════════════════════
     Copy
     ═══════════════════════════════════════════════════════ */
  window.copyMessage = function (btn, text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        showCopied(btn);
      }).catch(function () {
        fallbackCopy(btn, text);
      });
    } else {
      fallbackCopy(btn, text);
    }
  };

  function fallbackCopy(btn, text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); showCopied(btn); } catch (e) {}
    document.body.removeChild(ta);
  }

  function showCopied(btn) {
    var orig = btn.innerHTML;
    btn.classList.add('copied');
    btn.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
      '<span>已复制</span>';
    setTimeout(function () {
      btn.classList.remove('copied');
      btn.innerHTML = orig;
    }, 1800);
  }

  /* ═══════════════════════════════════════════════════════
     DOM — Messages
     ═══════════════════════════════════════════════════════ */
  function appendUserMessage(text) {
    var container = document.getElementById('messages');
    var div = document.createElement('div');
    div.className = 'msg msg-user';
    div.innerHTML = '<div class="msg-bubble">' + escapeHtml(text) + '</div>';
    container.appendChild(div);
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
        '<div class="msg-content">' + plainText(text) + '</div>' +
      '</div>';
    div.appendChild(row);

    // Copy button
    var copyRow = document.createElement('div');
    copyRow.className = 'copy-row';
    var copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
      '<span>复制</span>';
    copyBtn.onclick = function () { window.copyMessage(copyBtn, text); };
    copyRow.appendChild(copyBtn);
    div.appendChild(copyRow);

    container.appendChild(div);
    scrollDown();
  }

  function scrollDown() {
    var area = document.getElementById('chatArea');
    if (area) {
      area.scrollTop = area.scrollHeight;
    }
  }

  /* ═══════════════════════════════════════════════════════
     Helpers
     ═══════════════════════════════════════════════════════ */
  function escapeHtml(s) {
    var d = document.createElement('div');
    d.appendChild(document.createTextNode(s));
    return d.innerHTML;
  }

  function plainText(s) {
    // 简单展示文本，本阶段不做 Markdown 解析
    return escapeHtml(s).replace(/\n/g, '<br>');
  }

  init();
})();
