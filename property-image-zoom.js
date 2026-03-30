(function () {
  const STYLE_ID = "property-image-zoom-styles";

  const buildFallback = (label) =>
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
        <defs>
          <linearGradient id="pizGradient" x1="0" x2="1">
            <stop offset="0%" stop-color="#eef4ff" />
            <stop offset="100%" stop-color="#edf9f6" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#pizGradient)" />
        <text x="50%" y="48%" text-anchor="middle" font-size="46" fill="#1e3a8a" font-family="Inter, Arial, sans-serif">KD Conciergerie</text>
        <text x="50%" y="56%" text-anchor="middle" font-size="28" fill="#0f766e" font-family="Inter, Arial, sans-serif">${label || "Image indisponible"}</text>
      </svg>
    `)}`;

  class PropertyImageZoom {
    static modal = null;
    static images = [];
    static index = 0;
    static title = "";
    static subtitle = "";
    static fallback = buildFallback();

    static ensureStyles() {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        /* Le conteneur est monté sur <html>, pas sur <body> : un body avec transform
           (ex. page-ready) crée un bloc de conteneur et casse position:fixed → modal décalé / coupé */
        .pizoom {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          box-sizing: border-box;
          min-height: 100vh;
          min-height: 100dvh;
          min-height: -webkit-fill-available;
          display: none;
          align-items: center;
          justify-content: center;
          padding: max(12px, env(safe-area-inset-top, 0px)) 20px max(12px, env(safe-area-inset-bottom, 0px)) 20px;
          background: rgba(15, 23, 42, 0.42);
          backdrop-filter: blur(14px) saturate(1.15);
          -webkit-backdrop-filter: blur(14px) saturate(1.15);
          z-index: 100000;
        }

        .pizoom.is-open {
          display: flex;
          /* La page peut défiler derrière ; seule la boîte du zoom capture les interactions */
          pointer-events: none;
        }

        .pizoom__dialog {
          width: min(92vw, 1040px);
          max-height: min(calc(100dvh - 28px), calc(100vh - 28px), 900px);
          margin: auto;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          background: rgba(255, 255, 255, 0.07);
          border: 1px solid rgba(255, 255, 255, 0.22);
          border-radius: 26px;
          overflow: hidden;
          box-shadow: 0 24px 56px rgba(0, 0, 0, 0.22);
          backdrop-filter: blur(22px) saturate(1.2);
          -webkit-backdrop-filter: blur(22px) saturate(1.2);
          flex-shrink: 0;
          pointer-events: auto;
        }

        .pizoom__head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          min-height: 64px;
          padding: 0 18px;
          background: rgba(15, 23, 42, 0.28);
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        }

        .pizoom__copy {
          min-width: 0;
          display: grid;
          gap: 2px;
        }

        .pizoom__title {
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #f8fafc;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pizoom__subtitle {
          color: rgba(226, 232, 240, 0.92);
          font-size: 0.84rem;
          font-weight: 600;
          line-height: 1.4;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .pizoom__close {
          width: 42px;
          height: 42px;
          flex: 0 0 42px;
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.12);
          color: #f8fafc;
          cursor: pointer;
          transition: transform 0.22s ease, border-color 0.22s ease, background 0.22s ease;
        }

        .pizoom__close:hover {
          transform: translateY(-1px);
          background: rgba(255, 255, 255, 0.22);
          border-color: rgba(255, 255, 255, 0.4);
        }

        .pizoom__stage {
          position: relative;
          min-height: 0;
          max-height: min(56vh, 640px);
          height: min(50vh, 600px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px 76px;
          background: transparent;
        }

        .pizoom__image {
          display: block;
          max-width: 100%;
          max-height: 100%;
          width: auto;
          height: auto;
          margin: 0 auto;
          object-fit: contain;
          object-position: center;
        }

        .pizoom__nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 54px;
          height: 54px;
          border: 1px solid rgba(15, 23, 42, 0.08);
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.78);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          box-shadow: 0 16px 30px rgba(15, 23, 42, 0.2);
          transition: transform 0.22s ease, background 0.22s ease;
          font-size: 1.2rem;
          font-weight: 700;
        }

        .pizoom__nav:hover {
          transform: translateY(-50%) scale(1.03);
          background: rgba(15, 23, 42, 0.92);
        }

        .pizoom__nav--prev {
          left: 18px;
        }

        .pizoom__nav--next {
          right: 18px;
        }

        .pizoom__counter {
          position: absolute;
          right: 18px;
          bottom: 18px;
          min-height: 32px;
          padding: 0 12px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.68);
          color: #fff;
          display: inline-flex;
          align-items: center;
          font-size: 0.8rem;
          font-weight: 600;
        }

        @media (max-width: 980px) {
          .pizoom {
            padding: max(10px, env(safe-area-inset-top, 0px)) 16px max(10px, env(safe-area-inset-bottom, 0px)) 16px;
          }

          .pizoom__dialog {
            width: min(94vw, 860px);
            max-height: min(calc(100dvh - 24px), calc(100vh - 24px), 860px);
          }

          .pizoom__stage {
            max-height: min(50vh, 520px);
            height: min(44vh, 480px);
            padding: 16px 56px;
          }
        }

        @media (max-width: 720px) {
          .pizoom {
            padding: max(8px, env(safe-area-inset-top, 0px)) 12px max(8px, env(safe-area-inset-bottom, 0px)) 12px;
          }

          .pizoom__dialog {
            width: min(96vw, 560px);
            border-radius: 22px;
            max-height: min(calc(100dvh - 20px), calc(100vh - 20px), 720px);
          }

          .pizoom__stage {
            max-height: min(42vh, 420px);
            height: min(38vh, 380px);
            padding: 14px 44px;
          }

          .pizoom__nav {
            width: 46px;
            height: 46px;
          }

          .pizoom__nav--prev {
            left: 12px;
          }

          .pizoom__nav--next {
            right: 12px;
          }
        }
      `;
      document.head.appendChild(style);
    }

    static ensureModal() {
      if (this.modal) return;
      const root = document.createElement("div");
      root.className = "pizoom";
      root.setAttribute("aria-hidden", "true");
      root.innerHTML = `
        <div class="pizoom__dialog" role="dialog" aria-modal="true" aria-label="Zoom photo">
          <div class="pizoom__head">
            <div class="pizoom__copy">
              <strong class="pizoom__title"></strong>
              <span class="pizoom__subtitle"></span>
            </div>
            <button class="pizoom__close" type="button" aria-label="Fermer le zoom">✕</button>
          </div>
          <div class="pizoom__stage">
            <button class="pizoom__nav pizoom__nav--prev" type="button" aria-label="Image précédente">←</button>
            <img class="pizoom__image" alt="Photo agrandie" />
            <button class="pizoom__nav pizoom__nav--next" type="button" aria-label="Image suivante">→</button>
            <div class="pizoom__counter"></div>
          </div>
        </div>
      `;
      document.documentElement.appendChild(root);

      this.modal = {
        root,
        title: root.querySelector(".pizoom__title"),
        subtitle: root.querySelector(".pizoom__subtitle"),
        image: root.querySelector(".pizoom__image"),
        close: root.querySelector(".pizoom__close"),
        prev: root.querySelector(".pizoom__nav--prev"),
        next: root.querySelector(".pizoom__nav--next"),
        counter: root.querySelector(".pizoom__counter")
      };

      this.modal.close.addEventListener("click", () => this.close());
      this.modal.prev.addEventListener("click", () => this.move(-1));
      this.modal.next.addEventListener("click", () => this.move(1));
      this.modal.image.addEventListener("error", () => {
        this.modal.image.src = this.fallback;
      });
      document.addEventListener("keydown", (event) => {
        if (!this.modal?.root.classList.contains("is-open")) return;
        if (event.key === "Escape") this.close();
        if (event.key === "ArrowLeft") this.move(-1);
        if (event.key === "ArrowRight") this.move(1);
      });
    }

    static render() {
      if (!this.modal || !this.images.length) return;
      const safeIndex = (this.index + this.images.length) % this.images.length;
      this.index = safeIndex;
      this.modal.title.textContent = this.title || "Zoom photo";
      this.modal.subtitle.textContent = this.subtitle || "Photos du bien";
      this.modal.image.src = this.images[safeIndex] || this.fallback;
      this.modal.image.alt = `${this.title || "Annonce"} photo ${safeIndex + 1}`;
      this.modal.counter.textContent = `${safeIndex + 1} / ${this.images.length}`;
      const navDisplay = this.images.length > 1 ? "inline-flex" : "none";
      this.modal.prev.style.display = navDisplay;
      this.modal.next.style.display = navDisplay;
    }

    static open(options = {}) {
      this.ensureStyles();
      this.ensureModal();
      const images = Array.isArray(options.images) ? options.images.filter(Boolean) : [];
      this.fallback = options.placeholder || buildFallback();
      this.images = images.length ? images : [this.fallback];
      this.index = Number.isInteger(options.startIndex) ? options.startIndex : 0;
      this.title = options.title || "Galerie photo";
      this.subtitle = options.subtitle || "";
      this.modal.root.classList.add("is-open");
      this.modal.root.setAttribute("aria-hidden", "false");
      this.render();
    }

    static move(step) {
      if (!this.images.length) return;
      this.index += step;
      this.render();
    }

    static close() {
      if (!this.modal) return;
      this.modal.root.classList.remove("is-open");
      this.modal.root.setAttribute("aria-hidden", "true");
    }
  }

  window.PropertyImageZoom = {
    open(options) {
      PropertyImageZoom.open(options);
    },
    close() {
      PropertyImageZoom.close();
    }
  };
})();
