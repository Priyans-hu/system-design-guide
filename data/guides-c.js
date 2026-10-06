window.HUB_GUIDES = window.HUB_GUIDES || [];
window.HUB_GUIDES.push(
  {
    id: `rest-grpc-graphql`,
    area: `APIs and architecture`,
    title: `REST vs gRPC vs GraphQL`,
    question: `Which API style fits this boundary: public clients, your own services, or a UI that needs data from many places?`,
    summary: `All three run over HTTP; they differ in who they serve best. REST reaches every client, proxy and cache but has loose contracts. gRPC gives typed, compact, streaming calls between services you control but needs extra tooling at the edge. GraphQL lets each client ask for exactly the fields it needs, but moves query cost control and caching onto your server.`,
    why: `Expose gRPC to partners and they cannot call it from curl or a browser. Use JSON over REST for chatty internal calls and you hand-maintain clients and pay for parsing. Use GraphQL for simple CRUD and you inherit N+1 queries and cost limits for nothing.`,
    options: [
      {
        name: `REST (HTTP and JSON)`,
        what: `Each resource gets a URL (<code>/orders/42</code>) and clients use standard HTTP methods on it: GET reads, POST creates, PUT replaces, DELETE removes. Requests are stateless, carrying everything the server needs, and responses say whether they may be cached. Bodies are usually JSON, and the contract lives in docs or an OpenAPI spec.`,
        pros: [
          `Every language, browser, proxy and tool speaks HTTP and JSON, so a partner can integrate with curl and your docs.`,
          `GET responses are cacheable by URL under HTTP semantics, so CDNs, browsers and reverse proxies can absorb read traffic.`,
          `GET, PUT and DELETE are defined as idempotent, so clients and proxies know which requests are safe to retry.`
        ],
        cons: [
          `The contract is loose: a field can change type unnoticed unless you maintain an OpenAPI spec and test against it.`,
          `Fixed resource shapes cause over-fetching (40 fields sent, 5 used) and under-fetching (five calls to build one screen).`,
          `JSON is text, so payloads are bigger and slower to parse than binary Protobuf on hot internal paths.`,
          `POST is not idempotent, so a retried create can make a duplicate unless you add idempotency keys.`
        ],
        pick: `Public APIs, partner integrations, webhooks and any boundary where you do not control the client.`,
        avoid: `High-volume internal calls where payload size, typed stubs or streaming matter (use gRPC), and screens that stitch many resources together (consider GraphQL or a backend-for-frontend).`,
        example: `Stripe describes its API as organized around REST: resource-oriented URLs, form-encoded requests, JSON responses and standard HTTP status codes.`,
        tools: `OpenAPI, FastAPI, Go net/http, chi, Postman`
      },
      {
        name: `gRPC (Protobuf over HTTP/2)`,
        what: `You define services and messages in a <code>.proto</code> file, and code generators produce typed clients and servers for Go, Python and other languages. Calls travel as binary Protobuf over HTTP/2, which multiplexes many calls on one connection. There are four call types (unary, server streaming, client streaming, bidirectional), plus deadlines and cancellation.`,
        pros: [
          `Generated stubs turn the contract into a compile-time check, so a renamed field breaks the build instead of production.`,
          `Protobuf is smaller and faster than JSON, which cuts latency and CPU on chatty service-to-service paths.`,
          `Streaming and deadlines are built in: a call past its deadline fails with <code>DEADLINE_EXCEEDED</code>, and cancellation cascades downstream.`
        ],
        cons: [
          `Browsers cannot call it directly: gRPC-Web needs a proxy such as Envoy and supports only unary and server-streaming calls.`,
          `Long-lived HTTP/2 connections defeat layer 4 balancing, since one connection pins all its calls to one pod; you need L7 or client-side balancing.`,
          `Field numbers identify fields on the wire, so they can never change or be reused, and deleted ones must be marked <code>reserved</code>.`,
          `Binary payloads are not human readable, so debugging needs tools like grpcurl instead of curl and a browser.`
        ],
        pick: `Internal calls that are frequent, latency sensitive or polyglot (Go calling Python), and internal paths that need streaming.`,
        avoid: `Public APIs for browsers and third parties; if you must, put a REST or JSON gateway in front.`,
        example: `Kubernetes defines its Container Runtime Interface as a gRPC protocol, so the kubelet on every node is a gRPC client of the container runtime.`,
        tools: `protoc, buf, grpc-go, grpcio, grpcurl, Envoy`
      },
      {
        name: `GraphQL`,
        what: `The server publishes a typed schema, and clients send a query naming exactly the fields they want, usually to one <code>/graphql</code> endpoint. Each field has a resolver function that loads its data, so one query can pull from several databases or services. Writes are mutations, and over HTTP they must use POST.`,
        pros: [
          `Clients get exactly the fields they ask for in one round trip, which GitHub cites as the draw for mobile developers.`,
          `Adding types and fields does not break existing queries, because the server returns only what each query requested.`,
          `Frontend teams build new screens from existing fields without waiting for a new backend endpoint.`
        ],
        cons: [
          `Naive resolvers cause N+1 queries (50 orders, then one customer lookup each) unless a DataLoader batches them.`,
          `Clients can send deep or wide queries, so you need depth limits and cost budgets; GitHub charges each query points against an hourly limit.`,
          `Queries usually go as POST to one URL, so URL-based HTTP caching fails unless you use GET with persisted queries.`,
          `A response can carry partial data plus errors with HTTP 200, so dashboards built on status codes miss failures.`
        ],
        pick: `A backend for UIs whose screens need different slices of the same data, or one graph over many services.`,
        avoid: `Simple CRUD, file transfer and service-to-service calls, where REST or gRPC is simpler. A public GraphQL API means budgeting queries from clients you do not control.`,
        example: `Netflix built a federated GraphQL layer for its studio apps, so UI developers query one graph instead of hundreds of microservices while each domain team owns its slice.`,
        tools: `Apollo Federation, gqlgen, Strawberry, DataLoader`
      }
    ],
    compare: [
      [`Payload`, `JSON text`, `Binary Protobuf, compact`, `JSON, only requested fields`],
      [`Contract`, `Optional OpenAPI spec`, `Required .proto, generated code`, `Required typed schema`],
      [`Browser support`, `Native`, `gRPC-Web plus a proxy`, `Native`],
      [`Streaming`, `Add SSE or WebSockets`, `Built in, four call types`, `Subscriptions over WebSockets or SSE`],
      [`HTTP caching`, `GET cacheable by URL`, `None at the HTTP layer`, `Only GET with persisted queries`],
      [`Best boundary`, `Public and partner APIs`, `Internal service calls`, `UI data fetching`]
    ],
    decide: [
      [`Will third parties or browsers call it directly?`, `Yes → REST with an OpenAPI spec.`],
      [`Is it frequent service-to-service traffic, with both ends under your control?`, `Yes → gRPC.`],
      [`Do several clients need different shapes of the same data?`, `Yes → GraphQL, or one REST backend-for-frontend per client.`],
      [`Is it mostly simple CRUD on a few resources?`, `Yes → REST. GraphQL adds cost controls you do not need.`]
    ],
    scenario: {
      title: `Worked example: the API layer of a food delivery app`,
      setup: `A delivery startup has a mobile app, a partner API for restaurants, and ten Go and Python services. The order screen shows status, courier location, restaurant details and the menu, which live in four services.`,
      steps: [
        `Restaurants integrate from their own stacks, so the partner API is REST with an OpenAPI spec and idempotency keys on order creation.`,
        `Pricing, dispatch and payments call each other constantly across two languages, so they use gRPC with generated stubs and a deadline on every call.`,
        `Four REST calls per screen are slow on mobile networks, so add one aggregation layer: a GraphQL gateway or a REST backend-for-frontend.`,
        `gRPC rides long-lived HTTP/2 connections, so internal traffic goes through an L7 proxy or mesh, not a plain TCP balancer.`
      ],
      answer: `REST at the partner edge, gRPC between services, and a thin aggregation layer for the app. GraphQL earns its cost only if several clients need different shapes; one app is fine with a backend-for-frontend.`
    },
    mistakes: [
      `Exposing gRPC to partners. They cannot call it from a browser or curl, so you build a REST gateway anyway.`,
      `Shipping GraphQL without depth or cost limits. One nested query can fan out into thousands of database calls.`,
      `Putting gRPC behind a plain TCP load balancer. Each connection pins to one pod while the others sit idle.`,
      `Reusing a deleted Protobuf field number. Old clients decode new data into the wrong field, silently.`
    ],
    rule: `REST at the public edge, gRPC between your own services, and GraphQL only when several clients need different shapes of the same data.`,
    signals: [
      `Partners ask for an SDK or a Postman collection → it is a public API; keep it REST.`,
      `JSON encoding shows up in profiles of a hot internal hop → move that hop to gRPC.`,
      `The mobile app makes five calls to render one screen → add GraphQL or a backend-for-frontend.`,
      `One gRPC pod is hot while the others idle → switch to L7 or client-side load balancing.`
    ],
    interview: [
      `What counts as a breaking change in REST, and in Protobuf?`,
      `Why does gRPC need L7 or client-side load balancing?`,
      `How do you stop one expensive GraphQL query from overloading the database?`
    ],
    related: [`c9`, `p2`, `p6`, `e6`],
    deep: [`idempotency-keys`, `rate-limiting`],
    db: [],
    sources: [
      { t: `Core concepts, architecture and lifecycle`, by: `gRPC`, url: `https://grpc.io/docs/what-is-grpc/core-concepts/` },
      { t: `gRPC Web (README: proxy and streaming support)`, by: `gRPC Authors`, url: `https://github.com/grpc/grpc-web` },
      { t: `gRPC Load Balancing on Kubernetes without Tears`, by: `William Morgan, Kubernetes Blog`, url: `https://kubernetes.io/blog/2018/11/07/grpc-load-balancing-on-kubernetes-without-tears/` },
      { t: `Performance`, by: `GraphQL Foundation`, url: `https://graphql.org/learn/performance/` }
    ]
  },
  {
    id: `monolith-vs-microservices`,
    area: `APIs and architecture`,
    title: `Monolith vs modular monolith vs microservices`,
    question: `How many separately deployable units should this system have right now?`,
    summary: `You trade the simplicity of one process for the independence of many. A monolith gives in-process calls, one database and cheap refactors. Microservices let teams deploy and scale parts separately, but every call becomes a network call and every cross-service change a distributed one. The modular monolith sits between: one deployable, with boundaries enforced inside it.`,
    why: `Split too early and you pay for network failures, distributed transactions and platform work before you know where the boundaries belong. Split too late and teams queue behind one release train and share one blast radius.`,
    options: [
      {
        name: `Monolith`,
        what: `One codebase built and deployed as a single unit, usually with one database. Features call each other as plain function calls in one process, and one transaction can touch any table. You scale by running more copies of the whole app behind a load balancer.`,
        pros: [
          `Calls between features are in-process, so there is no network latency, serialization or partial failure between them.`,
          `One database lets a single ACID transaction update an order and its inventory together, with no sagas.`,
          `Moving code between modules is a refactor plus one deploy, which matters because early boundaries are usually wrong.`
        ],
        cons: [
          `Everything ships together, so as teams grow they queue behind one release train and one red test blocks everyone.`,
          `The blast radius is shared: a memory leak in reporting can take down checkout.`,
          `You scale the whole app even when one part is hot, and without enforced boundaries the code drifts into a big ball of mud.`
        ],
        pick: `A new product, one or two teams, or a domain you do not understand yet. Fowler notes that almost all successful microservice stories began as a monolith that grew too big.`,
        avoid: `When teams block each other on deploys every week, or one component needs very different scaling, runtime or isolation.`,
        example: `Segment ran over 140 services, one per destination, watched operational overhead grow with each one, and consolidated them into a single service.`,
        tools: `Django, Rails, Spring Boot, one Go binary`
      },
      {
        name: `Modular monolith`,
        what: `Still one deployable, but the code is split into modules with enforced rules: each module owns its tables and exposes a small interface, and other modules may call only that interface. A linter in CI fails the build on violations. Shopify defines it as one application with strictly enforced boundaries between domains.`,
        pros: [
          `You keep in-process calls, one deploy and local transactions while getting most of the isolation people want from services.`,
          `Boundaries stay cheap to move while you learn the domain, since moving code between modules is still a refactor.`,
          `A module that owns its tables and talks only through its interface can later be extracted with little rework.`
        ],
        cons: [
          `Boundaries decay without tooling such as Shopify's Packwerk, Go <code>internal</code> packages or Python's import-linter.`,
          `Deploys and the process are still shared, so one bad release or memory leak still hits every module.`,
          `All modules share one language and runtime, and they scale together.`
        ],
        pick: `The default for most products past the prototype, and the step before microservices: draw boundaries now, and pay for the network only when a module needs it.`,
        avoid: `When a module already needs its own release cadence, scaling, runtime or isolation, such as a GPU worker beside CRUD APIs; extract that module.`,
        example: `Shopify kept its core Rails app, worked on by more than a thousand developers, as a modular monolith and built Packwerk to flag code that uses another package's private constants.`,
        tools: `Packwerk, Go internal packages, import-linter, Spring Modulith`
      },
      {
        name: `Microservices`,
        what: `Separate services, each owning its data, deployed independently and talking over the network through APIs or events. Fowler describes them as mostly an organizational tool: small teams organized around business capabilities, each owning its services. No service reads another's database; it calls the owner or consumes its events.`,
        pros: [
          `Teams deploy independently, so payments can ship without coordinating with search, and a bad deploy hits one service.`,
          `Each service scales on its own, so a hot image resizer gets more instances without scaling the whole product.`,
          `The network boundary enforces modularity; Fowler lists strong module boundaries, independent deployment and technology diversity as the gains.`
        ],
        cons: [
          `Every call can fail or time out, so you need timeouts, retries, circuit breakers and idempotent handlers everywhere.`,
          `A business operation spanning services cannot use one ACID transaction, so you need sagas, outboxes and eventual consistency.`,
          `You need fast provisioning, monitoring and automated deploys first (Fowler's prerequisites), plus tracing and on-call per service.`,
          `Wrong boundaries are expensive, since fixing them means coordinated API changes and data migrations across teams.`
        ],
        pick: `Several teams that must ship independently, or parts with sharply different scale, runtime or reliability needs, with CI/CD, tracing and on-call already in place.`,
        avoid: `One team, unclear domain boundaries, or no platform to deploy and observe many services; start with a modular monolith instead.`,
        example: `Netflix runs a large microservice architecture and gives UI developers one aggregation layer at the edge instead of exposing hundreds of services to them.`,
        tools: `Kubernetes, gRPC, Kafka, OpenTelemetry, Temporal`
      }
    ],
    compare: [
      [`Deploy unit`, `Whole app`, `Whole app`, `One service`],
      [`Calls between parts`, `Function call`, `Function call through an interface`, `Network call that can fail`],
      [`Cross-part transactions`, `One ACID transaction`, `Local, one database`, `Sagas, eventual consistency`],
      [`Scale parts separately`, `No`, `No`, `Yes`],
      [`Cost to move a boundary`, `Low, a refactor`, `Low, a refactor`, `High, API and data migration`],
      [`Ops overhead`, `Lowest`, `Low, plus boundary linting`, `Highest: per-service CI, tracing, on-call`]
    ],
    decide: [
      [`Do you know the domain boundaries from running the product?`, `No → monolith or modular monolith until you do.`],
      [`Do teams wait on each other's deploys every week?`, `Yes → extract services along those team lines.`],
      [`Does one part need very different scaling, runtime or isolation?`, `Yes → extract just that part as a service.`],
      [`Do you lack CI/CD, tracing or on-call per service?`, `Yes → stay in one deployable for now.`],
      [`Do two services always change in the same PR?`, `Yes → merge them; they are one service.`]
    ],
    scenario: {
      title: `Worked example: an invoicing SaaS adding document processing`,
      setup: `An invoicing product has one Django app, two teams of six and one Postgres database. A third team will build PDF rendering and receipt OCR, which is CPU heavy and bursty. Deploys already collide twice a week.`,
      steps: [
        `Map the domains: billing, customers, documents, notifications. Billing and customers still change together.`,
        `Make the app a modular monolith first: each module owns its tables, and an import linter fails CI on cross-module reach-ins.`,
        `PDF and OCR work is CPU heavy, bursty and owned by one new team, so extract it as a service fed by a queue; it scales alone and its crashes spare billing.`,
        `Keep billing and customers together; splitting them would turn every invoice change into a cross-service transaction.`
      ],
      answer: `A modular monolith for the core plus one document-processing service. Each later split needs a team, scaling or isolation boundary that hurts, not a target service count.`
    },
    mistakes: [
      `Starting a new product as microservices. Boundaries drawn before you know the domain are wrong and costly to move.`,
      `Splitting services but sharing one database. You get network calls and tight coupling at once.`,
      `Splitting by technical layer (API, logic, data services). Every feature then changes all of them.`,
      `Extracting services before tracing and central logs exist. Nobody can tell which hop failed.`
    ],
    rule: `Start with a modular monolith and extract a service only when a specific team, scaling or isolation boundary keeps hurting.`,
    signals: [
      `Deploy queues and merge conflicts across teams every week → split along that team boundary.`,
      `One component needs far more CPU or memory than the rest → extract it.`,
      `Every change to one service needs a matching change in another → merge them or redraw the line.`,
      `Incidents spend most of their time finding the failing service → add tracing before splitting further.`
    ],
    interview: [
      `How would you find the service boundaries in this system?`,
      `How do you keep an order consistent across payment and inventory services?`,
      `What must be in place before you split a monolith?`
    ],
    related: [`c1`, `p1`, `e1`, `e9`],
    deep: [`strangler-fig`, `saga`, `outbox-inbox`],
    db: [],
    sources: [
      { t: `MonolithFirst`, by: `Martin Fowler`, url: `https://martinfowler.com/bliki/MonolithFirst.html` },
      { t: `Microservice Trade-Offs`, by: `Martin Fowler`, url: `https://martinfowler.com/articles/microservice-trade-offs.html` },
      { t: `Deconstructing the Monolith: Designing Software that Maximizes Developer Productivity`, by: `Kirsten Westeinde, Shopify Engineering`, url: `https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity` },
      { t: `Goodbye Microservices: From 100s of problem children to 1 superstar`, by: `Alexandra Noonan, Twilio Segment`, url: `https://www.twilio.com/en-us/blog/developers/best-practices/goodbye-microservices/` }
    ]
  },
  {
    id: `gateway-vs-mesh`,
    area: `APIs and architecture`,
    title: `API gateway vs service mesh vs shared library`,
    question: `Where should cross-cutting concerns like auth, rate limits, retries, timeouts and mTLS live?`,
    summary: `These are not exclusive; most systems use two. A gateway handles north-south traffic, everything entering from outside. A mesh or a shared library handles east-west traffic between your services. Between those two you trade a proxy beside every workload, which works for any language without code changes, against code inside each service that is cheaper and easier to debug but must be upgraded everywhere.`,
    why: `Put business logic in the gateway and every team waits on its releases. Run a mesh for six Go services and you operate a control plane and a proxy per pod for little gain. Use a library across five languages and retry and TLS behavior drift apart.`,
    options: [
      {
        name: `API gateway`,
        what: `A reverse proxy at the edge that every external request passes through. It terminates TLS, authenticates callers (API keys, OAuth tokens, JWTs), enforces rate limits and size limits, and routes each path to a backend service. Some gateways also merge several backend calls into one response; a variant, backends for frontends, gives each client type its own gateway.`,
        pros: [
          `Auth, quotas and TLS are enforced in one place instead of being rebuilt in every service.`,
          `Backends can be split, moved or renamed behind stable public URLs without clients noticing.`,
          `Managed gateways give per-client throttling; AWS API Gateway rate-limits with a token bucket, per account and per API key through usage plans.`
        ],
        cons: [
          `It is an extra hop and a critical component: if the gateway is down, every API is down.`,
          `It becomes a bottleneck when every route or policy change waits on the team that owns it.`,
          `Business logic creeps in until the gateway is a shared monolith nobody owns.`,
          `Managed gateways impose limits: AWS API Gateway REST APIs cap payloads at 10 MB and integration timeouts at 29 seconds unless you give up throttle quota.`
        ],
        pick: `Always, for traffic from outside your network: public APIs, mobile apps and partner integrations.`,
        avoid: `As a home for business logic, or as a hop for internal service-to-service calls; use a mesh or a library inside.`,
        example: `Netflix fronts all its edge services with Zuul, which routes traffic, can change routes at runtime, and sheds load to protect downstream services.`,
        tools: `AWS API Gateway, Kong, Envoy Gateway, NGINX, Apigee`
      },
      {
        name: `Service mesh (Istio, Linkerd)`,
        what: `A proxy runs beside every workload and intercepts its traffic, and a control plane pushes configuration to all the proxies. They add mTLS, retries, timeouts, per-request load balancing, traffic shifting and telemetry with few or no code changes. Istio offers an Envoy sidecar per pod, or ambient mode: a per-node layer 4 proxy plus optional Envoy waypoints for layer 7 features.`,
        pros: [
          `Policies apply the same way to every service in any language, because they live in the proxy, not the code.`,
          `mTLS and identity-based authorization between services come from the platform, not from each team's code.`,
          `Every hop gets uniform metrics and traces, plus canary traffic shifting, without app changes.`
        ],
        cons: [
          `Proxies cost resources: Istio measures about 0.20 vCPU and 60 MB per sidecar for every 1000 requests per second, repeated across every pod.`,
          `The control plane is one more critical system to upgrade, secure and debug.`,
          `Failures get harder to read: a 503 may come from the app or either proxy, and app plus mesh retries can multiply load.`
        ],
        pick: `Many services in several languages, an mTLS mandate, or a need for uniform timeouts, retries and canaries that teams will not build consistently.`,
        avoid: `A few services in one or two languages where a library covers the need, or no team to own the control plane.`,
        example: `A platform team runs Istio across hundreds of Kubernetes services in Go, Java and Node, so security gets mTLS everywhere and every team gets canary releases without code changes.`,
        tools: `Istio, Linkerd, Cilium, Consul, Envoy`
      },
      {
        name: `Shared library`,
        what: `Every service links a common package that applies timeouts, retries with backoff, circuit breaking, trace propagation and auth. In Go that is HTTP middleware plus gRPC interceptors; in Python, a wrapped client and decorators. The service mesh grew out of this approach, from libraries like Twitter's Finagle, Netflix's Hystrix and Google's Stubby.`,
        pros: [
          `There is no extra process or hop, so the added latency and resource cost are close to zero.`,
          `Behavior shows up in your own code and stack traces, so debugging uses tools the team already knows.`,
          `The library sees application context, such as which calls are idempotent and who the user is, which a proxy cannot.`
        ],
        cons: [
          `You need one implementation per language, and they drift apart in behavior.`,
          `A fix reaches production only when every service upgrades and redeploys, so old versions linger.`,
          `Nothing outside the process enforces the policy, so a team can skip or misconfigure it.`,
          `Libraries age: Netflix put Hystrix into maintenance mode and points new projects to resilience4j.`
        ],
        pick: `A small or medium fleet in one or two languages (say Go and Python), with a platform team that owns the library and pushes upgrades.`,
        avoid: `Many languages, or teams you cannot make upgrade; a mesh enforces the policy from outside the code.`,
        example: `A Go and Python shop ships an internal client that sets default timeouts, retries only idempotent calls with jittered backoff, and propagates OpenTelemetry trace headers.`,
        tools: `gRPC interceptors, OpenTelemetry SDKs, resilience4j, Finagle`
      }
    ],
    compare: [
      [`Traffic it covers`, `North-south, from outside`, `East-west, between services`, `East-west, between services`],
      [`Where it runs`, `Edge proxy`, `Proxy per pod or node`, `Inside each process`],
      [`Language support`, `Any`, `Any`, `One implementation per language`],
      [`Extra hops`, `One, at the edge`, `Proxy on each side of a call`, `None`],
      [`Rolling out a fix`, `Update the gateway`, `Push mesh config or upgrade proxies`, `Redeploy every service`],
      [`Main risk`, `Bottleneck, single point of failure`, `Operational complexity`, `Version drift`]
    ],
    decide: [
      [`Does traffic come from outside your network?`, `Yes → an API gateway, whatever you run inside.`],
      [`Must every internal call use mTLS?`, `Yes → a service mesh, or a platform with workload identity.`],
      [`Are services written in three or more languages?`, `Yes → a mesh beats maintaining three libraries.`],
      [`One or two languages, and a team to own a library?`, `Yes → a shared library; revisit as the fleet grows.`],
      [`Is anyone available to run a control plane?`, `No → skip the mesh for now.`]
    ],
    scenario: {
      title: `Worked example: a fintech's internal traffic after an audit`,
      setup: `A fintech has a public API and 40 Go and Python services on Kubernetes. An auditor now requires encryption and authentication on every internal call, and last month a retry storm, from retries coded three different ways, caused an outage.`,
      steps: [
        `The public edge keeps its API gateway for API keys, per-customer rate limits and size limits.`,
        `Encryption plus authentication on every hop is mTLS with workload identity; a mesh provides it without certificate code in 40 services.`,
        `Fix retries by choosing one layer: mesh retries for idempotent calls only, with a cap, and delete the ad hoc retry code.`,
        `Weigh cost: sidecars on every pod are expensive, so consider ambient mode, adding waypoints only where L7 features are needed.`
      ],
      answer: `Gateway at the edge, a mesh inside for mTLS and uniform timeouts, and a thin library for app context such as trace IDs and user identity. Without the mTLS mandate, a shared library alone would have been enough.`
    },
    mistakes: [
      `Putting orchestration or business rules in the gateway. It becomes a monolith every team must change.`,
      `Retrying in the app, the library and the mesh at once. Attempts multiply at each layer and turn a slowdown into a storm.`,
      `Adopting a mesh with nobody to own it. Control plane upgrades and proxy debugging land on whoever is on call.`,
      `Sending internal calls through the public gateway. It adds a hop and a bottleneck for traffic it was not built for.`
    ],
    rule: `Always put a gateway at the edge; inside, use a shared library until languages, fleet size or an mTLS mandate make a mesh pay for itself.`,
    signals: [
      `An auditor requires mTLS on every internal call → adopt a mesh or a platform with workload identity.`,
      `Services run three versions of the retry library with different defaults → centralize the policy.`,
      `Only external clients need auth and rate limits → a gateway alone is enough.`,
      `Sidecar CPU is a big share of the cluster bill → try ambient mode, or a library on hot paths.`
    ],
    interview: [
      `What handles north-south traffic, what handles east-west, and why?`,
      `Where should retries live, and how do you stop them multiplying?`,
      `What does a sidecar cost, and when is it worth it?`
    ],
    related: [`p5`, `r3`, `r4`, `o2`],
    deep: [`circuit-breaker`, `rate-limiting`],
    db: [],
    sources: [
      { t: `What is Istio?`, by: `Istio`, url: `https://istio.io/latest/docs/overview/what-is-istio/` },
      { t: `Performance and Scalability`, by: `Istio`, url: `https://istio.io/latest/docs/ops/deployment/performance-and-scalability/` },
      { t: `What is a service mesh?`, by: `Linkerd`, url: `https://linkerd.io/what-is-a-service-mesh/` },
      { t: `Pattern: API Gateway / Backends for Frontends`, by: `Chris Richardson, microservices.io`, url: `https://microservices.io/patterns/apigateway.html` }
    ]
  },
  {
    id: `pagination`,
    area: `APIs and architecture`,
    title: `Offset vs cursor (keyset) pagination`,
    question: `How should clients page through a list that is large, or that changes while they read it?`,
    summary: `Offset paging tells the database to skip N rows on every request. That gives page numbers, but deep pages get slower and rows shift when data changes. Keyset (cursor) paging remembers the last row seen and seeks past it through an index, so every page is fast and stable, but you lose jumping to page N and cheap totals.`,
    why: `Offset on a big table turns deep pages and full exports into slow scans, and users see duplicates or miss rows as new items arrive. A cursor on a small admin table just takes away the page numbers people want.`,
    options: [
      {
        name: `Offset and limit`,
        what: `The client asks for page N of size K, and the server runs <code>ORDER BY created_at DESC, id DESC LIMIT K OFFSET (N-1)*K</code>. It is stateless and maps directly onto page numbers. The catch is mechanical: Postgres documents that rows skipped by OFFSET still have to be computed inside the server, so page 1,000 makes the database produce and discard 999 pages of rows first.`,
        pros: [
          `It is trivial to build, every SQL database and ORM supports it, and page N is just a number in the URL.`,
          `Users can jump to page 7 or the last page, which admin tables and capped search results often need.`,
          `On small tables it pairs easily with a total count to show page 3 of 40.`
        ],
        cons: [
          `Each deeper page is slower than the last, because every skipped row is still read and thrown away.`,
          `Results drift: a row inserted between requests shifts everything down, so the reader sees a duplicate or misses a row.`,
          `Without ORDER BY on a unique key the order is undefined, and Postgres warns that different LIMIT and OFFSET values can then give inconsistent results.`,
          `Walking a whole table by offset does quadratic total work, so exports and sync jobs hammer the database.`
        ],
        pick: `Small or bounded lists that people browse: admin screens, back-office tables, and search results capped at a few pages.`,
        avoid: `Large or fast-changing tables, infinite scroll, public list APIs and exports; use keyset cursors there.`,
        example: `Elasticsearch refuses <code>from</code> plus <code>size</code> past 10,000 hits by default (<code>index.max_result_window</code>) and sends deep paging to <code>search_after</code>, a keyset method.`,
        tools: `SQL LIMIT and OFFSET, Django Paginator, Spring Data Pageable`
      },
      {
        name: `Cursor (keyset)`,
        what: `Sort by a unique, indexed key such as <code>(created_at, id)</code> and hand the client the last row's values as an opaque cursor. The next request seeks past it: <code>WHERE (created_at, id) &lt; (:ts, :id) ORDER BY created_at DESC, id DESC LIMIT 50</code>. With a matching index the database jumps straight to that spot, so page 1,000 costs about the same as page 1.`,
        pros: [
          `Every page costs about the same, since the index seek skips earlier rows instead of reading them.`,
          `Pages stay stable under inserts, because the cursor points at a value, not a position.`,
          `It fits infinite scroll, sync jobs and full exports, where clients only ever ask for the next page.`,
          `An opaque token, like Slack's base64 cursor, lets you change what is inside later without breaking clients.`
        ],
        cons: [
          `There is no jumping to page N and no free total, the two trade-offs Slack names for its cursor design.`,
          `Each sort order needs a matching index ending in a unique tiebreaker, or rows with equal sort values get skipped or repeated.`,
          `Row values are not portable: MySQL evaluates <code>(a, b) &lt; (x, y)</code> correctly but cannot use it for index access, so you expand it into AND and OR terms.`,
          `Cursors must stay bound to their filters; Google's AIP-158 says a request that changes other parameters alongside a page token should be rejected.`
        ],
        pick: `The default for APIs, feeds, infinite scroll, exports and any table that can grow without bound.`,
        avoid: `When users must jump to arbitrary pages or sort by many arbitrary columns; use offset on small results, or a search engine.`,
        example: `Stripe lists take <code>starting_after</code> or <code>ending_before</code> with an object ID and return <code>has_more</code>. Slack moved its Web API to opaque <code>next_cursor</code> tokens after offsets stopped scaling.`,
        tools: `SQL row values, DynamoDB LastEvaluatedKey, Elasticsearch search_after, GraphQL connections`
      }
    ],
    compare: [
      [`Cost of deep pages`, `Grows with the offset`, `Flat, with a matching index`],
      [`Stable under inserts`, `No, rows shift`, `Yes`],
      [`Jump to page N`, `Yes`, `No, next and previous only`],
      [`Total count`, `Easy on small tables`, `Separate query or an estimate`],
      [`Index needed`, `On the sort columns`, `Sort columns plus a unique tiebreaker`],
      [`Best for`, `Small lists people browse`, `APIs, feeds, exports`]
    ],
    decide: [
      [`Can the list grow without bound?`, `Yes → keyset cursors.`],
      [`Do users need page numbers, or a jump to page N, on a small list?`, `Yes → offset.`],
      [`Will clients walk the whole list, as in exports or sync?`, `Yes → keyset, with a sort that ends in a unique key.`],
      [`Do new rows arrive while people scroll?`, `Yes → keyset; offsets will skip or repeat items.`],
      [`Must users sort by many arbitrary columns?`, `Yes → offset over a capped result, or a search engine.`]
    ],
    scenario: {
      title: `Worked example: a transactions API for merchants`,
      setup: `A payments company exposes <code>GET /transactions</code>, newest first. Large merchants have tens of millions of rows, new ones arrive every second, and finance teams export a whole month through the API.`,
      steps: [
        `Offset fails both needs: deep pages make the database discard millions of rows each time, and new rows shift pages so the export double counts some transactions.`,
        `Use keyset on <code>(created_at, id)</code> descending, backed by an index on <code>(merchant_id, created_at, id)</code>, so every page is one index seek.`,
        `Return an opaque cursor that encodes the last <code>created_at</code>, the last <code>id</code> and the filters, and reject it if the filters change.`,
        `Drop the exact total from list calls, since Postgres must check every row's visibility to count; show an estimate instead.`,
        `Cap <code>limit</code>; Stripe allows 1 to 100, with a default of 10.`
      ],
      answer: `Keyset cursors over a composite index, with opaque tokens bound to their filters. Offset survives only on the internal admin screen, where support staff browse a few pages of one merchant's disputes.`
    },
    mistakes: [
      `Sorting by <code>created_at</code> alone. Rows with equal timestamps are skipped or repeated at page edges.`,
      `Exposing raw IDs or offsets as the cursor. Clients start building them by hand and the format is frozen.`,
      `Running <code>COUNT(*)</code> on every page request. On a big Postgres table that is a full visibility scan each time.`,
      `Adding pagination after launch. Google's AIP-158 calls that a backward-incompatible change for a list call.`,
      `Keyset without the matching index. The query still works but scans and sorts, so you lose the benefit.`
    ],
    rule: `Use keyset cursors for anything that can grow, and offsets only for small, bounded lists that people browse.`,
    signals: [
      `Page 1 is fast but deep pages are slow → you are paying for offset; switch to keyset.`,
      `Users see duplicates while scrolling a live feed → offsets are shifting; use a cursor.`,
      `Support needs page 30 of a small table → offset is fine there.`,
      `The cursor query plan shows a sort step → add the composite index with the tiebreaker.`
    ],
    interview: [
      `Why does OFFSET slow down on deep pages, and what does keyset do instead?`,
      `How do you handle ties in the sort key?`,
      `How would you show a total on a table with a billion rows?`
    ],
    related: [`k7`, `c9`],
    deep: [],
    db: [`relational`, `search`, `key-value`],
    sources: [
      { t: `LIMIT and OFFSET`, by: `PostgreSQL Documentation`, url: `https://www.postgresql.org/docs/current/queries-limit.html` },
      { t: `Paging Through Results`, by: `Markus Winand, Use The Index, Luke`, url: `https://use-the-index-luke.com/sql/partial-results/fetch-next-page` },
      { t: `Evolving API Pagination at Slack`, by: `Michael Hahn, Slack Engineering`, url: `https://slack.engineering/evolving-api-pagination-at-slack/` },
      { t: `AIP-158: Pagination`, by: `Google API Improvement Proposals`, url: `https://google.aip.dev/158` }
    ]
  },
  {
    id: `compute-platform`,
    area: `Infrastructure`,
    title: `EC2 vs ECS vs Kubernetes vs Lambda`,
    question: `Where should this service run, and how much of the platform do you want to operate?`,
    summary: `The options sit on one line, from owning the machine (EC2) to owning only your function code (Lambda). Each step hands AWS more of the work, like patching, scheduling and scaling, in exchange for less control and, at steady load, often a higher unit cost. Kubernetes sits off that line: the most portable and extensible option, and the most platform to run.`,
    why: `Too little platform and the team hand-builds deploys, health checks and scaling on VMs. Too much and a small team spends its weeks upgrading Kubernetes. Lambda for a busy, steady service means paying per request for work an always-on container does more cheaply.`,
    options: [
      {
        name: `EC2 VMs`,
        what: `You rent virtual machines, choose the instance type, and run your process on the OS, usually from an image built in CI and managed by an Auto Scaling group behind a load balancer. Under AWS's shared responsibility model you own the guest OS, its security patches, and everything installed on it.`,
        pros: [
          `You get full control of the host: kernel settings, network tuning, GPUs, local disks and any software or license.`,
          `Steady, predictable load is cheap, since a right-sized instance runs busy all day with no per-request charge.`,
          `There is no orchestration layer to learn, which suits one large stateful process such as a self-managed database.`
        ],
        cons: [
          `OS patching, image builds, config drift and hardening are all your job.`,
          `Deploys, health checks and rolling restarts must be assembled from Auto Scaling groups, images and scripts.`,
          `Packing small services onto VMs is manual, so instances often sit mostly idle.`
        ],
        pick: `Workloads that need the host: kernel or network tuning, special GPU drivers, licensed software, media servers, or one big stateful process sized for steady load.`,
        avoid: `A fleet of ordinary stateless services, where you would rebuild what ECS or Kubernetes already provides; use ECS.`,
        example: `A self-managed Kafka cluster on storage-optimized instances, where the team tunes disks, page cache and JVM settings node by node.`,
        tools: `EC2 Auto Scaling, Packer, Ansible, Systems Manager`
      },
      {
        name: `Amazon ECS`,
        what: `AWS's own container orchestrator. A task definition describes each service (image, CPU, memory, ports, IAM role), and the ECS scheduler keeps the desired number of tasks running and replaces failed ones. Tasks run on Fargate with no servers to manage, on EC2 instances you manage, or on ECS Managed Instances, where AWS provisions and patches the instances.`,
        pros: [
          `ECS orchestration itself is free; you pay only for the compute and resources underneath.`,
          `There are no cluster versions to upgrade, and it plugs straight into ALB, IAM, CloudWatch and Secrets Manager.`,
          `On Fargate you manage no servers and pay for requested vCPU, memory and storage per second, with a one-minute minimum.`
        ],
        cons: [
          `It runs only on AWS, so moving clouds means rewriting your deploy definitions.`,
          `The ecosystem is far smaller than Kubernetes': no operators, no Helm charts, few third-party controllers.`,
          `Fargate restricts the host: tasks must use <code>awsvpc</code> networking and cannot run privileged containers or request GPUs.`
        ],
        pick: `AWS-only teams running containerized services who want scheduling, rolling deploys and autoscaling without running Kubernetes; Fargate if you want no servers at all.`,
        avoid: `When you need portability or the Kubernetes ecosystem (operators, Helm, custom controllers); use EKS.`,
        example: `A 15-person team runs 20 Go and Python APIs as ECS services on Fargate behind one ALB, each with its own IAM role and CPU-based autoscaling.`,
        tools: `Amazon ECS, AWS Fargate, ECS Managed Instances, Terraform`
      },
      {
        name: `Kubernetes (EKS)`,
        what: `An open source orchestrator: you declare desired state (Deployments, Services, autoscalers) and controllers keep driving the cluster toward it, handling service discovery, rolling updates, self-healing and bin packing. Google open sourced it in 2014, building on over 15 years of running production workloads. EKS runs the control plane; you still own nodes, add-ons and version upgrades.`,
        pros: [
          `The same API runs on every major cloud and on premises, so manifests and skills carry over.`,
          `The ecosystem is huge: Helm charts, operators for databases and queues, meshes and autoscalers all plug into one API.`,
          `Custom resources and controllers let a platform team build its own abstractions on top.`
        ],
        cons: [
          `Upgrades never stop: each minor version gets about a year of upstream patches, and EKS charges $0.60 instead of $0.10 per cluster hour after 14 months of standard support.`,
          `Ingress, networking, RBAC, secrets, logging and monitoring are separate pieces you choose, install and keep current.`,
          `It usually needs a platform team; for a small team, the cluster becomes the product.`
        ],
        pick: `Large fleets and many teams, with a platform team to run it and a real need for operators, custom controllers or portability.`,
        avoid: `A small team with a handful of services and no platform engineers; ECS on Fargate gives most of the benefit with far less to run.`,
        example: `A company with dozens of teams shares EKS clusters, and a platform team provides templates, ingress, observability and upgrades, so product teams only ship manifests.`,
        tools: `Amazon EKS, Helm, Karpenter, Argo CD`
      },
      {
        name: `AWS Lambda`,
        what: `You upload a function, and AWS runs it in response to events: an HTTP request, an S3 upload, a queue message, a schedule. Each execution environment serves one request at a time, so concurrency equals environments, and billing is per request plus duration in GB-seconds. A new environment runs your init code first (a cold start), then stays warm for reuse.`,
        pros: [
          `There are no servers, OS or scaling policies to manage, and no charge while it sits idle unless you buy provisioned concurrency.`,
          `Native triggers from S3, SQS, EventBridge and API Gateway make event-driven glue a few lines of code.`,
          `AWS says cold starts typically hit under 1 percent of invocations, and provisioned concurrency pre-warms environments for latency-critical paths.`
        ],
        cons: [
          `A standard invocation runs at most 15 minutes, and synchronous requests and responses are capped at 6 MB each.`,
          `A cold start adds from under 100 ms to over 1 second, which hurts tight latency targets.`,
          `Concurrency defaults to 1,000 per region, shared by all functions, so one runaway function can throttle the rest unless you reserve concurrency.`,
          `Thousands of environments can each open a database connection; RDS Proxy pools connections to protect the database.`
        ],
        pick: `Spiky or low-volume event work: S3 and queue triggers, webhooks, scheduled jobs, and APIs that sit idle most of the day.`,
        avoid: `Steady high-throughput services, where a busy container usually costs less, plus jobs over 15 minutes and strict tail-latency paths; use ECS.`,
        example: `An S3 upload trigger that writes a thumbnail and its metadata, runs a few thousand times a day, and costs nothing between uploads.`,
        tools: `AWS Lambda, EventBridge, SQS, RDS Proxy, AWS SAM`
      }
    ],
    compare: [
      [`You manage`, `OS, runtime, deploys, scaling`, `Task definitions; instances unless Fargate`, `Nodes, add-ons, upgrades`, `Function code and settings`],
      [`Unit of scaling`, `Whole VM`, `Task`, `Pod`, `One environment per in-flight request`],
      [`Pricing`, `Instance running time`, `Compute only; ECS itself is free`, `Compute plus a cluster-hour fee`, `Per request plus GB-seconds`],
      [`Longest run`, `Unlimited`, `Unlimited`, `Unlimited`, `15 minutes per invocation`],
      [`Portability`, `Any cloud with VMs`, `AWS only`, `Any Kubernetes`, `AWS only`],
      [`Ops effort`, `High`, `Low to medium`, `Highest, needs a platform team`, `Lowest`]
    ],
    decide: [
      [`Is traffic idle most of the day, in short bursts, with jobs under 15 minutes?`, `Yes → Lambda.`],
      [`Do you need kernel tuning, privileged access or special GPU drivers?`, `Yes → EC2, or ECS on EC2 instances.`],
      [`Is there a platform team, and a need for operators or multi-cloud?`, `Yes → Kubernetes (EKS).`],
      [`Is it an AWS-only team running ordinary containerized services?`, `Yes → ECS, on Fargate to skip servers.`],
      [`Is it a long-lived service with steady heavy load?`, `Yes → containers or VMs kept busy, not Lambda.`]
    ],
    scenario: {
      title: `Worked example: placing the parts of an online-class product`,
      setup: `Eight engineers, no platform team, all on AWS. They run a REST API with steady daytime traffic, a nightly report job that takes 40 minutes, a thumbnail generator triggered by uploads, and a live-class media server that needs privileged access and host tuning.`,
      steps: [
        `The API is a long-lived service with steady load, so it runs as an ECS service on Fargate behind an ALB.`,
        `Thumbnails are short, bursty and triggered by S3 uploads, a textbook Lambda job that costs nothing when idle.`,
        `The report runs 40 minutes, past Lambda's 15-minute cap, so it becomes a scheduled ECS task.`,
        `Fargate rejects privileged containers, so the media server runs on EC2, or ECS on EC2 instances.`,
        `Kubernetes is not worth it yet: with no platform team, upgrades and add-ons would eat the team's time.`
      ],
      answer: `ECS on Fargate for the API and the report, Lambda for the upload trigger, and EC2 for the media server. Revisit EKS when the fleet and team can staff a platform team.`
    },
    mistakes: [
      `Running Kubernetes with no platform team. Upgrades, add-ons and networking become a second product nobody staffed.`,
      `Pointing thousands of Lambda environments at Postgres directly. Connection storms exhaust it; put RDS Proxy in between.`,
      `Defaulting a steady, high-traffic API to Lambda. Per-request pricing can cost more than a busy container.`,
      `Ignoring the shared Lambda concurrency pool. One runaway function throttles every other function in the region.`
    ],
    rule: `Pick the least platform that runs the workload: Lambda for event glue, ECS for services on AWS, EC2 when you need the host, and Kubernetes only with the scale and people for it.`,
    signals: [
      `Traffic is near zero most of the day with short bursts → Lambda.`,
      `There is no platform team → ECS over Kubernetes.`,
      `A job keeps running past 15 minutes → move it to an ECS task or split it into steps.`,
      `The workload needs privileged access or kernel tuning → EC2, or ECS on EC2 instances.`
    ],
    interview: [
      `Why not run everything on Lambda?`,
      `What do you still own on EKS that you would not own on ECS with Fargate?`,
      `How do you stop Lambda from overwhelming a relational database?`
    ],
    related: [`e3`, `h6`, `c3`],
    deep: [],
    db: [],
    sources: [
      { t: `Lambda quotas`, by: `AWS Documentation`, url: `https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html` },
      { t: `Understanding the Lambda execution environment lifecycle`, by: `AWS Documentation`, url: `https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtime-environment.html` },
      { t: `Amazon ECS task definition differences for Fargate`, by: `AWS Documentation`, url: `https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html` },
      { t: `Amazon EKS pricing`, by: `AWS`, url: `https://aws.amazon.com/eks/pricing/` }
    ]
  },
  {
    id: `scaling`,
    area: `Infrastructure`,
    title: `Vertical vs horizontal scaling`,
    question: `When load grows, do you get a bigger machine or more machines?`,
    summary: `Scaling up keeps one machine and makes it bigger: no code changes, but a hard ceiling and one large failure domain. Scaling out adds machines: near-unlimited capacity and no single box to lose, but only if the tier is stateless or the data is split. Most systems do both: stateless tiers out, stateful tiers up until up runs out.`,
    why: `Shard a database that one bigger instance could have handled and you buy years of cross-shard queries and rebalancing for nothing. Scale a stateless tier up instead of out and one box stays your single point of failure.`,
    options: [
      {
        name: `Vertical (scale up)`,
        what: `Move the same workload to a bigger instance with more vCPUs, memory, disk or network. For a database this often means the working set fits in memory again, so reads stop hitting disk. Nothing changes in the code or the architecture. Resizing usually needs a restart: on RDS, changing the instance class causes downtime, which a Multi-AZ setup shortens by failing over.`,
        pros: [
          `There are no code changes and no new failure modes; the app still talks to one database or one process.`,
          `Transactions, joins, locks and unique constraints keep working exactly as before, which is why it is the first move for relational databases.`,
          `It is quick: one change in the console or in Terraform instead of a project.`
        ],
        cons: [
          `There is a hard ceiling; once you are on the largest instance there is nowhere left to go.`,
          `One big machine is one big failure domain, and the AWS Well-Architected reliability pillar advises replacing one large resource with several small ones.`,
          `Resizing needs a restart or a failover, so it is a planned event, not an automatic response to a spike.`,
          `You pay for peak size all day, because one box cannot shrink at night without another restart.`
        ],
        pick: `The first move for databases and other stateful systems, and for any tier where one bigger box buys a year or more of headroom.`,
        avoid: `When you are near the largest size, when one machine dying is itself the availability risk, or when load swings widely within a day.`,
        example: `In 2016 Stack Overflow served about 209 million HTTP requests a day from 9 primary web servers and two SQL Server clusters, the main one on machines with 384 GB of RAM.`,
        tools: `RDS instance classes, EC2 instance types, Kubernetes VPA`
      },
      {
        name: `Horizontal (scale out)`,
        what: `Run more copies and spread the work. For a stateless tier, put N identical instances behind a load balancer and let an autoscaler change N; this only works if any instance can serve any request, so sessions and files live in Redis, a database or S3. For data, add read replicas for reads first, then split writes across shards by key.`,
        pros: [
          `Capacity for stateless tiers grows almost without limit: add instances and the load balancer spreads the requests.`,
          `Losing one of many small instances removes only its share of capacity, which is why AWS recommends many small resources over one large one.`,
          `Capacity can follow load both ways; the Kubernetes HPA, for example, recomputes the replica count every 15 seconds by default.`,
          `Read replicas add read capacity without touching writes, and an Aurora cluster can have up to 15 of them.`
        ],
        cons: [
          `The app must be stateless; in-memory sessions or local files break as soon as another instance serves the next request.`,
          `Replicas are asynchronous, so a read right after a write can return stale data unless you send it to the primary.`,
          `Sharding writes is a big change that is hard to undo: cross-shard queries, transactions, rebalancing and hot keys become your problem.`
        ],
        pick: `Stateless services behind a load balancer, read-heavy databases through replicas, and stores built to partition, such as DynamoDB or Cassandra.`,
        avoid: `Sharding a relational primary before trying a bigger instance, read replicas and caching, or scaling out an app that still keeps state in memory.`,
        example: `Netflix's active-active design requires every service on the user call path to be stateless, with all state replication handled in the data tier.`,
        tools: `Load balancers, EC2 Auto Scaling, Kubernetes HPA, read replicas, Redis`
      }
    ],
    compare: [
      [`Code changes`, `None`, `Stateless app; shard-aware data access`],
      [`Ceiling`, `Largest instance size`, `Near unlimited for stateless tiers`],
      [`One node fails`, `Whole service down until failover`, `Lose that node's share`],
      [`Resizing`, `Restart or failover`, `Add or remove instances live`],
      [`Writes to one database`, `Fine until the ceiling`, `Needs sharding, hard to undo`],
      [`Follows daily load`, `No, sized for peak`, `Yes, with autoscaling`]
    ],
    decide: [
      [`Is the tier stateless, or can it be made stateless?`, `Yes → scale out behind a load balancer.`],
      [`Is it the primary database, with bigger instances still available?`, `Yes → scale up first.`],
      [`Are most database queries reads?`, `Yes → add read replicas and a cache before sharding.`],
      [`Must it survive one node dying?`, `Yes → run at least two instances in different AZs, whatever the load.`],
      [`Do writes exceed what the biggest instance can take?`, `Yes → shard by a key, or move to a store built to partition.`]
    ],
    scenario: {
      title: `Worked example: an online store before a big sale`,
      setup: `A store runs a Python API on 4 instances and one Postgres primary. Marketing expects 5x normal traffic for a weekend sale. Database CPU already peaks at 70 percent, and most queries are product reads.`,
      steps: [
        `The API keeps carts in process memory, so move sessions and carts to Redis first; now any instance can serve any request.`,
        `Scale the API out with autoscaling on CPU or request count, spread over at least two AZs.`,
        `Reads dominate the database, so add a read replica and a cache for product pages, keeping checkout on the primary to avoid stale reads.`,
        `Scale the primary up one size before the sale, in a planned failover window, to give writes headroom.`,
        `Do not shard: the writes fit on one bigger box, and sharding is a long project that makes every cross-order query harder.`
      ],
      answer: `Scale out the stateless API, scale up the database primary, and move reads to replicas and a cache. Shard only when writes outgrow the largest instance.`
    },
    mistakes: [
      `Scaling out an app with in-memory sessions. Users lose carts or get logged out as the balancer moves them around.`,
      `Sharding early. You pay for cross-shard queries, rebalancing and hot keys long before one bigger machine would have run out.`,
      `Reading your own write from a lagging replica. The user saves a change, reloads and sees the old value.`,
      `Running one big instance with no standby because it is fast enough. Speed does not help when that box dies.`
    ],
    rule: `Scale stateless tiers out and stateful tiers up, use replicas and caches for reads, and shard only when writes outgrow the biggest machine.`,
    signals: [
      `The service keeps state in memory → make it stateless before scaling out.`,
      `Database CPU is high but the working set would fit in RAM on a bigger box → scale up.`,
      `Reads dominate the database → add replicas and a cache before thinking about shards.`,
      `You are one size below the largest instance and writes keep growing → plan sharding or a distributed database now.`
    ],
    interview: [
      `What must be true of a service before you can scale it out?`,
      `How do you scale a relational database, step by step?`,
      `When is scaling up the better answer?`
    ],
    related: [`c4`, `c3`, `d3`, `d5`],
    deep: [`sharding-consistent-hashing`, `cache-aside-stampede`],
    db: [`relational`, `distributed-sql`],
    sources: [
      { t: `Design principles (Reliability Pillar)`, by: `AWS Well-Architected Framework`, url: `https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/design-principles.html` },
      { t: `VI. Processes`, by: `The Twelve-Factor App`, url: `https://12factor.net/processes` },
      { t: `Stack Overflow: The Architecture - 2016 Edition`, by: `Nick Craver`, url: `https://nickcraver.com/blog/2016/02/17/stack-overflow-the-architecture-2016-edition/` },
      { t: `Horizontal Pod Autoscaling`, by: `Kubernetes Documentation`, url: `https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/` }
    ]
  },
  {
    id: `multi-region`,
    area: `Infrastructure`,
    title: `Multi-AZ vs active-passive vs active-active`,
    question: `How big an outage must you survive, and how much downtime and data loss can you accept?`,
    summary: `Each step buys a shorter recovery time (RTO) and less lost data (RPO) with more money and complexity. Multi-AZ survives a data center failure inside one region. A standby region recovers from losing a whole region in tens of minutes or minutes. Active-active serves from several regions at once and recovers almost instantly, but makes you design for write conflicts.`,
    why: `Overbuild and you pay for spare regions, conflict handling and harder on-call that the business never needed. Underbuild, or never test the standby, and a region outage becomes hours of downtime and lost data.`,
    options: [
      {
        name: `Single region, multi-AZ`,
        what: `Run in one region but spread across two or three Availability Zones, each one or more separate data centers with their own power and networking, all within 100 km of each other. Load balancers and autoscaling span AZs, and the database keeps a synchronous standby in another AZ (RDS Multi-AZ) for automatic failover. For a region loss, you rebuild elsewhere from backups.`,
        pros: [
          `AZs are close enough for synchronous replication, so an AZ failover loses no committed data.`,
          `Managed services do most of the work: load balancers span AZs and RDS Multi-AZ fails over on its own.`,
          `There are no cross-region consistency or conflict problems to design for.`
        ],
        cons: [
          `A full region outage takes you down until you restore from backups elsewhere, which AWS puts at hours of RTO and RPO.`,
          `Surviving AZs need spare capacity already running; the Builders' Library warns against relying on scaling up during an AZ event.`,
          `Users far from the region pay extra latency on every request, and the synchronous standby adds a little write latency.`
        ],
        pick: `The default for most products: it handles the common failures (an instance, a data center) at modest cost. Copy backups to another region and keep infrastructure as code so a rebuild is possible.`,
        avoid: `When a contract or regulator requires surviving a region outage with a short RTO, or users on other continents need low latency.`,
        example: `A B2B SaaS in one region across three AZs, with RDS Multi-AZ, an ALB, cross-region backup copies, and Terraform that can rebuild the stack in another region.`,
        tools: `RDS Multi-AZ, Aurora, ALB, EC2 Auto Scaling, AWS Backup`
      },
      {
        name: `Active-passive (pilot light or warm standby)`,
        what: `A second region holds a copy of the data through asynchronous replication (Aurora Global Database, cross-region replicas, S3 replication) but serves no traffic. In a pilot light only the data tier runs and app servers stay off until failover; in a warm standby a smaller but working copy runs all the time. Failover promotes the replica and moves traffic with DNS or Global Accelerator.`,
        pros: [
          `It survives losing a whole region; AWS rates pilot light at tens of minutes and warm standby at minutes of RTO and RPO.`,
          `Writes happen in one region only, so there are no write conflicts to resolve.`,
          `A warm standby can take traffic immediately, which makes regular failover tests practical.`
        ],
        cons: [
          `Asynchronous replication loses writes made just before the failure; your RPO is the replication lag, typically seconds on Aurora Global Database.`,
          `It works only if rehearsed: configs, quotas and runbooks drift, and AWS calls regular DR testing critical.`,
          `Automatic failover can fire on a false alarm, so many teams trigger it by hand but script every step.`
        ],
        pick: `When the business sets a region-loss recovery time of minutes to an hour and can accept seconds of lost writes.`,
        avoid: `When nobody will run failover drills, or when the RTO must be near zero; consider active-active then.`,
        example: `Aurora Global Database replicates to a secondary region with typical lag under a second, and AWS says a secondary can be promoted to take writes in under a minute.`,
        tools: `Aurora Global Database, S3 replication, Route 53 failover, Global Accelerator, ARC`
      },
      {
        name: `Active-active`,
        what: `Two or more regions serve live traffic at once, with users routed to a nearby healthy region. Each region must be able to absorb the others' traffic, and services must be stateless and call only local resources. Writes are the hard part: send all writes to one region (write global), give each user a home region (write partitioned), or accept writes everywhere and merge conflicts (write local).`,
        pros: [
          `Recovery from a region loss is close to instant, since the other regions already serve traffic; AWS rates it at real-time RTO and RPO.`,
          `Users get lower latency from a nearby region.`,
          `There is no cold failover path: every region is exercised every day, so problems surface early.`
        ],
        cons: [
          `Writes in several regions conflict; DynamoDB global tables resolve concurrent updates with last writer wins, which silently drops one of them.`,
          `Globally consistent data such as balances needs one write region or a consensus database, and Spanner notes that cross-region write quorums add write latency.`,
          `AWS calls it the most complex and costly DR option, and every region needs spare capacity for a failed region's load.`,
          `Corruption and bad deletes replicate everywhere too, so you still need point-in-time backups.`
        ],
        pick: `Global users who need low latency, or a near-zero RTO, with data that partitions cleanly by user or region, or merges safely.`,
        avoid: `When data needs global strong consistency and nobody has designed for conflicts, or when the team cannot yet run one region reliably.`,
        example: `Netflix runs active-active across AWS regions: stateless services, Cassandra replicating asynchronously between regions, geo-DNS splitting users roughly evenly, and tooling to send all traffic to one region during an outage.`,
        tools: `DynamoDB global tables, Spanner, CockroachDB, Cassandra, Route 53 latency routing`
      }
    ],
    compare: [
      [`Survives`, `An AZ (data center) failure`, `A region loss, after failover`, `A region loss, almost at once`],
      [`Region-loss RTO (AWS figures)`, `Hours, restore from backups`, `Tens of minutes to minutes`, `Near zero`],
      [`Region-loss RPO`, `Since the last backup copy`, `Replication lag, often seconds`, `Near zero, conflicts aside`],
      [`Write conflicts`, `None`, `None, one write region`, `Must be designed for`],
      [`Relative cost`, `Lowest`, `Medium`, `Highest`],
      [`What you must test`, `Restores from backup`, `Regular failover drills`, `Region evacuation`]
    ],
    decide: [
      [`Must you survive a full region outage by contract or regulation?`, `No → multi-AZ plus tested cross-region backups.`],
      [`Is a region-loss RTO of tens of minutes acceptable?`, `Yes → pilot light; for minutes, warm standby.`],
      [`Do you need near-zero RTO, or low latency on several continents?`, `Yes → active-active, if the data partitions or merges cleanly.`],
      [`Must data such as balances stay strongly consistent globally?`, `Yes → one write region, or a consensus database such as Spanner.`],
      [`Must data stay inside one country?`, `Yes → pin each tenant to a home region instead of replicating everywhere.`]
    ],
    scenario: {
      title: `Worked example: a payments API with a 15-minute recovery target`,
      setup: `A payments API runs in one AWS region. A new enterprise contract requires recovery from a full region outage within 15 minutes, losing at most a few seconds of transactions. Users are in one country, and balances must never diverge.`,
      steps: [
        `Multi-AZ alone fails the contract, because a region loss would mean restoring from backups, which takes hours.`,
        `Balances must not diverge, so writes stay in one region; that rules out write-local active-active.`,
        `Fifteen minutes fits a warm standby: a smaller copy of the stack runs in a second region, fed by Aurora Global Database with lag usually under a second.`,
        `Fail over by hand but scripted: promote the Aurora secondary, scale out the standby, and flip traffic with Route 53 health checks driven by ARC routing controls, a data plane switch.`,
        `Run failover drills on a schedule and measure the real RTO and RPO each time.`
      ],
      answer: `Warm standby with a single write region. It meets 15 minutes and seconds of RPO at far lower cost and risk than active-active, and balances never face write conflicts.`
    },
    mistakes: [
      `Building a standby region and never failing over to it. Configs and quotas drift, and the first real failover fails.`,
      `Writing in two regions without a conflict strategy. Last writer wins silently drops updates.`,
      `Depending on control plane actions, like launching instances, during the outage. AWS advises using only data plane operations to fail over.`,
      `Treating replication as backup. Corruption and accidental deletes replicate too.`
    ],
    rule: `Start multi-AZ with cross-region backups, add a standby region when the business sets a region-loss RTO you cannot otherwise meet, and go active-active only for data that partitions or merges cleanly.`,
    signals: [
      `The contract allows hours of recovery → multi-AZ plus tested cross-region restores.`,
      `The required RTO is minutes and RPO seconds → warm standby with asynchronous replication.`,
      `Data residency laws keep data in a country → region-pinned tenants, not global replication.`,
      `Most outages come from deploys, not AZ or region failures → invest in rollbacks and canaries first.`
    ],
    interview: [
      `What are RTO and RPO, and what does each option give you?`,
      `How do you fail over without depending on things that may be broken?`,
      `How would you handle writes in an active-active design?`
    ],
    related: [`r5`, `r6`, `e7`, `t7`],
    deep: [`leader-election-fencing`],
    db: [`distributed-sql`, `wide-column`, `key-value`],
    sources: [
      { t: `Disaster recovery options in the cloud`, by: `AWS Whitepaper: Disaster Recovery of Workloads on AWS`, url: `https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html` },
      { t: `Static stability using Availability Zones`, by: `Becky Weiss and Mike Furr, Amazon Builders' Library`, url: `https://aws.amazon.com/builders-library/static-stability-using-availability-zones/` },
      { t: `Active-Active for Multi-Regional Resiliency`, by: `Netflix Technology Blog`, url: `https://netflixtechblog.com/active-active-for-multi-regional-resiliency-c47719f6685b` },
      { t: `Instance configurations`, by: `Google Cloud Spanner Documentation`, url: `https://docs.cloud.google.com/spanner/docs/instance-configurations` }
    ]
  },
  {
    id: `build-vs-buy`,
    area: `Infrastructure`,
    title: `Build vs buy`,
    question: `Should you write this yourself, run open source, or pay a vendor?`,
    summary: `You are trading money against engineering time and control. Buying gets a working product now and someone else's on-call, at a price that grows with usage, plus some lock-in. Building gives an exact fit and full control, but version one is the cheap part; years of maintenance follow. Self-hosting open source sits between: no license fee, all of the operations.`,
    why: `Build a commodity and your best engineers maintain an in-house auth or email system instead of the product. Buy your core differentiator and you look like every competitor, with a bill that grows with your success.`,
    options: [
      {
        name: `Buy (SaaS or managed service)`,
        what: `Pay a vendor to run the capability: a SaaS product you call over an API (auth, email, payments, observability) or a managed cloud service such as RDS or managed Kafka. The vendor owns uptime, patching, scaling and security of its part; you integrate, configure and pay, usually per use or per seat.`,
        pros: [
          `It works in days, not quarters, because the product exists and many customers have already hit its edge cases.`,
          `The vendor carries on-call, upgrades and much of the compliance work, freeing your team for product work.`,
          `The cost is a visible invoice, which is easier to compare than hidden engineering time.`
        ],
        cons: [
          `Usage pricing grows with your volume, so a tool that was cheap at launch can become a major cost at scale.`,
          `Proprietary APIs, data formats and workflows make switching later expensive.`,
          `You cannot fix their bugs or outages, and your availability now includes theirs.`,
          `It is ruled out if the vendor cannot keep data in your region or account.`
        ],
        pick: `Anything that is not your differentiator and that many companies need: auth, email, payments, CI, observability, hosted search. Fowler's advice for such utility functions is to buy the package and adapt your process to it.`,
        avoid: `When the bill grows with your core volume into a major cost, or the vendor cannot meet compliance, residency or latency needs.`,
        example: `A startup uses a payments provider instead of building card processing, because PCI compliance and bank integrations are not what makes its product different.`,
        tools: `Auth0, Stripe, SendGrid, Datadog, GitHub Actions, Amazon RDS`
      },
      {
        name: `Build`,
        what: `Write and run it yourself, in your code and your infrastructure. You choose the design, data model and roadmap, and you own every bug, page and upgrade for as long as it lives. Google's software engineering book sums up why that matters: software engineering is programming integrated over time, so the real cost is keeping it working for years.`,
        pros: [
          `It fits exactly: it does what your product needs, with your data model and nothing extra.`,
          `It can be an edge; Fowler notes that for strategic functions you do not want the same software as your competitors.`,
          `At very large scale, owning it can beat vendor prices; Dropbox built its own storage citing performance and better unit economics.`
        ],
        cons: [
          `Version one is the small part; on-call, security fixes, upgrades and docs continue for the system's whole life.`,
          `It pulls engineers off product work, and the people who built it eventually leave.`,
          `You rediscover edge cases that vendors solved long ago, often in production.`
        ],
        pick: `Your core business logic and anything customers choose you for, or a commodity used at such scale that owning it is much cheaper or faster.`,
        avoid: `When an off-the-shelf product covers most of the need and the gap is not strategic; buy and adapt.`,
        example: `Dropbox moved file storage off Amazon S3 into its own system, Magic Pocket, and served 90 percent of its data in-house by October 2015.`,
        tools: ``
      },
      {
        name: `Self-host open source`,
        what: `Run an open source project on your own infrastructure: Prometheus, Kafka, Keycloak, OpenSearch. There is no license fee and you have the source, but your team installs, configures, scales, upgrades, backs up and gets paged for it. Many projects also sell a managed version, which is the buy option for the same software.`,
        pros: [
          `There are no license or per-use fees, so cost tracks your infrastructure rather than a vendor's price list.`,
          `Data stays in your own account and region, which helps with compliance and residency.`,
          `You can read, patch or extend the source when you hit a bug, and open APIs ease a later move to a managed version.`
        ],
        cons: [
          `Engineer time for upgrades, scaling, backups and incidents is easy to underestimate and never ends.`,
          `You need real expertise; a struggling Kafka or search cluster needs someone who knows its internals.`,
          `Security patches and version upgrades are your job, on your schedule.`
        ],
        pick: `When you need control, data locality or low cost at scale, and have a platform or SRE team that wants to own it.`,
        avoid: `When nobody on the team wants its upgrades and pages; buy the managed version of the same software.`,
        example: `A company runs Prometheus and Grafana in its own clusters because a per-metric SaaS bill would grow with every new service, and its SRE team already knows both tools.`,
        tools: `Prometheus, Grafana, Kafka, Keycloak, OpenSearch`
      }
    ],
    compare: [
      [`Time to first value`, `Fastest`, `Slowest`, `In between`],
      [`Upfront cost`, `Low`, `High, engineering time`, `Medium, setup time`],
      [`Cost as usage grows`, `Follows the vendor's pricing`, `Can be lowest at large scale`, `Infrastructure plus people`],
      [`Who is on call`, `The vendor, for their part`, `You`, `You`],
      [`Control and fit`, `Lowest`, `Highest`, `High, within the project`],
      [`Main risk`, `Lock-in and a rising bill`, `Maintenance forever`, `Underestimated operations work`]
    ],
    decide: [
      [`Is this what customers choose you for?`, `Yes → build it.`],
      [`Does a product cover most of the need, with a gap that is not strategic?`, `Yes → buy, and adapt your process.`],
      [`Must data stay in your account or country, and no vendor can do that?`, `Yes → self-host.`],
      [`Is there a team that wants to own its upgrades and pages?`, `No → buy, even if self-hosting looks cheaper.`],
      [`Does the vendor bill grow faster than revenue at your scale?`, `Yes → price self-hosting or building over three years, engineer time included.`]
    ],
    scenario: {
      title: `Worked example: auth and search for a growing SaaS`,
      setup: `A 30-engineer SaaS needs single sign-on for enterprise customers and full-text search over customer documents. Search relevance is a selling point; login is not. EU customers require their data to stay in the EU.`,
      steps: [
        `Login and SSO are a commodity with nasty security edge cases, so buy an identity provider that offers EU data residency.`,
        `Relevance is what customers pay for, so build the ranking and query logic in house.`,
        `The engine underneath is a commodity: compare managed OpenSearch with self-hosting over three years, counting engineer time for upgrades and on-call.`,
        `No team wants to run search clusters, so the managed engine wins even at a higher bill; revisit if the bill becomes a large share of revenue.`
      ],
      answer: `Buy auth, buy the managed search engine, and build the relevance layer on top. Spend scarce engineering time on what customers notice.`
    },
    mistakes: [
      `Comparing a vendor's price with the cost of writing version one. The real cost of building is years of maintenance and on-call.`,
      `Building in-house auth or email because it looks easy. Security fixes and edge cases never stop.`,
      `Buying with no exit plan. Without data export and a thin interface around the vendor, leaving later is a rewrite.`,
      `Self-hosting a complex system nobody wants to own. It works until the first serious incident.`
    ],
    rule: `Buy the commodity, build the differentiator, and compare three-year total cost including engineer time and on-call.`,
    signals: [
      `The vendor bill grows faster than revenue → price self-hosting or building that piece.`,
      `A whole team maintains an in-house version of a commodity → buy.`,
      `Compliance needs data in your own account or region → self-host, or a vendor with in-region hosting.`,
      `A vendor's roadmap keeps blocking a core feature → it may be strategic; consider building.`
    ],
    interview: [
      `How would you estimate the real cost of building this?`,
      `How do you limit lock-in when you buy?`,
      `What would make you move off a vendor later?`
    ],
    related: [`e4`, `e2`, `h11`, `e3`],
    deep: [`strangler-fig`],
    db: [],
    sources: [
      { t: `UtilityVsStrategicDichotomy`, by: `Martin Fowler`, url: `https://martinfowler.com/bliki/UtilityVsStrategicDichotomy.html` },
      { t: `Scaling to exabytes and beyond`, by: `Akhil Gupta, Dropbox`, url: `https://dropbox.tech/infrastructure/magic-pocket-infrastructure` },
      { t: `Software Engineering at Google, Chapter 1: What Is Software Engineering?`, by: `Titus Winters (ed. Tom Manshreck)`, url: `https://abseil.io/resources/swe-book/html/ch01.html` }
    ]
  }
);
