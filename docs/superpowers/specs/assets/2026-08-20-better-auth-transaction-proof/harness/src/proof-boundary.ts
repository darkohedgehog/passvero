import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";
import { runWithTransaction } from "@better-auth/core/context";
import type { Prisma, PrismaClient } from "../generated/client/client.js";
import { createProofAuth, type ProofAuth } from "./auth.js";
import type { DeferredCookie } from "./evidence.js";
import { readRunIdentity } from "./run-root.js";

export type FailurePoint =
  | "NONE"
  | "AFTER_PROVIDER_WRITE"
  | "AFTER_CANONICAL_WRITE"
  | "AFTER_SESSION_WRITE"
  | "BEFORE_COMMIT"
  | "AFTER_COMMIT_CALLBACK";

export type TransactionClient = Prisma.TransactionClient;

export interface BoundaryResult<T> {
  readonly value: T;
  readonly cookie: DeferredCookie;
  readonly committed: true;
}

interface CaptureState {
  readonly rawHeaders: string[];
}

const headerCapture = new AsyncLocalStorage<CaptureState>();

function injectFailure(actual: FailurePoint, expected: FailurePoint): void {
  if (actual === expected) throw new Error(`INJECTED_FAILURE_${expected}`);
}

export function captureDirectResponseHeaders(response: Response): void {
  const state = headerCapture.getStore();
  if (!state) throw new Error("STOP_HEADER_CAPTURE_CONTEXT_MISSING");
  const headerName = `set-${"cookie"}`;
  const getSetCookie = Reflect.get(response.headers, "getSetCookie");
  if (typeof getSetCookie === "function") {
    const values = Reflect.apply(getSetCookie, response.headers, []);
    if (Array.isArray(values)) {
      for (const value of values) if (typeof value === "string") state.rawHeaders.push(value);
      return;
    }
  }
  const value = response.headers.get(headerName);
  if (value !== null) state.rawHeaders.push(value);
}

function takeCapturedHeaders(): string[] {
  const state = headerCapture.getStore();
  if (!state) throw new Error("STOP_HEADER_CAPTURE_CONTEXT_MISSING");
  return state.rawHeaders.splice(0, state.rawHeaders.length);
}

function finalizeAfterCommit<T>(pending: { value: T; capturedHeaders: string[] }): BoundaryResult<T> {
  try {
    const raw = pending.capturedHeaders[0];
    if (!raw) {
      return {
        value: pending.value,
        cookie: {
          present: false,
          nameHash: null,
          secure: false,
          httpOnly: false,
          sameSite: null,
          hostOnly: true,
          maxAgeSeconds: null,
        },
        committed: true,
      };
    }

    const segments = raw.split(";").map((segment) => segment.trim());
    const pair = segments.shift() ?? "";
    const separator = pair.indexOf("=");
    const name = separator >= 0 ? pair.slice(0, separator) : pair;
    const attributes = new Map(
      segments.map((segment) => {
        const index = segment.indexOf("=");
        return index < 0
          ? [segment.toLowerCase(), ""]
          : [segment.slice(0, index).toLowerCase(), segment.slice(index + 1)];
      }),
    );
    const maxAge = attributes.get("max-age");
    return {
      value: pending.value,
      cookie: {
        present: true,
        nameHash: createHash("sha256").update(name).digest("hex"),
        secure: attributes.has("secure"),
        httpOnly: attributes.has("httponly"),
        sameSite: attributes.get("samesite")?.toLowerCase() === "lax" ? "lax" : null,
        hostOnly: !attributes.has("domain"),
        maxAgeSeconds: maxAge !== undefined && /^\d+$/.test(maxAge) ? Number(maxAge) : null,
      },
      committed: true,
    };
  } finally {
    pending.capturedHeaders.splice(0, pending.capturedHeaders.length);
  }
}

export async function runBetterAuthBoundary<T>(input: {
  readonly rootPrisma: PrismaClient;
  readonly invoke: (auth: ProofAuth, tx: TransactionClient) => Promise<T>;
  readonly failurePoint: FailurePoint;
}): Promise<BoundaryResult<T>> {
  readRunIdentity();
  const pending = await input.rootPrisma.$transaction(
    async (tx) => {
      const auth = createProofAuth({
        prisma: tx,
        adapterTransaction: false,
        disableSignUp: true,
      });
      const adapter = (await auth.$context).adapter;
      return runWithTransaction(adapter, async () =>
        headerCapture.run({ rawHeaders: [] }, async () => {
          const value = await input.invoke(auth, tx);
          injectFailure(input.failurePoint, "BEFORE_COMMIT");
          return { value, capturedHeaders: takeCapturedHeaders() };
        }),
      );
    },
    { isolationLevel: "Serializable" },
  );
  injectFailure(input.failurePoint, "AFTER_COMMIT_CALLBACK");
  return finalizeAfterCommit(pending);
}
