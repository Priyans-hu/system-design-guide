window.VAULT_CATS = [
 {
  "name": "Core Distributed Systems & Scalability",
  "key": "c"
 },
 {
  "name": "Data Modeling Storage & Indexing",
  "key": "d"
 },
 {
  "name": "Caching & Performance",
  "key": "k"
 },
 {
  "name": "Consistency Availability & Transactions",
  "key": "t"
 },
 {
  "name": "Reliability Failures & Recovery",
  "key": "r"
 },
 {
  "name": "Async Processing Events & Jobs",
  "key": "a"
 },
 {
  "name": "APIs Boundaries & Contracts",
  "key": "p"
 },
 {
  "name": "Observability Monitoring & Incidents",
  "key": "o"
 },
 {
  "name": "Evolution Cost People & Real-World Trade-offs",
  "key": "e"
 },
 {
  "name": "People Reviews & High-Level Thinking",
  "key": "h"
 }
];
window.VAULT_QUESTIONS = [
 {
  "id": "c1",
  "n": 1,
  "title": "How do I decide when to split a monolith into services?",
  "difficulty": "Intermediate",
  "category": "Core Distributed Systems & Scalability",
  "tags": [
   "Distributed Systems",
   "Scalability"
  ],
  "phase": 10
 },
 {
  "id": "c2",
  "n": 2,
  "title": "How does a request flow end-to-end through a production system?",
  "difficulty": "Fundamental",
  "category": "Core Distributed Systems & Scalability",
  "tags": [
   "Distributed Systems",
   "Networking"
  ],
  "phase": 0
 },
 {
  "id": "c3",
  "n": 3,
  "title": "How do I design a service that can handle 10x more traffic with minimal changes?",
  "difficulty": "Intermediate",
  "category": "Core Distributed Systems & Scalability",
  "tags": [
   "Caching",
   "Distributed Systems",
   "Scalability"
  ],
  "phase": 2
 },
 {
  "id": "c4",
  "n": 4,
  "title": "What are the trade-offs between vertical and horizontal scaling?",
  "difficulty": "Fundamental",
  "category": "Core Distributed Systems & Scalability",
  "tags": [
   "Distributed Systems",
   "Scalability"
  ],
  "phase": 0
 },
 {
  "id": "c5",
  "n": 5,
  "title": "How do I choose between synchronous and asynchronous communication?",
  "difficulty": "Intermediate",
  "category": "Core Distributed Systems & Scalability",
  "tags": [
   "Distributed Systems",
   "Message Queues"
  ],
  "phase": 3
 },
 {
  "id": "c6",
  "n": 6,
  "title": "When should I use a queue vs direct RPC?",
  "difficulty": "Intermediate",
  "category": "Core Distributed Systems & Scalability",
  "tags": [
   "Distributed Systems",
   "Message Queues"
  ],
  "phase": 3
 },
 {
  "id": "c7",
  "n": 7,
  "title": "How do I design for backpressure in a high-traffic system?",
  "difficulty": "Advanced",
  "category": "Core Distributed Systems & Scalability",
  "tags": [
   "Distributed Systems",
   "Reliability",
   "Scalability"
  ],
  "phase": 5
 },
 {
  "id": "c8",
  "n": 8,
  "title": "How do I protect downstream services from traffic spikes?",
  "difficulty": "Advanced",
  "category": "Core Distributed Systems & Scalability",
  "tags": [
   "Load Balancing",
   "Reliability",
   "Scalability"
  ],
  "phase": 5
 },
 {
  "id": "c9",
  "n": 9,
  "title": "How do I design APIs so they can evolve without breaking clients?",
  "difficulty": "Intermediate",
  "category": "Core Distributed Systems & Scalability",
  "tags": [
   "Distributed Systems",
   "Scalability"
  ],
  "phase": 10
 },
 {
  "id": "c10",
  "n": 10,
  "title": "How do I handle idempotency for write APIs?",
  "difficulty": "Advanced",
  "category": "Core Distributed Systems & Scalability",
  "tags": [
   "Databases",
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 3,
  "free": "https://www.puneetpatwari.in/sample-question/q/P10"
 },
 {
  "id": "d1",
  "n": 11,
  "title": "How do I model data differently for OLTP vs OLAP workloads?",
  "difficulty": "Fundamental",
  "category": "Data Modeling Storage & Indexing",
  "tags": [
   "Databases",
   "Storage"
  ],
  "phase": 1
 },
 {
  "id": "d2",
  "n": 12,
  "title": "How do I decide between SQL, NoSQL, and search engines?",
  "difficulty": "Fundamental",
  "category": "Data Modeling Storage & Indexing",
  "tags": [
   "Databases",
   "Distributed Systems"
  ],
  "phase": 1
 },
 {
  "id": "d3",
  "n": 13,
  "title": "How do I shard data by user, tenant, region, or something else?",
  "difficulty": "Intermediate",
  "category": "Data Modeling Storage & Indexing",
  "tags": [
   "Databases",
   "Distributed Systems",
   "Scalability"
  ],
  "phase": 1
 },
 {
  "id": "d4",
  "n": 14,
  "title": "What does a good partition key look like in a distributed store?",
  "difficulty": "Intermediate",
  "category": "Data Modeling Storage & Indexing",
  "tags": [
   "Databases",
   "Distributed Systems",
   "Storage"
  ],
  "phase": 1
 },
 {
  "id": "d5",
  "n": 15,
  "title": "How do I avoid hot partitions and skew?",
  "difficulty": "Intermediate",
  "category": "Data Modeling Storage & Indexing",
  "tags": [
   "Databases",
   "Distributed Systems",
   "Scalability"
  ],
  "phase": 1
 },
 {
  "id": "d6",
  "n": 16,
  "title": "How should I index for read-heavy vs write-heavy workloads?",
  "difficulty": "Intermediate",
  "category": "Data Modeling Storage & Indexing",
  "tags": [
   "Databases",
   "Storage"
  ],
  "phase": 1
 },
 {
  "id": "d7",
  "n": 17,
  "title": "How do I design soft delete, archival, and retention?",
  "difficulty": "Fundamental",
  "category": "Data Modeling Storage & Indexing",
  "tags": [
   "Databases",
   "Storage"
  ],
  "phase": 1
 },
 {
  "id": "d8",
  "n": 18,
  "title": "How do I handle multi-tenant data isolation?",
  "difficulty": "Intermediate",
  "category": "Data Modeling Storage & Indexing",
  "tags": [
   "Databases",
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 1
 },
 {
  "id": "d9",
  "n": 19,
  "title": "How do I safely backfill data in production?",
  "difficulty": "Advanced",
  "category": "Data Modeling Storage & Indexing",
  "tags": [
   "Databases",
   "Reliability",
   "Storage"
  ],
  "phase": 1
 },
 {
  "id": "d10",
  "n": 20,
  "title": "How do I design a migration strategy for a huge table?",
  "difficulty": "Advanced",
  "category": "Data Modeling Storage & Indexing",
  "tags": [
   "Databases",
   "Reliability",
   "Storage"
  ],
  "phase": 1,
  "free": "https://www.puneetpatwari.in/sample-question/q/P19"
 },
 {
  "id": "k1",
  "n": 21,
  "title": "Where should I cache: client, edge, service, DB layer?",
  "difficulty": "Fundamental",
  "category": "Caching & Performance",
  "tags": [
   "Caching",
   "Databases",
   "Networking",
   "Scalability"
  ],
  "phase": 2
 },
 {
  "id": "k2",
  "n": 22,
  "title": "How do I pick between write-through, write-back, and write-around caching?",
  "difficulty": "Fundamental",
  "category": "Caching & Performance",
  "tags": [
   "Caching"
  ],
  "phase": 2
 },
 {
  "id": "k3",
  "n": 23,
  "title": "How do I design cache invalidation rules that don’t become a nightmare?",
  "difficulty": "Intermediate",
  "category": "Caching & Performance",
  "tags": [
   "Caching"
  ],
  "phase": 2
 },
 {
  "id": "k4",
  "n": 24,
  "title": "How do I handle cache stampede and thundering herd?",
  "difficulty": "Intermediate",
  "category": "Caching & Performance",
  "tags": [
   "Caching"
  ],
  "phase": 2
 },
 {
  "id": "k5",
  "n": 25,
  "title": "What is my caching story for hot keys and large objects?",
  "difficulty": "Intermediate",
  "category": "Caching & Performance",
  "tags": [
   "Caching",
   "Databases",
   "Scalability"
  ],
  "phase": 2
 },
 {
  "id": "k6",
  "n": 26,
  "title": "How do I measure whether a cache is actually helping?",
  "difficulty": "Fundamental",
  "category": "Caching & Performance",
  "tags": [
   "Caching",
   "Monitoring"
  ],
  "phase": 2
 },
 {
  "id": "k7",
  "n": 27,
  "title": "How do I design pagination for massive datasets efficiently?",
  "difficulty": "Intermediate",
  "category": "Caching & Performance",
  "tags": [
   "Databases",
   "Scalability"
  ],
  "phase": 2
 },
 {
  "id": "k8",
  "n": 28,
  "title": "How do I design rate limiting that doesn’t break good users?",
  "difficulty": "Intermediate",
  "category": "Caching & Performance",
  "tags": [
   "Reliability",
   "Scalability"
  ],
  "phase": 2
 },
 {
  "id": "t1",
  "n": 29,
  "title": "When do I accept eventual consistency vs strict consistency?",
  "difficulty": "Fundamental",
  "category": "Consistency Availability & Transactions",
  "tags": [
   "Databases",
   "Distributed Systems"
  ],
  "phase": 4
 },
 {
  "id": "t2",
  "n": 30,
  "title": "How do I model consistency levels across services and data stores?",
  "difficulty": "Intermediate",
  "category": "Consistency Availability & Transactions",
  "tags": [
   "Databases",
   "Distributed Systems"
  ],
  "phase": 4
 },
 {
  "id": "t3",
  "n": 31,
  "title": "How do I implement distributed transactions without 2PC pain?",
  "difficulty": "Advanced",
  "category": "Consistency Availability & Transactions",
  "tags": [
   "Databases",
   "Distributed Systems",
   "Message Queues"
  ],
  "phase": 4
 },
 {
  "id": "t4",
  "n": 32,
  "title": "How do I design an outbox/inbox pattern for reliable events?",
  "difficulty": "Advanced",
  "category": "Consistency Availability & Transactions",
  "tags": [
   "Databases",
   "Distributed Systems",
   "Message Queues"
  ],
  "phase": 4
 },
 {
  "id": "t5",
  "n": 33,
  "title": "How do I handle “read your own writes” in a distributed system?",
  "difficulty": "Intermediate",
  "category": "Consistency Availability & Transactions",
  "tags": [
   "Databases",
   "Distributed Systems"
  ],
  "phase": 4
 },
 {
  "id": "t6",
  "n": 34,
  "title": "How do I reconcile divergent data across systems?",
  "difficulty": "Intermediate",
  "category": "Consistency Availability & Transactions",
  "tags": [
   "Databases",
   "Distributed Systems"
  ],
  "phase": 4
 },
 {
  "id": "t7",
  "n": 35,
  "title": "How do I design id generation that works across regions?",
  "difficulty": "Intermediate",
  "category": "Consistency Availability & Transactions",
  "tags": [
   "Distributed Systems",
   "Networking"
  ],
  "phase": 4
 },
 {
  "id": "t8",
  "n": 36,
  "title": "How do I reason about CAP trade-offs for a given product requirement?",
  "difficulty": "Intermediate",
  "category": "Consistency Availability & Transactions",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 4
 },
 {
  "id": "t9",
  "n": 37,
  "title": "B. How do Raft, Paxos, gossip, and quorum based replication actually fit into my design?",
  "difficulty": "Intermediate",
  "category": "Consistency Availability & Transactions",
  "tags": [
   "Distributed Systems",
   "Ordering"
  ],
  "phase": 4
 },
 {
  "id": "t10",
  "n": 38,
  "title": "How do Raft, Paxos, gossip, and quorum based replication actually fit into my design?",
  "difficulty": "Advanced",
  "category": "Consistency Availability & Transactions",
  "tags": [
   "PAXOS",
   "RAFT",
   "Distributed Systems"
  ],
  "phase": 4
 },
 {
  "id": "r1",
  "n": 39,
  "title": "What are all the ways my system can fail under real traffic?",
  "difficulty": "Fundamental",
  "category": "Reliability Failures & Recovery",
  "tags": [
   "Monitoring",
   "Reliability"
  ],
  "phase": 5
 },
 {
  "id": "r2",
  "n": 40,
  "title": "How do I design for graceful degradation instead of hard failure?",
  "difficulty": "Fundamental",
  "category": "Reliability Failures & Recovery",
  "tags": [
   "Reliability"
  ],
  "phase": 5
 },
 {
  "id": "r3",
  "n": 41,
  "title": "How do I implement retries without causing storms and loops?",
  "difficulty": "Intermediate",
  "category": "Reliability Failures & Recovery",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 5
 },
 {
  "id": "r4",
  "n": 42,
  "title": "How do I design circuit breakers and bulkheads correctly?",
  "difficulty": "Intermediate",
  "category": "Reliability Failures & Recovery",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 5
 },
 {
  "id": "r5",
  "n": 43,
  "title": "How do I run in multiple regions and fail over cleanly?",
  "difficulty": "Advanced",
  "category": "Reliability Failures & Recovery",
  "tags": [
   "Networking",
   "Reliability"
  ],
  "phase": 5
 },
 {
  "id": "r6",
  "n": 44,
  "title": "How do I design for data center outage scenarios?",
  "difficulty": "Advanced",
  "category": "Reliability Failures & Recovery",
  "tags": [
   "Networking",
   "Reliability"
  ],
  "phase": 5
 },
 {
  "id": "r7",
  "n": 45,
  "title": "How do I do schema changes without downtime?",
  "difficulty": "Advanced",
  "category": "Reliability Failures & Recovery",
  "tags": [
   "Databases",
   "Reliability"
  ],
  "phase": 1
 },
 {
  "id": "r8",
  "n": 46,
  "title": "How do I design a rollback strategy for bad releases?",
  "difficulty": "Intermediate",
  "category": "Reliability Failures & Recovery",
  "tags": [
   "Reliability"
  ],
  "phase": 9
 },
 {
  "id": "r9",
  "n": 47,
  "title": "How do I make “rebuild from scratch” possible if everything is lost?",
  "difficulty": "Advanced",
  "category": "Reliability Failures & Recovery",
  "tags": [
   "Reliability",
   "Storage"
  ],
  "phase": 9
 },
 {
  "id": "r10",
  "n": 48,
  "title": "How do I define SLOs and design around them?",
  "difficulty": "Advanced",
  "category": "Reliability Failures & Recovery",
  "tags": [
   "Monitoring",
   "Reliability"
  ],
  "phase": 6
 },
 {
  "id": "a1",
  "n": 49,
  "title": "When do I choose event-driven over request-response?",
  "difficulty": "Fundamental",
  "category": "Async Processing Events & Jobs",
  "tags": [
   "Distributed Systems",
   "Message Queues"
  ],
  "phase": 3
 },
 {
  "id": "a2",
  "n": 50,
  "title": "How do I design an event schema that can evolve safely?",
  "difficulty": "Intermediate",
  "category": "Async Processing Events & Jobs",
  "tags": [
   "Distributed Systems",
   "Message Queues"
  ],
  "phase": 3
 },
 {
  "id": "a3",
  "n": 51,
  "title": "How do I handle exactly once vs at least once semantics in practice?",
  "difficulty": "Advanced",
  "category": "Async Processing Events & Jobs",
  "tags": [
   "Distributed Systems",
   "Message Queues"
  ],
  "phase": 3
 },
 {
  "id": "a4",
  "n": 52,
  "title": "How do I design a job scheduler for millions of jobs/day?",
  "difficulty": "Advanced",
  "category": "Async Processing Events & Jobs",
  "tags": [
   "Distributed Systems",
   "Message Queues",
   "Scalability"
  ],
  "phase": 3
 },
 {
  "id": "a5",
  "n": 53,
  "title": "How do I track the status of long-running jobs for users?",
  "difficulty": "Intermediate",
  "category": "Async Processing Events & Jobs",
  "tags": [
   "Distributed Systems",
   "Message Queues",
   "Reliability"
  ],
  "phase": 3
 },
 {
  "id": "a6",
  "n": 54,
  "title": "How do I design dead-letter queues and retry policies?",
  "difficulty": "Intermediate",
  "category": "Async Processing Events & Jobs",
  "tags": [
   "Distributed Systems",
   "Message Queues",
   "Reliability"
  ],
  "phase": 3
 },
 {
  "id": "a7",
  "n": 55,
  "title": "How do I avoid processing the same event forever due to poison messages?",
  "difficulty": "Advanced",
  "category": "Async Processing Events & Jobs",
  "tags": [
   "Distributed Systems",
   "Message Queues",
   "Reliability"
  ],
  "phase": 3
 },
 {
  "id": "a8",
  "n": 56,
  "title": "How do I design a fan-out/fan-in pipeline for heavy computations?",
  "difficulty": "Advanced",
  "category": "Async Processing Events & Jobs",
  "tags": [
   "Distributed Systems",
   "Message Queues",
   "Scalability"
  ],
  "phase": 3
 },
 {
  "id": "a9",
  "n": 57,
  "title": "How do I handle ordering of events when it matters?",
  "difficulty": "Advanced",
  "category": "Async Processing Events & Jobs",
  "tags": [
   "Distributed Systems",
   "Message Queues",
   "Reliability"
  ],
  "phase": 3
 },
 {
  "id": "p1",
  "n": 58,
  "title": "How do I define clear boundaries between services?",
  "difficulty": "Intermediate",
  "category": "APIs Boundaries & Contracts",
  "tags": [
   "Distributed Systems",
   "Scalability"
  ],
  "phase": 10
 },
 {
  "id": "p2",
  "n": 59,
  "title": "How do I design versioning for public APIs?",
  "difficulty": "Fundamental",
  "category": "APIs Boundaries & Contracts",
  "tags": [
   "Distributed Systems",
   "Scalability"
  ],
  "phase": 10
 },
 {
  "id": "p3",
  "n": 60,
  "title": "How do I design tenant-level rate limits and quotas?",
  "difficulty": "Intermediate",
  "category": "APIs Boundaries & Contracts",
  "tags": [
   "Distributed Systems",
   "Reliability",
   "Scalability"
  ],
  "phase": 10
 },
 {
  "id": "p4",
  "n": 61,
  "title": "How do I handle partial failures in multi service calls?",
  "difficulty": "Advanced",
  "category": "APIs Boundaries & Contracts",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 10
 },
 {
  "id": "p5",
  "n": 62,
  "title": "How do I design a gateway that can evolve independently of services?",
  "difficulty": "Intermediate",
  "category": "APIs Boundaries & Contracts",
  "tags": [
   "Distributed Systems",
   "Reliability",
   "Scalability"
  ],
  "phase": 10
 },
 {
  "id": "p6",
  "n": 63,
  "title": "How do I design for backward compatibility when schemas change?",
  "difficulty": "Intermediate",
  "category": "APIs Boundaries & Contracts",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 10
 },
 {
  "id": "p7",
  "n": 64,
  "title": "How do I handle “breaking change” scenarios with minimal disruption?",
  "difficulty": "Intermediate",
  "category": "APIs Boundaries & Contracts",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 10
 },
 {
  "id": "p8",
  "n": 65,
  "title": "How do I design a safe deprecation process?",
  "difficulty": "Intermediate",
  "category": "APIs Boundaries & Contracts",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 10
 },
 {
  "id": "o1",
  "n": 66,
  "title": "What should I log at each layer, and what should I never log?",
  "difficulty": "Fundamental",
  "category": "Observability Monitoring & Incidents",
  "tags": [
   "Monitoring",
   "Reliability"
  ],
  "phase": 6
 },
 {
  "id": "o2",
  "n": 67,
  "title": "How do I design tracing across 50+ microservices?",
  "difficulty": "Advanced",
  "category": "Observability Monitoring & Incidents",
  "tags": [
   "Distributed Systems",
   "Monitoring",
   "Reliability"
  ],
  "phase": 6
 },
 {
  "id": "o3",
  "n": 68,
  "title": "How do I design metrics that actually tell me system health?",
  "difficulty": "Intermediate",
  "category": "Observability Monitoring & Incidents",
  "tags": [
   "Monitoring",
   "Reliability"
  ],
  "phase": 6
 },
 {
  "id": "o4",
  "n": 69,
  "title": "How do I design alerting that catches real issues but avoids noise?",
  "difficulty": "Intermediate",
  "category": "Observability Monitoring & Incidents",
  "tags": [
   "Monitoring",
   "Reliability"
  ],
  "phase": 6
 },
 {
  "id": "o5",
  "n": 70,
  "title": "How do I debug high tail latency in a distributed system?",
  "difficulty": "Advanced",
  "category": "Observability Monitoring & Incidents",
  "tags": [
   "Distributed Systems",
   "Monitoring",
   "Reliability"
  ],
  "phase": 7
 },
 {
  "id": "o6",
  "n": 71,
  "title": "How do I design dashboards that help during incidents?",
  "difficulty": "Intermediate",
  "category": "Observability Monitoring & Incidents",
  "tags": [
   "Monitoring",
   "Reliability"
  ],
  "phase": 6
 },
 {
  "id": "o7",
  "n": 72,
  "title": "How do I design runbooks so on-call engineers can act fast?",
  "difficulty": "Fundamental",
  "category": "Observability Monitoring & Incidents",
  "tags": [
   "Monitoring",
   "Reliability"
  ],
  "phase": 7
 },
 {
  "id": "o8",
  "n": 73,
  "title": "How do I simulate failures before they hit production?",
  "difficulty": "Intermediate",
  "category": "Observability Monitoring & Incidents",
  "tags": [
   "Monitoring",
   "Reliability"
  ],
  "phase": 7
 },
 {
  "id": "e1",
  "n": 74,
  "title": "How do I design something MVP-first that can still grow?",
  "difficulty": "Fundamental",
  "category": "Evolution Cost People & Real-World Trade-offs",
  "tags": [
   "Distributed Systems",
   "Scalability"
  ],
  "phase": 11
 },
 {
  "id": "e2",
  "n": 75,
  "title": "How do I choose between building a platform vs a one-off service?",
  "difficulty": "Intermediate",
  "category": "Evolution Cost People & Real-World Trade-offs",
  "tags": [
   "Distributed Systems",
   "Reliability",
   "Scalability"
  ],
  "phase": 11
 },
 {
  "id": "e3",
  "n": 76,
  "title": "How do I design for cost visibility and optimization from day one?",
  "difficulty": "Intermediate",
  "category": "Evolution Cost People & Real-World Trade-offs",
  "tags": [
   "Monitoring",
   "Reliability",
   "Scalability"
  ],
  "phase": 11
 },
 {
  "id": "e4",
  "n": 77,
  "title": "How do I decide what to buy vs what to build?",
  "difficulty": "Intermediate",
  "category": "Evolution Cost People & Real-World Trade-offs",
  "tags": [
   "Reliability",
   "Scalability"
  ],
  "phase": 11
 },
 {
  "id": "e5",
  "n": 78,
  "title": "How do I design systems that multiple teams can safely extend?",
  "difficulty": "Advanced",
  "category": "Evolution Cost People & Real-World Trade-offs",
  "tags": [
   "Distributed Systems",
   "Reliability",
   "Scalability"
  ],
  "phase": 10
 },
 {
  "id": "e6",
  "n": 79,
  "title": "How do I design for backward compatibility with older clients?",
  "difficulty": "Intermediate",
  "category": "Evolution Cost People & Real-World Trade-offs",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 10
 },
 {
  "id": "e7",
  "n": 80,
  "title": "How do I plan for data residency and regional regulations?",
  "difficulty": "Intermediate",
  "category": "Evolution Cost People & Real-World Trade-offs",
  "tags": [
   "Distributed Systems",
   "Networking",
   "Reliability"
  ],
  "phase": 11
 },
 {
  "id": "e8",
  "n": 81,
  "title": "How do I design to support experiments (A/B tests, flags) cleanly?",
  "difficulty": "Intermediate",
  "category": "Evolution Cost People & Real-World Trade-offs",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 9
 },
 {
  "id": "e9",
  "n": 82,
  "title": "How do I design migration paths when the legacy system cannot just die?",
  "difficulty": "Advanced",
  "category": "Evolution Cost People & Real-World Trade-offs",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 10
 },
 {
  "id": "h1",
  "n": 83,
  "title": "How do I explain my design to a junior dev so they truly get it?",
  "difficulty": "Intermediate",
  "category": "People Reviews & High-Level Thinking",
  "tags": [
   "Distributed Systems"
  ],
  "phase": 12
 },
 {
  "id": "h2",
  "n": 84,
  "title": "How do I defend trade-offs to a sceptical architect?",
  "difficulty": "Intermediate",
  "category": "People Reviews & High-Level Thinking",
  "tags": [
   "Distributed Systems"
  ],
  "phase": 12
 },
 {
  "id": "h3",
  "n": 85,
  "title": "How do I simplify a complex design without losing guarantees?",
  "difficulty": "Advanced",
  "category": "People Reviews & High-Level Thinking",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 12
 },
 {
  "id": "h4",
  "n": 86,
  "title": "How do I write a design doc that survives 3 years of evolution?",
  "difficulty": "Advanced",
  "category": "People Reviews & High-Level Thinking",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 12
 },
 {
  "id": "h5",
  "n": 87,
  "title": "How do I review someone else’s design deeply but respectfully?",
  "difficulty": "Advanced",
  "category": "People Reviews & High-Level Thinking",
  "tags": [
   "Distributed Systems"
  ],
  "phase": 12
 },
 {
  "id": "h6",
  "n": 88,
  "title": "How do I know when a design is over-engineered?",
  "difficulty": "Intermediate",
  "category": "People Reviews & High-Level Thinking",
  "tags": [
   "Distributed Systems",
   "Reliability",
   "Scalability"
  ],
  "phase": 12
 },
 {
  "id": "h7",
  "n": 89,
  "title": "How do I know when a design is dangerously under-engineered?",
  "difficulty": "Intermediate",
  "category": "People Reviews & High-Level Thinking",
  "tags": [
   "Distributed Systems",
   "Reliability",
   "Scalability"
  ],
  "phase": 12
 },
 {
  "id": "h8",
  "n": 90,
  "title": "How do I design so that mistakes are cheap, not catastrophic?",
  "difficulty": "Advanced",
  "category": "People Reviews & High-Level Thinking",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 12
 },
 {
  "id": "h9",
  "n": 91,
  "title": "How do I design systems that can be owned by teams, not heroes?",
  "difficulty": "Advanced",
  "category": "People Reviews & High-Level Thinking",
  "tags": [
   "Distributed Systems",
   "Reliability",
   "Scalability"
  ],
  "phase": 12
 },
 {
  "id": "h10",
  "n": 92,
  "title": "How do I design for boring reliability instead of cleverness?",
  "difficulty": "Intermediate",
  "category": "People Reviews & High-Level Thinking",
  "tags": [
   "Distributed Systems",
   "Reliability"
  ],
  "phase": 12
 },
 {
  "id": "h11",
  "n": 93,
  "title": "How do I decide what not to build into a system?",
  "difficulty": "Intermediate",
  "category": "People Reviews & High-Level Thinking",
  "tags": [
   "Distributed Systems",
   "Reliability",
   "Scalability"
  ],
  "phase": 12
 }
];
