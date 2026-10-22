import fs from "node:fs";
import dotenv from "dotenv";
import nodemailer from "nodemailer";

if (process.env.NODE_ENV !== "production" && fs.existsSync(".env")) {
  dotenv.config();
}

export const WISH_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const WISH_RATE_LIMIT_MAX = 5;
export const WISH_RATE_LIMIT_MIN_GAP_MS = 3000;

export const DEFAULT_WISH_TO_EMAIL = process.env.DEFAULT_WISH_TO_EMAIL;
export const DEFAULT_BREVO_HOST = "smtp-relay.brevo.com";
export const DEFAULT_BREVO_PORT = 587;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_IDEA_LENGTH = 500;
const MIN_IDEA_LENGTH = 10;
const MAX_EXPLANATION_LENGTH = 1000;
const MAX_EMAIL_LENGTH = 254;

const VALID_ENVIRONMENTS = new Set(["monsoon", "winter", "spring", "autumn", "desert", "coast"]);

export function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function validateWishPayload(body = {}) {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { ok: false, error: "Invalid request payload." };
  }

  // Honeypot check: any filled honeypot field indicates automated submission
  const honeypot = body.wish_hp || body.hp_source || body.nickname || body.honeypot;
  if (honeypot && String(honeypot).trim() !== "") {
    return { ok: false, error: "Submission rejected.", honeypot: true };
  }

  // Idea validation (Required, 10–500 chars after trim)
  const rawIdea = typeof body.idea === "string" ? body.idea : "";
  const idea = rawIdea.replace(/\r\n?/gu, "\n").trim();
  if (!idea || idea.length < MIN_IDEA_LENGTH) {
    return {
      ok: false,
      field: "idea",
      error: `Please share a little more detail (at least ${MIN_IDEA_LENGTH} characters).`
    };
  }
  if (idea.length > MAX_IDEA_LENGTH) {
    return {
      ok: false,
      field: "idea",
      error: `Please keep your wish under ${MAX_IDEA_LENGTH} characters.`
    };
  }

  // Explanation validation (Optional, up to 1000 chars after trim)
  const rawExplanation = typeof body.explanation === "string" ? body.explanation : "";
  const explanation = rawExplanation.replace(/\r\n?/gu, "\n").trim();
  if (explanation.length > MAX_EXPLANATION_LENGTH) {
    return {
      ok: false,
      field: "explanation",
      error: "Please keep the explanation under 1,000 characters."
    };
  }

  // Email validation (Optional, up to 254 chars after trim)
  const rawEmail = typeof body.email === "string" ? body.email : "";
  const email = rawEmail.trim();
  if (email.length > MAX_EMAIL_LENGTH) {
    return {
      ok: false,
      field: "email",
      error: "Please enter a valid email address."
    };
  }
  if (email.length > 0 && !EMAIL_REGEX.test(email)) {
    return {
      ok: false,
      field: "email",
      error: "Please enter a valid email address."
    };
  }

  // Consent checkbox validation (Required if checked, requires email)
  const consent = Boolean(body.consent);
  if (consent && (!email || !EMAIL_REGEX.test(email))) {
    return {
      ok: false,
      field: "email",
      error: "Please enter your email so we can let you know if this becomes available."
    };
  }

  // Environment tracking
  const rawEnv = typeof body.environment === "string" ? body.environment.toLowerCase().trim() : "";
  const environment = VALID_ENVIRONMENTS.has(rawEnv) ? rawEnv : "monsoon";

  return {
    ok: true,
    data: {
      idea,
      explanation: explanation || null,
      email: email || null,
      consent,
      environment
    }
  };
}

export function createWishTransport(config = {}) {
  const host = config.host || process.env.BREVO_SMTP_HOST || DEFAULT_BREVO_HOST;
  const port = Number(config.port || process.env.BREVO_SMTP_PORT || DEFAULT_BREVO_PORT);
  const user = config.user || process.env.BREVO_SMTP_MAIL;
  const pass = config.key || process.env.BREVO_SMTP_KEY;

  if (!user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    socketTimeout: 10_000
  });
}

