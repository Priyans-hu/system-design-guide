window.HUB_HLD = window.HUB_HLD || {};
Object.assign(window.HUB_HLD, {
  upi: {
    summary: `Apps talk only to their PSP, and PSPs only to NPCI's switch. The switch has the payee's PSP resolve the UPI ID, sends the debit to the payer's bank, then the credit to the payee's, and records the result. Banks settle net amounts at RBI later.`,
    layers: [
      { name: `Clients`, items: [[`Payer app`, `PhonePe, Google Pay, bank apps`], [`NPCI common library`, `captures, encrypts the PIN`], [`Merchant QR`, `carries the payee's UPI ID`], [`UPI Lite balance`, `on-device, small payments`]], why: `The app owns the experience, never the secrets: the PIN is typed into NPCI's library and encrypted before the app sees it. Small payments can come from an on-device Lite balance.` },
      { name: `PSP banks`, items: [[`Payer PSP`, `binds the device, sends ReqPay`], [`Payee PSP`, `owns and resolves its UPI IDs`]], why: `Only PSP banks connect to NPCI, so the switch deals with hundreds of members rather than every app. The payee's PSP issued the handle, so only it can resolve it.` },
      { name: `NPCI switch`, items: [[`Load balancing on txn ID`, `the ID is in every API URL`], [`UPI switch`, `routes each leg, records results`], [`Numeric mapper`, `mobile number to UPI ID`]], why: `One hub instead of a bank-to-bank mesh. It holds no balances and every call is stateless and idempotent, balanced on the transaction ID, so nodes scale out.` },
      { name: `Banks`, items: [[`Remitter bank`, `checks the PIN in an HSM, debits`], [`Beneficiary bank`, `credits, confirms`]], why: `Money stays in each bank's core banking system. These are the slowest and most varied hops, so most of NPCI's rules exist to protect them.` },
      { name: `Settlement`, items: [[`NPCI settlement`, `nets each bank per cycle`], [`RBI settlement accounts`, `banks' RTGS accounts`]], why: `Customers are credited at once, but banks pay each other only net amounts, 10 cycles a day since August 2024, which needs far less liquidity than paying gross.` },
      { name: `Failure handling`, items: [[`Check status`, `after 90 s, at most 3 times`], [`Reversals`, `return a stranded debit`], [`Disputes (UDIR)`, `complaints raised in the app`]], why: `Any leg can time out, so every payment needs a defined end: a status check, a reversal or a dispute, with RBI's T+1 deadline and ₹100 a day compensation.` },
      { name: `Load control`, items: [[`API limits (2025)`, `balance 50 a day, list 25 a day`], [`Shorter timeouts (2025)`, `pay 15 s, status 10 s`], [`Peak-hour rules`, `AutoPay outside peak hours`]], why: `After the 2025 outages NPCI cut load at the source: caps on non-payment calls, faster failure, and background work moved out of 10:00 to 13:00 and 17:00 to 21:30.` }
    ],
    edges: [
      [`Merchant QR`, `Payer app`, `data`, `payee UPI ID`],
      [`Payer app`, `NPCI common library`, `sync`, `PIN entry`],
      [`Payer app`, `Payer PSP`, `sync`, `pay request, PIN block`],
      [`UPI Lite balance`, `Payer PSP`, `sync`, `small payment, no PIN`],
      [`Payer PSP`, `Load balancing on txn ID`, `sync`, `ReqPay`],
      [`Load balancing on txn ID`, `UPI switch`, `sync`, `routed by txn ID`],
      [`UPI switch`, `Payee PSP`, `sync`, `resolve UPI ID`],
      [`UPI switch`, `Numeric mapper`, `sync`, `number lookup`],
      [`UPI switch`, `Remitter bank`, `sync`, `debit, PIN block`],
      [`UPI switch`, `Beneficiary bank`, `sync`, `credit`],
      [`UPI switch`, `Payer PSP`, `async`, `RespPay, final status`],
      [`UPI switch`, `NPCI settlement`, `data`, `cleared payments`],
      [`NPCI settlement`, `RBI settlement accounts`, `async`, `net amounts per cycle`],
      [`Payer PSP`, `Check status`, `sync`, `outcome unknown`],
      [`Check status`, `UPI switch`, `sync`, `ReqChkTxn`],
      [`UPI switch`, `Reversals`, `async`, `credit failed`],
      [`Reversals`, `Remitter bank`, `sync`, `return the debit`]
    ],
    paths: [
      { name: `Pay a merchant QR`, nodes: [`Merchant QR`, `Payer app`, `NPCI common library`, `Payer app`, `Payer PSP`, `Load balancing on txn ID`, `UPI switch`, `Payee PSP`, `UPI switch`, `Remitter bank`, `UPI switch`, `Beneficiary bank`, `UPI switch`, `Payer PSP`], note: `The QR gives the payee's UPI ID and NPCI's library encrypts the PIN. The switch has the payee's PSP resolve the ID, debits the payer's bank, credits the payee's, then reports the result.` },
      { name: `Credit leg times out`, nodes: [`UPI switch`, `Beneficiary bank`, `Payer PSP`, `Check status`, `UPI switch`, `Reversals`, `Remitter bank`], note: `The debit went through but the credit reply never came. The PSP checks status after 90 seconds, at most three times; if the credit failed, a reversal returns the debit, by T+1 under RBI rules.` }
    ]
  },
  'flipkart-bbd': {
    summary: `Search, product pages and checkout read hot data such as stock and prices from a shared Aerospike platform. Checkout hands each order to a queued pipeline (promise, order management, fulfillment, logistics) built so no order is dropped.`,
    layers: [
      { name: `Clients`, items: [[`Flipkart app and site`, `browse, search, check out`]], why: `Sale traffic arrives as a step at sale open, about 1.5 million requests a second in 2023, so everything behind the app must be ready before the clock strikes.` },
      { name: `Services`, items: [[`Search and product pages`, `deals, prices, stock`], [`Cart and checkout`, `price and stock checked again`], [`Promise`, `can we deliver, and by when`], [`Order management`, `owns each order's state`]], why: `Browsing is read-heavy and cacheable; checkout and orders are writes that must be correct. Splitting them lets the read side scale wide while the order path stays careful.` },
      { name: `Async and streaming`, items: [[`Message queues`, `async backbone, nothing dropped`]], why: `Checkout accepts the order and hands it to queues, so slow downstream steps delay orders instead of losing them. In 2015 every order was treated as P0.` },
      { name: `Fulfillment`, items: [[`Fulfillment`, `warehouses pick and pack`], [`Logistics`, `ship and deliver`]], why: `Physical capacity cannot autoscale. Flipkart's own retrospective says high website throughput means nothing without the manual capacity to pack and deliver.` },
      { name: `Data stores`, items: [[`Aerospike platform`, `200+ clusters, about 90M QPS`], [`MySQL`, `700+ clusters (PingCAP)`], [`TiDB`, `for services that outgrew shards`]], why: `Hot data (stock, prices, offers, recommendations) sits in Aerospike for sub-millisecond reads at peak; relational data sits in MySQL, and TiDB replaces manual resharding where it hurt.` },
      { name: `Platform`, items: [[`Kubernetes with operator`, `clusters from manifests`], [`Own data centres`, `three for Aerospike`], [`Microsoft Azure`, `exclusive public cloud (2017)`]], why: `Clusters declared in manifests can be created, scaled and upgraded without downtime before a sale. Flipkart runs its own data centres, with Azure as its public cloud since 2017.` },
      { name: `Readiness`, items: [[`Stress tests at 5x`, `for about a month (2015)`], [`Code freeze`, `after infrastructure work`], [`Chaos drills`, `LitmusChaos, before BBD 2024`], [`War room`, `24x7 tiger teams`]], why: `Load tests above the forecast find capacity limits, chaos drills find broken alerts and failover, and the freeze and war room keep launch night boring.` }
    ],
    edges: [
      [`Flipkart app and site`, `Search and product pages`, `sync`, `browse deals`],
      [`Flipkart app and site`, `Cart and checkout`, `sync`, `buy`],
      [`Search and product pages`, `Aerospike platform`, `data`, `stock, prices, offers`],
      [`Search and product pages`, `Promise`, `sync`, `delivery date`],
      [`Cart and checkout`, `Aerospike platform`, `data`, `check stock and price`],
      [`Cart and checkout`, `Order management`, `sync`, `create the order`],
      [`Order management`, `Message queues`, `async`, `order events`],
      [`Message queues`, `Fulfillment`, `async`, `pick and pack`],
      [`Fulfillment`, `Logistics`, `async`, `hand over shipment`],
      [`Kubernetes with operator`, `Aerospike platform`, `sync`, `provisions clusters`],
      [`Chaos drills`, `Kubernetes with operator`, `sync`, `inject failures`]
    ],
    paths: [
      { name: `Buy a deal at sale open`, nodes: [`Flipkart app and site`, `Search and product pages`, `Aerospike platform`, `Cart and checkout`, `Aerospike platform`, `Order management`, `Message queues`, `Fulfillment`, `Logistics`], note: `Product pages and checkout read stock and prices from Aerospike in under a millisecond. Checkout creates the order, which moves through queues to fulfillment and logistics, so a slow step delays it rather than losing it.` },
      { name: `Prove readiness before the sale`, nodes: [`Chaos drills`, `Kubernetes with operator`, `Aerospike platform`], note: `After stress tests prove capacity, chaos drills inject failures into the platform. Before BBD 2024 they found and fixed 6+ critical misconfigurations in alerting and deployment specs.` }
    ]
  },
  jiohotstar: {
    summary: `Apps reach everything through the CDN: video segments come from edge caches, cacheable API answers stop at the CDN, and personal calls pass to an Envoy gateway fleet in front of six EKS clusters. Capacity is added before each match.`,
    layers: [
      { name: `Clients`, items: [[`Mobile, web and TV apps`, `players adapt the bitrate`], [`Push notifications`, `bring millions back at once`]], why: `Only the player sees its own network, so it picks each segment's bitrate. Push notifications are a traffic source too: a send to everyone is a self-made spike.` },
      { name: `Edge and CDN`, items: [[`CDN as API gateway`, `security, routing, cached answers`], [`Video CDN edges`, `cache live segments`]], why: `The CDNs serve live segments near viewers and double as the external API gateway, running security checks and routing and answering cacheable calls such as the scorecard.` },
      { name: `Video origin`, items: [[`Live origin`, `segments at several bitrates`]], why: `The origin sends each segment once per edge, not once per viewer, so its load stays flat however many people watch.` },
      { name: `API gateway`, items: [[`Envoy gateway fleet`, `replaced 200+ load balancers`]], why: `One Envoy-based gateway fleet is easier to scale than 200+ per-service load balancers, each of which had to be pre-warmed before every tournament.` },
      { name: `Services`, items: [[`Playback`, `manifests and entitlement`], [`Payments and subscriptions`, `kept up in panic mode`], [`Ads`, `a P0 stack of its own`], [`Recommendations and personalization`, `first off in panic mode`]], why: `Playback and payments are what viewers came for. Ads and personalization are heavy P0 stacks too, but recommendations and personalization are the first things panic mode switches off.` },
      { name: `Platform`, items: [[`Six EKS clusters`, `one P0 stack each`], [`Pre-scaler`, `adds 100 to 300 nodes a step`], [`NAT gateway per subnet`, `no shared egress choke point`]], why: `Each critical stack gets its own EKS cluster to limit blast radius. Stepwise pre-scaling avoids API server throttling, and NAT per subnet removes a shared egress bottleneck.` },
      { name: `Readiness`, items: [[`Match forecast`, `request count or concurrency`], [`Project Hulk`, `108,000 CPUs, 8 regions (2019)`], [`Panic mode switches`, `turn extras off mid-match`]], why: `Capacity is planned from match forecasts and proven with full-scale load tests before the season; panic switches cover whatever the forecast missed.` }
    ],
    edges: [
      [`Push notifications`, `Mobile, web and TV apps`, `async`, `millions open the app`],
      [`Mobile, web and TV apps`, `CDN as API gateway`, `sync`, `API calls`],
      [`Video CDN edges`, `Mobile, web and TV apps`, `stream`, `live segments`],
      [`Live origin`, `Video CDN edges`, `stream`, `once per edge`],
      [`CDN as API gateway`, `Envoy gateway fleet`, `sync`, `personal calls only`],
      [`Envoy gateway fleet`, `Playback`, `sync`, `start playback`],
      [`Envoy gateway fleet`, `Payments and subscriptions`, `sync`, `buy a plan`],
      [`Envoy gateway fleet`, `Ads`, `sync`, `ad breaks`],
      [`Envoy gateway fleet`, `Recommendations and personalization`, `sync`, `home page rows`],
      [`Match forecast`, `Pre-scaler`, `sync`, `target capacity`],
      [`Pre-scaler`, `Six EKS clusters`, `sync`, `nodes in steps`],
      [`Six EKS clusters`, `NAT gateway per subnet`, `data`, `outbound traffic`],
      [`Panic mode switches`, `Recommendations and personalization`, `sync`, `switch off`]
    ],
    paths: [
      { name: `Open the app at the toss`, nodes: [`Push notifications`, `Mobile, web and TV apps`, `CDN as API gateway`, `Envoy gateway fleet`, `Playback`, `Video CDN edges`], note: `A notification brings millions back at once. Cacheable calls like the scorecard stop at the CDN; personal calls pass the Envoy gateways to playback, and video comes from edge caches.` },
      { name: `Pre-scale before the match`, nodes: [`Match forecast`, `Pre-scaler`, `Six EKS clusters`, `NAT gateway per subnet`], note: `Before match time the forecast sets target capacity on request count or concurrency, not CPU. The pre-scaler adds nodes in steps of 100 to 300 so the Kubernetes API server is not throttled.` }
    ]
  }
});
