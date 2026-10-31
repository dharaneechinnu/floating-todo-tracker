import { useEffect } from "react";

// Adds `is-in` to every [data-reveal] element the first time it scrolls into
// view. Content is always visible without it: the class only triggers a
// short transform-based entrance, never an opacity fade from zero.
export function useReveal() {
  useEffect(() => {
    const els = [...document.querySelectorAll("[data-reveal]")];
    if (!("IntersectionObserver" in window)) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
