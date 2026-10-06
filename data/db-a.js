/* Database types, part A: relational, distributed SQL, key-value, document. Facts checked against official docs, papers and engineering blogs as of 2026-10-01. */
window.HUB_DB = window.HUB_DB || { types: [] };
window.HUB_DB.types.push(
  {
    id: `relational`,
    name: `Relational (SQL)`,
    family: `Operational`,
    summary: `Tables of typed rows with a declared schema, queried with SQL and protected by ACID transactions. The default home for transactional (OLTP) data, usually one primary server plus read replicas.`,
    glance: {
      model: `Tables of typed rows, keys, constraints and relations`,
      query: `SQL: joins, aggregates, secondary indexes, multi-statement transactions`,
      bestAt: `Correct multi-row transactions and flexible ad hoc queries`,
      weakAt: `Write scaling past one primary; huge analytic scans`,
      scale: `Vertical first, then read replicas, partitioning, application sharding`,
      consistency: `ACID; Read Committed default in PostgreSQL, Repeatable Read in MySQL`
    },
    how: [
      `<strong>Pages.</strong> Rows live in fixed-size pages: 8 kB in PostgreSQL, 16 KB in InnoDB by default. PostgreSQL keeps rows in an unordered heap; InnoDB stores them inside the primary key B-tree (the clustered index).`,
      `<strong>Indexes.</strong> <code>CREATE INDEX</code> builds a B-tree by default. A lookup walks root → leaf in a few page reads, and a range scan then follows the sorted leaves. In InnoDB a secondary index stores the primary key, so a lookup by it descends the clustered index a second time.`,
      `<strong>Planning.</strong> The planner uses table statistics (refreshed by <code>ANALYZE</code>) to pick an index scan or a sequential scan, and a join order. <code>EXPLAIN ANALYZE</code> shows the plan it chose and the real time spent in each step.`,
      `<strong>Writes go to the log first.</strong> A change is appended to the write-ahead log (WAL in PostgreSQL, redo log in InnoDB). A commit only needs that sequential log flushed; changed pages stay dirty in the buffer pool and reach the data files later, at a checkpoint. After a crash the log is replayed (REDO).`,
      `<strong>MVCC.</strong> Updates keep the old row version around: PostgreSQL writes a new tuple, InnoDB keeps the old one in its undo log. Each statement (Read Committed) or each transaction (Repeatable Read) reads a snapshot, so reading never blocks writing. VACUUM (PostgreSQL) or purge (InnoDB) removes old versions later.`,
      `<strong>Replication.</strong> Replicas replay the primary's log. PostgreSQL and MySQL both replicate asynchronously by default, so a replica lags (PostgreSQL's docs say typically under one second when the standby keeps up). Synchronous mode makes each commit wait at least one round trip to the standby.`,
      `<strong>Partitioning.</strong> One huge table can be split into range, list or hash partitions. The planner skips partitions that cannot match (pruning), and dropping an old partition is far faster than a bulk <code>DELETE</code> and leaves no VACUUM work.`
    ],
    diagram: {
      layers: [
        { name: `Client`, items: [[`App server`, `SQL over a pooled connection`]] },
        { name: `Server`, items: [[`Query planner`, `parses, picks index or scan`]] },
        { name: `Memory`, items: [[`Buffer pool`, `cached and dirty pages`], [`WAL buffer`, `log records for the commit`]] },
        { name: `Disk`, items: [[`Table and index pages`, `heap or clustered B-tree`], [`WAL files`, `sequential, flushed at commit`]] },
        { name: `Replicas`, items: [[`Read replica`, `replays WAL, may lag`]] }
      ],
      edges: [
        [`App server`, `Query planner`, `sync`, `SQL`],
        [`Query planner`, `Buffer pool`, `data`, `read or change pages`],
        [`Query planner`, `WAL buffer`, `data`, `log the change`],
        [`WAL buffer`, `WAL files`, `data`, `flush on commit`],
        [`Buffer pool`, `Table and index pages`, `data`, `misses, checkpoint writes`],
        [`WAL files`, `Read replica`, `repl`, `stream WAL`],
        [`App server`, `Read replica`, `sync`, `read-only queries`]
      ],
      paths: [
        { name: `A write`, nodes: [`App server`, `Query planner`, `WAL buffer`, `WAL files`, `Read replica`], note: `The commit returns once its WAL records are flushed to disk; the changed table pages are written later at a checkpoint, and the replica replays the same WAL a little behind.` },
        { name: `A read`, nodes: [`App server`, `Query planner`, `Buffer pool`, `Table and index pages`], note: `The planner walks a B-tree index; pages already in the buffer pool cost no disk I/O, and misses are read from disk and cached.` }
      ]
    },
    modeling: [
      `Normalize first: one fact in one place, enforced by foreign keys and unique constraints. Denormalize a specific read path only after a measured query needs it, and update the copy in the same transaction.`,
      `Design indexes from queries. For "latest orders for a customer", an index on <code>(customer_id, created_at)</code> serves both the filter and the sort. Equality columns go first; the range or sort column comes after them.`,
      `Pick a compact primary key that grows roughly in order (<code>bigint</code> identity or time-ordered UUIDv7). Random UUIDv4 keys scatter inserts across the B-tree: InnoDB pages filled in random order end up 1/2 to 15/16 full instead of about 15/16.`,
      `Every index speeds some reads but adds work to every write and takes space. Index for real queries, use partial or expression indexes for narrow cases (<code>lower(email)</code>), and drop indexes nobody uses.`,
      `Use <code>jsonb</code> for the truly variable part (per-tenant settings, raw webhook payloads) and keep anything you filter, join or constrain on as real columns. A GIN index on <code>jsonb</code> serves containment (<code>@&gt;</code>) and key-exists queries.`
    ],
    strengths: [
      `ACID transactions across many rows and tables, with the database enforcing invariants: foreign keys, unique and check constraints.`,
      `Ad hoc queries work on day one (joins, aggregates, window functions), and a new access pattern usually needs only a new index.`,
      `Mature operations: point-in-time recovery from base backups plus archived WAL, streaming replicas, online index builds, and decades of tooling and know-how.`,
      `One engine covers a lot: <code>jsonb</code> documents with GIN indexes, full-text search and extensions, so many products never need a second database.`
    ],
    weaknesses: [
      `Writes scale only as far as one primary; past that you shard in the application (or with Vitess for MySQL) or move to distributed SQL.`,
      `Replicas are asynchronous by default, so reads from them can be stale; read-your-writes needs routing back to the primary.`,
      `Connections are heavy: PostgreSQL forks a backend process per connection and <code>max_connections</code> is typically 100, so large fleets need a pooler.`,
      `Schema changes on big tables need care: most <code>ALTER TABLE</code> forms take an ACCESS EXCLUSIVE lock, and some (like changing a column's type) rewrite the table and its indexes.`,
      `Long analytic scans compete with OLTP traffic for CPU, I/O and cache; send them to a replica or a columnar warehouse.`
    ],
    use: `The default for business data with relationships and invariants: users, orders, payments, inventory, billing. Pick it when you need transactions, constraints and flexible queries, and the write load fits on one primary with room to scale it up.`,
    avoid: `Do not push it past one primary's write capacity (move to distributed SQL, or DynamoDB for known key-value access), into huge analytic scans (use a columnar warehouse), into relevance search at scale (use a search engine), or as the only layer for very hot reads (put a cache such as Redis in front).`,
    examples: [
      [`PostgreSQL`, `Open source and feature-rich: MVCC, many index types (B-tree, GIN, GiST, BRIN), <code>jsonb</code>, extensions. A strong default for new systems.`, `Amazon RDS, Aurora PostgreSQL, Cloud SQL, AlloyDB, Azure Database for PostgreSQL`],
      [`MySQL (InnoDB)`, `Widely deployed open source RDBMS: rows clustered by primary key, Repeatable Read by default. Vitess adds horizontal sharding on top.`, `Amazon RDS, Aurora MySQL, Cloud SQL, Azure Database for MySQL`],
      [`SQLite`, `Embedded database in one file inside your process: unlimited readers but only one writer at a time. Great for mobile, edge devices and tests.`, ``],
      [`Microsoft SQL Server`, `Commercial RDBMS, common in .NET and Windows-centric enterprise stacks.`, `Azure SQL Database, Amazon RDS for SQL Server`]
    ],
    pitfalls: [
      `<strong>Connection storms.</strong> Every PostgreSQL connection is a process and <code>max_connections</code> is typically 100, so autoscaled pods that each open a pool of 20 exhaust it fast. Put a pooler in front (PgBouncer, RDS Proxy); PgBouncer's transaction pooling breaks session features such as <code>SET</code>, <code>LISTEN</code> and session-level advisory locks.`,
      `<strong>Bloat from long transactions.</strong> An open transaction, even one idle in a forgotten session, keeps old row versions visible, so VACUUM cannot remove them and tables bloat. Old transactions and abandoned replication slots (say, a dead CDC consumer) also hold back the oldest XID; near wraparound PostgreSQL stops assigning new XIDs. Set <code>idle_in_transaction_session_timeout</code> and alert on transaction age.`,
      `<strong>Stale read after write.</strong> A user saves a profile, the next page reads an async replica that has not replayed the change, and the old value shows. Read from the primary for that user for a short window after a write, or use a replica only once it has replayed past the write's WAL position.`,
      `<strong>Hidden full scans.</strong> A function on an indexed column (<code>WHERE lower(email) = ...</code>) or a leading wildcard (<code>LIKE '%bar'</code>) cannot use a plain B-tree index. Check plans with <code>EXPLAIN ANALYZE</code> and add an expression index where needed.`,
      `<strong>A migration that freezes the table.</strong> <code>ALTER TABLE</code> needs an ACCESS EXCLUSIVE lock; while it waits behind one long query, every new query on that table queues behind it. Set <code>lock_timeout</code> and retry, and build indexes with <code>CREATE INDEX CONCURRENTLY</code> (no write lock, but slower).`
    ],
    interview: [
      `How does a B-tree index make a lookup fast, and what does each extra index cost on writes?`,
      `Two transactions update the same row at Read Committed. What happens, and when would you reach for <code>SELECT ... FOR UPDATE</code> or Serializable?`,
      `A user does not see their own update because reads go to a replica. How do you fix it without sending every read to the primary?`,
      `The primary is at 80% CPU from writes. What do you try before sharding, and how would you shard?`
    ],
    guides: [`sql-vs-nosql`, `replication-modes`, `normalize-denormalize`, `btree-vs-lsm`],
    deep: [`outbox-inbox`, `change-data-capture`, `sharding-consistent-hashing`],
    related: [`d2`, `d6`, `r7`, `t5`],
    sources: [
      { t: `Transaction Isolation`, by: `PostgreSQL documentation`, url: `https://www.postgresql.org/docs/current/transaction-iso.html` },
      { t: `Write-Ahead Logging (WAL)`, by: `PostgreSQL documentation`, url: `https://www.postgresql.org/docs/current/wal-intro.html` },
      { t: `Log-Shipping Standby Servers (streaming replication)`, by: `PostgreSQL documentation`, url: `https://www.postgresql.org/docs/current/warm-standby.html` },
      { t: `Clustered and Secondary Indexes`, by: `MySQL 8.4 Reference Manual`, url: `https://dev.mysql.com/doc/refman/8.4/en/innodb-index-types.html` },
      { t: `Zero-downtime Postgres migrations: the hard parts`, by: `Chris Sinjakli, GoCardless`, url: `https://gocardless.com/blog/zero-downtime-postgres-migrations-the-hard-parts` }
    ]
  },
  {
    id: `distributed-sql`,
    name: `Distributed SQL (NewSQL)`,
    family: `Operational`,
    summary: `Relational databases that split tables into many small key ranges, replicate each range with Raft or Paxos, and run ACID transactions across ranges, so one logical SQL database scales across nodes and regions.`,
    glance: {
      model: `Relational tables stored as a sorted, range-split key-value map`,
      query: `SQL, usually over the PostgreSQL or MySQL wire protocol`,
      bestAt: `Horizontal write scale and surviving zone or region loss, with ACID`,
      weakAt: `Per-statement latency, cross-region commits, hot keys, cost`,
      scale: `Add nodes; ranges split and rebalance automatically`,
      consistency: `Serializable or snapshot isolation; Spanner adds external consistency`
    },
    how: [
      `<strong>Ranges.</strong> Each table is stored as a sorted key-value map (primary key → row). The key space is cut into contiguous chunks: ranges in CockroachDB (split at 512 MiB by default), Regions in TiKV (256 MiB), tablets in YugabyteDB, splits in Spanner. Chunks split and move between nodes as data and load grow.`,
      `<strong>Consensus per range.</strong> Every range is its own Raft group (Paxos in Spanner), with replicas in different zones (3 by default in CockroachDB and TiKV). A write commits once a majority has it in its log, so 3 replicas survive one failure and 5 survive two.`,
      `<strong>Routing.</strong> Any node can act as the SQL gateway: it parses and plans the query, finds which ranges hold the keys (CockroachDB keeps that map in meta ranges; TiDB asks PD), and sends key-value reads and writes to each range's leaseholder or leader.`,
      `<strong>Cross-range transactions.</strong> A transaction that touches several ranges commits with two-phase commit run over the replicated groups. In CockroachDB each write lays down a Raft-replicated write intent (a provisional value plus a lock), and flipping one transaction record to COMMITTED makes them all visible. Spanner takes locks at each Paxos leader and runs 2PC across groups.`,
      `<strong>Timestamps without one clock.</strong> MVCC needs a global order. Spanner's TrueTime returns an interval with bounded error from GPS and atomic clocks (the 2012 paper reports an error bound, epsilon, of about 1-7 ms) and makes each commit wait out that uncertainty (commit wait). CockroachDB and YugabyteDB use hybrid logical clocks; a read that finds a value inside the uncertainty window restarts at a later timestamp. TiDB takes timestamps from a central oracle in PD.`,
      `<strong>Reads.</strong> The leaseholder serves consistent reads without a Raft round, because its writes already reached consensus. Reads that may be a few seconds stale (CockroachDB follower reads, Spanner snapshot reads) go to the nearest replica and skip the cross-region hop.`,
      `<strong>Placement.</strong> Multi-region setups choose per table: home each row in the region that uses it (CockroachDB REGIONAL BY ROW) for local reads and writes, or replicate a read-mostly table to every region (GLOBAL) and accept slower writes.`
    ],
    diagram: {
      layers: [
        { name: `Client`, items: [[`App server`, `PostgreSQL or MySQL driver`]] },
        { name: `SQL layer (any node)`, items: [[`SQL gateway`, `plans, coordinates the txn`]] },
        { name: `Ranges`, items: [[`Meta range`, `which node leads which range`], [`Leaseholder`, `leads the key's Raft group`]] },
        { name: `Followers`, items: [[`Follower (zone B)`, `Raft replica`], [`Follower (zone C)`, `Raft replica`]] },
        { name: `Storage`, items: [[`LSM engine`, `Pebble or RocksDB per node`]] }
      ],
      edges: [
        [`App server`, `SQL gateway`, `sync`, `SQL`],
        [`SQL gateway`, `Meta range`, `data`, `find the range`],
        [`SQL gateway`, `Leaseholder`, `sync`, `KV write or read`],
        [`Leaseholder`, `Follower (zone B)`, `repl`, `Raft append`],
        [`Leaseholder`, `Follower (zone C)`, `repl`, `Raft append`],
        [`Leaseholder`, `LSM engine`, `data`, `apply committed write`],
        [`SQL gateway`, `Follower (zone C)`, `sync`, `follower read`]
      ],
      paths: [
        { name: `A write`, nodes: [`App server`, `SQL gateway`, `Leaseholder`, `Follower (zone B)`], note: `The gateway sends the write to the range's leaseholder, which proposes it to Raft; it commits once a majority (itself plus one follower) has logged it, so latency includes a round trip to the nearest other zone or region.` },
        { name: `A follower read`, nodes: [`App server`, `SQL gateway`, `Follower (zone C)`], note: `A read at a timestamp a few seconds in the past is served by the nearest replica without asking the leaseholder; fresh reads go to the leaseholder instead.` }
      ]
    },
    modeling: [
      `Avoid sequential primary keys (<code>SERIAL</code>, timestamps), the opposite of single-node advice: here they pile every insert onto the last range. Use random UUIDs, or a hash-sharded index if you must keep a sequential column (range scans on it then fan out across shards).`,
      `Give rows that are read together a shared key prefix. Spanner can interleave child rows (an order's line items) physically next to the parent; elsewhere a primary key like <code>(customer_id, order_id)</code> keeps one customer's orders contiguous, usually in one range.`,
      `Keep transactions short and touching few rows: every range touched joins the commit, and long transactions collide more. Wrap each one in a retry loop for SQLSTATE 40001 and make it idempotent.`,
      `Index only what queries need: indexes are more key-value data that every write must also update, in another part of the key space, so an indexed insert often becomes a multi-range transaction.`,
      `In multi-region, set locality per table: home user-owned rows in the user's region, replicate small read-mostly tables everywhere, and use stale (follower) reads where seconds-old data is fine.`
    ],
    strengths: [
      `Scales reads and writes by adding nodes; ranges split and rebalance automatically, with no sharding logic in the application.`,
      `Keeps SQL, secondary indexes and ACID transactions across shards: Serializable by default in CockroachDB, external consistency in Spanner.`,
      `Survives node and zone loss with no committed data lost, because every commit sits on a majority of replicas; with 3 or more regions it can survive losing a region.`,
      `Placement controls pin rows or tables to regions for latency or data residency.`
    ],
    weaknesses: [
      `Higher latency per statement than one local Postgres: every commit needs a consensus round, and multi-range transactions add more.`,
      `Surviving a region failure costs time on every write: latency rises by at least the round trip to the nearest other region (CockroachDB docs).`,
      `Contention turns into aborts and retries the app must handle; hot rows and long transactions hurt more than on a single node.`,
      `Compatible is not identical: each product skips some PostgreSQL or MySQL features, and Aurora DSQL caps a transaction at 3,000 modified rows and 5 minutes.`,
      `More nodes, more money and more moving parts than one well-tuned primary.`
    ],
    use: `Use it when one primary can no longer take the write load or the data no longer fits on one machine and you still need SQL and transactions, or when you must survive a zone or region outage with no committed-data loss and serve users in several regions. Typical: ledgers, payment metadata, inventory, multi-region SaaS.`,
    avoid: `Overkill when the data fits on one Postgres or MySQL primary with replicas, which covers most products: you pay latency, money and compatibility gaps for scale you do not need. For simple key lookups at huge scale DynamoDB is simpler; for analytics use a warehouse.`,
    examples: [
      [`Google Spanner`, `The original: Paxos per split, TrueTime and commit wait, external consistency, global scale. GoogleSQL and PostgreSQL dialects.`, `Spanner on Google Cloud (managed only)`],
      [`CockroachDB`, `PostgreSQL wire-compatible: Raft per range, hybrid logical clocks, Serializable by default, Pebble (LSM) storage. Self-hosted or managed.`, `CockroachDB Cloud`],
      [`YugabyteDB`, `Reuses PostgreSQL's query layer (YSQL) over DocDB, a Raft-replicated store built on RocksDB; also YCQL, an API rooted in Cassandra's CQL.`, `YugabyteDB Aeon (AWS, Azure, Google Cloud)`],
      [`TiDB`, `MySQL-compatible: stateless TiDB servers over TiKV (Raft per Region, RocksDB inside), PD for metadata and timestamps, TiFlash columnar replicas for analytics.`, `TiDB Cloud`],
      [`Amazon Aurora DSQL`, `Serverless and PostgreSQL-compatible, active-active across Regions on one continent; optimistic concurrency, so conflicts fail at commit; isolation fixed at Repeatable Read.`, `AWS only (serverless)`]
    ],
    pitfalls: [
      `<strong>Sequential-key hotspot.</strong> A <code>SERIAL</code> or timestamp primary key appends every insert to the last range, and load-based splitting cannot split an append point, so a big cluster writes at the speed of one node. Use UUIDs or a hash-sharded index.`,
      `<strong>No retry loop.</strong> Serializable transactions in CockroachDB, and optimistic ones in Aurora DSQL, fail on conflict with SQLSTATE 40001. Code that never retries surfaces random errors as soon as load rises; retry with backoff and keep the transaction idempotent.`,
      `<strong>Clock drift.</strong> CockroachDB assumes node clocks stay within a maximum offset (500 ms by default); a node that finds itself out of sync with at least half the cluster by 80% of that crashes on purpose. Run NTP or chrony and alert on clock offset.`,
      `<strong>Accidental global writes.</strong> Replicas spread across distant regions with no locality rules make every write wait on a cross-region quorum. Decide each table's locality (regional rows, global reference tables) up front.`,
      `<strong>Assuming drop-in Postgres.</strong> Gaps show up late: CockroachDB has no range types or session-level advisory locks, Spanner's PostgreSQL interface has no extensions, Aurora DSQL has no temporary tables or PL/pgSQL. Run your real migrations and ORM tests against it early.`
    ],
    interview: [
      `How does a distributed SQL database order transactions without one global clock? Compare Spanner's TrueTime commit wait with CockroachDB's hybrid logical clocks and read restarts.`,
      `You place 3 replicas in 3 regions. What is the minimum write latency, and how would you keep a user's writes local?`,
      `Why is an auto-increment primary key a hotspot here when it is a fine choice in single-node Postgres or MySQL?`,
      `When is distributed SQL overkill, and what would you use instead?`
    ],
    guides: [`sql-vs-nosql`, `consistency-levels`, `sharding-keys`, `id-generation`],
    deep: [`two-phase-commit`, `leader-election-fencing`, `idempotency-keys`],
    related: [`t10`, `t8`, `r5`, `t7`],
    sources: [
      { t: `Spanner: Google's Globally-Distributed Database (OSDI 2012)`, by: `James C. Corbett et al., Google`, url: `https://www.usenix.org/conference/osdi12/technical-sessions/presentation/corbett` },
      { t: `Transaction Layer`, by: `CockroachDB docs`, url: `https://docs.cockroachlabs.com/docs/stable/architecture/transaction-layer` },
      { t: `Living without atomic clocks: where CockroachDB and Spanner diverge`, by: `Spencer Kimball, Cockroach Labs`, url: `https://www.cockroachlabs.com/blog/living-without-atomic-clocks/` },
      { t: `TiDB Architecture`, by: `PingCAP docs`, url: `https://docs.pingcap.com/tidb/stable/tidb-architecture/` },
      { t: `Concurrency control in Aurora DSQL`, by: `Amazon Aurora DSQL docs`, url: `https://docs.aws.amazon.com/aurora-dsql/latest/userguide/working-with-concurrency-control.html` }
    ]
  },
  {
    id: `key-value`,
    name: `Key-value stores`,
    family: `Operational`,
    summary: `Store a value under a unique key and find it by hashing or sorting the key. Spans in-memory caches (Redis, Memcached), durable services (DynamoDB), consensus stores (etcd) and embedded engines (RocksDB).`,
    glance: {
      model: `Key → value: opaque bytes, or typed structures in Redis`,
      query: `Get, put, delete by key; ranges only on sorted keys`,
      bestAt: `Predictable, very fast lookups by key at huge scale`,
      weakAt: `Ad hoc queries, joins, lookups by non-key attributes`,
      scale: `Hash-partition keys across nodes; add partitions or shards`,
      consistency: `Varies: async replicas (Redis), optional strong reads (DynamoDB), linearizable (etcd)`
    },
    how: [
      `<strong>Partition by key.</strong> The key is hashed to pick a partition. DynamoDB hashes the partition key; Redis Cluster maps <code>CRC16(key) mod 16384</code> to one of 16,384 hash slots; Memcached clients hash the key to choose a server, and the servers never talk to each other. One key lives in one place, so a lookup is one hop.`,
      `<strong>Sorted within a partition, when supported.</strong> With a composite key, DynamoDB stores items that share a partition key together, sorted by the sort key, so one <code>Query</code> returns a range (a user's orders in September). etcd and RocksDB keep all keys sorted and support range scans; Memcached only does exact-key gets.`,
      `<strong>In memory.</strong> Redis and Memcached keep the dataset in RAM. Redis executes commands on one main thread, one at a time, so each command is atomic but one slow O(N) command stalls every client. Memcached is multithreaded (4 threads by default) and stores plain blobs.`,
      `<strong>Redis durability is optional.</strong> RDB writes point-in-time snapshots from a forked child (you can lose the last few minutes); AOF logs every write and by default fsyncs once per second (you can lose about a second). Replication to replicas is asynchronous.`,
      `<strong>DynamoDB durability.</strong> Each partition has 3 replicas in different Availability Zones forming a Multi-Paxos group. The leader logs a write and acknowledges once a quorum of replicas has persisted it to their write-ahead logs; storage replicas also keep a B-tree of the items. Only the leader serves strongly consistent reads; any replica serves eventually consistent ones.`,
      `<strong>LSM engines on disk.</strong> RocksDB appends writes to a WAL and an in-memory memtable, flushes full memtables to sorted, immutable SST files, and compacts them in the background. Reads check the memtable, then SST files, using Bloom filters to skip files that cannot hold the key.`,
      `<strong>Consensus stores.</strong> etcd runs every write through Raft and serves linearizable reads by default. It is built for small, critical data (configuration, leader election, Kubernetes API state): requests are capped at 1.5 MiB and the default storage quota is 2 GiB.`
    ],
    diagram: {
      layers: [
        { name: `Client`, items: [[`App server`, `GetItem, PutItem, Query`]] },
        { name: `Request routers`, items: [[`Request router`, `auth, hash the partition key`]] },
        { name: `Partition leader (AZ a)`, items: [[`Leader replica`, `writes and strong reads`]] },
        { name: `Other replicas`, items: [[`Replica (AZ b)`, `WAL plus B-tree`], [`Replica (AZ c)`, `WAL plus B-tree`]] },
        { name: `Global secondary index`, items: [[`GSI partition`, `same items, another key`]] }
      ],
      edges: [
        [`App server`, `Request router`, `sync`, `request by key`],
        [`Request router`, `Leader replica`, `sync`, `write or strong read`],
        [`Leader replica`, `Replica (AZ b)`, `repl`, `log record`],
        [`Leader replica`, `Replica (AZ c)`, `repl`, `log record`],
        [`Request router`, `Replica (AZ c)`, `sync`, `eventual read`],
        [`Leader replica`, `GSI partition`, `async`, `async index update`]
      ],
      paths: [
        { name: `A write`, nodes: [`App server`, `Request router`, `Leader replica`, `Replica (AZ b)`], note: `The router hashes the partition key to find the partition; the leader writes a log record and acknowledges once a quorum of replicas has persisted it. GSIs catch up asynchronously.` },
        { name: `An eventually consistent read`, nodes: [`App server`, `Request router`, `Replica (AZ c)`], note: `By default a read can go to any replica and may miss a write from the last moment; set <code>ConsistentRead</code> to read from the leader at twice the read cost.` }
      ]
    },
    modeling: [
      `Start from access patterns, not entities. List every query (get a user, a user's orders newest first, orders by status) and shape keys so each one is a single <code>GetItem</code> or <code>Query</code>.`,
      `Choose a high-cardinality partition key whose traffic spreads evenly (<code>user_id</code>, <code>order_id</code>), not a low-cardinality one (<code>status</code>, today's date). Each DynamoDB partition tops out at 3,000 read units and 1,000 write units per second.`,
      `Group related items under one partition key (single-table design): <code>PK = USER#42</code>, <code>SK = ORDER#2026-09-30#981</code>, so one <code>Query</code> on the user returns their orders sorted by date. Mix entity types in one table only when they are read together.`,
      `Add a GSI per extra access pattern (orders by status). GSI reads are eventually consistent only, each GSI adds write cost, and an under-provisioned GSI throttles writes to the base table. LSIs must be created with the table and cap each partition key's data at 10 GB.`,
      `In Redis, pick the structure that matches the operation: a hash for an object's fields, a sorted set for leaderboards and time-ordered feeds, a set for membership, <code>INCR</code> for counters, and a TTL on every cache key.`
    ],
    strengths: [
      `Predictable latency at any size: one key → one partition → one lookup. DynamoDB is designed for low single-digit millisecond latency; on Prime Day 2021 Amazon's traffic to it peaked at 89.2 million requests per second.`,
      `Scales out by adding partitions or shards; keys are independent, so there is no cross-key coordination on the hot path.`,
      `Managed options remove servers entirely: DynamoDB is serverless, and ElastiCache and MemoryDB run Valkey and Redis OSS.`,
      `Redis gives atomic operations on rich in-memory structures (hashes, lists, sets, sorted sets, streams), so counters, rate limits, leaderboards, queues and locks take one round trip.`
    ],
    weaknesses: [
      `No ad hoc queries: anything not answerable by key needs an index you planned, or a <code>Scan</code> that reads (and bills) the whole table.`,
      `Hot keys: one very popular key sits on one partition or shard, which caps its throughput no matter how large the cluster is.`,
      `Limited transactions and no joins: DynamoDB transactions cover up to 100 items and 4 MB; in Redis Cluster, multi-key commands need all keys in the same hash slot.`,
      `In-memory stores are bounded by RAM, and asynchronous replication means a failover can drop acknowledged writes; Redis docs say so even with <code>WAIT</code>.`,
      `Small values only: a DynamoDB item is at most 400 KB, and Memcached's default maximum item size is 1 MB.`
    ],
    use: `Use it when access is by key and the patterns are known: sessions, carts, user profiles, feature flags, idempotency keys, rate-limit counters, leaderboards, caching, and high-scale OLTP with fixed queries (DynamoDB). Use etcd only for small, critical coordination data.`,
    avoid: `Avoid it when queries are ad hoc or relational (filters on many fields, joins, reports): use Postgres. Do not make Redis the only copy of data you cannot lose unless you accept losing writes on failover. Avoid DynamoDB while access patterns are still unknown or changing fast.`,
    examples: [
      [`Redis`, `In-memory data structure server: strings, hashes, lists, sets, sorted sets, streams; RDB and AOF persistence; Redis Cluster for sharding.`, `Amazon ElastiCache, Amazon MemoryDB, Google Memorystore, Redis Cloud`],
      [`Valkey`, `BSD-licensed fork of Redis 7.2.4 under the Linux Foundation, launched in March 2024 after Redis changed its license.`, `Amazon ElastiCache, Amazon MemoryDB, Memorystore for Valkey`],
      [`Memcached`, `Multithreaded in-memory cache for plain blobs; no persistence or replication, and clients hash keys across independent servers.`, `Amazon ElastiCache for Memcached`],
      [`Amazon DynamoDB`, `Serverless key-value and document store: partition plus sort keys, GSIs, transactions, streams, multi-Region global tables.`, `AWS only (fully managed)`],
      [`etcd`, `Small, strongly consistent (Raft) store for configuration and coordination; holds all Kubernetes API server data.`, ``],
      [`RocksDB`, `Embedded LSM-tree library that started at Facebook from LevelDB code; the storage engine inside TiKV and YugabyteDB's DocDB.`, ``]
    ],
    pitfalls: [
      `<strong>Hot partition.</strong> A key like today's date or a celebrity's user ID funnels traffic into one partition, and DynamoDB throttles it at the per-partition limit even when the table has spare capacity; splitting cannot help a single hot item. Spread writes with key suffixes (<code>date.1</code> to <code>date.200</code>) and cache hot reads.`,
      `<strong>Eviction surprise.</strong> When Redis reaches <code>maxmemory</code>, the policy decides: <code>noeviction</code> makes writes fail with errors, <code>allkeys-lru</code> silently drops keys you may have treated as stored. Keep cache data and must-keep data in separate instances.`,
      `<strong>Losing writes on failover.</strong> Redis replicates asynchronously; if the primary dies before a replica gets a write, that write is gone even though the client got OK. <code>WAIT</code> narrows the window but does not make Redis strongly consistent.`,
      `<strong>Blocking the single thread.</strong> <code>KEYS *</code> or a big <code>SUNION</code> runs to completion while every other client waits. Use the <code>SCAN</code> family and keep collections bounded.`,
      `<strong>Scan as a query.</strong> A missing access pattern becomes a <code>Scan</code> with a filter, which reads every item, burns capacity and can throttle the partitions it hits. Add a GSI instead.`
    ],
    interview: [
      `Design keys for an orders table that must support "get order", "a user's orders by date" and "orders by status". What goes in the partition key, the sort key and the GSIs?`,
      `One key gets 100x the traffic of the rest. What breaks, and how do you fix it for reads and for writes?`,
      `Redis holds your sessions and rate-limit counters. What happens to each when the primary fails, and which persistence settings would you choose?`,
      `How does DynamoDB's replication (a Multi-Paxos leader per partition) differ from the 2007 Dynamo paper's sloppy quorums, hinted handoff and vector clocks?`
    ],
    guides: [`sql-vs-nosql`, `sharding-keys`, `redis-vs-memcached`, `btree-vs-lsm`],
    deep: [`sharding-consistent-hashing`, `cache-aside-stampede`, `rate-limiting`],
    related: [`d4`, `d5`, `k5`, `k4`],
    sources: [
      { t: `Amazon DynamoDB: A Scalable, Predictably Performant, and Fully Managed NoSQL Database Service (USENIX ATC 2022)`, by: `Mostafa Elhemali et al., Amazon Web Services`, url: `https://www.usenix.org/conference/atc22/presentation/elhemali` },
      { t: `Best practices for designing and using partition keys effectively`, by: `Amazon DynamoDB docs`, url: `https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html` },
      { t: `Redis persistence`, by: `Redis docs`, url: `https://redis.io/docs/latest/operate/oss_and_stack/management/persistence/` },
      { t: `Redis cluster specification`, by: `Redis docs`, url: `https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/` },
      { t: `Dynamo: Amazon's Highly Available Key-value Store (SOSP 2007)`, by: `Giuseppe DeCandia et al., Amazon`, url: `https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf` }
    ]
  },
  {
    id: `document`,
    name: `Document stores`,
    family: `Operational`,
    summary: `Store self-describing JSON-like documents (nested objects and arrays) in collections, so data read together lives together. Any field can be indexed; the schema is flexible, and collections shard by a shard key.`,
    glance: {
      model: `JSON or BSON documents with nested objects and arrays`,
      query: `Field filters, secondary indexes, aggregation pipelines, limited joins`,
      bestAt: `Aggregates read and written as one unit; varied shapes`,
      weakAt: `Many-to-many relations, cross-document invariants, heavy joins`,
      scale: `Replica sets for availability; shard collections by a key`,
      consistency: `Atomic per document; tunable read and write concerns`
    },
    how: [
      `<strong>One record per aggregate.</strong> A document is stored and fetched as a unit (BSON in MongoDB, at most 16 MiB; bigger files go to GridFS). Reading an order with its line items and address is one lookup with no joins.`,
      `<strong>Storage engine.</strong> MongoDB's WiredTiger uses document-level concurrency control, compresses collections with snappy by default, records every change in a journal (its write-ahead log) and checkpoints data files every 60 seconds; after a crash it replays the journal from the last checkpoint.`,
      `<strong>Indexes.</strong> Indexes are B-trees on any field, including nested ones; on an array field a multikey index gets one entry per element. Without a matching index a query scans every document in the collection. Order compound index fields by the ESR guideline: equality, then sort, then range.`,
      `<strong>Replica sets.</strong> Writes go to the primary, which records them in its oplog; secondaries copy and apply the oplog asynchronously. The implicit default write concern, <code>w: "majority"</code>, acknowledges once a majority of voting members have the write. If the primary goes silent for 10 seconds (the default election timeout), a secondary calls an election.`,
      `<strong>Transactions.</strong> A single-document write is atomic, which covers most needs when related data is embedded. Multi-document ACID transactions work on replica sets and sharded clusters but cost more, and by default must finish within 60 seconds.`,
      `<strong>Sharding.</strong> A sharded collection is split into chunks by ranges or hashes of the shard key, spread across shards. <code>mongos</code> routers cache the chunk map from the config servers: a query with the shard key goes to one shard, a query without it goes to every shard (scatter-gather).`,
      `<strong>Validation.</strong> A collection can carry a <code>$jsonSchema</code> validator for required fields, types and ranges; by default an insert or update that breaks it is rejected.`
    ],
    diagram: {
      layers: [
        { name: `Client`, items: [[`App server`, `driver: find, insert, update`]] },
        { name: `Routing`, items: [[`mongos router`, `caches the chunk map`]] },
        { name: `Cluster`, items: [[`Config servers`, `chunk ranges → shards`], [`Shard A primary`, `owns the key's chunk`], [`Shard B primary`, `owns other chunks`]] },
        { name: `Storage engine`, items: [[`WiredTiger`, `cache, journal, checkpoints`]] },
        { name: `Replica set`, items: [[`Shard A secondary`, `applies the oplog`]] }
      ],
      edges: [
        [`App server`, `mongos router`, `sync`, `query or write`],
        [`mongos router`, `Config servers`, `data`, `load chunk map`],
        [`mongos router`, `Shard A primary`, `sync`, `targeted by shard key`],
        [`mongos router`, `Shard B primary`, `sync`, `scatter, no shard key`],
        [`Shard A primary`, `WiredTiger`, `data`, `journal, then cache`],
        [`Shard A primary`, `Shard A secondary`, `repl`, `oplog`]
      ],
      paths: [
        { name: `A write`, nodes: [`App server`, `mongos router`, `Shard A primary`, `Shard A secondary`], note: `The document's shard key picks one chunk, so mongos sends the insert to one shard; with the default majority write concern the primary acknowledges once most of its replica set has the oplog entry.` },
        { name: `A query without the shard key`, nodes: [`App server`, `mongos router`, `Shard B primary`], note: `With no shard key in the filter, mongos must ask every shard and wait for all of them, so the slowest shard sets the latency.` }
      ]
    },
    modeling: [
      `Embed what is read together and owned by the parent (an order's line items, a user's addresses). Reference what is shared, high-cardinality, unbounded or updated on its own (products, authors, comments on a popular post).`,
      `Bound every array. An array that grows forever (events per device, comments per post) pushes the document toward 16 MiB and slows index updates; keep a small subset in the parent and the rest in its own collection (the subset pattern).`,
      `Duplicate a few read-mostly fields (the author's name on each post) to skip lookups, and own the job of updating the copies when the source changes.`,
      `Choose the shard key for high cardinality, even frequency and presence in most queries, for example <code>{ tenantId: 1, orderId: 1 }</code>. A monotonically increasing key (a timestamp, an ObjectId) sends every insert to one shard unless it is hashed.`,
      `Treat schemaless as schema-in-the-application: add a <code>$jsonSchema</code> validator for required fields and types, and version document shapes with a <code>schemaVersion</code> field so readers can handle old ones.`
    ],
    strengths: [
      `Natural fit for aggregate-shaped data: one read and one atomic write per business object, with no object-relational mapping layer.`,
      `Flexible schema: documents in one collection can differ, and adding a field needs no migration, with validation when you want it.`,
      `Rich queries on nested fields and arrays (multikey indexes), plus an aggregation pipeline for grouping and reshaping.`,
      `Built-in replication with automatic failover (median election within about 12 seconds by default) and native sharding when one replica set is not enough.`,
      `Change streams let services subscribe to inserts and updates without tailing the oplog by hand.`
    ],
    weaknesses: [
      `Relational data fits poorly: <code>$lookup</code> joins exist, but many-to-many links and cross-collection invariants are your job.`,
      `Atomicity is per document by default; multi-document transactions work but cost more, and MongoDB's own docs say good schema design should minimize the need for them.`,
      `Duplicated data drifts unless every writer updates every copy.`,
      `The shard key is hard to undo: <code>reshardCollection</code> (since MongoDB 5.0) redistributes all the data, and a bad key means hot shards or scatter-gather.`,
      `Schema drift: without validation, old document shapes pile up and every reader must handle all of them.`
    ],
    use: `Use it when each business object is read and written as a unit with nested parts (product catalogs with varied attributes, content and CMS, user profiles, event payloads), when shapes change often, and when you want built-in horizontal scale. Firestore fits mobile and web apps that need live sync and offline use.`,
    avoid: `Avoid it for highly relational data with cross-entity invariants (ledgers, double-entry accounting, inventory with many joins). If you only need a few flexible attributes on relational data, Postgres <code>jsonb</code> gives you documents plus joins, constraints and transactions in one database.`,
    examples: [
      [`MongoDB`, `BSON documents, rich indexes and aggregation, replica sets, native sharding, multi-document transactions, change streams.`, `MongoDB Atlas (AWS, Google Cloud, Azure)`],
      [`Couchbase`, `JSON documents with fast key-value access and SQL++ queries; keys hash (CRC32) into vBuckets spread across nodes.`, `Couchbase Capella`],
      [`Google Cloud Firestore`, `Serverless documents in collections and subcollections, real-time listeners and an offline cache; every query needs an index; 1 MiB max document.`, `Firebase or Google Cloud (managed only)`],
      [`Amazon DocumentDB`, `MongoDB-compatible service (3.6, 4.0, 5.0 and 8.0 APIs) with compute separate from a storage volume replicated six ways across three AZs.`, `AWS only (fully managed)`],
      [`PostgreSQL jsonb`, `Not a document database, but often the better pick: <code>jsonb</code> columns with GIN indexes next to normal relational tables, in one transaction.`, `Any managed Postgres (RDS, Aurora, Cloud SQL)`]
    ],
    pitfalls: [
      `<strong>Unbounded arrays.</strong> Appending every event or comment to one document grows it toward the 16 MiB cap, and updates and index maintenance slow down long before that. Model the growing side as its own collection.`,
      `<strong>Scatter-gather queries.</strong> Queries without the shard key hit every shard, so their cost grows with the number of shards. Put the shard key in the filters of hot queries.`,
      `<strong>Monotonic shard keys.</strong> Sharding on <code>createdAt</code> or the default ObjectId <code>_id</code> routes all inserts to the chunk at the top of the range, so one shard takes every write. Use a hashed key or a compound key led by a well-spread field.`,
      `<strong>Stale reads from secondaries.</strong> Any read preference other than <code>primary</code> may return stale data, because secondaries replicate asynchronously. Read from the primary, or use causally consistent sessions with majority concerns, where users must see their own writes.`,
      `<strong>Transactions as a crutch.</strong> Porting a normalized SQL schema and wrapping every request in a multi-document transaction gives you the costs of both worlds, and transactions running past 60 seconds abort by default. Re-model so most writes touch one document.`
    ],
    interview: [
      `Would you embed comments in a post document or store them separately? What changes when one post gets 100,000 comments?`,
      `Pick a shard key for a multi-tenant orders collection. What goes wrong with a timestamp key, and with <code>tenantId</code> alone when one tenant is huge?`,
      `When do you need a multi-document transaction in MongoDB, and how would you model the data to avoid it?`,
      `Why might Postgres with <code>jsonb</code> beat a document database for this product?`
    ],
    guides: [`sql-vs-nosql`, `normalize-denormalize`, `sharding-keys`, `consistency-levels`],
    deep: [`change-data-capture`, `sharding-consistent-hashing`],
    related: [`d2`, `d3`, `d8`, `p6`],
    sources: [
      { t: `MongoDB Limits and Thresholds`, by: `MongoDB docs`, url: `https://www.mongodb.com/docs/manual/reference/limits/` },
      { t: `Best Practices for Data Modeling in MongoDB`, by: `MongoDB docs`, url: `https://www.mongodb.com/docs/manual/data-modeling/best-practices/` },
      { t: `Transactions`, by: `MongoDB docs`, url: `https://www.mongodb.com/docs/manual/core/transactions/` },
      { t: `Choose a Shard Key`, by: `MongoDB docs`, url: `https://www.mongodb.com/docs/manual/core/sharding-choose-a-shard-key/` },
      { t: `JSON Types`, by: `PostgreSQL documentation`, url: `https://www.postgresql.org/docs/current/datatype-json.html` }
    ]
  }
);
