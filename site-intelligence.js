(function () {
  const STORAGE_KEYS = {
    favorites: "kd-favorites-v2",
    interactions: "kd-interactions-v2",
    searches: "kd-searches-v2",
    customBookmarks: "kd-custom-bookmarks-v1"
  };

  const safeParse = (value, fallback) => {
    try {
      const parsed = JSON.parse(value);
      return parsed ?? fallback;
    } catch (error) {
      return fallback;
    }
  };

  const readStorage = (key, fallback) => safeParse(window.localStorage.getItem(key), fallback);
  const writeStorage = (key, value) => window.localStorage.setItem(key, JSON.stringify(value));

  const normalizeText = (value) =>
    String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const titleCase = (value) =>
    String(value || "")
      .split(/[\s-]+/)
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1).toLowerCase())
      .join(" ");

  const inferType = (listing) => {
    const rawType = normalizeText(listing.type || listing.propertyType || "");
    const haystack = normalizeText([listing.title, listing.description, listing.shortDescription, listing.fullDescription].join(" "));
    if (rawType.includes("maison") || haystack.includes("maison")) return "Maison";
    if (rawType.includes("villa") || haystack.includes("villa")) return "Villa";
    if (rawType.includes("studio") || haystack.includes("studio")) return "Studio";
    if (rawType.includes("appartement") || rawType.includes("rental") || haystack.includes("appartement")) return "Appartement";
    return "Appartement";
  };

  const EQUIPMENT_RULES = [
    { key: "wifi", label: "WiFi", aliases: ["wifi", "wi-fi", "internet"] },
    { key: "parking", label: "Parking", aliases: ["parking", "stationnement", "garage"] },
    { key: "climatisation", label: "Climatisation", aliases: ["climatisation", "climatise", "air conditionne"] },
    { key: "terrasse", label: "Terrasse", aliases: ["terrasse", "balcon", "exterieur"] },
    { key: "tv", label: "TV", aliases: ["tv", "television"] },
    { key: "linge", label: "Linge fourni", aliases: ["linge", "draps", "serviettes"] }
  ];

  const inferEquipments = (listing) => {
    const explicit = Array.isArray(listing.equipments) ? listing.equipments.map((item) => String(item).trim()).filter(Boolean) : [];
    const haystack = normalizeText([
      ...explicit,
      listing.description,
      listing.shortDescription,
      listing.fullDescription,
      listing.teaser
    ].join(" "));

    const inferred = EQUIPMENT_RULES.filter((rule) => rule.aliases.some((alias) => haystack.includes(alias))).map((rule) => rule.label);
    return [...new Set([...explicit, ...inferred])];
  };

  const inferLocation = (listing) => String(listing.location || "Port-de-Bouc").trim();

  const inferPriceValue = (listing) => {
    if (typeof listing.priceValue === "number" && Number.isFinite(listing.priceValue)) return listing.priceValue;
    if (typeof listing.price === "number" && Number.isFinite(listing.price)) return listing.price;
    const match = String(listing.price || "").match(/(\d+[.,]?\d*)/);
    if (!match) return null;
    const numeric = Number(match[1].replace(",", "."));
    return Number.isFinite(numeric) ? numeric : null;
  };

  const enrichListing = (listing) => {
    const equipments = inferEquipments(listing);
    const type = inferType(listing);
    const location = inferLocation(listing);
    const priceValue = inferPriceValue(listing);
    return {
      ...listing,
      type,
      location,
      equipments,
      equipmentKeys: equipments.map((item) => normalizeText(item)),
      priceValue
    };
  };

  const getFavorites = () => new Set(readStorage(STORAGE_KEYS.favorites, []));
  const saveFavorites = (favoritesSet) => writeStorage(STORAGE_KEYS.favorites, [...favoritesSet]);

  const getCustomBookmarks = () => {
    const raw = readStorage(STORAGE_KEYS.customBookmarks, []);
    return Array.isArray(raw) ? raw : [];
  };

  const saveCustomBookmarks = (items) => writeStorage(STORAGE_KEYS.customBookmarks, items);

  const addCustomBookmark = (title) => {
    const label = String(title || "").trim();
    if (!label) return { bookmarks: getCustomBookmarks(), ok: false };
    const bookmarks = getCustomBookmarks();
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `bm-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    bookmarks.unshift({ id, title: label, createdAt: Date.now() });
    saveCustomBookmarks(bookmarks.slice(0, 40));
    return { bookmarks: getCustomBookmarks(), ok: true, id };
  };

  const removeCustomBookmark = (bookmarkId) => {
    const bookmarks = getCustomBookmarks().filter((item) => item.id !== bookmarkId);
    saveCustomBookmarks(bookmarks);
    return bookmarks;
  };

  const getInteractions = () =>
    readStorage(STORAGE_KEYS.interactions, {
      listings: {},
      counters: {
        favoriteAdds: 0,
        cardClicks: 0,
        views: 0
      }
    });

  const saveInteractions = (state) => writeStorage(STORAGE_KEYS.interactions, state);
  const getSearchHistory = () => readStorage(STORAGE_KEYS.searches, []);

  const trackSearch = (query) => {
    const normalized = String(query || "").trim();
    if (!normalized) return;
    const history = getSearchHistory().filter((item) => item !== normalized);
    history.unshift(normalized);
    writeStorage(STORAGE_KEYS.searches, history.slice(0, 8));
  };

  const ensureListingStats = (state, listingId) => {
    if (!state.listings[listingId]) {
      state.listings[listingId] = {
        views: 0,
        cardClicks: 0,
        favoriteAdds: 0,
        lastViewedAt: null,
        lastClickedAt: null
      };
    }
    return state.listings[listingId];
  };

  const trackListingEvent = (listingId, eventName) => {
    if (!listingId) return getInteractions();
    const state = getInteractions();
    const entry = ensureListingStats(state, listingId);
    const now = new Date().toISOString();

    if (eventName === "view") {
      entry.views += 1;
      entry.lastViewedAt = now;
      state.counters.views += 1;
    }

    if (eventName === "cardClick") {
      entry.cardClicks += 1;
      entry.lastClickedAt = now;
      state.counters.cardClicks += 1;
    }

    if (eventName === "favoriteAdd") {
      entry.favoriteAdds += 1;
      state.counters.favoriteAdds += 1;
    }

    saveInteractions(state);
    return state;
  };

  const toggleFavorite = (listingId) => {
    const favorites = getFavorites();
    const isActive = favorites.has(listingId);
    if (isActive) {
      favorites.delete(listingId);
    } else {
      favorites.add(listingId);
      trackListingEvent(listingId, "favoriteAdd");
    }
    saveFavorites(favorites);
    return { favorites, isFavorite: favorites.has(listingId) };
  };

  const getSuggestions = (listings, query) => {
    const normalized = normalizeText(query);
    const history = getSearchHistory();
    const tokens = new Set(history);
    listings.forEach((listing) => {
      const enriched = enrichListing(listing);
      [enriched.title, enriched.location, enriched.type, ...enriched.equipments].forEach((value) => {
        if (value) tokens.add(String(value));
      });
    });

    return [...tokens]
      .filter(Boolean)
      .filter((item) => !normalized || normalizeText(item).includes(normalized))
      .slice(0, 8);
  };

  const filterListings = (listings, filters) => {
    const query = normalizeText(filters.query || "");
    const locations = (filters.locations || []).map(normalizeText);
    const types = (filters.types || []).map(normalizeText);
    const equipments = (filters.equipments || []).map(normalizeText);
    const minPrice = Number(filters.minPrice || 0) || 0;
    const maxPrice = Number(filters.maxPrice || 0) || 0;

    return listings.filter((rawListing) => {
      const listing = enrichListing(rawListing);
      const haystack = normalizeText([
        listing.title,
        listing.location,
        listing.type,
        listing.description,
        listing.shortDescription,
        listing.fullDescription,
        listing.teaser,
        ...listing.equipments
      ].join(" "));

      if (query && !haystack.includes(query)) return false;
      if (locations.length && !locations.includes(normalizeText(listing.location))) return false;
      if (types.length && !types.includes(normalizeText(listing.type))) return false;
      if (equipments.length && !equipments.every((equipment) => listing.equipmentKeys.includes(equipment))) return false;
      if (minPrice && (listing.priceValue === null || listing.priceValue < minPrice)) return false;
      if (maxPrice && listing.priceValue !== null && listing.priceValue > maxPrice) return false;
      return true;
    });
  };

  const getAvailableFilters = (listings) => {
    const enriched = listings.map(enrichListing);
    return {
      locations: [...new Set(enriched.map((listing) => listing.location).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
      types: [...new Set(enriched.map((listing) => listing.type).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
      equipments: [...new Set(enriched.flatMap((listing) => listing.equipments || []).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr")),
      prices: enriched.map((listing) => listing.priceValue).filter((value) => typeof value === "number")
    };
  };

  const computeRecommendationScore = (target, candidate, interactions, favorites) => {
    if (!candidate || !target || candidate.id === target.id) return -1;

    const targetListing = enrichListing(target);
    const candidateListing = enrichListing(candidate);
    const candidateStats = interactions.listings[candidateListing.id] || {};

    let score = 0;
    if (normalizeText(targetListing.location) === normalizeText(candidateListing.location)) score += 4;
    if (normalizeText(targetListing.type) === normalizeText(candidateListing.type)) score += 3;

    const sharedEquipments = candidateListing.equipmentKeys.filter((item) => targetListing.equipmentKeys.includes(item)).length;
    score += sharedEquipments * 1.2;

    if (favorites.has(candidateListing.id)) score += 4;
    score += Math.min(candidateStats.views || 0, 5) * 0.3;
    score += Math.min(candidateStats.favoriteAdds || 0, 5) * 0.8;
    return score;
  };

  const getRecommendedListings = (listings, options) => {
    const favorites = getFavorites();
    const interactions = getInteractions();
    const targetId = options?.targetId || null;
    const limit = options?.limit || 3;
    const enriched = listings.map(enrichListing);

    let target = enriched.find((listing) => listing.id === targetId) || null;
    if (!target) {
      const sortedByAffinity = [...enriched].sort((a, b) => {
        const aStats = interactions.listings[a.id] || {};
        const bStats = interactions.listings[b.id] || {};
        const aScore = (favorites.has(a.id) ? 4 : 0) + (aStats.views || 0) + (aStats.favoriteAdds || 0) * 2;
        const bScore = (favorites.has(b.id) ? 4 : 0) + (bStats.views || 0) + (bStats.favoriteAdds || 0) * 2;
        return bScore - aScore;
      });
      target = sortedByAffinity[0] || enriched[0] || null;
    }

    if (!target) return [];

    return [...enriched]
      .filter((listing) => listing.id !== target.id)
      .map((listing) => ({
        listing,
        score: computeRecommendationScore(target, listing, interactions, favorites)
      }))
      .filter((item) => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.listing);
  };

  const getAnalyticsSummary = () => {
    const state = getInteractions();
    return {
      ...state.counters,
      favoritesCount: getFavorites().size
    };
  };

  window.KDSite = {
    normalizeText,
    titleCase,
    enrichListing,
    getFavorites,
    saveFavorites,
    toggleFavorite,
    isFavorite: (listingId) => getFavorites().has(listingId),
    getCustomBookmarks,
    addCustomBookmark,
    removeCustomBookmark,
    getInteractions,
    trackListingEvent,
    getSuggestions,
    trackSearch,
    filterListings,
    getAvailableFilters,
    getRecommendedListings,
    getAnalyticsSummary
  };
})();
