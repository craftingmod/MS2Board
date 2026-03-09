import { createHash } from "node:crypto"
import { hash } from "bun"
import { createReadStream } from "node:fs"
import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { ChocoLogger } from "choco-logger"

const OWNER = "craftingmod"
const REPO = "ms2archive"
const TAG = "v250529-shutdown"

type GithubReleaseAsset = {
  name: string
  browser_download_url: string
  digest?: null // sha256:<hash>
  size: number 
}

type GithubReleaseResponse = {
  assets: GithubReleaseAsset[]
}

const Log = new ChocoLogger("FetchData")

const DIST_DIR = path.resolve(import.meta.dir, "../dist")
const RELEASE_API_URL = `https://api.github.com/repos/${OWNER}/${REPO}/releases/tags/${TAG}`
const ARCHIVE_PATTERN = /\.7z(\.\d+)?$/i

function parseSha256Digest(digest?: string): string | null {
  if (!digest) {
    return null
  }

  const [algorithm, hex] = digest.split(":", 2)
  if (algorithm?.toLowerCase() !== "sha256" || !hex) {
    return null
  }

  return hex.toLowerCase()
}

async function getFileSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256")
  const stream = createReadStream(filePath)

  for await (const chunk of stream) {
    hash.update(chunk)
  }

  return hash.digest("hex").toLowerCase()
}

export async function fetchData(): Promise<void> {
  await mkdir(DIST_DIR, { recursive: true })

  const releaseRes = await fetch(RELEASE_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "ms2board-build-fetcher",
    },
  })

  if (!releaseRes.ok) {
    throw new Error(
      `Failed to read release metadata (${releaseRes.status} ${releaseRes.statusText})`,
    )
  }

  const release = (await releaseRes.json()) as GithubReleaseResponse
  const assets = release.assets.filter((asset) =>
    ARCHIVE_PATTERN.test(asset.name),
  )

  if (assets.length === 0) {
    throw new Error(
      `No matching .7z assets were found in release tag "${TAG}".`,
    )
  }
  Log.info(`Assets found: ${assets.map((v) => v.name).join(",")}`)

  for (const asset of assets) {
    const outPath = path.join(DIST_DIR, asset.name)
    // const expectedHash = parseSha256Digest(asset.digest)
    const file = Bun.file(outPath)
    const exists = await file.exists()

    // This release does not support hash lmao
    if (exists) {
      Log.info(`Skipped (already exist): ${asset.name}`)
      continue
    }
    /*
    if (exists && expectedHash) {
      const currentHash = await getFileSha256(outPath)
      if (currentHash === expectedHash) {
        Log.info(`Skipped (already valid): ${asset.name}`)
        continue
      }

      Log.warning(`[WARN] Hash mismatch, re-downloading: ${asset.name}`)
      await rm(outPath, { force: true })
    }

    if (exists && !expectedHash) {
      Log.warning(`[WARN] No digest provided, forcing re-download: ${asset.name}`)
      await rm(outPath, { force: true })
    }
    */

    Log.info(`Fetching asset: ${asset.name}`)
    const assetRes = await fetch(asset.browser_download_url, {
      headers: {
        Accept: "application/octet-stream",
        "User-Agent": "ms2board-build-fetcher",
      },
    })

    if (!assetRes.ok) {
      throw new Error(
        `Failed to download "${asset.name}" (${assetRes.status} ${assetRes.statusText})`,
      )
    }

    if (assetRes.body == null) {
      throw new Error(
        `Failed to fetch body "${asset.name}" (${assetRes.status} ${assetRes.statusText})`,
      )
    }

    const reader = assetRes.body.getReader()
    const writer = Bun.file(outPath).writer({
      highWaterMark: 1024 * 1024 * 100,
    })
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      writer.write(value)
    }
    writer.end()

    /*
    if (expectedHash) {
      const downloadedHash = await getFileSha256(outPath)
      if (downloadedHash !== expectedHash) {
        await rm(outPath, { force: true })
        throw new Error(`Downloaded file hash mismatch for "${asset.name}"`)
      }
    }
    */

    Log.info(`Downloaded: ${asset.name}`)
  }
}

if (import.meta.main) {
  fetchData().catch((error) => {
    Log.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
