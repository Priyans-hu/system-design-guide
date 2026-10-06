window.HUB_DEEP = window.HUB_DEEP || [];
window.HUB_DEEP.push(
  {
    id: `circuit-breaker`,
    title: `Circuit breakers, timeouts, retries and bulkheads`,
    family: `Resilience`,
    summary: `A client-side stack that stops one slow or failing dependency from taking down its callers: timeouts bound waiting, capped retries with jitter absorb blips, bulkheads cap shared resources, and a breaker fails fast.`,
    problem: `A voice and SMS API calls a carrier gateway for every send. When the gateway slows down, request threads wait on it, connection pools run dry, and unrelated endpoints start failing too. Naive retries make it worse by multiplying load on the gateway exactly when it has the least spare capacity.`,
    how: [
      `<strong>Time out every remote call.</strong> Set both a connect timeout and a request timeout. AWS picks an acceptable false-timeout rate (such as 0.1%) and uses the matching latency percentile of the dependency (p99.9). Pass the remaining deadline downstream so nobody keeps working for a caller that already gave up.`,
      `<strong>Retry only what is safe.</strong> Retry transient failures (timeouts, 503s) on idempotent calls, or calls that carry an idempotency key. A timeout does not prove the send did not happen, and a 4xx will not succeed on a retry.`,
      `<strong>Back off with jitter, and cap it.</strong> Full Jitter waits <code>random(0, min(cap, base * 2^attempt))</code> so clients that failed together do not retry together. Google allows up to 3 attempts per request and retries only while retries are under 10% of a client's requests.`,
      `<strong>Retry at one layer.</strong> AWS's example: five layers that each retry 3 times can multiply load on the database at the bottom 243x. Retry in one place, usually the layer just above the one that failed.`,
      `<strong>Wrap the call in a breaker.</strong> Closed: calls pass and their outcomes fill a rolling window. When failures cross a threshold (a count or a rate) it opens, and calls fail at once without touching the dependency. After a cool-down it goes half-open and lets a few trial calls through: success closes it, failure opens it again.`,
      `<strong>Isolate with bulkheads.</strong> Give each dependency its own bounded pool (a connection pool, a worker pool, or a semaphore around goroutines) so a stuck gateway can use up only its own slots, not the whole service.`,
      `<strong>Decide the open-state answer and watch it.</strong> Return a clear error right away, or queue work that can wait. Log every breaker state change and alert on it.`
    ],
    diagram: {
      layers: [
        { name: `Caller`, items: [[`Send API`, `POST /messages handler`]] },
        { name: `Client-side protection`, items: [[`Retry with backoff`, `max 3 tries, jittered waits`], [`Circuit breaker`, `closed, open, half-open`], [`Bulkhead and timeout`, `own pool, per-try deadline`]] },
        { name: `Dependency`, items: [[`Carrier gateway`, `slow or failing`], [`Fail-fast response`, `503 now, or queue the send`]] }
      ],
      edges: [
        [`Send API`, `Retry with backoff`, `sync`, `call with overall deadline`],
        [`Retry with backoff`, `Circuit breaker`, `sync`, `each attempt`],
        [`Circuit breaker`, `Bulkhead and timeout`, `sync`, `if closed or half-open`],
        [`Bulkhead and timeout`, `Carrier gateway`, `sync`, `pooled call`],
        [`Circuit breaker`, `Fail-fast response`, `sync`, `if open`]
      ],
      paths: [
        { name: `Healthy call`, nodes: [`Send API`, `Retry with backoff`, `Circuit breaker`, `Bulkhead and timeout`, `Carrier gateway`], note: `Each try takes a pool slot and a deadline, and its result feeds the breaker's rolling window.` },
        { name: `Gateway failing`, nodes: [`Send API`, `Retry with backoff`, `Circuit breaker`, `Fail-fast response`], note: `The breaker is open, so calls fail at once instead of holding threads for a full timeout; the retry layer must not retry this error.` }
      ]
    },
    variants: [
      [`Count or time window`, `The breaker judges the last N calls or the last N seconds. Either way, require a minimum number of calls first, so 2 failures out of 3 calls on a quiet night do not trip it.`],
      [`Slow-call breaker`, `Trips on the share of calls slower than a threshold, not only on errors (resilience4j supports both). Use it when the dependency degrades by getting slow rather than by failing.`],
      [`Retry token bucket`, `Instead of a breaker, allow retries while tokens remain, then retry only at a fixed low rate. AWS prefers this to breakers, which add a hard-to-test on/off mode and can slow recovery, and built it into its SDKs in 2016.`],
      [`Adaptive client throttling`, `Each client tracks requests sent and requests accepted over the last two minutes. Once requests exceed K times accepts (Google prefers K = 2), it rejects a share of new requests locally, before they reach the backend.`]
    ],
    alternatives: [
      [`load-shedding-backpressure`, `Load shedding`, `When the danger is your own server drowning in incoming work: the server rejects the excess. A breaker only protects a caller from its dependency.`],
      [`rate-limiting`, `Rate limiting`, `When each client should get a fixed share by agreement, whether or not anything is failing.`],
      [``, `Queue and retry later`, `When the caller does not need the answer now (webhook delivery, bulk sends): enqueue, retry from workers with backoff, and park poison messages in a dead-letter queue.`],
      [``, `Hedged requests`, `When tail latency, not failure, is the problem and the call is idempotent: send a second copy after a short delay and cancel whichever loses.`]
    ],
    pitfalls: [
      `<strong>Retry storms.</strong> Every layer retries on its own, the bottom sees the product of all attempts, and the extra load keeps it down long after the first fault is gone. Retry in one place and budget it.`,
      `<strong>Double sends.</strong> A timed-out send may have gone through. Retrying without an idempotency key sends the SMS twice and bills it twice.`,
      `<strong>Timeouts set by guesswork.</strong> Too long and threads pile up anyway; too short and normal tail latency turns into retries that add load. Some clients also leave DNS lookups or TLS handshakes outside the timer.`,
      `<strong>A breaker nobody has tested.</strong> The open state runs rarely, so it and its fallback break the first time they are needed, and AWS notes breakers can lengthen recovery. Exercise the open path in tests and game days.`,
      `<strong>Wrong scope or wrong errors.</strong> One breaker for a whole dependency trips for every tenant when a single bad host or tenant fails. Scope breakers to what fails together, and never count caller mistakes (4xx validation errors) as failures.`
    ],
    use: `Any synchronous call to something that can be slow or down: carrier gateways, payment providers, other internal services. Timeouts always; retries for transient errors on idempotent calls; breakers and bulkheads once one dependency can hurt unrelated traffic.`,
    avoid: `Skip the breaker for cheap local calls, or where one failure says nothing about the next call (a 404 for one key). For work that can wait, prefer a queue with retries over synchronous retries. When your own server is the thing overloaded, shed load instead.`,
    interview: [
      `Walk through the three breaker states. What sends a half-open breaker back to open?`,
      `Your API calls three downstreams and one gets slow. How do you stop it from taking the other two paths down with it?`,
      `Why add jitter to exponential backoff, and where in a five-service chain should retries live?`,
      `A send call timed out. Is it safe to retry, and what do you need first?`
    ],
    related: [`r4`, `r3`, `p4`],
    sources: [
      { t: `CircuitBreaker`, by: `Martin Fowler`, url: `https://martinfowler.com/bliki/CircuitBreaker.html` },
      { t: `Timeouts, retries, and backoff with jitter`, by: `Marc Brooker, Amazon Builders' Library`, url: `https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter` },
      { t: `Handling Overload (SRE book, ch. 21)`, by: `Alejandro Forero Cuervo, Google`, url: `https://sre.google/sre-book/handling-overload/` },
      { t: `Bulkhead pattern`, by: `Microsoft Azure Architecture Center`, url: `https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead` }
    ]
  },
  {
    id: `rate-limiting`,
    title: `Rate limiting`,
    family: `Resilience`,
    summary: `Cap how many requests each client (API key, account, IP) may make in a time window, and reject or delay the excess, so one caller cannot starve others or run up costs.`,
    problem: `A public SMS API is shared by thousands of accounts. One integration stuck in a retry loop, or a script firing OTPs, can eat capacity meant for everyone and run up carrier bills. The limit has to be checked cheaply on every request, across many API servers.`,
    how: [
      `<strong>Pick the key and the limit.</strong> Usually API key or account, sometimes account plus endpoint, with tighter limits on expensive endpoints. State each limit as a steady rate plus a burst allowance.`,
      `<strong>Pick an algorithm.</strong> A token bucket holds up to b tokens and refills r per second; each request takes one. Short bursts pass while the long-run rate stays at r. Stripe uses token buckets stored in Redis.`,
      `<strong>Keep state where every API server sees it.</strong> Use a shared Redis and make check-and-update one atomic step (<code>INCR</code>, or a Lua script for token buckets). A GET, then a check, then a SET from the app lets concurrent requests slip through.`,
      `<strong>Reject clearly.</strong> Over the limit, return HTTP 429 Too Many Requests with a <code>Retry-After</code> header, and expose the remaining quota in response headers so good clients can pace themselves.`,
      `<strong>Decide what happens when the limiter breaks.</strong> Stripe catches every limiter error and fails open, so a bug or a Redis outage never blocks traffic, and keeps a kill switch for each limiter.`,
      `<strong>Launch in shadow mode.</strong> Dark launch each new limit: log who would have been blocked, tune the threshold, then enforce.`
    ],
    diagram: {
      layers: [
        { name: `Clients`, items: [[`Well-behaved app`, `steady traffic`], [`Runaway script`, `retry loop, burst`]] },
        { name: `API gateway`, items: [[`Rate limiter`, `token bucket per API key`]] },
        { name: `Limiter store`, items: [[`Redis`, `atomic refill-and-take script`]] },
        { name: `Service`, items: [[`Send SMS service`, `does the real work`]] }
      ],
      edges: [
        [`Well-behaved app`, `Rate limiter`, `sync`, `requests`],
        [`Runaway script`, `Rate limiter`, `sync`, `burst; gets 429 + Retry-After`],
        [`Rate limiter`, `Redis`, `data`, `take a token`],
        [`Rate limiter`, `Send SMS service`, `sync`, `allowed requests`]
      ],
      paths: [
        { name: `Within limit`, nodes: [`Well-behaved app`, `Rate limiter`, `Send SMS service`], note: `The bucket has tokens, so one atomic Redis call takes one and the request goes through.` },
        { name: `Over limit`, nodes: [`Runaway script`, `Rate limiter`, `Redis`], note: `The bucket is empty, so the gateway answers 429 with Retry-After and the service never sees the request.` }
      ]
    },
    variants: [
      [`Token bucket (and GCRA)`, `Refill r tokens per second up to b. Allows bursts of b while holding the average to r; the usual default for APIs. GCRA is a leaky-bucket variant that stores just one timestamp per key.`],
      [`Fixed window counter`, `One counter per key per window: <code>INCR</code> plus <code>EXPIRE</code>. Cheapest and simplest, but a client can spend a full limit at the end of one window and another at the start of the next.`],
      [`Sliding window counter`, `Weight the previous window by how much of it still overlaps: <code>42 * (45/60) + 18 = 49.5</code> requests in the last minute. Cloudflare found only 0.003% of 400 million requests wrongly allowed or limited.`],
      [`Concurrency limit`, `Cap requests in flight rather than per second ("only 20 API requests in progress at the same time" at Stripe). Best for slow, CPU-heavy endpoints where rate alone does not bound load.`]
    ],
    alternatives: [
      [`load-shedding-backpressure`, `Load shedding`, `When the risk is total server load rather than one client's share: shed by priority based on the server's own health, even for clients under quota.`],
      [`circuit-breaker`, `Client-side breakers and retry budgets`, `When you are the caller and need to stop hammering a dependency that is already failing.`],
      [``, `Queue and drain`, `When requests can wait (bulk campaign sends): accept them into a queue and drain at the carrier's rate instead of rejecting.`],
      [``, `Usage quotas`, `When the limit is per day or month (plan allowances): count durably in a database and bill or block on it, not in a short-lived bucket.`]
    ],
    pitfalls: [
      `<strong>Read-then-write races.</strong> Separate GET and SET calls let concurrent requests all pass the check. Even <code>INCR</code> then <code>EXPIRE</code> as two calls can leak a key forever if the second never runs; wrap them in MULTI/EXEC or a Lua script.`,
      `<strong>Window-edge bursts.</strong> A fixed window lets a client send a full limit at 11:59:59 and another at 12:00:00. Use a token bucket or a sliding window when bursts hurt.`,
      `<strong>The limiter becomes the outage.</strong> Every request now depends on Redis. Fail open, keep a local fallback limit, put a tight timeout on the limiter call, and alert on its errors.`,
      `<strong>Limiting by IP.</strong> Many users share one IP behind NAT or a corporate proxy, while a botnet spreads across many IPs. Limit by API key or account, and keep IP limits for unauthenticated endpoints.`,
      `<strong>Clients that retry 429s at once.</strong> Without Retry-After and client-side backoff, blocked clients hammer the limiter. Document the limits and always send Retry-After.`
    ],
    use: `Every public or multi-tenant API: per-key limits for fairness and abuse control, tighter limits on expensive endpoints (sends, exports, search), and OTP or login endpoints limited per account and per destination number.`,
    avoid: `Limits are per client, so many clients each under their limit can still overload the server; pair rate limits with load shedding. Inside a batch pipeline, use queue backpressure instead of 429s.`,
    interview: [
      `Design a rate limiter for an API running on 50 servers. Where does the state live, and how is the check atomic?`,
      `Token bucket or sliding window: which lets bursts through, and when do you want that?`,
      `The Redis behind your limiter goes down. What does your API do?`,
      `How would you limit OTP sends so a script cannot drain your carrier budget, without blocking real users?`
    ],
    related: [`k8`, `p3`, `c8`],
    sources: [
      { t: `Scaling your API with rate limiters`, by: `Paul Tarjan, Stripe`, url: `https://stripe.com/blog/rate-limiters` },
      { t: `How we built rate limiting capable of scaling to millions of domains`, by: `Julien Desgats, Cloudflare`, url: `https://blog.cloudflare.com/counting-things-a-lot-of-different-things/` },
      { t: `INCR: rate limiter pattern`, by: `Redis docs`, url: `https://redis.io/docs/latest/commands/incr/` },
      { t: `RFC 6585: Additional HTTP Status Codes (429 Too Many Requests)`, by: `M. Nottingham, R. Fielding`, url: `https://www.rfc-editor.org/rfc/rfc6585.html` }
    ]
  },
  {
    id: `load-shedding-backpressure`,
    title: `Load shedding and backpressure`,
    family: `Resilience`,
    summary: `Load shedding: an overloaded server rejects excess work early and cheaply so the requests it accepts stay fast. Backpressure: a slow consumer makes producers slow down instead of letting queues grow without bound.`,
    problem: `Past its capacity, a server's latency climbs until it passes the client's timeout. From then on it burns CPU on answers nobody waits for, clients retry, and goodput (useful, on-time responses) collapses while the server stays 100% busy. Unbounded queues between stages hide this until memory or latency blows up.`,
    how: [
      `<strong>Find the knee.</strong> Load test past the point where goodput stops rising, and far beyond it. A good result keeps goodput flat as offered load keeps growing.`,
      `<strong>Admit a bounded amount of work.</strong> Cap in-flight requests per instance and answer the rest with 503 right away. Keep queues short: for steady traffic Google suggests a queue of at most about half the thread pool size.`,
      `<strong>Reject early and cheaply.</strong> Decide before any expensive work (database calls, downstream RPCs); even a stray log line can make a rejection costly. Layers in front, such as the load balancer, API gateway or iptables, can drop even earlier.`,
      `<strong>Shed by priority.</strong> Always answer load balancer health checks. Then drop the least valuable work first: Stripe reserves part of its fleet for critical calls like creating charges (with a 20% reservation, non-critical traffic past its 80% share gets a 503) and sheds test-mode traffic first.`,
      `<strong>Drop work that is already late.</strong> Propagate the caller's remaining deadline on every hop. When a request leaves a queue, skip it if its deadline has passed or it has waited too long.`,
      `<strong>Push back between stages.</strong> Use bounded queues and channels. When one fills, block or reject the producer instead of buffering more. Pull-based consumers (a Kafka consumer, a worker polling a queue) fall behind and catch up instead of being flooded.`,
      `<strong>Tell callers how to back off.</strong> Send 503 or 429 with Retry-After, and make clients back off with jitter so shedding does not turn into a retry storm.`
    ],
    diagram: {
      layers: [
        { name: `Clients`, items: [[`API clients`, `normal traffic plus a spike`]] },
        { name: `Edge`, items: [[`Load balancer`, `health checks, spreads load`]] },
        { name: `Service instance`, items: [[`Admission control`, `in-flight cap, priority, deadline`], [`Bounded queue`, `fixed size, max wait`], [`Workers`, `fixed pool`]] },
        { name: `Downstream`, items: [[`Carrier gateway`, `fixed throughput`]] }
      ],
      edges: [
        [`API clients`, `Load balancer`, `sync`, `requests`],
        [`Load balancer`, `Admission control`, `sync`, `forward; 503 back when full`],
        [`Admission control`, `Bounded queue`, `async`, `enqueue if room`],
        [`Bounded queue`, `Workers`, `async`, `pull at own pace`],
        [`Workers`, `Carrier gateway`, `sync`, `send`]
      ],
      paths: [
        { name: `Spike`, nodes: [`API clients`, `Load balancer`, `Admission control`], note: `Over the in-flight cap, admission control returns 503 before doing any real work, so accepted requests keep their normal latency.` },
        { name: `Slow downstream`, nodes: [`Admission control`, `Bounded queue`, `Workers`, `Carrier gateway`], note: `Workers pull only as fast as the gateway accepts; once the queue is full, admission control rejects instead of buffering.` }
      ]
    },
    variants: [
      [`Concurrency cap`, `Limit requests in flight per instance, set from load tests or adjusted from measured latency. Enforce it in the server, which knows more than a proxy counting raw connections.`],
      [`Priority classes`, `Tag every request with a criticality and shed from the bottom up. Google uses four levels: CRITICAL_PLUS, CRITICAL, SHEDDABLE_PLUS and SHEDDABLE. Batch jobs default to SHEDDABLE_PLUS because they can retry minutes or hours later.`],
      [`Queue discipline under overload`, `FIFO serves the oldest requests first, which are the likeliest to be abandoned. LIFO or CoDel (controlled delay) serve fresh requests and drop the ones that waited too long.`],
      [`Pull and flow control`, `Consumers ask for work when they have room: a Kafka consumer pulls, and TCP and HTTP/2 use flow-control windows. Nothing is pushed faster than the receiver can take it.`]
    ],
    alternatives: [
      [`rate-limiting`, `Rate limiting`, `When each client's fair share is known in advance. Limits are per client; shedding reacts to the server's own health.`],
      [`circuit-breaker`, `Circuit breaker`, `When you are the caller and the dependency is failing: stop sending it work at all.`],
      [``, `Autoscaling`, `When load grows over minutes. It adds capacity but reacts slowly, so keep shedding to cover the gap.`],
      [``, `Queue-based load leveling`, `When work needs no immediate answer (webhooks, bulk sends): accept it into a durable queue and process it at a steady rate.`]
    ],
    pitfalls: [
      `<strong>Shedding hides the scale-up signal.</strong> If shedding holds CPU at the same target that autoscaling watches, new instances never launch. Trigger scaling below the shedding point.`,
      `<strong>Failing health checks under load.</strong> An overloaded host that misses health checks is pulled, its traffic moves to the others, and they fall next. Serve health checks first and keep them cheap.`,
      `<strong>Rosy latency graphs.</strong> Fast rejections drag the median down: while shedding 60% of traffic, the median can look great even though successful requests are slow. Chart successful-request latency on its own.`,
      `<strong>Hidden queues.</strong> Executors, socket buffers and load balancer surge queues buffer silently. With a queue 10x the thread count and 100 ms of work per request, a request can take 1.1 s, mostly spent waiting.`,
      `<strong>Retry storms after shedding.</strong> Clients that retry 503s immediately add to the load being shed. Send Retry-After, budget retries, and return a do-not-retry error when the whole cluster is overloaded.`
    ],
    use: `Any server that can be offered more work than it can finish: public APIs, gateways, webhook receivers, and workers in front of a fixed-capacity dependency such as a carrier or payment provider.`,
    avoid: `Do not use shedding to paper over a daily capacity shortfall; if it rejects traffic on normal days, scale or tune instead. Do not use it for per-client fairness (that is rate limiting). For work that can wait, queue it durably rather than reject it.`,
    interview: [
      `Traffic triples for ten minutes. What happens to goodput with and without load shedding?`,
      `Which requests do you drop first, and how does each request carry its priority?`,
      `In a queue-based pipeline, how does a slow consumer make a fast producer slow down?`,
      `How can a server at 100% CPU have almost zero goodput?`
    ],
    related: [`c7`, `c8`, `r2`],
    sources: [
      { t: `Using load shedding to avoid overload`, by: `David Yanacek, Amazon Builders' Library`, url: `https://builder.aws.com/content/3Eun1EEyX6p2e3VYNyRLSJzLuMV/using-load-shedding-to-avoid-overload` },
      { t: `Addressing Cascading Failures (SRE book, ch. 22)`, by: `Mike Ulrich, Google`, url: `https://sre.google/sre-book/addressing-cascading-failures/` },
      { t: `Handling Overload (SRE book, ch. 21)`, by: `Alejandro Forero Cuervo, Google`, url: `https://sre.google/sre-book/handling-overload/` },
      { t: `Scaling your API with rate limiters`, by: `Paul Tarjan, Stripe`, url: `https://stripe.com/blog/rate-limiters` }
    ]
  },
  {
    id: `cache-aside-stampede`,
    title: `Cache-aside and stampede protection`,
    family: `Scale`,
    summary: `The app checks the cache first and, on a miss, reads the database and fills the cache. Stampede protection makes sure one hot key's miss triggers one reload, not thousands.`,
    problem: `A pricing table is read on every SMS send and cached with a TTL. When the key expires, every request in flight misses at once and queries the database, which slows down, so each rebuild takes longer and even more requests pile in. The XFetch paper's arithmetic: a key read 10 times a second that takes 3 seconds to rebuild gets rebuilt by 30 requests.`,
    how: [
      `<strong>Read.</strong> GET the key; on a hit, return it.`,
      `<strong>Miss.</strong> Load from the database, SET the key with a TTL, and return. The app owns this logic and the cache is a plain key-value store, which is why it is called a side (or look-aside) cache.`,
      `<strong>Write.</strong> Update the database, then DELETE the key instead of writing the new value into it. Deletes are idempotent, so retries and reordering stay safe; Facebook's memcache works this way.`,
      `<strong>Collapse concurrent misses.</strong> In each process, let one goroutine load a key while the rest wait for its result (Go's <code>singleflight</code>). Across servers, take a short lock (<code>SET lock:KEY TOKEN NX PX 5000</code>) so one server hits the database while the others wait briefly or serve the old value.`,
      `<strong>Refresh before expiry.</strong> Keep a soft TTL and a hard TTL: after the soft TTL one caller refreshes while others keep serving the old value, and if the database is down the old value lives on until the hard TTL. XFetch instead has each reader refresh early with a probability that rises as expiry nears.`,
      `<strong>Spread expiry and cache negatives.</strong> Add random jitter to TTLs so keys loaded together do not expire together, and cache not-found results with their own short TTL so missing keys do not hit the database every time.`
    ],
    diagram: {
      layers: [
        { name: `Clients`, items: [[`API requests`, `thousands read the same key`]] },
        { name: `Service`, items: [[`App server`, `cache-aside logic`], [`Single-flight gate`, `one loader per key`]] },
        { name: `Cache`, items: [[`Redis`, `values with TTL, lock keys`]] },
        { name: `Database`, items: [[`Primary DB`, `source of truth`]] }
      ],
      edges: [
        [`API requests`, `App server`, `sync`, `GET /rates`],
        [`App server`, `Redis`, `data`, `GET key; DEL after writes`],
        [`App server`, `Single-flight gate`, `sync`, `on miss`],
        [`Single-flight gate`, `Primary DB`, `data`, `one query per key`],
        [`Single-flight gate`, `Redis`, `data`, `SET with jittered TTL`],
        [`App server`, `Primary DB`, `data`, `writes`]
      ],
      paths: [
        { name: `Hot key expires`, nodes: [`API requests`, `App server`, `Single-flight gate`, `Primary DB`], note: `Thousands of misses collapse into one query; the other callers wait for its result or get the old value.` },
        { name: `Cache hit`, nodes: [`API requests`, `App server`, `Redis`], note: `Most reads end here, so the database sees only misses and writes.` }
      ]
    },
    variants: [
      [`Read-through and write-through`, `A cache library or proxy loads misses itself and writes pass through it. Less code in each service, but the cache sits in the request path: if it is down, so is the data.`],
      [`Leases`, `On a miss the cache hands one client a token, and only that token may set the value; a delete voids it, which blocks stale sets. Facebook issues one token per key every 10 seconds and cut peak database queries on herd-prone keys from 17K/s to 1.3K/s.`],
      [`Soft and hard TTL`, `Serve the old value while one caller refreshes, and keep serving it until the hard TTL if the source is down. AWS uses this in its IAM client.`],
      [`Probabilistic early refresh (XFetch)`, `Each read refreshes early if <code>now - delta * beta * log(rand()) &gt;= expiry</code>, where delta is how long the last rebuild took and beta defaults to 1. No locks and no coordination.`]
    ],
    alternatives: [
      [`change-data-capture`, `CDC-driven invalidation`, `When many services write the same tables and you cannot trust each one to delete keys: tail the database log and delete from there. Facebook's mcsqueal reads committed SQL and broadcasts the deletes.`],
      [`cqrs`, `CQRS read model`, `When reads need a different shape than writes and must stay current: maintain a projection instead of a TTL cache.`],
      [``, `Read replicas`, `When data must be fresher than any TTL allows and the read load fits on a few replicas.`],
      [``, `HTTP caching proxy`, `For whole HTTP responses: let a caching proxy such as Nginx or Varnish store them and coalesce identical misses, instead of coding it in the app.`]
    ],
    pitfalls: [
      `<strong>The stale set race.</strong> A reader misses and loads v1; a writer commits v2 and deletes the key; the reader then SETs v1, which stays until the TTL. Leases or version checks prevent it, and the TTL bounds the damage.`,
      `<strong>Falling back to the database when the cache is down.</strong> A cache outage sends every read to a database sized only for misses and can take it down. Cap the fallback rate or shed load, and load test with the cache turned off.`,
      `<strong>Cold start.</strong> A flushed cache or a new cluster sends every read to the database. Warm it first or ramp traffic slowly; Facebook fills a cold cluster from a warm one, cutting warmup from days to hours.`,
      `<strong>Synchronized expiry.</strong> Keys loaded together at deploy or warmup with the same TTL all expire together. Add jitter.`,
      `<strong>No negative caching.</strong> A missing or failing key hits the database on every request and can deepen an outage. Cache errors and not-found results with a short TTL of their own.`
    ],
    use: `Read-heavy data that is reused across requests and tolerates brief staleness: pricing, account settings, number lookups, feature config. Add stampede protection for any key that is hot or slow to rebuild.`,
    avoid: `Skip it when each request reads unique data (the hit rate will be near zero) or when reads must see the latest write, such as balances and payment state; read the source or a replica. If writes are as frequent as reads, invalidation churn eats the benefit.`,
    interview: [
      `A key read 50,000 times a second expires. What happens next, and how do you stop it?`,
      `Why delete the cache entry on write instead of updating it?`,
      `Walk through the race that leaves a stale value in cache-aside. How do leases fix it?`,
      `Your Redis cluster goes down. What happens to the database, and what should the app do?`
    ],
    related: [`k4`, `k3`, `k5`],
    sources: [
      { t: `Caching challenges and strategies`, by: `Matt Brinkley, Jas Chhabra, Amazon Builders' Library`, url: `https://aws.amazon.com/builders-library/caching-challenges-and-strategies/` },
      { t: `Scaling Memcache at Facebook (NSDI 2013)`, by: `Rajesh Nishtala et al., Facebook`, url: `https://www.usenix.org/system/files/conference/nsdi13/nsdi13-final170_update.pdf` },
      { t: `Optimal Probabilistic Cache Stampede Prevention (VLDB 2015)`, by: `Andrea Vattani, Flavio Chierichetti, Keegan Lowenstein`, url: `https://www.vldb.org/pvldb/vol8/p886-vattani.pdf` },
      { t: `singleflight package`, by: `Go project`, url: `https://pkg.go.dev/golang.org/x/sync/singleflight` }
    ]
  },
  {
    id: `sharding-consistent-hashing`,
    title: `Sharding and consistent hashing`,
    family: `Scale`,
    summary: `Sharding splits data across nodes by a partition key. Consistent hashing places keys and nodes on a hash ring so adding or removing a node moves only a small share of keys.`,
    problem: `Message logs for every account no longer fit on one database, and one primary cannot take all the writes. Routing with <code>hash(key) mod N</code> works until N changes: going from 10 to 12 shards moves 5 of every 6 keys, though moving 1/6 of the data would be enough. And one huge tenant can overload whichever shard it lands on.`,
    how: [
      `<strong>Choose the partition key.</strong> Pick one with many distinct values that keeps your main queries on one shard, like account_id for per-account message history. Low-cardinality or time-based keys (country, today's date) create hot shards.`,
      `<strong>Choose range or hash.</strong> Range partitioning keeps keys sorted for scans but piles new writes onto one shard when keys only increase (timestamps). Hashing spreads load evenly but gives up range scans.`,
      `<strong>Place nodes on a ring.</strong> Hash each node to many points (virtual nodes). A key belongs to the first node clockwise from <code>hash(key)</code>. Many points per node even out the ranges, and bigger machines can take more points.`,
      `<strong>Replicate along the ring.</strong> Store each key on the next N distinct physical nodes clockwise, skipping extra points of a machine already chosen (Dynamo's preference list).`,
      `<strong>Route every request.</strong> Clients or a router hold the ring map (from a config service, or by gossip as in Dynamo) and send each key straight to its owner.`,
      `<strong>Add capacity by moving ranges.</strong> A new node takes over some ranges, and the nodes that owned them stream only those keys to it. Every other key stays where it is.`,
      `<strong>Split hot keys.</strong> Spread a hot key across suffixes (key.1 to key.N) and merge on read, or give a giant tenant its own shard.`
    ],
    diagram: {
      layers: [
        { name: `Clients`, items: [[`API servers`, `read and write by account_id`]] },
        { name: `Routing`, items: [[`Shard router`, `hash(account_id) on the ring`], [`Ring map`, `vnode tokens to nodes, versioned`]] },
        { name: `Storage nodes`, items: [[`Node A`, `owns some ranges`], [`Node B`, `next clockwise, holds replicas`], [`Node C`, `owns other ranges`], [`New node D`, `joining`]] }
      ],
      edges: [
        [`API servers`, `Shard router`, `sync`, `get(account_id)`],
        [`Shard router`, `Ring map`, `data`, `load and watch`],
        [`Shard router`, `Node A`, `sync`, `owner of the key`],
        [`Node A`, `Node B`, `repl`, `replica on next node`],
        [`Shard router`, `Node C`, `sync`, `other keys`],
        [`Node A`, `New node D`, `stream`, `hand off one range`],
        [`Node C`, `New node D`, `stream`, `hand off one range`]
      ],
      paths: [
        { name: `Read a key`, nodes: [`API servers`, `Shard router`, `Node A`], note: `The router hashes account_id, walks clockwise to the first vnode, and calls its owner; Node B holds a replica.` },
        { name: `Add a node`, nodes: [`Node A`, `New node D`], note: `D takes a few small ranges from several nodes, which stream only those keys; everything else stays put.` }
      ]
    },
    variants: [
      [`Fixed partitions`, `Split the hash space into many more equal partitions than nodes and move whole partitions. Dynamo switched to this and got its best load balance, much smaller membership data, and faster bootstrapping, since a partition moves as one file.`],
      [`Rendezvous hashing`, `Score every node with <code>hash(key, node)</code> and pick the highest. No ring to store and any node can leave; the cost is one hash per node on every lookup.`],
      [`Jump consistent hash`, `About 5 lines of code and no memory. Maps a key to a bucket numbered 0 to N-1, so buckets must be numbered in sequence: good for numbered shards, not for cache servers that fail at random.`],
      [`Bounded-load consistent hashing`, `Cap each node at (1 + epsilon) times the average load; a request whose node is full moves clockwise to the next node with room. Vimeo used it in HAProxy and cut cache bandwidth by almost 8x.`]
    ],
    alternatives: [
      [``, `Scale up plus read replicas`, `When the data fits on one machine and the load is mostly reads; far simpler than sharding.`],
      [``, `Directory-based placement`, `When tenant sizes vary wildly: a lookup service maps each tenant to a shard, so you can move one big tenant on its own.`],
      [`cache-aside-stampede`, `Cache in front`, `When the pressure is reads of a small hot set, not data size or write volume.`],
      [``, `Managed partitioned store`, `When you would rather rent placement and rebalancing than build them; with DynamoDB you still choose the partition key.`]
    ],
    pitfalls: [
      `<strong>Hot partitions.</strong> A celebrity tenant or a date key sends most writes to one shard, and every shard has a ceiling (a DynamoDB partition serves at most 3,000 read units and 1,000 write units per second). Add a suffix to spread writes and merge on read.`,
      `<strong>Too few points per node.</strong> A handful of random ring positions gives uneven ranges; Karger-style rings needed about 1,000 points per node to bring the spread of keys per node down to a 3.2% standard deviation.`,
      `<strong>Cross-shard queries.</strong> Anything not keyed by the partition key becomes scatter-gather, and multi-shard writes need a saga or 2PC. Pick the key from your top queries.`,
      `<strong>Rebalancing at peak.</strong> Moving ranges competes with live traffic; Dynamo found that scanning a node's store to hand off keys was heavy enough to push into the background. Throttle transfers and prefer moving whole partitions.`,
      `<strong>Stale ring maps.</strong> Routers that loaded the map at different times send the same key to different nodes. Version the map and have nodes reject keys outside the ranges they own.`
    ],
    use: `When one node can no longer hold the data or absorb the writes, and most queries can be scoped to one key (account, tenant, user). Consistent hashing fits caches and stores whose set of nodes changes often.`,
    avoid: `Do not shard while one machine plus replicas and a cache still copes; sharding makes joins, transactions and schema changes harder for good. If most access is range scans, prefer range partitioning over hashing.`,
    interview: [
      `Why not route with hash(key) mod N? What happens when you add a node?`,
      `What problem do virtual nodes solve, and how are replicas placed on the ring?`,
      `One tenant sends 40% of all traffic. How do you shard around it?`,
      `How would you serve a query that needs data from every shard?`
    ],
    related: [`d3`, `d4`, `d5`],
    sources: [
      { t: `Dynamo: Amazon's Highly Available Key-value Store (SOSP 2007)`, by: `Giuseppe DeCandia et al., Amazon`, url: `https://www.allthingsdistributed.com/files/amazon-dynamo-sosp2007.pdf` },
      { t: `A Fast, Minimal Memory, Consistent Hash Algorithm`, by: `John Lamping, Eric Veach, Google`, url: `https://arxiv.org/abs/1406.2294` },
      { t: `Consistent Hashing with Bounded Loads`, by: `Vahab Mirrokni, Morteza Zadimoghaddam, Google Research`, url: `https://research.google/blog/consistent-hashing-with-bounded-loads/` },
      { t: `Best practices for designing and using partition keys effectively`, by: `Amazon DynamoDB docs`, url: `https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-partition-key-design.html` }
    ]
  },
  {
    id: `leader-election-fencing`,
    title: `Leader election and fencing tokens`,
    family: `Distributed correctness`,
    summary: `Leader election gives one node a time-limited lease to do a job alone, like running the scheduler. Fencing tokens make storage reject writes from a leader whose lease has already expired.`,
    problem: `Some work must run in one place at a time: one scheduler firing campaign sends, one writer per partition. A lease picks the leader, but the leader can pause (a long GC, a VM stall, a network partition) past its expiry; a new leader takes over, and the old one wakes up still believing it leads. Now two nodes write, and customers get duplicate messages or corrupted state.`,
    how: [
      `<strong>Keep leadership in a consensus store.</strong> Candidates race to create a lease key in etcd or ZooKeeper, or make a conditional write to a strongly consistent database. The store lets exactly one win.`,
      `<strong>Attach a TTL and renew it.</strong> The leader heartbeats well inside the TTL. If it stops, the lease lapses, the key goes away (etcd deletes keys attached to an expired lease), and another candidate can take over.`,
      `<strong>Get a token that only goes up.</strong> Each new lease comes with a larger number: the etcd revision of the key, a ZooKeeper zxid or znode version, or a counter bumped in the same transaction.`,
      `<strong>Send the token with every write.</strong> Storage remembers the highest token it has accepted and rejects anything lower. In Kleppmann's example the store has seen 34, so the woken old leader's write with 33 is refused.`,
      `<strong>Stop work when the lease is in doubt.</strong> Check the remaining lease time before every side effect, measure it with a monotonic clock, and do not heartbeat from a background thread that cannot stop the worker.`,
      `<strong>Make the work safe to redo.</strong> Persist progress before announcing it and keep tasks idempotent, so the next leader can re-run whatever the old one left half done.`
    ],
    diagram: {
      layers: [
        { name: `Candidates`, items: [[`Scheduler 1`, `old leader, paused in GC`], [`Scheduler 2`, `new leader`]] },
        { name: `Coordination`, items: [[`Lock service`, `etcd or ZooKeeper lease`]] },
        { name: `Storage`, items: [[`Job store`, `keeps highest token seen`]] },
        { name: `Workers`, items: [[`Send workers`, `run due jobs`]] }
      ],
      edges: [
        [`Scheduler 1`, `Lock service`, `sync`, `lease, token 33`],
        [`Scheduler 2`, `Lock service`, `sync`, `lease after expiry, token 34`],
        [`Scheduler 2`, `Job store`, `data`, `write with token 34`],
        [`Scheduler 1`, `Job store`, `data`, `late write with 33, rejected`],
        [`Job store`, `Send workers`, `async`, `due jobs`]
      ],
      paths: [
        { name: `Paused leader wakes up`, nodes: [`Scheduler 1`, `Job store`], note: `Its lease expired during the pause. The store has already accepted token 34, so the write carrying 33 is refused.` },
        { name: `Failover`, nodes: [`Lock service`, `Scheduler 2`, `Job store`, `Send workers`], note: `Scheduler 2 wins the lease with a higher token, writes with it, and workers pick up the jobs it schedules.` }
      ]
    },
    variants: [
      [`ZooKeeper sequential znodes`, `Each candidate creates an ephemeral, sequential znode and the lowest number leads. Each watches only the next lower znode, so a failure wakes one candidate, not all of them (no herd effect).`],
      [`etcd lease`, `Put a key bound to a lease with a TTL and keep the lease alive while leading. The key's revision doubles as the fencing token.`],
      [`Database lease row`, `A row holding owner, expiry and token, taken with a conditional write, the approach behind the DynamoDB lock client. Simple if you already run a strongly consistent database.`],
      [`Chubby sequencer and lock-delay`, `Chubby gives the holder a sequencer (lock name, mode, generation number) that servers check, which is a fencing token. For servers that cannot check, lock-delay stops anyone re-taking a lost lock for up to a minute.`]
    ],
    alternatives: [
      [``, `Partitioned ownership`, `When work splits by key: lease each shard to one worker (the Kinesis Client Library does this per stream shard), so no single leader limits scale.`],
      [`idempotency-keys`, `Idempotent work`, `When running a job twice only wastes effort: let runners race and dedupe on a key. Idempotent systems tolerate two leaders at little cost.`],
      [``, `Row claiming with SKIP LOCKED`, `When jobs live in Postgres: workers claim due rows with <code>SELECT ... FOR UPDATE SKIP LOCKED</code> in a transaction, with no leader at all.`],
      [``, `Managed workflow service`, `When the leader exists only to drive workflows: a workflow service (AWS names Step Functions) gives single-runner behavior with fewer risks.`]
    ],
    pitfalls: [
      `<strong>Trusting the lease clock.</strong> A GC pause, VM stall or slow network can outlast the lease between the check and the write; stop-the-world pauses have run for minutes. Checking expiry just before writing does not fix it. Fencing does.`,
      `<strong>Storage that cannot check tokens.</strong> An external API such as a carrier or payment provider will not fence for you. Send an idempotency key so a duplicate call from an old leader is a no-op.`,
      `<strong>A Redis lock for correctness.</strong> Redlock produces no fencing token and its safety depends on timing assumptions. It is fine for skipping duplicate work, not for preventing corruption; use a consensus store plus fencing.`,
      `<strong>Assuming exactly one leader.</strong> During failures there can be zero leaders or two. Design for both: a gap with no leader, and an overlap that fencing makes harmless.`,
      `<strong>The leader as a bottleneck.</strong> One leader is one point of failure and one point of scaling, and outgrowing it means re-architecting. Scope leadership per shard if load will grow.`
    ],
    use: `When one actor must own a job or a piece of state at a time: a cron-style scheduler, the single writer for a partition, a primary database, a rebalancer. Add fencing whenever a duplicate writer would corrupt data rather than just waste work.`,
    avoid: `Skip election when the work can be partitioned, made idempotent, or claimed row by row from a database; those need no leader. If a lock only saves duplicate effort, a single Redis instance is enough, with no Redlock cluster.`,
    interview: [
      `Your leader pauses for 30 seconds in GC. What can go wrong, and how does a fencing token prevent it?`,
      `Why is a Redis lock with a TTL not enough for correctness?`,
      `How does ZooKeeper leader election avoid waking every candidate when the leader dies?`,
      `Does this scheduler need a leader at all? What would you do instead?`
    ],
    related: [`t10`, `a4`],
    sources: [
      { t: `How to do distributed locking`, by: `Martin Kleppmann`, url: `https://martin.kleppmann.com/2016/02/08/how-to-do-distributed-locking.html` },
      { t: `Leader election in distributed systems`, by: `Marc Brooker, Amazon Builders' Library`, url: `https://builder.aws.com/content/3Ev0vH0hfkcUizISUWYTvHibtcp/leader-election-in-distributed-systems` },
      { t: `The Chubby lock service for loosely-coupled distributed systems (OSDI 2006)`, by: `Mike Burrows, Google`, url: `https://research.google/pubs/the-chubby-lock-service-for-loosely-coupled-distributed-systems/` },
      { t: `ZooKeeper Recipes and Solutions`, by: `Apache ZooKeeper`, url: `https://zookeeper.apache.org/doc/current/recipes.html` }
    ]
  },
  {
    id: `strangler-fig`,
    title: `Strangler fig migration`,
    family: `Change and migration`,
    summary: `Replace a legacy system piece by piece: put a routing layer in front, move one slice of behavior at a time to new code, and retire each old slice until nothing is left.`,
    problem: `A monolith handles billing, messaging and webhook delivery, and every change to it is slow and risky. A full rewrite freezes features for a long time and ends in one risky cutover; Fowler has seen that plan "go down in flames most of the time". The old system cannot just stop, because customers depend on its behavior, including quirks nobody wrote down.`,
    how: [
      `<strong>Put a seam in front.</strong> Add a routing facade (a reverse proxy, an API gateway, or an event router for message flows) that at first sends all traffic to the legacy system.`,
      `<strong>Pick a thin, valuable slice.</strong> Choose behavior with a clear boundary, such as webhook delivery, and build it as a new service.`,
      `<strong>Plan the data.</strong> Give the new service its own store. While both run, sync them with change data capture or events, and decide which side owns each record.`,
      `<strong>Prove it in the dark.</strong> Run the new path beside the old on real traffic and compare results before anyone relies on it. GitHub's Scientist runs both, returns the old result, and records mismatches.`,
      `<strong>Shift traffic gradually.</strong> Route by tenant, percentage or endpoint, starting with a canary, and keep a switch that sends everything back to legacy in one step.`,
      `<strong>Delete the old slice.</strong> When the new path owns 100% of the slice and is stable, remove the legacy code and the transitional glue for it, then pick the next slice.`
    ],
    diagram: {
      layers: [
        { name: `Clients`, items: [[`API clients`, `same URLs throughout`]] },
        { name: `Facade`, items: [[`Routing facade`, `routes by path, tenant or percent`]] },
        { name: `Systems`, items: [[`Legacy monolith`, `shrinking`], [`Webhook service`, `new, growing`]] },
        { name: `Data`, items: [[`Legacy DB`, `source of truth for now`], [`Webhook DB`, `new store`]] }
      ],
      edges: [
        [`API clients`, `Routing facade`, `sync`, `requests`],
        [`Routing facade`, `Legacy monolith`, `sync`, `not yet migrated`],
        [`Routing facade`, `Webhook service`, `sync`, `migrated routes`],
        [`Legacy monolith`, `Legacy DB`, `data`, `reads and writes`],
        [`Webhook service`, `Webhook DB`, `data`, `reads and writes`],
        [`Legacy DB`, `Webhook DB`, `repl`, `CDC sync during transition`]
      ],
      paths: [
        { name: `Migrated slice`, nodes: [`API clients`, `Routing facade`, `Webhook service`, `Webhook DB`], note: `Webhook calls go to the new service; flipping the route back is the rollback.` },
        { name: `Not yet migrated`, nodes: [`API clients`, `Routing facade`, `Legacy monolith`, `Legacy DB`], note: `Everything else still runs on the legacy system, unchanged.` }
      ]
    },
    variants: [
      [`Event interception`, `Intercept the messages or events that change legacy state and route some of them to the new component. Used when the seam is a queue or feed, not an HTTP endpoint.`],
      [`Branch by abstraction`, `Inside one codebase, wrap the old code in an abstraction that delegates to it, build the new implementation behind it, then flip the switch. Used when there is no network seam to route at.`],
      [`Parallel run`, `Run old and new side by side on real inputs and compare outputs before switching. Safe for reads; GitHub uses Scientist only on read paths, since running a write twice has side effects.`],
      [`Legacy mimic`, `The new system talks to the old one in the form it already expects (same files, tables or messages), so the legacy side does not notice that anything changed.`]
    ],
    alternatives: [
      [``, `Big-bang rewrite`, `Only when the system is small, well understood and can be frozen during the rewrite; otherwise the feature freeze and one-shot cutover carry huge risk.`],
      [``, `Refactor in place`, `When the platform is fine and the problem is code structure: carve modules inside the monolith first, and extract services later only if needed.`],
      [`change-data-capture`, `Change data capture`, `As the data half of the migration: stream legacy tables into the new store so reads can move before writes do.`],
      [`outbox-inbox`, `Outbox for dual writes`, `When both systems must see each change during the transition: write the change and an outbox record in one transaction instead of writing to two stores.`]
    ],
    pitfalls: [
      `<strong>Dual writes with no owner.</strong> Writing to both databases from the app drifts on the first partial failure. Give each record one source of truth, sync with CDC or an outbox, and run a reconciler.`,
      `<strong>Sharing the legacy database.</strong> If the new service reads and writes legacy tables directly, the old schema can never be retired and the coupling survives the migration.`,
      `<strong>Chasing feature parity.</strong> Copying every legacy behavior, much of which nobody wants, stalls the program and drifts back toward a big-bang cutover. Ask which behaviors users actually need.`,
      `<strong>A tail that never moves.</strong> The hardest slices come last, teams stop, and two systems plus the transitional glue run forever. Budget for the tail and track what is left.`,
      `<strong>A facade that grows logic.</strong> Business rules creeping into the router turn it into a new monolith and a single point of failure. Keep it to routing and run it redundantly.`
    ],
    use: `Replacing or splitting a system that must keep serving traffic: monolith to services, old platform to new, one vendor to another. Works best when requests or events can be intercepted and routed one slice at a time.`,
    avoid: `Skip it for a small system a team can rewrite and cut over quickly, or when there is no seam to intercept (use branch by abstraction inside the code). Do not start without funding for the tail: a half-finished migration leaves you running and paying for two systems.`,
    interview: [
      `How would you move webhook delivery out of a monolith with no downtime?`,
      `Where does the routing decision live, and how do you roll back one slice?`,
      `Both systems need the same data during the migration. How do you keep them consistent?`,
      `How do you know it is safe to delete the legacy code for a slice?`
    ],
    related: [`e9`, `c1`, `p7`],
    sources: [
      { t: `Strangler Fig`, by: `Martin Fowler`, url: `https://martinfowler.com/bliki/StranglerFigApplication.html` },
      { t: `Patterns of Legacy Displacement`, by: `Ian Cartwright, Rob Horn, James Lewis`, url: `https://martinfowler.com/articles/patterns-legacy-displacement/` },
      { t: `Pattern: Strangler application`, by: `Chris Richardson, microservices.io`, url: `https://microservices.io/patterns/refactoring/strangler-application.html` },
      { t: `Scientist: Measure Twice, Cut Once`, by: `Jesse Toth, GitHub`, url: `https://github.blog/developer-skills/application-development/scientist/` }
    ]
  }
);
