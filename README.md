# Jihong Min

Astro 정적 개인 사이트. 한국어와 영어의 홈, 연구, 영화, 글 페이지를 생성해 GitHub Pages에 게시한다.

## 로컬 실행

Node.js 22.19 이상이 필요하다.

```sh
npm ci
npm test
npm run dev
```

`npm run build`는 `dist/`에 게시 파일을 만든다. `/`에서 한국어 홈으로 이동한다. 홈에서 연구·영화·글로 바로 이동할 수 있고, 언어 전환은 같은 페이지의 다른 언어 버전으로 연결된다. 사이트 소개와 연구 문구는 `src/lib/copy.mjs`에서 관리한다. CV는 `public/Jihong_Min_CV_2026_.pdf`다.

## 영화 목록 갱신

원본 Watcha Pedia 추출 CSV를 저장소 최상단의 `movie.csv`로 놓고 다음을 실행한다. 원본은 `.gitignore`로 제외된다.

```sh
npm run import:movies
npm test
npm run build
```

가져오기는 `MOVIE` 행만 선택해 `src/data/movies.json`에 저장한다. 필수 열은 `ID`, `URL`, `Title`, `Type`, `Year`, `WatchedAt`, `Rating`, `Review`, `Spoiler`다. 중복 ID는 첫 항목을 사용하며, 추출기의 `1970-01-01`은 감상일 미상으로 처리한다. 한줄평은 원문으로 표시하고 `Spoiler=true`인 평은 펼치기 전까지 숨긴다. 파일에 잘못된 값이 있으면 기존 JSON을 보존한다. 검증 후 `src/data/movies.json`만 커밋한다.

사이트와 Actions는 Watcha Pedia에서 데이터를 수집하지 않는다. CSV 제공·변환 이후의 게시만 자동화한다.

## Instagram 연결

글 페이지는 [Meta Instagram API with Instagram Login](https://www.postman.com/meta/instagram/folder/6raa77c/instagram-api-with-instagram-login)을 사용한다. `themenostalgia` 프로페셔널 계정으로 앱을 연결하고 `instagram_business_basic` 권한이 있는 액세스 토큰과 Instagram User ID를 준비한다. 두 값은 저장소의 **Settings → Secrets and variables → Actions**에 각각 `INSTAGRAM_ACCESS_TOKEN`, `INSTAGRAM_USER_ID`로 등록한다. 토큰을 저장소 파일이나 브라우저 코드에 넣지 않는다.

Actions의 **Sync Instagram and deploy**를 수동 실행해 첫 조회를 확인한다. 스크립트는 응답 계정의 사용자명이 `themenostalgia`인지 확인하고 모든 페이지를 읽은 뒤 `src/data/instagram.json`을 교체한다. 실패하면 마지막 성공 목록을 보존한다. 최초 성공 전에는 게시물 예시 대신 계정 링크가 표시된다. 로컬에서는 동일한 두 환경 변수를 설정하고 `npm run sync:instagram`으로 확인할 수 있다.

워크플로는 매일 03:17 UTC(한국 시간 12:17)에 실행한다. 토큰 만료 전 새 토큰을 발급해 Secret을 갱신하고, Actions 실행 기록에서 인증 오류와 마지막 성공 시각을 확인한다. GitHub가 장기간 저장소 활동이 없는 예약 작업을 비활성화하면 Actions 화면에서 다시 활성화하고 수동 실행한다. Meta API 권한 또는 필드가 바뀌면 `scripts/instagram-data.mjs`의 요청을 공식 문서와 대조한다.

## GitHub Pages

저장소 **Settings → Pages → Build and deployment**에서 Source를 **GitHub Actions**로 선택한다. `main`에 푸시하면 **Deploy site**가 테스트·빌드 후 `dist/`를 게시한다. Instagram 예약 작업은 스냅샷이 바뀐 경우 그것만 커밋하고 같은 실행에서 사이트를 빌드·배포한다. GitHub Actions의 기본 토큰으로 만든 커밋은 다른 push 워크플로를 자동 시작하지 않으므로 동기화 워크플로에 배포 단계가 포함되어 있다.

직접 만든 영화와 영상 링크는 `src/pages/[lang]/cinema.astro`, 연구 소개는 `src/lib/copy.mjs`에서 관리한다. 별도 연구 코드 링크는 아직 제공되지 않아 임의의 항목으로 채우지 않았다. 읽기 기록과 소유자 추가 화면은 후속 범위다.
