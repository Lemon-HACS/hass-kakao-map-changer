class KakaoMapPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._markers = new Map();
    this._entityLabels = new Map();
    this._circles = new Map();
    this._zoneLabels = new Map();
    this._initialized = false;
  }

  set panel(panel) {
    this._panel = panel;
    this._apiKey = panel.config.api_key;
    if (!this._initialized) this._initPanel();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (this._map && (!prev || this._hasChanges(prev, hass))) {
      this._updateMap();
    }
  }

  set narrow(v) {
    this._narrow = v;
  }

  _hasChanges(prev, next) {
    for (const id of Object.keys(next.states)) {
      if (
        (id.startsWith("device_tracker.") ||
          id.startsWith("person.") ||
          id.startsWith("zone.")) &&
        prev.states[id] !== next.states[id]
      ) {
        return true;
      }
    }
    return false;
  }

  async _initPanel() {
    this._initialized = true;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; height:100%; width:100%; }
        #map { width:100%; height:100%; }
      </style>
      <div id="map"></div>
    `;

    await this._loadSDK();

    const container = this.shadowRoot.getElementById("map");
    const lat = this._hass?.config?.latitude || 37.5665;
    const lng = this._hass?.config?.longitude || 126.978;

    this._map = new kakao.maps.Map(container, {
      center: new kakao.maps.LatLng(lat, lng),
      level: 5,
    });

    this._map.addControl(
      new kakao.maps.MapTypeControl(),
      kakao.maps.ControlPosition.TOPRIGHT
    );
    this._map.addControl(
      new kakao.maps.ZoomControl(),
      kakao.maps.ControlPosition.RIGHT
    );

    new ResizeObserver(() => this._map && this._map.relayout()).observe(
      container
    );

    if (this._hass) this._updateMap();
  }

  _loadSDK() {
    return new Promise((resolve, reject) => {
      if (window.kakao?.maps?.Map) return resolve();
      if (window.kakao?.maps) return kakao.maps.load(resolve);
      const s = document.createElement("script");
      s.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${this._apiKey}&autoload=false&libraries=services`;
      s.onload = () => kakao.maps.load(resolve);
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  _updateMap() {
    if (!this._map || !this._hass) return;

    const states = this._hass.states;
    const bounds = new kakao.maps.LatLngBounds();
    let hasEntity = false;
    const activeTrackers = new Set();
    const activeZones = new Set();

    // --- Zones ---
    for (const [id, state] of Object.entries(states)) {
      if (!id.startsWith("zone.")) continue;
      const a = state.attributes;
      if (a.latitude == null || a.longitude == null) continue;

      activeZones.add(id);
      const center = new kakao.maps.LatLng(a.latitude, a.longitude);
      const isHome = id === "zone.home";
      const color = isHome ? "#FF6B35" : "#448aff";

      let circle = this._circles.get(id);
      if (circle) {
        circle.setPosition(center);
        circle.setRadius(a.radius || 100);
      } else {
        circle = new kakao.maps.Circle({
          center,
          radius: a.radius || 100,
          strokeWeight: 2,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeStyle: "solid",
          fillColor: color,
          fillOpacity: 0.15,
          map: this._map,
        });
        this._circles.set(id, circle);
      }

      const name = a.friendly_name || id.split(".")[1];
      let label = this._zoneLabels.get(id);
      if (!label) {
        const el = this._makeEl(
          `background:${color};color:#fff;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:500;white-space:nowrap;pointer-events:none;`
        );
        el.textContent = name;
        label = new kakao.maps.CustomOverlay({
          position: center,
          content: el,
          yAnchor: 0.5,
          map: this._map,
        });
        label._el = el;
        this._zoneLabels.set(id, label);
      } else {
        label.setPosition(center);
        label._el.textContent = name;
      }
    }

    // --- Trackers (person + device_tracker) ---
    for (const [id, state] of Object.entries(states)) {
      if (!id.startsWith("device_tracker.") && !id.startsWith("person."))
        continue;
      const a = state.attributes;
      if (a.latitude == null || a.longitude == null) continue;

      activeTrackers.add(id);
      hasEntity = true;
      const pos = new kakao.maps.LatLng(a.latitude, a.longitude);
      bounds.extend(pos);

      let marker = this._markers.get(id);
      if (marker) {
        marker.setPosition(pos);
      } else {
        if (a.entity_picture) {
          const el = this._makeAvatarEl(a.entity_picture);
          marker = new kakao.maps.CustomOverlay({
            position: pos,
            content: el,
            yAnchor: 0.5,
            map: this._map,
          });
        } else {
          marker = new kakao.maps.Marker({ position: pos, map: this._map });
        }
        this._markers.set(id, marker);
      }

      const name = a.friendly_name || id.split(".")[1];
      let nameLabel = this._entityLabels.get(id);
      if (!nameLabel) {
        const el = this._makeEl(
          "background:#fff;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.2);pointer-events:none;margin-top:4px;"
        );
        el.textContent = name;
        nameLabel = new kakao.maps.CustomOverlay({
          position: pos,
          content: el,
          yAnchor: -0.5,
          map: this._map,
        });
        nameLabel._el = el;
        this._entityLabels.set(id, nameLabel);
      } else {
        nameLabel.setPosition(pos);
        nameLabel._el.textContent = name;
      }
    }

    // --- Cleanup stale ---
    this._removeStale(this._markers, activeTrackers);
    this._removeStale(this._entityLabels, activeTrackers);
    this._removeStale(this._circles, activeZones);
    this._removeStale(this._zoneLabels, activeZones);

    if (hasEntity) this._map.setBounds(bounds);
  }

  _removeStale(map, activeSet) {
    for (const [id, obj] of map) {
      if (!activeSet.has(id)) {
        obj.setMap(null);
        map.delete(id);
      }
    }
  }

  _makeEl(style) {
    const el = document.createElement("div");
    el.style.cssText = style;
    return el;
  }

  _makeAvatarEl(src) {
    const wrap = document.createElement("div");
    wrap.style.cssText =
      "width:40px;height:40px;border-radius:50%;border:3px solid #4285f4;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.3);background:#fff;cursor:pointer;";
    const img = document.createElement("img");
    img.src = src;
    img.style.cssText = "width:100%;height:100%;object-fit:cover;";
    img.onerror = () => {
      img.style.display = "none";
      wrap.style.textAlign = "center";
      wrap.style.lineHeight = "40px";
      wrap.style.fontSize = "20px";
      wrap.textContent = "📍";
    };
    wrap.appendChild(img);
    return wrap;
  }
}

customElements.define("kakao-map-panel", KakaoMapPanel);
