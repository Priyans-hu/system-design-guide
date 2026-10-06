window.HUB_DEEP = window.HUB_DEEP || [];
window.HUB_DEEP.push(
  {
    id: `two-phase-commit`,
    title: `Two-phase commit (2PC)`,
    family: `Distributed correctness`,
    summary: `A coordinator asks every participant to prepare (make its changes durable, keep its locks, vote), then tells all of them to commit only if every vote was yes. All or nothing across databases.`,
    problem: `Placing an order must insert a row in the Orders DB and a charge in the Payments DB, and either both commit or neither does. Each database can only make its own transaction atomic, so a crash between the two commits leaves one written and the other not. 2PC adds a coordinator and a durable "prepared" state so every participant reaches the same decision.`,
    how: [
      `The service does its writes in each database inside open local transactions, then asks the coordinator to commit.`,
      `Phase 1, prepare: the coordinator sends <strong>prepare</strong> to every participant. Each one checks it can commit, writes its changes and a prepared record to durable storage, keeps its locks, and votes yes or no. In PostgreSQL this is <code>PREPARE TRANSACTION 'order-42'</code>.`,
      `A participant that voted yes has given up the right to abort on its own. From here it must wait for the decision, even across a restart.`,
      `The coordinator decides: commit only if every vote is yes; any no, or a missing vote after a timeout, means abort. It force-writes the decision to its own log <em>before</em> telling anyone.`,
      `Phase 2, commit or abort: the coordinator sends the decision to every participant (<code>COMMIT PREPARED</code> or <code>ROLLBACK PREPARED</code>). Each applies it, releases its locks and acknowledges.`,
      `Recovery: a restarted coordinator reads its log and resends the decision. A restarted participant still holds its prepared transactions (PostgreSQL lists them in <code>pg_prepared_xacts</code>) and waits for, or asks for, the outcome.`
    ],
    diagram: {
      layers: [
        { name: `Client`, items: [[`Checkout service`, `wrote in both DBs, asks to commit`]] },
        { name: `Coordinator`, items: [[`Transaction coordinator`, `collects votes, decides`]] },
        { name: `Durable state`, items: [[`Orders DB`, `prepared: on disk, locks held`], [`Payments DB`, `prepared: on disk, locks held`], [`Coordinator log`, `the commit or abort decision`]] }
      ],
      edges: [
        [`Checkout service`, `Transaction coordinator`, `sync`, `commit T1`],
        [`Transaction coordinator`, `Orders DB`, `sync`, `1. prepare and vote, 3. commit`],
        [`Transaction coordinator`, `Payments DB`, `sync`, `1. prepare and vote, 3. commit`],
        [`Transaction coordinator`, `Coordinator log`, `data`, `2. force-write decision`]
      ],
      paths: [
        { name: `Happy path`, nodes: [`Checkout service`, `Transaction coordinator`, `Payments DB`], note: `Both databases vote yes, the coordinator logs commit, then tells each one to commit and release its locks.` },
        { name: `Coordinator crash`, nodes: [`Coordinator log`, `Transaction coordinator`, `Orders DB`], note: `If the coordinator dies after the votes, Orders DB stays prepared with its locks held until the coordinator restarts, reads its log and finishes.` }
      ]
    },
    variants: [
      [`XA (X/Open DTP)`, `The standard contract between a transaction manager and resource managers. MySQL InnoDB implements XA; PostgreSQL provides the prepare step (<code>PREPARE TRANSACTION</code>) for an external manager to drive. Fits when every participant is a database that supports it.`],
      [`2PC over replicated participants`, `Each participant is a Paxos or Raft group, so prepared state and the decision survive a node loss. Spanner runs 2PC between Paxos groups only when a transaction spans groups; Gray and Lamport's Paxos Commit uses 2F+1 coordinators and makes progress while F+1 are up.`],
      [`Non-blocking "three-phase" commit`, `Protocols that try to pick a new coordinator when the first one fails. Rare in practice: Gray and Lamport knew of none proven correct against a clearly stated condition.`],
      [`Kafka transactions`, `The same prepare-then-commit shape inside one system: the transaction coordinator logs PREPARE_COMMIT, writes commit markers to each partition, then logs COMMITTED. It covers Kafka writes and consumer offsets, not your database.`]
    ],
    alternatives: [
      [`saga`, `Saga`, `Each service owns its database and you can accept visible intermediate states. Every step commits locally and a failure runs compensating steps. The usual choice across microservices.`],
      [`tcc`, `Try-Confirm/Cancel`, `You need all-or-nothing on business resources (a phone number, a fund hold) across services but cannot hold database locks between them. Expiring reservations replace locks.`],
      [`outbox-inbox`, `Transactional outbox`, `The second "participant" is really a message to publish. Write the event in the same local transaction and relay it later instead of enlisting the broker.`],
      [``, `One database`, `Both tables can live in one database or shard. A local transaction is simpler, faster and never waits on a coordinator.`]
    ],
    pitfalls: [
      `<strong>Blocking.</strong> If the coordinator dies after the votes, prepared participants cannot decide alone. They keep rows locked until it recovers, and every request that touches those rows waits.`,
      `<strong>Orphaned prepared transactions.</strong> In PostgreSQL a forgotten prepared transaction keeps its locks, stops VACUUM from reclaiming space and, in extreme cases, can force a shutdown to prevent transaction ID wraparound. The feature is off by default (<code>max_prepared_transactions = 0</code>); if you enable it, alert on old rows in <code>pg_prepared_xacts</code>.`,
      `<strong>Manual fixes that break atomicity.</strong> Running <code>ROLLBACK PREPARED</code> on one database without checking the coordinator's log can leave the other side committed. Resolve in-doubt transactions from the logged decision only.`,
      `<strong>Latency and availability multiply.</strong> Every commit waits for the slowest participant, extra message rounds and forced log writes, with locks held the whole time. One slow or down participant stalls or aborts every transaction that includes it.`,
      `<strong>Not every system can join.</strong> You usually cannot enlist a message broker and a database in one distributed transaction, so "save the order and publish the event" is rarely solvable with 2PC.`
    ],
    use: `Use it when a few databases you operate, close together on the network, must commit atomically, all support prepared transactions, and short lock holds are fine. It also runs inside databases such as Spanner, where running it over Paxos-replicated groups mitigates the availability problem.`,
    avoid: `Avoid it across independently deployed services, third-party APIs or high-volume hot paths. Use a saga or TCC for business workflows, and the transactional outbox when the second write is just an event.`,
    interview: [
      `The coordinator crashes after every participant voted yes but before sending commit. Who is stuck, holding what, and for how long?`,
      `Why may a participant abort freely before it prepares, but not after?`,
      `How does running 2PC over Paxos groups (as Spanner does) reduce blocking, and what does it cost?`,
      `Why is 2PC usually the wrong tool for "save the order and publish OrderPlaced to Kafka"?`
    ],
    related: [`t3`, `p4`],
    sources: [
      { t: `Consensus on Transaction Commit`, by: `Jim Gray and Leslie Lamport, ACM TODS (2006)`, url: `https://www.microsoft.com/en-us/research/wp-content/uploads/2004/01/consensus-on-transaction-commit.pdf` },
      { t: `PREPARE TRANSACTION`, by: `PostgreSQL documentation`, url: `https://www.postgresql.org/docs/current/sql-prepare-transaction.html` },
      { t: `XA Transactions`, by: `MySQL 8.4 Reference Manual`, url: `https://dev.mysql.com/doc/refman/8.4/en/xa.html` },
      { t: `Spanner: Google's Globally-Distributed Database`, by: `Corbett et al., OSDI 2012`, url: `https://static.googleusercontent.com/media/research.google.com/en//archive/spanner-osdi2012.pdf` }
    ]
  },
  {
    id: `tcc`,
    title: `Try-Confirm/Cancel (TCC)`,
    family: `Distributed correctness`,
    summary: `A business-level two-phase protocol. Each service first reserves what it needs (Try), then an orchestrator confirms every reservation or cancels them all. Reservations should expire on their own, so nothing is held forever.`,
    problem: `Buying a phone number touches two services: inventory must hand over the number and the wallet must take the money. If one succeeds and the other fails you either give the number away or charge for nothing, and you cannot hold database locks across two services while you wait. TCC gets all-or-nothing by making each step a reservation that is later confirmed or cancelled.`,
    how: [
      `The orchestrator creates a global transaction id (tx-42) and records it, with its branches and a deadline, in its own log.`,
      `Try: it calls each participant. Inventory marks the number RESERVED for tx-42 with an expiry; the wallet places a hold for the price. Nothing is final yet, and no database locks are held between calls.`,
      `If every Try succeeds, the orchestrator logs "confirm" and calls Confirm on each participant: assign the number, capture the hold.`,
      `If any Try fails or times out, it logs "cancel" and calls Cancel on every participant that might have reserved something (a timed-out Try may still have succeeded): release the number, release the hold.`,
      `Confirm and Cancel are retried until they succeed, so each must be idempotent: a second Confirm for tx-42 returns success and changes nothing.`,
      `If the orchestrator disappears, each participant cancels its own reservation when it expires, and a recovery job finishes transactions that were logged but not completed.`
    ],
    diagram: {
      layers: [
        { name: `Client`, items: [[`Buyer app`, `buys a phone number`]] },
        { name: `Orchestrator`, items: [[`Purchase service`, `runs Try, then Confirm or Cancel`]] },
        { name: `Participants and log`, items: [[`Number inventory`, `reserves the number with an expiry`], [`Wallet`, `holds the price`], [`TCC log`, `tx id, branches, decision`]] },
        { name: `Participant data`, items: [[`Numbers DB`, `RESERVED row keyed by tx id`], [`Wallet DB`, `hold row keyed by tx id`]] }
      ],
      edges: [
        [`Buyer app`, `Purchase service`, `sync`, `buy number`],
        [`Purchase service`, `TCC log`, `data`, `record tx, then decision`],
        [`Purchase service`, `Number inventory`, `sync`, `1. try, 2. confirm or cancel`],
        [`Purchase service`, `Wallet`, `sync`, `1. try, 2. confirm or cancel`],
        [`Number inventory`, `Numbers DB`, `data`, `reserve, then assign or release`],
        [`Wallet`, `Wallet DB`, `data`, `hold, then capture or release`]
      ],
      paths: [
        { name: `Happy path`, nodes: [`Buyer app`, `Purchase service`, `Wallet`, `Wallet DB`], note: `Both Trys succeed, confirm is logged, and Confirm turns the hold into a charge and the reservation into an assignment.` },
        { name: `Cancel path`, nodes: [`TCC log`, `Purchase service`, `Number inventory`, `Numbers DB`], note: `The wallet Try fails for low balance, cancel is logged and the number is released; if that call is lost, the reservation expires anyway.` }
      ]
    },
    variants: [
      [`Expiring reservations (Atomikos style)`, `Participants cancel on their own when a reservation times out, so the coordinator mainly has to confirm. A Confirm that arrives too late gets an error (404 in the paper), and the orchestrator can refuse to confirm when a reservation is close to expiry.`],
      [`Framework-managed TCC (Apache Seata)`, `A coordinator drives the phases, and each participant writes a fence row in the same local transaction as its business change. The fence makes Confirm and Cancel idempotent, skips a Cancel that has nothing to undo, and blocks a Try that arrives after Cancel.`],
      [`Card authorize and capture`, `Payments already work this way: authorize places a hold (Try), capture takes the money (Confirm), cancel releases it (Cancel). Stripe says an online card authorization is usually valid for 7 days; after that the funds are released.`]
    ],
    alternatives: [
      [`saga`, `Saga`, `A step cannot be reserved, such as sending an SMS, or you can live with visible intermediate states. Commit each step and compensate on failure.`],
      [`two-phase-commit`, `Two-phase commit`, `All participants are databases you operate that support prepared transactions, and short lock holds are acceptable.`],
      [`idempotency-keys`, `Idempotent retries until done`, `No step can be refused for a business reason, only fail transiently. Then retrying each idempotent step until it succeeds is enough; TCC is for steps that can say no.`],
      [``, `One database`, `Inventory and wallet can share a database. A local transaction with row locks is far simpler.`]
    ],
    pitfalls: [
      `<strong>Empty cancel.</strong> Try timed out on the orchestrator's side and never reached the wallet, yet Cancel arrives. The participant must record "cancelled, nothing held" instead of failing or refunding money it never took.`,
      `<strong>Hanging reservation.</strong> A delayed Try lands after Cancel already ran, reserves the number, and nobody will cancel it again. Keep a cancelled marker per tx id so a late Try is rejected (Seata uses a primary key conflict on its fence table).`,
      `<strong>Non-idempotent Confirm or Cancel.</strong> The orchestrator retries until it hears back, so a Confirm that captures twice or a Cancel that releases twice corrupts balances. Key every branch by tx id and check its state first, in the same local transaction.`,
      `<strong>Expiry races.</strong> If a reservation expires just before Confirm arrives, one participant has cancelled while others confirmed. The paper calls this a heuristic outcome that needs human reconciliation; keep deadlines generous and do not start Confirm when one is close.`,
      `<strong>Reservations are visible.</strong> TCC gives atomicity, not isolation. A hold lowers the available balance and a reserved number vanishes from search, so product and support must understand pending states.`
    ],
    use: `Use it when each step can be a cheap, expiring reservation (phone numbers, seats, stock, fund holds), the flow is short, and you need all-or-nothing across services without distributed locks.`,
    avoid: `Avoid it when a step cannot be reserved before it happens (sending an SMS, a third-party call with no hold API) or the flow runs for hours or days. Use a saga with compensations there, or a local transaction if the data can live together.`,
    interview: [
      `How is TCC different from a saga with compensations? When would you pick each?`,
      `Cancel reaches a participant that never saw Try. What should it do, and what happens when the delayed Try shows up later?`,
      `The orchestrator dies for good. Who releases the reservations, and how do you choose the timeout?`,
      `Map card authorize, capture and cancel onto Try, Confirm and Cancel. Where does the analogy break?`
    ],
    related: [`t3`, `p4`],
    sources: [
      { t: `Atomic Distributed Transactions: a RESTful Design`, by: `Guy Pardon and Cesare Pautasso, WWW 2014 Companion`, url: `http://www.pautasso.org/biblio-pdf/tcc-wsrest2014.pdf` },
      { t: `Alibaba Seata Resolves Idempotence, Dangling, and Empty Rollback Issues in TCC Mode`, by: `Apache Seata blog (2022)`, url: `https://seata.apache.org/blog/seata-tcc-fence/` },
      { t: `Place a hold on a payment method`, by: `Stripe documentation`, url: `https://docs.stripe.com/payments/place-a-hold-on-a-payment-method` },
      { t: `Life beyond Distributed Transactions: an Apostate's Opinion`, by: `Pat Helland, CIDR 2007`, url: `https://www.cidrdb.org/cidr2007/papers/cidr07p15.pdf` }
    ]
  },
  {
    id: `outbox-inbox`,
    title: `Transactional outbox and inbox`,
    family: `Distributed correctness`,
    summary: `Write the event into an outbox table in the same transaction as the business change, and let a relay publish it. Consumers record processed message ids (the inbox) so redeliveries do nothing.`,
    problem: `The order service must save the order and publish OrderPlaced, but a database and a broker cannot share one transaction. Commit then publish, and a crash in between loses the event; publish then commit, and consumers act on an order that was rolled back. The outbox makes the event part of the local transaction, and the inbox protects consumers from the duplicates an at-least-once relay produces.`,
    how: [
      `In one local transaction, insert the order row and an outbox row: event id (UUID), aggregate id (the order id), type and payload. Both commit or neither does.`,
      `A relay picks up new outbox rows, either by polling for unsent rows or by tailing the database log (Debezium reads the Postgres WAL).`,
      `It publishes each event keyed by aggregate id, so all events for one order land in one partition and stay in order.`,
      `After the broker acknowledges, the relay marks the row sent or deletes it. A crash between publish and mark sends the event again, so delivery is at least once.`,
      `The consumer, in one local transaction, inserts the event id into its inbox table (primary key on consumer and event id) and applies the change. A duplicate fails the insert, so it rolls back and acknowledges the message.`,
      `A cleanup job deletes old outbox and inbox rows, keeping inbox ids longer than any redelivery or replay window.`
    ],
    diagram: {
      layers: [
        { name: `Order service`, items: [[`Order API`, `handles place-order`]] },
        { name: `Order database`, items: [[`orders table`, `the business row`], [`outbox table`, `the event row, same transaction`]] },
        { name: `Relay`, items: [[`Outbox relay`, `polls unsent rows or tails the WAL`]] },
        { name: `Broker`, items: [[`Kafka topic`, `keyed by order id`]] },
        { name: `Consumer`, items: [[`Billing service`, `creates the invoice`]] },
        { name: `Consumer database`, items: [[`Billing DB`, `inbox ids and invoices`]] }
      ],
      edges: [
        [`Order API`, `orders table`, `data`, `1. insert order`],
        [`Order API`, `outbox table`, `data`, `1. insert event, same tx`],
        [`outbox table`, `Outbox relay`, `data`, `2. read new rows`],
        [`Outbox relay`, `Kafka topic`, `async`, `3. publish, then mark sent`],
        [`Kafka topic`, `Billing service`, `async`, `4. deliver, maybe twice`],
        [`Billing service`, `Billing DB`, `data`, `5. inbox insert + invoice, one tx`]
      ],
      paths: [
        { name: `Happy path`, nodes: [`Order API`, `outbox table`, `Outbox relay`, `Kafka topic`, `Billing service`, `Billing DB`], note: `The event commits with the order, is published at least once, and its effect is applied once because of the inbox.` },
        { name: `Relay crash`, nodes: [`Outbox relay`, `Kafka topic`, `Billing service`, `Billing DB`], note: `The relay publishes, dies before marking the row, and publishes again on restart; the second copy hits the inbox key and is dropped.` }
      ]
    },
    variants: [
      [`Polling publisher`, `The relay queries <code>WHERE sent_at IS NULL ORDER BY id LIMIT 100</code> on a short timer. Works with any SQL database; ordering gets tricky with several relays, and polling adds load and delay.`],
      [`Log tailing`, `A CDC connector such as Debezium reads outbox inserts from the WAL or binlog and routes them by aggregate type. Rows can be deleted right after insert and there is no polling load, but it needs database-specific tooling and can still duplicate after a crash.`],
      [`Inbox key on the business row`, `Instead of a separate inbox table, store the message id on the row the consumer creates, for example a unique <code>source_event_id</code> on invoices. Same guarantee, one less table.`]
    ],
    alternatives: [
      [`change-data-capture`, `CDC on the business tables`, `Consumers only need row changes (search index, cache, warehouse) and can live with your table layout. No outbox writes in app code.`],
      [`event-sourcing`, `Event sourcing`, `Events are already the source of truth. Appending to the event store is the single write, so there is no dual write to fix.`],
      [`two-phase-commit`, `Two-phase commit`, `Only if both the database and the broker support XA and you accept blocking. You usually cannot enlist the broker, which is why the outbox exists.`]
    ],
    pitfalls: [
      `<strong>Publishing directly "just this once".</strong> Code that sends to Kafka after commit, skipping the outbox, brings the dual write back: one crash or broker timeout and the event is gone. Make the outbox insert the only way to emit.`,
      `<strong>Skipped rows when polling by id.</strong> Ids come from a sequence at insert time, but rows become visible at commit. If transaction A takes id 10, B takes 11 and commits first, a poller that saved "last id = 11" never sees 10. Poll for unsent rows instead, or tail the log.`,
      `<strong>Reordering with parallel relays.</strong> Two relay workers can publish event 2 of an order before event 1. Run one active relay per set of aggregates, or let a log-tailing connector publish in commit order.`,
      `<strong>Side effects outside the inbox.</strong> The inbox only protects database changes. If the consumer calls an SMS provider, that call is not in the transaction; pass the event id downstream as an idempotency key where the provider supports one, or record "queued" first and send from there.`,
      `<strong>Unbounded tables.</strong> Outbox and inbox rows pile up and slow the relay query. Delete or partition by time, and keep inbox ids at least as long as redeliveries can happen.`
    ],
    use: `Use it whenever a service changes its own database and must reliably tell others: order placed, payment captured, number purchased, SMS status changed. It is the default for domain events between services.`,
    avoid: `Skip it when a lost event does not matter (best-effort metrics), when consumers only need a copy of the table (use CDC directly), or when an event store is already your source of truth (event sourcing).`,
    interview: [
      `Walk through every crash point between "insert order" and "invoice created". Where can an event be lost, and where duplicated?`,
      `Why is the relay at least once, and what makes the end result effectively once?`,
      `How do you keep per-order ordering with several relay instances and a partitioned topic?`,
      `Polling publisher or log tailing: what breaks with each at high volume?`
    ],
    related: [`t4`, `a3`, `a9`],
    sources: [
      { t: `Pattern: Transactional outbox`, by: `Chris Richardson, microservices.io`, url: `https://microservices.io/patterns/data/transactional-outbox.html` },
      { t: `Pattern: Idempotent Consumer`, by: `Chris Richardson, microservices.io`, url: `https://microservices.io/patterns/communication-style/idempotent-consumer.html` },
      { t: `Reliable Microservices Data Exchange With the Outbox Pattern`, by: `Gunnar Morling, Debezium blog (2019)`, url: `https://debezium.io/blog/2019/02/19/reliable-microservices-data-exchange-with-the-outbox-pattern/` },
      { t: `Outbox Event Router`, by: `Debezium documentation`, url: `https://debezium.io/documentation/reference/stable/transformations/outbox-event-router.html` }
    ]
  },
  {
    id: `idempotency-keys`,
    title: `Idempotency keys`,
    family: `Distributed correctness`,
    summary: `The client sends a unique key with each logical write. The server saves the key with the outcome, so a retry with that key replays the saved response instead of acting twice.`,
    problem: `A client calls POST /charges, the server charges the card, and the response is lost to a timeout. The client cannot tell whether the charge happened, so it either gives up (maybe losing a sale) or retries (maybe charging twice). With an idempotency key the retry is safe, because the server recognises it and returns the first outcome.`,
    how: [
      `The client creates one key per logical operation (a V4 UUID), saves it with its own record of the attempt, and sends it in an <code>Idempotency-Key</code> header. Every retry reuses that key.`,
      `The server inserts (account, key, request hash, status = in progress) before doing any work. A unique constraint on (account, key) decides which request owns the key.`,
      `New key: do the work, then save the business rows and the final response (status code and body) under the key in the same database transaction.`,
      `Known key, finished: replay the saved response, even an error (Stripe replays saved 500s too). Known key, still running: return 409 so the client retries later. Known key, different request hash: reject it (the IETF draft suggests 422) instead of guessing.`,
      `For calls to other systems (card processor, SMS provider), commit local state before the call, pass a key derived from yours downstream, and record a recovery point when it returns, so a retry resumes rather than repeats.`,
      `Expire keys after a documented window (Stripe prunes keys that are at least 24 hours old); a key reused after that is treated as a new request.`
    ],
    diagram: {
      layers: [
        { name: `Client`, items: [[`Checkout client`, `one key per payment, reused on retry`]] },
        { name: `API`, items: [[`Payments API`, `checks the key before any work`]] },
        { name: `Behind the API`, items: [[`idempotency_keys`, `key, request hash, status, response`], [`charges`, `the business rows`], [`Card processor`, `external, gets a derived key`]] }
      ],
      edges: [
        [`Checkout client`, `Payments API`, `sync`, `POST /charges + Idempotency-Key`],
        [`Payments API`, `idempotency_keys`, `data`, `1. insert key or load it`],
        [`Payments API`, `Card processor`, `sync`, `2. charge with a derived key`],
        [`Payments API`, `charges`, `data`, `3. charge row + response, one tx`]
      ],
      paths: [
        { name: `First attempt`, nodes: [`Checkout client`, `Payments API`, `Card processor`], note: `The key is new, so the API marks it in progress, charges the card, then saves the charge and the response together.` },
        { name: `Retry after a timeout`, nodes: [`Checkout client`, `Payments API`, `idempotency_keys`], note: `The same key finds a finished record, so the API replays the saved response and the card is not charged again.` }
      ]
    },
    variants: [
      [`Header key (Stripe style)`, `Every POST accepts an <code>Idempotency-Key</code> header. The server replays the first result, including errors, and rejects reuse with different parameters. A good default for public APIs.`],
      [`Token in the request body (AWS style)`, `The token is part of the API contract, such as EC2's <code>ClientToken</code>. It is remembered for the resource's lifetime plus a grace period and shown on the resource, so callers can find what their request created.`],
      [`Natural business key`, `Use an id the domain already has: one charge per order id, one SMS per (campaign, recipient). A unique constraint enforces it with no extra key table.`],
      [`Atomic phases with recovery points`, `For requests that call external services, split the work into local transactions between external calls and store the last recovery point on the key row. A retry jumps to where the last attempt stopped.`]
    ],
    alternatives: [
      [``, `Naturally idempotent writes`, `The change can be phrased as "set" instead of "add": PUT the full state, or <code>UPDATE ... SET status = 'sent'</code>. Repeating it changes nothing, so no key store is needed.`],
      [``, `Conditional writes`, `The client knows the version it read. <code>If-Match</code> with an ETag, or <code>UPDATE ... WHERE version = 7</code>, makes a replay fail harmlessly.`],
      [`outbox-inbox`, `Inbox on the consumer`, `The duplicate comes from a message broker, not an HTTP client. Record processed message ids in the consumer's own transaction.`]
    ],
    pitfalls: [
      `<strong>New key per retry.</strong> If the caller generates a fresh UUID for each attempt, the server sees different requests and charges twice. Create the key once per operation and store it before the first attempt.`,
      `<strong>Key store not atomic with the write.</strong> Checking Redis and then writing Postgres leaves a window where the charge commits but the key does not, or the reverse. Keep the key row and the business rows in one ACID transaction.`,
      `<strong>Two in-flight requests with one key.</strong> Without a unique constraint or lock, a retry that arrives while the first attempt is still running also starts work. Let the insert conflict decide and answer the loser with 409.`,
      `<strong>Keys not scoped per account.</strong> Two customers can send the same key. Make the constraint (account, key), and never use personal data such as an email address as the key.`,
      `<strong>Expiry shorter than retries.</strong> A queue that retries after two days, when keys expire after one, creates a duplicate. Match the expiry to the longest retry path and document it.`
    ],
    use: `Use it on every non-idempotent write a client may retry: payments, refunds, sending an SMS, buying a phone number, creating orders. It is essential when SDKs or proxies retry automatically on timeouts.`,
    avoid: `Skip it for reads and for writes that are already idempotent (PUT of full state, DELETE by id, set-status updates). For duplicate messages from a broker, use an inbox on the consumer instead of an HTTP key.`,
    interview: [
      `Where do you store the key and the saved response, and why must that be the same transaction as the business write?`,
      `A retry arrives while the first request is still running. What do you return, and why?`,
      `The card was charged but your database commit failed. How does the retry avoid a second charge?`,
      `What should happen if a client reuses a key with a different amount?`
    ],
    related: [`c10`, `r3`, `a3`],
    sources: [
      { t: `Idempotent requests`, by: `Stripe API reference`, url: `https://docs.stripe.com/api/idempotent_requests` },
      { t: `Making retries safe with idempotent APIs`, by: `Malcolm Featonby, Amazon Builders' Library`, url: `https://aws.amazon.com/builders-library/making-retries-safe-with-idempotent-APIs/` },
      { t: `Implementing Stripe-like Idempotency Keys in Postgres`, by: `Brandur Leach (2017)`, url: `https://brandur.org/idempotency-keys` },
      { t: `The Idempotency-Key HTTP Header Field (expired Internet-Draft)`, by: `IETF httpapi working group`, url: `https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/` }
    ]
  },
  {
    id: `event-sourcing`,
    title: `Event sourcing`,
    family: `Data`,
    summary: `Store every change as an immutable event in an append-only log, and derive current state by replaying them. The event log is the source of truth; tables are projections you can rebuild.`,
    problem: `A wallet table that stores only balance = 40 cannot explain how it got there, cannot answer "what was the balance on 1 March", and cannot be rebuilt after a bug corrupts it. Audit tables bolted on later miss writes and drift. Event sourcing makes the history the primary record, so current state, audit trail and past states all come from the same events.`,
    how: [
      `Model each entity (an account, an order) as a stream of events named for business intent: FundsDeposited, ChargeApplied, RefundIssued. Events are never updated or deleted.`,
      `To handle a command such as "charge 5.00", load the entity's latest snapshot and the events after it, and fold them into current state.`,
      `Check the business rule on that state (is the balance enough?), then produce new events or reject the command.`,
      `Append the new events with the stream version you read (expected version 41). If someone else appended first, the store rejects the write; reload and retry.`,
      `Projectors subscribe to the stream and build read models: a balance table, a statement view, a search index. Each tracks the last event it applied and skips duplicates.`,
      `Save a snapshot every N events so loading stays fast. To fix a projection or add a new one, rebuild it by replaying from the first event.`
    ],
    diagram: {
      layers: [
        { name: `Client`, items: [[`Wallet API`, `accepts commands like charge 5.00`]] },
        { name: `Domain`, items: [[`Account aggregate`, `folds events, checks rules`]] },
        { name: `Event store`, items: [[`Account stream`, `append-only, versioned per account`], [`Snapshots`, `state every N events`]] },
        { name: `Projections`, items: [[`Projector`, `applies each event once`]] },
        { name: `Read models`, items: [[`Balance view`, `current balance per account`], [`Statement view`, `history for statements`]] }
      ],
      edges: [
        [`Wallet API`, `Account aggregate`, `sync`, `command`],
        [`Account aggregate`, `Snapshots`, `data`, `1. load latest snapshot`],
        [`Account aggregate`, `Account stream`, `data`, `2. read newer events, 3. append at expected version`],
        [`Account stream`, `Projector`, `async`, `4. subscribe`],
        [`Projector`, `Balance view`, `data`, `upsert`],
        [`Projector`, `Statement view`, `data`, `append line`]
      ],
      paths: [
        { name: `Write`, nodes: [`Wallet API`, `Account aggregate`, `Account stream`], note: `The aggregate replays the account's events, checks the balance, and appends ChargeApplied only if nobody appended since it read.` },
        { name: `Rebuild`, nodes: [`Account stream`, `Projector`, `Balance view`], note: `Projections are disposable: drop the balance view, replay the stream from the first event, and it comes back with the bug fixed.` }
      ]
    },
    variants: [
      [`With CQRS`, `The usual pairing: the event store serves writes and projections serve every query, because the store can only be read efficiently by entity id.`],
      [`Snapshots`, `Periodically store folded state with its stream version, then load the snapshot plus newer events. Choose the interval by measuring load time, not up front.`],
      [`Event store on Postgres`, `An append-only table with a unique (stream id, version) constraint gives optimistic concurrency in a plain relational database. Purpose-built stores add per-stream reads, subscriptions and snapshots out of the box.`],
      [`Crypto-shredding`, `To honour erasure requests, keep personal data outside events and reference it by id; where you cannot, encrypt it with a per-person key and delete the key.`]
    ],
    alternatives: [
      [``, `CRUD with an audit table`, `You need "who changed what", not replay or temporal queries. Far simpler, and enough for most systems.`],
      [`change-data-capture`, `Change data capture`, `Other systems need a stream of changes, but the service should keep storing current state as it does today.`],
      [`outbox-inbox`, `Transactional outbox`, `You need reliable domain events, while current-state tables stay the source of truth.`]
    ],
    pitfalls: [
      `<strong>Event schema evolution.</strong> Old events live forever, so every reader must handle every version. Use tolerant readers, a version field and upcasters; rewriting stored events is a last resort because it breaks the audit trail.`,
      `<strong>Side effects on replay.</strong> Rebuilding a projection must not resend SMS or recharge cards. Route external calls through a gateway that is disabled during replay, or trigger them only from live subscriptions.`,
      `<strong>Bad events cannot be edited.</strong> A bug that wrote wrong amounts stays in the log. Fix forward with compensating events (ChargeReversed) and make sure every projection handles them.`,
      `<strong>Kafka as the event store.</strong> A broker lacks per-entity reads and optimistic concurrency, so two writers can both append based on stale state. Use Kafka to fan events out, not as the store you validate commands against.`,
      `<strong>Stale reads.</strong> Projections lag the stream, so a user who just paid may see the old balance. Show pending state, or answer that user's read from the stream.`
    ],
    use: `Use it where history is the product or a hard requirement: ledgers and wallets, order and number lifecycles, compliance audit trails, or anywhere you must answer "what did we know at time T" and rebuild views after bugs.`,
    avoid: `Avoid it for plain CRUD, MVPs and short-lived systems; Microsoft's guidance says traditional data management is enough for most systems. Use normal tables with an audit table, and add CDC or an outbox when others need events.`,
    interview: [
      `How do you stop two concurrent commands from overdrawing the same wallet?`,
      `An event's format changes. How do years of old events keep working?`,
      `How do you rebuild a read model without resending notifications?`,
      `How would you delete a user's personal data from an append-only log?`
    ],
    related: [`a2`, `r9`],
    sources: [
      { t: `Event Sourcing`, by: `Martin Fowler (2005)`, url: `https://martinfowler.com/eaaDev/EventSourcing.html` },
      { t: `Event Sourcing pattern`, by: `Microsoft Azure Architecture Center`, url: `https://learn.microsoft.com/en-us/azure/architecture/patterns/event-sourcing` },
      { t: `Pattern: Event sourcing`, by: `Chris Richardson, microservices.io`, url: `https://microservices.io/patterns/data/event-sourcing.html` }
    ]
  },
  {
    id: `cqrs`,
    title: `CQRS (Command Query Responsibility Segregation)`,
    family: `Data`,
    summary: `Use one model to change data (commands) and a different, query-shaped model to read it. The read side is often a separate store kept up to date from the write side's events.`,
    problem: `An SMS platform writes message rows through a normalized, validated model, but its dashboard asks for delivery rate by carrier for the last hour and support searches by phone number. Serving both from the same tables means heavy joins and scans on the database that also takes every send. CQRS keeps writes small and correct while reads come from views built for each query.`,
    how: [
      `Split the API: commands (SendSms, CancelMessage) change state and return little; queries (DeliveryStats, SearchMessages) return data and change nothing.`,
      `The command side enforces business rules and writes the source of truth, for example a normalized Postgres schema.`,
      `Every change also produces an event, captured through a transactional outbox or CDC so none is lost.`,
      `Projectors consume the events and update read models shaped for each screen: a search index, per-minute counters, a per-customer summary.`,
      `Queries read only the read models, so they scale out on their own and can use a different database.`,
      `Handle the lag: return the new version from the command, and let a query that needs it wait for the projection to reach that version or fall back to the write side.`
    ],
    diagram: {
      layers: [
        { name: `Clients`, items: [[`Send API client`, `sends commands`], [`Dashboard`, `asks queries`]] },
        { name: `Services`, items: [[`Command side`, `validates, writes`], [`Query side`, `reads prebuilt views`]] },
        { name: `Stores`, items: [[`Messages DB`, `normalized source of truth`], [`Read views`, `search index, per-minute stats`]] },
        { name: `Sync`, items: [[`Projector`, `idempotent view builder`]] }
      ],
      edges: [
        [`Send API client`, `Command side`, `sync`, `send SMS`],
        [`Command side`, `Messages DB`, `data`, `write`],
        [`Messages DB`, `Projector`, `repl`, `change feed (outbox or CDC)`],
        [`Projector`, `Read views`, `data`, `upsert views`],
        [`Dashboard`, `Query side`, `sync`, `delivery stats, search`],
        [`Query side`, `Read views`, `data`, `read`]
      ],
      paths: [
        { name: `Command`, nodes: [`Send API client`, `Command side`, `Messages DB`, `Projector`, `Read views`], note: `A send commits to the source of truth and reaches the read views a moment later through the change feed.` },
        { name: `Query`, nodes: [`Dashboard`, `Query side`, `Read views`], note: `Dashboards and searches never touch the write database, so a heavy report cannot slow down sends.` }
      ]
    },
    variants: [
      [`Same database, separate models`, `Commands go through the domain model; queries use SQL views or hand-written read queries on the same database. No sync lag, and often enough.`],
      [`Separate read store`, `Projections feed a store built for the query: a search engine for text search, a columnar store for analytics, a key-value store for counters. Reads scale independently, at the cost of lag and sync code.`],
      [`CQRS with event sourcing`, `The write side is an event store and every query is a projection, so new views can be built later by replaying history.`],
      [`Cross-service view`, `A service subscribes to events from several services to answer a query that spans them, instead of calling each one at read time.`]
    ],
    alternatives: [
      [``, `Read replicas`, `Reads need more capacity, not a different shape. Replicas copy the same schema with almost no code, though they also lag.`],
      [``, `Materialized views`, `One heavy query can be precomputed inside the same database. PostgreSQL's <code>REFRESH MATERIALIZED VIEW</code> rebuilds it when you run it; the CONCURRENTLY option needs a unique index.`],
      [`cache-aside-stampede`, `Cache-aside`, `The same hot reads repeat. A cache in front of the existing model is much cheaper than a second model.`],
      [``, `API composition`, `A query spanning services is rare or small. Call the owning services and join in memory instead of maintaining a view.`]
    ],
    pitfalls: [
      `<strong>CQRS everywhere.</strong> Fowler warns that for most systems it adds risky complexity and belongs only in specific parts of a system. Apply it to the one area with a real read problem.`,
      `<strong>Read-your-own-writes gaps.</strong> A user sends a message and the list does not show it yet. Wait for the returned version, show the pending item in the UI, or read that one item from the write side.`,
      `<strong>Projector not idempotent or not ordered.</strong> Redelivered or reordered events double-count stats or bring back deleted rows. Store the last applied version per entity and ignore anything older or equal.`,
      `<strong>No way to rebuild.</strong> If the events behind a view are gone, a projection bug is permanent. Keep a way to rebuild every read model: replay an event store, or re-snapshot the source tables through CDC.`,
      `<strong>Silent lag.</strong> A stalled projector keeps serving old numbers without errors. Alert on projection lag (time of newest event minus time of last applied event), not just on failures.`
    ],
    use: `Use it when reads and writes differ a lot in shape or volume: dashboards and search over transactional data, read-heavy screens, or queries that span services. Start with one bounded area.`,
    avoid: `Avoid it for simple CRUD where screens map to tables, or where users cannot tolerate any staleness. Try indexes, read replicas, materialized views or a cache first.`,
    interview: [
      `A user creates something and does not see it in the list. How do you fix that without giving up CQRS?`,
      `How do you keep the read store in sync, and what happens if the projector gets an event twice or out of order?`,
      `When is a read replica enough, and when do you need a different read model?`,
      `How would you build a new read view over two years of existing data?`
    ],
    related: [`t5`, `d1`, `t1`],
    sources: [
      { t: `CQRS`, by: `Martin Fowler (2011)`, url: `https://martinfowler.com/bliki/CQRS.html` },
      { t: `CQRS pattern`, by: `Microsoft Azure Architecture Center`, url: `https://learn.microsoft.com/en-us/azure/architecture/patterns/cqrs` },
      { t: `Pattern: Command Query Responsibility Segregation (CQRS)`, by: `Chris Richardson, microservices.io`, url: `https://microservices.io/patterns/data/cqrs.html` },
      { t: `REFRESH MATERIALIZED VIEW`, by: `PostgreSQL documentation`, url: `https://www.postgresql.org/docs/current/sql-refreshmaterializedview.html` }
    ]
  },
  {
    id: `change-data-capture`,
    title: `Change data capture (CDC)`,
    family: `Data`,
    summary: `Read the database's own transaction log (Postgres WAL, MySQL binlog) and turn every committed insert, update and delete into an ordered stream of change events for other systems.`,
    problem: `The numbers table is the source of truth, but the search index, the cache and the warehouse all need its changes within seconds. Dual writes from the app miss changes whenever the second write fails, and polling an <code>updated_at</code> column misses deletes and rows changed twice between polls while adding load. CDC reads the log the database already writes, so every committed change is captured in order with no change to application code.`,
    how: [
      `Enable logical decoding (in Postgres, <code>wal_level = logical</code>), then create a publication for the tables and a replication slot for the connector.`,
      `On first start the connector takes a consistent snapshot of existing rows and emits each as a read event.`,
      `It then streams committed changes from the slot in commit order. Each event carries the operation, the row before and after, and source metadata such as transaction id and log position.`,
      `By default each table gets its own topic and each event is keyed by primary key, so changes to one row stay in order within a partition.`,
      `The connector records its position and confirms it to the slot so Postgres can recycle old WAL. After a crash it resumes from the last recorded offset, so some events repeat.`,
      `Consumers (search indexer, cache invalidator, warehouse loader) apply events idempotently: upsert by primary key and ignore changes older than what they already hold.`
    ],
    diagram: {
      layers: [
        { name: `Application`, items: [[`Numbers service`, `writes as usual, no event code`]] },
        { name: `Database`, items: [[`Postgres tables`, `numbers, orders`]] },
        { name: `Log`, items: [[`WAL + replication slot`, `ordered changes, kept until acked`]] },
        { name: `Capture`, items: [[`Debezium connector`, `snapshot, then stream`]] },
        { name: `Broker`, items: [[`Kafka topics`, `one per table, keyed by primary key`]] },
        { name: `Consumers`, items: [[`Search indexer`, `upserts documents`], [`Cache invalidator`, `evicts changed keys`], [`Warehouse loader`, `bulk loads analytics`]] }
      ],
      edges: [
        [`Numbers service`, `Postgres tables`, `data`, `1. insert, update, delete`],
        [`Postgres tables`, `WAL + replication slot`, `repl`, `2. commit is logged`],
        [`WAL + replication slot`, `Debezium connector`, `repl`, `3. logical decoding, ack position`],
        [`Debezium connector`, `Kafka topics`, `stream`, `4. change events`],
        [`Kafka topics`, `Search indexer`, `async`, `5. consume`],
        [`Kafka topics`, `Cache invalidator`, `async`, `5. consume`],
        [`Kafka topics`, `Warehouse loader`, `stream`, `5. bulk load`]
      ],
      paths: [
        { name: `Change flow`, nodes: [`Numbers service`, `Postgres tables`, `WAL + replication slot`, `Debezium connector`, `Kafka topics`, `Search indexer`], note: `Only committed changes flow, in commit order, and the service never knows the pipeline exists.` },
        { name: `Connector outage`, nodes: [`WAL + replication slot`, `Debezium connector`], note: `While the connector is down the slot keeps every WAL segment, so it catches up on restart, but a long outage can fill the primary's disk.` }
      ]
    },
    variants: [
      [`Log-based (Debezium, native logical replication)`, `Reads the WAL or binlog. Captures deletes and every intermediate change with low load on the database; needs replication privileges and per-database setup.`],
      [`Query-based polling`, `Selects rows whose <code>updated_at</code> is newer than the last run. Works anywhere, but misses deletes and changes between polls and adds query load. Fine for hourly syncs.`],
      [`Trigger-based`, `Triggers copy each change into a changelog table that a job ships out. Captures deletes, but adds work to every write transaction.`],
      [`Incremental snapshots`, `Instead of one long initial snapshot, the connector copies tables in primary-key chunks while streaming continues, and can resume or re-run on demand (Debezium tracks progress with watermarks).`]
    ],
    alternatives: [
      [`outbox-inbox`, `Transactional outbox`, `Consumers are other teams' services that need stable, meaningful events (OrderPlaced), not your table layout. CDC on the outbox table gives you both.`],
      [``, `Batch export (ETL)`, `The target only needs data hourly or daily, such as warehouse reports. A scheduled dump or incremental query is simpler to run.`],
      [`event-sourcing`, `Event sourcing`, `The service already stores events as its source of truth, so they can be published directly.`]
    ],
    pitfalls: [
      `<strong>The slot fills the disk.</strong> A stopped or lagging connector pins its slot, and Postgres keeps all WAL behind it (<code>max_slot_wal_keep_size</code> defaults to -1, unlimited). It also happens when captured tables are quiet but the database is busy; Debezium's <code>heartbeat.interval.ms</code> covers that. Alert on slot lag and drop unused slots.`,
      `<strong>Failover and the slot.</strong> Logical slots live on the primary. Before PostgreSQL 17, resuming capture after a failover needs manual work and you risk missing changes; on 17 and later, configure a failover slot so it is synced to the standby.`,
      `<strong>Missing old values.</strong> With the default replica identity, update and delete events carry only the primary key in <code>before</code>, and unchanged large (TOASTed) columns arrive as a placeholder. Set <code>REPLICA IDENTITY FULL</code> where consumers need them.`,
      `<strong>Duplicates after crashes.</strong> Offsets are flushed periodically, so a restarted connector re-emits recent changes. Consumers must be idempotent: upsert by key and compare versions.`,
      `<strong>Your schema becomes a public API.</strong> Consumers break when you rename a column, and Postgres logical decoding does not emit DDL. Publish designed events through an outbox for other teams and keep raw CDC topics internal.`
    ],
    use: `Use it to keep derived stores in sync with an OLTP database (search index, cache invalidation, warehouse, audit), to relay an outbox without polling, and to copy data into a new store during a migration while the old one keeps taking writes.`,
    avoid: `Avoid it as the contract between teams (use an outbox with designed events), when hourly batch freshness is fine (use ETL), or when you cannot get replication access or run the connector reliably.`,
    interview: [
      `The connector was down for a day. What happened on the database, and what happens when it restarts?`,
      `How do you make a search index converge with the database despite duplicates and restarts?`,
      `What happens to the replication slot when the Postgres primary fails over?`,
      `CDC on business tables or an outbox: which would you expose to other teams, and why?`
    ],
    related: [`t4`, `d9`, `e9`],
    sources: [
      { t: `Debezium connector for PostgreSQL`, by: `Debezium documentation`, url: `https://debezium.io/documentation/reference/stable/connectors/postgresql.html` },
      { t: `Logical Decoding Concepts`, by: `PostgreSQL documentation`, url: `https://www.postgresql.org/docs/current/logicaldecoding-explanation.html` },
      { t: `Five Advantages of Log-Based Change Data Capture`, by: `Gunnar Morling, Debezium blog (2018)`, url: `https://debezium.io/blog/2018/07/19/advantages-of-log-based-change-data-capture/` },
      { t: `Replication settings (max_slot_wal_keep_size)`, by: `PostgreSQL documentation`, url: `https://www.postgresql.org/docs/current/runtime-config-replication.html` }
    ]
  }
);
