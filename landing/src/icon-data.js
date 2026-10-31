// The FocusDock brand mark: a dark "screen" tile with two lines of work on
// the left, and the orange bubble docked on its right edge. The bubble is
// clipped by the tile, so it peeks out the way the real app does, with a
// pending badge. Kept as an SVG string so the same mark can be both the
// favicon (data URI) and inline markup.
export const BRAND_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><defs><linearGradient id="fdg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFA552"/><stop offset=".55" stop-color="#FF7A1A"/><stop offset="1" stop-color="#E85D04"/></linearGradient><clipPath id="fdc"><rect x="2" y="2" width="44" height="44" rx="13"/></clipPath></defs><rect x="2" y="2" width="44" height="44" rx="13" fill="#1A1613"/><rect x="9" y="15" width="15" height="3.4" rx="1.7" fill="#fff" opacity=".42"/><rect x="9" y="22.3" width="10" height="3.4" rx="1.7" fill="#fff" opacity=".28"/><rect x="9" y="29.6" width="13" height="3.4" rx="1.7" fill="#fff" opacity=".2"/><g clip-path="url(#fdc)"><circle cx="41" cy="24" r="13" fill="url(#fdg)"/><path d="M31.6 24.4l3.1 3.1 5.6-6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></g><circle cx="31" cy="11.5" r="4.2" fill="#FF3B30" stroke="#1A1613" stroke-width="2"/></svg>`;

export const ICON_DATA_URI = `data:image/svg+xml,${encodeURIComponent(BRAND_SVG)}`;
