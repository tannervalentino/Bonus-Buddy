// Bonus Buddy - Content Script
let lastClaimTime = 0;

function getStreamer() {
  try {
    const parts = window.location.pathname.split("/");
    return parts[1] || null;
  } catch {
    return null;
  }
}

function postToBridge(action, data = {}) {
  window.postMessage({ source: "TWITCH_BONUS_CLAIMER", action, data }, "*");
}

function getStreamerAvatar() {
  try {
    const avatarSelectors = [
      'img[alt*="profile"]',
      'img[class*="avatar"]',
      'a[data-a-target="user-avatar"] img',
      'figure img'
    ];
    
    for (const selector of avatarSelectors) {
      const img = document.querySelector(selector);
      if (img && img.src && img.src.includes('twitch')) {
        return img.src;
      }
    }
  } catch (e) {}
  return null;
}

function getGameName() {
  try {
    const gameSelectors = [
      'a[data-a-target="stream-game-link"]',
      '[class*="ScMediaCardStatWrapper"] a[href*="/directory/game/"]',
      '[data-a-target="video-info-game-boxart"] + a'
    ];
    
    for (const selector of gameSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }
  } catch (e) {}
  return null;
}

function initStreamerData() {
  const streamer = getStreamer();
  if (!streamer) return;
  
  console.log(`[Bonus Buddy] Detected: ${streamer}`);
  
  setTimeout(() => {
    const avatar = getStreamerAvatar();
    const game = getGameName();
    
    postToBridge("streamerDetected", {
      streamer,
      avatar,
      game,
      timestamp: new Date().toISOString()
    });
  }, 2000);
}

function clickBonus() {
  const btn = document.querySelector('button[aria-label="Claim Bonus"]');
  if (!btn || btn.offsetParent === null) return;

  const now = Date.now();
  if (now - lastClaimTime < 2000) return;
  lastClaimTime = now;

  let points = 50;
  try {
    const pointsText = btn.textContent || btn.innerText;
    const match = pointsText.match(/(\d+)/);
    if (match) points = parseInt(match[1]);
  } catch (e) {}

  console.log(`[Bonus Buddy] Claiming ${points} pts`);
  btn.click();

  const streamer = getStreamer();
  if (!streamer) return;

  postToBridge("bonusClaimed", {
    streamer,
    points,
    timestamp: new Date().toISOString(),
  });
}

let bonusCheckInterval = null;
let mutationObserver = null;

function startBonusDetection() {
  bonusCheckInterval = setInterval(clickBonus, 5000);
  
  const chatContainer = document.querySelector('[data-a-target="chat-input"]')?.parentElement?.parentElement;
  
  if (chatContainer) {
    mutationObserver = new MutationObserver(() => {
      clickBonus();
    });
    
    mutationObserver.observe(chatContainer, {
      childList: true,
      subtree: true
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStreamerData);
} else {
  initStreamerData();
}

startBonusDetection();

window.addEventListener("beforeunload", () => {
  if (bonusCheckInterval) clearInterval(bonusCheckInterval);
  if (mutationObserver) mutationObserver.disconnect();
});

console.log("[Bonus Buddy] Active");
