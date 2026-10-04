"""카카오맵 통합 - Home Assistant의 기본 지도를 카카오맵으로 교체합니다."""
from __future__ import annotations

import os

from aiohttp import web

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.components.frontend import (
    add_extra_js_url,
    async_register_built_in_panel,
    async_remove_panel,
)
from homeassistant.components.http import HomeAssistantView

from .const import DOMAIN, CONF_API_KEY

VERSION = "1.3.0-beta.2"
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "frontend")
FRONTEND_FILES = frozenset(os.listdir(FRONTEND_DIR))
# 버전을 경로에 넣어 업데이트 시 브라우저 캐시를 우회한다. 모듈끼리 상대 경로로 import하므로 쿼리 대신 경로를 쓴다
FRONTEND_URL = f"/kakao_map_static/{VERSION}"
PANEL_JS = f"{FRONTEND_URL}/kakao-map-panel.js"
CARD_JS = f"{FRONTEND_URL}/kakao-map-card.js"


class FrontendFileView(HomeAssistantView):
    """경로의 버전 부분과 관계없이 현재 프론트엔드 파일을 제공한다.

    카드 JS 주소는 HA 첫 화면(index.html)에 박혀 있어서, 모바일 앱처럼 페이지를 오래 유지하는
    클라이언트는 업데이트 후에도 이전 버전 주소로 요청한다. 이 요청이 404가 되지 않게 한다.
    """

    url = "/kakao_map_static/{version}/{filename}"
    name = "kakao_map:static"
    requires_auth = False

    async def get(self, request: web.Request, version: str, filename: str) -> web.FileResponse:
        if filename not in FRONTEND_FILES:
            raise web.HTTPNotFound()
        return web.FileResponse(os.path.join(FRONTEND_DIR, filename))


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    api_key = entry.data[CONF_API_KEY]

    if not hass.data.get(f"{DOMAIN}_registered"):
        hass.http.register_view(FrontendFileView())
        hass.data[f"{DOMAIN}_registered"] = True
        add_extra_js_url(hass, CARD_JS)

    async_remove_panel(hass, "map", warn_if_unknown=False)

    async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title="지도",
        sidebar_icon="mdi:map",
        frontend_url_path="map",
        config={
            "_panel_custom": {
                "name": "kakao-map-panel",
                "module_url": PANEL_JS,
            },
            "api_key": api_key,
        },
        require_admin=False,
        update=True,
    )

    hass.data[DOMAIN] = {"api_key": api_key}
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    async_remove_panel(hass, "map", warn_if_unknown=False)

    async_register_built_in_panel(
        hass,
        component_name="map",
        sidebar_title="Map",
        sidebar_icon="hass:tooltip-account",
        frontend_url_path="map",
        update=True,
    )

    hass.data.pop(DOMAIN, None)
    return True
