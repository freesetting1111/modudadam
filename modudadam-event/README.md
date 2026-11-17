# modudadam-event

메인 프론트엔드·백엔드와 독립 배포하는 모두다담 이벤트 앱입니다.

## 로컬 실행

1. `.env.example`을 `.env.local`로 복사합니다.
2. frontend와 backend의 `EVENT_GATEWAY_SHARED_SECRET`에 동일한 32바이트 이상의 임의 문자열을 넣습니다.
3. backend(3004), frontend(3005), event(3006) 순서로 실행합니다.
4. `http://localhost:3005/events`에서 이벤트에 진입합니다. 이벤트 URL을 직접 열면 안전한 입장 절차로 자동 이동합니다.

## 신규 이벤트 추가

1. `app/events/<slug>/page.tsx`를 만들고 최상단에서 `requireEventSession("이벤트번호", "/events/<slug>")`를 호출합니다.
2. 백엔드 `event_definitions`에 이벤트 번호, slug, 배포 URL, 경로, 공개 기간을 등록합니다.
3. 이벤트 전용 API는 이 앱의 `/api/...`를 호출합니다. 프록시가 이벤트 세션을 `x-modudadam-event-session` 헤더로 백엔드에 전달합니다.
4. 이벤트별 응답·참여 데이터는 이벤트 기능용 마이그레이션으로 별도 테이블을 추가하고 `event_id`와 `user_id`를 참조합니다.

이벤트 앱에는 DB 접속 정보나 메인 로그인 쿠키를 넣지 않습니다. 데이터 저장과 권한 검증은 항상 메인 백엔드가 담당합니다.
