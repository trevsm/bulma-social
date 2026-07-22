(function () {
  const gallery = document.getElementById("gallery");
  const loading = document.getElementById("loading");
  const filtersEl = document.getElementById("filters");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const lightboxClose = document.getElementById("lightbox-close");
  const countEl = document.getElementById("count");

  const CACHE_KEY = "artwork-dimensions-v1";
  let artworks = [];
  let activeFilter = "All";
  let dimensionCache = loadDimensionCache();

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
    artworks = await res.json();
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
    if (activeFilter === "All") return artworks;
    return artworks.filter((a) => a.style === activeFilter);
  }

  function renderFilters() {
    filtersEl.innerHTML = "";
    getStyles().forEach((style) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn" + (style === activeFilter ? " active" : "");
      btn.textContent = style;
      btn.addEventListener("click", async () => {
        activeFilter = style;
        renderFilters();
        await renderGallery();
      });
      filtersEl.appendChild(btn);
    });
  }

  function openLightbox(art) {
    lightboxImg.src = art.src;
    lightboxImg.alt = `${art.title} by ${art.artist}`;
    const year = art.year ? `, ${art.year}` : "";
    lightboxCaption.textContent = `${art.title} — ${art.artist}${year}`;
    lightbox.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeLightbox() {
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
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !lightbox.hidden) closeLightbox();
  });

  loadArtworks()
    .then(async () => {
      if (countEl) {
        countEl.textContent = `${artworks.length.toLocaleString()} paintings`;
      }
      renderFilters();
      await renderGallery();
    })
    .catch((err) => {
      loading.textContent = "Failed to load gallery. Check data/artworks.json.";
      console.error(err);
    });
})();
