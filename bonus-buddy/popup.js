const streamerNameEl = document.getElementById("streamer-name");
const streamerAvatarEl = document.getElementById("streamer-avatar");
const streamerPointsEl = document.getElementById("streamer-points");
const streakCounterEl = document.getElementById("streak-counter");
const gameNameEl = document.getElementById("game-name");
const totalPointsEl = document.getElementById("total-points");
const claimHistoryListEl = document.getElementById("claim-history-list");
const chartButtonEl = document.getElementById("chart-button");
const settingsButtonEl = document.getElementById("settings-button");
const claimedChannelsMenuEl = document.getElementById("claimed-channels-menu");
const settingsMenuEl = document.getElementById("settings-menu");
const closeMenuEl = document.getElementById("close-menu");
const closeSettingsEl = document.getElementById("close-settings");
const channelsListEl = document.getElementById("channels-list");
const themeSelectorEl = document.getElementById("theme-selector");
const compactModeToggleEl = document.getElementById("compact-mode-toggle");
const updateBannerEl = document.getElementById("update-banner");
const latestVersionEl = document.getElementById("latest-version");
const downloadUpdateEl = document.getElementById("download-update");

// Toggle claimed channels menu
chartButtonEl.addEventListener("click", () => {
  settingsMenuEl.classList.remove("visible");
  settingsMenuEl.classList.add("hidden");
  
  claimedChannelsMenuEl.classList.toggle("hidden");
  claimedChannelsMenuEl.classList.toggle("visible");
});

closeMenuEl.addEventListener("click", () => {
  claimedChannelsMenuEl.classList.remove("visible");
  claimedChannelsMenuEl.classList.add("hidden");
});

// Toggle settings menu
settingsButtonEl.addEventListener("click", () => {
  claimedChannelsMenuEl.classList.remove("visible");
  claimedChannelsMenuEl.classList.add("hidden");
  
  settingsMenuEl.classList.toggle("hidden");
  settingsMenuEl.classList.toggle("visible");
});

closeSettingsEl.addEventListener("click", () => {
  settingsMenuEl.classList.remove("visible");
  settingsMenuEl.classList.add("hidden");
});

// Theme dropdown
themeSelectorEl.addEventListener('change', () => {
  const theme = themeSelectorEl.value;
  
  if (theme === 'default') {
    document.body.removeAttribute('data-theme');
  } else {
    document.body.setAttribute('data-theme', theme);
  }
  
  chrome.storage.local.set({ theme });
});

// Compact mode toggle
compactModeToggleEl.addEventListener('change', () => {
  const isCompact = compactModeToggleEl.checked;
  
  if (isCompact) {
    document.body.classList.add('compact-mode');
  } else {
    document.body.classList.remove('compact-mode');
  }
  
  chrome.storage.local.set({ compactMode: isCompact });
});

// Update banner
downloadUpdateEl.addEventListener('click', () => {
  chrome.storage.local.get(['downloadUrl'], (res) => {
    if (res.downloadUrl) {
      chrome.tabs.create({ url: res.downloadUrl });
    }
  });
});

// Check for updates
chrome.storage.local.get(['updateAvailable', 'latestVersion'], (res) => {
  if (res.updateAvailable && res.latestVersion) {
    updateBannerEl.classList.remove('hidden');
    latestVersionEl.textContent = res.latestVersion;
  } else {
    updateBannerEl.classList.add('hidden');
  }
});

// Load saved settings
chrome.storage.local.get(['theme', 'compactMode'], (res) => {
  const theme = res.theme || 'default';
  const compactMode = res.compactMode || false;
  
  if (theme !== 'default') {
    document.body.setAttribute('data-theme', theme);
  }
  themeSelectorEl.value = theme;
  
  if (compactMode) {
    document.body.classList.add('compact-mode');
    compactModeToggleEl.checked = true;
  }
});

function detectCurrentStreamer(callback) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs || !tabs[0] || !tabs[0].url) return callback(null);
    try {
      const url = new URL(tabs[0].url);
      if (!url.hostname.includes("twitch.tv")) return callback(null);
      const parts = url.pathname.split("/");
      const name = parts[1] || null;
      callback(name);
    } catch {
      callback(null);
    }
  });
}

function fetchAvatar(username, callback) {
  fetch(`https://decapi.me/twitch/avatar/${username}`)
    .then((r) => r.text())
    .then((url) => {
      if (url && !url.includes("404")) {
        callback(url);
      } else {
        callback("https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-300x300.png");
      }
    })
    .catch(() => {
      callback("https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-300x300.png");
    });
}

function formatClaimDateTime(timestamp) {
  const date = new Date(timestamp);
  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return { date: dateStr, time: timeStr };
}

