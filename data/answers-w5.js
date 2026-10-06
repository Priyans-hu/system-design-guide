window.VAULT_ANSWERS = window.VAULT_ANSWERS || {};
Object.assign(window.VAULT_ANSWERS, {
  e1: {
    tldr: `Build the smallest thing that proves value, but get the few hard-to-reverse decisions right: data model, IDs, API contract, tenancy. Keep everything else simple and behind seams you can swap later.`,
    body: `<h4>Core idea</h4><p>An MVP exists to learn fast. Growth fails when early shortcuts force a rewrite. The way out is to sort decisions into <strong>one-way doors</strong> (expensive to reverse once customers and data depend on them) and <strong>two-way doors</strong> (cheap to change later). Spend design effort on the one-way doors and take shortcuts everywhere else. Most "scale" work (sharding, microservices, Kafka) is a two-way door if the seams are right. Public API shape, ID format, the data model and tenant boundaries are not.</p>
<h4>How to do it</h4><ol>
<li><strong>Find the one-way doors and get them right.</strong> Opaque string IDs (prefixed UUIDv7 or ULID), not exposed auto-increment integers. An <code>account_id</code> on every table from day one. Money as exact decimals or integer micro-units (per-message prices go below one cent), never floats. Timestamps in UTC. <code>/v1/</code> in the path. Idempotency keys on write APIs. Append-only event records so you can recompute later.</li>
<li><strong>Take shortcuts on the two-way doors.</strong> One deployable (a modular monolith), one Postgres, a jobs table instead of a message broker, cron instead of a workflow engine, managed services instead of self-hosted.</li>
<li><strong>Put seams where change is likely.</strong> Internal interfaces around parts you expect to replace (a carrier client, a storage layer). Modules talk through functions, never through each other's tables.</li>
<li><strong>Add the cheap operational baseline.</strong> Structured logs with request IDs, rate, error and latency metrics, automated deploy and rollback, backups with one tested restore. Cheap now, painful to retrofit.</li>
<li><strong>Write down limits and triggers.</strong> "Single Postgres measured at 3k writes/s in a load test. Revisit at 60% of that." Growth becomes a planned step, not a surprise.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Building for scale you do not have delays learning. Most MVPs fail from too few users, not too many.</li>
<li>Skimped one-way doors (sequential public IDs, no tenant column, float money) need painful data migrations later.</li>
<li>"Temporary" hacks become permanent. Give each one a ticket and an owner.</li>
<li>Early microservices give you a distributed monolith: network failures and slow local development without the independence.</li>
</ul>
<h4>Example</h4><p>An MVP campaign scheduler for bulk SMS. One Go service, one Postgres, and a jobs table polled with <code>FOR UPDATE SKIP LOCKED</code>, sending through the existing messaging API. One-way doors done carefully: campaign IDs are opaque strings like <code>cmp_...</code>, every row carries <code>account_id</code>, <code>POST /v1/campaigns</code> accepts an <code>Idempotency-Key</code>, and each webhook payload carries a version field. Shortcuts: no Kafka, no separate scheduler service, no sharding. The design doc names the trigger: "move dispatch to a queue when p95 pickup delay exceeds 2 seconds." When a large customer arrives, dispatch internals change behind the same interface while the API and the data stay put.</p>`,
    followups: [`Which decisions in your last project were one-way doors, and how did you treat them?`, `How would you know it is time to move from the Postgres jobs table to a real queue?`, `How do you stop MVP shortcuts from quietly becoming permanent?`],
    related: ["c3", "c1", "h6"]
  },
  e2: {
    tldr: `Build the one-off first. Extract a platform only when two or three real consumers share a proven core need and a team will own it like a product: contract, docs, SLOs, support.`,
    body: `<h4>Core idea</h4><p>A platform is a product for other developers: a shared capability behind a stable contract, self-serve, owned for years. It costs far more than a one-off because of generality, docs, backward compatibility for every consumer, multi-tenancy and support. With one use case you cannot see which parts are common, so a platform built too early encodes the first consumer's assumptions and becomes a queue everyone waits on. The usual guide is the <strong>rule of three</strong>: build it once, build it again with an eye on the shared parts, extract on the third.</p>
<h4>How to do it</h4><ol>
<li><strong>Count real consumers.</strong> Teams that need it this quarter, not teams that might.</li>
<li><strong>Price the duplication.</strong> How many teams rebuilt it, engineer-weeks each, and incidents caused by divergent behavior (three retry policies, two signing schemes).</li>
<li><strong>Check the variance.</strong> If consumers differ only in configuration, a platform fits. If they differ in core behavior, the platform turns into a pile of flags.</li>
<li><strong>Find the owner.</strong> A team with on-call, SLOs, docs and a roadmap that treats consumers as customers. No owner, no platform.</li>
<li><strong>Extract, do not invent.</strong> Pull the platform out of working one-off code and migrate the first consumer yourself.</li>
<li><strong>Keep the contract narrow.</strong> Cover the common 80% and leave escape hatches (hooks, raw access) for the rest.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Platform cost: slower first delivery, coordination, and every change must stay compatible for N consumers.</li>
<li>One-off cost: duplicated effort, inconsistent behavior for customers, N teams on call for the same problem.</li>
<li>A platform built in isolation for imagined users usually goes unadopted.</li>
<li>Mandating adoption instead of making the platform easier than DIY breeds workarounds. Aim for a paved road people choose.</li>
<li>A platform team that hand-configures every consumer becomes a ticket queue. Make onboarding self-serve.</li>
</ul>
<h4>Example</h4><p>The messaging team builds webhook delivery for SMS status callbacks inside its own service: retries with backoff, HMAC signing, a dead-letter queue. Months later voice builds its own for call-status events, and the numbers team another for porting updates. Customers now see three signature schemes and three retry schedules. That is the signal to extract a webhook delivery service: one event envelope, one signing scheme, per-endpoint rate limits, a shared retry policy, and delivery logs customers can inspect. Messaging migrates first because its code is most mature, then voice. Differences such as timeouts become per-event-type config instead of forks.</p>`,
    followups: [`How would you get teams to adopt the platform without mandating it?`, `What belongs in the platform contract and what should each consumer keep?`, `What do you do when one consumer's needs start diverging from the platform roadmap?`],
    related: ["e5", "e4", "h11"]
  },
  e3: {
    tldr: `Attribute every dollar to an owner and a unit of business output: enforce resource tags, emit per-tenant usage metrics, and track cost per unit (per 1,000 messages, per call minute) next to latency and errors.`,
    body: `<h4>Core idea</h4><p>A cloud bill says "Compute: $180k". Nobody can act on that. Engineers can act on "transcription costs $0.012 per call minute and 40% of it is idle compute". Cost visibility means two things: <strong>attribution</strong> (which team, service and tenant caused the spend) and <strong>unit economics</strong> (cost per unit the business sells). Total cost should grow with revenue; cost per unit should stay flat or fall. In a CPaaS, variable third-party costs (carrier fees, speech vendors, LLM tokens) often exceed infrastructure, so they belong in the same view.</p>
<h4>How to do it</h4><ol>
<li><strong>Enforce a tagging standard.</strong> Every resource gets <code>team</code>, <code>service</code> and <code>env</code>. Enforce it with policy checks on Terraform plans, fail untagged resources in CI, and make sure tags reach billing data (some clouds need tags activated for cost allocation).</li>
<li><strong>Split accounts or projects</strong> by environment and major domain, so the biggest splits come free.</li>
<li><strong>Allocate shared infrastructure by usage.</strong> Kubernetes by CPU and memory requests per namespace (OpenCost does this), Kafka by bytes per topic, a shared database by storage or query load per schema.</li>
<li><strong>Emit usage metrics per tenant and feature:</strong> messages sent, call minutes, transcribed seconds, tokens. Join them with cost data to get cost per unit and gross margin per customer.</li>
<li><strong>Show cost where engineers look.</strong> Put cost per unit on the service dashboard. Set per-team budgets and anomaly alerts, for example daily spend 30% above the 7-day average.</li>
<li><strong>Make cost a design-review question.</strong> Every design estimates cost per unit at expected volume.</li>
<li><strong>Run a monthly top-10 review.</strong> Usual wins: rightsizing, autoscaling, storage lifecycle rules, log volume and retention, cross-AZ traffic, commitments for the steady baseline, spot capacity for batch jobs.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Perfect allocation is expensive. Attributing about 80% of spend is enough to act.</li>
<li>Observability can cost more than the service: debug logs in prod, high-cardinality metric labels.</li>
<li>Data transfer (cross-AZ, cross-region, internet egress) stays hidden until it is large.</li>
<li>Engineer time is a cost too. Do not spend an engineer-week to save $50 a month.</li>
<li>Commitments lock you in. Commit only the baseline you are sure of.</li>
</ul>
<h4>Example</h4><p>A call transcription feature. From day one, each job emits <code>account_id</code>, audio seconds and vendor, and every resource carries <code>service=transcription</code>. The dashboard shows cost per transcribed minute: vendor fees plus compute plus storage, divided by minutes. At launch it is $0.012 against a $0.02 price. A month later it jumps to $0.016 and the anomaly alert fires. The cause is a retry bug sending failed audio to the vendor twice. Without the per-unit metric, that leak would sit inside a growing total bill until the quarterly review.</p>`,
    followups: [`How would you split the cost of a shared Kafka cluster across the teams using it?`, `Which single cost metric would you put on a team's main dashboard, and why?`, `How do you decide whether a cost optimization is worth the engineering time?`],
    related: ["o3", "e4", "d7"]
  },
  e4: {
    tldr: `Build what differentiates you or protects your margins and reliability; buy commodity capabilities. Decide on 3-year total cost of ownership, compliance fit and lock-in, and wrap whatever you buy behind your own interface.`,
    body: `<h4>Core idea</h4><p>You can usually build anything. The real questions are: is this where your advantage comes from, and what does each option cost over its whole life? Building spends engineers who could work on the product, and keeps spending them, because code needs maintenance. Buying creates a dependency whose outages, pricing and roadmap you do not control. Rough rule: <strong>core domain, build; commodity, buy; in between, buy now and keep an exit.</strong></p>
<h4>How to do it</h4><ol>
<li><strong>Classify the capability.</strong> Core: customers pay you for it (message routing and carrier selection for a CPaaS). Supporting: needed but not differentiating (billing, internal tooling). Generic: email, auth, feature flags, observability.</li>
<li><strong>Compute 3-year TCO for both.</strong> Build: first version, ongoing maintenance, infrastructure, on-call, security and compliance work, and what those engineers would otherwise ship. Buy: fees at projected volume (not today's), integration, vendor management, expected price rises, and the cost of leaving.</li>
<li><strong>Check the non-cost fit.</strong> In-region processing for regulated markets, SLA and real outage history, latency, rate limits, support quality, the vendor's financial health.</li>
<li><strong>Find the crossover.</strong> Usage pricing that is cheap at 1 million units a month can dwarf build cost at 1 billion.</li>
<li><strong>Design for exit.</strong> Put the vendor behind your own interface (an anti-corruption layer), store results in your own format, and keep vendor concepts out of your domain model.</li>
<li><strong>Run a time-boxed proof of concept</strong> with real data and traffic before signing.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Teams underestimate build cost. The first version is the small part; edge cases, upgrades and on-call are the rest.</li>
<li>Buying your core gives competitors the same capability off the shelf.</li>
<li>Hidden vendor costs: a premium support tier to get a real SLA, seat creep, egress fees.</li>
<li>Lock-in grows through data gravity and proprietary features.</li>
<li>A vendor outage is your outage. Have a fallback or accept the risk explicitly.</li>
<li>A too-generic wrapper hides useful vendor features. Abstract the operations you need, not every vendor.</li>
</ul>
<h4>Example</h4><p>A CPaaS wants live transcription for voice calls. Building means an ML team, GPU capacity and accuracy work across many languages and accents, likely a year or more to reach vendor quality. Buying ships in weeks at around a cent or two per minute. Decision: buy, behind an internal <code>Transcriber</code> interface (<code>StartStream</code>, <code>SendAudio</code>, <code>Results</code>) so call-control code never imports a vendor SDK. The contract requires in-region processing for EU and India customers. Two vendors are integrated for failover and pricing leverage. The doc records the revisit trigger: monthly vendor fees exceeding the modeled TCO of self-hosting an open-source speech model, or accuracy in a key language becoming a selling point.</p>`,
    followups: [`How would you compute the volume at which self-hosting beats the vendor?`, `What must a vendor contract include before you send it EU customer data?`, `How do you keep a vendor swappable without building a lowest-common-denominator abstraction?`],
    related: ["e3", "e7", "e2"]
  },
  e5: {
    tldr: `Keep a small core that owns the invariants and give teams explicit extension points (config, plugin interfaces, events, hooks) with versioned contracts, isolation so one extension cannot sink the rest, and clear ownership of each part.`,
    body: `<h4>Core idea</h4><p>When many teams edit one codebase, you get merge conflicts, surprise regressions, and a core team that reviews everything and becomes the bottleneck. The fix is a <strong>stable core plus extension points</strong>. The core owns the invariants: auth, tenant isolation, billing each message exactly once, the status state machine. Extensions add behavior through narrow contracts without touching the core. Safety comes from four things: explicit contracts, isolation, clear ownership, and guardrails in CI.</p>
<h4>How to do it</h4><ol>
<li><strong>Separate what varies from what must not.</strong> Invariants stay in the core. Variation points become extension points: carrier adapters, channels (SMS, WhatsApp, RCS), pricing rules, content filters.</li>
<li><strong>Pick the loosest mechanism that works.</strong><ul>
<li>Config or data (routing rules, price tables): safest and cheapest.</li>
<li>In-process plugin interface: fast, but shares the process, so a panic or memory leak hits everyone.</li>
<li>Domain events that teams subscribe to: loose coupling, and the core never waits.</li>
<li>Synchronous out-of-process hooks: isolated, but they add latency and a new failure mode.</li>
</ul></li>
<li><strong>Make contracts explicit.</strong> A schema (Protobuf or JSON Schema), versioning rules, and documented semantics: idempotency, ordering, timeouts, retries. Add consumer-driven contract tests (Pact-style) so neither side can break the other silently.</li>
<li><strong>Contain the blast radius.</strong> Per-extension timeouts, circuit breakers, separate queues and worker pools (bulkheads), CPU and memory limits. A failing extension degrades only its own feature.</li>
<li><strong>Enforce boundaries mechanically.</strong> CODEOWNERS per directory, architecture tests or lint rules that forbid importing core internals, and an extension registry listing owner, on-call and SLO.</li>
<li><strong>Observe per extension.</strong> Label latency and error metrics by extension so the core team can see which one misbehaves.</li>
<li><strong>Roll out per extension</strong> behind a flag, with a kill switch.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>An extension point is a one-way door. Once five teams depend on it, changing it is a migration. Add one when the second or third real variation shows up, not speculatively.</li>
<li>Over-generic hooks such as <code>beforeAnything(ctx map)</code> create hidden coupling. Nobody knows what is safe to change.</li>
<li>Events decouple teams but make flows harder to trace. You need correlation IDs and a schema registry.</li>
<li>Contracts still need governance. Someone must review contract changes, or the system drifts.</li>
<li>If every new extension needs a core change, the boundary is in the wrong place. Move it.</li>
</ul>
<h4>Example</h4><p>A messaging core where channel teams add channels. The core owns API validation, rate limits, idempotency, the billing event and the message status state machine. Each channel team implements a <code>Channel</code> interface (<code>Validate</code>, <code>Send</code>, <code>ParseCallback</code>) in its own package, owned through CODEOWNERS, and gets its own queue and worker pool. The core calls <code>Send</code> with a 2-second timeout. A breaker opens if an adapter's error rate stays above 50% for 30 seconds, so a WhatsApp outage stalls only WhatsApp while SMS keeps flowing. Status changes go out as versioned events (<code>message.status.v1</code>) that the analytics and webhook teams consume without touching core code. Each adapter's contract tests run in the core's CI. Adding RCS becomes a new package plus a config row, with no change to the state machine.</p>`,
    followups: [`How do you change an extension point's contract once five teams depend on it?`, `When would you pick events over a synchronous hook for an extension?`, `How do you stop one team's extension from exhausting shared resources?`],
    related: ["p1", "e2", "r4"]
  },
  e6: {
    tldr: `Assume old clients live for years. Make only additive changes, keep old behavior as the default, version the rare breaking change, measure which clients use what, and retire old versions with data and notice.`,
    body: `<h4>Core idea</h4><p>You control the server, not the clients. SDKs pinned in customer code, mobile apps nobody updates, webhook receivers with strict parsers, and integrations written years ago keep calling. Backward compatibility means a client built against yesterday's contract still works today, and the server carries that burden. The skill is knowing what counts as breaking, avoiding it by default, and paying for it deliberately when you must.</p>
<h4>How to do it</h4><ol>
<li><strong>Know what breaks clients.</strong> Removing or renaming fields, changing a type or format, adding a required request field, tightening validation, changing defaults or error codes, and adding enum values that clients switch on. Behavior changes break too: ordering, timing, rate limits.</li>
<li><strong>Default to additive changes.</strong> New optional fields, new endpoints, new optional parameters whose default is the old behavior. Never reuse a removed field name with a new meaning.</li>
<li><strong>Make your SDKs tolerant readers.</strong> Ignore unknown fields and map unknown enum values to an "unknown" case. Do this from v1, because you cannot fix SDKs already shipped.</li>
<li><strong>Version breaking changes.</strong> Either a new major path (<code>/v2</code>) or date-based versions pinned per account. Translate at the edge with version adapters, so core logic keeps one current model.</li>
<li><strong>Measure usage.</strong> Log API version, SDK name and version (from the User-Agent), and endpoint per account. Then you can say "SDK 2.x is 4% of traffic from 312 accounts" instead of guessing.</li>
<li><strong>Test against the past.</strong> Keep recorded requests and responses from old SDK versions and replay them in CI against the new server.</li>
<li><strong>Retire deliberately.</strong> Announce, send <code>Deprecation</code> and <code>Sunset</code> headers, email affected accounts, run short scheduled brownouts, then remove.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Every supported version adds code and test matrix. Publish a policy, for example the last two major SDK versions.</li>
<li>Webhooks are the forgotten direction. There you are the client: a new field can break a strict receiver.</li>
<li>Silent default changes are the worst kind, because nothing errors. The client just behaves differently.</li>
<li>Hyrum's law: someone depends on every observable behavior, even undocumented ones. Usage data tells you who.</li>
</ul>
<h4>Example</h4><p>A voice API wants to add a <code>ringing</code> call status between <code>queued</code> and <code>in-progress</code>. Older SDKs parse status into a strict enum and throw on unknown values, so the change would break status handling in customer code. Safe path: emit <code>ringing</code> only to accounts on API versions dated after the change, or those that opt in. Older versions keep the old sequence. The current SDK maps unknown statuses to <code>UNKNOWN</code>. Usage logs show which accounts still pin old versions, and those accounts get migration notices. Once old-version traffic is near zero, after announcements and brownouts, the old mapping is deleted.</p>`,
    followups: [`How would you change a webhook payload that customers verify with a signature over the raw body?`, `How do you decide how many old SDK versions to support?`, `How would you find out which customers break if you remove a field?`],
    related: ["p6", "p2", "p8"]
  },
  e7: {
    tldr: `Classify your data, give every tenant a home region, store and process regulated data there, and keep the global layer thin. Then audit logs, backups, analytics and vendors, because that is where residency usually leaks.`,
    body: `<h4>Core idea</h4><p>Data residency is about where data is stored and processed. Rules vary: some require data to stay in the country (localization), others allow transfers with safeguards, and enterprise contracts are often stricter than the law. The design goal is to make "where does this tenant's data live" one enforced property of the tenant, so adding a region is configuration plus a deploy, not a rewrite.</p>
<h4>How to do it</h4><ol>
<li><strong>Inventory and classify data flows.</strong> Trace data through queues, databases, logs, warehouse, backups, vendors and support tools. Classes: content (message bodies, recordings), identifiers (phone numbers, emails), metadata (call and message records), and operational data with no PII.</li>
<li><strong>Map requirements per market with legal.</strong> GDPR restricts transfers out of the EEA unless there is an adequacy decision or safeguards such as Standard Contractual Clauses; it does not by itself mandate EU-only storage, but many EU customers demand it. India's DPDP Act allows transfers except to countries the government restricts, while sector rules can be stricter (RBI requires payment system data to be stored only in India).</li>
<li><strong>Give each tenant a home region</strong> at signup, kept in a small global directory (<code>account_id → region</code>). Route requests with region-specific hostnames or a global edge that forwards by account.</li>
<li><strong>Run a full stack per region:</strong> API, databases, queues, object storage, encryption keys. The global control plane holds only routing, login and catalog data, never content.</li>
<li><strong>Close the leak paths.</strong> Redact bodies and mask numbers in logs and traces, or keep log clusters regional. Aggregate or pseudonymize before data reaches a central warehouse. Keep backups in-region. Restrict and audit support access. Require in-region processing from subprocessors such as speech or LLM vendors.</li>
<li><strong>Verify continuously</strong> with automated checks that tenant data exists only in allowed regions.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Each region multiplies infrastructure, deploys, on-call and cost. Region count is a business decision.</li>
<li>Cross-region features get hard: global search, one customer in two regions, consolidated reporting.</li>
<li>Some countries have only one or two cloud regions, which limits in-country disaster recovery.</li>
<li>Moving a tenant between regions is a migration project. Make the home region deliberate and sticky.</li>
<li>Calls cross borders by nature. Ask legal whether a rule covers transit or only storage and processing.</li>
</ul>
<h4>Example</h4><p>An EU bank requires message content and call recordings to stay in the EU. Its account gets <code>home_region=eu</code>. Message bodies go to EU Postgres and object storage, encrypted with EU-held keys. Recordings are transcribed through the vendor's EU endpoint. Central logs get message IDs with redacted bodies and numbers masked to the last three digits. Global billing receives only aggregates: account, count, cost. A scheduled scan confirms that no storage holding EU tenant data exists outside EU regions.</p>`,
    followups: [`How would you move an existing tenant from the US region to the EU region?`, `What belongs in the global control plane, and what must never go there?`, `How do you keep logs useful for debugging while keeping PII in-region?`],
    related: ["d3", "r5", "o1"]
  },
  e8: {
    tldr: `Evaluate flags through one small interface with deterministic bucketing and safe defaults, log exposures for experiments, branch at a single decision point, and give every flag an owner, a kill switch path and an expiry date.`,
    body: `<h4>Core idea</h4><p>Flags separate deploy from release. Experiments measure whether a change helped. Done badly, you get hundreds of stale flags, branches everywhere, customers flipping between behaviors, and results nobody trusts. Done well, flags are typed, short-lived and evaluated in one place, and every experiment has a hypothesis, a metric and a stopping rule. Lifetimes differ by kind: <strong>release flags</strong> (days to weeks), <strong>experiment flags</strong> (weeks), <strong>ops kill switches</strong> (long-lived), and <strong>entitlements</strong> (permanent, so they belong in the plan or permission system, not the flag tool).</p>
<h4>How to do it</h4><ol>
<li><strong>One evaluation interface</strong>, for example <code>flags.Bool(ctx, "routing-v2", accountID, false)</code>, behind a standard SDK (OpenFeature is a vendor-neutral option). No ad hoc config reads.</li>
<li><strong>Deterministic bucketing.</strong> Hash the flag key plus subject ID, mod 100. The same account always lands in the same bucket, and ramping 5% → 25% keeps the first 5% in. Including the flag key keeps experiments independent.</li>
<li><strong>Pick the randomization unit.</strong> In B2B, randomize by account, not by request, or one customer sees mixed behavior.</li>
<li><strong>Evaluate locally.</strong> Cache rules in memory and stream updates, so a check costs microseconds and a flag service outage falls back to defaults instead of failing requests.</li>
<li><strong>Log exposures</strong> (flag, variant, subject, time) at evaluation, so analysis compares only subjects who actually hit the code.</li>
<li><strong>Branch once.</strong> Choose a strategy at the decision point (<code>router := pickRouter(flag)</code>) instead of scattering checks across files.</li>
<li><strong>Manage the lifecycle.</strong> Owner, created date and expiry live in the flag definition; CI warns on expired flags; the cleanup ticket is filed with the flag.</li>
<li><strong>Design the experiment up front:</strong> primary metric, guardrail metrics (errors, latency, cost), sample size and duration. Check the observed split matches the plan (sample ratio mismatch).</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Ten independent boolean flags make 1,024 combinations, most never tested. Keep few flags alive.</li>
<li>A remote flag call per request adds latency and a new dependency.</li>
<li>Peeking daily and stopping at the first good result inflates false positives.</li>
<li>In B2B a few large accounts dominate traffic. Stratify by account size or check results per segment.</li>
<li>A flag flip is a production change. Audit it, and review flips on critical paths.</li>
</ul>
<h4>Example</h4><p>A new SMS routing algorithm picks carriers by recent delivery rate and cost. The flag <code>routing-v2</code> is evaluated once per message in the routing step, bucketed by account, defaulting to v1. Rollout: internal accounts, then 5% of small accounts, then 25%. Primary metric: delivered within 60 seconds. Guardrails: cost per message, p99 routing latency, error rate. A kill switch sends everyone back to v1 in under a minute. After two stable weeks at 100%, a cleanup PR deletes the v1 router and the flag.</p>`,
    followups: [`How would you choose the randomization unit for an experiment on a B2B messaging API?`, `What should happen to live requests if the flag service goes down?`, `How do you enforce flag cleanup across many teams?`],
    related: ["r8", "h8", "o3"]
  },
  e9: {
    tldr: `Strangle it: put a routing layer in front, move one slice at a time, shield the new model with an anti-corruption layer, prove equivalence with shadow traffic and reconciliation, and keep rollback possible until the old path is idle.`,
    body: `<h4>Core idea</h4><p>Big-bang rewrites fail because the legacy system encodes years of undocumented behavior, and the business cannot pause for a cutover. The legacy "cannot die" because customers, contracts and data depend on it, so plan for coexistence as the normal state, possibly for years. Run old and new side by side, move traffic in small slices, prove equivalence with data, and keep every step reversible. This is the <strong>strangler fig</strong> pattern.</p>
<h4>How to do it</h4><ol>
<li><strong>Map before you replace.</strong> Inventory every entry point: APIs, cron jobs, database triggers, reports, and other teams reading legacy tables directly (database access logs reveal them). Capture current behavior with characterization tests and samples of real traffic.</li>
<li><strong>Put a routing seam in front.</strong> A gateway or facade decides old vs new per operation and per tenant. This is where the strangling happens.</li>
<li><strong>Add an anti-corruption layer.</strong> Translate legacy codes and shapes into the new domain model so legacy quirks do not leak into new code.</li>
<li><strong>Slice the work.</strong> Reads before writes, internal tenants before small ones before large ones, simple products before complex ones. Early slices should be low risk and high learning.</li>
<li><strong>Keep one system of record per slice.</strong> Avoid naive dual writes: a partial failure silently diverges the two stores. Backfill history, keep it in sync with change data capture (for example Debezium reading the binlog or WAL) or a transactional outbox, then flip the system of record slice by slice.</li>
<li><strong>Prove equivalence.</strong> Shadow mode sends real traffic to the new system, compares outputs and discards them. Nightly reconciliation diffs old vs new with explicit thresholds, and every mismatch gets an explanation.</li>
<li><strong>Cut over behind a flag, with rollback.</strong> If the new system took writes, rolling back needs a reverse sync. Build it before you need it.</li>
<li><strong>Decommission for real.</strong> Track "% traffic on new" as the headline metric. After N weeks at zero, delete code, drop tables and archive data per retention rules.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Coexistence is expensive: two systems, sync pipelines, double on-call knowledge. Budget for it and set an end date.</li>
<li>The last 10% (odd tenants, rare flows) is the hardest. Plan it explicitly or the legacy never dies.</li>
<li>Hyrum's law: some customers rely on legacy bugs. Decide per case to replicate, fix with notice, or grandfather.</li>
<li>Hidden consumers break on cutover day if you did not find them first.</li>
<li>Migrating and redesigning at once doubles the risk. Match behavior first, improve after.</li>
</ul>
<h4>Example</h4><p>Replacing a legacy billing system that rates SMS and voice usage in stored procedures. Step 1: CDC streams usage records to a new rating service. Step 2: the new service rates every record in shadow, and a nightly job compares per-account totals. One mismatch class appears: legacy rounds each message, the new service rounds each invoice line. Decision: keep legacy rounding for existing contracts. Step 3: invoice generation cuts over per account through a flag, internal accounts first, then new signups, then cohorts of existing customers, while legacy still produces a parallel invoice for comparison. Step 4: after two billing cycles with zero unexplained differences, legacy becomes read-only for audits and is kept for the legally required retention period.</p>`,
    followups: [`How would you roll back a slice after the new system has already accepted writes?`, `How do you find hidden consumers of a legacy database?`, `When is dual-writing acceptable, and how would you make it safe?`],
    related: ["t6", "t4", "d10"]
  },
  h1: {
    tldr: `Start from the problem and one real request's journey, not the box diagram. Explain why each choice was made and what was rejected, then check understanding by having them predict behavior when something fails.`,
    body: `<h4>Core idea</h4><p>A junior can memorize boxes and still not understand the system. Real understanding means they can predict what happens in a situation you did not cover: a failure, a new feature, a strange log line. So teach reasoning, not structure: problem, constraints, one request's path, decisions with alternatives, failure behavior.</p>
<h4>How to do it</h4><p>A 40-minute template:</p><ol>
<li><strong>Problem and constraints (5 min).</strong> Who uses it and what matters: "never send an OTP twice, p99 under 3 seconds".</li>
<li><strong>One request end to end (10 min).</strong> Follow a real ID through a sequence diagram, using the names that appear in code and logs.</li>
<li><strong>Three or four key decisions (10 min).</strong> For each: what we chose, what we rejected, and why.</li>
<li><strong>Failure walk-through (10 min).</strong> "What if Redis is down? What if the carrier times out?" Let them answer first.</li>
<li><strong>Teach-back (5 min).</strong> They redraw it or explain it to you. The gaps show what to re-explain.</li>
<li><strong>Hands-on.</strong> A small ticket in the flow, tracing a real request in logs, shadowing on-call.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Too much detail up front overloads. Big picture first, details on demand.</li>
<li>Happy path only leaves them lost at 3 a.m.</li>
<li>"Does that make sense?" always gets a yes. Ask "what would happen if...?" instead.</li>
<li>Analogies help but break somewhere. Say where.</li>
<li>Hiding known debt makes them trust fragile code. Point it out.</li>
</ul>
<h4>Example</h4><p>Explaining an OTP service. Instead of eight boxes, trace one OTP: the API accepts it with an idempotency key, stores it, enqueues it, a worker picks a carrier, the carrier's delivery receipt updates status, and a webhook notifies the customer. Then ask: "The carrier accepted the message but no receipt ever arrives. What does the customer see, and what does our system do?" A correct answer (status stays <code>sent</code>, a timeout job marks it <code>undelivered</code> after N minutes, a webhook fires) shows they understand the state machine, not just the diagram.</p>`,
    followups: [`How do you check understanding without making it feel like a test?`, `How would you change the explanation for a product manager?`, `What would you put in a one-page onboarding doc for this service?`],
    related: ["c2", "h4", "h9"]
  },
  h2: {
    tldr: `Do not defend the choice; show the decision. Agree on requirements first, compare options against them with numbers, name what you are giving up, and state what evidence would change your mind.`,
    body: `<h4>Core idea</h4><p>A sceptical architect is usually checking whether you have seen the failures they have seen. Treat objections as a free risk review. Your aim is not to win but to show the decision rests on requirements and evidence, and to find out quickly if they know something you do not.</p>
<h4>How to do it</h4><ol>
<li><strong>Agree on the goal first.</strong> "Peak 5k msg/s, 99.95% availability, team of four, three months." Once goals are shared, disagreement shrinks to means.</li>
<li><strong>Show two or three options</strong> in a table scored on the criteria that matter: latency, cost, operational load, time to build, risk. Include the option they probably prefer.</li>
<li><strong>Bring numbers.</strong> Back-of-envelope math, a load test, a cost estimate, past incidents.</li>
<li><strong>Name the costs yourself.</strong> "This gives at-least-once delivery, so consumers must be idempotent." Admitting weaknesses builds trust.</li>
<li><strong>Say how reversible it is.</strong> "It sits behind an interface; switching later costs about two weeks."</li>
<li><strong>Ask for the specific worry.</strong> "Which failure concerns you?" Then show how it is handled, or adopt it as a new requirement.</li>
<li><strong>Agree how to settle it.</strong> A time-boxed spike with success criteria, or disagree-and-commit with a revisit trigger. Record it in an ADR.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Arguing taste ("Kafka is better") without criteria convinces no one.</li>
<li>Getting defensive hides the useful part of the objection.</li>
<li>Caving without a reason is as bad as digging in. If a concern maps to no requirement, ask which requirement it serves.</li>
<li>An unrecorded decision gets re-argued in six months.</li>
</ul>
<h4>Example</h4><p>You chose a Postgres jobs table with <code>SKIP LOCKED</code> for a campaign scheduler; the architect wants Kafka. You show a peak of 300 jobs/s against 2,000/s in your load test, a team with no Kafka experience, and a need for per-job cancellation and status that fits a table. You concede there is no replayable stream for future consumers. Revisit trigger: sustained load above 1,000 jobs/s or a second consumer needing the stream. Their real worry is table bloat, so you partition by day and drop old partitions instead of deleting rows. The decision goes into ADR-012.</p>`,
    followups: [`What do you do if the architect still disagrees after seeing the data?`, `How do you argue a trade-off when you have no numbers yet?`, `What would the ADR for this decision contain?`],
    related: ["h4", "h5", "h6"]
  },
  h3: {
    tldr: `Write the guarantees down as testable statements, map every component to the guarantee it serves, and remove or merge what serves none or duplicates another. Then prove each guarantee still holds with failure tests.`,
    body: `<h4>Core idea</h4><p>Much complexity is accidental: layers added to patch old incidents, speculative scale, or one guarantee implemented twice (retries at four layers, two dedupe steps). Essential complexity exists to deliver a guarantee. The guarantees are the contract; the components are negotiable.</p>
<h4>How to do it</h4><ol>
<li><strong>Write guarantees as testable statements.</strong> "Each message is billed at most once." "No accepted event is lost if one node dies." "Status webhook within 60 seconds at p99." Include implicit ones, such as "absorbs 10x bursts".</li>
<li><strong>Build a component-to-guarantee matrix.</strong> Serves none: removal candidate. Two components serve one guarantee: merge candidate.</li>
<li><strong>Apply the usual simplifications.</strong> Enforce each guarantee at one layer (idempotency at the entry point, retries at one layer with a budget). Replace cross-service coordination with one transaction plus an outbox. Merge services that always deploy together. Use database constraints instead of application checks.</li>
<li><strong>Prove it.</strong> Failure injection (kill a process mid-operation, duplicate a message), property tests, and before/after metrics under a canary.</li>
<li><strong>Change one thing at a time</strong>, each with a rollback.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Chesterton's fence: learn why a component exists (git history, postmortems, ADRs) before removing it.</li>
<li>Removing a queue can silently remove burst absorption. Implicit guarantees matter.</li>
<li>Fewer components is not simpler if the one left is incomprehensible.</li>
<li>If every component maps to a real guarantee, the complexity is essential. Renegotiate a guarantee instead of hiding it.</li>
</ul>
<h4>Example</h4><p>A webhook pipeline writes to the database, then publishes to Kafka (a dual write). Around it sit a cron sweeper that republishes rows missing a <code>published</code> flag, a Redis dedupe set before delivery, and a second dedupe check in the worker. The matrix shows the sweeper and Redis exist only to patch the dual-write gap. Replacement: a transactional outbox (the event row is written in the same transaction and a relay publishes it) plus a unique constraint on <code>event_id</code> in the delivery table. Two components and one failure mode (Redis eviction dropping dedupe keys) disappear. Proof: a test kills the relay mid-batch 100 times and asserts every event appears exactly once in the delivery table.</p>`,
    followups: [`How do you find implicit guarantees that nobody wrote down?`, `What if simplifying means weakening a guarantee a customer relies on?`, `How would you convince the team a component is safe to remove?`],
    related: ["t4", "h6", "h10"]
  },
  h4: {
    tldr: `Capture the why that code cannot show: problem, constraints, decisions with rejected alternatives, and assumptions with revisit triggers. Freeze the doc once accepted and record later changes as linked ADRs.`,
    body: `<h4>Core idea</h4><p>Code shows what the system does today. Three years later, readers need what code cannot show: why it is built this way, what was rejected, and which assumptions it rests on. Details go stale in months; reasons stay useful for years. So pair a point-in-time design doc with an append-only log of Architecture Decision Records (ADRs), and keep current operational facts in a living README and runbook.</p>
<h4>How to do it</h4><p>Outline:</p><ol>
<li><strong>Header:</strong> owner team, authors, status (draft, accepted, superseded), date, links to later ADRs.</li>
<li><strong>Context:</strong> the problem, with numbers as of that date.</li>
<li><strong>Goals and non-goals.</strong> Non-goals explain gaps later.</li>
<li><strong>Assumptions, each with a revisit trigger:</strong> "single region; revisit if we add a second."</li>
<li><strong>Design:</strong> diagram, data model, contracts, one request flow. Link to schemas and code as the source of truth; do not copy them.</li>
<li><strong>Alternatives considered</strong>, each with why it was rejected. The most valuable section in year three.</li>
<li><strong>Trade-offs, risks, known limits.</strong></li>
<li><strong>Operations:</strong> SLOs, failure modes, rollout and rollback, migration.</li>
<li><strong>Security, privacy, cost estimate, open questions.</strong></li>
</ol>
<p>Keep it in the repo or link it from the README. Once accepted, do not rewrite history: add an ADR and mark the old section superseded. Keep diagrams as code so they can be updated.</p>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Class names and config values in the doc go stale fast. Link instead.</li>
<li>A doc in someone's personal drive leaves with them.</li>
<li>Happy-path-only docs leave nobody knowing the failure design.</li>
<li>Docs written only to pass a review never get updated.</li>
</ul>
<h4>Example</h4><p>A 2023 rate-limiting doc says: "Assumption: all tenants in one region; revisit if we add a second." In 2025 an EU region launches. The new team sees at once that per-tenant counters in a single Redis cannot enforce a global quota. They write ADR-021 (regional counters with a per-region quota split), link it from the original doc and mark that section superseded. A 2026 hire reads both and understands the current design and how it got there.</p>`,
    followups: [`How do you keep a design doc from going stale without making updates a chore?`, `What is the difference between a design doc and an ADR, and when do you write each?`, `Which sections would you keep if the doc had to fit on two pages?`],
    related: ["h2", "h9", "h1"]
  },
  h5: {
    tldr: `Review the problem before the solution, use a checklist for depth, ask questions tied to requirements instead of giving verdicts, and label each comment as blocking, should-fix or optional so the author knows what matters.`,
    body: `<h4>Core idea</h4><p>A good review catches the expensive mistakes early and leaves the author owning a better design. Depth comes from a systematic checklist. Respect comes from critiquing the design rather than the person, asking before asserting, and being explicit about what blocks approval versus what is taste.</p>
<h4>How to do it</h4><p>Process:</p><ol>
<li>Read once for the problem and goals (is this the right problem?), then again for the design.</li>
<li>Write comments async. Save live discussion for the big items, and raise sensitive ones 1:1 first.</li>
<li>Label each comment: <strong>blocking</strong> (correctness, data loss, security, compliance), <strong>should</strong> (real risk or cost), <strong>optional</strong> (style, preference).</li>
<li>Phrase comments as questions tied to requirements, and offer an alternative whenever you block.</li>
<li>Name specific strengths. End with a clear status: approved, or exactly what is still needed.</li>
</ol>
<p>Checklist:</p><ul>
<li>Requirements and non-goals explicit, with numbers?</li>
<li>Data: ownership, consistency, migrations, retention, PII.</li>
<li>Failures: each dependency down or slow, retries, idempotency, partial failure, backpressure.</li>
<li>Scale: which resource saturates first?</li>
<li>Security: auth, tenant isolation, secrets.</li>
<li>Operations: SLOs, alerts, runbook, rollout, rollback, owner.</li>
<li>Evolution: which decisions are hard to reverse?</li>
<li>Cost per unit. Anything removable?</li>
</ul>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Bikeshedding names while missing the data-loss bug.</li>
<li>Redesigning it your way. If it meets the requirements, a different taste is not blocking.</li>
<li>Forty nits bury the one blocker. Batch or skip them.</li>
<li>Reviewing only after it is built. Review the approach early.</li>
</ul>
<h4>Example</h4><p>Reviewing a webhook retry design that keeps pending retries only in Redis. Instead of "Redis is wrong here", write: "Blocking: our requirement says no webhook is lost within 72 hours. If Redis restarts, what happens to pending retries? Would keeping retry state in Postgres meet the requirement?" Then: "Optional: consider naming queues by event type." The author sees what must change, why, and a way forward.</p>`,
    followups: [`How do you handle an author who pushes back on a blocking comment?`, `How do you review a design in a domain the author knows better than you?`, `When should a design review be a meeting instead of async comments?`],
    related: ["h2", "h7", "h4"]
  },
  h6: {
    tldr: `A design is over-engineered when its complexity serves requirements nobody has: scale far beyond forecasts, flexibility no one asked for, or components tied to no guarantee. Ask what breaks if each piece is removed.`,
    body: `<h4>Core idea</h4><p>Complexity has a daily cost: build time, bugs, on-call load, onboarding. It is justified by a real requirement, or by a decision that is cheap now and expensive later (a one-way door). Over-engineering is paying today for a future that may never come.</p>
<h4>How to do it</h4><p>Signals:</p><ul>
<li><strong>Scale mismatch.</strong> Built for 100k req/s when the two-year forecast is 200. A common heuristic: handle about 10x current load, know the path to 100x, do not build it yet.</li>
<li><strong>Unjustified components.</strong> Nobody can say which requirement fails without them.</li>
<li><strong>Speculative generality.</strong> Plugin systems, rule DSLs, interfaces with one implementation.</li>
<li><strong>More services than engineers,</strong> or services that always deploy together.</li>
<li><strong>Distributed where local works.</strong> A saga across services for what one database transaction handles.</li>
<li><strong>Duplicate mechanisms</strong> for one guarantee: retries at every layer, caches on caches.</li>
<li><strong>Hard to explain.</strong> It does not fit on one page or in five minutes.</li>
<li><strong>Novelty-driven choices.</strong> "We want to learn Kafka."</li>
</ul>
<p>Tests: write requirements with numbers and map each component to one; do back-of-envelope capacity math for the simplest design; ask what adding each piece later would cost. If later is cheap, defer.</p>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Basics are not over-engineering: timeouts, idempotency, monitoring, backups and tested restores are cheap insurance.</li>
<li>Hard-to-change decisions (data model, tenancy, public API) deserve early care.</li>
<li>High-blast-radius systems such as billing and auth justify more rigor.</li>
</ul>
<h4>Example</h4><p>A proposal for alerting on failed SMS batches includes Kafka, a stream processor, a rules DSL and a new notification service. Volume is about 2,000 failures a day. A job that queries the messages table every minute and posts to Slack meets the need today; if alert rules genuinely multiply, revisit. The proposal adds two clusters to operate for a problem one SQL query solves.</p>`,
    followups: [`How would you push back on an over-engineered design without dismissing the author?`, `Which investments look like over-engineering but are cheap insurance?`, `How do you pick the scale target a design should handle?`],
    related: ["h7", "h11", "e1"]
  },
  h7: {
    tldr: `A design is dangerously under-engineered when a likely failure causes silent or irreversible harm: double charges, lost or duplicate messages, tenant data leaks, or no way to detect and roll back. Judge failure modes, not features.`,
    body: `<h4>Core idea</h4><p>Under-engineering is not missing scale. It is missing safety where mistakes are expensive or impossible to undo. Simple is fine when failures are visible, bounded and recoverable. It is dangerous when they are silent, unbounded or permanent.</p>
<h4>How to do it</h4><p>Red flags:</p><ul>
<li>No idempotency on writes that spend money or send messages. A client retry means a double charge or a duplicate OTP.</li>
<li>Database write plus queue publish with no outbox or reconciliation. The two diverge silently.</li>
<li>Network calls without timeouts; retries without backoff, jitter or caps.</li>
<li>Unbounded queues, memory, fan-out, result sets or per-tenant usage.</li>
<li>Backups never restored; one person who knows how to recover.</li>
<li>No way to answer "is it working now?" or "what happened to message X?"</li>
<li>Irreversible schema changes, or deploys with no rollback path.</li>
<li>Tenant ID taken from client input without an authorization check.</li>
<li>Deletes and bulk jobs with no dry run, soft delete or rate limit.</li>
</ul>
<p>Check: list likely failures (dependency down or slow, duplicate delivery, crash mid-operation, bad deploy, bad input, 10x traffic). For each, ask how it is detected, what it touches, how it is recovered, and whether anything is lost for good. Irreversible plus likely means fix before launch.</p>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Match rigor to blast radius. An internal report can be flaky; billing cannot.</li>
<li>"We'll add it later" works for scale. It fails for idempotency and data models, because bad data already exists by then.</li>
</ul>
<h4>Example</h4><p>A new bulk SMS endpoint loops over recipients inside the HTTP request. When the request times out, the client retries the whole batch. The first 3,000 recipients get the message twice, and nothing records who was sent what. The fix is not scaling work: persist the batch with an idempotency key, return 202, and process recipients asynchronously with per-recipient status.</p>`,
    followups: [`How do you decide which safety gaps must be fixed before launch?`, `What is the minimum observability a new service needs on day one?`, `How would you argue for this work to a PM who wants to ship now?`],
    related: ["h6", "c10", "r1"]
  },
  h8: {
    tldr: `Assume mistakes will happen and shrink their cost: small blast radius, fast detection, one-step rollback, and data that can be restored. Put heavy guardrails only on the few actions that are truly irreversible.`,
    body: `<h4>Core idea</h4><p>You cannot prevent all mistakes, but you can control what each one costs. Cost depends on four factors: blast radius, time to detect, time to recover, and whether it can be reversed. Design to shrink each. Separate reversible changes (two-way doors) from irreversible ones (one-way doors), and put heavy process only on the second kind.</p>
<h4>How to do it</h4><ol>
<li><strong>Limit blast radius.</strong> Cells, so a bad deploy hits one slice of customers, canaries at 1% → 10% → 100%, flags scoped per account, per-tenant limits, bulkheads.</li>
<li><strong>Detect fast.</strong> SLO burn-rate alerts, automated canary analysis that compares canary with baseline and rolls back, reconciliation jobs for data correctness.</li>
<li><strong>Recover fast.</strong> One-command rollback, kill switches, immutable artifacts, and expand/contract schema changes so a code rollback never needs a database rollback.</li>
<li><strong>Make data reversible.</strong> Soft delete with a grace period, point-in-time recovery, object versioning, append-only event logs you can replay.</li>
<li><strong>Guard irreversible actions.</strong> Scripts that default to dry run, confirmations that show the count, rate limits on bulk jobs, two-person review for production data changes, deletion protection on databases and buckets.</li>
<li><strong>Practice.</strong> Restore drills, game days, and blameless postmortems that ask what made the mistake easy.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Friction everywhere teaches people to bypass guardrails. Keep friction for irreversible or high-blast actions.</li>
<li>Canaries miss slow problems: memory leaks, monthly jobs, full-load effects.</li>
<li>Rollback fails if new code wrote data old code cannot read. Plan a forward fix or dual-format reads.</li>
<li>An untested backup is a hope, not a plan.</li>
</ul>
<h4>Example</h4><p>A cleanup script should release phone numbers unused for a year, but a bug in its filter also matches active numbers. Catastrophic version: numbers go back to the carrier immediately and customers lose them. Cheap version: the script defaults to dry run and prints "would affect 12,400 numbers" when about 300 were expected, so the engineer stops. Even if run, numbers first move to <code>pending_release</code> with a 30-day hold, the job processes 100 per minute with an anomaly alert, and one command restores them. The same bug becomes a ten-minute fix instead of a customer incident.</p>`,
    followups: [`How would you design rollback for a release that also migrates data?`, `Which actions in your current system are irreversible, and what guards them?`, `How do you choose canary size and duration?`],
    related: ["r8", "r7", "e8"]
  },
  h9: {
    tldr: `Put the knowledge in the system, not in people: named team ownership, SLOs, a runbook for every alert, automated recovery steps, and an on-call rotation where any trained member can handle a common incident alone.`,
    body: `<h4>Core idea</h4><p>A hero-owned system works because one person knows its secrets, and fails when that person is asleep, on leave or gone. Team ownership means any trained member can operate, debug and change it safely. A practical test: can the newest person on the rotation resolve a common incident at 3 a.m. using only the runbook and dashboards?</p>
<h4>How to do it</h4><ol>
<li><strong>Explicit ownership.</strong> A service catalog entry with owner team, on-call rotation, repo, dashboards, runbooks, SLOs and dependencies. CODEOWNERS points to the team, not a person.</li>
<li><strong>A runbook for every alert:</strong> what it means, how to confirm, how to mitigate, when to escalate. An alert without a runbook gets one or gets deleted.</li>
<li><strong>Automate hero knowledge.</strong> Turn manual recovery steps into scripts with a dry run: replay a dead-letter queue, rotate credentials, fail over.</li>
<li><strong>Standard, operable design.</strong> Use the company's paved road for frameworks, deploys and observability so skills transfer. Add health checks, structured logs with IDs, kill switches.</li>
<li><strong>Spread knowledge on purpose.</strong> Pair on incidents, rotate who leads postmortems, let the newest member run releases, update the runbook after each use.</li>
<li><strong>Track the bus factor.</strong> List critical tasks (deploy, restore, failover, key rotation) and who can do each. A task only one person can do goes on the backlog as a risk.</li>
<li><strong>Use SLOs and error budgets</strong> so reliability trade-offs are team decisions, not one person's judgment.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Organizations reward firefighting. Reward prevention and documentation too.</li>
<li>Runbooks rot. Review them after every use.</li>
<li>Clever custom tech deepens hero dependency; standard tech spreads knowledge.</li>
</ul>
<h4>Example</h4><p>In a carrier-integration service, only one engineer knows how to restore SMPP binds when a carrier changes its SMSC endpoint. The team writes a runbook from the last incident, turns the manual steps into a dry-run script, adds a per-carrier bind-failure alert that links to the runbook, and has two other engineers run it in a staging drill. At the next occurrence, an engineer six months into the team fixes it in fifteen minutes without paging anyone.</p>`,
    followups: [`How do you tell whether a system depends on a hero?`, `What makes a runbook usable at 3 a.m.?`, `How would you hand a system over from one team to another?`],
    related: ["o7", "r10", "h10"]
  },
  h10: {
    tldr: `Prefer mature, well-understood tools and simple mechanisms with known failure modes, make failure behavior explicit, and keep the system easy to reason about at 3 a.m. Spend novelty only where it clearly pays.`,
    body: `<h4>Core idea</h4><p>Reliability comes from understood behavior. Postgres, a standard queue, and HTTP with timeouts have known failure modes, tooling, docs and people who have debugged them. Clever designs (homegrown consensus, custom caches, lock-free tricks) have failure modes nobody knows yet. Think in <strong>innovation tokens</strong>: a team can afford only a few novel choices, so spend them where the product differentiates.</p>
<h4>How to do it</h4><ol>
<li><strong>Default to the paved road:</strong> the company's standard language, database, queue, deploy pipeline and observability. Any deviation needs a written reason.</li>
<li><strong>Use mechanisms with known failure modes:</strong> database transactions over sagas, retries with exponential backoff, jitter and caps, idempotency keys, a transactional outbox for events.</li>
<li><strong>Make failure explicit.</strong> Every network call has a timeout, a fallback or a clear error, and a metric. No infinite retries. Bounded queues.</li>
<li><strong>Cut moving parts.</strong> Each new service, store or cache adds failure modes and on-call knowledge.</li>
<li><strong>Keep operations predictable:</strong> one deploy and rollback process, config in version control, graceful shutdown, capacity headroom (for example, scale out before 60-70% utilization).</li>
<li><strong>Test the boring things:</strong> restore backups, rehearse failover, load test at 2x peak.</li>
<li><strong>Write code for the reader.</strong> Explicit beats clever.</li>
</ol>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Boring can cost more hardware or peak performance. That is usually cheaper than an incident.</li>
<li>Boring means mature, not abandoned. Dead tech without security fixes is a risk too.</li>
<li>Sometimes cleverness is the product, like a smarter routing algorithm. Isolate it behind an interface with a simple fallback.</li>
<li>Boring tools still need discipline: a Postgres without backups or connection pooling is not reliable.</li>
</ul>
<h4>Example</h4><p>For delivery-status tracking, a team proposes an in-memory state machine replicated across nodes with a custom gossip protocol. The boring version: status rows in Postgres keyed by <code>message_id</code>, idempotent upserts, and carrier receipts consumed from a standard queue with retries and a dead-letter queue. It handles the real 3,000 updates per second with headroom, any engineer can debug it with SQL, and failover is the managed database's, not a homegrown protocol.</p>`,
    followups: [`When is it worth spending an innovation token on new technology?`, `How would you make an unavoidably clever component safe to run?`, `What does boring look like for deploy and rollback?`],
    related: ["h3", "h9", "r3"]
  },
  h11: {
    tldr: `Build only what a real, current need justifies, counting its full lifetime cost. Say no or not yet to speculative features, to work another layer or vendor should own, and to public features you cannot take back.`,
    body: `<h4>Core idea</h4><p>Every feature is a permanent cost: code, tests, docs, support, on-call and, once public, backward compatibility. What you leave out keeps the system simple and fast to change. YAGNI: build for known needs, and leave seams so later needs are cheap to add.</p>
<h4>How to do it</h4><p>Filters, in order:</p><ol>
<li><strong>Real need?</strong> A named customer or a measured problem, not "someone might want it".</li>
<li><strong>Lifetime cost?</strong> Build, maintenance, support, compatibility. Public API features are nearly impossible to remove.</li>
<li><strong>Right place?</strong> Another service, a vendor or the client may own it better. Customers can build their own analytics from webhooks and exports.</li>
<li><strong>Possible without code?</strong> Config, a script, a manual process for the first ten cases, a doc.</li>
<li><strong>Threatens core guarantees?</strong> Latency on the hot path, tenant isolation, billing correctness.</li>
<li><strong>Reversible?</strong> Hold public features to a higher bar than internal ones.</li>
</ol>
<p>Write explicit non-goals in the design doc and keep a "not now" list, each item with the trigger that would change the answer.</p>
<h4>Trade-offs and pitfalls</h4><ul>
<li>Saying no to everything loses customers. "Not yet, here is the trigger" plus a cheap workaround usually works.</li>
<li>Custom features for one big customer fork the product. Prefer generic config or a supported extension point.</li>
<li>Scope creep arrives in small, reasonable steps. Review the total, not each addition.</li>
<li>Features without usage metrics can never be removed with confidence.</li>
</ul>
<h4>Example</h4><p>A customer asks the SMS API to send at each recipient's local 9 a.m., detecting the time zone from the phone number. Only one customer is asking. Time zone from a number is unreliable: people keep their numbers when they move, and some countries span several time zones. And a public API feature is forever. Decision: skip detection, support an explicit <code>send_at</code> timestamp that many customers can use, record detection as a non-goal, and revisit if several customers ask and a reliable data source exists.</p>`,
    followups: [`How do you say no to a large customer's request without losing the deal?`, `How do you make a not-now decision easy to revisit later?`, `How do you find features that should be removed?`],
    related: ["h6", "e1", "e2"]
  },
});
