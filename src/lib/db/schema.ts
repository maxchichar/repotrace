import { pgTable, uuid, jsonb, timestamp, index, text, integer } from 'drizzle-orm/pg-core';
import type { Analysis } from '../types';
export const reports = pgTable(
  'repotrace_reports',
  {
    id: uuid('id').primaryKey(),
    payload: jsonb('payload').$type<Analysis>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('repotrace_reports_expires_idx').on(table.expiresAt)],
);

export const rateLimits = pgTable(
  'repotrace_rate_limits',
  {
    key: text('key').primaryKey(),
    used: integer('used').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('repotrace_rate_limits_expires_idx').on(table.expiresAt)],
);
