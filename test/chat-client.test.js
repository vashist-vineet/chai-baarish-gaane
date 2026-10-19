import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";

const chatSource = fs.readFileSync(new URL("../chat.js", import.meta.url), "utf8");

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(...values) { values.forEach((value) => this.values.add(value)); }
  remove(...values) { values.forEach((value) => this.values.delete(value)); }
  contains(value) { return this.values.has(value); }
  toggle(value, force) {
    const active = force === undefined ? !this.values.has(value) : Boolean(force);
    if (active) this.values.add(value);
    else this.values.delete(value);
    return active;
  }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.value = "";
    this.textContent = "";
    this.style = {};
    this.listeners = new Map();
    this.children = [];
    this.scrollHeight = 0;
    this.scrollTop = 0;
    this.clientHeight = 0;
  }
  addEventListener(event, listener) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(listener);
  }
  dispatch(event, extra = {}) {
    const payload = { target: this, preventDefault() {}, ...extra };
    return Promise.all((this.listeners.get(event) || []).map((listener) => listener(payload)));
  }
  click() { return this.dispatch("click"); }
  focus() { this.focused = true; }
  select() { this.selected = true; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  append(...children) { this.children.push(...children); }
  remove() {
    if (!this.parent) return;
    this.parent.children = this.parent.children.filter((child) => child !== this);
  }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  scrollTo() {}
}

class FakeSocket {
  constructor() {
    this.connected = false;
    this.connectCalls = 0;
    this.events = [];
    this.deferJoinAcks = false;
    this.pendingJoinAcks = [];
    this.deferMessageAcks = false;
    this.pendingMessageAcks = [];
    this.handlers = new Map();
    this.managerHandlers = new Map();
    this.io = { on: (event, listener) => this.addHandler(this.managerHandlers, event, listener) };
  }
  addHandler(collection, event, listener) {
    if (!collection.has(event)) collection.set(event, []);
    collection.get(event).push(listener);
  }
  on(event, listener) { this.addHandler(this.handlers, event, listener); return this; }
  connect() { this.connectCalls += 1; return this; }
  timeout() { return this; }
  emit(event, payload, acknowledge) {
    this.events.push({ event, payload });
    if (typeof acknowledge === "function") {
      if (event === "chat:join" && this.deferJoinAcks) this.pendingJoinAcks.push(acknowledge);
      else if (event === "chat:message" && this.deferMessageAcks) this.pendingMessageAcks.push(acknowledge);
      else acknowledge(null, { ok: true });
    }
    return this;
  }
  resolveNextJoin(response = { ok: true }, error = null) {
    const acknowledge = this.pendingJoinAcks.shift();
    assert.ok(acknowledge, "expected a pending chat:join acknowledgement");
    acknowledge(error, response);
  }
  resolveNextMessage(response = { ok: true }, error = null) {
    const acknowledge = this.pendingMessageAcks.shift();
    assert.ok(acknowledge, "expected a pending chat:message acknowledgement");
    acknowledge(error, response);
  }
  trigger(event, payload) {
    if (event === "connect") this.connected = true;
    if (event === "disconnect") this.connected = false;
    (this.handlers.get(event) || []).forEach((listener) => listener(payload));
  }
  triggerManager(event, payload) {
    (this.managerHandlers.get(event) || []).forEach((listener) => listener(payload));
  }
}

