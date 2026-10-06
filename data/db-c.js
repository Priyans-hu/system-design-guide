window.HUB_DB = window.HUB_DB || { types: [] };
window.HUB_DB.types.push(
  {
    id: `search`,
    name: `Search engines`,
    family: `Specialized`,
    summary: `A search engine runs text through analyzers into an inverted index, so it can find and rank matching documents without scanning them. Elasticsearch, OpenSearch and Solr are distributed servers built on Apache Lucene.`,
    glance: { model: `JSON documents; analyzed text in an inverted index`, query: `Full-text match plus filters, facets and aggregations`, bestAt: `Ranked, typo-tolerant text search with filters and facets`, weakAt: `Transactions, frequent updates, joins, being the source of truth`, scale: `Primary shards split data; replicas add reads and failover`, consistency: `Near real-time: searchable after a refresh, 1s by default` },
    how: [
      `<strong>Analyze.</strong> At index time each <code>text</code> field runs through an analyzer: character filters clean the raw text, one tokenizer splits it into tokens, and token filters lowercase, stem or add synonyms. The query goes through the same analyzer, so with an English stemmer "Running Shoes" and "running shoe" meet on the same terms. <code>keyword</code> fields skip analysis and match exactly.`,
      `<strong>Inverted index.</strong> For every term, Lucene keeps a sorted postings list of the documents that contain it, with frequencies and positions. A query reads a few postings lists and intersects them instead of scanning documents. Sorting and aggregations use doc values, a columnar copy of each field built at index time.`,
      `<strong>Buffer, log, refresh.</strong> A new document goes into an in-memory buffer and into the translog, which by default is fsynced before the write is acknowledged. A refresh, every second by default, opens the buffer as a new segment that searches can see, without a full commit. Until then the document is stored but not searchable: search is near real-time, while a GET by id is real-time.`,
      `<strong>Immutable segments.</strong> A segment's data is never rewritten. An update indexes a new copy and marks the old one deleted; a delete only flags the document. Background merges combine small segments into bigger ones and purge the deleted documents. A flush does a Lucene commit and starts a new translog generation.`,
      `<strong>Shards and replicas.</strong> An index is split into primary shards, each a complete Lucene index. A document goes to shard <code>hash(_routing) % number_of_primary_shards</code>, and routing defaults to the document id, so the primary count is fixed when the index is created (split, shrink or reindex to change it). Replica shards on other nodes take over on failure and serve searches too.`,
      `<strong>Query then fetch.</strong> The coordinating node sends the query to one copy (primary or replica) of every shard. Each shard scores its matches and returns only the ids and scores of its top hits; the coordinator merges them into the global top N, then fetches those documents.`,
      `<strong>BM25 relevance.</strong> A term counts for more when it appears often in a field (with diminishing returns, k1 = 1.2), when it is rare across the index (inverse document frequency), and when the field is short (length normalization, b = 0.75). Statistics are kept per shard, so small indexes can rank oddly; <code>dfs_query_then_fetch</code> gathers global statistics first.`
    ],
    diagram: {
      layers: [
        { name: `Client`, items: [[`App server`, `sends documents and queries`]] },
        { name: `Coordinating node`, items: [[`Coordinator`, `routes writes, merges top hits`]] },
        { name: `Shards`, items: [[`Analyzer`, `on the primary: tokenize, stem`], [`Shard search`, `each shard scores with BM25`]] },
        { name: `Memory`, items: [[`Indexing buffer`, `new docs, not yet searchable`]] },
        { name: `Disk`, items: [[`Translog`, `operation log for durability`], [`Segments`, `immutable, visible on refresh`]] },
        { name: `Background`, items: [[`Segment merge`, `merges, purges deletes`]] }
      ],
      edges: [
        [`App server`, `Coordinator`, `sync`, `index or search`],
        [`Coordinator`, `Analyzer`, `sync`, `to primary shard`],
        [`Analyzer`, `Indexing buffer`, `data`, `analyzed terms`],
        [`Analyzer`, `Translog`, `data`, `log operation`],
        [`Indexing buffer`, `Segments`, `async`, `refresh, default 1s`],
        [`Segments`, `Segment merge`, `async`, `background merge`],
        [`Coordinator`, `Shard search`, `sync`, `query every shard`],
        [`Shard search`, `Segments`, `data`, `read postings lists`]
      ],
      paths: [
        { name: `Index a document`, nodes: [`App server`, `Coordinator`, `Analyzer`, `Indexing buffer`, `Segments`, `Segment merge`], note: `The primary shard analyzes the text, buffers the terms and logs the operation; the next refresh writes a searchable segment, and merges later compact it.` },
        { name: `Search`, nodes: [`App server`, `Coordinator`, `Shard search`, `Segments`], note: `Every shard scores its own matches with BM25 and returns its top hits; the coordinator merges them, then fetches the winning documents.` }
      ]
    },
    modeling: [
      `Map fields on purpose: <code>text</code> for words people search, <code>keyword</code> for IDs, tags, filters and sorting, or a multi-field for both. Dynamic mapping guesses once, and changing an existing field means a reindex.`,
      `Denormalize into one document per search result: copy the brand, category and price into the product document. Elastic's docs say good performance comes from de-normalizing, and parent-child joins add a significant query cost.`,
      `Point the app at an alias, not an index. Build the new index in the background, then swap the alias in one atomic call for a zero-downtime reindex.`,
      `For logs and events, write to time-based indices or a data stream, so retention deletes whole old indices instead of running delete-by-query.`,
      `Put exact conditions (tenant, status, date range) in <code>filter</code> clauses: they skip scoring, and frequently used filters get cached.`
    ],
    strengths: [
      `Relevance-ranked full-text search with stemming, synonyms, fuzzy matching, highlighting and autocomplete.`,
      `Combines free text, filters on many fields and facet counts in one fast query.`,
      `Scales out: shards spread data and work across nodes, and replicas add read capacity and failover.`,
      `Flexible JSON documents and fast aggregations make it a strong log and event explorer.`
    ],
    weaknesses: [
      `Near real-time only: a new write is invisible to search until the next refresh, even though a GET by id already sees it.`,
      `No multi-document transactions, and an update reindexes the whole document, so fields that change many times a second churn segments.`,
      `Changing a field's type or the primary shard count needs a reindex, split or shrink.`,
      `Some aggregations are approximate: <code>terms</code> counts across shards, and distinct counts (HyperLogLog++).`,
      `Deep pagination is expensive: <code>from + size</code> stops at 10,000 hits by default.`
    ],
    use: `Users type free text and expect ranked, typo-tolerant results (product search, help centers, autocomplete), or engineers need to explore logs and events by filtering on many fields. Feed it from the primary database.`,
    avoid: `As the system of record, for money or anything that needs transactions, or for counters updated many times a second. Keep the record in Postgres or similar and copy it into the index. If search is a small feature, Postgres full-text search (<code>tsvector</code> plus a GIN index) may be enough.`,
    examples: [
      [`Elasticsearch`, `The best-known Lucene-based engine: full-text search, log analytics and vector search, with Kibana for exploring data. Pick it for the broadest feature set.`, `Elastic Cloud`],
      [`OpenSearch`, `Apache 2.0 fork of Elasticsearch 7.10.2 from 2021, now run by the OpenSearch Software Foundation under the Linux Foundation. Pick it on AWS or for a permissive license.`, `Amazon OpenSearch Service`],
      [`Apache Solr`, `Long-running Apache search server on Lucene; SolrCloud uses ZooKeeper to coordinate the cluster. Pick it if your team already runs it.`, ``],
      [`Meilisearch`, `Rust engine for instant search-as-you-type, with typo tolerance on by default and little to configure. Good for app and site search.`, `Meilisearch Cloud`],
      [`Typesense`, `C++ engine that keeps its index in RAM for fast, typo-tolerant search. Size the machine so the whole index fits in memory.`, `Typesense Cloud`]
    ],
    pitfalls: [
      `<strong>Making it the source of truth.</strong> If a bad mapping or a lost cluster forces a rebuild, the data must exist somewhere else. Always be able to reindex from the primary database.`,
      `<strong>Dual writes from the app.</strong> Writing the database and then the index drifts when one call fails or two writers race. Use change data capture (Debezium reads the Postgres write-ahead log) or an outbox. Delivery is at least once, so use the row id as the document id to make replays idempotent. A polling job that selects rows by <code>updated_at</code> never sees deletes.`,
      `<strong>Oversharding.</strong> Many tiny shards waste heap and slow the cluster, and by default a node accepts at most 1,000 non-frozen shards. Elastic's guidance: shards between 10GB and 50GB, with fewer than 200 million documents each.`,
      `<strong>Deep pagination.</strong> <code>from + size</code> is capped by <code>index.max_result_window</code> (10,000 by default) and gets slower with depth; use <code>search_after</code> with a point in time.`,
      `<strong>Refreshing on every write.</strong> <code>refresh=true</code> creates tiny segments that must be merged later. Use <code>refresh=wait_for</code> only where a user must see their own change.`
    ],
    interview: [
      `How do you keep the search index in sync with Postgres, and what happens when the indexer falls behind or crashes?`,
      `A seller edits a price and search still shows the old one for a moment. Why, and what are your options?`,
      `How would you choose the number of shards for a product index, and what do you do when it outgrows them?`,
      `Why can a short title that matches a query rank above a long description that mentions it three times?`
    ],
    guides: [`oltp-olap-search`, `sql-vs-nosql`, `consistency-levels`, `pagination`],
    deep: [`change-data-capture`, `outbox-inbox`, `cqrs`],
    related: [`d2`, `d6`, `t4`, `k7`],
    sources: [
      { t: `Near real-time search`, by: `Elastic`, url: `https://www.elastic.co/docs/manage-data/data-store/near-real-time-search` },
      { t: `Anatomy of an analyzer`, by: `Elastic`, url: `https://www.elastic.co/docs/manage-data/data-store/text-analysis/anatomy-of-an-analyzer` },
      { t: `Practical BM25, Part 2: The BM25 algorithm and its variables`, by: `Elastic blog`, url: `https://www.elastic.co/blog/practical-bm25-part-2-the-bm25-algorithm-and-its-variables` },
      { t: `Size your shards`, by: `Elastic`, url: `https://www.elastic.co/docs/deploy-manage/production-guidance/optimize-performance/size-shards` },
      { t: `Using logs to build a solid data infrastructure (or: why dual writes are a bad idea)`, by: `Martin Kleppmann`, url: `https://martin.kleppmann.com/2015/05/27/logs-for-data-infrastructure.html` }
    ]
  },
  {
    id: `graph`,
    name: `Graph databases`,
    family: `Specialized`,
    summary: `A graph database stores nodes and the relationships between them as first-class records, so queries follow connections hop by hop instead of computing joins. It fits when the relationships are the question.`,
    glance: { model: `Nodes and typed relationships, both with properties`, query: `Pattern matching and traversals: Cypher, Gremlin, SPARQL`, bestAt: `Variable-depth paths: fraud rings, recommendations, access graphs`, weakAt: `Whole-dataset aggregations, bulk scans, scaling writes out`, scale: `One writer plus read replicas; sharding a graph is hard`, consistency: `ACID on the writer; read replicas can lag slightly` },
    how: [
      `<strong>Property graph.</strong> Nodes are entities with zero or more labels (<code>:Person</code>, <code>:Card</code>) and key-value properties. A relationship connects a source node to a target node, has exactly one type (<code>:USED</code>) and one direction, and can carry properties such as <code>since</code>. RDF stores model the same facts as subject-predicate-object triples, queried with SPARQL.`,
      `<strong>Find the start.</strong> A query first finds a few anchor nodes through an ordinary index, such as a lookup on <code>:User(id)</code>. Everything after that is traversal.`,
      `<strong>Index-free adjacency.</strong> In a native store each node holds direct references to its relationships. In Neo4j's record format a node record points to its first relationship, and each relationship record links to the previous and next ones for both of its nodes. A hop is a pointer chase, so query time depends on how much of the graph you touch, not on its total size; a relational database does an index lookup per hop instead. Neo4j's newer block format (the Enterprise default since 5.22) inlines data to cut pointer chasing further.`,
      `<strong>Traverse.</strong> The engine expands hop by hop, filtering on relationship type, direction and properties. Variable-length patterns such as <code>(a)-[:KNOWS*1..3]-&gt;(b)</code> (or Neo4j 5's quantified path patterns) and shortest-path search are built in.`,
      `<strong>Query languages.</strong> Cypher (Neo4j, and openCypher on Neptune), Gremlin from Apache TinkerPop (JanusGraph, Neptune) and SPARQL for RDF. GQL (ISO/IEC 39075) was published as the ISO standard graph query language in April 2024.`,
      `<strong>Not every graph store chases pointers.</strong> Neptune keeps the graph in indexes of quads (SPOG, POGS, GPSO), and JanusGraph stores each vertex's adjacency list as a row in Cassandra, HBase, Bigtable or ScyllaDB, writing every edge twice, once per end. Hops become index or key lookups, which is why data locality matters.`,
      `<strong>Writes and scale.</strong> Writes commit as ACID transactions on one leader (Neo4j) or one writer instance (Neptune), and read replicas apply them shortly after. Reads scale out with replicas; writes mostly scale up. Partitioning a graph well is NP-hard in general, and even Neo4j's Infinigraph shards only properties, keeping the graph structure in a single shard.`
    ],
    diagram: {
      layers: [
        { name: `Client`, items: [[`App server`, `fraud and friend queries`]] },
        { name: `Query engine`, items: [[`Query planner`, `parses Cypher or Gremlin`]] },
        { name: `Index and log`, items: [[`Property index`, `finds start nodes by key`], [`Transaction log`, `durable commit of writes`]] },
        { name: `Node store`, items: [[`Node records`, `point to first relationship`]] },
        { name: `Relationship store`, items: [[`Relationship chains`, `next edge for each node`]] },
        { name: `Cluster`, items: [[`Read replica`, `applies the log, serves reads`]] }
      ],
      edges: [
        [`App server`, `Query planner`, `sync`, `Cypher query`],
        [`Query planner`, `Property index`, `data`, `find start node`],
        [`Property index`, `Node records`, `data`, `node id`],
        [`Node records`, `Relationship chains`, `data`, `follow pointers`],
        [`Query planner`, `Transaction log`, `data`, `commit write`],
        [`Transaction log`, `Node records`, `data`, `apply to store`],
        [`Transaction log`, `Read replica`, `repl`, `ship transactions`]
      ],
      paths: [
        { name: `Friends of friends`, nodes: [`App server`, `Query planner`, `Property index`, `Node records`, `Relationship chains`], note: `The planner finds the user once through the index; every hop after that follows stored pointers, so cost grows with the edges visited, not the graph size.` },
        { name: `Add a relationship`, nodes: [`App server`, `Query planner`, `Transaction log`, `Read replica`], note: `The write commits through the writer's transaction log, and replicas apply it in order, so a replica read can briefly miss it.` }
      ]
    },
    modeling: [
      `Make the things you traverse through nodes and the verbs between them typed relationships: <code>(:Account)-[:USED]-&gt;(:Device)</code>. Values you only display or filter on stay as properties.`,
      `Prefer specific relationship types (<code>:FOLLOWS</code>, <code>:PAID</code>) over one generic type with a kind property, so a query expands only the edges it needs.`,
      `Index the properties queries start from (user id, card number); without one, a traversal begins by scanning every node with that label.`,
      `Plan for supernodes: a node with millions of relationships (a shared office IP, a celebrity) makes every hop through it explode. Split it, skip it, or keep that fact as a property.`,
      `Treat the graph as a read model when you can: keep the record in SQL and feed the graph with change data capture, so it can be rebuilt.`
    ],
    strengths: [
      `Multi-hop, variable-depth queries stay fast because each hop follows stored links instead of joining whole tables.`,
      `Expressive patterns: rings, paths and shortest paths in a few lines of Cypher or Gremlin.`,
      `Schema-optional: add a new label or relationship type without a migration.`,
      `Graph algorithms such as PageRank and Louvain community detection run next to the data (Neo4j Graph Data Science).`
    ],
    weaknesses: [
      `Hard to shard: a traversal that crosses machines pays a network hop per edge, and Neo4j composite databases do not allow relationships between shards.`,
      `Poor at whole-dataset aggregation and scans (revenue by month); use SQL or a columnar store.`,
      `Supernodes and unbounded path queries can blow up memory and latency.`,
      `One more system to run and keep in sync, usually fed from the primary database.`
    ],
    use: `When the question is about connections several hops deep, often of unknown depth: fraud rings sharing devices or cards, "people you may know", permission checks through nested groups, supply chains and knowledge graphs.`,
    avoid: `When relationships are shallow or fixed, like orders to customers: SQL joins handle that. For trees and bounded walks (org charts, category trees, two-hop friend lists), a recursive CTE in Postgres is usually enough: index the edge table on both columns, cap the depth and guard against loops with the <code>CYCLE</code> clause. For analytics over everything, use a columnar store.`,
    examples: [
      [`Neo4j`, `The best-known native property graph, queried with Cypher. Pick it for fraud, recommendations and knowledge graphs that fit one cluster.`, `Neo4j AuraDB`],
      [`Amazon Neptune`, `Managed graph on AWS for property graphs (Gremlin, openCypher) and RDF (SPARQL): one writer, up to 15 read replicas with lag usually well under 100 ms, and six copies of the data across three AZs.`, `Fully managed; Neptune Analytics is a separate in-memory engine for graph analytics`],
      [`JanusGraph`, `Open source Gremlin graph that keeps adjacency lists in Cassandra, HBase, Bigtable or ScyllaDB, with Elasticsearch, Solr or Lucene for search indexes. Pick it for very large graphs on a backend you already run.`, ``],
      [`PostgreSQL recursive CTEs`, `<code>WITH RECURSIVE</code> walks trees and shallow graphs in the database you already have; PostgreSQL 14 added <code>SEARCH</code> and <code>CYCLE</code> clauses.`, `Any managed Postgres`],
      [`Apache AGE`, `PostgreSQL extension (an Apache top-level project since 2022) that runs openCypher queries over graph data stored in Postgres.`, ``]
    ],
    pitfalls: [
      `<strong>Unbounded paths.</strong> <code>[:KNOWS*]</code> with no upper limit can explore millions of paths. Always cap the depth and add a <code>LIMIT</code>.`,
      `<strong>Deep traversals on the request path.</strong> A three-hop expansion on every page view can touch millions of edges. Precompute results such as "people you may know" in a batch job and serve them from a key-value store.`,
      `<strong>Using it as the general database.</strong> List pages, reports and aggregates run better in SQL; keep the graph for relationship queries.`,
      `<strong>Random placement.</strong> JanusGraph places vertices randomly by default, so neighbours land on different machines and each hop can cross the network. Keeping what is traversed together on one partition is the fix, and it is hard.`,
      `<strong>Reading your own write from a replica.</strong> A replica may not have applied it yet. Pass the Neo4j bookmark from the write to the next read, or send that read to the writer, as Neptune's docs advise.`
    ],
    interview: [
      `How would you find fraud rings where accounts share devices, cards or addresses? Compare a graph database with SQL self-joins.`,
      `Design "people you may know" for hundreds of millions of users. Would you traverse live or precompute candidates?`,
      `Why is a graph database hard to shard, and how would you scale reads?`,
      `When are recursive CTEs in Postgres enough instead of a graph database?`
    ],
    guides: [`sql-vs-nosql`, `normalize-denormalize`, `sharding-keys`],
    deep: [`change-data-capture`, `cqrs`],
    related: [`d2`, `d3`, `d5`],
    sources: [
      { t: `Graph database concepts`, by: `Neo4j`, url: `https://neo4j.com/docs/getting-started/appendix/graphdb-concepts/` },
      { t: `Graph Databases, 2nd edition (chapter 6: graph database internals)`, by: `Ian Robinson, Jim Webber, Emil Eifrem (O'Reilly, free from Neo4j)`, url: `https://go.neo4j.com/rs/710-RRC-335/images/Graph_Databases_2e_Neo4j.pdf` },
      { t: `Amazon Neptune DB clusters`, by: `AWS`, url: `https://docs.aws.amazon.com/neptune/latest/userguide/feature-overview-db-clusters.html` },
      { t: `Graph partitioning`, by: `JanusGraph`, url: `https://docs.janusgraph.org/advanced-topics/partitioning/` },
      { t: `WITH queries (common table expressions)`, by: `PostgreSQL docs`, url: `https://www.postgresql.org/docs/current/queries-with.html` }
    ]
  },
  {
    id: `vector`,
    name: `Vector databases`,
    family: `Specialized`,
    summary: `A vector database stores embeddings (arrays of numbers from an ML model) and finds the ones nearest a query vector, usually with an approximate index (HNSW or IVF). It powers semantic search and RAG.`,
    glance: { model: `Fixed-length float vectors with an id and metadata`, query: `Top-k nearest by cosine, dot product or L2`, bestAt: `Semantic search, RAG retrieval, similar items, near-duplicates`, weakAt: `Exact terms like IDs and SKUs, strict filters, exactness`, scale: `Memory grows with vectors times dimensions; shard and quantize`, consistency: `pgvector is transactional; Pinecone eventual; Milvus tunable` },
    how: [
      `<strong>Embed.</strong> A model turns each text chunk, image or user into a fixed-length vector, so similar meaning lands close together. Store the vector with an id, the source text and metadata, and embed queries with the same model.`,
      `<strong>Pick the distance.</strong> Cosine compares direction, dot product compares direction and length, and L2 is straight-line distance. On unit-length vectors (OpenAI's embeddings come normalized) all three give the same ranking, so use the metric the model was trained for. pgvector spells them <code>&lt;=&gt;</code>, <code>&lt;#&gt;</code> (negative inner product) and <code>&lt;-&gt;</code>.`,
      `<strong>Exact search.</strong> Exact k-NN compares the query with every vector: perfect recall, but the cost grows linearly with the data. pgvector does this by default; it is fine for small sets, or after a filter has already narrowed the rows.`,
      `<strong>HNSW.</strong> A layered proximity graph (Malkov and Yashunin). Search enters at the sparse top layer, greedily moves to closer neighbours, then drops a layer and repeats; an insert runs the same search to find its neighbours. <code>m</code> sets links per node, <code>ef_construction</code> the build quality and <code>ef_search</code> the recall vs latency trade at query time. Per pgvector, it beats IVF on speed for a given recall but builds slower and uses more memory.`,
      `<strong>IVF.</strong> k-means groups the vectors into lists around centroids, and a query scans only the closest few lists (pgvector probes 1 by default). It builds faster and uses less memory, but it must be trained on existing data, and recall depends on how many lists you probe. Product quantization (Jégou et al.) compresses each vector into a short code so far more fit in RAM, at some cost in accuracy.`,
      `<strong>Filter.</strong> Metadata filters (tenant, language, date) can run after the index scan, which can leave fewer than k results, or during it: Qdrant adds graph edges per payload value, OpenSearch applies the filter inside the k-NN search, and pgvector 0.8.0 added iterative index scans.`,
      `<strong>Hybrid search.</strong> Embeddings miss exact tokens such as error codes and SKUs, so many systems also run BM25 and merge the two ranked lists, often with reciprocal rank fusion: each list adds 1 / (60 + rank) to a document's score.`
    ],
    diagram: {
      layers: [
        { name: `Client`, items: [[`App server`, `RAG or semantic search`]] },
        { name: `Embedding`, items: [[`Embedding model`, `embeds docs and queries`]] },
        { name: `Vector database`, items: [[`Write-ahead log`, `makes upserts durable`], [`Query engine`, `plans filters, runs ANN`]] },
        { name: `Indexes`, items: [[`HNSW graph`, `layered neighbour links, in RAM`], [`Metadata index`, `tenant, date, tags`], [`Keyword index`, `BM25 for hybrid search`]] },
        { name: `Storage`, items: [[`Vector segments`, `full vectors and payloads`]] }
      ],
      edges: [
        [`App server`, `Embedding model`, `sync`, `embed text`],
        [`Embedding model`, `Write-ahead log`, `sync`, `upsert vector`],
        [`Embedding model`, `Query engine`, `sync`, `query vector`],
        [`Write-ahead log`, `HNSW graph`, `data`, `add to graph`],
        [`Write-ahead log`, `Vector segments`, `data`, `persist`],
        [`Query engine`, `HNSW graph`, `data`, `greedy walk`],
        [`Query engine`, `Metadata index`, `data`, `apply filter`],
        [`Query engine`, `Keyword index`, `data`, `BM25 match`],
        [`HNSW graph`, `Vector segments`, `data`, `rescore candidates`]
      ],
      paths: [
        { name: `Index a chunk`, nodes: [`App server`, `Embedding model`, `Write-ahead log`, `HNSW graph`], note: `The chunk is embedded and logged durably, then inserted into the graph by searching for its nearest neighbours and linking to them.` },
        { name: `Semantic query`, nodes: [`App server`, `Embedding model`, `Query engine`, `HNSW graph`, `Vector segments`], note: `The query vector enters the graph at the top layer and walks greedily down; the best candidates are filtered, rescored and returned as the top k.` }
      ]
    },
    modeling: [
      `Store chunks, not whole documents: each vector carries its chunk text, a source id and the metadata you filter on, so a hit can be shown and traced back.`,
      `Record the embedding model and version with every vector. Vectors from different models are not comparable, so a model change means re-embedding into a new index and switching over.`,
      `Isolate tenants on purpose: a filter on <code>tenant_id</code>, one Pinecone namespace per tenant, or a Milvus partition key on the tenant field.`,
      `Cut memory with fewer dimensions, 16-bit floats (pgvector <code>halfvec</code>) or quantization, then rescore the top candidates with full vectors.`,
      `Keep vectors in sync with their source rows: re-embed on change through CDC or an outbox, and delete vectors when the source is deleted.`
    ],
    strengths: [
      `Finds by meaning: synonyms, paraphrases and similar images match without sharing words.`,
      `ANN indexes return the top k without comparing the query against every vector.`,
      `Recall and latency are tunable per query (<code>ef_search</code>, probes).`,
      `Most products combine metadata filters and keyword search with vector search in one query.`
    ],
    weaknesses: [
      `Approximate: results can silently miss true neighbours, so you must measure recall against exact search.`,
      `Memory-hungry: 1M vectors of 1,536 float32 dimensions are about 6 GB raw, before any index overhead.`,
      `Restrictive filters cut recall unless the engine filters during the search, and IVF lists are learned from the rows present at build time.`,
      `Quality depends more on the embedding model and chunking than on the database, and pure vector search misses exact identifiers.`,
      `Changing the embedding model means re-embedding and reindexing everything.`
    ],
    use: `When queries are about meaning: semantic search, retrieval for RAG, similar products or images, and near-duplicate detection, where an approximate top k is acceptable.`,
    avoid: `For exact lookups, structured filters or keyword search on IDs and codes: use a B-tree index or a search engine. If you already run Postgres and the vectors fit on one node, start with pgvector before adding a separate vector database.`,
    examples: [
      [`pgvector`, `Postgres extension: a <code>vector</code> type, exact search, and HNSW and IVFFlat indexes, with joins and transactions over the rest of your data. Pick it first if you already run Postgres.`, `Amazon RDS for PostgreSQL and Aurora PostgreSQL`],
      [`Pinecone`, `Serverless vector database with namespaces, metadata filters and dense plus sparse hybrid search. Eventually consistent: new writes can take a moment to show. Pick it when you want nothing to operate.`, `Managed only`],
      [`Milvus`, `Open source and distributed: compute is separate from storage, data sits in object storage, and it offers many index types (HNSW, IVF variants, DiskANN, GPU). Consistency is tunable. Pick it for very large collections.`, `Zilliz Cloud`],
      [`Weaviate`, `Open source, written in Go, HNSW by default, with vectorizer modules and hybrid search that fuses BM25 and vector scores (alpha 0 is pure keyword, 1 pure vector).`, `Weaviate Cloud`],
      [`Qdrant`, `Open source, written in Rust. Payload indexes let filters apply during the HNSW search, with scalar, binary and product quantization built in.`, `Qdrant Cloud`],
      [`OpenSearch k-NN`, `Vector fields in an OpenSearch index (Faiss or Lucene engines; HNSW or IVF), with filtering inside the k-NN search and hybrid queries that combine BM25 and vector scores.`, `Amazon OpenSearch Service`]
    ],
    pitfalls: [
      `<strong>Post-filtering.</strong> pgvector applies a <code>WHERE</code> clause after the approximate index scan: with <code>ef_search</code> at 40 and a filter that matches 10% of rows, about 4 rows come back on average. Turn on iterative index scans, filter inside the search, or partition by tenant.`,
      `<strong>Never measuring recall.</strong> Defaults such as pgvector's <code>hnsw.ef_search</code> of 40 may be too low for your data and your k. Compare against exact search on a sample and tune.`,
      `<strong>Mixing models or metrics.</strong> Querying with a different model, or with L2 when the model expects cosine, returns plausible-looking nonsense.`,
      `<strong>IVF built too early.</strong> Training the lists on an empty or tiny table gives poor clusters. pgvector says to create the index after the table has data, with about rows / 1000 lists up to 1M rows; rebuild as the data shifts.`,
      `<strong>Index not in memory.</strong> An HNSW graph that spills to disk turns each hop into random I/O. Size RAM for the index, or use a disk-oriented index such as DiskANN.`
    ],
    interview: [
      `Design semantic search over millions of support articles for a RAG chatbot. Which index, which metric, and how do you keep each customer's data separate?`,
      `HNSW vs IVF: how do recall, latency, memory and build time trade off?`,
      `When is pgvector enough, and what would make you move to a dedicated vector database?`,
      `Why add keyword search to vector search, and how would you merge the two result lists?`
    ],
    guides: [`oltp-olap-search`, `sql-vs-nosql`, `sharding-keys`],
    deep: [`change-data-capture`, `outbox-inbox`],
    related: [`d2`, `d6`, `d8`],
    sources: [
      { t: `Efficient and robust approximate nearest neighbor search using Hierarchical Navigable Small World graphs (IEEE TPAMI)`, by: `Yu. A. Malkov, D. A. Yashunin`, url: `https://arxiv.org/abs/1603.09320` },
      { t: `Product quantization for nearest neighbor search (IEEE TPAMI 2011)`, by: `Hervé Jégou, Matthijs Douze, Cordelia Schmid`, url: `https://www.irisa.fr/texmex/people/jegou/papers/jegou_searching_with_quantization.pdf` },
      { t: `pgvector README`, by: `pgvector`, url: `https://github.com/pgvector/pgvector` },
      { t: `Indexing: payload index and filterable HNSW`, by: `Qdrant`, url: `https://qdrant.tech/documentation/manage-data/indexing/` },
      { t: `Reciprocal Rank Fusion outperforms Condorcet and individual Rank Learning Methods (SIGIR 2009)`, by: `Gordon V. Cormack, Charles L. A. Clarke, Stefan Buettcher`, url: `https://cormack.uwaterloo.ca/cormacksigir09-rrf.pdf` }
    ]
  }
);
Object.assign(window.HUB_DB, {
  finder: [
    [`Money movement with strict transactions`, `relational`, `Debits and credits must commit together or not at all. PostgreSQL or MySQL give ACID transactions, constraints and row locks, so a double-entry ledger stays balanced.`],
    [`A typical web app: users, orders, inventory, admin reports`, `relational`, `Joins, constraints and ad hoc SQL in PostgreSQL. One primary plus read replicas goes a long way, and you shard only when one primary truly cannot keep up.`],
    [`Global writes with strong consistency`, `distributed-sql`, `Spanner, CockroachDB or YugabyteDB replicate each range of rows through consensus and keep SQL transactions consistent across regions. Every write pays a consensus round trip.`],
    [`Outgrew one Postgres primary but still needs SQL transactions`, `distributed-sql`, `CockroachDB speaks the PostgreSQL wire protocol and divides tables into ranges that split automatically and rebalance across nodes, so writes scale without hand-built sharding.`],
    [`Shopping cart and sessions at huge scale`, `key-value`, `Every read and write is by one key and must stay available. Amazon's Dynamo paper was built around the shopping cart, and DynamoDB serves this kind of access at single-digit millisecond latency.`],
    [`Rate-limit counters, leaderboards and hot caches`, `key-value`, `Redis keeps data in memory with atomic commands: <code>INCR</code> plus <code>EXPIRE</code> makes a rate limiter, and a sorted set makes a leaderboard.`],
    [`Product catalog with varied attributes`, `document`, `A phone and a sofa have different fields. MongoDB stores each product as one JSON-like document and indexes only the fields you filter on.`],
    [`User profiles or CMS pages read as one unit`, `document`, `Keep the whole aggregate (profile, settings, addresses) in one document so a page load is one read, and single-document writes are atomic in MongoDB.`],
    [`Chat messages, write-heavy, read by conversation`, `wide-column`, `Partition by <code>(channel_id, bucket)</code> and cluster by <code>message_id</code>, so loading history is one partition read. Discord stored messages this way in Cassandra, then moved to ScyllaDB, going from 177 nodes to 72.`],
    [`Event or IoT writes accepted in several datacenters`, `wide-column`, `Cassandra sends every write to all replicas, sets a replication factor per datacenter and lets each query choose its consistency level, and its LSM storage makes appends cheap.`],
    [`Dashboards over billions of events`, `columnar`, `ClickHouse reads only the columns a query touches, compressed and processed in vectorized batches. Cloudflare's HTTP analytics ran on it at 6M requests per second (2018).`],
    [`Analysts running ad hoc SQL over all business data`, `columnar`, `Snowflake and BigQuery store tables in compressed columnar form and scale compute separately from storage.`],
    [`Metrics with labels and retention`, `time-series`, `Prometheus stores each label combination as its own series, packs samples into two-hour blocks and deletes data past retention (15 days by default).`],
    [`Sensor readings queried by device and time range`, `time-series`, `TimescaleDB splits a Postgres table into time chunks, compresses old chunks into columns and drops expired chunks whole.`],
    [`Cheap long-term event archive queried rarely`, `lakehouse`, `Parquet files on S3 in Apache Iceberg tables cost object-storage prices, and Athena or Spark query them, with time travel, only when needed.`],
    [`BI and ML on the same data without copying it`, `lakehouse`, `Open table formats such as Delta Lake and Iceberg add ACID transactions and schema evolution to files on object storage: the lakehouse idea from Armbrust et al. (CIDR 2021).`],
    [`Full-text search with typo tolerance`, `search`, `Elasticsearch or OpenSearch analyzers and fuzzy queries, or Meilisearch and Typesense with typo tolerance built in, rank matches by relevance.`],
    [`Search and filter logs across services`, `search`, `OpenSearch indexes every field, so you can filter by service, status and free text at once, and time-based indices make retention a matter of deleting old ones.`],
    [`Friends of friends, fraud rings`, `graph`, `Neo4j or Neptune walk account → device → account paths directly instead of chaining self-joins.`],
    [`Permission checks through nested groups and folders`, `graph`, `Access is reachability over users, groups and resources. A graph database or a recursive CTE fits; Google's Zanzibar stores relation tuples in Spanner and answers a check by expanding nested groups recursively.`],
    [`Semantic search for RAG`, `vector`, `Embed chunks and query by meaning: pgvector if you already run Postgres, or Pinecone, Milvus or Qdrant at larger scale.`],
    [`"More like this" for products or images`, `vector`, `Embed each item and return its nearest neighbours, filtered by stock or category in the same query (Qdrant, OpenSearch k-NN).`]
  ],
  indexes: [
    [`B-tree`, `A balanced tree of sorted keys in fixed-size pages, so a lookup or range scan reads a few pages from root to leaf.`, `Equality, ranges, sorting, prefix matches`, `PostgreSQL and MySQL InnoDB (the default index)`],
    [`Hash`, `Hashes the key to a bucket, so an equality lookup jumps straight to it but cannot scan a range.`, `Exact-match lookups only`, `PostgreSQL hash indexes; DynamoDB hashes the partition key to place items`],
    [`LSM-tree with bloom filters`, `Writes go to a write-ahead log and an in-memory table, which is flushed to sorted, immutable files that compaction merges; a bloom filter per file lets point reads skip files that cannot hold the key.`, `Write-heavy ingestion`, `RocksDB, Cassandra, ScyllaDB`],
    [`Inverted index`, `Maps each term to a sorted list of the documents that contain it.`, `Full-text search, filters on many fields`, `Lucene (Elasticsearch, OpenSearch, Solr)`],
    [`Bitmap`, `Keeps one bit array per distinct value, so filters become fast AND and OR operations over bits.`, `Low-cardinality filters in analytics (status, country)`, `Apache Druid (Roaring bitmaps), Apache Pinot, Oracle; PostgreSQL builds bitmaps in memory to combine indexes`],
    [`BRIN`, `Stores only a summary, such as min and max, per range of table pages (128 by default) and skips ranges that cannot match.`, `Huge append-only tables where values follow insert order, like timestamps`, `PostgreSQL`],
    [`GIN`, `An inverted index inside Postgres: each element of an array, JSON document or text vector points to the rows that contain it.`, `<code>jsonb</code> containment, arrays, full-text search, trigram <code>LIKE</code>`, `PostgreSQL`],
    [`GiST or R-tree`, `Groups nearby shapes under bounding boxes in a balanced tree, so a search descends only into boxes that overlap the query.`, `Geo: within a radius, intersects, nearest neighbour`, `PostGIS (an R-tree built on GiST), MySQL spatial indexes, SQLite R*Tree`],
    [`Sparse primary index`, `Keeps one mark per granule of sorted rows (up to 8,192 rows by default) instead of one per row, so it fits in memory and picks which granules to read.`, `Range filters on the sort key over billions of rows`, `ClickHouse MergeTree`],
    [`HNSW or IVF`, `HNSW walks a layered graph of near neighbours; IVF scans only the vector clusters closest to the query.`, `Approximate nearest neighbour search on embeddings`, `pgvector, Faiss, Milvus, Qdrant, OpenSearch k-NN`]
  ],
  confusions: [
    [`Wide-column means column-oriented, like ClickHouse.`, `No. Cassandra, HBase and Bigtable organize data by row or partition key and store a row's columns together (per column family in HBase), so they are still row-oriented underneath. Column-oriented stores such as ClickHouse and BigQuery keep each column separately, so scans read and compress only the columns they need.`],
    [`NoSQL means no schema.`, `The schema moves into the application rather than disappearing (schema-on-read). Cassandra tables still declare columns, and MongoDB can enforce a shape with <code>$jsonSchema</code> validation.`],
    [`SQL does not scale.`, `One well-indexed primary with read replicas carries most products a long way, and past that you shard or move to distributed SQL. Notion split Postgres into 480 logical shards on 32 databases (2021), and Figma sharded Postgres horizontally (2024). What gets hard is cross-shard joins and transactions, not SQL: Figma chose not to support atomic cross-shard transactions.`],
    [`MongoDB has no transactions.`, `Single-document writes have always been atomic, and multi-document ACID transactions arrived in MongoDB 4.0 for replica sets and 4.2 for sharded clusters. MongoDB still says they cost more than single-document writes and do not replace good schema design.`],
    [`Redis is either a durable database or a cache that loses everything on restart.`, `Neither. By default Redis saves RDB snapshots, and you can turn on an append-only file that fsyncs once per second by default. Replication is asynchronous, so acknowledged writes can be lost in a failover. Treat it as a primary store only for data you can lose or rebuild, or use a durable variant such as Amazon MemoryDB.`],
    [`Elasticsearch can be the system of record.`, `It stores documents durably with a translog and replicas, but it has no multi-document transactions, writes appear in search only after a refresh, a field type change means reindexing, and Elastic calls snapshots the only reliable way to back up a cluster. Keep the record in a database and treat the index as a rebuildable copy fed by CDC or an outbox.`],
    [`Time-series and columnar databases are unrelated.`, `They overlap. TimescaleDB's hypercore engine keeps older data in columns, InfluxDB 3 is built on Apache Arrow, DataFusion and Parquet, and ClickHouse ships a stack for logs, metrics and traces. A time-series database adds time partitioning, retention, downsampling and series-aware ingestion on top.`],
    [`Distributed SQL is Postgres that scales for free.`, `A write commits only after a majority of its range's replicas agree, a database set to survive a region failure pays at least a cross-region round trip per write, and Spanner makes each commit wait out clock uncertainty. If your data and writes fit one primary, a single Postgres node is faster and simpler.`]
  ],
  polyglot: {
    system: `Food delivery app`,
    stores: [
      [`Orders, payments, restaurants and menus`, `relational`, `PostgreSQL`, `Placing an order and recording its payment must commit together, and support staff need ad hoc SQL.`],
      [`Carts, sessions and live courier locations`, `key-value`, `Redis`, `Small hot values overwritten every few seconds; geo commands find couriers near a restaurant, and a lost update is replaced moments later.`],
      [`Restaurant and dish search`, `search`, `OpenSearch`, `Typo-tolerant text search plus filters and facets for cuisine, price and rating, fed from Postgres through CDC.`],
      [`"Something spicy and light" dish discovery`, `vector`, `pgvector`, `Embeddings of dish descriptions match by meaning, inside the same Postgres that holds the menus.`],
      [`Orders and delivery-time dashboards`, `columnar`, `ClickHouse`, `Aggregates order events by city and hour without loading the primary database.`],
      [`Service latency and error metrics`, `time-series`, `Prometheus`, `Labelled metrics for alerting and SLO dashboards, kept for a short retention window.`],
      [`Years of order history for finance and ML`, `lakehouse`, `Apache Iceberg on S3`, `Cheap storage that Athena or Spark can query, with time travel for audits and model training.`]
    ]
  },
  specialized: [
    [`Geospatial`, `Indexes for points and shapes that answer "within 2 km" and "nearest first": R-trees, geohash-style cells, or hexagonal grids.`, `PostGIS (an R-tree on GiST), H3 (Uber's hexagonal grid, 16 resolutions), Redis GEO (a sorted set scored by a 52-bit interleaved latitude and longitude)`],
    [`Ledger or immutable log`, `Append-only records that are never updated, with double-entry rules or cryptographic proofs so tampering shows.`, `TigerBeetle (double-entry accounting), immudb (verifiable, append-only). Amazon QLDB reached end of support on July 31, 2025.`],
    [`Embedded database`, `A library inside your process: no server and no network hop, just files on local disk.`, `SQLite (transactional, the most widely deployed), DuckDB (in-process analytics), RocksDB (LSM key-value under Kafka Streams state stores and TiKV)`],
    [`Event log as the source of truth`, `Every change is an ordered event that services replay to rebuild state. Log compaction keeps at least the latest value per key, and a null value deletes the key.`, `Apache Kafka (compacted topics)`],
    [`Object storage as a key-value store`, `Put and get whole objects by key: huge, cheap and durable, but slow per request, with no atomic updates across keys. Conditional writes (If-None-Match, If-Match) allow simple compare-and-swap.`, `Amazon S3 (strongly consistent since December 2020, conditional writes since 2024), Google Cloud Storage, Azure Blob Storage`]
  ]
});
