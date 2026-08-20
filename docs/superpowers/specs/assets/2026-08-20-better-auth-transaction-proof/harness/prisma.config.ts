import { defineConfig } from "prisma/config";
import { buildConnectionString, readRunIdentity } from "./src/run-root.js";

const identity = readRunIdentity();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: { url: buildConnectionString(identity) },
});
