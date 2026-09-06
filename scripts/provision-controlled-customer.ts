// Internal operator entry point. No env-file loader and no public route.
// Run from the repository root with inherited authorized configuration:
// node --conditions=react-server --import tsx scripts/provision-controlled-customer.ts \
//   --email <email> --organization-display-name <name> --role ADMIN --locale hr
// The single stdout result contains a bearer capability: do not redirect it to logs/files.
import { runOperatorProvisioningCli } from "../src/application/auth/operator-provisioning-cli";
import { createOperatorProvisioningRuntime } from "../src/infrastructure/auth/operator-provisioning-runtime";

async function main(): Promise<void> {
  let runtime: ReturnType<typeof createOperatorProvisioningRuntime> | undefined;
  try {
    process.exitCode = await runOperatorProvisioningCli(process.argv.slice(2), {
      async provision(input) {
        runtime = createOperatorProvisioningRuntime(process.env);
        return runtime.provision(input);
      },
      stdout: value => { process.stdout.write(value); },
      stderr: value => { process.stderr.write(value); },
    });
  } finally {
    // A cleanup failure must not replace a committed one-time result with a retry instruction.
    try { await runtime?.close(); } catch { process.stderr.write("RESOURCE_CLEANUP_FAILED: do not repeat provisioning.\n"); }
  }
}
void main().catch(() => { process.stderr.write("OPERATIONAL_FAILURE\n"); process.exitCode = 1; });
