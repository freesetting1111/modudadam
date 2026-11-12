# Modudadam Frontend

모두다담의 모바일 우선 Next.js 프런트엔드입니다. 화면 셸은 최대 600px이며 12개 생활 카테고리, 소셜 로그인, 익명 접근 분석을 제공합니다.

## Getting Started

먼저 `.env.example`을 참고해 `.env`를 설정하고 개발 서버를 실행합니다.

```env
API_URL=http://localhost:3004
```

```bash
npm run dev
```

[http://localhost:3005](http://localhost:3005)에서 확인할 수 있습니다. 백엔드는 기본적으로 `http://localhost:3004`를 사용합니다.

## Vercel 환경변수

프론트엔드 Vercel 프로젝트에는 다음 서버 전용 환경변수를 등록합니다.

```env
API_URL=https://modudadam-backend.vercel.app
```

`NEXT_PUBLIC_API_URL`은 사용하지 않습니다. 브라우저는 프론트엔드의 `/api`를 호출하고, Next.js 서버 라우트가 실행 시점의 `API_URL`을 읽어 백엔드로 요청을 전달합니다. 환경변수를 변경한 뒤에는 새로 배포해야 합니다.

브랜드 캐릭터는 `public/brand/modudadam-squirrel.png`, 파비콘은 `app/icon.png`입니다. 전체 제품·기술 기준은 `../docs/PROJECT_SPEC.md`를 참고합니다.
