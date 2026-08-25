import { isIP } from "node:net";
import { domainToASCII } from "node:url";

const accountError = "Auth abuse account identifier is invalid.";

export function canonicalizeAuthAccountIdentifier(value: string): string {
  const normalized = value.trim().normalize("NFC");
  const separator = normalized.indexOf("@");
  if (
    separator <= 0
    || separator !== normalized.lastIndexOf("@")
    || separator === normalized.length - 1
  ) {
    throw new Error(accountError);
  }

  const local = normalized.slice(0, separator).toLowerCase();
  const domain = domainToASCII(normalized.slice(separator + 1).toLowerCase());
  if (
    local.length === 0
    || domain.length === 0
    || domain.startsWith(".")
    || domain.endsWith(".")
    || domain.includes("..")
  ) {
    throw new Error(accountError);
  }
  return `${local}@${domain}`;
}

export type TrustedClientNetwork = Readonly<{
  addressFamily: "IPV4" | "IPV6";
  networkKey: string;
}>;

export function normalizeTrustedClientNetwork(
  trustedClientAddress: string | undefined,
): TrustedClientNetwork | null {
  if (
    trustedClientAddress === undefined
    || trustedClientAddress.length === 0
    || trustedClientAddress.trim() !== trustedClientAddress
    || trustedClientAddress.includes(",")
    || trustedClientAddress.includes("%")
  ) {
    return null;
  }

  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(
    trustedClientAddress,
  );
  const candidate = mapped?.[1] ?? trustedClientAddress;
  const family = isIP(candidate);
  if (family === 4) {
    const octets = candidate.split(".").map(Number);
    return {
      addressFamily: "IPV4",
      networkKey: `${octets[0]}.${octets[1]}.${octets[2]}.0/24`,
    };
  }
  if (family !== 6) {
    return null;
  }

  const words = parseIpv6(candidate);
  if (words === null) {
    return null;
  }
  words[3] &= 0xff00;
  for (let index = 4; index < words.length; index += 1) {
    words[index] = 0;
  }
  return {
    addressFamily: "IPV6",
    networkKey: `${formatIpv6(words)}/56`,
  };
}

function parseIpv6(value: string): number[] | null {
  const halves = value.toLowerCase().split("::");
  if (halves.length > 2) {
    return null;
  }
  const left = parseIpv6Side(halves[0] ?? "");
  const right = parseIpv6Side(halves[1] ?? "");
  if (left === null || right === null) {
    return null;
  }
  if (halves.length === 1) {
    return left.length === 8 ? left : null;
  }
  const omitted = 8 - left.length - right.length;
  if (omitted < 1) {
    return null;
  }
  return [...left, ...Array<number>(omitted).fill(0), ...right];
}

function parseIpv6Side(value: string): number[] | null {
  if (value === "") {
    return [];
  }
  const words: number[] = [];
  for (const part of value.split(":")) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) {
      return null;
    }
    words.push(Number.parseInt(part, 16));
  }
  return words;
}

function formatIpv6(words: readonly number[]): string {
  let bestStart = -1;
  let bestLength = 0;
  for (let start = 0; start < words.length;) {
    if (words[start] !== 0) {
      start += 1;
      continue;
    }
    let end = start;
    while (end < words.length && words[end] === 0) {
      end += 1;
    }
    if (end - start > bestLength && end - start >= 2) {
      bestStart = start;
      bestLength = end - start;
    }
    start = end;
  }

  const before = words
    .slice(0, bestStart < 0 ? words.length : bestStart)
    .map((word) => word.toString(16))
    .join(":");
  if (bestStart < 0) {
    return before;
  }
  const after = words
    .slice(bestStart + bestLength)
    .map((word) => word.toString(16))
    .join(":");
  return `${before}::${after}`;
}
