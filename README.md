# Kakao Map

Home Assistant의 기본 Leaflet 지도를 [카카오맵](https://map.kakao.com)으로 교체하는 커스텀 통합 구성요소입니다.

## 주요 기능

- 사이드바 Map 패널을 카카오맵으로 교체
- `person`, `device_tracker` 엔티티의 GPS 위치를 실시간 표시
- Zone을 반경 원 + MDI 아이콘 라벨로 시각화
- 프로필 사진이 있는 엔티티는 아바타 마커로 표시
- 통합 삭제 시 기본 Leaflet 지도로 자동 복원

## 설치

### HACS (권장)

1. HACS > 통합 구성요소 > 우측 상단 메뉴 > 사용자 정의 저장소
2. URL: `https://github.com/Lemon-HACS/hass-kakao-map-changer`, 카테고리: `통합 구성요소`
3. "Kakao Map" 설치 후 Home Assistant 재시작

### 수동 설치

`custom_components/kakao_map` 폴더를 HA 설정 디렉토리에 복사 후 재시작

## 설정

1. 설정 > 기기 및 서비스 > 통합 구성요소 추가 > "Kakao Map"
2. [카카오 개발자 사이트](https://developers.kakao.com)에서 발급받은 **JavaScript API 키** 입력

> 카카오 개발자 사이트에서 앱의 플랫폼 설정에 HA 도메인/IP를 등록해야 합니다.

## 작동 원리

1. **패널 교체**: `async_remove_panel`로 기본 Map 패널을 제거하고, `async_register_built_in_panel`로 카카오맵 커스텀 패널을 등록
2. **iframe 격리**: HA의 scoped-custom-element-registry 폴리필이 Kakao Maps SDK의 DOM 조작과 충돌하므로, iframe 내부에서 SDK를 로드하여 클린한 DOM 컨텍스트에서 동작
3. **엔티티 렌더링**: `hass.states`에서 `person`/`device_tracker`/`zone` 엔티티를 읽어 마커와 원을 표시. `person`의 source인 `device_tracker`는 중복 방지를 위해 건너뜀

## 제한사항

- Zone 편집기(`/config/zone`)는 HA 내부 컴포넌트를 사용하므로 기본 Leaflet 지도를 유지합니다.

## 요구사항

- Home Assistant 2024.1.0 이상
- 카카오 개발자 JavaScript API 키
