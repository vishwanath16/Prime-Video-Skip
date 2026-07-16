// Amazon Prime Video - Auto Skip Extension
// Watches for "Skip Intro", "Skip Credits", "Skip Recap" buttons and clicks them automatically

(function () {
  const SELECTORS = [
    // Skip Intro
    '[data-testid="skip-intro"]',
    '.skipelement',
    'button.skipelement',
    '[class*="SkipButton"]',
    '[class*="skip-intro"]',
    '[class*="skipIntro"]',

    // Skip Credits
    '[data-testid="skip-credits"]',
    '[class*="skip-credits"]',
    '[class*="skipCredits"]',

    // Skip Recap / Previously On
    '[data-testid="skip-recap"]',
    '[class*="skip-recap"]',
    '[class*="skipRecap"]',
  ];

  // Text patterns to match on buttons (case-insensitive)
  // NOTE: "Next Episode" is intentionally excluded — we only skip recaps/intros/credits
  // NOTE: "Watch credits" is intentionally excluded — see NEVER_CLICK_PATTERNS below.
  const SKIP_TEXT_PATTERNS = [
    /^skip intro$/i,
    /^skip recap$/i,
    /^skip credits$/i,
    /^skip previously$/i,
    /^skip opening$/i,
  ];

  // Labels that must NEVER be clicked, even if they happen to match one of the
  // CSS selectors above. Prime's end-of-season "Next Up" card shows a "Watch
  // credits" button that does the OPPOSITE of skipping: clicking it cancels
  // the built-in autoplay countdown to the next episode. That was causing the
  // extension to boot the user back to the show's homepage instead of letting
  // Prime advance to the next episode on its own.
  const NEVER_CLICK_PATTERNS = [
    /^watch credits$/i,
  ];

  let lastClickedButton = null;
  let lastClickTime = 0;
  const COOLDOWN_MS = 3000; // Don't re-click the same button within 3 seconds

  function getLabel(el) {
    const text = (el.innerText || el.textContent || '').trim();
    const aria = (el.getAttribute('aria-label') || '').trim();
    return text || aria;
  }

  function isForbidden(label) {
    return NEVER_CLICK_PATTERNS.some((pattern) => pattern.test(label));
  }

  function findAndClickSkipButton() {
    // Try CSS selectors first
    for (const selector of SELECTORS) {
      try {
        const buttons = document.querySelectorAll(selector);
        for (const btn of buttons) {
          const label = getLabel(btn);
          if (isForbidden(label)) continue; // never click, regardless of selector match
          if (isVisible(btn) && shouldClick(btn)) {
            clickButton(btn, label);
            return;
          }
        }
      } catch (e) {
        // Invalid selector, skip
      }
    }

    // Fallback: scan all buttons for skip text (exact trimmed match)
    const candidates = document.querySelectorAll('button, [role="button"], [class*="Button"], [class*="button"]');
    for (const el of candidates) {
      const label = getLabel(el);
      if (isForbidden(label)) continue;
      if (SKIP_TEXT_PATTERNS.some((pattern) => pattern.test(label))) {
        if (isVisible(el) && shouldClick(el)) {
          clickButton(el, label);
          return;
        }
      }
    }
  }

  function isVisible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    );
  }

  function shouldClick(btn) {
    const now = Date.now();
    if (btn === lastClickedButton && now - lastClickTime < COOLDOWN_MS) {
      return false;
    }
    return true;
  }

  function clickButton(btn, label) {
    const now = Date.now();
    lastClickedButton = btn;
    lastClickTime = now;

    const resolvedLabel = label || (btn.innerText || btn.textContent || 'button').trim();
    console.log(`[Prime Auto-Skip] Clicking: "${resolvedLabel}"`);

    // Dispatch a real mouse click event
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    btn.click();

    // Notify popup/badge (optional)
    try {
      chrome.runtime.sendMessage({ type: 'SKIPPED', label: resolvedLabel });
    } catch (e) {
      // Extension context might be invalidated, ignore
    }
  }

  // Poll every 800ms — Prime Video is a SPA, buttons appear dynamically
  let enabled = true;

  // Read persisted setting
  chrome.storage.sync.get(['enabled'], (result) => {
    if (result.enabled === false) enabled = false;
  });

  // Listen for toggle from popup
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'SET_ENABLED') {
      enabled = msg.value;
    }
  });

  setInterval(() => {
    if (enabled) {
      findAndClickSkipButton();
    }
  }, 800);

})();
