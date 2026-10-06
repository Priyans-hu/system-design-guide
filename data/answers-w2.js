window.VAULT_ANSWERS = window.VAULT_ANSWERS || {};
Object.assign(window.VAULT_ANSWERS, {
  d1: {
    tldr: `OLTP serves small transactional reads and writes: normalize, store by row, index each access path. OLAP serves big scans and aggregates: denormalize into wide fact tables, store by column, partition by time, and feed it from OLTP via CDC.`,
    body: `<h4>Core idea</h4><p>OLTP (online transaction processing) is the live product: create a message, fetch a call by ID, update a status. Each query touches a few rows by key, needs millisecond latency and must stay correct under concurrency. OLAP (online analytical processing) is reporting: minutes per country per day for 90 days. Each query reads millions of rows but only a few columns, and a few seconds is acceptable. Opposite shapes need opposite models.</p>
<table>
<thead><tr><th>Aspect</th><th>OLTP</th><th>OLAP</th></tr></thead>
<tbody>
<tr><td>Query shape</td><td>Point lookups, short ranges</td><td>Scans, group-by, aggregates</td></tr>
<tr><td>Schema</td><td>Normalized, constraints, foreign keys</td><td>Denormalized fact table (star schema or one wide table)</td></tr>
<tr><td>Storage</td><td>Row store: Postgres, MySQL</td><td>Column store: ClickHouse, BigQuery, Redshift</td></tr>
<tr><td>Writes</td><td>Single rows, transactions, updates</td><td>Batched appends, rare updates</td></tr>
<tr><td>Access path</td><td>B-tree index per query</td><td>Time partitions, sort key, compression</td></tr>
</tbody>
</table>
<h4>How to do it</h4><ol>
<li>Keep OLTP as the source of truth. Normalize so each fact lives in one place, and index every query the API runs.</li>
<li>Do not run heavy reports on the primary. Stream changes out with CDC (Debezium reading the Postgres WAL or MySQL binlog into Kafka) or batch ETL.</li>
<li>In OLAP, pick the grain first, such as one row per call. Copy the attributes you filter by (account, country, carrier) onto that row so queries skip joins.</li>
<li>Partition by time and sort by common filters. In ClickHouse: <code>PARTITION BY toYYYYMM(start_time) ORDER BY (account_id, start_time)</code>.</li>
<li>Pre-aggregate hot dashboards with materialized views (daily totals per account), so they read thousands of rows, not billions.</li>
<li>Treat OLAP as append-only. Model corrections as new versioned rows (ClickHouse ReplacingMergeTree) instead of frequent updates.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Big reports on the OLTP primary evict hot pages from memory and hold old snapshots open (in Postgres this blocks vacuum and causes bloat). A replica helps, but it is still a row store.</li>
<li>Denormalized rows freeze attributes at event time. That is right for billing (the rate at call time) but wrong when you need current names; join a small dimension table for those.</li>
<li>Column stores dislike tiny inserts. Batch thousands of rows per insert.</li>
<li>Analytics lag the source by seconds to minutes. Label dashboards with "data as of".</li>
</ul>
<h4>Example</h4><p>Call detail records. OLTP: a Postgres <code>calls</code> table keyed by <code>call_uuid</code>, with an index on <code>(account_id, created_at)</code> for the console's recent-calls page. OLAP: CDC streams each finished call into a ClickHouse <code>cdr_facts</code> table with country, carrier, duration and cost on the row, partitioned by month and ordered by <code>(account_id, start_time)</code>. A materialized view keeps daily minutes and spend per account. The usage dashboard reads the rollup in milliseconds, and the API database never sees a 90-day scan.</p>`,
    followups: [`How would you keep the OLAP copy correct when source rows are updated or deleted?`, `When is a read replica enough for reporting, and when do you need a separate column store?`, `How would you model late-arriving or corrected CDRs in an append-only table?`],
    related: ["d2", "d6", "t4"]
  },
  d2: {
    tldr: `Default to a relational database for business data. Add a key-value or wide-column store when access is simple and write scale outgrows one primary. Add a search engine for text and flexible filtering, fed from the source of truth.`,
    body: `<h4>Core idea</h4><p>Choose by access pattern, consistency need and scale, not fashion. Relational databases give transactions, joins, constraints and ad-hoc queries, and one well-indexed Postgres node handles thousands of transactions per second and terabytes of data. NoSQL stores (DynamoDB, Cassandra, ScyllaDB) trade query flexibility for horizontal write scale and predictable latency, but only for access patterns you designed up front. Search engines (OpenSearch, Elasticsearch) build inverted indexes for full-text, fuzzy and faceted queries. They are secondary indexes, not systems of record.</p>
<table>
<thead><tr><th>Aspect</th><th>SQL (Postgres, MySQL)</th><th>Wide-column or KV (Cassandra, DynamoDB)</th><th>Search (OpenSearch)</th></tr></thead>
<tbody>
<tr><td>Best at</td><td>Transactions, joins, constraints, new queries</td><td>Huge write rates, key lookups, multi-region</td><td>Text relevance, fuzzy match, many optional filters</td></tr>
<tr><td>Consistency</td><td>Strong on the primary</td><td>Tunable or eventual; limited transactions</td><td>Near real time (about 1 s refresh)</td></tr>
<tr><td>Scales writes by</td><td>Bigger machine, then sharding (Citus, Vitess)</td><td>Adding nodes; the partition key spreads load</td><td>Adding shards and nodes</td></tr>
<tr><td>Weak at</td><td>Write scale past one primary</td><td>Ad-hoc queries, joins, new access paths</td><td>Frequent updates, being the only copy</td></tr>
</tbody>
</table>
<h4>How to do it</h4><ol>
<li>List every query with its rate, latency target and data size, plus the write rate and what must be atomic.</li>
<li>Need multi-row transactions, uniqueness or unknown future queries? Use SQL, and scale it with indexes, replicas and partitioning first.</li>
<li>Simple key access (get by ID, range within one key), writes beyond one primary, or active-active regions? Use Cassandra or DynamoDB and design one table per query.</li>
<li>Search boxes or many combinable filters? Index into OpenSearch from the source of truth with CDC or an outbox, never by dual writes from app code.</li>
<li>Count the ops cost: every extra store must be synced, backed up, secured and monitored.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Picking NoSQL "for scale" when the data fits on one node. You lose ad-hoc queries, and every new screen needs a new table or global secondary index.</li>
<li>Using OpenSearch as the primary store. It has no multi-document transactions, an update is a delete plus a reindex, and changing a field type needs a full reindex.</li>
<li>Dual writes drift when the second write fails. CDC or an outbox gives retries and ordering.</li>
<li>Large Cassandra partitions hurt performance, and DynamoDB items cap at 400 KB. Model around both.</li>
</ul>
<h4>Example</h4><p>A messaging product. Message records and status updates live in Postgres, keyed by <code>message_uuid</code>, next to balances and invoices, because charging for a send must be transactional. The console's search by destination number, status, error code and date runs on OpenSearch, fed by CDC with about a second of lag. If volume later outgrows sharded Postgres, the write-once message log is the first candidate for Cassandra, keyed by account and day.</p>`,
    followups: [`Your Postgres primary is at 80% CPU from writes. What do you try before moving to NoSQL?`, `How do you keep OpenSearch in sync with Postgres, and what happens when the sync lags or fails?`, `How would you serve a new access pattern in DynamoDB that you did not plan for?`],
    related: ["d1", "d4", "t1"]
  },
  d3: {
    tldr: `Shard by the entity most queries and transactions are scoped to, usually the tenant (account) in B2B. Use a directory or many logical shards so big tenants can move, and treat region as an outer layer driven by residency.`,
    body: `<h4>Core idea</h4><p>The shard key decides three things: which queries stay on one shard, how evenly load spreads, and how hard rebalancing is. Pick the key your transactions are scoped to, so almost every request touches one shard.</p>
<ul>
<li><strong>Tenant/account:</strong> natural for B2B. Per-account queries and transactions stay local. Risk: one huge tenant.</li>
<li><strong>User:</strong> the same idea for consumer apps.</li>
<li><strong>Region:</strong> driven by residency and latency. Usually a separate stack (cell) per region, with tenant sharding inside it.</li>
<li><strong>Time:</strong> great for retention, but the current period takes every write. Use it for partitions inside a shard, not as the shard key.</li>
<li><strong>Hash of entity ID:</strong> even spread, but "everything for account X" becomes scatter-gather.</li>
</ul>
<h4>How to do it</h4><ol>
<li>List the top queries and transactions and find their common scope key.</li>
<li>Check the distribution. If the largest tenant is 20% of traffic, plain tenant sharding overloads one shard.</li>
<li>Choose the mapping. <code>hash(key) % N</code> is simple, but changing N moves most keys. Better: many logical shards (say 1,024) mapped onto a few physical databases, or a directory table (tenant → shard) that lets you place and move tenants one at a time.</li>
<li>Put the shard key in every primary key and every query. Route in a data-access layer or a proxy (Vitess for MySQL, Citus for Postgres).</li>
<li>Plan cross-shard needs: global lookups get their own small table; analytics go to OLAP via CDC, not scatter-gather.</li>
<li>Build tenant moves early: copy, catch up with CDC, pause writes briefly, flip the directory.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Sharding too early. Indexes, replicas, table partitioning and a bigger machine go a long way first.</li>
<li>Cross-shard transactions are slow and fragile. Keep them rare; use sagas or outbox events.</li>
<li>Global uniqueness (email, phone number) cannot be enforced per shard and needs a global table.</li>
<li>The directory becomes critical. Cache it in every service and keep it highly available.</li>
</ul>
<h4>Example</h4><p>A CPaaS stores messages, calls and numbers per account. Shard by <code>account_id</code> through a directory: most accounts share 32 Postgres clusters, while an enterprise account sending 25% of traffic gets its own. Inbound calls arrive keyed by phone number, not account, so a small global table maps number → account and is cached everywhere. EU accounts live in an EU cell for residency, sharded inside that cell. Cross-account reports read from ClickHouse, never from the shards.</p>`,
    followups: [`How would you move one large tenant to a new shard with no downtime?`, `How do you enforce a globally unique field, like a phone number, across shards?`, `What changes when a single tenant grows too big for one shard?`],
    related: ["d4", "d5", "e7"]
  },
  d4: {
    tldr: `A good partition key has many distinct values, spreads traffic evenly over time, matches the main query so it hits one partition, and keeps partitions bounded. Add a time bucket or hash suffix when one key grows too big.`,
    body: `<h4>Core idea</h4><p>In Cassandra, DynamoDB or Kafka, the partition key is hashed to choose where data lives. Rows with the same key live together, and a query is only efficient when it supplies the full key. Inside a partition, a sort (clustering) key orders rows so you can read ranges. The key has to serve both your queries and even load.</p>
<ul>
<li><strong>High cardinality:</strong> <code>account_id</code> or <code>call_uuid</code>, never <code>status</code> or <code>country</code>.</li>
<li><strong>Even traffic over time:</strong> no value takes a big share of reads or writes, and "today" is not a key.</li>
<li><strong>Query aligned:</strong> the main read names the whole key. Scans across partitions are expensive.</li>
<li><strong>Bounded size:</strong> no partition grows forever. Common Cassandra advice is to stay under about 100 MB per partition.</li>
<li><strong>Immutable:</strong> changing a key value means delete plus reinsert.</li>
</ul>
<h4>How to do it</h4><ol>
<li>Write the access patterns first: "get call by ID", "list an account's calls for a day, newest first".</li>
<li>Choose partition key plus sort key per pattern. One table or index per pattern is normal in NoSQL.</li>
<li>Size the biggest partition (rows per day times row size for the largest tenant), and check its write rate against per-partition limits. A DynamoDB partition serves about 1,000 writes/s and 3,000 strongly consistent reads/s of small items.</li>
<li>Too big or too hot? Add a bucket: <code>(account_id, day, bucket)</code> with <code>bucket = hash(call_uuid) % N</code>. Reads fan out to N partitions and merge.</li>
<li>Serve other lookups, such as by call ID, from a second table or a global secondary index.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>A date or timestamp as the whole key sends all current writes to one partition.</li>
<li>A random UUID key spreads load perfectly but supports only point lookups.</li>
<li>Many buckets make every read fan out. Size N per tenant: 1 for small accounts, more for whales.</li>
<li>In Kafka the key also defines ordering, so salting a hot key breaks per-key order.</li>
<li>Fixing a bad key later means migrating all the data.</li>
</ul>
<h4>Example</h4><p>A CDR store in Cassandra. The largest account makes 5M calls a day at about 500 bytes each: 2.5 GB per day in one partition if keyed by <code>(account_id, day)</code>. With 64 buckets, each partition holds about 40 MB.</p>
<pre>CREATE TABLE cdr_by_account (
  account_id text, day date, bucket int,
  start_time timestamp, call_uuid uuid, duration_sec int,
  PRIMARY KEY ((account_id, day, bucket), start_time, call_uuid)
) WITH CLUSTERING ORDER BY (start_time DESC, call_uuid ASC);</pre>
<p>"Last hour of calls" reads that account's 64 partitions in parallel and merges by <code>start_time</code>. "Get call by ID" uses a separate table keyed by <code>call_uuid</code>.</p>`,
    followups: [`How do you choose the number of buckets, and how would you change it for one tenant later?`, `How would you paginate results spread across N bucketed partitions?`, `How does the partition key in Kafka affect ordering and consumer parallelism?`],
    related: ["d3", "d5", "a9"]
  },
  d5: {
    tldr: `Skew comes from whale tenants, celebrity keys and time-ordered keys. Detect it per key, not by averages. Fix writes with key salting or bucketing, reads with caching and replicas, and whales with dedicated shards and per-tenant limits.`,
    body: `<h4>Core idea</h4><p>A distributed store is only as fast as its busiest partition. Skew is either data skew (one partition is much bigger) or load skew (one partition gets much more traffic). Usual causes:</p>
<ul>
<li><strong>Whale tenants:</strong> one account produces a big share of traffic.</li>
<li><strong>Celebrity keys:</strong> one row everyone reads, like a global config or pricing table.</li>
<li><strong>Monotonic keys:</strong> timestamps or auto-increment IDs in range-partitioned stores (HBase, Bigtable) send every new write to the last range.</li>
<li><strong>Low-cardinality keys:</strong> partitioning by status or country.</li>
</ul>
<h4>How to do it</h4><ol>
<li><strong>Measure per key.</strong> Track top-N keys by QPS and bytes, and the busiest node against the average. Tools: DynamoDB CloudWatch Contributor Insights, Cassandra <code>nodetool toppartitions</code>, Kafka per-partition lag.</li>
<li><strong>Design the key well:</strong> high cardinality, hashed, bounded with time buckets.</li>
<li><strong>Salt hot write keys.</strong> Write to <code>key#0</code> through <code>key#N-1</code> (for example by <code>hash(message_id) % N</code>) and fan out reads. Salt only known hot keys, so normal keys stay cheap to read.</li>
<li><strong>Absorb hot reads</strong> with Redis plus a short in-process cache, read replicas, and coalescing of identical concurrent requests.</li>
<li><strong>Isolate whales.</strong> A tenant → shard directory lets you move a big tenant to dedicated hardware.</li>
<li><strong>Limit per tenant.</strong> Rate limits and fair queues stop one tenant from saturating a shared partition.</li>
<li><strong>Use many small partitions.</strong> Hundreds of virtual shards make rebalancing granular. Some stores split hot ranges automatically (DynamoDB adaptive capacity, CockroachDB load-based splitting), but no store can split a single hot item.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Salting costs N reads per query and breaks per-key ordering.</li>
<li>Caching fixes hot reads, never hot writes.</li>
<li>Averages lie: ten nodes averaging 20% CPU can include one at 95%.</li>
<li>Hashing kills range scans; keep ranges inside a partition with the sort key.</li>
</ul>
<h4>Example</h4><p>A message-status store is partitioned by <code>account_id</code>. One customer launches a 10M-SMS campaign, and its delivery receipts pour into one partition, which throttles while the rest of the cluster idles. OTP traffic for small accounts on that node slows too. Fixes: salt that account's key across 16 partitions, batch receipt updates, and give each account a fair-share send queue with its own rate, so the campaign drains at its allowed throughput and OTPs never wait behind it.</p>`,
    followups: [`How would you detect a hot partition before customers notice it?`, `What do you lose when you salt a key, and how do reads change?`, `How do you stop one tenant's campaign from slowing every other tenant on the same shard?`],
    related: ["d4", "k5", "p3"]
  },
  d6: {
    tldr: `Every index speeds some reads and slows every write. For read-heavy tables, build composite, covering and partial indexes that match exact queries. For write-heavy tables, keep few indexes, use append-friendly keys, and push other queries to search or OLAP.`,
    body: `<h4>Core idea</h4><p>An index is a second copy of some columns, sorted for fast lookup. Reads get faster, but every insert, and every update to an indexed column, must also update each index, and indexes take memory and disk. The storage engine shapes the trade:</p>
<ul>
<li><strong>B-tree</strong> (Postgres, MySQL InnoDB): updates pages in place. Reads take a few page hops. Random inserts cause random I/O and page splits.</li>
<li><strong>LSM tree</strong> (Cassandra, RocksDB, ScyllaDB): writes go to memory and a log, then flush as sorted immutable files that compaction merges later. Writes are cheap and sequential; reads may check several files (bloom filters help), and compaction costs background I/O.</li>
</ul>
<h4>How to do it</h4><p><strong>Read-heavy:</strong></p><ol>
<li>Composite indexes in the right order: equality columns first, then the range or sort column, e.g. <code>(account_id, created_at)</code>.</li>
<li>Covering indexes for the hottest queries, so they become index-only scans: <code>CREATE UNIQUE INDEX ON numbers (phone_number) INCLUDE (account_id, app_id)</code>.</li>
<li>Partial indexes for small hot subsets, such as <code>WHERE deleted_at IS NULL</code>.</li>
<li>Verify with <code>EXPLAIN ANALYZE</code>, and drop unused indexes (Postgres <code>pg_stat_user_indexes</code> with <code>idx_scan = 0</code>).</li>
</ol>
<p><strong>Write-heavy:</strong></p><ol>
<li>Keep only indexes that serve real, frequent queries.</li>
<li>Use time-ordered IDs (UUIDv7, ULID, Snowflake-style) instead of random UUIDv4, so inserts land on the right edge of the B-tree instead of dirtying random pages.</li>
<li>Avoid indexing frequently updated columns. In Postgres, an update that changes no indexed column can be a HOT update, which skips index writes.</li>
<li>Batch writes (multi-row inserts, <code>COPY</code>). Build new indexes with <code>CREATE INDEX CONCURRENTLY</code>.</li>
<li>Send search and reporting to OpenSearch or ClickHouse via CDC, or use an LSM store for extreme write rates.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Over-indexing: ten indexes means ten extra structures to update on every insert.</li>
<li>Low-cardinality indexes (a boolean) rarely help unless they are partial.</li>
<li>Wrong column order: <code>(created_at, account_id)</code> cannot efficiently serve "account X, newest first".</li>
<li>Index-only scans in Postgres need an up-to-date visibility map, so they depend on vacuum keeping up.</li>
</ul>
<h4>Example</h4><p><strong>Read-heavy:</strong> inbound routing looks up a phone number on every call and SMS, while numbers change rarely. The unique covering index above answers from the index alone.</p>
<p><strong>Write-heavy:</strong> the message table takes an insert per send plus two or three status updates from delivery receipts. Keep a UUIDv7 primary key and one <code>(account_id, created_at)</code> index. Do not index <code>status</code>: it changes constantly, and indexing it would block HOT updates. Console search by status goes to OpenSearch.</p>`,
    followups: [`How do you find unused or redundant indexes in production?`, `Why do random UUIDv4 primary keys hurt insert performance in a B-tree?`, `How would you add an index to a 1 TB table without blocking writes?`],
    related: ["d1", "k7", "r7"]
  },
  d7: {
    tldr: `Soft delete hides rows reversibly (a deleted_at column). Archival moves cold data to cheap storage. Retention decides when data must be destroyed. Partition by time so archiving and purging drop partitions instead of running huge deletes.`,
    body: `<h4>Core idea</h4><p>These are three different jobs. <strong>Soft delete</strong> is a product feature: hide a row but keep it for undo, audit or references. <strong>Archival</strong> is a cost feature: move rarely read data to cheaper storage, still retrievable. <strong>Retention</strong> is policy: how long each class of data must be kept and when it must be destroyed (legal, contract, privacy). Decide all three per data class.</p>
<h4>How to do it</h4><ol>
<li><strong>Soft delete with <code>deleted_at</code></strong>, a nullable timestamp rather than a boolean, so you know when. Enforce the filter in one place: a view, a repository default or row-level security. Use partial indexes to keep live rows fast and unique: <code>CREATE UNIQUE INDEX ON numbers (phone_number) WHERE deleted_at IS NULL</code>.</li>
<li><strong>Purge soft-deleted rows</strong> after a grace period (say 30 days) with a batched job, or move them to a history table at delete time.</li>
<li><strong>Partition big append-only tables by time</strong> (Postgres declarative partitioning by day or month). To archive, export a partition to Parquet in object storage, then detach and drop it. Dropping a partition takes moments; deleting a billion rows takes hours and bloats the table.</li>
<li><strong>Keep archives queryable</strong> with Athena, Trino or ClickHouse over Parquet. Lifecycle rules move old files to colder tiers and expire them.</li>
<li><strong>Use built-in TTLs</strong> where they exist: DynamoDB TTL, Cassandra TTL, Redis <code>EXPIRE</code>, OpenSearch ISM policies.</li>
<li><strong>Write retention as config</strong> (data class → hot days, archive days, final action) and let one job enforce it everywhere.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>One query missing <code>deleted_at IS NULL</code> shows deleted data. Centralize the filter.</li>
<li>Soft delete is not deletion. For erasure requests, hard delete or anonymize every copy: replicas, caches, search, analytics, data lake. Backups age out on their own schedule; document it.</li>
<li>Crypto-shredding helps: encrypt a tenant's sensitive fields with its own key, then delete the key to make every copy unreadable.</li>
<li>A huge <code>DELETE ... WHERE created_at &lt; X</code> on an unpartitioned table means a long transaction, replica lag and bloat. Delete in small batches if you must.</li>
<li>Legal holds must override automated deletion.</li>
<li>TTL deletes are not instant: DynamoDB may take days, and Cassandra tombstones linger until compaction.</li>
</ul>
<h4>Example</h4><p>Message logs stay hot in Postgres for 90 days, partitioned by day. A nightly job exports older partitions to Parquet, checks row counts, then drops them. Lifecycle rules move files to an archive tier after a year and expire them at the retention limit. Message bodies are redacted after 7 days, while billing metadata stays for the full period. Numbers use soft delete with the partial unique index above, so a released number can be bought again.</p>`,
    followups: [`How would you honor a deletion request when the data also sits in backups, search and analytics?`, `How do you make sure no query forgets the soft-delete filter?`, `How would you restore one tenant's archived data on request?`],
    related: ["e7", "d6", "d10"]
  },
  d8: {
    tldr: `Pick an isolation model per tenant tier: shared tables with a tenant_id for most, dedicated databases or cells for big or regulated tenants. Enforce tenant scoping in layers: auth context, data-access layer, row-level security, keys, caches and tests.`,
    body: `<h4>Core idea</h4><p>Isolation has two sides: security (tenant A never sees tenant B's data) and performance (A's load never hurts B). The models form a spectrum:</p>
<table>
<thead><tr><th>Model</th><th>Isolation</th><th>Cost and ops</th><th>Fits</th></tr></thead>
<tbody>
<tr><td>Pool: shared tables with <code>tenant_id</code></td><td>Logical only</td><td>Cheapest; one schema to migrate</td><td>Many small tenants</td></tr>
<tr><td>Schema per tenant</td><td>Medium</td><td>Migrations run N times; catalog bloat at thousands</td><td>Tens to hundreds of tenants</td></tr>
<tr><td>Silo: database or cell per tenant</td><td>Strong, small blast radius</td><td>Highest; a fleet to manage</td><td>Enterprise, regulated, residency</td></tr>
</tbody>
</table>
<p>Most B2B systems run a hybrid: pool by default, silo for the few who need or pay for it.</p>
<h4>How to do it</h4><ol>
<li><strong>Derive the tenant from auth,</strong> never from the request body. The API key resolves to an account, carried in request context.</li>
<li><strong>Scope every query in the data-access layer.</strong> Repository methods require a tenant ID. Fetch with <code>WHERE id = $1 AND account_id = $2</code>, never by ID alone.</li>
<li><strong>Add a database backstop with Postgres row-level security:</strong>
<pre>ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON messages
  USING (account_id = current_setting('app.account_id')::bigint);</pre>
Set it per transaction with <code>SET LOCAL app.account_id = '42'</code>, and connect as a role that does not own the table (owners bypass RLS unless it is forced).</li>
<li><strong>Put the tenant in keys:</strong> composite keys <code>(account_id, id)</code>, including foreign keys, make cross-tenant references impossible. Prefix cache keys with the tenant, and filter every search query by it.</li>
<li><strong>Isolate performance</strong> with per-tenant rate limits, connection caps and fair queues.</li>
<li><strong>Test it:</strong> automated checks that tenant A's token asking for tenant B's IDs gets 404.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Background jobs, admin tools and exports often skip tenant context. Give them explicit, audited paths.</li>
<li>Behind a transaction-mode pooler (PgBouncer), a plain <code>SET</code> leaks to the next client. Use <code>SET LOCAL</code>.</li>
<li>RLS needs an index on the tenant column, or every query scans.</li>
<li>Answering 403 for another tenant's ID reveals that it exists; return 404.</li>
<li>Silos multiply databases, connections and upgrade work.</li>
</ul>
<h4>Example</h4><p>A CPaaS keeps messages, calls and recording metadata in shared tables with <code>account_id</code> on every row, backed by RLS. A reseller parent can read its subaccounts' data because auth expands its scope to its child IDs; a subaccount never sees its parent's. Recording files sit under per-account storage prefixes and are served through short-lived signed URLs, issued only after an ownership check. A bank with residency rules gets a dedicated database in its region, routed through a tenant directory.</p>`,
    followups: [`How would you find and prevent IDOR bugs across hundreds of endpoints?`, `When would you move a tenant from the shared pool to a dedicated database, and how?`, `How do you handle a noisy neighbor in a shared database?`],
    related: ["d3", "p3", "e7"]
  },
  d9: {
    tldr: `Treat a backfill as a production deploy: make live code handle old and new states first, then run an idempotent, resumable job in small throttled batches with a kill switch, and verify with reconciliation before anything depends on it.`,
    body: `<h4>Core idea</h4><p>A backfill rewrites many existing rows while live traffic keeps writing. It fails in four ways: it overloads the database (I/O, locks, replica lag, WAL growth, bloat), it races live writes and overwrites fresher data, it dies halfway, or it applies wrong logic to millions of rows. So the job must be idempotent, resumable, throttled, observable and verified, and it must never fire business side effects.</p>
<h4>How to do it</h4><ol>
<li><strong>Fix the end first.</strong> Deploy code that fills the new field on every new write and tolerates missing values on old rows. The backfill then covers a fixed set of rows and will finish.</li>
<li><strong>Make batches idempotent.</strong> Compute values deterministically and write with a guard: <code>UPDATE ... WHERE id BETWEEN $1 AND $2 AND new_col IS NULL</code>. Re-runs skip finished rows and never clobber rows live traffic already set. For read-modify-write logic, also match a version or <code>updated_at</code>.</li>
<li><strong>Walk the primary key in chunks</strong> (keyset, never OFFSET): 1,000-5,000 rows per batch, each in its own short transaction.</li>
<li><strong>Checkpoint</strong> the last finished ID in a table, so the job resumes after a crash or deploy.</li>
<li><strong>Throttle on real signals.</strong> Pause when replica lag passes a few seconds, DB CPU is high, or the API's p99 rises. Prefer off-peak hours. Add a kill switch that needs no deploy.</li>
<li><strong>Ramp up.</strong> Dry-run on a prod snapshot, then one tenant or 1% of IDs, check, then go wide.</li>
<li><strong>Isolate side effects.</strong> No webhooks, emails or billing events. Warn CDC consumers (search, analytics, cache invalidators) about the volume, or throttle to what they can absorb.</li>
<li><strong>Verify before depending on it.</strong> Count rows still missing the value, recompute a random sample and compare, and only then switch reads or add constraints.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>One giant <code>UPDATE</code> means one long transaction, huge WAL, replica lag, held locks, and an all-or-nothing rollback after hours of work.</li>
<li>OFFSET paging slows down with every batch, because each one rescans the skipped rows.</li>
<li>In Postgres every updated row is a new row version: expect bloat and autovacuum load, and watch disk.</li>
<li>Read-then-write races: the job reads a value, live traffic changes it, the job writes a stale result. Use one SQL statement or a guard.</li>
<li>Prefer slow and safe. A backfill that takes a day is fine; an outage is not.</li>
</ul>
<h4>Example</h4><p>A per-country report needs <code>country_code</code> on 2B historical message rows, derived from the E.164 destination number.</p>
<ol>
<li>Add the nullable column (metadata-only in Postgres) and deploy code that sets it on new inserts.</li>
<li>The job reads 5,000 IDs past the checkpoint, derives codes in the app, and writes them with <code>UPDATE ... FROM (VALUES ...)</code> guarded by <code>country_code IS NULL</code>.</li>
<li>It sleeps whenever replica lag exceeds 5 s, and publishes rows/s, lag and ETA to a dashboard.</li>
<li>At 10 batches per second it moves 50k rows/s, so 2B rows take about 11 hours.</li>
<li>On a replica, a count of rows with a null <code>country_code</code> returns 0, and 10,000 sampled rows recompute to the same values. Then add <code>CHECK (country_code IS NOT NULL) NOT VALID</code>, validate it separately, and ship the report.</li>
</ol>`,
    followups: [`How do you handle rows that fail during the backfill without stopping the whole job?`, `How would you backfill when the source data lives in another service, not the same database?`, `Which signals would make you pause or abort a running backfill?`],
    related: ["d10", "r7", "a3"]
  },
  d10: {
    tldr: `Never rewrite a huge table in place under a lock. Expand and contract: build the new shape alongside, sync live writes via triggers or CDC, backfill in throttled chunks, verify, cut over behind flags, keep a rollback path.`,
    body: `<h4>Core idea</h4><p>On a big table, innocent-looking changes (a column type change, a new primary key, re-partitioning) can rewrite every row under an exclusive lock: hours of downtime on a multi-TB table. The safe pattern is expand and contract: build the new structure next to the old one, keep both in sync while history is copied, switch in small reversible steps, and delete the old structure last.</p>
<h4>How to do it</h4><ol>
<li><strong>Size it.</strong> Rows, GB, write rate, disk headroom (roughly 2x space plus WAL or binlog), and tolerable replica lag. At a throttled 50 MB/s, copying 5 TB takes about 28 hours.</li>
<li><strong>Skip the copy if you can.</strong> Many changes are metadata-only: a nullable column in Postgres, many MySQL 8 <code>ALGORITHM=INSTANT</code> changes. Build indexes with <code>CREATE INDEX CONCURRENTLY</code>; add constraints as <code>NOT VALID</code>, then <code>VALIDATE CONSTRAINT</code>.</li>
<li><strong>Expand:</strong> create the new table with the target schema.</li>
<li><strong>Sync live writes:</strong> triggers (pt-online-schema-change or your own), log-based tools (gh-ost on the MySQL binlog, Postgres logical replication, Debezium), or app dual writes. Log-based sync catches every writer and adds nothing to the write path.</li>
<li><strong>Backfill history</strong> in throttled, checkpointed chunks, as idempotent upserts that never overwrite rows the live sync already copied.</li>
<li><strong>Verify:</strong> counts and checksums per ID range, plus shadow reads (serve from old, also query new, log mismatches).</li>
<li><strong>Cut over in steps:</strong> reads behind a flag (1% → 100%), then writes. The final swap, usually a rename, must be a short transaction.</li>
<li><strong>Keep rollback cheap:</strong> sync the old table in reverse for a soak period, then contract: stop syncing and drop it.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li><strong>Lock queues:</strong> even a fast Postgres <code>ALTER TABLE</code> waits for an exclusive lock, and every query behind it waits too. Set <code>lock_timeout</code> to a few seconds and retry.</li>
<li><strong>Dual writes drift</strong> when one side fails, so they need reconciliation. Prefer log-based sync.</li>
<li><strong>Triggers</strong> add latency to every write on an already hot table.</li>
<li><strong>Partitioned Postgres tables</strong> need the partition key in every primary key and unique constraint, so ID-only uniqueness is no longer enforced.</li>
<li><strong>Downstream consumers</strong> (CDC, search, analytics) need their own switch plan.</li>
</ul>
<h4>Example</h4><p>A Postgres <code>cdrs</code> table has 3B rows, no partitions, and an <code>int4</code> ID nearing its 2,147,483,647 limit. Goal: <code>bigint</code> IDs and monthly partitions for retention.</p>
<ol>
<li>Create <code>cdrs_v2</code> partitioned by <code>start_time</code>, with a <code>bigint</code> ID and primary key <code>(id, start_time)</code>.</li>
<li>A trigger on <code>cdrs</code> upserts every insert and update into <code>cdrs_v2</code> with the same ID.</li>
<li>Backfill by ID range with <code>INSERT ... ON CONFLICT DO NOTHING</code>, so rows the trigger already copied win, at a rate that keeps replica lag under 5 s.</li>
<li>Compare per-month counts and <code>sum(duration_sec)</code>; shadow-read the CDR API for a week.</li>
<li>In one short transaction with <code>lock_timeout</code>: rename the tables, drop the forward trigger (or the two triggers feed each other), widen the ID sequence with <code>ALTER SEQUENCE ... AS bigint</code>, and add a reverse trigger so <code>cdrs_old</code> stays current.</li>
<li>Keep <code>cdrs_old</code> as a rollback path for two weeks (possible only while IDs still fit in <code>int4</code>), then drop it.</li>
</ol>`,
    followups: [`How do you roll back after writes have already moved to the new table?`, `How would you prove two 3B-row tables hold the same data?`, `How would your plan change if other tables had foreign keys pointing at this one?`],
    related: ["d9", "r7", "e9"]
  },
  k1: {
    tldr: `Cache as close to the consumer as correctness allows. Public, slow-changing data goes to the client and CDN. Private hot data goes to a service cache (in-process plus Redis). The database caches via buffer pool, replicas and materialized views.`,
    body: `<h4>Core idea</h4><p>Each layer closer to the user saves more latency and backend load, but is harder to invalidate and knows less about the data. Three questions pick the layer: Who may see this data (everyone, one tenant, one user)? How stale can it be? Can I purge it when it changes?</p>
<ul>
<li><strong>Client</strong> (browser, mobile app, SDK): zero network cost. Controlled by <code>Cache-Control</code>, <code>ETag</code> and app memory. You cannot purge it, only let it expire.</li>
<li><strong>Edge/CDN:</strong> shared public responses near users. Purge by URL or tag. Ideal for static assets and public GETs.</li>
<li><strong>Service:</strong> an in-process cache (an LRU map, ristretto in Go) for tiny hot data, plus shared Redis or Memcached for per-tenant objects and expensive results. You control keys, TTLs and invalidation.</li>
<li><strong>Database:</strong> the buffer pool already caches hot pages. Read replicas and materialized views offload repeated reads.</li>
</ul>
<h4>How to do it</h4><ol>
<li>Profile first: rank endpoints and queries by total time spent, not by count.</li>
<li>Fix the database before caching around it. A missing index is the usual cause of "we need a cache".</li>
<li>Static assets: content-hashed filenames with <code>max-age=31536000, immutable</code> on a CDN.</li>
<li>Slow-changing public API data: CDN or gateway cache with a short TTL.</li>
<li>Authenticated data: send <code>Cache-Control: private</code> or <code>no-store</code> so shared caches never keep it, and cache it in the service, keyed by tenant.</li>
<li>Very hot, tiny, rarely changing data: in-process with a 5-30 s TTL, backed by Redis.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>A CDN that caches an authenticated response serves one customer's data to another. Check headers on every private endpoint.</li>
<li>Staleness adds up across layers: client TTL plus CDN TTL plus service TTL.</li>
<li>Each pod's in-process cache holds its own copy; copies diverge until TTL or a pub/sub eviction.</li>
<li>Replicas lag, which breaks read-your-own-writes.</li>
<li>Data that must be exact at decision time, such as balances or permissions, needs a strict invalidation design or no cache.</li>
</ul>
<h4>Example</h4><p>A CPaaS: docs and console bundles sit on a CDN with hashed filenames. The public pricing endpoint changes daily, so the gateway caches it for 5 minutes. Inbound call routing looks up number → application on every call: in-process cache (10 s TTL) over Redis over Postgres, with change events evicting entries. The SDK keeps its auth token until expiry. Balance checks at send time skip caches and use the database or an atomic counter.</p>`,
    followups: [`How do you cache per-tenant API responses without leaking data between tenants?`, `What is the worst-case staleness across client, CDN and service caches, and how do you bound it?`, `When would you choose an in-process cache over Redis?`],
    related: ["k2", "k3", "k6"]
  },
  k2: {
    tldr: `Write-through updates cache and database together, for data read soon after writing. Write-back acknowledges after the cache write and flushes later, for high-rate updates that tolerate loss. Write-around writes only the database and skips the cache, for data rarely re-read.`,
    body: `<h4>Core idea</h4><p>These patterns decide what happens to the cache on a write. Reads usually follow cache-aside: check the cache, and on a miss load from the database and fill the cache.</p>
<table>
<thead><tr><th>Pattern</th><th>Write path</th><th>Read after write</th><th>Main risk</th><th>Good for</th></tr></thead>
<tbody>
<tr><td>Write-through</td><td>DB and cache, synchronously</td><td>Hit, fresh</td><td>Slower writes; cache fills with data nobody reads</td><td>Read-soon data: settings, profiles</td></tr>
<tr><td>Write-back (write-behind)</td><td>Cache now, DB later in batches</td><td>Hit</td><td>Data loss if the cache dies before flushing</td><td>Counters, presence, high-rate updates</td></tr>
<tr><td>Write-around</td><td>DB only; cache key deleted</td><td>Miss, then load</td><td>First read after a write is slow</td><td>Write-heavy, rarely re-read data</td></tr>
</tbody>
</table>
<h4>How to do it</h4><ol>
<li>Ask how soon and how often data is read after it is written. Soon and often → write-through. Rarely → write-around.</li>
<li>Ask whether losing the last few seconds of writes is acceptable. Only if yes, consider write-back.</li>
<li>For write-through, write the database first, then the cache. If the cache write fails, delete the key so the next read reloads.</li>
<li>For write-back, make flushes idempotent and ordered per key, flush on a timer and on shutdown, and run the cache with replication and AOF persistence. Even then, Redis with <code>appendfsync everysec</code> can lose about a second of writes, and a failover to an async replica can lose more.</li>
<li>For write-around, delete the cached key after the database commit, and keep a TTL as a safety net.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Concurrent write-throughs can land out of order: writer A updates the DB, writer B updates the DB and the cache, then A overwrites the cache with its older value. Deleting instead of setting, or setting only if the version is newer, avoids it.</li>
<li>Write-back makes the cache the temporary source of truth. Anything reading the DB directly (reports, other services) sees stale data.</li>
<li>Never use write-back for money or anything a customer can dispute.</li>
<li>Write-through on write-heavy, rarely read data wastes memory and evicts useful keys.</li>
</ul>
<h4>Example</h4><p>In a CPaaS, account settings (webhook URL, default application) are read on every message right after an update: use write-through, or a DB write plus cache delete. The real-time usage widget uses write-back: <code>INCRBY</code> a Redis counter per message and flush totals to the database every 10 s. Losing a few seconds only blurs a chart, because the billing ledger is written to the database directly. Call detail records are written once and rarely read soon after, so they use write-around and never touch the cache.</p>`,
    followups: [`How would you make write-back safe enough for a counter that feeds billing?`, `What happens in write-through when the database write succeeds but the cache write fails?`, `Why do many teams delete the cache key on writes instead of updating it?`],
    related: ["k1", "k3", "t5"]
  },
  k3: {
    tldr: `Give every cached type a TTL as a safety net, invalidate by deleting keys after commit, and drive deletes from the data change itself (CDC or outbox), not each writer. Use versioned keys for groups.`,
    body: `<h4>Core idea</h4><p>Invalidation becomes a nightmare when many code paths write the same data, when one cached value is built from many tables, and when nobody knows how much staleness is acceptable. A few fixed rules keep it tractable, so correctness never depends on every writer remembering to clean up.</p>
<h4>How to do it</h4><ol>
<li><strong>Staleness budget per type.</strong> Document key format, TTL, invalidation trigger and owner for each cached type. Pricing can be 5 minutes stale; permissions cannot.</li>
<li><strong>Always set a TTL.</strong> It bounds the damage of any missed invalidation. Add jitter so keys do not expire together.</li>
<li><strong>Delete, do not update.</strong> On change, <code>DEL</code> the key and let the next read reload. Writers setting new values invite out-of-order overwrites.</li>
<li><strong>Delete after commit.</strong> Deleting before the commit lets a reader refill the cache with the old row.</li>
<li><strong>Invalidate from the change stream.</strong> Write an outbox event in the same transaction, or read the WAL/binlog with CDC (Debezium). An invalidator consumes events, deletes keys and retries on failure. This catches every writer, including scripts and admin tools.</li>
<li><strong>Version groups you cannot enumerate.</strong> For list or aggregate caches, embed a version in the key (<code>acct:42:v7:numbers</code>) and bump it on change. Old keys die by TTL.</li>
<li><strong>Broadcast to in-process caches</strong> over Redis pub/sub or a Kafka topic, or keep their TTL very short.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li><strong>The classic race:</strong> a reader misses and reads the old row; a writer commits and deletes the key; the reader then stores the old row. It stays stale until TTL. Fixes: a short TTL, a second delayed delete, conditional sets that only write a newer version (a Lua script), or leases (the cache hands out a token on a miss and rejects the set if the key was invalidated since).</li>
<li>Caching derived data (an account summary built from five tables) means five sources must invalidate it. Prefer caching entities by primary key and assembling them.</li>
<li>Negative entries ("not found") must be cleared on create, or new items stay invisible.</li>
<li>Bumping a global version invalidates everything at once and causes a stampede.</li>
<li>With multiple regions, invalidation must reach every region's cache.</li>
</ul>
<h4>Example</h4><p>Inbound routing caches <code>num:+14155550100</code> → account, application and answer URL, with a 5-minute TTL plus up to 10% jitter. Any change to a number (config edit, release, port-out) writes a <code>NumberChanged</code> outbox row in the same transaction. The invalidator deletes the Redis key and publishes the number on a pub/sub channel, so every routing pod evicts its in-process copy. Unknown numbers are negatively cached for 30 s to absorb calls to unassigned numbers, and a purchase event clears that entry.</p>`,
    followups: [`How would you invalidate a cached list, like all numbers for an account, when one number changes?`, `How do you guarantee the invalidation happens if the service crashes right after commit?`, `How do you invalidate in-process caches across 200 pods?`],
    related: ["k2", "k4", "t4"]
  },
  k4: {
    tldr: `A stampede is many requests missing the same hot key at once and all hitting the database. Allow one recompute per key (singleflight, a lock or lease), serve stale while refreshing, refresh early with probability, and add TTL jitter.`,
    body: `<h4>Core idea</h4><p>When a hot key expires, every request that arrives before it is rebuilt misses. If the rebuild takes 2 s and the key gets 500 requests per second, about 1,000 identical expensive queries hit the database within those 2 s, which slows the rebuild further. Thundering herd is the wider family: many clients acting at the same moment, such as keys set together expiring together, a cache restart, or clients retrying in sync after an outage.</p>
<h4>How to do it</h4><ol>
<li><strong>Coalesce in-process.</strong> Go's <code>singleflight.Group</code> makes concurrent misses for one key share a single call. With M pods, at most M calls reach the database.</li>
<li><strong>Coalesce across pods.</strong> The first misser takes a lock with <code>SET lock:key token NX PX 5000</code> and rebuilds. Others wait briefly and re-read, or serve stale. The expiry stops a crashed holder from blocking forever.</li>
<li><strong>Serve stale while revalidating.</strong> Store a soft expiry inside the value and a longer hard TTL on the key. After the soft expiry, one request refreshes in the background while everyone else gets the old value at once.</li>
<li><strong>Refresh early, probabilistically.</strong> Each reader refreshes before expiry with a probability that grows as expiry nears (the XFetch rule): refresh if <code>now - delta * beta * ln(rand()) &gt;= expiry</code>, where <code>delta</code> is rebuild time and <code>beta</code> is about 1. A hot key is usually rebuilt by one early reader before anyone sees a miss.</li>
<li><strong>Jitter TTLs,</strong> for example 300 s plus or minus 10%, so keys written together do not expire together.</li>
<li><strong>Warm and protect.</strong> Pre-load hot keys before shifting traffic to a new cache cluster. Cap concurrent database calls per pod, and retry with backoff and jitter.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>singleflight shares failures: if the one call errors or hangs, every waiter gets that result. Use <code>DoChan</code> with a context timeout.</li>
<li>Locks without a timeout or a fallback turn one slow rebuild into a latency spike for everyone.</li>
<li>Stale-while-revalidate is wrong for data that must be exact, like balances or permissions.</li>
<li>Jitter does nothing for one super-hot key; that key needs early refresh or a lock.</li>
<li>After a cache flush or failover the hit ratio drops to zero. Limit rebuild concurrency and ramp traffic back.</li>
</ul>
<h4>Example</h4><p>A console dashboard shows messages sent today per account, built by a 2 s aggregate query and cached for 60 s. A large customer has 200 agents with auto-refresh on, so every minute the key expires and dozens of pods run the same query. Fix: soft TTL 60 s, hard TTL 10 minutes, one refresher per key via <code>SET NX</code>, singleflight inside each pod, and TTL jitter. Result: one rebuild per key per minute, and agents never wait on the database.</p>`,
    followups: [`What happens to waiting requests if the one request rebuilding the key fails?`, `How would you warm a new Redis cluster before moving traffic to it?`, `How is a herd of client retries different from a cache stampede, and how do you handle it?`],
    related: ["k3", "k5", "r3"]
  },
  k5: {
    tldr: `For hot keys, absorb reads with a short in-process cache or key replicas, and split hot writes into sharded counters. For large objects, keep blobs in object storage behind a CDN and cache only metadata, compressed and trimmed.`,
    body: `<h4>Core idea</h4><p>Both problems break the even-spread assumption of a sharded cache. A <strong>hot key</strong> lives on one shard: in Redis Cluster a key maps to one slot on one primary, and one Redis process handles on the order of 100k simple operations per second. A key read 300k times a second overloads that node while the others idle. A <strong>large object</strong> hurts differently: a 5 MB value needs about 4 ms just to cross a 10 Gbps link, 1,000 reads a second of it is 40 Gbps, and big values evict many small useful ones.</p>
<h4>How to do it</h4><p><strong>Hot keys:</strong></p><ol>
<li>Find them with <code>redis-cli --hotkeys</code> (needs an LFU eviction policy), client-side counters per key prefix, or proxy stats.</li>
<li>Put a small in-process cache in front, with a 1-5 s TTL. It absorbs most reads, at the cost of a few seconds of staleness per pod.</li>
<li>Replicate the key: store copies <code>key#0</code> through <code>key#7</code> on different shards and read a random one. Writes must update all copies.</li>
<li>Read from Redis replicas if slight lag is fine.</li>
<li>For hot writes (counters), split the counter into N sub-keys and sum on read, or aggregate in memory and flush one <code>INCRBY</code> per second.</li>
</ol>
<p><strong>Large objects:</strong></p><ol>
<li>Keep blobs (recordings, media, exports) in object storage and serve them through a CDN or signed URLs. Cache only the pointer and metadata.</li>
<li>Cache only the fields callers need. A Redis hash lets you <code>HGET</code> one field instead of the whole object.</li>
<li>Compress (zstd, snappy) and use compact encodings such as protobuf or msgpack.</li>
<li>Split big collections into pages. Remove them with <code>UNLINK</code>, which frees memory in a background thread, not <code>DEL</code>, which blocks while freeing every element.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>In-process caches multiply memory by pod count, and invalidation must reach every pod.</li>
<li>Key replicas multiply write cost and can briefly disagree.</li>
<li>Memcached rejects items over 1 MB by default. Hitting that limit usually signals a design problem, not a config one.</li>
<li>Decoding big JSON on every hit burns CPU. Profile the hit path, not only the miss path.</li>
</ul>
<h4>Example</h4><p>A CPaaS send path reads the carrier routing table on every message. At 50k messages per second, one Redis key becomes the bottleneck. Each sender pod loads the table into memory and refreshes it every 30 s or on a change event, so Redis is only the reload source. Call recordings are several MB each, so they stay in object storage and Redis holds only duration, size and location. During a big campaign, the per-account sent counter is aggregated in memory and flushed once per second.</p>`,
    followups: [`How would you find hot keys in production without using MONITOR?`, `How do you keep replicated copies of a hot key consistent on writes?`, `Where would you store and serve call recordings, and what exactly would you cache?`],
    related: ["d5", "k4", "k1"]
  },
  k6: {
    tldr: `A cache helps only if it cuts latency, backend load or cost enough to justify staleness and complexity. Measure hit ratio per key type, hit and miss latency, origin load before and after, evictions and staleness, using a bypass experiment.`,
    body: `<h4>Core idea</h4><p>A cache is a bet: memory, code and staleness risk in exchange for lower latency and less origin load. Check the bet with numbers. Average latency is roughly <code>h * hit_time + (1 - h) * (lookup_time + origin_time)</code>. With a 1 ms hit and a 50 ms origin, a 90% hit ratio gives about 6 ms, but 50% gives about 26 ms. Origin load follows the miss ratio: going from 90% to 95% hits halves database traffic.</p>
<h4>How to do it</h4><ol>
<li><strong>Instrument at the call site.</strong> Count hit, miss and error per cache and key prefix (never per full key, so metric cardinality stays bounded), and record latency histograms split by hit and miss.</li>
<li><strong>Read server stats.</strong> Redis <code>INFO stats</code> gives <code>keyspace_hits</code>, <code>keyspace_misses</code>, <code>evicted_keys</code> and <code>expired_keys</code>. Also watch memory and ops per second.</li>
<li><strong>Watch the origin.</strong> DB QPS, CPU and p99 for the queries the cache fronts, before and after.</li>
<li><strong>Run a bypass experiment.</strong> Skip the cache for 1-5% of requests behind a flag and compare latency and load. It is the cleanest measure of real benefit.</li>
<li><strong>Measure staleness.</strong> Sample cached values, compare them with the source, and track the mismatch rate and the age of served values.</li>
<li><strong>Weigh by cost.</strong> 99% hits on cheap lookups can matter less than 60% on a 2 s query. Track database time saved, not only hits.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Signs a cache is not helping: under about 50% hits for a key type, high evictions with low hits, hit latency close to origin latency, or a worse p99 because misses now pay an extra hop.</li>
<li>One global hit ratio hides a useless cache behind a great one. Break it down by key type.</li>
<li>Hit ratio dips after deploys and failovers; compare steady state.</li>
<li>Test environments have different key distributions. Measure in production.</li>
<li>Caching a primary-key lookup that the database serves from memory in about 1 ms mostly adds a network hop and staleness risk.</li>
</ul>
<h4>Example</h4><p>Two caches in a CPaaS API. The number-routing cache shows 97% hits, lookups at 2 ms p99 against 15 ms uncached, and about 30x fewer queries on the numbers table: keep it. The message-detail cache for get-message-by-ID shows 8% hits, because most messages are fetched once, plus high evictions. The primary-key lookup takes 1-2 ms anyway, so remove that cache and give its memory to something hot.</p>`,
    followups: [`What hit ratio would make you remove a cache, and what else would you check first?`, `How would you design an experiment that measures a cache's real effect on p99?`, `How do you measure the staleness users actually see?`],
    related: ["o3", "k1", "o5"]
  },
  k7: {
    tldr: `Avoid OFFSET for deep pages because the database reads and discards every skipped row. Use keyset (cursor) pagination: order by a unique, immutable key, index it, and return an opaque cursor holding the last row's sort values.`,
    body: `<h4>Core idea</h4><p><code>OFFSET 1000000 LIMIT 50</code> makes the database walk 1,000,050 rows and throw away all but 50, so each page is slower than the last. Pages also shift when rows are inserted or deleted between requests, so users see duplicates or miss rows. Keyset pagination asks for "the next 50 after this position" and seeks straight to it through an index. Page 2 and page 20,000 cost the same.</p>
<h4>How to do it</h4><ol>
<li>Choose a total order with a unique tiebreaker: <code>created_at DESC, id DESC</code>.</li>
<li>Index it with the filter first: <code>(account_id, created_at, id)</code>. A B-tree reads backward just as well, so this one index serves descending order.</li>
<li>Query from the last row seen:
<pre>SELECT * FROM messages
WHERE account_id = $1
  AND (created_at, id) &lt; ($2, $3)
ORDER BY created_at DESC, id DESC
LIMIT 51;</pre>
Postgres uses the composite index for this row comparison. Fetching one extra row tells you whether a next page exists.</li>
<li>Return an opaque cursor: base64 of the last row's sort values plus a hash of the filters. Sign it (HMAC) so clients cannot forge it, and reject it if the filters change.</li>
<li>Skip exact totals on huge sets. Show "more results", or an estimate from planner statistics.</li>
<li>For bulk needs, offer an async export (a CSV in object storage) instead of paging through millions of rows.</li>
<li>Other stores have native cursors: DynamoDB <code>LastEvaluatedKey</code>, Cassandra paging state, OpenSearch <code>search_after</code> with a point-in-time. OpenSearch <code>from</code> plus <code>size</code> stops at 10,000 results by default.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>No jumping to page 37. Fine for APIs, feeds and infinite scroll; if a UI needs page numbers, cap the depth.</li>
<li>Sorting by a mutable column (<code>status</code>, <code>updated_at</code>) makes rows jump between pages mid-scan. Sort by immutable columns.</li>
<li>Keyset is not a snapshot. For a stable scan, also bound the query with <code>created_at &lt;= query_start</code>.</li>
<li>For a previous page, flip the comparison and sort order, then reverse the results.</li>
<li>Across shards, each shard pages independently and a coordinator merges, so the cursor stores a position per shard.</li>
</ul>
<h4>Example</h4><p>A list-messages API for an account with 500M messages used <code>offset</code>, and deep pages timed out. The new version takes <code>limit</code> and <code>cursor</code>, as in <code>GET /v1/messages?limit=50&amp;cursor=eyJ0Ijo...</code>, and returns <code>next_cursor</code> (null on the last page). Every page is one index seek of a few milliseconds. The old <code>offset</code> parameter keeps working for compatibility, capped at 10,000, and the docs point clients to cursors.</p>`,
    followups: [`How do you implement a previous-page link with keyset pagination?`, `How would you paginate across 16 shards with one global sort order?`, `How do you move existing API clients from offset to cursor pagination without breaking them?`],
    related: ["d6", "d4", "c9"]
  },
  k8: {
    tldr: `Limit by account or API key, not IP, using token buckets that allow short bursts. Give endpoints cost-based limits, return 429 with Retry-After, queue instead of reject where possible, protect critical traffic, and fail open if the limiter breaks.`,
    body: `<h4>Core idea</h4><p>Rate limits protect shared capacity and enforce fair use. They hurt good users when they key on the wrong identity (many customers behind one NAT IP), punish normal bursts, treat all endpoints alike, or reject without saying when to retry. Pick the algorithm for the traffic shape:</p>
<ul>
<li><strong>Token bucket:</strong> refill r tokens per second up to capacity B. Allows bursts up to B, then a sustained r. Tiny state. The default for APIs.</li>
<li><strong>Leaky bucket:</strong> a queue drained at a fixed rate. Smooths output for a downstream with a hard throughput cap.</li>
<li><strong>Fixed window:</strong> <code>INCR</code> plus <code>EXPIRE</code> per minute. Simple, but allows up to 2x the limit around window boundaries.</li>
<li><strong>Sliding window counter:</strong> weight the previous window's count by how much of it still overlaps. Cheap and close enough. A sliding log (one entry per request) is exact but memory-heavy.</li>
</ul>
<h4>How to do it</h4><ol>
<li><strong>Key by identity:</strong> account or API key for authenticated calls. Use IP only for unauthenticated endpoints such as login and signup, with NAT-friendly thresholds.</li>
<li><strong>Budget by cost:</strong> separate buckets for cheap reads, writes and expensive calls. Add concurrency limits where the scarce resource is concurrency, such as simultaneous calls.</li>
<li><strong>Stay atomic:</strong> one Redis Lua script refills and takes tokens in a single step. Local per-node buckets skip the network hop but are approximate.</li>
<li><strong>Communicate:</strong> return 429 with <code>Retry-After</code>, and remaining-quota headers (such as <code>X-RateLimit-Remaining</code>) on every response. Document limits and support per-account overrides.</li>
<li><strong>Launch in shadow mode:</strong> log would-be rejections for a week, check who they hit, then enforce.</li>
<li><strong>Protect what matters:</strong> separate buckets for critical and bulk traffic, so a campaign cannot starve OTPs.</li>
<li><strong>Fail open</strong> to a local fallback limit if Redis is down, so a limiter outage is not an API outage. Fail closed on abuse-prone endpoints.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Limits at both gateway and service with different numbers confuse clients. Own them in one place.</li>
<li>A giant tenant's limiter key becomes a hot key; shard it or use local buckets.</li>
<li>Clients that retry 429s instantly make things worse. Ship SDKs with exponential backoff, jitter and <code>Retry-After</code> support.</li>
<li>Rejecting is not the only option: queue and delay when the work is asynchronous anyway.</li>
</ul>
<h4>Example</h4><p>A send-SMS API gives each account a token bucket of 100 requests per second with a burst capacity of 500, so an OTP spike after a login wave passes. Accepted messages enter a per-account queue drained at that account's carrier throughput (a leaky bucket), so big batches are delayed, not rejected. List endpoints get a separate bucket of 20 per second. The public send-OTP endpoint is also limited per destination number, for example 5 per hour, to block SMS pumping fraud.</p>`,
    followups: [`How would you enforce one global quota for an account that calls you from several regions?`, `Token bucket or sliding window for a public API, and why?`, `What should happen when the rate limiter's Redis cluster is down?`],
    related: ["p3", "c8", "r3"]
  }
});
