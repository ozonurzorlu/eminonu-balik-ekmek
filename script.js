const reloadFromTopStorageKey = "eminonu:reload-from-top";
const homeIntroReplayStorageKey = "eminonu:intro:replay:v1";
const supportsScrollRestoration = "scrollRestoration" in window.history;
const prefersReducedReloadMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;
let reloadTransitionRunning = false;

const currentReloadPath = () => `${window.location.pathname}${window.location.search}`;
const isHomePagePath = () =>
  window.location.pathname.endsWith("/") ||
  window.location.pathname.endsWith("/index.html");

const requestHomeIntroReplay = () => {
  try {
    window.sessionStorage.setItem(homeIntroReplayStorageKey, "requested");
  } catch (_error) {
    // Navigation remains usable when browser storage is unavailable.
  }
};

const showHomeReloadCover = () => {
  const intro = document.querySelector("[data-site-intro]");

  if (!intro) {
    return;
  }

  intro.classList.remove("is-leaving");
  intro.setAttribute("aria-hidden", "false");
  document.documentElement.classList.add("intro-enabled", "intro-running");
  void intro.offsetWidth;
};

const readReloadFromTopFlag = () => {
  try {
    const storedValue = window.sessionStorage.getItem(reloadFromTopStorageKey);

    if (!storedValue) {
      return false;
    }

    const reloadIntent = JSON.parse(storedValue);
    const intentAge = Date.now() - Number(reloadIntent.createdAt || 0);

    return (
      reloadIntent.path === currentReloadPath() &&
      intentAge >= 0 &&
      intentAge < 5000
    );
  } catch (_error) {
    return false;
  }
};

const writeReloadFromTopFlag = () => {
  try {
    window.sessionStorage.setItem(
      reloadFromTopStorageKey,
      JSON.stringify({
        path: currentReloadPath(),
        createdAt: Date.now(),
      }),
    );
  } catch (_error) {
    // The page still reloads from its current top position without storage.
  }
};

const clearReloadFromTopFlag = () => {
  try {
    window.sessionStorage.removeItem(reloadFromTopStorageKey);
  } catch (_error) {
    // Browser storage is optional.
  }
};

if (readReloadFromTopFlag()) {
  if (supportsScrollRestoration) {
    window.history.scrollRestoration = "manual";
  }

  window.scrollTo(0, 0);
  clearReloadFromTopFlag();

  window.requestAnimationFrame(() => {
    window.scrollTo(0, 0);

    if (supportsScrollRestoration) {
      window.history.scrollRestoration = "auto";
    }
  });
}

const reloadAtPageTop = () => {
  if (reloadTransitionRunning) {
    return;
  }

  reloadTransitionRunning = true;

  if (supportsScrollRestoration) {
    window.history.scrollRestoration = "manual";
  }

  if (window.location.hash) {
    window.history.replaceState(
      window.history.state,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }

  writeReloadFromTopFlag();

  if (isHomePagePath()) {
    requestHomeIntroReplay();
    showHomeReloadCover();

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => window.location.reload());
    });
    return;
  }

  const startScrollY = Math.max(0, window.scrollY);
  const root = document.documentElement;
  const previousScrollBehavior = root.style.scrollBehavior;
  let reloadRequestSent = false;
  let reloadFallbackTimer = 0;

  const finishReload = () => {
    if (reloadRequestSent) {
      return;
    }

    reloadRequestSent = true;
    window.clearTimeout(reloadFallbackTimer);
    root.style.scrollBehavior = previousScrollBehavior;
    window.scrollTo(0, 0);
    window.location.reload();
  };

  if (prefersReducedReloadMotion || startScrollY <= 2) {
    finishReload();
    return;
  }

  const animationDuration = Math.min(460, Math.max(300, startScrollY * 0.055));
  const animationStartedAt = window.performance.now();

  root.style.scrollBehavior = "auto";
  reloadFallbackTimer = window.setTimeout(finishReload, 760);

  const animateToPageTop = (currentTime) => {
    const progress = Math.min(
      1,
      (currentTime - animationStartedAt) / animationDuration,
    );
    const easedProgress = 1 - Math.pow(1 - progress, 4);

    window.scrollTo(0, Math.round(startScrollY * (1 - easedProgress)));

    if (progress < 1) {
      window.requestAnimationFrame(animateToPageTop);
      return;
    }

    finishReload();
  };

  window.requestAnimationFrame(animateToPageTop);
};

document.addEventListener(
  "keydown",
  (event) => {
    const pressedKey = event.key.toLowerCase();
    const isPlainF5 =
      event.key === "F5" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.shiftKey &&
      !event.altKey;
    const isRegularReloadShortcut =
      pressedKey === "r" &&
      (event.ctrlKey || event.metaKey) &&
      !event.shiftKey &&
      !event.altKey;

    if (!isPlainF5 && !isRegularReloadShortcut) {
      return;
    }

    event.preventDefault();

    if (!event.repeat) {
      reloadAtPageTop();
    }
  },
  { capture: true },
);

