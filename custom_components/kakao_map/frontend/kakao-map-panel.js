// MDI SVG paths
var MDI = {
  home: "M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z",
  person:
    "M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z",
  map_marker: "M12,2C8.13,2 5,5.13 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9C19,5.13 15.87,2 12,2Z",
  briefcase:
    "M10,2H14A2,2 0 0,1 16,4V6H20A2,2 0 0,1 22,8V19A2,2 0 0,1 20,21H4C2.89,21 2,20.1 2,19V8C2,6.89 2.89,6 4,6H8V4C8,2.89 8.89,2 10,2M14,6V4H10V6H14Z",
  store:
    "M12,18H6V14H12M21,14V12L20,7H4L3,12V14H4V20H14V14H18V20H20V14M20,4H4V6H20V4Z",
  school:
    "M12,3L1,9L12,15L21,10.09V17H23V9M5,13.18V17.18L12,21L19,17.18V13.18L12,17L5,13.18Z",
};

function mdiPath(icon) {
  if (!icon) return MDI.map_marker;
  var key = icon.replace("mdi:", "").replace(/-/g, "_");
  return MDI[key] || MDI.map_marker;
}

class KakaoMapPanel extends HTMLElement {
  constructor() {
    super();
    this._ready = false;
    this._markers = new Map();
    this._entityLabels = new Map();
    this._circles = new Map();
    this._zoneLabels = new Map();
  }

  connectedCallback() {
    this._connected = true;
    this._tryInit();
  }

  set panel(panel) {
    this._panel = panel;
    this._apiKey = panel.config.api_key;
    this._tryInit();
  }

  _tryInit() {
    if (this._apiKey && this._connected && !this._iframe) this._init();
  }

  set hass(hass) {
    var prev = this._hass;
    this._hass = hass;
    if (this._ready && (!prev || this._hasChanges(prev, hass))) {
      this._updateMap();
    }
  }

  set narrow(v) {
    this._narrow = v;
  }

