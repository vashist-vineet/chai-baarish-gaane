import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { io as createClient } from "socket.io-client";
import { ALLOWED_REACTIONS, MAX_MESSAGES, createChatApplication } from "../server.js";

let application;
let url;
const clients = [];

function connectClient() {
  return new Promise((resolve, reject) => {
    const client = createClient(url, { forceNew: true });
    clients.push(client);
    client.once("connect", () => resolve(client));
    client.once("connect_error", reject);
  });
}

function connectClientWithOrigin(origin) {
  return new Promise((resolve, reject) => {
    const client = createClient(url, {
      transports: ["websocket"],
      forceNew: true,
      extraHeaders: { Origin: origin }
    });
    clients.push(client);
    client.once("connect", () => resolve(client));
    client.once("connect_error", reject);
  });
}

function emit(client, event, payload) {
  return new Promise((resolve) => client.emit(event, payload, resolve));
}

function once(client, event) {
  return new Promise((resolve) => client.once(event, resolve));
}

before(async () => {
  application = createChatApplication();
  await new Promise((resolve) => application.server.listen(0, "127.0.0.1", resolve));
  url = `http://127.0.0.1:${application.server.address().port}`;
});

after(async () => {
  clients.forEach((client) => client.disconnect());
  await new Promise((resolve) => application.io.close(resolve));
  await new Promise((resolve) => application.server.close(resolve));
});

test("two participants exchange a reply and toggle a reaction", async () => {
  const lucky = await connectClient();
  const mehak = await connectClient();
  await emit(lucky, "chat:join", { name: "Lucky" });
  const twoPresent = once(lucky, "presence:update");
  await emit(mehak, "chat:join", { name: "Mehak" });
  assert.equal((await twoPresent).count, 2);

  const receivedByMehak = once(mehak, "chat:message");
  const sent = await emit(lucky, "chat:message", { text: "chai ready?", environment: "monsoon" });
  assert.equal(sent.ok, true);
  assert.equal((await receivedByMehak).text, "chai ready?");

  await new Promise((resolve) => setTimeout(resolve, 950));
  const reply = await emit(mehak, "chat:message", { text: "haan, bilkul", environment: "spring", replyTo: sent.message.id });
  assert.equal(reply.ok, true);
  assert.equal(reply.message.replyTo.text, "chai ready?");
  assert.equal(reply.message.environment, "spring");

  const reactionUpdate = once(mehak, "chat:reaction");
  const reaction = await emit(lucky, "chat:reaction", { messageId: reply.message.id, reaction: "☕" });
  assert.equal(reaction.ok, true);
  assert.equal((await reactionUpdate).reactions["☕"], 1);
  await new Promise((resolve) => setTimeout(resolve, 150));
  const toggled = await emit(lucky, "chat:reaction", { messageId: reply.message.id, reaction: "☕" });
  assert.equal(toggled.active, false);
  assert.deepEqual(ALLOWED_REACTIONS, ["❤️", "☕", "🌧️", "✨"]);

  const onePresent = once(lucky, "presence:update");
  mehak.emit("chat:leave");
  assert.equal((await onePresent).count, 1);
});

test("health check is minimal and origin policy covers WebSocket upgrades", async () => {
  const response = await fetch(`${url}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, service: "chai-pe-chat" });

  const productionClient = await connectClientWithOrigin("https://baarishfm.vercel.app");
  assert.equal(productionClient.connected, true);

  await assert.rejects(
    connectClientWithOrigin("https://unapproved.example"),
    /websocket error|xhr poll error|server error/i
  );
});

test("history, XSS-shaped text and invalid payloads stay safe server-side", async () => {
  const first = clients[0];
  await new Promise((resolve) => setTimeout(resolve, 950));
  const xss = await emit(first, "chat:message", { text: "<script>alert(1)</script>", environment: "desert" });
  assert.equal(xss.ok, true);
  assert.equal(xss.message.text, "<script>alert(1)</script>");

  const newcomer = await connectClient();
  const init = once(newcomer, "chat:init");
  await emit(newcomer, "chat:join", { name: "Kabir" });
  assert.ok((await init).messages.some((message) => message.id === xss.message.id));

  const invalidReaction = await emit(newcomer, "chat:reaction", { messageId: xss.message.id, reaction: "🔥" });
  assert.equal(invalidReaction.ok, false);
  const invalidEnvironment = await new Promise(async (resolve) => {
    await new Promise((wait) => setTimeout(wait, 950));
    resolve(await emit(newcomer, "chat:message", { text: "safe environment", environment: "javascript:" }));
  });
  assert.equal(invalidEnvironment.message.environment, "monsoon");
});

test("message and duplicate rate limits reject spam", async () => {
  const spammer = await connectClient();
  await emit(spammer, "chat:join", { name: "Spammer" });
  const first = await emit(spammer, "chat:message", { text: "same", environment: "coast" });
  assert.equal(first.ok, true);
  await new Promise((resolve) => setTimeout(resolve, 950));
  const duplicate = await emit(spammer, "chat:message", { text: "same", environment: "coast" });
  assert.equal(duplicate.ok, false);
  const tooFast = await emit(spammer, "chat:message", { text: "another", environment: "coast" });
  assert.equal(tooFast.ok, false);
  assert.equal(MAX_MESSAGES, 150);
});

test("a fresh server process starts with empty in-memory chat state", async () => {
  const freshApplication = createChatApplication();
  assert.deepEqual(freshApplication.store.getRecentMessages(), []);
  assert.equal(freshApplication.store.participants.size, 0);
  await new Promise((resolve) => freshApplication.io.close(resolve));
});
 
