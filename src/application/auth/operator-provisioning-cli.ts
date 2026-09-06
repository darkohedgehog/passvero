import { ProvisioningError, type ProvisioningResult } from "./operator-provisioning";

export async function runOperatorProvisioningCli(args: readonly string[], io: {
  provision(input: unknown): Promise<ProvisioningResult>;
  stdout(value: string): void;
  stderr(value: string): void;
}): Promise<number> {
  const flags: Readonly<Record<string, string>> = {
    "--email": "email", "--organization-display-name": "organizationDisplayName", "--role": "role", "--locale": "locale",
  };
  const input: Record<string, string> = {};
  if (args.length !== 8) return invalid();
  for (let i = 0; i < args.length; i += 2) {
    const key = Object.hasOwn(flags, args[i]) ? flags[args[i]] : undefined;
    const value = args[i + 1];
    if (key === undefined || Object.hasOwn(input, key) || !value || value.startsWith("--") || value.length > 254) return invalid();
    input[key] = value;
  }
  try {
    const result = await io.provision(input);
    // This is the sole intentional capability output. Do not log or persist it.
    io.stdout(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (error) {
    const code = error instanceof ProvisioningError ? error.code : "OPERATIONAL_FAILURE";
    io.stderr(`${code}\n`);
    return code === "INVALID_INPUT" ? 2 : code === "OPERATIONAL_FAILURE" ? 1 : 3;
  }
  function invalid(): number {
    io.stderr("INVALID_INPUT: require --email --organization-display-name --role --locale, each exactly once.\n");
    return 2;
  }
}
