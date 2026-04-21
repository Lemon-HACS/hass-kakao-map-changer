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

## 동작 방식

기본 `map` 패널을 제거하고 카카오맵 기반 커스텀 패널을 등록합니다.
Kakao Maps SDK는 HA의 scoped-custom-element-registry와 호환되지 않으므로, iframe 격리를 통해 클린한 DOM 컨텍스트에서 동작합니다.

> **참고**: Zone 편집기(`/config/zone`)는 HA 내부 컴포넌트(`ha-map`)를 사용하며, 이는 iframe 격리가 불가능하여 기본 Leaflet 지도를 유지합니다.

## 요구사항

- Home Assistant 2024.1.0 이상
- HACS (권장)
- 카카오 개발자 JavaScript API 키