const setupOverlayScrollbar = () => {
  const root = document.documentElement;
  const scroller = document.scrollingElement || root;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (!finePointer.matches || document.querySelector("[data-site-scrollbar]")) {
    return;
  }

  const rail = document.createElement("div");
  const thumb = document.createElement("span");
  const railPadding = 2;
  let hideTimer = 0;
  let updateFrame = 0;
  let dragging = false;
  let dragPointerY = 0;
  let dragScrollY = 0;
  let currentMetrics = null;

  rail.className = "site-scrollbar";
  rail.dataset.siteScrollbar = "";
  rail.setAttribute("role", "scrollbar");
  rail.setAttribute("aria-label", "Sayfa kaydırma çubuğu");
  rail.setAttribute("aria-orientation", "vertical");
  rail.setAttribute("aria-valuemin", "0");
  scroller.id ||= "site-scroll-content";
  rail.setAttribute("aria-controls", scroller.id);
  rail.tabIndex = 0;
  thumb.className = "site-scrollbar-thumb";
  rail.append(thumb);
  document.body.append(rail);

  const getMetrics = () => {
    const documentHeight = scroller.scrollHeight;
    const viewportHeight = window.innerHeight;
    const scrollableHeight = Math.max(0, documentHeight - viewportHeight);
    const trackHeight = Math.max(0, rail.clientHeight - railPadding * 2);
    const thumbHeight = Math.min(
      trackHeight,
      Math.max(52, (viewportHeight / documentHeight) * trackHeight),
    );
    const thumbTravel = Math.max(0, trackHeight - thumbHeight);

    return {
      scrollableHeight,
      thumbHeight,
      thumbTravel,
    };
  };

  const updateScrollbar = () => {
    updateFrame = 0;
    currentMetrics = getMetrics();

    if (
      currentMetrics.scrollableHeight <= 1 ||
      currentMetrics.thumbTravel <= 0
    ) {
      rail.hidden = true;
      rail.tabIndex = -1;
      rail.setAttribute("aria-hidden", "true");
      root.classList.remove("site-scrollbar-visible");
      return;
    }

    rail.hidden = false;
    rail.tabIndex = 0;
    rail.removeAttribute("aria-hidden");

    const currentScrollY = Math.max(
      0,
      Math.min(currentMetrics.scrollableHeight, scroller.scrollTop),
    );
    const thumbOffset =
      (currentScrollY / currentMetrics.scrollableHeight) *
      currentMetrics.thumbTravel;

    thumb.style.height = `${currentMetrics.thumbHeight}px`;
    thumb.style.transform = `translate3d(0, ${Math.max(
      0,
      Math.min(currentMetrics.thumbTravel, thumbOffset),
    )}px, 0)`;
    rail.setAttribute(
      "aria-valuemax",
      String(Math.round(currentMetrics.scrollableHeight)),
    );
    rail.setAttribute("aria-valuenow", String(Math.round(currentScrollY)));
    rail.setAttribute(
      "aria-valuetext",
      `%${Math.round((currentScrollY / currentMetrics.scrollableHeight) * 100)}`,
    );
  };

  const requestScrollbarUpdate = () => {
    if (!updateFrame) {
      updateFrame = window.requestAnimationFrame(updateScrollbar);
    }
  };

  const revealScrollbar = () => {
    window.clearTimeout(hideTimer);
    root.classList.add("site-scrollbar-visible");
  };

  const hideScrollbarSoon = (delay = 150) => {
    window.clearTimeout(hideTimer);
    hideTimer = window.setTimeout(() => {
      if (
        !dragging &&
        !rail.matches(":hover") &&
        !rail.matches(":focus-within")
      ) {
        root.classList.remove("site-scrollbar-visible");
      }
    }, delay);
  };

  window.addEventListener(
    "pointermove",
    (event) => {
      const pointerNearRightEdge = window.innerWidth - event.clientX <= 10;

      if (pointerNearRightEdge || dragging) {
        revealScrollbar();
      } else {
        hideScrollbarSoon(110);
      }
    },
    { passive: true },
  );

  window.addEventListener(
    "scroll",
    requestScrollbarUpdate,
    { passive: true },
  );

  window.addEventListener("resize", requestScrollbarUpdate, { passive: true });
  rail.addEventListener("pointerenter", revealScrollbar);
  rail.addEventListener("pointerleave", () => {
    if (
      !dragging &&
      document.activeElement === rail &&
      !rail.matches(":focus-visible")
    ) {
      rail.blur();
    }

    hideScrollbarSoon(90);
  });
  rail.addEventListener("focusin", revealScrollbar);
  rail.addEventListener("focusout", () => hideScrollbarSoon(140));

  rail.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target === thumb) {
      return;
    }

    event.preventDefault();
    currentMetrics = getMetrics();

    if (!currentMetrics.thumbTravel) {
      return;
    }

    const railRect = rail.getBoundingClientRect();
    const pointerInsideTrack = event.clientY - railRect.top - railPadding;
    const requestedThumbOffset = Math.max(
      0,
      Math.min(
        currentMetrics.thumbTravel,
        pointerInsideTrack - currentMetrics.thumbHeight / 2,
      ),
    );
    const requestedScrollY =
      (requestedThumbOffset / currentMetrics.thumbTravel) *
      currentMetrics.scrollableHeight;

    window.scrollTo({
      top: requestedScrollY,
      behavior: reducedMotion ? "auto" : "smooth",
    });
    revealScrollbar();
    hideScrollbarSoon(320);
  });

  thumb.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    dragging = true;
    dragPointerY = event.clientY;
    dragScrollY = scroller.scrollTop;
    currentMetrics = getMetrics();
    rail.classList.add("is-dragging");
    root.classList.add("site-scrollbar-dragging");
    revealScrollbar();
    thumb.setPointerCapture(event.pointerId);
  });

  thumb.addEventListener("pointermove", (event) => {
    if (!dragging || !currentMetrics?.thumbTravel) {
      return;
    }

    const pointerDelta = event.clientY - dragPointerY;
    const scrollDelta =
      (pointerDelta / currentMetrics.thumbTravel) *
      currentMetrics.scrollableHeight;

    window.scrollTo(0, dragScrollY + scrollDelta);
  });

  const endThumbDrag = (event) => {
    if (!dragging) {
      return;
    }

    dragging = false;
    rail.classList.remove("is-dragging");
    root.classList.remove("site-scrollbar-dragging");

    if (thumb.hasPointerCapture?.(event.pointerId)) {
      thumb.releasePointerCapture(event.pointerId);
    }

    hideScrollbarSoon(220);
  };

  thumb.addEventListener("pointerup", endThumbDrag);
  thumb.addEventListener("pointercancel", endThumbDrag);

  rail.addEventListener("keydown", (event) => {
    currentMetrics = getMetrics();

    if (!currentMetrics.scrollableHeight) {
      return;
    }

    const pageStep = window.innerHeight * 0.84;
    let requestedScrollY = scroller.scrollTop;

    switch (event.key) {
      case "ArrowUp":
        requestedScrollY -= 48;
        break;
      case "ArrowDown":
        requestedScrollY += 48;
        break;
      case "PageUp":
        requestedScrollY -= pageStep;
        break;
      case "PageDown":
        requestedScrollY += pageStep;
        break;
      case "Home":
        requestedScrollY = 0;
        break;
      case "End":
        requestedScrollY = currentMetrics.scrollableHeight;
        break;
      default:
        return;
    }

    event.preventDefault();
    window.scrollTo({
      top: Math.max(
        0,
        Math.min(currentMetrics.scrollableHeight, requestedScrollY),
      ),
      behavior: reducedMotion ? "auto" : "smooth",
    });
    revealScrollbar();
    hideScrollbarSoon(760);
  });

  if ("ResizeObserver" in window) {
    const resizeObserver = new ResizeObserver(requestScrollbarUpdate);
    resizeObserver.observe(document.body);
    resizeObserver.observe(root);
  }

  updateScrollbar();
};

