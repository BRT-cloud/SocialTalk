# 소셜톡 (SocialTalk)

중학생을 위한 국어 화법 및 사회성 향상 게이미피케이션 학습 플랫폼입니다.

## 주요 기능
- 100단계의 실생활 대화 시나리오 학습
- 캐릭터와 실시간 채팅을 통한 사회성 훈련 (Gemini AI 활용)
- 성취도 분석 및 통계 대시보드
- 아이템 구매 및 미션 시스템
- PWA 지원 (홈 화면에 설치 가능)

## 시작하기

이 프로젝트를 로컬에서 실행하거나 깃허브에 배포하기 전에 필요한 설정입니다.

### 1. 전제 조건
- Node.js (v18 이상 권장)
- Firebase 프로젝트
- Google Gemini API 키

### 2. 환경 변수 설정
프로젝트 루트 폴더에 `.env` 파일을 생성하고 다음 내용을 입력하세요. `.env.example` 파일을 복사하여 사용할 수 있습니다.

```env
# Gemini AI 설정
GEMINI_API_KEY="your_gemini_api_key"

# Firebase 설정 (Firebase 콘솔에서 확인 가능)
VITE_FIREBASE_API_KEY="your_api_key"
VITE_FIREBASE_PROJECT_ID="your_project_id"
VITE_FIREBASE_APP_ID="your_app_id"
VITE_FIREBASE_AUTH_DOMAIN="your_auth_domain"
VITE_FIRESTORE_DATABASE_ID="your_database_id"
VITE_FIREBASE_STORAGE_BUCKET="your_storage_bucket"
VITE_FIREBASE_MESSAGING_SENDER_ID="your_messaging_sender_id"
```

### 3. 설치 및 실행
```bash
# 의존성 설치
npm install

# 로컬 개발 서버 실행
npm run dev
```

## 보안 주의사항
- `.env` 파일은 절대 공개 저장소(GitHub 등)에 올리지 마세요. 이미 `.gitignore`에 포함되어 있습니다.
- Firebase의 '보안 규칙(Security Rules)'을 설정하여 허가되지 않은 데이터 접근을 차단하세요.

## 라이선스
MIT License
