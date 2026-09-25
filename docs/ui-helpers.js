/** Escape untrusted input before inserting it into an HTML template. */
export function escapeHtml(value) {
  const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(value ?? "").replace(/[&<>"']/g, (character) => entities[character]);
}

/**
 * Parse a CSS declaration list into property/value pairs.
 *
 * The application renders geometry through this list instead of an inline
 * `style` attribute, because a Content-Security-Policy without
 * `'unsafe-inline'` silently drops style attributes.
 */
export function parseStyleDeclarations(text) {
  return String(text ?? "")
    .split(";")
    .map((declaration) => {
      const separator = declaration.indexOf(":");
      if (separator < 0) return null;
      const property = declaration.slice(0, separator).trim();
      const value = declaration.slice(separator + 1).trim();
      return property && value ? [property, value] : null;
    })
    .filter(Boolean);
}

/** Schemes a locally generated figure or download may legitimately use. */
const SAFE_RESOURCE_PREFIXES = ["data:image/svg+xml", "data:image/png", "blob:"];

/**
 * Return a resource URL only if its scheme is safe to place in href or src.
 *
 * Artifacts and figures can arrive from a restored project file, and escaping
 * does not neutralize a `javascript:` URL. Anything outside the allowlist is
 * refused rather than rendered.
 */
export function safeResourceUrl(value) {
  const url = String(value ?? "").trim();
  const lowered = url.toLowerCase();
  return SAFE_RESOURCE_PREFIXES.some((prefix) => lowered.startsWith(prefix)) ? url : null;
}

export function finiteNumber(value) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function assessmentTone(code) {
  if (["confirmed_supportive", "supportive_signal"].includes(code)) return "supportive";
  if (["confirmed_contradictory", "contradictory_signal"].includes(code)) return "contradictory";
  return "descriptive";
}

export function hasBalancedMixedDirections(candidate) {
  return candidate.complete_quantity_pairs > 0
    && candidate.decreased_pairs > 0
    && candidate.increased_pairs > 0
    && candidate.decreased_pairs === candidate.increased_pairs;
}

export function displayedAlignment(candidate) {
  return hasBalancedMixedDirections(candidate) ? "uncertain" : candidate.goal_alignment;
}

export function tierNumber(candidate) {
  return Number(String(candidate.tier ?? "Tier 4").split(" ")[1]) || 4;
}
