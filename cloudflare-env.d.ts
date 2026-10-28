declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    PLAN_DB?: D1Database;
    BUCKET?: R2Bucket;
    DASO_SETTINGS_KEY?: string;
    DASO_OWNER_EMAIL?: string;
    DASO_CRON_SECRET?: string;
    DASO_DEV_IDENTITY?: string;
    DASO_INBOX_SERVICE_ENABLED?: string;
    DASO_MAIL_INITIAL_PASSWORD?: string;
    CF_ACCESS_TEAM_DOMAIN?: string;
    CF_ACCESS_AUD?: string;
    CF_ACCESS_JWKS?: string;
  }
}
