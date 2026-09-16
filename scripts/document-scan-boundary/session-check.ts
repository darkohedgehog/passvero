import { resolveStagingRunnerContext } from "../../src/infrastructure/documents/staging-scan-runner";

async function main() {
  if (process.argv.length !== 2 || process.getuid?.() === 0) throw new Error();
  // node-postgres forwards PGOPTIONS at connection startup for both lazy pools.
  // Expired Better Auth sessions may attempt deletion despite disableRefresh.
  // Enforce read-only at PostgreSQL as well as at the context repository.
  process.env.PGOPTIONS = "-c default_transaction_read_only=on";
  let bytes = Buffer.alloc(0);
  const timeout = setTimeout(() => process.exit(1), 15_000);
  try {
    for await (const chunk of process.stdin) {
      const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (bytes.length + value.length > 8192) throw new Error();
      bytes = Buffer.concat([bytes, value]);
    }
    await resolveStagingRunnerContext(bytes.toString("utf8"));
    process.stdout.write('REAL_SESSION_RESOLVER_CHECK=PASS; PRODUCT_EDIT=YES; DOCUMENT_MUTATIONS=NO\n');
  } finally { bytes.fill(0); clearTimeout(timeout); }
}
main().then(() => process.exit(0), () => {
  process.stdout.write('REAL_SESSION_RESOLVER_CHECK=FAIL; NO_CONTEXT_EXPORTED\n');
  process.exit(1);
});