setupOverlayScrollbar();

const header = document.querySelector("[data-header]");
const siteIntro = document.querySelector("[data-site-intro]");
const homeLinks = document.querySelectorAll('a[href="index.html"]');
const menuToggle = document.querySelector("[data-menu-toggle]");
const nav = document.querySelector("[data-nav]");
const aboutNavItem = document.querySelector(".nav-item.has-dropdown");
const aboutNavTrigger = aboutNavItem?.querySelector(".nav-trigger");
const mobileNavMedia = window.matchMedia("(max-width: 940px)");
const contactForm = document.querySelector("[data-contact-form]");
const formStatus = document.querySelector("[data-form-status]");
const year = document.querySelector("[data-year]");
const videoModal = document.querySelector("[data-video-modal]");
const videoFrame = document.querySelector("[data-video-frame]");
const videoClose = document.querySelector("[data-video-close]");
const videoOpeners = document.querySelectorAll("[data-video-open]");
const pressLogoModal = document.querySelector("[data-press-logo-modal]");
const pressLogoModalImage = document.querySelector("[data-press-logo-modal-image]");
const pressLogoClose = document.querySelector("[data-press-logo-close]");
const pressLogoOpeners = document.querySelectorAll("[data-press-logo-open]");
const pressPhotoModal = document.querySelector("[data-press-photo-modal]");
const pressPhotoModalImage = document.querySelector("[data-press-photo-modal-image]");
const pressPhotoDownload = document.querySelector("[data-press-photo-download]");
const pressPhotoClose = document.querySelector("[data-press-photo-close]");
const pressPhotoOpeners = document.querySelectorAll("[data-press-photo-open]");
const heroCarousel = document.querySelector("[data-hero-carousel]");
const heroSlides = document.querySelectorAll("[data-hero-slide]");
const heroDots = document.querySelectorAll("[data-hero-dot]");
const heroPrev = document.querySelector("[data-hero-prev]");
const heroNext = document.querySelector("[data-hero-next]");
const historyLightbox = document.querySelector("[data-history-lightbox]");
const historyLightboxImage = document.querySelector("[data-history-lightbox-image]");
const historyLightboxCaption = document.querySelector("[data-history-lightbox-caption]");
const historyLightboxDownload = document.querySelector("[data-history-lightbox-download]");
const historyLightboxClose = document.querySelector("[data-history-lightbox-close]");
const historyLightboxPrev = document.querySelector("[data-history-lightbox-prev]");
const historyLightboxNext = document.querySelector("[data-history-lightbox-next]");
const historyPhotoOpeners = Array.from(document.querySelectorAll("[data-history-photo-open]"));
const newsCarousel = document.querySelector("[data-news-carousel]");
const newsTrack = document.querySelector("[data-news-track]");
const newsCards = Array.from(document.querySelectorAll("[data-news-card]"));
const newsPrev = document.querySelector("[data-news-prev]");
const newsNext = document.querySelector("[data-news-next]");
const newsStatus = document.querySelector("[data-news-status]");
const newsLightbox = document.querySelector("[data-news-lightbox]");
const newsLightboxImage = document.querySelector("[data-news-lightbox-image]");
const newsLightboxTitle = document.querySelector("[data-news-lightbox-title]");
const newsLightboxMeta = document.querySelector("[data-news-lightbox-meta]");
const newsLightboxOpen = document.querySelector("[data-news-lightbox-open]");
const newsLightboxClose = document.querySelector("[data-news-lightbox-close]");
const newsLightboxPrev = document.querySelector("[data-news-lightbox-prev]");
const newsLightboxNext = document.querySelector("[data-news-lightbox-next]");
const newsOpeners = Array.from(document.querySelectorAll("[data-news-open]"));
const audioCards = Array.from(document.querySelectorAll("[data-audio-card]"));
const revealTargets = Array.from(
  new Set(document.querySelectorAll(
  [
    ".hero-content > .eyebrow",
    ".hero-title-row",
    ".hero-copy",
    ".hero-certificate-link",
    ".home-authority-heading > *",
    ".home-authority-media",
    ".home-authority-card",
    ".home-authority-card .authority-list li",
    ".home-product-definition-heading > *",
    ".home-product-definition-lead",
    ".home-product-feature-visual",
    ".home-product-definition-grid article",
    ".home-product-process-visual",
    ".home-product-distinction",
    ".home-product-definition-actions a",
    ".home-firms-block > *",
    ".home-partner-heading > *",
    ".home-partner-card",
    ".home-news-heading > *",
    ".home-news-controls",
    ".article-index-head > *",
    ".article-button",
    ".media-coverage-head > *",
    ".media-coverage-column h2",
    ".media-mention-card",
    ".books-head > *",
    ".book-card",
    ".documentary-card",
    ".press-kit-heading > *",
    ".press-kit-section-title > *",
    ".press-kit-logo",
    ".press-kit-brochure-action",
    ".press-kit-bulletin",
    ".press-kit-gallery-item",
    ".topline > *",
    ".font-card",
    ".intro-section .two-column > *",
    ".authority-feature > *",
    ".authority-feature .authority-list li",
    ".authority-detail-heading > *",
    ".authority-detail-card",
    ".authority-detail-media",
    ".page-hero .section-inner > *",
    ".history-story h1",
    ".history-story p",
    ".history-hero-copy > *",
    ".history-hero-media",
    ".history-context-card",
    ".history-archive-heading > *",
    ".history-archive-item",
    ".section-heading > *",
    ".content-layout > *",
    ".page-card",
    ".route-card",
    ".resource-card",
    ".timeline article",
    ".standard-grid article",
    ".document-grid a",
    ".firms-layout > *",
    ".press-layout > *",
    ".press-list article",
    ".partner-list span",
    ".contact-info-card",
    ".contact-page-form",
    ".contact-info-item",
    ".contact-layout > *",
  ].join(","),
  )),
);

