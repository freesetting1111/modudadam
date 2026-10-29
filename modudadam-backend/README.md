# Modudadam Backend

Modudadam의 API 전용 Next.js 백엔드입니다. API는 `app/api` 아래의 Route Handler로 구성합니다.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

기본 주소는 [http://localhost:3004](http://localhost:3004)입니다.

## API

- `GET /api`: API 기본 정보
- `GET /api/health`: 서버 상태 확인

환경변수는 `.env.example`을 참고해 `.env`에 설정합니다.
