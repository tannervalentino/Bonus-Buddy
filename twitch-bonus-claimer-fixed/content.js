// =====================================
// Twitch Bonus Claimer – content.js
// Improved watch time tracking and streamer detection
// =====================================

let watchStart = Date.now();
let watchInterval = null;
let lastClaimTime = 0;

// Get streamer name from current URL
function getStreamer() {
  try {
    const parts = window.location.pathname.split("/");
    return parts[1] || null;
  } catch {
    return null;
  }
}

// Send messages to bridge
function postToBridge(action, data = {}) {
  window.postMessage({ source: "TWITCH_BONUS_CLAIMER", action, data }, "*");
}

// Get avatar from Twitch page
function getStreamerAvatar() {
  try {
    // Try to find profile image in various places
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
  } catch (e) {
    console.log("Could not get avatar:", e);
  }
  return null;
}

// Initialize streamer data when page loads
function initStreamerData() {
  const streamer = getStreamer();
  if (!streamer) return;
  
  console.log(`[Twitch Bonus Claimer] 📺 Detected streamer: ${streamer}`);
  
  // Wait a bit for page to load
  setTimeout(() => {
    const avatar = getStreamerAvatar();
    postToBridge("streamerDetected", {
      streamer,
      avatar,
      timestamp: new Date().toISOString()
    });
    console.log(`[Twitch Bonus Claimer] ✅ Streamer data initialized`);
  }, 2000);
}

// Update watch time every 10 seconds
function startWatchTimeTracking() {
  const streamer = getStreamer();
  if (!streamer) return;
  
  if (watchInterval) clearInterval(watchInterval);
  
  console.log(`[Twitch Bonus Claimer] ⏱️ Started tracking watch time for ${streamer}`);
  
  watchInterval = setInterval(() => {
    if (document.visibilityState === "visible") {
      const elapsed = Date.now() - watchStart;
      postToBridge("updateWatchTime", {
        streamer,
        delta: elapsed
      });
      watchStart = Date.now(); // Reset start time
    }
  }, 10000); // Update every 10 seconds
}

function clickBonus() {
  const btn = document.querySelector('button[aria-label="Claim Bonus"]');
  if (!btn || btn.offsetParent === null) return;

  const now = Date.now();
  if (now - lastClaimTime < 2000) return;
  lastClaimTime = now;

  // Try to extract points amount
  let points = 50; // Default
  try {
    const pointsText = btn.textContent || btn.innerText;
    const match = pointsText.match(/(\d+)/);
    if (match) points = parseInt(match[1]);
  } catch (e) {
    console.log("[Twitch Bonus Claimer] Could not extract points:", e);
  }

  console.log(`[Twitch Bonus Claimer] 🎉 Claiming ${points} points!`);
  btn.click();

  const streamer = getStreamer();
  if (!streamer) return;

  postToBridge("bonusClaimed", {
    streamer,
    points,
    timestamp: new Date().toISOString(),
  });

  // Update watch time when claiming
  const elapsed = Date.now() - watchStart;
  postToBridge("updateWatchTime", {
    streamer,
    delta: elapsed
  });
  watchStart = Date.now();
  
  console.log(`[Twitch Bonus Claimer] ✅ Bonus claimed for ${streamer}`);
}

// Smart bonus detection using both polling and DOM observation
let bonusCheckInterval = null;
let mutationObserver = null;

function startBonusDetection() {
  // Fallback polling every 5 seconds (lighter than 2.5s)
  bonusCheckInterval = setInterval(clickBonus, 5000);
  
  // Watch for DOM changes that might add the bonus button (zero-cost when idle)
  const chatContainer = document.querySelector('[data-a-target="chat-input"]')?.parentElement?.parentElement;
  
  if (chatContainer) {
    mutationObserver = new MutationObserver(() => {
      // Only check when something changes in chat area
      clickBonus();
    });
    
    mutationObserver.observe(chatContainer, {
      childList: true,
      subtree: true
    });
    
    console.log("[Twitch Bonus Claimer] 👁️ Watching chat for bonus button (optimized mode)");
  } else {
    console.log("[Twitch Bonus Claimer] ⚠️ Chat container not found, using polling only");
  }
}

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStreamerData);
} else {
  initStreamerData();
}

// Start tracking watch time
startWatchTimeTracking();

// Start optimized bonus detection
startBonusDetection();

// Tab visibility to pause watch time tracking
document.addEventListener("visibilitychange", () => {
  const streamer = getStreamer();
  if (!streamer) return;

  if (document.visibilityState === "visible") {
    watchStart = Date.now();
    startWatchTimeTracking();
  } else {
    if (watchInterval) clearInterval(watchInterval);
    const elapsed = Date.now() - watchStart;
    postToBridge("updateWatchTime", {
      streamer,
      delta: elapsed
    });
  }
});

// Save watch time before leaving
window.addEventListener("beforeunload", () => {
  const streamer = getStreamer();
  if (!streamer) return;

  const elapsed = Date.now() - watchStart;
  postToBridge("updateWatchTime", {
    streamer,
    delta: elapsed
  });
  
  // Cleanup
  if (bonusCheckInterval) clearInterval(bonusCheckInterval);
  if (watchInterval) clearInterval(watchInterval);
  if (mutationObserver) mutationObserver.disconnect();
});

// Log extension is active
console.log("[Twitch Bonus Claimer] 🚀 Extension active with optimized bonus detection");

