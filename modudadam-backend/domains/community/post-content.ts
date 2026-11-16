import sanitizeHtml from "sanitize-html";

const IMAGE_ID_PATTERN = /^[0-9a-f-]{36}$/i;

export function normalizePostContentHtml(rawValue: unknown, plainContent: string, imageIds: string[]) {
  let rawHtml = typeof rawValue === "string" ? rawValue : "";
  if (rawHtml.length > 150_000) throw new Error("CONTENT_HTML_TOO_LONG");
  if (!rawHtml) {
    rawHtml = textToHtml(plainContent) + imageIds.map((id) => `<figure data-image-id="${id}"></figure>`).join("");
  }

  const sanitized = sanitizeHtml(rawHtml, {
    allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "blockquote", "ul", "ol", "li", "figure"],
    allowedAttributes: { figure: ["data-image-id"] },
    disallowedTagsMode: "discard",
    enforceHtmlBoundary: true,
  });

  const referencedIds: string[] = [];
  const withoutInvalidFigures = sanitized.replace(
    /<figure(?:\s+data-image-id="([^"]+)")?\s*><\/figure>/gi,
    (_match, imageId: string | undefined) => {
      if (!imageId || !IMAGE_ID_PATTERN.test(imageId)) return "";
      referencedIds.push(imageId);
      return `<figure data-image-id="${imageId}"></figure>`;
    },
  ).replace(/<\/?figure[^>]*>/gi, "");

  const uniqueReferencedIds = [...new Set(referencedIds)];
  const expectedIds = [...new Set(imageIds)];
  if (uniqueReferencedIds.length !== referencedIds.length
    || uniqueReferencedIds.length !== expectedIds.length
    || uniqueReferencedIds.some((id) => !expectedIds.includes(id))) {
    throw new Error("CONTENT_IMAGE_MISMATCH");
  }
  return withoutInvalidFigures.trim() || textToHtml(plainContent);
}

export function renderPostContentHtml(
  rawValue: unknown,
  plainContent: string,
  images: Array<{ id: string; url: string; originalName: string }>,
) {
  const imageIds = images.map((image) => image.id);
  let normalized: string;
  try {
    normalized = normalizePostContentHtml(rawValue, plainContent, imageIds);
  } catch {
    normalized = normalizePostContentHtml(undefined, plainContent, imageIds);
  }
  const imageMap = new Map(images.map((image) => [image.id, image]));
  return normalized.replace(/<figure data-image-id="([0-9a-f-]{36})"><\/figure>/gi, (_match, imageId: string) => {
    const image = imageMap.get(imageId);
    if (!image) return "";
    return `<figure class="post-inline-image"><img src="${escapeAttribute(image.url)}" alt="${escapeAttribute(image.originalName)}" loading="lazy" /></figure>`;
  });
}

function textToHtml(value: string) {
  return value.split(/\n{2,}/).map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`).join("");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] || character);
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
