window.HUB_DB = window.HUB_DB || { types: [] };
window.HUB_DB.types.push(
  {
    id: `wide-column`,
    name: `Wide-column`,
    family: `Operational`,
    summary: `A distributed store that groups rows by key into partitions (Cassandra) or tablets (Bigtable), sorted inside each. Despite the name it is row-oriented: an operational store for heavy writes and known queries.`,
    glance: {
      model: `Rows grouped by partition key, sorted by clustering columns`,
      query: `By partition key (CQL) or row-key range scans; no joins`,
      bestAt: `Huge write volume, predictable key lookups, multi-datacenter writes`,
      weakAt: `Joins, ad hoc queries, aggregates, deletes, read-modify-write`,
      scale: `Add nodes: consistent hashing (Cassandra) or tablet splits (Bigtable)`,
      consistency: `Cassandra: tunable per query (ONE, QUORUM, ALL); HBase: strong per row`
    },
    how: [
      `<strong>Route by key.</strong> The client can send a request to any node, which acts as coordinator for it. The coordinator hashes the partition key (Murmur3 by default) to a token on the ring and finds the RF replicas that own that token. Bigtable and HBase instead split the sorted row-key space into ranges (tablets, regions), each served by one server at a time.`,
      `<strong>Write to a log and to memory.</strong> Each replica appends the write to an on-disk commit log, inserts it into a sorted in-memory memtable, and acks. Nothing is read first: <code>INSERT</code> and <code>UPDATE</code> are both upserts, which is why writes are cheap.`,
      `<strong>Flush to immutable SSTables.</strong> When a memtable fills up, it is flushed to disk as a sorted, immutable SSTable with a bloom filter and a partition index. Old files are never edited; a newer version of a value simply lands in a newer SSTable.`,
      `<strong>Read by merging.</strong> A replica checks its memtable plus only the SSTables whose bloom filter says the partition might be there, then merges what it finds. Every cell carries a write timestamp and the newest one wins (last write wins).`,
      `<strong>Tune consistency per request.</strong> Writes always go to all RF replicas; the consistency level only sets how many replies the coordinator waits for: <code>ONE</code>, <code>QUORUM</code> (a majority) or <code>ALL</code>. If R + W &gt; RF, the read and write sets overlap, so a read sees the latest acknowledged write. With RF=3, <code>QUORUM</code> writes and reads give 2 + 2 &gt; 3.`,
      `<strong>Compact, and treat deletes as writes.</strong> Background compaction merges SSTables, keeps the newest version of each cell and drops dead data. A delete writes a tombstone that hides older values; it can only be purged after <code>gc_grace_seconds</code> (10 days by default).`,
      `<strong>Repair drift.</strong> Replicas fall behind when nodes are down. Hinted handoff and read repair fix some of it on the fly, but only regular anti-entropy repair (comparing Merkle trees between replicas) guarantees they converge.`
    ],
    diagram: {
      layers: [
        { name: `Client`, items: [[`App server`, `driver sends CQL by partition key`]] },
        { name: `Coordinator`, items: [[`Coordinator node`, `any node; hashes the key to find replicas`]] },
        { name: `Replicas`, items: [[`Replica node`, `one of the RF owners of the token`], [`Other replicas`, `get the same write (RF=3)`]] },
        { name: `Memory`, items: [[`Memtable`, `sorted writes, flushed when full`]] },
        { name: `Disk`, items: [[`Commit log`, `append-only, replayed after a crash`], [`SSTables`, `immutable, with bloom filter and index`]] },
        { name: `Background`, items: [[`Compaction`, `merges SSTables, purges old tombstones`]] }
      ],
      edges: [
        [`App server`, `Coordinator node`, `sync`, `CQL write or read`],
        [`Coordinator node`, `Replica node`, `sync`, `token → replica`],
        [`Coordinator node`, `Other replicas`, `repl`, `write to all RF`],
        [`Replica node`, `Commit log`, `data`, `1. append first`],
        [`Replica node`, `Memtable`, `data`, `2. sorted insert`],
        [`Memtable`, `SSTables`, `data`, `flush when full`],
        [`Replica node`, `SSTables`, `data`, `read via bloom filter`],
        [`SSTables`, `Compaction`, `async`, `merge, purge tombstones`]
      ],
      paths: [
        { name: `A write`, nodes: [`App server`, `Coordinator node`, `Replica node`, `Memtable`, `SSTables`], note: `The coordinator sends the write to every replica; each appends it to the commit log, inserts it into the memtable and acks, and the memtable later flushes to a new SSTable.` },
        { name: `A read`, nodes: [`App server`, `Coordinator node`, `Replica node`, `SSTables`], note: `The coordinator asks as many replicas as the consistency level needs; each merges its memtable with the SSTables its bloom filters cannot rule out, and the newest timestamp wins.` }
      ]
    },
    modeling: [
      `<strong>Start from the queries.</strong> List every read the app makes, then design one table per query and copy data into each. There are no joins, so a query must find everything it needs in one partition of one table.`,
      `<strong>Partition key is what you look up by; clustering columns set the order inside it.</strong> For "latest messages in a channel", Discord used <code>PRIMARY KEY ((channel_id, bucket), message_id)</code> with a time-sortable Snowflake-style ID, so a page of recent messages is one partition read in order.`,
      `<strong>Bound every partition.</strong> Cassandra's guideline is under 100,000 values and under 100MB per partition. Put a time bucket in the key: Discord stored about 10 days of a channel's messages per bucket to stay under 100MB.`,
      `<strong>Avoid deletes by design.</strong> Expire time-shaped data with TTLs and a time-window compaction strategy, and never write nulls you do not need: Discord found that writing a null column created a tombstone.`,
      `<strong>Spread the writes.</strong> In Bigtable, a row key that starts with a timestamp or a sequential ID pushes all new writes onto one node, so lead with an identifier such as a device or user ID. In Cassandra, a "current hour" bucket with no other key part does the same to RF nodes.`
    ],
    strengths: [
      `Very high write throughput: a write is a log append plus a memory insert, with no read first.`,
      `Scales out by adding nodes; in Cassandra and ScyllaDB every node accepts writes, so there is no single leader to outgrow.`,
      `Multi-datacenter replication is built in, with per-request levels such as <code>LOCAL_QUORUM</code> that keep latency inside one datacenter.`,
      `Predictable latency for reads that hit one partition, even as the data grows.`,
      `TTLs and time-ordered clustering suit append-shaped data such as messages, events and sensor readings.`
    ],
    weaknesses: [
      `No joins and no ad hoc queries: a filter without the partition key means scanning every partition, which CQL refuses unless you add <code>ALLOW FILTERING</code>. Each new query pattern usually means a new table and a backfill.`,
      `Not a column store: a partition keeps each row's columns together (DDIA calls the Bigtable model "mostly row-oriented"), so summing one column over the whole table is a full scan. Send analytics to a columnar store.`,
      `Deletes and overwrites leave tombstones and old versions that slow reads until compaction removes them.`,
      `Conflicts resolve by timestamp (last write wins), so concurrent writers silently overwrite each other. Compare-and-set needs lightweight transactions (<code>IF NOT EXISTS</code>), which run Paxos and cost noticeably more.`,
      `Operationally heavy: compaction, repair and tombstone tuning need someone who knows the system well.`
    ],
    use: `Use it for very large, write-heavy data with access paths you know up front: chat messages, activity feeds, IoT readings, event logs and user timelines, especially when several datacenters must accept writes.`,
    avoid: `Avoid it for small or medium data, ad hoc reporting, joins, uniqueness rules or multi-row transactions: use Postgres (HBase's own docs suggest a traditional RDBMS if you only have thousands or millions of rows). For scans and aggregates, use a columnar store such as ClickHouse; for plain key-value access at scale with less to operate, consider DynamoDB.`,
    examples: [
      [`Apache Cassandra`, `Leaderless replication across datacenters, tunable consistency and CQL. Pick it for very large write-heavy data in several regions when you can operate it well.`, `Amazon Keyspaces (serverless; writes always LOCAL_QUORUM), DataStax Astra DB, Azure Managed Instance for Apache Cassandra`],
      [`ScyllaDB`, `A C++ rewrite that speaks Cassandra's CQL (plus a DynamoDB-compatible API) with a shard-per-core design. Discord moved trillions of messages to it, going from 177 Cassandra nodes to 72 ScyllaDB nodes.`, `ScyllaDB Cloud`],
      [`Apache HBase`, `Bigtable's design on top of HDFS: strongly consistent reads and writes, and regions that split automatically as tables grow. Fits teams already running Hadoop.`, `Amazon EMR (HDFS or S3 storage mode)`],
      [`Bigtable (Google Cloud)`, `The original wide-column system (OSDI 2006 paper), now a managed service: rows sorted by row key, every operation atomic per row, and an HBase-compatible Java client.`, `Google Cloud (managed only)`]
    ],
    pitfalls: [
      `<strong>Tombstone pile-ups.</strong> Using a table as a queue, or deleting many rows inside one partition, makes reads wade through dead cells. By default Cassandra logs a warning when one read scans more than 1,000 tombstones and fails the read past 100,000.`,
      `<strong>Zombie data.</strong> If a node stays down longer than <code>gc_grace_seconds</code> (10 days by default) and misses a delete, the other replicas may purge the tombstone and repair copies the deleted data back. Make sure every replica is repaired within that window.`,
      `<strong>Hot or unbounded partitions.</strong> A partition per channel or tenant with no time bucket grows forever, and one busy key hammers the same few replicas. At Discord one hot channel bucket often hurt latency across the whole cluster, so they added request coalescing: one database query serves many identical reads.`,
      `<strong>Treating QUORUM as a transaction.</strong> Overlapping quorums make an acknowledged write visible to the next quorum read, but two concurrent writers still race and the later timestamp wins. Cassandra's docs say correctness depends on clocks, so run NTP and use lightweight transactions where order matters.`,
      `<strong><code>ALLOW FILTERING</code> as a crutch.</strong> It lets a query without the partition key run by scanning every partition, so latency grows with the table. Build another table keyed for that query instead.`
    ],
    interview: [
      `Design the table for "show the latest 50 messages in a channel". What are the partition key and clustering columns, and how do you stop one busy channel's partition from growing forever?`,
      `With RF=3, which read and write consistency levels give read-your-writes? What happens to a <code>QUORUM</code> write when one replica is down, and when two are?`,
      `Why is a delete more expensive than an insert here? What is a tombstone, and how can deleted data come back?`,
      `Cassandra and ClickHouse both get called "column" databases. What does each keep together on disk, and which would you pick for chat history vs a usage dashboard?`
    ],
    guides: [`btree-vs-lsm`, `consistency-levels`, `replication-modes`, `sharding-keys`],
    deep: [`sharding-consistent-hashing`, `cache-aside-stampede`],
    related: [`d4`, `d5`, `t10`, `d7`],
    sources: [
      { t: `Storage Engine: commit log, memtables, SSTables`, by: `Apache Cassandra docs`, url: `https://cassandra.apache.org/doc/latest/cassandra/architecture/storage-engine.html` },
      { t: `Dynamo: replication and tunable consistency`, by: `Apache Cassandra docs`, url: `https://cassandra.apache.org/doc/latest/cassandra/architecture/dynamo.html` },
      { t: `Data modeling: introduction`, by: `Apache Cassandra docs`, url: `https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/intro.html` },
      { t: `Bigtable: A Distributed Storage System for Structured Data (OSDI 2006)`, by: `Chang et al., Google`, url: `https://research.google/pubs/bigtable-a-distributed-storage-system-for-structured-data/` },
      { t: `How Discord Stores Trillions of Messages`, by: `Bo Ingram, Discord (2023)`, url: `https://discord.com/blog/how-discord-stores-trillions-of-messages` }
    ]
  },
  {
    id: `columnar`,
    name: `Columnar (OLAP)`,
    family: `Analytical`,
    summary: `An analytical database that stores each column separately and compressed, so a query reads only the columns it needs. Built for scans and aggregates over billions of rows, not single-row updates.`,
    glance: {
      model: `Tables stored column by column, sorted and compressed`,
      query: `SQL scans with filters, GROUP BY and aggregates`,
      bestAt: `Aggregating billions of rows: dashboards, reports, event analytics`,
      weakAt: `Row updates and deletes, single-row lookups at high concurrency`,
      scale: `Shards and replicas, or storage separated from elastic compute`,
      consistency: `ClickHouse replicas are async (eventual); unique keys unenforced`
    },
    how: [
      `<strong>Column by column.</strong> All values of one column are stored together, so <code>SELECT avg(duration) FROM calls WHERE region = 'EU'</code> reads two columns, not whole rows. Redshift's docs give the arithmetic: a query that uses 5 of 100 columns reads about 5 percent of the data. A wide-column store like Cassandra does the opposite and keeps a row's columns together.`,
      `<strong>Sorted, compressed parts.</strong> In ClickHouse each INSERT is written as an immutable part, sorted by the table's <code>ORDER BY</code> key, with each column stored and compressed separately. Neighboring values in a sorted column look alike, so codecs such as ZSTD or Delta shrink them well, and less I/O means faster scans.`,
      `<strong>Skip instead of search.</strong> The sparse primary index holds one entry (a mark) per granule of 8,192 rows by default, small enough to stay in memory. A filter on the leading key columns binary-searches the marks to find the few granules that can match. Redshift and Snowflake prune the same way with min and max values per block or micro-partition.`,
      `<strong>Vectorized execution.</strong> Operators pass batches of column values instead of single rows, which keeps CPU caches warm and allows SIMD instructions. The plan is split into lanes, typically one per core, and a table can be spread across servers.`,
      `<strong>Merge in the background.</strong> Small parts are continuously merged into bigger ones, much like LSM compaction. Merges can also transform data: replacing merges keep only the latest version of a row, aggregating merges combine partial aggregates, and TTL merges delete expired rows.`,
      `<strong>Updates are rewrites.</strong> Parts are immutable, so <code>ALTER TABLE ... UPDATE</code> or <code>DELETE</code> is a mutation that rewrites every affected part in the background. A lightweight <code>DELETE</code> only masks rows until the next merge removes them.`,
      `<strong>Scale out.</strong> ClickHouse shards data across nodes and replicates each table asynchronously, coordinated by ClickHouse Keeper; by default an INSERT waits for one replica. BigQuery and Snowflake separate storage from compute so each scales on its own.`
    ],
    diagram: {
      layers: [
        { name: `Clients`, items: [[`Batch loader`, `Kafka consumer or app buffer`], [`Dashboard`, `GROUP BY over a time range`]] },
        { name: `Server`, items: [[`ClickHouse server`, `parses, plans and runs queries`], [`Vectorized scan`, `column batches, one lane per core`]] },
        { name: `Memory`, items: [[`Sparse primary index`, `one mark per 8,192 rows`]] },
        { name: `Disk`, items: [[`New parts`, `sorted by ORDER BY, columns stored apart`], [`Merged parts`, `fewer, larger, still sorted`]] },
        { name: `Background`, items: [[`Background merges`, `combine parts, apply engine rules`]] }
      ],
      edges: [
        [`Batch loader`, `ClickHouse server`, `sync`, `INSERT 10k-100k rows`],
        [`ClickHouse server`, `New parts`, `data`, `write sorted columns`],
        [`New parts`, `Background merges`, `async`, `pick small parts`],
        [`Background merges`, `Merged parts`, `data`, `write bigger part`],
        [`Dashboard`, `ClickHouse server`, `sync`, `SELECT ... GROUP BY`],
        [`ClickHouse server`, `Sparse primary index`, `data`, `binary search marks`],
        [`Sparse primary index`, `Vectorized scan`, `sync`, `matching granules only`],
        [`Vectorized scan`, `Merged parts`, `data`, `read needed columns`]
      ],
      paths: [
        { name: `A write`, nodes: [`Batch loader`, `ClickHouse server`, `New parts`, `Background merges`, `Merged parts`], note: `Each batched INSERT becomes one immutable part sorted by the ORDER BY key; background merges later fold small parts into larger ones.` },
        { name: `A query`, nodes: [`Dashboard`, `ClickHouse server`, `Sparse primary index`, `Vectorized scan`, `Merged parts`], note: `The server binary-searches the in-memory index to keep only granules that can match, then reads just the needed columns of those granules and aggregates them in batches.` }
      ]
    },
    modeling: [
      `<strong>Choose the sorting key from your filters.</strong> Lead with the columns most queries filter on, for example <code>ORDER BY (tenant_id, toDate(ts))</code> when every query is per tenant and time range. ClickHouse's guide also suggests ordering key columns by ascending cardinality, and says 4-5 key columns are usually enough.`,
      `<strong>Insert in batches.</strong> ClickHouse recommends at least 1,000 rows per INSERT and ideally 10,000-100,000, or server-side buffering with <code>async_insert=1, wait_for_async_insert=1</code>. One INSERT per event means one part per event.`,
      `<strong>Partition for lifecycle, not speed.</strong> Partition by month or day so retention is a cheap partition drop or TTL. Keep the partition key low-cardinality (ClickHouse suggests fewer than 100-1,000 values), because parts never merge across partitions.`,
      `<strong>Denormalize and pre-aggregate.</strong> Store wide, flat event rows instead of joining big tables at query time, and precompute hot rollups: a ClickHouse materialized view runs on each inserted block and writes into a <code>SummingMergeTree</code> or <code>AggregatingMergeTree</code> table; Druid can roll up rows at ingestion; Pinot offers the star-tree index.`
    ],
    strengths: [
      `Reads only the columns a query touches, and sorted values of one type compress well, so far less data comes off disk.`,
      `Vectorized, parallel execution: operators work on batches of values with SIMD, across every core and server.`,
      `Proven at high ingest: Cloudflare's 36-node ClickHouse cluster (2018) took the logs for about 6M HTTP requests per second, with peaks of 8M.`,
      `Real-time options: Druid and Pinot ingest straight from Kafka and serve highly concurrent analytics APIs.`,
      `BigQuery and Snowflake separate storage from compute, so each scales on its own and several compute clusters can query the same data.`
    ],
    weaknesses: [
      `Row updates and deletes are expensive: a ClickHouse mutation rewrites every affected part, so changing one row can rewrite a lot of data.`,
      `Poor at high-QPS point lookups: the smallest unit read is a granule or block of thousands of rows, not one row.`,
      `No enforced uniqueness: Redshift and Snowflake treat primary and unique keys as informational, and ClickHouse accepts duplicate primary keys.`,
      `Usually a second copy fed by a pipeline, so it lags the source and must be kept in sync.`,
      `Joins between two very large tables are costly; designs denormalize, pre-join at ingest, or co-locate join keys (Redshift KEY distribution).`
    ],
    use: `Use it for dashboards, product and usage analytics, log and event analysis, billing rollups and ad hoc analysis over large append-mostly data, loaded in batches from Kafka, CDC or files.`,
    avoid: `Avoid it as a system of record or for frequent single-row updates and lookups: use Postgres or another OLTP store. For a user-facing API that must serve aggregates at very high concurrency, look at Pinot or Druid, or precompute into a key-value store. For full-text search, use OpenSearch. For write-heavy operational data such as messages, a wide-column store fits better.`,
    examples: [
      [`ClickHouse`, `Open source and very fast on one node or a cluster: MergeTree tables, a sparse index, materialized views. Pick it for real-time event and log analytics.`, `ClickHouse Cloud, Altinity.Cloud`],
      [`Apache Druid`, `Partitions data by time, ingests from Kafka in real time and can roll up at ingest; built for highly concurrent analytics APIs. Supports streaming inserts, not streaming updates by key.`, `Imply Polaris`],
      [`Apache Pinot`, `Real-time OLAP for user-facing analytics at high query rates (LinkedIn's Who Viewed Profile, UberEats Restaurant Manager), with star-tree pre-aggregation and upserts from Kafka.`, `StarTree Cloud`],
      [`Google BigQuery`, `Serverless warehouse with separate storage and compute. On-demand queries bill by bytes processed, so selecting fewer columns costs less.`, `Google Cloud (managed only)`],
      [`Amazon Redshift`, `MPP warehouse on AWS: 1 MB columnar blocks, sort keys with per-block min and max, and distribution styles that co-locate join keys.`, `Redshift Serverless or provisioned clusters`],
      [`Snowflake`, `Cloud warehouse whose independent virtual warehouses query shared storage; tables split automatically into micro-partitions of 50-500 MB uncompressed, pruned by per-column value ranges.`, `Snowflake (managed only)`],
      [`DuckDB`, `In-process analytical database with a columnar-vectorized engine, in the spirit of SQLite; great for local analysis of Parquet and CSV files.`, `MotherDuck`]
    ],
    pitfalls: [
      `<strong>Row-by-row inserts.</strong> One INSERT per event creates one part per event; merges fall behind and ClickHouse starts failing inserts with "too many parts". Batch in the app or the Kafka consumer, or turn on async inserts.`,
      `<strong><code>SELECT *</code> on a column store.</strong> It reads every column and throws away the main advantage. In BigQuery, adding <code>LIMIT</code> to <code>SELECT *</code> does not reduce the data read; you are billed for all bytes in the table.`,
      `<strong>Treating it like OLTP.</strong> Frequent <code>UPDATE</code> and <code>DELETE</code> statements become background mutations that rewrite whole parts and spike disk I/O. Model changes as new rows (ReplacingMergeTree, CollapsingMergeTree) or drop whole partitions.`,
      `<strong>Assuming dedup is immediate.</strong> <code>ReplacingMergeTree</code> removes duplicates only during merges, at a time you cannot plan, so plain queries can count a row twice. Use <code>FINAL</code> or aggregate with <code>argMax</code> when correctness matters.`,
      `<strong>Wrong sorting or partition key.</strong> A filter that does not match the leading ORDER BY columns scans far more granules, and a high-cardinality partition key such as user ID creates thousands of small parts that can never merge across partitions.`
    ],
    interview: [
      `Why does <code>SELECT region, avg(duration) FROM calls GROUP BY region</code> over a billion rows take seconds in ClickHouse but much longer in Postgres? Walk through the bytes read.`,
      `How would you choose the ORDER BY key for an events table that is always queried by tenant and time range?`,
      `Your pipeline sends one INSERT per event and writes start failing. What is happening, and how do you fix it?`,
      `Cassandra and ClickHouse both get called column stores. What does each actually keep together on disk, and which would you use for chat history vs a usage dashboard?`
    ],
    guides: [`oltp-olap-search`, `normalize-denormalize`, `sql-vs-nosql`],
    deep: [`cqrs`, `change-data-capture`],
    related: [`d1`, `d2`, `d6`],
    sources: [
      { t: `Why is ClickHouse so fast?`, by: `ClickHouse docs`, url: `https://clickhouse.com/docs/concepts/why-clickhouse-is-so-fast` },
      { t: `A practical introduction to primary indexes in ClickHouse`, by: `ClickHouse docs`, url: `https://clickhouse.com/docs/guides/best-practices/sparse-primary-indexes` },
      { t: `C-Store: A Column-oriented DBMS (VLDB 2005)`, by: `Stonebraker et al.`, url: `https://www.vldb.org/archives/website/2005/program/paper/thu/p553-stonebraker.pdf` },
      { t: `Designing Data-Intensive Applications, ch. 3 (column-oriented storage)`, by: `Martin Kleppmann, O'Reilly`, url: `https://dataintensive.net/` },
      { t: `HTTP Analytics for 6M requests per second using ClickHouse`, by: `Cloudflare blog (2018)`, url: `https://blog.cloudflare.com/http-analytics-for-6m-requests-per-second-using-clickhouse/` }
    ]
  },
  {
    id: `time-series`,
    name: `Time-series`,
    family: `Analytical`,
    summary: `A database for timestamped measurements. Each series (a metric plus its labels) gets an append-mostly stream of time and value samples, compressed hard, queried by time range and expired by age.`,
    glance: {
      model: `Series (metric + labels) of timestamped samples`,
      query: `Time-range aggregations: PromQL, SQL with time buckets, InfluxQL`,
      bestAt: `High-rate appends, recent-window dashboards, alerts, rollups`,
      weakAt: `High-cardinality labels, updates, point deletes, joins`,
      scale: `Shard by series and time; remote storage for Prometheus`,
      consistency: `Varies: Postgres ACID (TimescaleDB); Prometheus single-node, not replicated`
    },
    how: [
      `<strong>Series identity.</strong> A series is a metric name plus a set of labels, such as <code>http_requests_total{method="GET", status="500"}</code>. Every unique label combination is a new series, and an index maps metric names and labels to the series that carry them.`,
      `<strong>Append to the head.</strong> Samples arrive roughly in time order and are appended to an in-memory head block, backed by a write-ahead log that is replayed after a crash. Prometheus rejects out-of-order samples unless you set <code>out_of_order_time_window</code> (default 0s).`,
      `<strong>Compress each series.</strong> Timestamps are stored as deltas of deltas, so a timestamp on a regular interval usually costs a single bit, and float values are XORed with the previous value. Facebook's Gorilla shrank 16-byte points to 1.37 bytes on average; Prometheus averages 1-2 bytes per sample.`,
      `<strong>Cut immutable blocks.</strong> Prometheus writes the head out as two-hour blocks (chunks, an index from labels to series, metadata) and compacts them in the background into bigger blocks spanning up to 10% of retention or 31 days.`,
      `<strong>Query by labels, then time.</strong> The engine resolves label matchers through the index to a set of series, reads only the chunks that overlap the time range, decodes them and aggregates, for example <code>sum by (status) (rate(http_requests_total[5m]))</code>.`,
      `<strong>Expire whole chunks.</strong> Retention drops entire blocks or chunks by age (Prometheus keeps 15 days by default) instead of deleting rows. Downsampling keeps coarse rollups for older data, for example TimescaleDB continuous aggregates or VictoriaMetrics Enterprise downsampling.`,
      `<strong>Scale out.</strong> Prometheus local storage is single-node, not clustered or replicated, so long-term and HA setups remote-write samples to Thanos, Grafana Mimir, Cortex or VictoriaMetrics. Clustered TSDBs shard by series and by time.`
    ],
    diagram: {
      layers: [
        { name: `Outside`, items: [[`Targets`, `apps exposing /metrics`], [`Grafana`, `dashboards and alert queries`]] },
        { name: `Server`, items: [[`Prometheus server`, `scrapes, stores, evaluates PromQL`]] },
        { name: `Memory`, items: [[`Head block`, `most recent samples`]] },
        { name: `Disk`, items: [[`WAL`, `replayed after a crash`], [`Two-hour blocks`, `chunks plus label index`]] },
        { name: `Background`, items: [[`Compactor`, `merges blocks, deletes expired ones`]] },
        { name: `Long-term`, items: [[`Remote storage`, `Thanos, Mimir or VictoriaMetrics`]] }
      ],
      edges: [
        [`Prometheus server`, `Targets`, `sync`, `scrape every interval`],
        [`Prometheus server`, `WAL`, `data`, `log samples`],
        [`Prometheus server`, `Head block`, `data`, `append samples`],
        [`Head block`, `Two-hour blocks`, `data`, `cut every 2h`],
        [`Two-hour blocks`, `Compactor`, `async`, `merge, drop expired`],
        [`Prometheus server`, `Remote storage`, `stream`, `remote_write`],
        [`Grafana`, `Prometheus server`, `sync`, `PromQL range query`],
        [`Prometheus server`, `Two-hour blocks`, `data`, `read matching chunks`]
      ],
      paths: [
        { name: `A write`, nodes: [`Targets`, `Prometheus server`, `Head block`, `Two-hour blocks`], note: `Each scrape appends one sample per series to the in-memory head (also logged to the WAL); about every two hours the head is cut into an immutable block on disk.` },
        { name: `A query`, nodes: [`Grafana`, `Prometheus server`, `Two-hour blocks`], note: `The server looks up the label matchers in each block's index to find series, decodes only the chunks inside the time range (plus recent data in the head) and aggregates.` }
      ]
    },
    modeling: [
      `<strong>Keep labels bounded.</strong> Use labels for small, fixed sets such as method, status, region or service. Never put user IDs, emails, request IDs or raw URLs in labels; Prometheus's naming guide warns against exactly that.`,
      `<strong>Do the cardinality math.</strong> Series per metric is roughly the product of each label's distinct values: 10 endpoints x 5 status codes x 200 pods is 10,000 series for one metric. Budget it before you ship a new label.`,
      `<strong>Put unique values in fields or another store.</strong> InfluxDB indexes tag values but not field values, so per-user values belong in fields; per-request detail belongs in logs or traces.`,
      `<strong>Plan retention tiers up front.</strong> Keep raw samples for days or weeks and 5-minute or hourly rollups for months. Keep counts, max and histograms in rollups, not only averages, because percentiles cannot be rebuilt from averages.`,
      `<strong>Precompute what dashboards poll.</strong> Use Prometheus recording rules or TimescaleDB continuous aggregates for panels that refresh every few seconds.`
    ],
    strengths: [
      `Very cheap per sample: delta-of-delta timestamps and XOR-encoded values bring Prometheus to 1-2 bytes per sample.`,
      `High ingest of small appends, because writes only touch the newest data of each series.`,
      `Retention is nearly free: dropping a whole chunk deletes a file instead of millions of rows, with no cleanup afterwards.`,
      `Time-aware queries such as <code>rate()</code> in PromQL or <code>time_bucket()</code> in TimescaleDB make window aggregations short to write.`
    ],
    weaknesses: [
      `Cardinality is the main cost: every new label value creates a series with its own index entries and in-memory state, so one bad label can exhaust RAM.`,
      `Updates and point deletes are awkward or slow; most engines assume append-only data.`,
      `Late data is limited: Prometheus rejects out-of-order samples unless an out-of-order window is configured.`,
      `Prometheus local storage is not clustered or replicated, so a lost disk loses its history.`,
      `Weak at joins and at rich per-event records, which belong in a columnar or log store.`
    ],
    use: `Use it for infrastructure and application metrics, IoT and sensor readings, and market ticks: regular, numeric samples that you query by time window and aggregate.`,
    avoid: `Avoid it for per-event records keyed by unbounded IDs (use a columnar store such as ClickHouse, or a log store), for business entities that change (use Postgres), and for anything that needs joins. If you already run Postgres and volume is moderate, TimescaleDB keeps time series in the same database.`,
    examples: [
      [`Prometheus`, `Pull-based metrics with PromQL and a local TSDB of two-hour blocks; the usual choice for service and Kubernetes monitoring. Single node: add remote storage for long-term data or HA.`, `Amazon Managed Service for Prometheus, Grafana Cloud`],
      [`InfluxDB`, `Push-based (line protocol). In 2.x, tags are indexed and fields are not; InfluxDB 3 is rebuilt in Rust on Apache Arrow and DataFusion, storing Parquet files in object storage.`, `InfluxDB Cloud, Amazon Timestream for InfluxDB`],
      [`TimescaleDB`, `A Postgres extension: hypertables partition by time into chunks, older chunks convert to a compressed columnstore, and continuous aggregates maintain rollups. Pick it to keep SQL, joins and Postgres tooling.`, `Tiger Cloud (Tiger Data)`],
      [`VictoriaMetrics`, `Prometheus-compatible storage (PromQL plus MetricsQL) in single-node and cluster versions; a common remote-write target for long-term metrics.`, `VictoriaMetrics Cloud`],
      [`QuestDB`, `Column-oriented with SQL; tables are partitioned by a designated timestamp, each column is a separate file, and retention is a cheap partition drop.`, `QuestDB Enterprise (BYOC)`],
      [`Amazon Timestream`, `Serverless, with a memory store for recent data and a magnetic store for history. Timestream for LiveAnalytics closed to new customers on June 20, 2025; AWS points new users to Timestream for InfluxDB.`, `AWS (managed only)`]
    ],
    pitfalls: [
      `<strong>Cardinality explosion.</strong> Someone adds <code>user_id</code> or a raw URL path as a label, series jump from thousands to millions, memory spikes and the server falls over. Track series count per metric and reject unbounded labels in review.`,
      `<strong>Treating local Prometheus as durable.</strong> It is one node with no replication; when the disk dies, the history goes with it. Remote-write anything you must keep to a replicated store.`,
      `<strong>Retention by time only.</strong> As the fleet grows, the same number of days takes more disk. Also set a size cap (<code>--storage.tsdb.retention.size</code>) and alert on disk usage.`,
      `<strong>Downsampling that loses the answer.</strong> Averaging into hourly rollups hides spikes and makes p99 impossible to recompute later; keep max, counts and histogram buckets.`,
      `<strong>Silently dropped late data.</strong> Backfills and clients with skewed clocks send old timestamps that Prometheus rejects as out of order or too old. Configure the out-of-order window, or load history with Prometheus's backfilling tool.`
    ],
    interview: [
      `You need per-customer API latency for a million customers. What breaks if you add <code>customer_id</code> as a Prometheus label, and what would you do instead?`,
      `How can a TSDB store a sample in one or two bytes? Explain delta-of-delta timestamps and XOR-encoded values.`,
      `How would you keep a year of metrics cheaply while dashboards stay fast? Talk about retention tiers, downsampling and what you lose.`,
      `When does one Prometheus server stop being enough, and what do remote write plus Thanos, Mimir or VictoriaMetrics add?`
    ],
    guides: [`btree-vs-lsm`, `sharding-keys`, `oltp-olap-search`],
    deep: [],
    related: [`o3`, `o6`, `d7`, `e3`],
    sources: [
      { t: `Storage: local TSDB, retention and remote storage`, by: `Prometheus docs`, url: `https://prometheus.io/docs/prometheus/latest/storage/` },
      { t: `Metric and label naming (cardinality)`, by: `Prometheus docs`, url: `https://prometheus.io/docs/practices/naming/` },
      { t: `Gorilla: A Fast, Scalable, In-Memory Time Series Database (VLDB 2015)`, by: `Pelkonen et al., Facebook`, url: `https://www.vldb.org/pvldb/vol8/p1816-teller.pdf` },
      { t: `Understand continuous aggregates`, by: `TimescaleDB docs (Tiger Data)`, url: `https://www.tigerdata.com/docs/use-timescale/latest/continuous-aggregates/about-continuous-aggregates` },
      { t: `InfluxDB schema design`, by: `InfluxData docs`, url: `https://docs.influxdata.com/influxdb/v2/write-data/best-practices/schema-design/` }
    ]
  },
  {
    id: `lakehouse`,
    name: `Data lake and lakehouse`,
    family: `Analytical`,
    summary: `Cheap object storage holds open columnar files (Parquet); a table format such as Apache Iceberg or Delta Lake adds snapshots and atomic commits, so many engines can query and write them as tables.`,
    glance: {
      model: `Parquet files in object storage, tracked by table snapshots`,
      query: `SQL engines over S3: Athena, Trino, Spark, warehouses`,
      bestAt: `Cheap storage of all history, shared by many engines`,
      weakAt: `Low-latency queries, high concurrency, small frequent writes, point lookups`,
      scale: `Storage and compute scale separately; add engines, not copies`,
      consistency: `Atomic commits per table; readers see one consistent snapshot`
    },
    how: [
      `<strong>Files in object storage.</strong> Data lives as Parquet files in S3, GCS or ADLS. A Parquet file splits rows into row groups, each holding one contiguous column chunk per column, divided into pages; the footer holds the schema, chunk locations and min/max statistics, so a reader fetches only the columns and row groups it needs.`,
      `<strong>A table format on top.</strong> A plain folder of files has no commits: a failed job can leave partial files that queries read. Iceberg tracks individual files instead of directories: a metadata file lists the table's snapshots, each snapshot points to a manifest list, and manifests record every data file with its partition values and column stats. Delta Lake keeps an ordered log of JSON commits in <code>_delta_log</code>, plus Parquet checkpoints.`,
      `<strong>Commit by atomic swap.</strong> A writer first writes new data files, then new metadata, then swaps the table's current-metadata pointer in the catalog in one atomic step. If another writer committed first, it retries on top of the new version (optimistic concurrency). Readers take no locks and never see a partial commit.`,
      `<strong>Plan from metadata, then read little.</strong> The engine loads the current snapshot, skips manifests and files whose partition values or min/max stats cannot match the filter, then reads only the needed columns of the surviving files. Iceberg's goal is to plan a scan with O(1) remote calls instead of listing directories.`,
      `<strong>Evolve without rewriting.</strong> Iceberg tracks columns by ID, so add, drop, rename and reorder are metadata-only changes. Hidden partitioning derives partition values from a column (<code>day(event_time)</code>, <code>bucket(16, id)</code>), so queries filter on the real column and the layout can change later.`,
      `<strong>Time travel.</strong> Every commit is a snapshot you can query or roll back to, for example with <code>FOR VERSION AS OF</code> or <code>FOR TIMESTAMP AS OF</code> in Trino and Athena. Replaced files stay until snapshots expire: Iceberg's snapshot expiry, or Delta's <code>VACUUM</code> (7-day default retention).`,
      `<strong>Maintain the table.</strong> Frequent commits create small files and piles of metadata, so schedule compaction (Iceberg <code>rewriteDataFiles</code>, Trino <code>optimize</code>), snapshot expiry and orphan-file cleanup, or use a service such as Amazon S3 Tables that runs them for you.`
    ],
    diagram: {
      layers: [
        { name: `Compute`, items: [[`Spark job`, `batch or streaming writer`], [`Trino or Athena`, `SQL query engine`], [`Compaction job`, `rewrites small files`]] },
        { name: `Catalog`, items: [[`Catalog`, `Glue, REST or Hive: current pointer`]] },
        { name: `Table metadata`, items: [[`Metadata file`, `schema, partition spec, snapshots`], [`Manifests`, `data file list with column stats`]] },
        { name: `Object storage`, items: [[`Parquet files`, `column chunks plus footer stats`]] }
      ],
      edges: [
        [`Spark job`, `Parquet files`, `data`, `1. write data files`],
        [`Manifests`, `Parquet files`, `data`, `list files + stats`],
        [`Metadata file`, `Manifests`, `data`, `snapshot → manifests`],
        [`Catalog`, `Metadata file`, `data`, `current pointer`],
        [`Spark job`, `Catalog`, `sync`, `commit: atomic swap`],
        [`Trino or Athena`, `Catalog`, `sync`, `load table`],
        [`Compaction job`, `Parquet files`, `async`, `rewrite small files`],
        [`Compaction job`, `Catalog`, `sync`, `commit rewrite`]
      ],
      paths: [
        { name: `A write`, nodes: [`Spark job`, `Parquet files`, `Manifests`, `Metadata file`, `Catalog`], note: `The job writes Parquet files, then manifests that list them, then a new metadata file, and finally swaps the catalog pointer; until that swap, readers keep seeing the old snapshot.` },
        { name: `A query`, nodes: [`Trino or Athena`, `Catalog`, `Metadata file`, `Manifests`, `Parquet files`], note: `The engine asks the catalog for the current metadata, prunes manifests and files with partition values and column stats, then reads only the needed columns of the remaining Parquet files.` }
      ]
    },
    modeling: [
      `<strong>Partition coarsely.</strong> Partition by a transform of the column most queries filter on, usually <code>day(event_time)</code>, not by user ID. Athena's guide warns that too many partition keys fragment data into small files, and suggests sorting by timestamp instead of partitioning by hour when queries span days.`,
      `<strong>Aim for big files.</strong> Iceberg's default target file size is 512 MB, with 128 MB Parquet row groups. Batch streaming writes (minutes, not seconds) and compact the rest.`,
      `<strong>Sort within files.</strong> Sorting or clustering on common filter columns tightens each file's min/max range, so statistics can skip more files and row groups.`,
      `<strong>Land raw, then derive.</strong> Append raw events untouched, then build cleaned and aggregated tables from them with scheduled jobs. Keeping raw history lets you rebuild or backfill any derived table.`,
      `<strong>Evolve through the format.</strong> Add or rename columns through Iceberg or Delta rather than rewriting files, and use partition evolution when volume changes; old files keep their old layout.`
    ],
    strengths: [
      `Cheapest place to keep everything: object storage for data, and compute paid only while queries run (Athena bills by data scanned).`,
      `One copy, many engines: Spark, Trino, Athena, Redshift and Snowflake can all work with Iceberg tables.`,
      `ACID commits, time travel and rollback on plain files, plus schema and partition evolution without rewriting data.`,
      `Storage and compute scale separately: a heavy Spark backfill runs on its own compute, apart from the SQL engine's.`
    ],
    weaknesses: [
      `Latency: planning reads metadata from object storage and every file open is a remote request, so it suits queries measured in seconds, not millisecond lookups.`,
      `Small files and metadata pile up with frequent commits unless you run compaction and snapshot expiry.`,
      `Row-level updates are costly: they rewrite whole files (copy-on-write) or add delete files that every read must merge (merge-on-read).`,
      `Concurrent writers to one table conflict and retry, so many jobs committing often to the same table need care.`,
      `More moving parts than a warehouse: catalog, engines, maintenance jobs and access control are yours to run.`
    ],
    use: `Use it as the long-term home for raw and historical data: event and log archives, CDC copies of OLTP tables, ML training sets and batch reporting, especially when several engines or teams share the same data.`,
    avoid: `Avoid it for user-facing dashboards that need sub-second answers at high concurrency (use ClickHouse, Druid or Pinot) and for OLTP. If one team mostly runs SQL BI and wants little to operate, a warehouse such as Snowflake, BigQuery or Redshift fits better; Snowflake and Redshift can also query Iceberg tables if you add a lake later.`,
    examples: [
      [`Apache Iceberg`, `Open table format with snapshots, hidden partitioning, and schema and partition evolution; supported by Spark, Trino, Athena, Redshift and Snowflake. A safe default when several engines share tables.`, `Amazon S3 Tables, AWS Glue Data Catalog, Snowflake Iceberg tables`],
      [`Delta Lake`, `Table format built on an ordered JSON transaction log with Parquet checkpoints; tight Spark integration, time travel, and VACUUM for old files.`, `Databricks`],
      [`Apache Hudi`, `Table format focused on record-level upserts, deletes and incremental pulls, with copy-on-write and merge-on-read tables. Fits CDC-heavy pipelines.`, `Amazon EMR (installed with Spark, Hive, Presto or Flink)`],
      [`Amazon Athena`, `Serverless SQL over S3 whose engine tracks open-source Trino and Presto; queries Parquet and Iceberg tables, supports Iceberg time travel, and bills by data scanned.`, `AWS (serverless)`],
      [`Trino`, `Open-source distributed SQL engine (formerly PrestoSQL) that queries lake tables in place, with Iceberg time travel and maintenance procedures such as optimize and expire_snapshots.`, `Starburst Galaxy, Amazon EMR`],
      [`Apache Spark`, `The common engine for writing and transforming lake tables in batch or streaming, and for ML pipelines.`, `Databricks, Amazon EMR, AWS Glue`]
    ],
    pitfalls: [
      `<strong>The small-files problem.</strong> A streaming job that commits every few seconds writes thousands of tiny files; each costs a request and a file open, planning slows, and heavy request rates can draw S3 SlowDown errors. Batch writes and compact.`,
      `<strong>Over-partitioning.</strong> Partitioning by user ID, or by hour on modest data, produces tiny files and huge metadata. Partition by day and sort inside files.`,
      `<strong>Never expiring snapshots.</strong> Time travel keeps every replaced file, so storage only grows until you expire snapshots. Deleting files by hand breaks snapshots that still point to them, and orphan cleanup with too short a window can delete files from writes still in progress.`,
      `<strong>Plain folders as tables.</strong> Without a table format there is no atomic commit, so a failed or concurrent job can leave partial results visible, and Hive-style partition columns filled in the wrong format give silently wrong answers.`,
      `<strong>Expecting warehouse speed for BI.</strong> Many analysts hitting raw lake tables through Athena means slow dashboards and a bill per scan. Add aggregated tables, or serve hot dashboards from a warehouse or OLAP store.`
    ],
    interview: [
      `Why do you need Iceberg or Delta Lake on top of Parquet files in S3? What goes wrong with a plain folder of files?`,
      `How does an engine avoid reading a whole 50 TB table? Walk through catalog, manifests, partition pruning, file statistics and column projection.`,
      `A streaming job writes to the lake every 10 seconds and queries got slow. Why, and how do you fix it?`,
      `When would you choose Snowflake, BigQuery or Redshift over S3 plus Iceberg plus Athena, and when the other way round?`
    ],
    guides: [`oltp-olap-search`, `aws-storage`],
    deep: [`change-data-capture`],
    related: [`d1`, `d7`, `d9`, `r9`],
    sources: [
      { t: `Iceberg Table Spec`, by: `Apache Iceberg`, url: `https://iceberg.apache.org/spec/` },
      { t: `Delta Transaction Log Protocol`, by: `Delta Lake project`, url: `https://github.com/delta-io/delta/blob/master/PROTOCOL.md` },
      { t: `Parquet file format (row groups, column chunks, statistics)`, by: `Apache Parquet`, url: `https://github.com/apache/parquet-format` },
      { t: `Optimize data (Athena performance tuning)`, by: `AWS docs`, url: `https://docs.aws.amazon.com/athena/latest/ug/performance-tuning-data-optimization-techniques.html` },
      { t: `Lakehouse: A New Generation of Open Platforms (CIDR 2021)`, by: `Armbrust, Ghodsi, Xin, Zaharia`, url: `https://www.cidrdb.org/cidr2021/papers/cidr2021_paper17.pdf` }
    ]
  }
);
