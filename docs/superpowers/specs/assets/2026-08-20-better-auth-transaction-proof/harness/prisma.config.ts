import { defineConfig } from "prisma/config";
import {
  buildConnectionString,
  readRunIdentity,
  validateDisposableHarnessEnvironment,
} from "./src/run-root.js";

validateDisposableHarnessEnvironment();
const identity = readRunIdentity();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: buildConnectionString(identity) },
});
