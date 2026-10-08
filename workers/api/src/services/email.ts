const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

type BrevoEnv = {
  BREVO_API_KEY?: string;
  BREVO_FROM_EMAIL?: string;
  BREVO_FROM_NAME?: string;
};

/**
 * Sends a transactional email through Brevo's REST API.
 * Throws on any failure — missing config, network error, or a non-2xx
 * response from Brevo — with the real reason in the error message so it
 * shows up in `wrangler tail` / `wrangler tail --format pretty`. Callers
 * that need to keep a generic user-facing response (e.g. forgot-password,
 * to avoid email enumeration) should catch this and log it, not swallow it
 * silently.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  env: BrevoEnv
) {
  if (!env.BREVO_API_KEY) {
    throw new Error("BREVO_API_KEY is not configured");
  }
  if (!env.BREVO_FROM_EMAIL) {
    throw new Error("BREVO_FROM_EMAIL is not configured");
  }

  const response = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "api-key": env.BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender: {
        email: env.BREVO_FROM_EMAIL,
        name: env.BREVO_FROM_NAME || "ZimRent",
      },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!response.ok) {
    // Brevo returns a JSON body like {"code":"...","message":"..."} on
    // failure (bad key, unverified sender, etc.) — surface it verbatim so
    // the real cause shows up in logs instead of a bare "failed to send".
    const body = await response.text();
    console.error(`Brevo send failed (${response.status}): ${body}`);
    throw new Error(`Brevo send failed (${response.status}): ${body}`);
  }
}
