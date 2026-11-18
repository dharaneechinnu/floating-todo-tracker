// Compares plain x.y.z versions. Anything after "-" (e.g. 0.3.0-beta.1)
// is ignored, which treats a beta as its release — good enough for a
// minimum-version gate.
export function compareVersions(a, b) {
  const parse = (v) => String(v).split("-")[0].split(".").map((n) => Number.parseInt(n, 10) || 0);
  const [x, y] = [parse(a), parse(b)];
  for (let i = 0; i < 3; i += 1) {
    if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) < (y[i] || 0) ? -1 : 1;
  }
  return 0;
}

export function isVersion(value) {
  return typeof value === "string" && /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(value);
}
