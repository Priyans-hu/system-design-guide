window.HUB_CASES = window.HUB_CASES || [];
window.HUB_CASES.push(...[
 {
  "id": "netflix",
  "name": "Netflix",
  "kind": "Video streaming",
  "tagline": "Video bytes dwarf everything else, so the hard part is serving them from inside the viewer's own ISP at evening peak while a large microservice control plane in AWS survives instance, zone and region failures.",
  "scale": [
   "302M paid memberships at the end of 2024 (Q4 2024 shareholder letter).",
   "Open Connect, started in 2011, partners with over a thousand ISPs (Open Connect site, 2026).",
   "Zuul 2 in 2018: 80+ gateway clusters routing over 1 million requests per second.",
   "EVCache in 2016: up to 30 million requests per second at peak, just under 2 trillion a day.",
   "2018: members watched 140 million hours a day, and a full region failover took 8 minutes, down from about 50."
  ],
  "requirements": {
   "functional": [
    "Browse a personalized catalog and search titles.",
    "Start playback quickly on TVs, phones and browsers, with seek and resume.",
    "Adapt video quality to each device and network.",
    "Track viewing progress and history per profile.",
    "Enforce entitlements: plan, regional licensing and DRM."
   ],
   "nonFunctional": [
    "Very high availability for playback, the core product.",
    "Fast start and few rebuffers at evening peak.",
    "Keep video bytes off expensive backbone and transit links.",
    "Survive the loss of an instance, a zone or a whole region.",
    "Eventual consistency is fine for most member data (history, ratings, recommendations)."
   ]
  },
  "flow": [
   [
    "Client",
    "TV, phone and browser apps"
   ],
   [
    "Zuul",
    "front door in AWS"
   ],
   [
    "Playback services",
    "auth, licensing, file choice"
   ],
   [
    "Steering",
    "picks OCAs, returns URLs"
   ],
   [
    "OCA",
    "cache inside the ISP"
   ],
   [
    "Player",
    "adapts to network conditions"
   ]
  ],
  "components": [
   {
    "name": "Open Connect",
    "role": "Netflix's own CDN, started in 2011. Purpose-built cache appliances (OCAs) sit at internet exchanges or inside ISP networks; qualifying ISPs get them free and supply power, space and connectivity."
   },
   {
    "name": "Control plane in AWS",
    "role": "Accounts, browsing, licensing checks and steering run in AWS. OCAs only report health, learned BGP routes and stored files, and serve bytes; the steering service uses those reports to give each client URLs for the best OCAs."
   },
   {
    "name": "Zuul",
    "role": "Edge gateway and front door for all requests into Netflix's AWS cloud, with filters for auth, routing, throttling and shedding load. Zuul 2 (open-sourced 2018) is a Netty server on an event loop, so filters must never block."
   },
   {
    "name": "Federated GraphQL",
    "role": "One API schema, owned in parts by domain teams through Domain Graph Services; a gateway splits each query into sub-queries. Studio apps moved first (by 2020), and in 2022 the iOS and Android apps moved from the Falcor API monolith to it."
   },
   {
    "name": "EVCache",
    "role": "Memcached-based cache for data like viewing history, ratings and precomputed recommendations. In 2016 it replicated writes to other regions asynchronously through Kafka, so traffic moved to another region does not hit cold caches."
   },
   {
    "name": "Cassandra",
    "role": "In 2013 Netflix said all data read and written to serve member requests lived in Cassandra, replicated asynchronously across regions. A 2011 benchmark reached 1.1 million client writes per second on 288 nodes."
   },
   {
    "name": "Encoding pipeline",
    "role": "Splits each source into chunks (a 1-hour episode became twenty 3-minute chunks) and encodes them in parallel on cloud instances. Per-title (2015) and shot-based (2018) optimization choose bitrate and resolution per title or per shot, scored with VMAF."
   },
   {
    "name": "Chaos tooling",
    "role": "Chaos Monkey (2011) randomly kills production instances during business hours. Chaos Gorilla takes out a whole zone, and Chaos Kong rehearses moving all traffic out of a region."
   }
  ],
  "decisions": [
   {
    "title": "Build a CDN inside ISPs instead of renting one",
    "why": "Video is most of the traffic and demand is predictable. Proactive, directed caching (filling OCAs with likely-watched titles in off-peak windows) cut upstream network demand by several orders of magnitude compared with a demand-driven CDN, per Netflix's Open Connect overview.",
    "tradeoff": "Needs hardware, an operations team and partnerships with 1,000+ ISPs. It works because the catalog is known in advance; a service with constant user uploads or live news cannot pre-position content this way."
   },
   {
    "title": "Split the control plane from the data plane",
    "why": "Fast-changing logic (accounts, licensing, steering, recommendations) runs in the cloud, where it scales elastically. OCAs stay simple: store files, report status, serve HTTP. Each side scales and fails on its own.",
    "tradeoff": "Two very different platforms to operate. Steering is only as good as the telemetry from thousands of appliances; stale data sends clients to overloaded boxes."
   },
   {
    "title": "Stateless services, active-active regions",
    "why": "Since 2013 Netflix has served members from more than one AWS region. Services keep no local state, data lives in Cassandra and EVCache replicated across regions, and DNS plus Zuul can move traffic when a region breaks.",
    "tradeoff": "Asynchronous replication means brief staleness after a shift, and every region needs spare capacity. Failover took about 50 minutes until Project Nimble (2018) kept pre-built \"dark\" capacity ready and cut it to 8."
   },
   {
    "title": "Eventual consistency for cached member data",
    "why": "Slightly different recommendations in two regions hurt nobody. EVCache replication is asynchronous and never blocks local reads or writes.",
    "tradeoff": "Wrong for payments or entitlements that need read-your-writes. In a long regional outage the Kafka buffer can drop replication messages, so services must tolerate stale or missing entries."
   },
   {
    "title": "Encode per title and per shot, not one ladder for all",
    "why": "A fixed bitrate ladder wastes bits on simple animation and starves grainy action. Per-title encoding (2015) cut one show's top 1080p stream from 5800 to 4640 kbps (20% less). Shot-based encodes (2018) needed less than half the bits of the old per-title AVC encodes for the same quality (VMAF 80).",
    "tradeoff": "Many trial encodes per title and more files to store. Worth it when each title is watched millions of times; wasteful for a long tail of rarely watched uploads."
   },
   {
    "title": "Break things on purpose",
    "why": "Failures are routine at this scale, so recovery has to be tested all the time. Running Chaos Monkey in business hours means engineers are around when something breaks.",
    "tradeoff": "Only safe once recovery is automated and monitoring is good; before that it just causes outages."
   }
  ],
  "whenNot": "Do not build your own CDN appliances or ISP program: buy a commercial CDN until video egress is a top cost line. Skip active-active regions, chaos testing in production and per-shot encoding until you have the traffic, the team and the automation; one region with backups and a managed transcoding service is the right start.",
  "lessons": [
   "Separate the byte path from the decision path: a simple, cacheable data plane plus a smart control plane scales better than one system doing both.",
   "Predictable demand lets you pre-position content off-peak instead of caching on first request.",
   "Stateless services make regional failover possible; the hard part moves to replicating data and warming caches.",
   "Failure paths that are not exercised regularly will not work when you need them."
  ],
  "interview": {
   "ask": "Design a video streaming service like Netflix",
   "plan": [
    "Clarify (5 min): on-demand only or live, catalog size, devices, DAU and peak concurrent streams, global or single region.",
    "Estimate: peak concurrent streams x average bitrate gives egress in Tbps. This shows edges must carry nearly all bytes and origin must not serve playback.",
    "Draw control plane vs data plane: gateway, catalog, playback and licensing, steering on one side; CDN edges holding video segments on the other.",
    "Ingest: upload master → split into chunks → encode in parallel into a bitrate ladder → package segments and a manifest (DASH or HLS) → distribute to origin and edges.",
    "Playback: client asks the playback service → gets a manifest and edge URLs → fetches segments and adapts bitrate per segment.",
    "Data: catalog in SQL behind a cache; watch history in a wide-column store keyed by profile; recommendations computed offline and cached.",
    "Reliability and metrics: multi-AZ first, then multi-region with stateless services; track start time and rebuffer rate."
   ],
   "deepDives": [
    "CDN fill: pull-through caching vs proactive off-peak fill; how steering picks an edge (health, file availability, network proximity).",
    "Adaptive bitrate: segment length, ladder design, what the client measures, why per-title ladders save bandwidth.",
    "Resume position for millions of viewers: small, frequent writes; debounce on the client; eventual consistency is fine.",
    "Regional failover: replicated data, cache warmth, spare capacity, DNS TTLs."
   ],
   "traps": [
    "Serving video from app servers or a single origin; the egress math rules it out.",
    "One strongly consistent database for everything, when most member data can be eventually consistent.",
    "Forgetting licensing, regional rights and DRM in the playback path."
   ]
  },
  "sources": [
   {
    "t": "Open Connect Overview",
    "by": "Netflix",
    "url": "https://openconnect.netflix.com/Open-Connect-Overview.pdf"
   },
   {
    "t": "Open Sourcing Zuul 2",
    "by": "Netflix TechBlog, 2018",
    "url": "https://netflixtechblog.com/open-sourcing-zuul-2-82ea476cb2b3"
   },
   {
    "t": "Caching for a Global Netflix",
    "by": "Netflix TechBlog, 2016",
    "url": "https://netflixtechblog.com/caching-for-a-global-netflix-7bcc457012f1"
   },
   {
    "t": "Optimized shot-based encodes: Now Streaming!",
    "by": "Netflix TechBlog, 2018",
    "url": "https://netflixtechblog.com/optimized-shot-based-encodes-now-streaming-4b9464204830"
   },
   {
    "t": "Project Nimble: Region Evacuation Reimagined",
    "by": "Netflix TechBlog, 2018",
    "url": "https://netflixtechblog.com/project-nimble-region-evacuation-reimagined-d0d0568254d4"
   },
   {
    "t": "Active-Active for Multi-Regional Resiliency",
    "by": "Netflix TechBlog, 2013",
    "url": "https://netflixtechblog.com/active-active-for-multi-regional-resiliency-c47719f6685b"
   },
   {
    "t": "Benchmarking Cassandra Scalability on AWS: Over a million writes per second",
    "by": "Netflix TechBlog, 2011",
    "url": "https://netflixtechblog.com/benchmarking-cassandra-scalability-on-aws-over-a-million-writes-per-second-39f45f066c9e"
   },
   {
    "t": "Migrating Netflix to GraphQL Safely",
    "by": "Netflix TechBlog, 2023",
    "url": "https://netflixtechblog.com/migrating-netflix-to-graphql-safely-8e1e4d4f1e72"
   },
   {
    "t": "Open Connect",
    "by": "Netflix",
    "url": "https://openconnect.netflix.com/en/"
   }
  ]
 },
 {
  "id": "youtube",
  "name": "YouTube",
  "kind": "User-generated video",
  "tagline": "Uploads never stop, so every video must be transcoded into many formats and pushed toward the edge, while counters and recommendations stay fresh for billions of viewers.",
  "scale": [
   "More than 500 hours of video uploaded every minute on average (YouTube, 2021).",
   "About 1 billion hours watched per day (milestone announced in 2017).",
   "Counters for views, likes and subscriptions served at millions of QPS with 3.3 ms p99 latency (Procella paper, 2019).",
   "The 2016 recommender had about 1 billion parameters, trained on hundreds of billions of examples.",
   "Argos transcoding chips (2021): 20-33x the compute efficiency of the previous CPU-based system."
  ],
  "requirements": {
   "functional": [
    "Upload videos of any size, resumable if the connection drops.",
    "Transcode each upload into several resolutions and codecs, then publish.",
    "Watch with seek and automatic quality switching on any device.",
    "Show view, like and subscriber counts.",
    "Recommendations on the home page and next to each video.",
    "Comments, channels and subscriptions."
   ],
   "nonFunctional": [
    "Fast playback start and little rebuffering worldwide.",
    "An acknowledged upload is never lost.",
    "Transcoding keeps up with upload spikes; minutes of processing delay is acceptable.",
    "Counts can lag but must filter out fake views.",
    "Read-heavy: views vastly outnumber uploads, so storage and egress dominate cost."
   ]
  },
  "flow": [
   [
    "Creator",
    "uploads one source file"
   ],
   [
    "Upload service",
    "stores original durably"
   ],
   [
    "Transcoding",
    "VCUs make many renditions"
   ],
   [
    "Storage",
    "renditions plus metadata"
   ],
   [
    "Edge cache",
    "GGC nodes inside ISPs"
   ],
   [
    "Player",
    "DASH, picks bitrate"
   ]
  ],
  "components": [
   {
    "name": "Transcoding on VCUs",
    "role": "Videos are uploaded in one format but watched on everything from phones to 4K TVs, so each is transcoded into several resolutions and codecs. In 2021 YouTube described its Argos video coding units, custom transcoding chips that were already carrying the 2020 surge; VP9 needs about 5x the encoding compute of H.264."
   },
   {
    "name": "Adaptive streaming",
    "role": "Since the January 2015 switch to HTML5, the web player has used Media Source Extensions with MPEG-DASH, offering H.264 and VP9. The player changes resolution and bitrate as network conditions change."
   },
   {
    "name": "Google edge network",
    "role": "Edge points of presence peer with other networks at 100+ interconnection facilities. Google Global Cache nodes are Google-supplied servers inside ISP networks that cache locally popular static content, including YouTube, and traffic management sends each user to the best node."
   },
   {
    "name": "Vitess",
    "role": "Built at YouTube in 2010 to scale MySQL. VTGate is a proxy that speaks the MySQL protocol and routes queries to shards; VTTablet runs beside each MySQL instance. The Vitess docs say it served all YouTube database traffic for over five years."
   },
   {
    "name": "Bigtable",
    "role": "Google's wide-column store. A 2023 Google Cloud post says YouTube uses it for recommendations based on watch history, for recording metrics like view counts and for ads, and that the YouTube Data Warehouse is built on it."
   },
   {
    "name": "Procella",
    "role": "SQL engine built at YouTube (VLDB 2019). Its stats-serving instances answer counter queries such as <code>SUM(views)</code> for one video from memory, apply updates in near real time, and send each lookup to a primary and a secondary server, taking the faster reply."
   },
   {
    "name": "Recommender",
    "role": "Two neural networks (2016 paper). Candidate generation narrows millions of videos to hundreds from watch and search history, served with an approximate nearest neighbor lookup. Ranking scores those hundreds with many more features, aiming at expected watch time, not clicks."
   }
  ],
  "decisions": [
   {
    "title": "Transcode once at upload, serve many times",
    "why": "Views vastly outnumber uploads, so paying the encoding cost once per rendition beats encoding per request. More efficient codecs (VP9, and AV1 in newer chips) save bytes on every future view.",
    "tradeoff": "Storage grows with every rendition of every video, including the long tail nobody watches. Heavier codecs cost more compute (VP9 about 5x H.264), which YouTube answered with custom chips; a small site should use one codec and a managed transcoder."
   },
   {
    "title": "Adaptive bitrate over plain HTTP",
    "why": "Segments over HTTP are cacheable anywhere, and the player can switch quality between segments. YouTube reported in 2015 that ABR reduced buffering by more than 50% globally and by up to 80% on congested networks.",
    "tradeoff": "More renditions to make and store, a manifest per video, and more client logic. Segment length trades start-up time against request overhead."
   },
   {
    "title": "Shard MySQL behind a proxy, not in app code",
    "why": "YouTube first added read replicas, then sharded with routing logic inside the application. Vitess moved that routing into a proxy layer, so applications see what looks like one MySQL server and resharding does not mean rewriting app code.",
    "tradeoff": "Cross-shard queries and transactions stay expensive, and the proxy tier is one more system to run. A database that fits on one server with replicas does not need it."
   },
   {
    "title": "Treat counters as an aggregation problem",
    "why": "One row updated on every view would be a hot spot for a viral video. Procella serves counts by summing rows held in memory, with near real-time updates, at millions of QPS. YouTube also validates engagement first, so public counts may lag, freeze or drop low-quality playbacks.",
    "tradeoff": "Counts are delayed and approximate, and numbers can move after the fact when bad views are removed. Creators notice, so the product has to explain it."
   },
   {
    "title": "Two-stage recommendations",
    "why": "A rich model cannot score millions of videos in tens of milliseconds. A cheap retrieval stage (embeddings plus nearest neighbor search) picks hundreds; an expensive ranker scores only those. Ranking on expected watch time avoids rewarding clickbait that people abandon.",
    "tradeoff": "Anything candidate generation misses can never be ranked. Watch-time goals still reward whatever keeps people watching, so the objective needs constant A/B testing and guardrails."
   }
  ],
  "whenNot": "Do not build custom transcoding chips, a cache network inside ISPs or a sharding proxy on day one: a managed transcoder, a commercial CDN and one database with replicas will carry a new video site a long way. Start recommendations with popularity and recency; a two-stage deep model only pays off with a huge catalog and lots of interaction data.",
  "lessons": [
   "When reads vastly outnumber writes, move expensive work to write time: transcode once, serve many times.",
   "Put a routing layer between apps and shards early, so resharding is an operations task, not an app rewrite.",
   "Hot counters need their own design (in-memory aggregation, batched updates, duplicate reads to cut tail latency), not an UPDATE per event.",
   "Retrieval then ranking is the standard shape of recommenders at scale."
  ],
  "interview": {
   "ask": "Design YouTube (video upload and playback)",
   "plan": [
    "Clarify: max upload size, on-demand vs live, DAU, uploads per day, which features are in scope (comments, recommendations, search).",
    "Estimate storage (hours uploaded per day x renditions x bitrate) and egress (concurrent viewers x bitrate); both point to blob storage plus a CDN.",
    "Upload path: resumable chunked upload to blob storage → queue → transcoding workers encode chunks in parallel → mark the video ready.",
    "Watch path: metadata service returns a manifest and CDN URLs; the CDN pulls from origin on a miss; the client runs ABR.",
    "Metadata: sharded SQL (by video or channel ID) with replicas and a cache; justify the shard key.",
    "Counters: view events into a stream, aggregated in batches into a counter store, served from cache; accept delay.",
    "Wrap up: recommendations as a separate offline plus online system, idempotent transcode jobs with retries, monitoring."
   ],
   "deepDives": [
    "Transcoding pipeline: job DAG, chunk-level parallelism, retries, idempotency, priority for popular channels.",
    "View counting: dedupe, bot filtering, sharded counters vs stream aggregation, what the UI shows while counts settle.",
    "Sharding metadata: shard key, hot channels, resharding behind a proxy like Vitess.",
    "Recommendations: candidate generation vs ranking, embeddings, freshness for new uploads."
   ],
   "traps": [
    "Incrementing one database row per view; a viral video becomes a write hot spot.",
    "Transcoding synchronously inside the upload request.",
    "Letting playback traffic reach your origin instead of the CDN."
   ]
  },
  "sources": [
   {
    "t": "Reimagining video infrastructure to empower YouTube",
    "by": "YouTube Blog, 2021",
    "url": "https://blog.youtube/inside-youtube/new-era-video-infrastructure/"
   },
   {
    "t": "Case Study: YouTube and HTML5 Video",
    "by": "Google Developers",
    "url": "https://developers.google.com/media/pdf/Youtube-HTML5-VP9-Case-Study.pdf"
   },
   {
    "t": "Vitess history: born at YouTube",
    "by": "Vitess docs",
    "url": "https://vitess.io/docs/24.0/overview/history/"
   },
   {
    "t": "Deep Neural Networks for YouTube Recommendations",
    "by": "Covington, Adams, Sargin (RecSys 2016)",
    "url": "https://research.google/pubs/deep-neural-networks-for-youtube-recommendations/"
   },
   {
    "t": "Procella: Unifying serving and analytical data at YouTube",
    "by": "PVLDB, 2019",
    "url": "https://www.vldb.org/pvldb/vol12/p2022-chattopadhyay.pdf"
   },
   {
    "t": "A peek behind Colossus, Google's file system",
    "by": "Google Cloud Blog, 2021",
    "url": "https://cloud.google.com/blog/products/storage-data-transfer/a-peek-behind-colossus-googles-file-system"
   },
   {
    "t": "How YouTube uses Bigtable to power one of the world's largest streaming services",
    "by": "Google Cloud Blog, 2023",
    "url": "https://cloud.google.com/blog/products/databases/how-youtube-uses-bigtable-to-power-one-of-the-worlds-largest-streaming-services"
   }
  ]
 },
 {
  "id": "spotify",
  "name": "Spotify",
  "kind": "Music and podcast streaming",
  "tagline": "Audio files are small and cacheable, so the hard parts are instant playback on flaky mobile networks, offline listening, and a data pipeline that turns billions of listening events into royalties and personal playlists.",
  "scale": [
   "777M monthly active users and 300M Premium subscribers (Q2 2026).",
   "Before moving to Google Cloud: about 2,000 services, 20,000 daily data pipeline runs and 100+ PB of data (described in 2019).",
   "Q1 2019: event delivery peaked above 8M events per second across 500+ event types, over 350 TB of raw events a day.",
   "2010: median playback latency was 265 ms, and only 8.8% of played music data came from Spotify's servers.",
   "2015 launch of Discover Weekly: 100 million personal playlists refreshed every week."
  ],
  "requirements": {
   "functional": [
    "Search and browse tracks, podcasts and audiobooks.",
    "Stream audio with near-instant start and quick skips.",
    "Download for offline listening (Premium).",
    "Playlists and library synced across devices.",
    "Personal recommendations such as Discover Weekly.",
    "Count plays accurately for royalties."
   ],
   "nonFunctional": [
    "Playback starts in a few hundred ms with minimal stutter.",
    "Works on poor mobile networks and fully offline.",
    "Play events must not be lost; they drive royalties and key metrics.",
    "Hundreds of teams ship independently.",
    "Low delivery cost per stream."
   ]
  },
  "flow": [
   [
    "App",
    "desktop, mobile, web"
   ],
   [
    "Local cache",
    "cached or downloaded tracks first"
   ],
   [
    "Backend",
    "auth, rights, file lookup"
   ],
   [
    "CDN",
    "Akamai, AWS, Fastly edges"
   ],
   [
    "Player",
    "buffers, prefetches next track"
   ],
   [
    "Event delivery",
    "play events to Pub/Sub"
   ]
  ],
  "components": [
   {
    "name": "Audio CDN",
    "role": "Audio comes from commercial CDNs. A 2020 post describes a multi-CDN setup with Akamai and AWS for audio, plus years of Fastly use for audio streaming. A 2018 test of BBR congestion control on audio downloads cut stutter by 6-10%."
   },
   {
    "name": "Client cache and offline",
    "role": "Clients cache what they play; in 2010, 55.4% of played data came from the local cache. Premium users can download up to 10,000 tracks on each of up to 5 devices and must go online every 30 days so plays can be reported for artist payouts."
   },
   {
    "name": "Event delivery",
    "role": "Every client action emits an event. Starting in 2016, Spotify moved from a Kafka 0.7 and syslog pipeline to Google Cloud Pub/Sub; by 2019 each event type had its own topic and landed in hourly buckets in Cloud Storage, with BigQuery for analysis."
   },
   {
    "name": "Google Cloud Platform",
    "role": "After exploring options from early 2015, Spotify went all in on one provider. Traffic was fully on GCP by May 2017; the first of four on-premise data centers closed in December 2017 and the other three in 2018."
   },
   {
    "name": "Backstage",
    "role": "Internal developer portal with a software catalog, templates and docs, open-sourced in March 2020 and now a CNCF incubating project. At launch 280+ internal teams used it to manage 2,000+ backend services, 300+ websites and 4,000+ data pipelines."
   },
   {
    "name": "Discover Weekly pipeline",
    "role": "Batch job that builds a playlist of tracks new to you from listening logs, other users' playlists, text from the web and audio analysis, then filters out music you already play. By 2016 it ran on Cloud Bigtable and computed results several days ahead instead of all on Sunday."
   },
   {
    "name": "Squads and tribes",
    "role": "Small autonomous teams, designed to feel like mini-startups, grouped into tribes with chapters and guilds across them (2012 model). Squads choose their own tools, which a 2020 Spotify post names as a source of fragmentation."
   }
  ],
  "decisions": [
   {
    "title": "CDNs for audio instead of peer-to-peer",
    "why": "In 2010 the desktop app got most music data from peers and its own cache, which kept a startup's server bill low. By 2014 Spotify had enough servers that P2P added overhead plus a codebase to maintain, so it phased P2P out; audio now comes from CDNs.",
    "tradeoff": "CDN egress costs money per byte, and multi-CDN needs routing and monitoring. P2P was cheaper per byte but complex, never ran on mobile or web, and depended on peers being online."
   },
   {
    "title": "All in on one cloud",
    "why": "Spotify wanted engineers on product, not data centers. It chose one provider over multi-cloud or hybrid to get a deeper partnership and managed services such as Pub/Sub, Cloud Storage and BigQuery.",
    "tradeoff": "Lock-in and dependence on one vendor's roadmap. Spotify had to help Google close gaps (for example scalable VPN and IAM organization) and wrote its own Pub/Sub client libraries when the official ones could not keep up."
   },
   {
    "title": "Managed Pub/Sub instead of self-run Kafka",
    "why": "The Kafka 0.7 system counted an event as safe only once it reached Hadoop, so a Hadoop outage stalled delivery. In tests, Kafka 0.8 MirrorMaker dropped data between data centers. Cloud Pub/Sub kept undelivered messages for 7 days, delivered at least once, and passed a 2M events per second load test.",
    "tradeoff": "At-least-once delivery means duplicates, so a dedup step is needed downstream. Trusting a then-beta service run by another company was a risk they took only after heavy testing."
   },
   {
    "title": "Isolate event streams by type",
    "why": "Some events pay royalties; others fire over 1M times a second. A separate Pub/Sub topic and ETL per event type means a noisy or broken type cannot delay critical ones, and a late hour for one type does not block the others.",
    "tradeoff": "Hundreds of topics, jobs and schemas to manage; Spotify built automation that creates and tears down every resource per event type."
   },
   {
    "title": "Precompute weekly playlists",
    "why": "Discover Weekly changes once a week, so it needs no online model serving. Computing 100M playlists in batch keeps the read path trivial: fetch a stored list.",
    "tradeoff": "A big weekly run is fragile: a few months after the 2015 launch, one incident meant playlists did not update. Running days ahead leaves slack but makes results a little staler."
   }
  ],
  "whenNot": "Do not copy the org and platform layers: squads, tribes and Backstage solve coordination among thousands of engineers, not ten. A small product should use one CDN, a hosted queue or analytics service with a simple event schema, and popularity lists or basic collaborative filtering before building weekly per-user batch pipelines.",
  "lessons": [
   "Static media belongs on CDNs; the engineering effort goes into clients, data and recommendations.",
   "Separate event streams by business importance so critical data never waits behind noisy data.",
   "If a result only needs to change weekly, compute it in batch and serve it as stored data.",
   "Team autonomy without shared tooling fragments the stack; paved paths like Backstage pull it back together."
  ],
  "interview": {
   "ask": "Design a music streaming service like Spotify",
   "plan": [
    "Clarify: catalog size, DAU, offline support, free vs paid tiers, and how much of recommendations is in scope.",
    "Estimate: a 4-minute track at 160 kbps is under 5 MB; multiply by concurrent streams for egress, and by catalog size and quality levels for storage.",
    "APIs: search, get track (returns a signed CDN URL), playlist CRUD, report play events.",
    "Storage: audio files in object storage behind a CDN; catalog metadata in SQL with a cache; playlists keyed by playlist ID; library keyed by user ID.",
    "Playback: check the local cache, fetch the first seconds fast, prefetch the next track; offline downloads carry a license that expires.",
    "Events: client → collector → durable queue → hourly batches → royalties, analytics, recommendations.",
    "Recommendations: offline collaborative filtering over playlists and listens, results written to a key-value store and served as-is."
   ],
   "deepDives": [
    "Offline mode: encrypted downloads, device limits, periodic check-in to report plays and renew rights.",
    "Play counts for royalties: at-least-once delivery, dedupe by event ID, late events, hourly partitions.",
    "Playlist sync across devices and collaborators: versions and conflicts.",
    "Recommendation freshness: weekly batch vs streaming updates, cold start for new tracks and users."
   ],
   "traps": [
    "Streaming audio through application servers instead of a CDN.",
    "Treating play events as best-effort logs when they drive payments.",
    "Designing real-time model serving for a playlist that changes weekly."
   ]
  },
  "sources": [
   {
    "t": "Views From The Cloud: A History of Spotify's Journey to the Cloud, Part 1",
    "by": "Spotify Engineering, 2019",
    "url": "https://engineering.atspotify.com/2019/12/views-from-the-cloud-a-history-of-spotifys-journey-to-the-cloud-part-1-2"
   },
   {
    "t": "Spotify's Event Delivery: Life in the Cloud",
    "by": "Spotify Engineering, 2019",
    "url": "https://engineering.atspotify.com/2019/11/spotifys-event-delivery-life-in-the-cloud"
   },
   {
    "t": "How Spotify Aligned CDN Services for a Lightning Fast Streaming Experience",
    "by": "Spotify Engineering, 2020",
    "url": "https://engineering.atspotify.com/2020/02/how-spotify-aligned-cdn-services-for-a-lightning-fast-streaming-experience"
   },
   {
    "t": "Announcing Backstage",
    "by": "Backstage blog, 2020",
    "url": "https://backstage.io/blog/2020/03/16/announcing-backstage/"
   },
   {
    "t": "The Little Hack That Could: The Story of Spotify's Discover Weekly Recommendation Engine",
    "by": "IEEE Spectrum, 2016",
    "url": "https://spectrum.ieee.org/the-little-hack-that-could-the-story-of-spotifys-discover-weekly-recommendation-engine"
   },
   {
    "t": "Personalization at Spotify using Cassandra",
    "by": "Spotify Engineering, 2015",
    "url": "https://engineering.atspotify.com/2015/01/personalization-at-spotify-using-cassandra"
   },
   {
    "t": "Spotify's Event Delivery: The Road to the Cloud (Part II)",
    "by": "Spotify Engineering, 2016",
    "url": "https://engineering.atspotify.com/2016/03/spotifys-event-delivery-the-road-to-the-cloud-part-ii"
   }
  ]
 },
 {
  "id": "instagram",
  "name": "Instagram",
  "kind": "Photo and video social network",
  "tagline": "Billions of people post media and scroll ranked feeds, so the hard parts are sharding metadata, keeping caches correct across data centers and ranking, all on one large Python/Django codebase.",
  "scale": [
   "3 billion monthly active users (announced September 2025).",
   "2015: 400M monthly users, 40B photos and videos stored, over 1 million requests per second.",
   "2012: more than 25 photos and 90 likes per second when Postgres sharding began.",
   "2019: one Django monolith of several million lines, deployed about 100 times a day.",
   "Explore (2019): 65 billion features extracted and 90 million model predictions per second."
  ],
  "requirements": {
   "functional": [
    "Upload photos and videos with captions and tags.",
    "Follow accounts and read a ranked home feed.",
    "Like and comment, with visible counts.",
    "Explore, Stories and Reels recommendations.",
    "Profile grid of a user's posts, newest first."
   ],
   "nonFunctional": [
    "Read-heavy: feeds and counts are read far more than written.",
    "Low feed latency on mobile networks.",
    "Durable media served from a CDN.",
    "Survive the loss of a data center.",
    "Eventual consistency is fine for counts and feeds, but people should see their own post right away."
   ]
  },
  "flow": [
   [
    "App",
    "uploads photo and caption"
   ],
   [
    "Web tier",
    "stateless Django servers"
   ],
   [
    "Media storage",
    "photo file, CDN in front"
   ],
   [
    "Postgres shard",
    "metadata with 64-bit ID"
   ],
   [
    "Async workers",
    "feed fan-out, notifications"
   ],
   [
    "Feed",
    "ranked when viewer opens"
   ]
  ],
  "components": [
   {
    "name": "Django web tier",
    "role": "Stateless Python/Django servers behind load balancers; in 2011 there were 25+ on EC2 and the workload was CPU-bound. By 2019 the server was one monolith with a few thousand endpoints, deployed every 7 minutes."
   },
   {
    "name": "Sharded PostgreSQL",
    "role": "Users, media metadata and likes live in Postgres. Thousands of logical shards, each a Postgres schema, map onto far fewer physical servers, so adding capacity means moving whole logical shards, not re-bucketing rows."
   },
   {
    "name": "ID generation",
    "role": "A PL/pgSQL function in each shard builds 64-bit IDs: 41 bits of milliseconds since a custom epoch, 13 bits of logical shard ID and 10 bits of a per-table sequence (1,024 IDs per shard per millisecond). IDs sort by time and name their shard."
   },
   {
    "name": "Cassandra",
    "role": "Adopted in 2012 to replace Redis for fraud detection, Feed and the Direct inbox; by 2018 one of the largest deployments in the world. \"Rocksandra\" swapped in a RocksDB storage engine to avoid Java GC pauses and cut one cluster's P99 reads from 60 ms to 20 ms."
   },
   {
    "name": "Caches",
    "role": "Memcached in front of Postgres, and Redis for the main feed, activity feed and sessions in the early years (2011). With several data centers (2015), each region has its own cache, kept correct by invalidation entries that travel with database replication."
   },
   {
    "name": "Media storage and CDN",
    "role": "In 2011 photos went straight to Amazon S3 and were served through CloudFront. From 2013 Instagram moved off AWS onto Facebook's infrastructure."
   },
   {
    "name": "Async task queue",
    "role": "In 2011 about 200 Python workers took jobs from Gearman: feed fan-out, cross-posting and notifications. Uploads finish fast, and posting is as quick for a big account as for a new one."
   },
   {
    "name": "Ranking systems",
    "role": "Feed, Stories, Explore and Reels each have their own ranking. Feed ranks recent posts from followed accounts by predicted actions (time spent, comment, like, reshare, profile tap); Explore (2019) sources candidates with ig2vec account embeddings and ranks them in stages from 500 down to 25."
   }
  ],
  "decisions": [
   {
    "title": "Shard Postgres instead of moving to NoSQL",
    "why": "In 2012 the team looked at NoSQL options but chose to shard PostgreSQL: known tools, SQL, and many logical shards on few machines, so growth means moving shards between servers.",
    "tradeoff": "No cross-shard joins, and the app must know the shard for every query. Writes still go to one primary per shard; in the 2015 multi-region setup that meant cross-data-center writes."
   },
   {
    "title": "Generate IDs inside the database",
    "why": "They wanted 64-bit, time-sortable IDs without new moving parts. Twitter's Snowflake came closest, but it needed ZooKeeper and dedicated ID servers; a PL/pgSQL function per shard gives similar IDs.",
    "tradeoff": "The bit layout is permanent: 13 bits caps logical shards at 8,192, and 10 bits caps each shard at 1,024 IDs per millisecond. IDs also reveal when each item was created."
   },
   {
    "title": "Keep one Django monolith",
    "why": "As of 2019 Instagram had no plans to aggressively break up its server. It invested in linting, type checking (Pyre) and continuous deployment every 7 minutes instead.",
    "tradeoff": "Hundreds of engineers share one codebase, so tooling and test discipline must be strong. Teams cannot choose their own language or release on a separate schedule."
   },
   {
    "title": "Fan out work asynchronously",
    "why": "A post only has to store the photo and its metadata before returning. Feed fan-out, cross-posting and notifications run in background workers, so accounts with many followers post as fast as new ones (2011).",
    "tradeoff": "Followers see posts a little later, and queues need retries, monitoring and idempotent jobs."
   },
   {
    "title": "Rank the feed instead of time order",
    "why": "By 2016 people were missing 70% of all posts in Feed, including almost half from close connections. Ranking by predicted interest puts the posts people care about first.",
    "tradeoff": "Users lose a predictable order and ask where posts went, creators chase the algorithm, and it takes large ML infrastructure plus ongoing public explanation."
   },
   {
    "title": "Invalidate caches through the database",
    "why": "With one cache per data center, a comment written in one region would not reach another region's cache. In 2015 Instagram inserted a cache-invalidation entry into the same Postgres database as the write; replication carries it to each region, where a process clears the local cache.",
    "tradeoff": "Every invalidation forces a re-read from the database. Hot counters (likes on a celebrity's post) triggered many <code>count(*)</code> queries, so they denormalized counters and used memcache leases."
   }
  ],
  "whenNot": "Do not start with sharding, custom ID schemes or cross-region cache invalidation: one Postgres primary with replicas, a cache and a CDN in front of object storage carry a young app a long way. A chronological or simple engagement-sorted feed is fine until people follow enough accounts to miss posts.",
  "lessons": [
   "A boring stack (Postgres, memcached, a task queue) went very far once the data was sharded well.",
   "Design IDs early: time-sortable IDs that encode the shard remove a lookup on every read.",
   "Plan cache consistency before going multi-region; the database's replication stream is a good carrier for invalidations.",
   "A monolith can serve hundreds of engineers if tooling and deploys are fast."
  ],
  "interview": {
   "ask": "Design Instagram (photo sharing with a home feed)",
   "plan": [
    "Clarify: upload, follow, home feed, likes and comments; DAU, posts per day, average follows; ranked or chronological.",
    "Estimate: uploads per day x photo size for storage; feed reads per second vs posts per second (read-heavy).",
    "Upload: client sends the file to object storage with a pre-signed URL → metadata row with a time-sortable ID → async jobs for resizing and fan-out.",
    "Data model: users, posts, follows, likes; shard by user ID so each user's posts sit together; IDs that encode shard and time.",
    "Feed: fan-out on write to per-user feed lists in a cache for normal accounts, pull for huge accounts, then rank the candidates.",
    "Serving: CDN for media, cache for hot posts and counts, cursor pagination by ID.",
    "Wrap up: multi-region reads, cache invalidation, counters, monitoring."
   ],
   "deepDives": [
    "ID generation: Snowflake-style service vs database-generated vs UUID; sortability and shard routing.",
    "Feed generation: push vs pull, celebrity accounts, feed length caps.",
    "Like counts: denormalized counters, hot keys, cache stampede protection with leases.",
    "Media pipeline: resizing into several sizes, CDN caching, deletes."
   ],
   "traps": [
    "Storing images in the database or serving them through app servers.",
    "Building each feed with a big join across follows and posts at read time.",
    "Using <code>COUNT(*)</code> for like counts on hot posts."
   ]
  },
  "sources": [
   {
    "t": "What Powers Instagram: Hundreds of Instances, Dozens of Technologies",
    "by": "Instagram Engineering, 2011",
    "url": "https://instagram-engineering.com/what-powers-instagram-hundreds-of-instances-dozens-of-technologies-adf2e22da2ad"
   },
   {
    "t": "Sharding &amp; IDs at Instagram",
    "by": "Instagram Engineering, 2012",
    "url": "https://instagram-engineering.com/sharding-ids-at-instagram-1cf5a71e5a5c"
   },
   {
    "t": "Instagration Pt. 2: Scaling our infrastructure to multiple data centers",
    "by": "Instagram Engineering, 2015",
    "url": "https://instagram-engineering.com/instagration-pt-2-scaling-our-infrastructure-to-multiple-data-centers-5745cbad7834"
   },
   {
    "t": "Open-sourcing a 10x reduction in Apache Cassandra tail latency",
    "by": "Instagram Engineering, 2018",
    "url": "https://instagram-engineering.com/open-sourcing-a-10x-reduction-in-apache-cassandra-tail-latency-d64f86b43589"
   },
   {
    "t": "Shedding More Light on How Instagram Works",
    "by": "Instagram, 2021",
    "url": "https://about.instagram.com/blog/announcements/shedding-more-light-on-how-instagram-works"
   }
  ]
 },
 {
  "id": "x-timeline",
  "name": "X (Twitter) home timeline",
  "kind": "Social feed",
  "tagline": "One tweet may need to reach millions of followers within seconds while every timeline read must return in milliseconds, so the design is a constant trade between write amplification and read latency.",
  "scale": [
   "2012: 150M active users and 300K QPS of home timeline reads, served at 1 ms p50 and 4 ms p99.",
   "2012: about 400M tweets a day became 30B timeline deliveries a day; reaching 1M followers took 3.5 s at p50.",
   "2013: a record 143,199 tweets in one second, about 25x the 5,700 per second average.",
   "2023: the For You pipeline ran about 5 billion times a day, under 1.5 s on average, using 220 CPU-seconds per run."
  ],
  "requirements": {
   "functional": [
    "Post a tweet with text and media.",
    "Read the home timeline: tweets from followed accounts, plus recommended ones in the ranked For You feed.",
    "Follow and unfollow accounts.",
    "Page back through older tweets.",
    "See new tweets within seconds."
   ],
   "nonFunctional": [
    "Timeline reads in milliseconds; reads far outnumber writes.",
    "Tweets reach most followers within a few seconds.",
    "Absorb spikes many times the average during live events.",
    "High availability; timelines can be eventually consistent.",
    "Unique, roughly time-ordered IDs without a central counter."
   ]
  },
  "flow": [
   [
    "Write API",
    "tweet arrives"
   ],
   [
    "Snowflake",
    "assigns 64-bit ID"
   ],
   [
    "Tweet store",
    "persists tweet body"
   ],
   [
    "Fanout",
    "looks up followers"
   ],
   [
    "Redis timelines",
    "appends ID per follower"
   ],
   [
    "Timeline Service",
    "reads list, hydrates tweets"
   ]
  ],
  "components": [
   {
    "name": "Fanout service",
    "role": "For each new tweet, looks up the author's followers in the social graph (Flock) and inserts the tweet ID into each follower's cached home timeline, pipelining about 4,000 destinations at a time (2012). In 2023 Twitter said it had just stopped using this 12-year-old service for the For You feed."
   },
   {
    "name": "Redis timeline cache",
    "role": "Each active user's home timeline was a Redis list of entries (8-byte tweet ID, 4-byte bits field, 8-byte user ID), about 800 long and stored on 3 machines (2012 talk). <code>RPUSHX</code> appends only to timelines already cached, so inactive users cost no memory."
   },
   {
    "name": "Timeline Service and hydration",
    "role": "Reads the ID list from one Redis machine, then fetches tweet and user objects in parallel from services with their own caches (Tweetypie for tweets, Gizmoduck for users)."
   },
   {
    "name": "Snowflake",
    "role": "ID service from 2010: 41 bits of milliseconds since a custom epoch, 10 bits of machine ID, 12 bits of sequence. It targets at least 10k IDs per second per process with no coordination between machines, and IDs are k-sorted (time-ordered to within about a second)."
   },
   {
    "name": "Tweet storage",
    "role": "Tweets moved from a single-master MySQL setup partitioned by time to T-Bird, which hashes tweets across many MySQL databases through Gizzard (described in 2013). By 2017 Manhattan was the backend for Tweets, Direct Messages and accounts."
   },
   {
    "name": "Manhattan",
    "role": "Twitter's own multi-tenant key-value database (2014). Eventually consistent at its core because most uses favor availability; strong consistency (check-and-set through a consensus log) is opt-in, and storage engines are pluggable for batch-loaded, write-heavy and read-heavy data."
   },
   {
    "name": "For You pipeline (2023)",
    "role": "Home Mixer, built on the Scala Product Mixer framework, gathers about 1,500 candidates: half in-network (from a search index, ranked with a light model and Real Graph) and half out-of-network (SimClusters, GraphJet, embeddings). A neural network of about 48M parameters scores them, then filters apply rules such as author diversity and blocked accounts."
   }
  ],
  "decisions": [
   {
    "title": "Fan out on write for home timelines",
    "why": "In 2012 timeline reads (300K QPS) dwarfed new tweets (about 5K per second). Doing the work once per tweet turns every read into a fetch of a precomputed list; the talk contrasts O(n) write with O(1) read against O(1) write with O(n) read.",
    "tradeoff": "Write amplification: one tweet becomes as many inserts as the author has followers (30B deliveries a day in 2012). Timelines are only as fresh as the fan-out queue, and memory caps how many entries each user keeps."
   },
   {
    "title": "Treat huge accounts differently (hybrid fan-out)",
    "why": "Fan-out to tens of millions of followers is slow: the 2012 talk cited Lady Gaga's 31M followers and up to about 5 minutes to deliver. The slides sketch merging such an account's own timeline into a home timeline at read time, shifting work to reads for those users.",
    "tradeoff": "Reads get more complex (merge, sort and dedupe several sources) and you must pick a follower threshold. With slow fan-out, replies could arrive before the tweet they answer."
   },
   {
    "title": "Cache timelines only for active users",
    "why": "Memory is the limit. Appending only to timelines already in cache means users who have not logged in lately (within 30 days, in 2012) cost nothing; their timeline is rebuilt from the social graph and storage when they return.",
    "tradeoff": "The first load after a long absence is slow and hits storage hard, and a mass return, such as after an outage, can cause a rebuild storm."
   },
   {
    "title": "Uncoordinated, time-ordered 64-bit IDs",
    "why": "Once tweets were hash-sharded across many MySQL databases, MySQL auto-increment could no longer produce unique IDs. Snowflake machines issue IDs independently, IDs fit in 64 bits, and they sort roughly by time, so \"since this ID\" queries keep working.",
    "tradeoff": "Depends on clocks: Snowflake refuses to issue IDs if the clock runs backwards, order is fuzzy within about a second, and machine IDs must be assigned without collisions."
   },
   {
    "title": "Eventually consistent storage by default",
    "why": "Most Twitter use cases favored availability over consistency, so Manhattan is eventually consistent at its core, with strong consistency as an opt-in for the few operations that need it.",
    "tradeoff": "Needs background replica reconciliation, and teams must know which operations need the slower strongly consistent path."
   },
   {
    "title": "Rank a mixed candidate pool (2023 For You)",
    "why": "Recommended tweets from accounts you do not follow cannot be fanned out in advance. The pipeline pulls about 1,500 candidates from several sources, scores them all with one ranker, then applies product rules.",
    "tradeoff": "Heavy compute on every request (220 CPU-seconds per run in 2023) and much harder to explain or debug than a time-ordered list."
   }
  ],
  "whenNot": "Do not build a fan-out service, a Redis timeline cluster or a custom ID service for a small app: a pull query (recent posts from followed accounts, indexed by author and time, plus a cache) works well for a long time. Add fan-out on write only when timeline reads dominate, and keep a pull path for very large accounts from the start.",
  "lessons": [
   "Precompute where reads dominate, but plan an escape hatch for extreme fan-out.",
   "Store IDs in timelines and hydrate objects from caches; lists stay small and each object lives in one place.",
   "Cache only what active users need; rebuild the rest on demand.",
   "Architectures follow the product: the ranked For You feed retired the 12-year-old fan-out service in 2023."
  ],
  "interview": {
   "ask": "Design Twitter's home timeline",
   "plan": [
    "Clarify: home timeline only, or also search and notifications; chronological or ranked; DAU, tweets per day, average and maximum followers.",
    "Estimate: tweets per second vs timeline reads per second, and deliveries per second = tweets per second x average followers. This frames push vs pull.",
    "APIs and data: post tweet, get home timeline with a cursor; tweets, users and follows stores; Snowflake-style IDs.",
    "Write path: store the tweet → queue → fan-out workers look up followers → append the tweet ID to each follower's capped cached list.",
    "Read path: fetch the ID list → merge recent tweets from followed huge accounts (pull) → hydrate tweets and users from caches → return a page.",
    "Scale: shard timeline caches by user ID, replicate, rebuild cold timelines on demand, queue fan-out to absorb spikes.",
    "If ranked: candidate sources, a ranker and filters, with a latency budget per stage."
   ],
   "deepDives": [
    "Celebrity problem: push vs pull threshold, merge cost at read time, ordering and dedupe.",
    "Timeline cache: list of IDs, length cap, memory estimate, eviction for inactive users.",
    "ID generation: Snowflake bit layout, clock skew, why sortable IDs make pagination easy.",
    "Traffic spikes: queue fan-out, back-pressure, degrade by delaying fan-out rather than failing reads."
   ],
   "traps": [
    "Fan-out on write for every account, including ones with tens of millions of followers.",
    "Copying full tweet objects into every follower's timeline instead of IDs.",
    "Offset pagination on a list that changes every second; use ID cursors."
   ]
  },
  "sources": [
   {
    "t": "Timelines at Scale (QCon SF 2012)",
    "by": "Raffi Krikorian, InfoQ",
    "url": "https://www.infoq.com/presentations/Twitter-Timeline-Scalability/"
   },
   {
    "t": "New Tweets per second record, and how!",
    "by": "Twitter Engineering, 2013",
    "url": "https://blog.x.com/engineering/en_us/a/2013/new-tweets-per-second-record-and-how"
   },
   {
    "t": "Snowflake README (2010 branch)",
    "by": "Twitter on GitHub",
    "url": "https://github.com/twitter-archive/snowflake/tree/snowflake-2010"
   },
   {
    "t": "Manhattan, our real-time, multi-tenant distributed database for Twitter scale",
    "by": "Twitter Engineering, 2014",
    "url": "https://blog.x.com/engineering/en_us/a/2014/manhattan-our-real-time-multi-tenant-distributed-database-for-twitter-scale"
   },
   {
    "t": "Twitter's Recommendation Algorithm",
    "by": "Twitter Engineering, 2023",
    "url": "https://blog.x.com/engineering/en_us/topics/open-source/2023/twitter-recommendation-algorithm"
   },
   {
    "t": "The Infrastructure Behind Twitter: Scale",
    "by": "Twitter Engineering, 2017",
    "url": "https://blog.x.com/engineering/en_us/topics/infrastructure/2017/the-infrastructure-behind-twitter-scale"
   },
   {
    "t": "the-algorithm: source code for the X recommendation algorithm",
    "by": "Twitter on GitHub",
    "url": "https://github.com/twitter/the-algorithm"
   }
  ]
 },
 {
  "id": "dropbox",
  "name": "Dropbox",
  "kind": "File sync and storage",
  "tagline": "Hundreds of millions of machines must stay in sync with exabytes of stored data, where one sync bug can delete or corrupt someone's files and every edit should upload as few bytes as possible.",
  "scale": [
   "700M+ registered users and 18.08M paying users (Q4 2025 results).",
   "2016: 500M signups and 500 PB of user data, over 90% of it stored and served in-house (Magic Pocket) instead of on S3.",
   "Magic Pocket (2016): multi-exabyte, built from cells of about 50 PB raw, with storage servers holding over 1 PB each.",
   "Edgestore metadata store (2016): several trillion entries, millions of queries per second."
  ],
  "requirements": {
   "functional": [
    "Sync a folder across all of a user's devices automatically.",
    "Upload and download large files, resuming after failures.",
    "Share folders with other people and teams.",
    "Version history and restore of deleted files.",
    "Access files on the web and mobile, downloading on demand."
   ],
   "nonFunctional": [
    "Durability first: never lose or corrupt data.",
    "Send only new or changed data over the network.",
    "Changes show up on other devices within seconds.",
    "Correct under concurrent edits, moves and flaky networks.",
    "Low storage cost per byte at exabyte scale."
   ]
  },
  "flow": [
   [
    "Client",
    "detects change, splits file"
   ],
   [
    "Hashing",
    "4 MB blocks, SHA-256"
   ],
   [
    "Metaserver",
    "commit; replies need blocks"
   ],
   [
    "Blockserver",
    "uploads missing blocks only"
   ],
   [
    "Magic Pocket",
    "immutable block storage"
   ],
   [
    "Other clients",
    "notified, list, download"
   ]
  ],
  "components": [
   {
    "name": "Sync engine (Nucleus)",
    "role": "Desktop client that watches the folder, hashes files and reconciles local and remote state. Rewritten in Rust and shipped to all users in 2020, replacing the Python \"Sync Engine Classic\"; it tracks three trees (Remote, Local, Synced), with Synced acting as the merge base."
   },
   {
    "name": "Blocks and blocklists",
    "role": "Every file is split into 4 MB blocks hashed with SHA-256; the list of hashes, the blocklist, identifies the file's contents (described in 2014)."
   },
   {
    "name": "Metaserver and Server File Journal",
    "role": "Holds users, namespaces (a user's root folder or a shared folder) and an append-only journal where each row is one version of a file: namespace, path, blocklist. Clients commit blocklists here and list new rows with a cursor."
   },
   {
    "name": "Blockserver",
    "role": "Key-value store from block hash to encrypted contents, with no knowledge of users or files. A commit that references unknown blocks gets a \"need blocks\" reply, so clients upload only what is missing."
   },
   {
    "name": "Notification server",
    "role": "Idle clients hold a long-poll connection; when something changes they wake up and call list."
   },
   {
    "name": "Magic Pocket",
    "role": "In-house immutable block store that replaced S3 for most data. Blocks are grouped into 1 GB buckets, replicated and then erasure coded, kept in at least two US zones, and located through a Block Index on sharded MySQL."
   },
   {
    "name": "Edgestore",
    "role": "Metadata store on MySQL (InnoDB), started in late 2012 and inspired in part by Facebook's TAO. It models entities and associations (for example users and the folders they can access), caches reads, and is strongly consistent by default."
   }
  ],
  "decisions": [
   {
    "title": "Content-addressed 4 MB blocks",
    "why": "Hashing blocks lets the server answer \"which of these do you already have?\", so clients upload only missing blocks, downloads can reuse blocks already on disk, and a block's storage key never changes.",
    "tradeoff": "Fixed-size blocks shift when bytes are inserted early in a file, so a small edit can touch many blocks (Dropbox also used rsync to shrink transfers). Dedup must be tied to access checks: the 2014 commit protocol checks both that a hash is known and that the user has access."
   },
   {
    "title": "Separate metadata from block storage",
    "why": "Content is huge and never changes once written; metadata is small, relational and changes constantly. Magic Pocket stores immutable blocks and pushes all mutation up into the file journal, which keeps storage simple.",
    "tradeoff": "Two systems must agree: a commit must never point at missing blocks, and deleting data needs garbage collection of blocks nothing references."
   },
   {
    "title": "Leave S3 and build Magic Pocket",
    "why": "At hundreds of petabytes, owning the stack let Dropbox tune performance end to end and get better unit economics from custom hardware and software. Work began in 2013, and files were first served fully in-house in February 2015.",
    "tradeoff": "A multi-year project with custom hardware, a 24/7 operations team and durability that is now entirely your problem. Dropbox still used AWS where it made sense, for example storing data in Germany for European customers (2016)."
   },
   {
    "title": "Rewrite the sync engine in Rust",
    "why": "Sync Engine Classic had no stable file IDs, weak consistency guarantees and thread-based concurrency that made tests non-reproducible. Nucleus has a strongly consistent protocol, unique IDs, atomic moves and one deterministic control thread, so seeded random tests can replay any failure.",
    "tradeoff": "About four years of work while the old engine still needed care. Dropbox itself says a rewrite is usually a bad idea and only did it after working through a rewrite checklist."
   },
   {
    "title": "Long-poll notify, then pull by cursor",
    "why": "A notification only says \"something changed\"; the client then lists journal entries after its cursor. Because listing is cursor-based, a client that was offline catches up the same way.",
    "tradeoff": "Millions of open connections to hold, and a thundering herd when a big shared folder changes and every member lists at once."
   }
  ],
  "whenNot": "Do not build your own blob store: S3 or similar is cheaper and safer until you hold hundreds of petabytes. Skip custom block-level sync and dedup unless sync is the product; for most apps, uploading whole files to object storage with one metadata row per version is enough.",
  "lessons": [
   "Split big files into content-hashed blocks: dedup, resumable transfers and safe retries follow.",
   "Keep stored bytes immutable and put all mutation in a metadata log.",
   "In sync systems the data model (stable IDs, a merge base) decides correctness more than code quality does.",
   "Make concurrency deterministic so random tests can reproduce every failure from a seed."
  ],
  "interview": {
   "ask": "Design Dropbox (file sync and storage)",
   "plan": [
    "Clarify: max file size, devices per user, sharing, version history, offline edits, conflict policy.",
    "Estimate: users x average storage for total bytes; daily changed bytes for upload bandwidth.",
    "Client: file watcher, chunker, hasher, local database of synced state, upload and download queues.",
    "Upload: client sends the blocklist → metadata service returns missing hashes → client uploads those blocks (pre-signed URLs) → commit the new file version.",
    "Download: notification (long poll or WebSocket) → list changes since cursor → fetch missing blocks → rebuild the file.",
    "Storage: blocks in object storage keyed by hash; files, versions and namespaces in sharded SQL; a per-namespace journal with increasing IDs.",
    "Conflicts and sharing: detect concurrent edits by base version, keep both copies for the user to resolve; permissions per shared folder."
   ],
   "deepDives": [
    "Chunking: fixed vs content-defined chunks, block size trade-offs, dedup scope and privacy.",
    "Conflicts: base version checks, moves vs delete plus add, stable file IDs.",
    "Notifications at scale: long polling, many devices per user, thundering herd on shared folders.",
    "Durability: replication vs erasure coding, cross-region copies, garbage collection of unreferenced blocks."
   ],
   "traps": [
    "Re-uploading whole files on every change.",
    "Treating a move as delete plus add, which can lose or duplicate data under concurrency.",
    "Keeping file content and metadata in the same store."
   ]
  },
  "sources": [
   {
    "t": "Streaming File Synchronization",
    "by": "Dropbox Tech, 2014",
    "url": "https://dropbox.tech/infrastructure/streaming-file-synchronization"
   },
   {
    "t": "Scaling to exabytes and beyond",
    "by": "Dropbox Tech, 2016",
    "url": "https://dropbox.tech/infrastructure/magic-pocket-infrastructure"
   },
   {
    "t": "Inside the Magic Pocket",
    "by": "Dropbox Tech, 2016",
    "url": "https://dropbox.tech/infrastructure/inside-the-magic-pocket"
   },
   {
    "t": "Rewriting the heart of our sync engine",
    "by": "Dropbox Tech, 2020",
    "url": "https://dropbox.tech/infrastructure/rewriting-the-heart-of-our-sync-engine"
   },
   {
    "t": "Testing sync at Dropbox",
    "by": "Dropbox Tech, 2020",
    "url": "https://dropbox.tech/infrastructure/-testing-our-new-sync-engine"
   },
   {
    "t": "Dropbox traffic infrastructure: Edge network",
    "by": "Dropbox Tech, 2018",
    "url": "https://dropbox.tech/infrastructure/dropbox-traffic-infrastructure-edge-network"
   },
   {
    "t": "How we migrated Dropbox from Nginx to Envoy",
    "by": "Dropbox Tech, 2020",
    "url": "https://dropbox.tech/infrastructure/how-we-migrated-dropbox-from-nginx-to-envoy"
   },
   {
    "t": "(Re)Introducing Edgestore",
    "by": "Dropbox Tech, 2016",
    "url": "https://dropbox.tech/infrastructure/reintroducing-edgestore"
   }
  ]
 },
 {
  "id": "google-docs",
  "name": "Google Docs",
  "kind": "Real-time collaborative editor",
  "tagline": "Several people type into the same document at once over imperfect networks, and every copy must end up identical without locking anyone out or losing what each person meant.",
  "scale": [
   "Google Workspace: more than 3 billion users and 11 million paying customers (December 2025).",
   "Up to 100 open tabs or devices can edit one file at the same time (Docs help, 2026).",
   "One document holds up to 1.02 million characters (Drive help, 2026)."
  ],
  "requirements": {
   "functional": [
    "Several users edit the same document at the same time.",
    "Everyone sees others' changes character by character.",
    "Show who is in the document and where they are working.",
    "Version history and restore.",
    "Comments and suggestions.",
    "Edit offline and sync when back online."
   ],
   "nonFunctional": [
    "Local typing never waits for the network.",
    "All copies converge to the same content.",
    "Each person's intent survives overlapping edits.",
    "No acknowledged edit is ever lost.",
    "Remote changes appear in well under a second."
   ]
  },
  "flow": [
   [
    "Editor A",
    "types; applies change locally"
   ],
   [
    "Client queue",
    "one change in flight"
   ],
   [
    "Server",
    "transforms against newer revisions"
   ],
   [
    "Revision log",
    "appends next revision"
   ],
   [
    "Broadcast",
    "acks sender, sends others"
   ],
   [
    "Editor B",
    "transforms against own pending"
   ]
  ],
  "components": [
   {
    "name": "Change log",
    "role": "As described in 2010, the new editor stores a document as a log of changes (insert text, delete text, apply style), not as a file of characters. The document is rebuilt by replaying the log, and each change records the revision it was based on."
   },
   {
    "name": "Operational transformation",
    "role": "Rewrites a change so it keeps its meaning after concurrent changes. If someone inserted two characters at the start, a remote delete at positions 9-11 must shift by two. Done correctly, all editors converge once they have all changes."
   },
   {
    "name": "Central server",
    "role": "Puts all changes into one order: it transforms each incoming change against revisions the sender had not seen, appends it to the revision log, acknowledges the sender and sends it to everyone else. It keeps no per-client state, so its work per change does not grow with the number of editors."
   },
   {
    "name": "Client state",
    "role": "Each client tracks its last synced revision, changes not yet sent, the one change sent but not acknowledged, and its current view of the document. It applies its own edits at once and transforms incoming changes against its pending ones."
   },
   {
    "name": "Presence",
    "role": "Docs shows who is active in a file and lets you jump to a collaborator's location; version history shows each person's edits in their own color."
   },
   {
    "name": "Offline mode",
    "role": "In Chrome or Edge with the Google Docs Offline extension, recent files are saved on the device and can be created, viewed and edited without a connection, then synced."
   }
  ],
  "decisions": [
   {
    "title": "Store operations, not versions",
    "why": "The old editor merged by diffing versions. If one person bolds \"brown fox\" while another replaces \"fox\" with \"dog\", a diff cannot tell whether the result should be \"brown dog\" or \"brown fox dog\". Recording each change with the revision it saw keeps intent clear.",
    "tradeoff": "The log only grows, so loading a long-lived document needs snapshots or compaction. Every new operation type needs transform rules against every existing type."
   },
   {
    "title": "OT through a central server",
    "why": "One server gives every change a single global order (revision numbers), so each client only transforms against the server's history, not against every other client. Google Wave's OT design (2010) made the same choice to keep one state space on the server.",
    "tradeoff": "Every edit passes through the server that owns the document, so there is no peer-to-peer editing. Transform rules must cover every pair of operation types; a bug means copies silently diverge."
   },
   {
    "title": "One unacknowledged change per client",
    "why": "A client never has more than one change in flight; new edits wait in a pending list until the ack arrives. Each change it sends is therefore based on a revision the server knows.",
    "tradeoff": "Others see your edits in bursts about once per round trip instead of as a smooth stream; the Wave whitepaper names this as the price of a simpler server."
   },
   {
    "title": "Apply locally first",
    "why": "Edits appear instantly because the client applies them before the server confirms, so network speed never limits typing speed.",
    "tradeoff": "The client must rebase its pending edits whenever remote changes arrive, and the UI has to cope if a change fails and must be rolled back."
   },
   {
    "title": "OT with a server, not CRDTs",
    "why": "CRDTs merge concurrent changes automatically without any central server, which suits peer-to-peer and offline-first apps. crdt.tech notes that Google Docs, Trello and Figma instead route all communication between users through a server.",
    "tradeoff": "Text CRDTs typically carry per-character metadata (IDs, deletion markers), which costs memory. OT with a server is easier to reason about, but collaborators can only converge through that server."
   }
  ],
  "whenNot": "Do not write your own OT or CRDT engine for a notes app or a form. Use a proven library (for example Yjs or Automerge, both listed on crdt.tech) or simple per-field locking with last-writer-wins; character-level merging only pays off when many people type in the same text at once.",
  "lessons": [
   "Model edits as operations tagged with a base revision; intent survives concurrency and history comes for free.",
   "A single ordering point per document makes convergence simple; CRDTs remove that point at the cost of more metadata.",
   "Apply locally, reconcile later: perceived latency is what users feel.",
   "Keep the server free of per-client state so adding editors does not add work per change."
  ],
  "interview": {
   "ask": "Design Google Docs (real-time collaborative editing)",
   "plan": [
    "Clarify: plain or rich text, max concurrent editors, offline, and whether comments, history and permissions are in scope.",
    "Pick the model: operations with revision numbers; choose OT with a central server or a CRDT and explain why.",
    "Sessions: clients hold a WebSocket to the server that owns the document (route by document ID); that server orders operations.",
    "Write path: client applies the op locally and sends it with its base revision; the server transforms it against newer ops, appends it, acks it and broadcasts it.",
    "Storage: append-only op log per document plus periodic snapshots; load = latest snapshot + later ops.",
    "Presence: cursor and selection updates as short-lived messages, kept out of the durable log.",
    "Failure: shard documents across servers, rebuild a document's state from its log on failover, resend unacknowledged ops on reconnect."
   ],
   "deepDives": [
    "Transform functions for insert and delete, including ties at the same position.",
    "Offline edits: a long queue of ops transformed against everything committed meanwhile; when to fall back to keeping both versions.",
    "Hot documents: batching ops, capping editors (Docs limits editing to 100 open tabs or devices), read-only viewers.",
    "OT vs CRDT: server dependency, metadata overhead, offline-first design."
   ],
   "traps": [
    "Sending the whole document on each keystroke, or merging by diffing versions.",
    "Last-writer-wins on the whole document, which silently drops edits.",
    "Writing cursor movements into the permanent history."
   ]
  },
  "sources": [
   {
    "t": "What's different about the new Google Docs: Working together, even apart",
    "by": "Google Drive Blog, 2010",
    "url": "https://drive.googleblog.com/2010/09/whats-different-about-new-google-docs_21.html"
   },
   {
    "t": "What's different about the new Google Docs: Conflict resolution",
    "by": "Google Drive Blog, 2010",
    "url": "https://drive.googleblog.com/2010/09/whats-different-about-new-google-docs_22.html"
   },
   {
    "t": "What's different about the new Google Docs: Making collaboration fast",
    "by": "Google Drive Blog, 2010",
    "url": "https://drive.googleblog.com/2010/09/whats-different-about-new-google-docs.html"
   },
   {
    "t": "Google Wave Operational Transformation",
    "by": "Wang, Mah, Lassen (Google), 2010",
    "url": "https://svn.apache.org/repos/asf/incubator/wave/whitepapers/operational-transform/operational-transform.html"
   },
   {
    "t": "About CRDTs",
    "by": "crdt.tech",
    "url": "https://crdt.tech/"
   }
  ]
 }
]);
