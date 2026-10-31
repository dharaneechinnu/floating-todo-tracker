import { BRAND_SVG } from "../icon-data.js";

export default function BrandMark({ size = 32, className = "" }) {
  return (
    <span
      className={`brandmark ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: BRAND_SVG }}
    />
  );
}
