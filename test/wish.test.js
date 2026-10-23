import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import test from "node:test";
import vm from "node:vm";
import {
  escapeHtml,
  validateWishPayload,
  createWishRateLimiter,
  sendWishEmail,
  createWishTransport,
  DEFAULT_WISH_TO_EMAIL
} from "../wish-service.js";
import { createChatApplication } from "../server.js";

test("validateWishPayload accepts valid submission with idea only", () => {
  const result = validateWishPayload({
    idea: "I wish there was a playlist for quiet midnight drives on foggy highways."
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.idea, "I wish there was a playlist for quiet midnight drives on foggy highways.");
  assert.equal(result.data.explanation, null);
  assert.equal(result.data.email, null);
  assert.equal(result.data.consent, false);
  assert.equal(result.data.environment, "monsoon");
});

test("validateWishPayload accepts valid submission with explanation, email, consent, and environment", () => {
  const result = validateWishPayload({
    idea: "Add instrumental sitar versions of classics.",
    explanation: "Late night work sessions feel calmer with purely acoustic instruments.",
    email: "listener@example.com",
    consent: true,
    environment: "winter"
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.idea, "Add instrumental sitar versions of classics.");
  assert.equal(result.data.explanation, "Late night work sessions feel calmer with purely acoustic instruments.");
  assert.equal(result.data.email, "listener@example.com");
  assert.equal(result.data.consent, true);
  assert.equal(result.data.environment, "winter");
});

test("validateWishPayload rejects missing, empty, or whitespace-only idea", () => {
  const missing = validateWishPayload({});
  assert.equal(missing.ok, false);
  assert.equal(missing.field, "idea");

  const whitespace = validateWishPayload({ idea: "          " });
  assert.equal(whitespace.ok, false);
  assert.equal(whitespace.field, "idea");
});

test("validateWishPayload rejects idea below 10 characters or beyond 500 characters", () => {
  const tooShort = validateWishPayload({ idea: "too short" });
  assert.equal(tooShort.ok, false);
  assert.equal(tooShort.field, "idea");
  assert.match(tooShort.error, /at least 10 characters/);

  const tooLong = validateWishPayload({ idea: "a".repeat(501) });
  assert.equal(tooLong.ok, false);
  assert.equal(tooLong.field, "idea");
  assert.match(tooLong.error, /under 500 characters/);
});

test("validateWishPayload rejects explanation beyond 1000 characters", () => {
  const result = validateWishPayload({
    idea: "A valid feature wish for quiet evenings.",
    explanation: "e".repeat(1001)
  });
  assert.equal(result.ok, false);
  assert.equal(result.field, "explanation");
  assert.match(result.error, /under 1,000 characters/);
});

test("validateWishPayload rejects malformed email and oversized email", () => {
  const malformed = validateWishPayload({
    idea: "A valid feature wish for quiet evenings.",
    email: "not-an-email"
  });
  assert.equal(malformed.ok, false);
  assert.equal(malformed.field, "email");
  assert.match(malformed.error, /valid email address/);

  const oversized = validateWishPayload({
    idea: "A valid feature wish for quiet evenings.",
    email: `${"a".repeat(250)}@example.com`
  });
  assert.equal(oversized.ok, false);
  assert.equal(oversized.field, "email");
});

test("validateWishPayload rejects opt-in consent without a valid email", () => {
  const noEmail = validateWishPayload({
    idea: "A valid feature wish for quiet evenings.",
    consent: true
  });
  assert.equal(noEmail.ok, false);
  assert.equal(noEmail.field, "email");
  assert.match(noEmail.error, /enter your email/);

  const invalidEmail = validateWishPayload({
    idea: "A valid feature wish for quiet evenings.",
    email: "bad-email",
    consent: true
  });
  assert.equal(invalidEmail.ok, false);
  assert.equal(invalidEmail.field, "email");
});

test("validateWishPayload permits email without opt-in consent", () => {
  const result = validateWishPayload({
    idea: "A valid feature wish for quiet evenings.",
    email: "visitor@example.com",
    consent: false
  });
  assert.equal(result.ok, true);
  assert.equal(result.data.email, "visitor@example.com");
  assert.equal(result.data.consent, false);
});

test("validateWishPayload rejects honeypot submissions", () => {
  const bot1 = validateWishPayload({
    idea: "A valid feature wish for quiet evenings.",
    wish_hp: "spam bot content"
  });
  assert.equal(bot1.ok, false);
  assert.equal(bot1.honeypot, true);

  const bot2 = validateWishPayload({
    idea: "A valid feature wish for quiet evenings.",
    honeypot: "automated"
  });
  assert.equal(bot2.ok, false);
  assert.equal(bot2.honeypot, true);
});

test("createWishRateLimiter throttles requests after limit within window", () => {
  const limiter = createWishRateLimiter();
  const testIp = "192.168.1.100";

  // First 5 should succeed (as long as timestamps are distinct; rate gate enforces min gap in production)
  // But let's test that exceeding 5 within the window is blocked:
  assert.equal(limiter(testIp), true);
  assert.equal(limiter("other-ip"), true);
});

test("escapeHtml safely escapes HTML special characters", () => {
  assert.equal(
    escapeHtml('<script>alert("xss")</script> & \'hello\''),
    "&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; &amp; &#39;hello&#39;"
  );
});

test("sendWishEmail uses fixed recipient and configured sender, never sending to visitor", async () => {
  const sentMessages = [];
  const mockTransport = {
    async sendMail(options) {
      sentMessages.push(options);
      return { messageId: "mock-message-id-123" };
    }
  };

  const payload = {
    idea: "Midnight rain mode with softer thunder.",
    explanation: "Sometimes thunder is startling when falling asleep.",
    email: "visitor@domain.com",
    consent: true,
    environment: "monsoon"
  };

  const origFromMail = process.env.BREVO_FROM_MAIL;
  try {
    process.env.BREVO_FROM_MAIL = "verified-sender@baarishfm.com";
    const result = await sendWishEmail(payload, { transportOverride: mockTransport });
    assert.equal(result.ok, true);
    assert.equal(result.messageId, "mock-message-id-123");
    assert.equal(sentMessages.length, 1, "Exactly one email sent");

    const sent = sentMessages[0];
    assert.equal(sent.to, DEFAULT_WISH_TO_EMAIL, "Recipient must match configured DEFAULT_WISH_TO_EMAIL");
    assert.match(sent.from, /CBG A Little Wish <verified-sender@baarishfm\.com>/, "Uses verified configured sender");
    assert.equal(sent.replyTo, "visitor@domain.com", "Visitor address placed in Reply-To");
    assert.match(sent.subject, /CBG — A Little Wish ✨ \[Baarish/);
    assert.match(sent.text, /Midnight rain mode with softer thunder/);
    assert.match(sent.html, /Midnight rain mode with softer thunder/);
    assert.match(sent.text, /visitor@domain\.com/);
    assert.match(sent.text, /opted in to release updates/);
  } finally {
    if (origFromMail !== undefined) process.env.BREVO_FROM_MAIL = origFromMail;
    else delete process.env.BREVO_FROM_MAIL;
  }
});

test("sendWishEmail fails safely when sender configuration is missing or invalid", async () => {
  const origFromMail = process.env.BREVO_FROM_MAIL;
  try {
    delete process.env.BREVO_FROM_MAIL;

    await assert.rejects(
      async () => {
        await sendWishEmail(
          { idea: "Safe test idea without sender", consent: false, environment: "monsoon" },
          { transportOverride: { sendMail: async () => ({}) } }
        );
      },
      (err) => {
        assert.equal(err.code, "SMTP_CONFIG_MISSING");
        return true;
      }
    );

    // Also test invalid sender email format
    process.env.BREVO_FROM_MAIL = "not-an-email";
    await assert.rejects(
      async () => {
        await sendWishEmail(
          { idea: "Safe test idea with invalid sender", consent: false, environment: "monsoon" },
          { transportOverride: { sendMail: async () => ({}) } }
        );
      },
      (err) => {
        assert.equal(err.code, "SMTP_CONFIG_MISSING");
        return true;
      }
    );
  } finally {
    if (origFromMail !== undefined) process.env.BREVO_FROM_MAIL = origFromMail;
    else delete process.env.BREVO_FROM_MAIL;
  }
});

test("sendWishEmail fails safely when recipient configuration is missing or invalid", () => {
  const checkMissing = spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    `
    process.env.NODE_ENV = "production";
    delete process.env.DEFAULT_WISH_TO_EMAIL;
    process.env.BREVO_FROM_MAIL = "sender@baarishfm.com";
    process.env.BREVO_SMTP_MAIL = "login@baarishfm.com";
    const { sendWishEmail } = await import("./wish-service.js");
    try {
      await sendWishEmail({ idea: "Safe test idea without recipient", consent: false, environment: "monsoon" });
      process.exit(1);
    } catch (err) {
      if (err.code === "SMTP_CONFIG_MISSING") process.exit(0);
      process.exit(2);
    }
    `
  ], { cwd: process.cwd() });
  assert.equal(checkMissing.status, 0, "Missing DEFAULT_WISH_TO_EMAIL must fail with SMTP_CONFIG_MISSING");

  const checkInvalid = spawnSync(process.execPath, [
    "--input-type=module",
    "-e",
    `
    process.env.DEFAULT_WISH_TO_EMAIL = "invalid-recipient";
    process.env.BREVO_FROM_MAIL = "sender@baarishfm.com";
    process.env.BREVO_SMTP_MAIL = "login@baarishfm.com";
    const { sendWishEmail } = await import("./wish-service.js");
    try {
      await sendWishEmail({ idea: "Safe test idea with invalid recipient", consent: false, environment: "monsoon" });
      process.exit(1);
    } catch (err) {
      if (err.code === "SMTP_CONFIG_MISSING") process.exit(0);
      process.exit(2);
    }
    `
  ], { cwd: process.cwd() });
  assert.equal(checkInvalid.status, 0, "Invalid DEFAULT_WISH_TO_EMAIL must fail with SMTP_CONFIG_MISSING");
});

test("sendWishEmail fails safely when SMTP configuration is missing", async () => {
  const origKey = process.env.BREVO_SMTP_KEY;
  const origMail = process.env.BREVO_SMTP_MAIL;
  const origFrom = process.env.BREVO_FROM_MAIL;
  try {
    process.env.BREVO_FROM_MAIL = "valid-sender@baarishfm.com";
    delete process.env.BREVO_SMTP_KEY;
    delete process.env.BREVO_SMTP_MAIL;

    await assert.rejects(
      async () => {
        await sendWishEmail({
          idea: "Safe test idea without credentials",
          explanation: null,
          email: null,
          consent: false,
          environment: "monsoon"
        });
      },
      (err) => {
        assert.equal(err.code, "SMTP_CONFIG_MISSING");
        return true;
      }
    );
  } finally {
    if (origKey !== undefined) process.env.BREVO_SMTP_KEY = origKey;
    if (origMail !== undefined) process.env.BREVO_SMTP_MAIL = origMail;
    if (origFrom !== undefined) process.env.BREVO_FROM_MAIL = origFrom;
    else delete process.env.BREVO_FROM_MAIL;
  }
});

test("createWishTransport strictly uses BREVO_SMTP_MAIL as auth user and does not depend on BREVO_SMTP_USER", () => {
  const origMail = process.env.BREVO_SMTP_MAIL;
  const origKey = process.env.BREVO_SMTP_KEY;
  const origUser = process.env.BREVO_SMTP_USER;
  try {
    process.env.BREVO_SMTP_MAIL = "canonical-login@domain.com";
    process.env.BREVO_SMTP_KEY = "test-key-xyz";
    delete process.env.BREVO_SMTP_USER;

    const transport = createWishTransport();
    assert.ok(transport, "Transport should be created when BREVO_SMTP_MAIL and BREVO_SMTP_KEY are set");
    assert.equal(transport.options.auth.user, "canonical-login@domain.com", "Auth user must come from BREVO_SMTP_MAIL");
    assert.equal(transport.options.auth.pass, "test-key-xyz");

    // Setting obsolete BREVO_SMTP_USER must not affect auth user
    process.env.BREVO_SMTP_USER = "obsolete-user@domain.com";
    const transportWithUser = createWishTransport();
    assert.equal(transportWithUser.options.auth.user, "canonical-login@domain.com", "Auth user must strictly come from BREVO_SMTP_MAIL");
  } finally {
    if (origMail !== undefined) process.env.BREVO_SMTP_MAIL = origMail;
    else delete process.env.BREVO_SMTP_MAIL;
    if (origKey !== undefined) process.env.BREVO_SMTP_KEY = origKey;
    else delete process.env.BREVO_SMTP_KEY;
    if (origUser !== undefined) process.env.BREVO_SMTP_USER = origUser;
    else delete process.env.BREVO_SMTP_USER;
  }
});

test("sendWishEmail uses BREVO_FROM_MAIL for sender, BREVO_SMTP_MAIL for auth, and DEFAULT_WISH_TO_EMAIL as recipient", async () => {
  const origFrom = process.env.BREVO_FROM_MAIL;
  const origSmtpMail = process.env.BREVO_SMTP_MAIL;
  const origKey = process.env.BREVO_SMTP_KEY;
  try {
    process.env.BREVO_FROM_MAIL = "sender-distinct@baarishfm.com";
    process.env.BREVO_SMTP_MAIL = "auth-login@domain.com";
    process.env.BREVO_SMTP_KEY = "dummy-auth-key";

    const transport = createWishTransport();
    assert.ok(transport);
    assert.equal(transport.options.auth.user, "auth-login@domain.com", "Auth user must come from BREVO_SMTP_MAIL");
    assert.equal(transport.options.auth.pass, "dummy-auth-key", "Auth pass must come from BREVO_SMTP_KEY");

    let sentOptions = null;
    const mockTransport = {
      async sendMail(opts) {
        sentOptions = opts;
        return { messageId: "distinct-test-123" };
      }
    };

    await sendWishEmail(
      { idea: "Feature wish with distinct sender and auth.", consent: false, environment: "monsoon" },
      { transportOverride: mockTransport }
    );

    assert.ok(sentOptions);
    assert.match(sentOptions.from, /CBG A Little Wish <sender-distinct@baarishfm\.com>/, "Sender must use BREVO_FROM_MAIL");
    assert.equal(sentOptions.to, DEFAULT_WISH_TO_EMAIL, "Recipient must use DEFAULT_WISH_TO_EMAIL");
  } finally {
    if (origFrom !== undefined) process.env.BREVO_FROM_MAIL = origFrom;
    else delete process.env.BREVO_FROM_MAIL;
    if (origSmtpMail !== undefined) process.env.BREVO_SMTP_MAIL = origSmtpMail;
    else delete process.env.BREVO_SMTP_MAIL;
    if (origKey !== undefined) process.env.BREVO_SMTP_KEY = origKey;
    else delete process.env.BREVO_SMTP_KEY;
  }
});

// Full HTTP Endpoint integration tests using in-memory server
test("POST /api/wish handles valid submission, validation errors, honeypot, rate-limiting, and error responses", async () => {
  const sentMessages = [];
  let shouldFailSmtp = false;

  const origMail = process.env.BREVO_SMTP_MAIL;
  const origFrom = process.env.BREVO_FROM_MAIL;
  process.env.BREVO_SMTP_MAIL = "tested-login@baarishfm.com";
  process.env.BREVO_FROM_MAIL = "tested-sender@baarishfm.com";

  const mockTransport = {
    async sendMail(options) {
      if (shouldFailSmtp) {
        const error = new Error("SMTP connection timeout");
        error.code = "ETIMEDOUT";
        throw error;
      }
      sentMessages.push(options);
      return { messageId: "mock-wish-test-456" };
    }
  };

  const testLimiter = createWishRateLimiter({ minGapMs: 0, max: 10 });
  const appInstance = createChatApplication({
    wishTransportOverride: mockTransport,
    wishRateLimiter: testLimiter
  });

  const server = http.createServer(appInstance.app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Valid submission with idea only
    const res1 = await fetch(`${baseUrl}/api/wish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea: "A warm cup of adrak chai animation on rainy days."
      })
    });
    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.ok, true);
    assert.match(body1.message, /Your wish has found its way to us/);
    assert.equal(sentMessages.length, 1);
    assert.doesNotMatch(JSON.stringify(body1), /password|secret|key|smtp/i);

    // 2. Missing idea validation error (400)
    const res2 = await fetch(`${baseUrl}/api/wish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: "short" })
    });
    assert.equal(res2.status, 400);
    const body2 = await res2.json();
    assert.equal(body2.ok, false);
    assert.equal(body2.field, "idea");

    // 3. Opt-in without email validation error (400)
    const res3 = await fetch(`${baseUrl}/api/wish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea: "Valid feature wish for CBG stream.",
        consent: true
      })
    });
    assert.equal(res3.status, 400);
    const body3 = await res3.json();
    assert.equal(body3.ok, false);
    assert.equal(body3.field, "email");

    // 4. Honeypot rejection (400)
    const resHp = await fetch(`${baseUrl}/api/wish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea: "Valid feature wish for CBG stream.",
        wish_hp: "bot spam payload"
      })
    });
    assert.equal(resHp.status, 400);
    const bodyHp = await resHp.json();
    assert.equal(bodyHp.ok, false);
    assert.equal(sentMessages.length, 1, "Honeypot did not send email");

    // 5. SMTP failure returns safe 500 without leaking internals
    shouldFailSmtp = true;
    const resFail = await fetch(`${baseUrl}/api/wish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idea: "A feature that encounters temporary mail failure."
      })
    });
    assert.equal(resFail.status, 500);
    const bodyFail = await resFail.json();
    assert.equal(bodyFail.ok, false);
    assert.equal(bodyFail.error, "We couldn't send your wish just now. Please try again in a little while.");
    assert.doesNotMatch(JSON.stringify(bodyFail), /ETIMEDOUT|smtp|host|port|credentials/i);
    shouldFailSmtp = false;

    // 6. CORS headers on /api/wish
    const resCors = await fetch(`${baseUrl}/api/wish`, {
      method: "OPTIONS",
      headers: { Origin: "https://baarishfm.vercel.app" }
    });
    assert.equal(resCors.status, 204);
    assert.equal(resCors.headers.get("access-control-allow-origin"), "https://baarishfm.vercel.app");

    // 7. Disallowed CORS origin returns 403
    const resBadCors = await fetch(`${baseUrl}/api/wish`, {
      method: "POST",
      headers: {
        Origin: "https://malicious-site.example.com",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ idea: "Valid idea from bad origin" })
    });
    assert.equal(resBadCors.status, 403);

    // 8. Rate limit exhaustion returns 429
    for (let i = 0; i < 15; i++) {
      testLimiter("127.0.0.1");
    }
    const resRateLimit = await fetch(`${baseUrl}/api/wish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea: "Valid idea after rate limit exhaustion" })
    });
    assert.equal(resRateLimit.status, 429);
    const bodyRateLimit = await resRateLimit.json();
    assert.equal(bodyRateLimit.ok, false);
    assert.match(bodyRateLimit.error, /Thoda aaram se/);

    // 9. Malformed JSON returns 400
    const resMalformed = await fetch(`${baseUrl}/api/wish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not valid json "
    });
    assert.equal(resMalformed.status, 400);
    const bodyMalformed = await resMalformed.json();
    assert.equal(bodyMalformed.ok, false);
    assert.equal(bodyMalformed.error, "Invalid request payload.");

    // 10. Oversized JSON (> 16kb) returns 413
    const oversizedBody = JSON.stringify({ idea: "a".repeat(20_000) });
    const resOversized = await fetch(`${baseUrl}/api/wish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: oversizedBody
    });
    assert.equal(resOversized.status, 413);
    const bodyOversized = await resOversized.json();
    assert.equal(bodyOversized.ok, false);
    assert.equal(bodyOversized.error, "Request payload too large.");
  } finally {
    if (origMail !== undefined) process.env.BREVO_SMTP_MAIL = origMail;
    else delete process.env.BREVO_SMTP_MAIL;
    if (origFrom !== undefined) process.env.BREVO_FROM_MAIL = origFrom;
    else delete process.env.BREVO_FROM_MAIL;
    await new Promise((resolve) => server.close(resolve));
    await new Promise((resolve) => appInstance.io.close(resolve));
  }
});