function createHarness({ savedName = "" } = {}) {
  const ids = [
    "chatDrawer", "chatClose", "chatEditName", "chatPresence", "chatNameGate", "chatNameInput",
    "chatNameError", "chatJoin", "chatRoom", "chatStatus", "chatStatusText", "chatRetry",
    "chatStream", "chatEmpty", "chatNewMessages", "chatReplyContext", "chatReplyName",
    "chatReplyText", "chatReplyCancel", "chatComposer", "chatMessage", "chatSend", "chatButton",
    "chaiHotspot", "closePlaylist"
  ];
  const elements = Object.fromEntries(ids.map((id) => [id, new FakeElement(id)]));
  elements.chatRoom.hidden = true;
  elements.chatRetry.hidden = true;
  elements.chatReplyContext.hidden = true;
  const body = new FakeElement("body");
  body.dataset.environment = "monsoon";
  const head = new FakeElement("head");
  const storage = new Map(savedName ? [["cbg-chai-chat-name", savedName]] : []);
  const timers = new Map();
  let timerId = 0;
  let socketFactoryCalls = 0;
  const sockets = [];
  const document = {
    body,
    head,
    querySelector(selector) {
      if (selector === 'meta[name="cbg-chat-server"]') return { content: "https://chai-pe-chat.onrender.com" };
      return selector.startsWith("#") ? elements[selector.slice(1)] : null;
    },
    createElement() { return new FakeElement(); },
    addEventListener() {}
  };
  head.appendChild = (element) => { element.parent = head; head.children.push(element); };
  const window = {};
  const context = {
    window,
    document,
    location: { origin: "https://baarishfm.vercel.app" },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value))
    },
    CSS: { escape: String },
    requestAnimationFrame: (callback) => callback(),
    setTimeout(callback) { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimeout(id) { timers.delete(id); },
    console
  };
  vm.runInNewContext(chatSource, context, { filename: "chat.js" });

  return {
    elements,
    head,
    storage,
    timers,
    window,
    sockets,
    open: () => window.CBGChat.open(),
    close: () => window.CBGChat.close(),
    runTimers() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((callback) => callback());
    },
    loadClient() {
      window.io = () => {
        socketFactoryCalls += 1;
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      };
      head.children.at(-1).onload();
    },
    failClientLoad() { head.children.at(-1).onerror(); },
    socketFactoryCalls: () => socketFactoryCalls
  };
}

async function flush() {
  for (let index = 0; index < 8; index += 1) await Promise.resolve();
}

test("first open renders immediately and starts one connection before a name is entered", async () => {
  const harness = createHarness();
  harness.open();

  assert.equal(harness.elements.chatDrawer.getAttribute("aria-hidden"), "false");
  assert.equal(harness.elements.chatNameGate.hidden, false);
  assert.equal(harness.elements.chatNameInput.focused, true);
  assert.equal(harness.elements.chatStatusText.textContent, "Connecting to the mehfil…");
  assert.equal(harness.head.children.length, 1);

  harness.open();
  assert.equal(harness.head.children.length, 1, "repeated opens must share the client load");
  harness.loadClient();
  await flush();
  assert.equal(harness.socketFactoryCalls(), 1);
  assert.equal(harness.sockets.length, 1);
});

test("a name submitted during connection joins once and enables the composer only after join", async () => {
  const harness = createHarness();
  harness.open();
  harness.elements.chatNameInput.value = "Mehak";
  void harness.elements.chatJoin.click();

  assert.equal(harness.elements.chatNameGate.hidden, true);
  assert.equal(harness.elements.chatMessage.disabled, true);
  harness.loadClient();
  await flush();
  const socket = harness.sockets[0];
  assert.equal(socket.events.filter(({ event }) => event === "chat:join").length, 0);

  socket.trigger("connect");
  await flush();
  assert.equal(socket.events.filter(({ event }) => event === "chat:join").length, 1);
  assert.equal(harness.elements.chatMessage.disabled, false);
  assert.equal(harness.elements.chatSend.disabled, false);
  assert.equal(harness.elements.chatStatusText.textContent, "mehfil live hai");

  socket.trigger("connect");
  await flush();
  assert.equal(socket.events.filter(({ event }) => event === "chat:join").length, 1);
});

test("a connected first-time visitor joins once after submitting a name", async () => {
  const harness = createHarness();
  harness.open();
  harness.loadClient();
  await flush();
  const socket = harness.sockets[0];
  socket.trigger("connect");
  await flush();
  assert.equal(harness.elements.chatMessage.disabled, true);

  harness.elements.chatNameInput.value = "Kabir";
  await harness.elements.chatJoin.click();
  await flush();
  assert.equal(socket.events.filter(({ event }) => event === "chat:join").length, 1);
  assert.equal(harness.elements.chatMessage.disabled, false);
});

test("closing and reopening reuses the socket and rejoins without duplicate listeners", async () => {
  const harness = createHarness({ savedName: "Lucky" });
  harness.open();
  harness.loadClient();
  await flush();
  const socket = harness.sockets[0];
  socket.trigger("connect");
  await flush();
  assert.equal(socket.events.filter(({ event }) => event === "chat:join").length, 1);

  harness.close();
  harness.open();
  await flush();
  assert.equal(harness.socketFactoryCalls(), 1);
  assert.equal(harness.head.children.length, 1);
  assert.equal(socket.handlers.get("connect").length, 1);
  assert.equal(socket.events.filter(({ event }) => event === "chat:join").length, 2);
});

