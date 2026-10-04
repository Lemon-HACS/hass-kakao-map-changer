# Kakao Map

Home Assistant의 기본 Leaflet 지도를 [카카오맵](https://map.kakao.com)으로 교체하는 커스텀 통합 구성요소입니다.

## 주요 기능

- 사이드바 Map 패널을 카카오맵으로 교체
- 대시보드에 넣을 수 있는 카카오맵 카드 제공
- `person`, `device_tracker` 엔티티의 GPS 위치를 실시간 표시
- Zone을 반경 원 + MDI 아이콘 라벨로 시각화
- 프로필 사진이 있는 엔티티는 아바타 마커로 표시
- 통합 삭제 시 기본 Leaflet 지도로 자동 복원

## 설치

### HACS (권장)

1. HACS > 우측 상단 점 세 개 메뉴 > Custom repositories
2. URL: `https://github.com/Lemon-HACS/hass-kakao-map-changer`, 카테고리: `Integration`
3. "Kakao Map" 설치 후 Home Assistant 재시작

### 수동 설치

`custom_components/kakao_map` 폴더를 HA 설정 디렉토리에 복사 후 재시작

## 설정

### 1. 카카오 개발자 콘솔 설정 (필수)

[카카오 개발자 콘솔](https://developers.kakao.com/console/app)에서 앱을 만든 뒤, 아래 두 가지를 설정합니다.

1. **카카오맵 사용 설정 켜기**: 앱 > **제품 설정** > **카카오맵** > 사용 설정의 상태를 **ON**으로 변경
2. **도메인 등록**: **내 앱** > 앱 선택 > **플랫폼** > **Web** > **JavaScript SDK 도메인**에 Home Assistant 접속 주소를 추가 (예: `https://hass.example.com`)
   - 집 안에서는 내부 주소(예: `http://192.168.0.10:8123`), 밖에서는 외부 주소로 접속한다면 **두 주소를 모두** 등록해야 합니다.

### 2. 통합 구성요소 추가

1. 설정 > 기기 및 서비스 > 통합 구성요소 추가 > "Kakao Map"
2. 카카오 개발자 콘솔의 **JavaScript 키** 입력 (REST API 키가 아님)

## 대시보드 카드

대시보드 편집 > 카드 추가 > **Kakao Map**을 선택하면 비주얼 편집기에서 설정할 수 있습니다. API 키는 통합 구성요소에 입력한 키를 그대로 사용합니다.

```yaml
type: custom:kakao-map-card
title: 가족 위치
entities:
  - person.lemon
  - zone.home
aspect_ratio: "16:9"
hide_search: false
hide_traffic: false
```

| 옵션 | 설명 |
|---|---|
| `title` | 카드 제목 |
| `entities` | 표시할 `person`, `device_tracker`, `zone` 엔티티 목록. 생략하면 지도 패널과 같이 숨김 처리되지 않은 모든 엔티티를 표시합니다. |
| `aspect_ratio` | 지도 가로세로 비율 (기본값 `1:1`). Masonry 대시보드에서만 적용되며, Sections 대시보드에서는 카드 크기 조절을 따릅니다. |
| `hide_search` | 장소 검색창 숨기기 (기본값 `false`) |
| `hide_traffic` | 교통 정보 버튼 숨기기 (기본값 `false`) |

- 대시보드 스크롤을 방해하지 않도록 마우스 휠 확대는 꺼져 있으며, 확대/축소 버튼을 사용합니다.

### 카드가 "구성 오류"로 표시될 때

카드 스크립트는 HA 화면을 처음 불러올 때 함께 로드되므로, 통합 구성요소를 설치하기 전에 열어 둔 화면에서는 카드를 찾지 못합니다. 설치 후 한 번만 아래 조치를 하면 됩니다.

- **웹 브라우저**: 새로고침
- **모바일 앱**: 앱을 완전히 종료한 뒤 다시 실행. 그래도 같다면 설정 > 컴패니언 앱 > 디버깅 > **프론트엔드 캐시 초기화**

## 작동 원리

1. **패널 교체**: `async_remove_panel`로 기본 Map 패널을 제거하고, `async_register_built_in_panel`로 카카오맵 커스텀 패널을 등록
2. **iframe 격리**: HA의 scoped-custom-element-registry 폴리필이 Kakao Maps SDK의 DOM 조작과 충돌하므로, iframe 내부에서 SDK를 로드하여 클린한 DOM 컨텍스트에서 동작. 패널과 대시보드 카드는 같은 지도 모듈(`kakao-map-core.js`)을 공유
3. **엔티티 렌더링**: `hass.states`에서 `person`/`device_tracker`/`zone` 엔티티를 읽어 마커와 원을 표시. `person` 엔티티와 그 source인 `device_tracker`는 같은 좌표를 공유하므로, 마커가 겹치지 않도록 `device_tracker`는 건너뛰고 프로필 사진이 있는 `person`만 표시

## 제한사항

- Zone 편집기(`/config/zone`)는 HA 내부 컴포넌트를 사용하므로 기본 Leaflet 지도를 유지합니다.

## 요구사항

- Home Assistant 2024.1.0 이상
- 카카오 개발자 JavaScript API 키
