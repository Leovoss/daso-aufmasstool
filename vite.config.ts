import vinext from "vinext";
import { defineConfig } from "vite";

export default defineConfig(async () => {
  process.env.CLOUDFLARE_CF_FETCH_ENABLED ??= "false";
  process.env.WRANGLER_SEND_METRICS ??= "false";
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.WRANGLER_REGISTRY_PATH ??= ".wrangler/dev-registry";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: {
          name: "daso-aufmasstool",
          main: "vinext/server/fetch-handler",
          preview_urls: false,
          compatibility_flags: ["nodejs_compat"],
          d1_databases: [
            {
              binding: "DB",
              database_name: "daso-aufmass",
              database_id: "1948e38b-1b13-4ae7-8aa3-e3e039f2eb10",
            },
            {
              binding: "PLAN_DB",
              database_name: "daso-montageplanung",
              database_id: "42f5d224-bb84-4fd2-a1f8-d6abfda88956",
            },
          ],
          r2_buckets: [{ binding: "BUCKET", bucket_name: "daso-aufmass-files" }],
        },
      }),
    ],
  };
});