let headerIsScrolled = false;
let headerScrollTicking = false;
const hasSolidHeader = header?.classList.contains("header-solid");

const setMobileAboutExpanded = (isExpanded) => {
  if (!aboutNavItem || !aboutNavTrigger) {
    return;
  }

  aboutNavItem.classList.toggle("submenu-collapsed", !isExpanded);
  aboutNavTrigger.setAttribute("aria-expanded", String(isExpanded));
};

const syncAboutNavigationMode = () => {
  if (!aboutNavItem || !aboutNavTrigger) {
    return;
  }

  if (mobileNavMedia.matches) {
    setMobileAboutExpanded(true);
    return;
  }

  aboutNavItem.classList.remove("submenu-collapsed");
  aboutNavTrigger.removeAttribute("aria-expanded");
};

syncAboutNavigationMode();
mobileNavMedia.addEventListener?.("change", syncAboutNavigationMode);

aboutNavTrigger?.addEventListener("click", () => {
  if (!mobileNavMedia.matches) {
    return;
  }

  const isExpanded = aboutNavTrigger.getAttribute("aria-expanded") === "true";
  setMobileAboutExpanded(!isExpanded);
});

const syncHeader = () => {
  if (!header || hasSolidHeader) {
    return;
  }

  const nextState = window.scrollY > 24;

  if (nextState === headerIsScrolled) {
    return;
  }

  headerIsScrolled = nextState;
  header.classList.toggle("scrolled", headerIsScrolled);
};

const scheduleHeaderSync = () => {
  if (headerScrollTicking) {
    return;
  }

  headerScrollTicking = true;
  window.requestAnimationFrame(() => {
    syncHeader();
    headerScrollTicking = false;
  });
};

const handleHeaderWheel = (event) => {
  if (
    document.documentElement.classList.contains("intro-running") ||
    document.body.classList.contains("modal-open") ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return;
  }

  const wheelUnit =
    event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? window.innerHeight
        : 1;
  const nextLeft = event.deltaX * wheelUnit;
  const nextTop = event.deltaY * wheelUnit;

  if (nextLeft === 0 && nextTop === 0) {
    return;
  }

  event.preventDefault();
  window.scrollBy({
    left: nextLeft,
    top: nextTop,
    behavior: "auto",
  });
};

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    const isOpen = header.classList.toggle("open");
    if (isOpen && mobileNavMedia.matches) {
      setMobileAboutExpanded(true);
    }
    menuToggle.setAttribute("aria-label", isOpen ? "Menüyü kapat" : "Menüyü aç");
  });
}

homeLinks.forEach((homeLink) => {
  homeLink.addEventListener("click", (event) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      homeLink.target === "_blank" ||
      homeLink.hasAttribute("download")
    ) {
      return;
    }

    requestHomeIntroReplay();

    if (!isHomePagePath()) {
      return;
    }

    event.preventDefault();
    header.classList.remove("open");
    window.location.assign(homeLink.href);
  });
});

if (nav) {
  nav.addEventListener("click", (event) => {
    if (event.target.matches("a")) {
      header.classList.remove("open");
      menuToggle?.setAttribute("aria-label", "Menüyü aç");
    }
  });
}

if (contactForm) {
  contactForm.addEventListener("submit", (event) => {
    event.preventDefault();
    contactForm.reset();
    formStatus.textContent =
      "Bilgi talebiniz alındı. Başvuru süreci için İSTİB tarafından dönüş yapılacaktır.";
  });
}

const closeVideoModal = () => {
  if (!videoModal || !videoFrame) {
    return;
  }

  videoModal.classList.remove("open");
  videoModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  videoFrame.removeAttribute("src");
};

const openVideoModal = (event) => {
  if (!videoModal || !videoFrame) {
    return;
  }

  event.preventDefault();
  videoFrame.setAttribute(
    "src",
    "https://www.youtube.com/embed/ir_lIpUvCTo?autoplay=1&rel=0",
  );
  videoModal.classList.add("open");
  videoModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  videoClose?.focus();
};

videoOpeners.forEach((opener) => {
  opener.addEventListener("click", openVideoModal);
});

if (videoClose) {
  videoClose.addEventListener("click", closeVideoModal);
}

