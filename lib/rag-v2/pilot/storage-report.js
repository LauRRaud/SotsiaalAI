// ADR-094, step 5: what the chat takes on disk and how it grows, in numbers only (no question, answer or source text).
// One read-only report for the tables a chat turn writes to: the audit rows (M4PilotTurn), the conversation's own
// messages with the durable records (ConversationMessage), the conversations and the turn identities. It says what is
// waiting for the sweeps: rows past their time that are not purged yet, whole rows older than the plan's audit time
// that are not lean yet, conversations past their time that are not deleted yet.
const number = value => (typeof value === 'bigint' ? Number(value) : value);
const plain = row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : number(value)]));

/** auditDays: the running plan's audit time (null when it has none); now: the moment the queues are counted at. */
export async function chatStorageReport(db, { auditDays = null, now = new Date() } = {}) {
  const one = async (strings, ...values) => plain((await db.$queryRaw(strings, ...values))[0]);
  const many = async (strings, ...values) => (await db.$queryRaw(strings, ...values)).map(plain);
  const tables = {};
  for (const name of ['M4PilotTurn', 'ConversationMessage', 'Conversation', 'ChatTurn']) {
    const size = await one`SELECT pg_total_relation_size(${`"${name}"`}::regclass) AS total_bytes, pg_indexes_size(${`"${name}"`}::regclass) AS index_bytes,
      (SELECT reltuples::bigint FROM pg_class WHERE oid = ${`"${name}"`}::regclass) AS rows_estimate`;
    tables[name] = size;
  }
  const day = new Date(now.getTime() - 86400000), week = new Date(now.getTime() - 7 * 86400000);
  const rows = await one`SELECT count(*)::int AS rows,
      count(*) FILTER (WHERE state = 'completed')::int AS completed,
      count(*) FILTER (WHERE state <> 'completed')::int AS without_answer,
      count(*) FILTER (WHERE jsonb_exists(payload, 'lean'))::int AS lean,
      count(*) FILTER (WHERE state = 'completed' AND NOT jsonb_exists(payload, 'lean'))::int AS whole,
      count(*) FILTER (WHERE "expiresAt" IS NULL)::int AS without_time_limit,
      count(*) FILTER (WHERE "expiresAt" <= ${now})::int AS past_their_time_not_purged,
      min("createdAt") AS oldest, min("expiresAt") FILTER (WHERE "expiresAt" <= ${now}) AS oldest_unpurged_expiry,
      coalesce(sum(pg_column_size(payload)), 0)::bigint AS stored_bytes,
      coalesce(round(avg(pg_column_size(payload)) FILTER (WHERE state = 'completed' AND NOT jsonb_exists(payload, 'lean'))), 0)::int AS whole_avg_bytes,
      coalesce(round(avg(pg_column_size(payload)) FILTER (WHERE jsonb_exists(payload, 'lean'))), 0)::int AS lean_avg_bytes,
      count(*) FILTER (WHERE "createdAt" >= ${day})::int AS rows_last_day, coalesce(sum(pg_column_size(payload)) FILTER (WHERE "createdAt" >= ${day}), 0)::bigint AS bytes_last_day,
      count(*) FILTER (WHERE "createdAt" >= ${week})::int AS rows_last_week, coalesce(sum(pg_column_size(payload)) FILTER (WHERE "createdAt" >= ${week}), 0)::bigint AS bytes_last_week
    FROM "M4PilotTurn"`;
  // What the lean sweep still has to do under the running plan's audit time.
  const leanQueue = Number.isInteger(auditDays) ? await one`SELECT count(*)::int AS whole_older_than_audit_time, min("createdAt") AS oldest
    FROM "M4PilotTurn" WHERE state = 'completed' AND NOT jsonb_exists(payload, 'lean') AND "createdAt" < ${new Date(now.getTime() - auditDays * 86400000)}` : null;
  const messages = await one`SELECT count(*)::int AS messages,
      count(*) FILTER (WHERE jsonb_exists(metadata, 'm4TurnId'))::int AS of_chat_turns,
      count(*) FILTER (WHERE jsonb_exists(metadata, 'm4History'))::int AS with_record,
      count(*) FILTER (WHERE jsonb_exists(metadata, 'm4TurnId') AND content LIKE '[Kaitstud M4 %')::int AS placeholders,
      coalesce(sum(pg_column_size(content) + coalesce(pg_column_size(metadata), 0)) FILTER (WHERE jsonb_exists(metadata, 'm4TurnId')), 0)::bigint AS chat_stored_bytes,
      coalesce(round(avg(pg_column_size(content) + pg_column_size(metadata)) FILTER (WHERE jsonb_exists(metadata, 'm4History'))), 0)::int AS answer_with_record_avg_bytes,
      coalesce(max(pg_column_size(content) + pg_column_size(metadata)) FILTER (WHERE jsonb_exists(metadata, 'm4History')), 0)::int AS answer_with_record_max_bytes,
      count(*) FILTER (WHERE jsonb_exists(metadata, 'm4History') AND "createdAt" >= ${day})::int AS records_last_day,
      coalesce(sum(pg_column_size(content) + coalesce(pg_column_size(metadata), 0)) FILTER (WHERE jsonb_exists(metadata, 'm4TurnId') AND "createdAt" >= ${day}), 0)::bigint AS chat_bytes_last_day,
      count(*) FILTER (WHERE jsonb_exists(metadata, 'm4History') AND "createdAt" >= ${week})::int AS records_last_week,
      coalesce(sum(pg_column_size(content) + coalesce(pg_column_size(metadata), 0)) FILTER (WHERE jsonb_exists(metadata, 'm4TurnId') AND "createdAt" >= ${week}), 0)::bigint AS chat_bytes_last_week
    FROM "ConversationMessage"`;
  const conversations = await one`SELECT count(*)::int AS conversations,
      count(*) FILTER (WHERE "expiresAt" IS NULL)::int AS without_time_limit,
      count(*) FILTER (WHERE "expiresAt" <= ${now})::int AS past_their_time_not_deleted,
      count(*) FILTER (WHERE "archivedAt" IS NOT NULL)::int AS archived,
      min("lastActivityAt") AS oldest_activity, max("lastActivityAt") AS newest_activity
    FROM "Conversation" WHERE metadata @> '{"m4": true}'::jsonb`;
  const turnsByConversation = await many`SELECT count(*)::int AS conversations, max(n)::int AS most_turns, round(avg(n), 1)::float AS mean_turns FROM
    (SELECT count(*) AS n FROM "ConversationMessage" WHERE jsonb_exists(metadata, 'm4History') GROUP BY "conversationId") AS per`;
  const database = await one`SELECT pg_database_size(current_database()) AS bytes`;
  return { at: now.toISOString(), database_bytes: database.bytes, tables, audit_rows: rows, lean_queue: leanQueue, messages, conversations, turns_in_a_conversation: turnsByConversation[0] ?? null };
}
