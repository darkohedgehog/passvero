import type { AuthEmailMessage } from "@/src/application/auth/auth-email";

export class AuthEmailTemplateError extends Error {
  readonly code = "UNTRUSTED_URL";

  constructor() {
    super("Authentication email URL is invalid.");
    this.name = "AuthEmailTemplateError";
  }
}

export interface RenderedAuthEmail {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

const copy = {
  en: {
    verify: "Verify your Passvero email",
    reset: "Reset your Passvero password",
    changedSubject: "Your Passvero password was changed",
    changedBody: "Your Passvero password was changed. Sign in again to continue.",
    continue: "Continue securely",
  },
  hr: {
    verify: "Potvrdite svoju Passvero adresu e-pošte",
    reset: "Ponovno postavite Passvero lozinku",
    changedSubject: "Vaša Passvero lozinka je promijenjena",
    changedBody: "Vaša Passvero lozinka je promijenjena. Ponovno se prijavite za nastavak.",
    continue: "Nastavite sigurno",
  },
} as const;

export function renderAuthEmail(
  message: AuthEmailMessage,
  canonicalOrigin: string,
): RenderedAuthEmail {
  const locale = message.locale ?? "en";
  const language = copy[locale === "hr" ? "hr" : "en"];
  if (message.type === "CONTROLLED_ACTIVATION") {
    const labels = { hr: "Odobren vam je pristup Passveru. Aktivirajte račun u roku od 72 sata", en: "Your Passvero access is approved. Activate your account within 72 hours", de: "Ihr Passvero-Zugang wurde genehmigt. Aktivieren Sie Ihr Konto innerhalb von 72 Stunden", sr: "Odobren vam je pristup Passveru. Aktivirajte nalog u roku od 72 sata", sl: "Vaš dostop do Passvera je odobren. Aktivirajte račun v 72 urah", pl: "Twój dostęp do Passvero został zatwierdzony. Aktywuj konto w ciągu 72 godzin" };
    const label = labels[locale];
    const url = assertCanonicalUrl(message.activationUrl, canonicalOrigin);
    return { subject: label, text: `${label}:\n${url.href}`, html: `<p>${label}:</p><p><a href="${escapeHtml(url.href)}">${label}</a></p>` };
  }

  if (message.type === "PASSWORD_CHANGED") {
    return {
      subject: language.changedSubject,
      text: language.changedBody,
      html: `<p>${language.changedBody}</p>`,
    };
  }

  const url = assertCanonicalUrl(
    message.type === "VERIFY_EMAIL"
      ? message.verificationUrl
      : message.resetUrl,
    canonicalOrigin,
  );
  const label = message.type === "VERIFY_EMAIL"
    ? language.verify
    : language.reset;

  return {
    subject: label,
    text: `${label}:\n${url.href}`,
    html: `<p>${label}:</p><p><a href="${escapeHtml(url.href)}">${language.continue}</a></p>`,
  };
}

function assertCanonicalUrl(value: string, canonicalOrigin: string): URL {
  let url: URL;
  let origin: URL;
  try {
    url = new URL(value);
    origin = new URL(canonicalOrigin);
  } catch {
    throw new AuthEmailTemplateError();
  }

  if (
    origin.protocol !== "https:"
    || origin.origin !== canonicalOrigin
    || origin.pathname !== "/"
    || origin.search.length > 0
    || origin.hash.length > 0
    || url.protocol !== "https:"
    || url.origin !== origin.origin
    || url.username.length > 0
    || url.password.length > 0
  ) {
    throw new AuthEmailTemplateError();
  }

  return url;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
