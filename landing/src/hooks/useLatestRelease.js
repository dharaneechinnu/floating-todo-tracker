import { useEffect, useState } from "react";

const REPO = "dharaneechinnu/floating-todo-tracker";
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
export const ALL_RELEASES_URL = `https://github.com/${REPO}/releases`;
export const REPO_URL = `https://github.com/${REPO}`;

function findAsset(assets, matcher) {
  return assets.find((a) => matcher(a.name.toLowerCase())) || null;
}

export function useLatestRelease() {
  const [state, setState] = useState({ status: "loading", release: null, assets: {} });

  useEffect(() => {
    let cancelled = false;

    fetch(API_URL)
      .then((r) => {
        if (!r.ok) throw new Error("no release");
        return r.json();
      })
      .then((release) => {
        if (cancelled) return;
        const assets = release.assets || [];
        setState({
          status: "ready",
          release,
          assets: {
            win: findAsset(assets, (n) => n.endsWith(".exe")),
            mac: findAsset(assets, (n) => n.endsWith(".dmg")),
            linux: findAsset(assets, (n) => n.endsWith(".appimage")),
            deb: findAsset(assets, (n) => n.endsWith(".deb")),
          },
        });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "empty", release: null, assets: {} });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
