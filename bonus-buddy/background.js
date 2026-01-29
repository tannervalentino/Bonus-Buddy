chrome.runtime.onInstalled.addListener((details) => {
  console.log("[Bonus Buddy Background] onInstalled reason:", details.reason);
  
  // Only initialize defaults on FIRST install, not on update or reload
  if (details.reason === 'install') {
    console.log("[Bonus Buddy Background] First install - setting defaults");
    chrome.storage.local.set({
      enabled: true,
      claims: [],
      totalPoints: 0,
      streamers: {},
      hasUnreadClaims: false
    }, () => {
      console.log("[Bonus Buddy Background] ✅ Default data initialized");
    });
    // Set initial icon to gray
    chrome.action.setIcon({ path: "icon-gray.png" });
  } else if (details.reason === 'update') {
    console.log("[Bonus Buddy Background] Extension updated - preserving data");
    // Verify data is still there
    chrome.storage.local.get(['claims', 'totalPoints'], (res) => {
      const claimCount = Array.isArray(res.claims) ? res.claims.length : 0;
      const totalPoints = res.totalPoints || 0;
      console.log(`[Bonus Buddy Background] ✅ Data preserved: ${claimCount} claims, ${totalPoints} total points`);
      
      // Restore icon state
      if (res.hasUnreadClaims) {
        chrome.action.setIcon({ path: "icon-purple.png" });
        console.log("[Bonus Buddy Background] Restored purple icon (unread claims)");
      } else {
        chrome.action.setIcon({ path: "icon-gray.png" });
        console.log("[Bonus Buddy Background] Restored gray icon");
      }
    });
  } else {
    // 'chrome_update', 'shared_module_update', or browser/extension reload
    console.log("[Bonus Buddy Background] Extension reloaded - preserving data");
    // Verify data after reload
    chrome.storage.local.get(['claims', 'totalPoints', 'hasUnreadClaims'], (res) => {
      const claimCount = Array.isArray(res.claims) ? res.claims.length : 0;
      const totalPoints = res.totalPoints || 0;
      console.log(`[Bonus Buddy Background] ✅ Data preserved: ${claimCount} claims, ${totalPoints} total points`);
      
      // Restore icon state
      if (res.hasUnreadClaims) {
        chrome.action.setIcon({ path: "icon-purple.png" });
        console.log("[Bonus Buddy Background] Restored purple icon (unread claims)");
      } else {
        chrome.action.setIcon({ path: "icon-gray.png" });
        console.log("[Bonus Buddy Background] Restored gray icon");
      }
    });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[Background] Received message:", msg.action, msg);
  
  // Handle streamer detection (when user lands on a stream)
  if (msg.action === "streamerDetected") {
    console.log("[Background] Streamer detected:", msg.streamer);
    chrome.storage.local.get(["streamers", "streaks"], (res) => {
      const streamers = res.streamers || {};
      const streaks = res.streaks || {};
      
      // Store streamer info
      if (!streamers[msg.streamer]) {
        streamers[msg.streamer] = {
          name: msg.streamer,
          avatar: msg.avatar,
          game: msg.game,
          firstSeen: msg.timestamp
        };
      }
      
      // Update avatar if available
      if (msg.avatar && streamers[msg.streamer]) {
        streamers[msg.streamer].avatar = msg.avatar;
      }
      
      // Update game if available
      if (msg.game && streamers[msg.streamer]) {
        streamers[msg.streamer].game = msg.game;
      }
      
      chrome.storage.local.set({ streamers, streaks }, () => {
        console.log("[Background] Saved streamer data");
      });
    });
  }

  // Handle bonus claims
  if (msg.action === "bonusClaimed") {
    console.log("[Background] Bonus claimed:", msg.points, "pts for", msg.streamer);
    chrome.storage.local.get(["claims", "totalPoints", "streaks"], (res) => {
      const claims = Array.isArray(res.claims) ? res.claims : [];
      const last = claims[claims.length - 1];
      const totalPoints = res.totalPoints || 0;
      const points = msg.points || 50;
      const streaks = res.streaks || {};

      if (!last || last.timestamp !== msg.timestamp) {
        claims.push({ 
          streamer: msg.streamer, 
          timestamp: msg.timestamp,
          points: points
        });
        const newTotal = totalPoints + points;
        
        // Update streak
        const today = new Date().toDateString();
        const streamer = msg.streamer;
        
        if (!streaks[streamer]) {
          streaks[streamer] = { lastClaim: today, count: 1 };
        } else {
          const lastClaimDate = new Date(streaks[streamer].lastClaim);
          const todayDate = new Date(today);
          const daysDiff = Math.floor((todayDate - lastClaimDate) / (1000 * 60 * 60 * 24));
          
          if (daysDiff === 0) {
            // Same day, keep streak
          } else if (daysDiff === 1) {
            // Next day, increment streak
            streaks[streamer].count += 1;
            streaks[streamer].lastClaim = today;
          } else {
            // Streak broken, reset
            streaks[streamer] = { lastClaim: today, count: 1 };
          }
        }
        
        chrome.storage.local.set({ 
          claims,
          totalPoints: newTotal,
          hasUnreadClaims: true,
          streaks
        }, () => {
          console.log("[Background] Saved claim. Total:", newTotal);
          chrome.action.setIcon({ path: "icon-purple.png" });
          console.log("[Background] 🟣 Icon set to purple (unread bonus)");
        });
      }
    });
  }
  
  // Handle prediction updates (every 10 seconds)
  if (msg.action === "predictionUpdate" && msg.streamer) {
    chrome.storage.local.get(["predictions"], (res) => {
      const predictions = res.predictions || {};
      
      if (msg.prediction !== null) {
        predictions[msg.streamer] = msg.prediction;
      }
      
      chrome.storage.local.set({ predictions });
    });
  }
  
  // Handle popup opened - mark claims as read
  if (msg.action === "popupOpened") {
    console.log("[Background] Popup opened - marking claims as read");
    chrome.storage.local.set({ hasUnreadClaims: false }, () => {
      // Change icon back to gray
      chrome.action.setIcon({ path: "icon-gray.png" });
      console.log("[Background] ⚪ Icon set to gray (claims read)");
    });
  }
});

// Update checker
async function checkForUpdates() {
  try {
    const response = await fetch('https://api.github.com/repos/tannervalentino/Bonus-Buddy/releases/latest');
    const data = await response.json();
    const latestVersion = data.tag_name.replace('v', '');
    const currentVersion = chrome.runtime.getManifest().version;
    
    console.log(`[Background] Current: ${currentVersion}, Latest: ${latestVersion}`);
    
    if (latestVersion !== currentVersion && compareVersions(latestVersion, currentVersion) > 0) {
      chrome.storage.local.set({ 
        updateAvailable: true, 
        latestVersion,
        downloadUrl: data.html_url
      });
      console.log(`[Background] Update available: ${latestVersion}`);
    } else {
      chrome.storage.local.set({ updateAvailable: false });
    }
  } catch (e) {
    console.log("[Background] Update check failed:", e);
  }
}

function compareVersions(a, b) {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  
  for (let i = 0; i < 3; i++) {
    if (aParts[i] > bParts[i]) return 1;
    if (aParts[i] < bParts[i]) return -1;
  }
  return 0;
}

// Check for updates on extension start
checkForUpdates();

// Check every 24 hours
setInterval(checkForUpdates, 24 * 60 * 60 * 1000);