test("a pending join from a closed drawer cannot join a reopened drawer session", async () => {
  const harness = createHarness();
  harness.open();
  harness.loadClient();
  await flush();
  const socket = harness.sockets[0];
  socket.deferJoinAcks = true;
  socket.trigger("connect");
  harness.elements.chatNameInput.value = "Mehak";
  void harness.elements.chatJoin.click();
  await flush();
  assert.equal(socket.pendingJoinAcks.length, 1);

  harness.close();
  harness.open();
  await flush();
  assert.equal(socket.pendingJoinAcks.length, 2, "reopen must start a join for the new drawer session");

  socket.resolveNextJoin();
  await flush();
  assert.equal(harness.elements.chatMessage.disabled, true);
  assert.notEqual(harness.elements.chatStatusText.textContent, "mehfil live hai");

  socket.trigger("connect");
  await flush();
  assert.equal(socket.pendingJoinAcks.length, 1, "stale cleanup must not clear the newer join promise");
  assert.equal(socket.events.filter(({ event }) => event === "chat:join").length, 2);

  socket.resolveNextJoin();
  await flush();
  assert.equal(harness.elements.chatMessage.disabled, false);
  assert.equal(harness.elements.chatStatusText.textContent, "mehfil live hai");
});

test("a pending join from a disconnected transport cannot overwrite the reconnected join", async () => {
  const harness = createHarness({ savedName: "Lucky" });
  harness.open();
  harness.loadClient();
  await flush();
  const socket = harness.sockets[0];
  socket.deferJoinAcks = true;
  socket.trigger("connect");
  await flush();
  assert.equal(socket.pendingJoinAcks.length, 1);

  socket.trigger("disconnect");
  assert.equal(harness.elements.chatMessage.disabled, true);
  socket.trigger("connect");
  await flush();
  assert.equal(socket.pendingJoinAcks.length, 2);

  socket.resolveNextJoin({ ok: false, error: "stale join failed" });
  await flush();
  assert.equal(harness.elements.chatMessage.disabled, true);
  assert.notEqual(harness.elements.chatStatusText.textContent, "stale join failed");

  socket.trigger("connect");
  await flush();
  assert.equal(socket.pendingJoinAcks.length, 1, "old promise cleanup must preserve the active rejoin");
  assert.equal(socket.events.filter(({ event }) => event === "chat:join").length, 2);

  socket.resolveNextJoin();
  await flush();
  assert.equal(harness.elements.chatMessage.disabled, false);
  assert.equal(harness.elements.chatStatusText.textContent, "mehfil live hai");
});

test("cleanup from an invalidated join cannot clear the newer active join promise", async () => {
  const harness = createHarness({ savedName: "Lucky" });
  harness.open();
  harness.loadClient();
  await flush();
  const socket = harness.sockets[0];
  socket.deferJoinAcks = true;
  socket.trigger("connect");
  await flush();

  harness.close();
  harness.open();
  await flush();
  assert.equal(socket.pendingJoinAcks.length, 2);

  socket.resolveNextJoin({ ok: false, error: "old join timed out" });
  await flush();
  harness.open();
  await flush();
  assert.equal(socket.events.filter(({ event }) => event === "chat:join").length, 2);
  assert.equal(socket.pendingJoinAcks.length, 1, "the active promise must still deduplicate join requests");

  socket.resolveNextJoin();
  await flush();
  assert.equal(harness.elements.chatMessage.disabled, false);
  assert.equal(harness.elements.chatStatusText.textContent, "mehfil live hai");
});

test("delayed, reconnecting, failed and retry states remain deterministic", async () => {
  const delayed = createHarness();
  delayed.open();
  delayed.runTimers();
  assert.equal(delayed.elements.chatStatusText.textContent, "The mehfil is waking up—first connection may take a little longer.");
  assert.equal(delayed.elements.chatNameGate.hidden, false);
  assert.equal(delayed.elements.chatNameInput.focused, true);
  delayed.runTimers();
  assert.equal(delayed.elements.chatStatusText.textContent, "Couldn’t reach the mehfil. Please try again.");
  assert.equal(delayed.elements.chatRetry.hidden, false);

  const failed = createHarness();
  failed.open();
  failed.failClientLoad();
  await flush();
  assert.equal(failed.elements.chatStatusText.textContent, "Couldn’t reach the mehfil. Please try again.");
  assert.equal(failed.elements.chatRetry.hidden, false);
  assert.equal(failed.head.children.length, 0, "a failed client script must be removed before retry");

  await failed.elements.chatRetry.click();
  assert.equal(failed.head.children.length, 1);
  failed.loadClient();
  await flush();
  const socket = failed.sockets[0];
  socket.trigger("connect");
  await flush();
  socket.trigger("disconnect");
  assert.equal(failed.elements.chatStatusText.textContent, "Reconnecting to the mehfil…");
  socket.triggerManager("reconnect_failed");
  assert.equal(failed.elements.chatRetry.hidden, false);
  await failed.elements.chatRetry.click();
  assert.equal(socket.connectCalls, 1);
  assert.equal(socket.handlers.get("connect").length, 1);
});

