(function () {
  const STYLE_ID = "kd-offer-share-styles";

  const getListingAbsoluteUrl = (listingId) => {
    const path = `location-detail.html?id=${encodeURIComponent(listingId)}`;
    try {
      return new URL(path, window.location.href).href;
    } catch {
      return path;
    }
  };

  const getShareButtonIcon = () => `
    <svg viewBox="0 0 24 24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
      <path
        fill="currentColor"
        d="M12 2.5a1 1 0 0 1 1 1v8.17l2.8-2.79a1 1 0 1 1 1.4 1.41l-4.5 4.5a1 1 0 0 1-1.4 0l-4.5-4.5a1 1 0 1 1 1.4-1.41l2.8 2.79V3.5a1 1 0 0 1 1-1Z"
      />
      <path
        fill="currentColor"
        d="M5.5 9.5a1 1 0 0 1 1 1V19h11v-8.5a1 1 0 1 1 2 0v8.75A1.75 1.75 0 0 1 17.75 21h-11.5A1.75 1.75 0 0 1 4.5 19.25V10.5a1 1 0 0 1 1-1Z"
      />
    </svg>
  `;

  const injectStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .share-sheet-root {
        position: fixed;
        inset: 0;
        z-index: 200000;
        display: none;
        align-items: flex-end;
        justify-content: center;
        padding: max(16px, env(safe-area-inset-bottom, 0px)) 16px 24px;
        background: rgba(15, 23, 42, 0.48);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      .share-sheet-root.is-open { display: flex; }
      .share-sheet {
        position: relative;
        width: min(100%, 420px);
        max-height: min(78vh, 560px);
        overflow-y: auto;
        border-radius: 22px;
        background: #fff;
        border: 1px solid rgba(226, 232, 240, 0.96);
        padding: 22px 18px 18px;
        box-shadow: 0 24px 48px rgba(15, 23, 42, 0.2);
        font-family: Inter, Arial, sans-serif;
      }
      .share-sheet__dismiss {
        position: absolute;
        top: 12px;
        right: 12px;
        width: 38px;
        height: 38px;
        border-radius: 12px;
        border: 1px solid rgba(226, 232, 240, 0.96);
        background: #fff;
        font-size: 1.1rem;
        line-height: 1;
        cursor: pointer;
        color: #475569;
      }
      .share-sheet__dismiss:hover { background: #f8fafc; }
      .share-sheet__title {
        font-size: 1.18rem;
        font-weight: 700;
        color: #0f172a;
        margin: 0 48px 8px 0;
        letter-spacing: -0.02em;
        line-height: 1.25;
      }
      .share-sheet__hint {
        margin: 0 0 18px;
        font-size: 0.95rem;
        color: #617084;
        line-height: 1.55;
      }
      .share-sheet__actions { display: grid; gap: 10px; }
      .share-sheet__btn {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 12px;
        width: 100%;
        min-height: 50px;
        padding: 0 16px;
        border-radius: 14px;
        border: 1px solid rgba(226, 232, 240, 0.96);
        background: #fff;
        font: inherit;
        font-size: 1rem;
        font-weight: 600;
        color: #1e293b;
        cursor: pointer;
        text-align: left;
        transition: background 0.2s ease, border-color 0.2s ease;
      }
      .share-sheet__btn:hover {
        background: #f8fafc;
        border-color: rgba(30, 64, 175, 0.2);
      }
      .share-sheet__btn--primary {
        background: #142c66;
        color: #fff;
        border-color: #142c66;
      }
      .share-sheet__btn--primary:hover {
        background: #1a3a8b;
        border-color: #1a3a8b;
      }
      a.share-sheet__btn { text-decoration: none; }
    `;
    document.head.appendChild(style);
  };

  let root = null;
  let state = { id: null, title: "", onFeedback: null };

  const close = () => {
    if (!root) return;
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    state = { id: null, title: "", onFeedback: state.onFeedback };
  };

  const feedback = (msg) => {
    if (typeof state.onFeedback === "function") state.onFeedback(msg);
  };

  const ensureRoot = () => {
    if (root) return root;
    injectStyles();
    const el = document.createElement("div");
    el.className = "share-sheet-root";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `
      <div class="share-sheet" role="dialog" aria-modal="true" aria-labelledby="kdOfferShareTitle">
        <button type="button" class="share-sheet__dismiss" aria-label="Fermer">✕</button>
        <p class="share-sheet__title" id="kdOfferShareTitle">Partager</p>
        <p class="share-sheet__hint" id="kdOfferShareHint"></p>
        <div class="share-sheet__actions">
          <button type="button" class="share-sheet__btn share-sheet__btn--primary" id="kdOfferShareNative" hidden>Partager maintenant</button>
          <button type="button" class="share-sheet__btn" id="kdOfferShareCopy">Copier le lien</button>
          <a class="share-sheet__btn" id="kdOfferShareWa" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a class="share-sheet__btn" id="kdOfferShareFb" target="_blank" rel="noopener noreferrer">Facebook</a>
          <a class="share-sheet__btn" id="kdOfferShareTw" target="_blank" rel="noopener noreferrer">X</a>
          <a class="share-sheet__btn" id="kdOfferShareLi" target="_blank" rel="noopener noreferrer">LinkedIn</a>
          <a class="share-sheet__btn" id="kdOfferShareMail">E-mail</a>
        </div>
      </div>
    `;
    document.documentElement.appendChild(el);

    el.addEventListener("click", (e) => {
      if (e.target === el) close();
    });
    el.querySelector(".share-sheet__dismiss").addEventListener("click", close);
    el.querySelector("#kdOfferShareCopy").addEventListener("click", async () => {
      if (!state.id) return;
      const url = getListingAbsoluteUrl(state.id);
      try {
        await navigator.clipboard.writeText(url);
        feedback("Lien copié");
        close();
      } catch {
        feedback("Copie impossible");
      }
    });
    el.querySelector("#kdOfferShareNative").addEventListener("click", async () => {
      if (!state.id) return;
      const url = getListingAbsoluteUrl(state.id);
      const title = state.title || "Annonce KD Conciergerie";
      const text = `Découvrez cette location : ${title}`;
      try {
        await navigator.share({ title, text, url });
        close();
      } catch (err) {
        if (err && err.name !== "AbortError") feedback("Partage indisponible");
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && root?.classList.contains("is-open")) close();
    });

    el.querySelectorAll(".share-sheet__actions a").forEach((anchor) => {
      anchor.addEventListener("click", () => window.setTimeout(close, 350));
    });

    root = el;
    return root;
  };

  const open = ({ id, title, onFeedback } = {}) => {
    if (!id) return;
    state = { id, title: title || "", onFeedback: typeof onFeedback === "function" ? onFeedback : null };
    const el = ensureRoot();
    const url = getListingAbsoluteUrl(id);
    const t = state.title || "Annonce KD Conciergerie";
    const text = `Découvrez cette location : ${t}`;

    el.querySelector("#kdOfferShareHint").textContent = `Annonce : ${t}`;
    el.querySelector("#kdOfferShareNative").hidden = typeof navigator.share !== "function";
    el.querySelector("#kdOfferShareWa").href = `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`;
    el.querySelector("#kdOfferShareFb").href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    el.querySelector("#kdOfferShareTw").href = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    el.querySelector("#kdOfferShareLi").href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
    el.querySelector("#kdOfferShareMail").href = `mailto:?subject=${encodeURIComponent(t)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`;

    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
  };

  window.KDOfferShare = { open, close, getShareButtonIcon };
})();
