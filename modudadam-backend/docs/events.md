# 독립 이벤트 프로젝트 운영

이벤트 UI는 `modudadam-event`, 데이터와 권한은 `modudadam-backend`, 이벤트 진입 링크는 `modudadam-frontend`가 담당합니다. 이벤트 앱에는 DB 자격 증명을 두지 않습니다.

## 배포 환경변수

### modudadam-frontend

```env
API_URL=https://<backend-domain>
EVENT_GATEWAY_SHARED_SECRET=<backend와 동일한 32바이트 이상 임의 문자열>
```

### modudadam-backend

```env
FRONTEND_URL=https://<frontend-domain>
MODUDADAM_EVENT_URL=https://<event-domain>
EVENT_GATEWAY_SHARED_SECRET=<frontend와 동일한 문자열>
```

### modudadam-event

```env
MODUDADAM_MAIN_URL=https://<frontend-domain>
MODUDADAM_BACKEND_URL=https://<backend-domain>
MODUDADAM_EVENT_URL=https://<event-domain>
```

`EVENT_ASSET_PREFIX`는 이벤트 정적 파일을 별도 CDN에서 서비스할 때만 설정합니다.

`local_event_base_url`은 로컬 개발 전용입니다. 운영에서는 백엔드의
`MODUDADAM_EVENT_URL`이 최우선으로 사용되며, 이 값이 없으면 각 이벤트의
`event_base_url`을 사용합니다. 운영 주소가 둘 다 없거나 localhost라면 진입을
중단해 잘못된 localhost 리다이렉트를 방지합니다.

## 신규 이벤트 등록 예시

먼저 `modudadam-event/app/events/<slug>/page.tsx`를 구현한 뒤 아래처럼 등록합니다.

```sql
INSERT INTO event_definitions (
  event_no, slug, title, description, badge, status, is_listed,
  display_order, event_base_url, local_event_base_url,
  entry_path, result_path, starts_at, ends_at
) VALUES (
  '2', 'my-event', '새 이벤트', '이벤트 설명', 'NEW', 'active', TRUE,
  2, 'https://<event-domain>', 'http://localhost:3006',
  '/events/my-event', '/events/my-event/result',
  '2026-12-01 00:00:00+09', '2026-12-31 23:59:59+09'
);
```

공개 전에는 `status='draft'`, `is_listed=FALSE`로 등록합니다. 중단은 `paused`, 종료 후에는 `ended`로 바꿉니다.

## 이벤트별 응답 데이터

공통 게이트웨이 테이블에 이벤트 응답을 JSON으로 몰아넣지 않습니다. 이벤트마다 필요한 컬럼과 인덱스가 다르므로 별도 테이블을 만들고 `event_id`, `user_id`를 참조합니다.

```sql
CREATE TABLE my_event_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES event_definitions(id),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_my_event_entries_event_created
  ON my_event_entries(event_id, created_at DESC);
CREATE INDEX idx_my_event_entries_user
  ON my_event_entries(user_id, created_at DESC) WHERE user_id IS NOT NULL;
```

이벤트 전용 백엔드 API에서는 `requireEventRequestSession(request, eventNo)`로 이벤트 세션을 검증한 뒤 저장합니다.

## 운영 체크

- 프론트엔드와 백엔드의 게이트웨이 비밀키가 정확히 같아야 합니다.
- Vercel Deployment Protection이 켜져 있으면 백엔드와 이벤트 앱 간 서버 요청이 막히므로 Production 배포는 공개 접근 가능해야 합니다.
- `event_base_url`, `MODUDADAM_EVENT_URL`, OAuth 콜백 URL은 서로 다른 개념입니다. 이벤트 도메인을 OAuth 콜백에 추가할 필요는 없습니다.
- 만료된 `event_entry_tickets`와 `event_sessions`는 정기 작업으로 삭제할 수 있습니다.

```sql
DELETE FROM event_entry_tickets WHERE expires_at < NOW() - INTERVAL '7 days';
DELETE FROM event_sessions WHERE expires_at < NOW() - INTERVAL '7 days';
```
