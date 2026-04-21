# Kakao Map

Home Assistant의 기본 Leaflet 지도를 [카카오맵](https://map.kakao.com)으로 교체하는 커스텀 통합 구성요소입니다.
사이드바의 지도 패널을 카카오맵으로 변경합니다.

## 주요 기능

- **사이드바 지도 교체**: 기본 Map 패널을 카카오맵 기반 커스텀 패널로 대체
- **실시간 위치 표시**: `person`, `device_tracker` 엔티티의 GPS 위치를 마커로 표시
- **Zone 시각화**: 등록된 Zone을 반경 원 + MDI 아이콘 라벨로 표시
- **엔티티 사진 지원**: 프로필 사진이 있는 엔티티는 아바타 마커로 표시
- **중복 마커 제거**: `person` 엔티티의 source인 `device_tracker`는 자동으로 건너뜀
- **통합 삭제 시 롤백**: 통합을 제거하면 기본 Leaflet 지도로 자동 복원

## 설치

### HACS (권장)

1. HACS > 통합 구성요소 > 우측 상단 메뉴 > 사용자 정의 저장소
2. URL: `https://github.com/Lemon-HACS/hass-kakao-map-changer`
3. 카테고리: `통합 구성요소`
4. "Kakao Map" 검색 후 설치
5. Home Assistant 재시작

### 수동 설치

1. `custom_components/kakao_map` 폴더를 HA 설정 디렉토리에 복사
2. Home Assistant 재시작

## 설정

1. 설정 > 기기 및 서비스 > 통합 구성요소 추가
2. "Kakao Map" 검색
3. [카카오 개발자 사이트](https://developers.kakao.com)에서 발급받은 **JavaScript API 키** 입력

> **참고**: 카카오 개발자 사이트에서 앱을 생성하고, 플랫폼 설정에서 Home Assistant의 도메인/IP를 등록해야 합니다.

## 작동 원리

### 전체 흐름

```
┌─ __init__.py (Python) ──────────────────────────────────────────┐
│  1. async_remove_panel("map")     ← 기본 Leaflet 패널 제거      │
│  2. async_register_built_in_panel ← 카카오맵 커스텀 패널 등록    │
│  3. async_register_static_paths   ← frontend/ 디렉토리 서빙     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─ kakao-map-panel.js (JavaScript) ───────────────────────────────┐
│  HA가 <kakao-map-panel> 커스텀 엘리먼트 생성                     │
│  → connectedCallback + set panel 후 _init() 실행               │
│                                                                 │
│  _init():                                                       │
│    1. iframe 생성 (src = kakao-map-inner.html)                  │
│    2. iframe 내부에서 Kakao Maps SDK 로드                        │
│    3. iframe.contentWindow.kakao.maps 로 지도 생성               │
│    4. hass.states에서 엔티티/zone 읽어서 마커/원 렌더링           │
└─────────────────────────────────────────────────────────────────┘
```

### iframe 격리가 필요한 이유

HA 프론트엔드는 **scoped-custom-element-registry** 폴리필을 사용합니다. 이 폴리필은 `document.createElement`와 `Node.prototype.insertBefore` 등 DOM API를 패치하여, 커스텀 엘리먼트를 특정 Shadow DOM 스코프에 바인딩합니다.

Kakao Maps SDK는 내부적으로 타일, 마커, 오버레이 등을 렌더링할 때 이 네이티브 DOM API를 직접 호출하는데, 패치된 API에서는 `insertBefore`의 첫 번째 인자가 Node 타입으로 인식되지 않아 `TypeError`가 발생합니다.

이를 해결하기 위해 Kakao Maps SDK를 **iframe 내부에서 로드**합니다. iframe은 독립된 `document` 컨텍스트를 가지므로 폴리필의 영향을 받지 않습니다.

```
┌─ HA 메인 페이지 (패치된 DOM API) ─────────────────────┐
│                                                        │
│  <kakao-map-panel>                                     │
│    └─ <iframe src="kakao-map-inner.html">              │
│         ┌─ 클린한 DOM 컨텍스트 ──────────────────┐     │
│         │  • Kakao Maps SDK 로드                 │     │
│         │  • new kakao.maps.Map(...)             │     │
│         │  • Marker, Circle, CustomOverlay       │     │
│         │  → 네이티브 DOM API 정상 동작           │     │
│         └────────────────────────────────────────┘     │
│                                                        │
│  부모 ↔ iframe 통신:                                    │
│  • iframe.contentWindow.kakao.maps (동일 origin)       │
│  • iframe.contentDocument.createElement (DOM 생성)     │
│  • hass.states 데이터는 부모에서 직접 참조              │
└────────────────────────────────────────────────────────┘
```

### HTTPS Mixed Content 방지

iframe을 `srcdoc`이나 `blob:` URL로 생성하면 `location.protocol`이 `about:`이 되어, Kakao SDK가 내부 스크립트를 `http://`로 로드하려 합니다. HTTPS 사이트에서는 Mixed Content로 차단됩니다.

이를 방지하기 위해 HA 서버에서 직접 서빙하는 HTML 파일(`kakao-map-inner.html`)을 iframe의 `src`로 사용하여, iframe 내부의 `location.protocol`이 `https:`가 되도록 합니다.

### 엔티티 렌더링

| 대상 | 조건 | 마커 타입 |
|------|------|-----------|
| `person.*` | `entity_picture` 있음 | 원형 아바타 (프로필 사진) |
| `person.*` | `entity_picture` 없음 | 파란 원형 + person SVG 아이콘 |
| `device_tracker.*` | `person`의 `source`에 해당 | 건너뜀 (중복 방지) |
| `device_tracker.*` | 독립적 | person과 동일 규칙 |
| `zone.*` | `zone.home` | 주황색 원 + 🏠 MDI 라벨 |
| `zone.*` | 기타 | 파란색 원 + MDI 아이콘 라벨 |

### 파일 구조

```
custom_components/kakao_map/
├── __init__.py          # 패널 등록/해제, 정적 파일 서빙
├── config_flow.py       # Config Flow (API 키 입력)
├── const.py             # DOMAIN, CONF_API_KEY 상수
├── manifest.json        # HACS/HA 통합 메타데이터
├── strings.json         # 기본 UI 문자열
├── translations/        # 다국어 지원
│   ├── en.json
│   └── ko.json
├── brand/               # HA 통합 아이콘
│   ├── icon.png
│   └── logo.png
└── frontend/
    ├── kakao-map-panel.js    # 커스텀 패널 Web Component
    └── kakao-map-inner.html  # iframe용 빈 HTML (HTTPS 보장)
```

### 캐시 버스팅

JS 파일 URL에 `?v={VERSION}` 파라미터를 추가하여, 통합 업데이트 시 브라우저 캐시가 자동으로 무효화됩니다.

## 제한사항

- Zone 편집기(`/config/zone`)는 HA 내부 컴포넌트(`ha-map`)를 사용하며, 이 컴포넌트는 HA의 Shadow DOM 내부에 있어 iframe 격리가 불가능하므로 기본 Leaflet 지도를 유지합니다.

## 요구사항

- Home Assistant 2024.1.0 이상
- HACS (권장)
- 카카오 개발자 JavaScript API 키
