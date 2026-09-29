(function () {
  "use strict";

  const FADE_MS = 1400;

  const prefersReducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const delay = (ms) =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

  async function waitForFonts() {
    if (!document.fonts?.ready) return;

    try {
      await Promise.race([
        document.fonts.ready,
        new Promise((resolve) => window.setTimeout(resolve, 1200)),
      ]);
    } catch {
      console.warn("Font loading timeout");
    }
  }

  const revealFadeBlocks = () => {
    document.querySelectorAll(".hero__fade").forEach((el) => {
      el.classList.add("is-revealed");
    });
  };

  const resetFadeBlocks = () => {
    document.querySelectorAll(".hero__fade").forEach((el) => {
      el.classList.remove("is-revealed");
    });
  };

  const runHeroEnter = async () => {
    document.documentElement.classList.remove("is-booting");
    document.documentElement.classList.add("is-content-ready");
    revealFadeBlocks();
    await delay(FADE_MS);
    window.dispatchEvent(new CustomEvent("hero-enter-complete"));
  };

  const boot = async () => {
    await waitForFonts();

    document.documentElement.classList.remove("is-booting");
    document.documentElement.classList.add("is-content-ready");
    revealFadeBlocks();
    window.dispatchEvent(new CustomEvent("hero-enter-complete"));
  };

  window.addEventListener(
    "pageshow",
    (event) => {
      if (!event.persisted) return;

      window.scrollTo(0, 0);
      resetFadeBlocks();
      document.documentElement.classList.remove("is-content-ready");

      if (!prefersReducedMotion()) {
        requestAnimationFrame(() => {
          runHeroEnter();
        });
      } else {
        document.documentElement.classList.add("is-content-ready");
        revealFadeBlocks();
      }
    },
    { passive: true }
  );

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
