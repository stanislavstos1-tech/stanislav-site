if ("scrollRestoration" in history) {
  history.scrollRestoration = "manual";
}

const resetScrollPosition = () => {
  window.scrollTo(0, 0);
};

resetScrollPosition();

const lockHeroStableHeight = () => {
  const isMobile = window.matchMedia("(max-width: 1024px)").matches;
  if (!isMobile) {
    document.documentElement.style.removeProperty("--hero-stable-height");
    return;
  }

  const height =
    window.visualViewport && window.visualViewport.height > 0
      ? Math.round(window.visualViewport.height)
      : window.innerHeight;

  if (height > 0) {
    document.documentElement.style.setProperty("--hero-stable-height", `${height}px`);
  }
};

lockHeroStableHeight();
window.addEventListener(
  "pageshow",
  (event) => {
    if (event.persisted) {
      resetScrollPosition();
      lockHeroStableHeight();
    }
  },
  { passive: true }
);
window.addEventListener(
  "orientationchange",
  () => {
    window.setTimeout(lockHeroStableHeight, 150);
  },
  { passive: true }
);

document.addEventListener("hero-enter-complete", () => {
  const canSmoothScroll = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!canSmoothScroll) return;

  window.setTimeout(() => {
    document.documentElement.classList.add("is-scroll-smooth");
  }, 100);
});

const TELEGRAM_USERNAME = "stanislav5621";
const TELEGRAM_START_MESSAGE =
  "Станислав, здравствуйте! Нужен лендинг для курса / школы / ивента. Посмотрите, с чего лучше начать.";

const buildTelegramLink = (text = TELEGRAM_START_MESSAGE) =>
  `https://t.me/${TELEGRAM_USERNAME}?text=${encodeURIComponent(text)}`;

document.querySelectorAll("[data-telegram-link]").forEach((link) => {
  link.setAttribute("href", buildTelegramLink());
});

const menuBtn = document.getElementById("burger");
const menuCloseBtn = document.getElementById("menu-close");
const sideMenu = document.getElementById("side-menu");
const menuOverlay = document.getElementById("menu-overlay");
const burgerLabel = menuBtn?.querySelector(".top-nav-burger__label");
const siteHeader = document.querySelector(".site-header");

const HEADER_COLLAPSE_THRESHOLD = 24;
const HEADER_MORPH_DURATION_MS = 550;
const MORPH_SPEED = 1 / HEADER_MORPH_DURATION_MS;

let headerMorphValue = 0;
let headerMorphTarget = 0;
let headerMorphRafId = 0;
let lastHeaderMorphTickTime = 0;

const clampMorph = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smoothstepMorph = (value) => {
  const clamped = clampMorph(value);
  return clamped * clamped * (3 - 2 * clamped);
};

const getMorphTargetFromScroll = () =>
  window.scrollY > HEADER_COLLAPSE_THRESHOLD ? 1 : 0;

const applyHeaderMorph = (value) => {
  const isMobile = window.matchMedia("(max-width: 1024px)").matches;
  const clamped = clampMorph(value);
  const widthMorph = 1 - (1 - clamped) * (1 - clamped);
  const slimMorph = smoothstepMorph((clamped - 0.06) / 0.82);
  const radiusMorph = smoothstepMorph((clamped - 0.18) / 0.7);
  const splitMorph = smoothstepMorph((clamped - 0.1) / 0.82);
  const split = isMobile && !document.body.classList.contains("menu-open") ? splitMorph : 0;

  document.documentElement.style.setProperty("--header-morph", widthMorph.toFixed(4));
  document.documentElement.style.setProperty("--header-morph-slim", slimMorph.toFixed(4));
  document.documentElement.style.setProperty("--header-morph-radius", radiusMorph.toFixed(4));
  document.documentElement.style.setProperty("--header-morph-split", split.toFixed(4));
};

const tickHeaderMorph = (now) => {
  headerMorphRafId = 0;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    headerMorphValue = headerMorphTarget;
    applyHeaderMorph(headerMorphValue);
    lastHeaderMorphTickTime = 0;
    return;
  }

  if (!lastHeaderMorphTickTime) {
    lastHeaderMorphTickTime = now;
  }

  const dt = now - lastHeaderMorphTickTime;
  lastHeaderMorphTickTime = now;
  const delta = headerMorphTarget - headerMorphValue;
  const step = MORPH_SPEED * dt;

  if (Math.abs(delta) <= step) {
    headerMorphValue = headerMorphTarget;
    applyHeaderMorph(headerMorphValue);
    lastHeaderMorphTickTime = 0;
    return;
  }

  headerMorphValue += Math.sign(delta) * step;
  applyHeaderMorph(headerMorphValue);
  headerMorphRafId = requestAnimationFrame(tickHeaderMorph);
};

