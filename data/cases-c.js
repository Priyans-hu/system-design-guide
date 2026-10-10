window.HUB_CASES = window.HUB_CASES || [];
window.HUB_CASES.push(...[
 {
  "id": "upi",
  "name": "UPI (India)",
  "kind": "Real-time payments",
  "tagline": "A national switch that never holds money: it routes messages between payment apps and 700+ banks, so it scales by staying thin. The hard limits are bank core systems and the retries aimed at them.",
  "scale": [
   "July 2026: 23.66 billion payments in a month, about 763 million a day (roughly 8,800 a second on average).",
   "NPCI's systems take about 10 billion API calls a day, peaking near 250,000 a second (NPCI, 2026).",
   "FY2016-17 to FY2025-26: yearly transactions grew from 2 crore to 24,162 crore, about 12,000-fold.",
   "October 2019: the first month above 1 billion transactions; March 2022: above 5 billion.",
   "2016: pilot in April with 21 banks; 741 banks were live by July 2026."
  ],
  "requirements": {
   "functional": [
    "Pay anyone at any bank from any UPI app, by UPI ID, mobile number or QR code.",
    "Link bank accounts to an app, set a UPI PIN and check balances.",
    "Merchant payments by QR, and recurring mandates (AutoPay) for bills and subscriptions.",
    "Give every payment a final status: success, or failure with the money returned.",
    "Raise and track a dispute for a payment that went wrong."
   ],
   "nonFunctional": [
    "Real time and 24x7, including weekends and bank holidays.",
    "Interoperable: any app with any bank, so no single app or bank is the gate.",
    "Two-factor security on every payment, without an OTP per payment.",
    "No money lost or created when any party times out mid-payment.",
    "Peaks well above the daily average: NPCI defines 10:00 to 13:00 and 17:00 to 21:30 as peak hours.",
    "Near-zero cost per payment, since users pay nothing to send money."
   ]
  },
  "levels": [
   {
    "name": "One bank, one ledger",
    "load": "Payments inside one bank",
    "flow": [
     ["Customer", "bank's own app"],
     ["Bank server", "checks the balance"],
     ["Core banking DB", "debit and credit, one commit"]
    ],
    "what": "A transfer between two accounts at the same bank is one database transaction: debit A, credit B, commit. ACID does all the hard work, and the bank's own app is the only way in.",
    "breaks": "Money cannot leave the bank. Paying a customer of another bank meant NEFT, which settled in batches during the day and needed the payee's account number and IFSC."
   },
   {
    "name": "A hub between banks",
    "load": "Interbank and real time",
    "flow": [
     ["Payer's bank", "debits, sends credit"],
     ["NPCI switch", "routes by bank"],
     ["Payee's bank", "credits, confirms"]
    ],
    "what": "Linking every bank to every other bank needs about n² connections, and India has hundreds of banks. Instead each bank connects once to a central switch run by NPCI, which routes requests and records outcomes. IMPS already worked this way, and UPI's first settlement files and limits were borrowed from IMPS.",
    "breaks": "Each bank's app served only its own customers, and payers still typed the payee's account number and IFSC, or a mobile number plus an MMID code."
   },
   {
    "name": "Addresses instead of account numbers",
    "load": "Any app, any bank (2016)",
    "flow": [
     ["Payer app", "pays ravi@bank"],
     ["NPCI switch", "finds the handle's owner"],
     ["Payee PSP", "UPI ID to account"]
    ],
    "what": "A UPI ID such as name@handle is mapped to a bank account at registration. On each payment the switch asks the PSP that owns the handle to resolve it (<code>ReqAuthDetails</code>), so the payer never sees account details. Apps are now separate from the banks that hold the money: any certified app can drive any bank account.",
    "breaks": "Dozens of apps now touch money. If each one handled PINs, a single leaky app could drain accounts, and an SMS OTP on every payment would be slow and costly."
   },
   {
    "name": "Trust the phone, hide the PIN",
    "load": "Two factors in one step",
    "flow": [
     ["Phone and SIM", "bound by an outbound SMS"],
     ["NPCI library", "encrypts the PIN"],
     ["NPCI switch", "re-encrypts for the bank"],
     ["Issuer bank HSM", "verifies the PIN"]
    ],
    "what": "Factor one is the device: the app sends an encrypted SMS from the registered SIM, binding phone, number and app. Factor two is the UPI PIN, typed into NPCI's common library inside the app and encrypted with NPCI's public key. NPCI re-encrypts it for the issuing bank, which decrypts it only inside an HSM. The app never sees the PIN.",
    "breaks": "A payment now crosses two PSPs, two banks and the switch. Any hop can time out after the debit and before the credit, leaving money gone and no answer."
   },
   {
    "name": "Two legs and an unknown middle",
    "load": "Every hop can time out",
    "flow": [
     ["Debit leg", "payer's bank"],
     ["Credit leg", "payee's bank"],
     ["Timeout", "outcome unknown"],
     ["Check status", "then confirm or reverse"]
    ],
    "what": "The switch resolves the address, then debits, then credits. Every API carries the transaction ID and must be idempotent, so retries cannot pay twice. The 2016 design treated a timeout as a decline and generated reversals; since 2019 RBI makes the beneficiary bank reverse a failed credit by T+1 and pay ₹100 for each day it is late.",
    "breaks": "Settling every payment in full between banks, one by one, would need enormous real-time liquidity and put the switch on the money path of billions of transfers."
   },
   {
    "name": "Clear now, settle later",
    "load": "Net settlement, 10 cycles a day",
    "flow": [
     ["Customer accounts", "debited and credited now"],
     ["NPCI", "nets each bank's position"],
     ["RBI accounts", "net amounts move per cycle"]
    ],
    "what": "Customers see the money move at once, but banks pay each other only the net difference. NPCI totals each bank's debits and credits per cycle and posts the net amount to its settlement account at RBI, within a net debit cap. There were 8 cycles a day until August 2024, now 10. The switch moves messages, never money.",
    "breaks": "Volume went from 1 billion payments a month in 2019 to over 20 billion. The switch and every bank integration now carry hundreds of millions of payments a day."
   },
   {
    "name": "Scale the switch",
    "load": "Hundreds of millions a day",
    "flow": [
     ["PSP request", "txn ID in the URL"],
     ["Load balancer", "spreads by txn ID"],
     ["Stateless switch nodes", "ack now, answer later"],
     ["Own data centres", "Chennai and Hyderabad"]
    ],
    "what": "Every API is a stateless, idempotent HTTPS call with the transaction ID in its URL, which the switch uses for load balancing, so nodes can be added freely. Each call gets an immediate ack and the result arrives later as its own message. NPCI's data centres in Chennai and Hyderabad were upgraded in 2023 to handle up to 50 to 70 billion transactions a month.",
    "breaks": "The slowest bank sets the success rate. Bank core systems return technical declines at peak, and apps that retry or poll multiply the load on them."
   },
   {
    "name": "Protect the weakest link",
    "load": "Final: about 760 million payments a day",
    "flow": [
     ["UPI Lite", "small payments skip core banking"],
     ["API limits", "balance checks 50 a day"],
     ["Status checks", "after 90 s, at most 3"],
     ["Shorter timeouts", "pay 15 s, status 10 s"]
    ],
    "what": "NPCI now shields bank core systems. UPI Lite pays small amounts from an on-device balance, which NPCI says reduces core banking load. After the April 2025 outages, status checks wait 90 seconds and stop at three, balance checks are capped at 50 a day per app, AutoPay runs outside peak hours, and payment timeouts fell from 30 to 15 seconds."
   }
  ],
  "flow": [
   ["Payer app", "PIN typed into NPCI's library"],
   ["Payer PSP", "sends ReqPay, gets an ack"],
   ["NPCI switch", "balanced on the txn ID"],
   ["Payee PSP", "resolves the UPI ID"],
   ["Remitter bank", "checks the PIN, debits"],
   ["Beneficiary bank", "credits; result to the PSPs"]
  ],
  "components": [
   {
    "name": "NPCI UPI switch",
    "role": "The hub every PSP and bank connects to. It has the payee's PSP resolve the address, sends the debit and then the credit, records each outcome and feeds settlement. It holds no customer balances."
   },
   {
    "name": "PSP banks and third-party apps",
    "role": "Only PSP banks connect to NPCI; apps such as PhonePe and Google Pay ride on them. The PSP binds the device and owns the UPI handles it issues. The app owns the experience, the bank owns the money."
   },
   {
    "name": "NPCI common library",
    "role": "An SDK inside every UPI app that captures the PIN and encrypts it with NPCI's public key before the app can read it. The app only passes the encrypted block along, so a compromised app still cannot learn PINs."
   },
   {
    "name": "Remitter and beneficiary banks",
    "role": "Hold the accounts. The remitter bank decrypts and checks the PIN inside an HSM and debits; the beneficiary bank credits. Their core banking systems are the slowest and most varied part of the chain."
   },
   {
    "name": "Settlement",
    "role": "NPCI nets each member's position per cycle (10 a day since August 2024) and posts it to the member's RTGS settlement account at RBI. Each bank's net debit cap is refreshed every cycle."
   },
   {
    "name": "UPI Lite",
    "role": "An on-device balance for small payments: up to ₹1,000 a payment and ₹5,000 held, after the 2024 increase. Payments need no PIN and do not hit core banking one by one; the user gets a consolidated debit later."
   },
   {
    "name": "Status, reversals and disputes",
    "role": "Check-status calls, reversals and UDIR (unified dispute and issue resolution) close out payments stuck in an unknown state, backed by NPCI's back office and RBI's T+1 rule."
   }
  ],
  "decisions": [
   {
    "title": "A switch that routes messages, not money",
    "why": "NPCI resolves, routes and records, while balances stay in the banks' existing ledgers. With no shared balances to lock, switch nodes are stateless and scale out, and banks keep the systems regulators already trust.",
    "tradeoff": "UPI is only as fast as the slowest of 700+ bank core systems. The switch can measure, cap and penalize a slow bank, but it cannot make it faster."
   },
   {
    "title": "Unbundle the app from the bank",
    "why": "Any certified app can move money from any bank through a UPI ID, so apps compete on experience and adoption is not capped by the quality of any one bank's app.",
    "tradeoff": "Volume concentrated anyway: PhonePe and Google Pay still carried 79% of payments in May 2026, so a failure at either looks like a UPI failure."
   },
   {
    "title": "Two factors without an OTP per payment",
    "why": "The bound device is one factor and the PIN, typed into NPCI's library and checked by the issuing bank, is the other. One step authenticates the payment with no SMS round trip.",
    "tradeoff": "Fraud moved to tricking people into entering the PIN themselves; NPCI stopped person-to-person collect requests from 1 October 2025 so nobody can be asked to approve a stranger's pull."
   },
   {
    "title": "Resolve, debit, credit, then settle the unknown",
    "why": "Debiting first means a failure leaves money with the payer's bank and never creates it. Every API carries the transaction ID and must be idempotent, so status checks and reversals are safe to retry.",
    "tradeoff": "Users can see a pending payment for a while. RBI had to force auto-reversal by T+1 with ₹100 a day compensation to make failures tolerable."
   },
   {
    "title": "Deferred net settlement",
    "why": "Customers are credited at once, but banks pay each other only net amounts each cycle, which needs a fraction of the liquidity that settling every payment in full would.",
    "tradeoff": "Between cycles banks carry exposure to each other, bounded by net debit caps. More cycles (8 became 10 in 2024) shrink that window but mean more files to reconcile."
   },
   {
    "title": "Cap load at the source",
    "why": "NPCI traced the April 2025 trouble to PSP banks firing repeated check-status calls at high rates. It answered with rules, not just capacity: status checks after 90 seconds, at most three, capped balance checks, AutoPay out of peak hours, shorter timeouts.",
    "tradeoff": "Apps lose freedom and users wait longer for a final status. NPCI must police hundreds of members, with penalties up to suspending new-customer onboarding."
   }
  ],
  "whenNot": "A national hub with deferred net settlement works because a regulator can make every bank speak one protocol and follow one set of risk rules. A company that only needs to accept payments should use existing rails (UPI, cards, a payment gateway), not build a switch. If you hold all the money yourself, one ledger with ACID transactions (level 1) beats any two-leg protocol.",
  "lessons": [
   "Keep the hub thin: route and record, and leave balances in the systems that already own them.",
   "Design every multi-party write for the unknown outcome: one transaction ID, idempotent APIs, status checks, reversals and a deadline.",
   "Your capacity is your weakest dependency's capacity. Shield it with offload (UPI Lite), limits and short timeouts.",
   "Retries and polling are load. Space them, cap them, and treat a known error as final."
  ],
  "interview": {
   "ask": "Design a real-time payment network like UPI",
   "plan": [
    "Clarify (5 min): P2P and merchant payments, UPI IDs, banks keep the accounts, 24x7, target volume and peak rate, what a failure must look like.",
    "Actors and flow (10 min): apps, PSPs, the switch, remitter and beneficiary banks; resolve the address, debit, credit, notify.",
    "Security (5 min): device binding, a PIN encrypted end to end to the issuer, why not an OTP per payment.",
    "Correctness (10 min): a transaction ID on every call, idempotency, timeouts, status checks, reversals, T+1.",
    "Settlement (5 min): instant customer credit, deferred net settlement between banks, net debit caps.",
    "Scale (5 min): stateless switch nodes balanced on the transaction ID, two data centres, protecting slow banks.",
    "Wrap-up (5 min): success rate and technical declines per bank, pending payments, p99 per leg, fraud checks."
   ],
   "deepDives": [
    "The debit succeeded and the credit timed out: who resolves it, how, and by when.",
    "Idempotency: where the transaction ID comes from and why every retry must reuse it.",
    "The April 2025 outages: how status-check retries became the load, and the fixes.",
    "Why UPI Lite takes load off bank core systems."
   ],
   "traps": [
    "Making the switch hold balances, which turns a router into the busiest ledger in the country.",
    "Treating a timeout as a failure and retrying the debit.",
    "Polling for status in a tight loop from every app."
   ]
  },
  "sources": [
   {
    "t": "Unified Payments Interface: Procedural Guidelines, version 1.5",
    "by": "NPCI, 2016 (copy hosted by SLBC Madhya Pradesh)",
    "url": "https://www.slbcmadhyapradesh.in/docs/UPI_Procedural_Guidelines24_12_2016.pdf"
   },
   {
    "t": "Unified Payment Interface: API Technology Specifications, v1.2.3",
    "by": "NPCI, 2017 (third-party copy)",
    "url": "https://s3-ap-southeast-1.amazonaws.com/he-public-data/NPCI%20API%20Descriptionsb9bceb7.pdf"
   },
   {
    "t": "Factsheet: UPI, Transforming India's Payment Landscape",
    "by": "Press Information Bureau, Government of India, August 2026",
    "url": "https://www.pib.gov.in/FactsheetDetails.aspx?id=150962&NoteId=150962&ModuleId=16&reg=48&lang=2"
   },
   {
    "t": "NPCI on GitHub (platform figures)",
    "by": "NPCI, read October 2026",
    "url": "https://github.com/NPCI"
   },
   {
    "t": "Harmonisation of Turn Around Time and customer compensation for failed transactions",
    "by": "Reserve Bank of India, September 2019",
    "url": "https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=11693&Mode=0"
   },
   {
    "t": "UPI OC 197: revision of settlement cycles (8 to 10)",
    "by": "NPCI circular, June 2024",
    "url": "https://www.npci.org.in/PDF/npci/upi/circular/2024/UPI-OC-No-197-FY-24-25-Implementation-of-10-settlement-cycles-&-revised-business-day-cutover.pdf"
   },
   {
    "t": "UPI OC 138: introduction of UPI Lite, an on-device wallet for small payments",
    "by": "NPCI circular, March 2022",
    "url": "https://www.npci.org.in/PDF/npci/upi/circular/2022/UPI-OC-138-Introduction-of-On-Device-wallet-UPI-Lite-for-Small-Value-Transactions.pdf"
   },
   {
    "t": "UPI OC 214: reduction in response time of UPI transactions",
    "by": "NPCI circular, April 2025",
    "url": "https://www.npci.org.in/PDF/npci/upi/circular/2025/UPI-OC-No-214-FY-2025-26-Reduction-in-response-time-of-UPI-Transaction.pdf"
   },
   {
    "t": "UPI OC 215: streamlining Check Transaction usage and misuse of UPI APIs",
    "by": "NPCI circular, April 2025",
    "url": "https://www.npci.org.in/PDF/npci/upi/circular/2025/UPI-OC-No-215-FY-2025-26-Streamlining-the-initiation-of-Check-Transaction-in-UPI-and-misuse-of-APIs.pdf"
   },
   {
    "t": "UPI OC 215A: guidelines on usage of UPI APIs",
    "by": "NPCI circular, May 2025",
    "url": "https://www.npci.org.in/PDF/npci/upi/circular/2025/UPI-OC-No-215-A-FY-2025-26-Guidelines-on-usage-of-UPI-APIs.pdf"
   },
   {
    "t": "India's NPCI modernises data centres using Kyndryl's cloud services",
    "by": "iTnews Asia, March 2023",
    "url": "https://www.itnews.asia/news/indias-npci-modernises-data-centres-using-kyndryls-cloud-services-592061"
   },
   {
    "t": "PhonePe, Google Pay combined UPI market share drops below 80% for first time",
    "by": "Outlook Business, June 2026",
    "url": "https://www.outlookbusiness.com/amp/story/economy-and-policy/phonepe-google-pay-combined-upi-market-share-drops-below-80-for-first-time"
   },
   {
    "t": "UPI OC 220: discontinuing UPI collect requests for person-to-person payments",
    "by": "NPCI circular, July 2025",
    "url": "https://www.npci.org.in/PDF/npci/upi/circular/2025/UPI-OC-No-220-FY-2025-26-Discontinuing-the-service-of-UPI-Collect-Request-for-Person-to-Person-P2P-transactions.pdf"
   },
   {
    "t": "NPCI restores UPI after nationwide payment failures",
    "by": "MediaNama, April 2025",
    "url": "https://www.medianama.com/2025/04/223-npci-upi-outage-april-12-2025/"
   }
  ]
 },
 {
  "id": "flipkart-bbd",
  "name": "Flipkart (Big Billion Days)",
  "kind": "E-commerce flash sale",
  "tagline": "At sale open, millions race for limited stock in the same minute. The hard parts are keeping stock and prices correct under the stampede, never dropping an order, and finding the breaking point before shoppers do.",
  "scale": [
   "2023: about 1.5 million requests a second when the sale opens, with capacity prepared for over 2,000 orders a second (Flipkart).",
   "Aerospike at Flipkart: about 90 million queries a second across three data centres and 200+ clusters (2025).",
   "6 October 2014: nearly 5,000 servers, prepared for 20 times normal traffic; 1.5 million people shopped, and the site still had outages.",
   "BBD 2015: stress tests at 5 times the projected load for almost a month; 99.997% of orders came through unharmed.",
   "Before BBD 2024: chaos drills found and fixed 6+ critical misconfigurations in alerting and deployment specs."
  ],
  "requirements": {
   "functional": [
    "Browse, search and view deals at sale open, with live prices and stock.",
    "Add to cart and check out with many payment options.",
    "Never sell more units than exist, and show sold-out items at once.",
    "Carry every order through promise, order management, fulfillment and delivery."
   ],
   "nonFunctional": [
    "Survive a step change at sale open: about 1.5 million requests a second in 2023.",
    "Correct stock and prices under contention; overselling and wrong prices cost trust.",
    "No dropped orders: every order is treated as top priority.",
    "Sub-millisecond reads for hot data such as stock, prices and offers.",
    "Warehouses and delivery must keep up, or website capacity is wasted."
   ]
  },
  "levels": [
   {
    "name": "One app, one database",
    "load": "Normal days",
    "flow": [
     [
      "Shopper",
      "app or website"
     ],
     [
      "App server",
      "pages, cart, checkout"
     ],
     [
      "One database",
      "products, stock, orders"
     ]
    ],
    "what": "A single application with one relational database serves browsing, carts and orders. Normal traffic is spread through the day, so a few servers and one primary database cope.",
    "breaks": "A sale squeezes a day of traffic into minutes. Product pages and searches swamp the database, and everything slows down together."
   },
   {
    "name": "Cache the reads, add servers",
    "load": "Many times normal traffic",
    "flow": [
     [
      "Shopper",
      "browses deals"
     ],
     [
      "CDN and caches",
      "images, pages, prices"
     ],
     [
      "Stateless app servers",
      "added before the sale"
     ],
     [
      "Database",
      "mostly writes"
     ]
    ],
    "what": "Images and pages come from a CDN and caches, app servers keep no state so more can be added, and the database mostly sees writes. For 6 October 2014 Flipkart deployed nearly 5,000 servers and prepared for 20 times normal traffic.",
    "breaks": "Capacity was not the only problem in 2014: the load still caused outages, stock ran out within minutes, items sold out seconds earlier were oversold, and some prices reverted to non-discounted rates for hours."
   },
   {
    "name": "Make stock and prices fast and correct",
    "load": "Millions racing for the same items",
    "flow": [
     [
      "Product page",
      "price and stock"
     ],
     [
      "Hot data store",
      "sub-millisecond reads"
     ],
     [
      "Checkout",
      "stock checked again"
     ],
     [
      "Sold out",
      "shown at once"
     ]
    ],
    "what": "Stock levels, prices and offers move to a low-latency store; Flipkart uses Aerospike for pricing and inventory, with sub-millisecond reads even at BBD peaks. Its 2015 rule was to show an item as out of stock as soon as it happens, so shoppers stop chasing it.",
    "breaks": "Behind the checkout button sit promise, order management, fulfillment and logistics. If any of them is slow or down, orders back up or get lost."
   },
   {
    "name": "Queue the order path",
    "load": "Every order is P0",
    "flow": [
     [
      "Checkout",
      "order accepted"
     ],
     [
      "Message queues",
      "nothing dropped"
     ],
     [
      "Order management",
      "promise and fulfillment"
     ],
     [
      "Logistics",
      "pick, pack, ship"
     ]
    ],
    "what": "For 2015 the order path (promise, order management, fulfillment, logistics) ran over an internal asynchronous messaging and queueing backbone built so no order could be dropped, with fallbacks, hot standbys and replication. Minor bugs touched a tiny number of orders; 99.997% came through unharmed.",
    "breaks": "Design reviews cannot tell you where the system breaks at sale open. In 2014 the real limits were found by shoppers."
   },
   {
    "name": "Rehearse at 5x, then freeze",
    "load": "5x the projected peak",
    "flow": [
     [
      "Forecast",
      "projected sale traffic"
     ],
     [
      "Stress tests",
      "5x for about a month"
     ],
     [
      "Code freeze",
      "infra work first"
     ],
     [
      "War room",
      "24x7 tiger teams"
     ]
    ],
    "what": "Preparation for BBD 2015 started about four months ahead. Infrastructure work filled the two months before a code freeze, stress tests ran at 5 times the projected numbers for almost a month, every metric got alerts, playbooks covered known outages, and cross-trained teams staffed the sale around the clock.",
    "breaks": "Load tests prove capacity, not recovery. Wrong alert rules and bad deployment settings stay hidden until something actually fails."
   },
   {
    "name": "Break things on purpose",
    "load": "Before every big sale",
    "flow": [
     [
      "Chaos platform",
      "LitmusChaos, multi-tenant"
     ],
     [
      "Drills",
      "inject failures"
     ],
     [
      "Findings",
      "alerting and config gaps"
     ],
     [
      "Fixes",
      "before the sale"
     ]
    ],
    "what": "Flipkart built a multi-tenant chaos platform on LitmusChaos for its platform teams. Drills before BBD 2024 found and fixed 6+ critical misconfigurations in alerting and deployment specs, and failure detection and recovery got about 20% and 25% faster than at the previous year's sale.",
    "breaks": "Data stores grown team by team do not scale on demand: with 700+ MySQL clusters, resharding ahead of a sale meant manual work and outages."
   },
   {
    "name": "Run hot data as a platform",
    "load": "Final: 1.5 million requests a second",
    "flow": [
     [
      "DBaaS portal",
      "teams request clusters"
     ],
     [
      "Aerospike on Kubernetes",
      "200+ clusters, 3 DCs"
     ],
     [
      "TiDB",
      "replaces manual shards"
     ],
     [
      "Sale day",
      "about 90M queries a second"
     ]
    ],
    "what": "A core team of fewer than ten engineers runs Aerospike as a shared service: 200+ clusters on Kubernetes across three data centres, about 90 million queries a second in total, for search, recommendations, ads, pricing and inventory. Services that outgrew manual MySQL sharding, such as SuperCoin's Coin Manager, moved to TiDB."
   }
  ],
  "flow": [
   [
    "Shopper",
    "opens the sale"
   ],
   [
    "Search and product pages",
    "hot data from Aerospike"
   ],
   [
    "Cart and checkout",
    "stock and price checked"
   ],
   [
    "Payment",
    "gateway and bank"
   ],
   [
    "Order pipeline",
    "queued, never dropped"
   ],
   [
    "Fulfillment",
    "pick, pack, ship"
   ]
  ],
  "components": [
   {
    "name": "Aerospike platform",
    "role": "Low-latency store for search, recommendations, ads, pricing and inventory: 200+ clusters and about 90 million queries a second across three data centres (2025), with sub-millisecond reads at BBD peaks. Teams get clusters from a DBaaS portal."
   },
   {
    "name": "Order path",
    "role": "Promise, order management, fulfillment and logistics systems linked by asynchronous messaging, so a slow step delays an order instead of losing it. In 2015 every order was treated as P0."
   },
   {
    "name": "Varadhi message bus",
    "role": "Flipkart's open-source REST message bus for point-to-point and pub-sub messaging, built on Apache Pulsar. Its README says the internal version has carried billions of messages a day for about ten years."
   },
   {
    "name": "MySQL and TiDB",
    "role": "Services ran on more than 700 MySQL clusters by PingCAP's count, where resharding was manual and risky before a sale. Coin Manager moved from 5 MySQL shards to two TiDB clusters on Kubernetes."
   },
   {
    "name": "Kubernetes operator",
    "role": "Aerospike runs on Kubernetes through the Aerospike Kubernetes Operator: clusters are declared in manifests and Helm charts, and upgrades roll through with zero downtime."
   },
   {
    "name": "Chaos engineering platform",
    "role": "A multi-tenant LitmusChaos platform shared by 15 central platform teams, with 2,000+ experiment runs over about 500 scenarios, used for drills before sales."
   },
   {
    "name": "Sale readiness program",
    "role": "Months of preparation: capacity work before a code freeze, stress tests at a multiple of the forecast, alerts on every metric, playbooks per outage, and a staffed war room through launch night (2015)."
   },
   {
    "name": "Own data centres plus Azure",
    "role": "Flipkart runs its own data centres and in 2017 picked Microsoft Azure as its exclusive public cloud, starting with compute on top of those data centres."
   }
  ],
  "decisions": [
   {
    "title": "Treat correctness as part of capacity",
    "why": "2014 showed that a sale can fail while servers stay up: stock ran out within minutes, sold-out items were oversold and some prices reverted. Fast, authoritative stock and price data, and showing sold-out items at once, protect trust as much as raw capacity.",
    "tradeoff": "Every order must update stock on the hot path, and a stale cache of stock or price is no longer acceptable, which costs latency and a much bigger hot data tier."
   },
   {
    "title": "Queue the order path and never drop an order",
    "why": "Checkout accepts the order and hands it to an asynchronous backbone, so it stays fast while promise, fulfillment and logistics catch up. Fallbacks and replicas mean a failed node delays orders rather than losing them.",
    "tradeoff": "Orders are confirmed before every downstream step finishes, so failures later need compensations, and backlogs must be watched and drained."
   },
   {
    "title": "Rehearse beyond the forecast",
    "why": "In 2015 Flipkart stress-tested at 5 times the projected numbers for almost a month; systems throttled just below that target, and those that failed under load came back up. Testing far above the forecast leaves room for a wrong forecast.",
    "tradeoff": "Months of preparation and a code freeze slow feature work before the biggest sale of the year, and test traffic only approximates real shoppers."
   },
   {
    "title": "Break it on purpose before the sale",
    "why": "Load tests prove capacity; chaos drills prove detection and recovery. Before BBD 2024 they found 6+ critical misconfigurations in alerting and deployment specs, and detection and recovery improved by about 20% and 25%.",
    "tradeoff": "A shared chaos platform needs guardrails so experiments cannot hurt production or other tenants. Flipkart also had to fix helper-pod scheduling that broke over 10% of staging runs."
   },
   {
    "title": "Run hot data as a shared platform",
    "why": "One small team runs 200+ Aerospike clusters for 50+ use cases, so each product team gets sub-millisecond reads at sale scale without building its own caching tier.",
    "tradeoff": "A shared platform concentrates risk: a bad upgrade or capacity mistake hits many teams at once, so it leans on rolling upgrades, cross-data-centre replication and chaos testing."
   },
   {
    "title": "Capacity includes warehouses and people",
    "why": "Flipkart's own BBD 2015 retrospective says high website throughput means nothing without the manual capacity to pack and deliver. A sale is a pipeline, and its slowest stage, digital or physical, sets the rate.",
    "tradeoff": "Physical capacity cannot autoscale at all, so it is planned months ahead and costs money even when demand falls short."
   }
  ],
  "whenNot": "Most stores never see a sale that multiplies traffic within a minute; a monolith with one database, a CDN and a job queue (levels 1 and 2) is fine until they do. Months of readiness work, a chaos platform and shared database services pay off at Flipkart's scale. A smaller shop gets further with managed services, a waiting room and one honest load test against a realistic forecast.",
  "lessons": [
   "A sale can fail with every server up: protect stock and price correctness, not just throughput.",
   "Accept the order fast, then move it through queues that never drop work.",
   "Test well beyond the forecast, then freeze; the forecast is usually wrong in the direction that hurts.",
   "Load tests find capacity limits; chaos drills find broken alerts and failover. You need both.",
   "Prime Day is the same problem at Amazon; compare the cells and queues in the Amazon case study."
  ],
  "interview": {
   "ask": "Design a flash sale for an e-commerce site like Flipkart's Big Billion Days",
   "plan": [
    "Clarify (5 min): traffic at sale open, how many hot items and units, fairness, payment options, what may degrade.",
    "Read path (10 min): CDN and caches for pages and images, stateless servers, search, scaling up before the open.",
    "Stock (10 min): an authoritative low-latency stock store, atomic decrements or holds, sold-out shown at once, no overselling.",
    "Orders (10 min): accept fast, queue the pipeline, idempotent steps, compensations, backlog alarms.",
    "Readiness (5 min): forecasts, load tests above the forecast, a code freeze, chaos drills, a war room.",
    "Wrap-up (5 min): what you switch off under load, rate limits or a waiting room, the metrics you watch."
   ],
   "deepDives": [
    "Overselling: keeping one hot item's stock count correct under millions of attempts.",
    "How prices and stock can revert under load, and how caches should defer to the source of truth.",
    "Backpressure in the order pipeline when payment gateways or warehouses slow down.",
    "Choosing the load-test target, and why Flipkart used 5 times the forecast."
   ],
   "traps": [
    "Keeping stock counts in a cache that can lag behind the real number.",
    "Doing payment, fulfillment and notifications synchronously inside checkout.",
    "Planning only servers and forgetting warehouses, delivery and payment partners."
   ]
  },
  "sources": [
   {
    "t": "We are really and truly sorry, says Flipkart founders after the #BigBillionDay mess",
    "by": "Inc42, October 2014 (reproduces the founders' email)",
    "url": "https://inc42.com/buzz/flipkart-sorry/"
   },
   {
    "t": "TBBD Throwback: The Big Billion Day 2015!",
    "by": "Flipkart Stories, September 2022",
    "url": "https://stories.flipkart.com/tbbd-throwback-the-big-billion-day-2015/"
   },
   {
    "t": "Personalization, innovation and customer first: Q&A with Jeyandran Venugopal",
    "by": "Flipkart Stories, October 2023",
    "url": "https://stories.flipkart.com/innovation-customer-first-qna-jeyandran-venugopal"
   },
   {
    "t": "Preparing for Big Billion Days: how Flipkart built a multi-tenant chaos engineering platform with LitmusChaos",
    "by": "CNCF case study, June 2026",
    "url": "https://www.cncf.io/case-studies/flipkart/"
   },
   {
    "t": "Flipkart's journey to 90 million QPS",
    "by": "Aerospike blog, November 2025",
    "url": "https://aerospike.com/blog/flipkart-journey-90-million-qps"
   },
   {
    "t": "Flipkart: transforming database management and reducing complexity with TiDB",
    "by": "PingCAP case study",
    "url": "https://www.pingcap.com/case-study/flipkart-transforming-database-management-and-reducing-complexity-with-tidb/"
   },
   {
    "t": "flipkart-incubator/varadhi",
    "by": "Flipkart on GitHub",
    "url": "https://github.com/flipkart-incubator/varadhi"
   },
   {
    "t": "Flipkart and Microsoft forge cloud partnership to expand e-commerce in India",
    "by": "Microsoft News Center India, February 2017",
    "url": "https://news.microsoft.com/en-in/flipkart-and-microsoft-forge-cloud-partnership-to-expand-e-commerce-in-india/"
   }
  ]
 },
 {
  "id": "jiohotstar",
  "name": "JioHotstar (live cricket)",
  "kind": "Live sports streaming",
  "tagline": "Tens of millions press play in the same minute, faster than any autoscaler reacts. So capacity is added before the toss, the CDN fronts everything, and a panic mode sheds extras to keep video playing.",
  "scale": [
   "5 March 2026: 65.2 million concurrent viewers for India vs England, a global streaming record (ICC).",
   "2019 talk: over 1 million requests a second and over 10 Tbps of bandwidth at peak.",
   "Peaks climbed from 10.3 million (IPL 2018 final) to 18.6 million (IPL 2019 final) to 25.3 million (World Cup semi-final, July 2019).",
   "2023: 32 million on JioCinema for the IPL final; 59 million on Disney+ Hotstar for the World Cup final.",
   "14 February 2025: JioCinema and Disney+ Hotstar merged into JioHotstar; the IPL 2025 final peaked at 55 million."
  ],
  "requirements": {
   "functional": [
    "Play live matches on phones, TVs and the web, adapting quality to each network.",
    "Sign in, check the subscription and entitlement, then start playback fast.",
    "Show live extras: scorecard, key moments, the live viewer count.",
    "Insert ads in breaks, and serve the home page and recommendations."
   ],
   "nonFunctional": [
    "Tens of millions of concurrent viewers, most of them on mobile networks.",
    "Step changes: in 2019 traffic could grow by over a million users a minute.",
    "Video playback must not fail; everything else may degrade.",
    "Capacity must be ready before the spike, because a live match cannot wait for scaling.",
    "Peaks follow the match calendar, so capacity held between matches is wasted money."
   ]
  },
  "levels": [
   {
    "name": "One origin server",
    "load": "Thousands of viewers",
    "flow": [
     [
      "Viewers",
      "phones and TVs"
     ],
     [
      "Origin server",
      "encodes and serves"
     ],
     [
      "Video",
      "one copy per viewer"
     ]
    ],
    "what": "Every viewer pulls the stream straight from your own servers, so bandwidth grows with every new viewer. At Hotstar's 2019 peak, video alone needed over 10 Tbps.",
    "breaks": "The origin's network saturates long before a cricket crowd arrives, and a single failure stops the match for everyone."
   },
   {
    "name": "Push video to the edge",
    "load": "Millions of viewers",
    "flow": [
     [
      "Encoder",
      "few-second segments"
     ],
     [
      "Origin",
      "each segment once"
     ],
     [
      "CDN edges",
      "cache near viewers"
     ],
     [
      "Player",
      "picks a bitrate"
     ]
    ],
    "what": "Live video is cut into segments a few seconds long at several bitrates (HLS or DASH). CDN edges cache each segment, so the origin sends it once per edge instead of once per viewer, and the player switches bitrate as its network changes.",
    "breaks": "Video now scales, but every app open still calls your APIs for sign-in, entitlement, the home page and the scorecard, and at a big moment millions open the app together."
   },
   {
    "name": "Put the APIs behind the CDN too",
    "load": "1M+ new users a minute",
    "flow": [
     [
      "App",
      "API calls"
     ],
     [
      "CDN as API gateway",
      "answers cacheable calls"
     ],
     [
      "Internal gateway",
      "personal calls only"
     ],
     [
      "Services",
      "sign-in, entitlement"
     ]
    ],
    "what": "Hotstar uses its CDNs as the external API gateway. For 2023 it ranked its top 10 APIs by live-match traffic and split them: highly cacheable features such as the scorecard, the viewer count and key moments are served from the CDN, so only personal calls reach the backend.",
    "breaks": "The backend still needs servers. In 2019 traffic grew by over a million users a minute while apps took about a minute to boot, and autoscaling hit insufficient-capacity errors."
   },
   {
    "name": "Scale before the spike",
    "load": "Toss, innings break, big moments",
    "flow": [
     [
      "Match schedule",
      "known weeks ahead"
     ],
     [
      "Forecast",
      "expected concurrency"
     ],
     [
      "Pre-scale",
      "100 to 300 nodes a step"
     ],
     [
      "Ready",
      "before match time"
     ]
    ],
    "what": "Hotstar pre-warms infrastructure before match time and scales on request count or concurrency, not CPU. In 2023, adding 400+ Kubernetes nodes at once caused API server errors, so pre-scaling now runs automatically in steps of 100 to 300 nodes.",
    "breaks": "Forecasts miss. Rain stopped the July 2019 semi-final at 13.9 million viewers, and the restart next day peaked at 25.3 million. One overloaded dependency can still take others down."
   },
   {
    "name": "Panic mode",
    "load": "Something breaks mid-match",
    "flow": [
     [
      "Overload",
      "a dependency struggles"
     ],
     [
      "Panic mode",
      "flip the switches"
     ],
     [
      "Extras off",
      "recommendations, personalization"
     ],
     [
      "Core stays up",
      "video and payments"
     ]
    ],
    "what": "While a game is on, nobody has 15 or 20 minutes to fix a problem. Hotstar's panic mode switches off non-critical features such as recommendations and personalization to keep streaming and payments running. A degraded app beats a dead one.",
    "breaks": "Clients can make it worse: when millions of phones retry a failed call at once, the retries become a second spike aimed at whatever is already struggling."
   },
   {
    "name": "Isolate and spread the load",
    "load": "50+ million planned (2023)",
    "flow": [
     [
      "CDN",
      "external API gateway"
     ],
     [
      "Envoy gateways",
      "one fleet, not 200+ LBs"
     ],
     [
      "Six EKS clusters",
      "one critical stack each"
     ],
     [
      "NAT per subnet",
      "no shared choke point"
     ]
    ],
    "what": "With cricket free on mobile in 2023, Hotstar moved from two self-managed Kubernetes clusters to six EKS clusters, one critical service stack each. One Envoy gateway fleet replaced 200+ per-service load balancers that each had to be pre-warmed, and a NAT gateway per subnet fixed a cluster using half its NAT capacity at a tenth of peak.",
    "breaks": "Each of these limits (NAT, gateway nodes at 8 to 9 Gbps, the API server) only showed up under high-scale load tests. You cannot reason your way to the next bottleneck."
   },
   {
    "name": "Rehearse at full scale",
    "load": "Final: 65.2 million concurrent (2026)",
    "flow": [
     [
      "Project Hulk",
      "load from 8 regions"
     ],
     [
      "Game day",
      "the match before the match"
     ],
     [
      "Fix the limits",
      "before the season"
     ],
     [
      "Match day",
      "capacity already up"
     ]
    ],
    "what": "Hotstar's load-testing rig, Project Hulk, used 108,000 CPUs in 8 regions pushing 200 Gbps to prepare for a 50 million peak, with tsunami tests and chaos engineering in its game days. JioHotstar later held 65.2 million concurrent viewers for the 2026 T20 World Cup semi-final."
   }
  ],
  "flow": [
   [
    "App open",
    "home page, scorecard"
   ],
   [
    "CDN gateway",
    "security, routing, cache"
   ],
   [
    "Envoy gateway",
    "personal calls only"
   ],
   [
    "Entitlement",
    "sign-in and plan"
   ],
   [
    "CDN edge",
    "video segments"
   ],
   [
    "Player",
    "adapts the bitrate"
   ]
  ],
  "components": [
   {
    "name": "CDN as the API gateway",
    "role": "Clients call the CDN, which runs security checks and routing rules before forwarding to the internal gateway. Cacheable answers such as the scorecard, viewer count and key moments are served there and never reach the backend."
   },
   {
    "name": "Video delivery",
    "role": "Live video goes out as short segments at several bitrates from CDN edges near viewers, and players switch bitrate as their network changes. At the 2019 peak this took over 10 Tbps."
   },
   {
    "name": "Envoy internal gateway",
    "role": "One fleet of Envoy-based gateways replaced 200+ per-service AWS load balancers, so a tournament no longer needs an organization-wide campaign to pre-warm each load balancer."
   },
   {
    "name": "Six EKS clusters",
    "role": "From 2023, six Amazon EKS clusters replaced two self-managed KOPS clusters on Kubernetes 1.17 that ran 800+ services. Each cluster hosts one P0 stack, so ads and personalization cannot starve each other."
   },
   {
    "name": "Pre-scaling",
    "role": "Capacity is added before match time, driven by request count or concurrency rather than CPU, in automated steps of 100 to 300 nodes to stay under Kubernetes API server throttling."
   },
   {
    "name": "Panic mode",
    "role": "Switches that turn off non-critical features (recommendations, personalization) during a live incident, keeping streaming and payments up while engineers find the cause."
   },
   {
    "name": "Project Hulk",
    "role": "In-house load generation: 108,000 CPUs across 8 regions pushing 200 Gbps (2019), with ML-based traffic patterns, used to rehearse a 50 million peak before real matches."
   }
  ],
  "decisions": [
   {
    "title": "Scale on a forecast, not on CPU",
    "why": "Traffic can grow by over a million users a minute, faster than instances boot. Hotstar pre-warms before match time. Dream11 does the same for its pre-match rush: a forecast five days out, refreshed two hours before, with capacity added from an hour before a 7:30 PM start.",
    "tradeoff": "Capacity sits idle when the forecast runs high, and no forecast sees a rain delay or a super over coming, so panic mode is still needed."
   },
   {
    "title": "The CDN is the front door for APIs, not just video",
    "why": "With the CDN as the external API gateway, security checks and routing run at the edge and cacheable answers never touch origin. Hotstar found scaling its CDNs for the raw volume of its top 10 APIs was neither cost nor time effective without that split.",
    "tradeoff": "Cached answers are slightly stale, every API has to be classified, and the split needs revisiting as features change. Personal calls still need full backend capacity."
   },
   {
    "title": "Degrade on purpose",
    "why": "During a live match there is no time to fix forward. Switching off recommendations and personalization frees capacity for what viewers came for: the video, and the payment that unlocks it.",
    "tradeoff": "Every feature needs a tested off switch and a fallback, and the degraded app still loses engagement and revenue while it lasts."
   },
   {
    "title": "One critical stack per cluster",
    "why": "Ads and personalization both need heavy compute and network at peak, so giving each P0 stack its own EKS cluster stops one from starving another and limits the blast radius.",
    "tradeoff": "Six clusters to upgrade, secure and observe, plus cross-cluster routing. Hotstar needed the Envoy gateway layer and standard endpoint names to make it workable."
   },
   {
    "title": "Rehearse the peak before the season",
    "why": "NAT limits, gateway nodes pushing 8 to 9 Gbps and API server throttling all surfaced in high-scale load tests. Finding them in a rehearsal is cheap; finding them during a final is a national headline.",
    "tradeoff": "Real peak load costs real money (108,000 CPUs in 2019), and synthetic traffic never exactly matches how viewers behave."
   }
  ],
  "whenNot": "Most products never see a million users arrive in one minute; reactive autoscaling behind a CDN is enough for them. Pre-scaling pays off only when spikes are scheduled (matches, sales, launches) and being late means a public outage. Panic switches and full-scale rehearsals cost real engineering time and money, so start with a CDN, cacheable APIs and sane timeouts.",
  "lessons": [
   "Scheduled spikes are a gift: forecast them and have capacity in place before they start.",
   "Separate the one thing that must work from everything that may degrade, and build the off switches first.",
   "Push every cacheable response to the edge, API answers included, not just video.",
   "You only learn your real limits under real load. Rehearse the peak before the tournament.",
   "The playbook fits any deadline rush: Dream11 scales in steps (it calls it ladder-based) before teams lock at the first ball."
  ],
  "interview": {
   "ask": "Design live streaming for a cricket final with 50 million concurrent viewers",
   "plan": [
    "Clarify (5 min): concurrency target, devices and networks, delay behind live, ads, which features may degrade.",
    "Video path (10 min): encoder, short segments at several bitrates, origin shield, multiple CDNs, adaptive players.",
    "API path (10 min): the CDN as front door, cacheable versus personal APIs, entitlement, the home page under load.",
    "Capacity (10 min): a forecast per match, pre-scaling in steps before the toss, why CPU autoscaling is too slow.",
    "Failure (5 min): panic-mode switches, client retries with backoff and jitter, isolating critical stacks.",
    "Wrap-up (5 min): peak-scale load tests, game-day runbooks, metrics such as concurrency, start time and rebuffering."
   ],
   "deepDives": [
    "Back of the envelope: bandwidth for 50 million viewers at a few hundred kbps each.",
    "The thundering herd after a rain delay or a push notification, and how clients should back off.",
    "Which features go dark first in panic mode, and how you test the switches.",
    "Limits on pre-scaling: boot time, Kubernetes API throttling, NAT and load-balancer warm-up."
   ],
   "traps": [
    "Counting on CPU-based autoscaling for a spike that arrives within a minute.",
    "Treating the CDN as video-only while every app open hammers origin APIs.",
    "Sending one push notification to the whole user base at the same moment."
   ]
  },
  "sources": [
   {
    "t": "How Hotstar.com dealt with 25 million concurrent viewers (AWS re:Invent 2019, CMY302)",
    "by": "DevelopersIO (Classmethod), December 2019, notes on the talk by Gaurav Kamboj",
    "url": "https://dev.classmethod.jp/articles/reinvent-2019-cmy302/"
   },
   {
    "t": "Scaling Infrastructure for Millions: From Challenges to Triumphs (Part 1)",
    "by": "Disney+ Hotstar engineering blog, October 2024",
    "url": "https://blog.hotstar.com/scaling-infrastructure-for-millions-from-challenges-to-triumphs-part-1-6099141a99ef"
   },
   {
    "t": "Scaling Infrastructure for Millions: Datacenter Abstraction (Part 2)",
    "by": "Disney+ Hotstar engineering blog, June 2025",
    "url": "https://blog.hotstar.com/scaling-infrastructure-for-millions-datacenter-abstraction-part-2-42b04ef5ed6a"
   },
   {
    "t": "ICC Men's T20 World Cup 2026 sets new global streaming record on JioHotstar",
    "by": "ICC media release, March 2026",
    "url": "https://www.icc-cricket.com/media-releases/icc-men-s-t20-world-cup-2026-sets-new-global-streaming-record-on-jiohotstar-during-india-england-semi-final"
   },
   {
    "t": "Disney says 518 mn Indian users watched ICC World Cup on TV, 59 mn on Hotstar app",
    "by": "Business Today, November 2023",
    "url": "https://www.businesstoday.in/amp/latest/trends/story/disney-says-518-mn-indian-users-watched-icc-world-cup-on-tv-59-mn-on-hotstar-app-406900-2023-11-23"
   },
   {
    "t": "JioCinema breaks world record with over 32 mn viewers during IPL final",
    "by": "Business Standard, May 2023",
    "url": "https://www.business-standard.com/cricket/news/jiocinema-breaks-world-record-with-over-32-mn-viewers-during-ipl-final-123053000170_1.html"
   },
   {
    "t": "JioStar launches JioHotstar, merges JioCinema, Disney+ Hotstar platforms",
    "by": "Deccan Herald, February 2025",
    "url": "https://www.deccanherald.com/business/companies/jiostar-launches-jiohotstar-merges-jiocinema-disney-hotstar-platforms-3405549"
   },
   {
    "t": "TATA IPL 2025 records highest-ever viewership across TV and digital platforms: JioStar",
    "by": "Social Samosa, June 2025",
    "url": "https://www.socialsamosa.com/industry-updates/tata-ipl-2025-highest-viewership-across-tv-digital-platforms-jiostar-9379318"
   },
   {
    "t": "How Dream11 uses an in-house scaling platform",
    "by": "AWS for Games Blog, September 2023",
    "url": "https://aws.amazon.com/blogs/gametech/how-dream11-uses-an-in-house-scaling-platform"
   }
  ]
 }
]);