export async function sendWishEmail(wishData, { transportOverride, now = new Date() } = {}) {
  const toEmail = DEFAULT_WISH_TO_EMAIL;
  const fromEmail = process.env.BREVO_FROM_MAIL;

  if (!toEmail || !EMAIL_REGEX.test(toEmail)) {
    console.error("[wish-service] Configured recipient email missing or invalid (DEFAULT_WISH_TO_EMAIL).");
    const err = new Error("SMTP recipient configuration missing or invalid");
    err.code = "SMTP_CONFIG_MISSING";
    throw err;
  }

  if (!fromEmail || !EMAIL_REGEX.test(fromEmail)) {
    console.error("[wish-service] Configured sender email missing or invalid (BREVO_FROM_MAIL).");
    const err = new Error("SMTP sender configuration missing or invalid");
    err.code = "SMTP_CONFIG_MISSING";
    throw err;
  }

  const transport = transportOverride || createWishTransport();
  if (!transport) {
    console.error("[wish-service] Brevo SMTP configuration missing (BREVO_SMTP_KEY or BREVO_SMTP_MAIL).");
    const err = new Error("SMTP configuration missing");
    err.code = "SMTP_CONFIG_MISSING";
    throw err;
  }

  const timestampIso = now.toISOString();
  const mausamName = {
    monsoon: "Baarish (Monsoon)",
    winter: "Sardi (Winter)",
    spring: "Bahar (Spring)",
    autumn: "Patjhad (Autumn)",
    desert: "Registan (Desert)",
    coast: "Samundar (Coast)"
  }[wishData.environment] || wishData.environment;

  const subject = `CBG — A Little Wish ✨ [${mausamName}]`;

  const textBody = [
    "CBG — A Little Wish ✨",
    "==================================================",
    `Submitted At: ${timestampIso}`,
    `Mausam:       ${mausamName}`,
    "",
    "--- Feature Wish ---",
    wishData.idea,
    "",
    "--- Context / Feeling Behind It ---",
    wishData.explanation || "(None provided)",
    "",
    "--- Visitor Contact & Consent ---",
    `Email:        ${wishData.email || "(None provided)"}`,
    `Opted In:     ${wishData.consent ? "Yes — visitor opted in to release updates" : "No"}`,
    "=================================================="
  ].join("\n");

  const htmlBody = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0d1519; color: #e4edf2; padding: 24px; line-height: 1.5;">
  <div style="max-width: 580px; margin: 0 auto; background: #142028; border: 1px solid rgba(184, 211, 224, 0.2); border-radius: 16px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
    <h2 style="margin: 0 0 4px; color: #a9d6e5; font-size: 20px;">A Little Wish ✨</h2>
    <p style="margin: 0 0 16px; font-size: 12px; color: #8ba2af;">Chai Baarish Gaane &middot; ${escapeHtml(mausamName)} &middot; <time datetime="${timestampIso}">${escapeHtml(timestampIso)}</time></p>
    <div style="background: rgba(8, 16, 22, 0.7); border: 1px solid rgba(184, 211, 224, 0.12); border-radius: 10px; padding: 16px; margin-bottom: 16px;">
      <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: #7ec8e3; text-transform: uppercase;">Feature Wish</p>
      <p style="margin: 0; font-size: 15px; color: #ffffff; white-space: pre-wrap;">${escapeHtml(wishData.idea)}</p>
    </div>
    ${wishData.explanation ? `
    <div style="background: rgba(8, 16, 22, 0.5); border: 1px solid rgba(184, 211, 224, 0.08); border-radius: 10px; padding: 14px; margin-bottom: 16px;">
      <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 0.1em; color: #8ba2af; text-transform: uppercase;">Context / Story</p>
      <p style="margin: 0; font-size: 13px; color: #c5d8e2; white-space: pre-wrap;">${escapeHtml(wishData.explanation)}</p>
    </div>` : ""}
    <div style="border-top: 1px solid rgba(255, 255, 255, 0.08); padding-top: 14px; font-size: 12px; color: #8ba2af;">
      <p style="margin: 4px 0;"><strong>Visitor Email:</strong> ${wishData.email ? escapeHtml(wishData.email) : "<em>None provided</em>"}</p>
      <p style="margin: 4px 0;"><strong>Release Update Consent:</strong> ${wishData.consent ? "<span style='color: #8bd39e;'>Explicitly opted in</span>" : "No"}</p>
    </div>
  </div>
</body>
</html>`;

  const mailOptions = {
    from: `CBG A Little Wish <${fromEmail}>`,
    to: toEmail,
    subject,
    text: textBody,
    html: htmlBody
  };

  if (wishData.email) {
    mailOptions.replyTo = wishData.email;
  }

  const result = await transport.sendMail(mailOptions);
  console.log("[wish-service] Wish email accepted by SMTP relay:", result?.messageId || "UNKNOWN");
  return { ok: true, messageId: result.messageId };
}

export function createWishRateLimiter({
  windowMs = WISH_RATE_LIMIT_WINDOW_MS,
  max = WISH_RATE_LIMIT_MAX,
  minGapMs = WISH_RATE_LIMIT_MIN_GAP_MS
} = {}) {
  const buckets = new Map();
  return (ip) => {
    const key = String(ip || "unknown");
    const now = Date.now();
    const timestamps = (buckets.get(key) || []).filter((time) => now - time < windowMs);
    if (timestamps.length && now - timestamps.at(-1) < minGapMs) {
      return false;
    }
    if (timestamps.length >= max) {
      return false;
    }
    timestamps.push(now);
    buckets.set(key, timestamps);
    return true;
  };
}
