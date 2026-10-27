import { readFileSync, writeFileSync } from "node:fs";

const path = "dist/server/wrangler.json";
const config = JSON.parse(readFileSync(path, "utf8"));

config.name = "daso-aufmasstool";
config.topLevelName = "daso-aufmasstool";
config.d1_databases = [
  {
    binding: "DB",
    database_name: "daso-aufmass",
    database_id: "1948e38b-1b13-4ae7-8aa3-e3e039f2eb10",
  },
];
config.r2_buckets = [{ binding: "BUCKET", bucket_name: "daso-aufmass-files" }];
config.preview_urls = false;

writeFileSync(path, JSON.stringify(config));
console.log("Patched dist/server/wrangler.json with production bindings.");
