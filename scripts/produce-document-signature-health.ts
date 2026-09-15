/** Operator-managed, explicit single run. Never invoked by application composition. */
import { createPrivateHealthSnapshotReader } from "../src/infrastructure/documents/signature-health-reader";
import { producerConfigSchema, createProducerIO } from "../src/infrastructure/documents/signature-health-producer-io";
import { createSignatureHealthProducer } from "../src/infrastructure/documents/signature-health-producer";
async function main() {
  try {
    if (process.argv.length !== 4 || process.argv[2] !== "--config" || process.getuid?.() !== 0) throw new Error();
    const bytes = await createPrivateHealthSnapshotReader().read(process.argv[3], { signal: AbortSignal.timeout(2000), limit: 16384 });
    const config = producerConfigSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)));
    const result = await createSignatureHealthProducer(config.socketPath, createProducerIO(config))();
    console.log(JSON.stringify({ result }));
    process.exitCode = result === "PUBLISHED" ? 0 : 1;
  } catch { console.log('{"result":"OPERATIONAL_FAILURE"}'); process.exitCode = 1; }
}
void main();
