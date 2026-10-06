/* Decision guides and "when to use / when not to" notes for technologies and patterns. */
window.HUB_TRADEOFFS = {
  guides: [
    {
      id: `sql-vs-nosql`,
      area: `Data`,
      title: `SQL vs NoSQL`,
      question: `Where should this data live?`,
      options: [
        { name: `Relational (Postgres, MySQL)`, pick: `Your default for business data such as accounts, billing and message records. You get joins, transactions, constraints and ad hoc queries, and one well-tuned instance handles more load than most teams expect.`, avoid: `When one table must absorb very high write rates across regions, or the data has no fixed shape and you never query across records.`, cost: `What you pay: migrations on big tables need care, and scaling writes past one primary means sharding, which is real work.` },
        { name: `Key-value or document (DynamoDB, MongoDB)`, pick: `When you know the access patterns up front and they are mostly get or put by key at a scale you do not want to operate, such as sessions, idempotency keys or status by message ID.`, avoid: `When the product keeps inventing new queries, reports and joins. Every new access pattern means a new index or another copy of the data.`, cost: `What you pay: you model around queries instead of entities, multi-item transactions are limited, and analytics needs an export to another store.` },
        { name: `Wide-column (Cassandra, ScyllaDB)`, pick: `When writes are huge and append-shaped (events, time series, call detail records) and you need writes in several datacenters with tunable consistency.`, avoid: `When the data is small or medium, or you need joins, uniqueness constraints or read-modify-write transactions.`, cost: `What you pay: one table per query pattern, tombstone and compaction tuning, and a cluster that needs a real operator.` }
      ],
      rule: `Start with Postgres and move a workload out only when you can name the access pattern or scale it cannot serve.`,
      signals: [
        `Access patterns are unknown or change every sprint → relational.`,
        `Mostly lookups by one key at very high, spiky volume → key-value.`,
        `You must update several rows together safely (debit a balance and insert a ledger row) → relational.`,
        `An append-only firehose that you read back by time range → wide-column or a columnar store.`
      ],
      related: [`d2`, `d4`, `t1`]
    },
    {
      id: `oltp-olap-search`,
      area: `Data`,
      title: `Postgres vs ClickHouse vs OpenSearch`,
      question: `Which engine should serve this query?`,
      options: [
        { name: `Postgres (OLTP)`, pick: `For the system of record: small reads and writes by key, transactions, and queries that touch a few rows.`, avoid: `For dashboards that scan and aggregate hundreds of millions of rows, or fuzzy text search over large text fields.`, cost: `What you pay: heavy analytics on the primary competes with live traffic, and even a read replica struggles with big scans.` },
        { name: `ClickHouse (OLAP)`, pick: `For analytics over large append-only data such as message logs, call records and usage events: fast GROUP BY over billions of rows with strong compression.`, avoid: `As a system of record, or for frequent single-row updates and deletes. It has no real multi-row transactions.`, cost: `What you pay: a second copy of the data fed by a pipeline, batched inserts (many tiny inserts hurt), and data that is a little behind the source.` },
        { name: `OpenSearch (search)`, pick: `For full-text search, relevance ranking, fuzzy matching, and log exploration that filters on many fields at once.`, avoid: `As a primary database, or for exact counts and heavy aggregations at scale, which ClickHouse does more cheaply.`, cost: `What you pay: memory-hungry clusters, shard and mapping planning, near-real-time visibility (new documents appear after a refresh, about a second by default), and a reindex whenever a mapping changes.` }
      ],
      rule: `Write to Postgres, copy to ClickHouse for aggregates and to OpenSearch for text search, and never make a copy the source of truth.`,
      signals: [
        `The query is "count or sum by day and by customer over months" → ClickHouse.`,
        `Users type free text and expect typo tolerance or ranking → OpenSearch.`,
        `The query must see a write that just happened, inside a transaction → Postgres.`,
        `An analytics query is slowing the primary → move it to a replica first, then to an OLAP store.`
      ],
      related: [`d1`, `d2`, `d6`]
    },
    {
      id: `replication-modes`,
      area: `Data`,
      title: `Single-leader vs multi-leader vs leaderless`,
      question: `How should copies of the data stay in sync?`,
      options: [
        { name: `Single-leader (Postgres, MySQL, Aurora)`, pick: `The default for almost everything: one node takes writes, replicas serve reads and stand by for failover, and there are no write conflicts to resolve.`, avoid: `When clients in several regions must all write with low latency, or the write rate is more than one node can take.`, cost: `What you pay: replica lag (stale reads), a failover window where writes fail, and possible loss of the last writes with async replication.` },
        { name: `Multi-leader`, pick: `When each region must accept writes locally and keep working when cut off from the others, or for offline-first clients that sync later.`, avoid: `When two places can update the same record and you have no clear merge rule. Conflict handling is the whole problem.`, cost: `What you pay: conflict resolution (last write wins silently drops data, and CRDTs or custom merges are hard) and bugs that appear only during partitions.` },
        { name: `Leaderless quorum (Cassandra, ScyllaDB, Riak)`, pick: `For high write availability across nodes and datacenters where some staleness is fine, tuned with quorums (W + R greater than N gives overlapping reads).`, avoid: `When you need read-modify-write transactions, uniqueness, or strictly ordered updates to one record.`, cost: `What you pay: read repair, hinted handoff and anti-entropy to reason about, last-write-wins by timestamp, and clock skew that can drop writes.` }
      ],
      rule: `Use single-leader until you can show that one write node or one write region is the bottleneck.`,
      signals: [
        `Users on several continents need low-latency writes → multi-leader or leaderless, with the merge story designed first.`,
        `Losing the last few seconds of writes on failover is unacceptable → synchronous or semi-synchronous replication to at least one replica.`,
        `Reads right after writes return old data → replica lag; send those reads to the leader.`
      ],
      related: [`t10`, `t8`, `r5`]
    },
    {
      id: `consistency-levels`,
      area: `Data`,
      title: `Strong vs read-your-writes vs eventual consistency`,
      question: `How fresh must a read be?`,
      options: [
        { name: `Strong (linearizable)`, pick: `For balances, credits, inventory and uniqueness (one username, one number per account): anything where acting on stale data costs money.`, avoid: `For feeds, counters, analytics and search, where a few seconds of lag is invisible to users.`, cost: `What you pay: reads go to the leader or a quorum, cross-region coordination adds round trips, and you lose availability during partitions.` },
        { name: `Read-your-writes or causal`, pick: `For user flows where people must see their own changes (save settings, reload the page) but do not need everyone else's changes instantly.`, avoid: `When other users or services also need the latest value right away. This guarantee is per session only.`, cost: `What you pay: sticky sessions, reading from the leader for a short window after a write, or tracking a version per client.` },
        { name: `Eventual`, pick: `For caches, search indexes, analytics, delivery-report dashboards and read models shared across services.`, avoid: `For check-then-act logic like "if the balance is enough, send". Stale reads there cause overspend.`, cost: `What you pay: users can see old data, so you need reconciliation jobs and a UI that tolerates lag.` }
      ],
      rule: `Pick the weakest level each read can tolerate, and make the few money and uniqueness paths strongly consistent.`,
      signals: [
        `A stale read could cause double spending or a duplicate unique record → strong.`,
        `Users report "I saved it but it disappeared" → add read-your-writes.`,
        `Data crosses services through events → it is eventual whether you like it or not, so design the UI for it.`
      ],
      related: [`t1`, `t2`, `t5`]
    },
    {
      id: `sharding-keys`,
      area: `Data`,
      title: `Hash vs range vs tenant or directory-based sharding`,
      question: `How do I split data across nodes?`,
      options: [
        { name: `Hash of a key`, pick: `When you want an even spread of load and queries look up one key at a time, such as a message ID or user ID.`, avoid: `When you need range scans (everything from the last hour) or queries across many keys, which become scatter-gather.`, cost: `What you pay: range queries hit every shard, and resharding moves data unless you use consistent hashing or many small virtual shards.` },
        { name: `Range of a key`, pick: `When queries read contiguous ranges, like time series by timestamp, and you want to split hot ranges as they grow.`, avoid: `When the key is monotonic, like a timestamp, so every new write lands on the last shard.`, cost: `What you pay: hot spots at the edge of the range, and a rebalancer that splits and moves ranges.` },
        { name: `Tenant or directory-based`, pick: `For B2B systems where almost every query is scoped to one customer. A lookup table maps tenant to shard, so you can move or isolate a big tenant.`, avoid: `When one tenant is bigger than a shard can hold, or many queries cross tenants.`, cost: `What you pay: a directory that must be highly available and cached, plus uneven shards because tenants differ in size by orders of magnitude.` }
      ],
      rule: `Shard by the key that almost every query already filters on, and keep a directory so you can move the one huge customer later.`,
      signals: [
        `One customer sends most of the traffic → give them their own shard through a directory.`,
        `Nearly every query includes a tenant ID → tenant-based.`,
        `Writes pile onto the newest shard → the key is monotonic; hash it or add a prefix.`
      ],
      related: [`d3`, `d4`, `d5`]
    },
    {
      id: `normalize-denormalize`,
      area: `Data`,
      title: `Normalize vs denormalize`,
      question: `Should I store this fact once, or copy it to where it is read?`,
      options: [
        { name: `Normalized`, pick: `The default for OLTP: every fact lives in one place, so updates are cheap and copies cannot disagree.`, avoid: `When a hot read path needs a five-way join on every request and you have measured it as the bottleneck.`, cost: `What you pay: joins at read time, and cross-shard joins become impractical once you shard.` },
        { name: `Denormalized (copied fields, precomputed rows)`, pick: `For read-heavy paths, per-query tables in NoSQL, and snapshots that should never change, like the price at the time of an order.`, avoid: `When the copied data changes often and must be right everywhere, like a customer's current plan.`, cost: `What you pay: write fan-out, drift between copies, and a backfill every time the shape changes.` },
        { name: `Materialized views or read models`, pick: `When you want both: keep the normalized source and build a derived table, refreshed by a job or by events (the CQRS style).`, avoid: `When a read must reflect a write instantly and refresh lag is not acceptable.`, cost: `What you pay: refresh lag, plus a pipeline to monitor and rebuild.` }
      ],
      rule: `Normalize the source of truth, and denormalize only derived copies you can rebuild from it.`,
      signals: [
        `The copied value is a snapshot that must not change later (an invoice line price) → copying is correct, not a hack.`,
        `The same join tops the slow query report → consider a derived table.`,
        `Two screens show different values for the same thing → too many copies.`
      ],
      related: [`d1`, `d6`]
    },
    {
      id: `id-generation`,
      area: `Data`,
      title: `Auto-increment vs UUIDv4 vs UUIDv7/ULID vs Snowflake`,
      question: `How should I generate primary keys?`,
      options: [
        { name: `Auto-increment (bigserial)`, pick: `For a single database where IDs stay internal: small, fast and ordered.`, avoid: `For public IDs (people can guess neighbors and estimate your volume), or when several databases or regions must create IDs independently.`, cost: `What you pay: a central sequence, painful merges across shards, and a second public identifier to hide the real one.` },
        { name: `UUIDv4 (random)`, pick: `When clients or many services must mint IDs with no coordination and ordering does not matter.`, avoid: `As the primary key of a big, write-heavy B-tree table, because random inserts scatter across the whole index.`, cost: `What you pay: 16 bytes per key, poor index locality, and more page splits and cache misses as the table grows.` },
        { name: `UUIDv7 or ULID (time-ordered)`, pick: `A good default for new distributed systems: no coordination, and roughly time-sorted, so inserts stay at the end of the index.`, avoid: `When creation time is sensitive, since anyone can read the timestamp from the ID.`, cost: `What you pay: 16 bytes per key, and ordering only as good as clock sync across machines.` },
        { name: `Snowflake-style (64-bit: time + worker + sequence)`, pick: `When you need compact, time-sortable 64-bit IDs at very high rates, such as an ID for every message or call event.`, avoid: `When you do not want to manage worker IDs. UUIDv7 gives most of the benefit with no setup.`, cost: `What you pay: a unique worker ID per process, and clock rollback handling (wait or refuse to issue IDs).` }
      ],
      rule: `Use UUIDv7 for new distributed tables, bigserial for internal single-database tables, and never expose sequential IDs publicly.`,
      signals: [
        `IDs appear in public URLs or APIs → not auto-increment.`,
        `Insert speed drops as a UUIDv4-keyed table grows → switch to time-ordered IDs.`,
        `Clients must create the ID before calling the server (offline work, safe retries) → a UUID.`
      ],
      related: [`t7`, `d6`]
    },
    {
      id: `btree-vs-lsm`,
      area: `Data`,
      title: `B-tree vs LSM-tree`,
      question: `Is this workload read-heavy or write-heavy at the storage level?`,
      options: [
        { name: `B-tree (Postgres, MySQL InnoDB)`, pick: `For read-heavy and mixed OLTP: point lookups and range scans are predictable, and rows are updated in place.`, avoid: `For sustained, very high write rates of small records, where random page writes and write amplification limit you.`, cost: `What you pay: random I/O on writes, page splits, and bloat (in Postgres, vacuum has to keep up).` },
        { name: `LSM-tree (RocksDB, Cassandra, ScyllaDB)`, pick: `For write-heavy workloads such as event ingestion and time series: writes go to a memtable and a sequential log, then flush to sorted files.`, avoid: `For read-heavy workloads with many point reads of old data, or frequent updates to the same keys.`, cost: `What you pay: background compaction that eats disk I/O and CPU, reads that may check several files (bloom filters help), and deleted data held as tombstones until compaction.` }
      ],
      rule: `B-tree for read-mostly OLTP, LSM for write-heavy ingestion, and tune compaction before blaming the database.`,
      signals: [
        `p99 latency spikes line up with compaction → tune compaction or add disk headroom.`,
        `Mass deletes do not free space, or reads slow down after them → tombstones in an LSM store.`,
        `Write throughput is the bottleneck and data is append-only → LSM.`
      ],
      related: [`d6`]
    },
    {
      id: `cache-placement`,
      area: `Caching`,
      title: `In-process vs Redis vs CDN`,
      question: `Where should the cache sit?`,
      options: [
        { name: `In-process (a map with TTL or LRU)`, pick: `For small, hot, rarely changing data such as config, feature flags, price tables and country rules: reads cost nanoseconds, with no network hop.`, avoid: `When every instance must see the same value, or the data is too big to hold in every process.`, cost: `What you pay: each instance has its own copy (stale in its own way), memory is multiplied by instance count, and every deploy starts cold.` },
        { name: `Distributed cache (Redis, Memcached)`, pick: `For data shared across instances: sessions, rate-limit counters, expensive query results, and anything where one invalidation must apply everywhere.`, avoid: `For tiny static data you could keep in memory, or when the network hop costs more than the query you are caching.`, cost: `What you pay: a network hop (usually a fraction of a millisecond inside one AZ), another system to run, and stampede risk when hot keys expire.` },
        { name: `CDN or edge`, pick: `For static assets and public, cacheable GET responses served to users around the world.`, avoid: `For personalized or per-tenant responses unless the cache key includes the user, and for anything that must change instantly.`, cost: `What you pay: slow (sometimes billed) invalidation, cache-key mistakes that can leak one user's data to another, and harder debugging.` }
      ],
      rule: `Cache as close to the reader as the data's freshness and privacy allow.`,
      signals: [
        `Read on every request, changes about daily → in-process with a short TTL.`,
        `Many instances must agree on a counter or a session → Redis.`,
        `The response is identical for every user in a region → CDN.`
      ],
      related: [`k1`, `k5`, `k6`]
    },
    {
      id: `cache-write-policies`,
      area: `Caching`,
      title: `Cache-aside vs read-through vs write-through vs write-back`,
      question: `Who fills the cache, and when do writes reach the database?`,
      options: [
        { name: `Cache-aside`, pick: `The default: the app reads the cache, on a miss reads the database and fills the cache, and on a write updates the database and then deletes the key.`, avoid: `Without protection for hot keys, where many instances miss at once and hammer the database; add request coalescing or a short lock.`, cost: `What you pay: cache logic in app code, a miss on first read, and a small race window where a stale value can be cached again (a TTL bounds it).` },
        { name: `Read-through`, pick: `When a library or cache layer can load from the database for you, so app code only talks to the cache.`, avoid: `When load logic is complex or differs per caller, because hiding it in the cache layer makes debugging harder.`, cost: `What you pay: coupling to a cache product or library, and the same stampede risk on cold keys.` },
        { name: `Write-through`, pick: `When reads right after writes must hit a warm, fresh cache, like a profile shown right after editing it.`, avoid: `For write-heavy data that is rarely read, since you pay to cache things nobody asks for.`, cost: `What you pay: slower writes (database plus cache), and you still need a TTL as a safety net when the two writes disagree after a failure.` },
        { name: `Write-back (write-behind)`, pick: `For high-rate counters or stats where losing a few seconds of updates is fine, flushed to the database in batches.`, avoid: `For money, orders, or anything you cannot lose: a cache crash loses writes you already acknowledged.`, cost: `What you pay: possible data loss, a flush pipeline to run, and a database that is always a little behind.` }
      ],
      rule: `Use cache-aside with delete-on-write and a TTL, and reach for the others only with a specific reason.`,
      signals: [
        `Database CPU spikes when a popular key expires → stampede; add jitter, coalescing or early refresh.`,
        `Users see old data right after saving → delete or update the key on write.`,
        `Frequent counter updates that can lose a little data → write-back.`
      ],
      related: [`k2`, `k3`, `k4`]
    },
    {
      id: `redis-vs-memcached`,
      area: `Caching`,
      title: `Redis vs Memcached`,
      question: `Which in-memory store should back the cache?`,
      options: [
        { name: `Redis (or its fork Valkey)`, pick: `The default: rich data types (hashes, sorted sets, streams), atomic operations and Lua scripts for rate limiters and locks, plus optional persistence and replication.`, avoid: `As the only copy of data you cannot lose, or as a broker for critical work before you understand its durability settings.`, cost: `What you pay: commands run mostly on one thread per instance, so one slow command (<code>KEYS</code>, a huge <code>DEL</code>) blocks everyone, and cluster mode limits multi-key operations to one hash slot.` },
        { name: `Memcached`, pick: `For a plain, large object cache where multi-threaded throughput per node and simplicity are what you want.`, avoid: `When you need data structures, persistence, replication or pub/sub.`, cost: `What you pay: no replication or persistence, so a restarted node loses its share, and clients handle the sharding.` }
      ],
      rule: `Pick Redis unless all you need is a plain get and set cache and you want the simplest thing.`,
      signals: [
        `You need rate limiting, leaderboards, locks or small queues → Redis.`,
        `Only get and set of blobs at very high throughput per node → Memcached is fine.`
      ],
      related: [`k5`, `k1`]
    },
    {
      id: `invalidation`,
      area: `Caching`,
      title: `TTL vs explicit invalidation vs versioned keys`,
      question: `How does stale data leave the cache?`,
      options: [
        { name: `TTL only`, pick: `When bounded staleness is fine (say 30-60 seconds for a pricing page) and you want no invalidation code at all.`, avoid: `When a change must be visible right away, like a revoked permission or a newly blocked number.`, cost: `What you pay: stale reads for up to one TTL, and expiry storms when many keys expire together, unless you add jitter.` },
        { name: `Explicit invalidation (delete on write)`, pick: `When all writes go through code you own, so each write can delete the keys it affects.`, avoid: `When many derived keys depend on one row, or data changes outside your app (manual SQL, other services).`, cost: `What you pay: you must know every key a write affects. A missed key stays stale until its TTL, so keep a TTL as a backstop.` },
        { name: `Versioned keys`, pick: `For data with many dependent keys: bump a version (like <code>user:42:v7</code>) and the old keys are simply never read again.`, avoid: `When memory is tight, since old versions linger until they expire or are evicted.`, cost: `What you pay: an extra read to fetch the current version, and memory held by dead versions.` }
      ],
      rule: `Always set a TTL, then add explicit deletes or versioning only where staleness hurts.`,
      signals: [
        `Security or billing data (API keys, block lists, balances) → explicit invalidation plus a short TTL.`,
        `Data changes outside your service → TTL, or invalidation driven by change data capture.`,
        `One change must invalidate dozens of keys → versioned keys.`
      ],
      related: [`k3`, `k4`]
    },
    {
      id: `queue-vs-log`,
      area: `Messaging`,
      title: `SQS vs Kafka vs RabbitMQ vs Redis Streams`,
      question: `Which broker should carry these messages?`,
      options: [
        { name: `Amazon SQS`, pick: `The default on AWS for job queues and decoupling: no servers, scales on its own, DLQs built in. Avoid Kafka for a few hundred messages a minute; SQS gives the same decoupling with nothing to operate.`, avoid: `When several independent consumers need the same messages, when you need replay, or when you need strict ordering at high throughput.`, cost: `What you pay: at-least-once delivery (standard queues can also reorder), visibility-timeout tuning, and lower throughput limits on FIFO queues.` },
        { name: `Kafka`, pick: `For high-volume event streams read by many consumer groups, with replay from any offset, ordering per key, and stream processing.`, avoid: `For low volume, per-message delays or priorities, or task queues where each job needs its own ack and retry.`, cost: `What you pay: a cluster to run (or MSK), partition planning, consumer lag monitoring, and ordering only within a partition.` },
        { name: `RabbitMQ`, pick: `For flexible routing (topic and header exchanges), per-message acks, priorities and request-reply, especially outside AWS.`, avoid: `When you need long retention and replay, or very high sustained throughput with many readers.`, cost: `What you pay: a cluster to operate, memory pressure when queues back up, and careful choice of queue type (quorum queues for durability).` },
        { name: `Redis Streams`, pick: `When you already run Redis and need a light stream with consumer groups at moderate volume.`, avoid: `When messages must never be lost, or the backlog could outgrow memory.`, cost: `What you pay: retention bounded by memory, durability tied to Redis persistence settings, and manual handling of stuck pending entries (<code>XPENDING</code>, <code>XCLAIM</code>).` }
      ],
      rule: `Use a queue for jobs, a log for shared event history, and the option with the least to operate that still meets the need.`,
      signals: [
        `Several teams want to consume the same events independently → Kafka, or SNS fanning out to one SQS queue per consumer.`,
        `You need to reprocess last week's events after a bug fix → Kafka retention.`,
        `Each message is a task that fails and retries on its own → SQS or RabbitMQ.`,
        `Order matters per entity (all status updates for one message) → Kafka key or an SQS FIFO message group.`
      ],
      related: [`c6`, `a9`, `a6`]
    },
    {
      id: `sync-vs-async`,
      area: `Messaging`,
      title: `Synchronous vs asynchronous communication`,
      question: `Should the caller wait for the result?`,
      options: [
        { name: `Synchronous (HTTP or gRPC call)`, pick: `When the caller needs the answer to continue, such as validating a request, checking a balance, or returning data to a user.`, avoid: `For slow or flaky downstream work (sending to a carrier, building a report) and for long call chains, where latency and failures add up.`, cost: `What you pay: if the callee is down or slow, so are you, plus timeouts, retries and circuit breakers to tune.` },
        { name: `Asynchronous (queue or event)`, pick: `When work can finish later, must survive traffic spikes, or should wait out a consumer outage, like delivering webhooks or sending messages.`, avoid: `When a user is waiting for the result on screen and there is no good "accepted, check back later" story.`, cost: `What you pay: eventual consistency, status tracking, DLQs, idempotent consumers, and harder debugging without trace propagation.` },
        { name: `Hybrid (accept synchronously, process asynchronously)`, pick: `For APIs that must respond fast but do slow work: validate and persist, return 202 with an ID, and finish in the background.`, avoid: `When clients can neither poll nor receive callbacks.`, cost: `What you pay: a job status model, a status endpoint or webhooks, and somewhere to keep results.` }
      ],
      rule: `Stay synchronous only for what the caller needs right now, and push everything else onto a queue.`,
      signals: [
        `The downstream p99 is seconds, or it fails often → async.`,
        `Traffic arrives in bursts far above the steady rate → a queue absorbs it.`,
        `A call chain is four or more services deep → break it with events or precomputed data.`
      ],
      related: [`c5`, `c6`, `a1`]
    },
    {
      id: `realtime-delivery`,
      area: `Messaging`,
      title: `Polling vs long polling vs SSE vs WebSockets vs webhooks`,
      question: `How does the other side learn that something changed?`,
      options: [
        { name: `Polling (short or long)`, pick: `Short polling for rare updates or a first version; long polling when you need faster updates but old clients or strict proxies rule out the other options.`, avoid: `When many clients need near-instant updates: most short polls return nothing, and long polling costs a new request per message.`, cost: `What you pay: wasted requests or held connections, delay of up to one interval for short polling, and timeout tuning at every proxy for long polling.` },
        { name: `Server-Sent Events (SSE)`, pick: `For one-way streams from server to browser, such as live status, logs or streamed model output, over plain HTTP with built-in reconnect.`, avoid: `When the client must also send a steady stream back, or you need binary data.`, cost: `What you pay: long-lived connections to hold and route, and on HTTP/1.1 a small per-domain connection limit in browsers.` },
        { name: `WebSockets`, pick: `For two-way, low-latency traffic: chat, agent consoles, interactive live dashboards, collaborative editing.`, avoid: `When one-way updates are enough; SSE or a hosted pub/sub service is simpler.`, cost: `What you pay: stateful connections that complicate deploys and load balancing, your own heartbeats and reconnect logic, and a shared pub/sub to fan messages out across servers.` },
        { name: `Webhooks`, pick: `For server-to-server notifications to your customers, like delivery reports or call status callbacks.`, avoid: `When the receiver cannot expose a public HTTPS endpoint or cannot handle bursts.`, cost: `What you pay: retries with backoff, HMAC signing so receivers can verify you, idempotency on their side, and a dead-letter and replay story for endpoints that stay down.` }
      ],
      rule: `Webhooks for servers, SSE for one-way browser updates, WebSockets only when the client talks back, and polling as the fallback.`,
      signals: [
        `The consumer is a customer's server → webhooks.`,
        `The browser only needs to watch progress → SSE.`,
        `Users interact in real time (chat, live agent console) → WebSockets or a hosted pub/sub.`,
        `Clients sit behind proxies that kill long connections → polling fallback.`
      ],
      related: [`a5`]
    },
    {
      id: `saga-styles`,
      area: `Messaging`,
      title: `Orchestration vs choreography`,
      question: `Who drives a multi-step business process across services?`,
      options: [
        { name: `Orchestration (a coordinator such as Temporal or a state machine)`, pick: `When the flow has many steps, branches, timeouts and compensations, and you need one place to see where each instance is stuck.`, avoid: `For simple two-step reactions, where a coordinator is more ceremony than value.`, cost: `What you pay: a coordinator or workflow engine to run, and the risk that it grows into a god service that knows too much.` },
        { name: `Choreography (services react to each other's events)`, pick: `For short flows where each service simply reacts to an event and teams want to stay decoupled.`, avoid: `When the flow spans more than a few services or needs compensations in a set order, because nobody can see the whole process.`, cost: `What you pay: flow logic scattered across services, accidental event cycles, and hard debugging without good tracing.` }
      ],
      rule: `Choreograph simple reactions, and orchestrate anything with more than about three steps or any compensation logic.`,
      signals: [
        `People keep asking "which step is this order stuck on?" → orchestrate.`,
        `Adding a step means changing several services → orchestrate.`,
        `One event with a few independent listeners (send an email, update stats) → choreography.`
      ],
      related: [`t3`, `p4`, `a1`]
    },
    {
      id: `delivery-semantics`,
      area: `Messaging`,
      title: `At-most-once vs at-least-once vs exactly-once`,
      question: `What happens when a message arrives twice, or not at all?`,
      options: [
        { name: `At-most-once`, pick: `For data where a loss is fine but a duplicate is useless or harmful: metric samples, presence pings, best-effort notifications.`, avoid: `For anything a customer pays for or expects to happen, such as a sent message, a charge or a webhook.`, cost: `What you pay: silent loss when a consumer crashes after acking but before finishing.` },
        { name: `At-least-once plus idempotency`, pick: `The default for real work: ack only after processing, retry on failure, and make the handler safe to run twice with an idempotency key or a dedup table.`, avoid: `When there is no stable key to dedupe on and the side effect cannot be made idempotent; fix that design first.`, cost: `What you pay: a dedup store or naturally idempotent writes (upserts, conditional updates), and extra care with side effects you cannot undo, like a call to a carrier.` },
        { name: `Kafka transactions (exactly-once inside Kafka)`, pick: `For consume-transform-produce pipelines where input and output are both Kafka topics, such as aggregations in Kafka Streams or Flink.`, avoid: `When the side effect leaves Kafka (a database write, an HTTP call, an SMS), because the guarantee does not cover outside systems.`, cost: `What you pay: extra latency and complexity, transactional producer IDs, and consumers set to <code>read_committed</code>.` }
      ],
      rule: `Assume at-least-once everywhere and make every consumer idempotent.`,
      signals: [
        `A duplicate would double-charge or double-send → an idempotency key checked atomically with the side effect.`,
        `The pipeline is Kafka to Kafka only → transactions are an option.`,
        `Losing a few events is harmless → at-most-once is cheaper.`
      ],
      related: [`a3`, `c10`, `t4`]
    },
    {
      id: `rest-grpc-graphql`,
      area: `APIs and architecture`,
      title: `REST vs gRPC vs GraphQL`,
      question: `Which API style fits this boundary?`,
      options: [
        { name: `REST (HTTP and JSON)`, pick: `The default for public APIs and webhooks: every language and tool understands it, curl can debug it, and GET responses are cacheable.`, avoid: `For chatty internal calls where payload size and latency matter, or when you need streaming in both directions.`, cost: `What you pay: loose contracts unless you maintain an OpenAPI spec, over-fetching or under-fetching, and versioning by convention.` },
        { name: `gRPC (Protobuf over HTTP/2)`, pick: `For service-to-service calls: typed contracts, generated Go and Python clients, streaming, and compact payloads.`, avoid: `For public APIs aimed at browsers or third parties, since browsers need gRPC-Web or a proxy and debugging needs special tools.`, cost: `What you pay: proto tooling in the build, layer 7 load balancing (long-lived HTTP/2 connections defeat layer 4 balancing), and schema rules such as never reusing a field number.` },
        { name: `GraphQL`, pick: `For a UI backend where several clients need different shapes of the same data and you want one round trip per screen.`, avoid: `For server-to-server APIs, simple CRUD, or public APIs where you cannot control the cost of each query.`, cost: `What you pay: N+1 queries unless resolvers batch (DataLoader style), query cost limits, and no simple HTTP caching by URL.` }
      ],
      rule: `REST at the edge, gRPC between internal services, and GraphQL only when frontends really need flexible shapes.`,
      signals: [
        `Third parties integrate with it → REST with an OpenAPI spec.`,
        `Two internal services call each other thousands of times a second → gRPC.`,
        `The mobile app makes six calls to render one screen → GraphQL or a BFF.`
      ],
      related: [`p2`, `c9`, `p6`]
    },
    {
      id: `monolith-vs-microservices`,
      area: `APIs and architecture`,
      title: `Monolith vs modular monolith vs microservices`,
      question: `How many deployable units should this system have?`,
      options: [
        { name: `Monolith`, pick: `For a new product or a small team: one deploy, one database, in-process calls, easy refactors and easy debugging.`, avoid: `When many teams block each other on one release train, or one part needs very different scaling or reliability.`, cost: `What you pay: a shared blast radius, slower builds and tests as it grows, and boundaries that rot without discipline.` },
        { name: `Modular monolith`, pick: `Usually the best middle ground: one deployable, but strict modules that own their tables and expose interfaces, so one can be extracted later.`, avoid: `When a module needs its own scaling, runtime or release cadence right now.`, cost: `What you pay: discipline and tooling (import rules, schemas owned per module) to stop modules reaching into each other.` },
        { name: `Microservices`, pick: `When independent teams need independent deploys, or parts differ sharply in scale, language or reliability needs (a media service next to CRUD APIs).`, avoid: `When one team owns everything, domain boundaries are unclear, or you lack CI/CD, tracing and on-call maturity.`, cost: `What you pay: network failures, distributed data and transactions, versioned contracts, and a platform to deploy and observe many services.` }
      ],
      rule: `Start with a modular monolith and split out a service only when a boundary causes recurring team or scaling pain.`,
      signals: [
        `Teams wait on each other's deploys every week → split along that team boundary.`,
        `One component needs far more resources than the rest → extract it.`,
        `Two services always change together in the same PR → they are one service; merge them.`
      ],
      related: [`c1`, `p1`, `e1`]
    },
    {
      id: `gateway-vs-mesh`,
      area: `APIs and architecture`,
      title: `API gateway vs service mesh vs shared library`,
      question: `Where should cross-cutting concerns like auth, retries and TLS live?`,
      options: [
        { name: `API gateway`, pick: `For traffic entering from outside: one front door for auth, API keys, rate limits, routing and request size limits.`, avoid: `As a home for business logic, or for service-to-service calls inside your network.`, cost: `What you pay: an extra hop, a critical component that must be highly available, and a bottleneck if every route change waits on the gateway owners.` },
        { name: `Service mesh (Istio, Linkerd)`, pick: `For many services in several languages that need mTLS, retries, timeouts and traffic shifting applied the same way without code changes.`, avoid: `With a handful of services or a single language, where the operating cost outweighs the gain.`, cost: `What you pay: a proxy per workload or node (CPU, memory, latency), a control plane to upgrade, and hard debugging when the proxy misbehaves.` },
        { name: `Shared library`, pick: `For a small fleet in one or two languages (say Go and Python): a common client with timeouts, retries, tracing and auth is cheap and easy to debug.`, avoid: `When you have many languages, or teams cannot be made to upgrade the library.`, cost: `What you pay: version drift across services, and every fix needs a redeploy of every consumer.` }
      ],
      rule: `Always put a gateway at the edge, and use a shared library inside until the number of services and languages makes a mesh pay for itself.`,
      signals: [
        `Security requires mTLS between every service → a mesh, or a platform feature that provides it.`,
        `Services run three different versions of the retry library → centralize it.`,
        `Only external clients need auth and rate limits → a gateway alone is enough.`
      ],
      related: [`p5`, `p1`]
    },
    {
      id: `pagination`,
      area: `APIs and architecture`,
      title: `Offset vs cursor (keyset) pagination`,
      question: `How do clients page through a big list?`,
      options: [
        { name: `Offset and limit`, pick: `For small tables, admin screens, and UIs that need "jump to page 7" with a total count.`, avoid: `For large or fast-changing tables, API exports and infinite scroll.`, cost: `What you pay: the database reads and discards every skipped row, so deep pages get slow, and new inserts shift results so items are skipped or repeated.` },
        { name: `Cursor (keyset)`, pick: `The default for APIs and large lists: filter past the last row seen, like <code>WHERE (created_at, id) &lt; (:ts, :id) ORDER BY created_at DESC, id DESC LIMIT 50</code>, backed by a matching index.`, avoid: `When users need random access to page N, or sorting on many arbitrary columns.`, cost: `What you pay: no page numbers or cheap total count, an index per supported sort order, and an opaque cursor to encode and version.` }
      ],
      rule: `Use keyset cursors for anything that can grow, and offsets only for small lists that humans browse.`,
      signals: [
        `Page 1000 takes seconds → switch to keyset.`,
        `Clients export every record through the API → a cursor with a stable sort that ends in a unique tiebreaker.`,
        `Users see duplicates while scrolling a live feed → offsets are shifting; use a cursor.`
      ],
      related: [`k7`]
    },
    {
      id: `compute-platform`,
      area: `Infrastructure`,
      title: `EC2 vs ECS vs Kubernetes vs Lambda`,
      question: `Where should this service run?`,
      options: [
        { name: `EC2 VMs`, pick: `For workloads that need the host: special kernel or network tuning, heavy UDP media traffic, licensed software, or steady load you can right-size.`, avoid: `For a fleet of ordinary stateless services, where you would end up hand-building deploys, health checks and scaling.`, cost: `What you pay: OS patching, image builds, config management and capacity planning are all on you.` },
        { name: `Amazon ECS`, pick: `For AWS-only teams running containers who want scheduling, rolling deploys and autoscaling without running Kubernetes.`, avoid: `When you need portability across clouds or depend on the Kubernetes ecosystem (operators, Helm charts).`, cost: `What you pay: AWS lock-in, fewer extension points, and task definitions plus IAM roles to manage.` },
        { name: `Kubernetes (EKS)`, pick: `For large fleets and many teams, or when you need operators, the wider ecosystem, or portability across clouds.`, avoid: `For a small team with a few services, where the platform becomes the product.`, cost: `What you pay: cluster upgrades, networking, RBAC, ingress and add-ons to maintain, usually by a platform team.` },
        { name: `AWS Lambda`, pick: `For spiky, event-driven glue: S3 triggers, small webhook handlers, scheduled jobs, and APIs that sit idle most of the day.`, avoid: `For steady high traffic (it costs more than containers), jobs longer than the 15-minute limit, or latency-sensitive paths hurt by cold starts.`, cost: `What you pay: cold starts, per-invocation pricing, concurrency limits that can throttle you, and connection storms against RDS unless you add RDS Proxy.` }
      ],
      rule: `Pick the least platform that runs the workload: Lambda for glue, ECS for services on AWS, and Kubernetes only when you have the scale and the people for it.`,
      signals: [
        `Traffic is near zero most of the day with short bursts → Lambda.`,
        `There is no platform team → ECS over Kubernetes.`,
        `The workload needs UDP, host networking or kernel tuning (media servers) → EC2, or ECS on EC2.`
      ],
      related: [`e3`, `h6`]
    },
    {
      id: `scaling`,
      area: `Infrastructure`,
      title: `Vertical vs horizontal scaling`,
      question: `Do I get a bigger machine or more machines?`,
      options: [
        { name: `Vertical (scale up)`, pick: `The first move for databases and other stateful systems: a bigger instance is one change, with no code changes and no new failure modes.`, avoid: `When you are near the largest instance size, or when one machine is itself the availability risk.`, cost: `What you pay: a hard ceiling, a single large failure domain, and usually a restart or failover to resize.` },
        { name: `Horizontal (scale out)`, pick: `For stateless services behind a load balancer, and for data systems built for it (partitioned or sharded stores).`, avoid: `For a relational primary before you have used replicas, caching and bigger hardware, because sharding is hard to undo.`, cost: `What you pay: the app must be stateless (sessions in Redis, not in memory), plus load balancing, and for data, partitioning and rebalancing.` }
      ],
      rule: `Scale stateless tiers out and stateful tiers up until up runs out.`,
      signals: [
        `The service keeps state in memory → make it stateless before scaling out.`,
        `Database CPU is high but the working set would fit in RAM on a bigger box → scale up.`,
        `You must survive one node dying → you need at least two, whatever the load.`
      ],
      related: [`c4`, `c3`]
    },
    {
      id: `multi-region`,
      area: `Infrastructure`,
      title: `Multi-AZ vs active-passive vs active-active`,
      question: `How much of a regional outage must we survive?`,
      options: [
        { name: `Single region, multi-AZ`, pick: `The default for most products: it survives the loss of one AZ with synchronous database replication (RDS Multi-AZ or Aurora) and load balancers spread across AZs.`, avoid: `When contracts, regulators or the business require surviving a full region outage, or users are far away and need low latency.`, cost: `What you pay: a region outage takes you down, though those are rare compared with your own bad deploys.` },
        { name: `Active-passive (warm standby or pilot light)`, pick: `When you must recover from a region loss within minutes to hours, with a standby region receiving asynchronously replicated data.`, avoid: `When nobody will run failover drills. An untested standby usually fails when you need it.`, cost: `What you pay: idle capacity, data loss up to the replication lag (your RPO), and DNS or traffic switching that must be rehearsed.` },
        { name: `Active-active`, pick: `When users are global and need low latency, or downtime is not acceptable, and your data partitions by region or merges cleanly on conflict.`, avoid: `When data needs global strong consistency (balances, unique usernames) and you have not designed for conflicts.`, cost: `What you pay: conflict handling, global ID generation, about double the infrastructure, and far harder testing and on-call.` }
      ],
      rule: `Start multi-AZ, add active-passive when the business sets a recovery time you cannot otherwise meet, and go active-active only for data that partitions cleanly by region.`,
      signals: [
        `Data residency laws require data to stay in a country → region-pinned tenants, not global replication.`,
        `The required RTO is minutes and RPO near zero → active-active or synchronous replication, and a big budget.`,
        `Most outages come from deploys, not AZ failures → invest in rollbacks first.`
      ],
      related: [`r5`, `r6`, `e7`]
    },
    {
      id: `build-vs-buy`,
      area: `Infrastructure`,
      title: `Build vs buy`,
      question: `Should we write this ourselves or pay for it?`,
      options: [
        { name: `Buy (SaaS or managed service)`, pick: `For anything that is not your differentiator: auth, email delivery, observability, CI, payments, hosted search.`, avoid: `When the bill grows with your core volume and becomes a large share of revenue, or the vendor cannot meet your compliance or data residency needs.`, cost: `What you pay: fees that grow with usage, lock-in, and limits on customization and access to your own data.` },
        { name: `Build`, pick: `For your core business logic, and where control, cost at scale or unusual requirements give you an edge.`, avoid: `When an off-the-shelf product covers most of the need and the gap is not strategic.`, cost: `What you pay: building is the small part. Maintenance, on-call, security patches and documentation last for years.` },
        { name: `Self-host open source`, pick: `When you need control and low license cost and have people to run it (Prometheus, OpenSearch, Kafka).`, avoid: `When nobody on the team wants to own its upgrades and incidents.`, cost: `What you pay: engineer time for upgrades, scaling and incidents, which is easy to underestimate.` }
      ],
      rule: `Buy the commodity, build the differentiator, and compare three-year total cost including engineer time.`,
      signals: [
        `The vendor bill grows faster than revenue → consider self-hosting that piece.`,
        `It takes a whole team to maintain the in-house version → buy.`,
        `Compliance needs the data kept in your account or region → self-host, or a vendor with in-region hosting.`
      ],
      related: [`e4`, `e2`, `h11`]
    },
    {
      id: `signals`,
      area: `Observability`,
      title: `Metrics vs logs vs traces vs profiles`,
      question: `Which telemetry answers this question?`,
      options: [
        { name: `Metrics`, pick: `For alerts, dashboards and trends: request rate, errors, latency percentiles, queue depth. They are cheap to store and fast to query.`, avoid: `For per-request detail, or with high-cardinality labels like user ID, message ID or phone number.`, cost: `What you pay: aggregation hides individual cases, and label cardinality drives cost.` },
        { name: `Logs`, pick: `For the story of one event: what happened to this message and why it failed, as structured fields.`, avoid: `As the source for alerts or for computing rates at high volume; metrics do that at a fraction of the cost.`, cost: `What you pay: storage and indexing that grow with traffic (so sampling and short retention), plus the risk of logging secrets or personal data.` },
        { name: `Traces`, pick: `For latency and failures that cross services: which hop is slow and what calls what.`, avoid: `For a single service with no fan-out, where logs with a request ID are enough.`, cost: `What you pay: context propagation through every hop, queues included, plus sampling decisions and storage.` },
        { name: `Continuous profiles`, pick: `For CPU or memory problems inside one process: which function burns CPU and where allocations come from (pprof in Go, py-spy in Python).`, avoid: `For latency caused by slow dependencies; time spent waiting on the network shows up better in traces.`, cost: `What you pay: a small runtime overhead, and one more backend to run or buy.` }
      ],
      rule: `Alert on metrics, find the slow hop with traces, read the details in logs, and use profiles when one process is the bottleneck.`,
      signals: [
        `You need "how many" or "how fast" → metrics.`,
        `You need "what happened to this one request" → logs, joined by a trace or request ID.`,
        `Latency is high but no single service looks slow → traces.`,
        `CPU is high and nobody knows why → profiles.`
      ],
      related: [`o1`, `o2`, `o3`]
    },
    {
      id: `metrics-collection`,
      area: `Observability`,
      title: `Prometheus pull vs Pushgateway vs OTLP push`,
      question: `How do metrics get from the app to the backend?`,
      options: [
        { name: `Prometheus pull (scraping /metrics)`, pick: `The default for long-running services: Prometheus discovers targets and scrapes them, and you get an <code>up</code> health metric for free.`, avoid: `For short jobs that exit before the next scrape, or targets Prometheus cannot reach through NAT or firewalls.`, cost: `What you pay: service discovery config, and one Prometheus has finite capacity, so big fleets need sharding or remote write.` },
        { name: `Pushgateway`, pick: `Only for batch and cron jobs that exit before a scrape: the job pushes its final metrics and Prometheus scrapes the gateway.`, avoid: `For services or per-instance metrics: it never forgets old series, it is a single point of failure, and you lose per-instance health.`, cost: `What you pay: stale series that linger until someone deletes them, and a gateway that fails quietly if nobody watches it.` },
        { name: `OTLP push (OpenTelemetry SDK to a Collector)`, pick: `When you want one pipeline for metrics, traces and logs, your targets are short-lived (Lambda, short tasks), or you send to a vendor.`, avoid: `When your stack is all Prometheus and scraping works; a Collector is one more hop to run.`, cost: `What you pay: a Collector tier to scale and monitor, and no automatic <code>up</code> signal, so you need alerts on missing data instead.` }
      ],
      rule: `Scrape long-running services, push from short jobs, and never use Pushgateway as a general push endpoint.`,
      signals: [
        `The process lives for less than one scrape interval → push.`,
        `You already use OpenTelemetry for traces → OTLP metrics can share the pipeline.`,
        `Pushgateway holds thousands of series from dead jobs → it is being misused.`
      ],
      related: [`o3`]
    },
    {
      id: `observability-hosting`,
      area: `Observability`,
      title: `Self-hosted stack vs SaaS`,
      question: `Should we run our own observability or pay a vendor like Datadog?`,
      options: [
        { name: `Self-hosted (Prometheus, Grafana, OpenSearch, Loki)`, pick: `When telemetry volume is large, cost matters, or data must stay in your account, and you have engineers to run it.`, avoid: `For a small team with nobody to own upgrades, retention, scaling and on-call for the monitoring itself.`, cost: `What you pay: infrastructure plus engineer time, and the risk that monitoring breaks during the same incident you need it for.` },
        { name: `SaaS (Datadog, New Relic, Grafana Cloud)`, pick: `When you want fast setup, metrics, logs and traces linked in one UI, and no on-call for the monitoring system.`, avoid: `When high-cardinality metrics or large log volumes make the bill grow faster than the business.`, cost: `What you pay: per-host, per-GB and per-custom-metric pricing that often surprises teams, plus lock-in to agents and query languages.` },
        { name: `Hybrid`, pick: `Common in practice: self-host high-volume, low-value data (debug logs, raw metrics) and send curated signals to a vendor.`, avoid: `When the team cannot keep two systems straight and engineers search in the wrong place during incidents.`, cost: `What you pay: two tools to learn, and routing rules to maintain.` }
      ],
      rule: `Buy while you are small, and self-host the highest-volume signal first once the bill pays for an engineer's time.`,
      signals: [
        `Observability is a large and growing share of the infra bill → move logs first.`,
        `Nobody owns the self-hosted stack and it keeps falling over → buy.`,
        `Data residency or privacy rules → self-host, or a vendor with in-region storage.`
      ],
      related: [`e4`, `e3`]
    },
    {
      id: `trace-sampling`,
      area: `Observability`,
      title: `Head vs tail sampling`,
      question: `Which traces do we keep?`,
      options: [
        { name: `Head sampling`, pick: `The simple default: decide at the start of a trace (keep, for example, 1-10%) and pass the decision along, so it is cheap and every service agrees.`, avoid: `When the traces you care about (errors, slow requests) are rare, because random sampling mostly drops them.`, cost: `What you pay: missing the interesting traces, since the decision is made before the outcome is known.` },
        { name: `Tail sampling`, pick: `When you want every error and slow trace plus a small share of normal ones, deciding after the trace completes.`, avoid: `When you cannot afford a Collector tier that buffers whole traces in memory.`, cost: `What you pay: Collectors that hold spans for a wait window, routing every span of a trace to the same Collector (trace-ID-aware load balancing), and a tier that scales with full traffic.` }
      ],
      rule: `Start with head sampling and add tail sampling in the Collector when you keep missing the traces that matter.`,
      signals: [
        `The error trace is never there when you look → tail sampling.`,
        `Trace storage costs too much → lower the head sampling rate.`,
        `A low-traffic service → keep 100%.`
      ],
      related: [`o2`, `o5`]
    },
    {
      id: `retry-vs-fail-fast`,
      area: `Reliability`,
      title: `Retry vs fail fast`,
      question: `When a call fails, should I try again?`,
      options: [
        { name: `Retry with backoff and jitter`, pick: `For transient failures of idempotent operations: timeouts, 503s, connection resets, and 429s (honor <code>Retry-After</code>).`, avoid: `For non-idempotent calls without an idempotency key, for other 4xx errors (they will not fix themselves), and when the downstream is overloaded.`, cost: `What you pay: added latency, and retry amplification: 3 retries at each of 3 layers can turn one request into 64 attempts.` },
        { name: `Fail fast`, pick: `When the caller's deadline cannot be met anyway, a circuit breaker is open, or the failure is permanent (validation, auth).`, avoid: `For background work, where retrying later is cheap and nobody is waiting.`, cost: `What you pay: more visible errors, so pair it with a clear error message and a fallback.` },
        { name: `Retry later through a queue`, pick: `For background work: put the job back with a delay, cap the attempts, then move it to a DLQ.`, avoid: `For user-facing requests that must answer now.`, cost: `What you pay: delay, plus DLQ monitoring and replay tooling.` }
      ],
      rule: `Retry only transient failures of idempotent calls, at one layer, with backoff, jitter and a budget; otherwise fail fast.`,
      signals: [
        `The downstream is struggling (latency and errors climbing) → stop retrying and let a circuit breaker open.`,
        `Retries create duplicates → add idempotency keys before adding retries.`,
        `Every layer of the call chain retries → keep retries in one layer only.`
      ],
      related: [`r3`, `r4`, `c8`]
    },
    {
      id: `fail-open-vs-closed`,
      area: `Reliability`,
      title: `Fail open vs fail closed`,
      question: `When a check like auth, a rate limiter or a fraud score is unavailable, do we allow or deny?`,
      options: [
        { name: `Fail open (allow)`, pick: `For protective but non-critical checks where blocking good users costs more than letting some bad traffic through, such as a rate-limiter backend or a recommendation service being down.`, avoid: `For authentication, authorization, payments, fraud and spam controls. Attackers love a failure that switches off your defenses.`, cost: `What you pay: abuse or overspend during the outage, so log and alert every time you fail open.` },
        { name: `Fail closed (deny)`, pick: `For security and money paths: if you cannot verify the API key, the balance or the fraud score, reject the request.`, avoid: `For checks unrelated to safety, where denying turns a small dependency outage into a full outage.`, cost: `What you pay: lower availability, since your uptime now depends on that check's uptime.` },
        { name: `Degrade to a safe default`, pick: `When there is a middle ground: use cached permissions, apply a strict local limit, or queue the request for later review.`, avoid: `When the cached or default value can be badly wrong, like a stale balance used to approve a big spend.`, cost: `What you pay: designing and testing a mode that rarely runs, and so tends to rot.` }
      ],
      rule: `Fail closed on security and money, fail open on convenience, and prefer a safe degraded mode when one exists.`,
      signals: [
        `The check guards money or access → closed.`,
        `The check exists to protect you from overload → open, with a local fallback limit.`,
        `The outage of one check would stop all sending → consider a cached or local decision.`
      ],
      related: [`r2`, `k8`]
    },
    {
      id: `rate-limit-algorithms`,
      area: `Reliability`,
      title: `Token bucket vs fixed window vs sliding window`,
      question: `How should a rate limiter count requests?`,
      options: [
        { name: `Token bucket (or leaky bucket)`, pick: `The default for APIs: it allows short bursts up to the bucket size while holding an average rate, and it is easy to explain as "N per second, bursts of M".`, avoid: `When the downstream accepts no bursts at all (a carrier with a strict per-second cap); smooth the output with a leaky bucket or a queue instead.`, cost: `What you pay: two numbers to tune per limit, and atomic updates (a Lua script in Redis) when many instances share one limit.` },
        { name: `Fixed window counter`, pick: `For simple quotas like N per day or N per minute where the edges do not matter: one <code>INCR</code> plus <code>EXPIRE</code> in Redis.`, avoid: `For tight per-second limits, because a client can send up to double the limit across a window boundary.`, cost: `What you pay: bursts at window edges.` },
        { name: `Sliding window (log or counter)`, pick: `When fairness at boundaries matters: the counter version blends the current and previous windows, and the log version stores each request time.`, avoid: `The log version at high volume, since storing every timestamp per client costs memory.`, cost: `What you pay: more memory or an approximation, and more code than a fixed window.` }
      ],
      rule: `Token bucket for API limits, fixed windows for daily quotas, and a queue when the downstream needs a smooth, strict rate.`,
      signals: [
        `The downstream has a hard per-second limit → shape traffic with a queue or leaky bucket instead of only rejecting.`,
        `Clients burst at the start of each minute → a fixed-window edge problem; use a token bucket or sliding window.`,
        `The limit is per tenant across many instances → a shared counter in Redis, or local limits that split the budget.`
      ],
      related: [`k8`, `p3`, `c8`]
    },
    {
      id: `sessions-vs-jwt`,
      area: `Security`,
      title: `Server sessions vs JWTs`,
      question: `How does the server remember who a user is?`,
      options: [
        { name: `Server-side sessions (opaque ID in a cookie, state in Redis or a database)`, pick: `The default for web apps: instant logout and revocation, a small cookie, and session data that stays on the server.`, avoid: `When many independent services or third parties must verify identity without calling a central store.`, cost: `What you pay: a session lookup on every request (usually cached), and a session store that must stay highly available.` },
        { name: `JWT (signed, self-contained token)`, pick: `For service-to-service auth, short-lived OAuth access tokens, and identity checks at many services without a shared database.`, avoid: `As a long-lived browser session you may need to revoke, because a valid token works until it expires unless you keep a denylist.`, cost: `What you pay: short expiry plus refresh tokens or a denylist, signing key rotation (JWKS), bigger headers, and classic bugs like accepting <code>alg: none</code> or skipping audience and expiry checks.` },
        { name: `Hybrid (short-lived JWT plus a server-side refresh token)`, pick: `When you want stateless checks on the hot path but still need logout: access tokens of 5-15 minutes and refresh tokens you can revoke on the server.`, avoid: `For simple apps where a session cookie does the job.`, cost: `What you pay: refresh-flow complexity, and a window of up to one token lifetime where a revoked user still gets in.` }
      ],
      rule: `Use server sessions for browser logins and short-lived JWTs between services.`,
      signals: [
        `You must be able to kill a session now (stolen laptop, fired employee) → server sessions or a denylist.`,
        `Many services verify the same identity → JWTs from one issuer, verified with its public keys.`,
        `Tokens keep growing because permissions are packed inside → keep claims small and look the rest up.`
      ],
      related: []
    },
    {
      id: `apikeys-vs-oauth`,
      area: `Security`,
      title: `API keys vs OAuth`,
      question: `How should third parties authenticate to our API?`,
      options: [
        { name: `API keys (or a key ID and secret pair)`, pick: `For customers calling their own account from their own servers: simple for developers, and it works with curl and every SDK.`, avoid: `When a third-party app acts on behalf of someone else's account, or in browser and mobile clients where the key would be exposed.`, cost: `What you pay: long-lived secrets that leak into repos and logs, so you need hashing at rest, recognizable prefixes for secret scanning, scopes, rotation and several active keys per account.` },
        { name: `OAuth 2.0 (authorization code, client credentials)`, pick: `When third-party apps need delegated, scoped, revocable access to a customer's account, such as marketplace or CRM integrations.`, avoid: `For one customer's own backend scripts, where the flow adds weight and no value.`, cost: `What you pay: an authorization server, consent screens, token and refresh lifecycles, and harder onboarding for developers.` },
        { name: `Signed requests (HMAC) or mTLS`, pick: `For high-trust integrations where you need proof the body was not altered or a strong machine identity, and for signing the webhooks you send.`, avoid: `For casual developer onboarding, since signing code and certificates add friction.`, cost: `What you pay: timestamps and replay windows (and clock skew) for HMAC, and certificate issuance and rotation for mTLS.` }
      ],
      rule: `API keys for customers calling their own account, OAuth when a third party acts for them, and HMAC signatures on the webhooks you send.`,
      signals: [
        `A partner builds an integration that many of your customers install → OAuth.`,
        `Keys keep leaking in public repos → prefixed keys for secret scanning, plus scoped, rotatable keys.`,
        `Customers need to verify that webhooks really came from you → HMAC signature over the body and a timestamp.`
      ],
      related: []
    }
  ],

  tools: {
    "Prometheus": {
      avoid: `For high-cardinality labels (user ID, message ID, phone number), for events or logs, or as long-term storage on its own.`,
      tradeoff: `Simple, reliable pull-based metrics with a strong query language (PromQL). One server has finite capacity and local retention, so scale and long history mean adding Thanos, Mimir or VictoriaMetrics.`
    },
    "Pushgateway": {
      avoid: `For long-running services or anything per instance. Use it only for batch jobs that exit before a scrape.`,
      tradeoff: `Lets short jobs report metrics, but it never expires series, its <code>up</code> metric describes the gateway rather than your job, and it is a single point of failure.`
    },
    "Alertmanager": {
      avoid: `As a place for alert logic. Keep conditions in Prometheus rules and use Alertmanager only for grouping, silencing and routing.`,
      tradeoff: `Deduplicates, groups, silences and routes alerts to Slack or a pager, but routing trees get confusing fast, and one bad inhibition rule can silence real pages.`
    },
    "Thanos, Mimir, VictoriaMetrics": {
      avoid: `When one Prometheus with a few weeks of retention covers your needs. These add many moving parts.`,
      tradeoff: `Thanos and Mimir add long retention, a global query view and high availability on object storage; VictoriaMetrics does similar work with fewer components on its own disk storage. All of them mean more to run than a single Prometheus.`
    },
    "Grafana": {
      avoid: `As a substitute for deciding what matters. Dozens of unowned dashboards help nobody during an incident.`,
      tradeoff: `One UI over many data sources (Prometheus, Loki, OpenSearch, ClickHouse), but it stores no telemetry itself, and dashboards drift unless you keep them as code.`
    },
    "OpenSearch and Elasticsearch": {
      avoid: `As a primary database, for exact financial numbers, or for plain metrics that Prometheus stores far more cheaply.`,
      tradeoff: `Excellent full-text search and flexible log queries, but memory and disk hungry, sensitive to shard counts and mapping explosions, and new documents are searchable only after a refresh.`
    },
    "OpenSearch Dashboards and Kibana": {
      avoid: `As your main alerting system, or for broad queries over months of logs at peak traffic.`,
      tradeoff: `Great for ad hoc log exploration, but wide time ranges and big aggregations load the same cluster that is busy ingesting logs.`
    },
    "Loki": {
      avoid: `When you need fast full-text search across long time ranges, or when you would have to turn high-cardinality fields into labels.`,
      tradeoff: `Much cheaper than a full-text index because it indexes only labels and keeps log chunks in object storage, but queries scan like grep, so broad searches are slow.`
    },
    "Filebeat, Fluent Bit, Vector": {
      avoid: `Heavy parsing and enrichment on every node when CPU is tight. Do it in a central processing tier instead.`,
      tradeoff: `Ship logs with buffering and retries: Fluent Bit is the lightest, Vector has strong transforms, and Filebeat fits the Elastic stack. Size the buffers so a slow backend neither drops logs nor fills the disk.`
    },
    "OpenTelemetry": {
      avoid: `Instrumenting everything before you have a backend and a question to answer. Start with HTTP, database and queue spans.`,
      tradeoff: `Vendor-neutral APIs, SDKs and a Collector for traces, metrics and logs, so you can switch backends, but maturity differs by language and the Collector is one more service to run.`
    },
    "Jaeger and Tempo": {
      avoid: `Before context propagates across your services and queues. Broken, partial traces mislead more than they help.`,
      tradeoff: `Jaeger is the classic open-source tracing backend and needs a store such as Elasticsearch, OpenSearch or Cassandra; Tempo keeps traces cheaply in object storage and is queried through Grafana with TraceQL. Both need sampling to keep costs sane.`
    },
    "Sentry": {
      avoid: `As a log store, or for expected errors (validation failures, 404s) that burn quota and bury real bugs.`,
      tradeoff: `Surfaces new exceptions fast with stack traces, grouping and release tracking, but grouping needs tuning, and self-hosted Sentry is a heavy stack of many services.`
    },
    "ClickHouse": {
      avoid: `For OLTP: frequent single-row updates or deletes, transactions, or streams of tiny inserts.`,
      tradeoff: `Very fast aggregations over billions of rows with strong compression, but data should arrive in batches, updates and deletes are heavy background operations, and joins need care.`
    },
    "Altinity": {
      avoid: `When a single ClickHouse node or a fully managed service already covers you, since operator-based clusters need Kubernetes skills.`,
      tradeoff: `The company behind the open-source ClickHouse operator for Kubernetes, long-term-support builds, a managed cloud and support contracts. That helps teams self-hosting at scale, at the price of a contract or of running the operator yourselves.`
    },
    "ClickHouse Keeper": {
      avoid: `On a single ClickHouse node without replication, where you do not need it, or squeezed onto busy data nodes in a large cluster.`,
      tradeoff: `A Raft-based, ZooKeeper-compatible coordinator for ClickHouse replication and distributed DDL, lighter than ZooKeeper, but it needs an odd number of nodes (3 is typical), and losing quorum turns replicated tables read-only.`
    },
    "PostgreSQL and Aurora": {
      avoid: `For huge analytical scans on the primary, full-text search at scale, or write rates beyond one primary without a sharding plan.`,
      tradeoff: `The best default database: transactions, rich SQL, JSONB and extensions. Aurora adds fast failover, storage replicated across AZs and many read replicas, but costs more, and per-request I/O charges can surprise I/O-heavy workloads (the I/O-Optimized option trades them for a higher base price).`
    },
    "PgBouncer": {
      avoid: `Transaction pooling mode when the app relies on session state such as <code>SET</code>, advisory locks, <code>LISTEN/NOTIFY</code> or temp tables.`,
      tradeoff: `Lets thousands of client connections share a small pool of real Postgres connections, which matters because each Postgres connection is a process, but it is one more hop and it limits session features.`
    },
    "Redis": {
      avoid: `As the only copy of data you cannot lose, or with unbounded keys and no TTLs or eviction policy.`,
      tradeoff: `Very fast shared state for caches, rate limits, locks and small queues, but memory is expensive, one slow command blocks the instance, and failover can lose recent writes.`
    },
    "DynamoDB": {
      avoid: `When access patterns are unknown, for ad hoc queries and reporting, or for items that keep growing (there is a 400 KB item limit).`,
      tradeoff: `Serverless, predictable single-digit-millisecond lookups by key at any scale, but tables are designed around queries up front, and hot keys, scans and extra indexes get expensive.`
    },
    "Cassandra and ScyllaDB": {
      avoid: `For small data sets, joins or ad hoc queries, or workloads with lots of deletes.`,
      tradeoff: `Write throughput that scales with nodes and multi-datacenter availability with no single leader, but you model one table per query, tune consistency levels, and manage tombstones, repairs and compaction.`
    },
    "Kafka": {
      avoid: `For a few hundred messages a minute, for per-message delays, priorities or routing, or when nobody can operate it.`,
      tradeoff: `Durable, replayable streams, ordered per partition, shared by many consumer groups at huge throughput, but you run brokers (or pay for MSK), plan partitions and watch consumer lag.`
    },
    "Amazon SQS": {
      avoid: `When several consumers need the same messages (use SNS fan-out or Kafka), when you need replay, or when you need strict global ordering.`,
      tradeoff: `Nothing to operate, scales automatically, with DLQs and delays built in, but delivery is at-least-once, the visibility timeout must exceed processing time, and FIFO queues trade throughput for ordering.`
    },
    "Amazon SNS": {
      avoid: `As a durable queue. SNS pushes to subscribers and standard topics keep no history, so subscribe SQS queues when consumers need buffering or can be down.`,
      tradeoff: `Simple fan-out to SQS, Lambda, HTTP endpoints, email and SMS with filter policies, but only FIFO topics can archive and replay, and a subscriber that stays down depends on retry policies and a DLQ.`
    },
    "RabbitMQ": {
      avoid: `For event history and replay, or very high throughput streams read by many independent consumers.`,
      tradeoff: `Flexible routing, per-message acks, priorities and TTLs, but queues that back up eat memory, and running a cluster well (quorum queues, upgrades) takes skill.`
    },
    "Celery": {
      avoid: `For long multi-step workflows that must survive restarts and keep state. Use Temporal or an explicit state machine.`,
      tradeoff: `Easy background jobs in Python on Redis, RabbitMQ or SQS, but the defaults surprise people: tasks are acked before they run unless <code>acks_late</code> is set, and on Redis or SQS, delayed or late-acked tasks that outlive the visibility timeout can run twice.`
    },
    "Temporal": {
      avoid: `For simple fire-and-forget jobs, where a queue and a worker are far less to learn and run.`,
      tradeoff: `Durable workflows with retries, timers and compensations written as normal Go or Python code, but workflow code must be deterministic, long histories need continue-as-new, and the cluster (or Temporal Cloud) becomes a critical dependency.`
    },
    "Consul": {
      avoid: `When your orchestrator's built-in service discovery and config (Kubernetes, ECS Service Connect) are enough.`,
      tradeoff: `Service discovery with health checks, a KV store and an optional mesh in one tool, but the server cluster is critical infrastructure (3 or 5 servers on Raft), and the KV store is for small config, not data.`
    },
    "consul-template": {
      avoid: `When the app can read config and secrets at runtime through a client library, or when re-rendering would restart services too often.`,
      tradeoff: `Renders files from Consul KV, service data and Vault secrets and runs a command on change, so apps need no Consul client, but changes land only when the app reloads or restarts, and a missing key can block startup.`
    },
    "etcd": {
      avoid: `As a general database, or for large values and high write volume. It is built for small, critical coordination data.`,
      tradeoff: `Strongly consistent Raft key-value store with watches and leases, good for leader election and config, but every write needs a quorum, disk fsync latency matters a lot, and the data set must stay small.`
    },
    "ZooKeeper": {
      avoid: `For new systems: Kafka 4.0 dropped it in favor of KRaft, and ClickHouse Keeper replaces it for ClickHouse.`,
      tradeoff: `Battle-tested coordination (locks, leader election, config) with strong ordering guarantees, but it is a JVM ensemble to tune and run, and its client recipes are easy to get wrong.`
    },
    "Secrets managers": {
      avoid: `Fetching the secret on every request (cache it with a TTL), and keeping secrets in git, container images or plain env files.`,
      tradeoff: `AWS Secrets Manager, SSM Parameter Store and Vault give access control, audit logs and rotation, but add a runtime dependency and per-call cost, and rotation only helps if apps pick up new values.`
    },
    "Docker": {
      avoid: `Treating a container as a security boundary as strong as a VM, running as root, or shipping images with build tools inside.`,
      tradeoff: `The same artifact runs on a laptop and in production and starts fast, but containers share the host kernel, and image size and base-image patching need ongoing care.`
    },
    "Amazon ECS": {
      avoid: `When you need portability across clouds or rely on Kubernetes operators and Helm charts.`,
      tradeoff: `Much simpler than Kubernetes and tightly integrated with AWS (IAM role per task, ALB, CloudWatch), on EC2 or Fargate, but it ties you to AWS and has a smaller ecosystem.`
    },
    "Kubernetes": {
      avoid: `For a small team with a handful of services. You will spend more time on the cluster than on the product.`,
      tradeoff: `A standard, portable platform with self-healing and a huge ecosystem, but upgrades, networking, RBAC and add-ons are ongoing work that usually needs a platform team.`
    },
    "Helm": {
      avoid: `For simple manifests that plain YAML or Kustomize overlays can handle. Templated YAML gets hard to read.`,
      tradeoff: `Packages Kubernetes apps with per-environment values and easy installs of third-party charts, but Go-templated YAML is error-prone, and big values files hide what actually gets deployed.`
    },
    "Terraform and OpenTofu": {
      avoid: `For app deploys or settings that change many times a day. Keep it for infrastructure that changes slowly.`,
      tradeoff: `Declarative, reviewable infrastructure with a plan before every apply, but state needs locking and care, manual console changes cause drift, and one giant state makes plans slow and risky. OpenTofu is the open-source fork made after Terraform's license change.`
    },
    "Jenkins": {
      avoid: `For a new project when a hosted CI such as GitHub Actions or GitLab CI covers your needs.`,
      tradeoff: `Very flexible and self-hosted, with a plugin for everything, but plugins break on upgrades, Groovy pipelines get hard to maintain, and the controller is a pet server you must secure and back up.`
    },
    "LocalStack": {
      avoid: `As proof that code works on AWS. IAM, limits and edge cases differ, so still test against a real account.`,
      tradeoff: `Local versions of AWS APIs (S3, SQS, SNS, DynamoDB and more) for fast dev and CI loops, but fidelity is imperfect and some services and features sit behind a paid tier.`
    },
    "AWS ALB and NLB": {
      avoid: `An ALB for non-HTTP traffic such as UDP or raw TCP; an NLB when you need host or path routing, redirects or built-in login.`,
      tradeoff: `The ALB works at layer 7 (HTTP routing, WebSockets, gRPC, OIDC auth); the NLB works at layer 4 (TCP, UDP, TLS) with static IPs per AZ, client IP preservation and very high throughput. Choose by protocol first.`
    },
    "Nginx, HAProxy, Envoy": {
      avoid: `Running your own proxy when a managed load balancer already covers the need.`,
      tradeoff: `Nginx is a solid web server and reverse proxy, HAProxy a fast load balancer with excellent stats, and Envoy a proxy configured through APIs (xDS) that powers most meshes. More power means more config to own and test.`
    },
    "CDN": {
      avoid: `For personalized or sensitive responses without very careful cache keys, or for content that must update instantly.`,
      tradeoff: `Cuts latency and origin load for static and public content and absorbs spikes, but invalidation is slow, cache-key bugs can leak data between users, and data transfer is billed per GB.`
    },
    "PubNub": {
      avoid: `For server-to-server pipelines, high-volume internal events, or work that needs durable, acknowledged, replayable delivery. Use a queue or a log there.`,
      tradeoff: `Hosted realtime pub/sub to browsers and phones with presence, access control and a global edge, so you run no WebSocket fleet, but cost grows with usage, channel names and message sizes have limits, and you are locked in to the vendor.`
    },
    "Toxiproxy": {
      avoid: `For UDP traffic, since it proxies TCP only, or as a replacement for testing in a real environment.`,
      tradeoff: `Scriptable network faults (latency, timeouts, resets, bandwidth limits) between a service and its dependencies in tests, but traffic must be routed through it, and it only simulates the faults you think to inject.`
    },
    "vegeta, hey, k6": {
      avoid: `Closed-loop load (a fixed number of workers each waiting for a response) when you want to see behavior under overload. The tool slows down with the server and hides queueing, a problem known as coordinated omission.`,
      tradeoff: `vegeta sends a constant request rate from the command line, hey is a quick closed-loop smoke test, and k6 scripts realistic scenarios in JavaScript with thresholds and arrival-rate executors. Watch the load generator too, because one laptop often hits its own limits first.`
    },
    "Chaos tools": {
      avoid: `Before you have dashboards, alerts, a steady-state baseline and a quick way to stop the experiment. Without them you only cause an outage.`,
      tradeoff: `AWS Fault Injection Service, Chaos Mesh, Litmus and Gremlin find weak retries, timeouts and failovers before real incidents do, but experiments need a small blast radius, owner buy-in and time to fix what they find.`
    }
  },

  patterns: {
    "Factory Method": {
      use: `When the caller should get an object without knowing its concrete type, like picking a carrier client from config. In Go this is usually a plain <code>NewX</code> function that returns an interface.`,
      avoid: `When there is only one implementation. A constructor is enough, and the factory is one more layer to read.`
    },
    "Abstract Factory": {
      use: `When you create families of related objects that must match, such as all the clients for one cloud provider (storage, queue, secrets) or a full set of test fakes.`,
      avoid: `When only one object varies. A single factory function or plain dependency injection is simpler.`
    },
    "Builder": {
      use: `When an object has many optional fields and needs validation, like an outgoing message request or a complex query. In Go, functional options such as <code>WithTimeout(5 * time.Second)</code> fill this role.`,
      avoid: `For objects with a few fields, where a struct literal or Python keyword arguments are clearer.`
    },
    "Singleton": {
      use: `For truly process-wide resources such as a DB pool, a logger or a metrics registry, created once at startup (<code>sync.Once</code> in Go).`,
      avoid: `As hidden global state reached from everywhere. It makes tests share state and hides dependencies, so pass the instance in explicitly.`
    },
    "Prototype": {
      use: `When building an object is expensive and you need many similar copies, like cloning a template config or request and changing a few fields.`,
      avoid: `When objects are cheap to build, or hold references that are hard to deep-copy. Shallow copies of maps and slices cause shared-state bugs.`
    },
    "Adapter": {
      use: `To make a third-party or legacy API fit your interface, like wrapping each carrier or payment provider SDK behind one <code>Sender</code> interface.`,
      avoid: `When you control both sides and can simply change the interface.`
    },
    "Decorator": {
      use: `To add behavior around a call without changing it: logging, metrics, retries, caching. HTTP middleware in Go and function decorators in Python are this pattern.`,
      avoid: `When stacked wrappers make the order and behavior hard to see. Keep the chain short and explicit.`
    },
    "Facade": {
      use: `To give callers one simple entry point to a messy subsystem, such as a <code>SendMessage</code> function that hides pricing, routing and persistence.`,
      avoid: `When it grows into a god object everything depends on. Split it by use case.`
    },
    "Proxy": {
      use: `To control access to an object behind the same interface: lazy loading, caching, access checks, or a remote client that looks local.`,
      avoid: `When callers need to know a call is remote. Hiding a network hop behind a local-looking interface invites missing timeouts and retries.`
    },
    "Composite": {
      use: `For trees you want to treat uniformly: nested rules, menus, IVR call-flow nodes, or org hierarchies.`,
      avoid: `When the structure is flat, or leaves and branches need very different handling.`
    },
    "Bridge": {
      use: `When two dimensions vary independently, like notification type (alert, OTP, marketing) and channel (SMS, email, voice), so you avoid one class per combination.`,
      avoid: `When only one dimension varies. It is extra indirection for no gain.`
    },
    "Flyweight": {
      use: `When you hold huge numbers of similar objects and can share their common immutable part, like interned strings or shared country and carrier metadata.`,
      avoid: `Unless memory profiling shows the duplication matters. It complicates code for a gain you may not need.`
    },
    "Strategy": {
      use: `When you swap algorithms at runtime behind one interface, like routing rules (cheapest vs best-quality carrier), retry policies or pricing rules.`,
      avoid: `For two fixed branches that never change, where an if statement is clearer. In Go and Python a function value often replaces the whole pattern.`
    },
    "Observer": {
      use: `When several parts of one process must react to an event without the source knowing about them, like UI updates or in-process hooks.`,
      avoid: `When reaction order or failure handling matters, or across services. Use explicit calls or a real message broker there.`
    },
    "State": {
      use: `When behavior depends on a lifecycle with clear states and transitions, like a call (ringing, answered, completed) or a message (queued, sent, delivered, failed).`,
      avoid: `When there are only two or three states with simple rules. An enum plus a transition table is enough.`
    },
    "Command": {
      use: `To turn a request into an object you can queue, log, retry or undo, like jobs on a queue or admin actions with an audit trail.`,
      avoid: `When a direct function call does the job and you never queue, replay or undo anything.`
    },
    "Chain of Responsibility": {
      use: `When a request passes through handlers that may act on it or stop it, like HTTP middleware (auth, rate limit, validation) or message filters (spam, opt-out, compliance).`,
      avoid: `When every request must run the same fixed steps in the same order. A plain sequence of function calls is easier to follow.`
    },
    "Template Method": {
      use: `When several variants share one algorithm skeleton and differ in a few steps, like importers that all fetch, validate and save.`,
      avoid: `In Go, which has no inheritance, and wherever composition works. Pass the varying steps in as functions or an interface.`
    },
    "Iterator": {
      use: `To walk a collection or stream without loading it all, like paging through an API or reading rows from a cursor. Python generators and Go range-over-func iterators make this cheap.`,
      avoid: `When the data already fits in a slice or list and a plain loop is clearer.`
    },
    "Mediator": {
      use: `When many components talk to each other in tangled ways. Route their interactions through one coordinator, like a dialog controller or a workflow orchestrator.`,
      avoid: `When the mediator would become a god object holding all the business logic.`
    },
    "Memento": {
      use: `To capture and restore an object's state without exposing its internals, like undo in an editor or checkpoints in a long job.`,
      avoid: `When states are large or change often. Snapshots eat memory, and an event log or diffs may fit better.`
    },
    "Visitor": {
      use: `When the set of node types is stable and you keep adding operations over them, like walking an AST or a call-flow tree to validate, render or estimate cost.`,
      avoid: `When node types change often, because every new type means updating every visitor.`
    },
    "Interpreter": {
      use: `For a small, bounded language such as filter or rule expressions (<code>status = failed AND country = DE</code>) that users or config must express.`,
      avoid: `For anything growing into a real language. Use an existing parser, an embedded language, or a structured JSON format instead.`
    },
    "Saga": {
      use: `For a business transaction across services that cannot share a database transaction: each step commits locally and has a compensating action to undo it.`,
      avoid: `When the data can live in one database. A local ACID transaction is simpler and safer.`
    },
    "Transactional outbox": {
      use: `When you must update the database and publish an event reliably: write the event to an outbox table in the same transaction, and a relay publishes it to the broker.`,
      avoid: `When losing or delaying the event is acceptable, or the database write is the only side effect.`
    },
    "Idempotency key": {
      use: `For write APIs that clients may retry, such as send message or charge card: the client sends a unique key, and the server stores the first result and returns it for repeats.`,
      avoid: `For naturally idempotent operations (a PUT that sets a value, a delete by ID), where the key only adds storage.`
    },
    "Inbox (idempotent consumer)": {
      use: `When consumers get at-least-once delivery: record processed message IDs in the same transaction as the side effect, and skip any ID already seen.`,
      avoid: `When the handler is already idempotent by design, like an upsert or a conditional write on a version number.`
    },
    "CQRS": {
      use: `When reads and writes differ sharply in shape or scale, like a write model for sending messages and a denormalized read model for reports.`,
      avoid: `For simple CRUD. Two models plus a sync pipeline double the work and add lag.`
    },
    "Event sourcing": {
      use: `When the history itself is the product (ledgers, audit trails), or you must rebuild state as of any point in time.`,
      avoid: `For most CRUD domains. Event schema changes, snapshots and rebuilding projections are a large, permanent cost.`
    },
    "Strangler fig": {
      use: `To replace a legacy system step by step: route one slice of traffic (an endpoint, a tenant) to the new system, grow it, then retire the old one.`,
      avoid: `When the old system is small enough to rewrite and cut over in one low-risk step.`
    },
    "Anti-corruption layer": {
      use: `When integrating a legacy system or third party whose model should not leak into your domain, like translating each carrier's error codes into your own statuses.`,
      avoid: `When the external model is simple and already matches yours. The translation layer is then just extra code.`
    },
    "Circuit breaker": {
      use: `When a dependency can fail or slow down and waiting on it ties up your workers: after repeated failures, fail fast for a while, then let a few probe calls through.`,
      avoid: `For calls you can never skip without a fallback plan, or when a timeout and a retry budget already cover the risk.`
    },
    "Bulkhead": {
      use: `To stop one slow dependency or noisy tenant from draining shared resources, with separate pools, queues or workers per dependency or customer tier.`,
      avoid: `When load is small and even. Split pools waste capacity and add tuning.`
    },
    "Retry with backoff and jitter": {
      use: `For transient failures of idempotent calls: exponential backoff with random jitter and a cap on attempts.`,
      avoid: `For non-idempotent calls without idempotency keys, for permanent errors, or when another layer of the stack already retries.`
    },
    "Rate limiting": {
      use: `To protect shared resources and keep usage fair per customer, API key or IP, and to respect downstream limits such as carrier throughput.`,
      avoid: `As your only overload defense. Limits do not help when total legitimate traffic exceeds capacity; that is what load shedding is for.`
    },
    "Load shedding": {
      use: `When overloaded: reject low-priority or excess work early with a fast 503, so the work you accept still meets its latency target.`,
      avoid: `When rejected work cannot be retried or queued by the caller. Add capacity or a durable queue instead.`
    },
    "Backpressure": {
      use: `When producers can outrun consumers: use bounded queues, blocking, or signals that slow the producer instead of unbounded buffers.`,
      avoid: `When the producer cannot slow down (incoming phone calls, say). Then you need shedding or buffering to durable storage.`
    },
    "API gateway": {
      use: `As one managed front door for external clients that handles auth, rate limits, routing and TLS.`,
      avoid: `For business logic, or for service-to-service traffic inside your network.`
    },
    "Backend for frontend (BFF)": {
      use: `When web, mobile and partner clients need different shapes of the same data, so each gets a thin backend that aggregates for it.`,
      avoid: `With only one kind of client, or when the BFFs start duplicating business logic.`
    },
    "Sidecar and service mesh": {
      use: `When many services in several languages need the same networking features (mTLS, retries, metrics) applied outside app code.`,
      avoid: `For a few services in one language, where a shared library costs far less to run and debug.`
    },
    "Leader election": {
      use: `When exactly one instance must do a job at a time, like a scheduler or a shard owner, using leases in etcd, Consul, ZooKeeper or a database lock.`,
      avoid: `When the work can be split with a queue and competing consumers. Never use it without fencing tokens if two leaders could briefly overlap.`
    },
    "Consistent hashing": {
      use: `To spread keys over a changing set of nodes so adding or removing one moves only a small share of keys, as in cache clusters and partitioned stores.`,
      avoid: `When the node set is fixed, or when a directory table gives you more control over placement.`
    },
    "Cache-aside": {
      use: `The default caching pattern: read the cache, on a miss load from the database and fill the cache, and delete the key on write.`,
      avoid: `When stale data is dangerous and you cannot bound it with a TTL or invalidation, or the data is cheap to read directly.`
    },
    "Change data capture (CDC)": {
      use: `To stream database changes to other systems (search, analytics, caches) from the write-ahead log with tools like Debezium or AWS DMS, without dual writes in app code.`,
      avoid: `When consumers need business events that carry intent rather than row changes. Publish those explicitly through an outbox.`
    },
    "Pub/sub": {
      use: `When one event should reach many independent subscribers that can come and go, like SNS fanning out to several SQS queues, or Kafka topics.`,
      avoid: `When exactly one worker should handle each message. That is a queue with competing consumers.`
    },
    "Competing consumers": {
      use: `To scale processing by running many workers on one queue, where each message is handled by exactly one of them.`,
      avoid: `When messages for the same key must be processed in order. Partition by key or use FIFO message groups.`
    },
    "Fan-out/fan-in": {
      use: `To split big work into parallel pieces and combine the results, like sending a bulk campaign in chunks and then aggregating delivery stats.`,
      avoid: `When the pieces depend on each other, or the combine step cannot cope with partial failure. Plan for stragglers and retries.`
    },
    "Feature flags": {
      use: `To separate deploy from release: gradual rollouts, kill switches and per-tenant enablement.`,
      avoid: `As permanent config or a substitute for authorization. Stale flags pile up as untested code paths, so give each flag an owner and an expiry.`
    },
    "Expand/contract": {
      use: `For zero-downtime schema or API changes: add the new shape, write to both, backfill, switch reads, then remove the old shape.`,
      avoid: `For tables and APIs with no live traffic, where a single migration is fine.`
    },
    "Sharding": {
      use: `When one database node cannot hold the data or take the write rate even after scaling up, caching and read replicas.`,
      avoid: `Before you truly need it. Cross-shard queries, cross-shard transactions and resharding are permanent costs.`
    },
    "Read replicas": {
      use: `To scale read-heavy workloads and move reporting off the primary, when readers can tolerate some lag.`,
      avoid: `For reads that must see the latest write (right after a user saves), and for scaling writes, which replicas do not help.`
    }
  }
};
