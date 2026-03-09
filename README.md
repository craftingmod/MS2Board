# ms2board

`ms2board` is a Bun monorepo for browsing [ms2archive](https://github.com/craftingmod/ms2archive) data from SQLite.

It currently supports:
- Cross-board post listing
- Search by `title OR authorName`
- Post detail rendering (sanitized HTML)
- Image serving from archived assets (`/images/*`, forced to `.avif`)
- Comment viewing in descending order with pagination
- Full-screen event list and page routing from archived FSE HTML (`/events`, `/events/:date/:name`, `/events/:slug`)
- Direct FSE resource routing (`/res/*`)

## Repository Structure

- `packages/build` (`@ms2board/build`): data setup scripts (download/extract)
- `packages/server` (`@ms2board/server`): Bun + SQLite backend API
- `packages/web` (`@ms2board/web`): Svelte + Vite frontend
- `packages/common` (`@ms2board/common`): shared types and board metadata

## Prerequisites

- [Bun](https://bun.sh/) (project developed with Bun v1.3.x)
- 7-Zip (or `7zz`) available in `PATH` for archive extraction

## Install Dependencies

```bash
bun install
```

## Data Setup (What We Use in This Project)

The setup flow used so far is:

1. Download archive parts from the release source
2. Extract the split archive (`.7z.001`) into `packages/build/data`
3. If `packages/build/data/directories.7z` exists, extract it again into the same `data` directory
4. Create SQLite indexes for faster browsing/search

Run commands:

```bash
bun run setup:fetch
bun run setup:extract
bun run setup:indexes
```

Notes:
- If data is already present in `packages/build/data`, you can skip fetch/extract and run only `setup:indexes`.
- `setup:extract` clears and recreates `packages/build/data` before extraction.

## Run Development Servers

Run backend:

```bash
bun run dev:server
```

Run frontend (separate terminal):

```bash
bun run dev:web
```

Default ports:
- Server: `http://localhost:3000`
- Web: `http://localhost:5173`

The web dev server proxies `/api`, `/images`, `/events`, and `/res` to the backend.

## Environment Variables

Backend (`packages/server`):
- `PORT` (default: `3000`)
- `MS2_ARCHIVE_DB_PATH` (default: `packages/build/data/ms2archive.db`)

Frontend (`packages/web`):
- `VITE_API_BASE_URL` (optional, default empty)
- `VITE_PROXY_TARGET` (default: `http://localhost:3000`)

## Useful Commands

```bash
bun run test:server
bun run test:web
bun run eslint
bun run prettier
```

## API Overview

- `GET /api/boards`
- `GET /api/posts?board=&q=&page=&pageSize=&sort=`
- `GET /api/posts/:board/:articleId`
- `GET /api/posts/:board/:articleId/comments?page=&pageSize=`
- `GET /images/...` (served from `packages/build/data/images`, extension normalized to `.avif`)
- `GET /events` (lists archived FSE pages)
- `GET /events/:date/:name` (maps to `packages/build/data/fse/<date>_<name>.html`)
- `GET /events/:slug` (maps to `packages/build/data/fse/<slug>.html`)
- `GET /res/...` (served from `packages/build/data/fse/res/...`)

## Current Scope

Current MVP focuses on archive post browsing/search in `ms2archive.db` plus FSE event page routing.
Other DB files (character/profile/guestbook/rank) are out of current scope.
