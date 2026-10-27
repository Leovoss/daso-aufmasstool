import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
export const revisions = sqliteTable('project_revisions', {
  id: text('id').primaryKey(), version: integer('version').notNull().default(0), token: text('token').notNull(),
});
export const records = sqliteTable('records', {
  id: text('id').primaryKey(), kind: text('kind').notNull(), projectId: text('project_id').notNull(),
  data: text('data').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [index('records_project_kind').on(t.projectId, t.kind)]);
export const audit = sqliteTable('audit', {
  id: text('id').primaryKey(), projectId: text('project_id').notNull(), action: text('action').notNull(),
  user: text('user').notNull(), detail: text('detail').notNull(), at: text('at').notNull(),
}, t => [index('audit_project').on(t.projectId, t.at)]);