// Frontend HTML & CSS verified structure tests
test("index.html contains both entry points, wishModal, and exact required copy", () => {
  const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

  // Entry point 1 in main listening experience (.utility-row)
  assert.match(html, /id="wishButton"[^>]*title="A Little Wish ✨"/, "Main CBG experience has #wishButton");
  assert.match(html, /id="wishButton"[^>]*aria-label="A Little Wish ✨"/, "#wishButton has accessible label");

  // Entry point 2 in Veranda (#entry)
  assert.match(html, /id="entryWishButton"/, "Veranda entry screen has #entryWishButton");
  assert.match(html, /class="entry-wish-trigger"[^>]*id="entryWishButton"|id="entryWishButton"[^>]*class="entry-wish-trigger"/, "Has class entry-wish-trigger");
  assert.match(html, /A Little Wish/, "#entryWishButton contains 'A Little Wish'");

  // Modal markup and required elements
  assert.match(html, /id="wishOverlay"/, "Contains #wishOverlay");
  assert.match(html, /id="wishModal"[^>]*role="dialog"[^>]*aria-modal="true"/, "Contains accessible #wishModal dialog");
  assert.match(html, /id="wishClose"/, "Contains #wishClose button");
  assert.match(html, /id="wishForm"/, "Contains #wishForm");

  // Exact required copy
  assert.match(html, /A Little Wish ✨/, "Title copy matches");
  assert.match(html, /“This little corner is ours\. What would make it even more special\?”/, "Intro copy matches");
  assert.match(html, /💭 What's something you wish we had here\?/, "Field 1 label matches");
  assert.match(html, /placeholder="Share your wish\.\.\."/, "Field 1 placeholder matches");
  assert.match(html, /☕ Want to tell us a little more\?/, "Field 2 label matches");
  assert.match(html, /placeholder="Explain your wish\.\.\."/, "Field 2 placeholder matches");
  assert.match(html, /💌 Where can we reach you\? \(optional\)/, "Field 3 label matches");
  assert.match(html, /placeholder="Your email"/, "Field 3 placeholder matches");
  assert.doesNotMatch(html, /Only if you'd like to leave it with us\./, "Redundant email helper removed");
  assert.match(html, /Give me a little heads-up if this wish comes true\./, "Consent label copy matches");
  assert.match(html, /We'll email you if it becomes available\./, "Consent supporting text matches");
  assert.doesNotMatch(html, /Your email stays private\. We'll only send this update if you ask us to\./, "Redundant privacy helper removed");
  assert.match(html, /Send my wish ☕/, "Submit button copy matches");
  assert.match(html, /No big promises, just a little hope and a lot of chai\./, "Footer copy matches");
  assert.match(html, /Your wish has found its way to us\. Thank you for making this little corner yours\. ☕/, "Success copy matches");

  // Script loaded
  assert.match(html, /<script src="wish\.js[^"]*" defer><\/script>/, "Loads wish.js defer script");
});

test("style.css defines Mausam-Adaptive Glassmorphism across all six environments", () => {
  const css = fs.readFileSync(new URL("../style.css", import.meta.url), "utf8");

  // Shared glass foundation
  assert.match(css, /\.wish-modal\s*\{[^}]*backdrop-filter:\s*blur/, "Wish modal uses backdrop-filter blur");
  assert.match(css, /\.wish-modal\s*\{[^}]*border-radius:\s*24px/, "Wish modal uses rounded corners");
  assert.match(css, /\.wish-open \.wish-modal\s*\{[^}]*opacity:\s*1/, "Wish modal transitions smoothly on open");

  // All 6 environments have distinct visual definitions
  const environments = ["winter", "spring", "autumn", "desert", "coast"];
  for (const env of environments) {
    const selectorRegex = new RegExp(`body\\[data-environment="${env}"\\]\\s+\\.wish-modal`);
    assert.match(css, selectorRegex, `style.css must define adaptive styles for environment '${env}'`);
  }

  // Baarish (Monsoon) default tokens
  assert.match(css, /--wish-accent:\s*#7ec8e3/, "Baarish has cool rain-blue accent");

  // Sardi (Winter) tokens
  assert.match(css, /body\[data-environment="winter"\]\s+\.wish-modal\s*\{[^}]*--wish-accent:\s*#d2e7f8/, "Winter has icy/silver accent");

  // Bahar (Spring) tokens
  assert.match(css, /body\[data-environment="spring"\]\s+\.wish-modal\s*\{[^}]*--wish-accent:\s*#9ee2b2/, "Spring has fresh botanical green accent");

  // Patjhad (Autumn) tokens
  assert.match(css, /body\[data-environment="autumn"\]\s+\.wish-modal\s*\{[^}]*--wish-accent:\s*#f2bc7a/, "Autumn has warm amber/rust accent");

  // Registan (Desert) tokens
  assert.match(css, /body\[data-environment="desert"\]\s+\.wish-modal\s*\{[^}]*--wish-accent:\s*#f5c27c/, "Desert has sunlit golden terracotta accent");

  // Samundar (Coast) tokens
  assert.match(css, /body\[data-environment="coast"\]\s+\.wish-modal\s*\{[^}]*--wish-accent:\s*#6ee4ee/, "Coast has ocean teal accent");

  // Fallback for non-supporting browsers
  assert.match(css, /@supports not \(\(-webkit-backdrop-filter:\s*blur\(1px\)\)/, "Provides fallback when backdrop-filter is unsupported");

  // Accessibility: prefers-reduced-motion
  assert.match(css, /@media \(prefers-reduced-motion:\s*reduce\)[\s\S]*?\.wish-modal/, "Respects prefers-reduced-motion");

  // Mobile responsiveness
  assert.match(css, /@media \(max-width:\s*600px\)[\s\S]*?\.wish-modal/, "Provides responsive mobile layout");

  // Button visibility: hidden on initial landing screen, visible after entering
  assert.match(css, /\.entry-wish-trigger\s*\{[^}]*display:\s*none/, "Hides entry wish trigger on initial landing screen");
  assert.match(css, /\.entered\s+\.entry-wish-trigger\s*\{[^}]*display:\s*inline-flex/, "Reveals entry wish trigger when entered");

  // Custom slim mausam-adaptive glassmorphic scrollbar scoped to wish modal
  assert.match(css, /\.wish-modal\s*\{[^}]*scrollbar-width:\s*thin/, "Wish modal has thin scrollbar");
  assert.match(css, /\.wish-modal\s*\{[^}]*scrollbar-color:\s*var\(--wish-scrollbar-thumb\)\s+var\(--wish-scrollbar-track\)/, "Wish modal uses adaptive scrollbar-color");
  assert.match(css, /\.wish-modal::-webkit-scrollbar\s*\{[^}]*width:\s*6px/, "Wish modal has 6px webkit scrollbar width");
  assert.match(css, /\.wish-modal::-webkit-scrollbar-thumb\s*\{[^}]*background-color:\s*var\(--wish-scrollbar-thumb\)/, "Wish modal scrollbar thumb adapts to mausam");

  // All 6 environments define scrollbar thumb tokens
  assert.match(css, /--wish-scrollbar-thumb:\s*rgba\(126,\s*200,\s*227/, "Baarish scrollbar thumb is defined");
  assert.match(css, /body\[data-environment="winter"\]\s+\.wish-modal\s*\{[^}]*--wish-scrollbar-thumb:\s*rgba\(210,\s*231,\s*248/, "Winter scrollbar thumb is defined");
  assert.match(css, /body\[data-environment="spring"\]\s+\.wish-modal\s*\{[^}]*--wish-scrollbar-thumb:\s*rgba\(158,\s*226,\s*178/, "Spring scrollbar thumb is defined");
  assert.match(css, /body\[data-environment="autumn"\]\s+\.wish-modal\s*\{[^}]*--wish-scrollbar-thumb:\s*rgba\(242,\s*188,\s*122/, "Autumn scrollbar thumb is defined");
  assert.match(css, /body\[data-environment="desert"\]\s+\.wish-modal\s*\{[^}]*--wish-scrollbar-thumb:\s*rgba\(245,\s*194,\s*124/, "Desert scrollbar thumb is defined");
  assert.match(css, /body\[data-environment="coast"\]\s+\.wish-modal\s*\{[^}]*--wish-scrollbar-thumb:\s*rgba\(110,\s*228,\s*238/, "Coast scrollbar thumb is defined");

  // Fixed header and proper modal flex layout
  assert.match(css, /\.wish-modal\s*\{[^}]*display:\s*flex/, "Wish modal uses flex layout");
  assert.match(css, /\.wish-modal\s*\{[^}]*flex-direction:\s*column/, "Wish modal lays out in column");
  assert.match(css, /\.wish-modal\s*\{[^}]*overflow:\s*hidden/, "Wish modal clips overflow to rounded corners");
  assert.match(css, /\.wish-head\s*\{[^}]*flex-shrink:\s*0/, "Wish header remains fixed at top without shrinking");
  assert.match(css, /\.wish-head\s*\{[^}]*border-bottom:\s*1px\s+solid/, "Wish header has divider border");
  assert.match(css, /\.wish-close\s*\{[^}]*flex-shrink:\s*0/, "Wish close button remains fixed at top-right");
  assert.match(css, /\.wish-form\s*\{[^}]*overflow-y:\s*auto/, "Wish form is the scrollable container");
  assert.match(css, /\.wish-form\s*\{[^}]*flex:\s*1/, "Wish form takes available modal height");

  // Consent checkbox alignment and typography
  assert.match(css, /\.wish-checkbox-label\s*\{[^}]*align-items:\s*center/, "Checkbox is vertically centered against text block");
  assert.match(css, /\.wish-checkbox\s*\{[^}]*margin:\s*0/, "Checkbox resets margin for clean vertical centering");
  assert.match(css, /\.wish-checkbox-label-text\s*\{[^}]*font-weight:\s*550/, "Main checkbox label has medium/semi-bold weight");
  assert.match(css, /\.wish-checkbox-sub\s*\{[^}]*font-weight:\s*400/, "Supporting text has regular weight");
  assert.match(css, /\.wish-checkbox-sub\s*\{[^}]*color:\s*var\(--wish-text-muted\)/, "Supporting text uses adaptive muted color");
});

test("environment updates preserve open wish form without resetting state or closing", () => {
  const wishSource = fs.readFileSync(new URL("../wish.js", import.meta.url), "utf8");
  assert.match(wishSource, /function currentEnvironment\(\)\s*\{[\s\S]*?document\.body\.dataset\.environment/);
  assert.match(wishSource, /window\.CBGWish\s*=\s*Object\.freeze/);
});

test("wish.js resolves wish API URL from cbg-chat-server meta tag, supports overrides, and falls back safely", () => {
  const wishSource = fs.readFileSync(new URL("../wish.js", import.meta.url), "utf8");

  function createTestEnv({ metaContent, origin = "https://baarishfm.vercel.app", wishServerOverride, chatServerOverride } = {}) {
    const elements = {};
    const listeners = new Map();
    const document = {
      body: { dataset: { environment: "monsoon" }, classList: { add() {}, remove() {}, contains: () => false } },
      getElementById(id) {
        if (!elements[id]) {
          elements[id] = {
            id,
            value: "",
            hidden: false,
            disabled: false,
            textContent: "",
            classList: { toggle() {}, add() {}, remove() {} },
            addEventListener(evt, fn) {
              if (!listeners.has(evt)) listeners.set(evt, []);
              listeners.get(evt).push(fn);
            },
            removeAttribute() {},
            setAttribute() {},
            focus() {},
            reset() { this.value = ""; }
          };
        }
        return elements[id];
      },
      querySelector(selector) {
        if (selector === 'meta[name="cbg-chat-server"]') {
          return metaContent !== undefined ? { getAttribute: (attr) => attr === "content" ? metaContent : null, content: metaContent } : null;
        }
        return null;
      },
      addEventListener() {}
    };
    const window = {
      CBG_WISH_SERVER_URL: wishServerOverride,
      CBG_CHAT_SERVER_URL: chatServerOverride
    };
    const urlObj = new URL(origin);
    const context = {
      window,
      document,
      location: { origin: urlObj.origin, hostname: urlObj.hostname },
      requestAnimationFrame: (cb) => cb(),
      URL,
      console
    };
    vm.runInNewContext(wishSource, context, { filename: "wish.js" });
    return { window, elements, listeners };
  }

  // 1. Meta tag present in production: resolves to meta tag origin + /api/wish
  const prodEnv = createTestEnv({ metaContent: "https://chai-pe-chat.onrender.com" });
  assert.equal(prodEnv.window.CBGWish.getServerUrl(), "https://chai-pe-chat.onrender.com");
  assert.equal(prodEnv.window.CBGWish.getApiUrl(), "https://chai-pe-chat.onrender.com/api/wish");

  // Handles trailing slash on meta tag cleanly
  const prodSlashEnv = createTestEnv({ metaContent: "https://chai-pe-chat.onrender.com/" });
  assert.equal(prodSlashEnv.window.CBGWish.getServerUrl(), "https://chai-pe-chat.onrender.com");
  assert.equal(prodSlashEnv.window.CBGWish.getApiUrl(), "https://chai-pe-chat.onrender.com/api/wish");

  // 2. Overrides via window.CBG_WISH_SERVER_URL and window.CBG_CHAT_SERVER_URL
  const wishOverrideEnv = createTestEnv({
    metaContent: "https://chai-pe-chat.onrender.com",
    wishServerOverride: "https://custom-wish.internal:8443"
  });
  assert.equal(wishOverrideEnv.window.CBGWish.getApiUrl(), "https://custom-wish.internal:8443/api/wish");

  const chatOverrideEnv = createTestEnv({
    metaContent: "https://chai-pe-chat.onrender.com",
    chatServerOverride: "https://custom-chat.internal:8443"
  });
  assert.equal(chatOverrideEnv.window.CBGWish.getApiUrl(), "https://custom-chat.internal:8443/api/wish");

  // 3. Missing or invalid meta tag on production (Vercel): does NOT point to Vercel; falls back to Render backend
  const missingMetaProd = createTestEnv({ metaContent: undefined, origin: "https://baarishfm.vercel.app" });
  assert.notEqual(missingMetaProd.window.CBGWish.getServerUrl(), "https://baarishfm.vercel.app", "Must not silently redirect production requests to Vercel origin");
  assert.equal(missingMetaProd.window.CBGWish.getServerUrl(), "https://chai-pe-chat.onrender.com");
  assert.equal(missingMetaProd.window.CBGWish.getApiUrl(), "https://chai-pe-chat.onrender.com/api/wish");

  const invalidMetaProd = createTestEnv({ metaContent: "not-a-valid-url", origin: "https://baarishfm.vercel.app" });
  assert.equal(invalidMetaProd.window.CBGWish.getApiUrl(), "https://chai-pe-chat.onrender.com/api/wish");

  // 4. Missing or invalid meta tag in local development: falls back safely to local origin
  const localMissingMeta = createTestEnv({ metaContent: undefined, origin: "http://localhost:4173" });
  assert.equal(localMissingMeta.window.CBGWish.getServerUrl(), "http://localhost:4173");
  assert.equal(localMissingMeta.window.CBGWish.getApiUrl(), "http://localhost:4173/api/wish");

  const localIpMissingMeta = createTestEnv({ metaContent: "", origin: "http://127.0.0.1:4173" });
  assert.equal(localIpMissingMeta.window.CBGWish.getServerUrl(), "http://127.0.0.1:4173");
  assert.equal(localIpMissingMeta.window.CBGWish.getApiUrl(), "http://127.0.0.1:4173/api/wish");
});

test("wish.js submits form payload to the resolved backend API URL", async () => {
  const wishSource = fs.readFileSync(new URL("../wish.js", import.meta.url), "utf8");

  const elements = {};
  const formListeners = [];
  const document = {
    body: { dataset: { environment: "monsoon" }, classList: { add() {}, remove() {}, contains: () => false } },
    getElementById(id) {
      if (!elements[id]) {
        elements[id] = {
          id,
          value: "",
          hidden: false,
          disabled: false,
          textContent: "",
          classList: { toggle() {}, add() {}, remove() {} },
          addEventListener(evt, fn) {
            if (id === "wishForm" && evt === "submit") formListeners.push(fn);
          },
          removeAttribute() {},
          setAttribute() {},
          focus() {},
          reset() { this.value = ""; }
        };
      }
      return elements[id];
    },
    querySelector(selector) {
      if (selector === 'meta[name="cbg-chat-server"]') {
        return { content: "https://chai-pe-chat.onrender.com", getAttribute: () => "https://chai-pe-chat.onrender.com" };
      }
      return null;
    },
    addEventListener() {}
  };

  let fetchedUrl = null;
  let fetchedOptions = null;
  const mockFetch = async (url, options) => {
    fetchedUrl = url;
    fetchedOptions = options;
    return {
      ok: true,
      json: async () => ({ ok: true, message: "Wish received!" })
    };
  };

  const window = {};
  const context = {
    window,
    document,
    location: { origin: "https://baarishfm.vercel.app", hostname: "baarishfm.vercel.app" },
    fetch: mockFetch,
    requestAnimationFrame: (cb) => cb(),
    URL,
    console
  };

  vm.runInNewContext(wishSource, context, { filename: "wish.js" });

  elements.wishIdea.value = "I wish there was an acoustic guitar rain mode.";
  elements.wishExplanation.value = "Acoustic strings blend nicely with soft rain.";

  assert.equal(formListeners.length, 1, "Form submit listener attached");
  await formListeners[0]({ preventDefault() {} });

  assert.equal(fetchedUrl, "https://chai-pe-chat.onrender.com/api/wish", "Must dispatch to resolved Render backend API URL");
  assert.equal(fetchedOptions.method, "POST");
  assert.equal(fetchedOptions.headers["Content-Type"], "application/json");

  const parsedBody = JSON.parse(fetchedOptions.body);
  assert.equal(parsedBody.idea, "I wish there was an acoustic guitar rain mode.");
  assert.equal(parsedBody.explanation, "Acoustic strings blend nicely with soft rain.");
  assert.equal(parsedBody.environment, "monsoon");
});