const scheduleHeaderMorphTick = () => {
  if (!headerMorphRafId) {
    lastHeaderMorphTickTime = 0;
    headerMorphRafId = requestAnimationFrame(tickHeaderMorph);
  }
};

const syncHeaderMorphFromScroll = () => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    headerMorphTarget = getMorphTargetFromScroll();
    headerMorphValue = headerMorphTarget;
    applyHeaderMorph(headerMorphValue);
    return;
  }

  headerMorphTarget = getMorphTargetFromScroll();
  scheduleHeaderMorphTick();
};

let headerMorphTicking = false;

window.addEventListener(
  "scroll",
  () => {
    if (headerMorphTicking) return;
    headerMorphTicking = true;
    requestAnimationFrame(() => {
      syncHeaderMorphFromScroll();
      headerMorphTicking = false;
    });
  },
  { passive: true }
);

window.addEventListener("resize", syncHeaderMorphFromScroll, { passive: true });

headerMorphTarget = getMorphTargetFromScroll();
headerMorphValue = headerMorphTarget;
applyHeaderMorph(headerMorphValue);

const updateHeaderMorph = () => {
  headerMorphTarget = getMorphTargetFromScroll();
  applyHeaderMorph(headerMorphValue);
  scheduleHeaderMorphTick();
};

let headerMetricsReady = false;

let lastHeaderHeightUpdate = 0;

const updateSiteHeaderHeight = () => {
  if (!headerMetricsReady) return;
  const now = performance.now();
  if (now - lastHeaderHeightUpdate < 80) return;
  lastHeaderHeightUpdate = now;
  const header = document.querySelector(".site-header");
  if (!header) return;
  const height = Math.ceil(header.getBoundingClientRect().height);
  document.documentElement.style.setProperty("--site-header-height", `${height}px`);
};

const initSiteHeaderHeight = () => {
  window.addEventListener(
    "hero-enter-complete",
    () => {
      headerMetricsReady = true;
      updateSiteHeaderHeight();
    },
    { once: true }
  );

  window.addEventListener("resize", updateSiteHeaderHeight, { passive: true });
  const header = document.querySelector(".site-header");
  if (header && typeof ResizeObserver !== "undefined") {
    new ResizeObserver(updateSiteHeaderHeight).observe(header);
  }
};

const lockPageScroll = () => {
  document.documentElement.classList.add("is-menu-scroll-locked");
};

const unlockPageScroll = () => {
  document.documentElement.classList.remove("is-menu-scroll-locked");
};

const setMenuOpen = (isOpen) => {
  if (!menuBtn || !sideMenu || !menuOverlay) return;

  sideMenu.classList.toggle("open", isOpen);
  menuOverlay.classList.toggle("open", isOpen);
  menuOverlay.setAttribute("aria-hidden", isOpen ? "false" : "true");
  menuBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
  menuBtn.setAttribute("aria-label", isOpen ? "Закрыть меню" : "Открыть меню");
  if (burgerLabel) burgerLabel.textContent = isOpen ? "Закрыть" : "Меню";
  document.documentElement.classList.toggle("has-mobile-menu-open", isOpen);

  if (isOpen) {
    document.body.classList.add("menu-open");
    lockPageScroll();
    updateHeaderMorph();
    return;
  }

  document.body.classList.remove("menu-open");
  unlockPageScroll();
  menuBtn.blur();
  updateHeaderMorph();
};

const toggleMenu = (forceOpen) => {
  const isOpen =
    typeof forceOpen === "boolean"
      ? forceOpen
      : !sideMenu?.classList.contains("open");

  setMenuOpen(isOpen);
};

menuBtn?.addEventListener("click", () => toggleMenu());
menuCloseBtn?.addEventListener("click", () => toggleMenu(false));
menuOverlay?.addEventListener("click", (event) => {
  if (event.target === menuOverlay) toggleMenu(false);
});

sideMenu?.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => toggleMenu(false));
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && sideMenu?.classList.contains("open")) {
    toggleMenu(false);
  }
});

document.addEventListener(
  "touchmove",
  (event) => {
    if (!document.body.classList.contains("menu-open")) return;
    if (sideMenu?.contains(event.target)) return;
    event.preventDefault();
  },
  { passive: false }
);

initSiteHeaderHeight();

const initDiscussCtaState = () => {
  const contactSection = document.getElementById("contact");
  const discussLinks = document.querySelectorAll('a[href="#contact"]');
  if (!contactSection || !discussLinks.length) return;

  const setDiscussLit = (isLit) => {
    discussLinks.forEach((link) => {
      link.classList.toggle("is-section-active", isLit);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => setDiscussLit(entry.isIntersecting));
    },
    {
      root: null,
      threshold: 0.12,
      rootMargin: "-8% 0px -35% 0px",
    }
  );

  observer.observe(contactSection);

  discussLinks.forEach((link) => {
    link.addEventListener("click", () => {
      window.setTimeout(() => link.blur(), 0);
    });
  });
};

