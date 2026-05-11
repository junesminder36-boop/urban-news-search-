/* ===== 优小码 - AI 智能体小助手 ===== */
(function() {
  'use strict';

  // 避免重复初始化
  if (document.getElementById('aiAssistantWidget')) return;

  // 插入 HTML
  const widgetHtml = `
    <div class="ai-assistant" id="aiAssistantWidget">
      <div class="ai-pet" id="aiPet" title="点击和我聊天">
        <div class="pet-screen">
          <div class="screen-header">
            <span class="dot red"></span>
            <span class="dot yellow"></span>
            <span class="dot green"></span>
          </div>
          <div class="code-lines">
            <div class="code-line line-green"></div>
            <div class="code-line line-blue"></div>
            <div class="code-line line-yellow"></div>
          </div>
        </div>
        <div class="pet-face">
          <div class="pet-eye left"></div>
          <div class="pet-eye right"></div>
        </div>
        <div class="pet-arm left"></div>
        <div class="pet-arm right"></div>
        <div class="pet-keyboard">
          <div class="key-row">
            <span class="key"></span><span class="key"></span><span class="key"></span>
            <span class="key"></span><span class="key"></span><span class="key"></span>
          </div>
          <div class="key-row">
            <span class="key"></span><span class="key"></span><span class="key"></span>
            <span class="key"></span><span class="key"></span>
          </div>
        </div>
      </div>

      <div class="chat-panel hidden" id="chatPanel">
        <div class="chat-header">
          <h3>优小码</h3>
          <button class="chat-close" id="chatClose">&times;</button>
        </div>
        <div class="chat-messages" id="chatMessages">
          <div class="chat-msg bot">
            <div class="chat-avatar">🤖</div>
            <div class="chat-bubble">嗨！我是优小码，你的AI智能体~ 可以帮你搜索资讯、写代码、做分析、回答问题，有什么需要随时叫我！</div>
          </div>
        </div>
        <div class="chat-quick-actions">
          <button data-action="search">🔍 帮我搜索</button>
          <button data-action="daily">📋 生成日报</button>
          <button data-action="code">💻 写段代码</button>
        </div>
        <div class="chat-input-wrap">
          <input type="text" id="chatInput" placeholder="输入消息...">
          <button id="chatSend">发送</button>
        </div>
      </div>
    </div>
  `;
  const div = document.createElement('div');
  div.innerHTML = widgetHtml.trim();
  document.body.appendChild(div.firstChild);

  function escapeHtml(text) {
    const el = document.createElement('div');
    el.textContent = text;
    return el.innerHTML;
  }

  const pet = document.getElementById('aiPet');
  const panel = document.getElementById('chatPanel');
  const closeBtn = document.getElementById('chatClose');
  const messages = document.getElementById('chatMessages');
  const input = document.getElementById('chatInput');
  const sendBtn = document.getElementById('chatSend');
  const quickActions = document.querySelector('.chat-quick-actions');

  function togglePanel() {
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) input.focus();
  }

  pet.addEventListener('click', togglePanel);
  closeBtn.addEventListener('click', () => panel.classList.add('hidden'));

  function appendMsg(text, isBot) {
    const msg = document.createElement('div');
    msg.className = 'chat-msg ' + (isBot ? 'bot' : 'user');
    msg.innerHTML = `
      <div class="chat-avatar">${isBot ? '🤖' : '👤'}</div>
      <div class="chat-bubble">${escapeHtml(text)}</div>
    `;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  function appendLoading() {
    const msg = document.createElement('div');
    msg.className = 'chat-msg bot';
    msg.id = 'chatLoading';
    msg.innerHTML = `
      <div class="chat-avatar">🤖</div>
      <div class="chat-bubble"><span class="chat-loading-dots">思考中<span>.</span><span>.</span><span>.</span></span></div>
    `;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  }

  async function sendMessage(text) {
    if (!text.trim()) return;
    appendMsg(text, false);
    input.value = '';
    const loading = appendLoading();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      loading.remove();
      if (data.error) {
        appendMsg('抱歉，' + data.error, true);
      } else {
        appendMsg(data.reply, true);
      }
    } catch (err) {
      loading.remove();
      appendMsg('网络开小差了，请稍后再试~', true);
    }
  }

  sendBtn.addEventListener('click', () => sendMessage(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage(input.value);
  });

  quickActions.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const action = btn.dataset.action;
    if (action === 'search') {
      sendMessage('我想搜索一些资讯');
    } else if (action === 'daily') {
      sendMessage('帮我生成今天的行业日报');
    } else if (action === 'code') {
      sendMessage('帮我写一段有用的代码');
    }
  });
})();