  _hasChanges(prev, next) {
    for (var id of Object.keys(next.states)) {
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

    var iframe = document.createElement("iframe");
    iframe.style.cssText = "width:100%;height:100%;border:none;";
    iframe.src = "/kakao_map_static/kakao-map-inner.html";
    this.appendChild(iframe);
    this._iframe = iframe;

    await new Promise((r) => iframe.addEventListener("load", r, { once: true }));

    var doc = iframe.contentDocument;
    var apiKey = this._apiKey;

    // SDK 로드 전에 XHR/fetch 인터셉트 (SDK가 참조를 캐시하므로 먼저 패치)
    var _apiDomainError = false;
    var _domainErrorHtml =
      '<div class="result-item" style="line-height:1.6">' +
      '<div class="result-name">⚠️ API 키 오류</div>' +
      '<div class="result-addr">현재 도메인이 허용 목록에 없습니다.</div>' +
      '<div class="result-addr"><a href="https://developers.kakao.com/console/app" target="_blank" style="color:#4285f4">카카오 개발자 콘솔</a>에서 Web 도메인에 추가하세요:</div>' +
      '<div class="result-addr"><code style="background:#f5f5f5;padding:1px 6px;border-radius:3px">' + location.origin + "</code></div></div>";

    var _origOpen = iframe.contentWindow.XMLHttpRequest.prototype.open;
    iframe.contentWindow.XMLHttpRequest.prototype.open = function () {
      this._isKakao = String(arguments[1]).indexOf("dapi.kakao.com") !== -1;
      return _origOpen.apply(this, arguments);
    };
    var _origSend = iframe.contentWindow.XMLHttpRequest.prototype.send;
    iframe.contentWindow.XMLHttpRequest.prototype.send = function () {
      if (this._isKakao) {
        this.addEventListener("load", function () {
          if (this.status === 401) _apiDomainError = true;
        });
      }
      return _origSend.apply(this, arguments);
    };
    if (iframe.contentWindow.fetch) {
      var _origFetch = iframe.contentWindow.fetch;
      iframe.contentWindow.fetch = function (url) {
        return _origFetch.apply(iframe.contentWindow, arguments).then(function (resp) {
          if (resp.status === 401 && String(url).indexOf("dapi.kakao.com") !== -1) {
            _apiDomainError = true;
          }
          return resp;
        });
      };
    }

    try {
      await new Promise((resolve, reject) => {
        var s = doc.createElement("script");
        s.src =
          "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" +
          apiKey +
          "&autoload=false&libraries=services";
        s.onload = () => {
          iframe.contentWindow.kakao.maps.load(resolve);
        };
        s.onerror = () => reject(new Error("SDK 로드 실패"));
        doc.head.appendChild(s);
      });
    } catch (e) {
      doc.getElementById("map").innerHTML =
        '<div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:12px;font-family:sans-serif;color:#333">' +
        '<div style="font-size:48px">🔑</div>' +
        '<div style="font-size:18px;font-weight:700">카카오맵 API 키 오류</div>' +
        '<div style="font-size:14px;color:#666;text-align:center;max-width:400px;line-height:1.6">' +
        "API 키가 유효하지 않거나, 현재 도메인이 허용 목록에 없습니다.<br>" +
        '<a href="https://developers.kakao.com/console/app" target="_blank" style="color:#4285f4">카카오 개발자 콘솔</a>에서 ' +
        "앱 > 플랫폼 > Web에 현재 도메인을 추가하세요.<br>" +
        '<code style="background:#f5f5f5;padding:2px 6px;border-radius:4px;font-size:13px">' +
        location.origin + "</code></div></div>";
      return;
    }

    var K = iframe.contentWindow.kakao.maps;
    var lat = this._hass?.config?.latitude || 37.5665;
    var lng = this._hass?.config?.longitude || 126.978;

    var map = new K.Map(doc.getElementById("map"), {
      center: new K.LatLng(lat, lng),
      level: 3,
    });
    map.addControl(new K.MapTypeControl(), K.ControlPosition.TOPRIGHT);
    map.addControl(new K.ZoomControl(), K.ControlPosition.RIGHT);

    // 교통 정보 토글
    var trafficOn = false;
    var trafficBtn = doc.getElementById("traffic-btn");
    trafficBtn.addEventListener("click", function () {
      trafficOn = !trafficOn;
      if (trafficOn) {
        map.addOverlayMapTypeId(K.MapTypeId.TRAFFIC);
        trafficBtn.classList.add("active");
      } else {
        map.removeOverlayMapTypeId(K.MapTypeId.TRAFFIC);
        trafficBtn.classList.remove("active");
      }
    });

    // 장소 검색
    var ps = new (iframe.contentWindow.kakao.maps.services.Places)();
    var searchInput = doc.getElementById("search-input");
    var searchBtn = doc.getElementById("search-btn");
    var resultsEl = doc.getElementById("search-results");
    var searchMarker = null;

    function clearSearchMarker() {
      if (searchMarker) { searchMarker.setMap(null); searchMarker = null; }
    }

    function doSearch() {
      var query = searchInput.value.trim();
      if (!query) return;
      _apiDomainError = false;
      ps.keywordSearch(query, function (data, status) {
        resultsEl.innerHTML = "";
        if (_apiDomainError) {
          resultsEl.innerHTML = _domainErrorHtml;
          resultsEl.style.display = "block";
          return;
        }
        var SVC = iframe.contentWindow.kakao.maps.services.Status;
        if (status !== SVC.OK || !data || !data.length) {
          resultsEl.innerHTML = '<div class="result-item"><span class="result-addr">검색 결과가 없습니다.</span></div>';
          resultsEl.style.display = "block";
          return;
        }
        for (var i = 0; i < data.length; i++) {
          (function (place) {
            var item = doc.createElement("div");
            item.className = "result-item";
            item.innerHTML =
              '<div class="result-name">' + place.place_name + "</div>" +
              '<div class="result-addr">' + (place.road_address_name || place.address_name) + "</div>" +
              (place.category_group_name ? '<div class="result-category">' + place.category_group_name + "</div>" : "") +
              '<a class="result-link" href="https://place.map.kakao.com/' + place.id + '" target="_blank">카카오맵에서 보기 →</a>';
            item.addEventListener("click", function (e) {
              if (e.target.classList.contains("result-link")) return;
              var pos = new K.LatLng(place.y, place.x);
              map.setCenter(pos);
              map.setLevel(3);
              clearSearchMarker();
              searchMarker = new K.Marker({ position: pos, map: map });
              resultsEl.style.display = "none";
            });
            resultsEl.appendChild(item);
          })(data[i]);
        }
        var closeBtn = doc.createElement("div");
        closeBtn.className = "result-close";
        closeBtn.textContent = "닫기";
        closeBtn.addEventListener("click", function () { resultsEl.style.display = "none"; });
        resultsEl.appendChild(closeBtn);
        resultsEl.style.display = "block";
      });
    }

    searchBtn.addEventListener("click", doSearch);
    searchInput.addEventListener("keydown", function (e) { if (e.key === "Enter") doSearch(); });

    this._K = K;
    this._doc = doc;
    this._map = map;
    this._ready = true;

    var self = this;
    new ResizeObserver(function () {
      if (self._map) self._map.relayout();
    }).observe(iframe);

    setTimeout(function () {
      map.relayout();
      if (self._hass) self._updateMap();
    }, 100);

    if (this._hass) this._updateMap();
  }

  _updateMap() {
    var K = this._K;
    var doc = this._doc;
    var map = this._map;
    if (!map || !this._hass) return;

    var states = this._hass.states;
    var bounds = new K.LatLngBounds();
    var hasContent = false;
    var activeTrackers = new Set();
    var activeZones = new Set();

    // person 엔티티의 source인 device_tracker는 중복이므로 건너뛰기
    var personSources = new Set();
    for (var [pid, pstate] of Object.entries(states)) {
      if (pid.startsWith("person.") && pstate.attributes.source) {
        personSources.add(pstate.attributes.source);
      }
    }

    // --- Zones (circle + label only, no pin marker) ---
    for (var [id, state] of Object.entries(states)) {
      if (!id.startsWith("zone.")) continue;
      var a = state.attributes;
      if (a.latitude == null || a.longitude == null) continue;

      activeZones.add(id);
      hasContent = true;
      var center = new K.LatLng(a.latitude, a.longitude);
      bounds.extend(center);
      var isHome = id === "zone.home";
      var color = isHome ? "#FF6B35" : "#448aff";
      var icon = a.icon || (isHome ? "mdi:home" : "mdi:map-marker");

      // Circle
      var circle = this._circles.get(id);
      if (circle) {
        circle.setPosition(center);
        circle.setRadius(a.radius || 100);
      } else {
        circle = new K.Circle({
          center: center,
          radius: a.radius || 100,
          strokeWeight: 2,
          strokeColor: color,
          strokeOpacity: 0.8,
          strokeStyle: "solid",
          fillColor: color,
          fillOpacity: 0.15,
          map: map,
        });
        this._circles.set(id, circle);
      }

      // Zone label (icon + name)
      var name = a.friendly_name || id.split(".")[1];
      var label = this._zoneLabels.get(id);
      if (!label) {
        var el = doc.createElement("div");
        el.style.cssText =
          "display:flex;align-items:center;gap:4px;background:" +
          color +
          ";color:#fff;padding:4px 10px;border-radius:14px;font-size:12px;font-weight:600;white-space:nowrap;pointer-events:none;box-shadow:0 1px 4px rgba(0,0,0,.25);";
        el.innerHTML =
          '<svg viewBox="0 0 24 24" width="14" height="14" fill="white"><path d="' +
          mdiPath(icon) +
          '"/></svg><span>' +
          this._escHtml(name) +
          "</span>";
        label = new K.CustomOverlay({
          position: center,
          content: el,
          yAnchor: 0.5,
          map: map,
        });
        label._el = el;
        label._span = el.querySelector("span");
        this._zoneLabels.set(id, label);
      } else {
        label.setPosition(center);
        label._span.textContent = name;
      }
    }

    // --- Trackers (person + device_tracker) ---
    for (var [id2, state2] of Object.entries(states)) {
      if (personSources.has(id2)) continue;
      if (!id2.startsWith("device_tracker.") && !id2.startsWith("person."))
        continue;
      var a2 = state2.attributes;
      if (a2.latitude == null || a2.longitude == null) continue;

      activeTrackers.add(id2);
      hasContent = true;
      var pos = new K.LatLng(a2.latitude, a2.longitude);
      bounds.extend(pos);

      var marker = this._markers.get(id2);
      if (marker) {
        marker.setPosition(pos);
      } else {
        if (a2.entity_picture) {
          // Avatar marker
          var wrap = doc.createElement("div");
          wrap.style.cssText =
            "width:40px;height:40px;border-radius:50%;border:3px solid #4285f4;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,.3);background:#fff;";
          var img = doc.createElement("img");
          img.src = a2.entity_picture;
          img.style.cssText = "width:100%;height:100%;object-fit:cover;";
          img.onerror = function () {
            this.style.display = "none";
            this.parentNode.innerHTML =
              '<svg viewBox="0 0 24 24" width="24" height="24" fill="#4285f4" style="margin:8px"><path d="' +
              MDI.person +
              '"/></svg>';
          };
          wrap.appendChild(img);
          marker = new K.CustomOverlay({
            position: pos,
            content: wrap,
            yAnchor: 0.5,
            map: map,
          });
        } else {
          // SVG icon marker
          var iconEl = doc.createElement("div");
          iconEl.style.cssText =
            "width:36px;height:36px;border-radius:50%;background:#4285f4;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.3);border:2px solid #fff;";
          iconEl.innerHTML =
            '<svg viewBox="0 0 24 24" width="20" height="20" fill="white"><path d="' +
            MDI.person +
            '"/></svg>';
          marker = new K.CustomOverlay({
            position: pos,
            content: iconEl,
            yAnchor: 0.5,
            map: map,
          });
        }
        this._markers.set(id2, marker);
      }

      // Name label
      var ename = a2.friendly_name || id2.split(".")[1];
      var nameLabel = this._entityLabels.get(id2);
      if (!nameLabel) {
        var nel = doc.createElement("div");
        nel.style.cssText =
          "background:#fff;padding:2px 8px;border-radius:12px;font-size:12px;font-weight:500;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.2);pointer-events:none;";
        nel.textContent = ename;
        nameLabel = new K.CustomOverlay({
          position: pos,
          content: nel,
          yAnchor: -0.5,
          map: map,
        });
        nameLabel._el = nel;
        this._entityLabels.set(id2, nameLabel);
      } else {
        nameLabel.setPosition(pos);
        nameLabel._el.textContent = ename;
      }
    }

    this._removeStale(this._markers, activeTrackers);
    this._removeStale(this._entityLabels, activeTrackers);
    this._removeStale(this._circles, activeZones);
    this._removeStale(this._zoneLabels, activeZones);

    if (hasContent) map.setBounds(bounds);
  }

  _removeStale(map, activeSet) {
    for (var [id, obj] of map) {
      if (!activeSet.has(id)) {
        obj.setMap(null);
        map.delete(id);
      }
    }
  }

  _escHtml(s) {
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
}

customElements.define("kakao-map-panel", KakaoMapPanel);
