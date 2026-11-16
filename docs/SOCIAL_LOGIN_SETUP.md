# 모두다담 소셜 로그인 설정

모두다담은 카카오·네이버 소셜 로그인을 기본 인증 수단으로 사용합니다. 일반 아이디 회원가입과 로그인은 소스에 보존하되 `LOCAL_AUTH_ENABLED=false`일 때 화면과 API에서 노출하지 않습니다.

## 로컬 개발 콜백 URL

- 카카오: `http://localhost:3005/api/auth/oauth/kakao/callback`
- 네이버: `http://localhost:3005/api/auth/oauth/naver/callback`

프론트엔드의 `/api` 프록시가 OAuth state 쿠키와 세션 쿠키를 같은 출처에서 처리하므로 콜백은 백엔드 3004가 아니라 프론트엔드 3005를 사용합니다.

## 운영 콜백 URL

프론트엔드 도메인이 `https://www.example.com`이라면 다음 주소를 각 개발자센터와 백엔드 환경변수에 동일하게 등록합니다.

- 카카오: `https://www.example.com/api/auth/oauth/kakao/callback`
- 네이버: `https://www.example.com/api/auth/oauth/naver/callback`

## 백엔드 환경변수

```env
LOCAL_AUTH_ENABLED=false

KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
KAKAO_REDIRECT_URI=http://localhost:3005/api/auth/oauth/kakao/callback

NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
NAVER_REDIRECT_URI=http://localhost:3005/api/auth/oauth/naver/callback

OAUTH_SUCCESS_REDIRECT_URL=http://localhost:3005
OAUTH_FAILURE_REDIRECT_URL=http://localhost:3005/login
```

운영 환경에서는 localhost를 실제 프론트엔드 HTTPS 도메인으로 바꿉니다. Client Secret은 프론트엔드 환경변수에 등록하지 않습니다.

## 개발자센터 확인 항목

### 카카오

1. 카카오 로그인 활성화
2. Web 플랫폼 도메인 등록
3. Redirect URI 등록
4. 필요한 개인정보 동의항목 설정
5. 프로필, 이메일, 성별, 연령대, 전화번호 중 실제 사용하는 항목만 신청

### 네이버

1. 서비스 URL 등록
2. Callback URL 등록
3. 제공 정보 사용 목적 입력
4. 닉네임, 이메일, 성별, 연령대, 휴대폰 번호 중 실제 사용하는 항목만 신청
5. 검수용 로그인 흐름과 마이페이지 캡처 준비

## DB

추가 소셜 로그인 테이블은 필요하지 않습니다. 기존 `users`와 `user_oauth_accounts`가 다음 관계를 이미 지원합니다.

```text
users 1명
└─ user_oauth_accounts 1개 이상
   ├─ provider: kakao | naver
   └─ provider_user_id: 공급자별 고유 식별자
```

기존 DB 마이그레이션을 아직 적용하지 않은 환경에서만 백엔드 디렉터리에서 `npm run db:apply`를 실행합니다.
