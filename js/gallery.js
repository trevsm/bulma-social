(function () {
  const gallery = document.getElementById("gallery");
  const loading = document.getElementById("loading");
  const filtersEl = document.getElementById("filters");
  const lightbox = document.getElementById("lightbox");
  const lightboxImg = document.getElementById("lightbox-img");
  const lightboxCaption = document.getElementById("lightbox-caption");
  const lightboxClose = document.getElementById("lightbox-close");

  let artworks = [];
  let activeFilter = "All";

  async function loadArtworks() {
    const res = await fetch("data/artworks.json");
    if (!res.ok) throw new Error("Could not load artworks.json");
    artworks = await res.json();
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
      btn.addEventListener("click", () => {
        activeFilter = style;
        renderFilters();
        renderGallery();
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

  function renderGallery() {
    gallery.innerHTML = "";
    const items = filtered();

    items.forEach((art) => {
      const card = document.createElement("article");
      card.className = "card";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${art.title} by ${art.artist}`);

      const img = document.createElement("img");
      img.src = art.src;
      img.alt = `${art.title} by ${art.artist}`;
      img.loading = "lazy";
      img.decoding = "async";

      if (art.professional) {
        const chip = document.createElement("span");
        chip.className = "chip pro";
        chip.textContent = "Professional";
        card.appendChild(chip);
      }

      const overlay = document.createElement("div");
      overlay.className = "card-overlay";
      overlay.innerHTML =
        `<p class="card-title">${escapeHtml(art.title)}</p>` +
        `<p class="card-meta">${escapeHtml(art.artist)}${art.year ? ", " + art.year : ""}${art.style ? " · " + escapeHtml(art.style) : ""}</p>`;

      card.appendChild(img);
      card.appendChild(overlay);

      card.addEventListener("click", () => openLightbox(art));
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openLightbox(art);
        }
      });

      gallery.appendChild(card);
    });
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
    .then(() => {
      loading.classList.add("hidden");
      renderFilters();
      renderGallery();
    })
    .catch((err) => {
      loading.textContent = "Failed to load gallery. Check data/artworks.json.";
      console.error(err);
    });
})();
