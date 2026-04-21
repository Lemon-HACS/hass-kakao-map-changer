(async function () {
  "use strict";

  // --- API key ---
  async function getApiKey() {
    for (let i = 0; i < 100; i++) {
      try {
        const key =
          document.querySelector("home-assistant")?.hass?.panels?.map?.config
            ?.api_key;
        if (key) return key;
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 200));
    }
    return null;
  }

  // --- SDK loader ---
  function loadSDK(apiKey) {
    return new Promise((resolve, reject) => {
      if (window.kakao?.maps?.Map) return resolve();
      if (window.kakao?.maps) return kakao.maps.load(resolve);
      const s = document.createElement("script");
      s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${apiKey}&autoload=false&libraries=services`;
      s.onload = () => kakao.maps.load(resolve);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    console.warn("[KakaoMap] API key not found");
    return;
  }
  await loadSDK(apiKey);

  // =========================================================
  //  ha-map override
  // =========================================================
  await customElements.whenDefined("ha-map");
  const HaMap = customElements.get("ha-map");
  const _origFirstUpdated = HaMap.prototype.firstUpdated;

  HaMap.prototype.firstUpdated = function (_changed) {
    const mapEl = this.shadowRoot?.getElementById("map");
    if (!mapEl) return;

    mapEl.innerHTML = "";

    const lat = this.hass?.config?.latitude || 37.5665;
    const lng = this.hass?.config?.longitude || 126.978;

    this._kakaoMap = new kakao.maps.Map(mapEl, {
      center: new kakao.maps.LatLng(lat, lng),
      level: this.zoom || 5,
    });
    this._kMarkers = new Map();
    this._kCircles = new Map();
    this._kOverlays = new Map();

    if (this.darkMode) {
      mapEl.style.filter = "invert(1) hue-rotate(180deg)";
    }

    this._kakaoResizeObs = new ResizeObserver(() => {
      if (this._kakaoMap) this._kakaoMap.relayout();
    });
    this._kakaoResizeObs.observe(mapEl);

    this._syncKakao();
  };

  HaMap.prototype.updated = function (changed) {
    if (!this._kakaoMap) return;

    if (changed.has("darkMode")) {
      const el = this.shadowRoot?.getElementById("map");
      if (el) el.style.filter = this.darkMode ? "invert(1) hue-rotate(180deg)" : "";
    }
    if (changed.has("zoom") && this.zoom != null) {
      this._kakaoMap.setLevel(this.zoom);
    }
    this._syncKakao();
  };

  HaMap.prototype._syncKakao = function () {
    if (!this._kakaoMap || !this.hass) return;

    this._kMarkers.forEach((m) => m.setMap(null));
    this._kCircles.forEach((c) => c.setMap(null));
    this._kOverlays.forEach((o) => o.setMap(null));
    this._kMarkers.clear();
    this._kCircles.clear();
    this._kOverlays.clear();

    const bounds = new kakao.maps.LatLngBounds();
    let hasBounds = false;

    // entities
    if (this.entities?.length) {
      for (const conf of this.entities) {
        const id = typeof conf === "string" ? conf : conf.entity;
        const st = this.hass.states[id];
        if (!st?.attributes?.latitude) continue;
        const pos = new kakao.maps.LatLng(
          st.attributes.latitude,
          st.attributes.longitude
        );
        bounds.extend(pos);
        hasBounds = true;

        const marker = new kakao.maps.Marker({ position: pos, map: this._kakaoMap });
        this._kMarkers.set(id, marker);

        const name = st.attributes.friendly_name || id.split(".")[1];
        const el = document.createElement("div");
        el.style.cssText =
          "background:#fff;padding:2px 6px;border-radius:10px;font-size:11px;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.2);pointer-events:none;";
        el.textContent = name;
        const lbl = new kakao.maps.CustomOverlay({
          position: pos,
          content: el,
          yAnchor: -0.3,
          map: this._kakaoMap,
        });
        this._kOverlays.set(id + "_lbl", lbl);
      }
    }

    // zones
    for (const [id, st] of Object.entries(this.hass.states)) {
      if (!id.startsWith("zone.")) continue;
      const a = st.attributes;
      if (a.latitude == null || a.longitude == null) continue;

      const center = new kakao.maps.LatLng(a.latitude, a.longitude);
      bounds.extend(center);
      hasBounds = true;

      const isHome = id === "zone.home";
      const color = isHome ? "#FF6B35" : "#448aff";
      const circle = new kakao.maps.Circle({
        center,
        radius: a.radius || 100,
        strokeWeight: 2,
        strokeColor: color,
        strokeOpacity: 0.8,
        strokeStyle: "solid",
        fillColor: color,
        fillOpacity: 0.15,
        map: this._kakaoMap,
      });
      this._kCircles.set(id, circle);
    }

    if (hasBounds) this._kakaoMap.setBounds(bounds);
  };

  Object.defineProperty(HaMap.prototype, "kakaoMap", {
    get() {
      return this._kakaoMap;
    },
    configurable: true,
  });

  // =========================================================
  //  ha-locations-editor override
  // =========================================================
  await customElements.whenDefined("ha-locations-editor");
  const HaLocEd = customElements.get("ha-locations-editor");

  HaLocEd.prototype.firstUpdated = function (_changed) {
    this._map = this.shadowRoot?.querySelector("ha-map");
    if (!this._map) return;

    this._locMarkers = new Map();
    this._locCircles = new Map();
    this._locLabels = new Map();

    const waitForMap = (n) => {
      if (this._map._kakaoMap) {
        this._initKakaoLocations();
      } else if (n < 300) {
        requestAnimationFrame(() => waitForMap(n + 1));
      }
    };
    waitForMap(0);
  };

  HaLocEd.prototype._initKakaoLocations = function () {
    const map = this._map._kakaoMap;

    kakao.maps.event.addListener(map, "click", (e) => {
      const ll = e.latLng;
      this.dispatchEvent(
        new CustomEvent("location-added", {
          detail: { latitude: ll.getLat(), longitude: ll.getLng() },
        })
      );
    });

    this._syncKakaoLocations();
  };

  HaLocEd.prototype._syncKakaoLocations = function () {
    const map = this._map?._kakaoMap;
    if (!map || !this.locations) return;

    this._locMarkers.forEach((m) => m.setMap(null));
    this._locCircles.forEach((c) => c.setMap(null));
    this._locLabels.forEach((l) => l.setMap(null));
    this._locMarkers.clear();
    this._locCircles.clear();
    this._locLabels.clear();

    const bounds = new kakao.maps.LatLngBounds();
    let any = false;

    for (const loc of this.locations) {
      if (loc.latitude == null || loc.longitude == null) continue;
      any = true;

      const pos = new kakao.maps.LatLng(loc.latitude, loc.longitude);
      bounds.extend(pos);

      // draggable marker
      const marker = new kakao.maps.Marker({
        position: pos,
        map: map,
        draggable: true,
      });

      kakao.maps.event.addListener(marker, "dragend", () => {
        const np = marker.getPosition();
        const circle = this._locCircles.get(loc.id);
        if (circle) circle.setPosition(np);
        const lbl = this._locLabels.get(loc.id);
        if (lbl) lbl.setPosition(np);

        this.dispatchEvent(
          new CustomEvent("location-updated", {
            detail: {
              id: loc.id,
              latitude: np.getLat(),
              longitude: np.getLng(),
            },
          })
        );
      });

      this._locMarkers.set(loc.id, marker);

      // radius circle
      if (loc.radius) {
        const color = loc.radius_color || "#448aff";
        const circle = new kakao.maps.Circle({
          center: pos,
          radius: loc.radius,
          strokeWeight: 2,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeStyle: "solid",
          fillColor: color,
          fillOpacity: 0.2,
          map: map,
        });
        this._locCircles.set(loc.id, circle);
      }

      // name label
      if (loc.name) {
        const el = document.createElement("div");
        el.style.cssText =
          "background:rgba(68,138,255,.85);color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;white-space:nowrap;pointer-events:none;";
        el.textContent = loc.name;
        const lbl = new kakao.maps.CustomOverlay({
          position: pos,
          content: el,
          yAnchor: -0.3,
          map: map,
        });
        this._locLabels.set(loc.id, lbl);
      }
    }

    if (any) map.setBounds(bounds);
  };

  HaLocEd.prototype.updated = function (changed) {
    if (changed.has("locations") && this._map?._kakaoMap) {
      this._syncKakaoLocations();
    }
  };

  console.info(
    "%c[KakaoMap]%c ha-map / ha-locations-editor 오버라이드 완료",
    "color:#FF6B35;font-weight:bold",
    ""
  );
})();