function formatNumber(num) {
  if (num === null || num === undefined) return '—';
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function getTodaysClaims(claims) {
  const today = new Date().toDateString();
  return claims.filter(claim => {
    const claimDate = new Date(claim.timestamp).toDateString();
    return claimDate === today;
  });
}

function showStreamerData(streamer, grouped, streamers, streaks) {
  streamerNameEl.textContent = streamer;
  
  if (streamers[streamer]?.avatar) {
    streamerAvatarEl.src = streamers[streamer].avatar;
  } else {
    fetchAvatar(streamer, (url) => {
      streamerAvatarEl.src = url;
    });
  }
  
  if (streamers[streamer]?.game) {
    gameNameEl.textContent = streamers[streamer].game;
  } else {
    gameNameEl.textContent = '—';
  }

  const claims = grouped[streamer] || [];
  let totalPts = 0;
  claims.forEach(claim => {
    totalPts += claim.points || 50;
  });
  
  streamerPointsEl.textContent = `Collected Points: ${formatNumber(totalPts)} pts`;

  const streak = streaks && streaks[streamer] ? streaks[streamer].count : 0;
  if (streak > 0) {
    streakCounterEl.textContent = `🔥 ${streak} day streak`;
  } else {
    streakCounterEl.textContent = `🔥 0 day streak`;
  }

  claimHistoryListEl.innerHTML = "";
  
  const todaysClaims = getTodaysClaims(claims);
  
  if (todaysClaims.length === 0) {
    const li = document.createElement("li");
    li.innerHTML = '<div class="empty-state">No claims today</div>';
    li.style.background = "none";
    claimHistoryListEl.appendChild(li);
  } else {
    todaysClaims.slice().reverse().forEach((claim) => {
      const { date, time } = formatClaimDateTime(claim.timestamp);
      const pts = claim.points || 50;
      
      const li = document.createElement("li");
      li.innerHTML = `
        <div>
          <div class="date">${date}</div>
          <div class="time">${time}</div>
        </div>
        <div class="points">${pts} pts</div>
      `;
      claimHistoryListEl.appendChild(li);
    });
  }
}

function populateClaimedChannels(grouped, streamers, currentStreamer) {
  channelsListEl.innerHTML = "";
  
  const streamerNames = Object.keys(grouped);
  if (streamerNames.length === 0) {
    channelsListEl.innerHTML = '<div class="empty-state">No channels claimed yet</div>';
    return;
  }
  
  streamerNames.forEach(streamer => {
    const claims = grouped[streamer] || [];
    let totalPts = 0;
    claims.forEach(claim => totalPts += claim.points || 50);
    
    const channelDiv = document.createElement("div");
    channelDiv.className = "channel-item";
    if (streamer === currentStreamer) {
      channelDiv.style.background = "var(--accent)";
    }
    
    let avatarUrl = "https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-300x300.png";
    if (streamers[streamer]?.avatar) {
      avatarUrl = streamers[streamer].avatar;
    }
    
    channelDiv.innerHTML = `
      <img src="${avatarUrl}" alt="${streamer}" />
      <div class="channel-item-info">
        <div class="channel-item-name">${streamer}</div>
        <div class="channel-item-stats">
          <span>${formatNumber(totalPts)} pts</span>
        </div>
      </div>
    `;
    
    channelDiv.addEventListener("click", () => {
      chrome.tabs.create({ url: `https://www.twitch.tv/${streamer}` });
    });
    
    channelsListEl.appendChild(channelDiv);
  });
}

function loadPopup() {
  chrome.storage.local.get(["claims", "totalPoints", "streamers", "streaks"], (res) => {
    const allClaims = Array.isArray(res.claims) ? res.claims : [];
    const totalPoints = res.totalPoints || 0;
    const streamers = res.streamers || {};
    const streaks = res.streaks || {};

    totalPointsEl.textContent = `Total Points Claimed: ${formatNumber(totalPoints)}`;

    const grouped = {};
    allClaims.forEach((c) => {
      if (!grouped[c.streamer]) grouped[c.streamer] = [];
      grouped[c.streamer].push(c);
    });

    detectCurrentStreamer((current) => {
      if (!current) {
        streamerNameEl.textContent = "Not on Twitch";
        streamerPointsEl.textContent = "Collected Points: —";
        streakCounterEl.textContent = "🔥 0 day streak";
        gameNameEl.textContent = "—";
        streamerAvatarEl.src = "https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-300x300.png";
        claimHistoryListEl.innerHTML = '<li style="background: none;"><div class="empty-state">Open a Twitch stream to see data</div></li>';
        populateClaimedChannels(grouped, streamers, null);
        return;
      }

      showStreamerData(current, grouped, streamers, streaks);
      populateClaimedChannels(grouped, streamers, current);
    });
  });
}

chrome.runtime.sendMessage({ action: "popupOpened" }, () => {
  if (chrome.runtime.lastError) {}
});

setInterval(loadPopup, 2000);
loadPopup();
