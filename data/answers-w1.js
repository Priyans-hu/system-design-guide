window.VAULT_ANSWERS = window.VAULT_ANSWERS || {};
Object.assign(window.VAULT_ANSWERS, {
  c1: {
    tldr: `Split only when a specific, recurring pain (teams blocking each other, very different scaling or reliability needs, deploy coupling) costs more than the tax of a network boundary. Modularize first, then extract one well-bounded module at a time.`,
    body: `<h4>Core idea</h4>
<p>Services are a tool for team independence and fault isolation, not a default architecture. Every split turns an in-process function call into a network call, which brings latency, partial failures, distributed data, and one more thing to deploy, monitor, and be on call for. Split only when a concrete, recurring pain costs more than that tax.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Name the pain with evidence.</strong> Good reasons: several teams queue behind one deploy pipeline; one module needs very different scaling (a CPU-heavy media transcoder next to light CRUD); one module has a stricter reliability or compliance bar (billing, card data); one module's failures take everything down. Weak reasons: "it's modern" or "the code is messy". Messy code gets messier over a network.</li>
<li><strong>Modularize inside the monolith first.</strong> Separate packages per domain, no cross-module table access, calls only through interfaces. If you can't keep a boundary clean in-process, it won't stay clean across the network.</li>
<li><strong>Pick the seam.</strong> Look for a module with a small interface, its own data, and its own change rhythm. Git history helps: files that always change together belong together.</li>
<li><strong>Extract with the strangler fig pattern.</strong> Put a routing layer in front, move one endpoint or flow at a time, shadow or dual-run traffic to compare results, cut over, then delete the old code.</li>
<li><strong>Move the data with it.</strong> The new service owns its tables. Others use its API or consume its events, never direct joins.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li><strong>Distributed monolith:</strong> services that must deploy together or share a database give you every cost and none of the benefits.</li>
<li>Each service needs CI/CD, dashboards, alerts, tracing, and an on-call owner. Five engineers running fifteen services is usually a mistake.</li>
<li>Cross-service workflows need sagas or an outbox instead of one DB transaction. If two modules need strong consistency with each other, keep them together.</li>
<li>Wrong boundaries are cheap to fix in-process and expensive once they are network APIs that other teams depend on.</li>
</ul>
<h4>Example</h4>
<p>A CPaaS monolith handles the send-SMS API, carrier routing, billing, and delivery-receipt webhooks. Webhook delivery is the best first candidate. Its load is bursty and retry-heavy because customer endpoints time out, its slowness should never touch the send path, and its only input is a "message status changed" event. Extract it behind a queue with its own workers, retry policy, and autoscaling on queue depth. Billing could follow, since it has a stricter correctness bar and its own team. Carrier routing sits on the latency-critical send path and changes with it, so it stays in the core for now.</p>`,
    followups: [
      `How would you split the database when two modules currently join across each other's tables?`,
      `What signs tell you a split has produced a distributed monolith?`,
      `How do you keep data consistent when a workflow now spans two services?`
    ],
    related: ["p1", "e9", "t3"]
  },

  c2: {
    tldr: `The client resolves DNS and opens a TLS connection to an edge load balancer. A gateway authenticates and rate-limits, a service does the work using caches, databases, and queues, and the response travels back the same path.`,
    body: `<h4>Core idea</h4>
<p>A request crosses several layers, each with one job. Knowing them tells you where latency comes from, where failures happen, and where each concern (auth, caching, retries) belongs.</p>
<h4>How to do it</h4>
<ol>
<li><strong>DNS:</strong> the client resolves the API hostname. GeoDNS or anycast can send it to the nearest region.</li>
<li><strong>Connection:</strong> a TCP handshake (1 round trip), then TLS (1 more with TLS 1.3, 2 with TLS 1.2). Keep-alive and connection pools let later requests skip this.</li>
<li><strong>Edge and load balancer:</strong> a CDN or WAF filters abuse. An L4 or L7 load balancer terminates TLS and picks a healthy instance (round robin, least connections) based on health checks.</li>
<li><strong>API gateway:</strong> authenticates the API key or token, applies per-account rate limits, assigns a request ID, and routes by path.</li>
<li><strong>Service:</strong> validates input and runs business logic. It reads a cache (Redis), reads or writes the database (Postgres), calls other services with timeouts, and puts slow work on a queue (Kafka, SQS).</li>
<li><strong>Response:</strong> goes back through the same layers. Each hop emits logs, metrics, and trace spans. Queue workers finish the async part later.</li>
</ol>
<h4>Numbers to know</h4>
<ul>
<li>Round trip inside a data center: well under 1 ms. Across continents: roughly 100-250 ms, so a fresh HTTPS connection from far away costs hundreds of ms before any work starts.</li>
<li>Redis GET in the same region: under 1 ms. Indexed Postgres read: about 1-5 ms.</li>
</ul>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Every hop adds latency and a failure point. Set a timeout at each one, with inner timeouts shorter than outer ones, or callers give up while callees keep working.</li>
<li>Retries at several layers multiply: 3 attempts at each of 3 layers means up to 27 calls to the bottom service.</li>
<li>Pass a request ID and trace context (the W3C traceparent header) through every hop, including queue messages, or debugging turns into guesswork.</li>
<li>On deploys, the load balancer must drain an instance before it stops, or in-flight requests fail.</li>
</ul>
<h4>Example</h4>
<p>A customer calls POST /v1/messages to send an OTP. DNS picks the nearest region, the load balancer terminates TLS, and the gateway checks the API key and the account's rate limit. The messaging service validates the number, checks the balance, saves the message as "queued", publishes a job, and returns 202 with a message ID in about 50 ms. A worker then submits the SMS to a carrier. When the delivery receipt arrives, another worker updates the status and calls the customer's webhook.</p>`,
    followups: [
      `Where would you terminate TLS, and what changes if traffic must stay encrypted inside your network?`,
      `How do you propagate a deadline and a trace ID across every hop, including queues?`,
      `What happens to in-flight requests when an instance is removed from the load balancer during a deploy?`
    ],
    related: ["c4", "p5", "o2"]
  },

  c3: {
    tldr: `Keep the app tier stateless so you can add instances, load-test to find the first bottleneck (usually the database), and use the standard levers: caching, read replicas, connection pooling, queues for slow work, and a partition key chosen early.`,
    body: `<h4>Core idea</h4>
<p>At 10x, the stateless tier rarely breaks; you just add pods. What breaks is shared state: the database, a hot cache key, a global lock, a connection limit, or a third party with a fixed quota. Design so the stateless part scales by adding instances, and every stateful part has a known next step.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Keep app servers stateless.</strong> No sessions or files in local memory or disk; use Redis, the database, or signed tokens. Then autoscale on CPU or request rate behind a load balancer.</li>
<li><strong>Find the real bottleneck.</strong> Load-test at 10x peak with a realistic request mix. Watch p99 latency, DB CPU and connections, lock waits, and queue lag. Size concurrency with Little's law: in-flight requests = throughput x latency, so 5,000 RPS at 40 ms is about 200 requests in flight.</li>
<li><strong>Protect the database.</strong> Cache hot reads (cache-aside with TTLs), send lag-tolerant reads to replicas, pool connections (PgBouncer; each Postgres connection is a process), add the right indexes, fix N+1 queries, and batch writes.</li>
<li><strong>Move slow work off the request path.</strong> Webhooks, emails, and analytics go to a queue. The API does the minimum and returns.</li>
<li><strong>Pick a partition key now.</strong> Put account_id on every table and query, so sharding later is a routing change, not a rewrite.</li>
<li><strong>Remove single points:</strong> global locks, one-row counters, cron jobs on one box, singleton workers.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>More pods means more DB connections: 50 pods with 20 connections each is 1,000 connections, enough to hurt Postgres on its own.</li>
<li>Caches add staleness and invalidation bugs. Replicas add lag, so users may not see their own writes.</li>
<li>Autoscaling takes tens of seconds to minutes. For sudden spikes, keep headroom (say 50-60% CPU at peak) or pre-scale for known events.</li>
<li>Third-party limits (carrier throughput, payment quotas) don't grow with your pods.</li>
<li>Don't build sharding for 10x. A bigger database plus replicas and cache usually covers it. Plan sharding for 100x.</li>
</ul>
<h4>Example</h4>
<p>An SMS API runs at 500 RPS and must handle 5,000 during a festival OTP surge. API pods scale out with no code change. The database hits its connection limit first as pods multiply, so a pooler goes in front, and status updates (several per message) are batched by queue consumers. Account settings such as sender IDs are cached in Redis for 60 seconds because they rarely change. Carriers cap throughput per connection, so send workers pace per carrier from a queue, and OTPs get their own lane so bulk campaigns can't delay them. Per-account rate limits keep one customer's surge from becoming everyone's outage.</p>`,
    followups: [
      `Your load test shows the database saturating at 4x. What do you change first, and why?`,
      `How would you handle a 10x spike that arrives faster than autoscaling can react?`,
      `When is it time to shard, and how would you choose the shard key?`
    ],
    related: ["c4", "k1", "d3"]
  },

  c4: {
    tldr: `Vertical scaling (a bigger machine) is simple but has a ceiling and remains a single point of failure. Horizontal scaling (more machines) goes further and survives node loss, but needs stateless services and a plan for data.`,
    body: `<h4>Core idea</h4>
<p>Vertical scaling (scale up) gives one node more CPU, RAM, or faster disks. Horizontal scaling (scale out) adds nodes and spreads load across them. Real systems use both. Stateless services scale out early. Databases usually scale up as far as is sensible, then add read replicas, and shard only when writes outgrow the biggest machine.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Scale up first when it's cheap.</strong> Moving a database at 70% CPU to an instance twice the size is a planned failover. Sharding is months of work.</li>
<li><strong>Check the software can use a bigger box.</strong> Redis runs commands on one main thread, so extra cores barely help it. In standard CPython, the GIL lets one process run Python code on only one core at a time, so run several worker processes. Go uses all available cores by default.</li>
<li><strong>Make services ready to scale out.</strong> Remove local state (sessions, files on local disk, in-memory counters), put instances behind a load balancer with health checks, and make any node able to handle any request.</li>
<li><strong>Scale data out in stages:</strong> read replicas for read-heavy load, then partitioning or sharding by a key such as account_id for write-heavy load.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<table>
<thead><tr><th></th><th>Vertical</th><th>Horizontal</th></tr></thead>
<tbody>
<tr><td>Code changes</td><td>None</td><td>Stateless design, partitioned data</td></tr>
<tr><td>Ceiling</td><td>Largest instance you can buy</td><td>Coordination and data partitioning</td></tr>
<tr><td>Failure</td><td>Single point of failure</td><td>Lose a node, others carry on</td></tr>
<tr><td>Resizing</td><td>Usually a restart or failover</td><td>Add or remove nodes live</td></tr>
<tr><td>Consistency</td><td>Simple, one copy</td><td>Replication lag, cross-shard queries</td></tr>
</tbody>
</table>
<ul>
<li>Vertical scaling hides problems until you hit the largest instance, and then you redesign under pressure.</li>
<li>A big box is paid for at peak size all day. Horizontal fleets can scale in at night.</li>
<li>Scaling out adds network hops, lowers per-node cache hit rates, and multiplies database connections.</li>
<li>Replicas scale reads, not writes, and their reads can be stale.</li>
</ul>
<h4>Example</h4>
<p>An SMS platform runs stateless Go API pods that autoscale on CPU behind a load balancer. The Postgres primary holding messages hits 80% CPU. First add missing indexes and move dashboard and reporting queries to a read replica. Next, move the primary to a larger instance through a replica failover. Sharding by account_id waits until write volume nears the largest instance's limit. The Redis used for rate limiting is bound by its single command thread, so it scales out with Redis Cluster, which spreads keys across shards, rather than moving to a bigger box.</p>`,
    followups: [
      `Your Postgres primary is at 80% CPU. What are your options, in order?`,
      `What state would you need to remove from a service before you can scale it horizontally?`,
      `How do read replicas change the consistency guarantees your API gives users?`
    ],
    related: ["c3", "d3", "t5"]
  },

  c5: {
    tldr: `Use synchronous calls when the caller needs the result now to continue or to answer the user. Use asynchronous messaging when the work can finish later, is slow or bursty, or should survive the downstream being down.`,
    body: `<h4>Core idea</h4>
<p>The key question is: does the caller need the answer before it can respond? A synchronous call (HTTP, gRPC) couples caller and callee in time. Both must be up, and their latencies add. Asynchronous communication (a queue or event stream) decouples them. The caller records the intent durably and moves on, and a consumer does the work when it can.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Does the response depend on the result?</strong> Auth checks, balance checks, and reads for a page are sync.</li>
<li><strong>How long does the work take?</strong> If it takes seconds or has no upper bound (third-party APIs, carrier submission, media processing), go async and give the client a status to poll or a webhook.</li>
<li><strong>What if the downstream is down?</strong> If you would rather accept the request and finish later, go async. If the request is meaningless without the downstream, stay sync with a timeout and a clear error.</li>
<li><strong>How many parties care?</strong> If billing, analytics, and notifications all react to one fact, publish one event instead of making three sync calls.</li>
<li><strong>What is the load shape?</strong> Bursty traffic suits a queue, which absorbs peaks while consumers work at a steady rate.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Sync chains multiply failure: five services in series at 99.9% each give about 99.5% for the whole call.</li>
<li>Async brings duplicates (at-least-once delivery), reordering, poison messages, and consumer lag. Consumers must be idempotent, and you need a dead-letter queue and lag alerts.</li>
<li>Async is harder to debug. Put a trace ID in message headers.</li>
<li>Dual writes break: committing to the DB and then publishing to a queue can lose the event if the process dies in between. Use a transactional outbox.</li>
<li>An async API that clients poll every 100 ms is sync with extra steps. Offer webhooks or long polling.</li>
</ul>
<h4>Example</h4>
<p>For a send-SMS request, the sync part is small: authenticate, validate the destination number, check balance, save the message as "queued", and return 202 Accepted with a message ID. Everything else is async: choosing a route, submitting to the carrier, handling the delivery receipt, updating status, charging, and calling the customer's webhook. By contrast, verifying an OTP code the user just typed is sync, because the user is waiting on the login screen and the answer is a quick database lookup.</p>`,
    followups: [
      `How does a client learn the final outcome of an async operation, and when would you pick polling over webhooks?`,
      `How do you avoid losing the event if the database commit succeeds but the publish fails?`,
      `When is request-reply over a message queue a reasonable choice?`
    ],
    related: ["c6", "a1", "t4"]
  },

  c6: {
    tldr: `Use RPC when you need an answer within the request and the callee can keep up. Use a queue when you need durability, buffering for bursts, retries without the caller waiting, or workers sharing load at their own pace.`,
    body: `<h4>Core idea</h4>
<p>RPC is a phone call: the callee must answer now. A queue is a mailbox: a broker stores the message durably, and consumers take it when ready. A queue costs an extra hop, another system to run, and delayed results. In return you get buffering, retries, and independent scaling of producers and consumers.</p>
<h4>How to do it</h4>
<p><strong>Choose RPC when</strong> the caller needs the response (reads, validation, auth), the latency budget is tight, the operation is cheap, and the caller must know about failure immediately, for example to return a 400 to the user.</p>
<p><strong>Choose a queue when:</strong></p>
<ul>
<li>producers can outpace consumers in bursts (load leveling);</li>
<li>the work is slow or calls flaky third parties, so it needs retries with backoff and a dead-letter queue after N attempts;</li>
<li>work must survive a consumer crash (ack only after processing);</li>
<li>you want competing consumers, adding workers to drain faster;</li>
<li>several consumers need the same event, or you need replay.</li>
</ul>
<p><strong>Pick the right kind of queue:</strong></p>
<table>
<thead><tr><th></th><th>Work queue (SQS, RabbitMQ)</th><th>Log (Kafka)</th></tr></thead>
<tbody>
<tr><td>Progress</td><td>Per-message ack, redelivery after a visibility timeout</td><td>Consumer commits an offset per partition</td></tr>
<tr><td>Ordering</td><td>SQS standard: not guaranteed. FIFO: per message group</td><td>Per partition</td></tr>
<tr><td>Replay</td><td>No, gone once acked</td><td>Yes, within retention</td></tr>
<tr><td>Fan-out</td><td>One queue per consumer (SNS to SQS, exchanges)</td><td>Every consumer group reads everything</td></tr>
<tr><td>Parallelism</td><td>Add consumers freely</td><td>Capped by partition count per group</td></tr>
</tbody>
</table>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Queues hide failures: the producer sees success while consumers fail. Alert on oldest-message age, consumer lag, and DLQ size, not just depth.</li>
<li>Delivery is at least once, so consumers must be idempotent (dedupe on a message ID).</li>
<li>A queue doesn't add capacity. If consumers are slower on average, the backlog grows forever.</li>
<li>Request-reply over queues (reply queue plus correlation ID) adds latency and complexity. If you need the answer now, use RPC.</li>
</ul>
<h4>Example</h4>
<p>When a carrier delivery receipt arrives, don't call the customer's webhook inline in the receipt handler, because customer endpoints can be slow or down. Put a webhook job on a queue. Workers POST with a 5-10 second timeout, retry with exponential backoff over several hours, move the job to a DLQ when the retry budget runs out, and cap concurrency per customer so one slow endpoint can't hold every worker. Checking whether an API key is valid on each request is the opposite case: a fast RPC or cached lookup, never a queue.</p>`,
    followups: [
      `How do you size the number of consumers and Kafka partitions for a workload?`,
      `What metrics tell you a queue-based pipeline is falling behind?`,
      `How do you stop one customer's slow webhook endpoint from delaying everyone else's deliveries?`
    ],
    related: ["c5", "a6", "a3"]
  },

  c7: {
    tldr: `Backpressure lets a slow stage make its producers slow down instead of drowning. Bound every queue and pool, prefer pull over push, reject early with 429 or 503 plus Retry-After, and shed or defer low-priority work first.`,
    body: `<h4>Core idea</h4>
<p>Every pipeline runs at the speed of its slowest stage. When input exceeds that, the excess must be buffered, slowed at the source, or dropped. Unbounded buffers only delay the failure: memory grows, latency climbs, clients time out and retry, and the system spends its capacity on requests nobody is waiting for anymore. Backpressure passes "I'm full" upstream, so the system keeps running at its maximum useful throughput instead of collapsing.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Bound everything.</strong> Every in-memory queue, worker pool, connection pool, and in-flight request count gets a limit. In Go, a buffered channel or semaphore plus a select with a default branch rejects work when full instead of blocking forever.</li>
<li><strong>Prefer pull over push.</strong> Pulling consumers (Kafka, SQS long polling) take work only when they have capacity, and the broker is a disk-backed buffer built for this.</li>
<li><strong>Admission control at the edge.</strong> Cap concurrency per instance, ideally with an adaptive limit that shrinks when latency rises (AIMD, as in TCP congestion control). Over the limit, reject fast with 503 or 429 and a Retry-After header.</li>
<li><strong>Respect deadlines.</strong> Propagate the caller's deadline, skip work that has already expired, and drop stale queue items.</li>
<li><strong>Prioritize.</strong> Separate queues and worker pools for critical and bulk traffic, and shed bulk first.</li>
<li><strong>Make clients cooperate.</strong> Honor Retry-After, back off exponentially with full jitter, and cap retries with a budget (say 10% of requests).</li>
<li><strong>Close the loop across queues.</strong> A Kafka producer never feels consumer lag. Watch lag and throttle intake explicitly, for example with a per-tenant cap on pending work.</li>
</ol>
<h4>Numbers to know</h4>
<ul>
<li>Queueing delay explodes near full utilization. In a simple single-server queue (M/M/1), time in system = service time / (1 - utilization): 2x the service time at 50% busy, 10x at 90%, 100x at 99%. Keep peak utilization well below 100%.</li>
<li>Little's law: wait = backlog / drain rate. 100,000 queued messages drained at 1,000 per second means new work waits 100 seconds.</li>
</ul>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Big buffers trade errors for latency. A request that waited 30 seconds is often as useless as a rejected one, and it cost you resources.</li>
<li>Blocking a producer spreads the stall upstream. Somewhere, usually at the edge, backpressure must become a fast, explicit rejection.</li>
<li>Retries without budgets can cause a metastable failure: retry load alone keeps the system overloaded after the original trigger is gone.</li>
<li>Static limits go stale as code and hardware change. Use adaptive limits or re-check them with regular load tests.</li>
</ul>
<h4>Example</h4>
<p>A customer submits 2 million marketing SMS through the API while OTP traffic keeps flowing. The API accepts messages into a durable per-account queue with a cap on pending messages. Past the cap, bulk submissions get 429 with Retry-After. OTP and bulk traffic use separate queues and worker pools. Send workers pull at the rate each carrier connection allows, using a token bucket per connection. When a carrier slows down or returns throttling errors, workers cut their send rate and the queue absorbs the difference. OTPs that waited longer than their validity window are expired, not sent late.</p>`,
    followups: [
      `How would you choose a concurrency limit for a service, and could it adapt automatically?`,
      `Kafka consumers are 30 minutes behind. Should that pressure reach the public API, and how?`,
      `How do you stop client retries from turning a slowdown into an outage?`
    ],
    related: ["c8", "r3", "r2"]
  },

  c8: {
    tldr: `Layer defenses: rate-limit and shed at the edge, cap concurrency per dependency (bulkheads), fail fast with timeouts and circuit breakers, absorb bursts with queues and caches, and keep retries jittered and budgeted so they don't multiply the spike.`,
    body: `<h4>Core idea</h4>
<p>A spike rarely kills the service that receives it. It kills what sits behind it with fixed capacity: a database, a legacy service, a third-party API with a hard quota. Protecting a downstream means two things: it never receives more than it can handle, and when it slows down, callers back off instead of piling on.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Limit at the edge.</strong> A per-tenant token bucket at the gateway (for example 100 requests per second, burst 200) returns 429 with Retry-After before a request costs anything. Rejecting after auth, parsing, and a DB read wastes the capacity you meant to protect.</li>
<li><strong>Level load with a queue.</strong> Work that doesn't need an immediate answer goes on a queue, and consumers call the downstream at a rate it can sustain.</li>
<li><strong>Bulkheads.</strong> Give each dependency its own bounded pool of in-flight calls (say 50 to billing, 100 to routing) and fail fast when it's full. One slow dependency can then no longer tie up every worker.</li>
<li><strong>Timeouts and circuit breakers.</strong> Base timeouts on the dependency's p99 plus a margin. When errors cross a threshold (for example 50% of the last 20 calls), open the breaker and fail immediately for a cooldown, then let a few probe calls through (half-open) before closing it.</li>
<li><strong>Retry carefully.</strong> Only retryable errors (timeouts, 503, 429), at most 2-3 attempts, with full jitter: sleep = random(0, min(cap, base x 2^attempt)). A retry budget keeps retries a small fraction of traffic.</li>
<li><strong>Cache and coalesce.</strong> Cache hot reads with jittered TTLs, collapse concurrent identical requests into one call (Go's singleflight package), and serve stale data when the downstream fails.</li>
<li><strong>Let the downstream defend itself.</strong> It caps its own concurrency and rejects extra work with a fast 503 instead of queueing internally, dropping low-priority traffic first.</li>
<li><strong>Share hard quotas.</strong> If a partner allows 1,000 calls per second across all your pods, enforce it with one token bucket in Redis, not per-pod guesses.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Retry amplification: 3 attempts at each of 3 layers is up to 27 calls per user request. Retry at one layer only.</li>
<li>Autoscaling callers can hurt the downstream: 50 pods with 20 DB connections each is 1,000 connections.</li>
<li>Synchronized clients (cron jobs at the top of the minute, caches expiring together) create self-inflicted spikes. Add jitter.</li>
<li>A breaker shared by all tenants lets one tenant's bad requests cut off everyone. Scope breakers per dependency, and per tenant or endpoint when needed.</li>
<li>Fallbacks that never run in normal operation are often broken when needed. Test them.</li>
</ul>
<h4>Example</h4>
<p>A customer fires 50,000 OTP requests in a minute, and each needs a lookup from a routing service backed by one small database. The gateway's per-account token bucket caps the burst. Routing results are cached in Redis by number prefix with jittered TTLs, and singleflight collapses simultaneous lookups for the same prefix. Send workers hold at most 100 concurrent calls to the routing service. If it slows down, the breaker opens and workers use the last cached route or a default one, while the routing service sheds anything above its concurrency limit with a fast 503.</p>`,
    followups: [
      `How do you choose timeout and circuit-breaker thresholds for a dependency?`,
      `A partner API allows 1,000 requests per second shared by 40 of your pods. How do you enforce that?`,
      `When should a caller serve stale data instead of returning an error?`
    ],
    related: ["c7", "r4", "r3"]
  },

  c9: {
    tldr: `Treat the API as a contract. Make only additive changes, have clients ignore what they don't know, keep internals out of responses, and leave room to grow (objects not bare values, open enums, cursors). Version only true breaks.`,
    body: `<h4>Core idea</h4>
<p>Once an API is public, every field, status code, default, and error string is something a client may depend on, documented or not (Hyrum's law). You can't see or redeploy client code, so evolution means making changes old clients can safely ignore. Most changes should ship without a new version.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Write down what counts as breaking</strong> (table below) and check every change against it in review.</li>
<li><strong>Leave room to grow.</strong> Return objects, not bare arrays, so you can add fields like next_cursor later. Send 64-bit IDs as strings, since JavaScript loses precision above 2^53. Use cursor pagination. Document enums as open: clients must handle unknown values.</li>
<li><strong>Use one error shape</strong> with a machine-readable code, like <code>{"error": {"code": "insufficient_balance", "message": "..."}}</code>. Clients branch on the code, never on the message text.</li>
<li><strong>Keep internals out.</strong> Don't expose column names, internal enums, or raw upstream errors. Map carrier errors to your own stable codes.</li>
<li><strong>Be strict on input, tolerant on output.</strong> Rejecting unknown request parameters surfaces client typos and keeps names free for later. Clients should ignore unknown response fields.</li>
<li><strong>Automate the check.</strong> Keep an OpenAPI spec and run a breaking-change diff (for example oasdiff) in CI. For internal APIs, consumer-driven contract tests (Pact) catch breaks before deploy.</li>
</ol>
<table>
<thead><tr><th>Usually safe</th><th>Breaking</th></tr></thead>
<tbody>
<tr><td>New endpoint or response field</td><td>Removing or renaming a field or endpoint</td></tr>
<tr><td>New optional request field that defaults to old behavior</td><td>New required field, or optional becoming required</td></tr>
<tr><td>Looser validation</td><td>Stricter validation, or different status or error codes for existing cases</td></tr>
<tr><td>New enum value, if clients were told to expect unknowns</td><td>Changing a type, format, unit, default, or meaning</td></tr>
</tbody>
</table>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Clients rely on undocumented behavior: sort order, error text, timing. Changing these can break someone even when the schema is identical.</li>
<li>New enum values and webhook event types break clients with strict parsing or exhaustive switches. Announce them ahead of time.</li>
<li>Versioning every change fragments clients and multiplies the code you maintain.</li>
</ul>
<h4>Example</h4>
<p>A send-SMS API returns status values queued, sent, delivered, and failed. You want to add undelivered for carrier rejections. Because the docs said statuses are open, you announce it with a date and ship it, and SDKs map unknown values to a generic unknown case. Later you want multiple recipients per request. Changing dst from a string to an array would break every client, so you add an optional recipients array, keep dst working, and reject requests that set both.</p>`,
    followups: [
      `Is adding a value to a response enum a breaking change? How would you roll it out?`,
      `How would you detect breaking changes automatically before they ship?`,
      `Should the server reject or ignore unknown request fields, and why?`
    ],
    related: ["p2", "p6", "e6"]
  },

  c10: {
    tldr: `Clients send an idempotency key per operation. Store it with a request hash and the response under a unique constraint, in the same transaction as the write, so retries replay the original result instead of repeating the side effect.`,
    body: `<h4>Core idea</h4>
<p>A timeout doesn't tell the client whether the work happened. The server may have failed, or it may have succeeded and only the response was lost. So clients retry, and without idempotency a retry sends a second SMS or charges twice. An idempotent operation has the same effect whether it runs once or many times. GET, PUT, and DELETE are defined as idempotent in HTTP (if you implement them that way). POST is not, so you add it explicitly.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Client:</strong> generate a unique key (a UUID) per logical operation, send it in an Idempotency-Key header, and reuse it on every retry. The server scopes keys per account.</li>
<li><strong>Store:</strong> a table with a primary key on (account_id, idem_key), plus request_hash, status (in_progress or completed), response_code, response_body, locked_until, and created_at.</li>
<li><strong>Claim atomically:</strong> INSERT ... ON CONFLICT DO NOTHING with status in_progress. If your insert won, you own the operation. Never check-then-insert: two concurrent retries would both pass the check.</li>
<li><strong>On conflict, read the row.</strong> Different request_hash: 422, the key was reused for a different request. Completed: replay the stored status and body. In progress: 409, so the client retries shortly.</li>
<li><strong>Record the result in the same transaction as the business write</strong> (insert the message and mark the key completed together). Separate commits mean a crash in between leaves a duplicate or a lost result.</li>
<li><strong>External side effects</strong> (carrier, payment provider) can't join your transaction. Commit the intent and key together, then let an outbox worker make the call, passing your own ID as the provider's idempotency key or reference when it supports one.</li>
<li><strong>Failures and expiry.</strong> If an attempt failed before doing any work, delete the key so a retry can run. If a worker died mid-way, locked_until lets a later retry take over. Expire keys after a window such as 24 hours.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li><strong>Redis alone is not enough.</strong> SET key value NX EX 86400 is a fast first check, but Redis replication is asynchronous, so a failover can lose keys. For messages or money, the database constraint is the source of truth.</li>
<li><strong>Hash a canonical body</strong> (sorted keys, normalized values), or harmless differences look like key reuse.</li>
<li><strong>Retries after expiry are new requests.</strong> Keep keys longer than any client's retry horizon.</li>
<li><strong>An idempotent API is not exactly-once downstream.</strong> A worker that crashes after the carrier accepted a message, but before recording it, can resend. Close the gap with downstream dedupe or reconciliation.</li>
<li><strong>Natural idempotency is often simpler:</strong> client-chosen IDs as primary keys, conditional updates (UPDATE ... WHERE status = 'queued'), and consumer inbox tables keyed by message ID.</li>
</ul>
<h4>Example</h4>
<p>A client sends POST /v1/messages with an idempotency key. The server claims the key, inserts the message and an outbox row, marks the key completed with the 202 response, and commits once. The response is lost on a flaky mobile network, so the client retries with the same key. The insert conflicts, the row is completed, and the server replays the same 202 and message ID. No second SMS goes out. A retry that arrives while the first attempt is still running gets 409. The same key with a different destination number gets 422.</p>`,
    followups: [
      `What should the server return if a retry arrives while the first attempt is still running?`,
      `How do you make a call to an external provider safe to retry if it doesn't support idempotency keys?`,
      `How long should you keep idempotency keys, and what happens when a retry arrives after expiry?`
    ],
    related: ["a3", "t4", "r3"]
  },

  p1: {
    tldr: `Draw boundaries around business capabilities that own their data and change together, so each service can be changed and deployed alone. A good boundary has a small, stable interface, and no other service touches its tables.`,
    body: `<h4>Core idea</h4>
<p>Aim for high cohesion inside a service and loose coupling between services. A boundary is right when most changes stay inside one service. Domain-driven design calls these areas bounded contexts: places where a term has one meaning. A "message" in the messaging context is not the same thing as a usage record in billing, even when both describe the same SMS.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Start from business capabilities, not layers:</strong> Numbers, Messaging, Billing, Identity. Not a "database service" or a "validation service".</li>
<li><strong>Give every piece of data exactly one owner.</strong> Only the owner writes it. Others call the owner's API, or consume its events and keep a local read copy.</li>
<li><strong>Keep atomic things together.</strong> If two pieces of data must change in one transaction (a balance and its ledger entry), they belong in one service. Data that can be eventually consistent can live apart.</li>
<li><strong>Check change coupling.</strong> Look at recent features. If most of them touched the same two services, the line is in the wrong place.</li>
<li><strong>Watch the call pattern.</strong> Ten calls to render one page, or calls in a loop, mean the split cuts through a single capability.</li>
<li><strong>Match teams.</strong> One team owns a service end to end (Conway's law). A service owned by three teams has no owner.</li>
<li><strong>Write the contract down:</strong> API spec (OpenAPI or protobuf), events published, SLOs, and what the service will not do.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Too fine: chatty APIs, distributed transactions, and more latency. Too coarse: teams collide, and one bug has a big blast radius.</li>
<li>Smells: two services writing the same table, lockstep deploys, circular calls (A calls B calls A), and a shared "common" service everything depends on.</li>
<li>Copying data into read models is the price of autonomy. Accept eventual consistency there, and decide who fixes drift.</li>
<li>Boundaries drift as the product changes. Revisit them when change coupling rises.</li>
</ul>
<h4>Example</h4>
<p>A CPaaS splits into Numbers (search, buy, and release phone numbers; owns the inventory), Messaging (accept, route, and track messages), and Billing (rate and charge usage). Messaging must check that an account owns the sender number. Instead of joining Numbers' tables, Numbers publishes NumberAssigned and NumberReleased events, and Messaging keeps a local account-to-number map. Billing consumes MessageSent events to rate usage. The pre-send balance check stays a synchronous call to Billing, because it has to be current.</p>`,
    followups: [
      `Two services need the same customer data. Who owns it, and how does the other service get it?`,
      `How would you tell, after launch, that a service boundary is in the wrong place?`,
      `One business operation must update data owned by two services. What are your options?`
    ],
    related: ["c1", "e5", "t3"]
  },

  p2: {
    tldr: `Version only for breaking changes. Use one visible scheme (a URL path like /v1/ is simplest), keep additive changes unversioned, support old versions for a published window, and track usage per version.`,
    body: `<h4>Core idea</h4>
<p>A version is a promise that requests written against it keep working the same way. New versions cost you (more code to run and test) and your customers (migration work), so bump only for breaking changes. Additive changes, such as new endpoints and optional fields, ship into the current version.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Define "breaking" in writing:</strong> removed or renamed fields, type or format changes, new required parameters, changed defaults or meaning, changed status or error codes.</li>
<li><strong>Choose one scheme</strong> (table below). For a public REST API used through SDKs, a major version in the path is the common choice: explicit, easy to route at the gateway, and visible in every log line.</li>
<li><strong>Build old versions as thin adapters.</strong> Keep one core implementation and translate old requests and responses at the edge. Forked codebases per version rot.</li>
<li><strong>Version webhooks and SDKs too.</strong> Put a version in webhook payloads and let each account choose which one it receives.</li>
<li><strong>Publish a support policy,</strong> for example at least 12 months of support after a successor ships, and send Deprecation and Sunset headers on old versions.</li>
<li><strong>Measure</strong> traffic per version, account, and SDK version (from User-Agent). You can't retire what you can't see.</li>
</ol>
<table>
<thead><tr><th>Scheme</th><th>Example</th><th>Pros</th><th>Cons</th></tr></thead>
<tbody>
<tr><td>URL path</td><td>/v1/messages</td><td>Obvious, easy to route and test with curl</td><td>Coarse: the whole API bumps together</td></tr>
<tr><td>Header</td><td>API-Version: 2</td><td>Clean URLs</td><td>Easy to miss in logs and debugging</td></tr>
<tr><td>Query param</td><td>?version=2</td><td>Easy to add</td><td>Easy to drop, clutters every URL</td></tr>
<tr><td>Dated, pinned per account</td><td>2025-01-15</td><td>Small breaks, each one opt-in</td><td>Needs a chain of transforms per version</td></tr>
</tbody>
</table>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Every live version is code to test, secure, and document. Aim for at most two active majors.</li>
<li>If a request has no version, don't serve "latest". Pin it to the account's version, or your next release silently breaks it.</li>
<li>Semantic versioning (major.minor.patch) fits SDKs. HTTP API clients only care about the major.</li>
</ul>
<h4>Example</h4>
<p>A messaging API is on /v1/. You want per-segment pricing in the response. Instead of changing the existing units field (a type change), you add a new segments field to v1. Only when several true breaks pile up, such as a new auth model and renamed resources, do you cut /v2/. Then v1 becomes an adapter over the v2 core, every v1 response carries Deprecation and Sunset headers, and accounts with v1 traffic get direct notice.</p>`,
    followups: [
      `How would you support v1 and v2 without maintaining two copies of the business logic?`,
      `What should the API do when a request doesn't specify a version?`,
      `How do you version webhook payloads that you push to customers?`
    ],
    related: ["c9", "p7", "p8"]
  },

  p3: {
    tldr: `Rate limits cap short-term throughput per tenant (a token bucket in Redis, checked at the gateway, 429 with Retry-After). Quotas cap usage over long windows and are counted durably. Configure both per plan with per-tenant overrides.`,
    body: `<h4>Core idea</h4>
<p>These are two tools. A <strong>rate limit</strong> protects the system and keeps tenants fair right now ("100 requests per second per account"). It runs on the hot path and can be slightly approximate. A <strong>quota</strong> enforces a business limit over time ("1 million messages a month", "50 concurrent calls"). It must be accurate and durable, and it is often tied to billing.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Pick the algorithm.</strong> A token bucket (refill r tokens per second up to b) allows bursts up to b and averages r, which suits most APIs. GCRA is an equivalent that stores one timestamp per key. Fixed windows (INCR a per-minute key) are simple but allow 2x bursts at window edges.</li>
<li><strong>Layer the keys:</strong> per account, per API key, per endpoint class (expensive search endpoints get lower limits), and per resource such as a sender number.</li>
<li><strong>Store limits per plan with per-tenant overrides</strong> in the database, cached in the gateway for 30-60 seconds, so changing a limit needs no deploy.</li>
<li><strong>Enforce at the gateway</strong> with a Redis Lua script that refills and decrements atomically in one round trip.</li>
<li><strong>Tell clients.</strong> Return 429 with Retry-After and headers like X-RateLimit-Remaining. For an exhausted monthly quota, use a distinct code such as quota_exceeded and no short Retry-After.</li>
<li><strong>Count quotas durably.</strong> A Redis counter serves the hot path and is reconciled against the billing record. For prepaid balance, reserve before sending and refund on failure.</li>
<li><strong>Concurrency quotas</strong> (active calls) need a counter taken at start and released at end, plus a lease that expires, so a crashed call can't hold a slot forever.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>A central Redis check adds a dependency. Local per-instance limiters (limit divided by instance count) avoid it but drift when traffic is uneven.</li>
<li>Pick a failure mode: usually fail open with a local fallback for rate limits, and fail closed for paid quotas and fraud limits.</li>
<li>Count retries and failed requests, or abusive clients retry for free.</li>
<li>Gateway limits don't stop one tenant's queued backlog from hogging workers. Add per-tenant fair scheduling in queues.</li>
</ul>
<h4>Example</h4>
<p>A CPaaS plan allows 100 send requests per second per account with bursts of 300, a trial quota of 1,000 messages a month, and 50 concurrent calls. When the burst is spent, the gateway returns 429 with Retry-After: 1. Send workers pace each sender number at the rate carriers or regulations allow. A call slot is taken when a call starts and released at hangup, and the voice server renews its lease every minute, so a crashed server's slots free up quickly. A big launch gets a temporary override row with an expiry date.</p>`,
    followups: [
      `How would you enforce one per-tenant limit across 30 gateway instances without a Redis call on every request?`,
      `Should the limiter fail open or fail closed when Redis is down? Does the answer change for quotas?`,
      `How would you stop one tenant's huge backlog from delaying other tenants' messages in a shared queue?`
    ],
    related: ["k8", "c8", "d8"]
  },

  p4: {
    tldr: `Assume any call can fail or time out after succeeding. Classify each dependency as required, optional, or deferrable. Use deadlines and idempotent retries, and for multi-step writes use sagas with compensation, an outbox, and reconciliation.`,
    body: `<h4>Core idea</h4>
<p>A remote call has three outcomes: success, failure, and unknown (a timeout or reset after the request was sent). "Service B is down" is the easy case: fail fast or degrade. The hard cases are "B timed out, did it do the work?" and "A and B succeeded, C failed". You can't commit across services atomically without two-phase commit, so make every step retryable, reversible, or checkable later.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Classify each dependency.</strong> Required (auth, balance): fail the request with a clear error. Optional (enrichment such as a carrier-name lookup): short timeout, then continue without it or with a cached value. Deferrable (webhooks, analytics): don't call inline; write to an outbox or queue.</li>
<li><strong>Use deadlines, not just timeouts.</strong> The edge sets a total budget (say 2 seconds) and each hop passes on what's left. In Go, gRPC carries the context deadline across calls, and callees stop when it expires.</li>
<li><strong>Retry safely:</strong> only retryable errors, only idempotent operations or ones with idempotency keys, with backoff and jitter, at a single layer.</li>
<li><strong>Use a saga for multi-step writes:</strong> a sequence of local transactions, each with a compensating action. An orchestrator persists the saga's state (a workflow table, or an engine like Temporal) so a crash resumes instead of restarting. Choreography, where services react to each other's events, suits short flows but gets hard to follow.</li>
<li><strong>Order steps by reversibility:</strong> reversible steps first, then the one irreversible pivot, then steps that are safe to retry until they succeed.</li>
<li><strong>Commit state and events together</strong> with a transactional outbox.</li>
<li><strong>Resolve unknowns.</strong> Query the downstream by the reference you sent. If it's still unclear, park the item in a pending state for a reconciliation job that compares both sides.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Compensation is not rollback. You can't unsend an SMS, only refund it, so put irreversible steps as late as possible.</li>
<li>Intermediate states are visible (money reserved but not charged). Make them explicit states like pending.</li>
<li>A caller timeout shorter than the callee's work triggers retries while the first attempt still runs. Without idempotency, that means duplicates.</li>
<li>Fan-out magnifies tails: if each of 10 parallel calls is slow 1% of the time, about 10% of requests are slow.</li>
<li>Fallback paths that rarely run are often broken. Exercise them with fault injection.</li>
</ul>
<h4>Example</h4>
<p>Buying a phone number takes four steps: reserve it with an upstream provider (undo: release), charge the account (undo: refund), confirm the purchase with the provider (the irreversible pivot), then assign it and configure routing (internal, idempotent, retried until done). An orchestrator records each step. If the charge fails, it releases the reservation. If the confirm call times out, it doesn't blindly retry; it looks up the order by the reference it sent. If that's still unclear, the order goes to pending_verification, the customer sees "processing", and a reconciliation job settles it. The charge uses an idempotency key derived from the order ID, so no retry can bill twice.</p>`,
    followups: [
      `Would you use orchestration or choreography for this saga, and why?`,
      `A downstream call timed out and the operation isn't idempotent. What do you do?`,
      `How would you test that your compensation and fallback paths actually work?`
    ],
    related: ["t3", "t4", "r2"]
  },

  p5: {
    tldr: `Keep the gateway thin: only cross-cutting concerns (TLS, auth, rate limits, routing, observability), driven by declarative config that each service owns, with no business logic. Then services and gateway deploy on separate schedules.`,
    body: `<h4>Core idea</h4>
<p>Every request passes through the gateway, so it attracts logic: "just add this check here". Each addition ties a gateway release to a service release and makes the gateway team a bottleneck. Independence comes from a clear split. The gateway enforces generic policy, services own domain logic, and the contract between them is route config plus a few standard headers.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Fix the gateway's job list:</strong> TLS termination, authentication, rate limits, request size limits, routing, request IDs and trace context, access logs and metrics. Not on it: business validation, orchestrating several services, or reshaping responses per client.</li>
<li><strong>Pass identity as trusted context.</strong> After auth, the gateway strips any client-supplied copies of internal headers and sets its own (account ID, scopes), or attaches a short-lived signed token that services verify. Services never re-parse API keys.</li>
<li><strong>Make routes declarative and service-owned.</strong> Each service keeps a route manifest (path prefix, upstream, auth policy, rate-limit class, timeout) in its repo. CI validates it, and the gateway loads it without a gateway deploy (Envoy xDS, Kubernetes Gateway API routes, Kong declarative config).</li>
<li><strong>Add features as opt-in policies.</strong> A new capability, such as per-account IP allowlists, ships once as a generic policy that routes can enable.</li>
<li><strong>Treat the gateway-to-service contract as an API.</strong> Add headers and claims additively, and have services ignore ones they don't know.</li>
<li><strong>Roll out carefully.</strong> The gateway has the biggest blast radius in the system. Canary a small share of traffic, keep the last known-good config, and make rollback one step.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Business logic creep turns the gateway into a second monolith that every team waits on.</li>
<li>Per-client response shaping belongs in a backend-for-frontend (BFF) service behind the gateway.</li>
<li>Services that trust identity headers must be reachable only through the gateway (network policy or mTLS). Otherwise anything inside the network can spoof an account.</li>
<li>One bad config push can break every route. Validate in CI and reject invalid config at load time.</li>
</ul>
<h4>Example</h4>
<p>A CPaaS public API routes /v1/messages to messaging, /v1/calls to voice, and /v1/numbers to numbers. The gateway validates the API key, resolves the account, applies its rate-limit class, adds a request ID and the trusted account header, and forwards by prefix. When the voice team adds a call-recording endpoint, they merge a route entry in their own repo, CI checks it, and the gateway picks it up in seconds. Nobody touches gateway code. When the platform team adds IP allowlists, it ships once as a policy, with no service redeploys.</p>`,
    followups: [
      `How do services trust identity information that the gateway adds?`,
      `Where would you put logic that combines data from three services for one mobile screen?`,
      `How would you roll out a risky gateway change without risking every API at once?`
    ],
    related: ["p1", "p3", "c2"]
  },

  p6: {
    tldr: `Assume old and new code, and old and new data, exist at the same time. Make changes additive (optional fields with defaults), run expand, migrate, contract as separate deploys, and enforce compatibility with a schema registry or CI checks.`,
    body: `<h4>Core idea</h4>
<p>A schema change is never atomic across a real system. During a rolling deploy, old and new code run side by side. Topics hold messages from old producers, tables hold rows written years ago, and clients upgrade when they like.</p>
<ul>
<li><strong>Backward compatible:</strong> new readers can read data written with the old schema.</li>
<li><strong>Forward compatible:</strong> old readers can read data written with the new schema, ignoring what they don't know.</li>
</ul>
<p>When producers and consumers deploy in any order, you need both (full compatibility).</p>
<h4>How to do it</h4>
<ol>
<li><strong>Additive changes only.</strong> New fields are optional with a sensible default. Never rename a field or change its type in place: add a new field, migrate, and remove the old one later.</li>
<li><strong>Never reuse a removed field.</strong> In Protobuf, field numbers are the wire identity, so mark removed ones reserved.</li>
<li><strong>Readers ignore unknown fields.</strong> Protobuf does this by default. For JSON event consumers, avoid DisallowUnknownFields in Go and extra="forbid" in Pydantic.</li>
<li><strong>Enforce it automatically.</strong> A schema registry (such as Confluent Schema Registry in BACKWARD or FULL mode) rejects incompatible schemas, and buf breaking does the same for Protobuf in CI.</li>
<li><strong>Databases use expand, migrate, contract.</strong> Add the new column as nullable or with a constant default (no table rewrite in Postgres 11+). Deploy code that writes both. Backfill in batches. Switch reads behind a flag. Stop writing the old column, then drop it in a later release. Each step is its own deploy and can be rolled back.</li>
<li><strong>Deploy readers before writers.</strong> Consumers that understand the new format go out everywhere before any producer writes it.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>If new code writes data old code can't read, you can't roll back. That's why "can read" ships before "writes".</li>
<li>Decide what "absent" means. Missing, null, and 0 can mean different things, and mixing them causes silent bugs.</li>
<li>Long-retention topics and backups keep old formats for months. Readers must handle them until they age out.</li>
</ul>
<h4>Example</h4>
<p>Delivery-receipt events carry an integer error_code. You want a structured error with a code, the raw carrier code, and a description. First add an optional error object next to error_code. Then deploy consumers that prefer error when present and fall back to error_code. Then deploy producers that write both. Once every consumer uses the new field and old events have aged out of the topic's 7-day retention, stop writing error_code and mark it deprecated. The registry would reject any attempt to simply change error_code's type.</p>`,
    followups: [
      `In what order do you deploy producers and consumers when an event schema changes, and why?`,
      `How would you rename a column in a 500-million-row table without downtime?`,
      `What is an example of a change that is backward compatible but not forward compatible?`
    ],
    related: ["a2", "r7", "c9"]
  },

  p7: {
    tldr: `First try to avoid the break (make it additive). If you can't, run old and new side by side, migrate clients using usage data, gate with per-account opt-in, and cut over gradually with a rollback path.`,
    body: `<h4>Core idea</h4>
<p>A breaking change makes a working client fail or behave differently. Clients pay the cost, so your job is to make their migration small, optional for as long as possible, and reversible. Planned breaks let you set the timeline. Forced breaks (a security fix, a regulation, an upstream change) don't.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Look for a non-breaking path first.</strong> Add a new field or endpoint instead of changing an old one, accept both old and new input formats, or keep the old behavior as default and let clients opt in.</li>
<li><strong>Measure the blast radius.</strong> Find which accounts, API keys, and SDK versions used the behavior in the last 30-90 days. Often it's a short list you can contact directly.</li>
<li><strong>Run old and new in parallel,</strong> with the old behavior as an adapter over the new core so bugs get fixed once.</li>
<li><strong>Move accounts in stages with a per-account flag:</strong> opt-in for early adopters, then the new behavior as default for new accounts, then existing accounts in cohorts, small ones first. Every flip is reversible.</li>
<li><strong>Make migration cheap:</strong> a guide with before and after examples, SDKs that support both, warnings in responses and the dashboard, and a sandbox.</li>
<li><strong>Watch each cohort</strong> for errors and support tickets. Run brownouts (short, announced windows with the old behavior off) to find forgotten integrations before the final date.</li>
<li><strong>For forced breaks,</strong> keep the change narrow, contact affected accounts directly, and keep a short-lived per-account exception list if the constraint allows it.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Two code paths cost time. Set an end date or you'll maintain both forever.</li>
<li>A big-bang cutover with no per-account flag has no rollback except a redeploy.</li>
<li>Silent semantic changes (same field, new meaning) are the worst: nothing fails, results are just wrong. Make them loud with a new field name.</li>
<li>Internal consumers break too: data pipelines, analytics, and support tools often parse the same payloads.</li>
</ul>
<h4>Example</h4>
<p>A send-SMS API accepts numbers without a country code and guesses the country, which sometimes misroutes messages. You want to require E.164 format (a plus sign, country code, then the number). Logs show 4% of requests, from 120 accounts, use local formats. You add a warning field to those responses, release SDKs that normalize numbers, and email each account its own counts. New accounts get strict validation by default. Existing accounts flip in cohorts, each reversible by flag. Two weeks of short brownouts catch the last scripts, and then local formats get a clear invalid_number_format error.</p>`,
    followups: [
      `How would you find out exactly which customers depend on the behavior you want to change?`,
      `What is a brownout, and when is it too risky to run one?`,
      `A security fix must break some clients within a week. How do you handle it?`
    ],
    related: ["p8", "p2", "e8"]
  },

  p8: {
    tldr: `Deprecation is a staged process driven by usage data: announce a date, signal it in-band (Deprecation and Sunset headers, SDK warnings), track remaining usage per account, chase the stragglers, run brownouts, and remove only when usage is near zero.`,
    body: `<h4>Core idea</h4>
<p>Deprecated means "still works, but will stop on a known date". Sunset is the date it stops. The main risk is removing something people still depend on without knowing it, so the process is driven by usage data, not by the calendar alone.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Decide and document</strong> what is deprecated, why, the replacement, and the dates. Publish a minimum notice period (6-12 months is common for public APIs; internal ones can move faster).</li>
<li><strong>Instrument before announcing.</strong> Log each use with account, API key, and SDK version, and chart daily requests and distinct accounts.</li>
<li><strong>Announce everywhere:</strong> changelog, docs banner, dashboard notice, and email to accounts that actually used it, with their own numbers.</li>
<li><strong>Signal in-band.</strong> Send Deprecation and Sunset headers (Sunset carries the removal date) on every affected response, plus a link to the migration guide. Mark it deprecated in OpenAPI (deprecated: true) and Protobuf ([deprecated = true]) so generated code carries warnings.</li>
<li><strong>Stop new adoption.</strong> New accounts can't enable it, docs drop the examples, and the next SDK major removes it.</li>
<li><strong>Chase the long tail.</strong> Review usage weekly and have account managers contact the largest remaining users.</li>
<li><strong>Run brownouts.</strong> Schedule short, announced outages of the old feature (10 minutes, then an hour, then a day) that return a clear error pointing to the guide. They flush out forgotten cron jobs while rollback is instant.</li>
<li><strong>Remove.</strong> When usage is near zero or the last users have signed off, return 410 Gone with an error code naming the replacement, not a confusing 404. Delete the code later.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>A date with no usage data means you either break a big customer or extend forever.</li>
<li>Extending the global deadline again and again teaches customers that deadlines aren't real. Extend per account, with an expiry.</li>
<li>Internal callers (cron jobs, support tools, other teams) use deprecated endpoints too. Check internal traffic.</li>
<li>Never reuse a removed path or field name for something new; old clients will call it with old assumptions.</li>
</ul>
<h4>Example</h4>
<p>You retire an old bulk-send endpoint that takes a delimited string of numbers, in favor of a batch endpoint with per-recipient results. Month 0: announce a 9-month window and add Sunset headers and SDK warnings. Month 3: 140 accounts still use it, and each gets an email with its volume. Month 6: new accounts are blocked. Months 7-8: announced brownouts of 15 minutes, then 2 hours. Month 9: six accounts remain and get a 30-day per-account extension. After that, the endpoint returns 410 with a pointer to the new one.</p>`,
    followups: [
      `How do you decide how long a deprecation window should be?`,
      `A top-10 customer says they can't migrate before the sunset date. What do you do?`,
      `How would you deprecate a field inside a webhook payload rather than a whole endpoint?`
    ],
    related: ["p7", "p2", "e6"]
  }
});
