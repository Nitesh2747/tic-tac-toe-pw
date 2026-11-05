// Settings that are legal but probably wrong when the server runs for real.
// Returns a list of warnings (an empty list means nothing looks off).
export function getStartupWarnings({ env, trustProxy, origins }) {
  const warnings = [];
  const deployed = Boolean(env.RENDER) || env.NODE_ENV === "production";

  if (deployed && !trustProxy) {
    warnings.push(
      "TRUST_PROXY is not 'true' but this looks like a hosted server. Behind a proxy every player " +
        "would appear to share one address, so per-address limits would hit everybody at once."
    );
  }
  if (origins.includes("*")) {
    warnings.push("CLIENT_ORIGIN contains '*': any website could connect. List your site's exact address.");
  }
  if (deployed && origins.every((origin) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin))) {
    warnings.push("CLIENT_ORIGIN only lists localhost, so your real website will be refused.");
  }
  return warnings;
}