if (videoModal) {
  videoModal.addEventListener("click", (event) => {
    if (event.target === videoModal) {
      closeVideoModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && videoModal?.classList.contains("open")) {
    closeVideoModal();
  }
});

const setAudioCardState = (card, isPlaying) => {
  const toggle = card.querySelector("[data-audio-toggle]");
  const icon = card.querySelector("[data-audio-icon]");
  const status = card.querySelector("[data-audio-status]");
  const title = card.dataset.audioTitle || "Şarkı";

  card.classList.toggle("is-playing", isPlaying);
  toggle?.setAttribute("aria-pressed", String(isPlaying));
  toggle?.setAttribute(
    "aria-label",
    isPlaying
      ? `${title} şarkısını duraklat`
      : `${title} şarkısını oynat`,
  );

  if (icon) {
    icon.classList.toggle("bi-play-fill", !isPlaying);
    icon.classList.toggle("bi-pause-fill", isPlaying);
  }

  if (status) {
    status.textContent = isPlaying
      ? `${title} şarkısı oynatılıyor.`
      : `${title} şarkısı duraklatıldı.`;
  }
};

audioCards.forEach((card) => {
  const audio = card.querySelector("[data-audio-player]");
  const toggle = card.querySelector("[data-audio-toggle]");
  const status = card.querySelector("[data-audio-status]");

  if (!audio || !toggle) {
    return;
  }

  toggle.addEventListener("click", () => {
    if (audio.paused) {
      audioCards.forEach((otherCard) => {
        if (otherCard === card) {
          return;
        }

        otherCard.querySelector("[data-audio-player]")?.pause();
      });

      audio.play().catch(() => {
        if (status) {
          status.textContent = "Şarkı şu anda oynatılamıyor.";
        }
      });
    } else {
      audio.pause();
    }
  });

  audio.addEventListener("play", () => setAudioCardState(card, true));
  audio.addEventListener("pause", () => setAudioCardState(card, false));
  audio.addEventListener("ended", () => {
    audio.currentTime = 0;
    setAudioCardState(card, false);
  });
});

let activePressLogoOpener = null;

const closePressLogoModal = () => {
  if (!pressLogoModal || !pressLogoModalImage) {
    return;
  }

  pressLogoModal.classList.remove("open");
  pressLogoModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  pressLogoModalImage.removeAttribute("src");
  pressLogoModalImage.alt = "";
  activePressLogoOpener?.focus();
  activePressLogoOpener = null;
};

const openPressLogoModal = (event) => {
  if (!pressLogoModal || !pressLogoModalImage) {
    return;
  }

  const opener = event.currentTarget;
  const logo = opener.querySelector("img");

  if (!logo) {
    return;
  }

  activePressLogoOpener = opener;
  pressLogoModalImage.src = logo.currentSrc || logo.src;
  pressLogoModalImage.alt = logo.alt;
  pressLogoModal.classList.add("open");
  pressLogoModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  pressLogoClose?.focus();
};

pressLogoOpeners.forEach((opener) => {
  opener.addEventListener("click", openPressLogoModal);
});

pressLogoClose?.addEventListener("click", closePressLogoModal);

pressLogoModal?.addEventListener("click", (event) => {
  if (event.target === pressLogoModal) {
    closePressLogoModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pressLogoModal?.classList.contains("open")) {
    closePressLogoModal();
  }
});

let activePressPhotoOpener = null;

const closePressPhotoModal = () => {
  if (!pressPhotoModal || !pressPhotoModalImage || !pressPhotoDownload) {
    return;
  }

  pressPhotoModal.classList.remove("open");
  pressPhotoModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  pressPhotoModalImage.removeAttribute("src");
  pressPhotoModalImage.alt = "";
  pressPhotoDownload.setAttribute("href", "#");
  activePressPhotoOpener?.focus();
  activePressPhotoOpener = null;
};

const openPressPhotoModal = (event) => {
  if (!pressPhotoModal || !pressPhotoModalImage || !pressPhotoDownload) {
    return;
  }

  event.preventDefault();

  const opener = event.currentTarget;
  const photo = opener.querySelector("img");

  if (!photo) {
    return;
  }

  const photoUrl = opener.href || photo.currentSrc || photo.src;
  const photoName = new URL(photoUrl, window.location.href).pathname.split("/").pop();

  activePressPhotoOpener = opener;
  pressPhotoModalImage.src = photoUrl;
  pressPhotoModalImage.alt = photo.alt;
  pressPhotoDownload.href = photoUrl;
  pressPhotoDownload.setAttribute("download", photoName || "eminonu-balik-ekmek-fotograf.webp");
  pressPhotoModal.classList.add("open");
  pressPhotoModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  pressPhotoClose?.focus();
};

pressPhotoOpeners.forEach((opener) => {
  opener.addEventListener("click", openPressPhotoModal);
});

pressPhotoClose?.addEventListener("click", closePressPhotoModal);

pressPhotoModal?.addEventListener("click", (event) => {
  if (event.target === pressPhotoModal) {
    closePressPhotoModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && pressPhotoModal?.classList.contains("open")) {
    closePressPhotoModal();
  }
});

const setupSiteIntro = (startExperience) => {
  const root = document.documentElement;
  let experienceStarted = false;

  const startPageExperience = () => {
    if (experienceStarted) {
      return;
    }

    experienceStarted = true;
    startExperience();
  };

  const clearInlineFailsafe = () => {
    if (window.__eminonuIntroFailsafe) {
      window.clearTimeout(window.__eminonuIntroFailsafe);
      window.__eminonuIntroFailsafe = 0;
    }
  };

  if (!siteIntro || !root.classList.contains("intro-enabled")) {
    clearInlineFailsafe();
    root.classList.remove("intro-enabled", "intro-running");
    siteIntro?.setAttribute("aria-hidden", "true");
    startPageExperience();
    return;
  }

  const startedAt = Number(window.__eminonuIntroStarted) || window.performance.now();
  const elapsed = () => Math.max(0, window.performance.now() - startedAt);
  const wait = (duration) =>
    new Promise((resolve) => window.setTimeout(resolve, Math.max(0, duration)));
  let finished = false;
  let cleanupTimer = 0;
  let watchdogTimer = 0;

  const handleIntroKeydown = (event) => {
    if (event.key === "Escape") {
      finishIntro();
    }
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      finishIntro(true);
    }
  };

  const handlePageShow = (event) => {
    if (event.persisted) {
      finishIntro(true);
    }
  };

  const cleanupIntro = () => {
    window.clearTimeout(cleanupTimer);
    window.clearTimeout(watchdogTimer);
    clearInlineFailsafe();
    document.removeEventListener("keydown", handleIntroKeydown);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("pageshow", handlePageShow);
    root.classList.remove("intro-enabled", "intro-running");
    siteIntro.setAttribute("aria-hidden", "true");
  };

  function finishIntro(immediate = false) {
    if (finished) {
      return;
    }

    finished = true;
    window.clearTimeout(watchdogTimer);
    clearInlineFailsafe();
    startPageExperience();
    siteIntro.setAttribute("aria-hidden", "true");

    if (immediate) {
      cleanupIntro();
      return;
    }

    siteIntro.classList.add("is-leaving");
    siteIntro.addEventListener(
      "transitionend",
      (event) => {
        if (event.target === siteIntro && event.propertyName === "opacity") {
          cleanupIntro();
        }
      },
    );
    cleanupTimer = window.setTimeout(cleanupIntro, 1050);
  }

  siteIntro.addEventListener("pointerdown", () => finishIntro(), { once: true });
  document.addEventListener("keydown", handleIntroKeydown);
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("pageshow", handlePageShow);

  if (document.visibilityState === "hidden") {
    finishIntro(true);
    return;
  }

  const activeHeroImage = document.querySelector(
    ".hero-slide.is-active .hero-image",
  );
  const heroDecode = activeHeroImage?.decode
    ? activeHeroImage.decode().catch(() => undefined)
    : Promise.resolve();
  const heroReady = Promise.race([heroDecode, wait(800)]);
  const minimumDisplay = wait(1800 - elapsed());

  Promise.all([minimumDisplay, heroReady]).then(() => finishIntro());
  watchdogTimer = window.setTimeout(
    () => finishIntro(),
    Math.max(0, 2700 - elapsed()),
  );
};

