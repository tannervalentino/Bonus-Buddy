window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "TWITCH_BONUS_CLAIMER")
    return;

  try {
    const message = {
      action: event.data.action,
      ...event.data.data
    };
    console.log("[Bridge] Forwarding message to background:", message);
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        console.error("[Bridge] Error sending message:", chrome.runtime.lastError.message);
      } else {
        console.log("[Bridge] Message sent successfully");
      }
    });
  } catch (error) {
    console.error("[Bridge] Failed to send message:", error);
  }
});
