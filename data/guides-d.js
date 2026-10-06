/* Decision guides D: observability, reliability and API security. Each claim was checked against the sources listed per guide. */
window.HUB_GUIDES = window.HUB_GUIDES || [];
window.HUB_GUIDES.push(
  {
    id: `signals`,
    area: `Observability`,
    title: `Metrics vs logs vs traces vs profiles`,
    question: `Which signal answers the question in front of you: a metric, a log line, a trace or a profile?`,
    summary: `The four signals describe the same system at different grain. Metrics are cheap numbers aggregated over time, so they suit alerts and trends but hide single requests. Logs and traces keep per-event detail at a cost that grows with traffic. Profiles show which functions use CPU and memory. You trade cost and query speed against detail, and most production systems need all four.`,
    why: `Pick the wrong signal and you either pay to store detail nobody reads or have no detail when it matters, such as a latency alert with no trace behind it. High-cardinality metric labels are the classic way to crash a Prometheus server or inflate a vendor bill.`,
    options: [
      {
        name: `Metrics`,
        what: `A metric is a named number recorded over time, such as a request counter or a latency histogram. Each unique combination of label values is its own time series, and Prometheus stores an average of 1-2 bytes per sample. Queries aggregate across series (rate, sum, percentile), so metrics answer "how many" and "how fast" for the whole fleet.`,
        pros: [
          `Cost depends on the number of series, not on traffic: a counter that counts a million requests is still one series.`,
          `Queries over long time ranges stay fast because the data is already reduced to numbers, which is what dashboards and alert rules need.`,
          `Histogram buckets can be summed across instances into a fleet-wide percentile, which the Prometheus docs note you cannot do with precomputed summary quantiles.`,
          `Google's four golden signals (latency, traffic, errors, saturation) are all metrics, so a small set covers most user-facing health.`
        ],
        cons: [
          `Every new label value creates a new series, so a label like user ID or order ID can multiply memory and cost by millions.`,
          `Aggregation throws away the individual request, so a metric shows that errors rose but not which customer or why.`,
          `Averages hide the tail: the SRE book's example is a 100 ms average at 1,000 requests per second hiding 1% of requests that take 5 seconds.`,
          `Short spikes can vanish: AWS notes that brief traffic spikes are often hidden by aggregated metrics.`
        ],
        pick: `Pick metrics for anything you alert on or chart: request rate, error ratio, latency percentiles, queue depth and saturation. They are the first place to look in an incident, to see what broke and since when.`,
        avoid: `Avoid metrics for per-request questions and for labels with unbounded values. Put request IDs and customer IDs in logs and traces, and link to them from metrics with exemplars.`,
        example: `A Go service exposes <code>http_request_duration_seconds</code> as a Prometheus histogram labelled by route and status code, and an alert fires when the 5-minute error ratio passes 2%.`,
        tools: `Prometheus, Grafana Mimir, Thanos, Datadog, CloudWatch`
      },
      {
        name: `Logs`,
        what: `A log is a timestamped record of one event, best written as structured key-value fields (JSON) rather than free text. Lines are shipped to a store that indexes them, either every field and word (OpenSearch, Elasticsearch) or only a few labels (Loki). You then search for the lines about one request, user or error.`,
        pros: [
          `A log line can carry high-cardinality fields such as request ID, customer ID and the full error message, which metric labels cannot.`,
          `Every language and framework already writes logs, so they are the easiest signal to start with.`,
          `Structured fields let you filter and group events, and OpenTelemetry log records have trace ID and span ID fields that tie a line to its trace.`,
          `Logs record what the code decided and why, which is often the only way to explain a business-logic bug.`
        ],
        cons: [
          `Volume grows with traffic: ten times the requests means roughly ten times the bytes to ship, index and keep.`,
          `Counting from logs means scanning many events at query time, which is slower and costlier than reading a counter.`,
          `Free-text logs are hard to query, and every team formats them differently unless a schema is enforced.`,
          `Logs easily leak secrets and personal data (tokens, card numbers, phone numbers), and indexed copies are hard to purge.`
        ],
        pick: `Pick logs for the story of one event: why this payment failed, what this job did, which input broke the parser. Log at service boundaries and on errors, with a request or trace ID on every line.`,
        avoid: `Avoid logs as an alert source or as a counter at high volume; emit a metric instead. Avoid logging full request bodies on hot paths.`,
        example: `A Python worker writes <code>{"event": "charge_failed", "order_id": "o_123", "trace_id": "4bf9...", "reason": "card_declined"}</code>, so support can find every step of that order with one search.`,
        tools: `OpenSearch, Elasticsearch, Grafana Loki, CloudWatch Logs, Datadog Logs`
      },
      {
        name: `Traces`,
        what: `A trace follows one request across services. Each service records spans (one operation with a start time, duration, status and attributes), and a trace ID passed in a header such as W3C <code>traceparent</code> links the spans into a tree. The trace view shows which hop took the time and where an error started.`,
        pros: [
          `It shows the critical path, so you see that most of a slow request was one database call three services away.`,
          `Span attributes (customer tier, query type, version) let you compare slow requests with fast ones.`,
          `Spans can also produce request, error and duration metrics, for example through the OpenTelemetry Collector's span metrics connector.`,
          `OpenTelemetry instrumentation libraries for common HTTP, gRPC and database clients give useful traces with little code.`
        ],
        cons: [
          `Every hop must pass the context on, including queues and background jobs, and one service that drops it breaks the trace.`,
          `Keeping every trace is expensive at high traffic, so most systems sample, and the trace you need may not have been kept.`,
          `A trace shows where time went, not why the code inside one function was slow; that needs a profile.`,
          `A trace is only as complete as its least instrumented service, so coverage is a cross-team effort.`
        ],
        pick: `Pick traces when latency or errors cross service boundaries, when requests fan out, or when "which service is slow" is the real question.`,
        avoid: `Skip tracing for a single service with no downstream calls, where a request ID in logs is enough. Do not count requests from sampled traces; take counts from metrics.`,
        example: `A checkout request passes through the gateway, cart, pricing and payment services; its trace shows the pricing service waiting 600 ms on one slow query.`,
        tools: `OpenTelemetry SDKs, Jaeger, Grafana Tempo, Zipkin, AWS X-Ray, Datadog APM`
      },
      {
        name: `Continuous profiles`,
        what: `A sampling profiler records the call stacks of a running process at a fixed rate and adds up where CPU time or memory allocations go. Continuous profiling keeps a low-overhead profiler running in production and stores the results, so you can compare flame graphs across deploys and time ranges. Go ships <code>pprof</code> in its standard library, and py-spy profiles Python processes from outside.`,
        pros: [
          `A flame graph points at the function that burns CPU or allocates memory, which no other signal shows.`,
          `Profiles explain cost: they show which code to optimize before you buy more machines.`,
          `Comparing profiles before and after a deploy catches regressions that metrics only show as "CPU went up".`,
          `Sampling keeps overhead low, and py-spy runs outside the Python process, which its authors say makes it safe for production.`
        ],
        cons: [
          `Profiles carry no request context by default, so they show that serialization is hot, not which endpoint caused it.`,
          `Go's CPU profile counts only time spent on CPU, not time sleeping or waiting for I/O, so it misses latency from slow dependencies.`,
          `Profiling adds overhead; the Go docs say to measure it before enabling profiles in production.`,
          `It is one more agent and backend to run, and fewer engineers can read flame graphs.`
        ],
        pick: `Pick profiles when one service uses too much CPU or memory and metrics and traces cannot say why, or when you need to cut compute cost.`,
        avoid: `Avoid profiles for latency caused by waiting on networks, locks in other services or queues; traces show that better.`,
        example: `A Go API's CPU doubles after a release; comparing <code>pprof</code> flame graphs from before and after shows the new time is spent compiling a regular expression inside a hot loop.`,
        tools: `Go pprof, py-spy, Grafana Pyroscope, Parca, Datadog Continuous Profiler`
      }
    ],
    compare: [
      [`Answers`, `How many, how fast, since when`, `What happened to this event`, `Where time went across services`, `Which code uses CPU or memory`],
      [`Cost grows with`, `Number of series`, `Traffic and retention`, `Traffic, unless sampled`, `Number of processes profiled`],
      [`Per-request detail`, `None, aggregated`, `Full, per event`, `Full, for kept traces`, `None, aggregated by stack`],
      [`Good for alerts`, `Yes, the main source`, `Rarely, slow and costly`, `No, sampling skews counts`, `No`],
      [`High-cardinality IDs`, `Keep out of labels`, `Fine as fields`, `Fine as span attributes`, `Not applicable`],
      [`Typical query`, `Rate, sum or percentile over time`, `Search and filter by field`, `Find slow or failed traces`, `Flame graph diff between periods`]
    ],
    decide: [
      [`Do you need to alert, chart a trend or answer "how many"?`, `Metrics, with low-cardinality labels.`],
      [`Do you need the details of one request, user or job?`, `Logs, joined by a trace or request ID.`],
      [`Is latency high while each service's own dashboard looks normal?`, `Traces, to see the critical path across hops.`],
      [`Is one process burning CPU or memory and nobody knows which code?`, `Continuous profiles.`],
      [`Do you want to jump from a latency spike to an example request?`, `Metrics with exemplars that carry trace IDs.`]
    ],
    scenario: {
      title: `Worked example: checkout p99 jumped from 300 ms to 2 s`,
      setup: `A checkout API calls cart, pricing and payment services. After a deploy, p99 latency rose from 300 ms to 2 s. You have Prometheus metrics, JSON logs with trace IDs, OpenTelemetry traces at 10% head sampling, and no profiler.`,
      steps: [
        `Start with metrics: split the latency histogram by route and by downstream call to find when it started and which endpoint is affected.`,
        `Open traces for slow requests in that window: the critical path shows 1.5 s inside the pricing service's database call.`,
        `Search the pricing service's logs for those trace IDs: they show that a query changed by the deploy now scans far more rows.`,
        `Had pricing shown high CPU instead of waiting, a CPU profile of one pricing pod would point at the hot function.`
      ],
      answer: `Metrics detect and scope the problem, traces find the slow hop, logs explain what that hop did, and a profile helps only if the hop is CPU-bound. In an interview, say which signal you open first and why.`
    },
    mistakes: [
      `Putting user ID, order ID or raw URL in metric labels → millions of series and an out-of-memory Prometheus or a huge custom-metrics bill.`,
      `Alerting on log searches at high volume → slow, costly queries and alerts that break when someone rewords a message.`,
      `Computing error rates from sampled traces → wrong numbers; compute request and error metrics before sampling.`,
      `Logs without a trace or request ID → no way to join a log line to its trace during an incident.`,
      `Reading a CPU profile to explain latency → time spent waiting on I/O never shows up in it.`
    ],
    rule: `Alert on metrics, find the slow hop with traces, read the details in logs, and use profiles when one process is the bottleneck.`,
    signals: [
      `You need "how many" or "how fast" → metrics.`,
      `You need "what happened to this one request" → logs, joined by trace ID.`,
      `Latency is high but every service looks fine on its own → traces.`,
      `CPU or memory is high and nobody knows which code → profiles.`,
      `A metric's series count keeps climbing → a label has unbounded values; move it to logs or traces.`
    ],
    interview: [
      `How would you debug a p99 latency regression in a system of 20 services?`,
      `Why should a user ID not be a Prometheus label, and where would you put it?`,
      `How do you get from a spike on a dashboard to the logs and traces behind it?`
    ],
    related: [`o1`, `o2`, `o3`, `o5`],
    deep: [],
    db: [`time-series`, `search`],
    sources: [
      { t: `Monitoring Distributed Systems (Site Reliability Engineering, chapter 6)`, by: `Google`, url: `https://sre.google/sre-book/monitoring-distributed-systems/` },
      { t: `Metric and label naming`, by: `Prometheus`, url: `https://prometheus.io/docs/practices/naming/` },
      { t: `Signals`, by: `OpenTelemetry`, url: `https://opentelemetry.io/docs/concepts/signals/` },
      { t: `Diagnostics`, by: `The Go project`, url: `https://go.dev/doc/diagnostics` }
    ]
  },
  {
    id: `metrics-collection`,
    area: `Observability`,
    title: `Prometheus pull vs Pushgateway vs OTLP push`,
    question: `How should metrics get from your code to the backend: scraped by Prometheus, pushed through a Pushgateway, or pushed with OTLP?`,
    summary: `With pull, Prometheus scrapes an HTTP endpoint on each target, so it also learns when a target is down. With push, the app sends its metrics out, which suits short jobs and targets Prometheus cannot reach. You trade built-in health checks and simpler apps against reach and one shared pipeline for all telemetry.`,
    why: `Choose wrong and you get silent gaps: a cron job that exits before any scrape, or a Pushgateway that keeps serving a dead job's last values as if they were current. A push pipeline with no alert on missing data hides outages the same way.`,
    options: [
      {
        name: `Prometheus pull (scraping /metrics)`,
        what: `Each process exposes its current metric values over HTTP, usually at <code>/metrics</code>, using a client library such as Go's <code>client_golang</code> or Python's <code>prometheus_client</code>. Prometheus finds targets through service discovery (Kubernetes, EC2, Consul, DNS and more) and scrapes each one on an interval; the default <code>scrape_interval</code> is one minute. Every scrape also writes an <code>up</code> series: 1 if the scrape worked, 0 if it failed.`,
        pros: [
          `Target health comes free: the <code>up</code> series turns a crashed or unreachable process into an alert with no extra code.`,
          `Targets do not know who scrapes them, so you can point extra Prometheus servers at them, even one on a laptop, as the Prometheus FAQ notes.`,
          `Prometheus sets the pace, and per-scrape limits such as <code>sample_limit</code> fail a scrape that suddenly exposes too many samples.`,
          `You can open any target's <code>/metrics</code> page in a browser or with curl while debugging.`
        ],
        cons: [
          `A job that exits between scrapes is never seen, so short batch and serverless work needs push.`,
          `Prometheus must reach every target over the network, which fails across NAT, firewalls or customer networks unless you add a tool such as PushProx.`,
          `One server's local storage is not clustered or replicated, so large fleets need sharding, federation, or remote write to Mimir or Thanos.`,
          `Service discovery and relabeling are a skill of their own, and a wrong relabel rule can drop targets without raising an error.`
        ],
        pick: `Pick pull for long-running services and infrastructure inside a network Prometheus can reach, especially on Kubernetes, where discovery is built in.`,
        avoid: `Avoid pull for processes that live shorter than a scrape interval or sit behind NAT; use OTLP push, or the Pushgateway for batch jobs.`,
        example: `A Go service on Kubernetes registers a histogram with <code>client_golang</code> and serves <code>/metrics</code>; Prometheus finds each pod through <code>kubernetes_sd_configs</code>, and an alert on <code>up == 0</code> pages when pods stop answering.`,
        tools: `Prometheus, client_golang, prometheus_client, Grafana Alloy, VictoriaMetrics`
      },
      {
        name: `Pushgateway`,
        what: `The Pushgateway is a small server that accepts metrics over HTTP and holds them so Prometheus can scrape them. A batch job pushes its final values (rows processed, duration, time of last success) just before it exits. The gateway is a cache, not an aggregator: it keeps each group of metrics until the next push replaces it or someone deletes it.`,
        pros: [
          `A job that runs for seconds can report to a pull-based system without changing Prometheus.`,
          `It is the documented fit for the outcome of a service-level batch job, one not tied to a particular machine, such as a nightly export.`,
          `A pushed "last success" timestamp gives a simple, reliable alert: page if the job has not succeeded in a day.`,
          `Go and Python client libraries can push in a few lines with the metric types the team already uses.`
        ],
        cons: [
          `It never forgets: pushed series are exposed forever unless deleted through its API, so a dead job looks alive.`,
          `You lose the per-instance <code>up</code> signal, because Prometheus only sees whether the gateway itself is up.`,
          `The Prometheus docs warn that it becomes a single point of failure and a possible bottleneck when many instances push to it.`,
          `It does not aggregate, so two instances pushing to the same group overwrite each other instead of adding up.`
        ],
        pick: `Pick the Pushgateway only for service-level batch jobs that exit before a scrape and can be named with a stable job label.`,
        avoid: `Avoid it for services, per-instance metrics and anything you want health checks on; use pull, the Node Exporter textfile collector for per-machine jobs, or OTLP push.`,
        example: `A nightly Python export job pushes <code>export_rows_processed</code> and <code>export_last_success_timestamp_seconds</code> when it finishes, and an alert fires if the timestamp is more than 26 hours old.`,
        tools: `Prometheus Pushgateway, Node Exporter textfile collector`
      },
      {
        name: `OTLP push (OpenTelemetry SDK to a Collector)`,
        what: `The app records measurements with the OpenTelemetry SDK, which aggregates them in memory and exports them with the OpenTelemetry Protocol (OTLP) on a timer; the default interval is 60 seconds. It usually sends to an OpenTelemetry Collector, which can batch, retry, filter and forward to one or more backends. Prometheus can also receive OTLP directly when started with <code>--web.enable-otlp-receiver</code>.`,
        pros: [
          `One SDK and one pipeline carry metrics, traces and logs, so the same service name and version attributes appear on every signal.`,
          `It works from anywhere that can open an outbound connection: serverless functions, short tasks, edge devices and customer networks.`,
          `Switching or adding a backend becomes a Collector config change instead of a code change, since OpenTelemetry is vendor-neutral.`,
          `The Collector takes over retries, batching, encryption and filtering of sensitive data, so the app can hand data off quickly.`
        ],
        cons: [
          `There is no <code>up</code> series, because <code>up</code> comes from scrapes, so you must alert on absent data to notice a silent app.`,
          `The Collector is another tier to size, monitor and keep highly available, or it becomes the new single point of failure.`,
          `OTLP allows delta temporality, but Prometheus works with cumulative values, and its delta-to-cumulative conversion is experimental and behind a feature flag.`,
          `Resource attributes such as service name are not Prometheus labels by default; you promote the ones you need or join on <code>target_info</code>.`
        ],
        pick: `Pick OTLP push when you already use OpenTelemetry for traces, when targets are short-lived or unreachable, or when data goes to a vendor or several backends.`,
        avoid: `Avoid adding a Collector tier when every target is long-running inside one network and scraping already works.`,
        example: `Short-lived Kubernetes jobs and AWS Lambda functions export OTLP to a Collector deployment, which forwards metrics to Prometheus and traces to Grafana Tempo.`,
        tools: `OpenTelemetry SDKs, OpenTelemetry Collector, Grafana Alloy, Prometheus OTLP receiver`
      }
    ],
    compare: [
      [`Who starts the transfer`, `Prometheus scrapes the app`, `Job pushes, Prometheus scrapes the gateway`, `App pushes on a timer`],
      [`Notices a dead target`, `Yes, <code>up</code> is free`, `No per-job health`, `Only with absent-data alerts`],
      [`Short-lived jobs`, `Missed if they exit early`, `Built for this`, `Fine if the SDK flushes`],
      [`Targets behind NAT`, `Needs network reach or PushProx`, `Fine, outbound push`, `Fine, outbound push`],
      [`Stale data risk`, `Low, series go stale`, `High, never forgets`, `Low, data just stops`],
      [`Extra moving parts`, `Service discovery config`, `Gateway process`, `Collector tier`]
    ],
    decide: [
      [`Does the process run for longer than a few scrape intervals?`, `Prometheus pull.`],
      [`Is it a batch job that exits before a scrape and is not tied to one machine?`, `Pushgateway, with a last-success timestamp.`],
      [`Is it a cron job tied to one machine?`, `Node Exporter textfile collector.`],
      [`Is the target serverless, behind NAT or in a customer network?`, `OTLP push to a Collector.`],
      [`Do you already use OpenTelemetry for traces or send data to a vendor?`, `OTLP push, so all signals share one pipeline.`]
    ],
    scenario: {
      title: `Worked example: metrics for a mixed fleet`,
      setup: `You run 40 Go and Python services on Kubernetes, a nightly billing export job and a set of AWS Lambda functions. You already run Prometheus and Grafana, and the team plans to add tracing next quarter.`,
      steps: [
        `The services are long-running and reachable, so scrape them with Kubernetes service discovery and alert on <code>up == 0</code>.`,
        `The nightly export is a service-level batch job, so it pushes row counts and a last-success timestamp to a Pushgateway, with an alert if the timestamp is over 26 hours old.`,
        `Lambda functions cannot be scraped, so they export OTLP to a Collector that forwards to Prometheus, plus an alert on absent series because there is no <code>up</code>.`,
        `When tracing arrives, the same Collector carries spans too, so new services can start on OTLP for every signal.`
      ],
      answer: `Use pull as the default, the Pushgateway only for the batch job, and OTLP for what cannot be scraped. Each path needs its own way to detect silence: <code>up</code>, a last-success timestamp, and absent-series alerts.`
    },
    mistakes: [
      `Using the Pushgateway as a general push endpoint for services → stale series forever, no per-instance health, and one gateway that everything depends on.`,
      `Pushing with a new instance label on every run → each run leaves a group behind that never expires.`,
      `OTLP push with no absent-data alert → a crashed app just goes quiet and nothing pages.`,
      `A Python app with several Gunicorn worker processes and no multiprocess mode in <code>prometheus_client</code> → each scrape reads one worker's counters, so totals jump around.`,
      `Scraping a 20-second job once a minute → it finishes between scrapes and its metrics never exist.`
    ],
    rule: `Scrape long-running services, push from jobs that end before a scrape, and give every path an alert for silence.`,
    signals: [
      `The process lives less than one scrape interval → push: the Pushgateway for batch jobs, OTLP for serverless.`,
      `You already run OpenTelemetry for traces → let OTLP metrics share that pipeline.`,
      `The Pushgateway holds groups from jobs that no longer exist → it is being misused; delete them and move those apps to pull or OTLP.`,
      `Prometheus cannot reach targets across a network boundary → OTLP push or PushProx instead of opening firewalls.`
    ],
    interview: [
      `Why does Prometheus pull, and what do you lose when you push?`,
      `How would you monitor a cron job that runs for 30 seconds?`,
      `In a push system, how do you notice that a service stopped sending metrics?`
    ],
    related: [`o3`, `o4`],
    deep: [],
    db: [`time-series`],
    sources: [
      { t: `When to use the Pushgateway`, by: `Prometheus`, url: `https://prometheus.io/docs/practices/pushing/` },
      { t: `FAQ: Why do you pull rather than push?`, by: `Prometheus`, url: `https://prometheus.io/docs/introduction/faq/` },
      { t: `Using Prometheus as your OpenTelemetry backend`, by: `Prometheus`, url: `https://prometheus.io/docs/guides/opentelemetry/` },
      { t: `Collector`, by: `OpenTelemetry`, url: `https://opentelemetry.io/docs/collector/` }
    ]
  },
  {
    id: `observability-hosting`,
    area: `Observability`,
    title: `Self-hosted stack vs SaaS`,
    question: `Should you run your own observability stack, pay a vendor such as Datadog, or split the data between both?`,
    summary: `Self-hosting turns a usage bill into infrastructure plus engineer time, and gives you control over retention and where data lives. SaaS turns operations into a bill that grows with hosts, metric series and log volume. The real trade is engineer time and the reliability of the monitoring itself against cost at scale and control.`,
    why: `Choose badly and you either spend engineers nursing a fragile stack that fails during incidents, or pay a bill that grows faster than traffic because of cardinality and debug logs. Both are hard to undo once dashboards and alerts are built on one tool.`,
    options: [
      {
        name: `Self-hosted (Prometheus, Grafana, OpenSearch, Loki)`,
        what: `You run the open-source pieces yourself: Prometheus or Mimir for metrics, Loki or OpenSearch for logs, Tempo or Jaeger for traces, and Grafana on top. You size the clusters, set retention, back up the data and upgrade versions. The data stays in your own cloud account or data center.`,
        pros: [
          `At high volume the marginal cost is storage and compute, which can be far cheaper per series or per GB than usage pricing.`,
          `You choose retention and resolution yourself; Loki, for example, indexes only labels and keeps compressed logs in cheap object storage.`,
          `Data never leaves your network, which simplifies data residency and privacy reviews.`,
          `Open formats such as PromQL, OTLP and Grafana dashboards avoid lock-in to one vendor's agent and query language.`
        ],
        cons: [
          `Someone must own capacity planning, upgrades, backups and on-call for the monitoring itself, which is real engineer time.`,
          `One Prometheus server's local storage is not clustered or replicated, so durability and scale mean running Thanos or Mimir, which are distributed systems too.`,
          `If the stack shares infrastructure with production, it can fail in the same outage you need it for.`,
          `Linking metrics, logs and traces in one UI takes integration work that vendors ship ready-made.`
        ],
        pick: `Pick self-hosting when telemetry volume is large, cost or data residency matters, and a platform team can own it.`,
        avoid: `Avoid it for a small team with nobody to run it, since a half-maintained stack fails silently. Buy SaaS until the bill pays for the people.`,
        example: `A company producing billions of log lines a day runs Loki on object storage for debug logs and Mimir for metrics, with a small platform team on call for both.`,
        tools: `Prometheus, Thanos, Grafana Mimir, Grafana Loki, OpenSearch, Grafana Tempo, Jaeger, Grafana`
      },
      {
        name: `SaaS (Datadog, New Relic, Grafana Cloud)`,
        what: `A vendor runs ingestion, storage and the UI; you install its agent or send OTLP, and pay by usage units such as hosts, custom metric series, log volume or indexed log events. Datadog, for example, counts each unique combination of metric name and tag values, including the host tag, as a separate custom metric.`,
        pros: [
          `Setup is fast because agents, integrations, dashboards and alerting come ready to use.`,
          `Metrics, logs, traces and profiles are linked in one UI, so an engineer goes from a spike to a trace to its logs in a few clicks.`,
          `The vendor is on call for the platform, and it runs outside your infrastructure, so dashboards, history and alerts stay up when your cluster is down.`,
          `Regional sites help with data residency; Datadog runs fully independent sites, including one in the EU, and data is not shared across them.`
        ],
        cons: [
          `Cost follows usage you do not fully control: one new high-cardinality tag or debug log flag can multiply the bill.`,
          `Proprietary agents, query languages and dashboards make leaving expensive, which weakens you at renewal time.`,
          `Long retention of raw, high-volume data is priced by tier and gets costly fast.`,
          `Telemetry leaves your network, so personal data in logs must be scrubbed before it is sent.`
        ],
        pick: `Pick SaaS when the team is small or moving fast, when nobody should be on call for monitoring, and while the bill is small next to an engineer's salary.`,
        avoid: `Avoid sending high-volume, low-value data (debug logs, metrics nobody reads) to usage-priced SaaS; filter it or route it elsewhere first.`,
        example: `A 15-person startup installs the Datadog agent on its Kubernetes nodes and gets linked APM, logs and dashboards without running any storage.`,
        tools: `Datadog, New Relic, Grafana Cloud, Honeycomb, Elastic Cloud, AWS CloudWatch`
      },
      {
        name: `Hybrid`,
        what: `You split by value: keep high-volume, low-value data (debug logs, raw infrastructure metrics) in a self-hosted or cloud-native store, and send curated signals (SLO metrics, error traces, audit logs) to a vendor. An OpenTelemetry Collector in front of both routes each stream, so apps do not change when the split changes.`,
        pros: [
          `Cost follows value: you pay vendor prices only for the data engineers actually query during incidents.`,
          `Instrumenting with OpenTelemetry keeps the split reversible, because moving a stream is a Collector config change.`,
          `Each store can be tuned for its job, such as cheap object storage for logs kept only for audits.`,
          `You can migrate in either direction gradually instead of in one risky switch.`
        ],
        cons: [
          `Engineers must know which tool holds which data, and during incidents they search in the wrong place.`,
          `Two systems mean two bills, two sets of access controls and two things to keep running.`,
          `Correlation across tools is weaker: a trace in the vendor may not link to logs in your own store.`,
          `Routing rules need an owner, or data drifts back into the expensive tier.`
        ],
        pick: `Pick hybrid when one signal, usually logs, dominates the bill, or when some data must stay in-house while the rest can go to a vendor.`,
        avoid: `Avoid it for small teams and early products; one tool everyone knows beats two half-used ones.`,
        example: `A team keeps 30 days of debug logs in Loki on object storage and sends only error logs, traces and SLO metrics to its vendor, routed by one Collector.`,
        tools: `OpenTelemetry Collector, Vector, Fluent Bit, Grafana Alloy`
      }
    ],
    compare: [
      [`Main cost`, `Infrastructure plus engineer time`, `Usage-based bill`, `Both, sized by routing`],
      [`Setup effort`, `High, you build and run it`, `Low, install an agent or send OTLP`, `Medium, two systems plus routing`],
      [`On call for monitoring`, `Your team`, `The vendor`, `Both`],
      [`Cost at high volume`, `Lowest per unit, if run well`, `Grows with hosts, series and log volume`, `Middle, vendor gets curated data`],
      [`Data location control`, `Full`, `Limited to vendor regions`, `Full for in-house data`],
      [`Lock-in`, `Low, open formats`, `High, agents and query languages`, `Low if apps use OpenTelemetry`],
      [`Cross-signal correlation`, `You wire it up`, `Built in`, `Weaker across tools`]
    ],
    decide: [
      [`Is anyone free to own the stack, including on-call for it?`, `If not, SaaS.`],
      [`Is observability a large and growing share of the infra bill?`, `Cut cardinality and log volume, then self-host the biggest signal (usually logs) or go hybrid.`],
      [`Must data stay in your account or country?`, `Self-hosted, or a vendor with a site in that region.`],
      [`Do you need linked metrics, traces and logs now with little effort?`, `SaaS.`],
      [`Are apps instrumented with a vendor's proprietary agent or SDK?`, `Move to OpenTelemetry first, so any later switch is a config change.`]
    ],
    scenario: {
      title: `Worked example: the observability bill doubled`,
      setup: `A 60-engineer company runs 300 hosts on a SaaS vendor. The bill doubled in a year while traffic grew 30%, mostly from indexed logs and custom metrics. The platform team has 4 people.`,
      steps: [
        `Find the drivers: a new tag with per-customer values multiplied custom metric series, and debug logs are indexed at full volume.`,
        `Fix the cheap things first: drop the high-cardinality tag, stop indexing debug logs or sample them, and shorten retention on noisy indexes.`,
        `If logs still dominate, route debug logs through an OpenTelemetry Collector to self-hosted Loki on object storage, and keep error logs, traces and SLO metrics in the vendor.`,
        `Keep the vendor for incident work, since 4 people cannot run metrics, logs and traces for 300 hosts and also be on call for them.`
      ],
      answer: `Go hybrid: fix cardinality and log volume at the source, then self-host only the highest-volume, lowest-value stream. Moving everything in-house would swap a bill for an on-call load the team cannot staff.`
    },
    mistakes: [
      `Self-hosting to save money with no owner → a stack that fills its disks and fails exactly during an incident.`,
      `Sending every debug log and tag to usage-priced SaaS → a bill that grows faster than traffic.`,
      `Instrumenting with a vendor's proprietary SDK → switching later means touching every service.`,
      `Running the monitoring on the same cluster it watches → no visibility in the outage you need it for.`
    ],
    rule: `Buy while you are small, instrument with OpenTelemetry so you can move later, and self-host the highest-volume signal first once the bill pays for an engineer.`,
    signals: [
      `Observability is a large and growing share of the infra bill → cut cardinality and log volume, then move logs first.`,
      `Nobody owns the self-hosted stack and it keeps falling over → buy.`,
      `Data residency or privacy rules apply → self-host, or pick a vendor site in the required region.`,
      `Engineers avoid adding metrics because of cost → pricing is shaping your observability; revisit the split.`
    ],
    interview: [
      `How would you cut an observability bill without losing incident visibility?`,
      `What does it take to run Prometheus for 1,000 hosts with a year of retention?`,
      `Where should monitoring run so it still works when production is down?`
    ],
    related: [`e4`, `e3`, `e7`],
    deep: [],
    db: [`time-series`, `search`],
    sources: [
      { t: `Storage`, by: `Prometheus`, url: `https://prometheus.io/docs/prometheus/latest/storage/` },
      { t: `Loki overview`, by: `Grafana Labs`, url: `https://grafana.com/docs/loki/latest/get-started/overview/` },
      { t: `Custom Metrics Billing`, by: `Datadog`, url: `https://docs.datadoghq.com/account_management/billing/custom_metrics/` },
      { t: `What is OpenTelemetry?`, by: `OpenTelemetry`, url: `https://opentelemetry.io/docs/what-is-opentelemetry/` }
    ]
  },
  {
    id: `trace-sampling`,
    area: `Observability`,
    title: `Head vs tail sampling`,
    question: `Which traces do you keep, and do you decide when a request starts or after it finishes?`,
    summary: `Head sampling decides at the root span, before anything is known about the request, so it is cheap and every service agrees, but rare errors are dropped at the same rate as boring successes. Tail sampling decides after the trace completes, so it can keep every error and slow trace, but it needs a stateful Collector tier that buffers whole traces.`,
    why: `With 1% head sampling, a failure that hits 0.1% of requests leaves about one trace per 100,000 requests, so the trace you need is missing during the incident. A badly sized tail tier drops traces before deciding or runs out of memory.`,
    options: [
      {
        name: `Head sampling`,
        what: `The root service decides when the trace starts, usually with a probability based on the trace ID (the OpenTelemetry <code>TraceIdRatioBased</code> sampler), and records the result in the sampled flag of the W3C <code>traceparent</code> header. Downstream services use a parent-based sampler that follows the flag, so a trace is kept or dropped as a whole. The SDK default, <code>parentbased_always_on</code>, keeps every trace until you set a ratio.`,
        pros: [
          `It is cheap: unsampled spans are never exported, so CPU, network and storage costs fall with the rate.`,
          `It is stateless and simple; the OpenTelemetry docs call it easy to understand, easy to configure and efficient.`,
          `A decision based on the trace ID is consistent, so every service keeps the same traces and you get complete traces at a known rate.`,
          `A known rate lets you scale counts back up: at 5%, each kept trace stands for about 20 requests.`
        ],
        cons: [
          `It cannot keep "all errors" or "all slow requests", because the outcome is unknown when the decision is made.`,
          `Rare events are kept at the same low rate as normal traffic, so rare failures leave very few traces.`,
          `The W3C spec calls the sampled flag a recommendation, so a service that ignores it or drops the header breaks complete traces.`,
          `One global rate fits nobody: busy endpoints fill storage while quiet ones keep too few traces.`
        ],
        pick: `Pick head sampling as the default for busy services with uniform traffic, and keep 100% (no sampling) for low-volume services.`,
        avoid: `Avoid relying on head sampling alone when the traces you care about are rare errors or tail latency; add tail sampling for those.`,
        example: `A Python API sets <code>OTEL_TRACES_SAMPLER=parentbased_traceidratio</code> and <code>OTEL_TRACES_SAMPLER_ARG=0.05</code> to keep about 5% of traces, and every downstream Go service follows the parent's flag.`,
        tools: `OpenTelemetry SDK samplers, Collector probabilistic sampler, Jaeger remote sampling`
      },
      {
        name: `Tail sampling`,
        what: `Every service exports all spans to a Collector tier. The Collector buffers spans by trace ID, waits for the trace to finish (the tail sampling processor's <code>decision_wait</code> defaults to 30 seconds), then applies policies such as "keep errors", "keep traces over 1 second" and "keep 5% of the rest". Because a decision needs the whole trace, a first layer of Collectors routes spans by trace ID to the sampling layer with the load balancing exporter.`,
        pros: [
          `It can keep every error and slow trace while dropping most healthy ones, which is the data you want in an incident.`,
          `Policies can use anything in the trace: status, latency, or attributes such as customer tier or a newly deployed version.`,
          `Storage cost falls while useful traces stay, since most traffic is healthy and repetitive.`,
          `Rules live in the Collector, so you change what you keep without redeploying services.`
        ],
        cons: [
          `All spans still leave the services and cross the network, so export and Collector costs scale with full traffic.`,
          `The tier is stateful: it holds spans in memory, and the OpenTelemetry docs warn it can need dozens or even hundreds of nodes and close monitoring.`,
          `All spans of a trace must reach the same Collector, and when that layer scales, some routes move to a different Collector.`,
          `Spans that arrive after the decision can get a different decision, and traces longer than the wait are judged before they finish.`
        ],
        pick: `Pick tail sampling when volume is high, you must keep rare errors and slow requests, and you can run and monitor a Collector tier.`,
        avoid: `Avoid it for low-volume systems (keep everything instead) and when nobody can run a stateful pipeline; head sampling plus error logs is simpler.`,
        example: `A payments platform keeps 100% of traces with errors or latency over 2 seconds and 2% of the rest, routing spans through a load-balancing Collector layer to a tail-sampling layer sized for 30 seconds of traffic.`,
        tools: `OpenTelemetry Collector tail sampling processor, load balancing exporter, Grafana Tempo, vendor tail samplers`
      }
    ],
    compare: [
      [`When it decides`, `At the root span`, `After the trace completes`],
      [`Keeps all errors`, `No, only by chance`, `Yes, by policy`],
      [`State needed`, `None`, `Whole traces buffered in memory`],
      [`Network cost`, `Only kept spans are exported`, `All spans go to Collectors`],
      [`Routing requirement`, `None`, `Same Collector for each trace ID`],
      [`Main failure mode`, `The interesting trace was dropped`, `Traces dropped under memory pressure`]
    ],
    decide: [
      [`Do you produce only tens of small traces per second or fewer?`, `Do not sample; keep everything.`],
      [`Is traffic high and mostly healthy, with no need to keep every error?`, `Head sampling at a fixed ratio.`],
      [`Must you keep every error and slow trace?`, `Tail sampling in a Collector tier.`],
      [`Is volume so high that the tail tier would be overloaded?`, `Head sample at a moderate rate first, then tail sample.`],
      [`Do you need exact request and error rates?`, `Compute them from all spans, or in the services, before any sampling.`]
    ],
    scenario: {
      title: `Worked example: tracing 20,000 requests per second`,
      setup: `A ride-hailing backend serves 20,000 requests per second across 30 services. About 0.2% of requests fail, and the team needs every error trace plus enough normal traces to compare. The trace store budget is about 500 traces per second.`,
      steps: [
        `Head sampling at 2.5% fits the budget (500 per second) but also keeps only 2.5% of the 40 errors per second, about 1 error trace per second.`,
        `Tail sampling can keep all 40 error traces per second plus slow ones, and fill the rest of the budget with a small share of healthy traces.`,
        `The cost moves into the pipeline: every span flows to Collectors that hold 30 seconds of traces in memory, behind a layer that routes by trace ID.`,
        `Emit request, error and latency metrics from all spans (or from the services) before the sampler, so dashboards stay exact.`
      ],
      answer: `Use tail sampling with "all errors, all slow, a few percent of the rest", sized and monitored as a stateful tier. If the Collectors cannot keep up, put a moderate head sample in front and accept losing some rare traces.`
    },
    mistakes: [
      `Relying on head sampling alone and expecting error traces to be there → the rare failure you need was dropped at the root.`,
      `Running tail sampling behind a plain round-robin load balancer → spans of one trace land on different Collectors and decisions are made on fragments.`,
      `Setting <code>decision_wait</code> shorter than your slowest traces → long traces are judged before they finish.`,
      `Counting requests from sampled traces → rates and error ratios are off unless scaled by the sampling rate.`,
      `Services that do not pass <code>traceparent</code> through queues → broken traces that no sampler can fix.`
    ],
    rule: `Keep everything while volume is low, head sample when traffic is uniform, and add tail sampling when you must keep rare errors and slow requests.`,
    signals: [
      `The error trace is never there when you look → add tail sampling with an always-keep rule for errors.`,
      `Trace storage costs too much and the traces are mostly healthy → lower the head ratio.`,
      `Tail-sampling Collectors run out of memory or drop traces before deciding → add nodes, raise <code>num_traces</code>, or head sample in front.`,
      `A low-traffic service has only a handful of traces → stop sampling it.`
    ],
    interview: [
      `Why can head sampling not keep all error traces, and what does tail sampling need to do it?`,
      `How do you make sure all spans of one trace reach the same tail-sampling Collector?`,
      `How do you keep request and error rates accurate when traces are sampled?`
    ],
    related: [`o2`, `o5`],
    deep: [],
    db: [],
    sources: [
      { t: `Sampling`, by: `OpenTelemetry`, url: `https://opentelemetry.io/docs/concepts/sampling/` },
      { t: `Tail Sampling Processor`, by: `OpenTelemetry Collector Contrib`, url: `https://github.com/open-telemetry/opentelemetry-collector-contrib/blob/main/processor/tailsamplingprocessor/README.md` },
      { t: `Trace Context`, by: `W3C`, url: `https://www.w3.org/TR/trace-context/` },
      { t: `Environment Variable Specification`, by: `OpenTelemetry`, url: `https://opentelemetry.io/docs/specs/otel/configuration/sdk-environment-variables/` }
    ]
  },
  {
    id: `retry-vs-fail-fast`,
    area: `Reliability`,
    title: `Retry vs fail fast`,
    question: `When a call to a dependency fails, should you retry now, return an error at once, or retry later from a queue?`,
    summary: `Retries turn transient failures into successes, but each retry is extra load on a dependency that may already be failing, and retries at several layers multiply. Failing fast protects the dependency and the caller's deadline but shows more errors to users. You trade apparent availability against load amplification and latency.`,
    why: `Retry wrong and a small blip becomes an outage: Google's SRE book shows 3 retries at each of 3 layers sending 64 attempts to an overloaded database for one user action. Fail fast where one retry would have worked and users see errors you could have hidden.`,
    options: [
      {
        name: `Retry with backoff and jitter`,
        what: `The client catches a retryable failure (timeout, connection reset, 503, 429), waits, and tries again up to a small cap. The wait grows exponentially and is randomized: with "full jitter" it is a random time between 0 and <code>min(cap, base * 2**attempt)</code>, the formula the AWS SDKs use. Good clients also limit retries with a budget, such as a token bucket or a maximum ratio of retries to requests.`,
        pros: [
          `Most transient errors (a dropped connection, one bad host) succeed on the next attempt, so users never see them.`,
          `Backoff spreads retries over time and jitter breaks up synchronized retries; in AWS's simulation with 100 contending clients, jitter cut the call count by more than half.`,
          `Retrying on another replica is cheap when only a few backends are overloaded, which Google's SRE book describes as a form of organic load balancing.`,
          `Good libraries exist: AWS SDKs retry with backoff, jitter and a retry quota, and gRPC supports retry policies with throttling.`
        ],
        cons: [
          `Retries are selfish: each one spends more of the server's time, and when the failure is overload they make it worse and delay recovery.`,
          `Retries multiply across layers: AWS's example of a five-deep call stack with three tries per layer puts 243 times the load on the database.`,
          `Retrying a call with side effects can repeat it (two charges, two emails) unless the API accepts an idempotency key.`,
          `Each retry adds latency, and a retry that finishes after the caller's deadline is wasted work.`
        ],
        pick: `Pick retries for transient failures of idempotent calls, or calls with an idempotency key: timeouts, connection errors, 503s, and 429s after honoring <code>Retry-After</code>. Retry in one layer only, with a small attempt cap and a retry budget.`,
        avoid: `Do not retry most 4xx errors, which will not fix themselves, non-idempotent calls without a key, or a dependency that is clearly overloaded; fail fast or queue instead.`,
        example: `Stripe's API stores the result of the first request for each <code>Idempotency-Key</code>, including 500 errors, so a client can retry a timed-out charge without charging twice.`,
        tools: `AWS SDK standard retry mode, gRPC retry policy, Envoy retry policy, cenkalti/backoff (Go), tenacity (Python)`
      },
      {
        name: `Fail fast`,
        what: `The caller returns an error immediately instead of waiting or retrying. Typical triggers are a remaining deadline too short to finish, an open circuit breaker after repeated failures, a permanent error (validation, auth, not found), or an explicit overload signal from the dependency. With deadline propagation, every service in the call tree knows how much time is left.`,
        pros: [
          `It protects an overloaded dependency, because no extra attempts land on it while it recovers.`,
          `Users get an answer quickly instead of hanging; the SRE book advises returning an error for an unavailable backend at once rather than tying up resources waiting.`,
          `Threads, connections and memory are freed quickly, so one slow dependency cannot exhaust the caller and cascade upward.`,
          `Permanent errors surface right away with a clear cause instead of after several slow, doomed attempts.`
        ],
        cons: [
          `Users see errors that a single retry might have hidden, which lowers apparent availability.`,
          `Circuit breakers add modes that are hard to test, and AWS notes they can add significant time to recovery.`,
          `It depends on good error classification; treating a transient timeout as permanent fails requests that would have worked.`,
          `The caller must handle the error well (a fallback, a clear message, a later retry), or failing fast just moves the pain.`
        ],
        pick: `Pick fail fast for permanent errors, when the caller's deadline is nearly spent, when a dependency returns an explicit overload signal, and while a circuit breaker is open.`,
        avoid: `Avoid failing fast on transient errors of cheap, idempotent reads, where one quick retry on another replica usually works, and on background work, where a delayed retry costs nothing.`,
        example: `A gRPC service passes its remaining deadline down the call chain, so a downstream service that receives a request with no time left returns <code>DEADLINE_EXCEEDED</code> at once instead of doing work nobody will read.`,
        tools: `gRPC deadlines, Go context.WithTimeout, sony/gobreaker, pybreaker, Envoy outlier detection`
      },
      {
        name: `Retry later through a queue`,
        what: `The work goes onto a queue and a worker processes it; on failure the message is retried later with a growing delay. After a maximum number of attempts it moves to a dead-letter queue (DLQ) for inspection and replay. Nobody waits on the result, so retries can be spread over minutes or hours.`,
        pros: [
          `Delays can be long enough for real recovery (a restart, a rate-limit window), which in-request retries cannot afford.`,
          `The queue absorbs bursts and lets workers process at the rate the dependency can take.`,
          `Failed work is not lost: the DLQ keeps it for debugging and replay after a fix.`,
          `The user-facing request finishes quickly, because it only has to enqueue.`
        ],
        cons: [
          `The result arrives later, so the product must show a pending state.`,
          `Delivery is at least once, so handlers must be idempotent or duplicates cause double effects.`,
          `A DLQ nobody watches is a silent data-loss bin; it needs alerts, an owner and replay tooling.`,
          `Poison messages that always fail burn worker time, and can block ordered queues, until they hit the attempt cap.`
        ],
        pick: `Pick queue retries for background work that can finish minutes later: webhooks, emails, exports, syncs with partners.`,
        avoid: `Avoid it for requests that must answer now, such as login or a price quote; retry once in the request or fail fast.`,
        example: `Stripe retries webhook deliveries for up to three days with exponential backoff in live mode, and tells receivers to deduplicate by event ID because an event can arrive more than once.`,
        tools: `SQS with a DLQ, RabbitMQ dead-letter exchanges, Kafka retry topics, Celery retries, Temporal`
      }
    ],
    compare: [
      [`Latency for the caller`, `Higher, waits for attempts`, `Lowest, answers at once`, `Lowest, only enqueues`],
      [`Load on a failing dependency`, `Higher, multiplies across layers`, `Lowest`, `Set by worker rate`],
      [`Hides transient errors`, `Yes`, `No`, `Yes, eventually`],
      [`Needs idempotency`, `Yes, or an idempotency key`, `No`, `Yes, delivery is at least once`],
      [`When the result arrives`, `Same request`, `Same request, as an error`, `Minutes to hours later`],
      [`Main risk`, `Retry storms`, `Errors a retry would have fixed`, `An unwatched DLQ`]
    ],
    decide: [
      [`Is the error permanent (validation, auth, not found)?`, `Fail fast; a retry cannot help.`],
      [`Is the call idempotent or protected by an idempotency key?`, `If not, do not retry automatically; add a key first.`],
      [`Is the dependency signaling overload (429, 503, rising latency)?`, `Back off: honor Retry-After, or fail fast.`],
      [`Is there enough deadline left for another attempt?`, `If not, fail fast.`],
      [`Can the result arrive later without hurting the user?`, `Queue it, with backoff and a DLQ.`],
      [`Does another layer above or below already retry?`, `Retry in one layer only.`]
    ],
    scenario: {
      title: `Worked example: payment calls are timing out`,
      setup: `A checkout service calls a payment provider. During a provider incident, 20% of calls time out after 3 seconds. Checkout has a 10-second user-facing deadline, and today the mobile app, the API gateway and the checkout service each retry 3 times.`,
      steps: [
        `Count the amplification: 4 attempts at each of 3 layers means up to 64 calls to the provider for one tap, aimed at a provider that is already struggling.`,
        `Keep retries in one layer, the checkout service, which knows the call and its deadline, and turn them off in the gateway and the app.`,
        `Send an idempotency key with every charge, so a retry after a timeout cannot charge twice.`,
        `Cap it: at most 2 retries with jittered backoff, only while the deadline allows, and stop once a retry budget (say 10% of requests) is spent.`,
        `If the provider stays down, fail fast to a "payment pending" state and let a queue retry the charge for hours.`
      ],
      answer: `Retry, but in one layer, with idempotency keys, jittered backoff, a deadline check and a budget, then fail fast into a queued pending state. That hides blips without turning the provider's incident into a retry storm.`
    },
    mistakes: [
      `Retrying at every layer → load multiplies (64 attempts in the SRE book's example) exactly when the dependency is weakest.`,
      `Retrying without jitter → clients retry in sync and hit the dependency in waves.`,
      `Retrying non-idempotent writes without a key → duplicate charges, orders or emails.`,
      `Retrying permanent errors such as 400 or 401 → wasted load and slower failures.`,
      `Unbounded retries with no budget → a small outage becomes a retry storm that keeps the dependency down after the cause is fixed.`
    ],
    rule: `Retry only transient failures of idempotent calls, in one layer, with jittered backoff, a deadline check and a budget; otherwise fail fast or queue.`,
    signals: [
      `Downstream latency and errors climb together → stop retrying and let a breaker or a budget kick in.`,
      `Retries create duplicates → add idempotency keys before adding retries.`,
      `Every layer of the call chain retries → keep retries in one layer only.`,
      `Retry traffic stays high after the original fault is fixed → retries are keeping it overloaded; cap them with a budget.`
    ],
    interview: [
      `Which errors would you retry, and which never?`,
      `How do retries at several layers amplify load, and how do you prevent it?`,
      `How do you make a payment call safe to retry?`
    ],
    related: [`r3`, `r4`, `c10`, `a6`],
    deep: [`idempotency-keys`, `circuit-breaker`, `load-shedding-backpressure`],
    db: [],
    sources: [
      { t: `Timeouts, retries and backoff with jitter`, by: `Marc Brooker, Amazon Builders' Library`, url: `https://builder.aws.com/content/3EumjoZascWd1oZiEgL8ORlv3qE/timeouts-retries-and-backoff-with-jitter` },
      { t: `Addressing Cascading Failures (Site Reliability Engineering, chapter 22)`, by: `Google`, url: `https://sre.google/sre-book/addressing-cascading-failures/` },
      { t: `Exponential Backoff And Jitter`, by: `Marc Brooker, AWS Architecture Blog`, url: `https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/` },
      { t: `Idempotent requests`, by: `Stripe`, url: `https://docs.stripe.com/api/idempotent_requests` }
    ]
  },
  {
    id: `fail-open-vs-closed`,
    area: `Reliability`,
    title: `Fail open vs fail closed`,
    question: `When a check such as auth, a rate limiter or a fraud score cannot answer, do you allow the request, deny it, or fall back to something safer?`,
    summary: `Failing open keeps the product available when a check is down but switches the protection off. Failing closed keeps the protection but turns the check's outage into your outage. Google's security book frames this as reliability against security, and the answer depends on what the check guards: money and access, or capacity and convenience.`,
    why: `Fail open on authentication and anyone who can knock the auth service over gets in for free. Fail closed on a rate limiter and one Redis blip takes down the whole API, even though nobody was abusing it.`,
    options: [
      {
        name: `Fail open (allow)`,
        what: `If the check errors or times out, the request goes through as if the check said yes. The code catches the failure, logs it, increments a metric and carries on. Envoy's global rate limit filter works this way by default: unless <code>failure_mode_deny</code> is set to true, traffic is allowed when the rate limit service does not answer.`,
        pros: [
          `Availability does not depend on the check, so an outage of a helper service is invisible to users.`,
          `It is the right default for checks that exist to keep you up, such as rate limiters; Stripe built its limiters to fail open if Redis went down.`,
          `It is simple: one catch block and a counter, with no fallback data to maintain.`,
          `It stops bugs in non-critical code from becoming outages, such as a new limiter rule that throws an exception.`
        ],
        cons: [
          `The protection is gone during the outage, so abuse, overload or overspend can get through.`,
          `Attackers can trigger it on purpose; Google's security book warns that failing open lets an attacker degrade security with a denial-of-service attack alone.`,
          `It fails silently, so you need an alert on the fail-open counter or nobody notices.`,
          `A check that started as convenience (spam scoring, say) can quietly become a security control while still failing open.`
        ],
        pick: `Pick fail open for checks that protect capacity or convenience, where a short gap costs less than blocking good users: rate limiters, recommendations, personalization, analytics.`,
        avoid: `Avoid it for authentication, authorization, payments, fraud and abuse controls; there, fail closed or use a stricter local fallback.`,
        example: `Stripe's API rate limiters catch exceptions at every level, so a Redis outage or a bug in limiter code lets requests through instead of failing the API.`,
        tools: `Envoy rate limit filter (default), middleware with a catch-and-allow path, feature flag SDK defaults`
      },
      {
        name: `Fail closed (deny)`,
        what: `If the check cannot answer, the request is rejected with an error. Security code is written so that any exception follows the same path as "deny". Envoy's external authorization filter does this by default: with <code>failure_mode_allow</code> false, it returns 403 when the auth service is unreachable or returns a 5xx.`,
        pros: [
          `The protection holds even when its service is down or under attack, which is what security and money paths need.`,
          `It matches OWASP's "fail securely" advice: methods like <code>isAuthorized()</code> should return false when they hit an exception.`,
          `Behavior is predictable and easy to audit, since no error path grants access.`,
          `Attackers gain nothing by crashing the checker, because a crash denies them too.`
        ],
        cons: [
          `Your availability can be no better than the checker's, so the checker must be as reliable as the product.`,
          `A blip in that dependency becomes a full outage for every request that needs the check.`,
          `Legitimate users are locked out during the outage, which in some products is worse than the risk.`,
          `Users and on-call see auth-looking errors unless the response clearly says "unavailable" rather than "forbidden".`
        ],
        pick: `Pick fail closed for authentication, authorization, payments, balance checks, fraud and abuse decisions, and admission controls that enforce policy.`,
        avoid: `Avoid it for checks unrelated to safety, where denying turns a small outage into a full one; fail open or degrade instead.`,
        example: `Kubernetes admission webhooks default to <code>failurePolicy: Fail</code>, so if a policy webhook is unreachable, the API server rejects the request instead of admitting an unchecked object.`,
        tools: `Envoy ext_authz (default), Kubernetes admission webhooks, Open Policy Agent, API gateway authorizers`
      },
      {
        name: `Degrade to a safe default`,
        what: `If the check cannot answer, use a decision that is safe and bounded: a cached result with a short TTL, a stricter local limit, a reduced feature, or "accept but hold for review". The goal is to keep serving some traffic without giving up the protection. Google's security book suggests replacing a failed control with a cheaper alternative that applies stronger restrictions.`,
        pros: [
          `You keep most of the availability and most of the protection instead of choosing one.`,
          `A stricter fallback, such as a lower local rate limit, makes attacking the main checker pointless.`,
          `Pushing data ahead of time removes the call from the hot path; AWS pushes IAM role credentials to EC2 instances that stay valid for hours, so requests keep working if the push breaks.`,
          `Holding risky actions for review keeps users moving without allowing anything irreversible.`
        ],
        cons: [
          `The degraded mode rarely runs, so it rots; AWS avoids classic fallback because it is hard to test and often fails or widens the outage when it finally triggers.`,
          `Cached decisions go stale: a revoked permission or a spent balance can still look valid until the TTL ends.`,
          `You must design, document and test a third behavior, including how to leave it.`,
          `Picking the safe default for each check needs product and security input, not only engineering.`
        ],
        pick: `Pick a degraded mode when a meaningful middle ground exists and you can exercise it continuously, for example by always serving cached permissions and refreshing them in the background.`,
        avoid: `Avoid it when the fallback value can be badly wrong, such as a stale balance approving a large spend, or when you cannot test it; fail closed instead.`,
        example: `When the fraud-scoring service times out, a payments API approves small, low-risk charges under a strict local limit and queues larger ones for review instead of allowing or blocking all of them.`,
        tools: `Local caches with a short TTL, last-known-good config, Envoy local rate limit, review queues`
      }
    ],
    compare: [
      [`During the check's outage`, `Everything allowed`, `Everything denied`, `A bounded subset allowed`],
      [`Your availability`, `Independent of the check`, `No better than the check's`, `Mostly independent`],
      [`Protection kept`, `None`, `Full`, `Partial, by design`],
      [`Attacker incentive`, `Crash the checker to get in`, `None, a crash denies them too`, `Low, the fallback is stricter`],
      [`Build and test cost`, `Low`, `Low`, `High, a rarely used mode`],
      [`Typical use`, `Rate limits, recommendations`, `Auth, payments, admission policy`, `Fraud scoring, cached permissions`]
    ],
    decide: [
      [`Does the check guard money, data access or identity?`, `Fail closed, or a stricter degraded mode.`],
      [`Does the check exist to protect your capacity, like a rate limiter?`, `Fail open, with a local backup limit and an alert.`],
      [`Could an attacker cause the failure on purpose?`, `Never fail open; fail closed or degrade to stricter rules.`],
      [`Is there a safe, bounded middle ground you can exercise regularly?`, `Degrade to it.`],
      [`Would denying stop a core flow for every user?`, `Make the checker as reliable as the product, or push its data to the hot path.`]
    ],
    scenario: {
      title: `Worked example: the API key validation service is down`,
      setup: `Your public API checks every request's API key against an auth service backed by a database. That service is down for 10 minutes. The API sends paid SMS messages for customers, so every request costs money.`,
      steps: [
        `Classify the check: API key validation is authentication on a money path, so plain fail open is not acceptable.`,
        `Look for a safe middle: each API node keeps a local cache of recently validated key hashes with a short TTL, refreshed in the background, so known keys keep working.`,
        `Deny unknown keys during the outage with a 503 and a <code>Retry-After</code> header, not a 401, so clients know it is temporary.`,
        `Limit the blast radius: while serving from cache, apply a lower per-account send limit and alert on every request served that way.`
      ],
      answer: `Fail closed for unknown keys and degrade to a short-lived cache for known ones, with a stricter limit. A revoked key stays usable for at most one TTL, which is the explicit price of staying up.`
    },
    mistakes: [
      `Catching every exception in an auth check and returning "allowed" → anyone who can break the auth service gets in.`,
      `Failing closed on a rate limiter backed by a single Redis → a cache blip takes down the whole API.`,
      `Shipping a fallback mode that never runs in production → it fails or misbehaves the first time it triggers.`,
      `Failing open with no metric or alert → protection is off for hours and nobody knows.`,
      `Mixing up "fail safe" and "fail secure" → in Google's security book, fail safe means staying available (open) and fail secure means locking down (closed).`
    ],
    rule: `Fail closed on security and money, fail open on capacity and convenience, and prefer a stricter, regularly exercised degraded mode when one exists.`,
    signals: [
      `The check guards money or access → fail closed, or degrade to a stricter mode.`,
      `The check exists to protect you from overload → fail open, with a local fallback limit.`,
      `One checker's outage would stop all traffic → cache or push its data so the hot path does not call it.`,
      `The fail-open counter stays above zero for long periods → treat it as an incident; the protection is off.`
    ],
    interview: [
      `Your rate limiter's Redis is down. Do you allow or block requests, and why?`,
      `How would you keep login working when the permissions service is slow?`,
      `How do you test a fallback path that only runs during outages?`
    ],
    related: [`r2`, `k8`],
    deep: [`rate-limiting`, `circuit-breaker`],
    db: [],
    sources: [
      { t: `Building Secure and Reliable Systems, chapter 8: Design for Resilience`, by: `Google (Adkins et al.)`, url: `https://google.github.io/building-secure-and-reliable-systems/raw/ch08.html` },
      { t: `Fail securely`, by: `OWASP`, url: `https://owasp.org/www-community/Fail_securely` },
      { t: `Avoiding fallback in distributed systems`, by: `Jacob Gabrielson, Amazon Builders' Library`, url: `https://builder.aws.com/content/3EuS9Sakq7L3VLQIF3qzfMfke1Y/avoiding-fallback-in-distributed-systems` },
      { t: `Scaling your API with rate limiters`, by: `Paul Tarjan, Stripe`, url: `https://stripe.com/blog/rate-limiters` }
    ]
  },
  {
    id: `rate-limit-algorithms`,
    area: `Reliability`,
    title: `Token bucket vs fixed window vs sliding window`,
    question: `How should a rate limiter count requests: token bucket, leaky bucket, fixed window or sliding window?`,
    summary: `Every limiter asks one question: has this client used too much recently? Fixed window counters are cheapest but let bursts through at window edges. Sliding windows fix the edges with more memory or an approximation. Buckets model a steady rate plus a burst allowance: a token bucket rejects the excess, while a leaky bucket queues it and releases it at a steady rate.`,
    why: `A window that resets every minute lets a client send nearly twice the limit in a few seconds around the reset, which can break a fragile downstream. A limiter that rejects when the downstream needed smoothing makes clients retry, which adds load instead of spreading it.`,
    options: [
      {
        name: `Token bucket`,
        what: `Each client has a bucket that holds up to <em>b</em> tokens and refills at <em>r</em> tokens per second. A request takes one token; if the bucket is empty, the request is rejected, usually with 429. Bursts of up to <em>b</em> requests pass at once, while the long-run rate cannot exceed <em>r</em>. You store only two numbers per client: the token count and the last refill time.`,
        pros: [
          `It allows short bursts while holding an average rate, which matches real clients that send in bursts.`,
          `It is cheap: two numbers per key, updated in constant time on each request.`,
          `It is the common production choice: Stripe, AWS API Gateway and Envoy's local rate limit filter all use token buckets.`,
          `Its two knobs match how people describe limits, such as "100 per second, bursts of 200".`
        ],
        cons: [
          `Rate and burst are two numbers to tune per limit, which Cloudflare found hard to get right for the closely related leaky bucket.`,
          `When many servers share one limit, the refill-and-take step must be atomic, for example a Lua script in Redis, or concurrent requests overspend.`,
          `A full bucket lets <em>b</em> requests hit the downstream at once, which is wrong for dependencies that accept no bursts.`,
          `A central store adds a network hop per request and becomes a dependency that must fail open or closed.`
        ],
        pick: `Pick a token bucket as the default for API limits per user, key or tenant, where short bursts are fine and the average rate is what matters.`,
        avoid: `Avoid it when the downstream accepts no bursts at all, such as a partner capped at N per second; shape traffic with a leaky bucket or a queue.`,
        example: `Stripe gives every user a token bucket in Redis and removes a token per request; AWS API Gateway exposes the same two knobs as a throttling rate and a burst.`,
        tools: `Redis with Lua, Envoy local rate limit, AWS API Gateway throttling, golang.org/x/time/rate`
      },
      {
        name: `Leaky bucket (as a queue)`,
        what: `Requests enter a queue (the bucket) and leave at a fixed rate, like water dripping from a hole. If the queue is full, new requests are rejected. The output is smooth however bursty the input is. NGINX's <code>limit_req</code> works this way: excess requests are delayed to the configured rate until they exceed <code>burst</code>, then rejected with 503 by default.`,
        pros: [
          `The downstream sees a steady rate with no bursts, which protects partners with strict per-second caps.`,
          `Clients are delayed rather than rejected while the queue has room, so fewer requests fail and fewer clients retry.`,
          `It is simple to reason about: one rate and one queue size.`,
          `NGINX ships it, so edge rate limiting needs only configuration.`
        ],
        cons: [
          `Queued requests wait, which adds latency, and a long queue can push requests past their deadlines.`,
          `Each key needs a queue and something to drain it, which costs memory and workers.`,
          `Legitimate bursts are slowed even when the backend has spare capacity.`,
          `A strict global drain rate across many servers needs one coordinator, which is a bottleneck and a single point of failure.`
        ],
        pick: `Pick a leaky bucket when the goal is shaping: sending to a dependency with a hard per-second cap, or smoothing writes into a fragile system.`,
        avoid: `Avoid it for interactive APIs where waiting is worse than a fast 429 and bursts are harmless; use a token bucket.`,
        example: `A notification service sends to an email provider capped at 100 requests per second; workers pull from a queue at exactly that rate instead of rejecting senders.`,
        tools: `NGINX limit_req, SQS or Kafka with fixed-rate consumers`
      },
      {
        name: `Fixed window counter`,
        what: `Time is cut into windows, such as each minute. Each request increments a counter keyed by client and window (for example <code>user:42:12:05</code>), and once the count passes the limit, requests are rejected until the next window. In Redis this is an <code>INCR</code> plus an <code>EXPIRE</code>, run inside <code>MULTI</code> or a Lua script so the expiry is never lost.`,
        pros: [
          `It is the simplest to build and explain: one counter per client per window.`,
          `It needs only an atomic increment, so it works on almost any store, including memcached.`,
          `Quotas map onto it naturally: "5,000 requests per hour" with a reset time is easy for customers to track.`,
          `Memory is tiny, and old windows expire by themselves.`
        ],
        cons: [
          `Bursts at the boundary: a client can use the full limit at the end of one window and again at the start of the next, nearly twice the limit in a short span.`,
          `Clients that wait for the reset all come back at the same moment, causing spikes at the top of each window.`,
          `If the increment and the expiry are not atomic, a crash between them leaves a key that never expires, a race the Redis docs call out.`,
          `It is coarse: a per-minute window cannot enforce a per-second limit.`
        ],
        pick: `Pick fixed windows for quotas and billing-style limits (per hour, per day) where edges do not matter and a reset time helps customers.`,
        avoid: `Avoid them for tight per-second protection of a backend, where the boundary burst can double the load; use a token bucket or a sliding window counter.`,
        example: `GitHub's REST API gives authenticated users 5,000 requests per hour and reports the remaining count and the time the current window resets in <code>x-ratelimit-*</code> headers.`,
        tools: `Redis INCR and EXPIRE, memcached incr, API gateway usage plans`
      },
      {
        name: `Sliding window (log or counter)`,
        what: `A sliding log stores the timestamp of every request, for example in a Redis sorted set, and counts the ones in the last N seconds, which is exact. A sliding window counter keeps only the current and previous fixed-window counts and weights the previous one by how much of it still overlaps the window. Cloudflare's formula is <code>rate = previous * (60 - elapsed) / 60 + current</code>.`,
        pros: [
          `It removes the fixed window's edge burst, so the limit holds over any N-second span.`,
          `The counter version needs only two numbers per key and one increment per request.`,
          `It is accurate in practice: across 400 million requests from 270,000 sources, Cloudflare found only 0.003% of requests wrongly allowed or limited.`,
          `The log version is exact, which suits small, high-value limits such as login attempts.`
        ],
        cons: [
          `The log version stores every timestamp, so memory and CPU grow with the limit; Cloudflare judged it too costly for limits like 5,000 requests per hour.`,
          `The counter version is an approximation that assumes requests in the previous window were evenly spread.`,
          `It is harder to explain to customers than "resets at the top of the hour".`,
          `It has no explicit burst allowance, unlike a token bucket.`
        ],
        pick: `Pick the sliding window counter for fair, edge-free limits at scale with simple storage, and the sliding log for small, exact limits like login attempts.`,
        avoid: `Avoid the log version for high limits or many keys, where memory explodes, and avoid both when you want explicit burst control (token bucket).`,
        example: `Cloudflare's edge rate limiter runs the sliding window counter on memcached using only GET and INCR, and caches "this client is blocked" in server memory so large attacks do not hammer the counters.`,
        tools: `Redis sorted sets (log), Redis or memcached counters, Cloudflare rate limiting`
      }
    ],
    compare: [
      [`State per key`, `Two numbers`, `A queue of requests`, `One counter`, `Timestamps (log) or two counters`],
      [`Bursts`, `Allowed up to bucket size`, `Smoothed out by delay`, `Nearly 2x at window edges`, `Prevented, no burst allowance`],
      [`Over the limit`, `Reject, usually 429`, `Delay, then reject when full`, `Reject until next window`, `Reject`],
      [`Accuracy`, `Exact for rate and burst`, `Exact output rate`, `Loose at edges`, `Exact (log) or close (counter)`],
      [`Adds latency`, `No`, `Yes, while queued`, `No`, `No`],
      [`Good fit`, `Per-user API limits`, `Feeding strict downstream caps`, `Hourly or daily quotas`, `Fair limits, login attempts`]
    ],
    decide: [
      [`Must traffic to a downstream stay under a hard per-second cap?`, `Leaky bucket or a fixed-rate queue.`],
      [`Is it a per-user API limit where short bursts are fine?`, `Token bucket.`],
      [`Is it a quota per hour or day that customers track against a reset time?`, `Fixed window.`],
      [`Do edge bursts hurt, and you need simple storage at scale?`, `Sliding window counter.`],
      [`Is the limit small and must be exact, like 5 login attempts per 15 minutes?`, `Sliding window log.`],
      [`Is the limit shared by many servers?`, `Atomic updates in a shared store (Lua in Redis), or split the budget into local limits.`]
    ],
    scenario: {
      title: `Worked example: limits for a public messaging API`,
      setup: `Each account of a public API should average 50 requests per second with short bursts allowed, and each monthly plan includes a message quota. The upstream carrier accepts at most 30 messages per second per sender, with no bursts. The API runs on 20 stateless servers.`,
      steps: [
        `Per-account API limit: a token bucket with rate 50 and burst 100, kept in Redis and updated by a Lua script so all 20 servers share it atomically.`,
        `Monthly quota: a fixed window counter per account per month, because customers think in "used of included" and the edges do not matter.`,
        `Carrier cap: accepted messages go into a queue per sender drained at 30 per second (a leaky bucket), so the carrier never sees a burst and senders are delayed, not rejected.`,
        `Failure mode: if Redis is down, fall back to a local token bucket on each server with 1/20 of the rate, and alert.`
      ],
      answer: `Use different algorithms for different jobs: a token bucket for fairness at the API edge, a fixed window for the billing quota, and a leaky bucket queue to shape traffic to the carrier. Say why each limit exists before choosing its algorithm.`
    },
    mistakes: [
      `Protecting a fragile backend with a one-minute fixed window → nearly twice the limit arrives around each reset.`,
      `Reading, computing and writing in separate Redis calls → concurrent requests overspend the limit under load.`,
      `Rejecting when the downstream needs shaping → clients retry and add load instead of being smoothed.`,
      `Using a sliding log for high-volume keys → memory grows with every request.`,
      `Returning 429 without <code>Retry-After</code> or limit headers → clients guess and retry too soon.`
    ],
    rule: `Use a token bucket for API limits, fixed windows for quotas, a sliding window when edges matter, and a leaky bucket queue when the downstream needs a smooth rate.`,
    signals: [
      `The downstream has a hard per-second cap → shape with a queue or leaky bucket instead of only rejecting.`,
      `Load spikes at the start of each minute → a fixed-window edge effect; switch to a token bucket or sliding window counter.`,
      `The limit is per tenant across many servers → a shared atomic counter in Redis, or local limits that split the budget.`,
      `Redis load grows with limiter traffic → use counters instead of logs, or cache "blocked" decisions locally as Cloudflare does.`
    ],
    interview: [
      `Walk through a token bucket: what state do you store, and how do you update it atomically in Redis?`,
      `What is the boundary problem with fixed windows, and how does a sliding window counter fix it?`,
      `Should a rate limiter fail open or closed when Redis is down?`
    ],
    related: [`k8`, `p3`, `c8`],
    deep: [`rate-limiting`, `load-shedding-backpressure`],
    db: [`key-value`],
    sources: [
      { t: `Scaling your API with rate limiters`, by: `Paul Tarjan, Stripe`, url: `https://stripe.com/blog/rate-limiters` },
      { t: `How we built rate limiting capable of scaling to millions of domains`, by: `Julien Desgats, Cloudflare`, url: `https://blog.cloudflare.com/counting-things-a-lot-of-different-things/` },
      { t: `Module ngx_http_limit_req_module`, by: `NGINX`, url: `https://nginx.org/en/docs/http/ngx_http_limit_req_module.html` },
      { t: `INCR (rate limiter pattern)`, by: `Redis`, url: `https://redis.io/docs/latest/commands/incr/` }
    ]
  },
  {
    id: `sessions-vs-jwt`,
    area: `Security`,
    title: `Server sessions vs JWTs`,
    question: `After login, how does the server recognize the user on each request: a session ID it looks up, a signed token it verifies, or both?`,
    summary: `A server session keeps the truth on the server and gives the browser a random ID, so logout and revocation are instant but every request needs a lookup. A JWT carries signed claims, so any service with the key can verify it without a lookup, but it stays valid until it expires. You trade instant revocation and simplicity against lookup-free verification.`,
    why: `Use long-lived JWTs as browser sessions and you cannot log out a stolen token without building a denylist, which brings back the lookup you wanted to avoid. Use one central session store for many independent services and every request depends on it.`,
    options: [
      {
        name: `Server-side sessions (opaque ID in a cookie)`,
        what: `After login, the server creates a random session ID with at least 64 bits of entropy from a secure random generator, stores the session data in Redis or a database, and sets the ID in a cookie marked <code>Secure</code>, <code>HttpOnly</code> and <code>SameSite</code>. On each request the server looks the ID up. Logout deletes the record, and idle and absolute timeouts are enforced on the server.`,
        pros: [
          `Revocation is instant: delete the session record and the next request fails, which covers logout, stolen laptops and fired employees.`,
          `The cookie holds a meaningless ID, so reading it reveals nothing; OWASP requires session IDs to carry no meaning.`,
          `An <code>HttpOnly</code> cookie cannot be read by JavaScript, which blocks the most common way XSS steals sessions.`,
          `Session data (roles, flags, cart) can change at any time without reissuing anything to the client.`
        ],
        cons: [
          `Every request needs a lookup, so the session store sits on the hot path and must be fast and highly available.`,
          `Services on other domains, or other companies, cannot verify the session without calling your store.`,
          `Cookies bring CSRF risk on state-changing requests; OWASP treats <code>SameSite</code> as defense in depth, not a replacement for CSRF tokens.`,
          `Several regions need a replicated session store or sticky routing, which adds latency or complexity.`
        ],
        pick: `Pick server sessions for browser logins to your own web app, especially when you need instant logout, admin-forced sign-out, or session data that changes often.`,
        avoid: `Avoid them as the identity proof for many independent services or third parties; issue short-lived tokens at the edge instead.`,
        example: `A Django app stores sessions in Redis with a 30-minute idle timeout; when an admin disables a user, the app deletes their sessions and the user is logged out on the next click.`,
        tools: `Redis, Memcached, a database table, framework session middleware (Django, Rails, gorilla/sessions)`
      },
      {
        name: `JWT (signed, self-contained token)`,
        what: `A JWT has three base64url parts: a header (algorithm, key ID), a payload of claims such as <code>iss</code>, <code>sub</code>, <code>aud</code>, <code>exp</code> and <code>jti</code>, and a signature. The issuer signs with a private key (RS256, ES256) or a shared secret (HS256), and any service with the verification key checks it locally and trusts the claims until <code>exp</code>. The payload is signed, not encrypted, so anyone holding the token can read it.`,
        pros: [
          `Verification is a local signature check with no network call, which suits many services and high request rates.`,
          `With public-key signatures, verifiers only need the issuer's public keys, usually published as a JWKS, so no secret is shared.`,
          `Claims travel with the request (user ID, tenant, scopes), so downstream services know the caller without a lookup.`,
          `It is the format of OpenID Connect ID tokens and many OAuth access tokens, so libraries exist in every language.`
        ],
        cons: [
          `A valid token works until it expires; revoking it early needs a denylist keyed by <code>jti</code>, which OWASP notes makes the session stateful again.`,
          `Validation is easy to get wrong: RFC 8725 describes libraries that accepted <code>alg: none</code> or verified an RS256 token as HS256 using the public key as the secret.`,
          `Every verifier must check <code>exp</code>, <code>iss</code> and <code>aud</code> and allow only expected algorithms, or a token for one service works at another.`,
          `Tokens grow with every claim and ride on every request, while the cookie spec only asks browsers to support 4096 bytes per cookie.`
        ],
        pick: `Pick JWTs for service-to-service calls, OAuth access tokens and gateways that verify identity at the edge, always with short lifetimes.`,
        avoid: `Avoid long-lived JWTs as browser sessions you may need to revoke, and never put secrets or personal data in the payload.`,
        example: `An API gateway verifies a 10-minute access token against the identity provider's JWKS and forwards the <code>sub</code> and <code>scope</code> claims to backend services, which never call the identity provider.`,
        tools: `golang-jwt/jwt, PyJWT, Keycloak, Auth0, Okta, AWS Cognito`
      },
      {
        name: `Hybrid (short-lived JWT plus a revocable refresh token)`,
        what: `Login returns a short-lived access token (a JWT that lasts minutes) and a long-lived refresh token that the server stores and can revoke. Services verify the access token locally, and when it expires the client trades the refresh token for a new one. With refresh token rotation, each refresh returns a new refresh token and invalidates the old one, so reuse of a stolen one is detected.`,
        pros: [
          `The hot path stays lookup-free, while the server still decides at each refresh whether the user may continue.`,
          `Logout or a ban takes effect within one access-token lifetime, which you choose.`,
          `Rotation makes refresh token theft detectable: when both the attacker and the user present tokens from the same chain, the server revokes it, as RFC 9700 describes.`,
          `It follows the OAuth 2.0 model, so standard identity providers and libraries support it.`
        ],
        cons: [
          `A revoked user keeps access until the current access token expires, so the lifetime is a security decision.`,
          `The refresh flow adds client complexity: parallel requests racing to refresh, retries, and safe storage.`,
          `The refresh token is a long-lived secret; for public clients RFC 9700 requires rotation or binding it to the client.`,
          `You now run both a token issuer and a stateful refresh token store.`
        ],
        pick: `Pick the hybrid when many services or mobile clients need lookup-free checks but you still need logout, bans and a list of active sessions.`,
        avoid: `Avoid it for a single web app with one backend, where a session cookie does the same job with less code.`,
        example: `A mobile app holds a 15-minute access token and a rotating refresh token; "log out of all devices" revokes the user's refresh tokens, so every device is out within 15 minutes.`,
        tools: `OAuth 2.0 and OpenID Connect providers (Keycloak, Auth0, Okta, Cognito), a refresh token table`
      }
    ],
    compare: [
      [`What the client holds`, `Random ID in a cookie`, `Signed claims`, `Short JWT plus refresh token`],
      [`Per-request lookup`, `Yes, in the session store`, `No, a signature check`, `No, only at refresh`],
      [`Revocation`, `Instant`, `At expiry, or via a denylist`, `Within one access-token lifetime`],
      [`Cross-service verification`, `Needs the store`, `Any service with the key`, `Any service with the key`],
      [`Main failure`, `Store outage blocks every request`, `Stolen token valid until expiry`, `Refresh flow bugs`],
      [`Best fit`, `Browser login to your app`, `Service-to-service, OAuth access tokens`, `Many services plus mobile apps`]
    ],
    decide: [
      [`Is it a browser login to one web app you own?`, `Server sessions in an HttpOnly cookie.`],
      [`Must you kill a session immediately (stolen device, fired employee)?`, `Server sessions, or a denylist next to JWTs.`],
      [`Do many services or third parties verify the same identity?`, `JWTs from one issuer, verified with its public keys.`],
      [`Do you need lookup-free checks and also logout?`, `Hybrid: short access tokens and rotating refresh tokens.`],
      [`Are tokens growing because permissions are packed inside?`, `Keep claims small and look the rest up.`]
    ],
    scenario: {
      title: `Worked example: web app, mobile app and 12 services`,
      setup: `You run a web dashboard, a mobile app and 12 backend services serving 20,000 requests per second. Security wants "log out of all devices" to take effect within 5 minutes, and disabled admin accounts locked out at once.`,
      steps: [
        `A session lookup on all 20,000 requests per second, in every service, would make one store critical to everything, so avoid central lookups inside the system.`,
        `Issue 5-minute JWT access tokens at the gateway, signed with keys published as a JWKS; services verify locally, allow only the expected algorithm and check <code>aud</code>.`,
        `Keep refresh tokens on the server with rotation; "log out everywhere" revokes them, and access tokens die within 5 minutes.`,
        `For disabled admins, keep a small denylist of user IDs checked only at the gateway, with entries kept until their tokens would expire.`
      ],
      answer: `Use the hybrid: short JWTs inside, rotating refresh tokens for logout, and a tiny gateway denylist for the rare instant lockout. Pure sessions would put one store in front of every request; long-lived JWTs alone could not meet the logout rule.`
    },
    mistakes: [
      `Keeping tokens in <code>localStorage</code> → any XSS can read them; OWASP advises not to store session identifiers there.`,
      `Trusting the <code>alg</code> in the token header → forged tokens through <code>none</code> or RS256-to-HS256 confusion.`,
      `Long-lived JWTs with no revocation plan → a leaked token keeps working for days.`,
      `Skipping the <code>aud</code> check → a token issued for one service is accepted by another.`,
      `Putting personal data in JWT claims → anyone holding the token can read it, because signing is not encryption.`
    ],
    rule: `Use server sessions for browser logins and short-lived JWTs between services, and add rotating refresh tokens when you need both.`,
    signals: [
      `You must kill a session now (stolen laptop, fired employee) → server sessions or a denylist.`,
      `Many services verify the same identity → JWTs from one issuer, verified with its public keys.`,
      `Tokens keep growing as permissions are packed inside → keep claims small and look the rest up.`,
      `You are building a denylist checked on every request → you rebuilt sessions; consider plain sessions.`
    ],
    interview: [
      `How would you implement logout with JWTs?`,
      `What must a service check before trusting a JWT?`,
      `Where should a browser keep its session or token, and why?`
    ],
    related: [],
    deep: [],
    db: [`key-value`],
    sources: [
      { t: `RFC 7519: JSON Web Token (JWT)`, by: `IETF`, url: `https://www.rfc-editor.org/rfc/rfc7519` },
      { t: `RFC 8725: JSON Web Token Best Current Practices`, by: `IETF`, url: `https://www.rfc-editor.org/rfc/rfc8725` },
      { t: `Session Management Cheat Sheet`, by: `OWASP`, url: `https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html` },
      { t: `JSON Web Token Cheat Sheet`, by: `OWASP`, url: `https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_Cheat_Sheet.html` }
    ]
  },
  {
    id: `apikeys-vs-oauth`,
    area: `Security`,
    title: `API keys vs OAuth`,
    question: `How should outside callers prove who they are to your API: an API key, an OAuth token, or a signed request?`,
    summary: `An API key is one long-lived secret that identifies an account, which is simple for developers calling their own account. OAuth 2.0 issues scoped, expiring tokens through an authorization server, so a third-party app can act for a customer without seeing their credentials. Signed requests also prove the request was not changed. You trade developer simplicity against delegation, scoping and revocation.`,
    why: `Use API keys for third-party integrations and customers paste full-access keys into partner apps, with no way to scope or revoke one partner alone. Force OAuth on a customer's own cron script and you add an authorization server and token refresh for no gain.`,
    options: [
      {
        name: `API keys (or a key ID and secret pair)`,
        what: `The provider generates a long random secret per account, often several named by use, shows it once and ideally stores only a hash. The client sends it on every request, usually in an <code>Authorization</code> header. Good designs prefix keys by type and mode, like Stripe's <code>sk_live_</code> and <code>rk_live_</code>, and attach scopes to each key.`,
        pros: [
          `Onboarding is as easy as it gets: copy a key and call the API with curl or any SDK.`,
          `Restricted keys limit the damage of a leak; Stripe recommends restricted keys with only the permissions an integration needs over full secret keys.`,
          `Prefixes make leaks findable: GitHub's token prefixes such as <code>ghp_</code> were designed so secret scanning can spot tokens with few false positives.`,
          `Several active keys per account allow rotation without downtime; after a rotation in Stripe's dashboard, old and new keys both work for up to 7 days.`
        ],
        cons: [
          `A key is a bearer secret that usually lives for months, so a copy in a repo, log or screenshot works until someone rotates it.`,
          `It identifies an account, not a person or app, so audit logs cannot say who made a call unless you issue keys per use.`,
          `Giving a key to a third party gives it everything the key can do, and it cannot be revoked for that party alone; this is the problem OAuth was created to solve.`,
          `Secret keys cannot live in browsers or mobile apps, where anyone can extract them; only publishable keys such as Stripe's <code>pk_</code> are meant for that.`,
          `They identify a client program, not a user; OWASP's API Security Top 10 says not to use API keys for user authentication.`
        ],
        pick: `Pick API keys when customers call their own account from their own servers: scripts, backends and CI jobs.`,
        avoid: `Avoid them when a third-party app acts for someone else's account, and in browser or mobile code; use OAuth there, or a publishable key with no sensitive powers.`,
        example: `Stripe gives each account publishable (<code>pk_</code>), secret (<code>sk_</code>) and restricted (<code>rk_</code>) keys, recommends restricted keys for most uses, and lets live keys be limited to known IP ranges.`,
        tools: `Prefixed keys stored as hashes, AWS API Gateway API keys, Kong key-auth, HashiCorp Vault`
      },
      {
        name: `OAuth 2.0 (authorization code, client credentials)`,
        what: `An authorization server issues short-lived access tokens with specific scopes. For a third-party app acting for a user, the authorization code flow sends the user to your consent screen, then the app trades a one-time code, protected with PKCE, for tokens. For machine-to-machine calls, the client credentials grant trades a client ID and secret for a token. Your API checks each token's scope, audience and expiry.`,
        pros: [
          `It delegates access without sharing secrets: the user grants a partner app access, and the app never sees the user's password or API key.`,
          `Scoped, per-app grants let a customer give one integration read-only access and revoke it without touching the others.`,
          `Access tokens are short-lived, so a leaked one expires quickly, and refresh tokens can be rotated and revoked.`,
          `It is a standard with mature servers and libraries, and OpenID Connect adds login on top of it.`
        ],
        cons: [
          `You must run or buy an authorization server, consent screens, token storage and app registration.`,
          `Onboarding is harder: developers handle redirects, PKCE, refresh and expiry instead of pasting a key.`,
          `It is easy to get wrong; the OAuth security best practice (RFC 9700) says clients should not use the implicit grant and must not use the password grant.`,
          `OAuth alone does not log users in; OWASP stresses that OAuth is not authentication, so login needs OpenID Connect.`
        ],
        pick: `Pick OAuth when third-party apps act for your customers (marketplaces, CRM or helpdesk integrations), and client credentials when machine clients should get short-lived tokens.`,
        avoid: `Avoid the user-facing flows for a customer's own backend script; an API key or client credentials is simpler.`,
        example: `GitHub's token formats keep personal access tokens (<code>ghp_</code>) separate from OAuth access tokens (<code>gho_</code>) and refresh tokens (<code>ghr_</code>), so the kind of a leaked token is clear at a glance.`,
        tools: `Keycloak, Auth0, Okta, AWS Cognito, Ory Hydra, golang.org/x/oauth2, Authlib (Python)`
      },
      {
        name: `Signed requests (HMAC) or mTLS`,
        what: `With HMAC signing, the client keeps a secret and sends a signature computed over the method, path, a timestamp and a hash of the body; the server recomputes it and rejects stale timestamps. AWS Signature Version 4 works this way, and in most cases a request must reach AWS within five minutes of its timestamp. With mTLS, both sides present certificates during the TLS handshake, so the client's identity comes from a certificate instead of a header.`,
        pros: [
          `The secret never travels on the wire, so a captured request cannot be turned into a different call.`,
          `It proves integrity: changing the body or path breaks the signature.`,
          `Timestamps limit replay to a short window, five minutes for AWS SigV4 and by default in Stripe's webhook libraries.`,
          `mTLS gives strong machine identity that proxies and service meshes can enforce, and RFC 8705 can bind OAuth tokens to the client certificate.`
        ],
        cons: [
          `Clients must build the canonical string exactly right, so most users need an SDK; AWS recommends its SDKs over signing by hand.`,
          `Clock skew breaks requests, so clients need accurate clocks; Stripe tells webhook receivers to use NTP.`,
          `Verifiers must use the raw body and a constant-time comparison, or checks fail when a framework reformats JSON, or leak timing.`,
          `mTLS means issuing, rotating and revoking a certificate for every client, which is heavy for casual developers.`
        ],
        pick: `Pick HMAC signing for high-value APIs where tampering matters and for the webhooks you send; pick mTLS for partner or internal machine traffic with managed certificates.`,
        avoid: `Avoid them as the only option for casual developers; offer keys or OAuth plus an SDK that hides the signing.`,
        example: `Stripe signs every webhook with HMAC-SHA256 over the timestamp and the raw body, sends both in the <code>Stripe-Signature</code> header, and its libraries reject events older than five minutes by default.`,
        tools: `AWS SigV4, Stripe webhook signatures, Envoy or Istio mTLS, SPIFFE and SPIRE, cert-manager`
      }
    ],
    compare: [
      [`Who it identifies`, `An account or key`, `An app acting for a user, or a client`, `A key holder or certificate`],
      [`Credential lifetime`, `Months, until rotated`, `Minutes for access tokens`, `Signature per request; certificates last longer`],
      [`Delegation to third parties`, `No, sharing gives full access`, `Yes, scoped and revocable`, `No`],
      [`Developer effort`, `Lowest`, `Highest`, `Medium, needs an SDK`],
      [`Tamper protection`, `None beyond TLS`, `None beyond TLS unless sender-constrained`, `Yes, signature or mutual TLS`],
      [`If it leaks`, `Full access until rotated`, `Limited by scope and expiry`, `Captured requests useless; key theft still serious`]
    ],
    decide: [
      [`Is the caller a customer's own server calling their own account?`, `API keys, scoped and prefixed.`],
      [`Does a third-party app act for many of your customers?`, `OAuth authorization code with PKCE.`],
      [`Is it machine-to-machine and you want short-lived tokens?`, `OAuth client credentials.`],
      [`Must you prove a request or webhook was not altered or replayed?`, `HMAC signature with a timestamp.`],
      [`Is it partner or internal traffic with managed certificates?`, `mTLS.`],
      [`Does the code run in a browser or mobile app?`, `Never a secret key; use OAuth with PKCE or a publishable key.`]
    ],
    scenario: {
      title: `Worked example: opening your API to partner apps`,
      setup: `Customers call your API with API keys today. You are launching a marketplace where partner apps (a CRM, a helpdesk) will read and send data for any customer who installs them. You also send webhooks to customers.`,
      steps: [
        `Keep API keys for customers' own servers, and add prefixes, scopes, hashing at rest and several active keys per account for rotation.`,
        `For partner apps, add the OAuth authorization code flow with PKCE: each install creates a grant with explicit scopes that the customer can revoke without touching their own keys.`,
        `Issue short-lived access tokens and rotating refresh tokens, and check scope and audience on every call.`,
        `Sign webhooks with HMAC over a timestamp and the raw body, so customers can verify them and reject replays.`
      ],
      answer: `Run both: API keys for first-party scripts, OAuth for third-party apps, and HMAC signatures on outbound webhooks. The deciding question is whose account the caller acts on, and whether that access must be scoped and revocable per app.`
    },
    mistakes: [
      `Letting partners collect customers' API keys → every partner gets full access and none can be revoked alone.`,
      `Storing API keys in plaintext → one database leak exposes every customer; store a hash and show each key once.`,
      `Shipping a secret key in a mobile app or web page → anyone can extract it and use it.`,
      `Using OAuth's implicit or password grants → the token leakage and credential exposure that RFC 9700 warns against.`,
      `Comparing signatures with plain string equality → timing attacks; use a constant-time comparison.`
    ],
    rule: `API keys for customers calling their own account, OAuth when a third party acts for them, and HMAC signatures on the webhooks you send.`,
    signals: [
      `A partner builds an integration that many of your customers install → OAuth.`,
      `Keys keep leaking in public repos → prefixed keys that secret scanning can match, plus scoped, rotatable keys.`,
      `Customers need to verify that webhooks came from you → HMAC over the body and a timestamp.`,
      `Support cannot tell which integration made a call → per-app credentials, through OAuth or one key per integration.`
    ],
    interview: [
      `When would you choose OAuth over API keys for a public API?`,
      `How would you store, rotate and detect leaks of API keys?`,
      `How do you make webhooks verifiable and safe against replay?`
    ],
    related: [],
    deep: [],
    db: [],
    sources: [
      { t: `RFC 6749: The OAuth 2.0 Authorization Framework`, by: `IETF`, url: `https://www.rfc-editor.org/rfc/rfc6749` },
      { t: `RFC 9700: Best Current Practice for OAuth 2.0 Security`, by: `IETF`, url: `https://www.rfc-editor.org/rfc/rfc9700` },
      { t: `API keys`, by: `Stripe`, url: `https://docs.stripe.com/keys` },
      { t: `Behind GitHub's new authentication token formats`, by: `GitHub`, url: `https://github.blog/engineering/platform-security/behind-githubs-new-authentication-token-formats/` }
    ]
  }
);
