const toggle = document.getElementById('enableToggle');
const toggleRow = document.getElementById('toggleRow');
const logList = document.getElementById('logList');

let skipLog = [];

// Load saved state
chrome.storage.sync.get(['enabled', 'skipLog'], (result) => {
  const enabled = result.enabled !== false; // default true
  toggle.checked = enabled;
  if (result.skipLog) {
    skipLog = result.skipLog;
    renderLog();
  }
});

// Toggle handler
toggle.addEventListener('change', () => {
  const val = toggle.checked;
  chrome.storage.sync.set({ enabled: val });

  // Send message to active Prime Video tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { type: 'SET_ENABLED', value: val }).catch(() => {});
    }
  });
});

toggleRow.addEventListener('click', () => {
  toggle.checked = !toggle.checked;
  toggle.dispatchEvent(new Event('change'));
});

// Listen for skip events from content script
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SKIPPED') {
    const now = new Date();
    const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    skipLog.unshift({ label: msg.label, time });
    if (skipLog.length > 20) skipLog.pop();
    chrome.storage.sync.set({ skipLog });
    renderLog();
  }
});

function renderLog() {
  if (skipLog.length === 0) {
    logList.innerHTML = '<div class="log-empty">No skips yet this session</div>';
    return;
  }
  logList.innerHTML = skipLog.map(entry => `
    <div class="log-item">
      <span class="log-dot"></span>
      <span>${escapeHtml(entry.label)}</span>
      <span class="log-time">${entry.time}</span>
    </div>
  `).join('');
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
