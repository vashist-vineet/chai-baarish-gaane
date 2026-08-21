(() => {
  "use strict";

  const NAME_KEY = "cbg-chai-chat-name";
  const MAX_MESSAGE_LENGTH = 400;
  const REACTIONS = ["❤️", "☕", "🌧️", "✨"];
  const ENVIRONMENT_ICONS = Object.freeze({ monsoon: "🌧️", winter: "❄️", spring: "🌸", autumn: "🍂", desert: "🏜️", coast: "🌊" });
  const $ = (selector, root = document) => root.querySelector(selector);
  const els = {
    drawer: $("#chatDrawer"),
    close: $("#chatClose"),
    editName: $("#chatEditName"),
    presence: $("#chatPresence"),
    nameGate: $("#chatNameGate"),
    nameInput: $("#chatNameInput"),
    nameError: $("#chatNameError"),
    join: $("#chatJoin"),
    room: $("#chatRoom"),
    status: $("#chatStatus"),
    stream: $("#chatStream"),
    empty: $("#chatEmpty"),
    newMessages: $("#chatNewMessages"),
    replyContext: $("#chatReplyContext"),
    replyName: $("#chatReplyName"),
    replyText: $("#chatReplyText"),
    replyCancel: $("#chatReplyCancel"),
    composer: $("#chatComposer"),
    message: $("#chatMessage"),
    send: $("#chatSend"),
    launch: $("#chatButton"),
    chai: $("#chaiHotspot"),
    playlistClose: $("#closePlaylist")
  };
  if (!els.drawer || !els.chai) return;

  const state = {
    open: false,
    socket: null,
    connected: false,
    joined: false,
    name: readName(),
    replyTo: null,
    messages: new Map(),
    ownReactions: new Set(),
    reported: new Set(),
    loadingSocket: null
  };

  function readName() {
    try { return validateName(localStorage.getItem(NAME_KEY)) || ""; }
    catch { return ""; }
  }

  function validateName(value) {
    if (typeof value !== "string") return "";
    const name = value.replace(/\s+/gu, " ").trim();
    if (name.length < 2 || name.length > 24 || /[\u0000-\u001f\u007f]/u.test(name)) return "";
    return name;
  }

  function chatServerUrl() {
    const configured = document.querySelector('meta[name="cbg-chat-server"]')?.content.trim();
    return String(window.CBG_CHAT_SERVER_URL || configured || location.origin).replace(/\/$/u, "");
  }

  function setStatus(copy, connected = state.connected) {
    els.status.textContent = copy;
    els.status.classList.toggle("connected", connected);
    els.send.disabled = !connected;
    els.message.disabled = !connected;
  }

  function presenceCopy(count) {
    const safeCount = Number.isFinite(count) ? count : 0;
    return safeCount === 1 ? "1 shakhs veranda par hai" : `${safeCount} log veranda par hain`;
  }

  function loadSocketClient() {
    if (window.io) return Promise.resolve(window.io);
    if (state.loadingSocket) return state.loadingSocket;
    state.loadingSocket = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `${chatServerUrl()}/socket.io/socket.io.js`;
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => window.io ? resolve(window.io) : reject(new Error("Socket.IO client unavailable"));
      script.onerror = () => reject(new Error("Chat server unavailable"));
      document.head.appendChild(script);
    }).catch((error) => {
      state.loadingSocket = null;
      throw error;
    });
    return state.loadingSocket;
  }

  async function ensureSocket() {
    if (state.socket) {
      if (!state.socket.connected) state.socket.connect();
      return state.socket;
    }
    setStatus("connection jod rahe hain…", false);
    const io = await loadSocketClient();
    const socket = io(chatServerUrl(), { autoConnect: true, reconnection: true, reconnectionDelayMax: 4000 });
    state.socket = socket;
    socket.on("connect", () => {
      state.connected = true;
      setStatus("mehfil live hai", true);
      if (state.open && state.name) joinChat();
    });
    socket.on("disconnect", () => {
      state.connected = false;
      state.joined = false;
      setStatus("connection dobara jod rahe hain…", false);
    });
    socket.on("connect_error", () => setStatus("chat server abhi nahi mil raha…", false));
    socket.on("chat:init", ({ messages = [], presence = 0 } = {}) => {
      state.messages.clear();
      els.stream.querySelectorAll(".chat-message").forEach((node) => node.remove());
      messages.forEach(upsertMessage);
      els.presence.textContent = presenceCopy(presence);
      updateEmpty();
      scrollToBottom(false);
    });
    socket.on("chat:message", (message) => {
      const nearBottom = isNearBottom();
      upsertMessage(message);
      if (nearBottom) scrollToBottom();
      else els.newMessages.hidden = false;
    });
    socket.on("chat:reaction", ({ messageId, reactions } = {}) => {
      const message = state.messages.get(messageId);
      if (!message) return;
      message.reactions = reactions;
      upsertMessage(message);
    });
    socket.on("chat:delete", ({ messageId } = {}) => removeMessage(messageId));
    socket.on("presence:update", ({ count = 0 } = {}) => { els.presence.textContent = presenceCopy(count); });
    return socket;
  }

  function emitWithAck(event, payload) {
    return new Promise((resolve) => {
      if (!state.socket?.connected) return resolve({ ok: false, error: "Connection abhi nahi hai." });
      state.socket.timeout(4500).emit(event, payload, (error, response) => {
        if (error) resolve({ ok: false, error: "Server ne jawab nahi diya." });
        else resolve(response || { ok: false, error: "Kuch gadbad ho gayi." });
      });
    });
  }

  async function joinChat() {
    if (!state.name || !state.socket?.connected || !state.open) return;
    const result = await emitWithAck("chat:join", { name: state.name });
    state.joined = Boolean(result.ok);
    if (!result.ok) setStatus(result.error || "Mehfil join nahi hui.", false);
  }

  async function openChat() {
    if (document.body.classList.contains("playlist-open")) els.playlistClose?.click();
    state.open = true;
    document.body.classList.add("chat-open");
    els.drawer.removeAttribute("inert");
    els.drawer.setAttribute("aria-hidden", "false");
    if (!state.name) {
      showNameGate();
      requestAnimationFrame(() => els.nameInput.focus());
      return;
    }
    showRoom();
    try {
      await ensureSocket();
      if (state.socket.connected) await joinChat();
      els.message.focus();
    } catch {
      setStatus("chat server abhi nahi mil raha…", false);
    }
  }

  function closeChat() {
    state.open = false;
    state.joined = false;
    state.socket?.emit("chat:leave");
    document.body.classList.remove("chat-open");
    els.drawer.setAttribute("aria-hidden", "true");
    els.drawer.setAttribute("inert", "");
    cancelReply();
    els.chai.focus();
  }

  function showNameGate(editing = false) {
    els.nameGate.hidden = false;
    els.room.hidden = true;
    els.editName.hidden = true;
    els.nameInput.value = editing ? state.name : "";
    els.nameError.textContent = "";
  }

  function showRoom() {
    els.nameGate.hidden = true;
    els.room.hidden = false;
    els.editName.hidden = false;
  }

  async function saveName() {
    const name = validateName(els.nameInput.value);
    if (!name) {
      els.nameError.textContent = "2 se 24 characters ka naam likho.";
      els.nameInput.focus();
      return;
    }
    state.name = name;
    try { localStorage.setItem(NAME_KEY, name); } catch { /* Name still works for this visit. */ }
    showRoom();
    try {
      await ensureSocket();
      if (state.joined) await emitWithAck("chat:name", { name });
      else await joinChat();
      els.message.focus();
    } catch {
      setStatus("chat server abhi nahi mil raha…", false);
    }
  }

  function currentEnvironment() {
    const environment = document.body.dataset.environment;
    return Object.hasOwn(ENVIRONMENT_ICONS, environment) ? environment : "monsoon";
  }

  function formatTime(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  }

  function createMessageNode(message) {
    const article = document.createElement("article");
    article.className = "chat-message";
    article.dataset.messageId = message.id;

    const header = document.createElement("header");
    const identity = document.createElement("strong");
    identity.textContent = message.name;
    const icon = document.createElement("span");
    icon.textContent = ENVIRONMENT_ICONS[message.environment] || ENVIRONMENT_ICONS.monsoon;
    icon.setAttribute("aria-label", message.environment || "monsoon");
    const time = document.createElement("time");
    time.dateTime = message.createdAt;
    time.textContent = formatTime(message.createdAt);
    header.append(identity, icon, time);
    article.append(header);

    if (message.replyTo) {
      const reply = document.createElement("div");
      reply.className = "chat-message-reply";
      const replyName = document.createElement("strong");
      replyName.textContent = message.replyTo.name || "purana message";
      const replyText = document.createElement("span");
      replyText.textContent = message.replyTo.text || "purana message";
      reply.append(replyName, replyText);
      article.append(reply);
    }

    const copy = document.createElement("p");
    copy.className = "chat-message-copy";
    copy.textContent = message.text;
    article.append(copy);

    const actions = document.createElement("footer");
    actions.className = "chat-message-actions";
    REACTIONS.forEach((reaction) => {
      const key = `${message.id}:${reaction}`;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.reaction = reaction;
      button.classList.toggle("active", state.ownReactions.has(key));
      button.setAttribute("aria-label", `React ${reaction}`);
      const count = Number(message.reactions?.[reaction] || 0);
      button.textContent = count ? `${reaction} ${count}` : reaction;
      actions.append(button);
    });
    const replyButton = document.createElement("button");
    replyButton.type = "button";
    replyButton.dataset.action = "reply";
    replyButton.textContent = "Reply";
    actions.append(replyButton);
    const reportButton = document.createElement("button");
    reportButton.type = "button";
    reportButton.dataset.action = "report";
    reportButton.textContent = state.reported.has(message.id) ? "Reported" : "Report";
    reportButton.disabled = state.reported.has(message.id);
    actions.append(reportButton);
    article.append(actions);
    return article;
  }

  function upsertMessage(message) {
    if (!message?.id || typeof message.text !== "string" || typeof message.name !== "string") return;
    state.messages.set(message.id, message);
    const next = createMessageNode(message);
    const existing = els.stream.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`);
    if (existing) existing.replaceWith(next);
    else els.stream.append(next);
    updateEmpty();
  }

  function removeMessage(id) {
    state.messages.delete(id);
    els.stream.querySelector(`[data-message-id="${CSS.escape(String(id))}"]`)?.remove();
    updateEmpty();
  }

  function updateEmpty() {
    els.empty.hidden = state.messages.size > 0;
  }

  function isNearBottom() {
    return els.stream.scrollHeight - els.stream.scrollTop - els.stream.clientHeight < 90;
  }

  function scrollToBottom(smooth = true) {
    els.stream.scrollTo({ top: els.stream.scrollHeight, behavior: smooth ? "smooth" : "auto" });
    els.newMessages.hidden = true;
  }

  function beginReply(message) {
    state.replyTo = message;
    els.replyContext.hidden = false;
    els.replyName.textContent = message.name;
    els.replyText.textContent = message.text.slice(0, 96);
    els.message.focus();
  }

  function cancelReply() {
    state.replyTo = null;
    els.replyContext.hidden = true;
    els.replyName.textContent = "";
    els.replyText.textContent = "";
  }

  async function sendMessage() {
    const text = els.message.value.trim();
    if (!text || text.length > MAX_MESSAGE_LENGTH || !state.connected) return;
    els.send.disabled = true;
    const result = await emitWithAck("chat:message", {
      text,
      environment: currentEnvironment(),
      replyTo: state.replyTo?.id || null
    });
    if (result.ok) {
      els.message.value = "";
      els.message.style.height = "auto";
      cancelReply();
      scrollToBottom();
      setStatus("mehfil live hai", true);
    } else setStatus(result.error || "Message nahi gaya.", state.connected);
    els.send.disabled = !state.connected;
    els.message.focus();
  }

  els.chai.setAttribute("aria-label", "Open Chai Pe Chat");
  els.chai.addEventListener("click", openChat);
  els.launch?.addEventListener("click", openChat);
  els.close.addEventListener("click", closeChat);
  els.join.addEventListener("click", saveName);
  els.nameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") { event.preventDefault(); saveName(); }
  });
  els.editName.addEventListener("click", () => {
    showNameGate(true);
    requestAnimationFrame(() => els.nameInput.select());
  });
  els.composer.addEventListener("submit", (event) => { event.preventDefault(); sendMessage(); });
  els.message.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); sendMessage(); }
  });
  els.message.addEventListener("input", () => {
    els.message.style.height = "auto";
    els.message.style.height = `${Math.min(110, els.message.scrollHeight)}px`;
  });
  els.stream.addEventListener("click", async (event) => {
    const messageNode = event.target.closest(".chat-message");
    const message = messageNode ? state.messages.get(messageNode.dataset.messageId) : null;
    if (!message) return;
    const reaction = event.target.closest("button[data-reaction]")?.dataset.reaction;
    if (reaction) {
      const result = await emitWithAck("chat:reaction", { messageId: message.id, reaction });
      if (result.ok) {
        const key = `${message.id}:${reaction}`;
        if (result.active) state.ownReactions.add(key);
        else state.ownReactions.delete(key);
        upsertMessage(message);
      }
      return;
    }
    const action = event.target.closest("button[data-action]")?.dataset.action;
    if (action === "reply") beginReply(message);
    if (action === "report" && !state.reported.has(message.id)) {
      const result = await emitWithAck("chat:report", { messageId: message.id });
      if (result.ok) { state.reported.add(message.id); upsertMessage(message); }
    }
  });
  els.replyCancel.addEventListener("click", cancelReply);
  els.newMessages.addEventListener("click", () => scrollToBottom());
  els.stream.addEventListener("scroll", () => {
    if (isNearBottom()) els.newMessages.hidden = true;
  }, { passive: true });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.open) closeChat();
  });

  window.CBGChat = Object.freeze({ open: openChat, close: closeChat, nameKey: NAME_KEY });
})();
