import { KakaoMapView } from "./kakao-map-core.js";

const FORM_LABELS = {
  title: "제목",
  entities: "표시할 엔티티 (비우면 전체 표시)",
  aspect_ratio: "가로세로 비율 (예: 16:9, Masonry 대시보드 전용)",
  hide_search: "장소 검색창 숨기기",
  hide_traffic: "교통 정보 버튼 숨기기",
};

// "16:9", "16x9", "1.78" 형식을 CSS aspect-ratio 값으로 변환한다
function toCssAspectRatio(value) {
  var parts = String(value).split(/[:x]/).map(Number);
  if (parts.length === 1 && parts[0] > 0) return String(parts[0]);
  if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
    return parts[0] + " / " + parts[1];
  }
  return "1 / 1";
}

class KakaoMapCard extends HTMLElement {
  static getConfigForm() {
    return {
      schema: [
        { name: "title", selector: { text: {} } },
        {
          name: "entities",
          selector: {
            entity: {
              multiple: true,
              filter: { domain: ["person", "device_tracker", "zone"] },
            },
          },
        },
        { name: "aspect_ratio", selector: { text: {} } },
        { name: "hide_search", selector: { boolean: {} } },
        { name: "hide_traffic", selector: { boolean: {} } },
      ],
      computeLabel: (schema) => FORM_LABELS[schema.name],
    };
  }

  static getStubConfig() {
    return {};
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; height: 100%; }
        ha-card { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
        .card-header { padding: 12px 16px 8px; font-size: 20px; }
        #map-container { position: relative; flex: 1; min-height: 0; }
        #map-container.fixed-ratio { flex: none; }
        .message { padding: 16px; }
      </style>
      <ha-card>
        <div class="card-header" hidden></div>
        <div id="map-container"></div>
      </ha-card>
    `;
    this._header = this.shadowRoot.querySelector(".card-header");
    this._mapContainer = this.shadowRoot.getElementById("map-container");
  }

  setConfig(config) {
    if (config.entities && !Array.isArray(config.entities)) {
      throw new Error("entities는 엔티티 ID 목록이어야 합니다.");
    }
    this._config = config;
    this._header.textContent = config.title || "";
    this._header.hidden = !config.title;
    this._applyAspectRatio();
    if (this._view) this._applyConfigToView();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._view) this._view.hass = hass;
    this._tryInit();
  }

  // Sections 대시보드가 카드 배치 방식을 알려 주는 값 ("grid"이면 그리드 크기를 따른다)
  set layout(layout) {
    this._layout = layout;
    this._applyAspectRatio();
  }

  getCardSize() {
    return 7;
  }

  getGridOptions() {
    return { columns: "full", rows: 4, min_columns: 6, min_rows: 2 };
  }

  connectedCallback() {
    this._connected = true;
    this._tryInit();
  }

  // 대시보드 뷰를 전환하면 카드가 DOM에서 떨어졌다 다시 붙는데, 이때 iframe이 새로 로드되어
  // 기존 지도가 사라지므로 다시 연결될 때 지도를 새로 만든다
  disconnectedCallback() {
    this._connected = false;
    this._view?.destroy();
    this._view = null;
  }

  _tryInit() {
    if (this._view || !this._connected || !this._config || !this._hass) return;

    var apiKey = this._hass.panels?.map?.config?.api_key;
    if (!apiKey) {
      this._mapContainer.innerHTML =
        '<div class="message">Kakao Map 통합 구성요소가 설정되어 있지 않습니다. ' +
        "설정 > 기기 및 서비스에서 Kakao Map을 추가하세요.</div>";
      return;
    }

    this._mapContainer.innerHTML = "";
    this._view = new KakaoMapView(this._mapContainer, {
      apiKey: apiKey,
      fullscreen: false,
    });
    this._view.hass = this._hass;
    this._applyConfigToView();
    this._view.init();
  }

  _applyConfigToView() {
    var entities = this._config.entities;
    this._view.setEntityFilter(entities && entities.length ? entities : null);
    this._view.setToolbar({
      search: !this._config.hide_search,
      traffic: !this._config.hide_traffic,
    });
  }

  _applyAspectRatio() {
    if (!this._config) return;
    var followsGrid = this._layout === "grid" || this._layout === "panel";
    this._mapContainer.classList.toggle("fixed-ratio", !followsGrid);
    this._mapContainer.style.aspectRatio = followsGrid
      ? ""
      : toCssAspectRatio(this._config.aspect_ratio || "1");
  }
}

customElements.define("kakao-map-card", KakaoMapCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "kakao-map-card",
  name: "Kakao Map",
  description: "카카오맵에 사람, 기기 위치와 Zone을 표시합니다.",
  documentationURL: "https://github.com/Lemon-HACS/hass-kakao-map-changer",
});
