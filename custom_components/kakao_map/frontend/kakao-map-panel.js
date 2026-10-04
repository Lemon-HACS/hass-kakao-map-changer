import { KakaoMapView } from "./kakao-map-core.js";

class KakaoMapPanel extends HTMLElement {
  connectedCallback() {
    this._connected = true;
    this._tryInit();
  }

  set panel(panel) {
    this._panel = panel;
    this._tryInit();
  }

  set hass(hass) {
    this._hass = hass;
    if (this._view) this._view.hass = hass;
    this._updateMenuButton();
  }

  set narrow(v) {
    this._narrow = v;
    this._updateMenuButton();
  }

  _tryInit() {
    if (this._panel && this._connected && !this._view) this._init();
  }

  async _init() {
    this.style.cssText = "display:block;width:100%;height:100%;";
    // HA 2026.8부터 ha-panel-custom이 display:block이 되어 높이 기준점이 됐는데
    // 자체 높이가 없어 iframe이 기본 150px로 줄어든다 (frontend#53127)
    if (this.parentElement) this.parentElement.style.height = "100%";

    this._view = new KakaoMapView(this, {
      apiKey: this._panel.config.api_key,
      fullscreen: true,
    });
    if (this._hass) this._view.hass = this._hass;
    await this._view.init();

    this._menuBtn = this._view.document.getElementById("menu-btn");
    this._menuBtn.addEventListener("click", () => {
      this.dispatchEvent(
        new CustomEvent("hass-toggle-menu", { bubbles: true, composed: true })
      );
    });
    this._updateMenuButton();
  }

  // 좁은 화면에선 HA가 사이드바를 숨기고 각 패널이 메뉴 버튼을 띄우는 구조라,
  // 전체 화면 iframe인 이 패널은 직접 버튼을 띄워야 사이드바를 열 수 있다
  _updateMenuButton() {
    if (!this._menuBtn) return;
    this._menuBtn.hidden = !(
      this._narrow || this._hass?.dockedSidebar === "always_hidden"
    );
  }
}

customElements.define("kakao-map-panel", KakaoMapPanel);
