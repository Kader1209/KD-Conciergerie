(function () {
  const STYLE_ID = "property-image-gallery-styles";

  const buildPlaceholder = (label) =>
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
        <defs>
          <linearGradient id="pigGradient" x1="0" x2="1">
            <stop offset="0%" stop-color="#eef4ff" />
            <stop offset="100%" stop-color="#edf9f6" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#pigGradient)" />
        <text x="50%" y="48%" text-anchor="middle" font-size="46" fill="#1e3a8a" font-family="Inter, Arial, sans-serif">KD Conciergerie</text>
        <text x="50%" y="56%" text-anchor="middle" font-size="28" fill="#0f766e" font-family="Inter, Arial, sans-serif">${label || "Image indisponible"}</text>
      </svg>
    `)}`;

  class PropertyImageGallery {
    static ensureStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        .pigallery {
          width: 100%;
        }

        .pigallery--cover {
          height: 100%;
        }

        .pigallery__grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 12px;
          width: 100%;
        }

        .pigallery--cover .pigallery__grid {
          grid-template-columns: 1fr;
          gap: 0;
          height: 100%;
        }

        .pigallery__tile {
          position: relative;
          display: block;
          width: 100%;
          aspect-ratio: 1 / 1;
          overflow: hidden;
          border: 0;
          padding: 0;
          border-radius: 18px;
          background: linear-gradient(135deg, #eef5ff, #f8fbff);
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
          transition: transform 0.24s ease, box-shadow 0.24s ease;
        }

        .pigallery__tile:hover {
          transform: translateY(-2px);
          box-shadow: 0 16px 28px rgba(15, 23, 42, 0.1);
        }

        .pigallery--cover .pigallery__tile {
          height: 100%;
          min-height: 100%;
          border-radius: 16px;
          box-shadow: none;
        }

        .pigallery--cover .pigallery__tile:hover {
          transform: none;
        }

        .pigallery--preview-only .pigallery__tile {
          cursor: default;
          pointer-events: none;
        }

        .pigallery--preview-only .pigallery__tile:hover {
          transform: none;
          box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
        }

        .pigallery--preview-only .pigallery__image {
          transition: none;
        }

        .pigallery--preview-only .pigallery__tile:hover .pigallery__image {
          transform: none;
        }

        .pigallery__image {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          transform: scale(1);
          transition: transform 0.32s ease;
          background: linear-gradient(135deg, #eef5ff, #f8fbff);
        }

        .pigallery__tile:hover .pigallery__image {
          transform: scale(1.03);
        }

        .pigallery__badge {
          position: absolute;
          right: 12px;
          bottom: 12px;
          min-height: 30px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.64);
          color: #fff;
          display: inline-flex;
          align-items: center;
          font-size: 0.76rem;
          font-weight: 600;
          backdrop-filter: blur(8px);
        }

        @media (max-width: 980px) {
          .pigallery__grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .pigallery--cover .pigallery__grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .pigallery__grid {
            grid-template-columns: 1fr;
          }

          .pigallery--cover .pigallery__grid {
            grid-template-columns: 1fr;
          }
        }
      `;
      document.head.appendChild(style);
    }

    constructor(target, options = {}) {
      PropertyImageGallery.ensureStyles();
      this.target = target;
      this.variant = options.variant === "cover" ? "cover" : "grid";
      this.title = options.title || "Galerie photo";
      this.subtitle = options.subtitle || "";
      this.onOpen = typeof options.onOpen === "function" ? options.onOpen : null;
      this.enableZoom = options.enableZoom !== false;
      this.placeholder = options.placeholder || buildPlaceholder();
      const rawImages = Array.isArray(options.images) ? options.images.filter(Boolean) : [];
      this.images = rawImages.length ? rawImages : [this.placeholder];
      this.render();
    }

    createTile(src, index) {
      const tile = document.createElement(this.enableZoom ? "button" : "div");
      if (this.enableZoom) {
        tile.type = "button";
        tile.setAttribute("aria-label", `Ouvrir la photo ${index + 1}`);
      }
      tile.className = "pigallery__tile";

      const image = document.createElement("img");
      image.className = "pigallery__image";
      image.src = src || this.placeholder;
      image.alt = `${this.title} photo ${index + 1}`;
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => {
        image.src = this.placeholder;
      });

      if (this.enableZoom) {
        tile.addEventListener("click", () => {
          if (this.onOpen) this.onOpen(index);
          if (window.PropertyImageZoom && typeof window.PropertyImageZoom.open === "function") {
            window.PropertyImageZoom.open({
              images: this.images,
              title: this.title,
              subtitle: this.subtitle,
              placeholder: this.placeholder,
              startIndex: index
            });
          }
        });
      }

      tile.appendChild(image);
      return tile;
    }

    render() {
      this.target.innerHTML = "";
      const root = document.createElement("div");
      root.className = `pigallery pigallery--${this.variant}${this.enableZoom ? "" : " pigallery--preview-only"}`;

      const grid = document.createElement("div");
      grid.className = "pigallery__grid";

      const visibleImages = this.variant === "cover" ? [this.images[0]] : this.images;
      visibleImages.forEach((src, index) => {
        const tile = this.createTile(src, index);
        if (this.variant === "cover" && this.images.length > 1) {
          const badge = document.createElement("span");
          badge.className = "pigallery__badge";
          badge.textContent = `${this.images.length} photos`;
          tile.appendChild(badge);
        }
        grid.appendChild(tile);
      });

      root.appendChild(grid);
      this.target.appendChild(root);
    }
  }

  window.PropertyImageGallery = {
    mount(target, options) {
      if (!target) return null;
      return new PropertyImageGallery(target, options);
    }
  };
})();
