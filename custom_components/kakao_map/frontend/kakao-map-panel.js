class KakaoMapPanel extends HTMLElement {
  constructor() {
    super();
    this._ready = false;
    this._markers = new Map();
    this._entityLabels = new Map();
    this._circles = new Map();
    this._zoneMarkers = new Map();
    this._zoneLabels = new Map();
  }

  set panel(panel) {
    this._panel = panel;
    this._apiKey = panel.config.api_key;
    if (!this._iframe) this._init();
  }

  set hass(hass) {
    const prev = this._hass;
    this._hass = hass;
    if (this._ready && (!prev || this._hasChanges(prev, hass))) {
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
      )
        return true;
    }
    return false;
  }

  async _init() {
    this.style.cssText = "display:block;width:100%;height:100%;";

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "width:100%;height:100%;border:none;";
    this.appendChild(iframe);
    this._iframe = iframe;

    // iframe 내부에 클린한 HTML 작성 (scoped registry 간섭 없음)
    const doc = iframe.contentDocument;
    doc.open();
    doc.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8">' +
        '<base href="' + location.origin + '">' +
        "<style>*{margin:0;padding:0}html,body,#map{width:100%;height:100%}</style>" +
        '</head><body><div id="map"></div></body></html>'
    );
    doc.close();

    // iframe 내부에서 Kakao SDK 로드
    await new Promise((resolve, reject) => {
      const s = doc.createElement("script");
      s.src =
        "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" +
        this._apiKey +
        "&autoload=false&libraries=services";
      s.onload = () => iframe.contentWindow.kakao.maps.load(resolve);
      s.onerror = reject;
      doc.head.appendChild(s);
    });

    const K = iframe.contentWindow.kakao.maps;
    const lat = this._hass?.config?.latitude || 37.5665;
    const lng = this._hass?.config?.longitude || 126.978;

    const map = new K.Map(doc.getElementById("map"), {
      center: new K.LatLng(lat, lng),
      level: 3,
    });
    map.addControl(new K.MapTypeControl(), K.ControlPosition.TOPRIGHT);
    map.addControl(new K.ZoomControl(), K.ControlPosition.RIGHT);

    this._K = K;
    this._doc = doc;
    this._map = map;
    this._ready = true;

    new ResizeObserver(() => {
      if (this._map) this._map.relayout();
    }).observe(iframe);

    setTimeout(() => {
      map.relayout();
      if (this._hass) this._updateMap();
    }, 100);

    if (this._hass) this._updateMap();
  }

  _updateMap() {
    const K = this._K;
    const doc = this._doc;
    const map = this._map;
    if (!map || !this._hass) return;

    const states = this._hass.states;
    const bounds = new K.LatLngBounds();
    let hasContent = false;
    const activeTrackers = new Set();
    const activeZones = new Set();

    // --- Zones ---
    for (const [id, state] of Object.entries(states)) {
      if (!id.startsWith("zone.")) continue;
      const a = state.attributes;
      if (a.latitude == null || a.longitude == null) continue;

      activeZones.add(id);
      hasContent = true;
      const center = new K.LatLng(a.latitude, a.longitude);
      bounds.extend(center);
      const isHome = id === "zone.home";
      const color = isHome ? "#FF6B35" : "#448aff";

      let circle = this._circles.get(id);
      if (circle) {
        circle.setPosition(center);
        circle.setRadius(a.radius || 100);
      } else {
        circle = new K.Circle({
          center,
          radius: a.radius || 100,
          strokeWeight: 2,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeStyle: "solid",
          fillColor: color,
          fillOpacity: 0.15,
          map,
        });
        this._circles.set(id, circle);
      }

      let zm = this._zoneMarkers.get(id);
      if (zm) {
        zm.setPosition(center);
      } else {
        zm = new K.Marker({ position: center, map });
        this._zoneMarkers.set(id, zm);
      }

      const name = a.friendly_name || id.split(".")[1];
      let label = this._zoneLabels.get(id);
      if (!label) {
        const el = doc.createElement("div");
        el.style.cssText =
          "background:" +
          color +
          ";color:#fff;padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600;white-space:nowrap;pointer-events:none;";
        el.textContent = name;
        label = new K.CustomOverlay({
          position: center,
          content: el,
          yAnchor: -0.3,
          map,
        });
        label._el = el;
        this._zoneLabels.set(id, label);
      } else {
        label.setPosition(center);
        label._el.textContent = name;
      }
    }

    // --- Trackers ---
    for (const [id, state] of Object.entries(states)) {
      if (!id.startsWith("device_tracker.") && !id.startsWith("person."))
        continue;
      const a = state.attributes;
      if (a.latitude == null || a.longitude == null) continue;

      activeTrackers.add(id);
      hasContent = true;
      const pos = new K.LatLng(a.latitude, a.longitude);
      bounds.extend(pos);

      let marker = this._markers.get(id);
      if (marker) {
        marker.setPosition(pos);
      } else {
        if (a.entity_picture) {
          const wrap = doc.createElement("div");
          wrap.style.cssText =
            "width:40px;height:40px;border-radius:50%;border:3px solid #4285f4;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.3);background:#fff;";
          const img = doc.createElement("img");
          img.src = a.entity_picture;
          img.style.cssText = "width:100%;height:100%;object-fit:cover;";
          img.onerror = function () {
            img.style.display = "none";
            wrap.textContent = "\u{1F4CD}";
            wrap.style.textAlign = "center";
            wrap.style.lineHeight = "40px";
            wrap.style.fontSize = "20px";
          };
          wrap.appendChild(img);
          marker = new K.CustomOverlay({
            position: pos,
            content: wrap,
            yAnchor: 0.5,
            map,
          });
        } else {
          marker = new K.Marker({ position: pos, map });
        }
        this._markers.set(id, marker);
      }

      const name = a.friendly_name || id.split(".")[1];
      let nameLabel = this._entityLabels.get(id);
      if (!nameLabel) {
        const el = doc.createElement("div");
        el.style.cssText =
          "background:#fff;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.2);pointer-events:none;";
        el.textContent = name;
        nameLabel = new K.CustomOverlay({
          position: pos,
          content: el,
          yAnchor: -0.5,
          map,
        });
        nameLabel._el = el;
        this._entityLabels.set(id, nameLabel);
      } else {
        nameLabel.setPosition(pos);
        nameLabel._el.textContent = name;
      }
    }

    this._removeStale(this._markers, activeTrackers);
    this._removeStale(this._entityLabels, activeTrackers);
    this._removeStale(this._circles, activeZones);
    this._removeStale(this._zoneMarkers, activeZones);
    this._removeStale(this._zoneLabels, activeZones);

    if (hasContent) map.setBounds(bounds);
  }

  _removeStale(map, activeSet) {
    for (const [id, obj] of map) {
      if (!activeSet.has(id)) {
        obj.setMap(null);
        map.delete(id);
      }
    }
  }
}

customElements.define("kakao-map-panel", KakaoMapPanel);
