// Fail fast at boot if security-critical config is missing or insecure.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}
