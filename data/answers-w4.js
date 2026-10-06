window.VAULT_ANSWERS = window.VAULT_ANSWERS || {};
Object.assign(window.VAULT_ANSWERS, {
  r1: {
    tldr: `Real traffic breaks systems through overload, slow or failing dependencies, resource exhaustion, bad data, bad changes, and infrastructure loss. Walk the request path, list how each hop can fail, and add detection and a mitigation for each.`,
    body: `<h4>Core idea</h4><p>Under real traffic, systems rarely fail with a clean crash. They fail partially, slowly, or by hurting themselves. A useful habit is to walk every hop of the request path and ask four questions. What if it is <strong>down</strong>? What if it is <strong>slow</strong>? What if it returns <strong>wrong data</strong>? What if traffic jumps <strong>10x</strong>? Slow is often worse than down: slow calls hold threads, connections, and memory while callers keep sending more.</p>
<h4>How to do it</h4><p>Learn the main families of failure:</p><ol>
<li><strong>Overload:</strong> traffic spikes, retry storms, cache expiry stampedes, queues growing faster than consumers drain them.</li>
<li><strong>Dependency failure:</strong> a database, cache, or third party that times out, returns 5xx, rate limits you, or fails on only some hosts.</li>
<li><strong>Resource exhaustion:</strong> connection pools, goroutines or threads, file descriptors, memory (OOM kills), disks full of logs, CPU throttling in containers.</li>
<li><strong>Bad data:</strong> poison messages that crash consumers, hot keys, unexpected nulls, huge payloads.</li>
<li><strong>Bad changes:</strong> deploys, config pushes, flag flips, library upgrades. Google's SRE book reports that roughly 70% of outages come from changes to a live system.</li>
<li><strong>Infrastructure:</strong> host, zone, or region loss, network partitions, packet loss, DNS failures.</li>
<li><strong>Expiry and time:</strong> TLS certificates, tokens, and domains that expire, clock skew, overlapping cron runs.</li>
<li><strong>Abuse:</strong> DDoS, credential stuffing, and in messaging, traffic pumping fraud.</li>
</ol><p>For each component, write one row: failure, how you detect it, blast radius, mitigation (timeout, retry, breaker, fallback, load shedding, failover).</p>
<h4>Trade-offs and pitfalls</h4><ul>
<li><strong>Gray failures</strong> are the hardest: health checks pass while real requests fail. Alert on user-facing success rate, not only on health checks.</li>
<li><strong>Metastable failures:</strong> a short blip triggers retries, the retries keep the system overloaded, and it stays down after the trigger is gone. Recovery needs load shedding or retry limits, not just restarts.</li>
<li>Correlated failures defeat redundancy. Replicas with the same bad config or the same expired cert fail together.</li>
<li>You cannot fix everything. Rank by likelihood times impact and fix the top few first.</li>
</ul>
<h4>Example</h4><p>OTP path: API → auth → rate limiter (Redis) → queue → sender worker → carrier → delivery receipt → customer webhook. Redis slow: every API call waits, so use a 50 ms timeout and a local fallback limit. Carrier slow: the worker pool fills and the queue grows, so alert on queue age and fail over to a backup route. Customer webhook down: retries pile up, so give each endpoint its own backoff and concurrency cap. Bad worker deploy: OTP success drops, so canary and auto-rollback. Traffic pumping: a sudden burst to premium number ranges, so per-account velocity limits.</p>`,
    followups: [
      `How would you detect a gray failure that your health checks miss?`,
      `What is a metastable failure, and how do you get a system out of one?`,
      `Which failure modes change when you move from one region to two?`
    ],
    related: ["r2", "c8", "o8"]
  },

  r2: {
    tldr: `Split features into critical and optional. Give every optional dependency a timeout and a fallback, shed low-priority load first, and add kill switches, so a partial failure removes extras instead of taking down the core path.`,
    body: `<h4>Core idea</h4><p>Graceful degradation means the system keeps doing its most important job while parts of it are broken, and gives up the extras first. This does not happen by accident. You decide in advance what is critical, what is optional, and what each piece does when a dependency fails.</p>
<h4>How to do it</h4><ol>
<li><strong>Classify dependencies.</strong> For each call on the request path, mark it hard (the request cannot succeed without it) or soft (nice to have). Try to turn hard dependencies into soft ones.</li>
<li><strong>Timeout plus fallback for every soft dependency:</strong> a stale cached value, a safe default, an empty section, or queue the work for later.</li>
<li><strong>Choose fail-open or fail-closed per check.</strong> A rate limiter whose Redis is down can fail open with a local per-instance limit. Auth and fraud checks usually fail closed.</li>
<li><strong>Shed load by priority.</strong> When saturated, reject low-priority work early with 429 or 503 and a Retry-After header, before it uses resources. Separate queues keep bulk traffic from starving urgent traffic.</li>
<li><strong>Kill switches:</strong> feature flags or config keys that turn off expensive features at runtime, without a deploy.</li>
<li><strong>Reduce fidelity:</strong> fewer results, coarser data, read-only mode, async instead of sync.</li>
<li><strong>Make it visible.</strong> Increment a metric every time a fallback fires, so degradation is never silent.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Fallback code runs rarely, so it rots. Test it with fault injection, or it will fail on the day you need it.</li>
<li>A fallback can overload something else. Cache down → every request hits the database → database down. Limit the fallback path too.</li>
<li>Stale data has a cost. A stale country list is harmless. A stale account balance can let customers overspend, so bound it (a small credit limit, then reconcile).</li>
<li>Many degradation modes make behavior hard to predict. Keep a short, documented list.</li>
</ul>
<h4>Example</h4><p>An SMS API during a partial outage. Critical: accept the message, persist it, send it. Optional: number lookup enrichment, analytics events, usage dashboard updates. If enrichment is slow, skip it after 100 ms and send anyway. If the analytics pipeline is down, buffer events in a queue and replay them later. If the platform is saturated, bulk marketing campaigns get 429s first, while OTP traffic keeps its own queue and workers because it is time-critical. Each fallback increments <code>degraded_requests_total{feature="enrichment"}</code>, so the dashboard shows exactly what is switched off.</p>`,
    followups: [
      `How do you decide whether a check should fail open or fail closed?`,
      `How would you test that a fallback path still works six months from now?`,
      `How do you shed load fairly across tenants while still protecting OTP traffic?`
    ],
    related: ["r4", "c7", "p4"]
  },

  r3: {
    tldr: `Retry only transient failures on idempotent operations, at one layer, with capped exponential backoff and full jitter, a small attempt limit, a retry budget, and a propagated deadline. Stop when the server tells you to.`,
    body: `<h4>Core idea</h4><p>Retries fix short blips but add load exactly when a dependency is struggling. If three layers each make 3 attempts, one user request can become 27 calls at the bottom. That is how a small slowdown becomes an outage that sustains itself. Good retries are rare, spread out in time, and bounded.</p>
<h4>How to do it</h4><ol>
<li><strong>Retry only what is safe.</strong> Timeouts, connection resets, 502, 503, 504, and 429. Never 400, 401, 404, or 422. Writes need an idempotency key so a retry cannot double-send.</li>
<li><strong>Capped exponential backoff with full jitter:</strong> sleep a random time between 0 and <code>min(cap, base * 2^attempt)</code>. Jitter spreads clients out so they do not retry in sync.</li>
<li><strong>Small attempt limits:</strong> 2-3 attempts for synchronous calls. Long schedules only for async work.</li>
<li><strong>Retry at one layer,</strong> usually the one closest to the failing dependency. Other layers fail fast.</li>
<li><strong>Retry budget:</strong> allow retries only while they stay a small share of traffic, for example 10%. gRPC retry throttling and Envoy's retry budget work on this idea.</li>
<li><strong>Propagate deadlines.</strong> Pass the remaining time downstream (Go context deadlines, gRPC deadlines). Skip the retry if another attempt cannot fit.</li>
<li><strong>Honor Retry-After</strong> and back off harder on 429.</li>
</ol>
<pre>// full jitter: random sleep in [0, min(maxDelay, base*2^attempt))
func backoff(attempt int) time.Duration {
    d := base * time.Duration(1&lt;&lt;attempt)
    if d &gt; maxDelay {
        d = maxDelay
    }
    return time.Duration(rand.Int63n(int64(d)))
}</pre>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Retrying non-idempotent calls without keys causes duplicates: two SMS, two charges.</li>
<li>Retry loops: A calls B calls A, or a consumer re-enqueues a failing message forever. Cap attempts and move poison messages to a dead-letter queue.</li>
<li>Retries hide problems. Count them and alert when the retry ratio climbs.</li>
<li>Pair retries with a circuit breaker, so you stop retrying a dependency that is clearly down.</li>
</ul>
<h4>Example</h4><p>Webhook delivery to customer servers. One customer's endpoint is down for an hour. A naive worker retries each event 5 times immediately, filling its pool with timeouts and delaying healthy customers. Better: one inline attempt with a 5 s timeout, then a delayed retry queue with a schedule like 30 s, 2 min, 10 min, 1 h, 6 h, each with jitter. Cap concurrency per endpoint so one dead endpoint cannot hog the workers. After about 24 hours, mark the event failed and let the customer replay it. Send the same event ID on every attempt so the customer can dedupe.</p>`,
    followups: [
      `Why is full jitter better than no jitter or a fixed jitter?`,
      `How would you implement a retry budget shared across many client instances?`,
      `How do idempotency keys handle a timeout where the first attempt actually succeeded?`
    ],
    related: ["c10", "a6", "r4"]
  },

  r4: {
    tldr: `A circuit breaker stops calling a dependency that keeps failing, so callers fail fast and the dependency can recover. A bulkhead caps the resources each dependency or tenant can use, so one slow part cannot drain the whole service.`,
    body: `<h4>Core idea</h4><p>Both patterns limit blast radius. A <strong>circuit breaker</strong> watches calls to one dependency. When failures cross a threshold, it stops sending traffic for a while and returns an error or fallback immediately. That frees your threads and gives the dependency room to recover. A <strong>bulkhead</strong> splits resources (connection pools, worker pools, queues) into compartments, so a slow dependency or noisy tenant fills only its own.</p>
<h4>How to do it</h4><p>Breaker states: <strong>closed</strong> (normal, outcomes tracked over a rolling window such as 10 s), <strong>open</strong> (fail fast for a cool-down such as 30 s), <strong>half-open</strong> (let a few trial calls through; success closes it, failure opens it again).</p><ol>
<li>Trip on <strong>failure rate with a minimum volume</strong>, for example over 50% failures across at least 20 calls. A raw count trips too easily at low traffic.</li>
<li>Count timeouts and slow calls as failures. Do not count client errors such as 400 or 404.</li>
<li>Scope breakers per dependency, and per destination when failures are local (per carrier, per host). One global breaker turns one bad host into a full outage.</li>
<li>Define the open-state behavior: cached data, a default, queue for later, or a clear 503.</li>
<li>Size bulkheads with Little's law: concurrency = throughput times latency. 200 req/s at 250 ms needs about 50 slots. Add headroom, then cap there.</li>
<li>In Go, a bulkhead can be a buffered channel or a <code>semaphore.Weighted</code> per dependency, with a short acquire timeout. Libraries: sony/gobreaker (Go), pybreaker (Python). At the proxy layer, Envoy outlier detection ejects bad hosts.</li>
<li>Export breaker state as a gauge and alert when a breaker stays open.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Too sensitive and the breaker flaps and causes errors by itself. Too lax and your pools fill before it trips.</li>
<li>Half-open without a cap on trial calls lets a burst hit a recovering service.</li>
<li>Decide whether retries count as separate failures, and be consistent, or the thresholds mean nothing.</li>
<li>Bulkheads waste capacity: an idle pool cannot lend slots to a busy one. Keep the number of pools small.</li>
</ul>
<h4>Example</h4><p>An SMS sender talks to three carriers. Carrier B starts timing out at 10 s. Without bulkheads, all 300 worker goroutines end up waiting on B, and traffic for A and C stalls too. With 100 workers per carrier, only B's traffic backs up. B's breaker opens after 60% of calls fail within 10 s, B's messages reroute to A where routing rules allow, and every 30 s a few probe sends test whether B has recovered.</p>`,
    followups: [
      `How do you pick breaker thresholds and cool-down times without past incident data?`,
      `Should the breaker live in the client library, a sidecar proxy, or the gateway, and why?`,
      `How would you isolate resources per tenant so one large customer cannot starve the rest?`
    ],
    related: ["r3", "c8", "r2"]
  },

  r5: {
    tldr: `Pick active-passive or active-active from your RPO and RTO. Keep compute stateless, replicate data deliberately, route with health-checked DNS or anycast, fence the old primary before promoting, and rehearse failover until it is boring.`,
    body: `<h4>Core idea</h4><p>Running compute in two regions is easy. The hard parts are data, routing, and the decision to fail over. Two numbers drive the design: <strong>RPO</strong>, how much recent data you can lose, and <strong>RTO</strong>, how long you can be down. Cross-region replication is usually asynchronous, so a region failover typically loses the last few seconds of writes. Decide per data type whether that is acceptable.</p>
<table><thead><tr><th>Strategy</th><th>Typical RPO / RTO</th><th>Cost</th></tr></thead><tbody>
<tr><td>Backup and restore</td><td>hours</td><td>lowest</td></tr>
<tr><td>Pilot light (data replicated, little compute)</td><td>tens of minutes</td><td>low</td></tr>
<tr><td>Warm standby (scaled-down full copy)</td><td>minutes</td><td>medium</td></tr>
<tr><td>Active-active</td><td>near zero</td><td>highest</td></tr>
</tbody></table>
<h4>How to do it</h4><ol>
<li><strong>Identical stateless compute per region,</strong> built from the same Terraform modules and image tags, so regions do not drift.</li>
<li><strong>Pick a write model.</strong> One writer region with replicas elsewhere is simplest, but failover needs a promotion. Or give each tenant a home region, so each account writes in one place. Avoid multiple writers on the same rows unless you accept conflict resolution.</li>
<li><strong>Routing.</strong> DNS failover with health checks (for example Route 53 failover records) and a 30-60 s TTL. Some clients ignore TTLs, so expect a tail. Anycast options like AWS Global Accelerator avoid DNS caching. For SIP, DNS SRV records with priorities give clients a built-in backup.</li>
<li><strong>Write the failover sequence:</strong> detect → decide → fence the old primary (block its writes) → promote the replica → shift traffic → verify → fail back later. Fencing prevents split brain, where both regions accept writes.</li>
<li><strong>Capacity.</strong> Survivors must absorb the failed region's load. With two active regions, keep each under about 50% of its limit, or accept load shedding while you scale.</li>
<li><strong>Hunt hidden single-region dependencies:</strong> CI/CD, container registry, secrets, Consul servers, S3 buckets, Terraform state, partner IP allowlists.</li>
<li><strong>Rehearse</strong> on a schedule and measure the real RTO.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Fully automated failover on a flaky health check causes flapping. A common split: automate the traffic shift, keep a human decision for promoting the database.</li>
<li>Active-active roughly doubles cost and forces you to handle conflicts and globally unique IDs.</li>
<li>Synchronous cross-region calls on the hot path add tens to hundreds of milliseconds per round trip and tie the regions' fates together.</li>
<li>A standby that never takes traffic rots. Send it a small share of real traffic.</li>
</ul>
<h4>Example</h4><p>A voice platform runs call control in two regions, with each account homed in one. Region A fails. Health-checked DNS and SIP SRV records steer new calls to region B within a minute or two. Calls in progress on A usually drop, because live media sessions do not move between regions. B promotes its replica of A's account data, accepts a few seconds of lost call records (flagged and reconciled later), and scales up media servers. Failback happens days later, after a full resync, during low traffic.</p>`,
    followups: [
      `How do you prevent split brain when the old primary region comes back online?`,
      `How would you handle idempotency keys and ID generation across two active regions?`,
      `Which parts of failover would you automate, and which would you leave to a human?`
    ],
    related: ["r6", "t7", "t8"]
  },

  r6: {
    tldr: `Treat a data center (availability zone) as a unit that will fail. Spread every tier across three zones, pre-provision spare capacity so survivors absorb the load without scaling, keep quorums intact, and practice draining a zone.`,
    body: `<h4>Core idea</h4><p>In cloud terms, a data center is roughly an availability zone (AZ). Losing one should be a non-event for users. The guiding principle is <strong>static stability</strong>: when a zone fails, the system keeps working with what is already running. It should not need to launch instances, change config, or call a control plane that may itself be struggling during the event.</p>
<h4>How to do it</h4><ol>
<li><strong>Write down scenarios and expected behavior:</strong> one host dies, a zone goes dark, a zone is degraded (packet loss, slow disks), zones cannot reach each other, a whole region fails, a shared provider (DNS, a carrier) fails.</li>
<li><strong>Spread every tier across 3 zones:</strong> load balancers, app instances, queues, caches, databases.</li>
<li><strong>Pre-provision spare capacity.</strong> Losing one of 3 zones moves its third of the load onto the other two. To stay at or under 100% afterwards, each zone must normally run below about 66%. Aim for 50-55% to keep headroom.</li>
<li><strong>Keep quorums intact.</strong> Raft-style clusters (Consul servers, etcd, Kafka controllers) need a majority. Three nodes, one per zone, survive losing any one zone. With only 2 zones, there is always one zone whose loss breaks quorum.</li>
<li><strong>Database failover.</strong> A synchronous standby in another zone (for example RDS Multi-AZ) fails over automatically, typically in 1-2 minutes. Apps must reconnect and re-resolve DNS instead of holding on to the old IP.</li>
<li><strong>Plan for gray zones.</strong> A half-broken zone is worse than a dead one, because health checks may still pass. Have a tested way to drain a zone on purpose, such as an AWS zonal shift on load balancers, or removing the zone from service discovery.</li>
<li><strong>Prefer zone-local calls with remote fallback.</strong> Cross-zone calls add latency and transfer cost, but strict zone-local routing strands clients inside a sick zone.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Idle headroom costs money. That is the price of static stability. Autoscaling during a zone outage may fail, because everyone else in the region is scaling too.</li>
<li>Single-zone resources hide everywhere: one NAT gateway, one Redis primary without a replica, a stateful box on a single EBS volume.</li>
<li>Failing over the database but not the cache or queue leaves the app half-working.</li>
<li>Untested zone failover is a guess. Schedule drills.</li>
</ul>
<h4>Example</h4><p>An SMS platform runs its API and workers in 3 zones at 50% utilization, Kafka with replication factor 3 and <code>min.insync.replicas=2</code>, and Multi-AZ Postgres. Zone C loses power. Load balancers stop routing to C's targets once health checks fail. API and workers in A and B go from 50% to 75% load, with no scaling needed. Kafka moves partition leadership from C's brokers to A and B, and producers using <code>acks=all</code> keep writing because 2 in-sync replicas remain. If the database primary was in C, the standby takes over, and the app sees errors for a minute or two, which retries and the queue absorb. Carrier connections from C drop, so senders in A and B must already hold enough connections to cover the lost third.</p>`,
    followups: [
      `What is static stability, and how would you test that your system has it?`,
      `How do you detect and handle a zone that is degraded but not fully down?`,
      `How does losing one zone affect a quorum-based system like Consul or Kafka?`
    ],
    related: ["r5", "r9", "o8"]
  },

  r7: {
    tldr: `Use expand/contract: add the new schema alongside the old, ship code that handles both, backfill in batches, switch reads, then drop the old parts later. Use online DDL and short lock timeouts so no step blocks traffic.`,
    body: `<h4>Core idea</h4><p>During a rolling deploy, old and new versions of your code run at the same time against one database. So every schema change must work with both. Never make a breaking change in one step. Split it into small compatible steps, known as <strong>expand/contract</strong>. The second danger is locking: some DDL locks the whole table, and on a busy table that is an outage.</p>
<h4>How to do it</h4><p>Renaming <code>phone</code> to <code>phone_e164</code>, as separate deploys:</p><ol>
<li><strong>Expand:</strong> add <code>phone_e164</code> as nullable. No code reads it yet.</li>
<li><strong>Dual write:</strong> ship code that writes both columns and still reads the old one.</li>
<li><strong>Backfill</strong> old rows in batches of 1,000-5,000 by primary key, pausing between batches and watching replica lag.</li>
<li><strong>Switch reads</strong> to the new column, ideally behind a feature flag so you can flip back.</li>
<li><strong>Stop writing</strong> the old column.</li>
<li><strong>Contract:</strong> drop the old column in a later release, once the rollback window has passed.</li>
</ol><p>Postgres techniques that avoid long locks:</p><ul>
<li><code>CREATE INDEX CONCURRENTLY</code> builds without blocking writes. It cannot run inside a transaction, and a failed build leaves an INVALID index to drop and retry.</li>
<li>NOT NULL: add <code>CHECK (col IS NOT NULL) NOT VALID</code>, then <code>VALIDATE CONSTRAINT</code>, which does not block reads or writes. On Postgres 12+, a later <code>SET NOT NULL</code> uses that constraint and skips the full table scan.</li>
<li>Foreign keys: add as <code>NOT VALID</code>, validate separately.</li>
<li>Set <code>lock_timeout</code> (for example 3 s) in every migration. An ALTER waiting for its lock makes every later query on that table queue behind it. Failing and retrying beats freezing the table.</li>
<li>Type changes like int to bigint rewrite the table. Do them as a new column plus backfill.</li>
</ul><p>On MySQL, use online DDL (<code>ALGORITHM=INSTANT</code> or <code>INPLACE</code>) where supported, or gh-ost or pt-online-schema-change for big tables.</p>
<h4>Trade-offs and pitfalls</h4><ul>
<li>It takes several deploys over days. That is the price of zero downtime.</li>
<li>Dropping a column while any code still selects it breaks that code. Check every consumer first, including reports and ETL jobs.</li>
<li>Running migrations at app startup in every pod causes races. Run them once, as a separate pipeline step, with a tool like goose, Alembic, or Flyway.</li>
<li>Down migrations are often unsafe once new data exists. Prefer fixing forward.</li>
<li>Test on a production-sized copy. A migration that takes 50 ms in staging can take 40 minutes in production.</li>
</ul>
<h4>Example</h4><p>A message log table has 2 billion rows, and a customer-facing search needs an index on <code>(account_id, created_at)</code>. A plain <code>CREATE INDEX</code> blocks inserts for the whole build, so message sends would hang. Instead, run <code>CREATE INDEX CONCURRENTLY</code> off-peak from a session with <code>statement_timeout</code> disabled, while watching I/O and replica lag. Ship the query that depends on the index only after the build finishes and the index is marked valid.</p>`,
    followups: [
      `How would you backfill a new column on a 2-billion-row table without hurting production?`,
      `How do you change a schema when another team's service reads your table directly?`,
      `Why can an ALTER TABLE cause an outage even when the statement itself is fast?`
    ],
    related: ["d10", "d9", "r8"]
  },

  r8: {
    tldr: `Make every release reversible in minutes: immutable versioned artifacts, backward-compatible schema and data changes, canaries with automated rollback on SLO signals, and feature flags that turn off new behavior without a deploy. Roll back first, debug later.`,
    body: `<h4>Core idea</h4><p>A rollback plan is decided before the release, not during the incident. The goal: any release can be undone in minutes by someone who did not write it. That needs three things. The previous version still exists. The previous version still works with current data and schema. And you detect the problem fast, ideally automatically.</p>
<h4>How to do it</h4><ol>
<li><strong>Immutable artifacts.</strong> Tag images by git SHA or version, and never deploy <code>latest</code>. Rollback means redeploying the last known-good tag with one Jenkins job (or <code>kubectl rollout undo</code> on Kubernetes).</li>
<li><strong>Separate deploy from release.</strong> Ship new code dark behind a feature flag. Turning the flag off is the fastest rollback there is.</li>
<li><strong>Backward-compatible schema changes</strong> (expand/contract), so rolling back code never needs a schema rollback.</li>
<li><strong>Forward-compatible data.</strong> Old code must tolerate what new code writes: unknown enum values, new JSON fields, new queue message formats.</li>
<li><strong>Progressive rollout:</strong> canary on one host or 1-5% of traffic, bake for 10-30 minutes, then 25%, 50%, 100%. Compare canary against baseline on error ratio, p99 latency, and saturation. Argo Rollouts and Flagger automate this. A Jenkins pipeline can do it too by querying Prometheus between stages.</li>
<li><strong>Automatic abort rules,</strong> for example: canary 5xx ratio above 2x baseline, p99 up more than 20%, or crash loops → roll back and notify.</li>
<li><strong>Config is code.</strong> Keep config in git and push it through a pipeline, so a bad Consul value is one revert away.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Some effects cannot be undone: SMS already sent, webhooks delivered, customers charged. Use flags and slow rollouts there, and plan compensating actions.</li>
<li>Destructive migrations (drop column, rewrite data) remove the option to roll back. Delay them until the release has proven itself.</li>
<li>Lockstep releases across services are fragile. Make each service work with both old and new versions of its neighbors.</li>
<li>Fixing forward under pressure often makes things worse. Default rule: if in doubt, roll back.</li>
<li>Unpracticed rollbacks fail. Roll back a harmless release on purpose now and then.</li>
</ul>
<h4>Example</h4><p>A new SMS worker version writes a new delivery status, <code>queued_at_carrier</code>. The canary's own metrics look fine, but old workers crash when they pick up those rows for retries. Rolling back the canary does not help, because the rows are already in the database. The fix is ordering: first ship a release in which every reader tolerates unknown statuses, then ship the writer behind a flag. Now turning off the flag, or a full rollback, is safe.</p>`,
    followups: [
      `What do you do when a release has side effects that a rollback cannot undo?`,
      `How would you choose canary metrics and thresholds for automated rollback?`,
      `How do feature flags change your rollback strategy, and what new risks do they add?`
    ],
    related: ["r7", "e8", "h8"]
  },

  r9: {
    tldr: `Everything that is not data should be code in git: infrastructure (Terraform), config, pipelines, dashboards. Data needs isolated, immutable, tested backups in another account and region. Then rehearse a full rebuild and time it.`,
    body: `<h4>Core idea</h4><p>Split the system into two kinds of things. <strong>Reproducible things</strong> (networks, servers, config, pipelines, dashboards) must be rebuildable from git with no manual steps. <strong>Irreplaceable things</strong> (databases, object storage, secrets, customer settings) need backups that survive the same disaster that hit production, including a deleted cloud account, ransomware, or a stolen admin credential. The plan only counts once you have actually run it.</p>
<h4>How to do it</h4><ol>
<li><strong>Infrastructure as code.</strong> Every VPC, IAM role, database, queue, and DNS record lives in Terraform. No console-only changes. Keep Terraform state in a versioned S3 bucket, with a copy in another region.</li>
<li><strong>Config and secrets.</strong> Consul KV content comes from git, not hand edits. Secrets live in a secrets manager with a tested export or replication path.</li>
<li><strong>Artifacts.</strong> Images and packages in a registry replicated to a second region. Pin versions, so a rebuild reproduces what ran, not whatever is newest.</li>
<li><strong>Your tooling too.</strong> Jenkinsfiles in repos, Prometheus rules and Grafana dashboards as files in git, alert routing as code. After a disaster you need your tooling first.</li>
<li><strong>Backups by the 3-2-1 rule:</strong> 3 copies, 2 kinds of storage, 1 off-site. Keep copies in a separate AWS account with immutability (S3 Object Lock or AWS Backup Vault Lock), so the credential that can delete production cannot delete the backups.</li>
<li><strong>Know your RPO.</strong> Nightly snapshots can lose up to 24 hours. RDS point-in-time recovery restores to within about 5 minutes of the failure, with retention of up to 35 days.</li>
<li><strong>Document the bootstrap order:</strong> account and network → IAM → secrets → data stores → service discovery → services → DNS and traffic. Call out chicken-and-egg steps, like the Terraform state bucket and the CI server itself.</li>
<li><strong>Restore drills.</strong> Regularly restore into a fresh account, verify with row counts and checksums, and time it. That time is your real RTO.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>A backup that was never restored is a hope. Common surprises: missing encryption keys, a restore that takes 10 hours, a dump that silently skipped a schema.</li>
<li>External state is easy to forget: carrier connection settings, partner IP allowlists, DNS registrar access, TLS certificates, number routing held by third parties.</li>
<li>Runbooks stored only on the infrastructure that died are useless. Keep a copy elsewhere.</li>
<li>Full drills cost engineer time. Start with one service per quarter.</li>
</ul>
<h4>Example</h4><p>A rebuild drill for a messaging service: create an empty AWS account, run <code>terraform apply</code> for the network and data layers, restore Postgres from the backup account to a point in time, load Consul config from git, deploy pinned image tags through Jenkins, and send a test SMS through a sandbox carrier. The first run usually exposes gaps, like a hardcoded account ID or a secret that only existed on one engineer's laptop. Fix each gap in code and repeat until the rebuild is a checklist anyone can run.</p>`,
    followups: [
      `How would you protect backups from an attacker who holds production admin credentials?`,
      `In what order would you rebuild services, and which circular dependencies do you expect?`,
      `How do you verify that a restored database is actually complete and correct?`
    ],
    related: ["r6", "r5", "o7"]
  },

  r10: {
    tldr: `Pick a few SLIs that reflect what users feel (good events over valid events), set SLO targets below 100% from real data, and use the remaining error budget to decide between shipping faster and fixing reliability.`,
    body: `<h4>Core idea</h4><p>An <strong>SLI</strong> is a measured ratio of good events to valid events, such as successful API requests over all API requests. An <strong>SLO</strong> is a target for it over a window, such as 99.9% over 30 days. The <strong>error budget</strong> is the rest: 0.1%, about 43 minutes of full downtime a month. An <strong>SLA</strong> is the customer contract with penalties, and should be looser than the SLO. The budget turns reliability into a number you can spend on risky launches or save.</p>
<h4>How to do it</h4><ol>
<li><strong>Start from user journeys,</strong> not components: send an OTP, place a call, receive a webhook.</li>
<li><strong>Pick 1-3 SLIs per journey:</strong> availability (non-5xx), latency (share of requests under a threshold), and delivery time or freshness for async flows. Measure close to the user, such as at the load balancer.</li>
<li><strong>Write latency SLIs as ratios,</strong> not percentiles, with a histogram bucket exactly at the threshold:
<pre>sum(rate(http_request_duration_seconds_bucket{job="sms-api",le="0.3"}[5m]))
/
sum(rate(http_request_duration_seconds_count{job="sms-api"}[5m]))</pre></li>
<li><strong>Set targets from data:</strong> what you achieved in recent months and what users complain about. Start slightly below current performance and tighten later.</li>
<li><strong>Agree an error budget policy</strong> with product: when the budget is gone, pause risky launches and prioritize reliability work until it recovers.</li>
<li><strong>Alert on burn rate,</strong> meaning how fast the budget is being used, not on raw thresholds.</li>
<li><strong>Let the SLO shape the architecture.</strong> Serial hard dependencies multiply: three at 99.9% each give about 99.7%. So a 99.95% service cannot call three 99.9% services synchronously without caching, fallbacks, or redundancy. And 99.99% leaves about 4 minutes a month, too little for a human to respond, so failover must be automatic.</li>
</ol>
<h4>Numbers to know</h4><table><thead><tr><th>SLO</th><th>Error budget per 30 days</th></tr></thead><tbody>
<tr><td>99%</td><td>7.2 hours</td></tr>
<tr><td>99.9%</td><td>43.2 minutes</td></tr>
<tr><td>99.95%</td><td>21.6 minutes</td></tr>
<tr><td>99.99%</td><td>4.3 minutes</td></tr>
</tbody></table>
<h4>Trade-offs and pitfalls</h4><ul>
<li>100% is the wrong target. It blocks all change, and users cannot tell 99.99% from 100% through their own networks and devices.</li>
<li>Too many SLOs means nobody watches them. A handful per service is enough.</li>
<li>Global ratios hide pain: one big customer at 95% can vanish inside a global 99.95%. Add per-tier or per-customer views for large accounts.</li>
<li>An SLO without a policy is just a dashboard.</li>
</ul>
<h4>Example</h4><p>OTP SLO: 99% of OTP messages accepted by the API are handed to a carrier within 5 seconds, over 30 days. SLI: accepted OTP messages with a carrier submit time at most 5 s after acceptance, divided by all accepted OTP messages. When one carrier's slowness burns 40% of the month's budget in a week, the team pauses a planned queue migration and first builds faster failover to a backup route.</p>`,
    followups: [
      `How would you define an SLI for an asynchronous flow like SMS delivery?`,
      `What should concretely happen when a team exhausts its error budget halfway through the month?`,
      `How do you set an SLO for a service that depends on third parties you cannot control?`
    ],
    related: ["o4", "o3", "o6"]
  },

  o1: {
    tldr: `Log structured JSON with request and trace IDs: one summary line per request at the edge, state changes and external calls in services, full context on errors. Never log secrets, tokens, OTPs, message bodies, or raw PII.`,
    body: `<h4>Core idea</h4><p>Logs answer "what happened to this specific request?" Metrics answer "how much, how often, how fast". Error trackers answer "which code broke". Use each for its job. Logs should be structured JSON, consistent across services, and joinable through shared <code>request_id</code> and <code>trace_id</code> fields. Anything you log is copied into OpenSearch, backups, and exports that many people can read, so treat logs as a data store with security rules.</p>
<h4>How to do it</h4><table><thead><tr><th>Layer</th><th>What to log</th></tr></thead><tbody>
<tr><td>Edge or gateway</td><td>One line per request: method, route template, status, latency, account ID, request ID, client IP</td></tr>
<tr><td>Service</td><td>State changes (queued → sent → delivered), decisions (route chosen, rate limit hit), external calls with target, status, duration</td></tr>
<tr><td>Async worker</td><td>Message ID, attempt number, queue wait time, outcome</td></tr>
<tr><td>Data layer</td><td>Slow queries without parameter values, migrations, failovers</td></tr>
<tr><td>Audit</td><td>Who changed what (API key created, number released), in a separate stream with longer retention</td></tr>
</tbody></table>
<p>Every line carries: UTC timestamp, level, service, version, region, request_id, trace_id, account_id, plus a fixed message with fields, such as <code>{"msg":"carrier submit failed","carrier":"B","status":503}</code>.</p>
<p>Where things go: exceptions with stack traces → Sentry. Searchable events → OpenSearch. Counts and latencies → Prometheus, never counted from log lines.</p>
<p><strong>Never log:</strong> passwords, API tokens, Authorization headers, cookies, private keys, OTP codes, card numbers, message bodies. Mask PII such as phone numbers (<code>+1415*****23</code>) and emails. Enforce this in the shared logging library with an allowlist of fields, not at each call site. In Sentry, keep <code>send_default_pii</code> off and scrub events in <code>before_send</code>.</p>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Volume costs money and slows search. Sample successful INFO and DEBUG lines at high traffic, and keep every error.</li>
<li>Logging full request bodies "for debugging" is a common way secrets leak into logs.</li>
<li>Logging the same error at every layer creates noise. Log it once, where it is handled.</li>
<li>Level inflation: ERROR should mean someone may need to act.</li>
</ul>
<h4>Example</h4><p>A customer says an OTP never arrived. Search OpenSearch by message ID: the API accept line, the worker line (carrier A, attempt 1, 503), the retry line (carrier B, accepted), and the delivery receipt (undelivered, handset unreachable). The ticket is answered in two minutes, and neither the OTP code nor the full phone number appears in any log.</p>`,
    followups: [
      `How would you enforce PII redaction across 50 services owned by different teams?`,
      `When would you sample logs, and how do you avoid dropping the lines you need?`,
      `How do audit logs differ from application logs in retention and access control?`
    ],
    related: ["o2", "o3"]
  },

  o2: {
    tldr: `Standardize on OpenTelemetry and W3C trace context, instrument once in shared libraries, propagate context through HTTP, gRPC, and queues, and tail-sample in collectors: keep every error and slow trace, plus a small share of the rest.`,
    body: `<h4>Core idea</h4><p>A trace is a tree of spans showing one request's path through every service, with timing per hop. At 50+ services the hard parts are consistency and cost, not the concept. Tracing works only if every service propagates the same context, including ones owned by other teams. Storing every span of every request is too expensive, so sampling must keep the interesting traces.</p>
<h4>How to do it</h4><ol>
<li><strong>One standard:</strong> OpenTelemetry SDKs with the W3C <code>traceparent</code> header (version, trace ID, parent span ID, flags). Mixed formats break traces at the boundaries.</li>
<li><strong>Instrument in shared libraries,</strong> not per service: HTTP middleware (otelhttp in Go, the Flask, Django, and requests instrumentations in Python), gRPC interceptors, DB and Redis clients. New services get tracing from the service template.</li>
<li><strong>Cross async boundaries.</strong> Inject context into queue message headers when producing, and extract it when consuming. For batch consumers, use span links to the producer spans.</li>
<li><strong>Naming.</strong> Span names stay low-cardinality, like <code>POST /v1/messages</code>. IDs (account, message, call) go in attributes, which is fine for traces even though it would explode metrics. Follow OpenTelemetry semantic conventions so queries work across services.</li>
<li><strong>Collector tier.</strong> Services send spans to an OpenTelemetry Collector. A first tier forwards with the load-balancing exporter, which routes by trace ID, so all spans of a trace land on one second-tier collector. That tier runs tail sampling: keep 100% of error traces, 100% above a latency threshold, and 1-5% of the rest.</li>
<li><strong>One backend,</strong> such as Grafana Tempo or Jaeger. OpenSearch can also store traces via Data Prepper.</li>
<li><strong>Connect the signals.</strong> Put <code>trace_id</code> in every log line and Sentry event. Enable exemplars on latency histograms, so a spike on a Grafana panel links to an actual trace.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Head sampling (decide at the root, for example <code>parentbased_traceidratio</code> at 5%) is cheap but blind: it drops most error traces. Tail sampling sees whole traces but buffers them in memory during its decision wait (often 10-30 s).</li>
<li>One hop that drops headers (an old proxy, a hand-rolled HTTP client) breaks every trace through it. Test propagation in CI.</li>
<li>Volume: 2,000 req/s with 30 spans each is 60,000 spans per second before sampling.</li>
<li>Traces show where time goes, not why. You still need logs and profiles.</li>
<li>Do not blindly trust trace headers from the public internet. Start a fresh trace at your edge and keep any incoming ID as a link or attribute.</li>
</ul>
<h4>Example</h4><p>Inbound call webhooks are slow for some customers. A kept trace shows: edge 2 ms, call control 15 ms, number lookup 8 ms, then 900 ms in the webhook dispatcher waiting on the customer's server, followed by a retry. Tail sampling kept it because it crossed the 500 ms threshold. Span attributes carry the account ID and target host, so you see that one customer's endpoint causes it. Without tracing, this just looks like "the voice API is slow".</p>`,
    followups: [
      `How does tail sampling work when spans of one trace arrive at different collectors?`,
      `How do you propagate trace context through a message queue or a batch job?`,
      `How would you roll out tracing to 50 services without every team doing custom work?`
    ],
    related: ["o1", "o5", "c2"]
  },

  o3: {
    tldr: `Measure what users experience first (RED: rate, errors, duration per endpoint), then resource saturation (USE), then business outcomes. Use counters, gauges, and histograms correctly, keep labels bounded, and always emit denominators so you can compute ratios.`,
    body: `<h4>Core idea</h4><p>Healthy means users get correct answers quickly. CPU at 40% says nothing about that. So measure from the outside in: request rate, error ratio, and latency for each user-facing operation. Then add saturation signals that predict trouble before users feel it. Then add business metrics that catch silent failures, like zero errors but also zero deliveries.</p>
<h4>How to do it</h4><ol>
<li><strong>RED per service:</strong> Rate, Errors, Duration, labeled by route template and status class.</li>
<li><strong>USE per resource:</strong> Utilization, Saturation, Errors for pools, queues, disks, CPU. Queue depth plus the age of the oldest message beats depth alone.</li>
<li><strong>Right type.</strong> Counter: only goes up, query with <code>rate()</code> or <code>increase()</code>. Gauge: a current value, like in-flight requests. Histogram: latencies and sizes, aggregatable across pods. Avoid summaries on multi-replica services, since their quantiles cannot be combined.</li>
<li><strong>Base units in names:</strong> <code>http_request_duration_seconds</code>, <code>sms_submitted_total</code>.</li>
<li><strong>Bounded labels.</strong> Each label combination is a separate series. 20 routes x 5 status classes x 50 pods = 5,000 series, fine. Add <code>customer_id</code> with 50,000 values and it can reach 250 million. IDs belong in logs and traces.</li>
<li><strong>Initialize label sets to zero</strong> at startup, so error series exist before the first error.</li>
<li><strong>Pushgateway only for batch jobs.</strong> It never expires what was pushed, so alert on <code>time() - push_time_seconds</code> to catch jobs that stopped running.</li>
</ol>
<pre># error ratio per route
sum by (route) (rate(http_requests_total{job="sms-api",code=~"5.."}[5m]))
/
sum by (route) (rate(http_requests_total{job="sms-api"}[5m]))

# p99: aggregate buckets first, keep le
histogram_quantile(0.99,
  sum by (le, route) (rate(http_request_duration_seconds_bucket{job="sms-api"}[5m])))</pre>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Averaging p99s across pods is mathematically wrong. Aggregate buckets, then take the quantile.</li>
<li><code>histogram_quantile</code> interpolates within a bucket. Put bucket boundaries near your SLO threshold, or p99 will be vague.</li>
<li><code>rate()</code> on a gauge is meaningless. Use <code>deriv()</code> or <code>delta()</code>.</li>
<li>Metrics nobody reads still cost storage and attention.</li>
</ul>
<h4>Example</h4><p>An SMS pipeline: an API request counter and latency histogram (RED), <code>sms_queue_oldest_age_seconds</code> and worker pool in-use vs max (USE), <code>sms_carrier_submit_total</code> labeled by carrier and result, and <code>sms_dlr_total</code> labeled by carrier and status (business). One morning API errors are 0% and latency is normal, but delivery receipts for one carrier fall from 95% to 60% delivered. Only the business metric shows it, because the failure happens at the carrier, after your API already returned success.</p>`,
    followups: [
      `Why are histograms preferred over summaries in a multi-replica service?`,
      `How would you find and fix a label cardinality explosion in Prometheus?`,
      `Which business metrics would you add to catch failures that technical metrics miss?`
    ],
    related: ["r10", "o4", "o6"]
  },

  o4: {
    tldr: `Page only on user-facing symptoms that need action now, measured as SLO burn rate over two windows. Send everything else to tickets or dashboards. Every page needs a runbook, and every page that was not actionable gets fixed or deleted.`,
    body: `<h4>Core idea</h4><p>An alert is a request for human attention. Pages should be urgent, actionable, and tied to user impact. Cause alerts (CPU at 85%, a pod restarted) fire often and usually need nothing, so people learn to ignore them. Symptom alerts (users are getting errors, the error budget is burning) are rarer and almost always real. Keep causes on dashboards for diagnosis.</p>
<h4>How to do it</h4><ol>
<li><strong>Two tiers.</strong> Page: act within minutes. Ticket: act within days. Everything else is a dashboard.</li>
<li><strong>Burn rate alerts.</strong> Burn rate = error ratio / (1 - SLO). A common setup for a 99.9%, 30-day SLO: page when burn rate is above 14.4 over both 1 h and 5 min (2% of the budget gone in an hour), page above 6 over 6 h and 30 min, ticket above 1 over 3 days and 6 h. The long window shows it matters. The short one lets the alert clear soon after recovery.
<pre>(
  sum(rate(http_requests_total{job="sms-api",code=~"5.."}[1h]))
  / sum(rate(http_requests_total{job="sms-api"}[1h]))
) &gt; (14.4 * 0.001)
and
(
  sum(rate(http_requests_total{job="sms-api",code=~"5.."}[5m]))
  / sum(rate(http_requests_total{job="sms-api"}[5m]))
) &gt; (14.4 * 0.001)</pre></li>
<li><strong>A few cause alerts that predict certain pain:</strong> disk full within 4 hours (<code>predict_linear</code>), certs expiring within 14 days, a stale batch job (<code>push_time_seconds</code> too old), <code>up == 0</code> on critical targets.</li>
<li><strong>Use a <code>for:</code> duration</strong> (for example 5m) on noisy signals so blips do not page.</li>
<li><strong>Alertmanager hygiene:</strong> group related alerts into one notification, inhibit downstream alerts when an upstream one fires, route by a severity label (page → pager, ticket → Slack).</li>
<li><strong>Every alert has an owner and a runbook link</strong> in its annotations.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Low-traffic services make ratios jumpy: 1 error in 10 requests is 10%. Require a minimum request count.</li>
<li>Symptom alerts say something is wrong, not where. Dashboards and traces do that.</li>
<li>No data means no alert. Add <code>absent()</code> or <code>up</code> alerts for critical jobs.</li>
<li>Review pages weekly. Tune or delete every page that was not actionable.</li>
</ul>
<h4>Example</h4><p>A webhook service used to page on CPU above 80%, any pod restart, and queue depth above 1,000: 30 pages a week, mostly noise. The new setup: an SLO that 99.5% of webhooks are attempted within 60 s of the event, burn-rate pages on it, and one ticket alert for slowly growing queue age. Pages fell to one or two a week, each a real customer-visible delay.</p>`,
    followups: [
      `Why use two windows in a burn-rate alert instead of one?`,
      `How would you alert on a low-traffic service where error ratios are noisy?`,
      `How do you measure whether your alerting is getting better or worse over time?`
    ],
    related: ["r10", "o3", "o7"]
  },

  o5: {
    tldr: `Confirm the tail with histograms, then narrow where it lives (which endpoint, instance, zone, customer, dependency) using breakdowns and slow traces. Common causes are queueing near saturation, GC pauses, pool contention, retries, noisy neighbors, and fan-out.`,
    body: `<h4>Core idea</h4><p>Tail latency (p99, p99.9) is what your slowest 1% or 0.1% of requests see. It matters more than the median because busy users and fan-out requests hit it often. If a request fans out to 100 backends and each is slow 1% of the time, about 63% of requests wait on at least one slow call (1 - 0.99^100). Tails usually come from waiting, not computing: queues, locks, pauses, retries.</p>
<h4>How to do it</h4><ol>
<li><strong>Confirm with histograms,</strong> not averages. If p50 moves too, it is general slowness. If only p99 moves, look for something intermittent.</li>
<li><strong>Slice to find where it lives:</strong> by instance, zone, route, dependency.
<pre>histogram_quantile(0.99,
  sum by (le, instance) (rate(http_request_duration_seconds_bucket{job="call-api"}[5m])))</pre>
One bad instance suggests a host problem, a noisy neighbor, or a bad deploy. All instances suggest shared load or a shared dependency.</li>
<li><strong>Compare slow traces with fast ones,</strong> via exemplars or tail-sampled traces. Which span grew? Or is the time in a gap between spans (queueing, GC, waiting for a connection)?</li>
<li><strong>Check the usual suspects:</strong><ul>
<li>Saturation: latency climbs steeply as utilization nears 100%, because requests queue. Compare pool in-use against max.</li>
<li>Runtime pauses: <code>go_gc_duration_seconds</code>, goroutine counts, heap growth. In Python, blocking calls inside async code.</li>
<li>CPU throttling in containers: <code>container_cpu_cfs_throttled_periods_total</code> rising while average CPU looks fine.</li>
<li>Retries: a retry after a 1 s timeout puts that request above 1 s.</li>
<li>Cold paths: cache misses, new TCP and TLS handshakes, DNS lookups.</li>
<li>Skew: one big tenant or hot key with far more data than the rest.</li>
</ul></li>
<li><strong>Profile the slow case:</strong> Go pprof (CPU, block, mutex), py-spy for Python, <code>pg_stat_statements</code> and slow query logs for the database.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Tail fixes: tight timeouts, hedged requests (send a second copy after the p95 delay, take the first reply), right-sized pools with load shedding, connection warm-up, isolating heavy tenants. Hedging adds load, so cap it at a few percent.</li>
<li>Coordinated omission: a load tester that waits for each response before sending the next hides the tail. Use a constant-rate tool.</li>
<li>Wide buckets hide detail: if slow requests land in a 1-5 s bucket, you cannot tell 1.1 s from 4.9 s.</li>
<li>Client-side p99 includes network and queueing that server metrics miss. Measure both.</li>
</ul>
<h4>Example</h4><p>Call setup API: p50 steady at 80 ms, but p99 jumped from 300 ms to 2 s after traffic grew. All instances are affected. Slow traces show 1.5 s passing before the database span even starts. The pool allows 10 connections per pod, and in-use sits at 10 of 10 at peak, so requests wait for a connection. The database's connection limit rules out simply raising the pool, so the team adds PgBouncer and fixes one query that held connections for 400 ms. p99 returns to 250 ms.</p>`,
    followups: [
      `How do hedged requests reduce tail latency, and when do they make things worse?`,
      `Why does latency rise sharply as utilization approaches 100%?`,
      `How would you tell whether the tail comes from your service or from a dependency?`
    ],
    related: ["o2", "c7", "r3"]
  },

  o6: {
    tldr: `Build a top-down hierarchy: one overview that answers "are users hurt, and where?" in seconds, then per-service RED and dependency panels, then resource detail. Use consistent layouts, deploy annotations, and links to logs and traces.`,
    body: `<h4>Core idea</h4><p>During an incident, a dashboard has one job: shorten the path from "something is wrong" to "it is this component, since this time". That needs a fixed reading order: first "are users hurt, and which ones?", then which service, then which dependency or resource. A wall of 80 unordered panels slows down a stressed engineer.</p>
<h4>How to do it</h4><ol>
<li><strong>Level 1, overview:</strong> SLO status and budget left, request rate, error ratio, p50 and p99 latency, each with last week's line for comparison: <code>sum(rate(http_requests_total{job="sms-api"}[5m] offset 1w))</code>.</li>
<li><strong>Level 2, per service:</strong> RED per route, then one row per dependency (calls, errors, latency as the caller sees them), then saturation (pool usage, queue depth and age, in-flight requests).</li>
<li><strong>Level 3, resources:</strong> USE per pod or host, runtime metrics (GC, goroutines), database internals.</li>
<li><strong>Same layout for every service,</strong> generated from a template and stored as JSON in git, with dropdown variables for region, service, and instance.</li>
<li><strong>Deploy annotations.</strong> Have Jenkins post a Grafana annotation for each deploy and config change. "Errors started two minutes after build 1432" is often the whole diagnosis.</li>
<li><strong>Links out:</strong> data links from panels to the matching OpenSearch query and time range, to Sentry issues, and to traces through exemplars.</li>
<li><strong>Readable panels:</strong> units on axes, SLO threshold lines, red only for bad states, and a short note on what normal looks like.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>A dashboard per idea becomes a graveyard. Remove panels nobody used in recent incidents.</li>
<li>Averages hide incidents. Show p99 or a latency heatmap.</li>
<li>Long ranges and coarse steps smooth out spikes. Default to the last few hours.</li>
<li>Heavy queries make dashboards slow exactly when everyone opens them. Precompute them with recording rules.</li>
<li>Dashboards are for diagnosis. Alerts do detection.</li>
</ul>
<h4>Example</h4><p>SMS incident dashboard. Top row: accepted messages per second, API error ratio, OTP time-to-carrier p99, error budget left. Second row: submit success by carrier, and a table of delivery success by carrier and destination country, with cells colored by threshold. Third row: queue depth and oldest message age per carrier queue, worker pool usage. When a carrier degrades, on-call sees that carrier's cells turn red while the others stay green, and its queue starts aging. Two clicks later they are reading its error responses in OpenSearch.</p>`,
    followups: [
      `What would you put in the top row of a dashboard for a voice call setup service?`,
      `How do you keep dashboards consistent across dozens of services and teams?`,
      `How would you link a latency spike on a panel to the exact traces and logs behind it?`
    ],
    related: ["o3", "o4", "o7"]
  },

  o7: {
    tldr: `One runbook per alert, linked from the alert itself. Lead with impact and the safest mitigation, give copy-paste commands and ready dashboard queries, say when to escalate, and update the runbook after every incident that used it.`,
    body: `<h4>Core idea</h4><p>A runbook turns expert knowledge into steps a tired engineer can follow at 3 a.m. without the expert. In an incident, the priority is to stop user impact first and find the root cause later. So a runbook leads with how to confirm the problem and how to mitigate it safely. Background goes at the bottom.</p>
<h4>How to do it</h4><p>Use one template for every alert:</p><ol>
<li><strong>Meaning and impact:</strong> what fired, in one or two sentences, and who is affected.</li>
<li><strong>Confirm:</strong> the exact Grafana panel to open, plus a ready OpenSearch query or PromQL expression to paste. Never just "check the logs".</li>
<li><strong>Mitigate, safest first:</strong> roll back the last deploy, flip a kill switch, shift traffic to another carrier or region, scale out, shed low-priority load. For each step: the command or Jenkins job, what should happen, and how long to wait.</li>
<li><strong>Verify:</strong> which metric should recover, and to what value.</li>
<li><strong>Escalate:</strong> when (for example, no improvement in 15 minutes) and to whom, including vendor contacts.</li>
<li><strong>Communicate:</strong> when to update the status page, with a template message.</li>
<li><strong>Background:</strong> architecture notes, known causes, links to past incidents.</li>
</ol><p>Keep runbooks in git next to the alert rules, and put the link in each alert's annotations so the page leads straight to the steps.</p>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Stale runbooks are worse than none: they send people down wrong paths. Review the ones used in each postmortem, and date them.</li>
<li>A long list of manual commands is a signal to automate. Wrap repeated steps into a script or one Jenkins job, and point the runbook at it.</li>
<li>Authors skip steps that feel obvious to them. Have a newer engineer follow the runbook during a game day.</li>
<li>Risky commands (restarts, failovers, deletes) need a clear warning and their blast radius.</li>
</ul>
<h4>Example</h4><p>Alert: SMS delivery success via carrier B below 80% for 10 minutes. Impact: messages to B's subscribers are delayed or lost, and OTPs are hit first. Confirm: the carrier row on the SMS dashboard, then the OpenSearch query <code>carrier:B AND level:error</code> for the last 30 minutes, to tell whether B is rejecting (often our side, like an expired credential) or accepting but not delivering (their side). Mitigate: if B is at fault, set B's routing weight to 0 with the documented config change, so traffic moves to backup carriers. Verify: delivery success recovers within 5 minutes. Escalate: ticket to B's NOC, and page the messaging lead if a country has no backup route.</p>`,
    followups: [
      `How do you keep runbooks from going stale?`,
      `When should a runbook step be automated instead of documented?`,
      `What belongs in a runbook versus a postmortem?`
    ],
    related: ["o4", "o6", "h9"]
  },

  o8: {
    tldr: `Inject realistic faults, starting small: unit tests with failing fakes, toxiproxy in CI and staging, load tests past capacity, then controlled chaos experiments and game days, each with a hypothesis, a steady-state metric, and an abort switch.`,
    body: `<h4>Core idea</h4><p>You cannot trust a timeout, retry, breaker, or failover that has never fired. Failure simulation fires them on purpose, under control, so you find the gaps before real traffic does. Chaos engineering is the disciplined version: define normal, predict what will happen, inject one fault, and compare.</p>
<h4>How to do it</h4><ol>
<li><strong>Unit and integration tests:</strong> fake clients that error, hang, or return garbage. Assert that the code times out, falls back, and does not leak goroutines.</li>
<li><strong>Network faults with toxiproxy</strong> between your service and Redis, Postgres, or a fake carrier, in CI or staging:
<pre>toxiproxy-cli create -l localhost:26379 -u localhost:6379 redis
toxiproxy-cli toxic add -t latency -a latency=1000 redis</pre>
Other toxics include timeout, bandwidth, reset_peer, and slicer. On Linux hosts, <code>tc netem</code> adds delay and packet loss.</li>
<li><strong>Load tests past capacity</strong> with k6, Locust, or vegeta. Find the breaking point, check that the system sheds load instead of collapsing, and check that it recovers when load drops.</li>
<li><strong>Chaos experiments,</strong> staging first, then production: kill pods or instances, blackhole a dependency, fill a disk. AWS Fault Injection Service can stop instances or disrupt networking, with stop conditions tied to CloudWatch alarms.</li>
<li><strong>Game days:</strong> the team runs a scenario (zone loss, carrier outage) with real runbooks and on-call, and records every gap.</li>
</ol><p>Each experiment needs a written <strong>hypothesis</strong> ("if Redis adds 1 s latency, API p99 stays under 400 ms thanks to the 50 ms timeout and local fallback"), a <strong>steady-state metric</strong>, a small <strong>blast radius</strong>, and an automatic <strong>abort condition</strong>.</p>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Production chaos finds more but risks more. Earn it: staging, then one host, off-peak, with people watching.</li>
<li>Staging is often too small and too quiet to reproduce load failures. Treat its results as a floor, not proof.</li>
<li>Findings without owners are wasted. File each one as a ticket.</li>
<li>Test slow, not just down. Down is easy to simulate, but slow dependencies are often more damaging because they tie up resources.</li>
</ul>
<h4>Example</h4><p>Hypothesis: if carrier B's endpoint starts timing out, OTP time-to-carrier p99 stays under 5 s, because B's breaker opens and traffic shifts to a backup route. In staging, toxiproxy in front of a fake carrier B gets a timeout toxic. Result: the breaker opened, but B shared a worker pool with carrier C, so C's traffic stalled for 40 seconds too. The fix was a separate pool per carrier. The rerun passed, and the scenario joined the monthly game day.</p>`,
    followups: [
      `How do you decide when a chaos experiment is safe to run in production?`,
      `Which steady-state metric would you pick for an SMS delivery experiment, and why?`,
      `How would you simulate a slow dependency, not just a dead one?`
    ],
    related: ["r1", "r4", "r6"]
  }
});
