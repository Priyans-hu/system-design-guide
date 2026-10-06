/* Study hub content: roadmap, patterns, tools, labs, resources. */
window.HUB = {
 "start": "2026-10-03",
 "phases": [
  {
   "n": 0,
   "id": "ph0",
   "title": "Foundations",
   "short": "Foundations",
   "weekends": 1,
   "goal": "Know what happens between a click and a database row, and do capacity math in your head.",
   "topics": [
    {
     "id": "p0-request",
     "title": "Life of a request",
     "what": "Every design question starts here. Follow one HTTPS call from the client to the database and back, naming each hop and what can go wrong at it.",
     "points": [
      "DNS: resolvers, TTLs, why a DNS change is not instant",
      "TCP handshake (one round trip), TLS 1.3 (one more), and why keep-alive and connection pools matter",
      "HTTP/1.1 vs HTTP/2 (many requests on one connection) vs HTTP/3 (QUIC over UDP)",
      "Load balancer (L4 vs L7), reverse proxy, TLS termination, health checks",
      "App server, cache, database, response: where the time goes (p50 vs p99)"
     ],
     "res": [
      "whathappens",
      "hpbn",
      "tls13",
      "howdns",
      "haproxy-l4l7"
     ]
    },
    {
     "id": "p0-proto",
     "title": "Protocols you will choose between",
     "what": "Decide how clients and services talk: plain REST, gRPC, webhooks, or a live connection.",
     "points": [
      "REST over HTTP and JSON: simple, cacheable, understood by everyone",
      "gRPC with Protobuf: typed contracts and streaming for service-to-service calls",
      "Webhooks: your server calls the customer back, so you need signing, retries and idempotent receivers",
      "WebSockets, Server-Sent Events, long polling: pushing live updates to browsers"
     ],
     "res": [
      "hpbn",
      "http3-explained"
     ]
    },
    {
     "id": "p0-os",
     "title": "OS and concurrency basics",
     "what": "A server is a process juggling threads, sockets and memory. Knowing the limits explains most scaling surprises.",
     "points": [
      "Process vs thread vs goroutine; context switches; why Go can run 100k goroutines",
      "Blocking vs non-blocking I/O (epoll), and why one slow call can hold a worker",
      "File descriptors, connection limits, memory and garbage-collection pauses",
      "Race conditions, mutexes, deadlocks, atomics; the Go race detector"
     ],
     "res": [
      "ostep",
      "go-pipelines"
     ]
    },
    {
     "id": "p0-scale",
     "title": "Scaling basics",
     "what": "Make the app tier stateless, then add machines. State (sessions, files, data) is what makes scaling hard.",
     "points": [
      "Vertical (bigger box) vs horizontal (more boxes), and when each is right",
      "Stateless services plus shared state stores; why sticky sessions hurt",
      "Load-balancing algorithms: round robin, least connections, consistent hashing",
      "Replication (copies) vs partitioning (splits): the two tools behind every data scaling story"
     ],
     "res": [
      "sdprimer"
     ]
    },
    {
     "id": "p0-estimate",
     "title": "Back-of-envelope math",
     "what": "Rough numbers decide designs. Practice until QPS, storage and bandwidth take under three minutes.",
     "points": [
      "1 day is about 86,400 s (call it 10<sup>5</sup>). 1M requests/day is about 12/s on average; plan for 2-5x at peak",
      "Storage = items per day x bytes x retention. 1 KB x 1M/day x 365 is about 365 GB a year",
      "Memory ~100 ns, SSD random read ~16 µs, same-datacenter round trip ~0.5 ms, India to US East ~200 ms",
      "Say each assumption out loud, round hard, and only compute what changes the design"
     ],
     "res": [
      "napkin",
      "latency",
      "bbg-estimation"
     ]
    }
   ],
   "vault": [
    "c2",
    "c4"
   ],
   "lab": "Trace a real request: run <code>dig</code>, <code>curl -v</code> and <code>openssl s_client</code> against a public API, then draw every hop with its rough latency.",
   "done": "You can draw a request's path through 8+ hops and estimate QPS and storage for a product in under three minutes."
  },
  {
   "n": 1,
   "id": "ph1",
   "title": "Databases and data modeling",
   "short": "Data",
   "weekends": 3,
   "goal": "Pick the right store, shape data for how it is read, and change schemas without downtime.",
   "topics": [
    {
     "id": "p1-rdbms",
     "title": "How a relational database finds rows",
     "what": "Indexes are the difference between 2 ms and 20 s. Learn what the database actually does with your query.",
     "points": [
      "Pages and B-tree indexes; primary vs secondary indexes",
      "Composite index column order (equality columns first, then range); covering and partial indexes",
      "Reading EXPLAIN ANALYZE: sequential vs index scans, row estimates, sorts",
      "N+1 queries, connection pooling (PgBouncer), prepared statements"
     ],
     "res": [
      "uil",
      "pg-explain",
      "cmu445"
     ]
    },
    {
     "id": "p1-tx",
     "title": "Transactions and isolation",
     "what": "Isolation levels decide which strange things concurrent requests can see. Most real bugs here are lost updates and write skew.",
     "points": [
      "ACID; read committed vs repeatable read vs serializable",
      "Anomalies: dirty read, non-repeatable read, phantom, lost update, write skew",
      "MVCC in Postgres: readers do not block writers",
      "Pessimistic (<code>SELECT ... FOR UPDATE</code>) vs optimistic (version column) concurrency"
     ],
     "res": [
      "pg-mvcc",
      "ddia",
      "cmu445"
     ]
    },
    {
     "id": "p1-engines",
     "title": "Storage engines: B-tree vs LSM",
     "what": "B-trees update pages in place and favor reads. LSM trees append and merge later, and favor writes.",
     "points": [
      "B-tree: Postgres, MySQL InnoDB. Predictable reads, random writes",
      "LSM: RocksDB, Cassandra. Memtable, SSTables, compaction, bloom filters",
      "Write vs read vs space amplification",
      "ClickHouse MergeTree: sorted, immutable parts merged in the background, a close cousin of LSM"
     ],
     "res": [
      "db-internals",
      "ddia",
      "cmu445"
     ]
    },
    {
     "id": "p1-nosql",
     "title": "The store zoo: which one when",
     "what": "Pick the store from the access pattern, not from hype. Most real systems use two or three. The <a class=\"link\" href=\"#/databases\">Databases</a> page goes deep on each type.",
     "points": [
      "Relational (Postgres): transactions, joins, flexible queries. The default",
      "Key-value (Redis, DynamoDB): lookups by key at huge scale",
      "Wide-column (Cassandra): write-heavy, partition-key access, tunable consistency",
      "Search (OpenSearch, inverted index), time series (Prometheus), columnar analytics (ClickHouse), documents (MongoDB)"
     ],
     "res": [
      "ddia",
      "sdprimer"
     ]
    },
    {
     "id": "p1-repl",
     "title": "Replication",
     "what": "Copies of data give you read scale and survival. They also give you lag, failover drama and stale reads.",
     "points": [
      "Leader-follower, sync vs async replication, replication lag",
      "Read replicas and the read-your-own-writes problem",
      "Failover: detection, promotion, split brain",
      "Multi-leader and leaderless (quorums), previewed here and covered in Phase 4"
     ],
     "res": [
      "ddia",
      "kleppmann-lectures"
     ]
    },
    {
     "id": "p1-shard",
     "title": "Partitioning and sharding",
     "what": "When one machine cannot hold the data or the writes, split it by a key. The key choice is the whole game.",
     "points": [
      "Range vs hash partitioning; consistent hashing with virtual nodes",
      "A good partition key: high cardinality, even load, matches the main query",
      "Hot partitions and skew: a celebrity user, a giant tenant, one busy time bucket",
      "Resharding, cross-shard queries, local vs global secondary indexes"
     ],
     "res": [
      "ddia",
      "sdprimer"
     ]
    },
    {
     "id": "p1-model",
     "title": "Modeling data and changing it safely",
     "what": "Model for the reads you must serve, then learn to change the schema while traffic keeps flowing.",
     "points": [
      "Normalize vs denormalize; OLTP tables vs OLAP star schemas",
      "Multi-tenancy: shared tables with tenant_id, schema per tenant, database per tenant",
      "Soft delete, archival and retention",
      "Expand/contract migrations, batched backfills, dual writes, change data capture"
     ],
     "res": [
      "ddia",
      "uil"
     ]
    }
   ],
   "vault": [
    "d1",
    "d2",
    "d3",
    "d4",
    "d5",
    "d6",
    "d7",
    "d8",
    "d9",
    "d10",
    "r7"
   ],
   "lab": "Postgres in Docker: load 5M fake message rows, find a slow query with EXPLAIN ANALYZE, add the right composite index and watch the plan change. Then rename a column with expand/contract while a script keeps writing.",
   "done": "Given an access pattern, you can pick a store, a key and the indexes, and say what breaks first at 100x."
  },
  {
   "n": 2,
   "id": "ph2",
   "title": "Caching and performance",
   "short": "Caching",
   "weekends": 1,
   "goal": "Put caches in the right place, keep them correct, and protect the system with rate limits.",
   "topics": [
    {
     "id": "p2-where",
     "title": "Where caching happens",
     "what": "Every layer can cache. Closer to the user is faster but harder to invalidate.",
     "points": [
      "Browser and HTTP caching (<code>Cache-Control</code>, <code>ETag</code>)",
      "CDN at the edge",
      "In-process cache (an LRU map in memory)",
      "Distributed cache (Redis, Memcached); database buffer pool; materialized views"
     ],
     "res": [
      "aws-caching",
      "webdev-cdn"
     ]
    },
    {
     "id": "p2-patterns",
     "title": "Cache patterns and invalidation",
     "what": "Cache-aside is the default. The hard part is knowing when cached data has gone wrong.",
     "points": [
      "Cache-aside, read-through, write-through, write-back, write-around",
      "TTLs, invalidation on write, versioned keys",
      "Negative caching (remembering misses) and its risks",
      "Measure hit ratio, latency saved and staleness, not just hits"
     ],
     "res": [
      "aws-caching",
      "fb-memcache"
     ]
    },
    {
     "id": "p2-failure",
     "title": "When caches hurt you",
     "what": "Caches fail in groups: many keys expire at once, one key gets hammered, or a miss storm hits the database.",
     "points": [
      "Stampede (thundering herd): request coalescing with Go singleflight, locks, early refresh",
      "Avalanche: add random jitter to TTLs",
      "Hot keys: local cache, key splitting, read replicas",
      "Penetration (lookups for keys that never exist): negative cache or a bloom filter"
     ],
     "res": [
      "fb-memcache"
     ]
    },
    {
     "id": "p2-redis",
     "title": "Redis in depth",
     "what": "An in-memory data structure server. Fast because data lives in memory and commands run one at a time.",
     "points": [
      "Types: strings, hashes, lists, sets, sorted sets, streams",
      "Persistence (RDB snapshots, AOF log) and eviction policies",
      "Redis Cluster: 16,384 hash slots; <code>{hash tags}</code> pin related keys to one slot",
      "Atomic multi-step logic with Lua; locks with <code>SET NX PX</code> and their limits"
     ],
     "res": [
      "redis-types",
      "redis-cluster",
      "kleppmann-locking"
     ]
    },
    {
     "id": "p2-ratelimit",
     "title": "Rate limiting",
     "what": "Protect the system and share it fairly. Where you enforce the limit and how you tell clients matters more than the algorithm.",
     "points": [
      "Token bucket (allows bursts), leaky bucket (smooths), fixed window, sliding window",
      "Limit per API key, account, IP or endpoint",
      "Distributed counters in Redis, made atomic with Lua",
      "Return 429 with <code>Retry-After</code>; keep rate limits separate from quotas"
     ],
     "res": [
      "stripe-ratelimit",
      "aws-loadshed"
     ]
    },
    {
     "id": "p2-perf",
     "title": "Latency, pagination and throughput",
     "what": "Averages hide pain. Design and measure for the slow tail.",
     "points": [
      "p50, p95, p99; why a call that fans out to 100 servers sees their p99 on most requests",
      "Offset vs keyset (cursor) pagination on large tables",
      "Batching, pooling, compression, fewer chatty calls",
      "Little's Law: requests in flight = throughput x latency"
     ],
     "res": [
      "tail-at-scale",
      "uil"
     ]
    }
   ],
   "vault": [
    "k1",
    "k2",
    "k3",
    "k4",
    "k5",
    "k6",
    "k7",
    "k8",
    "c3"
   ],
   "lab": "Build a token-bucket rate limiter in Go backed by Redis (one Lua script). Load test it with vegeta. Then put cache-aside with singleflight in front of a slow endpoint and compare p99 before and after.",
   "done": "You can explain three cache failure modes with their fixes, and build a correct distributed rate limiter."
  },
  {
   "n": 3,
   "id": "ph3",
   "title": "Async processing and messaging",
   "short": "Async",
   "weekends": 2,
   "goal": "Decouple work with queues and logs, and make duplicates, retries and poison messages harmless.",
   "topics": [
    {
     "id": "p3-sync",
     "title": "Sync vs async",
     "what": "Call and wait when the user needs the answer now. Queue it when the work is slow, spiky, or allowed to fail and retry.",
     "points": [
      "Request-response vs events vs jobs",
      "Temporal coupling: if B is down, does A fail too?",
      "Queues absorb spikes (load leveling)",
      "Async APIs: 202 Accepted plus a status endpoint or a webhook"
     ],
     "res": [
      "aws-backlogs"
     ]
    },
    {
     "id": "p3-queues",
     "title": "Queues vs logs",
     "what": "A queue hands each message to one worker and forgets it. A log keeps every message in order so many readers can replay it.",
     "points": [
      "SQS and RabbitMQ: competing consumers, visibility timeout or ack, delete after success",
      "Kafka: topics, partitions, offsets, consumer groups, retention and replay",
      "SNS: one publish fanned out to many subscribers",
      "Ordering is per message group or partition, never global"
     ],
     "res": [
      "kafka-design",
      "confluent-101",
      "the-log"
     ]
    },
    {
     "id": "p3-semantics",
     "title": "Delivery semantics and idempotency",
     "what": "Networks retry, so messages arrive twice. \"Exactly once\" in practice means at-least-once delivery plus idempotent processing.",
     "points": [
      "At-most-once, at-least-once, effectively-once",
      "Idempotency keys and dedup tables (the inbox pattern)",
      "Idempotent consumers: upserts, conditional writes, version checks",
      "Ordering per key: partition by account or conversation"
     ],
     "res": [
      "stripe-idem",
      "brandur-idem",
      "aws-idem"
     ]
    },
    {
     "id": "p3-failures",
     "title": "Retries, DLQs and poison messages",
     "what": "Some messages will never succeed. Retry the transient failures with backoff and park the rest where a human will see them.",
     "points": [
      "Retry with backoff and cap the attempts (maxReceiveCount)",
      "Dead-letter queue, plus an alert and a redrive tool",
      "Poison message: one bad payload that crashes every consumer that touches it",
      "Watch queue depth and the age of the oldest message, not just throughput"
     ],
     "res": [
      "aws-backlogs"
     ]
    },
    {
     "id": "p3-eda",
     "title": "Event-driven design and schemas",
     "what": "Events let services react without knowing about each other. You pay for it with harder debugging and schema evolution.",
     "points": [
      "Event notification vs event-carried state transfer vs event sourcing",
      "Schema evolution: additive changes, versioned events, a schema registry",
      "Change data capture (CDC): stream database changes as events",
      "Choreography gets hard to follow past four or five steps"
     ],
     "res": [
      "fowler-es",
      "the-log"
     ]
    },
    {
     "id": "p3-jobs",
     "title": "Jobs, schedulers and workflows",
     "what": "Long or scheduled work needs a durable record of its state, not just a message.",
     "points": [
      "Job table, worker pool, and status polling or a webhook for users",
      "Delayed and scheduled jobs; cron at scale",
      "Workflow engines (Temporal) for long, multi-step processes",
      "Heartbeats and leases so stuck jobs get picked up again"
     ],
     "res": [
      "temporal-saga",
      "hello-interview"
     ]
    }
   ],
   "vault": [
    "c5",
    "c6",
    "c10",
    "a1",
    "a2",
    "a3",
    "a4",
    "a5",
    "a6",
    "a7",
    "a8",
    "a9"
   ],
   "lab": "LocalStack SQS (or Redpanda for a Kafka API) in Docker: one producer, two consumers, a poison message that lands in a DLQ, and an idempotent consumer that stays correct when every message is delivered twice.",
   "done": "You can explain why exactly-once is mostly a myth, and design a pipeline that stays correct under duplicates, reordering and consumer crashes."
  },
  {
   "n": 4,
   "id": "ph4",
   "title": "Consistency, transactions and consensus",
   "short": "Consistency",
   "weekends": 2,
   "goal": "Reason precisely about what users can observe, and coordinate machines without fooling yourself.",
   "topics": [
    {
     "id": "p4-models",
     "title": "Consistency models",
     "what": "A consistency model is a promise about what reads can return. Stronger promises cost latency and availability.",
     "points": [
      "Linearizable: the system behaves like a single copy",
      "Causal, read-your-writes, monotonic reads: the session guarantees users actually notice",
      "Eventual: replicas converge once writes stop",
      "Choose per feature: an account balance needs strong; a view counter does not"
     ],
     "res": [
      "jepsen-models",
      "ddia"
     ]
    },
    {
     "id": "p4-cap",
     "title": "CAP and PACELC",
     "what": "During a network partition you choose consistency or availability. The rest of the time you trade latency for consistency.",
     "points": [
      "CAP only bites while a partition is happening",
      "PACELC: else (no partition), latency vs consistency",
      "Single-leader Postgres leans consistent; Dynamo-style stores lean available with tunable quorums",
      "In interviews, say the product consequence, not just the letter"
     ],
     "res": [
      "kleppmann-lectures"
     ]
    },
    {
     "id": "p4-dtx",
     "title": "Distributed transactions: 2PC, sagas, outbox",
     "what": "Across services you cannot hold one lock. Sagas and outboxes get you correctness through retries and compensation.",
     "points": [
      "2PC: atomic but blocking, and the coordinator is a single point of failure",
      "Saga: local steps with compensations, orchestrated or choreographed (see the Patterns tab)",
      "Transactional outbox: write the event in the same DB transaction, relay it later",
      "Inbox or dedup table on the consumer side"
     ],
     "res": [
      "ms-saga",
      "ms-outbox",
      "temporal-saga"
     ]
    },
    {
     "id": "p4-time",
     "title": "Time, ordering and IDs",
     "what": "Clocks on different machines disagree. Never order events across machines by wall-clock time alone.",
     "points": [
      "Clock skew and NTP; why timestamps collide or even go backwards",
      "Lamport clocks and vector clocks (happened-before)",
      "Unique IDs: Snowflake (time + machine + sequence), UUIDv7, ULID",
      "Time-sortable IDs keep indexes and pagination happy"
     ],
     "res": [
      "kleppmann-lectures"
     ]
    },
    {
     "id": "p4-consensus",
     "title": "Consensus, locks and leases",
     "what": "Consensus lets a group of machines agree on one value or one log. You almost always use it through etcd, Consul or ZooKeeper instead of writing it.",
     "points": [
      "Raft: leader election, log replication, majority commit",
      "Quorums: R + W &gt; N; why clusters have 3 or 5 nodes",
      "Leases and leader election; fencing tokens stop zombie leaders",
      "Gossip for membership and failure detection"
     ],
     "res": [
      "raft-anim",
      "raft-paper",
      "kleppmann-locking",
      "mit6824"
     ]
    }
   ],
   "vault": [
    "t1",
    "t2",
    "t3",
    "t4",
    "t5",
    "t6",
    "t7",
    "t8",
    "t9",
    "t10"
   ],
   "lab": "Play the Raft animation, then run a 3-node etcd cluster in Docker: kill the leader, watch re-election, write with one node down, then with two down.",
   "done": "You can pick a consistency level per feature, sketch a saga with compensations, and explain why a lock without a fencing token is unsafe."
  },
  {
   "n": 5,
   "id": "ph5",
   "title": "Reliability and resilience",
   "short": "Reliability",
   "weekends": 2,
   "goal": "Expect failure, and design so it stays small, short and visible.",
   "topics": [
    {
     "id": "p5-failures",
     "title": "How systems really fail",
     "what": "Slow is worse than dead. Most outages come from overload, retries, bad deploys or config, not hardware.",
     "points": [
      "Crashed vs slow vs partly failing dependencies",
      "Resource exhaustion: connections, threads, file descriptors, memory",
      "Cascading failures and retry storms; metastable failures that stay down after the trigger is gone",
      "Bad deploys, config pushes, expired certificates, full disks, noisy neighbors"
     ],
     "res": [
      "sre-cascading",
      "sre-overload"
     ]
    },
    {
     "id": "p5-retries",
     "title": "Timeouts, retries and backoff",
     "what": "Every remote call needs a timeout. Retries help only for idempotent work, with backoff and jitter, at one layer.",
     "points": [
      "Set timeouts from real p99 latency and pass deadlines downstream",
      "Exponential backoff with full jitter",
      "Retry budgets (for example, at most 10% extra load)",
      "Retry at one layer only: 5 layers x 3 tries each is 243 calls"
     ],
     "res": [
      "aws-retries",
      "sre-cascading"
     ]
    },
    {
     "id": "p5-breakers",
     "title": "Circuit breakers, bulkheads, load shedding",
     "what": "Stop sending traffic to what is failing, keep failures in their own compartment, and drop work you cannot finish.",
     "points": [
      "Circuit breaker: closed, open, half-open",
      "Bulkheads: separate pools per dependency or tenant",
      "Load shedding and admission control: reject early and cheaply",
      "Backpressure: slow the producer instead of drowning the consumer"
     ],
     "res": [
      "azure-patterns",
      "aws-loadshed",
      "aws-shuffle"
     ]
    },
    {
     "id": "p5-degrade",
     "title": "Graceful degradation",
     "what": "Decide in advance what to switch off so the core path survives.",
     "points": [
      "Serve stale data, hide non-critical widgets, queue instead of failing",
      "Kill switches and feature flags for heavy features",
      "Static fallbacks, default values, last known good config",
      "Fail open vs fail closed: security checks fail closed"
     ],
     "res": [
      "sre-overload"
     ]
    },
    {
     "id": "p5-dr",
     "title": "Multi-AZ, multi-region and disaster recovery",
     "what": "Availability zones protect you from one data center failing; regions protect you from a whole region failing, at a real cost.",
     "points": [
      "RPO (how much data you can lose) and RTO (how long recovery takes)",
      "Active-passive vs active-active; DNS and health-check failover",
      "Cross-region replication lag and conflict handling",
      "Backups only count if you practice restoring them"
     ],
     "res": [
      "sre-book"
     ]
    }
   ],
   "vault": [
    "r1",
    "r2",
    "r3",
    "r4",
    "r5",
    "r6",
    "c7",
    "c8"
   ],
   "lab": "Put Toxiproxy between a Go client and a small service. Add 2 s of latency and watch the client pile up. Then add a timeout, retries with jitter and a circuit breaker (sony/gobreaker) and compare.",
   "done": "You can walk through how one slow dependency takes a whole system down, and name the four or five mechanisms that stop it."
  },
  {
   "n": 6,
   "id": "ph6",
   "title": "Monitoring and observability: Prometheus, Grafana, logs, traces, profiles",
   "short": "Observability",
   "weekends": 3,
   "goal": "Tell whether the system is healthy in 10 seconds, and find out why it is not in 10 minutes.",
   "topics": [
    {
     "id": "p6-methods",
     "title": "Signals and methods",
     "what": "Metrics tell you something is wrong, traces tell you where, logs tell you why. Error tracking and profiles fill the gaps.",
     "points": [
      "RED for services: rate, errors, duration",
      "USE for resources: utilization, saturation, errors",
      "Google's four golden signals: latency, traffic, errors, saturation",
      "Alert on symptoms users feel; investigate with causes"
     ],
     "res": [
      "red",
      "use",
      "golden-signals"
     ]
    },
    {
     "id": "p6-prom",
     "title": "Prometheus",
     "what": "A metrics system. It stores numbers over time as series (a metric name plus labels), and lets you query and alert on them.",
     "points": [
      "Pull model: Prometheus scrapes <code>/metrics</code> endpoints on an interval",
      "Types: counter (only goes up), gauge (up and down), histogram (buckets), summary",
      "Pushgateway is meant for short-lived batch jobs, and it keeps a series until you delete it",
      "Cardinality: every unique label combination is a new series. Never label by user or request id"
     ],
     "res": [
      "prom-start",
      "prom-overview",
      "prom-pushing",
      "prom-naming",
      "prom-instr"
     ]
    },
    {
     "id": "p6-promql",
     "title": "PromQL",
     "what": "The query language. Most real dashboards need about eight patterns.",
     "points": [
      "<code>rate(http_requests_total[5m])</code>: per-second rate of a counter",
      "<code>sum by (route) (...)</code>: aggregate across instances",
      "Error ratio: the rate of errors divided by the rate of all requests",
      "<code>histogram_quantile(0.99, sum by (le) (rate(x_bucket[5m])))</code>: p99 latency"
     ],
     "res": [
      "promql-basics",
      "promlabs-cheat",
      "promlabs-rate",
      "prom-histograms"
     ]
    },
    {
     "id": "p6-alerting",
     "title": "Alerting",
     "what": "An alert should mean a human must act now. Everything else belongs on a dashboard or in a ticket.",
     "points": [
      "Alertmanager: grouping, routing, silences, inhibition",
      "Alert on SLO burn rate over two windows (a fast one and a slow one)",
      "Every alert links to a runbook",
      "Track noisy alerts, then fix or delete them"
     ],
     "res": [
      "sre-alerting-slo",
      "alertmanager"
     ]
    },
    {
     "id": "p6-grafana",
     "title": "Grafana",
     "what": "The screen where metrics, logs and traces meet. It stores no data itself; it queries data sources and draws panels.",
     "points": [
      "Data sources, dashboards, panels, variables",
      "Incident-first layout: SLOs and RED at the top, drill-downs below",
      "Grafana alerting vs Prometheus alerting",
      "The LGTM stack: Loki (logs), Grafana, Tempo (traces), Mimir (metrics)"
     ],
     "res": [
      "grafana-fund",
      "lgtm-docker",
      "grafana-docs"
     ]
    },
    {
     "id": "p6-logs",
     "title": "Logs, traces and errors",
     "what": "Structured logs with a request id, traces that follow one request across services, and error tracking for crashes.",
     "points": [
      "Structured JSON logs, levels, correlation ids; never log secrets or personal data",
      "Log search: the OpenSearch/Elasticsearch inverted index, retention",
      "OpenTelemetry: spans, context propagation, the Collector, head vs tail sampling",
      "Error tracking (Sentry) groups exceptions with stack traces"
     ],
     "res": [
      "otel-primer",
      "otel-collector",
      "jaeger-docs"
     ]
    },
    {
     "id": "p6-slo",
     "title": "SLOs and error budgets",
     "what": "Pick what users care about, set a target, and spend the leftover unreliability on shipping faster.",
     "points": [
      "SLI (what you measure), SLO (your target), SLA (a contract with penalties)",
      "Error budget = 1 - SLO. 99.9% a month allows about 43 minutes of failure",
      "Burn-rate alerts instead of static thresholds",
      "Pick SLIs per user journey: send a message, place a call, OTP delivered"
     ],
     "res": [
      "sre-slo",
      "sre-workbook",
      "sre-alerting-slo"
     ]
    },
    {
     "id": "obs-instrumentation",
     "title": "Instrumentation in code",
     "what": "Good dashboards start in code: one RED middleware on every server and client, a small fixed set of labels, and histogram buckets chosen around your SLO.",
     "points": [
      "One middleware records requests, errors and a duration histogram for every route; wrap outbound HTTP and database clients the same way",
      "Labels: <code>route</code> as the template (<code>/v1/messages/{id}</code>, never the raw path), <code>method</code> and status class. Never user ids, phone numbers or request ids",
      "Put bucket edges around your SLO threshold (for example 0.1, 0.25, 0.3, 0.5, 1 s); native histograms (stable in Prometheus 3.8+) set buckets automatically",
      "Exemplars attach a trace id to a histogram sample, so a latency spike in Grafana links straight to a slow trace (Prometheus needs <code>--enable-feature=exemplar-storage</code>)",
      "Follow OpenTelemetry semantic conventions (<code>http.server.request.duration</code>) so Go and Python services report the same names"
     ],
     "use": "Every new service or endpoint, before it reaches production.",
     "avoid": "Do not add a label per customer or raw URL, and do not use summaries when you need to aggregate percentiles across instances.",
     "res": [
      {
       "t": "Instrumentation",
       "by": "Prometheus docs",
       "url": "https://prometheus.io/docs/practices/instrumentation/",
       "type": "docs",
       "free": true,
       "why": "What to measure for online services, batch jobs and libraries."
      },
      {
       "t": "Histograms and summaries",
       "by": "Prometheus docs",
       "url": "https://prometheus.io/docs/practices/histograms/",
       "type": "docs",
       "free": true,
       "why": "Bucket choice, quantile error and why summaries do not aggregate."
      },
      {
       "t": "Introduction to exemplars",
       "by": "Grafana docs",
       "url": "https://grafana.com/docs/grafana/latest/fundamentals/exemplars/",
       "type": "docs",
       "free": true,
       "why": "How a metric point links to the trace that produced it."
      }
     ]
    },
    {
     "id": "obs-tracing",
     "title": "Distributed tracing deep dive",
     "what": "A trace is a tree of spans that follows one request across services. It only works if context propagates through every hop, including queues, and if spans are named for the work they do.",
     "points": [
      "W3C <code>traceparent</code> holds a version, a 16-byte trace id, an 8-byte parent span id and flags (the sampled bit); <code>tracestate</code> carries vendor data",
      "One span per network call or meaningful unit of work, with low-cardinality names (<code>GET /v1/calls/{id}</code>) and details in attributes; set error status on failures",
      "Propagate through async hops too: put <code>traceparent</code> in queue message headers, and use span links when one job consumes many messages",
      "Baggage sends key-value pairs (tenant, plan) to every downstream call, so keep it small and never put secrets or personal data in it",
      "Head sampling decides at the root (cheap, but misses rare errors); tail sampling in the Collector waits for the whole trace and keeps errors and slow ones, at a memory cost"
     ],
     "use": "When a request crosses several services, queues or third-party calls and you need to see where the time or the error is.",
     "avoid": "Do not create a span per function or loop iteration, and do not try to keep 100% of traces at high traffic.",
     "res": [
      {
       "t": "Trace Context",
       "by": "W3C",
       "url": "https://www.w3.org/TR/trace-context/",
       "type": "spec",
       "free": true,
       "why": "The traceparent and tracestate headers, field by field."
      },
      {
       "t": "Traces",
       "by": "OpenTelemetry docs",
       "url": "https://opentelemetry.io/docs/concepts/signals/traces/",
       "type": "docs",
       "free": true,
       "why": "Spans, attributes, events, links and status."
      },
      {
       "t": "Sampling",
       "by": "OpenTelemetry docs",
       "url": "https://opentelemetry.io/docs/concepts/sampling/",
       "type": "docs",
       "free": true,
       "why": "Head vs tail sampling and when to use each."
      }
     ]
    },
    {
     "id": "obs-profiling",
     "title": "Continuous profiling",
     "what": "Continuous profiling samples CPU and memory in production all the time, so you can see which functions cost the most during an incident or after a deploy, not just in a benchmark.",
     "points": [
      "Profile types: CPU, heap (in use and allocated), goroutines, mutex and block contention; for Python, sampled CPU and wall time",
      "Flame graphs: width is the share of samples, height is stack depth, and the x-axis is not time. Look for wide plateaus",
      "Grafana Pyroscope and Parca store profiles over time; they scrape Go's <code>/debug/pprof</code> endpoints, accept SDK pushes, or profile any process with eBPF",
      "Diff two time ranges (before and after a deploy) to see what got slower; span profiles link a slow trace span to its profile",
      "Profiles also feed Go's profile-guided optimization: a <code>default.pgo</code> CPU profile typically gives 2-14% speedups"
     ],
     "use": "When CPU or memory cost is high or regressed after a deploy and metrics cannot tell you which code is responsible.",
     "avoid": "Do not expose <code>/debug/pprof</code> on a public listener; serve it on an internal port only.",
     "res": [
      {
       "t": "Flame Graphs",
       "by": "Brendan Gregg",
       "url": "https://www.brendangregg.com/flamegraphs.html",
       "type": "blog",
       "free": true,
       "why": "How to read flame graphs, from the person who invented them."
      },
      {
       "t": "Grafana Pyroscope",
       "by": "Grafana docs",
       "url": "https://grafana.com/docs/pyroscope/latest/",
       "type": "docs",
       "free": true,
       "why": "Setup for Go and Python, flame graph diffs and links from traces."
      },
      {
       "t": "Parca",
       "by": "Parca project",
       "url": "https://www.parca.dev/docs/overview/",
       "type": "docs",
       "free": true,
       "why": "An open source, eBPF-based alternative."
      }
     ]
    },
    {
     "id": "obs-synthetic-rum",
     "title": "Synthetic and real-user monitoring",
     "what": "Synthetic checks probe your service from outside on a schedule; real-user monitoring (RUM) measures what actual users experience. Both catch failures your internal metrics cannot see, such as DNS, TLS, CDN or browser problems.",
     "points": [
      "Prometheus Blackbox Exporter probes HTTP, TCP, DNS, ICMP and gRPC; alert on <code>probe_success</code>, and on <code>probe_ssl_earliest_cert_expiry</code> well before a certificate expires",
      "Run checks from several regions and from outside your cloud, so DNS, certificate and load balancer failures show up",
      "Script real journeys, not just <code>/healthz</code>: authenticate, send a test message, confirm the status webhook arrives",
      "RUM for web apps: Core Web Vitals (LCP, INP, CLS) from real browsers via the <code>web-vitals</code> library, split by page, country and device",
      "Synthetics give a clean baseline even with no traffic; RUM shows real variety but is noisy and needs sampling and privacy care"
     ],
     "use": "Public APIs, login and payment flows, and any endpoint customers call directly or rely on for webhooks.",
     "avoid": "Do not treat a 200 from <code>/healthz</code> as proof users can complete a journey, and do not let probe traffic skew your SLIs; label or exclude it.",
     "res": [
      {
       "t": "Blackbox Exporter",
       "by": "Prometheus",
       "url": "https://github.com/prometheus/blackbox_exporter",
       "type": "repo",
       "free": true,
       "why": "Probe modules and example configs for HTTP, TCP, DNS, ICMP and gRPC."
      },
      {
       "t": "Web Vitals",
       "by": "web.dev (Google)",
       "url": "https://web.dev/articles/vitals",
       "type": "docs",
       "free": true,
       "why": "What LCP, INP and CLS measure and their good thresholds."
      },
      {
       "t": "Monitoring Distributed Systems",
       "by": "Google SRE book",
       "url": "https://sre.google/sre-book/monitoring-distributed-systems/",
       "type": "book",
       "free": true,
       "why": "Black-box vs white-box monitoring and the four golden signals."
      }
     ]
    },
    {
     "id": "obs-cost-cardinality",
     "title": "Observability cost and cardinality control",
     "what": "Observability bills grow with active series, log volume and span count, and they often grow faster than traffic. Control them by design instead of by emergency deletes.",
     "points": [
      "A metric's series count can reach the product of each label's distinct values. Find the worst offenders with <code>topk(10, count by (__name__) ({__name__=~\".+\"}))</code> or the TSDB status page",
      "Give each metric a label budget and enforce it: <code>sample_limit</code> and <code>label_limit</code> in scrape configs, <code>metric_relabel_configs</code> to drop labels",
      "Logs: no debug level in production, sample high-volume success logs, keep every error, and move old indices hot → warm → delete with OpenSearch ISM policies",
      "Traces: head-sample routine traffic and tail-sample to keep all errors and slow requests",
      "Recording rules pre-compute expensive queries, so dashboards and long-term storage read a few aggregated series instead of thousands of raw ones"
     ],
     "use": "When adding labels or log lines on a hot path, and when the monitoring bill or Prometheus memory grows faster than traffic.",
     "avoid": "Do not cut cost by dropping what you need in an incident (error logs, SLO metrics); cut high-volume, low-value data first.",
     "res": [
      {
       "t": "Cardinality is key",
       "by": "Brian Brazil, Robust Perception",
       "url": "https://www.robustperception.io/cardinality-is-key/",
       "type": "blog",
       "free": true,
       "why": "Why series count drives Prometheus cost and how to budget it."
      },
      {
       "t": "What are cardinality spikes and why do they matter?",
       "by": "Grafana Labs",
       "url": "https://grafana.com/blog/what-are-cardinality-spikes-and-why-do-they-matter/",
       "type": "blog",
       "free": true,
       "why": "How spikes happen and how to find and limit them."
      },
      {
       "t": "Index State Management",
       "by": "OpenSearch docs",
       "url": "https://docs.opensearch.org/latest/im-plugin/ism/index/",
       "type": "docs",
       "free": true,
       "why": "Policies that move log indices through retention tiers and delete them."
      }
     ]
    }
   ],
   "vault": [
    "o1",
    "o2",
    "o3",
    "o4",
    "o6",
    "r10"
   ],
   "lab": "Observability in a box: docker compose with a tiny Go service, Prometheus, Grafana and Alertmanager. Instrument a counter and a histogram, write five PromQL queries, build a RED dashboard, and fire an alert when p99 goes over 300 ms.",
   "done": "You can instrument a service, write the p99 and error-rate PromQL from memory, and explain why a high-cardinality label is dangerous."
  },
  {
   "n": 7,
   "id": "ph7",
   "title": "Production engineering: on-call, incidents and debugging",
   "short": "Production",
   "weekends": 2,
   "goal": "Handle incidents calmly, find causes with data instead of guesses, and make the system faster, sturdier and cheaper on purpose.",
   "topics": [
    {
     "id": "prod-oncall",
     "title": "On-call and incident response",
     "what": "Incident response is a practiced routine: declare early, assign roles, mitigate before you debug, and communicate on a schedule.",
     "points": [
      "Define severity by customer impact (for example, SEV1: many customers cannot send messages or place calls); declare early and downgrade later",
      "Roles: an incident commander coordinates and does not debug; subject-matter experts fix; a communications lead posts updates; a scribe keeps the timeline",
      "Mitigate first: roll back, turn off the feature flag, fail over or shed load. Root cause can wait until users are fine",
      "Update on a fixed cadence (for example every 30 minutes for SEV1), internally and on the status page, even when nothing is new",
      "Healthy on-call: page on SLO burn rate and user-facing symptoms, link a runbook from every alert, hand over with notes, and track pages per shift and MTTR"
     ],
     "use": "As soon as you join an on-call rotation, and the moment a customer-facing problem starts.",
     "avoid": "Do not let one person both debug and coordinate, and do not stay quiet on the status page until you know the cause.",
     "res": [
      {
       "t": "PagerDuty Incident Response",
       "by": "PagerDuty",
       "url": "https://response.pagerduty.com/",
       "type": "docs",
       "free": true,
       "why": "Roles, severity levels and call etiquette, ready to adopt."
      },
      {
       "t": "Managing Incidents",
       "by": "Google SRE book",
       "url": "https://sre.google/sre-book/managing-incidents/",
       "type": "book",
       "free": true,
       "why": "An unmanaged incident vs a managed one, step by step."
      },
      {
       "t": "Being On-Call",
       "by": "Google SRE book",
       "url": "https://sre.google/sre-book/being-on-call/",
       "type": "book",
       "free": true,
       "why": "Balancing load, avoiding burnout and keeping pages actionable."
      }
     ]
    },
    {
     "id": "prod-debugging",
     "title": "Debugging production",
     "what": "Debug production with a loop: observe, form a hypothesis, test it with data, narrow down. Start with what changed and what users see.",
     "points": [
      "Ask first: what changed? Deploys, config and feature flags, traffic shape, dependencies, certificates, cron jobs",
      "Scope it: which endpoints, regions, customers and versions. RED dashboards show whether it is errors, latency or traffic",
      "Follow one bad request: exemplar → trace → slow or failing span → that service's logs by trace id → a profile if it is CPU or memory",
      "Write each hypothesis down and test the cheapest first; change one thing at a time and note timestamps for the postmortem",
      "Capture evidence before restarting (a goroutine dump, <code>py-spy dump</code>, a heap profile), and know when to stop debugging and roll back"
     ],
     "use": "Any error spike, latency regression or customer escalation where the cause is not obvious in the first five minutes.",
     "avoid": "Do not grep logs at random or restart things and hope; a restart can destroy the evidence you need.",
     "res": [
      {
       "t": "Effective Troubleshooting",
       "by": "Google SRE book",
       "url": "https://sre.google/sre-book/effective-troubleshooting/",
       "type": "book",
       "free": true,
       "why": "The hypothesis-driven method and its common pitfalls."
      },
      {
       "t": "A debugging manifesto",
       "by": "Julia Evans",
       "url": "https://jvns.ca/blog/2022/12/08/a-debugging-manifesto/",
       "type": "blog",
       "free": true,
       "why": "Short rules for staying calm and systematic while debugging."
      }
     ]
    },
    {
     "id": "prod-postmortems",
     "title": "Postmortems",
     "what": "A postmortem turns an incident into lasting fixes. It is blameless: it asks how the system let the failure happen, not who caused it.",
     "points": [
      "Blameless means people can describe what they saw and did without fear, which is the only way to learn what really happened",
      "Build a UTC timeline: first signal, detection, escalation, mitigation, resolution. Measure time to detect and time to mitigate",
      "Look for contributing factors, not one root cause, and ask why each decision made sense at the time",
      "Action items: few, specific, owned, dated and tracked as tickets. Prefer guardrails, alerts and tests over \"be more careful\"",
      "Review the postmortem in a meeting, share it widely, and check open action items weekly until they are closed"
     ],
     "use": "After any customer-impacting incident, SLO breach or scary near miss.",
     "avoid": "Do not write \"human error\" as the root cause, and do not produce twenty vague action items that nobody owns.",
     "res": [
      {
       "t": "Postmortem Culture: Learning from Failure",
       "by": "Google SRE book",
       "url": "https://sre.google/sre-book/postmortem-culture/",
       "type": "book",
       "free": true,
       "why": "Why blameless works and how to make postmortems a habit."
      },
      {
       "t": "PagerDuty Postmortem Documentation",
       "by": "PagerDuty",
       "url": "https://postmortems.pagerduty.com/",
       "type": "docs",
       "free": true,
       "why": "A full process and template, from timeline to action items."
      },
      {
       "t": "Example Postmortem",
       "by": "Google SRE book",
       "url": "https://sre.google/sre-book/example-postmortem/",
       "type": "book",
       "free": true,
       "why": "A complete sample to copy the shape of."
      }
     ]
    },
    {
     "id": "prod-capacity",
     "title": "Capacity planning and load testing",
     "what": "Capacity planning answers \"how much traffic can we take, and when do we run out?\" Load tests measure the answer instead of guessing it.",
     "points": [
      "Find each service's limiting resource (CPU, database connections, a partner's rate limit) and its throughput at your latency SLO, not at 100% CPU",
      "Latency climbs steeply as utilization nears 100% because queues build; run well below the measured limit, with headroom for spikes and a lost zone",
      "Little's Law: requests in flight = throughput x latency. At 500 req/s and 200 ms that is about 100; size pools and workers from it",
      "k6 test types: smoke, average-load, stress, spike, soak (hours, finds leaks) and breakpoint. Use arrival-rate executors so a slow server does not slow the load",
      "Test a production-like setup with realistic data and traffic mix, watch dependencies too, and set pass/fail thresholds on p99 and error rate"
     ],
     "use": "Before a launch or a large customer onboarding, after big architecture changes, and quarterly for growth forecasts.",
     "avoid": "Do not load test a partner's or a shared production API without permission, and do not judge results by averages; read p95 and p99.",
     "res": [
      {
       "t": "Load test types",
       "by": "Grafana k6 docs",
       "url": "https://grafana.com/docs/k6/latest/testing-guides/test-types/",
       "type": "docs",
       "free": true,
       "why": "When to run smoke, average-load, stress, spike, soak and breakpoint tests."
      },
      {
       "t": "Open and closed models",
       "by": "Grafana k6 docs",
       "url": "https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/",
       "type": "docs",
       "free": true,
       "why": "Why arrival-rate load avoids coordinated omission."
      },
      {
       "t": "Latency Sneaks Up On You",
       "by": "Marc Brooker",
       "url": "https://brooker.co.za/blog/2021/08/05/utilization.html",
       "type": "blog",
       "free": true,
       "why": "Why latency rises sharply as utilization grows."
      }
     ]
    },
    {
     "id": "prod-perf",
     "title": "Performance engineering",
     "what": "Performance work starts with a latency budget and a profile, not a hunch. Most backend wins come from fewer round trips and less waiting, not faster code.",
     "points": [
      "Set a latency budget per hop: if the API target is 300 ms at p99, split it across gateway, service, database and partner calls",
      "Profile before optimizing: traces show where wall time goes, pprof or py-spy show where CPU goes. Fix the biggest bar first",
      "N+1 queries (one query per item in a loop) show up as a ladder of identical spans; fix with a join, <code>WHERE id IN (...)</code> or batching",
      "Pools: size database and HTTP pools with Little's Law and watch pool wait time; a pool that is too large overloads the database",
      "Fan-out multiplies tail latency, so one slow dependency sets your p99. Use tight timeouts, hedged requests for idempotent reads, and caching with care"
     ],
     "use": "When a p99 is over its target, a hot endpoint burns too much CPU, or a new feature adds a call to the critical path.",
     "avoid": "Do not optimize code that is not hot in a profile, and do not add a cache before you know why the call underneath is slow.",
     "res": [
      {
       "t": "Performance Analysis Methodology",
       "by": "Brendan Gregg",
       "url": "https://www.brendangregg.com/methodology.html",
       "type": "docs",
       "free": true,
       "why": "Named methods (and anti-methods) for finding performance problems."
      },
      {
       "t": "The Tail at Scale",
       "by": "Jeffrey Dean and Luiz André Barroso",
       "url": "https://research.google/pubs/the-tail-at-scale/",
       "type": "paper",
       "free": true,
       "why": "Why fan-out makes p99 dominate, and hedged requests to fight it."
      },
      {
       "t": "Use The Index, Luke",
       "by": "Markus Winand",
       "url": "https://use-the-index-luke.com/",
       "type": "book",
       "free": true,
       "why": "SQL indexing for developers, the usual fix for slow queries."
      }
     ]
    },
    {
     "id": "prod-chaos",
     "title": "Chaos engineering and game days",
     "what": "Chaos engineering tests a hypothesis about how your system handles failure by injecting that failure on purpose, in a controlled way, before it happens for real.",
     "points": [
      "The loop: define steady state as an SLI, predict it will hold, inject a real-world fault, compare, then fix what broke",
      "Start small: one service in staging, a small blast radius and an abort switch; move toward production only when experiments are routine",
      "Useful faults: kill a task, add latency or errors to a dependency (Toxiproxy), fill a disk, expire a certificate, throttle a partner API",
      "AWS Fault Injection Service runs experiments with stop conditions, using actions such as <code>aws:ecs:stop-task</code>, <code>aws:ecs:task-network-latency</code> and <code>aws:rds:failover-db-cluster</code>",
      "Game days: a scheduled team exercise that practices detection, runbooks and communication, not only the fix"
     ],
     "use": "After adding resilience mechanisms (timeouts, retries, failover) to prove they work, and before a peak event.",
     "avoid": "Do not run an experiment without monitoring, a hypothesis and a way to stop it, and do not start in production.",
     "res": [
      {
       "t": "Principles of Chaos Engineering",
       "by": "principlesofchaos.org",
       "url": "https://principlesofchaos.org/",
       "type": "docs",
       "free": true,
       "why": "The one-page definition: steady state, real-world events, small blast radius."
      },
      {
       "t": "What is AWS Fault Injection Service?",
       "by": "AWS docs",
       "url": "https://docs.aws.amazon.com/fis/latest/userguide/what-is.html",
       "type": "docs",
       "free": true,
       "why": "Experiment templates, actions and stop conditions on AWS."
      },
      {
       "t": "Toxiproxy",
       "by": "Shopify",
       "url": "https://github.com/Shopify/toxiproxy",
       "type": "repo",
       "free": true,
       "why": "A TCP proxy for adding latency, timeouts and resets in tests."
      }
     ]
    },
    {
     "id": "prod-cost",
     "title": "Cost awareness",
     "what": "Every request costs money in compute, storage, data transfer and third-party fees. Knowing the cost per unit (per message, per call minute, per API request) lets you make trade-offs with numbers.",
     "points": [
      "Unit cost = a service's infrastructure and vendor spend / units served. Track it over time, like latency",
      "Tag every resource (service, team, environment) and enforce it, so Cost Explorer and the Cost and Usage Report can split the bill",
      "Common AWS surprises: NAT gateway and cross-AZ data transfer, idle or oversized instances, unattached EBS volumes, logs kept forever",
      "Levers: rightsizing, autoscaling, Savings Plans for the steady base, Spot for interruptible work, Graviton, S3 lifecycle rules",
      "FinOps makes engineers own the cost of what they build, in three phases: Inform, Optimize, Operate"
     ],
     "use": "When designing a feature with a per-unit cost (call recordings, logs per request), and when a monthly bill grows faster than traffic.",
     "avoid": "Do not cut cost below your reliability targets, and do not chase small savings while a large untagged line item stays unexplained.",
     "res": [
      {
       "t": "FinOps Framework",
       "by": "FinOps Foundation",
       "url": "https://www.finops.org/framework/",
       "type": "docs",
       "free": true,
       "why": "Principles, phases and capabilities of cloud cost management."
      },
      {
       "t": "Cost Optimization Pillar",
       "by": "AWS Well-Architected",
       "url": "https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/welcome.html",
       "type": "docs",
       "free": true,
       "why": "AWS design principles and checklists for cost."
      },
      {
       "t": "Best Practices for Tagging AWS Resources",
       "by": "AWS Whitepapers",
       "url": "https://docs.aws.amazon.com/whitepapers/latest/tagging-best-practices/tagging-best-practices.html",
       "type": "docs",
       "free": true,
       "why": "A tagging strategy for cost allocation and ownership."
      }
     ]
    }
   ],
   "vault": [
    "o5",
    "o7",
    "o8"
   ],
   "lab": "Sunday game day, reusing your observability lab. Put Toxiproxy between a small Go service and Postgres. 1) Run a k6 arrival-rate test and find the request rate where p99 crosses 300 ms, then drop to half of it. 2) Have a friend (or a script with a random delay) add 500 ms of latency to the database through Toxiproxy. 3) Act as incident commander: declare a severity, post an update every 15 minutes to a notes file, keep a UTC timeline, and mitigate. 4) Find the cause through dashboard → trace → logs. 5) Write a one-page blameless postmortem with three owned, dated action items.",
   "done": "You can run an incident as commander, trace a latency regression from dashboard to span to profile, and write a postmortem whose action items all have owners and dates."
  },
  {
   "n": 8,
   "id": "ph8",
   "title": "Analytics: ClickHouse and Altinity",
   "short": "ClickHouse",
   "weekends": 1,
   "goal": "Know when a column store beats Postgres, and how ClickHouse runs in production.",
   "topics": [
    {
     "id": "p7-olap",
     "title": "Row stores vs column stores",
     "what": "Analytics reads a few columns across millions of rows. Storing data by column makes that fast and compresses well.",
     "points": [
      "Row store: fast single-row reads and writes (OLTP)",
      "Column store: fast scans and aggregates (OLAP)",
      "Compression and vectorized execution",
      "Write in batches; avoid single-row updates"
     ],
     "res": [
      "ch-docs",
      "ch-learn"
     ]
    },
    {
     "id": "p7-ch",
     "title": "ClickHouse core",
     "what": "An open-source columnar database built for fast analytical queries on very large tables.",
     "points": [
      "MergeTree: each insert creates a sorted part; background merges combine parts",
      "<code>ORDER BY</code> is the sparse primary index, so choose it from your filters",
      "Replacing, Summing, Aggregating and Collapsing MergeTree variants",
      "Materialized views transform data at insert time; insert in batches or use <code>async_insert</code>"
     ],
     "res": [
      "ch-mergetree",
      "ch-learn"
     ]
    },
    {
     "id": "p7-ops",
     "title": "Running ClickHouse",
     "what": "Production ClickHouse means replication, sharding and a coordination service.",
     "points": [
      "ReplicatedMergeTree plus ClickHouse Keeper (a Raft-based ZooKeeper replacement)",
      "Distributed tables spread queries across shards",
      "<code>ON CLUSTER</code> DDL",
      "Ingestion: batch inserts, the Kafka engine, CDC"
     ],
     "res": [
      "ch-keeper",
      "ch-docs"
     ]
    },
    {
     "id": "p7-altinity",
     "title": "Altinity",
     "what": "A company built around ClickHouse: managed hosting, long-term-support builds and open-source tooling.",
     "points": [
      "Altinity.Cloud: managed ClickHouse, in their cloud account or yours",
      "Altinity Kubernetes Operator: runs ClickHouse clusters on Kubernetes (open source)",
      "Altinity Stable builds: ClickHouse releases with longer support",
      "Altinity Knowledge Base: practical how-tos and gotchas",
      "Newer: Project Antalya, open-source builds that query Iceberg and Parquet data lakes"
     ],
     "res": [
      "altinity-kb",
      "altinity-docs",
      "altinity-operator",
      "altinity-site"
     ]
    },
    {
     "id": "p7-obs",
     "title": "ClickHouse for logs and traces",
     "what": "Column stores compress logs well, so many observability tools now keep logs and traces in ClickHouse.",
     "points": [
      "Why: high compression on logs and fast aggregations over time ranges",
      "Examples: SigNoz and other OpenTelemetry backends",
      "Trade-off vs OpenSearch: cheaper aggregations, weaker free-text search",
      "Retention with TTL and partitions"
     ],
     "res": [
      "ch-docs"
     ]
    }
   ],
   "vault": [],
   "lab": "ClickHouse in Docker: generate 50M synthetic call records, compare a calls-per-country-per-hour query against Postgres, try two ORDER BY choices, then add a materialized view.",
   "done": "You can explain MergeTree, pick an ORDER BY for a query pattern, and say when ClickHouse is the wrong tool. Revisit vault questions d1 and k6 after this phase."
  },
  {
   "n": 9,
   "id": "ph9",
   "title": "Infra and platform",
   "short": "Platform",
   "weekends": 2,
   "goal": "Understand how code becomes a running, configured, recoverable service.",
   "topics": [
    {
     "id": "p8-containers",
     "title": "Containers and orchestration",
     "what": "Containers package an app with its dependencies. An orchestrator decides where they run and restarts them when they die.",
     "points": [
      "Images, layers, containers vs VMs; small, reproducible Dockerfiles",
      "ECS: task definitions, services, daemon tasks",
      "Kubernetes: pods, deployments, services, ingress, probes, autoscaling",
      "Operators and CRDs: software that runs other software (the Altinity operator is one)"
     ],
     "res": [
      "docker-start",
      "k8s-tutorials"
     ]
    },
    {
     "id": "p8-config",
     "title": "Config and service discovery",
     "what": "Config lives outside the code, so the same build runs in every environment.",
     "points": [
      "12-factor config; secrets in a secrets manager, never in git",
      "Consul: key-value store, service catalog, health checks (Raft inside)",
      "consul-template renders config files from Consul keys",
      "Render once at boot vs watch and restart on change"
     ],
     "res": [
      "consul-docs",
      "consul-template"
     ]
    },
    {
     "id": "p8-iac",
     "title": "Infrastructure as code",
     "what": "Describe infrastructure in files, review it like code, and rebuild it on demand.",
     "points": [
      "Terraform: providers, resources, modules, plan and apply",
      "Remote state with locking (S3 + DynamoDB)",
      "Drift, imports and pinning module versions",
      "OpenTofu: the open-source fork of Terraform"
     ],
     "res": [
      "tf-tutorials",
      "opentofu"
     ]
    },
    {
     "id": "p8-cicd",
     "title": "CI/CD and safe releases",
     "what": "Ship small changes often, watch them, and make rollback boring.",
     "points": [
      "Build once, promote the same artifact through environments",
      "Canary, blue/green, feature flags, automatic rollback on bad metrics",
      "Database migrations as their own step: expand first, contract later",
      "Feature flags need owners and cleanup dates"
     ],
     "res": [
      "sre-book"
     ]
    },
    {
     "id": "p8-cloud",
     "title": "Cloud building blocks (AWS)",
     "what": "Most designs are drawn with the same dozen managed services.",
     "points": [
      "VPC, subnets, security groups; ALB (L7) vs NLB (L4)",
      "EC2, autoscaling groups, ECS",
      "S3, SQS, SNS, RDS/Aurora, ElastiCache",
      "IAM roles and least privilege"
     ],
     "res": [
      "aws-well-arch"
     ]
    }
   ],
   "vault": [
    "r8",
    "r9",
    "e8"
   ],
   "lab": "Write Terraform for an S3 bucket and an SQS queue against LocalStack: plan, apply, change, destroy. Then trace one config key from its source of truth to the file your service actually reads.",
   "done": "You can trace a commit from merge to running task, and explain how config reaches a service."
  },
  {
   "n": 10,
   "id": "ph10",
   "title": "APIs, boundaries and architecture",
   "short": "Architecture",
   "weekends": 2,
   "goal": "Split systems along the right seams, and change contracts without breaking anyone.",
   "topics": [
    {
     "id": "p9-api",
     "title": "API design",
     "what": "A public API is a promise you keep for years. Make it predictable, retry-safe and pageable.",
     "points": [
      "Resources, verbs and status codes; one consistent error shape",
      "Idempotency keys on POST; cursor pagination; filtering",
      "gRPC for typed internal calls",
      "Webhooks: signed payloads, retries with backoff, idempotent receivers"
     ],
     "res": [
      "stripe-idem",
      "brandur-idem"
     ]
    },
    {
     "id": "p9-evolve",
     "title": "Evolving and versioning APIs",
     "what": "Prefer additive changes. Version only when you truly have to break something.",
     "points": [
      "Additive changes and tolerant readers",
      "Versioning in the URL vs a header; old SDK versions in the wild",
      "Deprecation: announce, measure usage, send a <code>Sunset</code> header, then remove",
      "Contract tests between services"
     ],
     "res": [
      "azure-patterns"
     ]
    },
    {
     "id": "p9-boundaries",
     "title": "Service boundaries",
     "what": "Split by business capability and data ownership, not by technical layer.",
     "points": [
      "Monolith vs modular monolith vs microservices, and the cost of each",
      "Bounded contexts; each service owns its data",
      "Shared databases create hidden coupling",
      "Conway's law: systems mirror team structure"
     ],
     "res": [
      "ms-patterns"
     ]
    },
    {
     "id": "p9-gateway",
     "title": "Gateways, BFFs and sidecars",
     "what": "Put cross-cutting concerns at the edge so services stay simple.",
     "points": [
      "API gateway: auth, rate limits, routing, request shaping",
      "Backend for frontend (BFF): one API per client type",
      "Sidecars and service mesh (Envoy): retries, mTLS, telemetry",
      "Anti-corruption layer in front of legacy or third-party systems"
     ],
     "res": [
      "ms-gateway",
      "azure-patterns"
     ]
    },
    {
     "id": "p9-arch",
     "title": "Architecture patterns",
     "what": "Named shapes for organizing code and services. Use one only when it removes a real pain.",
     "points": [
      "Layered and hexagonal (ports and adapters) inside a service",
      "Event-driven architecture between services",
      "CQRS: separate write and read models",
      "Event sourcing (store events, derive state); strangler fig for migrations"
     ],
     "res": [
      "fowler-cqrs",
      "fowler-es",
      "fowler-strangler"
     ]
    },
    {
     "id": "p9-tenancy",
     "title": "Multi-tenancy",
     "what": "Many customers share one system. Keep their data apart and stop one of them from starving the rest.",
     "points": [
      "Isolation levels: row (tenant_id), schema, database or cluster per tenant",
      "Per-tenant quotas and rate limits",
      "Noisy neighbors: bulkheads, shuffle sharding",
      "Tenant-aware routing, sub-accounts, data residency"
     ],
     "res": [
      "aws-shuffle"
     ]
    }
   ],
   "vault": [
    "p1",
    "p2",
    "p3",
    "p4",
    "p5",
    "p6",
    "p7",
    "p8",
    "c1",
    "c9",
    "e5",
    "e6",
    "e9"
   ],
   "lab": "Write an OpenAPI spec for a send-message API with idempotency keys, cursor pagination and a status webhook. Then plan a breaking change as expand, migrate clients, contract, sunset.",
   "done": "You can justify where you would draw service boundaries, and ship a breaking change without breaking a client."
  },
  {
   "n": 11,
   "id": "ph11",
   "title": "HLD interview practice",
   "short": "HLD practice",
   "weekends": 2,
   "goal": "Run a 45-60 minute design interview calmly, with a repeatable structure.",
   "topics": [
    {
     "id": "p10-framework",
     "title": "The framework",
     "what": "Requirements, estimates, API, data model, high-level design, deep dives, wrap-up. The HLD and LLD tab has the time boxes.",
     "points": [
      "Clarify functional and non-functional requirements first",
      "Estimate only what changes the design",
      "Draw the request path, then zoom into the hardest part",
      "Close with bottlenecks, failure modes and what you would monitor"
     ],
     "res": [
      "hello-interview",
      "bbg-sdi"
     ]
    },
    {
     "id": "p10-set1",
     "title": "Classic problems, set 1",
     "what": "The five that teach the most building blocks.",
     "points": [
      "URL shortener",
      "Rate limiter",
      "Notification system",
      "Chat (WhatsApp)",
      "News feed"
     ],
     "res": [
      "bbg-sdi",
      "hello-interview"
     ]
    },
    {
     "id": "p10-set2",
     "title": "Classic problems, set 2",
     "what": "Harder ones with real trade-offs.",
     "points": [
      "Typeahead / autocomplete",
      "Distributed cache or key-value store",
      "Job scheduler",
      "Payment system",
      "Ride sharing",
      "Metrics and logging system"
     ],
     "res": [
      "bbg-sdi",
      "hello-interview",
      "sdprimer"
     ]
    },
    {
     "id": "p10-own",
     "title": "Problems from your own domain",
     "what": "Interviewers love a candidate who can go deep on something they have actually run. Prepare these from your own domain.",
     "points": [
      "SMS gateway with carrier routing and failover",
      "OTP service with rate limits and expiry",
      "Webhook delivery system with retries and ordering",
      "Call detail records pipeline into analytics",
      "AI support agent with tools, limits and escalation"
     ],
     "res": []
    },
    {
     "id": "p10-mocks",
     "title": "Mocks",
     "what": "Knowledge becomes a skill only under a clock.",
     "points": [
      "One timed mock per weekend in this phase",
      "Record yourself and listen for silence and hand-waving",
      "Ask Claude for a mock HLD interview and a score",
      "Keep a list of follow-ups you could not answer"
     ],
     "res": []
    }
   ],
   "vault": [
    "e1",
    "e2",
    "e3",
    "e4",
    "e7"
   ],
   "lab": "Mock loop: pick a problem, set a 45-minute timer, talk out loud, then paste your design to Claude for a score and three follow-ups.",
   "done": "You can do three different problems end to end in 45 minutes each, with clear trade-offs."
  },
  {
   "n": 12,
   "id": "ph12",
   "title": "Staff-level judgment",
   "short": "Judgment",
   "weekends": 1,
   "goal": "Show judgment: simplicity, cost, ownership and clear communication.",
   "topics": [
    {
     "id": "p11-docs",
     "title": "Design docs and ADRs",
     "what": "A design that is not written down cannot be reviewed or remembered.",
     "points": [
      "Context, goals and non-goals, options considered, decision, risks, rollout",
      "Architecture decision records: one decision per page",
      "Write for the engineer who joins in two years",
      "Diagrams with a legend and a request walk-through"
     ],
     "res": []
    },
    {
     "id": "p11-review",
     "title": "Reviews and trade-off conversations",
     "what": "Reviewing designs well is a senior skill, and interviewers probe it directly.",
     "points": [
      "Ask about failure modes, data ownership, migration and rollback",
      "Separate blocking issues from preferences",
      "Defend trade-offs with numbers and the alternatives you rejected",
      "Disagree and commit, in writing"
     ],
     "res": []
    },
    {
     "id": "p11-simple",
     "title": "Simplicity and scope",
     "what": "The best designs remove moving parts.",
     "points": [
      "Over-engineered: abstractions with one user, scale nobody asked for",
      "Under-engineered: no timeouts, no idempotency, no migration plan",
      "Boring technology you can operate beats clever technology",
      "Decide what not to build, and write it down"
     ],
     "res": []
    },
    {
     "id": "p11-own",
     "title": "Ownership and blast radius",
     "what": "Design so mistakes are cheap and any on-call engineer can fix things.",
     "points": [
      "Small, reversible changes behind flags",
      "Runbooks, dashboards and alerts owned by the team",
      "Limit blast radius: cells, shards, per-tenant limits",
      "Systems that do not need heroes"
     ],
     "res": [
      "aws-shuffle"
     ]
    }
   ],
   "vault": [
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "h7",
    "h8",
    "h9",
    "h10",
    "h11"
   ],
   "lab": "Write a two-page design doc for one real improvement you would make at work, and ask Claude to review it like a staff engineer.",
   "done": "You can explain a design to a junior, defend it to a skeptic, and say what you chose not to build."
  }
 ],
 "lld": {
  "title": "LLD side track (weekdays)",
  "intro": "Runs alongside the main track on the weekdays you have time. Machine-coding rounds (60-120 minutes of working code) are the real filter at many Indian product companies, so this track matters as much as HLD.",
  "steps": [
   {
    "id": "lld-oop",
    "title": "OOP and SOLID, the Go and Python way",
    "points": [
     "Encapsulation, composition over inheritance, interfaces",
     "SOLID with Go idioms: small interfaces, accept interfaces and return structs",
     "Dependency injection without a framework"
    ],
    "res": [
     "solid-go"
    ]
   },
   {
    "id": "lld-create",
    "title": "Creational and structural patterns",
    "points": [
     "Factory, Builder (functional options in Go), Singleton (sync.Once) and why to avoid it",
     "Adapter, Decorator (HTTP middleware), Facade, Proxy, Composite"
    ],
    "res": [
     "refactoring-guru",
     "okhravi"
    ]
   },
   {
    "id": "lld-behave",
    "title": "Behavioral patterns",
    "points": [
     "Strategy, Observer, State, Command, Chain of Responsibility, Template Method",
     "Spot them in real code: HTTP middleware is a chain; a call lifecycle is a state machine"
    ],
    "res": [
     "refactoring-guru",
     "okhravi"
    ]
   },
   {
    "id": "lld-conc",
    "title": "Concurrency for machine coding",
    "points": [
     "Mutex vs channels, worker pools, context cancellation",
     "Thread-safe caches, rate limiters and queues",
     "Races and deadlocks; <code>go test -race</code>"
    ],
    "res": [
     "go-pipelines"
    ]
   },
   {
    "id": "lld-katas",
    "title": "Katas: one 90-minute problem a week",
    "points": [
     "Timebox it, make it run, then refactor",
     "Compare with a reference solution only after you finish",
     "Ask Claude to grade it against the rubric below"
    ],
    "res": [
     "awesome-lld",
     "cc-lld",
     "workat"
    ]
   }
  ],
  "katas": [
   "LRU cache",
   "Rate limiter (token bucket)",
   "Parking lot",
   "Splitwise",
   "Snake and ladder",
   "Elevator system",
   "BookMyShow (seat locking)",
   "In-memory key-value store with TTL",
   "Pub/sub message queue",
   "Logger framework",
   "Vending machine",
   "SMS dispatcher with retries and per-account limits"
  ],
  "rubric": [
   "Runs end to end and handles the main flow",
   "Clear classes with one job each, named after the domain",
   "Easy to extend where requirements vary (Strategy, Factory)",
   "Handles bad input, and concurrency wherever state is shared",
   "A driver or tests that prove it works"
  ]
 },
 "design": {
  "compare": [
   [
    "Zoom level",
    "The whole system: services, stores, queues, caches",
    "Inside one service: classes, interfaces, state"
   ],
   [
    "What you produce",
    "A box-and-arrow diagram plus the trade-offs",
    "A class design plus working code"
   ],
   [
    "Interview format",
    "45-60 minute discussion at a whiteboard",
    "60-120 minute machine-coding round, or a 45-minute class design"
   ],
   [
    "Scored on",
    "Requirements, scale, trade-offs, failure handling, communication",
    "Working code, clean structure, extensibility, edge cases, tests"
   ],
   [
    "Typical prompt",
    "Design WhatsApp. Design a rate limiter service.",
    "Design Splitwise. Build a parking lot. Implement an LRU cache."
   ]
  ],
  "hld": [
   [
    "Clarify requirements",
    "5 min",
    "Three to five core features, the users, scale, latency and availability targets, consistency needs. Say what is out of scope."
   ],
   [
    "Estimate",
    "3-5 min",
    "Average and peak QPS, storage per year, bandwidth. Only the numbers that change the design."
   ],
   [
    "API",
    "5 min",
    "Three to six endpoints with their key parameters: idempotency keys, pagination cursors, auth."
   ],
   [
    "Data model",
    "5 min",
    "Entities, keys and relationships, and which store holds each, with the reason."
   ],
   [
    "High-level design",
    "10 min",
    "Client, edge, services, stores, queues. Walk one request through it end to end."
   ],
   [
    "Deep dives",
    "10-15 min",
    "The two or three hardest parts: hot keys, fan-out, consistency, failure handling. This is where you win or lose."
   ],
   [
    "Wrap up",
    "3 min",
    "Bottlenecks, failure modes, what you would monitor, and what you would build next."
   ]
  ],
  "lldSteps": [
   [
    "Clarify",
    "5-10 min",
    "List features and constraints, and agree on what to skip. Write them at the top of your file."
   ],
   [
    "Entities",
    "10 min",
    "Nouns become types, verbs become methods. Sketch the relationships."
   ],
   [
    "Interfaces first",
    "10 min",
    "Define interfaces for the parts that vary (pricing, routing, strategy points)."
   ],
   [
    "Core flow",
    "30-40 min",
    "Implement the happy path end to end and make it run from a main or a test."
   ],
   [
    "Extend",
    "10 min",
    "Add patterns only where requirements vary. Keep the rest plain."
   ],
   [
    "Edge cases and concurrency",
    "10 min",
    "Validation, errors, and locks wherever state is shared."
   ],
   [
    "Prove it",
    "5-10 min",
    "A driver or unit tests that show it works. Then talk through what you would improve."
   ]
  ],
  "connect": "HLD picks the boxes; LLD builds one box well. Deep dives in an HLD round often zoom into LLD (the rate limiter's algorithm, the cache's eviction), and a strong LLD answer mentions the HLD context (what happens with two instances?).",
  "numbers": [
   [
    "Main memory reference",
    "~100 ns"
   ],
   [
    "Read 1 MB sequentially from memory",
    "~3 µs"
   ],
   [
    "SSD random read",
    "~16 µs"
   ],
   [
    "Read 1 MB sequentially from SSD",
    "~50 µs"
   ],
   [
    "Round trip inside one data center",
    "~0.5 ms"
   ],
   [
    "Redis GET over the network, same zone",
    "~0.2-1 ms"
   ],
   [
    "Simple indexed Postgres query",
    "~1-5 ms"
   ],
   [
    "Round trip India to US East",
    "~200 ms"
   ],
   [
    "Requests per day to per second",
    "1M/day is about 12/s; 100M/day is about 1,200/s"
   ],
   [
    "Storage per year",
    "1 KB x 1M items/day x 365 is about 365 GB"
   ],
   [
    "Downtime allowed per month",
    "99.9% is about 43 min; 99.99% is about 4.3 min"
   ]
  ]
 },
 "patterns": {
  "families": [
   [
    "Code (GoF)",
    "How do I structure classes so change is cheap?",
    "Strategy, Factory, Builder, Observer, Decorator, Adapter, State, Command",
    "LLD and machine coding"
   ],
   [
    "Application architecture",
    "How is one service organized?",
    "Layered, Hexagonal (ports and adapters), Clean, Modular monolith",
    "LLD and HLD"
   ],
   [
    "Integration",
    "How do services talk?",
    "API gateway, BFF, Pub/sub, Competing consumers, Request-reply, Webhooks",
    "HLD"
   ],
   [
    "Data",
    "How is data stored, split and kept in sync?",
    "Replication, Sharding, CQRS, Event sourcing, CDC, Materialized view, Cache-aside",
    "HLD"
   ],
   [
    "Distributed correctness",
    "How do we stay correct across machines?",
    "Saga, Outbox and inbox, Idempotency key, Leader election, Fencing token, Quorum",
    "HLD deep dives"
   ],
   [
    "Resilience",
    "How do we survive failure?",
    "Timeout, Retry with backoff and jitter, Circuit breaker, Bulkhead, Rate limit, Load shedding, Backpressure",
    "HLD deep dives"
   ],
   [
    "Change and migration",
    "How do we change a live system safely?",
    "Strangler fig, Expand/contract, Feature flags, Canary, Blue/green, Dual writes with backfill",
    "HLD and senior rounds"
   ]
  ],
  "finder": [
   [
    "Behavior varies by type or config, and the if/else chain keeps growing",
    "Strategy (or a map of handlers)",
    "Code"
   ],
   [
    "Creating an object depends on input or is complicated",
    "Factory, Builder",
    "Code"
   ],
   [
    "A constructor has many optional parameters",
    "Builder (functional options in Go)",
    "Code"
   ],
   [
    "One event, many independent reactions inside one app",
    "Observer",
    "Code"
   ],
   [
    "Add logging, auth, caching or metrics around something without editing it",
    "Decorator (middleware)",
    "Code"
   ],
   [
    "A third-party API has a different shape from what your code wants",
    "Adapter; at service scale, an anti-corruption layer",
    "Code"
   ],
   [
    "Callers need one simple entry into a messy subsystem",
    "Facade",
    "Code"
   ],
   [
    "Behavior depends on status, with many transitions",
    "State pattern or an explicit state machine",
    "Code"
   ],
   [
    "Operations must be queued, retried, logged or undone",
    "Command",
    "Code"
   ],
   [
    "A request passes through a series of checks",
    "Chain of responsibility (middleware pipeline)",
    "Code"
   ],
   [
    "One event, many reactions across services",
    "Pub/sub (SNS, Kafka topics)",
    "Integration"
   ],
   [
    "Web and mobile need different API shapes",
    "Backend for frontend (BFF)",
    "Integration"
   ],
   [
    "Auth, TLS and rate limits repeated in every service",
    "API gateway",
    "Integration"
   ],
   [
    "Network concerns (mTLS, retries, telemetry) in every service",
    "Sidecar or service mesh",
    "Integration"
   ],
   [
    "A client retries a POST after a timeout",
    "Idempotency key",
    "Correctness"
   ],
   [
    "A DB write and a message publish must both happen",
    "Transactional outbox",
    "Correctness"
   ],
   [
    "Consumers get at-least-once delivery",
    "Idempotent consumer (inbox or dedup table)",
    "Correctness"
   ],
   [
    "One business transaction spans several services",
    "Saga (orchestrated for complex flows)",
    "Correctness"
   ],
   [
    "Only one instance may run a job at a time",
    "Leader election with leases, plus fencing tokens",
    "Correctness"
   ],
   [
    "Reads vastly outnumber writes and need a different shape",
    "Read replicas, cache-aside, or CQRS",
    "Data"
   ],
   [
    "You need a full audit history and replay",
    "Event sourcing (only if you truly need it)",
    "Data"
   ],
   [
    "Search or analytics stores must follow the main database",
    "Change data capture (CDC)",
    "Data"
   ],
   [
    "Spread keys over nodes without reshuffling everything when one is added",
    "Consistent hashing",
    "Data"
   ],
   [
    "A slow or flaky downstream dependency",
    "Timeout, retry with backoff and jitter, circuit breaker",
    "Resilience"
   ],
   [
    "One tenant or feature starves the others",
    "Bulkhead, per-tenant rate limits, shuffle sharding",
    "Resilience"
   ],
   [
    "Traffic spikes beyond capacity",
    "Queue-based load leveling, load shedding, backpressure",
    "Resilience"
   ],
   [
    "Heavy computation over many items",
    "Fan-out/fan-in (scatter-gather) with a work queue",
    "Resilience"
   ],
   [
    "Replacing a legacy system without a big bang",
    "Strangler fig",
    "Change"
   ],
   [
    "Renaming a column or field with zero downtime",
    "Expand/contract (parallel change)",
    "Change"
   ],
   [
    "A risky feature or algorithm change",
    "Feature flag plus canary release",
    "Change"
   ]
  ],
  "gof": [
   {
    "group": "Creational",
    "items": [
     [
      "Factory Method",
      "Let a function or subclass decide which concrete type to create.",
      "NewNotifier(channel) returns an SMS, email or WhatsApp notifier.",
      true
     ],
     [
      "Abstract Factory",
      "Create families of related objects that must match.",
      "A cloud kit that returns matching storage and queue clients.",
      false
     ],
     [
      "Builder",
      "Build a complex object step by step.",
      "A message with optional media, callback URL and schedule. In Go: functional options.",
      true
     ],
     [
      "Singleton",
      "Exactly one shared instance.",
      "A config or logger, created with sync.Once. Prefer passing dependencies in; singletons hide state and hurt tests.",
      true
     ],
     [
      "Prototype",
      "Create new objects by copying an existing one.",
      "Clone a campaign template. Rare in Go.",
      false
     ]
    ]
   },
   {
    "group": "Structural",
    "items": [
     [
      "Adapter",
      "Make one interface look like another.",
      "Wrap each carrier's SMS API behind one Carrier interface.",
      true
     ],
     [
      "Decorator",
      "Add behavior by wrapping, without changing the original.",
      "HTTP middleware for logging, auth and metrics.",
      true
     ],
     [
      "Facade",
      "One simple front for a complicated subsystem.",
      "A billing facade over pricing, balance and invoices.",
      false
     ],
     [
      "Proxy",
      "A stand-in that controls access to the real object.",
      "A caching or rate-limited client; lazy loading.",
      false
     ],
     [
      "Composite",
      "Treat a tree of objects and single objects the same way.",
      "An IVR menu tree; folders and files.",
      false
     ],
     [
      "Bridge",
      "Split an abstraction from its implementation so both can vary.",
      "Notification types x delivery channels.",
      false
     ],
     [
      "Flyweight",
      "Share common state across many small objects.",
      "Share country and carrier metadata across millions of number records.",
      false
     ]
    ]
   },
   {
    "group": "Behavioral",
    "items": [
     [
      "Strategy",
      "Swap algorithms behind one interface.",
      "Routing strategy: least cost vs best quality; the rate-limit algorithm.",
      true
     ],
     [
      "Observer",
      "Notify subscribers when something changes.",
      "Event listeners inside one service.",
      true
     ],
     [
      "State",
      "Behavior changes with internal state.",
      "Call lifecycle: ringing, in progress, completed; a vending machine.",
      true
     ],
     [
      "Command",
      "Wrap a request as an object.",
      "Queued jobs, undo, retries, audit logs.",
      true
     ],
     [
      "Chain of Responsibility",
      "Pass a request along handlers until one handles it.",
      "Message validation pipeline; middleware.",
      true
     ],
     [
      "Template Method",
      "A fixed skeleton with steps you can override.",
      "A report or ETL job with pluggable steps. In Go: pass functions.",
      false
     ],
     [
      "Iterator",
      "Walk a collection without exposing how it is stored.",
      "An SDK iterator over paginated API results.",
      false
     ],
     [
      "Mediator",
      "One object coordinates how others interact.",
      "A chat room; a conference bridge coordinating call legs.",
      false
     ],
     [
      "Memento",
      "Capture and restore state.",
      "Undo in an editor; draft snapshots.",
      false
     ],
     [
      "Visitor",
      "Add operations to a structure without changing its classes.",
      "Walking an AST; exporting a diagram to several formats.",
      false
     ],
     [
      "Interpreter",
      "Evaluate sentences in a small language.",
      "A filter or rules engine DSL.",
      false
     ]
    ]
   }
  ],
  "solid": [
   [
    "Single responsibility",
    "One reason to change per type or module."
   ],
   [
    "Open/closed",
    "Add behavior by adding code (a new Strategy), not by editing old code."
   ],
   [
    "Liskov substitution",
    "Anything that implements an interface must honor its contract."
   ],
   [
    "Interface segregation",
    "Small, focused interfaces, like Go's io.Reader."
   ],
   [
    "Dependency inversion",
    "Depend on interfaces and inject dependencies."
   ]
  ],
  "anti": [
   "Distributed monolith: services that must deploy together",
   "A database shared by several services",
   "Retries at every layer",
   "A cache with no TTL and no invalidation plan",
   "Two-phase commit across microservices",
   "Event sourcing for plain CRUD",
   "A singleton as hidden global state",
   "Microservices before you have the team or the traffic for them"
  ]
 },
 "toolGroups": [
  {
   "name": "Metrics and alerting",
   "tools": [
    {
     "name": "Prometheus",
     "what": "Open-source metrics system. Scrapes numeric time series from services, stores them, and evaluates PromQL queries and alert rules.",
     "use": "Service and infrastructure health, SLOs, alerts. Not for logs, per-request detail, or numbers that must be exact (like billing).",
     "res": [
      "prom-overview"
     ]
    },
    {
     "name": "Pushgateway",
     "what": "A holding area that batch jobs push metrics to, so Prometheus can still collect them after the job exits.",
     "use": "Short-lived jobs. It never expires a series on its own, and you lose the \"is this target up\" signal.",
     "res": [
      "prom-pushing"
     ]
    },
    {
     "name": "Alertmanager",
     "what": "Receives alerts from Prometheus, groups and deduplicates them, and routes them to Slack, PagerDuty or Opsgenie.",
     "use": "Routing, silences, and inhibition (one big alert mutes the smaller alerts it causes).",
     "res": [
      "alertmanager"
     ]
    },
    {
     "name": "Thanos, Mimir, VictoriaMetrics",
     "what": "Long-term, horizontally scalable storage and global querying for Prometheus data.",
     "use": "When one Prometheus cannot hold the retention, or you need one view across clusters.",
     "res": [
      "thanos",
      "mimir",
      "victoriametrics"
     ]
    }
   ]
  },
  {
   "name": "Dashboards",
   "tools": [
    {
     "name": "Grafana",
     "what": "Open-source dashboards and alerting. Queries Prometheus, ClickHouse, OpenSearch, Loki and more; stores no metrics itself.",
     "use": "Incident dashboards, SLO views, ad hoc exploration.",
     "res": [
      "grafana-fund",
      "grafana-docs"
     ]
    }
   ]
  },
  {
   "name": "Logs",
   "tools": [
    {
     "name": "OpenSearch and Elasticsearch",
     "what": "Search engines built on an inverted index, used for full-text search and log search. OpenSearch is the Apache-2.0 fork AWS started in 2021, after Elastic changed Elasticsearch's license.",
     "use": "Searching logs by any field or phrase; product search.",
     "res": [
      "opensearch-docs"
     ]
    },
    {
     "name": "OpenSearch Dashboards and Kibana",
     "what": "The web UIs for searching and charting what is stored in OpenSearch or Elasticsearch.",
     "use": "Log search during incidents; saved queries.",
     "res": []
    },
    {
     "name": "Loki",
     "what": "Grafana's log store. It indexes only labels, not the full text, which keeps it cheap; you filter by labels, then grep.",
     "use": "Cheap log storage next to Grafana.",
     "res": [
      "loki-docs"
     ]
    },
    {
     "name": "Filebeat, Fluent Bit, Vector",
     "what": "Log shippers: they tail container or file logs and forward them to a store.",
     "use": "Getting logs off hosts reliably.",
     "res": []
    }
   ]
  },
  {
   "name": "Traces and errors",
   "tools": [
    {
     "name": "OpenTelemetry",
     "what": "The vendor-neutral standard and SDKs for traces, metrics and logs, plus a Collector that receives, processes and exports them. It is not a backend.",
     "use": "Instrument once, send anywhere; follow a request across services.",
     "res": [
      "otel-primer",
      "otel-docs"
     ]
    },
    {
     "name": "Jaeger and Tempo",
     "what": "Trace backends. They store spans and show one request's timeline across services.",
     "use": "Finding which hop made a request slow.",
     "res": [
      "jaeger-docs"
     ]
    },
    {
     "name": "Sentry",
     "what": "Error tracking: groups exceptions with stack traces, release info and alerting.",
     "use": "Seeing new crashes and regressions fast.",
     "res": [
      "sentry-docs"
     ]
    }
   ]
  },
  {
   "name": "Analytics databases",
   "tools": [
    {
     "name": "ClickHouse",
     "what": "Open-source columnar database for fast aggregations over billions of rows.",
     "use": "Analytics, dashboards over events, logs and traces at scale.",
     "res": [
      "ch-docs",
      "ch-learn"
     ]
    },
    {
     "name": "Altinity",
     "what": "A company built around ClickHouse: Altinity.Cloud (managed ClickHouse), the open-source Kubernetes operator, Stable builds and a Knowledge Base.",
     "use": "Running ClickHouse without building a database team.",
     "res": [
      "altinity-site",
      "altinity-kb",
      "altinity-docs",
      "altinity-operator"
     ]
    },
    {
     "name": "ClickHouse Keeper",
     "what": "ClickHouse's Raft-based replacement for ZooKeeper. It speaks the ZooKeeper client protocol and handles replication metadata and ON CLUSTER DDL.",
     "use": "Coordinating replicated ClickHouse tables.",
     "res": [
      "ch-keeper"
     ]
    }
   ]
  },
  {
   "name": "Operational databases",
   "tools": [
    {
     "name": "PostgreSQL and Aurora",
     "what": "The default relational database. Aurora is AWS's managed, Postgres-compatible engine with shared storage.",
     "use": "Transactions, joins, flexible queries.",
     "res": [
      "pg-mvcc"
     ]
    },
    {
     "name": "PgBouncer",
     "what": "A connection pooler: many app connections share a few database connections.",
     "use": "When many service instances would otherwise exhaust database connections.",
     "res": []
    },
    {
     "name": "Redis",
     "what": "In-memory data structure server: cache, counters, locks, queues and streams.",
     "use": "Anything that must be fast and can be rebuilt or tolerate some loss.",
     "res": [
      "redis-types"
     ]
    },
    {
     "name": "DynamoDB",
     "what": "AWS managed key-value and document store with steady low latency at any scale.",
     "use": "Known access patterns by partition key; design keys first.",
     "res": []
    },
    {
     "name": "Cassandra and ScyllaDB",
     "what": "Leaderless wide-column stores built for heavy writes, with tunable consistency.",
     "use": "Huge write volumes read by partition key.",
     "res": []
    }
   ]
  },
  {
   "name": "Messaging and jobs",
   "tools": [
    {
     "name": "Kafka",
     "what": "A distributed append-only log. Producers write to partitioned topics; consumer groups read at their own offsets and can replay. Since 4.0 it runs without ZooKeeper (KRaft), and 4.2 added share groups for queue-style consumption.",
     "use": "High-volume event streams, CDC, many independent consumers.",
     "res": [
      "kafka-intro",
      "kafka-design",
      "confluent-101"
     ]
    },
    {
     "name": "Amazon SQS",
     "what": "Managed queue. A message is hidden while a worker processes it (visibility timeout) and deleted on success; a redrive policy moves repeat failures to a DLQ. Standard queues are at-least-once; FIFO queues add per-group ordering and a 5-minute dedup window.",
     "use": "Background jobs and decoupling with at-least-once delivery.",
     "res": [
      "sqs-docs"
     ]
    },
    {
     "name": "Amazon SNS",
     "what": "Managed pub/sub: one publish delivered to many subscribers (queues, HTTP, email, mobile push).",
     "use": "Fan-out and notifications.",
     "res": []
    },
    {
     "name": "RabbitMQ",
     "what": "A message broker with exchanges and queues and flexible routing.",
     "use": "Task queues with rich routing rules.",
     "res": []
    },
    {
     "name": "Celery",
     "what": "Python task queue: workers pull jobs from a broker and run them, with retries.",
     "use": "Background work in Python services.",
     "res": []
    },
    {
     "name": "Temporal",
     "what": "Durable workflow engine: you write multi-step workflows as code, and it persists state and retries steps.",
     "use": "Sagas and long-running business processes.",
     "res": [
      "temporal-saga"
     ]
    }
   ]
  },
  {
   "name": "Coordination and config",
   "tools": [
    {
     "name": "Consul",
     "what": "Service catalog, health checks and key-value config, replicated with Raft.",
     "use": "Config and service discovery.",
     "res": [
      "consul-docs"
     ]
    },
    {
     "name": "consul-template",
     "what": "Renders config files from Consul keys, once at boot or on every change.",
     "use": "Feeding config into apps that read files.",
     "res": [
      "consul-template"
     ]
    },
    {
     "name": "etcd",
     "what": "A Raft-based key-value store for small, critical data. Kubernetes keeps all cluster state in it.",
     "use": "Config, leader election, locks.",
     "res": [
      "raft-anim"
     ]
    },
    {
     "name": "ZooKeeper",
     "what": "An older coordination service (ZAB protocol), used by many Hadoop-era systems and by Kafka before KRaft.",
     "use": "Mostly legacy now; ClickHouse Keeper and etcd replace it.",
     "res": []
    },
    {
     "name": "Secrets managers",
     "what": "AWS Secrets Manager and HashiCorp Vault store and rotate credentials outside code and config.",
     "use": "Every password, token and key.",
     "res": []
    }
   ]
  },
  {
   "name": "Infra and delivery",
   "tools": [
    {
     "name": "Docker",
     "what": "Packages an app and its dependencies into an image that runs the same everywhere.",
     "use": "Local stacks, CI, production images.",
     "res": [
      "docker-start"
     ]
    },
    {
     "name": "Amazon ECS",
     "what": "AWS's container orchestrator: task definitions, services and daemon tasks.",
     "use": "Running containers on AWS without Kubernetes.",
     "res": []
    },
    {
     "name": "Kubernetes",
     "what": "Container orchestrator that schedules pods, restarts them, scales them and exposes them as services.",
     "use": "The industry default for container platforms.",
     "res": [
      "k8s-tutorials"
     ]
    },
    {
     "name": "Helm",
     "what": "Package manager for Kubernetes apps, using templated manifests.",
     "use": "Installing and upgrading apps on Kubernetes.",
     "res": [
      "helm-quick"
     ]
    },
    {
     "name": "Terraform and OpenTofu",
     "what": "Infrastructure as code: declare resources, review a plan, apply it. OpenTofu is the open-source fork.",
     "use": "All cloud infrastructure.",
     "res": [
      "tf-tutorials",
      "opentofu"
     ]
    },
    {
     "name": "Jenkins",
     "what": "A CI/CD server that runs pipelines defined in Jenkinsfiles.",
     "use": "Build, test and deploy.",
     "res": []
    },
    {
     "name": "LocalStack",
     "what": "Emulates AWS services (SQS, S3, SNS and more) on your laptop.",
     "use": "Labs and integration tests without an AWS bill.",
     "res": [
      "localstack"
     ]
    }
   ]
  },
  {
   "name": "Edge and realtime",
   "tools": [
    {
     "name": "AWS ALB and NLB",
     "what": "Managed load balancers. ALB routes HTTP (L7) by host and path; NLB forwards TCP/UDP (L4) with very low overhead.",
     "use": "The front door for services.",
     "res": [
      "haproxy-l4l7"
     ]
    },
    {
     "name": "Nginx, HAProxy, Envoy",
     "what": "Reverse proxies and load balancers; Envoy is the usual service-mesh sidecar.",
     "use": "TLS termination, routing, retries at the edge.",
     "res": []
    },
    {
     "name": "CDN",
     "what": "Caches content at edge locations near users (CloudFront, Cloudflare).",
     "use": "Static assets and cacheable API responses.",
     "res": [
      "webdev-cdn"
     ]
    },
    {
     "name": "PubNub",
     "what": "Hosted realtime messaging over persistent connections.",
     "use": "Pushing live updates to browsers and apps.",
     "res": []
    }
   ]
  },
  {
   "name": "Testing and resilience",
   "tools": [
    {
     "name": "Toxiproxy",
     "what": "A TCP proxy that injects latency, errors and dropped connections.",
     "use": "Testing how clients behave when a dependency misbehaves.",
     "res": [
      "toxiproxy"
     ]
    },
    {
     "name": "vegeta, hey, k6",
     "what": "Load generators that measure throughput and latency percentiles.",
     "use": "Finding limits before users do.",
     "res": [
      "vegeta"
     ]
    },
    {
     "name": "Chaos tools",
     "what": "Chaos Mesh, AWS Fault Injection Service and similar tools run controlled failure experiments.",
     "use": "Proving that failover and degradation actually work.",
     "res": []
    }
   ]
  },
  {
   "name": "Profiling and on-call",
   "tools": [
    {
     "name": "pprof and py-spy",
     "what": "Profilers. Go's pprof samples CPU, heap, goroutines and locks; py-spy samples a running Python process without code changes. Both give flame graphs.",
     "use": "Finding where time or memory actually goes, before you optimize anything.",
     "avoid": "Exposing the pprof HTTP endpoint publicly; it leaks internals and lets anyone burn your CPU.",
     "tradeoff": "Sampling adds a little overhead, and one profile can mislead: compare profiles taken under realistic load.",
     "res": [
      "go-pprof"
     ]
    },
    {
     "name": "Grafana Pyroscope and Parca",
     "what": "Continuous profiling: always-on, low-overhead profiles stored over time, so you can compare before and after a deploy.",
     "use": "Catching CPU or memory regressions in production that never show up locally.",
     "avoid": "Small services with no performance problems; the agents and storage are overhead you do not need yet.",
     "tradeoff": "A little CPU and storage all the time; eBPF-based agents need kernel access.",
     "res": [
      "pyroscope",
      "parca"
     ]
    },
    {
     "name": "blackbox_exporter",
     "what": "A Prometheus exporter that probes endpoints from the outside: HTTP, TCP, ICMP and DNS checks, with latency and TLS certificate expiry.",
     "use": "Uptime checks and certificate-expiry alerts that see what users see.",
     "avoid": "Using it as your only signal: a probe tells you something is down, not why.",
     "tradeoff": "Probes from one place miss regional problems; many locations cost more to run.",
     "res": [
      "blackbox"
     ]
    },
    {
     "name": "PagerDuty and Opsgenie",
     "what": "Paging tools: they receive alerts, apply on-call schedules and escalation rules, and wake the right person.",
     "use": "Anything that must reach a human at 3 a.m.",
     "avoid": "Routing every warning to them; pages that need no action burn out on-call fast.",
     "tradeoff": "Paid per user, but the real cost is alert hygiene, not the tool.",
     "res": [
      "pd-response"
     ]
    }
   ]
  },
  {
   "name": "Quality, security and AI",
   "tools": [
    {
     "name": "Testcontainers",
     "what": "Libraries that start real dependencies (Postgres, Redis, Kafka) in Docker from test code and clean them up afterwards.",
     "use": "Integration tests that need real database behavior instead of mocks.",
     "avoid": "Pure unit tests; spinning up containers for logic that does no I/O just slows the suite.",
     "tradeoff": "Needs Docker in CI and adds seconds per suite; reuse containers across tests.",
     "res": [
      "testcontainers-go"
     ]
    },
    {
     "name": "Trivy",
     "what": "An open-source scanner for vulnerable packages, misconfigurations and leaked secrets in container images, repos and Terraform.",
     "use": "Blocking known-vulnerable images in CI.",
     "avoid": "Failing builds on every finding without triage; teams then add a bypass and stop looking.",
     "tradeoff": "Noise vs safety: tune severity thresholds and keep an ignore file with reasons.",
     "res": [
      "trivy"
     ]
    },
    {
     "name": "pgvector",
     "what": "A Postgres extension for vector similarity search over embeddings, with exact search and approximate indexes (HNSW, IVFFlat).",
     "use": "RAG and semantic search when your data already lives in Postgres.",
     "avoid": "Hundreds of millions of vectors under heavy query load; a dedicated vector store scales further.",
     "tradeoff": "One database to operate, in exchange for slower search and index builds at very large scale.",
     "res": [
      "pgvector"
     ]
    },
    {
     "name": "Langfuse",
     "what": "Open-source LLM observability: traces of prompts and tool calls, token usage and cost, plus evals and prompt versions.",
     "use": "Debugging and measuring LLM features in production.",
     "avoid": "A single prompt call with no users yet; plain logs are enough.",
     "tradeoff": "Another service to run or pay for, and traces can contain user data, so plan redaction.",
     "res": [
      "langfuse"
     ]
    }
   ]
  }
 ],
 "labs": [
  {
   "phase": 0,
   "title": "Trace a request",
   "stack": "dig, curl, openssl",
   "steps": [
    "Resolve a public API's hostname with <code>dig</code> and note the TTL",
    "Run <code>curl -v</code> and <code>openssl s_client</code> and find the TLS version and certificate chain",
    "Draw every hop from your laptop to the database, with rough latency per hop"
   ]
  },
  {
   "phase": 1,
   "title": "Postgres indexes and a zero-downtime rename",
   "stack": "Docker, Postgres, Python or Go",
   "steps": [
    "Load 5M fake message rows",
    "Find a slow query with EXPLAIN ANALYZE and fix it with a composite index",
    "Rename a column with expand/contract while a script keeps writing, and prove nothing failed"
   ]
  },
  {
   "phase": 2,
   "title": "Rate limiter and cache in Go",
   "stack": "Go, Redis, vegeta",
   "steps": [
    "Token bucket in Redis with one Lua script",
    "Load test with vegeta and check the 429 rate",
    "Add cache-aside with singleflight to a slow endpoint and compare p99"
   ]
  },
  {
   "phase": 3,
   "title": "Queue with a DLQ and an idempotent consumer",
   "stack": "LocalStack SQS or Redpanda, Go",
   "steps": [
    "One producer, two consumers",
    "A poison message that ends up in the DLQ after N tries",
    "Deliver every message twice and prove the result is still correct"
   ]
  },
  {
   "phase": 4,
   "title": "Break a Raft cluster",
   "stack": "etcd in Docker",
   "steps": [
    "Run three nodes; kill the leader and time the re-election",
    "Write with one node down, then two, and explain the difference",
    "Implement a lease-based lock with a fencing token"
   ]
  },
  {
   "phase": 5,
   "title": "Slow dependency drill",
   "stack": "Go, Toxiproxy, sony/gobreaker",
   "steps": [
    "Add 2 s of latency and watch goroutines and latency pile up",
    "Add timeouts, retries with full jitter and a circuit breaker",
    "Compare error rate and p99 before and after"
   ]
  },
  {
   "phase": 6,
   "title": "Observability in a box",
   "stack": "Go, Prometheus, Grafana, Alertmanager",
   "steps": [
    "Instrument a counter and a histogram",
    "Write five PromQL queries, including p99 and error ratio",
    "Build a RED dashboard and fire an alert when p99 goes over 300 ms"
   ]
  },
  {
   "phase": 7,
   "title": "Game day: break it, page it, fix it",
   "stack": "Phase 6 lab stack, Toxiproxy, k6",
   "steps": [
    "Run the Phase 6 observability stack and a steady k6 load test",
    "Inject a fault: 2 s of database latency with Toxiproxy, or kill a dependency",
    "Let the burn-rate alert fire and page you through Alertmanager",
    "Debug it the production way: RED dashboard, then traces, then logs, then a profile",
    "Write a one-page blameless postmortem with a timeline and two action items"
   ]
  },
  {
   "phase": 8,
   "title": "ClickHouse vs Postgres",
   "stack": "ClickHouse, Postgres",
   "steps": [
    "Generate 50M synthetic call records",
    "Compare a calls-per-country-per-hour query in both",
    "Try two ORDER BY keys and add a materialized view"
   ]
  },
  {
   "phase": 9,
   "title": "Infra from code",
   "stack": "Terraform, LocalStack",
   "steps": [
    "Create an S3 bucket and an SQS queue: plan, apply, change, destroy",
    "Trace one config key from its source of truth to the file your service reads"
   ]
  },
  {
   "phase": 10,
   "title": "An API you would ship",
   "stack": "OpenAPI",
   "steps": [
    "Spec a send-message API with idempotency keys, cursor pagination and a status webhook",
    "Plan one breaking change as expand, migrate clients, contract, sunset"
   ]
  }
 ],
 "prompts": [
  [
   "Teach me Prometheus from scratch, then quiz me with five questions.",
   "Swap in any topic from the roadmap."
  ],
  [
   "Show me how we use ClickHouse in our code, with the three files to read first.",
   "Works for any tool on the Tools tab."
  ],
  [
   "Grade my vault answer (then paste what \"Copy for grading\" gave you).",
   "You get a score, the gaps, and one follow-up."
  ],
  [
   "Read my study hub backup (study-hub-backup-<date>.json) and grade every answer marked Drafted.",
   "Use Backup on the vault notebook first."
  ],
  [
   "Mock HLD interview: design an OTP service. 45 minutes, act like a real interviewer.",
   "Uses the interview-coach skill and tracks your scores."
  ],
  [
   "Mock machine-coding round: LRU cache in Go, 60 minutes.",
   "Paste your code at the end for a rubric score."
  ],
  [
   "Scaffold the Phase 6 lab in a labs/ folder next to my study hub.",
   "Prometheus, Grafana, Alertmanager and a small Go service."
  ]
 ],
 "top7": [
  "DDIA 2nd edition (Kleppmann and Riccomini, 2026), read alongside Phases 1-4.",
  "CMU 15-445 (the Fall 2025 videos) plus Use The Index, Luke, for Phase 1.",
  "Kleppmann's Cambridge distributed systems lectures, then the MIT 6.5840 Raft lab in Go.",
  "The AWS Builders' Library articles, Stripe on idempotency, and the SRE book chapters on cascading failures and overload.",
  "Prometheus docs (naming, histograms, when to push) with the PromLabs cheat sheet and the SRE workbook chapter on alerting on SLOs.",
  "Hello Interview \"System Design in a Hurry\" plus ByteByteGo volume 1, then ten mock designs.",
  "The awesome-low-level-design repo (Go and Python solutions) with the Concept && Coding playlist: one 90-minute kata a week."
 ],
 "resGroups": [
  [
   "Foundations",
   [
    "whathappens",
    "hpbn",
    "http3-explained",
    "tls13",
    "howdns",
    "haproxy-l4l7",
    "webdev-cdn",
    "ostep",
    "go-pipelines",
    "napkin",
    "latency",
    "bbg-estimation"
   ]
  ],
  [
   "Databases",
   [
    "ddia",
    "ddia-2e",
    "uil",
    "cmu445",
    "cmu445-yt",
    "db-internals",
    "pg-mvcc",
    "pg-explain"
   ]
  ],
  [
   "Distributed systems",
   [
    "kleppmann-lectures",
    "kleppmann-notes",
    "mit6824",
    "mit6824-yt",
    "raft-anim",
    "raft-paper",
    "jepsen",
    "jepsen-models",
    "uds",
    "gossip-glomers",
    "kleppmann-locking"
   ]
  ],
  [
   "Caching, Redis and messaging",
   [
    "aws-caching",
    "fb-memcache",
    "redis-types",
    "redis-cluster",
    "redis-univ",
    "stripe-ratelimit",
    "tail-at-scale",
    "kafka-intro",
    "kafka-design",
    "confluent-101",
    "the-log",
    "sqs-docs"
   ]
  ],
  [
   "Reliability",
   [
    "aws-retries",
    "aws-backlogs",
    "aws-loadshed",
    "aws-shuffle",
    "aws-idem",
    "stripe-idem",
    "brandur-idem",
    "sre-book",
    "sre-cascading",
    "sre-overload",
    "sre-workbook"
   ]
  ],
  [
   "Observability",
   [
    "prom-start",
    "prom-overview",
    "prom-naming",
    "prom-instr",
    "prom-histograms",
    "prom-pushing",
    "promql-basics",
    "promlabs-cheat",
    "promlabs-rate",
    "prom-book",
    "alertmanager",
    "grafana-fund",
    "grafana-tutorials",
    "grafana-docs",
    "lgtm-docker",
    "otel-primer",
    "otel-collector",
    "sre-slo",
    "red",
    "use",
    "golden-signals",
    "sre-alerting-slo",
    "otel-docs",
    "jaeger-docs",
    "loki-docs",
    "thanos",
    "mimir",
    "victoriametrics",
    "sentry-docs",
    "opensearch-docs",
    "go-pprof",
    "pyroscope",
    "parca",
    "blackbox"
   ]
  ],
  [
   "ClickHouse and Altinity",
   [
    "ch-learn",
    "ch-docs",
    "ch-mergetree",
    "ch-keeper",
    "altinity-site",
    "altinity-kb",
    "altinity-docs",
    "altinity-operator"
   ]
  ],
  [
   "Infra and platform",
   [
    "docker-start",
    "k8s-tutorials",
    "helm-quick",
    "tf-tutorials",
    "opentofu",
    "consul-docs",
    "consul-template",
    "localstack",
    "toxiproxy",
    "vegeta",
    "aws-well-arch"
   ]
  ],
  [
   "Patterns",
   [
    "ms-patterns",
    "ms-saga",
    "ms-outbox",
    "ms-gateway",
    "ms-strangler",
    "azure-patterns",
    "temporal-saga",
    "temporal-saga-go",
    "fowler-strangler",
    "fowler-cqrs",
    "fowler-es",
    "refactoring-guru"
   ]
  ],
  [
   "LLD and machine coding",
   [
    "awesome-lld",
    "cc-lld",
    "workat",
    "okhravi",
    "solid-go"
   ]
  ],
  [
   "HLD interview prep",
   [
    "hello-interview",
    "bbg-sdi",
    "bbg-blog",
    "sdprimer",
    "arpit",
    "puneet",
    "hnasr",
    "gkcs"
   ]
  ],
  [
   "Quality, security, AI and on-call",
   [
    "pd-response",
    "testcontainers-go",
    "trivy",
    "pgvector",
    "langfuse"
   ]
  ]
 ],
 "resources": {
  "whathappens": {
   "t": "What happens when...",
   "by": "GitHub community",
   "url": "https://github.com/alex/what-happens-when",
   "type": "repo",
   "free": true,
   "why": "The whole URL-to-page journey on one page."
  },
  "hpbn": {
   "t": "High Performance Browser Networking",
   "by": "Ilya Grigorik",
   "url": "https://hpbn.co/",
   "type": "book",
   "free": true,
   "why": "TCP, TLS, HTTP/1.1 and HTTP/2 on the wire. Written before HTTP/3."
  },
  "http3-explained": {
   "t": "HTTP/3 explained",
   "by": "Daniel Stenberg",
   "url": "https://http3-explained.haxx.se/",
   "type": "book",
   "free": true,
   "why": "QUIC and HTTP/3 in plain words, by the curl author."
  },
  "tls13": {
   "t": "The Illustrated TLS 1.3 Connection",
   "by": "xargs.org",
   "url": "https://tls13.xargs.org/",
   "type": "interactive",
   "free": true,
   "why": "Every byte of a real handshake, explained."
  },
  "howdns": {
   "t": "How DNS works",
   "by": "howdns.works",
   "url": "https://howdns.works/",
   "type": "comic",
   "free": true,
   "why": "DNS resolution as a short comic."
  },
  "haproxy-l4l7": {
   "t": "Layer 4 and Layer 7 proxy mode",
   "by": "HAProxy",
   "url": "https://www.haproxy.com/blog/layer-4-and-layer-7-proxy-mode",
   "type": "blog",
   "free": true,
   "why": "L4 vs L7 load balancing, clearly."
  },
  "webdev-cdn": {
   "t": "Content delivery networks",
   "by": "web.dev",
   "url": "https://web.dev/articles/content-delivery-networks",
   "type": "article",
   "free": true,
   "why": "What a CDN does and how to use one well."
  },
  "ostep": {
   "t": "Operating Systems: Three Easy Pieces",
   "by": "Arpaci-Dusseau",
   "url": "https://pages.cs.wisc.edu/~remzi/OSTEP/",
   "type": "book",
   "free": true,
   "why": "Processes, concurrency and I/O, free and readable."
  },
  "go-pipelines": {
   "t": "Go Concurrency Patterns: Pipelines",
   "by": "The Go Blog",
   "url": "https://go.dev/blog/pipelines",
   "type": "blog",
   "free": true,
   "why": "Goroutines, channels and cancellation done right."
  },
  "napkin": {
   "t": "napkin-math",
   "by": "Simon Eskildsen",
   "url": "https://github.com/sirupsen/napkin-math",
   "type": "repo",
   "free": true,
   "why": "Current latency and throughput numbers, and how to use them."
  },
  "latency": {
   "t": "Latency numbers every programmer should know",
   "by": "Colin Scott",
   "url": "https://colin-scott.github.io/personal_website/research/interactive_latency.html",
   "type": "interactive",
   "free": true,
   "why": "The classic table, adjustable by year."
  },
  "bbg-estimation": {
   "t": "Back-of-the-envelope estimation",
   "by": "ByteByteGo",
   "url": "https://bytebytego.com/courses/system-design-interview/back-of-the-envelope-estimation",
   "type": "chapter",
   "free": true,
   "why": "Free chapter from Alex Xu's book."
  },
  "ddia": {
   "t": "Designing Data-Intensive Applications, 2nd ed.",
   "by": "Martin Kleppmann, Chris Riccomini",
   "url": "https://www.oreilly.com/library/view/designing-data-intensive-applications/9781098119058/",
   "type": "book",
   "free": false,
   "why": "The spine of Phases 1-4. The 2nd edition came out in March 2026."
  },
  "ddia-2e": {
   "t": "What is new in the DDIA 2nd edition",
   "by": "Martin Kleppmann",
   "url": "https://martin.kleppmann.com/2026/03/24/designing-data-intensive-applications-2e.html",
   "type": "blog",
   "free": true,
   "why": "The author on what changed."
  },
  "uil": {
   "t": "Use The Index, Luke",
   "by": "Markus Winand",
   "url": "https://use-the-index-luke.com/",
   "type": "book",
   "free": true,
   "why": "How B-tree indexes and query plans really work, for app developers."
  },
  "cmu445": {
   "t": "CMU 15-445/645 Database Systems",
   "by": "Andy Pavlo, CMU",
   "url": "https://15445.courses.cs.cmu.edu/fall2026/",
   "type": "course",
   "free": true,
   "why": "The best free database internals course. This term's videos need a CMU login, so watch Fall 2025."
  },
  "cmu445-yt": {
   "t": "CMU 15-445 Fall 2025 lectures",
   "by": "CMU Database Group",
   "url": "https://www.youtube.com/playlist?list=PLSE8ODhjZXjYMAgsGH-GtY5rJYZ6zjsd5",
   "type": "video",
   "free": true,
   "why": "25 public lectures."
  },
  "db-internals": {
   "t": "Database Internals",
   "by": "Alex Petrov",
   "url": "https://www.databass.dev/",
   "type": "book",
   "free": false,
   "why": "Storage engines (B-tree, LSM), then replication and consensus."
  },
  "pg-mvcc": {
   "t": "PostgreSQL: concurrency control",
   "by": "PostgreSQL docs",
   "url": "https://www.postgresql.org/docs/current/mvcc.html",
   "type": "docs",
   "free": true,
   "why": "What each isolation level really does in Postgres."
  },
  "pg-explain": {
   "t": "PostgreSQL: using EXPLAIN",
   "by": "PostgreSQL docs",
   "url": "https://www.postgresql.org/docs/current/using-explain.html",
   "type": "docs",
   "free": true,
   "why": "How to read a query plan."
  },
  "kleppmann-lectures": {
   "t": "Distributed Systems lecture series",
   "by": "Martin Kleppmann, Cambridge",
   "url": "https://www.youtube.com/playlist?list=PLeKd45zvjcDFUEv_ohr_HdUFe97RItdiB",
   "type": "video",
   "free": true,
   "why": "The gentlest rigorous introduction."
  },
  "kleppmann-notes": {
   "t": "Distributed Systems lecture notes (PDF)",
   "by": "Martin Kleppmann",
   "url": "https://www.cl.cam.ac.uk/teaching/2122/ConcDisSys/dist-sys-notes.pdf",
   "type": "notes",
   "free": true,
   "why": "The written companion to the lectures."
  },
  "mit6824": {
   "t": "MIT 6.5840 Distributed Systems",
   "by": "MIT PDOS",
   "url": "https://pdos.csail.mit.edu/6.824/",
   "type": "course",
   "free": true,
   "why": "Labs in Go: MapReduce, Raft, a sharded key-value store."
  },
  "mit6824-yt": {
   "t": "MIT 6.824 lectures (Spring 2020)",
   "by": "Robert Morris",
   "url": "https://www.youtube.com/playlist?list=PLrw6a1wE39_tb2fErI4-WkMbsvGQk9_UB",
   "type": "video",
   "free": true,
   "why": "Lecture videos to go with the labs."
  },
  "raft-anim": {
   "t": "Raft, animated",
   "by": "The Secret Lives of Data",
   "url": "https://thesecretlivesofdata.com/raft/",
   "type": "interactive",
   "free": true,
   "why": "Leader election and log replication, step by step. Start here."
  },
  "raft-paper": {
   "t": "In Search of an Understandable Consensus Algorithm",
   "by": "Ongaro, Ousterhout",
   "url": "https://raft.github.io/raft.pdf",
   "type": "paper",
   "free": true,
   "why": "The Raft paper. Genuinely readable."
  },
  "jepsen": {
   "t": "Jepsen analyses",
   "by": "Kyle Kingsbury",
   "url": "https://jepsen.io/analyses",
   "type": "reports",
   "free": true,
   "why": "Real databases breaking their promises."
  },
  "jepsen-models": {
   "t": "Consistency models",
   "by": "Jepsen",
   "url": "https://jepsen.io/consistency",
   "type": "docs",
   "free": true,
   "why": "Every consistency model and how they relate."
  },
  "uds": {
   "t": "Understanding Distributed Systems",
   "by": "Roberto Vitillo",
   "url": "https://understandingdistributed.systems/",
   "type": "book",
   "free": false,
   "why": "A compact survey for working engineers."
  },
  "gossip-glomers": {
   "t": "Gossip Glomers",
   "by": "Fly.io",
   "url": "https://fly.io/dist-sys/",
   "type": "interactive",
   "free": true,
   "why": "Hands-on distributed systems challenges, with a Go walkthrough."
  },
  "kleppmann-locking": {
   "t": "How to do distributed locking",
   "by": "Martin Kleppmann",
   "url": "https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html",
   "type": "blog",
   "free": true,
   "why": "Why locks need fencing tokens."
  },
  "aws-caching": {
   "t": "Caching best practices",
   "by": "AWS",
   "url": "https://aws.amazon.com/caching/best-practices/",
   "type": "docs",
   "free": true,
   "why": "Cache-aside, write-through and TTLs in one page."
  },
  "fb-memcache": {
   "t": "Scaling Memcache at Facebook",
   "by": "NSDI 2013",
   "url": "https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf",
   "type": "paper",
   "free": true,
   "why": "Leases, stampedes and invalidation at huge scale."
  },
  "redis-types": {
   "t": "Redis data types",
   "by": "Redis",
   "url": "https://redis.io/docs/latest/develop/data-types/",
   "type": "docs",
   "free": true,
   "why": "What each structure is for."
  },
  "redis-cluster": {
   "t": "Redis cluster specification",
   "by": "Redis",
   "url": "https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/",
   "type": "docs",
   "free": true,
   "why": "Hash slots, hash tags and failover."
  },
  "redis-univ": {
   "t": "Redis University",
   "by": "Redis",
   "url": "https://university.redis.io/",
   "type": "course",
   "free": true,
   "why": "Short structured courses."
  },
  "stripe-ratelimit": {
   "t": "Scaling your API with rate limiters",
   "by": "Stripe",
   "url": "https://stripe.com/blog/rate-limiters",
   "type": "blog",
   "free": true,
   "why": "Four kinds of limiters from a real API company."
  },
  "tail-at-scale": {
   "t": "The Tail at Scale",
   "by": "Jeff Dean, Luiz Barroso",
   "url": "https://research.google/pubs/the-tail-at-scale/",
   "type": "paper",
   "free": true,
   "why": "Why p99 dominates in fan-out systems, and what to do about it."
  },
  "kafka-design": {
   "t": "Kafka design",
   "by": "Apache Kafka",
   "url": "https://kafka.apache.org/43/design/design/",
   "type": "docs",
   "free": true,
   "why": "The log, replication and delivery semantics."
  },
  "confluent-101": {
   "t": "Kafka 101",
   "by": "Confluent Developer",
   "url": "https://developer.confluent.io/courses/apache-kafka/events/",
   "type": "video",
   "free": true,
   "why": "Short free course; follow with the architecture deep dive."
  },
  "the-log": {
   "t": "The Log: what every software engineer should know",
   "by": "Jay Kreps",
   "url": "https://web.archive.org/web/20260612105408/https://engineering.linkedin.com/distributed-systems/log-what-every-software-engineer-should-know-about-real-time-datas-unifying",
   "type": "essay",
   "free": true,
   "why": "Where Kafka's model comes from (archived copy)."
  },
  "sqs-docs": {
   "t": "Amazon SQS developer guide",
   "by": "AWS",
   "url": "https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html",
   "type": "docs",
   "free": true,
   "why": "Visibility timeout, DLQs, FIFO queues."
  },
  "aws-retries": {
   "t": "Timeouts, retries and backoff with jitter",
   "by": "AWS Builders' Library",
   "url": "https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/",
   "type": "article",
   "free": true,
   "why": "Retry amplification and jitter, from people who run huge systems."
  },
  "aws-backlogs": {
   "t": "Avoiding insurmountable queue backlogs",
   "by": "AWS Builders' Library",
   "url": "https://aws.amazon.com/builders-library/avoiding-insurmountable-queue-backlogs/",
   "type": "article",
   "free": true,
   "why": "How queues recover, or do not."
  },
  "aws-loadshed": {
   "t": "Using load shedding to avoid overload",
   "by": "AWS Builders' Library",
   "url": "https://aws.amazon.com/builders-library/using-load-shedding-to-avoid-overload/",
   "type": "article",
   "free": true,
   "why": "Overload control in practice."
  },
  "aws-shuffle": {
   "t": "Workload isolation using shuffle-sharding",
   "by": "AWS Builders' Library",
   "url": "https://aws.amazon.com/builders-library/workload-isolation-using-shuffle-sharding/",
   "type": "article",
   "free": true,
   "why": "Limiting the blast radius of one bad tenant."
  },
  "aws-idem": {
   "t": "Making retries safe with idempotent APIs",
   "by": "AWS Builders' Library",
   "url": "https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/",
   "type": "article",
   "free": true,
   "why": "Idempotency tokens done properly."
  },
  "stripe-idem": {
   "t": "Designing robust and predictable APIs with idempotency",
   "by": "Stripe",
   "url": "https://stripe.com/blog/idempotency",
   "type": "blog",
   "free": true,
   "why": "The classic post on idempotency keys."
  },
  "brandur-idem": {
   "t": "Implementing Stripe-like idempotency keys in Postgres",
   "by": "Brandur Leach",
   "url": "https://brandur.org/idempotency-keys",
   "type": "blog",
   "free": true,
   "why": "The full implementation, with recovery points."
  },
  "sre-book": {
   "t": "Site Reliability Engineering",
   "by": "Google",
   "url": "https://sre.google/sre-book/table-of-contents/",
   "type": "book",
   "free": true,
   "why": "The SRE book, free online."
  },
  "sre-cascading": {
   "t": "Addressing cascading failures",
   "by": "Google SRE book",
   "url": "https://sre.google/sre-book/addressing-cascading-failures/",
   "type": "chapter",
   "free": true,
   "why": "How one failure becomes an outage."
  },
  "sre-overload": {
   "t": "Handling overload",
   "by": "Google SRE book",
   "url": "https://sre.google/sre-book/handling-overload/",
   "type": "chapter",
   "free": true,
   "why": "Load shedding and graceful degradation."
  },
  "sre-workbook": {
   "t": "The Site Reliability Workbook",
   "by": "Google",
   "url": "https://sre.google/workbook/table-of-contents/",
   "type": "book",
   "free": true,
   "why": "SLOs and alerting in practice."
  },
  "prom-overview": {
   "t": "Prometheus overview",
   "by": "Prometheus docs",
   "url": "https://prometheus.io/docs/introduction/overview/",
   "type": "docs",
   "free": true,
   "why": "Architecture and data model in one page."
  },
  "prom-naming": {
   "t": "Metric and label naming",
   "by": "Prometheus docs",
   "url": "https://prometheus.io/docs/practices/naming/",
   "type": "docs",
   "free": true,
   "why": "Units, suffixes like _total, and label rules."
  },
  "prom-histograms": {
   "t": "Histograms and summaries",
   "by": "Prometheus docs",
   "url": "https://prometheus.io/docs/practices/histograms/",
   "type": "docs",
   "free": true,
   "why": "How to measure latency correctly."
  },
  "prom-pushing": {
   "t": "When to use the Pushgateway",
   "by": "Prometheus docs",
   "url": "https://prometheus.io/docs/practices/pushing/",
   "type": "docs",
   "free": true,
   "why": "Short: when pushing is right, and why it usually is not."
  },
  "promql-basics": {
   "t": "Querying basics (PromQL)",
   "by": "Prometheus docs",
   "url": "https://prometheus.io/docs/prometheus/latest/querying/basics/",
   "type": "docs",
   "free": true,
   "why": "Instant vs range vectors, selectors, functions."
  },
  "promlabs-cheat": {
   "t": "PromQL cheat sheet",
   "by": "PromLabs",
   "url": "https://promlabs.com/promql-cheat-sheet/",
   "type": "reference",
   "free": true,
   "why": "Every common query shape on one page."
  },
  "prom-book": {
   "t": "Prometheus: Up and Running, 2nd ed.",
   "by": "Julien Pivotto, Brian Brazil",
   "url": "https://www.oreilly.com/library/view/prometheus-up/9781098131135/",
   "type": "book",
   "free": false,
   "why": "The book-length treatment, by maintainers."
  },
  "prom-start": {
   "t": "Getting started with Prometheus",
   "by": "Prometheus docs",
   "url": "https://prometheus.io/docs/prometheus/latest/getting_started/",
   "type": "tutorial",
   "free": true,
   "why": "Run a server and write your first queries."
  },
  "prom-instr": {
   "t": "Instrumentation best practices",
   "by": "Prometheus docs",
   "url": "https://prometheus.io/docs/practices/instrumentation/",
   "type": "docs",
   "free": true,
   "why": "What to measure, and the cardinality rule: keep most metrics under 10 label combinations."
  },
  "promlabs-rate": {
   "t": "How exactly does PromQL calculate rates?",
   "by": "PromLabs",
   "url": "https://promlabs.com/blog/2021/01/29/how-exactly-does-promql-calculate-rates/",
   "type": "blog",
   "free": true,
   "why": "rate vs irate vs increase, precisely."
  },
  "grafana-fund": {
   "t": "Grafana fundamentals",
   "by": "Grafana Labs",
   "url": "https://grafana.com/tutorials/grafana-fundamentals/",
   "type": "tutorial",
   "free": true,
   "why": "Dashboards and alerts over Prometheus and Loki, hands-on."
  },
  "lgtm-docker": {
   "t": "docker-otel-lgtm",
   "by": "Grafana Labs",
   "url": "https://grafana.com/docs/opentelemetry/docker-lgtm/",
   "type": "tool",
   "free": true,
   "why": "The whole LGTM stack plus an OTel Collector in one container, for labs."
  },
  "otel-primer": {
   "t": "Observability primer",
   "by": "OpenTelemetry",
   "url": "https://opentelemetry.io/docs/concepts/observability-primer/",
   "type": "docs",
   "free": true,
   "why": "Signals, spans and context explained simply."
  },
  "otel-collector": {
   "t": "Collector quick start",
   "by": "OpenTelemetry",
   "url": "https://opentelemetry.io/docs/collector/quick-start/",
   "type": "tutorial",
   "free": true,
   "why": "Receivers, processors and exporters, hands-on."
  },
  "sre-slo": {
   "t": "Service level objectives",
   "by": "Google SRE book",
   "url": "https://sre.google/sre-book/service-level-objectives/",
   "type": "chapter",
   "free": true,
   "why": "SLIs, SLOs and SLAs defined properly."
  },
  "altinity-docs": {
   "t": "Altinity documentation",
   "by": "Altinity",
   "url": "https://docs.altinity.com/",
   "type": "docs",
   "free": true,
   "why": "Altinity.Cloud and the operator."
  },
  "kafka-intro": {
   "t": "Kafka introduction",
   "by": "Apache Kafka",
   "url": "https://kafka.apache.org/intro",
   "type": "docs",
   "free": true,
   "why": "Events, topics, partitions in ten minutes."
  },
  "helm-quick": {
   "t": "Helm quickstart",
   "by": "Helm",
   "url": "https://helm.sh/docs/intro/quickstart/",
   "type": "tutorial",
   "free": true,
   "why": "Install and upgrade a chart."
  },
  "alertmanager": {
   "t": "Alertmanager",
   "by": "Prometheus docs",
   "url": "https://prometheus.io/docs/alerting/latest/alertmanager/",
   "type": "docs",
   "free": true,
   "why": "Grouping, inhibition, silences, routing."
  },
  "grafana-tutorials": {
   "t": "Grafana tutorials",
   "by": "Grafana Labs",
   "url": "https://grafana.com/tutorials/",
   "type": "tutorials",
   "free": true,
   "why": "Hands-on, from first dashboard to alerting."
  },
  "grafana-docs": {
   "t": "Grafana documentation",
   "by": "Grafana Labs",
   "url": "https://grafana.com/docs/grafana/latest/",
   "type": "docs",
   "free": true,
   "why": "Panels, variables, data sources."
  },
  "red": {
   "t": "The RED method",
   "by": "Tom Wilkie, Grafana Labs",
   "url": "https://grafana.com/blog/the-red-method-how-to-instrument-your-services/",
   "type": "blog",
   "free": true,
   "why": "Rate, errors, duration for every service."
  },
  "use": {
   "t": "The USE method",
   "by": "Brendan Gregg",
   "url": "https://www.brendangregg.com/usemethod.html",
   "type": "article",
   "free": true,
   "why": "Utilization, saturation, errors for every resource."
  },
  "golden-signals": {
   "t": "Monitoring distributed systems",
   "by": "Google SRE book",
   "url": "https://sre.google/sre-book/monitoring-distributed-systems/",
   "type": "chapter",
   "free": true,
   "why": "The four golden signals, and what makes a good alert."
  },
  "sre-alerting-slo": {
   "t": "Alerting on SLOs",
   "by": "Google SRE workbook",
   "url": "https://sre.google/workbook/alerting-on-slos/",
   "type": "chapter",
   "free": true,
   "why": "Multi-window, multi-burn-rate alerts explained."
  },
  "otel-docs": {
   "t": "OpenTelemetry documentation",
   "by": "OpenTelemetry",
   "url": "https://opentelemetry.io/docs/",
   "type": "docs",
   "free": true,
   "why": "Concepts, SDKs, the Collector."
  },
  "jaeger-docs": {
   "t": "Jaeger: getting started",
   "by": "Jaeger",
   "url": "https://www.jaegertracing.io/docs/latest/getting-started/",
   "type": "docs",
   "free": true,
   "why": "Run the all-in-one image and the HotROD demo app locally."
  },
  "loki-docs": {
   "t": "Grafana Loki documentation",
   "by": "Grafana Labs",
   "url": "https://grafana.com/docs/loki/latest/",
   "type": "docs",
   "free": true,
   "why": "Label-indexed log storage."
  },
  "thanos": {
   "t": "Thanos",
   "by": "CNCF",
   "url": "https://thanos.io/tip/thanos/getting-started.md/",
   "type": "docs",
   "free": true,
   "why": "Long-term storage and global view for Prometheus."
  },
  "mimir": {
   "t": "Grafana Mimir",
   "by": "Grafana Labs",
   "url": "https://grafana.com/oss/mimir/",
   "type": "docs",
   "free": true,
   "why": "Scalable long-term metrics storage."
  },
  "victoriametrics": {
   "t": "VictoriaMetrics",
   "by": "VictoriaMetrics",
   "url": "https://docs.victoriametrics.com/victoriametrics/quick-start/",
   "type": "docs",
   "free": true,
   "why": "A fast Prometheus-compatible time series database."
  },
  "sentry-docs": {
   "t": "Sentry documentation",
   "by": "Sentry",
   "url": "https://docs.sentry.io/",
   "type": "docs",
   "free": true,
   "why": "Error tracking concepts and SDKs."
  },
  "opensearch-docs": {
   "t": "OpenSearch documentation",
   "by": "OpenSearch Project",
   "url": "https://docs.opensearch.org/latest/getting-started/",
   "type": "docs",
   "free": true,
   "why": "Indexes, queries, index state management."
  },
  "ch-docs": {
   "t": "ClickHouse documentation",
   "by": "ClickHouse",
   "url": "https://clickhouse.com/docs",
   "type": "docs",
   "free": true,
   "why": "Start with the concepts and the guides."
  },
  "ch-mergetree": {
   "t": "MergeTree table engine",
   "by": "ClickHouse docs",
   "url": "https://clickhouse.com/docs/reference/engines/table-engines/mergetree-family/mergetree",
   "type": "docs",
   "free": true,
   "why": "Parts, merges, ORDER BY and partitions."
  },
  "ch-keeper": {
   "t": "ClickHouse Keeper",
   "by": "ClickHouse docs",
   "url": "https://clickhouse.com/docs/guides/oss/deployment-and-scaling/keeper",
   "type": "docs",
   "free": true,
   "why": "The Raft-based coordination service. It speaks the ZooKeeper protocol; run 3 nodes."
  },
  "ch-learn": {
   "t": "ClickHouse Academy",
   "by": "ClickHouse",
   "url": "https://learn.clickhouse.com/",
   "type": "course",
   "free": true,
   "why": "Free official training paths. Start here."
  },
  "altinity-site": {
   "t": "Altinity",
   "by": "Altinity",
   "url": "https://altinity.com/",
   "type": "site",
   "free": true,
   "why": "Altinity.Cloud, Stable builds, support."
  },
  "altinity-kb": {
   "t": "Altinity Knowledge Base",
   "by": "Altinity",
   "url": "https://kb.altinity.com/",
   "type": "docs",
   "free": true,
   "why": "Practical ClickHouse how-tos and gotchas."
  },
  "altinity-operator": {
   "t": "Altinity Kubernetes Operator for ClickHouse",
   "by": "Altinity",
   "url": "https://github.com/Altinity/clickhouse-operator",
   "type": "repo",
   "free": true,
   "why": "How ClickHouse clusters run on Kubernetes."
  },
  "docker-start": {
   "t": "Docker: get started",
   "by": "Docker",
   "url": "https://docs.docker.com/get-started/",
   "type": "tutorial",
   "free": true,
   "why": "Images, containers, compose."
  },
  "k8s-tutorials": {
   "t": "Kubernetes Basics",
   "by": "Kubernetes",
   "url": "https://kubernetes.io/docs/tutorials/kubernetes-basics/",
   "type": "tutorial",
   "free": true,
   "why": "Six short official modules, runnable locally with minikube."
  },
  "tf-tutorials": {
   "t": "Terraform tutorials",
   "by": "HashiCorp",
   "url": "https://developer.hashicorp.com/terraform/tutorials",
   "type": "tutorial",
   "free": true,
   "why": "State, modules, plan and apply, hands-on."
  },
  "opentofu": {
   "t": "OpenTofu",
   "by": "Linux Foundation",
   "url": "https://opentofu.org/",
   "type": "docs",
   "free": true,
   "why": "The open-source Terraform fork."
  },
  "consul-docs": {
   "t": "Consul KV store",
   "by": "HashiCorp",
   "url": "https://developer.hashicorp.com/consul/docs/automate/kv",
   "type": "docs",
   "free": true,
   "why": "How the key-value store works; the rest of the docs cover discovery and health checks."
  },
  "consul-template": {
   "t": "consul-template",
   "by": "HashiCorp",
   "url": "https://github.com/hashicorp/consul-template",
   "type": "repo",
   "free": true,
   "why": "How templates render and re-render."
  },
  "localstack": {
   "t": "LocalStack",
   "by": "LocalStack",
   "url": "https://github.com/localstack/localstack",
   "type": "repo",
   "free": true,
   "why": "AWS services on your laptop."
  },
  "toxiproxy": {
   "t": "Toxiproxy",
   "by": "Shopify",
   "url": "https://github.com/Shopify/toxiproxy",
   "type": "repo",
   "free": true,
   "why": "Inject latency and failures between services."
  },
  "vegeta": {
   "t": "Vegeta",
   "by": "Tomás Senart",
   "url": "https://github.com/tsenart/vegeta",
   "type": "repo",
   "free": true,
   "why": "HTTP load testing with latency percentiles."
  },
  "aws-well-arch": {
   "t": "AWS Well-Architected Framework",
   "by": "AWS",
   "url": "https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html",
   "type": "docs",
   "free": true,
   "why": "How AWS itself thinks about reliability, cost and security."
  },
  "ms-patterns": {
   "t": "Microservice patterns",
   "by": "Chris Richardson",
   "url": "https://microservices.io/patterns/index.html",
   "type": "docs",
   "free": true,
   "why": "The catalog, with problems and trade-offs."
  },
  "ms-saga": {
   "t": "Saga pattern",
   "by": "microservices.io",
   "url": "https://microservices.io/patterns/data/saga.html",
   "type": "docs",
   "free": true,
   "why": "Choreography vs orchestration, with examples."
  },
  "ms-outbox": {
   "t": "Transactional outbox",
   "by": "microservices.io",
   "url": "https://microservices.io/patterns/data/transactional-outbox.html",
   "type": "docs",
   "free": true,
   "why": "Reliable events without two-phase commit."
  },
  "ms-gateway": {
   "t": "API gateway pattern",
   "by": "microservices.io",
   "url": "https://microservices.io/patterns/apigateway.html",
   "type": "docs",
   "free": true,
   "why": "Gateways and backends for frontends."
  },
  "ms-strangler": {
   "t": "Strangler application",
   "by": "microservices.io",
   "url": "https://microservices.io/patterns/refactoring/strangler-application.html",
   "type": "docs",
   "free": true,
   "why": "Migrating off a monolith gradually."
  },
  "azure-patterns": {
   "t": "Cloud design patterns",
   "by": "Microsoft",
   "url": "https://learn.microsoft.com/en-us/azure/architecture/patterns/",
   "type": "docs",
   "free": true,
   "why": "Retry, circuit breaker, bulkhead, CQRS, with when-to-use notes."
  },
  "temporal-saga": {
   "t": "Saga pattern made easy",
   "by": "Temporal",
   "url": "https://temporal.io/blog/saga-pattern-made-easy",
   "type": "blog",
   "free": true,
   "why": "Durable sagas as code."
  },
  "temporal-saga-go": {
   "t": "Temporal saga sample in Go",
   "by": "Temporal",
   "url": "https://github.com/temporalio/samples-go/tree/main/saga",
   "type": "repo",
   "free": true,
   "why": "Working compensation code to read."
  },
  "fowler-strangler": {
   "t": "Strangler fig application",
   "by": "Martin Fowler",
   "url": "https://martinfowler.com/bliki/StranglerFigApplication.html",
   "type": "article",
   "free": true,
   "why": "The original idea."
  },
  "fowler-cqrs": {
   "t": "CQRS",
   "by": "Martin Fowler",
   "url": "https://martinfowler.com/bliki/CQRS.html",
   "type": "article",
   "free": true,
   "why": "What it is, and why most systems should not use it."
  },
  "fowler-es": {
   "t": "Event sourcing",
   "by": "Martin Fowler",
   "url": "https://martinfowler.com/eaaDev/EventSourcing.html",
   "type": "article",
   "free": true,
   "why": "State as a sequence of events."
  },
  "refactoring-guru": {
   "t": "Design patterns",
   "by": "Refactoring.Guru",
   "url": "https://refactoring.guru/design-patterns",
   "type": "site",
   "free": true,
   "why": "All 23 GoF patterns with diagrams and Go examples."
  },
  "awesome-lld": {
   "t": "awesome-low-level-design",
   "by": "Ashish Pratap Singh",
   "url": "https://github.com/ashishps1/awesome-low-level-design",
   "type": "repo",
   "free": true,
   "why": "Classic LLD problems with Go and Python solutions."
  },
  "cc-lld": {
   "t": "Low Level Design, basics to advanced",
   "by": "Shrayansh Jain (Concept && Coding)",
   "url": "https://www.youtube.com/playlist?list=PL6W8uoQQ2c61X_9e6Net0WdYZidm7zooW",
   "type": "video",
   "free": true,
   "why": "Long machine-coding walkthroughs (Java)."
  },
  "workat": {
   "t": "Machine coding practice",
   "by": "workat.tech",
   "url": "https://workat.tech/machine-coding/practice",
   "type": "problems",
   "free": true,
   "why": "India-style problems, tiered by SDE level."
  },
  "okhravi": {
   "t": "Design Patterns in OOP",
   "by": "Christopher Okhravi",
   "url": "https://www.youtube.com/playlist?list=PLrhzvIcii6GNjpARdnO4ueTUAVR9eMBpc",
   "type": "video",
   "free": true,
   "why": "GoF patterns with the reasoning behind them."
  },
  "solid-go": {
   "t": "SOLID Go Design",
   "by": "Dave Cheney",
   "url": "https://dave.cheney.net/2016/08/20/solid-go-design",
   "type": "blog",
   "free": true,
   "why": "SOLID in idiomatic Go."
  },
  "hello-interview": {
   "t": "System Design in a Hurry",
   "by": "Hello Interview",
   "url": "https://www.hellointerview.com/learn/system-design/in-a-hurry/introduction",
   "type": "guide",
   "free": true,
   "why": "A delivery framework plus many free breakdowns."
  },
  "bbg-sdi": {
   "t": "System Design Interview, volumes 1 and 2",
   "by": "Alex Xu, ByteByteGo",
   "url": "https://bytebytego.com/courses/system-design-interview",
   "type": "book",
   "free": false,
   "why": "The standard worked problems."
  },
  "bbg-blog": {
   "t": "ByteByteGo newsletter",
   "by": "Alex Xu",
   "url": "https://blog.bytebytego.com/",
   "type": "newsletter",
   "free": true,
   "why": "Weekly visual explainers."
  },
  "sdprimer": {
   "t": "The System Design Primer",
   "by": "Donne Martin",
   "url": "https://github.com/donnemartin/system-design-primer",
   "type": "repo",
   "free": true,
   "why": "Fundamentals and practice problems."
  },
  "arpit": {
   "t": "Arpit Bhayani",
   "by": "Arpit Bhayani",
   "url": "https://arpitbhayani.me/",
   "type": "blog + video",
   "free": true,
   "why": "Deep, practical internals from an Indian engineering lens."
  },
  "puneet": {
   "t": "Puneet Patwari's newsletter",
   "by": "Puneet Patwari",
   "url": "https://puneetpatwari.substack.com/",
   "type": "newsletter",
   "free": true,
   "why": "From the author of the vault questions."
  },
  "hnasr": {
   "t": "Hussein Nasser",
   "by": "Hussein Nasser",
   "url": "https://www.youtube.com/@hnasr",
   "type": "video",
   "free": true,
   "why": "Protocols, proxies and database internals."
  },
  "gkcs": {
   "t": "System design playlist",
   "by": "Gaurav Sen",
   "url": "https://www.youtube.com/playlist?list=PLMCXHnjXnTnvo6alSjVkgxV-VH6EPyvoX",
   "type": "video",
   "free": true,
   "why": "Concept-first HLD videos."
  },
  "go-pprof": {
   "t": "Profiling Go Programs",
   "by": "The Go Blog",
   "url": "https://go.dev/blog/pprof",
   "type": "blog",
   "free": true,
   "why": "The canonical pprof walkthrough."
  },
  "pyroscope": {
   "t": "Grafana Pyroscope docs",
   "by": "Grafana Labs",
   "url": "https://grafana.com/docs/pyroscope/latest/",
   "type": "docs",
   "free": true,
   "why": "Continuous profiling backend."
  },
  "parca": {
   "t": "Parca overview",
   "by": "Polar Signals",
   "url": "https://www.parca.dev/docs/overview/",
   "type": "docs",
   "free": true,
   "why": "Always-on eBPF profiling."
  },
  "blackbox": {
   "t": "blackbox_exporter",
   "by": "Prometheus",
   "url": "https://github.com/prometheus/blackbox_exporter",
   "type": "repo",
   "free": true,
   "why": "HTTP, TCP, ICMP and DNS probes."
  },
  "pd-response": {
   "t": "Incident Response Documentation",
   "by": "PagerDuty",
   "url": "https://response.pagerduty.com/",
   "type": "docs",
   "free": true,
   "why": "Roles, call etiquette and postmortems, free."
  },
  "trivy": {
   "t": "Trivy docs",
   "by": "Aqua Security",
   "url": "https://trivy.dev/docs/latest/guide/",
   "type": "docs",
   "free": true,
   "why": "Image, repo and IaC scanning."
  },
  "testcontainers-go": {
   "t": "Testcontainers for Go",
   "by": "Testcontainers",
   "url": "https://golang.testcontainers.org/",
   "type": "docs",
   "free": true,
   "why": "Real dependencies in tests."
  },
  "pgvector": {
   "t": "pgvector",
   "by": "Andrew Kane",
   "url": "https://github.com/pgvector/pgvector",
   "type": "repo",
   "free": true,
   "why": "Vector search inside Postgres (HNSW, IVFFlat)."
  },
  "langfuse": {
   "t": "Langfuse observability docs",
   "by": "Langfuse",
   "url": "https://langfuse.com/docs/observability/overview",
   "type": "docs",
   "free": true,
   "why": "LLM traces, costs and evals."
  }
 }
};