initDiscussCtaState();

const form = document.getElementById("lead-form");
const formStatus = document.getElementById("lead-form-status");
let isSubmitting = false;
const nameInput = document.getElementById("lead-name");
const contactInput = document.getElementById("lead-contact");
const consentCheckbox = document.getElementById("lead-consent");
const submitBtn = document.getElementById("lead-submit");

const SOCIAL_PLACEHOLDERS = {
  telegram: "username",
  vk: "Ссылка на профиль VK",
};

const normalizeContact = (contact, social) => {
  const trimmed = contact.trim();
  if (!trimmed) return trimmed;

  if (social === "telegram") {
    if (/^https?:\/\//i.test(trimmed) || trimmed.includes("t.me/")) {
      return trimmed;
    }
    const username = trimmed.replace(/^@+/, "");
    return username ? `@${username}` : "";
  }

  return trimmed;
};

const getSelectedSocial = () => {
  const checked = form?.querySelector('input[name="social"]:checked');
  return checked instanceof HTMLInputElement ? checked.value : "telegram";
};

const syncSocialPlaceholder = () => {
  if (!(contactInput instanceof HTMLInputElement)) return;
  const social = getSelectedSocial();
  contactInput.placeholder =
    SOCIAL_PLACEHOLDERS[social] ?? SOCIAL_PLACEHOLDERS.telegram;
};

form?.querySelectorAll('input[name="social"]').forEach((radio) => {
  radio.addEventListener("change", syncSocialPlaceholder);
});
syncSocialPlaceholder();

const buildLeadSummary = ({ name, contact, social = "telegram" }) => {
  const socialLabel = social === "vk" ? "VK" : "Telegram";
  const lines = [`${socialLabel}: ${contact}`];

  if (name) {
    lines.unshift(`Имя: ${name}`);
  }

  return lines.join("\n");
};

const setFormStatus = (message, type = "success") => {
  if (!formStatus) return;

  const hasMessage = Boolean(message);
  formStatus.textContent = message;
  formStatus.classList.toggle("is-empty", !hasMessage);
  formStatus.setAttribute("aria-hidden", hasMessage ? "false" : "true");
  formStatus.classList.remove("lead-form__status--success", "lead-form__status--error", "lead-form__status--info");

  if (!hasMessage) {
    return;
  }

  formStatus.classList.add(
    type === "error"
      ? "lead-form__status--error"
      : type === "info"
        ? "lead-form__status--info"
        : "lead-form__status--success"
  );
};

const isLeadFormReady = () => {
  const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : "";
  const contact = contactInput instanceof HTMLInputElement ? contactInput.value.trim() : "";
  const hasConsent = consentCheckbox instanceof HTMLInputElement && consentCheckbox.checked;

  return name.length > 0 && contact.length > 0 && hasConsent;
};

const syncSubmitState = () => {
  if (!(submitBtn instanceof HTMLButtonElement)) {
    return;
  }

  submitBtn.classList.toggle(
    "lead-form__submit--ready",
    isLeadFormReady() && !isSubmitting
  );
};

const clearFieldErrors = () => {
  form?.querySelectorAll(".lead-form__input--error").forEach((field) => {
    field.classList.remove("lead-form__input--error");
  });
  form?.querySelectorAll(".lead-form__consent--error").forEach((consent) => {
    consent.classList.remove("lead-form__consent--error");
  });
};

const markFieldError = (field, { focus = true } = {}) => {
  if (field instanceof HTMLInputElement) {
    field.readOnly = false;
    field.closest(".lead-form__input-wrap")?.classList.add("is-editing");
  }
  field?.classList.add("lead-form__input--error");
  if (focus) {
    field?.focus();
  }
};

const markConsentError = () => {
  consentCheckbox?.closest(".lead-form__consent")?.classList.add("lead-form__consent--error");
};

const validateLeadForm = () => {
  clearFieldErrors();

  const name = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : "";
  const contact = contactInput instanceof HTMLInputElement ? contactInput.value.trim() : "";
  const social = getSelectedSocial();
  const hasConsent = consentCheckbox instanceof HTMLInputElement && consentCheckbox.checked;

  let isValid = true;

  if (!name) {
    markFieldError(nameInput, { focus: false });
    isValid = false;
  }

  if (!contact) {
    markFieldError(contactInput, { focus: false });
    isValid = false;
  }

  if (!hasConsent) {
    markConsentError();
    isValid = false;
  }

  if (!isValid) {
    const missing = [];
    if (!name) missing.push("name");
    if (!contact) missing.push("contact");
    if (!hasConsent) missing.push("consent");

    if (missing.length > 1) {
      setFormStatus("Заполните обязательные поля и отметьте согласие.", "error");
    } else if (!name) {
      setFormStatus("Укажите имя.", "error");
    } else if (!contact) {
      setFormStatus(
        social === "vk"
          ? "Укажите ссылку на профиль VK."
          : "Укажите username в Telegram.",
        "error"
      );
    } else {
      setFormStatus("Для отправки нужно согласие на обработку персональных данных.", "error");
    }

    const firstInvalid = !name
      ? nameInput
      : !contact
        ? contactInput
        : consentCheckbox;

    if (firstInvalid instanceof HTMLInputElement) {
      firstInvalid.focus({ preventScroll: true });
    }

    return null;
  }

  return { name, contact, social };
};