const setupHeroCarousel = () => {
  if (!heroCarousel || heroSlides.length === 0) {
    return;
  }

  let currentSlide = 0;
  let carouselTimer;

  const showSlide = (index) => {
    currentSlide = (index + heroSlides.length) % heroSlides.length;

    heroSlides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === currentSlide);
    });

    heroDots.forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === currentSlide);
    });
  };

  const restartTimer = () => {
    window.clearInterval(carouselTimer);
    carouselTimer = window.setInterval(() => {
      showSlide(currentSlide + 1);
    }, 6200);
  };

  const goToSlide = (index) => {
    showSlide(index);
    restartTimer();
  };

  heroPrev?.addEventListener("click", () => goToSlide(currentSlide - 1));
  heroNext?.addEventListener("click", () => goToSlide(currentSlide + 1));

  heroDots.forEach((dot, index) => {
    dot.addEventListener("click", () => goToSlide(index));
  });

  heroCarousel.addEventListener("mouseenter", () => window.clearInterval(carouselTimer));
  heroCarousel.addEventListener("mouseleave", restartTimer);

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (!prefersReducedMotion) {
    restartTimer();
  }
};

let activeHistoryPhotoIndex = 0;
let activeHistoryPhotoOpener = null;

const showHistoryPhoto = (index) => {
  if (
    !historyLightboxImage ||
    !historyLightboxCaption ||
    !historyLightboxDownload ||
    historyPhotoOpeners.length === 0
  ) {
    return;
  }

  activeHistoryPhotoIndex = (index + historyPhotoOpeners.length) % historyPhotoOpeners.length;
  const opener = historyPhotoOpeners[activeHistoryPhotoIndex];
  const photo = opener.querySelector("img");
  const caption = opener.querySelector("span")?.textContent?.trim() || photo?.alt || "";

  if (!photo) {
    return;
  }

  const photoUrl = opener.href || photo.currentSrc || photo.src;
  const photoName = new URL(photoUrl, window.location.href).pathname.split("/").pop();
  historyLightboxImage.src = photoUrl;
  historyLightboxImage.alt = photo.alt;
  historyLightboxCaption.textContent = caption;
  historyLightboxDownload.href = photoUrl;
  historyLightboxDownload.setAttribute("download", photoName || "eminonu-balik-ekmek.jpg");
};

const openHistoryLightbox = (event) => {
  if (!historyLightbox) {
    return;
  }

  event.preventDefault();
  activeHistoryPhotoOpener = event.currentTarget;
  showHistoryPhoto(historyPhotoOpeners.indexOf(activeHistoryPhotoOpener));
  historyLightbox.classList.add("open");
  historyLightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  historyLightboxClose?.focus();
};

const closeHistoryLightbox = () => {
  if (!historyLightbox || !historyLightboxImage) {
    return;
  }

  historyLightbox.classList.remove("open");
  historyLightbox.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  historyLightboxImage.removeAttribute("src");
  activeHistoryPhotoOpener?.focus();
  activeHistoryPhotoOpener = null;
};

historyPhotoOpeners.forEach((opener) => opener.addEventListener("click", openHistoryLightbox));
historyLightboxClose?.addEventListener("click", closeHistoryLightbox);
historyLightboxPrev?.addEventListener("click", () => showHistoryPhoto(activeHistoryPhotoIndex - 1));
historyLightboxNext?.addEventListener("click", () => showHistoryPhoto(activeHistoryPhotoIndex + 1));

historyLightbox?.addEventListener("click", (event) => {
  if (event.target.closest("[data-history-lightbox-image], button, a")) {
    return;
  }

  closeHistoryLightbox();
});

document.addEventListener("keydown", (event) => {
  if (!historyLightbox?.classList.contains("open")) {
    return;
  }

  if (event.key === "Escape") {
    closeHistoryLightbox();
  } else if (event.key === "ArrowLeft") {
    showHistoryPhoto(activeHistoryPhotoIndex - 1);
  } else if (event.key === "ArrowRight") {
    showHistoryPhoto(activeHistoryPhotoIndex + 1);
  }
});

let activeNewsIndex = 0;
let activeNewsOpener = null;

const getNewsCardOffset = (card) => {
  if (!newsTrack || !card) {
    return 0;
  }

  const trackRect = newsTrack.getBoundingClientRect();
  const cardRect = card.getBoundingClientRect();
  return newsTrack.scrollLeft + cardRect.left - trackRect.left;
};

const getNewsGap = () => {
  if (!newsTrack) {
    return 0;
  }

  const trackStyle = window.getComputedStyle(newsTrack);
  return Number.parseFloat(trackStyle.columnGap || trackStyle.gap) || 0;
};

const getVisibleNewsCount = () => {
  if (!newsTrack || newsCards.length === 0) {
    return 0;
  }

  const cardWidth = newsCards[0].getBoundingClientRect().width;
  const gap = getNewsGap();

  if (cardWidth <= 0) {
    return 1;
  }

  return Math.max(
    1,
    Math.min(
      newsCards.length,
      Math.floor((newsTrack.clientWidth + gap + 1) / (cardWidth + gap)),
    ),
  );
};

