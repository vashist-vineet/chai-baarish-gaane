(() => {
  "use strict";

  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const MIN_IDEA_LENGTH = 10;
  const MAX_IDEA_LENGTH = 500;
  const MAX_EXPLANATION_LENGTH = 1000;
  const MAX_EMAIL_LENGTH = 254;

  const els = {
    overlay: document.getElementById("wishOverlay"),
    modal: document.getElementById("wishModal"),
    close: document.getElementById("wishClose"),
    dismiss: document.getElementById("wishDismiss"),
    form: document.getElementById("wishForm"),
    idea: document.getElementById("wishIdea"),
    ideaCount: document.getElementById("wishIdeaCount"),
    ideaError: document.getElementById("wishIdeaError"),
    explanation: document.getElementById("wishExplanation"),
    explanationCount: document.getElementById("wishExplanationCount"),
    explanationError: document.getElementById("wishExplanationError"),
    email: document.getElementById("wishEmail"),
    emailError: document.getElementById("wishEmailError"),
    consent: document.getElementById("wishConsent"),
    statusBanner: document.getElementById("wishStatusBanner"),
    submit: document.getElementById("wishSubmit"),
    successView: document.getElementById("wishSuccessView"),
    hp: document.getElementById("wishHp"),
    triggerMain: document.getElementById("wishButton"),
    triggerEntry: document.getElementById("entryWishButton")
  };

  const state = {
    open: false,
    submitting: false,
    lastActiveElement: null
  };

  function currentEnvironment() {
    return document.body.dataset.environment || "monsoon";
  }

  const DEFAULT_PRODUCTION_BACKEND_URL = "https://chai-pe-chat.onrender.com";

  function isLocalEnvironment() {
    if (typeof location === "undefined" || !location.hostname) return false;
    return /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
  }

  function wishServerUrl() {
    const override = typeof window !== "undefined"
      ? (window.CBG_WISH_SERVER_URL || window.CBG_CHAT_SERVER_URL)
      : null;
    if (typeof override === "string" && override.trim()) {
      return override.trim().replace(/\/$/u, "");
    }

    const meta = document.querySelector('meta[name="cbg-chat-server"]')?.content?.trim() || "";
    if (meta) {
      try {
        const parsed = new URL(meta);
        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
          return meta.replace(/\/$/u, "");
        }
      } catch {
        // Invalid meta URL, fall through to safe fallback
      }
    }

    // Missing or invalid meta tag:
    // In local development, fallback to local origin
    if (isLocalEnvironment()) {
      return location.origin.replace(/\/$/u, "");
    }

    // In production (e.g. Vercel), do not fallback to Vercel origin; fallback to expected Render backend
    return DEFAULT_PRODUCTION_BACKEND_URL;
  }

  function wishApiUrl() {
    return `${wishServerUrl()}/api/wish`;
  }

  function updateCounts() {
    if (els.idea && els.ideaCount) {
      const len = els.idea.value.length;
      els.ideaCount.textContent = `${len} / ${MAX_IDEA_LENGTH}`;
      els.ideaCount.classList.toggle("near-limit", len > MAX_IDEA_LENGTH * 0.9);
      els.ideaCount.classList.toggle("over-limit", len > MAX_IDEA_LENGTH);
    }
    if (els.explanation && els.explanationCount) {
      const len = els.explanation.value.length;
      els.explanationCount.textContent = `${len} / ${MAX_EXPLANATION_LENGTH}`;
      els.explanationCount.classList.toggle("near-limit", len > MAX_EXPLANATION_LENGTH * 0.9);
      els.explanationCount.classList.toggle("over-limit", len > MAX_EXPLANATION_LENGTH);
    }
  }

  function clearErrors() {
    if (els.ideaError) els.ideaError.textContent = "";
    if (els.explanationError) els.explanationError.textContent = "";
    if (els.emailError) els.emailError.textContent = "";
    if (els.statusBanner) {
      els.statusBanner.hidden = true;
      els.statusBanner.textContent = "";
    }
    els.idea?.removeAttribute("aria-invalid");
    els.explanation?.removeAttribute("aria-invalid");
    els.email?.removeAttribute("aria-invalid");
  }

  function validate() {
    clearErrors();
    let valid = true;
    let firstInvalid = null;

    // Idea
    const idea = els.idea ? els.idea.value.trim() : "";
    if (!idea || idea.length < MIN_IDEA_LENGTH) {
      if (els.ideaError) els.ideaError.textContent = `Please share a little more detail (at least ${MIN_IDEA_LENGTH} characters).`;
      els.idea?.setAttribute("aria-invalid", "true");
      valid = false;
      if (!firstInvalid) firstInvalid = els.idea;
    } else if (idea.length > MAX_IDEA_LENGTH) {
      if (els.ideaError) els.ideaError.textContent = `Please keep your wish under ${MAX_IDEA_LENGTH} characters.`;
      els.idea?.setAttribute("aria-invalid", "true");
      valid = false;
      if (!firstInvalid) firstInvalid = els.idea;
    }

    // Explanation
    const explanation = els.explanation ? els.explanation.value.trim() : "";
    if (explanation.length > MAX_EXPLANATION_LENGTH) {
      if (els.explanationError) els.explanationError.textContent = `Please keep the explanation under ${MAX_EXPLANATION_LENGTH} characters.`;
      els.explanation?.setAttribute("aria-invalid", "true");
      valid = false;
      if (!firstInvalid) firstInvalid = els.explanation;
    }

    // Email
    const email = els.email ? els.email.value.trim() : "";
    if (email.length > MAX_EMAIL_LENGTH) {
      if (els.emailError) els.emailError.textContent = "Please enter a valid email address.";
      els.email?.setAttribute("aria-invalid", "true");
      valid = false;
      if (!firstInvalid) firstInvalid = els.email;
    } else if (email.length > 0 && !EMAIL_REGEX.test(email)) {
      if (els.emailError) els.emailError.textContent = "Please enter a valid email address.";
      els.email?.setAttribute("aria-invalid", "true");
      valid = false;
      if (!firstInvalid) firstInvalid = els.email;
    }

    // Consent checkbox
    if (els.consent?.checked && (!email || !EMAIL_REGEX.test(email))) {
      if (els.emailError) els.emailError.textContent = "Please enter your email so we can let you know.";
      els.email?.setAttribute("aria-invalid", "true");
      valid = false;
      if (!firstInvalid) firstInvalid = els.email;
    }

    if (firstInvalid) {
      firstInvalid.focus();
    }

    return valid;
  }

  function openWish() {
    if (state.open) return;

    // Mutual drawer exclusion: close playlist drawer if open
    if (document.body.classList.contains("playlist-open")) {
      const closePl = document.getElementById("closePlaylist");
      if (closePl) closePl.click();
      else document.body.classList.remove("playlist-open");
    }

    // Close chat drawer if open
    if (document.body.classList.contains("chat-open")) {
      if (typeof window.CBGChat?.close === "function") {
        window.CBGChat.close();
      } else {
        const closeChat = document.getElementById("chatClose");
        if (closeChat) closeChat.click();
        else document.body.classList.remove("chat-open");
      }
    }

    state.lastActiveElement = document.activeElement;
    state.open = true;

    document.body.classList.add("wish-open");
    if (els.overlay) {
      els.overlay.removeAttribute("inert");
      els.overlay.setAttribute("aria-hidden", "false");
    }
    if (els.triggerMain) els.triggerMain.setAttribute("aria-expanded", "true");
    if (els.triggerEntry) els.triggerEntry.setAttribute("aria-expanded", "true");

    updateCounts();
    requestAnimationFrame(() => {
      if (els.idea && !els.idea.value) {
        els.idea.focus();
      } else if (els.close) {
        els.close.focus();
      }
    });
  }

  function closeWish() {
    if (!state.open) return;
    state.open = false;

    document.body.classList.remove("wish-open");
    if (els.overlay) {
      els.overlay.setAttribute("aria-hidden", "true");
      els.overlay.setAttribute("inert", "");
    }
    if (els.triggerMain) els.triggerMain.setAttribute("aria-expanded", "false");
    if (els.triggerEntry) els.triggerEntry.setAttribute("aria-expanded", "false");

    // If successfully submitted, reset view for next time
    if (els.successView && !els.successView.hidden) {
      els.successView.hidden = true;
      if (els.form) {
        els.form.hidden = false;
        els.form.reset();
      }
      clearErrors();
      updateCounts();
    }

    // Restore focus
    if (state.lastActiveElement && typeof state.lastActiveElement.focus === "function") {
      state.lastActiveElement.focus();
    }
  }

  async function handleSubmit(event) {
    if (event) event.preventDefault();
    if (state.submitting) return;

    if (!validate()) return;

    state.submitting = true;
    if (els.submit) {
      els.submit.disabled = true;
      els.submit.textContent = "Sending wish… ☕";
    }

    const payload = {
      idea: els.idea ? els.idea.value.trim() : "",
      explanation: els.explanation ? els.explanation.value.trim() : "",
      email: els.email ? els.email.value.trim() : "",
      consent: Boolean(els.consent?.checked),
      environment: currentEnvironment(),
      wish_hp: els.hp ? els.hp.value : ""
    };

    try {
      const response = await fetch(wishApiUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json().catch(() => null);

      if (response.ok && result?.ok) {
        // Confirmed acceptance by backend
        if (els.form) els.form.hidden = true;
        if (els.successView) {
          els.successView.hidden = false;
          const dismissBtn = els.dismiss;
          if (dismissBtn) requestAnimationFrame(() => dismissBtn.focus());
        }
      } else {
        // Show field error or general error without losing entered data
        if (result?.field && result?.error) {
          if (result.field === "idea" && els.ideaError) els.ideaError.textContent = result.error;
          else if (result.field === "explanation" && els.explanationError) els.explanationError.textContent = result.error;
          else if (result.field === "email" && els.emailError) els.emailError.textContent = result.error;
          else if (els.statusBanner) {
            els.statusBanner.hidden = false;
            els.statusBanner.textContent = result.error;
          }
        } else if (els.statusBanner) {
          els.statusBanner.hidden = false;
          els.statusBanner.textContent = result?.error || "We couldn't send your wish just now. Please try again in a little while.";
        }
      }
    } catch {
      // Do not treat network error as proof it was not processed; keep form data intact
      if (els.statusBanner) {
        els.statusBanner.hidden = false;
        els.statusBanner.textContent = "We couldn't send your wish just now. Please try again in a little while.";
      }
    } finally {
      state.submitting = false;
      if (els.submit) {
        els.submit.disabled = false;
        els.submit.textContent = "Send my wish ☕";
      }
    }
  }

  // Keyboard trap inside the modal
  function handleKeyDown(event) {
    if (!state.open) return;

    if (event.key === "Escape") {
      event.preventDefault();
      closeWish();
      return;
    }

    if (event.key === "Tab") {
      const focusables = els.modal?.querySelectorAll(
        'button:not([disabled]):not([hidden]), [href], input:not([disabled]):not([hidden]):not([type="hidden"]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusables || focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  // Wire up event listeners
  if (els.triggerMain) els.triggerMain.addEventListener("click", openWish);
  if (els.triggerEntry) els.triggerEntry.addEventListener("click", openWish);
  if (els.close) els.close.addEventListener("click", closeWish);
  if (els.dismiss) els.dismiss.addEventListener("click", closeWish);

  // Overlay click (outside dialog) closes modal
  if (els.overlay) {
    els.overlay.addEventListener("click", (event) => {
      if (event.target === els.overlay || event.target.classList.contains("wish-dialog-wrap")) {
        closeWish();
      }
    });
  }

  if (els.idea) {
    els.idea.addEventListener("input", () => {
      updateCounts();
      if (els.ideaError?.textContent) clearErrors();
    });
  }

  if (els.explanation) {
    els.explanation.addEventListener("input", () => {
      updateCounts();
      if (els.explanationError?.textContent) clearErrors();
    });
  }

  if (els.email) {
    els.email.addEventListener("input", () => {
      if (els.emailError?.textContent) clearErrors();
    });
  }

  if (els.consent) {
    els.consent.addEventListener("change", () => {
      if (!els.consent.checked && els.emailError?.textContent) {
        clearErrors();
      }
    });
  }

  if (els.form) {
    els.form.addEventListener("submit", handleSubmit);
  }

  document.addEventListener("keydown", handleKeyDown);

  // Global namespace for interoperability and testing
  window.CBGWish = Object.freeze({
    open: openWish,
    close: closeWish,
    validate,
    isOpen: () => state.open,
    getServerUrl: wishServerUrl,
    getApiUrl: wishApiUrl
  });
})();