test("the prolonged failure state stays actionable until an explicit retry succeeds", async () => {
  const harness = createHarness({ savedName: "Lucky" });
  harness.open();
  harness.loadClient();
  await flush();
  const socket = harness.sockets[0];

  harness.runTimers();
  harness.runTimers();
  const failureCopy = "Couldn’t reach the mehfil. Please try again.";
  assert.equal(harness.elements.chatStatusText.textContent, failureCopy);
  assert.equal(harness.elements.chatRetry.hidden, false);

  socket.trigger("connect_error");
  socket.triggerManager("reconnect_attempt");
  assert.equal(harness.elements.chatStatusText.textContent, failureCopy);
  assert.equal(harness.elements.chatRetry.hidden, false);

  await harness.elements.chatRetry.click();
  assert.equal(socket.connectCalls, 1);
  assert.equal(harness.socketFactoryCalls(), 1);
  assert.equal(socket.handlers.get("connect").length, 1);
  assert.equal(harness.elements.chatStatusText.textContent, "Reconnecting to the mehfil…");
  assert.equal(harness.elements.chatRetry.hidden, true);

  socket.trigger("connect");
  await flush();
  assert.equal(socket.events.filter(({ event }) => event === "chat:join").length, 1);
  assert.equal(harness.elements.chatStatusText.textContent, "mehfil live hai");
  assert.equal(harness.elements.chatMessage.disabled, false);
});

test("a stale message success cannot mutate a reconnected session", async () => {
  const harness = createHarness({ savedName: "Lucky" });
  harness.open();
  harness.loadClient();
  await flush();
  const socket = harness.sockets[0];
  socket.trigger("connect");
  await flush();

  socket.deferMessageAcks = true;
  harness.elements.chatMessage.value = "message from the old session";
  void harness.elements.chatComposer.dispatch("submit");
  await flush();
  assert.equal(socket.pendingMessageAcks.length, 1);

  socket.deferJoinAcks = true;
  socket.trigger("disconnect");
  socket.trigger("connect");
  await flush();
  assert.equal(socket.pendingJoinAcks.length, 1);
  harness.elements.chatMessage.value = "new session draft";

  socket.resolveNextMessage();
  await flush();
  assert.equal(harness.elements.chatStatusText.textContent, "Reconnecting to the mehfil…");
  assert.equal(harness.elements.chatMessage.value, "new session draft");
  assert.equal(harness.elements.chatSend.disabled, true);

  socket.resolveNextJoin();
  await flush();
  assert.equal(harness.elements.chatStatusText.textContent, "mehfil live hai");
  assert.equal(harness.elements.chatSend.disabled, false);

  socket.deferMessageAcks = false;
  harness.elements.chatMessage.value = "message from the current session";
  await harness.elements.chatComposer.dispatch("submit");
  await flush();
  assert.equal(harness.elements.chatMessage.value, "");
  assert.equal(harness.elements.chatStatusText.textContent, "mehfil live hai");
  assert.equal(harness.elements.chatSend.disabled, false);
});

test("a stale message error cannot overwrite a pending rejoin", async () => {
  const harness = createHarness({ savedName: "Lucky" });
  harness.open();
  harness.loadClient();
  await flush();
  const socket = harness.sockets[0];
  socket.trigger("connect");
  await flush();

  socket.deferMessageAcks = true;
  harness.elements.chatMessage.value = "old message";
  void harness.elements.chatComposer.dispatch("submit");
  await flush();

  socket.deferJoinAcks = true;
  socket.trigger("disconnect");
  socket.trigger("connect");
  await flush();
  harness.elements.chatMessage.value = "keep this draft";

  socket.resolveNextMessage({ ok: false, error: "old message failed" });
  await flush();
  assert.notEqual(harness.elements.chatStatusText.textContent, "old message failed");
  assert.equal(harness.elements.chatMessage.value, "keep this draft");
  assert.equal(harness.elements.chatSend.disabled, true);

  socket.resolveNextJoin();
  await flush();
  assert.equal(harness.elements.chatStatusText.textContent, "mehfil live hai");
  assert.equal(harness.elements.chatSend.disabled, false);
});
