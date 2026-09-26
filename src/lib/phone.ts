export type Country = { code: string; name: string; dial: string };

/** Liste courte et modifiable. Le Rwanda est proposé en premier. */
export const COUNTRIES: Country[] = [
  { code: "RW", name: "Rwanda", dial: "250" },
  { code: "BI", name: "Burundi", dial: "257" },
  { code: "CD", name: "RD Congo", dial: "243" },
  { code: "UG", name: "Ouganda", dial: "256" },
  { code: "KE", name: "Kenya", dial: "254" },
  { code: "TZ", name: "Tanzanie", dial: "255" },
  { code: "BE", name: "Belgique", dial: "32" },
  { code: "FR", name: "France", dial: "33" },
  { code: "CA", name: "Canada", dial: "1" },
  { code: "US", name: "États-Unis", dial: "1" },
  { code: "CH", name: "Suisse", dial: "41" },
  { code: "GB", name: "Royaume-Uni", dial: "44" },
  { code: "ZA", name: "Afrique du Sud", dial: "27" },
];

/** Construit un numéro international normalisé E.164 (+ et chiffres seulement). */
export function toE164(dial: string, local: string): string | null {
  const digits = local.replace(/\D/g, "").replace(/^0+/, "");
  const d = dial.replace(/\D/g, "");
  if (digits.length < 6 || digits.length > 14) return null;
  return `+${d}${digits}`;
}

export function digitsOnly(e164: string): string {
  return e164.replace(/\D/g, "");
}

export function formatPhoneForDisplay(e164: string): string {
  return e164.replace(/(\+\d{1,3})(\d{3})(\d{3})(\d+)/, "$1 $2 $3 $4");
}

/** Lien officiel « Click to Chat » de WhatsApp. */
export function whatsappLink(e164: string, message: string): string {
  return `https://wa.me/${digitsOnly(e164)}?text=${encodeURIComponent(message)}`;
}

export function defaultWhatsappMessage(theirName: string | null, myName: string | null): string {
  if (theirName && myName) {
    return `Bonjour ${theirName}, c'est ${myName}. Je t'ai retrouvé(e) sur notre arbre familial et je voulais te saluer !`;
  }
  return "Bonjour ! Je t'ai retrouvé(e) sur notre arbre familial et je voulais te saluer !";
}
