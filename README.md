# Kakao Map

Home Assistant의 기본 Leaflet 지도를 [카카오맵](https://map.kakao.com)으로 교체하는 커스텀 통합 구성요소입니다.
사이드바 지도 패널과 지역(Zone) 편집기의 지도를 카카오맵으로 변경합니다.

## 주요 기능

- **사이드바 지도 교체**: 기본 Map 패널을 카카오맵 기반 커스텀 패널로 대체
- **Zone 편집기 교체**: 설정 > 지역(config/zone)의 지도를 카카오맵으로 오버라이드
- **실시간 위치 표시**: `person`, `device_tracker` 엔티티의 GPS 위치를 마커로 표시
- **Zone 시각화**: 등록된 Zone을 반경 원으로 표시
- **엔티티 사진 지원**: 프로필 사진이 있는 엔티티는 아바타 마커로 표시
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

| 대상 | 방식 |
|------|------|
| 사이드바 지도 | 기본 `map` 패널을 제거하고 카카오맵 커스텀 패널로 등록 |
| Zone 편집기 | `ha-map`, `ha-locations-editor` 컴포넌트의 prototype을 오버라이드 |

## 요구사항

- Home Assistant 2024.1.0 이상
- HACS (권장)
- 카카오 개발자 JavaScript API 키
