(function () {
  const THEME_STORAGE_KEY = "artwork-theme";
  const themeToggle = document.getElementById("theme-toggle");
  const themeIcon = themeToggle?.querySelector(".theme-toggle-icon");
  const themeLabel = themeToggle?.querySelector(".theme-toggle-label");

  function getSystemTheme() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function getActiveTheme() {
    const stored = document.documentElement.dataset.theme;
    if (stored === "dark" || stored === "light") return stored;
    return getSystemTheme();
  }

  function updateThemeToggle() {
    if (!themeToggle) return;
    const isDark = getActiveTheme() === "dark";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
    if (themeIcon) themeIcon.textContent = isDark ? "☀" : "☾";
    if (themeLabel) themeLabel.textContent = isDark ? "Light" : "Dark";
  }

  function setTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    updateThemeToggle();
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      setTheme(getActiveTheme() === "dark" ? "light" : "dark");
    });
  }

  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      updateThemeToggle();
    }
  });

  updateThemeToggle();

  const gallery = document.getElementById("gallery");
  const loading = document.getElementById("loading");
  const filtersEl = document.getElementById("filters");
  const filterSelect = document.getElementById("filter-select");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const lightboxClose = document.getElementById("lightbox-close");
  const lightboxHide = document.getElementById("lightbox-hide");
  const countEl = document.getElementById("count");
  const hiddenToggle = document.getElementById("hidden-toggle");
  const hiddenCountEl = document.getElementById("hidden-count");
  const hiddenPanel = document.getElementById("hidden-panel");
  const hiddenPanelClose = document.getElementById("hidden-panel-close");
  const hiddenList = document.getElementById("hidden-list");
  const hiddenExport = document.getElementById("hidden-export");
  const hiddenClear = document.getElementById("hidden-clear");

  const CACHE_KEY = "artwork-dimensions-v7";
  const HIDDEN_STORAGE_KEY = "artwork-user-hidden-v1";
  let artworks = [];
  let hiddenMeta = new Map();
  let hiddenSrcs = new Set();
  let activeFilter = "All";
  let activeLightboxArt = null;
  let dimensionCache = loadDimensionCache();

  const JUNK_PATTERNS = [
    /\.pdf(?:\.|$|\?)/i,
    /\blumin\b|changan/i,
    /barcode|qr.?code|isbn/i,
    /(?:^|[\s_\-(])(?:00[1-9])(?:[\s_\-)]|\.jpg|$)/i,
    /(?:^|[\s_\-])(?:detail|deta|crop|verso|back|x2_deta|fxd)(?:[\s_\-]|\.|$)/i,
    /-wus\d{5}/i,
    /sketchbook|sketch book/i,
    /letters?\s+of|letter\s+of|correspondence|handwritten|manuscript|epistle/i,
    /1860-s|alexey-savrasov-1860|savrasov-1860-s/i,
    /by nadar|by rockwood|by william merritt chase|peasant and painter/i,
    /_self\.|\/self\.jpg|self[- ]portrait|autoportrait/i,
    /savrasov_photo|ivan_aivazovsky\.jpg|ivan_aivazovsky1881\.png/i,
    /signed palettes|new york tribune|fred harvey|\bnby \d|tribune, august/i,
    /hummingbird|interrupted reading|abduction of the sabine|\bgleaners\b|\bangelus\b|dressing for the carnival|the source met/i,
    /installation view|gallery view|exhibition view|overall\.jpg|room view|people viewing/i,
    /\bmrs\.|portrait of|manuel garcia|edwin forrest/i,
    /rutherford|nightmare hall|whitman publishing/i,
    /army photography|fmwrc/i,
    /\banagoria\b|gasometer|oberhausen.*der sch[oö]ne schein/i,
    /d[üu]lmen.*2017|dietmar rabich/i,
    /interior.*in the museum|exterior.*in the museum/i,
    /hell and the flood p\d|hieronymus bosch 0\d{2}(?:\s|$|\()/i,
    /reliquary.*0[1-3] by shakko/i,
    /\(\d{11,}\)/,
  ];

  const MUSEUM_ID_EXCEPTION = /200[12][-.]|nga\s*\d{5}|met\s*dp|11001|57002|2007\.|1971\./i;

  function isJunkArtwork(art) {
    const blob = `${art.title || ""} ${art.src || ""} ${art.artist || ""}`;
    const title = (art.title || "").trim().toLowerCase();

    if (JUNK_PATTERNS.some((pattern) => pattern.test(blob))) {
      if (/00[1-9]/.test(blob) && MUSEUM_ID_EXCEPTION.test(blob)) {
        return false;
      }
      if (/(?:detail|deta|crop|verso|back|x2_deta|fxd)/i.test(blob) && /cropsey/i.test(blob)) {
        return false;
      }
      return true;
    }

    if (title === "photo" && /photo/i.test(art.src || "")) return true;
    if (title === "ivan" && /ivan_aivazovsky\.jpg/i.test(art.src || "")) return true;
    if (title === "self") return true;
    if (/^1860-s$|^alexey--1860-s$/.test(title)) return true;
    if (/^jean-baptiste-camille( c1850)?$/.test(title)) return true;
    if (/^ivan 1881$/.test(title)) return true;
    if (/^landscape met dp|^worthington met dp|^jean-fran\u00e7ois met dp/i.test(title)) return true;
    if (/^\-ivan constantinovich aivasovski\- met dp/i.test(title)) return true;

    return false;
  }

  function loadUserHidden() {
    try {
      const stored = JSON.parse(localStorage.getItem(HIDDEN_STORAGE_KEY) || "[]");
      if (!Array.isArray(stored)) return [];
      return stored.filter((entry) => entry && entry.src);
    } catch {
      return [];
    }
  }

  function saveUserHidden(entries) {
    try {
      localStorage.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(entries));
    } catch {
      /* ignore quota errors */
    }
  }

  function rebuildHiddenState() {
    hiddenMeta = new Map();
    hiddenSrcs = new Set();

    loadUserHidden().forEach((entry) => {
      hiddenSrcs.add(entry.src);
      hiddenMeta.set(entry.src, entry);
    });
  }

  async function loadHiddenBlocklist() {
    rebuildHiddenState();

    try {
      const res = await fetch("data/hidden.json");
      if (!res.ok) return;
      const blocklist = await res.json();
      if (!Array.isArray(blocklist)) return;

      blocklist.forEach((entry) => {
        const src = typeof entry === "string" ? entry : entry?.src;
        if (!src || hiddenSrcs.has(src)) return;
        hiddenSrcs.add(src);
        hiddenMeta.set(src, typeof entry === "string" ? { src } : entry);
      });
    } catch {
      /* optional file */
    }
  }

  function isHidden(art) {
    return hiddenSrcs.has(art.src);
  }

  function hideArtwork(art) {
    if (!art?.src || hiddenSrcs.has(art.src)) return;

    hiddenSrcs.add(art.src);
    hiddenMeta.set(art.src, {
      src: art.src,
      title: art.title || "",
      artist: art.artist || "",
      hiddenAt: Date.now(),
    });

    const userHidden = loadUserHidden().filter((entry) => entry.src !== art.src);
    userHidden.push(hiddenMeta.get(art.src));
    saveUserHidden(userHidden);

    if (activeLightboxArt?.src === art.src) {
      closeLightbox();
    }

    updateHiddenUi();
    renderGallery();
  }

  function restoreArtwork(src) {
    saveUserHidden(loadUserHidden().filter((entry) => entry.src !== src));
    loadHiddenBlocklist().then(() => {
      updateHiddenUi();
      renderHiddenPanel();
      renderGallery();
    });
  }

  function restoreAllHidden() {
    saveUserHidden([]);
    loadHiddenBlocklist().then(() => {
      updateHiddenUi();
      renderHiddenPanel();
      renderGallery();
    });
  }

  function getUserHiddenEntries() {
    return loadUserHidden();
  }

  function updateHiddenUi() {
    const userHiddenCount = getUserHiddenEntries().length;
    const visibleCount = artworks.filter((art) => !isHidden(art)).length;

    if (countEl) {
      countEl.textContent = `${visibleCount.toLocaleString()} paintings`;
    }

    if (hiddenToggle && hiddenCountEl) {
      hiddenCountEl.textContent = String(userHiddenCount);
      hiddenToggle.hidden = userHiddenCount === 0;
    }
  }

  function renderHiddenPanel() {
    if (!hiddenList) return;

    hiddenList.innerHTML = "";
    const entries = getUserHiddenEntries().sort((a, b) => (b.hiddenAt || 0) - (a.hiddenAt || 0));

    if (!entries.length) {
      const empty = document.createElement("li");
      empty.className = "hidden-empty";
      empty.textContent = "Nothing hidden yet. Use Hide on any card to remove it from the gallery.";
      hiddenList.appendChild(empty);
      return;
    }

    entries.forEach((entry) => {
      const item = document.createElement("li");
      item.className = "hidden-item";

      const label = document.createElement("div");
      label.className = "hidden-item-label";
      label.innerHTML =
        `<strong>${escapeHtml(entry.title || "Untitled")}</strong>` +
        `<span>${escapeHtml(entry.artist || "Unknown artist")}</span>`;

      const restoreBtn = document.createElement("button");
      restoreBtn.type = "button";
      restoreBtn.className = "hidden-restore";
      restoreBtn.textContent = "Restore";
      restoreBtn.addEventListener("click", () => restoreArtwork(entry.src));

      item.appendChild(label);
      item.appendChild(restoreBtn);
      hiddenList.appendChild(item);
    });
  }

  function openHiddenPanel() {
    if (!hiddenPanel) return;
    renderHiddenPanel();
    hiddenPanel.showModal();
  }

  async function exportHiddenList() {
    const payload = getUserHiddenEntries().map(({ src, title, artist }) => ({ src, title, artist }));

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      if (hiddenExport) {
        const original = hiddenExport.textContent;
        hiddenExport.textContent = "Copied!";
        setTimeout(() => {
          hiddenExport.textContent = original;
        }, 1600);
      }
    } catch {
      if (hiddenExport) {
        hiddenExport.textContent = "Copy failed";
        setTimeout(() => {
          hiddenExport.textContent = "Copy list";
        }, 1600);
      }
    }
  }

  function createHideButton(art) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "card-hide";
    btn.setAttribute("aria-label", `Hide ${art.title}`);
    btn.textContent = "Hide";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      hideArtwork(art);
    });
    return btn;
  }
  function normalizeArtist(artist) {
    const cleaned = (artist || "")
      .toLowerCase()
      .replace(/^(after|follower of|school of|attributed to|circle of|print made by:)\s+/, "")
      .replace(/[^\w\s]/g, " ")
      .trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    return parts[parts.length - 1] || cleaned;
  }

  function normalizeTitle(title) {
    return (title || "")
      .replace(/\([^)]*\)/g, "")
      .replace(/\b(detail|fragment|study|section|panel|interior|exterior|google art project)\b.*/gi, "")
      .replace(/\b\d{2,}\.\d+\b.*/g, "")
      .replace(/[^\w\s]/g, " ")
      .toLowerCase()
      .replace(/\s+\d{1,2}$/, "")
      .trim()
      .replace(/\s+/g, " ");
  }

  function artworkScore(art) {
    let score = 0;
    const blob = `${art.title || ""} ${art.src || ""}`;

    if (art.src.includes("960px-")) score += 30;
    else if (art.src.includes("800px-")) score += 20;
    if (art.professional) score += 5;
    if (art.year) score += 3;
    if (/\b(detail|fragment|section|panel|study|fxd|interior|exterior)\b/i.test(blob)) score -= 40;
    if (/\b0[1-9]\b|\bp[1-9]\b/i.test(blob)) score -= 25;
    if (/google art project|metropolitan museum|detroit institute|yale university|nga\.|ng\.m\./i.test(blob)) {
      score -= 6;
    }
    score -= Math.min(Math.floor((art.title || "").length / 20), 10);

    return score;
  }

  function dedupeArtworks(items) {
    const bySrc = new Map();
    const byWork = new Map();

    items.forEach((art) => {
      if (bySrc.has(art.src)) return;
      bySrc.set(art.src, art);

      const key = `${normalizeArtist(art.artist)}::${normalizeTitle(art.title)}`;
      if (key.length < 12) {
        byWork.set(`${art.src}::${byWork.size}`, art);
        return;
      }

      const existing = byWork.get(key);
      if (!existing || artworkScore(art) > artworkScore(existing)) {
        byWork.set(key, art);
      }
    });

    const seen = new Set();
    const unique = [];

    byWork.forEach((art) => {
      if (seen.has(art.src)) return;
      seen.add(art.src);
      unique.push(art);
    });

    return unique;
  }

  function loadDimensionCache() {
    try {
      return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveDimensionCache() {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(dimensionCache));
    } catch {
      /* ignore quota errors */
    }
  }

  async function loadArtworks() {
    const res = await fetch("data/artworks.json");
    if (!res.ok) throw new Error("Could not load artworks.json");
    const raw = await res.json();
    artworks = dedupeArtworks(raw.filter((art) => !isJunkArtwork(art)));
  }

  function loadImageDimensions(src) {
    if (dimensionCache[src]) {
      return Promise.resolve(dimensionCache[src]);
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        const dims = {
          width: img.naturalWidth || 4,
          height: img.naturalHeight || 3,
        };
        dimensionCache[src] = dims;
        resolve(dims);
      };
      img.onerror = () => {
        const dims = { width: 4, height: 3 };
        dimensionCache[src] = dims;
        resolve(dims);
      };
      img.src = src;
    });
  }

  async function preloadDimensions(items) {
    const pending = items.filter((item) => !dimensionCache[item.src]);
    if (!pending.length) return;

    const concurrency = 32;
    let index = 0;
    let loaded = items.length - pending.length;

    const workers = Array.from({ length: concurrency }, async () => {
      while (index < pending.length) {
        const current = pending[index++];
        await loadImageDimensions(current.src);
        loaded += 1;
        if (loading && loaded % 24 === 0) {
          loading.textContent = `Loading paintings… ${loaded.toLocaleString()} / ${items.length.toLocaleString()}`;
        }
      }
    });

    await Promise.all(workers);
    saveDimensionCache();
  }

  function getStyles() {
    const styles = new Set(artworks.map((a) => a.style).filter(Boolean));
    return ["All", ...Array.from(styles).sort()];
  }

  function filtered() {
    const visible = artworks.filter((art) => !isHidden(art));
    if (activeFilter === "All") return visible;
    return visible.filter((a) => a.style === activeFilter);
  }

  async function setActiveFilter(style) {
    activeFilter = style;
    renderFilters();
    await renderGallery();
  }

  function renderFilters() {
    const styles = getStyles();

    if (filterSelect) {
      filterSelect.innerHTML = "";
      styles.forEach((style) => {
        const option = document.createElement("option");
        option.value = style;
        option.textContent = style;
        option.selected = style === activeFilter;
        filterSelect.appendChild(option);
      });
    }

    filtersEl.innerHTML = "";
    styles.forEach((style) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn" + (style === activeFilter ? " active" : "");
      btn.textContent = style;
      btn.addEventListener("click", () => setActiveFilter(style));
      filtersEl.appendChild(btn);
    });
  }

  function openLightbox(art) {
    activeLightboxArt = art;
    lightboxImg.src = art.src;
    lightboxImg.alt = `${art.title} by ${art.artist}`;
    const year = art.year ? `, ${art.year}` : "";
    lightboxCaption.textContent = `${art.title} — ${art.artist}${year}`;
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
    activeLightboxArt = null;
    lightbox.hidden = true;
    lightboxImg.src = "";
    document.body.style.overflow = "";
  }

  async function renderGallery() {
    gallery.innerHTML = "";
    gallery.classList.add("gallery-loading");

    const items = filtered();
    loading.classList.remove("hidden");
    loading.textContent = `Loading paintings… 0 / ${items.length.toLocaleString()}`;

    await preloadDimensions(items);

    loading.classList.add("hidden");
    gallery.classList.remove("gallery-loading");

    const fragment = document.createDocumentFragment();

    items.forEach((art) => {
      const dims = dimensionCache[art.src] || { width: 4, height: 3 };

      const card = document.createElement("article");
      card.className = "card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${art.title} by ${art.artist}`);

      const media = document.createElement("div");
      media.className = "card-media";
      media.style.aspectRatio = `${dims.width} / ${dims.height}`;

      const img = document.createElement("img");
      img.src = art.src;
      img.alt = `${art.title} by ${art.artist}`;
      img.loading = "lazy";
      img.decoding = "async";
      img.width = dims.width;
      img.height = dims.height;

      const overlay = document.createElement("div");
      overlay.className = "card-overlay";
      overlay.innerHTML =
        `<p class="card-title">${escapeHtml(art.title)}</p>` +
        `<p class="card-meta">${escapeHtml(art.artist)}${art.year ? ", " + art.year : ""}${art.style ? " · " + escapeHtml(art.style) : ""}</p>`;

      media.appendChild(img);
      card.appendChild(media);
      card.appendChild(overlay);
      card.appendChild(createHideButton(art));

      card.addEventListener("click", () => openLightbox(art));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(art);
        }
      });

      fragment.appendChild(card);
    });

    gallery.appendChild(fragment);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  lightboxClose.addEventListener("click", closeLightbox);
  if (lightboxHide) {
    lightboxHide.addEventListener("click", () => {
      if (activeLightboxArt) hideArtwork(activeLightboxArt);
    });
  }
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
  });

  if (hiddenToggle) {
    hiddenToggle.addEventListener("click", openHiddenPanel);
  }
  if (hiddenPanelClose) {
    hiddenPanelClose.addEventListener("click", () => hiddenPanel?.close());
  }
  if (hiddenExport) {
    hiddenExport.addEventListener("click", exportHiddenList);
  }
  if (hiddenClear) {
    hiddenClear.addEventListener("click", restoreAllHidden);
  }
  if (hiddenPanel) {
    hiddenPanel.addEventListener("click", (e) => {
      if (e.target === hiddenPanel) hiddenPanel.close();
    });
  }

  if (filterSelect) {
    filterSelect.addEventListener("change", () => {
      setActiveFilter(filterSelect.value);
    });
  }

  loadHiddenBlocklist()
    .then(() => loadArtworks())
    .then(async () => {
      updateHiddenUi();
      renderFilters();
      await renderGallery();
    })
    .catch((err) => {
      loading.textContent = "Failed to load gallery. Check data/artworks.json.";
      console.error(err);
    });
})();