nameInput?.addEventListener("input", () => {
  nameInput.classList.remove("lead-form__input--error");
  syncSubmitState();
});
contactInput?.addEventListener("input", () => {
  contactInput.classList.remove("lead-form__input--error");
  syncSubmitState();
});
consentCheckbox?.addEventListener("change", () => {
  consentCheckbox.closest(".lead-form__consent")?.classList.remove("lead-form__consent--error");
  syncSubmitState();
});
syncSubmitState();

const initMobileFormUx = () => {
  if (!form) return;

  const isTouchDevice = window.matchMedia("(hover: none) and (pointer: coarse)").matches;

  const syncKeyboardState = () => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    document.body.classList.toggle(
      "is-keyboard-open",
      viewport.height < window.innerHeight * 0.82
    );
  };

  const blurFieldIfScrolledAway = () => {
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !form.contains(active)) return;

    const viewport = window.visualViewport;
    const viewportHeight = viewport?.height ?? window.innerHeight;
    const viewportTop = viewport?.offsetTop ?? 0;
    const rect = active.getBoundingClientRect();
    const visibleTop = viewportTop + 12;
    const visibleBottom = viewportTop + viewportHeight - 12;

    if (rect.bottom < visibleTop || rect.top > visibleBottom) {
      active.blur();
    }
  };

  const bindFieldFocusTracking = (field) => {
    field.addEventListener("focus", syncKeyboardState);
    field.addEventListener("blur", () => {
      window.setTimeout(syncKeyboardState, 0);
    });
  };

  if (!isTouchDevice) {
    form.querySelectorAll(".lead-form__input").forEach((field) => {
      if (field instanceof HTMLInputElement) {
        bindFieldFocusTracking(field);
      }
    });
    window.addEventListener("scroll", blurFieldIfScrolledAway, { passive: true });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", syncKeyboardState);
    }
    return;
  }

  form.querySelectorAll(".lead-form__input-wrap").forEach((wrap) => {
    const input = wrap.querySelector(".lead-form__input");
    if (!(input instanceof HTMLInputElement)) return;

    input.readOnly = true;
    let startX = 0;
    let startY = 0;
    let moved = false;

    const enableEditing = () => {
      input.readOnly = false;
      wrap.classList.add("is-editing");
      input.focus();
    };

    const disableEditing = () => {
      input.readOnly = true;
      wrap.classList.remove("is-editing");
    };

    wrap.addEventListener(
      "touchstart",
      (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        startX = touch.clientX;
        startY = touch.clientY;
        moved = false;
      },
      { passive: true }
    );

    wrap.addEventListener(
      "touchmove",
      (event) => {
        const touch = event.touches[0];
        if (!touch) return;
        if (
          Math.abs(touch.clientX - startX) > 8 ||
          Math.abs(touch.clientY - startY) > 8
        ) {
          moved = true;
        }
      },
      { passive: true }
    );

    wrap.addEventListener("touchend", () => {
      if (moved) return;
      enableEditing();
    });

    input.addEventListener("blur", disableEditing);
    bindFieldFocusTracking(input);

    const label = wrap.closest(".lead-form__field")?.querySelector(".lead-form__label");
    label?.addEventListener("click", (event) => {
      event.preventDefault();
      enableEditing();
    });
  });

  window.addEventListener("scroll", blurFieldIfScrolledAway, { passive: true });

  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", () => {
      syncKeyboardState();
      blurFieldIfScrolledAway();
    });
    window.visualViewport.addEventListener("scroll", blurFieldIfScrolledAway);
    syncKeyboardState();
  }
};

initMobileFormUx();

form?.addEventListener("submit", (event) => {
  event.preventDefault();
  if (isSubmitting) return;

  if (document.activeElement instanceof HTMLElement && form.contains(document.activeElement)) {
    document.activeElement.blur();
  }

  const validated = validateLeadForm();
  if (!validated) {
    syncSubmitState();
    return;
  }

  setFormStatus(
    "Форма не отправляет данные. Напишите в Telegram или VK — ссылки под кнопкой.",
    "info"
  );
});