const getNearestNewsIndex = () => {
  if (!newsTrack || newsCards.length === 0) {
    return 0;
  }

  return newsCards.reduce((closestIndex, card, index) => {
    const currentDistance = Math.abs(getNewsCardOffset(card) - newsTrack.scrollLeft);
    const closestDistance = Math.abs(
      getNewsCardOffset(newsCards[closestIndex]) - newsTrack.scrollLeft,
    );
    return currentDistance < closestDistance ? index : closestIndex;
  }, 0);
};

const updateNewsCarouselState = () => {
  if (!newsTrack || newsCards.length === 0) {
    return;
  }

  const visibleCount = getVisibleNewsCount();
  const maxStartIndex = Math.max(0, newsCards.length - visibleCount);
  const startIndex = Math.min(getNearestNewsIndex(), maxStartIndex);
  const endIndex = Math.min(newsCards.length, startIndex + visibleCount);
  const maxScrollLeft = Math.max(0, newsTrack.scrollWidth - newsTrack.clientWidth);

  if (newsStatus) {
    newsStatus.textContent = `${startIndex + 1}–${endIndex} / ${newsCards.length}`;
  }

  if (newsPrev) {
    newsPrev.disabled = newsTrack.scrollLeft <= 2;
  }

  if (newsNext) {
    newsNext.disabled = newsTrack.scrollLeft >= maxScrollLeft - 2;
  }
};

const scrollToNews = (index) => {
  if (!newsTrack || newsCards.length === 0) {
    return;
  }

  const targetIndex = Math.max(0, Math.min(index, newsCards.length - 1));
  const maxScrollLeft = Math.max(0, newsTrack.scrollWidth - newsTrack.clientWidth);
  const targetLeft = Math.min(getNewsCardOffset(newsCards[targetIndex]), maxScrollLeft);
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";

  newsTrack.scrollTo({ left: targetLeft, behavior });
};

const setupNewsCarousel = () => {
  if (!newsCarousel || !newsTrack || newsCards.length === 0) {
    return;
  }

  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  let scrollTicking = false;
  let resizeTicking = false;
  let entryMotionActive = false;
  let entryMotionFrame = 0;
  let entryObserver = null;

  const finishEntryMotion = () => {
    newsTrack.scrollLeft = 0;
    entryMotionActive = false;
    entryMotionFrame = 0;
    newsTrack.classList.remove("is-entry-gliding");
    updateNewsCarouselState();
  };

  const cancelEntryMotion = () => {
    if (!entryMotionActive) {
      return;
    }

    entryMotionActive = false;
    if (entryMotionFrame) {
      window.cancelAnimationFrame(entryMotionFrame);
    }
    entryMotionFrame = 0;
    entryObserver?.disconnect();
    entryObserver = null;
    newsTrack.classList.remove("is-entry-gliding");
    updateNewsCarouselState();
  };

  const runEntryMotion = () => {
    const startOffset = newsTrack.scrollLeft;
    const duration = 820;
    const startTime = window.performance.now();

    const animate = (currentTime) => {
      if (!entryMotionActive) {
        return;
      }

      const progress = Math.min((currentTime - startTime) / duration, 1);
      const easedProgress = 1 - Math.pow(1 - progress, 4);
      newsTrack.scrollLeft = startOffset * (1 - easedProgress);

      if (progress < 1) {
        entryMotionFrame = window.requestAnimationFrame(animate);
      } else {
        finishEntryMotion();
      }
    };

    entryMotionFrame = window.requestAnimationFrame(animate);
  };

  const prepareEntryMotion = () => {
    if (prefersReducedMotion || !("IntersectionObserver" in window)) {
      return;
    }

    const maxScrollLeft = Math.max(0, newsTrack.scrollWidth - newsTrack.clientWidth);
    if (maxScrollLeft <= 0) {
      return;
    }

    entryMotionActive = true;
    newsTrack.classList.add("is-entry-gliding");
    newsTrack.scrollLeft = Math.min(64, maxScrollLeft);

    entryObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || entry.intersectionRatio < 0.18) {
          return;
        }

        entryObserver?.disconnect();
        entryObserver = null;
        runEntryMotion();
      },
      {
        threshold: [0.18],
        rootMargin: "0px 0px -8% 0px",
      },
    );
    entryObserver.observe(newsCarousel);
  };

  newsPrev?.addEventListener("click", () => {
    cancelEntryMotion();
    scrollToNews(getNearestNewsIndex() - 1);
  });

  newsNext?.addEventListener("click", () => {
    cancelEntryMotion();
    scrollToNews(getNearestNewsIndex() + 1);
  });

  newsTrack.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      cancelEntryMotion();
      scrollToNews(getNearestNewsIndex() - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      cancelEntryMotion();
      scrollToNews(getNearestNewsIndex() + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      cancelEntryMotion();
      scrollToNews(0);
    } else if (event.key === "End") {
      event.preventDefault();
      cancelEntryMotion();
      newsTrack.scrollTo({
        left: newsTrack.scrollWidth - newsTrack.clientWidth,
        behavior: prefersReducedMotion ? "auto" : "smooth",
      });
    }
  });

  newsTrack.addEventListener("pointerdown", cancelEntryMotion, { passive: true });
  newsTrack.addEventListener("touchstart", cancelEntryMotion, { passive: true });
  newsTrack.addEventListener("wheel", cancelEntryMotion, { passive: true });

  newsTrack.addEventListener(
    "scroll",
    () => {
      if (scrollTicking) {
        return;
      }

      scrollTicking = true;
      window.requestAnimationFrame(() => {
        if (!entryMotionActive) {
          updateNewsCarouselState();
        }
        scrollTicking = false;
      });
    },
    { passive: true },
  );

  window.addEventListener(
    "resize",
    () => {
      if (resizeTicking) {
        return;
      }

      resizeTicking = true;
      window.requestAnimationFrame(() => {
        cancelEntryMotion();
        updateNewsCarouselState();
        resizeTicking = false;
      });
    },
    { passive: true },
  );

  updateNewsCarouselState();
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(prepareEntryMotion);
  });
};

