window.VAULT_ANSWERS = window.VAULT_ANSWERS || {};
Object.assign(window.VAULT_ANSWERS, {
  t1: {
    tldr: `Decide per operation, not per system. Use strong consistency where a stale read breaks an invariant or loses money (balances, number ownership, uniqueness). Accept eventual consistency where staleness is cosmetic, bounded, and self-healing (dashboards, logs, analytics).`,
    body: `<h4>Core idea</h4>
<p>Consistency is chosen per piece of data and per operation, not once for the whole system. <strong>Strong</strong> consistency means every read sees the latest committed write, as if there were one copy. <strong>Eventual</strong> consistency means copies converge once writes stop, but a read may return old data for a while. Strong costs latency (a round trip to a leader or quorum) and availability when nodes cannot talk. Eventual is fast and survives failures, but your code and your users must cope with stale data.</p>
<p>The deciding question: <strong>what is the worst thing that happens if this read is a few seconds old?</strong> "We lose money, sell something twice, or break a rule" means strong. "A chart is slightly behind" means eventual is fine.</p>
<h4>How to do it</h4>
<ol>
<li><strong>List the invariants.</strong> Balance never below zero. One phone number, one owner. Each message billed once.</li>
<li><strong>Guard each invariant with one atomic write on its source of truth:</strong> a transaction on the SQL primary, a unique constraint, or a conditional update such as <code>UPDATE accounts SET balance = balance - 5 WHERE id = 42 AND balance &gt;= 5</code>. The check and the change happen in one statement.</li>
<li><strong>Let derived data be eventual:</strong> caches, read replicas, search indexes, analytics stores, and other services' copies, fed by events or CDC.</li>
<li><strong>Bound and measure the staleness.</strong> Alert on replica lag and consumer lag, and write the bound down ("usage graphs may lag up to 60 s").</li>
<li><strong>Check the cheaper middle options.</strong> Often the real need is only "users see their own changes" (read-your-writes), not strong consistency everywhere.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Checking a rule against a replica or cache, then writing (check-then-act on stale data), is the classic bug. Check on the primary, inside the conditional write.</li>
<li>"Eventual" without a bound becomes minutes during an incident, and nobody notices without a lag metric.</li>
<li>Making everything strong "to be safe" sends every request to the leader, adds cross-region round trips (tens to hundreds of ms), and turns a network blip into errors.</li>
<li>Strictness is partly a business call. A small overdraft that you reconcile later can be cheaper than serializing every send on one hot balance row.</li>
</ul>
<h4>Example</h4>
<p>A customer sends an SMS through your API. The balance debit is strong: one conditional update on the primary, so two concurrent sends from a nearly empty account cannot both pass. Buying a phone number is strong too (a unique constraint), so it is never sold twice. The message log, the usage graph, and delivery statuses are read from a replica or an analytics store and may lag a few seconds. Nobody is harmed if "delivered" shows up two seconds late.</p>`,
    followups: [`How would you stop two concurrent API calls from overdrawing a prepaid balance?`, `How do you measure and alert on replication lag?`, `Which data in a messaging platform could tolerate a minute of staleness, and which could not tolerate one second?`],
    related: ["t8", "t5", "t2"]
  },
  t2: {
    tldr: `Map each entity to one owning store, then write down the guarantee every copy actually gives (primary, replica, cache, search, event projection) and its staleness bound. The end-to-end guarantee is only as strong as the weakest hop.`,
    body: `<h4>Core idea</h4>
<p>Consistency is a ladder. From strongest: <strong>linearizable</strong> (every read sees the latest write, in real-time order), <strong>causal</strong> (nobody sees an effect before its cause), <strong>session guarantees</strong> (read-your-writes, monotonic reads), <strong>bounded staleness</strong> (at most N seconds old), and <strong>eventual</strong> (copies converge some day). A request that crosses several services and stores gets the <strong>weakest</strong> level on its path: a strongly consistent database behind a 5-minute cache is a 5-minute-stale system.</p>
<p>Keep this separate from <strong>isolation levels</strong> (read committed, snapshot, serializable), which are about concurrent transactions inside one database.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Name one owner per entity.</strong> Billing owns balances; the message service owns messages. Everyone else holds read-only projections.</li>
<li><strong>Write down what each store really gives</strong>, and its knob for going stronger (table below).</li>
<li><strong>Tag each use case with the level it needs, then route it:</strong> invariant checks → primary; a user viewing their own change → session guarantee; dashboards → replica or cache.</li>
<li><strong>Carry versions across boundaries.</strong> Put an entity version or sequence number in events and API responses, so consumers can drop older updates and spot gaps.</li>
<li><strong>Publish the contract.</strong> "List endpoints are eventually consistent, usually under 2 s" belongs in the API docs.</li>
</ol>
<table>
<thead><tr><th>Store</th><th>Default</th><th>Stronger option</th></tr></thead>
<tbody>
<tr><td>SQL primary</td><td>Strong</td><td>Serializable isolation</td></tr>
<tr><td>Async read replica</td><td>Eventual, ms to s behind</td><td>Read the primary, or wait until the replica reaches your LSN</td></tr>
<tr><td>DynamoDB</td><td>Eventually consistent reads</td><td>ConsistentRead (not on GSIs)</td></tr>
<tr><td>Cassandra</td><td>Chosen per query</td><td>QUORUM or LOCAL_QUORUM</td></tr>
<tr><td>OpenSearch</td><td>Near real time (~1 s refresh)</td><td>refresh=wait_for on the write</td></tr>
<tr><td>Redis cache</td><td>Stale up to the TTL</td><td>Delete on write, short TTL</td></tr>
</tbody>
</table>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Writing to a database and then separately to a cache or search index (dual write) is never atomic. Use an outbox or CDC so copies converge instead of drifting.</li>
<li>Views that join a fresh source with a lagging projection can show impossible combinations. Show an "as of" time, or read both from one place.</li>
<li>Serializable isolation on the primary does nothing for reads served by a replica.</li>
<li>Linearizability everywhere is expensive. Most flows need strong writes plus session guarantees.</li>
</ul>
<h4>Example</h4>
<p>The message service writes to Postgres and streams changes by CDC into OpenSearch and ClickHouse. <code>POST /messages</code> returns an ID, and <code>GET /messages/{id}</code> reads the primary, so a client can always fetch what it just created. The search-backed list endpoint is documented as a few seconds behind. Billing debits balances with conditional writes on its own primary. Status events carry a rank, so a late "sent" never overwrites "delivered".</p>`,
    followups: [`If a cache sits in front of a strongly consistent database, what consistency do readers actually get?`, `What is the difference between serializable isolation and linearizability?`, `How would you make a consumer ignore updates older than what it already has?`],
    related: ["t1", "t5", "t4"]
  },
  t3: {
    tldr: `Avoid 2PC with a saga: a chain of local transactions, each with a compensating action, driven by an orchestrator (Temporal, Step Functions, a state table) or by events. Run irreversible steps last. Make every step idempotent.`,
    body: `<h4>Core idea</h4>
<p>Two-phase commit (2PC) makes several databases commit atomically: a coordinator asks every participant to prepare, then to commit. The pain: participants hold locks while they wait, a coordinator crash can leave them stuck "in doubt", every participant must speak the protocol (Kafka, carriers, and payment APIs do not), and the slowest participant sets everyone's latency.</p>
<p>A <strong>saga</strong> replaces one distributed transaction with a sequence of local ones, T1..Tn. If step k fails, compensations run for the steps already done, in reverse. You give up isolation and instant atomicity in exchange for availability: intermediate states are visible for a while, and "rollback" is a new business action (a refund, not an undo).</p>
<h4>How to do it</h4>
<ol>
<li><strong>Avoid it if you can.</strong> If the invariant fits in one service and one database, a local ACID transaction beats any distributed protocol.</li>
<li><strong>Classify steps:</strong> compensatable (reserve, charge), pivot (the point of no return, such as handing an SMS to a carrier), and retriable (after the pivot; must eventually succeed). Order them: compensatable → pivot → retriable.</li>
<li><strong>Choose coordination.</strong> Orchestration: one workflow drives the steps and holds the state (Temporal, AWS Step Functions, or your own state-machine table). Choreography: each service reacts to the previous one's event. Orchestration is easier to debug and to add timeouts to; choreography couples less, but the flow becomes invisible past three or four steps.</li>
<li><strong>Persist saga state</strong> (saga_id, current step, status) so a crash resumes instead of forgetting.</li>
<li><strong>Make every step and compensation idempotent</strong>, keyed by saga_id + step. Retries and redelivery will happen.</li>
<li><strong>Publish step results through an outbox</strong> so "state changed" and "event sent" cannot disagree.</li>
<li><strong>Make up for missing isolation:</strong> semantic locks (a PENDING status other flows respect), reservations instead of direct debits (Try-Confirm-Cancel), and re-validation before acting.</li>
<li><strong>Watch for stuck sagas:</strong> step timeouts, alerts on sagas older than expected, and a manual-resolution path.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Other requests can see a reserved number or a charge that will later be refunded. Design APIs and UI for these states.</li>
<li>Compensations fail too. Retry them with backoff, then escalate to a human queue. Never drop one.</li>
<li>Some actions cannot be undone (SMS sent, call placed). Make them the pivot, as late as possible.</li>
<li>Choreographed flows grow event chains nobody owns. Put the saga_id in every log line and trace.</li>
<li>The orchestrator becomes critical infrastructure and must be durable, which is why Temporal persists each workflow's full history.</li>
</ul>
<h4>Example</h4>
<p>Buying a phone number, orchestrated:</p>
<ol>
<li>Inventory reserves the number (RESERVED, expires in 10 minutes). Compensation: release it.</li>
<li>Billing charges the setup fee and first month with idempotency key saga_id:charge. Compensation: a refund ledger entry.</li>
<li>Pivot: provision the number with the upstream carrier. On permanent failure, refund, then release.</li>
<li>Retriable: mark the number active, attach the customer's app, send the webhook. Retry until done.</li>
</ol>
<p>The same ordering answers "send SMS, then debit": debit or reserve first, since it can be refunded, then hand the message to the carrier, since it cannot be unsent.</p>`,
    followups: [`What is a pivot transaction, and why should it come as late as possible?`, `What do you do when a compensation keeps failing?`, `How do you stop another request from acting on the intermediate state of a saga in flight?`],
    related: ["t4", "p4", "c10"]
  },
  t4: {
    tldr: `Write the business change and an outbox row in one transaction; a relay (poller or CDC) publishes them. Consumers record event IDs in an inbox table in the same transaction as their effect. Delivery is at-least-once; effects happen once.`,
    body: `<h4>Core idea</h4>
<p>The <strong>dual-write problem</strong>: a handler that commits to the database and then publishes to Kafka can crash in between, or the publish can fail. Now the database says the balance was debited but no event exists. Publishing first is worse: an event for a change that rolled back. A database and a broker cannot commit atomically without 2PC.</p>
<p>The <strong>outbox</strong> puts the event inside the database: insert an event row in the same transaction as the business change, so both commit or neither does. A separate relay publishes outbox rows to the broker. It may publish a row twice (crash after publishing, before marking it sent), so delivery is at-least-once. The <strong>inbox</strong> on the consumer side absorbs those duplicates.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Outbox table:</strong> event_id (UUIDv7, created once at insert), aggregate_type, aggregate_id (the partition key), event_type, payload, created_at, published_at.</li>
<li><strong>Relay option A, polling:</strong> <code>SELECT ... WHERE published_at IS NULL ORDER BY id LIMIT 500 FOR UPDATE SKIP LOCKED</code>, publish, mark published. Simple; latency is the poll interval (100 ms to 1 s); adds load on the primary.</li>
<li><strong>Relay option B, CDC:</strong> Debezium tails the Postgres WAL or MySQL binlog and publishes outbox inserts to Kafka. Its outbox event router picks the topic by aggregate type and keys by aggregate_id. Lower latency and no polling, but you now run Kafka Connect and a replication slot.</li>
<li><strong>Keep per-entity order:</strong> key by aggregate_id, keep Kafka's idempotent producer on, and never let two relay workers publish the same aggregate's events concurrently (one relay, or relays owning disjoint hash shards).</li>
<li><strong>Clean up:</strong> delete published rows, or partition the table by day and drop old partitions.</li>
<li><strong>Inbox:</strong> <code>inbox(consumer, event_id)</code> with a primary key on both. In one transaction, insert with <code>ON CONFLICT DO NOTHING</code>; zero rows inserted means a duplicate, so skip; otherwise apply the change. Commit, then ack or commit the offset.</li>
<li><strong>Keep inbox rows</strong> longer than the longest redelivery or replay window.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>The outbox guarantees no lost and no phantom events. It does not prevent duplicates, so consumers must dedupe.</li>
<li>If the CDC connector stops, an unread Postgres replication slot keeps WAL on the primary until the disk fills. Alert on slot lag.</li>
<li>The inbox only helps when the effect lives in the same database. For external effects (a carrier or payment API), pass the event_id downstream as an idempotency key, or record intent first and reconcile unknown outcomes.</li>
<li>Outbox payloads are a public contract. Version them; do not dump internal rows.</li>
</ul>
<h4>Example</h4>
<p>Billing debits a balance for a sent SMS. One transaction updates the balance, inserts a ledger row, and inserts an outbox row: BalanceDebited with account_id, message_id, and amount. Debezium streams it to a billing events topic keyed by account_id. The usage service consumes it and, in one transaction, inserts the event_id into its inbox and increments the account's daily usage. If it crashes before committing the offset, the redelivered event hits the primary-key conflict and is skipped, so usage is never counted twice.</p>`,
    followups: [`How do you keep per-account event order if you run several relay workers?`, `What happens to the Postgres primary if the CDC connector is down for a day?`, `How do you make a consumer idempotent when its side effect is an external API call?`],
    related: ["t3", "a3", "a9"]
  },
  t5: {
    tldr: `After a user writes, route their reads to a copy that has that write: the primary for a short window, or any replica that has caught up to a version token (LSN, GTID, entity version) returned by the write.`,
    body: `<h4>Core idea</h4>
<p>Read-your-writes (RYW) is a <strong>session guarantee</strong>: after a client writes, its own later reads reflect that write. Other users may briefly see the old value. It breaks when writes go to one place and reads come from a lagging copy: an async replica, a cache, a search index, a CQRS read model, or another region. Symptom: "I created the application, and the list does not show it."</p>
<h4>How to do it</h4>
<ol>
<li><strong>Primary-after-write window.</strong> After a user writes, send that user's reads to the primary for N seconds, with N above your p99 replica lag. Track it with a session flag or a short-TTL Redis key. Crude, effective.</li>
<li><strong>Version tokens.</strong> The write returns a position (Postgres WAL LSN, MySQL GTID, or the entity's version), and the client sends it back on reads. The read router uses a replica that has replayed past it (Postgres: <code>pg_last_wal_replay_lsn()</code>), waits briefly, or falls back to the primary. MongoDB's causally consistent sessions work this way.</li>
<li><strong>Split by read type.</strong> Get-by-ID right after creation → primary. Lists, search, analytics → replicas.</li>
<li><strong>Return the full object from the write</strong> so the UI can show it without re-reading a lagging list.</li>
<li><strong>Caches:</strong> delete the key on write rather than setting it (a concurrent reader can repopulate a stale value), and keep TTLs short.</li>
<li><strong>Multi-region:</strong> pin each user or tenant to a home region for writes and fresh reads, or forward reads whose token the local region has not reached.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Primary windows add primary load. Keep them short and limited to users who just wrote.</li>
<li>Session tricks do not cover a second device. For cross-device RYW, keep the user's last write token server side, not in a cookie.</li>
<li>RYW is not monotonic reads: bouncing between replicas can show new, then old. Pin a session to one replica for monotonic reads.</li>
<li>Waiting for a replica needs a timeout, or one lagging replica becomes a latency incident.</li>
</ul>
<h4>Example</h4>
<p>A customer changes their application's inbound SMS webhook URL in the console. The API writes to the primary and returns the updated object plus a consistency token (the commit LSN). The console reloads the page with that token, and the router serves it from a caught-up replica or the primary. The message router, which caches application config, drops its entry on the change event, so the next inbound SMS goes to the new URL within a second or two, a bound the docs state.</p>`,
    followups: [`How would you give read-your-writes across a user's phone and laptop?`, `What is the difference between read-your-writes and monotonic reads?`, `How does your approach change when a user's requests can land in different regions?`],
    related: ["t2", "k3", "r5"]
  },
  t6: {
    tldr: `Assume copies will drift. Pick a source of truth per field, compare on a shared key over a closed time window, aggregate first then drill into mismatched buckets, auto-repair safe cases idempotently, and send money-affecting cases to humans.`,
    body: `<h4>Core idea</h4>
<p>Whenever the same fact lives in two systems (your messages table and a carrier's records, your ledger and a payment provider, your database and a search index), the copies drift. Causes: lost events, bugs, partial failures, manual fixes, rounding, time zones. Prevention (outbox, idempotency) reduces drift; <strong>reconciliation</strong> finds and repairs the rest. Treat it as a scheduled job you own, not incident cleanup.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Declare the source of truth per field.</strong> The carrier is the truth for "delivered, and how many segments"; your ledger is the truth for what you charged. Without this you cannot decide which side to fix.</li>
<li><strong>Join on a stable shared key</strong> (message ID, carrier message ID, payment reference) over a closed window, such as yesterday in UTC, run after a grace period so late records have landed.</li>
<li><strong>Compare cheaply first.</strong> Counts and sums per account per hour on both sides; diff row by row only inside buckets that disagree. At larger scale, compare hashes per bucket (the Merkle-tree idea Cassandra repair uses).</li>
<li><strong>Classify each difference:</strong> missing on A, missing on B, or field mismatch. Separate "late, re-check tomorrow" from "real error".</li>
<li><strong>Repair:</strong> automatic for safe classes (re-emit the event from the source, upsert from the source of truth), a human queue for money or ambiguity. Record corrections as new, reason-coded ledger entries, never silent edits.</li>
<li><strong>Track</strong> mismatch count and amount per run. A jump usually means a new upstream bug.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Late data looks like missing data. Use a grace window and re-check just before repairing.</li>
<li>Auto-repair can spread a bug at machine speed. Cap fixes per run and start in dry-run mode.</li>
<li>The job will be rerun, so repairs must be idempotent.</li>
<li>Big scans hurt production. Run against a replica, a snapshot, or the warehouse.</li>
<li>Replicas that accept writes in several places also need a merge rule. Last-write-wins by timestamp silently drops updates when clocks skew; version vectors detect concurrent writes; CRDTs merge counters and sets safely.</li>
</ul>
<h4>Example</h4>
<p>Nightly carrier reconciliation. Load the carrier's daily records and join them to your messages on carrier message ID. Compare message and segment counts per account per hour, then diff the hours that disagree. Typical classes: you charged the customer but the carrier has no record (maybe never sent: refund candidate); the carrier charged you but you have no record (a lost response or a leak: investigate); segment counts differ (the text went out as UCS-2, 70 characters per SMS, instead of GSM-7, 160). Adjustments become reason-coded ledger entries, and the mismatch rate is graphed per carrier.</p>`,
    followups: [`How do you avoid false positives from records that arrive late?`, `How would you compare two billion-row tables without a full row-by-row diff?`, `When is last-write-wins acceptable, and when does it lose data?`],
    related: ["t4", "d9", "a3"]
  },
  t7: {
    tldr: `Generate IDs locally with no cross-region call. Default to UUIDv7 or ULID (128-bit, time-ordered, no coordination). Use Snowflake-style 64-bit IDs when you need bigint keys, with region and worker bits and a clock-skew guard.`,
    body: `<h4>Core idea</h4>
<p>A good ID is unique without coordination (no call to another region per ID), roughly time-ordered (new rows land at the end of the index and sort by creation), compact enough for your keys, and hard to guess if customers see it. Coordination-free schemes get uniqueness from randomness or from a unique worker ID per generator.</p>
<table>
<thead><tr><th>Scheme</th><th>Size</th><th>Time-ordered</th><th>Needs</th></tr></thead>
<tbody>
<tr><td>UUIDv4</td><td>128 bits</td><td>No</td><td>Nothing (122 random bits)</td></tr>
<tr><td>UUIDv7 (RFC 9562)</td><td>128 bits</td><td>Yes, by ms</td><td>Nothing (48-bit ms time + random)</td></tr>
<tr><td>ULID</td><td>128 bits</td><td>Yes, by ms</td><td>Nothing (48-bit ms time + 80 random bits)</td></tr>
<tr><td>Snowflake</td><td>64 bits</td><td>Yes, by ms</td><td>A unique worker ID and a sane clock</td></tr>
<tr><td>DB sequence</td><td>64 bits</td><td>Yes</td><td>A database per region with disjoint ranges</td></tr>
</tbody>
</table>
<h4>How to do it</h4>
<ol>
<li><strong>Default to UUIDv7</strong> generated in the application: no coordination, sortable, index-friendly, and you can decode the creation time while debugging.</li>
<li><strong>Need 64-bit keys?</strong> Snowflake layout: 41 bits of milliseconds since a custom epoch (about 69 years), 10 bits of worker ID, 12 bits of sequence (4,096 IDs per ms per worker). Give a few worker bits to the region.</li>
<li><strong>Assign worker IDs safely:</strong> lease them from etcd, Consul, or a database table with expiry. Two live processes must never share one; random picks are not enough under autoscaling.</li>
<li><strong>Guard the clock:</strong> if NTP moves time backwards, stop issuing until the clock passes the last timestamp used. If the sequence runs out within a millisecond, wait for the next one.</li>
<li><strong>Embed routing info when useful:</strong> region bits or a region prefix let any API node route a lookup to the owning region.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Time-ordered IDs are only roughly ordered across machines. Never use them to decide what happened first.</li>
<li>Random UUIDv4 keys scatter inserts across a B-tree (page splits, poor cache use), worst as a MySQL InnoDB clustered key.</li>
<li>Range-sharded stores (Spanner, CockroachDB, Bigtable) are the reverse: increasing keys send every insert to the last range, a hot spot. Use random or hash-prefixed keys there.</li>
<li>64-bit IDs exceed JavaScript's safe integer (2^53 - 1). Send them as strings in JSON.</li>
<li>UUIDv7 and ULID reveal creation time; sequences reveal volume and invite enumeration.</li>
</ul>
<h4>Example</h4>
<p>A CPaaS API runs in US and EU regions and returns a message ID on every send. Each API pod generates a UUIDv7, so there is no cross-region call and no ID service to fail. The messages table's primary key index stays append-friendly, and support can read a message's creation time from its ID. A high-volume CDR table keyed by bigint uses Snowflake IDs with 2 region bits and 8 worker bits, with worker IDs leased from etcd.</p>`,
    followups: [`What happens to a Snowflake generator when NTP moves the clock backwards?`, `Why can a time-ordered key be good for Postgres but bad for Spanner or CockroachDB?`, `How would you assign worker IDs safely in an autoscaling Kubernetes deployment?`],
    related: ["d5", "d4", "r5"]
  },
  t8: {
    tldr: `CAP only bites during a network partition: then each operation either refuses (consistent) or answers with possibly stale or conflicting data (available). Decide per operation by pricing both wrong answers. PACELC adds the everyday cost: latency versus consistency.`,
    body: `<h4>Core idea</h4>
<p>CAP says: when the network splits replicas apart (P), each side must either refuse requests it cannot answer correctly (C, meaning linearizable) or keep answering and risk stale reads and conflicting writes (A). Partitions will happen, so "CA" is not a real option for anything spread over a network. The useful question is: <strong>for this operation, during a partition, is an error or a possibly wrong answer cheaper?</strong></p>
<p><strong>PACELC</strong> adds the cost you pay every day: if Partitioned, choose A or C; Else, choose Latency or Consistency. Synchronous replication to another region adds a WAN round trip (tens to hundreds of ms) to every write, even when nothing is broken.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Turn the requirement into a failure scenario:</strong> "Region A cannot reach region B for 10 minutes. A user in B does X. What happens?"</li>
<li><strong>Price both wrong answers.</strong> CP costs errors, failed sends, lost revenue. AP costs double spends, double sells, stale screens. Ask which can be repaired later (refund, reconcile, merge).</li>
<li><strong>Decide per operation.</strong> Appends that merge later (logs, usage events, inbound messages) suit AP. Uniqueness and money (buy a number, debit a balance) lean CP.</li>
<li><strong>Check the normal-day latency:</strong> does a cross-region commit fit your p99 budget?</li>
<li><strong>Pick mechanisms to match.</strong> CP: a single leader or consensus (a Postgres primary, etcd, Spanner, CockroachDB), quorum reads and writes. AP: local writes with async replication, low consistency levels in leaderless stores, idempotency keys for later merges, conflict rules (last-write-wins, CRDTs).</li>
<li><strong>Look for a bounded middle.</strong> Split a global limit into per-region allowances (escrow) so each side keeps working during a partition while the total stays capped.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>CAP's C is linearizability, not the C in ACID. Its A means every live node answers, a far stricter bar than "high availability".</li>
<li>Real systems are rarely purely CP or AP. Cassandra at consistency ONE behaves AP; at QUORUM it is much closer to CP.</li>
<li>A slow network, a GC pause, or a half-dead node looks just like a partition. Your timeouts decide when you are "partitioned".</li>
<li>Choosing AP means designing conflict handling and reconciliation up front.</li>
</ul>
<h4>Example</h4>
<p>A CPaaS runs in the US and India. Requirements: "customers can always send SMS" and "prepaid accounts never overspend". During a partition these collide, so decide per operation. Accepting a send is AP: each region accepts it, queues it, and records a usage event keyed by message ID for merging later. The balance lives in the account's home region (CP). The cut-off region keeps sending against a pre-granted allowance, say 10% of the balance, so worst-case overspend is bounded, and ledgers reconcile when the link heals.</p>`,
    followups: [`Why is "CA" not a meaningful choice for a system that spans a network?`, `If partitions are rare but every write crosses regions, how does PACELC change your design?`, `How would you bound the damage of accepting writes on both sides of a partition?`],
    related: ["t1", "t10", "r5"]
  },
  t9: {
    tldr: `They are the engines inside tools you already run. Raft or Paxos give small, critical, strongly consistent state (config, leaders, locks, metadata); quorums plus gossip give highly available bulk data. Pick tools by engine; do not build your own.`,
    body: `<h4>Core idea</h4>
<ul>
<li><strong>Consensus (Paxos, Raft):</strong> a small group (3 or 5 nodes) agrees on one ordered log while a majority is up. Linearizable, and survives node loss. For small, critical data.</li>
<li><strong>Quorum replication (Dynamo style):</strong> no leader; writes go to N replicas and need W acks, reads ask R. Tunable per request, highly available, built for heavy writes; conflicts are possible.</li>
<li><strong>Gossip:</strong> nodes swap state with random peers, spreading membership and health across thousands of nodes in seconds. It spreads knowledge; it does not make decisions.</li>
</ul>
<p>You almost never implement these. You pick tools that embed them, so learn which engine each tool runs and what that implies.</p>
<h4>How to do it</h4>
<table>
<thead><tr><th>Tool</th><th>Engine</th><th>Used for</th></tr></thead>
<tbody>
<tr><td>etcd, Consul servers</td><td>Raft</td><td>Config, service catalog, leader election, locks</td></tr>
<tr><td>Consul agents</td><td>Gossip (Serf)</td><td>Membership, failure detection</td></tr>
<tr><td>ZooKeeper</td><td>ZAB (Paxos-like)</td><td>Coordination for HBase, older Kafka</td></tr>
<tr><td>Kafka KRaft</td><td>Raft-based quorum</td><td>Cluster metadata (Kafka 4.0 removed ZooKeeper)</td></tr>
<tr><td>Kafka partitions</td><td>Leader + in-sync replicas, not Raft</td><td>The message log</td></tr>
<tr><td>ClickHouse Keeper</td><td>Raft, ZooKeeper-compatible</td><td>Coordinating replicated tables</td></tr>
<tr><td>Cassandra, ScyllaDB, Riak</td><td>Quorums + gossip</td><td>High-volume writes</td></tr>
<tr><td>Spanner (Paxos); CockroachDB, TiDB, YugabyteDB (Raft)</td><td>Consensus per data range</td><td>Distributed SQL</td></tr>
</tbody>
</table>
<ol>
<li><strong>Coordination goes to a consensus service, never bulk data.</strong> Elect leaders with an etcd election, a Consul lock, or a Kubernetes Lease (client-go's leaderelection package in Go). etcd's default size quota is 2 GB.</li>
<li><strong>Match the store to the data.</strong> Money and uniqueness → single-leader or consensus-backed SQL. Append-heavy records (CDRs, events) → Kafka, Cassandra-style stores, ClickHouse.</li>
<li><strong>Reuse proven failover.</strong> Patroni keeps its Postgres leader key in etcd or Consul; do not write your own failover script.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Hand-rolled locks (a Redis key or a DB row with a TTL) are where split brain usually starts. Use a coordination service, plus fencing (see the advanced take).</li>
<li>Consensus fsyncs every commit, so slow disks cause leader flapping. Give etcd fast SSDs.</li>
<li>The coordination cluster is now a dependency. If etcd loses quorum, Kubernetes cannot change anything, though running pods keep running.</li>
<li>Gossip views lag by seconds. Do not make correctness decisions on "node X looks dead".</li>
</ul>
<h4>Example</h4>
<p>A messaging platform: the campaign dispatcher runs 3 replicas, and a Kubernetes Lease picks the one that dispatches. Per-tenant rate limits live in Consul KV and senders watch them. Delivery records, tens of thousands per second, flow through Kafka into ClickHouse, whose replicated tables coordinate through ClickHouse Keeper. Balances stay in Postgres, with Patroni handling failover. Nobody writes Raft code, but everyone knows which component needs a majority alive.</p>`,
    followups: [`Why shouldn't you store message logs in etcd, even though it is strongly consistent?`, `What happens to running workloads if a Kubernetes cluster's etcd loses quorum?`, `When would you pick Cassandra's quorum model over a Raft-based distributed SQL database?`],
    related: ["t10", "t8", "a4"]
  },
  t10: {
    tldr: `Any two majorities share a node, so a new leader can see all committed writes. Raft enforces this with terms and a commit index; leaderless stores approximate it when R + W exceeds N. Fencing tokens stop deposed leaders.`,
    body: `<h4>Core idea</h4>
<p>Everything rests on one fact: <strong>any two majorities of a group share a node.</strong> If every commit reaches a majority and every election needs one, a new leader always meets a node holding every committed entry.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Terms and elections.</strong> Leadership periods are numbered terms. A follower that misses heartbeats for a randomized timeout (etcd defaults: 100 ms heartbeat, 1 s election) becomes a candidate for the next term. Nodes vote once per term, only for a candidate whose log is at least as up to date as theirs. A higher term forces any leader to step down.</li>
<li><strong>Commit index.</strong> A current-term entry is committed once a majority stores it; the commit index advances and nodes apply up to it. A leader cut off from the majority can accept writes but never commit them. Before a linearizable read, it confirms it still leads (ReadIndex) or trusts a clock-bounded lease.</li>
<li><strong>Why 3 or 5.</strong> Majority is floor(N/2) + 1: 3 nodes survive 1 failure, 5 survive 2, and 4 still survive only 1. Bigger groups slow every commit; add non-voting learners for read scale.</li>
<li><strong>Leaderless quorums.</strong> Writes wait for W of N replicas, reads query R, and R + W &gt; N (N=3, W=2, R=2) makes the sets overlap. Hinted handoff replays writes a down replica missed; read repair fixes stale replicas a read touches.</li>
<li><strong>Fencing tokens.</strong> A leader can freeze (GC pause, VM stall) past its lease, be replaced, then wake and keep writing without knowing. Give each lease a token that only grows (Raft term, etcd revision, ZooKeeper zxid), send it with every write, and have storage reject tokens below the highest seen.</li>
<li><strong>Cross-region placement.</strong> A commit waits for the nearest majority. With 5 replicas placed 2-2-1 over three regions, the leader's region gives two votes and the closest other region the third: one short WAN round trip per commit, and any one region can fail. Keep the leader near most writers.</li>
<li><strong>Membership changes.</strong> Switching configurations in one step can create two disjoint majorities, so two leaders. Raft uses joint consensus or one-node-at-a-time changes. Add nodes as non-voting learners (etcd supports this) and promote them once caught up; a lagging voter raises the majority without adding a working vote.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>R + W &gt; N is not linearizable: during an in-flight write one reader can see the new value and a later one the old. A write reported as failed may survive on one replica and spread.</li>
<li>Sloppy quorums (Dynamo, Riak) count stand-in nodes toward W while home replicas are down, so the overlap lapses until handoff finishes. Cassandra does not count hints toward QUORUM.</li>
<li>Read repair only fixes keys that get read. Cold data needs anti-entropy repair, in Cassandra within gc_grace_seconds (10 days by default), or deleted rows can reappear.</li>
<li>A Redis TTL lock has no fencing token: fine for avoiding duplicate work, unsafe for correctness.</li>
</ul>
<h4>Example</h4>
<p>A campaign dispatcher leads via an etcd lease (10 s TTL). Leader A stalls in a 20 s GC pause; B is elected and dispatches. A wakes and sends its batch: thousands of duplicate SMS. The fix: each batch claim carries the claimer's token (the etcd revision of its election key), and the jobs table rejects claims with a lower token than it has stored. Per-message idempotency keys catch the rest.</p>`,
    followups: [`Why can a Raft leader not serve a linearizable read from local state without an extra step?`, `With N=3, W=2, R=2, how can a read still return stale data?`, `How would you replace a failed member of a 3-node etcd cluster without risking quorum?`],
    related: ["t9", "a4", "r5"]
  },
  a1: {
    tldr: `Use request-response when the caller needs the answer to continue. Use events or queues when the work is slow, bursty, or unreliable, when several consumers care, or when a downstream failure must not fail the caller.`,
    body: `<h4>Core idea</h4>
<p>In <strong>request-response</strong> (HTTP, gRPC) the caller waits for an answer. It is simple to reason about and errors come straight back, but both sides must be up at the same moment, and latencies add up along the chain. In <strong>event-driven</strong> designs, a producer records that something happened (or drops a job on a queue) and moves on; consumers react later, at their own pace.</p>
<p>Two async flavors: a <strong>command</strong> on a queue ("send this SMS", one worker does it) and an <strong>event</strong> on a topic ("message delivered", any number of subscribers react).</p>
<h4>How to do it</h4>
<ol>
<li><strong>Does the caller need the result to continue?</strong> Auth, balance checks, price quotes, "is this number available": request-response.</li>
<li><strong>Is the work slow, bursty, or dependent on a flaky third party?</strong> Queue it and return 202 Accepted with an ID. The queue absorbs spikes and retries failures.</li>
<li><strong>Do several independent parts care?</strong> Publish an event. Billing, analytics, webhooks, and fraud checks subscribe without the producer knowing them.</li>
<li><strong>Must a downstream outage not break this path?</strong> Go async, so the producer keeps working while consumers catch up.</li>
<li><strong>The usual answer is a hybrid:</strong> validate and persist synchronously, respond fast, then do the heavy part asynchronously and report the outcome by webhook or a status endpoint.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Sync chains multiply risk: five dependencies at 99.9% each give about 99.5% together, and each one adds to your tail latency.</li>
<li>Events bring eventual consistency, at-least-once delivery (duplicates), ordering questions, schema evolution, and a broker to operate.</li>
<li>Debugging needs correlation IDs and tracing through the broker. Otherwise nobody can tell where a message stopped.</li>
<li>Do not fake RPC over a queue (publish a request, block waiting for a reply event). You get RPC's coupling with worse latency.</li>
<li>Too many choreographed events become a flow nobody can draw. Document who publishes and who consumes each event.</li>
</ul>
<h4>Example</h4>
<p>A send-SMS API. Synchronous part: authenticate, validate the number, check rate limits and balance, store the message as queued, and return 202 with a message ID in tens of milliseconds. Asynchronous part: a queue feeds sender workers that talk to carriers, whose speed and throttling vary. When a delivery receipt arrives, a "message status changed" event fans out to the webhook dispatcher, usage billing, and analytics. If webhook delivery is down, sending and billing continue, and callbacks catch up later.</p>`,
    followups: [`If you return 202 Accepted, how does the client learn the final result?`, `What is the difference between a command on a queue and an event on a topic?`, `How would you trace one request through five services connected only by events?`],
    related: ["c5", "c6", "a5"]
  },
  a2: {
    tldr: `Treat events as a long-lived public contract. Only add optional fields; never rename, remove, or change meaning. Enforce compatibility with a schema registry in CI, and ship breaking changes as a new event version with a migration window.`,
    body: `<h4>Core idea</h4>
<p>Producers and consumers deploy independently, and old events stay in the log for replays. So every schema change must be <strong>backward compatible</strong> (new consumer code reads old events) and <strong>forward compatible</strong> (old consumer code reads new events). Safe changes are additive: new optional fields with defaults. Removing, renaming, retyping, or reusing a field breaks someone, often silently.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Use a standard envelope:</strong> event_id (for dedup), type, schema version, occurred_at, producer, subject ID (also the partition key), per-entity sequence, trace ID, then the data. CloudEvents standardizes this.</li>
<li><strong>Use a schema format with tooling</strong> (Avro, Protobuf, or JSON Schema) and a registry (Confluent Schema Registry, Apicurio, AWS Glue) that rejects incompatible changes in CI or at publish. Confluent's default mode is BACKWARD; the TRANSITIVE modes check every older version, not just the last.</li>
<li><strong>Follow the format's rules.</strong> Protobuf: never reuse a field number; mark removed ones <code>reserved</code>. Avro: new fields need defaults. JSON: consumers ignore unknown fields (Go's encoding/json and Pydantic's default both do).</li>
<li><strong>Put units in names</strong> (amount_micros, duration_ms) and keep times in UTC. A unit change without a name change is a break no registry catches.</li>
<li><strong>For a real break, publish a new version</strong> (a v2 event type or a new topic), dual-publish during migration, move consumers, and retire v1 once the last consumer moves and retention expires.</li>
<li><strong>Publish domain events, not table rows.</strong> Raw CDC of internal tables couples every consumer to your schema. Curate the payload in an outbox.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li><strong>Enums are the trap.</strong> A new value breaks consumers that switch exhaustively or reject unknown values. Every consumer needs an "unknown" branch.</li>
<li>Thin events (IDs only) stay small but force consumers to call back, adding load and a race with newer state. Fat events are self-contained but bigger.</li>
<li>Replays push old events through today's code. Keep old versions readable while they are retained.</li>
<li>Money as floats will bite. Use integer minor units or decimal strings.</li>
</ul>
<h4>Example</h4>
<p>A message status event v1 carries event_id, message_id, account_id, status (queued, sent, delivered, failed, undelivered), and occurred_at. Product wants carrier error codes and a new "read" status for chat channels. An optional error_code is safe. "read" is not: a billing consumer that rejects unknown statuses would stall. So consumers first ship an "unknown status: log and skip" branch, then the producer emits "read" behind a flag. The public customer webhook gets it only through an opt-in or a new API version.</p>`,
    followups: [`Why is adding a new enum value riskier than adding a new field?`, `What is the difference between backward and forward compatibility, and which matters if consumers deploy first?`, `When would you choose thin events that carry only IDs?`],
    related: ["p6", "c9", "t4"]
  },
  a3: {
    tldr: `Exactly-once delivery is not achievable end to end; exactly-once effect is. Use at-least-once delivery (ack after processing) plus idempotent handlers. Kafka transactions give exactly-once only for Kafka-to-Kafka pipelines; external side effects still need idempotency.`,
    body: `<h4>Core idea</h4>
<p>A consumer can crash after doing the work but before acknowledging it, and acks get lost. The sender cannot tell "not processed" from "processed, ack lost", so it either redelivers (duplicates possible) or does not (loss possible). That is the real menu:</p>
<table>
<thead><tr><th>Semantics</th><th>How</th><th>Failure mode</th></tr></thead>
<tbody>
<tr><td>At-most-once</td><td>Ack, then process</td><td>Lost messages</td></tr>
<tr><td>At-least-once</td><td>Process, then ack</td><td>Duplicates</td></tr>
<tr><td>Effectively-once</td><td>At-least-once + idempotent handler</td><td>Dedup storage, key design</td></tr>
<tr><td>Kafka exactly-once</td><td>Idempotent producer + transactions</td><td>Covers Kafka-to-Kafka only</td></tr>
</tbody>
</table>
<p>So "exactly once" in practice means <strong>at-least-once delivery plus processing that makes duplicates harmless.</strong></p>
<h4>How to do it</h4>
<ol>
<li><strong>Ack or commit offsets only after the effect is durable.</strong> Kafka auto-commit plus hand-off to other goroutines or threads can commit offsets for unfinished work, which is lost on a crash. Commit manually.</li>
<li><strong>Make handlers idempotent</strong>, cheapest first: absolute writes (set status, upsert) instead of relative ones (<code>balance = balance - x</code>); state guards (<code>UPDATE ... WHERE id = ? AND status = 'sent'</code>); a natural unique key on the effect (one ledger row per message_id and charge_type); or a dedup (inbox) table keyed by event_id, written in the same transaction as the effect.</li>
<li><strong>Use stable IDs.</strong> Create the event ID once at the source, never per attempt. If the source has none (a carrier callback), derive one, such as a hash of carrier message ID plus status.</li>
<li><strong>Producer retries:</strong> Kafka's idempotent producer (on by default in current clients) drops duplicates from its own retries within a session. It does not stop your app from re-sending after a restart.</li>
<li><strong>Kafka-to-Kafka pipelines:</strong> use transactions (a transactional.id, consumer offsets sent inside the transaction) with downstream consumers on <code>isolation.level=read_committed</code>, or Kafka Streams with <code>exactly_once_v2</code>.</li>
<li><strong>External calls:</strong> pass an idempotency key if the API accepts one. If not, record intent first ("sending") and reconcile unknown outcomes instead of retrying blindly.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>A Redis "seen it?" check followed by a DB write is a race: two workers both see "new". Put the unique constraint where the effect is written.</li>
<li>Keep dedup records longer than the maximum redelivery or replay window. SQS FIFO's built-in dedup covers only 5 minutes.</li>
<li>Kafka transactions add latency, and read_committed consumers wait for open transactions.</li>
<li>Webhooks you send are at-least-once too. Include an event ID and tell customers to dedupe on it.</li>
</ul>
<h4>Example</h4>
<p>A carrier retries a delivery receipt, so "message X delivered" arrives twice. The consumer runs one transaction: insert the derived key into processed_events (a conflict means duplicate: stop), move the message from sent to delivered only if it is still sent, and insert the billing row under a unique (message_id, charge_type). Then it commits the Kafka offset. If it crashes before that commit, the redelivered receipt hits the unique key and changes nothing. The customer's "delivered" webhook may still fire twice, which is why it carries an event ID.</p>`,
    followups: [`Why does the Kafka idempotent producer not prevent duplicates after your service restarts and re-sends?`, `How long should you keep dedup records, and what decides it?`, `How do you make a handler idempotent when the third-party API it calls has no idempotency key?`],
    related: ["c10", "t4", "a6"]
  },
  a4: {
    tldr: `Store jobs durably with a run_at time; stateless schedulers claim due jobs (SKIP LOCKED or time buckets) onto a queue; workers run them at least once with leases, retries, and idempotent handlers. Size for peaks, not averages.`,
    body: `<h4>Core idea</h4>
<p>Millions of jobs a day is less throughput than it sounds: 1M/day is about 12 per second on average, 10M/day about 116. The hard parts are elsewhere: peaks (everyone picks 9:00), never losing a job, not running it twice, recurring schedules across time zones, cancellation, and one tenant flooding the rest. The shape: a durable job store, schedulers that find due jobs, a queue, and workers.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Job table:</strong> job_id, tenant_id, run_at (UTC), status (scheduled, enqueued, running, done, failed, cancelled), attempts, lease_expires_at, payload reference, plus cron expression and IANA time zone for recurring jobs. Add a partial index on run_at where status is scheduled.</li>
<li><strong>Claim due jobs without a single leader:</strong> <code>SELECT ... WHERE status = 'scheduled' AND run_at &lt;= now() ORDER BY run_at LIMIT 500 FOR UPDATE SKIP LOCKED</code>, mark them enqueued, publish via an outbox. Many scheduler instances can run this at once. Use the database clock, not host clocks.</li>
<li><strong>Add a fast tier as volume grows.</strong> Far-future jobs stay in the database; a loader moves the next few minutes of jobs into a Redis sorted set scored by run_at (or time buckets, or an in-memory timing wheel) that dispatchers drain. Past one database, shard jobs by hash and give each scheduler its shards.</li>
<li><strong>Execute with leases.</strong> A worker takes a lease (visibility timeout) and heartbeats to extend it. On failure, back off exponentially; after max attempts, dead-letter. A sweeper re-queues jobs whose lease expired.</li>
<li><strong>At-least-once means idempotent:</strong> key side effects on job_id (plus scheduled time for recurring jobs), and re-check status just before acting, so a cancelled job does not run.</li>
<li><strong>Recurring jobs:</strong> compute only the next occurrence after each run. Decide DST behaviour (2:30 AM may not exist, or may happen twice) and a misfire policy after downtime: catch up once, or skip.</li>
<li><strong>Fairness:</strong> per-tenant concurrency caps or weighted fair queues, jitter for jobs that do not need exact timing, and rate limits toward downstream systems.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Consider buying: Temporal (durable timers and schedules), AWS EventBridge Scheduler, or clustered Quartz. Kubernetes CronJobs suit a handful of heavy jobs, not millions of small ones.</li>
<li>A single leader-elected scheduler without fencing can double-dispatch after a pause.</li>
<li>Finished jobs bloat the table and slow the due-job query. Partition by day and drop old partitions.</li>
<li>Track start lag (actual start minus run_at) as the SLO, for example p99 under 5 s.</li>
</ul>
<h4>Example</h4>
<p>Customers schedule SMS with a send_at time: 5M a day, many at 9:00 local time. A campaign is one job that fans out at run time into batches of 1,000 recipients, not a million rows. Single scheduled messages sit in a day-partitioned table; a loader moves the next five minutes into Redis buckets per shard, and dispatchers push due items onto a Kafka topic keyed by account. Senders enforce per-account and per-carrier throughput, dedupe on job_id, and re-check for cancellation before sending. An alert fires if p99 start lag passes 30 s.</p>`,
    followups: [`How do you make sure a job does not run twice if a worker stalls past its lease?`, `A customer cancels a job one second before its run time. What guarantees can you give?`, `How do you stop one tenant's 2 million jobs at 9:00 from delaying everyone else?`],
    related: ["a8", "a6", "t10"]
  },
  a5: {
    tldr: `Return 202 with a job ID, keep a job record with a strict state machine and progress counters, and let clients poll (with Retry-After), get a webhook, or stream updates. The job record is the truth; notifications are hints.`,
    body: `<h4>Core idea</h4>
<p>Work that outlasts an HTTP timeout should use the <strong>async request-reply</strong> pattern: accept the request, return <strong>202 Accepted</strong> with a job ID and a status URL, and do the work in the background. A durable job record with an explicit state machine is the source of truth. Polling, webhooks, and live streams are only ways of telling the client what that record says.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Create:</strong> validate, insert the job (PENDING), enqueue the work through an outbox, return 202. Accept an Idempotency-Key so a client retry does not start a second job.</li>
<li><strong>State machine:</strong> PENDING → RUNNING → SUCCEEDED, FAILED, or CANCELLED (plus PARTIAL if some items fail). Allow only legal moves, with conditional updates such as <code>UPDATE jobs SET status = 'RUNNING' WHERE id = ? AND status = 'PENDING'</code>. Terminal states never change.</li>
<li><strong>Progress:</strong> keep total, succeeded, and failed counts, updated per chunk or every few seconds, not per item.</li>
<li><strong>Liveness:</strong> workers write heartbeat_at; a sweeper retries or fails jobs with stale heartbeats, so nothing sits in RUNNING forever.</li>
<li><strong>Tell the client:</strong> polling on <code>GET /jobs/{id}</code> with Retry-After to pace clients and ETags for cheap "no change" replies; a signed, retried completion webhook with an event ID; SSE or WebSocket for live progress bars, with polling as the fallback.</li>
<li><strong>Results:</strong> large outputs go to object storage behind a pre-signed, expiring URL.</li>
<li><strong>Cancel:</strong> set CANCEL_REQUESTED; workers check between chunks, and the job ends CANCELLED with partial results.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Updating one progress row per item makes it a lock hotspot. Batch updates, or keep counts on chunk rows and sum them on read.</li>
<li>Polling at scale is mostly "no change" traffic. Push is cheaper per update but needs connection handling, and clients still need polling to recover missed events.</li>
<li>A worker can crash after the work but before the status update. Make the work idempotent so the retry is harmless.</li>
<li>Check account ownership on every status read, and use unguessable job IDs.</li>
</ul>
<h4>Example</h4>
<p>A 500k-recipient SMS campaign. <code>POST /campaigns</code> returns 202 with a campaign ID. Workers send in chunks of 1,000 and bump counters once per chunk: 500 updates instead of 500,000. Sending ends in minutes, but delivery receipts trickle in for hours, so "done" has two stages: "sending complete" and "delivery stats final". A receipt aggregator refreshes delivered and failed counts every 10 s. The console streams progress over SSE, API users poll or get a campaign.completed webhook, and per-recipient results download as a CSV from a pre-signed URL.</p>`,
    followups: [`How would you avoid lock contention when many workers update one job's progress?`, `How does a client recover if it missed the completion webhook?`, `How do you detect and handle a job stuck in RUNNING because its worker died?`],
    related: ["a1", "a8", "c10"]
  },
  a6: {
    tldr: `Retry only transient failures, with capped exponential backoff and jitter; send permanent failures and exhausted retries to a dead-letter queue with full context. Alert on DLQ depth, fix the cause, then redrive at a controlled rate through idempotent handlers.`,
    body: `<h4>Core idea</h4>
<p>Failures come in two kinds. <strong>Transient</strong> ones (timeouts, 429, 503, connection resets) often succeed on retry. <strong>Permanent</strong> ones (validation errors, unknown account, undecodable payload, a code bug) fail every time, so retrying only burns capacity and delays other messages. A <strong>dead-letter queue (DLQ)</strong> quarantines messages that fail permanently or run out of retries: they leave the main flow, nothing is lost, and someone can inspect, fix, and redrive them.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Classify errors in code</strong> (typed or wrapped errors): retryable or not. Unknown errors count as retryable, with a cap.</li>
<li><strong>Back off with jitter:</strong> wait a random time between 0 and min(cap, base x 2^attempt), for example base 1 s, cap 5 min, 6-8 attempts. Honour Retry-After.</li>
<li><strong>Delay at the broker, not in a sleeping worker.</strong> SQS: change the message's visibility timeout (up to 12 h). RabbitMQ: a retry queue with a TTL that dead-letters back to the main queue. Kafka has no per-message delay and a stuck record blocks its partition, so use tiered retry topics (retry-1m, retry-10m), then a DLQ topic.</li>
<li><strong>Configure the DLQ:</strong> an SQS redrive policy with maxReceiveCount (for example 5). Give the DLQ longer retention than the source; for standard SQS queues the original enqueue time carries over, so a short-retention DLQ can expire messages on arrival.</li>
<li><strong>Store context with each dead letter:</strong> source queue or topic, partition and offset, error, attempt count, first and last failure time, consumer version.</li>
<li><strong>Operate it:</strong> alert on DLQ depth and inflow, name an owner, and redrive at a controlled rate after the fix (SQS can redrive a DLQ back to its source queue).</li>
<li><strong>During outages, pause instead of dead-lettering.</strong> If most messages fail, the dependency is down: trip a circuit breaker and stop consuming.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>A visibility timeout shorter than processing time causes duplicate processing and inflated receive counts, pushing healthy messages into the DLQ.</li>
<li>Moving one message aside breaks per-key order: later messages for that key overtake it.</li>
<li>Some messages expire in meaning. A one-time password redriven an hour later is useless; a campaign sent days late at 3 AM is harmful. Check validity before redrive.</li>
<li>A DLQ nobody watches is data loss with extra steps.</li>
</ul>
<h4>Example</h4>
<p>Status webhooks to customer servers. A 5xx or timeout is retried at roughly 1 min, 5 min, 30 min, 2 h, and 6 h, with jitter; a 429 honours Retry-After; most other 4xx responses stop early. After the last attempt the event lands in a per-customer dead-letter store, shown in the console as failed webhooks with a resend button. If one customer's endpoint is down entirely, a per-customer circuit breaker parks their deliveries so their backlog does not starve other customers.</p>`,
    followups: [`How do you choose maxReceiveCount and backoff settings for a given queue?`, `What goes wrong if the visibility timeout is shorter than processing time?`, `How would you safely redrive 200,000 messages after fixing a bug?`],
    related: ["r3", "a7", "r4"]
  },
  a7: {
    tldr: `Bound attempts per message (broker receive count or a durable counter), then quarantine it to a DLQ or parking topic and move on. Catch panics, never retry undecodable payloads, and decide per stream whether to skip or block the key.`,
    body: `<h4>Core idea</h4>
<p>A <strong>poison message</strong> fails every time: a malformed payload, an unexpected schema, an edge case that hits a bug, or input that crashes the process. Unbounded redelivery turns it into a loop. In SQS or RabbitMQ it cycles forever, eating capacity. In Kafka it is worse: offsets commit in order, so one stuck record blocks its whole partition and lag grows for every key behind it. The cure: <strong>count attempts, quarantine, keep going, alert.</strong></p>
<h4>How to do it</h4>
<ol>
<li><strong>Bound attempts.</strong> SQS: maxReceiveCount moves the message to a DLQ. RabbitMQ: quorum queues have a delivery limit, then dead-letter. Kafka: no broker-side count, so the consumer tracks attempts, publishes the record to a DLQ topic after N failures, and commits the offset.</li>
<li><strong>Survive crash loops.</strong> If the message panics the worker, in-memory counters reset on every restart. Recover panics per message (Go: <code>recover()</code> in a handler wrapper; Python: catch per message) and turn them into errors. For hard crashes such as OOM kills, persist the attempt count (Redis or DB, keyed by message ID) before processing. SQS receive counts survive crashes by themselves.</li>
<li><strong>Fail fast on bad input.</strong> Deserialization and schema errors are permanent: dead-letter immediately, zero retries. Validate against a schema registry at produce time to stop poison at the source.</li>
<li><strong>Tell poison from outage.</strong> Poison is one message failing while others succeed. If most messages fail, a dependency is down: pause consumption with a circuit breaker instead of dead-lettering everything.</li>
<li><strong>Decide skip or block per stream.</strong> Skipping is fine when later events do not depend on this one. When per-key order matters (ledger entries), park the key: send this message and every later one for the same key to a parking topic until it is fixed, while other keys keep flowing.</li>
<li><strong>Quarantine with context:</strong> the raw bytes (not a parsed object), error, stack trace, consumer version, attempts, source partition and offset. Fix the code, then redrive through idempotent handlers.</li>
<li><strong>Cap cost per message:</strong> a maximum payload size and a per-message deadline (Go <code>context.WithTimeout</code>), so one huge or slow message cannot hold a worker forever.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>A low retry limit dead-letters transient failures; a high one blocks a Kafka partition longer. Keep in-line retries short, then hand off to retry topics.</li>
<li>Skipping breaks order; blocking breaks availability. Per-key parking is the middle, but the blocked-key set must survive restarts and rebalances.</li>
<li>An unwatched DLQ is silent data loss.</li>
</ul>
<h4>Example</h4>
<p>A Kafka topic of delivery receipts, keyed by message ID, feeds status updates and billing. A carrier starts sending a status code the parser does not know, and a nil field panics the consumer. Unprotected, it crash-loops while one partition's lag climbs. Protected, the wrapper recovers the panic, the parse error is classed as permanent, and the raw record goes to a DLQ topic with partition, offset, and error headers. The offset is committed and the partition flows again. Skipping is safe here because statuses only move forward and a nightly reconciliation catches messages stuck in "sent". The DLQ alert fires, the parser is fixed, and the DLQ is redriven.</p>`,
    followups: [`How do you count attempts for a message that crashes the process before it can record the failure?`, `In Kafka, what are your options when a poison message sits at the head of a partition whose order matters?`, `How can a consumer tell a poison message from a downstream outage automatically?`],
    related: ["a6", "a9", "t6"]
  },
  a8: {
    tldr: `Persist a parent job and N chunk records, fan chunks out through a queue or workflow engine, write chunk results idempotently, count completions atomically so exactly one worker triggers the fan-in, and cap concurrency to protect downstream systems.`,
    body: `<h4>Core idea</h4>
<p>Fan-out splits a big job into independent chunks processed in parallel; fan-in waits for all of them and combines the results. The parallel part is easy. The hard parts: knowing reliably when every chunk is done despite retries and redelivery, handling chunks that fail or crawl, merging idempotently, and not flattening shared dependencies with sudden parallelism.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Persist before fanning out.</strong> The coordinator writes a parent row (total N, completed 0, RUNNING) and N chunk rows, and publishes chunk messages through an outbox, so a crash cannot lose chunks.</li>
<li><strong>Size chunks:</strong> seconds to a few minutes of work each, and several times more chunks than workers so load evens out. Tiny chunks drown in overhead; huge ones make retries expensive.</li>
<li><strong>Distribute</strong> through a queue and worker pool, or a workflow engine that tracks children for you (Temporal child workflows, Step Functions Map state). For data-parallel compute, use Spark, Beam, or Ray.</li>
<li><strong>Write results idempotently</strong> to a deterministic place (an object key or rows keyed by chunk_id), so a retry overwrites instead of duplicating.</li>
<li><strong>Count completions atomically.</strong> In one transaction, flip the chunk to DONE only if it was not DONE, and increment parent.completed only if that flip happened. Then exactly one worker wins <code>UPDATE parent SET status = 'MERGING' WHERE id = ? AND status = 'RUNNING' AND completed = total</code> and starts the merge. Redelivered chunks change nothing.</li>
<li><strong>Merge with associative operations</strong> (sums, counts, per-chunk top-K then a final top-K, HyperLogLog sketches) so order does not matter. For very large N, merge in a tree.</li>
<li><strong>Handle failures and stragglers:</strong> per-chunk retries with backoff, then FAILED; decide up front whether one failure fails the job or it finishes with partial results and a failure report. A sweeper times out silent chunks. Speculative execution (run a copy of a slow chunk, keep the first result) is safe only because outputs are idempotent.</li>
<li><strong>Apply backpressure:</strong> cap in-flight chunks per job and per tenant, and respect downstream limits (database write capacity, carrier throughput).</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>One parent counter hit by 100k chunks is a hot row. Use sharded counters, or count chunk rows periodically.</li>
<li>A coordinator holding all results in memory falls over. Stream results to storage and merge from there.</li>
<li>Non-idempotent chunk side effects (sending SMS) plus retries means duplicates. Use per-item idempotency keys.</li>
<li>"The last worker triggers the merge" without an atomic check fires twice or never.</li>
</ul>
<h4>Numbers to know</h4>
<p>If each of 100 chunks has a 1% chance of being slow, the chance that at least one is slow is 1 - 0.99^100, about 63%. Fan-in latency follows the slowest chunk, not the average.</p>
<h4>Example</h4>
<p>Monthly invoices for 200,000 accounts. The coordinator creates 2,000 chunks of 100 accounts. Each worker reads usage (SMS segments, voice minutes by destination) from the analytics store, applies rate plans, and upserts invoice drafts keyed by account and month. Chunk completion and the parent counter update in one transaction. When completed reaches 2,000, one worker moves the parent to MERGING, totals are reconciled against the ledger, and an InvoicesReady event goes out. At most 50 chunks run at once to protect the analytics cluster.</p>`,
    followups: [`How do you make sure the merge step runs exactly once when chunk completions are redelivered?`, `What would you do about one chunk that takes ten times longer than the rest?`, `How do you keep a large fan-out from overloading a shared database or a third-party API?`],
    related: ["a4", "a5", "c7"]
  },
  a9: {
    tldr: `Order is only guaranteed per partition or message group, never globally. Pick the smallest entity that needs order, use it as the partition key, process each key sequentially, and guard consumers with per-entity versions, because sources and retries reorder.`,
    body: `<h4>Core idea</h4>
<p>Brokers order messages only within a lane: a Kafka partition, an SQS FIFO message group, a RabbitMQ queue with a single consumer. There is no cheap global order; one partition for everything means one consumer and no scaling. So decide <strong>which entity's events must be ordered</strong> (one message, one call, one account), make it the key, and process each key's events one at a time. Then accept that events can still be born out of order (carrier callbacks, retries, clock skew) and make consumers defend themselves.</p>
<h4>How to do it</h4>
<ol>
<li><strong>Choose the smallest ordering scope.</strong> Per message or per call usually beats per account: finer keys spread load and avoid hot partitions.</li>
<li><strong>Producer:</strong> key by that entity so it always lands on the same partition. Keep Kafka's idempotent producer on; it preserves order across retries with up to 5 in-flight requests. Have one writer per entity, for example through that service's outbox.</li>
<li><strong>Consumer:</strong> process a partition sequentially. To parallelize inside it, shard by key onto sub-workers, never round-robin (Confluent's Parallel Consumer has a key-ordered mode). With SQS FIFO, use the entity as MessageGroupId; the group's next message waits until the current one is deleted.</li>
<li><strong>Defend against disorder:</strong> per-entity sequence numbers from the single writer (ignore anything at or below the last applied; on a gap, buffer briefly or re-read the source); state machines that only move forward (queued → sent → delivered or failed); commutative updates such as counters where possible. Never order by timestamps from different machines.</li>
<li><strong>Keep order through failures.</strong> Moving a failed message to a retry topic or DLQ lets later messages for its key overtake it. Where order is strict, park the whole key instead.</li>
<li><strong>Plan the partition count.</strong> Adding Kafka partitions changes which partition a key maps to, so a key's old and new events can briefly sit in different lanes. Start with enough, or drain before resizing.</li>
</ol>
<h4>Trade-offs and pitfalls</h4>
<ul>
<li>Order costs parallelism: throughput is capped by partition count, and one hot key by a single consumer.</li>
<li>Head-of-line blocking: one slow message delays everything behind it in its lane.</li>
<li>A rebalance hands a partition to a new consumer that reprocesses uncommitted messages. Idempotent, version-checked handlers make that harmless.</li>
<li>Keys give per-entity order, not cross-entity (causal) order. "Account created" and "message sent" may sit on different partitions, so check preconditions and retry later.</li>
</ul>
<h4>Example</h4>
<p>A carrier sends "delivered" for a message at 10:00:01 and a delayed "accepted" at 10:00:03. Applying arrival order would leave the message stuck in "sent" and fire a webhook that goes backwards. Instead, receipts are keyed by message ID and applied with a rank check: <code>UPDATE messages SET status = ?, status_rank = ? WHERE id = ? AND status_rank &lt; ?</code>. Terminal states are final. Customer webhooks carry a per-message sequence number so customers can drop stale ones, since webhook retries can reorder deliveries too.</p>`,
    followups: [`What can break ordering during a Kafka consumer group rebalance, and how do you protect against it?`, `How would you handle ordering for one very hot key that one partition cannot keep up with?`, `Why are timestamps a poor tool for ordering events produced on different machines?`],
    related: ["t4", "a7", "d5"]
  },
});
