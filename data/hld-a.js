window.HUB_HLD = window.HUB_HLD || {};
Object.assign(window.HUB_HLD, {
  netflix: {
    summary: `A control plane in AWS (Zuul, stateless microservices, EVCache, Cassandra) decides what a member can watch and which appliance serves it; Open Connect appliances in and near ISPs stream the bytes. Regions run active-active since 2013.`,
    layers: [
      { name: `Clients`, items: [[`TV, phone and web apps`, `browse, search, play`], [`Adaptive bitrate player`, `adapts to network conditions`]], why: `Only the device sees its real network, so the player picks each segment's bitrate itself, trading quality for fewer rebuffers at evening peak.` },
      { name: `Edge and CDN`, items: [[`Open Connect appliances (since 2011)`, `inside ISPs and at exchanges`], [`Nightly proactive fill`, `pre-positions likely-watched titles`], [`BGP sessions with ISPs`, `steer users to local OCAs`]], why: `Video is most of the traffic and the catalog is known in advance, so filling caches off-peak inside ISPs keeps bytes off backbone and transit links at evening peak.` },
      { name: `Load balancing`, items: [[`UltraDNS and Route53`, `geo-DNS to a region (2013)`], [`AWS Elastic Load Balancers`, `spread traffic across instances`], [`Ribbon with Eureka`, `client-side balancing, service discovery`]], why: `DNS picks each member's region, so evacuating a broken region means flipping records; Route53 sits under UltraDNS because its API changes fast. ELBs and Ribbon spread load within a region.` },
      { name: `API gateway`, items: [[`Zuul 2 (open-sourced 2018)`, `auth, routing, throttling, shedding`], [`Federated GraphQL (mobile, 2022)`, `one schema over domain services`], [`Falcor API (before 2022)`, `monolith run by one team`]], why: `One front door applies auth, routing and load shedding to every request. Federated GraphQL (mobile since 2022) lets domain teams own their part of one schema instead of one API team.` },
      { name: `Services`, items: [[`Playback services`, `auth, licensing, file choice`], [`Steering service`, `picks OCAs, returns URLs`], [`Domain Graph Services`, `teams own schema parts`], [`Chaos Monkey (2011)`, `kills instances in business hours`]], why: `Services keep no local state, so any instance, or any region, can serve a member; Chaos Monkey kills instances in business hours to keep that true.` },
      { name: `Caching`, items: [[`EVCache`, `memcached-based, in every region`], [`Replication Relay and Proxy`, `copy writes to other regions`]], why: `Most reads are member data where slight staleness is fine, so EVCache serves them from memory and replicates writes across regions asynchronously; failover traffic finds warm caches.` },
      { name: `Data stores`, items: [[`Cassandra`, `member data, replicated across regions`], [`Priam (2011)`, `automates Cassandra, backups to S3`]], why: `Cassandra accepts writes in every region and replicates asynchronously, favoring availability; throughput scaled linearly to 288 nodes in a 2011 test (1.1M writes per second).` },
      { name: `Async and streaming`, items: [[`Kafka (by 2016)`, `queues EVCache replication keys`], [`Amazon SQS (2013)`, `earlier cross-region cache invalidation`], [`Mantis`, `real-time event streaming`]], why: `Cross-region copies go through Kafka so a slow or failed region never blocks local writes; only keys travel, and relays fetch values from the local cache.` },
      { name: `Analytics and ML`, items: [[`Parallel chunked encoding`, `encodes chunks on cloud instances`], [`Per-title, shot-based encoding`, `ladder per title (2015), shot (2018)`], [`VMAF`, `perceptual quality score`], [`Recommendations`, `precomputed, cached in EVCache`]], why: `A title is encoded once but streamed millions of times, so compute that trims bits pays back on every view; shot-based encodes (2018) needed under half the bits at equal quality.` }
    ],
    edges: [
      [`TV, phone and web apps`, `UltraDNS and Route53`, `sync`, `geo-DNS lookup`],
      [`UltraDNS and Route53`, `AWS Elastic Load Balancers`, `sync`, `routes to`],
      [`AWS Elastic Load Balancers`, `Zuul 2 (open-sourced 2018)`, `sync`, `forwards`],
      [`Zuul 2 (open-sourced 2018)`, `Playback services`, `sync`, `play request`],
      [`Zuul 2 (open-sourced 2018)`, `Federated GraphQL (mobile, 2022)`, `sync`, `app queries`],
      [`Federated GraphQL (mobile, 2022)`, `Domain Graph Services`, `sync`, `sub-queries`],
      [`Playback services`, `Steering service`, `sync`, `pick OCAs`],
      [`Open Connect appliances (since 2011)`, `Steering service`, `async`, `health, routes, files`],
      [`Open Connect appliances (since 2011)`, `Adaptive bitrate player`, `stream`, `video segments`],
      [`Nightly proactive fill`, `Open Connect appliances (since 2011)`, `stream`, `off-peak fill`],
      [`Parallel chunked encoding`, `Nightly proactive fill`, `stream`, `encoded files`],
      [`Playback services`, `EVCache`, `data`, `member data`],
      [`Domain Graph Services`, `EVCache`, `data`, `member data`],
      [`Playback services`, `Cassandra`, `data`, `reads, writes`],
      [`EVCache`, `Kafka (by 2016)`, `async`, `replication keys`],
      [`Kafka (by 2016)`, `Replication Relay and Proxy`, `async`, `consume keys`],
      [`Replication Relay and Proxy`, `EVCache`, `repl`, `other regions`],
      [`Recommendations`, `EVCache`, `data`, `precomputed rows`]
    ],
    paths: [
      { name: `Press play`, nodes: [`TV, phone and web apps`, `UltraDNS and Route53`, `AWS Elastic Load Balancers`, `Zuul 2 (open-sourced 2018)`, `Playback services`, `Steering service`, `Open Connect appliances (since 2011)`, `Adaptive bitrate player`], note: `DNS and ELB lead to Zuul; playback services check plan and license, steering returns OCA URLs, and the player streams segments from one, often inside its own ISP.` },
      { name: `Update viewing history`, nodes: [`TV, phone and web apps`, `UltraDNS and Route53`, `AWS Elastic Load Balancers`, `Zuul 2 (open-sourced 2018)`, `Federated GraphQL (mobile, 2022)`, `Domain Graph Services`, `EVCache`, `Kafka (by 2016)`, `Replication Relay and Proxy`, `EVCache`], note: `The service writes the local EVCache; the EVCache library also puts the key on Kafka, and relays copy the value to other regions, so failover finds warm caches.` }
    ]
  },
  youtube: {
    summary: `Creators upload one file; YouTube transcodes it once into many renditions on custom chips. Viewers stream DASH segments from Google's edge, often from caches inside their ISP. Vitess, Spanner and Bigtable hold operational data; Procella and a two-stage recommender serve counts and suggestions.`,
    layers: [
      { name: `Clients`, items: [[`HTML5 player (since 2015)`, `Media Source Extensions, MPEG-DASH`], [`H.264 and VP9`, `VP9 cuts bytes per view`]], why: `Segments over plain HTTP cache anywhere and let the player switch quality between them; YouTube said in 2015 this cut buffering by over 50% globally.` },
      { name: `Edge and CDN`, items: [[`Google Global Cache`, `Google servers inside ISPs`], [`Edge points of presence`, `peer at 100+ facilities`], [`Traffic management`, `sends users to best node`]], why: `Locally popular videos are cached inside the viewer's ISP, and edge POPs peer directly with networks, cutting ISP costs and delay.` },
      { name: `Services`, items: [[`Upload service`, `stores the original durably`], [`Argos VCUs (described 2021)`, `transcoding chips, 20-33x efficiency`], [`Watch and metadata services`, `details not public`]], why: `Views vastly outnumber uploads, so encoding each rendition once pays off; VP9 needs about 5x the compute of H.264, which pushed YouTube to custom transcoding chips.` },
      { name: `Data stores`, items: [[`Vitess (since 2010)`, `VTGate proxy over sharded MySQL`], [`Spanner`, `operational database (2023 post)`], [`Bigtable`, `recommendation data, view metrics`]], why: `Vitess moved shard routing from app code into a proxy, so apps see one MySQL and resharding needs no rewrite; cross-shard queries stay costly.` },
      { name: `Object storage`, items: [[`Colossus`, `Google storage under YouTube (2021)`], [`Originals and renditions`, `layout details not public`]], why: `Keeping every rendition trades disk, even for long-tail videos nobody watches, for no encoding at view time; views vastly outnumber uploads, so the trade pays.` },
      { name: `Analytics and ML`, items: [[`Procella (2019 paper)`, `serves view and like counts`], [`Two-stage recommender (2016)`, `candidates, then watch-time ranking`], [`TensorFlow`, `trains the recommender models`], [`YouTube Data Warehouse`, `on Bigtable, feeds dashboards`]], why: `Updating one row per view makes a hot spot, so Procella sums in-memory rows (taking page stats over from Vitess); scoring millions of videos is too slow, so retrieval narrows first.` }
    ],
    edges: [
      [`HTML5 player (since 2015)`, `Watch and metadata services`, `sync`, `watch page`],
      [`Watch and metadata services`, `Vitess (since 2010)`, `data`, `video metadata`],
      [`Watch and metadata services`, `Procella (2019 paper)`, `sync`, `view counts`],
      [`Watch and metadata services`, `Two-stage recommender (2016)`, `sync`, `recommendations`],
      [`Two-stage recommender (2016)`, `Bigtable`, `data`, `watch history`],
      [`HTML5 player (since 2015)`, `Traffic management`, `sync`, `pick edge node`],
      [`Traffic management`, `Google Global Cache`, `sync`, `directs to`],
      [`Google Global Cache`, `HTML5 player (since 2015)`, `stream`, `DASH segments`],
      [`Edge points of presence`, `HTML5 player (since 2015)`, `stream`, `via peering`],
      [`Originals and renditions`, `Google Global Cache`, `stream`, `cache fill`],
      [`Upload service`, `Originals and renditions`, `stream`, `original file`],
      [`Argos VCUs (described 2021)`, `Originals and renditions`, `stream`, `transcode`],
      [`Upload service`, `Vitess (since 2010)`, `data`, `video metadata`],
      [`Procella (2019 paper)`, `Colossus`, `data`, `columnar data`],
      [`Spanner`, `YouTube Data Warehouse`, `repl`, `raw ingest`],
      [`YouTube Data Warehouse`, `Bigtable`, `data`, `stored in`]
    ],
    paths: [
      { name: `Watch a video`, nodes: [`HTML5 player (since 2015)`, `Watch and metadata services`, `Procella (2019 paper)`, `Watch and metadata services`, `HTML5 player (since 2015)`, `Traffic management`, `Google Global Cache`], note: `Services gather metadata, the Procella view count and recommendations; the player then streams DASH segments from the edge node that traffic management picks.` },
      { name: `Upload a video`, nodes: [`Upload service`, `Originals and renditions`, `Argos VCUs (described 2021)`], note: `The upload service stores the original durably, Argos VCUs transcode it into many resolutions and codecs, and renditions plus metadata are saved for playback.` }
    ]
  },
  spotify: {
    summary: `Clients play from a local cache first and stream the rest from commercial CDNs. Backend services run on Google Cloud (all traffic by 2017), and every client action becomes a Pub/Sub event feeding royalties, analytics and weekly batch recommendations.`,
    layers: [
      { name: `Clients`, items: [[`Desktop, mobile and web apps`, `cache tracks, prefetch the next`], [`Offline downloads`, `up to 10,000 tracks, 5 devices`]], why: `Listeners replay the same tracks, so a local cache (55.4% of played data in 2010) saves bandwidth and starts fast; offline devices check in every 30 days to report plays.` },
      { name: `Edge and CDN`, items: [[`Akamai and AWS`, `business-critical audio delivery (2020)`], [`Fastly`, `audio for years, company-wide CDN (2020)`], [`Peer-to-peer (phased out by 2014)`, `desktop peers shared cached tracks`]], why: `Audio is static and cacheable, so commercial CDNs deliver it. P2P cut early server bills, but by 2014 it was extra overhead and code, and never ran on mobile.` },
      { name: `Services`, items: [[`About 2,000 backend services`, `auth, rights, file lookup`], [`Apollo and Helios (2016)`, `service framework, orchestration`], [`Backstage (open-sourced 2020)`, `software catalog, templates, docs`]], why: `Hundreds of squads ship independently, so the backend is many small services; that autonomy fragmented tooling, which Backstage's catalog, templates and docs pull back together.` },
      { name: `Data stores`, items: [[`Cassandra (2015)`, `user profiles, entity metadata`], [`Cloud Bigtable (by 2016)`, `Discover Weekly data`], [`Cloud SQL (2019)`, `event delivery metadata`]], why: `Personal data needed low latency near users even at some cost to consistency, so Cassandra replicated it between EU and NA sites (2015); Discover Weekly moved to managed Cloud Bigtable.` },
      { name: `Object storage`, items: [[`Google Cloud Storage`, `hourly event buckets, datasets`]], why: `Each event type lands in its own immutable hourly bucket, so a late or broken type never blocks others, and downstream jobs read complete, fixed hours.` },
      { name: `Async and streaming`, items: [[`Event Service`, `validates events, publishes by type`], [`Cloud Pub/Sub (since 2016)`, `one topic per event type`], [`ETL on Compute Engine`, `cluster per type, Dataproc dedup`], [`Kafka 0.7 (retired 2017)`, `old pipeline into Hadoop`]], why: `Play events drive royalties, so none may be lost: Pub/Sub kept undelivered messages for 7 days, per-type topics isolate noisy events, and at-least-once delivery needs dedup.` },
      { name: `Analytics and ML`, items: [[`BigQuery`, `data warehouse for analysis`], [`Dataflow`, `encrypts sensitive event data`], [`Discover Weekly (2015)`, `100M playlists, batch, weekly`]], why: `Discover Weekly changes once a week, so a batch job computes 100M playlists days ahead and the app just reads a stored list; no online model serving needed.` }
    ],
    edges: [
      [`Desktop, mobile and web apps`, `About 2,000 backend services`, `sync`, `rights, file lookup`],
      [`Akamai and AWS`, `Desktop, mobile and web apps`, `stream`, `audio files`],
      [`Fastly`, `Desktop, mobile and web apps`, `stream`, `audio files`],
      [`Peer-to-peer (phased out by 2014)`, `Desktop, mobile and web apps`, `stream`, `until 2014`],
      [`Desktop, mobile and web apps`, `Offline downloads`, `data`, `saved tracks`],
      [`Desktop, mobile and web apps`, `Event Service`, `async`, `client events`],
      [`Event Service`, `Cloud Pub/Sub (since 2016)`, `async`, `topic per type`],
      [`Cloud Pub/Sub (since 2016)`, `ETL on Compute Engine`, `async`, `consume events`],
      [`ETL on Compute Engine`, `Google Cloud Storage`, `data`, `hourly buckets`],
      [`ETL on Compute Engine`, `Cloud SQL (2019)`, `data`, `ETL metadata`],
      [`Google Cloud Storage`, `BigQuery`, `data`, `event datasets`],
      [`Google Cloud Storage`, `Discover Weekly (2015)`, `data`, `listening logs`],
      [`Discover Weekly (2015)`, `Cloud Bigtable (by 2016)`, `data`, `weekly playlists`],
      [`About 2,000 backend services`, `Cassandra (2015)`, `data`, `user profiles`]
    ],
    paths: [
      { name: `Play a track`, nodes: [`Desktop, mobile and web apps`, `About 2,000 backend services`, `Desktop, mobile and web apps`, `Akamai and AWS`], note: `The app checks its local cache first; on a miss, backend services check rights and locate the file, and audio streams from a CDN while the next track prefetches.` },
      { name: `Log a play`, nodes: [`Desktop, mobile and web apps`, `Event Service`, `Cloud Pub/Sub (since 2016)`, `ETL on Compute Engine`, `Google Cloud Storage`, `BigQuery`], note: `The Event Service publishes the play to its type's Pub/Sub topic; ETL writes deduplicated hourly buckets to Cloud Storage for royalty, BigQuery and recommendation jobs.` }
    ]
  },
  instagram: {
    summary: `A stateless Python/Django monolith sits behind load balancers, with memcached over sharded PostgreSQL plus Cassandra. Photos live in object storage behind a CDN, async workers fan out posts, and separate ML rankers order Feed, Stories, Explore and Reels.`,
    layers: [
      { name: `Clients`, items: [[`iOS and Android apps`, `post media, read ranked feeds`]], why: `Most traffic is reads over mobile networks, so the app fetches feed pages from the web tier but loads images straight from the CDN.` },
      { name: `Edge and CDN`, items: [[`Amazon CloudFront (2011)`, `CDN for photos worldwide`], [`Facebook infrastructure (since 2013)`, `CDN details not public`]], why: `Photos never change once posted and are read many times, so a CDN caches them near users; in 2011 CloudFront sped up far markets like Japan.` },
      { name: `Load balancing`, items: [[`Amazon ELB (2011)`, `ends SSL, health-checks nginx`], [`nginx`, `3 instances behind ELB`], [`Amazon Route53`, `DNS`]], why: `DNS round-robin over 2 nginx boxes was slow to drop a dead box, so in 2011 ELB took over: failed health checks remove nginx instances automatically, and SSL ends at ELB.` },
      { name: `Services`, items: [[`Django monolith`, `Python, few thousand endpoints (2019)`], [`Gunicorn (2011)`, `WSGI server`], [`Continuous deployment`, `about every 7 minutes (2019)`]], why: `Stateless servers scale by adding machines. One monolith for hundreds of engineers works only with strong tooling: linting, Pyre type checks and deploys every 7 minutes (2019).` },
      { name: `Caching`, items: [[`Memcached`, `per-region cache over Postgres`], [`Redis (2011)`, `feed, activity feed, sessions`], [`PgQ invalidation (2015)`, `clears caches via replication`], [`Memcache leases`, `limit re-reads of hot keys`]], why: `Each region has its own cache, so a write in one region must clear the others: invalidation rows ride Postgres replication, and leases stop hot keys from flooding the database.` },
      { name: `Data stores`, items: [[`Sharded PostgreSQL`, `thousands of logical shards`], [`PL/pgSQL ID generator`, `64-bit IDs: time, shard, sequence`], [`Cassandra (since 2012)`, `feed, Direct inbox, fraud detection`], [`Rocksandra (2018)`, `RocksDB engine, fewer GC pauses`]], why: `Sharding Postgres kept known tools and SQL; many logical shards on few servers make growth a matter of moving shards, and IDs name their shard so reads route directly.` },
      { name: `Object storage`, items: [[`Amazon S3 (2011)`, `stored photo files`], [`Media storage (since 2013)`, `on Facebook infrastructure, not public`]], why: `Photos go straight to object storage while Postgres keeps only metadata, so media bytes never load the database and each scales separately.` },
      { name: `Async and streaming`, items: [[`Gearman (2011)`, `task queue, about 200 workers`], [`pyapns (2011)`, `push notifications`], [`Regional async tier (2015)`, `brokers and workers per region`]], why: `A post only has to store the photo and its row before returning; fan-out, sharing and notifications run in workers, so big accounts post as fast as new ones.` },
      { name: `Analytics and ML`, items: [[`Feed ranking`, `predicts time spent, likes, comments`], [`Explore (2019)`, `ig2vec candidates, staged 500 to 25`], [`Per-surface algorithms`, `Feed, Stories, Explore, Reels`]], why: `By 2016 people missed 70% of Feed posts, so feeds rank by predicted interest; each surface has its own algorithm because people seek friends in Stories but novelty in Explore.` }
    ],
    edges: [
      [`iOS and Android apps`, `Amazon Route53`, `sync`, `DNS lookup`],
      [`iOS and Android apps`, `Amazon ELB (2011)`, `sync`, `HTTPS requests`],
      [`Amazon ELB (2011)`, `nginx`, `sync`, `SSL terminated`],
      [`nginx`, `Gunicorn (2011)`, `sync`, `proxy`],
      [`Gunicorn (2011)`, `Django monolith`, `sync`, `WSGI calls`],
      [`Django monolith`, `Memcached`, `data`, `cached reads`],
      [`Django monolith`, `Redis (2011)`, `data`, `feeds, sessions`],
      [`Django monolith`, `Sharded PostgreSQL`, `data`, `users, media, likes`],
      [`Django monolith`, `Cassandra (since 2012)`, `data`, `feed, Direct`],
      [`Django monolith`, `Amazon S3 (2011)`, `stream`, `photo files`],
      [`Amazon S3 (2011)`, `Amazon CloudFront (2011)`, `stream`, `origin fetch`],
      [`Amazon CloudFront (2011)`, `iOS and Android apps`, `stream`, `photos`],
      [`Django monolith`, `Gearman (2011)`, `async`, `queue tasks`],
      [`Gearman (2011)`, `Redis (2011)`, `data`, `feed fan-out`],
      [`Sharded PostgreSQL`, `PgQ invalidation (2015)`, `repl`, `replicated rows`],
      [`PgQ invalidation (2015)`, `Memcached`, `data`, `invalidate keys`],
      [`Django monolith`, `Feed ranking`, `sync`, `rank candidates`],
      [`Django monolith`, `Regional async tier (2015)`, `async`, `region-local jobs`]
    ],
    paths: [
      { name: `Post a photo`, nodes: [`iOS and Android apps`, `Amazon ELB (2011)`, `nginx`, `Gunicorn (2011)`, `Django monolith`, `Amazon S3 (2011)`, `Django monolith`, `Sharded PostgreSQL`, `Django monolith`, `Gearman (2011)`], note: `Django stores the file in object storage and a metadata row with a shard-encoded ID in Postgres, returns, and leaves fan-out and notifications to async workers.` },
      { name: `Open home feed`, nodes: [`iOS and Android apps`, `Amazon ELB (2011)`, `nginx`, `Gunicorn (2011)`, `Django monolith`, `Memcached`, `Django monolith`, `Feed ranking`], note: `Django gathers recent posts from followed accounts via memcached, Postgres and Cassandra, rankers order them by predicted interest, and images load from the CDN.` }
    ]
  },
  'x-timeline': {
    summary: `JVM services store each tweet under a Snowflake ID; a fanout service pushed that ID into each active follower's Redis timeline, so reads were one list fetch plus hydration. Since 2023 For You ranks about 1,500 candidates per request.`,
    layers: [
      { name: `Clients`, items: [[`iOS, Android and web apps`, `ask for tweets since an ID`]], why: `Clients ask for tweets since a given ID, so IDs must sort by time without loading tweets; Snowflake's time-first bit layout makes that a number comparison.` },
      { name: `Edge and CDN`, items: [[`POPs on five continents`, `front-end servers end client sessions`], [`BGP Anycast`, `replaced GeoDNS for routing`], [`3,000+ network interconnects`, `direct peering worldwide`]], why: `Terminating client sessions near users cuts latency; GeoDNS guessed location from the user's DNS server, often wrongly, so Twitter moved to BGP Anycast (2017 post).` },
      { name: `Services`, items: [[`Write API`, `accepts and stores tweets`], [`Timeline Service`, `reads ID list, hydrates tweets`], [`Tweetypie and Gizmoduck`, `tweet and user objects`], [`Home Mixer (2023)`, `builds For You on Product Mixer`]], why: `Rails hosts served 200-300 requests per second; JVM services on Finagle reached 10-20K per host (2013), and calling services concurrently kept response times from adding up.` },
      { name: `Caching`, items: [[`Redis timeline lists (2012)`, `about 800 IDs per user`], [`Haplo (2017)`, `customized Redis timeline cache`], [`Twemcache and Nighthawk`, `cache users, tweets and more`]], why: `Reads outnumbered writes about 60 to 1 in 2012, so timelines are precomputed ID lists in memory; only active users' lists are kept, and inactive ones are rebuilt on return.` },
      { name: `Search`, items: [[`Earlybird search index`, `in-network candidates, about half`], [`Light ranker`, `scores posts inside Earlybird`]], why: `Pulling followed accounts' recent tweets from an index at read time avoids pushing each tweet into millions of cached timelines; it supplies about half of For You candidates.` },
      { name: `Data stores`, items: [[`Manhattan (since 2014)`, `tweets, DMs, accounts`], [`Flock`, `social graph, follower lookups`], [`T-Bird on MySQL (2013)`, `tweets hashed via Gizzard`]], why: `Most data favors availability, so Manhattan is eventually consistent at its core with opt-in strong consistency; tweets left time-partitioned single-master MySQL, which could not keep up with writes.` },
      { name: `Async and streaming`, items: [[`Fanout service`, `async push of IDs to followers`]], why: `Fan-out works once per tweet so each read is a list fetch, but one tweet becomes one insert per follower (30B a day, 2012); For You stopped using it in 2023.` },
      { name: `Coordination`, items: [[`Snowflake (since 2010)`, `64-bit time-sorted IDs`], [`Configured machine IDs`, `10 bits, up to 1,024 machines`], [`NTP and a clock guard`, `no IDs if clock runs back`]], why: `Sharded stores have no global auto-increment, so each Snowflake machine mints IDs from time plus its own configured ID; no runtime coordination, and IDs sort by time within about a second.` },
      { name: `Analytics and ML`, items: [[`SimClusters, TwHIN, GraphJet`, `out-of-network candidates`], [`Real Graph`, `predicts engagement between two users`], [`Heavy ranker`, `neural net, about 48M parameters`], [`Navi`, `model serving written in Rust`]], why: `Recommended tweets from accounts you do not follow cannot be pushed in advance, so each request scores about 1,500 candidates; the price is 220 CPU-seconds per run (2023).` }
    ],
    edges: [
      [`iOS, Android and web apps`, `Write API`, `sync`, `post tweet`],
      [`iOS, Android and web apps`, `Timeline Service`, `sync`, `read timeline`],
      [`iOS, Android and web apps`, `POPs on five continents`, `sync`, `client sessions`],
      [`POPs on five continents`, `Home Mixer (2023)`, `sync`, `For You request`],
      [`Write API`, `Snowflake (since 2010)`, `sync`, `new ID`],
      [`Write API`, `T-Bird on MySQL (2013)`, `data`, `store tweet`],
      [`Write API`, `Fanout service`, `async`, `new tweet`],
      [`Fanout service`, `Flock`, `data`, `followers`],
      [`Fanout service`, `Redis timeline lists (2012)`, `data`, `append IDs`],
      [`Timeline Service`, `Redis timeline lists (2012)`, `data`, `read ID list`],
      [`Timeline Service`, `Haplo (2017)`, `data`, `reads, writes`],
      [`Timeline Service`, `Tweetypie and Gizmoduck`, `sync`, `hydrate`],
      [`Tweetypie and Gizmoduck`, `Twemcache and Nighthawk`, `data`, `cached objects`],
      [`Tweetypie and Gizmoduck`, `Manhattan (since 2014)`, `data`, `tweets, accounts`],
      [`Home Mixer (2023)`, `Earlybird search index`, `sync`, `in-network candidates`],
      [`Earlybird search index`, `Light ranker`, `sync`, `score posts`],
      [`Home Mixer (2023)`, `SimClusters, TwHIN, GraphJet`, `sync`, `out-of-network`],
      [`Home Mixer (2023)`, `Heavy ranker`, `sync`, `score candidates`]
    ],
    paths: [
      { name: `Post a tweet (2012 fan-out)`, nodes: [`iOS, Android and web apps`, `Write API`, `Snowflake (since 2010)`, `Write API`, `T-Bird on MySQL (2013)`, `Write API`, `Fanout service`, `Flock`, `Fanout service`, `Redis timeline lists (2012)`], note: `The write API gets a Snowflake ID and stores the tweet; fanout then looks up followers in Flock and appends the ID to each cached Redis timeline.` },
      { name: `Open For You (2023)`, nodes: [`iOS, Android and web apps`, `POPs on five continents`, `Home Mixer (2023)`, `Earlybird search index`, `Home Mixer (2023)`, `SimClusters, TwHIN, GraphJet`, `Home Mixer (2023)`, `Heavy ranker`], note: `Home Mixer gathers about 1,500 candidates, half from the Earlybird index and half from SimClusters, GraphJet and embeddings, scores them with the heavy ranker, then filters.` }
    ]
  },
  dropbox: {
    summary: `Desktop clients split files into 4 MB SHA-256 blocks and upload only blocks the server lacks. Metadata lives in an append-only file journal and Edgestore (MySQL); block contents live in Magic Pocket, the in-house store that replaced S3 for most data.`,
    layers: [
      { name: `Clients`, items: [[`Nucleus sync engine`, `Rust, all users since 2020`], [`Block hasher`, `4 MB blocks, SHA-256 each`], [`Three trees`, `Remote, Local, Synced merge base`]], why: `Hashing on the device means only unknown blocks cross the network; Nucleus (2020) replaced Python Sync Engine Classic with stable file IDs and one deterministic thread, so seeded tests replay bugs.` },
      { name: `Edge and CDN`, items: [[`20 edge PoPs (2018)`, `end TCP and TLS near users`], [`GeoDNS`, `hands each user a nearby PoP`], [`Anycast`, `fallback for apex domains`]], why: `Nearby PoPs shorten TCP and TLS handshakes, which cuts time to first byte; the PoP then reuses keep-alive connections to data centers over Dropbox's backbone.` },
      { name: `Load balancing`, items: [[`IPVS`, `kernel L4 load balancer`], [`nginx, then Envoy (2020)`, `L7 proxy at the edge`]], why: `Envoy began replacing nginx as the L7 proxy around 2020: nginx's blocking disk IO hurt tail latency, it exposed few metrics, and internal APIs were moving to gRPC.` },
      { name: `Real-time connections`, items: [[`Notification server`, `long-poll held by idle clients`]], why: `A notification only says something changed; the client then lists journal rows after its cursor, so a client returning from offline catches up the same way.` },
      { name: `Services`, items: [[`Metaserver`, `commits blocklists, lists changes`], [`Blockserver`, `stores and serves blocks by hash`]], why: `Splitting commit from upload lets the metaserver answer which blocks it lacks, so clients send only those; the blockserver checks access before serving any block.` },
      { name: `Caching`, items: [[`Edgestore caches`, `partitioned, replicated read cache`]], why: `Edgestore is read-optimized, so partitioned caches serve lookups; being strongly consistent by default, it invalidates cache entries on writes, and clients that tolerate stale reads can ask for eventual consistency.` },
      { name: `Data stores`, items: [[`Server File Journal`, `append-only file versions`], [`Edgestore on MySQL (2012)`, `entities and associations`], [`Block Index`, `sharded MySQL: block to bucket`]], why: `Metadata is small, relational and changes constantly, so it stays in MySQL, which Dropbox already ran at scale; even Magic Pocket's Block Index chose sharded MySQL over a custom store.` },
      { name: `Object storage`, items: [[`Magic Pocket (since 2015)`, `in-house immutable block store`], [`1 GB buckets`, `replicated, then erasure coded`], [`Three US zones`, `each block in 2+ zones`], [`Amazon S3`, `earlier store; Germany data (2016)`]], why: `At hundreds of petabytes, owning storage improved unit economics; blocks never change, so replication, erasure coding and repair stay simple, and all mutation lives in the metadata layer.` }
    ],
    edges: [
      [`Nucleus sync engine`, `Block hasher`, `sync`, `hash blocks`],
      [`Nucleus sync engine`, `GeoDNS`, `sync`, `DNS lookup`],
      [`Nucleus sync engine`, `20 edge PoPs (2018)`, `sync`, `TCP, TLS`],
      [`20 edge PoPs (2018)`, `IPVS`, `sync`, `L4 balancing`],
      [`IPVS`, `nginx, then Envoy (2020)`, `sync`, `L7 proxy`],
      [`nginx, then Envoy (2020)`, `Metaserver`, `sync`, `over backbone`],
      [`nginx, then Envoy (2020)`, `Blockserver`, `stream`, `file blocks`],
      [`Metaserver`, `Blockserver`, `sync`, `internal RPC`],
      [`Metaserver`, `Server File Journal`, `data`, `commit, list`],
      [`Blockserver`, `Magic Pocket (since 2015)`, `stream`, `put, get blocks`],
      [`Magic Pocket (since 2015)`, `Block Index`, `data`, `block location`],
      [`Magic Pocket (since 2015)`, `1 GB buckets`, `data`, `block writes`],
      [`Magic Pocket (since 2015)`, `Three US zones`, `repl`, `cross-zone copies`],
      [`Amazon S3`, `Magic Pocket (since 2015)`, `repl`, `2015 migration`],
      [`Nucleus sync engine`, `Notification server`, `sync`, `long-poll`],
      [`Edgestore caches`, `Edgestore on MySQL (2012)`, `data`, `cache misses`]
    ],
    paths: [
      { name: `Upload a changed file`, nodes: [`Nucleus sync engine`, `20 edge PoPs (2018)`, `IPVS`, `nginx, then Envoy (2020)`, `Metaserver`, `Server File Journal`, `Metaserver`, `nginx, then Envoy (2020)`, `Blockserver`, `Magic Pocket (since 2015)`], note: `The client commits the new blocklist; the metaserver replies with the hashes it lacks, the client uploads only those blocks, then the retried commit adds a journal row.` },
      { name: `Sync to another device`, nodes: [`Notification server`, `Nucleus sync engine`, `20 edge PoPs (2018)`, `IPVS`, `nginx, then Envoy (2020)`, `Metaserver`, `Server File Journal`, `Metaserver`, `nginx, then Envoy (2020)`, `Blockserver`, `Magic Pocket (since 2015)`], note: `The idle client's long-poll returns; it lists journal rows after its cursor, downloads only blocks it does not already have, and rebuilds the file.` }
    ]
  },
  'google-docs': {
    summary: `Each editor applies its edits instantly and keeps one change in flight to a central server that owns the document. The server transforms it against newer revisions (operational transformation), appends it to the revision log and broadcasts it (design described 2010).`,
    layers: [
      { name: `Clients`, items: [[`Browser editor`, `applies own edits instantly`], [`Pending and sent lists`, `at most one change in flight`], [`Docs Offline extension`, `edit offline in Chrome, Edge`]], why: `Typing must never wait on the network, so edits apply locally first; holding one change in flight means every change sent is based on a revision the server knows.` },
      { name: `Real-time connections`, items: [[`Client-server channel`, `transport details not public`], [`Presence`, `who is active, and where`]], why: `Remote edits should appear well under a second, so each editor needs a two-way path to the document's server for sends, acks and broadcasts; Google has not published the transport.` },
      { name: `Services`, items: [[`Document server`, `orders changes, numbers revisions`], [`Operational transformation`, `rewrites changes against newer ones`], [`Unprocessed change list`, `received but not yet processed`], [`Ack and broadcast`, `ack sender, send to others`]], why: `One ordering point per document means clients transform only against the server's history; no per-client state means work per change stays flat as editors join.` },
      { name: `Data stores`, items: [[`Revision log`, `append-only list of changes`], [`Current document state`, `as of last processed change`], [`Storage technology`, `details not public`]], why: `A log of changes tagged with base revisions keeps each editor's intent where diffing versions cannot, and history comes free; the cost is a log that only grows.` },
      { name: `Coordination`, items: [[`One owner server per doc`, `assignment details not public`]], why: `Convergence needs one order per document, so every editor of a document must reach the same server; how Google assigns documents to servers is not public.` }
    ],
    edges: [
      [`Browser editor`, `Pending and sent lists`, `data`, `local edits`],
      [`Pending and sent lists`, `Client-server channel`, `sync`, `one change`],
      [`Client-server channel`, `One owner server per doc`, `sync`, `route by doc`],
      [`One owner server per doc`, `Document server`, `sync`, `owning server`],
      [`Document server`, `Unprocessed change list`, `async`, `queue change`],
      [`Unprocessed change list`, `Operational transformation`, `async`, `next change`],
      [`Operational transformation`, `Revision log`, `data`, `read, append`],
      [`Operational transformation`, `Current document state`, `data`, `apply change`],
      [`Revision log`, `Ack and broadcast`, `data`, `new revision`],
      [`Ack and broadcast`, `Client-server channel`, `async`, `ack, broadcast`],
      [`Presence`, `Browser editor`, `async`, `who is here`],
      [`Browser editor`, `Docs Offline extension`, `data`, `offline copies`]
    ],
    paths: [
      { name: `Type a character`, nodes: [`Browser editor`, `Pending and sent lists`, `Client-server channel`, `One owner server per doc`, `Document server`, `Unprocessed change list`, `Operational transformation`, `Revision log`, `Ack and broadcast`], note: `The edit shows at once; the client sends it with its base revision, the server transforms it against newer revisions, appends it, acks the sender and broadcasts it.` },
      { name: `Receive a remote edit`, nodes: [`Ack and broadcast`, `Client-server channel`, `Pending and sent lists`, `Browser editor`], note: `The server sends another editor's change; the client transforms it against its own pending and unacknowledged changes before applying, so every copy converges.` }
    ]
  }
});
