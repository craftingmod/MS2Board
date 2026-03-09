# ms2board

`ms2board`는 [ms2archive](https://github.com/craftingmod/ms2archive) 데이터를 웹에서 조회하기 위한 Bun 모노레포입니다.

현재 지원 기능:
- 여러 게시판 통합 목록 조회
- `title OR authorName` 검색
- 게시글 상세 렌더링(HTML 정제 후 표시)
- 아카이브 이미지 제공(`/images/*`, 확장자는 `.avif`로 강제)
- 댓글 최신순(내림차순) 조회 + 페이지네이션

## 저장소 구성

- `packages/build` (`@ms2board/build`): 데이터 다운로드/압축해제 스크립트
- `packages/server` (`@ms2board/server`): Bun + SQLite 백엔드 API
- `packages/web` (`@ms2board/web`): Svelte + Vite 프론트엔드
- `packages/common` (`@ms2board/common`): 공용 타입/보드 메타

## 사전 준비

- [Bun](https://bun.sh/) (현재 프로젝트는 Bun v1.3.x 기준)
- 7-Zip 또는 `7zz` (압축 해제를 위해 `PATH`에서 실행 가능해야 함)

## 의존성 설치

```bash
bun install
```

## 데이터 셋업 (현재 프로젝트에서 사용한 순서)

지금까지의 셋업 과정은 아래 순서입니다.

1. 릴리스에서 분할 압축 파일 다운로드
2. `.7z.001`을 `packages/build/data`로 해제
3. `packages/build/data/directories.7z`가 있으면 같은 `data` 폴더에 한 번 더 해제
4. 조회/검색 성능을 위해 SQLite 인덱스 생성

실행 명령:

```bash
bun run setup:fetch
bun run setup:extract
bun run setup:indexes
```

참고:
- `packages/build/data`가 이미 준비되어 있으면 `setup:fetch`, `setup:extract`를 생략하고 `setup:indexes`만 실행해도 됩니다.
- `setup:extract` 실행 시 `packages/build/data`를 삭제 후 다시 생성하여 해제합니다.

## 개발 서버 실행

백엔드 실행:

```bash
bun run dev:server
```

프론트엔드 실행(별도 터미널):

```bash
bun run dev:web
```

기본 포트:
- 서버: `http://localhost:3000`
- 웹: `http://localhost:5173`

웹 개발 서버는 `/api`, `/images`를 백엔드로 프록시합니다.

## 환경 변수

백엔드(`packages/server`):
- `PORT` (기본값: `3000`)
- `MS2_ARCHIVE_DB_PATH` (기본값: `packages/build/data/ms2archive.db`)

프론트엔드(`packages/web`):
- `VITE_API_BASE_URL` (선택, 기본값 빈 문자열)
- `VITE_PROXY_TARGET` (기본값: `http://localhost:3000`)

## 자주 쓰는 명령어

```bash
bun run test:server
bun run test:web
bun run eslint
bun run prettier
```

## API 개요

- `GET /api/boards`
- `GET /api/posts?board=&q=&page=&pageSize=&sort=`
- `GET /api/posts/:board/:articleId`
- `GET /api/posts/:board/:articleId/comments?page=&pageSize=`
- `GET /images/...` (`packages/build/data/images`에서 서빙, 확장자 `.avif`로 정규화)

## 현재 범위

현재 MVP 범위는 `ms2archive.db`의 게시글 조회/검색입니다.
`ms2char.db`, `ms2profile.db`, `ms2guestbook.db`, `ms2rank.db` 및 이벤트 HTML 라우팅은 현재 범위 밖입니다.
