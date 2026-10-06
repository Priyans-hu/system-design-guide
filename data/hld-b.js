window.HUB_HLD = window.HUB_HLD || {};
Object.assign(window.HUB_HLD, {
  whatsapp: {
    summary: `A thin relay built for millions of mostly idle phone connections. Erlang chat servers hold one socket per phone; messages are kept only until delivered, and servers never see plaintext because phones encrypt with the Signal Protocol (default since 2016).`,
    layers: [
      { name: `Clients`, items: [[`Phone app`, `holds keys, encrypts per device`], [`Linked devices (since 2021)`, `each gets its own encrypted copy`]], why: `Only devices hold keys, so encryption, fan-out to a user's devices, and chat history all live on the client; the server only relays ciphertext.` },
      { name: `Real-time connections`, items: [[`Chat servers (Erlang/BEAM)`, `one long-lived socket per phone`], [`FreeBSD hosts`, `about 1M phones each (2014)`]], why: `Millions of mostly idle connections suit BEAM's lightweight processes. The big wins came from removing lock contention in BEAM and FreeBSD, not from adding servers.` },
      { name: `Services`, items: [[`Prekey store`, `start sessions with offline devices`], [`Group fan-out`, `copies one ciphertext to members`], [`Media servers`, `handle encrypted media (250 in 2014)`]], why: `The server cannot read content, so its services handle keys and copies. With Sender Keys a group message is encrypted once, and the server copies it to each member.` },
      { name: `Caching`, items: [[`Write-back cache (2014)`, `absorbs offline-message writes`]], why: `Most parked messages are picked up very quickly, so a write-back cache lets many be delivered and deleted before ever reaching disk. It fixed a 2014 I/O bottleneck.` },
      { name: `Data stores`, items: [[`Offline storage`, `mailboxes, deleted on delivery`], [`Mnesia`, `accounts; <code>async_dirty</code> writes`]], why: `Relay, not archive: a message is deleted once delivered and dropped after 30 days if never delivered, so storage stays small and there is little to leak.` },
      { name: `Object storage`, items: [[`Encrypted blob store`, `attachments, fresh AES-256 key each`]], why: `Media stays off the chat path: the message carries only key, hash, and pointer. Messages stay tiny, and the blob store holds only ciphertext.` }
    ],
    edges: [
      [`Phone app`, `Chat servers (Erlang/BEAM)`, `sync`, `long-lived socket`],
      [`Chat servers (Erlang/BEAM)`, `Linked devices (since 2021)`, `async`, `per-device copy`],
      [`Chat servers (Erlang/BEAM)`, `Write-back cache (2014)`, `data`, `park if offline`],
      [`Write-back cache (2014)`, `Offline storage`, `data`, `delayed flush`],
      [`Phone app`, `Prekey store`, `sync`, `fetch prekeys`],
      [`Phone app`, `Group fan-out`, `sync`, `one ciphertext`],
      [`Group fan-out`, `Chat servers (Erlang/BEAM)`, `async`, `copy per member`],
      [`Phone app`, `Media servers`, `stream`, `encrypted media`],
      [`Media servers`, `Encrypted blob store`, `stream`, `store blob`]
    ],
    paths: [
      { name: `Message to an offline phone`, nodes: [`Phone app`, `Chat servers (Erlang/BEAM)`, `Write-back cache (2014)`, `Chat servers (Erlang/BEAM)`, `Phone app`], note: `An online recipient gets it straight from the chat server; otherwise it waits in offline storage, mostly in the write-back cache. The recipient's ack becomes the second check mark.` },
      { name: `Send a photo`, nodes: [`Phone app`, `Media servers`, `Encrypted blob store`, `Media servers`, `Phone app`, `Chat servers (Erlang/BEAM)`, `Phone app`], note: `The phone encrypts the file with a fresh key and uploads it, then sends a normal message with key, hash, and pointer. The recipient downloads and decrypts.` }
    ]
  },
  discord: {
    summary: `Elixir processes hold every WebSocket session and fan guild events out. A Python API reaches ScyllaDB through Rust data services, with messages keyed by channel and time bucket. Voice runs through Discord's own C++ SFU servers.`,
    layers: [
      { name: `Clients`, items: [[`Desktop and mobile apps`, `WebSocket; voice encrypted with Salsa20`], [`Browser app`, `WebSocket; standard WebRTC voice`]], why: `Discord controls its native apps, so it swapped DTLS/SRTP for faster Salsa20 and sends nothing during silence; browsers must use standard WebRTC, so the SFU bridges both.` },
      { name: `Real-time connections`, items: [[`Gateway sessions (Elixir)`, `one process per WebSocket`], [`Guild processes (Elixir)`, `fan each event to sessions`], [`Manifold`, `batches big-guild sends per node`], [`Voice servers (C++ SFU)`, `forward media, hide user IPs`]], why: `Chat is pub/sub, which suits millions of cheap Erlang VM processes. Voice goes through Discord's SFUs, so user IPs never leak and a muted user's packets are dropped.` },
      { name: `Services`, items: [[`API monolith (Python)`, `stores message, dispatches over gRPC`], [`Data services (Rust, gRPC)`, `coalesce identical database reads`]], why: `An @everyone announcement makes thousands read the same rows. Hash routing by channel ID sends duplicates to one instance, which queries the database once.` },
      { name: `Search`, items: [[`Elasticsearch (since 2017)`, `many small clusters, by guild`], [`Cells on Kubernetes (by 2025)`, `logical groups of clusters`], [`DM index (by 2025)`, `sharded by user ID`]], why: `Not everyone searches, so history is indexed lazily on first search, and in bulk because Elasticsearch prefers bulk writes.` },
      { name: `Data stores`, items: [[`ScyllaDB (since 2022)`, `message history on 72 nodes`], [`Cassandra (before 2022)`, `177 nodes, GC latency spikes`], [`MongoDB (2015)`, `one replica set at launch`]], why: `Every read is per channel, so the partition key is <code>(channel_id, bucket)</code>; 10-day buckets keep partitions under 100 MB. ScyllaDB (no GC) cut p99 reads from 40-125 ms to 15 ms.` },
      { name: `Async and streaming`, items: [[`Google Cloud Pub/Sub`, `indexing queue, replaced Redis`], [`Message router (Rust)`, `groups messages by destination`]], why: `Redis dropped messages once Elasticsearch node failures backed the queue up, so indexing moved to Pub/Sub; a Rust router then groups messages by destination cluster.` },
      { name: `Coordination`, items: [[`etcd`, `voice server health and load`]], why: `Voice servers report health to etcd, so the guild service can send each call to the least-loaded server in the right region.` }
    ],
    edges: [
      [`Desktop and mobile apps`, `API monolith (Python)`, `sync`, `HTTP requests`],
      [`Browser app`, `API monolith (Python)`, `sync`, `HTTP requests`],
      [`Desktop and mobile apps`, `Gateway sessions (Elixir)`, `async`, `WebSocket events`],
      [`Browser app`, `Gateway sessions (Elixir)`, `async`, `WebSocket events`],
      [`API monolith (Python)`, `Data services (Rust, gRPC)`, `sync`, `gRPC`],
      [`Data services (Rust, gRPC)`, `ScyllaDB (since 2022)`, `data`, `coalesced queries`],
      [`API monolith (Python)`, `Guild processes (Elixir)`, `async`, `gRPC dispatch`],
      [`Guild processes (Elixir)`, `Manifold`, `async`, `publish`],
      [`Manifold`, `Gateway sessions (Elixir)`, `async`, `batched per node`],
      [`Desktop and mobile apps`, `Voice servers (C++ SFU)`, `stream`, `voice, Salsa20`],
      [`Browser app`, `Voice servers (C++ SFU)`, `stream`, `WebRTC media`],
      [`Voice servers (C++ SFU)`, `etcd`, `data`, `health reports`],
      [`Guild processes (Elixir)`, `etcd`, `data`, `pick voice server`],
      [`MongoDB (2015)`, `Cassandra (before 2022)`, `repl`, `migration`],
      [`Cassandra (before 2022)`, `ScyllaDB (since 2022)`, `repl`, `2022 migration`],
      [`Google Cloud Pub/Sub`, `Message router (Rust)`, `async`, `pulled batches`],
      [`Message router (Rust)`, `Elasticsearch (since 2017)`, `data`, `guild messages`],
      [`Message router (Rust)`, `DM index (by 2025)`, `data`, `DM messages`]
    ],
    paths: [
      { name: `Send a message`, nodes: [`Desktop and mobile apps`, `API monolith (Python)`, `Data services (Rust, gRPC)`, `ScyllaDB (since 2022)`, `Data services (Rust, gRPC)`, `API monolith (Python)`, `Guild processes (Elixir)`, `Manifold`, `Gateway sessions (Elixir)`, `Desktop and mobile apps`], note: `The client sends it over HTTP; the Python API stores it, then hands it over gRPC to the guild process, which fans it out to every connected session.` },
      { name: `Load channel history`, nodes: [`Desktop and mobile apps`, `API monolith (Python)`, `Data services (Rust, gRPC)`, `ScyllaDB (since 2022)`], note: `The API calls the Rust data service picked by hashing the channel ID; identical in-flight reads share one ScyllaDB query on the channel's time buckets.` }
    ]
  },
  slack: {
    summary: `A Hack (PHP) webapp persists each message to Vitess, then stateful Java channel servers fan it out to regional gateway servers holding WebSockets. Flannel caches boot data at the edge; a Kafka-plus-Redis job queue runs follow-up work.`,
    layers: [
      { name: `Clients`, items: [[`Desktop, mobile, web apps`, `send via HTTP, receive via WebSocket`]], why: `Clients reconnect in storms when an office or region comes back, so connects must be cheap: a slim boot from the edge, then one WebSocket for all events.` },
      { name: `Edge and CDN`, items: [[`Flannel (since 2017)`, `edge cache, fed by live events`]], why: `A full team snapshot on connect (<code>rtm.start</code>) got huge on big teams. Flannel serves a slim boot and on-demand lookups from edge PoPs: 44x smaller on a 32K-user team.` },
      { name: `Load balancing`, items: [[`Envoy edge LBs`, `replaced HAProxy (WebSockets, 2021)`], [`AWS NLB`, `in front of WebSocket Envoys`]], why: `HAProxy reloads left old processes draining long-lived WebSockets for hours; Envoy takes endpoint changes live. By 2023, per-AZ weights could drain a bad AZ within 5 minutes.` },
      { name: `Real-time connections`, items: [[`Gateway Servers`, `hold WebSockets in several regions`], [`Channel Servers (Java)`, `own channels in memory, fan out`], [`Presence Servers`, `track who is online`]], why: `One in-memory owner per channel, found by consistent hashing, makes fan-out local. Each regional gateway subscribes once per channel and relays to its own users.` },
      { name: `Services`, items: [[`Webapp (Hack/PHP)`, `APIs; persists before broadcast`], [`Admin Servers`, `stateless; route to channel owner`]], why: `Persist before broadcast: a message someone has seen can never vanish, at the cost of database latency on every send. Typing indicators skip the database.` },
      { name: `Search`, items: [[`Solr`, `message index, cheap first ranking`], [`App-layer re-ranker`, `rescores top hits, full features`]], why: `Each team's corpus is small, so ranking can afford rich per-message features: Solr ranks by cheap ones, then the app re-ranks the top results with all of them.` },
      { name: `Data stores`, items: [[`Vitess on MySQL`, `by channel ID; 2.3M QPS (2020)`], [`Per-workspace MySQL pairs (before)`, `outgrown by the biggest customers`]], why: `One MySQL pair per workspace broke when a customer outgrew the biggest host; sharding by channel (moved 2017-2020) spreads load, but cross-channel queries now span shards.` },
      { name: `Async and streaming`, items: [[`Kafkagate (Go)`, `takes jobs over HTTP`], [`Kafka (since 2017)`, `durable buffer for jobs`], [`JQRelay (Go) → Redis`, `rate-limited handoff`], [`PHP workers`, `notifications, unfurls, reminders`]], why: `When Redis ran out of memory, no job could be enqueued. Putting Kafka in front was the smallest fix, and the enqueue and dequeue interfaces stayed the same.` },
      { name: `Coordination`, items: [[`Consul`, `service discovery, job rate limits`], [`CHARMs`, `ring managers for channel servers`], [`Rotor (in-house xDS)`, `pushes config to edge Envoys`]], why: `Stateful channel servers need an owner map that heals fast: ring managers bring up a replacement in under 20 seconds, and Rotor reweights edge traffic without reloads.` }
    ],
    edges: [
      [`Desktop, mobile, web apps`, `Envoy edge LBs`, `sync`, `HTTP API`],
      [`Desktop, mobile, web apps`, `AWS NLB`, `async`, `WebSockets`],
      [`AWS NLB`, `Envoy edge LBs`, `async`, `WebSockets`],
      [`Envoy edge LBs`, `Webapp (Hack/PHP)`, `sync`, `API calls`],
      [`Envoy edge LBs`, `Gateway Servers`, `async`, `WebSockets`],
      [`Desktop, mobile, web apps`, `Flannel (since 2017)`, `sync`, `boot, lookups`],
      [`Flannel (since 2017)`, `Webapp (Hack/PHP)`, `sync`, `startup data`],
      [`Webapp (Hack/PHP)`, `Vitess on MySQL`, `data`, `persist first`],
      [`Webapp (Hack/PHP)`, `Admin Servers`, `sync`, `broadcast`],
      [`Admin Servers`, `Channel Servers (Java)`, `sync`, `by channel hash`],
      [`Channel Servers (Java)`, `Gateway Servers`, `async`, `fan-out`],
      [`CHARMs`, `Channel Servers (Java)`, `sync`, `ring membership`],
      [`Webapp (Hack/PHP)`, `Solr`, `sync`, `search query`],
      [`Webapp (Hack/PHP)`, `Kafkagate (Go)`, `sync`, `enqueue job`],
      [`Kafkagate (Go)`, `Kafka (since 2017)`, `async`, `produce`],
      [`Kafka (since 2017)`, `JQRelay (Go) → Redis`, `async`, `relay`],
      [`JQRelay (Go) → Redis`, `PHP workers`, `async`, `dequeue`],
      [`Consul`, `JQRelay (Go) → Redis`, `data`, `rate limits`]
    ],
    paths: [
      { name: `Send a message`, nodes: [`Desktop, mobile, web apps`, `Envoy edge LBs`, `Webapp (Hack/PHP)`, `Vitess on MySQL`, `Webapp (Hack/PHP)`, `Admin Servers`, `Channel Servers (Java)`, `Gateway Servers`], note: `Webapp writes the message to Vitess first, then an Admin Server hashes the channel ID to find its Channel Server, which fans out to subscribed regional Gateway Servers.` },
      { name: `Open the app`, nodes: [`Desktop, mobile, web apps`, `Flannel (since 2017)`, `Webapp (Hack/PHP)`, `Vitess on MySQL`], note: `A Flannel host chosen by consistent hashing serves the whole team in that region. It returns a slim boot payload and hits the backend only on misses.` }
    ]
  },
  uber: {
    summary: `Apps talk to an Edge Gateway; live driver locations sit in memory, sharded by map cell, so dispatch can match by road ETA. Trip state moved to Spanner transactions in 2021; Kafka and Cadence carry events and long workflows.`,
    layers: [
      { name: `Clients`, items: [[`Rider app`, `requests rides, sees cars, ETA`], [`Driver app`, `sends location every 4 s`]], why: `Drivers report every few seconds, so in the 2015 design their phones also held an encrypted trip-state digest used to rebuild trips after a datacenter failover.` },
      { name: `API gateway`, items: [[`Edge Gateway (Go)`, `routing, protocol conversion, rate limits`]], why: `Mobile calls arrive over HTTP while backends may speak gRPC or Thrift, so one gateway converts protocols and applies rate limits and load shedding. Go replaced Node.js.` },
      { name: `Real-time connections`, items: [[`RAMEN push platform`, `streams trip updates to apps`], [`gRPC streams (by 2022)`, `replaced SSE; acks on stream`]], why: `Polling drained batteries on weak networks and once made up 80% of gateway requests, so one long-lived stream per app pushes ETA, route, and nearby-driver updates.` },
      { name: `Services`, items: [[`DISCO (dispatch)`, `matches riders and drivers`], [`Geospatial index`, `live drivers in memory, by cell`], [`Routing / ETA`, `ranks drivers by road time`], [`Fulfillment (since 2021)`, `trip state machines (statecharts)`]], why: `Locations go stale within seconds, so they live in memory, sharded by S2 cell (2015); H3 hexagons (2018) drive pricing and dispatch. Matching ranks by road ETA, not straight-line distance.` },
      { name: `Data stores`, items: [[`Schemaless (MySQL, 2014)`, `append-only trip data`], [`Cassandra (before 2021)`, `fulfillment state, last write wins`], [`Google Cloud Spanner (2021)`, `transactional trip and order state`]], why: `Last-write-wins overwrites during failovers caused consistency bugs, so in 2021 fulfillment moved to Spanner for all-or-nothing updates, paying extra latency to Google Cloud.` },
      { name: `Async and streaming`, items: [[`Kafka`, `app events, changelogs, data lake`], [`Cadence (since 2015)`, `durable long-running workflows`]], why: `Over 300 services queued work through Kafka by 2021, so producers never wait on consumers; Cadence persists workflow state so timeouts and retries survive crashes.` },
      { name: `Coordination`, items: [[`Ringpop (Node.js)`, `gossip membership, key ownership`]], why: `Ringpop gives each key one owner and forwards requests to it, so services scale by adding workers. Its peer-to-peer size limits and best-effort ownership fed into the 2021 rebuild.` },
      { name: `Analytics and ML`, items: [[`Michelangelo`, `ML platform, serves models`], [`DeepETA (2022)`, `corrects routing-engine ETAs`], [`Data lake`, `fed by Kafka`]], why: `The routing engine sums segment times; a model predicts the gap to real arrival times. It is Uber's highest-QPS model, so it must add little latency.` }
    ],
    edges: [
      [`Rider app`, `Edge Gateway (Go)`, `sync`, `ride request`],
      [`Driver app`, `Edge Gateway (Go)`, `sync`, `pings, accepts`],
      [`Edge Gateway (Go)`, `DISCO (dispatch)`, `sync`, `find a driver`],
      [`Edge Gateway (Go)`, `Geospatial index`, `sync`, `location pings`],
      [`Edge Gateway (Go)`, `Fulfillment (since 2021)`, `sync`, `trip actions`],
      [`DISCO (dispatch)`, `Geospatial index`, `sync`, `nearby drivers`],
      [`DISCO (dispatch)`, `Routing / ETA`, `sync`, `road ETAs`],
      [`Routing / ETA`, `DeepETA (2022)`, `sync`, `ETA residual`],
      [`Michelangelo`, `DeepETA (2022)`, `sync`, `serves model`],
      [`DISCO (dispatch)`, `Driver app`, `async`, `trip offer`],
      [`Ringpop (Node.js)`, `Geospatial index`, `sync`, `owner routing`],
      [`Fulfillment (since 2021)`, `Google Cloud Spanner (2021)`, `data`, `transactions`],
      [`RAMEN push platform`, `Rider app`, `async`, `ETA, route updates`],
      [`RAMEN push platform`, `Driver app`, `async`, `push messages`],
      [`Rider app`, `Kafka`, `async`, `app events`],
      [`Driver app`, `Kafka`, `async`, `app events`],
      [`Kafka`, `Data lake`, `async`, `feeds`]
    ],
    paths: [
      { name: `Request a ride`, nodes: [`Rider app`, `Edge Gateway (Go)`, `DISCO (dispatch)`, `Geospatial index`, `DISCO (dispatch)`, `Routing / ETA`, `DeepETA (2022)`, `Routing / ETA`, `DISCO (dispatch)`, `Driver app`], note: `Dispatch searches nearby cells, ranks drivers by road ETA (routing engine plus DeepETA), offers the trip, records state in Spanner, and pushes live ETA and route updates.` },
      { name: `Driver location ping`, nodes: [`Driver app`, `Edge Gateway (Go)`, `Geospatial index`, `Ringpop (Node.js)`, `Geospatial index`], note: `Pings arrived every 4 s (2015). Any geo worker takes the ping; Ringpop hashes the cell ID and forwards it to the owner, which updates memory. No database write.` }
    ]
  },
  stripe: {
    summary: `A public REST API guarded by Redis-backed rate limiters and load shedders, made retry-safe by idempotency keys, and kept backward compatible by dated versions. Data lives in DocDB, Stripe's sharded MongoDB-based store that moves data with zero downtime.`,
    layers: [
      { name: `Clients`, items: [[`Merchant servers`, `POST with an Idempotency-Key`], [`Client libraries (e.g. Ruby)`, `auto-retry with backoff, jitter`]], why: `A timeout does not reveal whether a charge happened, so clients retry with the same key; random jitter keeps retries from hammering a recovering server.` },
      { name: `API gateway`, items: [[`Rate limiters (Redis)`, `per-user rate and concurrency caps`], [`Load shedders`, `reserve capacity for critical calls`]], why: `Per-user limits stop runaway scripts, and shedders reserve capacity (for example 20%) so charges still work during spikes. Limiters fail open if Redis dies.` },
      { name: `Services`, items: [[`Idempotency layer`, `replays saved result on retry`], [`API logic`, `charges, refunds, money movement`], [`Version change modules`, `reshape responses for old versions`]], why: `Idempotency keys make retries safe: the first result, even a 500, is replayed. Code targets only the newest version; modules reshape responses for each account's pinned version.` },
      { name: `Data stores`, items: [[`DocDB proxies (Go)`, `route queries by chunk map`], [`DocDB shards (MongoDB-based)`, `2,000+ shards, 5M+ QPS (2024)`]], why: `Stripe chose MongoDB in 2011 for developer productivity, then built its own proxies and chunk map so shards can split, merge, and move without downtime.` },
      { name: `Async and streaming`, items: [[`Webhooks`, `events retried up to 3 days`], [`Kafka`, `streams oplog changes during moves`]], why: `Outcomes like a bank confirming a payment arrive later, so webhooks push events with retries (dedupe by event ID); Kafka streams oplog changes so writes continue while a chunk moves.` },
      { name: `Coordination`, items: [[`Chunk metadata service`, `maps each chunk to a shard`], [`Data Movement Platform`, `moves chunks with zero downtime`]], why: `Proxies route by the chunk map, so a move ends by flipping one mapping; the chunk pauses under 2 seconds. Bin-packing this way cut shard count about 75% (2023).` },
      { name: `Analytics and ML`, items: [[`Radar`, `fraud score in under 100 ms`], [`Hadoop on DB snapshots`, `offline migration backfills (2017)`]], why: `Fraud must be caught before a charge confirms, so Radar scores 1,000+ signals inline in under 100 ms. Hadoop backfills read snapshots so production is never scanned.` }
    ],
    edges: [
      [`Merchant servers`, `Client libraries (e.g. Ruby)`, `sync`, `API call`],
      [`Client libraries (e.g. Ruby)`, `Rate limiters (Redis)`, `sync`, `POST, retries`],
      [`Rate limiters (Redis)`, `Load shedders`, `sync`, `under limit`],
      [`Load shedders`, `Idempotency layer`, `sync`, `admitted`],
      [`Idempotency layer`, `API logic`, `sync`, `new key only`],
      [`API logic`, `Radar`, `sync`, `fraud score`],
      [`API logic`, `DocDB proxies (Go)`, `data`, `reads, writes`],
      [`DocDB proxies (Go)`, `Chunk metadata service`, `sync`, `route lookup`],
      [`DocDB proxies (Go)`, `DocDB shards (MongoDB-based)`, `data`, `routed queries`],
      [`API logic`, `Version change modules`, `sync`, `reshape response`],
      [`API logic`, `Webhooks`, `async`, `events`],
      [`Webhooks`, `Merchant servers`, `async`, `signed HTTPS POSTs`],
      [`Data Movement Platform`, `DocDB shards (MongoDB-based)`, `data`, `bulk import`],
      [`DocDB shards (MongoDB-based)`, `Kafka`, `repl`, `oplog changes`],
      [`Kafka`, `Data Movement Platform`, `repl`, `replay changes`],
      [`Data Movement Platform`, `Chunk metadata service`, `sync`, `flip mapping`],
      [`DocDB shards (MongoDB-based)`, `Hadoop on DB snapshots`, `data`, `snapshots`]
    ],
    paths: [
      { name: `Create a charge`, nodes: [`Client libraries (e.g. Ruby)`, `Rate limiters (Redis)`, `Load shedders`, `Idempotency layer`, `API logic`, `DocDB proxies (Go)`, `DocDB shards (MongoDB-based)`, `DocDB proxies (Go)`, `API logic`, `Version change modules`], note: `Limiters admit the POST; a known Idempotency-Key replays the saved result. Otherwise the charge runs, is stored via DocDB proxies, and the response is reshaped to the pinned version.` },
      { name: `Move a chunk between shards`, nodes: [`Data Movement Platform`, `DocDB shards (MongoDB-based)`, `Kafka`, `Data Movement Platform`, `Chunk metadata service`], note: `Register the move, bulk-import a snapshot to the target, replay oplog changes via Kafka, verify, then flip the chunk map. Clients retry through a pause under 2 s.` }
    ]
  },
  zoom: {
    summary: `Signaling and media are split. The client joins over HTTPS, measures candidate meeting zones, and connects to a multimedia router that forwards streams without mixing, over UDP when it can. Co-located data centers plus AWS and Oracle Cloud absorbed the 2020 surge.`,
    layers: [
      { name: `Clients`, items: [[`Desktop, mobile, Rooms, SDK`, `encode several resolutions per stream`], [`Web client`, `browser fallback`], [`E2EE mode (opt-in, 2020)`, `host's client makes the keys`]], why: `Clients do the decoding and send several resolutions, so routers never re-encode and each receiver gets a version that fits its screen and bandwidth.` },
      { name: `Edge and CDN`, items: [[`Web infrastructure (HTTPS 443)`, `meeting lookup, Geo-IP zone list`]], why: `Joining starts over HTTPS on 443, which almost every firewall allows, and Geo-IP narrows the choice to nearby zones before any media flows.` },
      { name: `Load balancing`, items: [[`Zone controllers`, `track load, assign best router`], [`Meeting zones`, `co-located DCs and public cloud`]], why: `The client tests each candidate zone controller and keeps the best, so placement reflects the real network; the controller knows its servers' load and hands out a router.` },
      { name: `Real-time connections`, items: [[`Multimedia routers (MMR)`, `forward streams, no mixing`], [`UDP 8801`, `preferred media path`], [`TCP 8801, then SSL 443`, `fallbacks when UDP is blocked`], [`HTTP tunnel`, `last resort after 5.5 s`]], why: `Forwarding skips server decode and re-encode, so one router hosts far more people (Zoom claimed 15x an MCU). UDP stops a lost packet from delaying newer ones.` },
      { name: `Object storage`, items: [[`Amazon S3`, `object storage Zoom uses`], [`Cloud recordings`, `exact storage details not public`]], why: `Recording needs servers that can see the media, which is why the 2020 end-to-end encrypted mode turns cloud recording off.` }
    ],
    edges: [
      [`Desktop, mobile, Rooms, SDK`, `Web infrastructure (HTTPS 443)`, `sync`, `meeting lookup`],
      [`Web client`, `Web infrastructure (HTTPS 443)`, `sync`, `browser join`],
      [`Desktop, mobile, Rooms, SDK`, `Zone controllers`, `sync`, `performance test`],
      [`Zone controllers`, `Multimedia routers (MMR)`, `sync`, `track load`],
      [`Desktop, mobile, Rooms, SDK`, `Multimedia routers (MMR)`, `sync`, `SSL control channel`],
      [`Desktop, mobile, Rooms, SDK`, `UDP 8801`, `stream`, `media first`],
      [`Web client`, `UDP 8801`, `stream`, `media first`],
      [`UDP 8801`, `Multimedia routers (MMR)`, `stream`, `routed streams`],
      [`Desktop, mobile, Rooms, SDK`, `TCP 8801, then SSL 443`, `stream`, `if UDP blocked`],
      [`TCP 8801, then SSL 443`, `Multimedia routers (MMR)`, `stream`, `routed streams`],
      [`Desktop, mobile, Rooms, SDK`, `HTTP tunnel`, `sync`, `5.5 s fallback`],
      [`HTTP tunnel`, `Meeting zones`, `stream`, `tunneled traffic`]
    ],
    paths: [
      { name: `Join a meeting`, nodes: [`Desktop, mobile, Rooms, SDK`, `Web infrastructure (HTTPS 443)`, `Desktop, mobile, Rooms, SDK`, `Zone controllers`, `Multimedia routers (MMR)`, `Desktop, mobile, Rooms, SDK`, `UDP 8801`, `Multimedia routers (MMR)`], note: `HTTPS lookup returns candidate zones by Geo-IP; the client tests their controllers, gets a router from the best, opens a control channel, then media over UDP 8801 if allowed.` },
      { name: `Share your video`, nodes: [`Desktop, mobile, Rooms, SDK`, `UDP 8801`, `Multimedia routers (MMR)`, `UDP 8801`, `Desktop, mobile, Rooms, SDK`], note: `The sender uploads several encodings of each stream; the router forwards each receiver the one that fits its screen and bandwidth, without mixing or re-encoding.` }
    ]
  },
  amazon: {
    summary: `A service-oriented site where the cart favors availability: Dynamo (2007) accepts writes through failures and the app merges versions. Checkout acks once an order is queued, and a pipeline of queued, retryable steps charges, fulfills, and ships it.`,
    layers: [
      { name: `Clients`, items: [[`Web and mobile shoppers`, `add to cart, check out`]], why: `Refusing an add-to-cart costs sales and trust, so the cart lives server-side by customer and must accept writes from any device, even during failures.` },
      { name: `Edge and CDN`, items: [[`CloudFront`, `edge delivery; 500M+ requests/min peak`]], why: `Serving close to shoppers cuts latency and spreads Prime Day load across edge locations: 1.3 trillion HTTP requests over Prime Day 2024.` },
      { name: `Load balancing`, items: [[`Cell router (AWS pattern)`, `maps customer ID to a cell`], [`Shuffle sharding`, `near-unique worker set per customer`]], why: `Each cell serves a slice of customers, so a failure or bad deploy stays in one cell (10 cells: about 90% unaffected). The router stays thin because everything depends on it.` },
      { name: `Services`, items: [[`Page rendering`, `calls 150+ services per page (2007)`], [`Shopping cart service`, `merges conflicting cart versions`], [`Checkout`, `acks once the order is queued`], [`Order pipeline steps`, `charge, fulfill, ship; each retries`]], why: `The cart service owns the merge because it knows what a cart means; checkout waits only for "queued", so steps like card charges retry on their own.` },
      { name: `Data stores`, items: [[`Dynamo (2007, internal)`, `leaderless, always-writeable carts`], [`DynamoDB (since 2012)`, `powers Amazon.com, fulfillment centers`], [`Aurora and RDS (by 2019)`, `consistent relational workloads, ex-Oracle`]], why: `Dynamo keeps every conflicting cart version (vector clocks) so an add is never lost; DynamoDB later chose a leader per partition for strong reads and no client merges.` },
      { name: `Async and streaming`, items: [[`Queues`, `pass orders between steps`], [`Dead-letter queues`, `park messages out of retries`]], why: `Queues let each step fail and retry alone, but backlogs are the price: after an hour-long outage you need about double capacity for another hour.` },
      { name: `Coordination`, items: [[`Consistent hashing ring`, `places keys on N replicas`], [`Gossip membership`, `nodes learn ring changes`], [`Cell control plane`, `creates cells, moves customers`]], why: `Dynamo has no master to fail: gossip spreads membership and consistent hashing places keys, so nodes join or leave with little data movement. Moving customers between cells needs a control plane.` }
    ],
    edges: [
      [`Web and mobile shoppers`, `CloudFront`, `sync`, `edge requests`],
      [`Web and mobile shoppers`, `Page rendering`, `sync`, `page views`],
      [`Page rendering`, `Shopping cart service`, `sync`, `one of 150+`],
      [`Page rendering`, `DynamoDB (since 2012)`, `data`, `site data`],
      [`Web and mobile shoppers`, `Shopping cart service`, `sync`, `add to cart`],
      [`Shopping cart service`, `Dynamo (2007, internal)`, `data`, `quorum writes`],
      [`Consistent hashing ring`, `Dynamo (2007, internal)`, `sync`, `places keys`],
      [`Gossip membership`, `Consistent hashing ring`, `sync`, `membership changes`],
      [`Web and mobile shoppers`, `Checkout`, `sync`, `place order`],
      [`Checkout`, `Queues`, `async`, `order queued`],
      [`Queues`, `Order pipeline steps`, `async`, `next step`],
      [`Queues`, `Dead-letter queues`, `async`, `out of retries`],
      [`Order pipeline steps`, `DynamoDB (since 2012)`, `data`, `fulfillment data`],
      [`Cell control plane`, `Cell router (AWS pattern)`, `sync`, `moves customers`]
    ],
    paths: [
      { name: `Add to cart`, nodes: [`Web and mobile shoppers`, `Shopping cart service`, `Dynamo (2007, internal)`, `Shopping cart service`, `Web and mobile shoppers`], note: `A write succeeds once W of the first N healthy replicas ack (often 2 of 3). Divergent versions come back together on read, and the cart service merges them.` },
      { name: `Place an order`, nodes: [`Web and mobile shoppers`, `Checkout`, `Queues`, `Order pipeline steps`, `Queues`, `Dead-letter queues`], note: `Checkout acks once the order is queued. Pipeline steps (charge card, then fulfill and ship) pull from queues, retry alone, and send exhausted messages to a DLQ.` }
    ]
  }
});
