window.HUB_CASES = window.HUB_CASES || [];
window.HUB_CASES.push(...[
 {
  "id": "whatsapp",
  "name": "WhatsApp",
  "kind": "Messaging",
  "tagline": "Holding hundreds of millions of always-on phone connections and delivering every message to devices that are often offline, while the servers cannot read what they carry.",
  "scale": [
   "Jan 2012: one FreeBSD server running Erlang held over 2 million TCP connections.",
   "Mar 2014: 465M monthly users, 19B messages in and 40B out per day, 147M concurrent connections.",
   "Mar 2014: about 550 servers, including about 150 chat servers holding about 1M phones each. About 10 engineers worked on Erlang and handled both development and ops.",
   "Apr 2016: end-to-end encryption (Signal Protocol) turned on by default for more than a billion users."
  ],
  "requirements": {
   "functional": [
    "Send 1:1 and group text messages.",
    "Deliver to offline recipients as soon as they reconnect.",
    "Show sent, delivered, and read receipts (the check marks).",
    "Send photos, video, voice notes, and files.",
    "Use one account on a phone plus linked devices (multi-device since 2021)."
   ],
   "nonFunctional": [
    "Hold a very large number of long-lived connections per server.",
    "Low delivery latency over flaky mobile networks.",
    "End-to-end encryption: servers relay content they cannot read.",
    "Keep little data on servers: delete messages once delivered.",
    "Ride out spikes from world events (sports, earthquakes) without manual work."
   ]
  },
  "flow": [
   [
    "Sender phone",
    "encrypts once per device"
   ],
   [
    "Chat server",
    "Erlang, keeps socket open"
   ],
   [
    "Offline storage",
    "only if recipient offline"
   ],
   [
    "Recipient phone",
    "decrypts, sends delivery ack"
   ],
   [
    "Sender phone",
    "shows second check mark"
   ]
  ],
  "components": [
   {
    "name": "Chat servers",
    "role": "Erlang/BEAM on FreeBSD. They keep phone connections open and route messages. In 2014 about 150 of them held about 1M phones each."
   },
   {
    "name": "Offline storage",
    "role": "Mailboxes for messages whose recipient is not connected. In 2014 writing to them was an I/O bottleneck, fixed with a write-back cache because most messages are picked up very quickly. Policy: deleted once delivered, dropped after 30 days if never delivered."
   },
   {
    "name": "Mnesia",
    "role": "Erlang's built-in database, used mostly with <code>async_dirty</code> writes. In 2014 records were hashed so each one lived on one node, and the account table had 512 fragments."
   },
   {
    "name": "Prekey store",
    "role": "Holds each device's public identity key, signed prekey, and one-time prekeys, so a sender can start an encrypted session while the recipient is offline."
   },
   {
    "name": "Group fan-out",
    "role": "For a group message the sender uploads one ciphertext, encrypted with its Sender Key, and the server copies it to every participant."
   },
   {
    "name": "Media servers and blob store",
    "role": "The phone encrypts an attachment with a fresh AES-256 key and uploads it to a blob store. The chat message carries only the key, a hash, and a pointer. In 2014 about 250 servers handled media."
   }
  ],
  "decisions": [
   {
    "title": "Erlang on FreeBSD for the connection tier",
    "why": "The 2014 talk calls Erlang an awesome choice for scalability and non-stop operations. In 2012 BEAM kept over 85% CPU use across 24 logical CPUs, and one server peaked at 2.8M connections.",
    "tradeoff": "The team had to find lock contention inside BEAM and FreeBSD and patch both; the 2012 talk says every fix from 200K to 2M connections was a contention fix. Wrong call if your team has no Erlang depth and your scale is modest."
   },
   {
    "title": "Relay, not archive",
    "why": "A message sits on the server only until it is delivered, then it is deleted. Storage stays small and there is little user content to protect or leak.",
    "tradeoff": "There is no server-side history. A newly linked device cannot download old chats from the server; the phone encrypts a bundle of recent messages and sends it. Cross-device search and sync are much harder than in Slack or Discord."
   },
   {
    "title": "End-to-end encryption by default",
    "why": "Signal Protocol since April 2016. Prekeys let a sender open a session with an offline recipient, and the server only ever sees ciphertext.",
    "tradeoff": "The server cannot search, index, or scan content. Every device is a separate target: the client encrypts and sends each message N times for N devices (client-fanout)."
   },
   {
    "title": "Sender Keys for groups",
    "why": "Each member first sends its Sender Key to every member device over pairwise sessions. After that, a group message is encrypted once and the server fans out a single ciphertext.",
    "tradeoff": "Whenever a member leaves, every participant clears its Sender Key and starts over, which means new pairwise messages to every device. The server still has to know the member list to fan out."
   },
   {
    "title": "Media outside the chat path",
    "why": "Large blobs go to a blob store and the chat message stays tiny. Forwarded media can be kept temporarily, still encrypted, so repeat forwards are cheaper.",
    "tradeoff": "Sending becomes two steps (upload, then message). Orphaned blobs need cleanup, and a download can fail even though the message arrived."
   },
   {
    "title": "Partition and decouple everything",
    "why": "The 2014 talk: split services into partitions (usually 2-32), use <code>async_dirty</code> Mnesia writes, prefer casts over calls, and keep separate read and write queues so one slow part does not block the rest.",
    "tradeoff": "Skipping transactions means the app must live with weaker consistency. Coupling still bit them: on Feb 22, 2014 a router glitch caused mass disconnects and a full stop and restart."
   }
  ],
  "whenNot": "Do not hand-patch a VM and a kernel or run your own Mnesia cluster for a small app: a managed WebSocket gateway, one database, and a queue go a long way. Skip delete-after-delivery if users expect full history and search on every device. Add end-to-end encryption only through a proven library and only when privacy is the product, because it complicates groups, multi-device, backups, and moderation.",
  "lessons": [
   "The right runtime for the workload (millions of mostly idle connections), plus measuring everything, let a tiny team run a huge system.",
   "Most scaling wins came from removing contention and coupling, not from adding servers.",
   "A relay that deletes after delivery keeps storage small and privacy strong, but it pushes history onto devices.",
   "End-to-end encryption reshapes everything around it: fan-out, multi-device, media, and backups."
  ],
  "interview": {
   "ask": "Design a chat app like WhatsApp",
   "plan": [
    "Clarify (5 min): 1:1 and groups, receipts, offline delivery, media, E2EE, max group size, how long messages are kept.",
    "Estimate (5 min): e.g. 500M daily users x 40 messages = 20B a day, about 230K per second on average and several times that at peak. Concurrent connections decide the server count.",
    "Connection tier (10 min): long-lived TCP or WebSocket to a gateway, a session registry (user → gateway), heartbeats, and resume after reconnect.",
    "Message path (10 min): client message ID; server ack (one check); store in the recipient inbox if offline; device ack (two checks); read receipt.",
    "Groups and media (5 min): server fan-out of one ciphertext per group message; media to a blob store and CDN, the message carries a pointer and key.",
    "Storage and keys (5 min): per-user inbox partitioned by user ID and deleted on ack; a prekey server for E2EE; one inbox per device.",
    "Wrap-up (5 min): failure modes, big groups, reconnect storms, metrics."
   ],
   "deepDives": [
    "Delivery guarantees: client message IDs, acks, retries with dedupe, per-chat ordering with sequence numbers.",
    "Group fan-out: one ciphertext copied by the server (Sender Keys) versus encrypting for every member; capping group size.",
    "Offline and multi-device: inbox per device, push to wake the app, what a new device gets.",
    "Connection tier: sockets per box, heartbeats, and a reconnect storm after a network blip."
   ],
   "traps": [
    "Designing a permanent message archive when the product only needs store-and-forward.",
    "No idempotency: a resend after a lost ack shows the message twice.",
    "Saying \"add E2EE\" without key distribution, multi-device, and the loss of server-side search."
   ]
  },
  "sources": [
   {
    "t": "1 million is so 2011",
    "by": "WhatsApp Blog, 2012",
    "url": "https://blog.whatsapp.com/1-million-is-so-2011"
   },
   {
    "t": "Scaling to Millions of Simultaneous Connections",
    "by": "Rick Reed, Erlang Factory SF 2012",
    "url": "https://www.erlang-factory.com/upload/presentations/558/efsf2012-whatsapp-scaling.pdf"
   },
   {
    "t": "That's Billion with a B: Scaling to the next level at WhatsApp",
    "by": "Rick Reed, Erlang Factory SF 2014",
    "url": "https://www.erlang-factory.com/static/upload/media/1394350183453526efsf2014whatsappscaling.pdf"
   },
   {
    "t": "WhatsApp Encryption Overview (technical white paper)",
    "by": "WhatsApp",
    "url": "https://www.whatsapp.com/security/WhatsApp-Security-Whitepaper.pdf"
   },
   {
    "t": "WhatsApp Privacy Policy (how undelivered messages are kept)",
    "by": "WhatsApp",
    "url": "https://www.whatsapp.com/legal/privacy-policy"
   }
  ]
 },
 {
  "id": "discord",
  "name": "Discord",
  "kind": "Chat and voice",
  "tagline": "Fanning out every message and presence change to communities with tens of thousands of people online, keeping every message forever, and still reading history in milliseconds.",
  "scale": [
   "Jan 2017: more than 120 million messages a day, with all history kept forever.",
   "Jul 2017: nearly 5 million concurrent users and millions of events per second through Elixir.",
   "Sep 2018: 850+ voice servers in 13 regions (30+ data centers), 2.6 million concurrent voice users, 220+ Gbps egress.",
   "2022: messages moved from 177 Cassandra nodes holding trillions of messages to 72 ScyllaDB nodes.",
   "2022: the migration ran at up to 3.2 million messages per second and finished in 9 days."
  ],
  "requirements": {
   "functional": [
    "Servers (guilds) with text channels, plus direct messages.",
    "Real-time delivery of messages, typing, and presence to everyone online in a guild.",
    "Full history forever, with random jumps into old messages (mentions, pins, search).",
    "Voice and video channels with many people.",
    "Moderation, such as muting someone in voice."
   ],
   "nonFunctional": [
    "Millions of concurrent WebSocket sessions.",
    "Fan-out to guilds with tens of thousands of people online.",
    "Predictable read latency on a huge and ever-growing message store.",
    "Survive spikes such as an @everyone announcement or a World Cup final.",
    "Never leak user IP addresses in voice.",
    "Low operational toil: automatic failover and no manual resharding."
   ]
  },
  "flow": [
   [
    "Client",
    "scrolls channel history"
   ],
   [
    "API monolith",
    "forwards the read"
   ],
   [
    "Hash routing",
    "by channel ID"
   ],
   [
    "Rust data service",
    "coalesces identical reads"
   ],
   [
    "ScyllaDB",
    "channel plus time bucket"
   ]
  ],
  "components": [
   {
    "name": "Gateway sessions (Elixir)",
    "role": "Each connected user gets a session process (a GenServer) behind a WebSocket. In 2017 nearly 5 million ran at peak."
   },
   {
    "name": "Guild processes (Elixir)",
    "role": "One process per guild on remote Erlang nodes. Anything published in a guild is fanned out to every connected session; the Manifold library batches sends per remote node."
   },
   {
    "name": "API monolith",
    "role": "Serves client requests and reaches the message database through the data services."
   },
   {
    "name": "Data services (Rust)",
    "role": "Roughly one gRPC endpoint per database query and no business logic. The first request for a row starts a worker task; identical requests subscribe to it, so the database is queried once."
   },
   {
    "name": "Message store",
    "role": "MongoDB at first, then Cassandra, then ScyllaDB from May 2022. Primary key <code>((channel_id, bucket), message_id)</code>; a bucket holds about 10 days so partitions stay under 100 MB."
   },
   {
    "name": "Voice servers",
    "role": "A signaling part plus a homegrown C++ SFU that forwards audio and video. The guilds service picks the least-loaded voice server in a region from health reports kept in etcd."
   }
  ],
  "decisions": [
   {
    "title": "Elixir processes for sessions and guilds",
    "why": "Most of Discord is pub/sub: a guild process publishes and session processes receive. The Erlang VM suited a highly concurrent real-time system, and the first prototype was already in Elixir.",
    "tradeoff": "Fan-out got expensive. One send took 30 to 70 microseconds, so a publish in a large guild could take 900 ms to 2.1 s. They had to build Manifold, FastGlobal, and a Semaphore library to keep it stable."
   },
   {
    "title": "Partition messages by channel and time bucket",
    "why": "Every read is per channel, so <code>channel_id</code> leads the key and time-sortable Snowflake IDs order messages. A 10-day bucket keeps partitions under 100 MB.",
    "tradeoff": "A quiet channel may need several bucket queries to fill one page. Deletes are writes (tombstones): one channel with millions of deleted messages made Cassandra scan tombstones and choke on GC."
   },
   {
    "title": "Cassandra, then ScyllaDB",
    "why": "Cassandra gave linear scaling and automatic failover without manual resharding. By 2022 it needed 177 nodes, GC pauses caused latency spikes, and compactions fell behind. ScyllaDB (C++, shard-per-core, no GC) did the job on 72 nodes, with p99 history reads falling from 40-125 ms to 15 ms.",
    "tradeoff": "A risky move of trillions of rows: the first estimate was 3 months, so they wrote their own migrator in Rust. Hot partitions still exist on ScyllaDB, so the switch alone was not enough."
   },
   {
    "title": "Shield the database with data services",
    "why": "Request coalescing turns a stampede (everyone opening an @everyone announcement) into one query. Consistent-hash routing by channel ID sends all requests for a channel to the same instance, so duplicates actually meet.",
    "tradeoff": "One more hop and one more service to run. A very hot channel now lands on a single instance, and losing an instance moves its channels elsewhere."
   },
   {
    "title": "SFU voice through Discord servers",
    "why": "Peer-to-peer gets too expensive as groups grow, and routing through servers never leaks IP addresses and allows moderation (a muted user's packets are dropped). Native apps replaced DTLS/SRTP with faster Salsa20 and send nothing during silence.",
    "tradeoff": "Discord pays for all the media bandwidth (220+ Gbps in 2018) and runs 850+ voice servers. Browsers use standard WebRTC, so the SFU also has to bridge browser and native clients."
   },
   {
    "title": "A semaphore instead of a circuit breaker",
    "why": "Once ring lookups got fast, nearly 5 million session processes stampeded the ten guild registry processes; calls timed out, piled up, and could run the VM out of memory. A semaphore built on ETS atomic counters caps outstanding requests.",
    "tradeoff": "Requests over the cap fail fast and must retry later. They skipped a circuit breaker on purpose: a burst of timeouts should not stop all attempts for a while."
   }
  ],
  "whenNot": "A small community app does not need a Rust coalescing tier or a Cassandra-to-ScyllaDB migration: one relational database with an index on (channel_id, message_id) lasts a long time. Keeping every message forever is a product choice that drives the whole storage design, so make it on purpose. Build your own SFU and transport only if voice is the product.",
  "lessons": [
   "Derive the partition key from the access pattern (channel plus time bucket) and cap partition size early.",
   "Protect the database upstream: coalescing and hash routing fixed what a faster database alone did not.",
   "In LSM stores, deletes and nulls are writes (tombstones); design for them.",
   "Large fan-out needs batching per node, not one send per recipient."
  ],
  "interview": {
   "ask": "Design a group chat app like Discord",
   "plan": [
    "Clarify (5 min): guilds with channels, huge communities, presence, history forever, voice in or out of scope.",
    "Estimate (5 min): concurrent sessions, messages per second, and the fan-out of one message in the biggest guild.",
    "Real-time tier (10 min): WebSocket gateway, one actor per session, one actor per guild that fans out events.",
    "Storage (10 min): messages keyed by (channel_id, time bucket) with time-sortable IDs; paginate by message ID.",
    "Hot reads (5 min): caching, request coalescing, routing by channel so duplicate requests meet.",
    "Presence and voice (5 min): send presence only where it is visible; regional SFU voice servers picked by load.",
    "Wrap-up (5 min): losing a guild node, reconnect storms, backpressure."
   ],
   "deepDives": [
    "Fan-out to a guild with 30,000 people online: batching per node, lazy member lists, rate limits.",
    "A hot partition during an announcement: coalescing, caching, consistent-hash routing.",
    "Snowflake-style IDs: time-sortable without coordination, and why not auto-increment.",
    "A reconnect storm after a deploy: semaphores and backpressure instead of unbounded retries."
   ],
   "traps": [
    "Partitioning by channel alone, so old busy channels grow without limit.",
    "Pushing every presence change to every member of a huge guild.",
    "Heavy deletes on an LSM store without planning for tombstones."
   ]
  },
  "sources": [
   {
    "t": "How Discord Stores Billions of Messages",
    "by": "Discord Engineering, 2017",
    "url": "https://discord.com/blog/how-discord-stores-billions-of-messages"
   },
   {
    "t": "How Discord Stores Trillions of Messages",
    "by": "Discord Engineering, 2023",
    "url": "https://discord.com/blog/how-discord-stores-trillions-of-messages"
   },
   {
    "t": "How Discord Scaled Elixir to 5,000,000 Concurrent Users",
    "by": "Discord Engineering, 2017",
    "url": "https://discord.com/blog/how-discord-scaled-elixir-to-5-000-000-concurrent-users"
   },
   {
    "t": "How Discord Handles Two and Half Million Concurrent Voice Users using WebRTC",
    "by": "Discord Engineering, 2018",
    "url": "https://discord.com/blog/how-discord-handles-two-and-half-million-concurrent-voice-users-using-webrtc"
   },
   {
    "t": "How Discord Indexes Billions of Messages",
    "by": "Discord Engineering, 2017",
    "url": "https://discord.com/blog/how-discord-indexes-billions-of-messages"
   },
   {
    "t": "How Discord Indexes Trillions of Messages",
    "by": "Discord Engineering, 2025",
    "url": "https://discord.com/blog/how-discord-indexes-trillions-of-messages"
   },
   {
    "t": "Tracing Discord's Elixir Systems (Without Melting Everything)",
    "by": "Discord Engineering, 2026",
    "url": "https://discord.com/blog/tracing-discords-elixir-systems-without-melting-everything"
   }
  ]
 },
 {
  "id": "slack",
  "name": "Slack",
  "kind": "Team chat",
  "tagline": "Pushing each message to every online member within about half a second worldwide, while some customers grow bigger than any single database shard.",
  "scale": [
   "Apr 2023: about 16 million channels served per channel-server host at peak; messages delivered across the world in 500 ms.",
   "Dec 2020: Vitess served 2.3M queries per second at peak (2M reads, 300K writes), median 2 ms, p99 11 ms.",
   "Dec 2017: the job queue ran over 1.4 billion jobs on busy days, peaking at 33,000 per second.",
   "May 2017: Flannel edge caches held 4 million simultaneous connections and served 600K queries per second at peak."
  ],
  "requirements": {
   "functional": [
    "Channels, DMs, and threads inside workspaces, including large Enterprise Grid orgs and Slack Connect.",
    "Real-time delivery of messages and hundreds of other event types (reactions, joins).",
    "Presence (green dots) and typing indicators.",
    "Fast client start, even on teams with tens of thousands of users.",
    "Background work per message: push notifications, link unfurls, reminders."
   ],
   "nonFunctional": [
    "Every message is durable before anyone sees it.",
    "Global delivery in about 500 ms.",
    "Survive reconnect storms when a whole office or region reconnects at once.",
    "Scale past the largest single customer.",
    "99.99% availability target, under 1 hour of downtime a year."
   ]
  },
  "flow": [
   [
    "Client",
    "calls Webapp API"
   ],
   [
    "Webapp (Hack)",
    "persists message first"
   ],
   [
    "Admin Server",
    "hashes channel ID"
   ],
   [
    "Channel Server",
    "owns channel, fans out"
   ],
   [
    "Gateway Servers",
    "per region, subscribed"
   ],
   [
    "Clients",
    "receive over WebSocket"
   ]
  ],
  "components": [
   {
    "name": "Webapp",
    "role": "The Hack (PHP) codebase that hosts the client APIs. Every message is persisted before it goes out over the real-time WebSocket stack."
   },
   {
    "name": "Channel Servers",
    "role": "Stateful, in-memory Java services; each owns a set of channels via consistent hashing (about 16M channels per host at peak). Ring managers (CHARMs) bring up a replacement in under 20 seconds."
   },
   {
    "name": "Gateway Servers",
    "role": "Stateful and deployed in several regions. They hold users' WebSocket subscriptions and subscribe to the Channel Servers for each user's channels. A bad region can be drained to the nearest good one."
   },
   {
    "name": "Admin and Presence Servers",
    "role": "Admin Servers are stateless glue between Webapp and Channel Servers. Presence Servers track who is online, with users hashed across them."
   },
   {
    "name": "Flannel",
    "role": "An application-level cache at edge points of presence. Clients boot from a slim payload and fetch users and channels on demand. Flannel stays fresh by consuming real-time events over its own WebSocket."
   },
   {
    "name": "Vitess (MySQL)",
    "role": "Horizontal sharding for MySQL. Message data is sharded by channel ID instead of by workspace, and Vitess handles failovers and backups."
   },
   {
    "name": "Job queue",
    "role": "Kafkagate (Go) takes jobs over HTTP and writes them to Kafka; JQRelay (Go) moves them into Redis at rates set in Consul; PHP workers run them."
   }
  ],
  "decisions": [
   {
    "title": "Stateful channel servers on a hash ring",
    "why": "One in-memory owner per channel makes fan-out a local operation. Gateways in each region subscribe once and relay to their own users.",
    "tradeoff": "Losing a host hurts its channels until the ring heals (higher latency for under 20 seconds). You need ring managers, service discovery (Consul), and a plan for hot channels."
   },
   {
    "title": "Persist before broadcast",
    "why": "A message someone has seen can never vanish, and the database stays the source of truth for history.",
    "tradeoff": "Database latency sits on the send path, so storage must be very fast and reliable. Transient events such as typing skip the database and take a lighter path."
   },
   {
    "title": "Lazy loading at the edge (Flannel)",
    "why": "<code>rtm.start</code> sent a full team snapshot on connect, which became slow and huge on big teams and made reconnect storms expensive. With Flannel the boot payload shrank 7x on a 1.5K-user team and 44x on a 32K-user team.",
    "tradeoff": "Another cache tier to keep coherent, and clients must handle partial data and fetch on demand. Routing a team to one Flannel host per region can make that host hot."
   },
   {
    "title": "From workspace shards to Vitess, sharded by channel",
    "why": "One workspace per MySQL pair broke when a single customer outgrew the biggest host, and Enterprise Grid and Slack Connect put one team's data on several shards. Sharding messages by channel ID spreads the load.",
    "tradeoff": "The migration took about three years (2017 to 2020), and Slack had to fill gaps in Vitess itself. Queries that span channels now cross shards."
   },
   {
    "title": "Kafka in front of Redis for jobs",
    "why": "When Redis ran out of memory, no job could be enqueued (and dequeuing also needed free memory). Adding Kafka as a durable buffer was the smallest fix, and the enqueue and dequeue interfaces stayed the same.",
    "tradeoff": "Two systems to operate. Kafkagate waits only for the partition leader's ack, so a job can be lost if the leader dies before replicating. Go and PHP encoded some JSON differently."
   },
   {
    "title": "Silo each availability zone",
    "why": "Services talk only within their AZ, so reweighting the edge load balancers drains an AZ within 5 minutes. Before, errors in one AZ showed up in frontends in all of them.",
    "tradeoff": "Strongly consistent stores such as Vitess cannot be siloed, because each write needs the one shard primary wherever it runs. Every service must also run in every AZ."
   }
  ],
  "whenNot": "A small team chat does not need stateful channel servers with ring managers, an edge cache, or Vitess: one WebSocket service with pub/sub and a single relational database go far. Shard by tenant until one tenant is too big, then shard by channel. Put Kafka in front of an existing queue only after losing queued work has actually hurt you.",
  "lessons": [
   "Durable first, then fast: persist, then fan out from memory.",
   "Shard by the unit of fan-out (channel), not by customer, once customers get huge or share channels.",
   "Do not ship the whole world on connect; lazy load from a cache near the user.",
   "Fix incidents with the smallest safe change: Kafka in front of Redis, not a rewrite."
  ],
  "interview": {
   "ask": "Design a team chat app like Slack",
   "plan": [
    "Clarify (5 min): workspaces, public and private channels, DMs, threads, history, presence, notifications, very large tenants.",
    "Estimate (5 min): connected clients, messages per second, average and worst-case channel size.",
    "APIs (5 min): HTTP POST to send with a client message ID, WebSocket to receive, paginated history reads.",
    "Write path (10 min): persist to a store sharded by channel, then route by channel ID to an in-memory owner that fans out to regional gateways.",
    "Client boot (5 min): small bootstrap plus on-demand queries through an edge cache; plan for reconnect storms.",
    "Async work (5 min): notifications, unfurls, and indexing through a durable job queue with rate limits.",
    "Deep dive and wrap-up (10 min): huge channels, region drain, monitoring."
   ],
   "deepDives": [
    "Fan-out to a channel with 100K members: only online users, aggregated per gateway.",
    "Ordering and duplicates: per-channel timestamps or sequence numbers plus client message IDs.",
    "Sharding: workspace key versus channel key, hot tenants, channels shared across workspaces.",
    "Reconnect storms: jittered reconnects, an edge cache, a slim boot payload."
   ],
   "traps": [
    "Sharding everything by workspace and getting stuck when one enterprise outgrows a shard.",
    "Sending the full workspace state on every connect.",
    "Storing typing indicators like messages."
   ]
  },
  "sources": [
   {
    "t": "Real-time Messaging",
    "by": "Slack Engineering, 2023",
    "url": "https://slack.engineering/real-time-messaging/"
   },
   {
    "t": "Flannel: An Application-Level Edge Cache to Make Slack Scale",
    "by": "Slack Engineering, 2017",
    "url": "https://slack.engineering/flannel-an-application-level-edge-cache-to-make-slack-scale/"
   },
   {
    "t": "Scaling Datastores at Slack with Vitess",
    "by": "Slack Engineering, 2020",
    "url": "https://slack.engineering/scaling-datastores-at-slack-with-vitess/"
   },
   {
    "t": "Scaling Slack's Job Queue",
    "by": "Slack Engineering, 2017",
    "url": "https://slack.engineering/scaling-slacks-job-queue/"
   },
   {
    "t": "Slack's Migration to a Cellular Architecture",
    "by": "Slack Engineering, 2023",
    "url": "https://slack.engineering/slacks-migration-to-a-cellular-architecture/"
   },
   {
    "t": "Migrating Millions of Concurrent Websockets to Envoy",
    "by": "Slack Engineering, 2021",
    "url": "https://slack.engineering/migrating-millions-of-concurrent-websockets-to-envoy/"
   },
   {
    "t": "Search at Slack",
    "by": "Slack Engineering, 2017",
    "url": "https://slack.engineering/search-at-slack/"
   }
  ]
 },
 {
  "id": "uber",
  "name": "Uber",
  "kind": "Ride-hailing",
  "tagline": "Matching moving riders and drivers within seconds from a constant stream of location updates, and keeping every trip's state correct through failures.",
  "scale": [
   "2015 (QCon talk): drivers sent a location every 4 seconds, and the geospatial index was designed for a million writes per second.",
   "Feb 2016: many millions of trips per day across six continents.",
   "Jul 2021: the fulfillment platform handled over a million concurrent users, billions of trips a year in 10,000+ cities, and billions of database transactions a day.",
   "Aug 2021: Kafka carried trillions of messages and multiple petabytes per day.",
   "Jun 2023: Cadence ran over 12 billion workflow executions a month at Uber, across 1,000+ services."
  ],
  "requirements": {
   "functional": [
    "Riders request a ride and see nearby cars and an ETA.",
    "Drivers stream their location and receive trip offers.",
    "Match each request to a good driver by road ETA, not straight-line distance.",
    "Track each trip from request to drop-off, including cancellations.",
    "Price trips (including dynamic pricing) and bill after the ride."
   ],
   "nonFunctional": [
    "Very high write rate of short-lived location data.",
    "Matching in seconds.",
    "Survive a datacenter failover without dropping trips in progress.",
    "Correct trip state under concurrent updates (no double booking).",
    "Scale out by adding machines as cities and products grow."
   ]
  },
  "flow": [
   [
    "Rider app",
    "requests a ride"
   ],
   [
    "DISCO",
    "dispatch optimization"
   ],
   [
    "Geo by supply",
    "nearby drivers by S2 cell"
   ],
   [
    "Routing / ETA",
    "ranks by road time"
   ],
   [
    "Supply service",
    "offers trip to driver"
   ],
   [
    "Driver app",
    "accepts, trip state advances"
   ]
  ],
  "components": [
   {
    "name": "DISCO (dispatch)",
    "role": "Matches supply to demand. The 2015 design could also plan ahead, for example revising the route of a trip already in progress."
   },
   {
    "name": "Geospatial index",
    "role": "Live driver locations, sharded by map cell. The 2015 design used Google S2 level-12 cells (3.31 to 6.38 square km) with the cell ID as the shard key. In 2018 Uber open-sourced H3, its hexagon grid for pricing and dispatch decisions."
   },
   {
    "name": "Ringpop",
    "role": "A Node.js library: SWIM gossip for membership, a consistent hash ring (FarmHash) so each key has one owner, and handle-or-forward routing over TChannel. Its first user was the Geospatial service."
   },
   {
    "name": "Schemaless",
    "role": "An append-only store of immutable JSON cells on sharded MySQL, keyed by row UUID, column, and version. Built in 2014 when trip data outgrew Postgres. Triggers let billing run when a trip's BASE column is written."
   },
   {
    "name": "Kafka",
    "role": "Pub/sub backbone for rider and driver app events, database changelogs, and the data lake. In 2021 over 300 microservices used it for queueing."
   },
   {
    "name": "Cadence",
    "role": "A durable workflow engine created at Uber starting in 2015 and the predecessor of Temporal. Used for long-running workflows, orchestration, and distributed cron."
   },
   {
    "name": "Fulfillment platform",
    "role": "Since the 2021 rewrite, trips and orders are hierarchical state machines (statecharts) stored in Google Cloud Spanner for transactions."
   }
  ],
  "decisions": [
   {
    "title": "Live locations in memory, sharded in the app (Ringpop)",
    "why": "Location data is stale within seconds, so a database adds little. Ringpop gives each key one owner and forwards requests to it, so the Node.js services scale by adding workers without manual reassignment.",
    "tradeoff": "Ownership is best effort (availability over consistency). By 2021 Uber listed Ringpop's peer-to-peer size limits and Cassandra's last-write-wins overwrites during failovers among the reasons to rebuild fulfillment on transactions."
   },
   {
    "title": "Grid cells as the geo index (S2, then H3)",
    "why": "A cell ID is a cheap shard key, and \"nearby\" becomes \"these cells\". Hexagons have a single distance to every neighbor, which reduces error as people move through a city.",
    "tradeoff": "Cell size is a trade-off: smaller cells mean more cells to query per search. Hexagons do not nest exactly, so a child cell is only approximately inside its parent."
   },
   {
    "title": "Build Schemaless instead of adopting a new database",
    "why": "In early 2014 trip data would outgrow Postgres within the year. Uber needed linear scaling, write availability, change notifications, and indexes, and the decision came down to operational trust: knowing how to fix it at 3 am.",
    "tradeoff": "No transactions across cells, and indexes are eventually consistent (usually under 20 ms behind). You own and operate a custom database layer."
   },
   {
    "title": "The trip as a state machine, with transactions",
    "why": "Trips and orders now have many flows (reservations, batching, shared rides). Statecharts make legal transitions explicit, and Spanner updates several entities all or nothing.",
    "tradeoff": "Each operation makes a sequence of network calls to Spanner in Google Cloud, so latency is higher than the old in-region stack. A core system now depends on one cloud vendor."
   },
   {
    "title": "Durable workflows for long-running steps (Cadence)",
    "why": "Timeouts, retries, and multi-step business processes need state that survives crashes. A workflow engine persists that state so engineers do not hand-build it from queues, cron jobs, and status tables.",
    "tradeoff": "Uber itself heard that Cadence has a steep learning curve, and it is another stateful platform to run on top of stores such as Cassandra or MySQL."
   },
   {
    "title": "Driver phones as a backup of trip state",
    "why": "In the 2015 design, dispatch periodically sent an encrypted state digest to each driver phone. After a datacenter failover, the backup site rebuilt in-progress trips from the phones instead of replicating everything.",
    "tradeoff": "Recovery depends on phones reconnecting, and the digest must be encrypted and versioned. It only works because drivers report every few seconds."
   }
  ],
  "whenNot": "Do not build gossip-based app sharding, a custom datastore on MySQL, or a workflow platform for a small ride or delivery app: one database with a spatial index handles thousands of drivers. Uber itself moved from best-effort ownership back to transactions in 2021 once correctness bugs outweighed the speed. Reach for durable workflows only when you have many long-running, multi-step flows.",
  "lessons": [
   "Separate hot, disposable data (locations in memory) from durable data (trips in a database).",
   "Pick the grid for the query: cells turn \"nearby\" into cheap set lookups.",
   "Availability-first shortcuts (best-effort ownership, last write wins) came back as consistency bugs at scale.",
   "Make the trip an explicit state machine so retries and races cannot create impossible states."
  ],
  "interview": {
   "ask": "Design a ride-hailing app like Uber",
   "plan": [
    "Clarify (5 min): request, match, ETA, trip tracking, pricing, payment; one city or global.",
    "Estimate (5 min): e.g. 1M online drivers updating every 4 s = 250K writes per second; riders read far more.",
    "Location ingest (10 min): drivers → gateway → in-memory index sharded by cell (S2 or H3); keep the main database off this path.",
    "Matching (10 min): cells around pickup → filter candidates → road ETA → rank → offer to one driver with a timeout, then the next.",
    "Trip state (5 min): explicit states (requested, accepted, arrived, on trip, completed, cancelled) with guarded transitions in a transactional store.",
    "Events (5 min): trip events on Kafka feed billing, receipts, and analytics; long steps run as durable workflows.",
    "Wrap-up (5 min): region failover, hot cells (airports, stadiums), surge pricing per cell."
   ],
   "deepDives": [
    "Geo index: cell size, searching rings of neighbor cells, hot cells.",
    "Double booking: one driver, two offers; conditional updates or one owner per driver.",
    "Trip state consistency: why Uber moved from Ringpop plus Cassandra to Spanner transactions.",
    "Failover without losing trips: replicate state, or rebuild it from client-held state."
   ],
   "traps": [
    "Writing every location ping to the primary database.",
    "Ranking by straight-line distance instead of road ETA.",
    "No state machine, so a late retry moves a completed trip back to in progress."
   ]
  },
  "sources": [
   {
    "t": "How Uber Scales Their Real-time Market Platform (write-up of Matt Ranney's QCon London 2015 talk)",
    "by": "High Scalability, 2015",
    "url": "https://highscalability.com/how-uber-scales-their-real-time-market-platform/"
   },
   {
    "t": "How Ringpop from Uber Engineering Helps Distribute Your Application",
    "by": "Uber Engineering, 2016",
    "url": "https://www.uber.com/us/en/blog/ringpop-open-source-nodejs-library/"
   },
   {
    "t": "H3: Uber's Hexagonal Hierarchical Spatial Index",
    "by": "Uber Engineering, 2018",
    "url": "https://www.uber.com/us/en/blog/h3/"
   },
   {
    "t": "Designing Schemaless, Uber Engineering's Scalable Datastore Using MySQL",
    "by": "Uber Engineering, 2016",
    "url": "https://www.uber.com/us/en/blog/schemaless-part-one-mysql-datastore/"
   },
   {
    "t": "Uber's Fulfillment Platform: Ground-up Re-architecture to Accelerate Uber's Go/Get Strategy",
    "by": "Uber Engineering, 2021",
    "url": "https://www.uber.com/us/en/blog/fulfillment-platform-rearchitecture/"
   },
   {
    "t": "The Architecture of Uber's API gateway",
    "by": "Uber Engineering, 2021",
    "url": "https://www.uber.com/blog/architecture-api-gateway/"
   },
   {
    "t": "Uber's Real-Time Push Platform",
    "by": "Uber Engineering, 2020",
    "url": "https://www.uber.com/blog/real-time-push-platform/"
   },
   {
    "t": "Uber's Next Gen Push Platform on gRPC",
    "by": "Uber Engineering, 2022",
    "url": "https://www.uber.com/us/en/blog/ubers-next-gen-push-platform-on-grpc/"
   },
   {
    "t": "DeepETA: How Uber Predicts Arrival Times Using Deep Learning",
    "by": "Uber Engineering, 2022",
    "url": "https://www.uber.com/us/en/blog/deepeta-how-uber-predicts-arrival-times/"
   }
  ]
 },
 {
  "id": "stripe",
  "name": "Stripe",
  "kind": "Payments API",
  "tagline": "Moving money over unreliable networks, where a retried request must never charge twice and an integration written years ago must keep working.",
  "scale": [
   "2023: $1 trillion in total payments volume at 99.999% uptime.",
   "2024: DocDB served over 5 million queries per second across 2,000+ shards and 5,000+ collections, holding petabytes.",
   "2023: 1.5 PB moved online to bin-pack thousands of databases, cutting shard count by about three quarters.",
   "2017: every API version since 2011 still supported, after almost a hundred breaking changes in six years.",
   "2017: hundreds of millions of Subscriptions objects migrated to a new table with no downtime."
  ],
  "requirements": {
   "functional": [
    "Create charges, refunds, and other money movements through a public API.",
    "Let clients retry any write safely.",
    "Keep old integrations working while the API evolves.",
    "Change data models and move data without maintenance windows.",
    "Limit each user so one integration cannot hurt others."
   ],
   "nonFunctional": [
    "Correctness first: never double charge, never lose a write.",
    "Very high availability (99.999% in 2023).",
    "Stable latency during spikes such as flash sales.",
    "Horizontal scale for a shared, multi-tenant database.",
    "An audit trail of what happened to each request."
   ]
  },
  "flow": [
   [
    "Client",
    "POST with Idempotency-Key"
   ],
   [
    "Rate limiters",
    "token buckets in Redis"
   ],
   [
    "Idempotency layer",
    "replays saved result if seen"
   ],
   [
    "API logic",
    "runs the charge"
   ],
   [
    "DB proxy (Go)",
    "routes via chunk metadata"
   ],
   [
    "DocDB shard",
    "MongoDB-based storage"
   ],
   [
    "Version layer",
    "reshapes response for pinned version"
   ]
  ],
  "components": [
   {
    "name": "Idempotency layer",
    "role": "Saves the status code and body of the first request for each key, even a 500. On a retry it compares parameters and errors if they differ. Keys can be pruned once they are 24 hours old."
   },
   {
    "name": "Rate limiters and load shedders",
    "role": "Four kinds (2017): per-user request rate, per-user concurrent requests, a fleet shedder that reserves capacity for critical calls, and a worker-utilization shedder. Token buckets live in Redis."
   },
   {
    "name": "API version layer",
    "role": "An account is pinned to the newest date-named version on its first call. Responses are built at the current version, then version change modules walk them back to the caller's version."
   },
   {
    "name": "DocDB proxies (Go)",
    "role": "Parse each query, route it to one or more shards using the chunk metadata service, merge the results, and enforce admission and access control."
   },
   {
    "name": "Chunk metadata service",
    "role": "Maps chunks of data to shards. Proxies route by it, and a data move is finished by updating it."
   },
   {
    "name": "Data Movement Platform",
    "role": "Moves chunks between shards with zero downtime: register, bulk import from a snapshot, replicate changes from the oplog (via Kafka), verify, switch traffic, clean up."
   }
  ],
  "decisions": [
   {
    "title": "Idempotency keys on every POST",
    "why": "A timeout does not tell the client whether the charge happened. With a client-generated key it can simply retry, and the server returns the saved result instead of charging again.",
    "tradeoff": "Every write pays for a key lookup and a stored response. A request that conflicts with one still running is not saved and must be retried. Once a key is pruned, a very late retry becomes a new request."
   },
   {
    "title": "Date-based versions with backward transformations",
    "why": "Each dated version holds a small set of breaking changes, so upgrades are incremental. Code is written for the current version only, and version change modules convert responses back for older callers.",
    "tradeoff": "Every breaking change becomes a module kept for years, and changes that cannot be encapsulated leave version checks scattered through the code. Worth it for a public API, not for an internal one."
   },
   {
    "title": "Online migrations with dual writes",
    "why": "Four phases: dual write to old and new tables, move reads (compared in production with GitHub's Scientist), move writes, delete the old data. The backfill ran as offline Hadoop jobs on snapshots so production was not scanned.",
    "tradeoff": "Slow and code-heavy: parallel code paths live for the whole migration, dual writes add load (ramped up by percentage), and every phase needs checks before the next."
   },
   {
    "title": "DocDB: MongoDB with Stripe's own sharding and data movement",
    "why": "Stripe picked MongoDB in 2011 for developer productivity, then built proxies, a chunk map, and the Data Movement Platform to split, merge, and move shards without downtime.",
    "tradeoff": "A large in-house platform, including a custom MongoDB patch for versioned gating. Each traffic switch pauses a chunk briefly (under 2 seconds) and relies on clients retrying."
   },
   {
    "title": "Layered rate limiting and load shedding",
    "why": "Per-user limits stop runaway scripts (millions of rejected requests a month in 2017). Reserving part of the fleet, for example 20%, for critical calls like creating charges keeps payments working when other traffic spikes.",
    "tradeoff": "Limiters must fail open: if Redis dies, traffic flows unprotected. Thresholds need dark launches and tuning, and clients must handle 429 and 503."
   },
   {
    "title": "Client retries with exponential backoff and jitter",
    "why": "Stripe's Ruby library retries failures automatically with an idempotency key, and random jitter spreads retries so they do not hammer a recovering server.",
    "tradeoff": "Retries are safe only because of idempotency keys, and backoff makes each individual failure slower to resolve."
   }
  ],
  "whenNot": "Do not build a DocDB-style data movement platform or four kinds of limiters for a young product: use a managed database, expand-and-contract migrations, and one per-user rate limiter (Stripe itself says to start there). Date-based versioning with transformation modules pays off for public APIs with many outside integrations; internal APIs can just coordinate deploys. Idempotency keys, though, are cheap and worth having from day one for anything that moves money.",
  "lessons": [
   "Make every mutating call idempotent; then retries become safe and simple.",
   "Treat the API as a contract: pin versions, transform at the edge, keep old callers working.",
   "Change data in phases you can verify and roll back, never in one big switch.",
   "Shed low-priority load before it takes down high-priority work."
  ],
  "interview": {
   "ask": "Design a payments API like Stripe",
   "plan": [
    "Clarify (5 min): charges, refunds, webhooks; card networks behind a processor; many merchants; each request takes effect once.",
    "API (5 min): <code>POST /v1/charges</code> with an <code>Idempotency-Key</code> header; states pending → succeeded or failed; results also sent by webhook.",
    "Idempotency store (10 min): key → request hash, status, saved response; unique insert or lock while in flight; expiry.",
    "Money flow (10 min): call the processor with timeouts; on timeout mark the charge unknown and reconcile; record every movement in a ledger.",
    "Protection (5 min): per-account token bucket, concurrency limits, reserved capacity for charges over list calls.",
    "Data (5 min): shard by merchant or account; plan online migrations and schema versions.",
    "Wrap-up (5 min): webhook retries, audit trail, API versioning."
   ],
   "deepDives": [
    "Two identical requests arrive at once: unique constraint or lock on the key, reject the second.",
    "A timeout calling the card processor: never blind-retry, check the status first.",
    "Rate limiter design: token bucket in Redis, fail open, 429 versus 503.",
    "Changing a hot table safely: dual writes, compared reads, backfill."
   ],
   "traps": [
    "Generating the idempotency key on the server, so a retry after a lost response looks new.",
    "Treating a timeout as a failure and charging again.",
    "Changing response shapes under existing integrations."
   ]
  },
  "sources": [
   {
    "t": "Idempotent requests (API reference)",
    "by": "Stripe Docs",
    "url": "https://docs.stripe.com/api/idempotent_requests"
   },
   {
    "t": "APIs as infrastructure: future-proofing Stripe with versioning",
    "by": "Brandur Leach, Stripe, 2017",
    "url": "https://stripe.com/blog/api-versioning"
   },
   {
    "t": "Online migrations at scale",
    "by": "Jacqueline Xu, Stripe, 2017",
    "url": "https://stripe.com/blog/online-migrations"
   },
   {
    "t": "How Stripe's document databases supported 99.999% uptime with zero-downtime data migrations",
    "by": "Jimmy Morzaria and Suraj Narkhede, Stripe, 2024",
    "url": "https://stripe.dev/blog/how-stripes-document-databases-supported-99.999-uptime-with-zero-downtime-data-migrations"
   },
   {
    "t": "Scaling your API with rate limiters",
    "by": "Paul Tarjan, Stripe, 2017",
    "url": "https://stripe.com/blog/rate-limiters"
   },
   {
    "t": "Receive Stripe events in your webhook endpoint",
    "by": "Stripe Docs",
    "url": "https://docs.stripe.com/webhooks"
   },
   {
    "t": "How we built it: Stripe Radar",
    "by": "Stripe, 2023",
    "url": "https://stripe.dev/blog/how-we-built-it-stripe-radar"
   }
  ]
 },
 {
  "id": "zoom",
  "name": "Zoom",
  "kind": "Video conferencing",
  "tagline": "Getting low-latency audio and video through almost any network to meetings of many people, and absorbing a 30x jump in daily use within months.",
  "scale": [
   "Jun 2019: 13 co-located data centers; Zoom said multimedia routing supports 15x more participants than a standard MCU, which usually handles under 100.",
   "Dec 2019 → Apr 2020: from about 10 million to more than 300 million daily meeting participants.",
   "Apr 2020: over 7 PB a day flowed through Oracle Cloud, which carried hundreds of thousands of concurrent participants within hours of deployment.",
   "2020: AWS added tens of thousands of EC2 instances for Zoom, sometimes thousands in a single day.",
   "Oct 2020: an end-to-end encrypted meeting mode (technical preview) for up to 200 participants."
  ],
  "requirements": {
   "functional": [
    "Join a meeting from desktop, mobile, room systems, or a browser.",
    "Many-party audio, video, and screen sharing.",
    "Adapt quality to each device and network.",
    "Work behind strict firewalls and proxies.",
    "Optional end-to-end encryption."
   ],
   "nonFunctional": [
    "Low latency and jitter for real-time media.",
    "Scale to very large meetings and to sudden global growth.",
    "Pick a good data center automatically and survive failures.",
    "Encrypt media in transit (256-bit AES-GCM by default in 2020).",
    "Low server CPU per participant."
   ]
  },
  "flow": [
   [
    "Client",
    "asks to join"
   ],
   [
    "Web infrastructure",
    "HTTPS 443, returns zones"
   ],
   [
    "Zone controllers",
    "performance test, pick best"
   ],
   [
    "Multimedia router",
    "control channel over SSL"
   ],
   [
    "Media connections",
    "UDP 8801, else TCP, SSL"
   ],
   [
    "Other participants",
    "receive routed streams"
   ]
  ],
  "components": [
   {
    "name": "Zoom client",
    "role": "Desktop, mobile, room, or SDK. Opens one media connection per type (audio, video, content), so networks can prioritize media with DSCP marking."
   },
   {
    "name": "Web infrastructure",
    "role": "Handles meeting lookup over HTTPS and uses Geo-IP to return candidate meeting zones and their zone controllers."
   },
   {
    "name": "Meeting zone",
    "role": "A group of co-located servers that can host a session, in Zoom's data centers or on-premises. Contains multimedia routers and zone controllers."
   },
   {
    "name": "Zone controller",
    "role": "Tracks the load on the zone's servers and brokers new connections; the client asks it for the best multimedia router."
   },
   {
    "name": "Multimedia router (MMR)",
    "role": "Hosts meetings and routes each participant's streams to the others (SFU-style) instead of mixing them."
   },
   {
    "name": "HTTP tunnel",
    "role": "A fallback in public clouds and Zoom data centers, used when no zone controller answers within 5.5 seconds."
   },
   {
    "name": "Cloud capacity",
    "role": "Media runs in co-located and commercial cloud data centers; in 2020 Zoom added large AWS and Oracle Cloud capacity to absorb the surge."
   }
  ],
  "decisions": [
   {
    "title": "Route streams (SFU-style) instead of mixing (MCU)",
    "why": "A mixing MCU decodes, combines, and re-encodes media on the server, which is CPU-heavy. Zoom's multimedia routers forward several streams and let clients decode, which Zoom said supports 15x more participants.",
    "tradeoff": "Clients download and decode several streams, so weak devices and links need smaller versions of each. A mixer sends one stream per client, which is easier on very old or very weak endpoints."
   },
   {
    "title": "UDP first, then TCP, then TLS",
    "why": "Media prefers UDP on port 8801, where a lost packet does not hold up newer ones. If UDP is blocked the client tries TCP 8801, then SSL on 443; an HTTP tunnel and the web client are further fallbacks.",
    "tradeoff": "Each fallback adds latency and head-of-line blocking under loss, and the connection logic gets complex (for example a 5.5 second wait before tunneling). Enterprises must open specific ports to get the best path."
   },
   {
    "title": "The client measures and picks the meeting zone",
    "why": "The client runs a performance test against each candidate zone controller and keeps the best one, so it lands on a nearby, healthy data center without a central guess.",
    "tradeoff": "Extra round trips at join time, and zone load must be tracked so every client does not pile onto the same good zone."
   },
   {
    "title": "Multi-bitrate encoding and app-level QoS",
    "why": "Each stream can adjust to several resolutions, so the server never re-encodes per receiver and each device gets quality that fits its screen and bandwidth.",
    "tradeoff": "Senders spend more CPU and uplink on several encodings, and the server must choose the right version for every receiver."
   },
   {
    "title": "Own data centers plus public cloud",
    "why": "Growth from about 10 million to 300+ million daily participants in a few months was absorbed by adding tens of thousands of AWS instances and Oracle capacity that went live within hours.",
    "tradeoff": "Several providers mean more operations work, network paths, and egress cost, and the software must deploy the same way everywhere."
   },
   {
    "title": "End-to-end encryption as an opt-in mode",
    "why": "With E2EE the host's client creates the meeting keys and shares them with public-key cryptography, so Zoom's servers become oblivious relays. It uses the same AES-GCM as normal meetings; only where the keys live changes.",
    "tradeoff": "The 2020 version disabled join before host, cloud recording, streaming, live transcription, breakout rooms, polling, 1:1 private chat, and reactions, since the servers can no longer see the media."
   }
  ],
  "whenNot": "For a small product, do not build your own media routers, meeting zones, or proprietary transport: use WebRTC with an existing SFU or a managed video API. For plain 1:1 calls peer-to-peer can be enough. Add a second cloud or your own data centers only when growth or cost truly demands it.",
  "lessons": [
   "Forward, do not mix: moving decode work to clients is what lets one server host big meetings.",
   "Connectivity is a feature: design a fallback ladder from UDP to TCP to TLS to a tunnel.",
   "Adapt per receiver with several encodings instead of one quality for everyone.",
   "Keep an escape hatch for capacity: public cloud on top of your own data centers."
  ],
  "interview": {
   "ask": "Design a video conferencing system like Zoom",
   "plan": [
    "Clarify (5 min): meeting size, gallery vs active speaker, screen share, recording, dial-in, E2EE, regions.",
    "Signaling vs media (5 min): HTTPS or WebSocket for join and control; a separate real-time media transport over UDP.",
    "Topology (10 min): mesh vs SFU vs MCU with bandwidth math; pick an SFU for groups.",
    "Placement (5 min): regional zones; the client picks by measured latency; a controller assigns the least-loaded media router.",
    "Quality (10 min): several encodings per sender, a version chosen per receiver, active speaker in high quality, others as thumbnails.",
    "Reliability (5 min): router failure → rejoin; UDP → TCP → TLS fallback; burst capacity in the cloud.",
    "Security (5 min): TLS and SRTP by default; the E2EE mode and what it turns off."
   ],
   "deepDives": [
    "Bandwidth: in a mesh each sender uploads N-1 streams; with an SFU it uploads 1 and downloads N-1; with a mixer it downloads 1.",
    "Why UDP, and how to survive networks that block it.",
    "Large meetings: forward only active speakers at full quality.",
    "End-to-end encryption: who creates keys and what the server can still do."
   ],
   "traps": [
    "Sending media through the same stateless HTTP tier as signaling.",
    "Assuming TCP is fine for live media.",
    "Mixing on the server by default and running out of CPU."
   ]
  },
  "sources": [
   {
    "t": "Connection Process (white paper)",
    "by": "Zoom, 2025",
    "url": "https://media.zoom.com/download/assets/Zoom+Connection+Process+Jan-09-2025.pdf/449a2ed2f05711ef907d5e9c08889a4d"
   },
   {
    "t": "How Zoom Provides Industry-Leading Video Capacity (archived copy)",
    "by": "Zoom Blog, 2019",
    "url": "https://web.archive.org/web/20220125002347/https://blog.zoom.us/zoom-can-provide-increase-industry-leading-video-capacity/"
   },
   {
    "t": "Zoom Rolling Out End-to-End Encryption Offering",
    "by": "Zoom Blog, 2020",
    "url": "https://www.zoom.com/en/blog/zoom-rolling-out-end-to-end-encryption-offering/"
   },
   {
    "t": "AWS and Zoom Extend Strategic Relationship",
    "by": "Amazon press release, 2020",
    "url": "https://press.aboutamazon.com/2020/11/aws-and-zoom-extend-strategic-relationship"
   },
   {
    "t": "Zoom Selects Oracle as a Cloud Infrastructure Provider for Its Core Online Meeting Service",
    "by": "Oracle press release, 2020",
    "url": "https://www.oracle.com/corporate/pressrelease/zoom-selects-oracle-to-support-growth-042820.html"
   },
   {
    "t": "Zoom and Amazon Web Services",
    "by": "Zoom",
    "url": "https://www.zoom.com/en/industry/government/features/aws/"
   }
  ]
 },
 {
  "id": "amazon",
  "name": "Amazon (cart and orders)",
  "kind": "E-commerce",
  "tagline": "Never refusing an add-to-cart, even while disks, networks, and data centers fail, and turning each checkout into a long chain of steps that must each happen exactly once.",
  "scale": [
   "1998: the architecture overhaul aimed to support ten times the order volume of the day.",
   "2007: rendering one page could call over 150 services; the cart service handled tens of millions of requests and over 3 million checkouts in a single day.",
   "2007: storage SLAs were set at the 99.9th percentile (typically 300 ms); 99.94% of cart reads saw exactly one version.",
   "2021 Prime Day: DynamoDB peaked at 89.2 million requests per second from Amazon systems.",
   "2024 Prime Day: DynamoDB peaked at 146 million requests per second."
  ],
  "requirements": {
   "functional": [
    "Add, remove, and view cart items from any device.",
    "Check out: create the order, charge payment, reserve and ship items.",
    "Track each order as it moves through the pipeline.",
    "Handle a failure at any step (card declined, item out of stock) without losing the order."
   ],
   "nonFunctional": [
    "Cart writes must succeed even during failures.",
    "Tail latency matters: measure the 99.9th percentile, not the average.",
    "Each order step takes effect once, even with retries.",
    "Peak events (holiday season, Prime Day) at many times normal load.",
    "Limit the blast radius of any failure or bad deploy."
   ]
  },
  "flow": [
   [
    "Customer",
    "adds item to cart"
   ],
   [
    "Cart service",
    "always-writeable Dynamo store"
   ],
   [
    "Checkout",
    "order queued, quick ack"
   ],
   [
    "Order pipeline",
    "workflow steps via queues"
   ],
   [
    "Card charge step",
    "success onward, failures aside"
   ],
   [
    "Fulfillment",
    "pick, pack, ship"
   ]
  ],
  "components": [
   {
    "name": "Shopping cart service",
    "role": "The main example in the 2007 Dynamo paper: it must always be able to write and read carts. When versions conflict, the app merges them into one cart."
   },
   {
    "name": "Dynamo",
    "role": "Internal key-value store (2007): consistent hashing with virtual nodes, N replicas per key, vector clocks, sloppy quorum with hinted handoff, Merkle-tree anti-entropy, gossip membership. A common (N, R, W) was (3, 2, 2)."
   },
   {
    "name": "DynamoDB",
    "role": "The managed service launched in 2012. It shares the name but little of Dynamo's architecture: each partition is a Multi-Paxos group whose leader takes writes and strongly consistent reads."
   },
   {
    "name": "Order pipeline",
    "role": "Described in 1998 as business processes acting on an order from placement until it ships. An asynchronous call only confirms the work was queued; results come back later by polling or callback."
   },
   {
    "name": "Queues and dead-letter queues",
    "role": "Amazon builds many asynchronous systems on queues, including fulfilling amazon.com orders. Teams watch the age of messages in the queue, and messages that run out of retries go to a DLQ."
   },
   {
    "name": "Cells",
    "role": "Independent copies of a workload, each serving a slice of customers, behind the thinnest possible router keyed by something like customer ID. A control plane creates cells and moves customers."
   }
  ],
  "decisions": [
   {
    "title": "Availability over consistency for the cart",
    "why": "Rejecting an add-to-cart costs sales and trust. Dynamo accepts writes during failures and keeps every version, so an add is never lost.",
    "tradeoff": "Reads can return several versions that the app must merge, and with the cart's merge, deleted items can come back."
   },
   {
    "title": "Leaderless replication with sloppy quorums",
    "why": "Any of the first N healthy nodes can take a write, and hinted handoff delivers it to the right node later, so node and network failures do not fail requests. (N, R, W) tunes the balance; W = 1 favors availability most.",
    "tradeoff": "A small W opens a durability window, conflicts get more likely, and replicas need read repair and Merkle-tree anti-entropy to converge."
   },
   {
    "title": "Vector clocks and app-level merges",
    "why": "Vector clocks tell whether two versions are ordered or concurrent, so the store never silently drops a concurrent update the way last-write-wins can.",
    "tradeoff": "Clocks grow with the number of writers (Dynamo trimmed them at about 10 entries), and every app must write merge logic. Some teams did not want to and fell back to last write wins."
   },
   {
    "title": "DynamoDB chose one leader per partition",
    "why": "Multi-Paxos per partition gives strongly consistent reads when needed and no client-side merging. As a managed service it removed the operations burden that made teams avoid running Dynamo themselves.",
    "tradeoff": "After a leader fails, the new leader takes no writes until the old lease expires, so a partition can pause briefly. It is not always writeable in the Dynamo sense."
   },
   {
    "title": "An asynchronous, queued order pipeline",
    "why": "The 1998 manifesto moved Amazon toward workflow: each node passes the order to the next and only waits for \"queued\". A step such as charging a card can retry on its own, and failed orders go to exception handling.",
    "tradeoff": "Backlogs: after an hour-long outage you need about double capacity for another hour to catch up. It is also harder to see where one order is, so every state change must be recorded."
   },
   {
    "title": "Cells and shuffle sharding to limit blast radius",
    "why": "A failure or bad deploy in one cell hits only its customers (with 10 cells, about 90% are unaffected). Shuffle sharding gives each customer a near-unique set of workers, so one bad actor cannot take down everyone.",
    "tradeoff": "The cell router becomes critical and must stay tiny. Cross-cell queries and moving customers need a control plane, and spare capacity in every cell costs money."
   }
  ],
  "whenNot": "Do not copy leaderless replication, vector clocks, and merge logic unless you truly must accept writes during partitions; even Amazon's own engineers preferred managed services over running Dynamo themselves. A monolith with one relational database and a job queue is fine for an early store. Cells pay off only when blast radius costs more than the extra routing and spare capacity.",
  "lessons": [
   "Choose consistency per data type: carts can merge, payments and orders cannot.",
   "Put conflict resolution where the business meaning lives; the cart knows how to merge.",
   "Async pipelines trade latency for resilience; plan for backlogs, message age, and dead letters.",
   "Contain failures by design (cells, shuffle sharding) instead of hoping they stay small."
  ],
  "interview": {
   "ask": "Design the shopping cart and checkout for a site like Amazon",
   "plan": [
    "Clarify (5 min): cart operations, guest vs signed-in carts, checkout steps, inventory rules, peak events.",
    "Cart (10 min): key-value by customer ID, availability first; a merge rule for conflicting versions (union of adds, careful removes).",
    "Checkout (10 min): idempotent place-order with a client request ID; validate price and stock; reserve inventory with a timeout.",
    "Order pipeline (10 min): durable workflow or queues for charge → fulfill → ship → notify; every step idempotent; compensations such as refund or release stock.",
    "Data (5 min): orders and payments in a strongly consistent store; publish order events for other services.",
    "Wrap-up (5 min): partition by customer, cells, alarms on the age of the oldest message."
   ],
   "deepDives": [
    "Cart conflicts: vector clocks vs last-write-wins, and why deleted items can come back.",
    "Inventory: overselling vs underselling, reservations that expire.",
    "Payment step: idempotent charge, unknown outcomes, compensation when shipping fails.",
    "Recovering from a backlog: catch-up capacity, message age, serving fresh orders first."
   ],
   "traps": [
    "Putting the cart on a single-leader database that rejects writes during failover.",
    "Doing payment, fulfillment, and email synchronously inside the checkout request.",
    "Letting a retried place-order create a second order."
   ]
  },
  "sources": [
   {
    "t": "Dynamo: Amazon's Highly Available Key-value Store",
    "by": "DeCandia et al., SOSP 2007",
    "url": "https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf"
   },
   {
    "t": "Amazon DynamoDB: A Scalable, Predictably Performant, and Fully Managed NoSQL Database Service",
    "by": "Elhemali et al., USENIX ATC 2022",
    "url": "https://www.usenix.org/system/files/atc22-elhemali.pdf"
   },
   {
    "t": "The Distributed Computing Manifesto (1998 internal document)",
    "by": "Werner Vogels, All Things Distributed, 2022",
    "url": "https://www.allthingsdistributed.com/2022/11/amazon-1998-distributed-computing-manifesto.html"
   },
   {
    "t": "Avoiding insurmountable queue backlogs",
    "by": "Amazon Builders' Library",
    "url": "https://builder.aws.com/content/3EuRcgkTP1MI0c7zM8W6HL3WIqA/avoiding-insurmountable-queue-backlogs"
   },
   {
    "t": "Reducing the Scope of Impact with Cell-Based Architecture",
    "by": "AWS Well-Architected whitepaper, 2023",
    "url": "https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/reducing-scope-of-impact-with-cell-based-architecture.html"
   },
   {
    "t": "Migration Complete: Amazon's Consumer Business Just Turned off its Final Oracle Database",
    "by": "AWS News Blog, 2019",
    "url": "https://aws.amazon.com/blogs/aws/migration-complete-amazons-consumer-business-just-turned-off-its-final-oracle-database/"
   },
   {
    "t": "How AWS powered Prime Day 2024 for record-breaking sales",
    "by": "AWS News Blog, 2024",
    "url": "https://aws.amazon.com/blogs/aws/how-aws-powered-prime-day-2024-for-record-breaking-sales/"
   }
  ]
 }
]);
