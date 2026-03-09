import { mkdir, readdir, rm } from "node:fs/promises"
import path from "node:path"
import { ChocoLogger } from "choco-logger"

const Log = new ChocoLogger("ExtractData")

const DIST_DIR = path.resolve(import.meta.dir, "../dist")
const DATA_DIR = path.resolve(import.meta.dir, "../data")
const DIRECTORIES_ARCHIVE = path.join(DATA_DIR, "directories.7z")

async function commandExists(command: string): Promise<boolean> {
  try {
    const checker =
      process.platform === "win32"
        ? Bun.spawn({
            cmd: ["where", command],
            stdout: "ignore",
            stderr: "ignore",
          })
        : Bun.spawn({
            cmd: ["which", command],
            stdout: "ignore",
            stderr: "ignore",
          })

    return (await checker.exited) === 0
  } catch {
    return false
  }
}

async function find7zBinary(): Promise<string> {
  const directCandidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\7-Zip\\7z.exe",
          "C:\\Program Files (x86)\\7-Zip\\7z.exe",
        ]
      : []

  for (const candidate of directCandidates) {
    if (await Bun.file(candidate).exists()) {
      return candidate
    }
  }

  const pathCandidates =
    process.platform === "win32"
      ? ["7zz.exe", "7z.exe", "7zz", "7z"]
      : ["7zz", "7z"]

  for (const candidate of pathCandidates) {
    if (await commandExists(candidate)) {
      return candidate
    }
  }

  throw new Error(
    "7-Zip executable not found. Install 7-Zip (or 7zz) and make sure it is in PATH.",
  )
}

async function findFirstSplitArchive(): Promise<string> {
  const entries = await readdir(DIST_DIR, { withFileTypes: true })
  const splitParts = entries
    .filter((entry) => entry.isFile() && /\.7z\.001$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))

  if (splitParts.length === 0) {
    throw new Error(`No .7z.001 file found in ${DIST_DIR}`)
  }

  if (splitParts.length > 1) {
    Log.info(`[WARN] Multiple .001 archives found. Using: ${splitParts[0]}`)
  }

  return path.join(DIST_DIR, splitParts[0])
}

async function extractArchive(
  sevenZip: string,
  archivePath: string,
  outputDir: string,
  errorLabel: string,
): Promise<void> {
  const proc = Bun.spawn({
    cmd: [sevenZip, "x", archivePath, `-o${outputDir}`, "-y"],
    stdout: "inherit",
    stderr: "inherit",
  })

  const exitCode = await proc.exited
  if (exitCode !== 0) {
    throw new Error(`${errorLabel} failed with exit code ${exitCode}`)
  }
}

export async function extractData(): Promise<void> {
  const sevenZip = await find7zBinary()
  const archivePath = await findFirstSplitArchive()

  await rm(DATA_DIR, { recursive: true, force: true })
  await mkdir(DATA_DIR, { recursive: true })

  Log.info(`Extracting: ${archivePath}`)
  Log.info(`Output: ${DATA_DIR}`)

  await extractArchive(sevenZip, archivePath, DATA_DIR, "Primary 7z extraction")

  if (await Bun.file(DIRECTORIES_ARCHIVE).exists()) {
    Log.info(`Extracting nested archive: ${DIRECTORIES_ARCHIVE}`)
    await extractArchive(
      sevenZip,
      DIRECTORIES_ARCHIVE,
      DATA_DIR,
      "Nested directories.7z extraction",
    )
  } else {
    Log.info("Nested archive not found: directories.7z")
  }

  Log.info("Extraction completed.")
}

if (import.meta.main) {
  extractData().catch((error) => {
    Log.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
