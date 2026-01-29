chrome.runtime.onInstalled.addListener(() => {
  // Only set defaults if they don't exist (don't wipe data on reload)
  chrome.storage.local.get(null, (existing) => {
    const defaults = {
      enabled: true,
      claims: [],
      watchTimes: {},
      totalPoints: 0,
      streamers: {}
    };
    
    // Merge defaults with existing data (existing takes priority)
    const merged = { ...defaults, ...existing };
    chrome.storage.local.set(merged);
    
    console.log("[Twitch Bonus Claimer Background] Initialized with data:", merged);
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[Background] Received message:", msg.action, msg);
  
  // Handle streamer detection (when user lands on a stream)
  if (msg.action === "streamerDetected") {
    console.log("[Background] Streamer detected:", msg.streamer);
    chrome.storage.local.get(["streamers", "watchTimes"], (res) => {
      const streamers = res.streamers || {};
      const watchTimes = res.watchTimes || {};
      
      // Store streamer info
      if (!streamers[msg.streamer]) {
        streamers[msg.streamer] = {
          name: msg.streamer,
          avatar: msg.avatar,
          firstSeen: msg.timestamp
        };
      }
      
      // Update avatar if available
      if (msg.avatar && streamers[msg.streamer]) {
        streamers[msg.streamer].avatar = msg.avatar;
      }
      
      // Initialize watch time if not exists
      if (!watchTimes[msg.streamer]) {
        watchTimes[msg.streamer] = { ms: 0 };
      }
      
      chrome.storage.local.set({ streamers, watchTimes }, () => {
        console.log("[Background] Saved streamer data:", streamers[msg.streamer]);
      });
    });
  }

  // Handle bonus claims
  if (msg.action === "bonusClaimed") {
    console.log("[Background] Bonus claimed:", msg.points, "pts for", msg.streamer);
    chrome.storage.local.get(["claims", "totalPoints"], (res) => {
      const claims = Array.isArray(res.claims) ? res.claims : [];
      const last = claims[claims.length - 1];
      const totalPoints = res.totalPoints || 0;
      const points = msg.points || 50;

      if (!last || last.timestamp !== msg.timestamp) {
        claims.push({ 
          streamer: msg.streamer, 
          timestamp: msg.timestamp,
          points: points
        });
        const newTotal = totalPoints + points;
        chrome.storage.local.set({ 
          claims,
          totalPoints: newTotal
        }, () => {
          console.log("[Background] Saved claim. Total claims:", claims.length, "Total points:", newTotal);
        });
      }
    });
  }

  // Handle watch time updates (every 10 seconds)
  if (msg.action === "updateWatchTime" && msg.streamer) {
    chrome.storage.local.get("watchTimes", (res) => {
      const watchTimes = res.watchTimes || {};
      const prevMs = watchTimes[msg.streamer]?.ms || 0;
      const newMs = prevMs + (msg.delta || 0);
      watchTimes[msg.streamer] = { ms: newMs };
      chrome.storage.local.set({ watchTimes }, () => {
        const mins = Math.floor(newMs / 60000);
        console.log("[Background] Updated watch time for", msg.streamer, "- Total:", mins, "minutes");
      });
    });
  }
});
