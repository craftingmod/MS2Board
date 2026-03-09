const ALLOWED_TAGS = new Set([
  "a",
  "b",
  "br",
  "div",
  "em",
  "font",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "span",
  "strong",
  "u",
  "ul",
])

const ALLOWED_ATTRS = new Set(["style", "size", "href", "src"])

function sanitizeStyle(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  const lowered = trimmed.toLowerCase()
  if (lowered.includes("expression(") || lowered.includes("javascript:")) {
    return null
  }

  return trimmed
}

function sanitizeHref(value: string): string | null {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    return null
  }

  const lowered = trimmed.toLowerCase()
  if (lowered.startsWith("javascript:") || lowered.startsWith("vbscript:")) {
    return null
  }

  return trimmed
}

function toArchiveImagePath(value: string): string | null {
  const normalized = value.trim().replaceAll("\\", "/")
  const lowered = normalized.toLowerCase()

  if (lowered.startsWith("javascript:") || lowered.startsWith("data:")) {
    return null
  }

  if (
    !lowered.startsWith("data/images/") &&
    !lowered.startsWith("/data/images/")
  ) {
    return normalized
  }

  const withoutPrefix = lowered.startsWith("/data/images/")
    ? normalized.slice("/data/images/".length)
    : normalized.slice("data/images/".length)

  const segments = withoutPrefix
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)

  if (segments.length === 0 || segments.some((segment) => segment === "..")) {
    return null
  }

  const fileName = segments[segments.length - 1]
  const dotIndex = fileName.lastIndexOf(".")
  const baseName = dotIndex >= 0 ? fileName.slice(0, dotIndex) : fileName

  if (baseName.length === 0) {
    return null
  }

  segments[segments.length - 1] = `${baseName}.avif`

  return `/images/${segments.join("/")}`
}

function sanitizeSize(value: string): string | null {
  const trimmed = value.trim()
  if (!/^\d{1,2}$/.test(trimmed)) {
    return null
  }

  return trimmed
}

export function sanitizeArchiveHtml(html: string): string {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return html
  }

  const template = document.createElement("template")
  template.innerHTML = html

  const elements = template.content.querySelectorAll("*")
  for (const element of elements) {
    const tag = element.tagName.toLowerCase()

    if (!ALLOWED_TAGS.has(tag)) {
      element.remove()
      continue
    }

    for (const attr of [...element.attributes]) {
      const name = attr.name.toLowerCase()
      if (!ALLOWED_ATTRS.has(name)) {
        element.removeAttribute(attr.name)
        continue
      }

      if (name === "style") {
        const sanitizedStyle = sanitizeStyle(attr.value)
        if (sanitizedStyle) {
          element.setAttribute(attr.name, sanitizedStyle)
        } else {
          element.removeAttribute(attr.name)
        }
        continue
      }

      if (name === "href") {
        const sanitizedHref = sanitizeHref(attr.value)
        if (sanitizedHref) {
          element.setAttribute(attr.name, sanitizedHref)
        } else {
          element.removeAttribute(attr.name)
        }
        continue
      }

      if (name === "src") {
        const sanitizedSrc = toArchiveImagePath(attr.value)
        if (sanitizedSrc) {
          element.setAttribute(attr.name, sanitizedSrc)
        } else {
          element.remove()
        }
        continue
      }

      if (name === "size") {
        const sanitizedSize = sanitizeSize(attr.value)
        if (sanitizedSize) {
          element.setAttribute(attr.name, sanitizedSize)
        } else {
          element.removeAttribute(attr.name)
        }
      }
    }
  }

  for (const commentNode of [...template.content.childNodes]) {
    if (commentNode.nodeType === Node.COMMENT_NODE) {
      commentNode.remove()
    }
  }

  return template.innerHTML
}
