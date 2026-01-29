const streamerNameEl = document.getElementById("streamer-name");
const streamerAvatarEl = document.getElementById("streamer-avatar");
const streamerPointsEl = document.getElementById("streamer-points");
const watchTimeEl = document.getElementById("watch-time");
const channelListEl = document.getElementById("channel-list");
const channelDetailsEl = document.getElementById("channel-details");
const toolbarEl = document.getElementById("toolbar");
const toolbarToggleEl = document.getElementById("toolbar-toggle");
const totalPointsEl = document.getElementById("total-points");

// Toggle claimed channels visibility
let toolbarExpanded = false;
toolbarToggleEl.addEventListener("click", () => {
  toolbarExpanded = !toolbarExpanded;
  if (toolbarExpanded) {
    channelListEl.style.display = "block";
    toolbarToggleEl.textContent = "▼";
  } else {
    channelListEl.style.display = "none";
    toolbarToggleEl.textContent = "▶";
  }
});

// Get streamer's name from the current active Twitch tab
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

// Fetch avatar from DecAPI
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

// Display data for a specific streamer
function showStreamerData(streamer, grouped, watchTimes, streamers) {
  streamerNameEl.textContent = streamer;
  
  // Try to get avatar from stored data first
  if (streamers[streamer]?.avatar) {
    streamerAvatarEl.src = streamers[streamer].avatar;
  } else {
    // Fallback to fetching
    fetchAvatar(streamer, (url) => {
      streamerAvatarEl.src = url;
    });
  }

  // Calculate points for this streamer
  const claims = grouped[streamer] || [];
  let totalPts = 0;
  claims.forEach(claim => {
    totalPts += claim.points || 50;
  });
  
  streamerPointsEl.textContent = `${totalPts} pts`;

  // Show watch time
  const ms = (watchTimes && watchTimes[streamer]?.ms) || 0;
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  watchTimeEl.textContent = `Watched: ${hours}h ${mins}m`;

  // Show claim history
  channelDetailsEl.innerHTML = "<h3>Claim History</h3>";
  
  if (claims.length === 0) {
    const p = document.createElement("p");
    p.textContent = "No claims yet for this streamer";
    p.style.color = "var(--text-secondary)";
    p.style.fontSize = "14px";
    channelDetailsEl.appendChild(p);
  } else {
    const ul = document.createElement("ul");
    claims.slice().reverse().forEach((claim) => {
      const li = document.createElement("li");
      const time = new Date(claim.timestamp).toLocaleTimeString();
      const pts = claim.points || 50;
      li.textContent = `${time} - ${pts} pts`;
      ul.appendChild(li);
    });
    channelDetailsEl.appendChild(ul);
  }
}

// Populate claimed channels list
function populateClaimedChannels(grouped, currentStreamer) {
  channelListEl.innerHTML = "";
  
  const streamers = Object.keys(grouped);
  if (streamers.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No channels claimed yet";
    li.style.cursor = "default";
    li.style.color = "var(--text-secondary)";
    channelListEl.appendChild(li);
    return;
  }
  
  streamers.forEach(streamer => {
    const li = document.createElement("li");
    li.textContent = streamer;
    if (streamer === currentStreamer) {
      li.style.background = "var(--accent)";
    }
    li.addEventListener("click", () => {
      chrome.tabs.create({ url: `https://www.twitch.tv/${streamer}` });
    });
    channelListEl.appendChild(li);
  });
}

// Load and display popup data
function loadPopup() {
  chrome.storage.local.get(["claims", "watchTimes", "totalPoints", "streamers"], (res) => {
    const allClaims = Array.isArray(res.claims) ? res.claims : [];
    const watchTimes = res.watchTimes || {};
    const totalPoints = res.totalPoints || 0;
    const streamers = res.streamers || {};

    // Display total lifetime points
    totalPointsEl.textContent = `Total Points Claimed: ${totalPoints}`;

    const grouped = {};
    allClaims.forEach((c) => {
      if (!grouped[c.streamer]) grouped[c.streamer] = [];
      grouped[c.streamer].push(c);
    });

    detectCurrentStreamer((current) => {
      if (!current) {
        streamerNameEl.textContent = "Not on Twitch";
        streamerPointsEl.textContent = "—";
        watchTimeEl.textContent = "—";
        streamerAvatarEl.src = "https://static-cdn.jtvnw.net/user-default-pictures-uv/cdd517fe-def4-11e9-948e-784f43822e80-profile_image-300x300.png";
        channelDetailsEl.innerHTML = "<p style='color: var(--text-secondary); font-size: 14px;'>Open a Twitch stream to see data</p>";
        populateClaimedChannels(grouped, null);
        return;
      }

      // Show streamer data even if no claims yet
      showStreamerData(current, grouped, watchTimes, streamers);
      populateClaimedChannels(grouped, current);
    });
  });
}

// Refresh data every 2 seconds while popup is open
setInterval(loadPopup, 2000);

// Initial load
loadPopup();
