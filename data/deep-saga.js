/* Saga deep dive. Its diagrams (forward steps with compensations, orchestration vs choreography) are drawn by the app. */
window.HUB_DEEP = window.HUB_DEEP || [];
window.HUB_DEEP.push(
  {
    id: `saga`,
    title: `Saga`,
    family: `Distributed correctness`,
    summary: `One business transaction that spans several services, run as a chain of local transactions. If a later step fails, compensating transactions undo the steps that already committed.`,
    problem: `Placing an order touches the order, stock and payment services, and each owns its database. You cannot hold one lock or one ACID transaction across them, and two-phase commit blocks every participant while its coordinator is down. The order must still either finish or be cleanly undone.`,
    how: [
      `Split the business transaction into steps. Each step is a local transaction in one service and commits on its own.`,
      `When a step commits, trigger the next one: an orchestrator sends a command, or the service publishes an event the next service reacts to.`,
      `Give every step that can be undone a compensating transaction, such as <em>refund card</em> for <em>charge card</em>.`,
      `Order the steps: undoable steps first, then the <strong>pivot</strong> (the point of no return), then retryable steps that cannot fail for business reasons.`,
      `If a step fails before the pivot, run the compensations for the finished steps in reverse order.`,
      `After the pivot, never compensate: retry the remaining steps until they succeed.`
    ],
    diagram: null,
    variants: [
      [`Orchestration`, `A central orchestrator sends each command and tracks every reply. Suits many steps, branches and timeouts. Built with Temporal, AWS Step Functions or a saga state table.`],
      [`Choreography`, `Each service reacts to events and publishes its own; no central controller. Suits two to four simple steps. Beyond that the flow is hard to see, test and change.`]
    ],
    alternatives: [
      [`two-phase-commit`, `Two-phase commit`, `Every participant is a database or broker that supports XA, the transaction is short, and other readers must never see a half-done state.`],
      [`tcc`, `Try-Confirm-Cancel`, `Each step can reserve first (hold stock, hold funds), so you confirm or cancel reservations instead of undoing real changes.`],
      [`outbox-inbox`, `Transactional outbox`, `Only two things must happen together: a database write and a message. Sagas use an outbox for every step anyway.`],
      [``, `One service, one database`, `If the data can live in one database, a local ACID transaction beats every distributed pattern.`]
    ],
    pitfalls: [
      `<strong>No isolation.</strong> Other requests see half-finished state, which causes lost updates, dirty reads and fuzzy reads. Use a semantic lock (a PENDING status), commutative updates, or re-read values before acting.`,
      `<strong>Compensations fail too.</strong> A refund can time out. Make compensations idempotent, retry them with backoff, and alert a human when one is stuck.`,
      `<strong>Irreversible side effects too early.</strong> An email or SMS cannot be unsent, so send it after the pivot.`,
      `<strong>Lost messages.</strong> Publishing after the commit, without an outbox, drops the next step forever if the process crashes in between.`,
      `<strong>State kept only in memory.</strong> A restarted orchestrator cannot resume. Persist saga state (or use Temporal), and put a timeout on every step.`
    ],
    use: `A business transaction spans services that each own their data, every step before the pivot has a meaningful undo, and a few seconds of eventual consistency are acceptable.`,
    avoid: `The data can live in one database (use a local transaction), the steps have no sensible undo, or users must never see an in-between state (keep it in one service, or reserve with TCC).`,
    interview: [
      `Orchestration or choreography for this flow, and why?`,
      `Which step is your pivot, and what happens if a step after it keeps failing?`,
      `How do you stop another request from reading the half-finished order?`,
      `How does a step avoid running twice when its message is redelivered?`
    ],
    related: [`t3`, `t4`, `p4`],
    example: `Buying a phone number from a telecom API: reserve it with the carrier, charge the account, provision it (attach it to an app and set up routing), then email a confirmation. Provisioning is the pivot. If it fails, refund the charge and release the reservation. The email comes after the pivot, so it never needs undoing.`,
    sources: [
      { t: `Sagas`, by: `Hector Garcia-Molina and Kenneth Salem, SIGMOD 1987`, url: `https://www.cs.cornell.edu/andru/cs711/2002fa/reading/sagas.pdf` },
      { t: `Pattern: Saga`, by: `Chris Richardson, microservices.io`, url: `https://microservices.io/patterns/data/saga.html` },
      { t: `Saga distributed transactions pattern`, by: `Microsoft Azure Architecture Center`, url: `https://learn.microsoft.com/en-us/azure/architecture/patterns/saga` },
      { t: `Saga orchestration pattern`, by: `AWS Prescriptive Guidance`, url: `https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/saga-orchestration.html` },
      { t: `Saga pattern made easy`, by: `Temporal`, url: `https://temporal.io/blog/saga-pattern-made-easy` }
    ]
  }
);
