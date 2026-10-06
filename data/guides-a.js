/* Decision guides, part A: data storage choices. Facts checked against official docs, papers and engineering blogs as of 2026-10-01. */
window.HUB_GUIDES = window.HUB_GUIDES || [];
window.HUB_GUIDES.push(
  {
    id: `sql-vs-nosql`,
    area: `Data`,
    title: `SQL vs NoSQL`,
    question: `Should this data live in a relational database, a key-value or document store, or a wide-column store?`,
    summary: `You are trading query flexibility and multi-row transactions against easy horizontal scale. A relational database answers questions you did not plan for and keeps related rows consistent. Key-value, document and wide-column stores make you design around known queries, and in return spread data and traffic across many nodes with little effort.`,
    why: `Choose NoSQL too early and every new feature needs a new index, a copied table or a backfill, while integrity checks move into app code. Choose one relational primary for a huge firehose and you end up sharding it by hand, under pressure.`,
    options: [
      {
        name: `Relational (Postgres, MySQL)`,
        what: `Tables with a declared schema, linked by keys and queried with SQL. The query planner turns each query into index lookups, scans and joins, so one schema serves questions nobody planned for. ACID transactions change many rows in one commit, and the database enforces constraints. A typical setup is one primary that takes every write, plus read replicas.`,
        pros: [
          `Ad hoc queries work, because the planner can combine indexes and joins for a question you did not design the schema around.`,
          `A transfer can debit one account, credit another and insert a ledger row in one transaction that fully commits or fully rolls back.`,
          `<code>UNIQUE</code> and foreign key constraints are checked by the database, so a bug in one service cannot create duplicate emails or orphaned orders.`,
          `Variable fields still fit: Postgres <code>jsonb</code> columns can be indexed with GIN for containment and key-exists queries.`
        ],
        cons: [
          `Writes scale up, not out: every write goes to one primary, and past the biggest machine you must shard (Citus, Vitess or your own code).`,
          `Some schema changes rewrite a big table: in Postgres, changing a column type normally rewrites the table and its indexes under an exclusive lock.`,
          `Replicas are asynchronous by default in Postgres and MySQL, so reads from them can be slightly stale.`,
          `Once data is sharded, joins and transactions across shards get slow or impossible, so the main strength fades exactly when you need scale.`
        ],
        pick: `Your default for business data with relations and invariants: users, orders, payments, inventory, permissions. Indexed well, one primary with replicas goes a long way.`,
        avoid: `Avoid it as the only home for an append-heavy firehose that outgrows one primary, for full-text search, or for big analytics scans. Feed those to a wide-column, search or columnar store.`,
        example: `GitHub keeps its core data in MySQL: 50+ clusters, each a primary plus replicas, serving 5.5 million queries per second across 300+ TB (2023).`,
        tools: `PostgreSQL, MySQL, Amazon Aurora, Citus, Vitess`
      },
      {
        name: `Key-value or document (DynamoDB, MongoDB)`,
        what: `Every item has a key, and the store uses it to pick a partition: DynamoDB hashes the partition key and keeps items that share it sorted by a sort key. A get or put by key touches one partition however big the table is. Document stores such as MongoDB keep JSON-like documents that embed related data and can index fields inside them.`,
        pros: [
          `Reads and writes by key stay fast as data grows, because each request touches one partition and the store adds partitions as data and traffic grow.`,
          `Managed services such as DynamoDB take server, replica and failover work off your team.`,
          `A document can hold a whole aggregate (an order with its lines), so one read loads it and one single-document write updates it atomically.`,
          `There is no fixed column list, so a new attribute needs no migration.`
        ],
        cons: [
          `You must know the access patterns first: AWS's own guide says not to design a DynamoDB schema until you know the questions it must answer.`,
          `A query that does not use the key is a <code>Scan</code> of every item, or needs a secondary index, which is another eventually consistent copy you pay to write and store.`,
          `Multi-item transactions are limited: DynamoDB allows 100 items per transaction in one Region, and MongoDB says multi-document transactions cost more than single-document writes.`,
          `Joins are missing (DynamoDB) or limited (MongoDB <code>$lookup</code>), so related data is embedded or duplicated and must be kept in sync.`
        ],
        pick: `Pick it when the main access patterns are known and keyed (sessions, carts, user profiles, device state, idempotency records) and you want steady latency at any scale.`,
        avoid: `Avoid it when the product keeps inventing filters, reports and joins, or when correctness needs many records to change together, like a ledger. Use a relational database there.`,
        example: `Amazon's Dynamo paper describes a key-value store built for the shopping cart, which had to accept "add to cart" even while disks failed and network routes flapped.`,
        tools: `Amazon DynamoDB, MongoDB, Redis, Azure Cosmos DB`
      },
      {
        name: `Wide-column (Cassandra, ScyllaDB)`,
        what: `Rows are grouped into partitions by a partition key and sorted inside each partition by clustering columns. A hash of the partition key places each partition on several replicas, and there is no leader: any replica can take a write. Writes append to a commit log and a memtable, then flush to immutable files. There are no joins, so you build one table per query.`,
        pros: [
          `Write capacity grows by adding nodes, because partitions spread by hash and each write is a sequential append plus a memory insert.`,
          `It runs across datacenters, with per-query consistency such as <code>LOCAL_QUORUM</code> to keep latency inside one region.`,
          `There is no failover step: if one replica is down, the others keep serving at the chosen consistency level.`,
          `Reading one partition in clustering order is cheap, which fits "latest 50 messages in a channel" or "readings for a device today".`
        ],
        cons: [
          `Every new query shape needs a new table holding duplicated data, kept in sync by your code.`,
          `There are no joins and no multi-partition transactions; lightweight transactions give compare-and-set inside one partition only.`,
          `Conflicts resolve by last write wins on timestamps, so clock skew can silently drop a write.`,
          `Deletes write tombstones that live at least <code>gc_grace_seconds</code> (10 days by default), and compaction, repair and hot partitions need an experienced operator.`
        ],
        pick: `Pick it for huge, append-heavy data read back by key and time (chat messages, activity feeds, IoT readings, audit events), especially across datacenters.`,
        avoid: `Avoid it for small or medium data, for joins or multi-row transactions, or without people to run it. Use Postgres or a managed key-value store instead.`,
        example: `Discord stores messages partitioned by channel and a time bucket. It grew to 177 Cassandra nodes by 2022, then moved to 72 ScyllaDB nodes.`,
        tools: `Apache Cassandra, ScyllaDB, Amazon Keyspaces`
      }
    ],
    compare: [
      [`Query flexibility`, `Any SQL: joins, ad hoc filters`, `By key; other queries need indexes`, `One table per query`],
      [`Transactions`, `Multi-row ACID`, `Single item; limited multi-item`, `Single-partition compare-and-set`],
      [`Write scaling`, `One primary; shard by hand`, `Automatic partitions by key`, `Add nodes; any replica writes`],
      [`Read consistency`, `Primary current; replicas lag`, `DynamoDB: eventual unless requested`, `Tunable per query`],
      [`Schema change`, `Migrations; big tables need care`, `Per item; old items keep shape`, `New query means new table`],
      [`Operations`, `Familiar; sharding is the hard part`, `Managed options need little`, `Compaction, repair, tombstones`]
    ],
    decide: [
      [`Will people keep asking new questions of this data (filters, reports, joins)?`, `Yes → Relational. In NoSQL each new question is a new index or table.`],
      [`Must several records change together or not at all?`, `Yes → Relational. NoSQL transactions are limited or costly.`],
      [`Is nearly every read a get by one key, at high or spiky volume?`, `Yes → Key-value or document, ideally managed.`],
      [`Is it an append-heavy stream, read by key and time, too big for one primary?`, `Yes → Wide-column, or a columnar store if reads are aggregates.`],
      [`Will the data fit one primary for the next few years?`, `Yes → Relational. Do not pay distributed costs early.`]
    ],
    scenario: {
      title: `Worked example: storage for a food-delivery app`,
      setup: `Customers browse menus, place orders and pay. Couriers send a GPS ping every few seconds during a trip, and the app draws the live route. Support searches orders by customer and date, and finance runs monthly reports.`,
      steps: [
        `Split by access pattern, not by app. Orders, payments, menus and customers have relations, invariants and changing queries.`,
        `Paying for an order updates the order, the payment and a ledger row together → relational transactions.`,
        `Pings are append-only, constant, read as "pings for trip X in time order", then expire → a wide-column partition per trip, clustered by time, with a TTL (or DynamoDB with a sort key).`,
        `Support search and finance reports change every month → serve them from a Postgres replica now and a warehouse later, never from the ping store.`,
        `Check sizes first: if the ping rate fits one Postgres primary with batched inserts, start there.`
      ],
      answer: `Postgres for orders, payments, menus and customers, plus a wide-column or key-value store with TTL for pings once their volume needs it. The choice is per workload: relations and invariants go to SQL, a keyed firehose goes to NoSQL.`
    },
    mistakes: [
      `Choosing NoSQL "for scale" before measuring. You end up writing joins and integrity checks in app code without ever needing the scale.`,
      `Modeling DynamoDB or Cassandra like SQL, one table per entity. Every screen then needs several round trips or a scan.`,
      `Believing NoSQL has no schema. The schema moves into app code, and old items keep old shapes forever.`,
      `Running analytics on the operational NoSQL table. Scans burn capacity that live traffic needs; export to a columnar store.`
    ],
    rule: `Start with a relational database, and move a workload out only when you can name the access pattern or the scale it cannot serve.`,
    signals: [
      `Writes outgrow the biggest primary and the data is append-only → move that workload to wide-column or key-value.`,
      `A new DynamoDB index ships every sprint → the access patterns are not stable; this data belongs in SQL.`,
      `A rule spans many records (balances, stock across warehouses) → relational, or distributed SQL at scale.`,
      `Most queries aggregate months of events → a columnar store, not either of these.`
    ],
    interview: [
      `List the access patterns. Which one would break a key-value model?`,
      `How would you serve a query that does not include the partition key?`,
      `Where are the multi-record invariants, and what enforces them?`
    ],
    related: [`d2`, `d4`, `t1`],
    deep: [`sharding-consistent-hashing`],
    db: [`relational`, `key-value`, `wide-column`],
    sources: [
      { t: `NoSQL design for DynamoDB`, by: `Amazon DynamoDB docs`, url: `https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-general-nosql-design.html` },
      { t: `Data modeling: introduction`, by: `Apache Cassandra docs`, url: `https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/intro.html` },
      { t: `Upgrading GitHub.com to MySQL 8.0`, by: `GitHub Engineering (2023)`, url: `https://github.blog/engineering/infrastructure/upgrading-github-com-to-mysql-8-0/` },
      { t: `How Discord Stores Trillions of Messages`, by: `Bo Ingram, Discord (2023)`, url: `https://discord.com/blog/how-discord-stores-trillions-of-messages` }
    ]
  },
  {
    id: `oltp-olap-search`,
    area: `Data`,
    title: `Postgres vs ClickHouse vs OpenSearch`,
    question: `Which engine should serve this query: the transactional database, a columnar analytics store, or a search engine?`,
    summary: `Each engine lays data out for one kind of query. Postgres keeps whole rows for small transactional reads and writes, ClickHouse keeps compressed columns for scanning and aggregating billions of rows, and OpenSearch keeps an inverted index for text search and ranking. You usually write to Postgres and feed copies to the other two.`,
    why: `Run dashboards on the primary and big scans slow down checkout. Make ClickHouse or OpenSearch the source of truth and you lose transactions, cheap updates and a clean copy to rebuild from.`,
    options: [
      {
        name: `Postgres (OLTP)`,
        what: `A row store: each row's columns sit together on 8 kB pages, and B-tree indexes find a row in a few page reads. MVCC lets reads and writes run at the same time, and the write-ahead log makes each commit durable. It is built for many small transactions that each touch a few rows.`,
        pros: [
          `It is a safe system of record: transactions and constraints mean a write commits fully or not at all.`,
          `Lookups and short range reads on indexed columns are fast, because a B-tree finds the rows without scanning the table.`,
          `A query on the primary sees every write committed before it started, which no downstream copy can promise.`,
          `It covers small versions of the other jobs: <code>GROUP BY</code> over modest data, and full-text search with <code>tsvector</code> and GIN indexes.`
        ],
        cons: [
          `Large aggregates read whole rows, because the row layout cannot skip the columns a query does not use.`,
          `A long report on the primary competes with live traffic for CPU, memory and I/O, and keeps old row versions alive that vacuum cannot remove yet.`,
          `Built-in text search has basic ranking; typo tolerance needs the <code>pg_trgm</code> extension, and relevance tuning is limited.`
        ],
        pick: `Pick it for the system of record and for any query that touches a few rows and must see the latest committed data: checkout, balances, profile edits, admin lookups.`,
        avoid: `Avoid heavy dashboards and free-text search on the primary. Move reports to a read replica first, then to ClickHouse as scans grow, and move search to OpenSearch.`,
        example: `An online store keeps orders, payments and stock in Postgres, so "reserve the item and record the payment" commits as one transaction.`,
        tools: `PostgreSQL, MySQL, Amazon Aurora, read replicas`
      },
      {
        name: `ClickHouse (OLAP)`,
        what: `A column store: each column is stored and compressed separately, sorted by the table's <code>ORDER BY</code> key. A sparse primary index keeps one entry per 8,192-row granule, so a query skips granules that cannot match and reads only the columns it names. Execution is vectorized and spread across all cores.`,
        pros: [
          `Aggregates over billions of rows are fast, because a query reads only the columns it uses and processes values in batches.`,
          `Storage is small, since values of one type and distribution sit together and compress well.`,
          `Filters on the sorting key skip most data, because the sparse index points to the granules that may match.`,
          `Materialized views can pre-aggregate on insert, so a dashboard reads a small rollup table instead of raw events.`
        ],
        cons: [
          `Inserts must be batched: the docs recommend at least 1,000 rows per insert, ideally 10,000-100,000, because every insert creates a part that background merges must combine.`,
          `Updates and deletes are heavy: a mutation rewrites whole data parts, so frequent row changes cause large write amplification.`,
          `There are no general transactions: an insert is atomic only as a single block, and multi-statement transactions are experimental.`,
          `It is a copy fed by a pipeline, so data lags the source, and dedup engines such as ReplacingMergeTree remove duplicates only during background merges.`
        ],
        pick: `Pick it for analytics over large, mostly append-only data: product events, logs, metrics, usage reports, any "sum or count by day and customer over months" query.`,
        avoid: `Avoid it as a system of record or for data that changes row by row, like order status or balances. Keep that in Postgres and ship changes to ClickHouse.`,
        example: `Uber's 2021 write-up describes moving log analytics from Elasticsearch to ClickHouse: one ClickHouse node ingested about ten times the logs of an Elasticsearch node, and hardware cost fell by more than half.`,
        tools: `ClickHouse, Apache Druid, Apache Pinot, BigQuery, Snowflake, Amazon Redshift`
      },
      {
        name: `OpenSearch (search)`,
        what: `A search engine in which each shard is a Lucene index. An analyzer splits text into terms (tokenize, lowercase, stem), and an inverted index maps each term to the documents that contain it. Matches are scored with BM25 by default. New documents become searchable after a refresh, every second by default.`,
        pros: [
          `Full-text queries are fast, because the inverted index jumps from a word to its documents instead of scanning text.`,
          `Ranking, fuzzy matching, synonyms and highlighting are built in, and they are hard to rebuild in SQL.`,
          `It filters on many fields at once, which suits faceted search (brand, price and rating together) and log exploration.`,
          `It scales out by spreading shards and replicas across nodes.`
        ],
        cons: [
          `It is near real time: a new document is invisible until the next refresh, and shards with no recent searches stop refreshing until searched again.`,
          `You cannot change an existing field's mapping, so a type change means a new index and a full reindex.`,
          `Some aggregations are approximate: <code>terms</code> counts across shards depend on <code>shard_size</code>, and <code>cardinality</code> uses HyperLogLog++.`,
          `Indexing every field costs memory and disk, and clusters need careful shard sizing.`
        ],
        pick: `Pick it when users type free text and expect ranked, typo-tolerant results (product search, help centers, people search), or for interactive log search across many fields.`,
        avoid: `Avoid it as the primary database, and for workloads that are mostly aggregations. Uber left Elasticsearch (the engine OpenSearch was forked from) for logs partly because over 80% of its log queries were aggregations.`,
        example: `A shop indexes products into OpenSearch from Postgres change events, so a search for "wireles headphnes" still returns wireless headphones, ranked by relevance.`,
        tools: `OpenSearch, Elasticsearch, Apache Solr, Typesense, Meilisearch`
      }
    ],
    compare: [
      [`Storage layout`, `Rows on pages, B-tree indexes`, `Compressed columns sorted by key`, `Inverted index of terms`],
      [`Best query`, `Read or change a few rows`, `Aggregate billions of rows`, `Ranked text search, many filters`],
      [`Writes`, `Row by row, transactional`, `Large batches; updates are heavy`, `Bulk indexing, visible after refresh`],
      [`Freshness`, `Visible on commit`, `Lags by pipeline delay`, `About 1 second after indexing`],
      [`Role`, `Source of truth`, `Derived analytics copy`, `Derived search index`],
      [`Scaling`, `Bigger primary, replicas, then shards`, `Shards plus parallel scans`, `Shards and replicas across nodes`]
    ],
    decide: [
      [`Must the read see a write that just committed, or run inside a transaction?`, `Yes → Postgres.`],
      [`Is it an aggregate (count, sum, percentile) over millions of rows or more?`, `Yes → ClickHouse. A read replica is fine while data is small.`],
      [`Do users type free text and expect ranking or typo tolerance?`, `Yes → OpenSearch.`],
      [`Is it log exploration?`, `OpenSearch when people mostly search raw lines; ClickHouse when most queries aggregate.`],
      [`Is a report already slowing the primary?`, `Move it to a read replica today, and to ClickHouse as data grows.`]
    ],
    scenario: {
      title: `Worked example: a marketplace's orders, seller dashboards and search`,
      setup: `Buyers place orders and pay. Sellers want revenue by day and product over two years. Buyers search millions of listings by free text, filtered by price and category.`,
      steps: [
        `Orders and payments need transactions and must read their own writes → Postgres is the source of truth.`,
        `Seller dashboards aggregate two years of order lines. On the primary that scan would fight checkout traffic → stream order changes (CDC) into ClickHouse, sorted by seller and date.`,
        `Listing search needs tokenizing, typo tolerance and ranking → index listings into OpenSearch from the same change stream.`,
        `Set expectations: dashboards and search lag by seconds, while checkout and "my orders" read Postgres.`,
        `Plan rebuilds: both copies can be recreated from Postgres after a mapping change or a pipeline bug.`
      ],
      answer: `Postgres for orders, ClickHouse for seller analytics, OpenSearch for listing search, all fed from Postgres changes. Each engine serves the query its layout is built for, and only Postgres is authoritative.`
    },
    mistakes: [
      `Pointing BI tools at the primary. One heavy report slows checkout for everyone.`,
      `Treating the search index as the source of truth. After a mapping change or a corrupt index there is nothing to rebuild from.`,
      `Sending single-row inserts to ClickHouse. Parts pile up faster than merges; batch them or use async inserts.`,
      `Forcing a refresh on every OpenSearch write. Use <code>refresh=wait_for</code> only on flows that must see the document; forced refreshes create many small segments.`,
      `Using OpenSearch for exact billing numbers. Cross-shard <code>terms</code> counts can be approximate.`
    ],
    rule: `Write to Postgres, copy to ClickHouse for aggregates and to OpenSearch for text search, and never make a copy the source of truth.`,
    signals: [
      `The query is "count or sum by day and customer over months" → ClickHouse.`,
      `Users type free text and expect typo tolerance or ranking → OpenSearch.`,
      `The read must see a write that just committed → the Postgres primary.`,
      `Most log queries are aggregations and the search cluster is expensive → move logs to ClickHouse, as Uber did.`
    ],
    interview: [
      `How does data get from the primary into the analytics store and the search index, and how stale is each copy?`,
      `Why is a column store faster than Postgres for this dashboard query?`,
      `What happens when you must change a field's type in the search index?`
    ],
    related: [`d1`, `d2`, `d6`],
    deep: [`change-data-capture`, `cqrs`],
    db: [`relational`, `columnar`, `search`],
    sources: [
      { t: `Why is ClickHouse so fast?`, by: `ClickHouse docs`, url: `https://clickhouse.com/docs/get-started/about/why-clickhouse-is-so-fast` },
      { t: `Selecting an insert strategy`, by: `ClickHouse docs`, url: `https://clickhouse.com/docs/concepts/best-practices/selecting-an-insert-strategy` },
      { t: `OpenSearch concepts (translog, refresh, segments, BM25)`, by: `OpenSearch docs`, url: `https://docs.opensearch.org/latest/getting-started/concepts/` },
      { t: `Fast and Reliable Schema-Agnostic Log Analytics Platform`, by: `Chao Wang and Xiaobing Li, Uber (2021)`, url: `https://www.uber.com/blog/logging/` }
    ]
  },
  {
    id: `replication-modes`,
    area: `Data`,
    title: `Single-leader vs multi-leader vs leaderless`,
    question: `Where can writes happen, and how do the copies stay in sync?`,
    summary: `Replication keeps copies of data on several nodes, and the real choice is who may accept writes. One leader is simple and conflict-free but has one write node and a failover gap; several leaders give local writes everywhere but concurrent edits conflict; leaderless quorums never fail over but give weaker guarantees and need constant repair.`,
    why: `Choose multi-leader or leaderless without a conflict plan and concurrent writes vanish under last-write-wins. Choose async single-leader while promising zero data loss and a failover can drop recent commits.`,
    options: [
      {
        name: `Single-leader (Postgres, MySQL, Aurora)`,
        what: `One node, the leader or primary, accepts all writes and records them in a log (the WAL in Postgres, the binlog in MySQL). Replicas replay that log in the same order and serve reads. By default the leader does not wait for replicas; in synchronous or semi-synchronous mode a commit waits until at least one replica has the change. If the leader fails, a replica is promoted.`,
        pros: [
          `There are no write conflicts, because every write passes through one node in one order.`,
          `Reads from the leader are always current, and replicas add read capacity and hot standbys.`,
          `Durability is tunable: with synchronous replication in Postgres, a commit is lost only if the primary and the standby crash together.`,
          `Every mainstream relational database supports it, and managed services such as Aurora fail over automatically.`
        ],
        cons: [
          `Write capacity is one node: replicas add reads, not writes.`,
          `Async replicas lag (Postgres says typically under one second when the standby keeps up), so replica reads can be stale.`,
          `Async failover loses the commits that had not shipped yet, in proportion to the lag at that moment.`,
          `Synchronous mode adds at least one round trip to every commit, and commits wait if the required standby is down.`,
          `Writes fail until a replica is promoted, and without fencing a bad promotion can leave two leaders.`
        ],
        pick: `The default for nearly every OLTP system, including multi-region apps that send each write to one home region.`,
        avoid: `Avoid it when users in several regions need fast local writes, or when one node cannot take the write rate. Then consider sharding (one leader per shard), multi-leader or leaderless.`,
        example: `GitHub runs 50+ MySQL clusters, each a primary plus replicas, serving 5.5 million queries per second (2023).`,
        tools: `PostgreSQL streaming replication, MySQL replication, Amazon RDS and Aurora, MongoDB replica sets`
      },
      {
        name: `Multi-leader`,
        what: `Several nodes accept writes, usually one leader per region or per device, and each forwards its changes to the others asynchronously. Two leaders can change the same record at the same moment, so you need a conflict rule: last writer wins by timestamp, keep both versions for the app to merge, or use data types that merge on their own (CRDTs).`,
        pros: [
          `Writes are local in every region, so users skip a cross-region round trip.`,
          `Each region keeps taking writes when cut off from the others, and catches up when the link returns.`,
          `A failed region needs no promotion: traffic moves to a region that already takes writes.`,
          `Offline-first apps fit: each device writes locally and syncs later, as CouchDB replication allows.`
        ],
        cons: [
          `Concurrent writes to one record conflict, and last writer wins keeps one and silently drops the other.`,
          `Keeping both versions pushes merging into the app: CouchDB stores the losing revisions in <code>_conflicts</code> for you to resolve.`,
          `Global rules break: two regions can both sell the last seat or both accept the same username.`,
          `Transactions are local: in DynamoDB global tables a transaction is atomic only in its own Region, and other Regions can see it partly applied.`
        ],
        pick: `Pick it when each region must write locally and survive isolation, and the data rarely conflicts (users mostly write in one region) or merges cleanly (sets, CRDT counters, per-field edits).`,
        avoid: `Avoid it for data with global invariants: balances, stock, unique names. Send those writes to one home region, or use a strongly consistent multi-region store.`,
        example: `DynamoDB global tables in their default MREC mode accept writes in every Region, replicate typically within a second, and resolve concurrent edits by last writer wins per item.`,
        tools: `DynamoDB global tables, CouchDB and PouchDB, CRDT libraries (Automerge, Yjs)`
      },
      {
        name: `Leaderless quorum (Cassandra, ScyllaDB, Riak)`,
        what: `No node is the leader. A coordinator sends each write to all N replicas of a key and calls it done after W acknowledge; a read asks R replicas and keeps the newest version. If W + R &gt; N, the replicas read overlap the replicas written. Replicas that missed writes catch up through hinted handoff, read repair and anti-entropy repair with Merkle trees.`,
        pros: [
          `There is no failover step: when a replica dies the others still form a quorum, so reads and writes continue.`,
          `Consistency is chosen per request, such as <code>ONE</code> for fast telemetry writes and <code>QUORUM</code> where reads must see the last write.`,
          `It spans datacenters well, with <code>LOCAL_QUORUM</code> keeping each request inside one datacenter.`,
          `Writes stay available through failures: Dynamo's sloppy quorum writes to the next healthy node and hands the data back later.`
        ],
        cons: [
          `Conflicts resolve by last write wins per cell, by timestamp, so clock skew can let an older write win.`,
          `Quorums are not transactions: Cassandra offers compare-and-set only inside one partition.`,
          `A sloppy quorum may write outside the key's usual replicas, so W + R &gt; N does not guarantee that a read sees the latest write.`,
          `Repair is your job: replicas drift without it, and tombstones must outlive <code>gc_grace_seconds</code> (10 days by default) or deleted data comes back.`
        ],
        pick: `Pick it for very high write volume across nodes and datacenters, where staying writable beats always reading the newest value: telemetry, messages, activity logs.`,
        avoid: `Avoid it when you need transactions, uniqueness or strictly ordered updates to one record. Use single-leader, or a consensus-based database such as CockroachDB.`,
        example: `Discord stored messages in Cassandra, reading and writing at quorum, partitioned by channel and time bucket, before moving to ScyllaDB in 2022.`,
        tools: `Apache Cassandra, ScyllaDB, Riak KV, Amazon Keyspaces`
      }
    ],
    compare: [
      [`Who accepts writes`, `One leader`, `One leader per region or device`, `Any replica, with quorums`],
      [`Write conflicts`, `None`, `Yes; needs a merge rule`, `Yes; last write wins per cell`],
      [`On node or region failure`, `Promote a replica; brief write outage`, `Other leaders keep writing`, `Quorum continues; no failover`],
      [`Read freshness`, `Leader current; replicas lag`, `Remote edits arrive later`, `Tunable; quorum reads usually current`],
      [`Remote write latency`, `Cross-region round trip`, `Local`, `Local with LOCAL_QUORUM`],
      [`Transactions`, `Full, on the leader`, `Local to one leader`, `Single-partition compare-and-set`]
    ],
    decide: [
      [`Can one node take all writes for the next few years?`, `Yes → Single-leader, with replicas for reads.`],
      [`Must users far from the leader get fast writes?`, `Yes → Route each user to a home-region leader; multi-leader only for mergeable data.`],
      [`Would two concurrent edits to one record be a correctness bug?`, `Yes → Single-leader or consensus. No merge rule fixes a double-sold seat.`],
      [`Is it write-heavy, append-like and fine with slightly stale reads?`, `Yes → Leaderless quorum.`],
      [`Is losing the last seconds of commits on failover unacceptable?`, `Yes → Synchronous or semi-synchronous replication to at least one replica.`]
    ],
    scenario: {
      title: `Worked example: profiles and a wallet for users in the US, EU and India`,
      setup: `Users in three regions edit profiles and settings. A wallet ledger records top-ups and spends and must never go negative. Product wants fast writes for everyone.`,
      steps: [
        `Sort the data by how bad a conflict is. Two profile edits can merge or let the last write win; two spends on one wallet cannot.`,
        `Profiles: multi-leader with last writer wins per field, or home-region writes. A lost edit is annoying, not a financial bug.`,
        `Wallet: each spend checks the balance, so its writes need one order. Use a single leader per user in the user's home region, with synchronous replication to a nearby standby.`,
        `Most users write from home, so latency stays low; a traveler pays one cross-region round trip on payments, which is acceptable.`
      ],
      answer: `Single-leader per home region for the wallet, multi-leader or home-region routing for profiles. Let conflicts pick the mode: allow concurrent writers only where a merge rule is acceptable.`
    },
    mistakes: [
      `Assuming async replication loses nothing. On failover, commits that had not shipped are gone.`,
      `Using last-write-wins for balances or counters. Concurrent updates overwrite each other and money disappears.`,
      `Reading from a replica right after a write. The user sees old data; read from the leader for that session.`,
      `Treating W + R &gt; N as linearizable. Sloppy quorums, concurrent writes and clock skew still return stale or lost values.`,
      `Skipping repair in a leaderless cluster. Replicas drift, and deleted rows return if a replica misses a tombstone for longer than <code>gc_grace_seconds</code>.`
    ],
    rule: `Use single-leader until you can show that one write node or one write region is the bottleneck, and allow concurrent writers only for data with a safe merge rule.`,
    signals: [
      `Users on several continents complain about write latency → home-region routing first; multi-leader only for mergeable data.`,
      `Losing the last seconds of writes on failover is unacceptable → synchronous or semi-synchronous replication.`,
      `Reads right after writes return old data → replica lag; read from the leader for that session.`,
      `Deleted rows reappear in Cassandra → repair did not finish within <code>gc_grace_seconds</code>.`
    ],
    interview: [
      `What happens to commits that reached the leader but not the replicas when the leader dies?`,
      `Two regions update the same record at once. What does your system keep?`,
      `Why does W + R &gt; N not give you transactions?`,
      `How do you prevent two leaders after a failover?`
    ],
    related: [`t10`, `t8`, `r5`],
    deep: [`leader-election-fencing`],
    db: [`relational`, `key-value`, `wide-column`],
    sources: [
      { t: `Log-Shipping Standby Servers (streaming and synchronous replication)`, by: `PostgreSQL documentation`, url: `https://www.postgresql.org/docs/current/warm-standby.html` },
      { t: `How DynamoDB global tables work`, by: `Amazon DynamoDB docs`, url: `https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2globaltables_HowItWorks.html` },
      { t: `Dynamo: replication and tunable consistency`, by: `Apache Cassandra docs`, url: `https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html` },
      { t: `Dynamo: Amazon's Highly Available Key-value Store (SOSP 2007)`, by: `Giuseppe DeCandia et al., Amazon`, url: `https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf` }
    ]
  },
  {
    id: `consistency-levels`,
    area: `Data`,
    title: `Strong vs read-your-writes vs eventual consistency`,
    question: `How fresh must each read be, and who must see a write right away?`,
    summary: `Consistency is what a read may return after a write. Strong (linearizable) reads always see the latest write but need coordination and can stall during partitions; read-your-writes only guarantees that people see their own changes; eventual only promises that copies converge once writes stop. Each step down is cheaper, faster and more available.`,
    why: `Too weak on a money path and two requests both read the old balance and overspend. Too strong everywhere and every read pays leader or quorum latency, and fails during partitions, for no user benefit.`,
    options: [
      {
        name: `Strong (linearizable)`,
        what: `The system acts as if there were one copy: once a write completes, every later read from any client returns it or something newer. Jepsen's definition is that operations appear to take effect atomically, in an order consistent with real time. Systems get there by reading from the current leader, using majority quorums, or running consensus such as Raft.`,
        pros: [
          `Locks, leader election, uniqueness checks and compare-and-set are correct, because every client agrees on one latest value.`,
          `Code is simpler, since nothing has to handle stale data.`,
          `Flows across services work: after a write, another service that reads immediately sees it.`,
          `Many stores offer it per request, such as DynamoDB's <code>ConsistentRead</code> on tables.`
        ],
        cons: [
          `Reads cost more: DynamoDB strong reads cost twice as much as eventual ones, and Cosmos DB strong reads use two replicas, halving read throughput.`,
          `Latency grows with distance: Cosmos DB writes with strong consistency across regions take about two round trips between the farthest regions.`,
          `It cannot stay fully available: during a network partition some nodes must refuse requests rather than return stale data.`,
          `Not everything supports it: DynamoDB global secondary indexes are always eventually consistent.`
        ],
        pick: `Pick it where a stale read causes a wrong decision: locks, leader election, uniqueness (one username, one seat), stock and balance checks, and reads that follow another service's write.`,
        avoid: `Avoid it for feeds, counters, recommendations, analytics and search, where seconds of lag are invisible. Use eventual there and save the cost.`,
        example: `Amazon S3 became strongly consistent for GET, PUT and LIST in December 2020 at no extra charge, so a job can list a bucket and see objects it just wrote.`,
        tools: `Postgres or MySQL primary reads, DynamoDB ConsistentRead, etcd, ZooKeeper, Spanner, CockroachDB`
      },
      {
        name: `Read-your-writes or causal`,
        what: `Session guarantees: after you write, your own later reads include that write, and your reads never go back in time (monotonic reads). Causal consistency adds that anyone who sees an effect also sees its cause, so a reply never shows up without the post it answers. Other users may still see older data for a while.`,
        pros: [
          `It fixes the most visible bug, "I saved it and it disappeared", without global coordination.`,
          `Reads can still use nearby replicas once they have caught up to the session's last write; Cosmos DB does this with a session token and retries another replica if needed.`,
          `It stays available during partitions as long as clients stick to the same server (Jepsen calls this sticky available).`,
          `It is widely offered: session is Cosmos DB's most used level, and MongoDB has causally consistent sessions.`
        ],
        cons: [
          `It covers one session only: another user, or the same user on a new device, can still read stale data.`,
          `You must carry state, such as a session token or the last write's log position, through every hop that reads.`,
          `Sticky routing hurts load balancing and breaks when a node fails and the client moves.`,
          `In MongoDB, all four causal guarantees survive failures only with majority read and write concern, which costs latency.`
        ],
        pick: `Pick it for user flows where people must see their own changes at once: settings, profile edits, posting a comment, a cart, an order just placed.`,
        avoid: `Avoid relying on it when other users or services must see the change at once, such as a payment another service checks. Use strong reads there.`,
        example: `With Postgres replicas, store the primary's <code>pg_current_wal_lsn()</code> after a user's write, and read from a replica only once its <code>pg_last_wal_replay_lsn()</code> has passed it. Or set <code>synchronous_commit = remote_apply</code>, which makes commits wait until the standby has applied them.`,
        tools: `Cosmos DB session consistency, MongoDB causal sessions, Postgres remote_apply, sticky sessions`
      },
      {
        name: `Eventual`,
        what: `Replicas apply writes in the background, and if writes stop, all copies converge. Until then a read may return an older value, and two reads in a row can even go backwards. Vogels calls the time between a write and the moment every reader sees it the inconsistency window.`,
        pros: [
          `It is the cheapest read: one nearby replica answers, and DynamoDB eventual reads cost half as much as strong ones.`,
          `It is the most available: any replica can answer, even during a partition.`,
          `It is often fresh in practice: DynamoDB index updates normally propagate within a fraction of a second.`,
          `It is the natural model for derived data: caches, search indexes, analytics copies and read models.`
        ],
        cons: [
          `Users can see old data, and a refresh can show older data than the page before it.`,
          `Check-then-act on a stale read breaks: "if the balance is enough, spend" overspends.`,
          `The window has no fixed bound: DynamoDB warns that failures can delay propagation, so code must not assume a number.`,
          `You need reconciliation jobs and a UI that tolerates lag, such as "processing" states.`
        ],
        pick: `Pick it for data where lag is harmless: like and view counts, feeds, recommendations, search results, dashboards and caches.`,
        avoid: `Avoid it for any read that decides money, stock, access or uniqueness. Read those from the leader or with a strong read.`,
        example: `Azure Cosmos DB's docs list retweet counts, likes and non-threaded comments as typical eventual-consistency data.`,
        tools: `DynamoDB default reads and GSIs, Cassandra at ONE, async read replicas, caches, search indexes`
      }
    ],
    compare: [
      [`Guarantee`, `Every read sees the latest write`, `You see your own writes`, `Copies converge once writes stop`],
      [`Who sees a write at once`, `Everyone`, `The writer's session`, `No one is guaranteed`],
      [`Read path`, `Leader, quorum or consensus`, `Replica caught up to session`, `Any replica`],
      [`Cost and latency`, `Highest; cross-region round trips`, `Near eventual`, `Lowest`],
      [`During a partition`, `Some nodes refuse requests`, `Available if clients stick`, `Fully available`],
      [`Typical data`, `Balances, locks, unique names`, `Settings, carts, own posts`, `Likes, feeds, search, caches`]
    ],
    decide: [
      [`Would acting on a stale value lose money, oversell or break uniqueness?`, `Yes → Strong for that read, plus a transaction or conditional write.`],
      [`Does another user or service read the value right after it is written?`, `Yes → Strong. Session guarantees do not cover other readers.`],
      [`Does only the writer need to see the change at once?`, `Yes → Read-your-writes.`],
      [`Is the data derived (cache, index, counter, analytics)?`, `Yes → Eventual, with reconciliation for drift.`]
    ],
    scenario: {
      title: `Worked example: consistency per screen in a ticketing app`,
      setup: `Users browse events, view seat maps, buy tickets and leave reviews. A seat must never be sold twice. The app uses a Postgres primary with read replicas.`,
      steps: [
        `List each read and ask what a stale value would cost.`,
        `Buying a seat: a stale "available" means a double sale → strong. Check and reserve in one transaction on the primary, or with a conditional update.`,
        `"My tickets" after buying: the buyer must see the ticket and nobody else cares → read-your-writes, by reading from the primary for a short time or waiting for the replica's LSN.`,
        `Listings, review counts and search: seconds of lag are harmless → eventual, from replicas and the search index.`,
        `Seat map while browsing: eventual is fine, because checkout re-checks on the primary.`
      ],
      answer: `Strong only for the purchase decision, read-your-writes for the buyer's own pages, eventual for the rest. Consistency is chosen per read, not per database.`
    },
    mistakes: [
      `Choosing one level for the whole system. Either everything pays strong-read costs or money paths run on stale data.`,
      `Reading strongly, then writing in a separate step. Another request can change the value in between; use a transaction or a conditional write.`,
      `Reading your own write from a replica. The change seems to vanish, users retry, and duplicates appear.`,
      `Assuming DynamoDB reads are strong by default. They are eventual unless <code>ConsistentRead</code> is set, and GSIs are always eventual.`,
      `Hard-coding a replication delay with a sleep. The window grows under load and failure.`
    ],
    rule: `Pick the weakest level each read can tolerate, and make the few money, stock and uniqueness decisions strongly consistent.`,
    signals: [
      `A stale read could cause a double spend or a duplicate unique record → strong, plus a transaction or conditional write.`,
      `Users report "I saved it but it disappeared" → add read-your-writes for that session.`,
      `Data crosses services through events → it is eventual whether you like it or not; design the UI for lag.`,
      `Strong reads dominate latency or cost → move display-only reads to eventual.`
    ],
    interview: [
      `For this read, what is the worst thing a stale value could cause?`,
      `How do you give users read-your-writes when reads go to replicas?`,
      `What does your store do with strong reads during a network partition?`,
      `Why is a strongly consistent read alone not enough to prevent overselling?`
    ],
    related: [`t1`, `t2`, `t5`, `t8`],
    deep: [`cqrs`, `leader-election-fencing`],
    db: [`relational`, `key-value`, `distributed-sql`],
    sources: [
      { t: `Linearizability (and the related models on the same map)`, by: `Jepsen`, url: `https://jepsen.io/consistency/models/linearizable` },
      { t: `Eventually Consistent - Revisited`, by: `Werner Vogels (2008)`, url: `https://www.allthingsdistributed.com/2008/12/eventually_consistent.html` },
      { t: `Consistency level choices`, by: `Azure Cosmos DB docs`, url: `https://learn.microsoft.com/en-us/azure/cosmos-db/consistency-levels` },
      { t: `DynamoDB read consistency`, by: `Amazon DynamoDB docs`, url: `https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.ReadConsistency.html` }
    ]
  },
  {
    id: `sharding-keys`,
    area: `Data`,
    title: `Hash vs range vs tenant or directory-based sharding`,
    question: `How should rows be assigned to shards so load spreads evenly and the common queries hit one shard?`,
    summary: `A shard key decides which node owns each row, and every scheme trades even load against query locality. Hashing spreads writes evenly but turns range queries into scatter-gather; ranges keep neighbors together for scans but send monotonic keys to one hot shard; tenant or directory sharding keeps each customer together and movable, at the cost of a lookup table and uneven shard sizes.`,
    why: `The shard key is one of the hardest choices to undo. A bad key gives you a hot shard that caps throughput, or queries that must ask every shard, and fixing it means moving most of the data.`,
    options: [
      {
        name: `Hash of a key`,
        what: `Hash the key (user_id, order_id) and map the hash to a shard. To avoid moving everything when shards are added, systems hash into many fixed slots or ring ranges and assign those to nodes. Redis Cluster uses 16,384 slots (CRC16 of the key mod 16384), and Dynamo and Cassandra use consistent hashing with virtual nodes.`,
        pros: [
          `Load spreads evenly even for sequential keys, because neighboring values hash to different shards.`,
          `A lookup by the key goes to exactly one shard.`,
          `Adding a node moves only some slots or ring ranges; with consistent hashing a node's arrival affects only its neighbors.`,
          `Any client can compute the owner from the key and a small slot map.`
        ],
        cons: [
          `Range queries scatter: "orders from the last hour" must ask every shard, because hashing destroys key order.`,
          `Queries on other fields are scatter-gather too, and MongoDB notes these do not scale linearly as shards are added.`,
          `A single hot key still lands on one shard; hashing spreads keys, not the traffic to one key.`,
          `Plain <code>hash(key) mod N</code> remaps almost every key when N changes, so use slots or consistent hashing from day one.`
        ],
        pick: `Pick it when access is mostly by one ID and you want even load without tuning: profiles, sessions, carts, messages by conversation.`,
        avoid: `Avoid it when the main queries are ranges over the key, like time windows. Range-shard instead, or hash an entity ID and keep time as the sort order inside it.`,
        example: `DynamoDB hashes each item's partition key to pick a partition, and each partition serves at most 3,000 read units and 1,000 write units per second, so the key must spread traffic.`,
        tools: `Redis Cluster, Cassandra, DynamoDB, MongoDB hashed sharding`
      },
      {
        name: `Range of a key`,
        what: `Each shard owns a contiguous key range, such as names A to F or one week of timestamps. A router keeps the range map and sends each query to the shards whose ranges overlap it. A range that grows too big or too busy splits in two: CockroachDB splits ranges at 512 MiB by default and also splits ranges under heavy load.`,
        pros: [
          `Range scans touch only the shards covering the range, so "events for device 7 last week" stays local.`,
          `Data stays sorted across shards, which helps ordered pagination and time-window reads.`,
          `Splits follow the data: hot or large ranges split automatically instead of you choosing a shard count.`,
          `Old ranges can be archived or dropped as a unit, which suits retention by time.`
        ],
        cons: [
          `A monotonic key makes one hot shard: if the key always grows (a timestamp, a sequence), every insert goes to the last range.`,
          `Skewed key values give uneven shards unless ranges keep splitting and moving.`,
          `Routers must cache the range map and refresh it as ranges move.`,
          `Fixing hot spots takes key design: Spanner's guide suggests swapping key order, a hashed shard prefix or bit-reversed sequences.`
        ],
        pick: `Pick it when the main queries read contiguous ranges, like time series per device or sorted listings, with a non-monotonic leading key (device_id before timestamp).`,
        avoid: `Avoid it with a monotonically increasing leading key. Lead with an entity ID, add a hashed prefix, or use hash sharding.`,
        example: `Spanner splits tables by key range, so its docs warn that a timestamp-first primary key sends every insert to one server.`,
        tools: `CockroachDB, Spanner, TiDB, HBase, Bigtable, MongoDB ranged sharding`
      },
      {
        name: `Tenant or directory-based`,
        what: `Every row carries a tenant key (workspace_id, account_id), and a directory, a lookup table, maps each tenant to a shard. A tenant's queries go to one shard, where joins and transactions work as usual. Because the mapping is data, you can move a tenant, or give a huge one its own shard, by copying its rows and updating the directory.`,
        pros: [
          `Nearly every query in a B2B app filters by tenant, so nearly every query hits one shard.`,
          `Joins, foreign keys and transactions work within a tenant, because Citus co-locates all of a tenant's tables on one node.`,
          `Big tenants can be isolated: Citus can move a large tenant to its own shard and node.`,
          `Many logical shards on fewer servers make growth easy: Notion runs 480 logical shards on 32 databases, and 480 divides evenly into many host counts.`
        ],
        cons: [
          `Tenants differ in size by orders of magnitude, so shards are uneven and one tenant can outgrow a shard, as Slack's largest customers did.`,
          `Cross-tenant queries, such as admin reports, hit every shard, and features that span tenants (Slack Connect) break the model.`,
          `The directory sits on every request path, so it must be cached and highly available.`,
          `Moving a tenant is a live migration: copy, catch up, switch the directory, and handle writes during the cutover.`
        ],
        pick: `Pick it for multi-tenant SaaS where nearly every query is scoped to one customer and you want per-customer isolation.`,
        avoid: `Avoid it when one tenant can exceed a shard or features cross tenants often. Shard those tables by a finer key, as Slack did with channel IDs on Vitess.`,
        example: `Notion shards Postgres by workspace ID: every block belongs to one workspace, and 480 logical shards live as schemas on 32 physical databases (2021).`,
        tools: `Citus, Vitess, a directory table or service`
      }
    ],
    compare: [
      [`Load spread`, `Even across keys`, `Uneven with skewed or monotonic keys`, `Uneven; tenants differ in size`],
      [`Point lookup`, `One shard`, `One shard`, `One shard after a directory lookup`],
      [`Range scan on key`, `Every shard`, `Only overlapping shards`, `Within one tenant`],
      [`Rebalancing`, `Move slots or ring ranges`, `Split and move ranges`, `Move tenants, update the directory`],
      [`Typical failure`, `One hot key`, `Hot newest range`, `Tenant outgrows its shard`],
      [`Routing metadata`, `Slot map, computed from key`, `Range map, cached by routers`, `Directory read on every request`]
    ],
    decide: [
      [`Do nearly all queries filter by one tenant or account?`, `Yes → Tenant or directory-based, with a plan for the biggest tenant.`],
      [`Are the main queries ranges over the key (time windows, sorted lists)?`, `Yes → Range, with an entity ID leading so new writes spread.`],
      [`Is access mostly by one ID, with no range queries?`, `Yes → Hash, using slots or consistent hashing.`],
      [`Is the natural key monotonic (timestamp, sequence)?`, `Yes → Never range-shard on it alone; hash it or lead with another column.`],
      [`Can one entity be bigger or hotter than a shard?`, `Yes → Split it with a finer key or a salt suffix, or give it its own shard through a directory.`]
    ],
    scenario: {
      title: `Worked example: sharding a B2B helpdesk`,
      setup: `A helpdesk SaaS serves 20,000 companies. Agents list their company's tickets by recent activity. One enterprise customer owns 30% of all tickets, and the data no longer fits one Postgres primary.`,
      steps: [
        `List the queries: nearly all filter by company_id; a few admin reports cross companies.`,
        `Hash on ticket_id spreads load, but "my company's open tickets" would hit every shard → no.`,
        `Range on created_at sends every new ticket to the newest shard → no.`,
        `Shard by company_id through a directory: a company's tickets, comments and users live together, so joins and transactions still work.`,
        `Give the enterprise customer its own shard through the directory, and serve admin reports from an analytics copy instead of fanning out.`
      ],
      answer: `Tenant sharding by company_id, with a directory so the biggest customer gets a dedicated shard. The key matches how nearly every query filters, and the directory is the escape hatch for skew.`
    },
    mistakes: [
      `Sharding on a timestamp or auto-increment ID. Every insert hits the last shard while the rest sit idle.`,
      `Using <code>hash(key) mod N</code>. Adding one shard remaps almost every key.`,
      `Choosing a key the main queries do not filter on. Every request becomes scatter-gather, as slow as the slowest shard.`,
      `Ignoring the one huge tenant or hot key. Its shard caps the whole system.`,
      `Creating exactly one shard per server. Use many logical shards per server so you can rebalance without re-splitting data.`
    ],
    rule: `Shard by the key that almost every query already filters on, and keep a directory or slot map so you can move the one huge customer later.`,
    signals: [
      `One customer sends most of the traffic → give them a dedicated shard through the directory.`,
      `Writes pile onto the newest shard → the key is monotonic; hash it or lead with another column.`,
      `Most queries fan out to every shard → the key does not match the queries; rethink it before adding nodes.`,
      `One key stays hot after sharding → add a suffix to spread it, as DynamoDB's write-sharding guide shows, or cache it.`
    ],
    interview: [
      `What is the shard key, and what share of queries include it?`,
      `How do you add a shard without moving most of the data?`,
      `What happens when your largest tenant outgrows its shard?`,
      `How do you serve a query that lacks the shard key?`
    ],
    related: [`d3`, `d4`, `d5`, `d8`],
    deep: [`sharding-consistent-hashing`],
    db: [`relational`, `distributed-sql`, `key-value`],
    sources: [
      { t: `Choose a Shard Key`, by: `MongoDB docs`, url: `https://www.mongodb.com/docs/manual/core/sharding-choose-a-shard-key/` },
      { t: `Herding elephants: Lessons learned from sharding Postgres at Notion`, by: `Garrett Fidalgo, Notion (2021)`, url: `https://www.notion.com/blog/sharding-postgres-at-notion` },
      { t: `Scaling Datastores at Slack with Vitess`, by: `Slack Engineering (2020)`, url: `https://slack.engineering/scaling-datastores-at-slack-with-vitess/` },
      { t: `Multi-tenant Applications`, by: `Citus documentation`, url: `https://docs.citusdata.com/en/stable/use_cases/multi_tenant.html` }
    ]
  },
  {
    id: `normalize-denormalize`,
    area: `Data`,
    title: `Normalize vs denormalize`,
    question: `Should each fact be stored once and joined at read time, or copied to where it is read?`,
    summary: `Normalizing stores each fact once and joins at read time, so writes are simple and copies cannot disagree. Denormalizing copies facts into the rows that are read together, so reads are cheap but every change must reach every copy. Materialized views and read models keep the normalized source and derive the copies, trading refresh lag for both benefits.`,
    why: `Copy the wrong field and copies drift: two screens show different prices and someone writes a reconciliation job. Normalize a hot path that joins five tables per request and that join sets your latency floor.`,
    options: [
      {
        name: `Normalized`,
        what: `Each fact lives in one row, and other tables point to it by key: an order holds customer_id, not the customer's name and address. Foreign keys and unique constraints keep references valid. Reads that need the full picture join tables at query time, and indexes on the join keys keep that cheap.`,
        pros: [
          `An update touches one row, so a new email is correct everywhere at once.`,
          `Copies cannot disagree, because there are no copies.`,
          `New questions are easy, since tables join in ways nobody planned; AWS notes that a normalized relational model can be built without knowing the access patterns.`,
          `Storage stays small, because large values are not repeated in every row.`
        ],
        cons: [
          `Reads pay for joins: a page that needs five tables does five lookups or a join on every request.`,
          `Once data is sharded, joins across shards become slow or impossible.`,
          `Stores without joins, such as Cassandra and DynamoDB, turn a normalized model into many round trips.`,
          `History is lost if you only reference live data: when a product's price changes, old orders that point to it show the new price.`
        ],
        pick: `The default for the source of truth: users, accounts, orders, inventory, anything that changes and must be right everywhere.`,
        avoid: `Avoid it on a hot read path where a measured join is the bottleneck, and in stores without joins. Add a derived read model or copied fields there.`,
        example: `A billing system keeps each customer's plan in one customers row; invoices, usage and the admin panel join to it, so a plan change is one update.`,
        tools: `PostgreSQL, MySQL, foreign keys, unique constraints`
      },
      {
        name: `Denormalized (copied fields, precomputed rows)`,
        what: `Copy the fields a read needs into the row or document that is read: the author's name on each comment, order lines embedded in the order document, or one Cassandra table per query. Every write must then update all copies, in the same transaction, from events, or in a background job.`,
        pros: [
          `Reads are one lookup with no joins, so latency stays flat as data grows.`,
          `It fits stores without joins: Cassandra's docs say data is duplicated across tables so that each query reads one table.`,
          `Snapshots are correct by design: the price and address at purchase time must not change, and MongoDB's guide calls such data safe to duplicate.`,
          `Embedded data updates atomically with its parent, since a single-document write is atomic in MongoDB.`
        ],
        cons: [
          `Each change must reach every copy, so writes slow down and grow more complex as copies multiply.`,
          `Copies drift when one update path is missed or a job fails, and users see two values for one fact.`,
          `Changing the shape of the data means backfilling every copy.`,
          `Unbounded embedding fails: a list that grows forever bloats the document toward MongoDB's 16 MiB limit.`
        ],
        pick: `Pick it for read-heavy paths with stable copied fields, for stores without joins, and for snapshots that must never change, like an invoice line's price.`,
        avoid: `Avoid copying data that changes often and must be right everywhere, like a customer's current plan or a stock level. Reference it, or derive the copy so it can be rebuilt.`,
        example: `Discord partitions its messages table by channel and time bucket, so "latest messages in this channel" is one partition read with no joins.`,
        tools: `MongoDB embedded documents, DynamoDB single-table design, Cassandra query tables`
      },
      {
        name: `Materialized views or read models`,
        what: `Keep the normalized tables as the source of truth and build a separate, query-shaped copy from them. A database materialized view stores a query's result and is refreshed; a read model (the CQRS idea) is a table or index updated from change events. If a copy goes wrong, you rebuild it from the source.`,
        pros: [
          `Reads get a precomputed shape while the source stays normalized.`,
          `Copies are rebuildable, so a bug in the view is fixed by recomputing it.`,
          `One source can feed several shapes: a dashboard rollup, a search index and a per-user feed.`,
          `Some engines update incrementally: a ClickHouse materialized view runs on each inserted block and writes to a target table.`
        ],
        cons: [
          `Reads lag the source: a Postgres materialized view changes only on <code>REFRESH</code>, which recomputes the whole query.`,
          `<code>REFRESH MATERIALIZED VIEW CONCURRENTLY</code> keeps the view readable but needs a unique index, and is slower when many rows change.`,
          `Insert-triggered views miss changes: ClickHouse incremental views react only to inserts into the source table, not to updates or deletes.`,
          `An event-fed read model is one more pipeline to run, and Fowler warns that CQRS adds risky complexity for most systems.`
        ],
        pick: `Pick it when you need fast reads of joined or aggregated data and can accept refresh lag: dashboards, leaderboards, search, feeds.`,
        avoid: `Avoid it when a read must reflect a write at once, such as checking stock before a sale. Read the source for that path.`,
        example: `The Postgres docs show a <code>sales_summary</code> materialized view over past days' invoices, refreshed nightly, for fast reads where today's data is not needed.`,
        tools: `Postgres materialized views, ClickHouse materialized views, Debezium plus a consumer, Materialize`
      }
    ],
    compare: [
      [`Read cost`, `Joins at read time`, `One lookup`, `One lookup on the derived copy`],
      [`Write cost`, `One row per fact`, `Update every copy`, `Source write plus refresh`],
      [`Freshness`, `Always current`, `Current only if every copy updated`, `Lags until refresh or event`],
      [`Drift risk`, `None`, `High; missed updates`, `Low; rebuild from source`],
      [`Schema change`, `Migrate one table`, `Backfill every copy`, `Recompute the view`],
      [`Best for`, `Source of truth`, `Snapshots, stores without joins`, `Dashboards, feeds, search`]
    ],
    decide: [
      [`Is this the source of truth for a fact that changes?`, `Yes → Normalized.`],
      [`Is the value a snapshot that must never change, like the price at purchase?`, `Yes → Copy it; that is correct, not a hack.`],
      [`Is a join on a hot path the measured bottleneck?`, `Yes → An index first, then a materialized view or read model, hand-kept copies last.`],
      [`Does the store lack joins (DynamoDB, Cassandra)?`, `Yes → Denormalized, one item shape or table per query.`],
      [`Must the read reflect a write instantly?`, `Yes → Read the normalized source, not a derived copy.`]
    ],
    scenario: {
      title: `Worked example: an order page and a seller dashboard`,
      setup: `The order page shows items, prices, the shipping address and seller names. Sellers see daily revenue per product. Product names and prices change often.`,
      steps: [
        `Source of truth: normalized tables for products, sellers, customers, orders and order lines.`,
        `Order lines copy the unit price and product name at purchase time. These are snapshots: the order must show what was bought, even after edits.`,
        `The shipping address is a snapshot on the order; the customer's current address stays in customers.`,
        `Seller names are not snapshots, so the page joins sellers by an indexed key instead of copying them.`,
        `Daily revenue is derived: build it as a materialized view or a ClickHouse rollup fed by order events.`
      ],
      answer: `Normalize the source, copy only true snapshots into orders, and serve the dashboard from a derived view. Every copy is either immutable or rebuildable, so nothing drifts silently.`
    },
    mistakes: [
      `Copying a mutable field, like a customer's tier, into many tables. One update path misses a copy and screens disagree.`,
      `Not copying a snapshot, like an order line's price. A later price change rewrites old invoices.`,
      `Denormalizing before measuring. You pay write fan-out and drift for a join an index would have fixed.`,
      `Building a read model you cannot rebuild. One bad event leaves it wrong for good.`,
      `Embedding unbounded lists in a document. It grows toward the size limit, and every read drags the whole list along.`
    ],
    rule: `Normalize the source of truth, and denormalize only snapshots or derived copies you can rebuild from it.`,
    signals: [
      `The copied value must not change later (an invoice price) → copying is correct.`,
      `The same join tops the slow-query log → add an index, then a materialized view.`,
      `Two screens show different values for one fact → too many hand-kept copies; derive them instead.`,
      `A schema change needs days of backfills → copies have spread too far.`
    ],
    interview: [
      `Which fields here are snapshots, and which must always be current?`,
      `How do you keep a copied field in sync, and how do you repair it when it drifts?`,
      `How stale can the read model get, and what does the user see meanwhile?`
    ],
    related: [`d1`, `d9`, `t6`],
    deep: [`cqrs`, `change-data-capture`],
    db: [`relational`, `document`, `wide-column`],
    sources: [
      { t: `Best Practices for Data Modeling in MongoDB`, by: `MongoDB docs`, url: `https://www.mongodb.com/docs/manual/data-modeling/best-practices/` },
      { t: `Materialized Views`, by: `PostgreSQL documentation`, url: `https://www.postgresql.org/docs/current/rules-materializedviews.html` },
      { t: `Incremental materialized view`, by: `ClickHouse docs`, url: `https://clickhouse.com/docs/concepts/features/materialized-views/incremental-materialized-view` },
      { t: `CQRS`, by: `Martin Fowler`, url: `https://martinfowler.com/bliki/CQRS.html` }
    ]
  },
  {
    id: `id-generation`,
    area: `Data`,
    title: `Auto-increment vs UUIDv4 vs UUIDv7/ULID vs Snowflake`,
    question: `How should primary keys be generated: by a database counter, at random, or time-ordered?`,
    summary: `An ID scheme trades coordination, size, ordering and privacy. Auto-increment is small and ordered but needs one central counter and reveals volume; UUIDv4 needs no coordination but scatters inserts across the index. UUIDv7, ULID and Snowflake put a timestamp first, so any machine can create IDs that still sort roughly by time.`,
    why: `Random keys on a big B-tree table slow inserts and waste pages. Sequential public IDs let anyone count your orders or guess other users' URLs. Changing the key type later means rewriting every foreign key.`,
    options: [
      {
        name: `Auto-increment (bigserial)`,
        what: `The database hands out the next number from a counter (a sequence or identity column in Postgres, <code>AUTO_INCREMENT</code> in MySQL). Values are 8-byte integers that only grow, so new rows land at the right edge of the primary key index. Numbers taken by aborted transactions are never reused, so gaps are normal.`,
        pros: [
          `It is compact: 8 bytes per key, so every foreign key and secondary index that stores it stays small.`,
          `Inserts append to the end of the index, so pages fill densely (InnoDB fills sequentially inserted pages about 15/16 full).`,
          `It is built in, and short numbers are easy to read in logs and support tickets.`
        ],
        cons: [
          `There is one counter in one database: several writers collide unless you split the number space, which is what MySQL's <code>auto_increment_increment</code> and <code>auto_increment_offset</code> are for.`,
          `It leaks business data: anyone can estimate your order volume from two IDs and guess neighbors' URLs.`,
          `The ID exists only after the insert, so clients cannot create it ahead of time for safe retries or offline work.`,
          `Gaps from rollbacks, crashes and <code>ON CONFLICT</code> mean it cannot give gapless invoice numbers.`
        ],
        pick: `Pick it for internal tables in one database whose IDs never leave the system: join tables, audit rows, job queues.`,
        avoid: `Avoid it for public IDs and for rows created in several databases or regions. Use UUIDv7 or Snowflake, or keep it internal next to a random public ID.`,
        example: `A back-office app on one Postgres instance keys its audit_log with <code>bigint GENERATED ALWAYS AS IDENTITY</code> and never shows that ID to customers.`,
        tools: `Postgres identity columns and sequences, MySQL AUTO_INCREMENT`
      },
      {
        name: `UUIDv4 (random)`,
        what: `A 128-bit value with 122 random bits, created anywhere with no coordination (RFC 9562). A collision only becomes likely after about 2^61 IDs, so services, clients and offline devices can all mint IDs. Because the values are random, each insert lands at a random place in a B-tree index.`,
        pros: [
          `There is no coordination: any process, client or device can create an ID, even offline.`,
          `Clients can create the ID before calling the server, so a retried request reuses it instead of creating a duplicate.`,
          `It reveals nothing: no time, no volume, no machine.`,
          `IDs from different databases never clash, so merging data needs no remapping.`
        ],
        cons: [
          `Inserts scatter across the whole index, so the entire index must stay in memory; RFC 9562 says time-ordered UUIDs can improve index locality by an order of magnitude or more.`,
          `Random inserts split pages anywhere, leaving them 1/2 to 15/16 full in InnoDB.`,
          `It takes 16 bytes, twice a bigint, and InnoDB copies the primary key into every secondary index entry.`,
          `IDs have no order, so "newest first" needs a separate created_at index.`
        ],
        pick: `Pick it for IDs created by clients or many services on tables that are small or not insert-heavy, or as a public ID next to an internal key.`,
        avoid: `Avoid it as the primary key of a large, insert-heavy B-tree table. UUIDv7 keeps the benefits with ordered inserts.`,
        example: `Spanner's schema guide recommends UUIDv4 keys on purpose: Spanner splits data by key range, and random keys spread inserts across servers.`,
        tools: `Postgres gen_random_uuid(), Python uuid.uuid4(), Go google/uuid`
      },
      {
        name: `UUIDv7 or ULID (time-ordered)`,
        what: `A 128-bit ID whose first 48 bits are a Unix timestamp in milliseconds, followed by random bits (74 in UUIDv7, 80 in ULID). Later IDs sort later, so inserts land near the right edge of the index, while the random part prevents collisions without coordination. ULID is the same idea written as 26 Crockford base32 characters.`,
        pros: [
          `There is no coordination, as with UUIDv4, but inserts stay near the end of the index, keeping pages dense and the hot set small.`,
          `Sorting by ID gives roughly creation order, which helps pagination and time-range scans.`,
          `It is a standard: RFC 9562 (May 2024) defines UUIDv7 and tells implementations to prefer it over v1 and v6.`,
          `Support is built in: Postgres 18 has <code>uuidv7()</code>, Python 3.14 has <code>uuid.uuid7()</code>, and Go's google/uuid has <code>NewV7</code>.`
        ],
        cons: [
          `It still takes 16 bytes, twice a bigint, in every index that stores the key.`,
          `It reveals creation time to anyone holding the ID; Postgres reads it back with <code>uuid_extract_timestamp()</code>.`,
          `Order is only as good as the clocks: IDs from different machines interleave by clock skew, and order inside one millisecond depends on the generator.`,
          `On range-split stores like Spanner, a time-first key sends new writes to one range, the hot spot that v4 avoids.`
        ],
        pick: `A good default for new tables in distributed systems, and for IDs that clients or services create before inserting.`,
        avoid: `Avoid it where creation time is sensitive (expose a random ID instead), and as the leading key on range-split databases like Spanner.`,
        example: `Postgres 18 (September 2025) added <code>uuidv7()</code>, so <code>id uuid DEFAULT uuidv7() PRIMARY KEY</code> gives time-ordered keys with no extension.`,
        tools: `Postgres 18 uuidv7(), Python 3.14 uuid.uuid7(), Go google/uuid NewV7, ULID libraries`
      },
      {
        name: `Snowflake-style (64-bit: time + worker + sequence)`,
        what: `A 64-bit integer made of milliseconds since a custom epoch, a worker ID and a per-worker sequence. Twitter's original layout used 41 bits of time (about 69 years), 10 bits of machine ID (1,024 machines) and 12 bits of sequence (4,096 IDs per millisecond per machine). Each worker generates IDs alone, so IDs are unique as long as worker IDs are.`,
        pros: [
          `It fits a <code>bigint</code>, half the size of a UUID in every key and index.`,
          `IDs are roughly time-ordered (k-sorted), so inserts append and IDs sort by creation time.`,
          `It sustains high rates with no coordination: 4,096 IDs per millisecond per worker in Twitter's layout.`
        ],
        cons: [
          `Every running process needs a unique worker ID, assigned by config or a coordination service, and a duplicate worker ID means duplicate IDs.`,
          `Clock rollback is dangerous: Twitter's Snowflake refuses to issue IDs until the clock passes the last timestamp it used.`,
          `64-bit IDs exceed JavaScript's safe integer limit (2^53 - 1), so APIs must send them as strings, as Discord does.`,
          `The bit layout is yours to choose, and a bad split (too few worker bits) is hard to change later.`
        ],
        pick: `Pick it when you need compact, time-sortable 64-bit IDs at very high rates, such as messages or events, and can run worker ID assignment.`,
        avoid: `Avoid it if you do not want to manage worker IDs and clocks. UUIDv7 gives most of the benefit with no setup.`,
        example: `Discord IDs are Snowflakes: 42 bits of milliseconds since the first second of 2015, 5 bits of worker, 5 bits of process and a 12-bit increment, sent as strings in JSON.`,
        tools: `Twitter Snowflake (archived), Sony Sonyflake, custom generators`
      }
    ],
    compare: [
      [`Size`, `8 bytes`, `16 bytes`, `16 bytes`, `8 bytes`],
      [`Coordination`, `One database counter`, `None`, `None`, `Unique worker IDs`],
      [`Index inserts`, `Append at the end`, `Random, scattered`, `Near the end`, `Near the end`],
      [`Sorts by time`, `Yes, insert order`, `No`, `Roughly, by millisecond`, `Roughly (k-sorted)`],
      [`Reveals`, `Volume and neighbors`, `Nothing`, `Creation time`, `Creation time and worker`],
      [`Known before insert`, `No`, `Yes`, `Yes`, `Yes`]
    ],
    decide: [
      [`Will the ID appear in public URLs or APIs?`, `Yes → Not auto-increment. Use UUIDv7, UUIDv4 or a separate public ID.`],
      [`Must several databases, regions or clients create IDs independently?`, `Yes → UUIDv7 by default, Snowflake if you need 64 bits.`],
      [`Is the table large and insert-heavy on a B-tree?`, `Yes → Time-ordered keys (UUIDv7, Snowflake, bigint), not UUIDv4.`],
      [`Is the store split by key range (Spanner, Bigtable)?`, `Yes → UUIDv4 or a hashed prefix, so inserts do not all hit one range.`]
    ],
    scenario: {
      title: `Worked example: IDs for an order service in three regions`,
      setup: `Orders are created in three regions and copied to one analytics store. Order IDs appear in emails and URLs, and mobile clients retry on flaky networks. The Postgres orders table grows by millions of rows a day.`,
      steps: [
        `Public IDs rule out auto-increment: anyone could estimate order volume and guess other orders' URLs.`,
        `Three regions must create IDs without talking to each other → a UUID or Snowflake, not a database sequence.`,
        `Retries must reuse the ID → the client or API edge creates it before the insert, which UUIDs make trivial.`,
        `Millions of inserts a day on a B-tree → time-ordered beats random, so UUIDv7 over UUIDv4.`,
        `The order date is on the receipt anyway, so v7 revealing creation time is acceptable.`
      ],
      answer: `UUIDv7, created before the insert. It needs no coordination, makes retries safe, keeps inserts ordered and hides volume; Snowflake is only worth its setup if 64-bit keys matter.`
    },
    mistakes: [
      `Exposing auto-increment IDs in URLs. Outsiders read your growth and enumerate other records.`,
      `Using UUIDv4 as the key of a huge, insert-heavy table. Inserts slow down once the index no longer fits in memory.`,
      `Treating UUIDs as secrets. RFC 9562 says they must not be used as security capabilities; use real access tokens.`,
      `Sending 64-bit IDs as JSON numbers. JavaScript clients round them above 2^53 - 1.`,
      `Reusing a Snowflake worker ID on two hosts, or letting the clock jump back. Both produce duplicate IDs.`
    ],
    rule: `Use UUIDv7 for new distributed tables, bigint identity for internal single-database tables, and never expose sequential IDs publicly.`,
    signals: [
      `IDs appear in public URLs or APIs → not auto-increment.`,
      `Insert speed drops as a UUIDv4-keyed table grows → switch new rows to UUIDv7.`,
      `Clients must create the ID before calling the server → a UUID.`,
      `Key and index size dominate storage at billions of rows → consider 64-bit Snowflake IDs.`
    ],
    interview: [
      `How do two regions create IDs without colliding?`,
      `Why does a random UUID primary key hurt a B-tree, and what fixes it?`,
      `What does your generator do if the clock goes backwards?`
    ],
    related: [`t7`, `d6`, `c10`],
    deep: [`idempotency-keys`],
    db: [`relational`, `distributed-sql`],
    sources: [
      { t: `RFC 9562: Universally Unique IDentifiers (UUIDs)`, by: `IETF (May 2024)`, url: `https://www.rfc-editor.org/rfc/rfc9562.html` },
      { t: `Snowflake README (2010 release)`, by: `Twitter`, url: `https://github.com/twitter-archive/snowflake/tree/snowflake-2010` },
      { t: `ULID specification`, by: `ulid/spec on GitHub`, url: `https://github.com/ulid/spec` },
      { t: `The Physical Structure of an InnoDB Index`, by: `MySQL 8.4 Reference Manual`, url: `https://dev.mysql.com/doc/refman/8.4/en/innodb-physical-structure.html` }
    ]
  },
  {
    id: `btree-vs-lsm`,
    area: `Data`,
    title: `B-tree vs LSM-tree`,
    question: `Should the storage engine update pages in place (B-tree) or append sorted files and merge them later (LSM-tree)?`,
    summary: `Both keep keys sorted, but they pay for writes at different times. A B-tree finds the page for a key and changes it in place, so reads are cheap and steady but each write touches a random page. An LSM-tree buffers writes in memory and flushes sorted files, so writes are cheap and sequential, but reads may check several files and compaction keeps rewriting data.`,
    why: `Put a write-heavy firehose on a B-tree and random page writes cap ingest. Put a read-heavy workload on an LSM and reads check many files while compaction steals I/O and adds latency spikes.`,
    options: [
      {
        name: `B-tree (Postgres, MySQL InnoDB)`,
        what: `Data and indexes are trees of fixed-size pages (8 kB in Postgres, 16 KB in InnoDB). A lookup walks from the root to a leaf in a few page reads. A write changes the leaf page in memory and records the change in the write-ahead log, which is flushed at commit; a full leaf splits, and splits can cascade upward. InnoDB stores rows inside the primary key tree, while Postgres keeps rows in a heap and writes a new row version on every update.`,
        pros: [
          `Reads are predictable: a point lookup costs a few page reads, and the upper levels, under 1% of pages in Postgres, are usually cached.`,
          `Range scans are efficient, because each level of the tree is a sorted, linked list of pages.`,
          `Each key lives in one place, so a read never merges versions from several files.`,
          `It is the default index in Postgres and MySQL, with decades of tooling and tuning behind it.`
        ],
        cons: [
          `Writes are random I/O: each insert or update dirties a page somewhere in the tree, on top of the WAL write.`,
          `Page splits leave pages partly empty, especially with random keys (InnoDB: 1/2 to 15/16 full).`,
          `In Postgres, an update that changes an indexed column adds new entries to every index on the table, unless it qualifies as a HOT update.`,
          `Dead row versions need vacuum in Postgres, and plain VACUUM does not return space to the operating system.`
        ],
        pick: `Pick it for read-heavy and mixed OLTP with point lookups, range scans and updates: the default for almost every application database.`,
        avoid: `Avoid it for sustained, very high ingest of small records (events, metrics, logs), where random writes and index upkeep cap throughput. Use an LSM engine there.`,
        example: `In a typical Postgres app, "user by email" and "orders for a customer by date" are B-tree lookups and range scans that stay fast as tables grow.`,
        tools: `PostgreSQL, MySQL InnoDB, SQLite, SQL Server, Oracle`
      },
      {
        name: `LSM-tree (RocksDB, Cassandra, ScyllaDB)`,
        what: `Writes go to a write-ahead log and an in-memory sorted table (memtable). A full memtable is flushed as an immutable sorted file (SSTable). A read checks the memtable, then files from newest to oldest, using a Bloom filter per file to skip files that cannot hold the key. Background compaction merges files and drops overwritten values and, after a grace period, deleted ones.`,
        pros: [
          `Writes are a sequential log append plus a memory insert, so ingest is high; the original LSM paper targets files with a high rate of inserts.`,
          `Immutable sorted files compress well: Facebook's MyRocks used 50% less storage than compressed InnoDB for its user database.`,
          `Large sequential writes suit flash, and in Facebook's LinkBench tests MyRocks wrote far less to storage than InnoDB.`,
          `Compaction is tunable: leveled compaction favors reads and space, while size-tiered or universal compaction favors writes.`
        ],
        cons: [
          `Point reads may touch several files; Bloom filters skip most of them (about 1% false positives at 10 bits per key), but range scans must merge every level.`,
          `Compaction rewrites data many times: RocksDB's tuning guide works a leveled example with write amplification around 33.`,
          `Compaction competes with live traffic for disk and CPU, and falling behind shows up as latency spikes.`,
          `Deletes are tombstones kept until compaction after a grace period (10 days by default in Cassandra), so delete-heavy data lingers and reads must skip it.`,
          `Old versions stay until compaction, and size-tiered or universal styles need spare disk for merges.`
        ],
        pick: `Pick it for write-heavy workloads (event ingestion, time series, messaging, logs, key-value state) and when storage efficiency on flash matters.`,
        avoid: `Avoid it for read-mostly workloads with many random point reads and few writes, where a B-tree gives lower, steadier latency with no compaction.`,
        example: `Facebook moved its user database (UDB) from InnoDB to MyRocks, MySQL on RocksDB, and cut storage in half compared with compressed InnoDB (2016).`,
        tools: `RocksDB, LevelDB, Cassandra, ScyllaDB, CockroachDB (Pebble), MyRocks, HBase`
      }
    ],
    compare: [
      [`Write path`, `Find the page, change it in place`, `Append to log and memtable`],
      [`Disk write pattern`, `Random page writes plus WAL`, `Sequential file flushes`],
      [`Point read`, `One root-to-leaf walk`, `Memtable plus files; Bloom filters help`],
      [`Range scan`, `Walk sorted leaf pages`, `Merge across files and levels`],
      [`Background work`, `Vacuum in Postgres; page splits`, `Compaction, always running`],
      [`Deletes`, `Remove entry; vacuum reclaims space`, `Tombstones until compaction`],
      [`Space`, `Partly empty pages, bloat`, `Old versions until compaction; compresses well`]
    ],
    decide: [
      [`Is the workload mostly reads, with point lookups and range scans?`, `Yes → B-tree.`],
      [`Is sustained write throughput the bottleneck, with mostly appends?`, `Yes → LSM.`],
      [`Is steady p99 read latency more important than ingest rate?`, `Yes → B-tree; compaction adds variance.`],
      [`Is storage cost on flash a top concern at large scale?`, `Yes → LSM, which compresses better.`],
      [`Is old data deleted in bulk by age?`, `LSM with TTL and time-window compaction, so whole files expire; avoid row-by-row deletes.`]
    ],
    scenario: {
      title: `Worked example: storage for an IoT metrics platform`,
      setup: `A million devices each send a reading every 10 seconds. Users query the last 24 hours for one device, and readings expire after 30 days. A device registry (owner, model, settings) is read on every API call.`,
      steps: [
        `Readings: 100,000 writes per second, append-only, read by device and time range, deleted by age. That is where an LSM shines.`,
        `Use an LSM store with TTL and time-window compaction (Cassandra or ScyllaDB with TWCS), partitioned by device and day, so expired data leaves as whole files instead of row tombstones.`,
        `Registry: small, read on every request, rarely updated, needs uniqueness and joins → a B-tree database such as Postgres.`,
        `Monitor the LSM: pending compactions, read latency during compaction, and disk headroom for merges.`
      ],
      answer: `LSM for the readings, B-tree for the registry. Match the engine to each table's read and write mix instead of using one engine for everything.`
    },
    mistakes: [
      `Choosing an LSM store for a read-heavy OLTP table. Reads check several files and compaction adds latency, with no write benefit.`,
      `Running an LSM store with little free disk. Compaction needs room to write merged files and falls behind without it.`,
      `Mass-deleting rows in Cassandra. Tombstones pile up, and reads must skip them until compaction purges them after the grace period.`,
      `Using random keys for heavy inserts on a B-tree. Pages split everywhere; use time-ordered keys.`,
      `Ignoring vacuum on update-heavy Postgres tables. Dead versions bloat tables and indexes.`
    ],
    rule: `B-tree for read-mostly OLTP, LSM for write-heavy ingestion, and check compaction before blaming the database.`,
    signals: [
      `p99 latency spikes line up with compaction → tune compaction or add disk and I/O headroom.`,
      `Mass deletes do not free space, or reads slow after them → tombstones; switch to TTL with time-window compaction.`,
      `Write throughput is the bottleneck and data is append-only → LSM.`,
      `Postgres tables grow while row counts do not → vacuum is behind; look for long-running transactions.`
    ],
    interview: [
      `Walk through what happens on disk when you write one row to a B-tree and to an LSM-tree.`,
      `Why can LSM reads be slower, and what reduces the cost?`,
      `What is write amplification, and where does each design pay it?`
    ],
    related: [`d6`, `d7`, `o5`],
    deep: [],
    db: [`relational`, `wide-column`, `key-value`],
    sources: [
      { t: `The Log-Structured Merge-Tree (LSM-Tree)`, by: `Patrick O'Neil, Edward Cheng, Dieter Gawlick, Elizabeth O'Neil (Acta Informatica)`, url: `https://www.cs.umb.edu/~poneil/lsmtree.pdf` },
      { t: `RocksDB Tuning Guide`, by: `RocksDB wiki (Meta)`, url: `https://github.com/facebook/rocksdb/wiki/RocksDB-Tuning-Guide` },
      { t: `B-Tree Indexes (implementation)`, by: `PostgreSQL documentation`, url: `https://www.postgresql.org/docs/current/btree.html` },
      { t: `MyRocks: A space- and write-optimized MySQL database`, by: `Yoshinori Matsunobu, Facebook Engineering (2016)`, url: `https://engineering.fb.com/2016/08/31/core-infra/myrocks-a-space-and-write-optimized-mysql-database/` }
    ]
  }
);