const showNewsLightboxItem = (index) => {
  if (
    newsOpeners.length === 0 ||
    !newsLightboxImage ||
    !newsLightboxTitle ||
    !newsLightboxMeta ||
    !newsLightboxOpen
  ) {
    return;
  }

  activeNewsIndex = (index + newsOpeners.length) % newsOpeners.length;
  const opener = newsOpeners[activeNewsIndex];
  const source = opener.dataset.newsSrc || "";
  const title = opener.dataset.newsTitle || "Haber kupürü";
  const meta = opener.dataset.newsMeta || "";

  newsLightboxImage.src = source;
  newsLightboxImage.alt = `${title} haber kupürü`;
  newsLightboxTitle.textContent = title;
  newsLightboxMeta.textContent = meta;
  newsLightboxOpen.href = source;
};

const openNewsLightbox = (event) => {
  if (!newsLightbox) {
    return;
  }

  activeNewsOpener = event.currentTarget;
  const openerIndex = newsOpeners.indexOf(activeNewsOpener);
  showNewsLightboxItem(openerIndex >= 0 ? openerIndex : 0);
  newsLightbox.classList.add("open");
  newsLightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  window.requestAnimationFrame(() => newsLightboxClose?.focus());
};

const closeNewsLightbox = () => {
  if (!newsLightbox || !newsLightboxImage) {
    return;
  }

  newsLightbox.classList.remove("open");
  newsLightbox.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  newsLightboxImage.removeAttribute("src");
  newsLightboxImage.alt = "";
  activeNewsOpener?.focus();
  activeNewsOpener = null;
};

newsOpeners.forEach((opener) => opener.addEventListener("click", openNewsLightbox));
newsLightboxClose?.addEventListener("click", closeNewsLightbox);
newsLightboxPrev?.addEventListener("click", () => showNewsLightboxItem(activeNewsIndex - 1));
newsLightboxNext?.addEventListener("click", () => showNewsLightboxItem(activeNewsIndex + 1));

newsLightbox?.addEventListener("click", (event) => {
  if (event.target === newsLightbox || event.target === newsLightbox.firstElementChild) {
    closeNewsLightbox();
  }
});

document.addEventListener("keydown", (event) => {
  if (!newsLightbox?.classList.contains("open")) {
    return;
  }

  if (event.key === "Escape") {
    event.preventDefault();
    closeNewsLightbox();
    return;
  }

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    showNewsLightboxItem(activeNewsIndex - 1);
    return;
  }

  if (event.key === "ArrowRight") {
    event.preventDefault();
    showNewsLightboxItem(activeNewsIndex + 1);
    return;
  }

  if (event.key !== "Tab") {
    return;
  }

  const focusableElements = [
    newsLightboxOpen,
    newsLightboxClose,
    newsLightboxPrev,
    newsLightboxNext,
  ].filter(Boolean);

  if (focusableElements.length === 0) {
    return;
  }

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstFocusable) {
    event.preventDefault();
    lastFocusable.focus();
  } else if (!event.shiftKey && document.activeElement === lastFocusable) {
    event.preventDefault();
    firstFocusable.focus();
  }
});

const setupRevealAnimations = () => {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const targets = Array.from(revealTargets);

  if (targets.length === 0) {
    return;
  }

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  const animatedTargets = [];
  const deferredScrollTargets = [];
  const deferredRevealSelector = [
    ".home-authority-heading > *",
    ".home-authority-media",
    ".home-authority-card",
    ".home-authority-card .authority-list li",
    ".home-product-definition-heading > *",
    ".home-product-definition-lead",
    ".home-product-feature-visual",
    ".home-product-definition-grid article",
    ".home-product-process-visual",
    ".home-product-distinction",
    ".home-product-definition-actions a",
    ".home-news-heading > *",
    ".home-news-controls",
    ".resource-card",
    ".documentary-card",
    ".history-hero-copy > *",
    ".history-hero-media",
    ".history-context-card",
    ".history-archive-heading > *",
    ".history-archive-item",
  ].join(",");

  targets.forEach((element) => {
    const rect = element.getBoundingClientRect();
    const isDeferredRevealTarget = element.matches(deferredRevealSelector);
    const revealStartRatio = isDeferredRevealTarget ? 0.72 : 0.92;
    const shouldAnimate =
      !prefersReducedMotion &&
      rect.top < viewportHeight * revealStartRatio &&
      rect.bottom > 0;
    const shouldDeferUntilVisible =
      !prefersReducedMotion &&
      isDeferredRevealTarget &&
      rect.top >= viewportHeight * revealStartRatio;

    element.classList.add("reveal-item");

    if (shouldAnimate) {
      element.style.setProperty("--reveal-delay", `${Math.min(animatedTargets.length * 70, 280)}ms`);
      animatedTargets.push(element);
      return;
    }

    if (shouldDeferUntilVisible) {
      deferredScrollTargets.push(element);
      return;
    }

    element.classList.add("reveal-visible");
  });

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      animatedTargets.forEach((element) => {
        element.classList.add("reveal-visible");
      });
    });
  });

  if (deferredScrollTargets.length === 0) {
    return;
  }

  if (!("IntersectionObserver" in window)) {
    deferredScrollTargets.forEach((element) => {
      element.classList.add("reveal-visible");
    });
    return;
  }

  const deferredRevealObserver = new IntersectionObserver(
    (entries) => {
      let visibleIndex = 0;

      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.style.setProperty(
          "--reveal-delay",
          `${Math.min(visibleIndex * 85, 340)}ms`,
        );
        entry.target.classList.add("reveal-visible");
        deferredRevealObserver.unobserve(entry.target);
        visibleIndex += 1;
      });
    },
    {
      rootMargin: "0px 0px -28% 0px",
      threshold: 0.12,
    },
  );

  deferredScrollTargets.forEach((element) => {
    deferredRevealObserver.observe(element);
  });
};

if (year) {
  year.textContent = new Date().getFullYear();
}
if (!hasSolidHeader) {
  syncHeader();
  window.addEventListener("scroll", scheduleHeaderSync, { passive: true });
}
const startHomepageExperience = () => {
  setupHeroCarousel();
  setupNewsCarousel();
  setupRevealAnimations();
};

setupSiteIntro(startHomepageExperience);
header?.addEventListener("wheel", handleHeaderWheel, { passive: false });
