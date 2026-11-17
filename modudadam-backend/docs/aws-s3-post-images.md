# 게시글 이미지용 Amazon S3 설정

## 1. IAM 권한

백엔드 전용 IAM 사용자에 아래 정책만 연결합니다. 브라우저나 프런트엔드 환경 변수에는 액세스 키를 넣지 않습니다.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ModudadamPostImages",
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::modudadam-bucket/posts/*"
    }
  ]
}
```

IAM 사용자에서 액세스 키를 만든 뒤 아래 두 값을 한 번만 안전하게 보관합니다.

- Access key ID → `AWS_ACCESS_KEY_ID`
- Secret access key → `AWS_SECRET_ACCESS_KEY`

## 2. 버킷 CORS

S3 콘솔의 `modudadam-bucket` → 권한 → CORS에 아래 설정을 저장합니다.

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedOrigins": [
      "http://localhost:3005",
      "https://modudadam-frontend.vercel.app"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

실제 운영 도메인을 연결하면 `AllowedOrigins`에 그 주소도 추가합니다. 버킷의 퍼블릭 액세스 차단은 켜 둡니다.

## 3. 백엔드 환경 변수

로컬 `modudadam-backend/.env`와 Vercel 백엔드 프로젝트의 Production 환경 변수에 설정합니다.

```dotenv
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET=modudadam-bucket
AWS_ACCESS_KEY_ID=발급받은_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=발급받은_SECRET_ACCESS_KEY
AWS_S3_PUBLIC_BASE_URL=
```

`AWS_REGION`은 버킷의 속성 화면에 표시되는 실제 리전 코드와 같아야 합니다. CloudFront를 나중에 연결하기 전까지 `AWS_S3_PUBLIC_BASE_URL`은 비워 둡니다.

환경 변수를 저장한 뒤 백엔드를 다시 배포합니다.

## 4. DB 반영

백엔드 디렉터리에서 다음 명령으로 `015_post_images.sql`과 `016_community_activity_reports.sql`을 포함한 마이그레이션을 반영합니다.

```powershell
npm run db:apply
```

현재 업로드 제한은 게시글당 10장, 파일당 10MB이며 JPG, PNG, WebP만 허용합니다. 본문 편집기에서 Ctrl+V로 클립보드 이미지를 붙여넣을 수 있습니다.

## 5. 객체 키 구조

신규 이미지는 다음 키로 저장합니다.

```text
posts/images/YYYY/MM/DD/{userId}/{uuid}.{ext}
```

S3의 폴더는 실제 디렉터리가 아니라 객체 키의 접두사입니다. 게시판마다 버킷이나 최상위 폴더를 나누지 않고, 콘텐츠 종류와 날짜를 접두사로 사용하면 수명주기 규칙·삭제 작업·비용 분석을 일관되게 적용할 수 있습니다. 기존 `posts/{userId}/...` 객체도 이동하지 않고 계속 읽을 수 있습니다.

연결 상태는 S3 폴더가 아니라 PostgreSQL `post_images.post_id`, `status`, `sort_order`로 관리합니다.
