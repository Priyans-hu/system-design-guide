window.HUB_TRACKS = window.HUB_TRACKS || [];
window.HUB_TRACKS.push(
  {
    id: `security`,
    title: `Security for backend engineers`,
    short: `Security`,
    icon: `shield`,
    why: `Your APIs, webhooks and agents handle customer data and money, and one missing tenant check or leaked key becomes a breach. At SDE-2 you are expected to catch these in design and code review, not after an incident.`,
    cadence: `One topic per weekday evening (about 45 minutes, plus the PortSwigger lab where one is linked), about two weeks.`,
    topics: [
      {
        id: `sec-authn`,
        title: `Authentication: who is calling`,
        what: `Proving the identity of the caller on every request. Server-to-server APIs mostly use API keys or bearer tokens, browser apps use session cookies, and a JWT is a token format, not a strategy.`,
        points: [
          `API keys: 32+ random bytes, shown once, stored as a SHA-256 hash with a short visible prefix for lookup (high entropy makes a fast hash safe)`,
          `Passwords need a slow hash: argon2id (OWASP minimum 19 MiB memory, 2 iterations) or bcrypt with cost 10+, never plain SHA-256`,
          `Sessions: an opaque random ID in a cookie with <code>HttpOnly</code>, <code>Secure</code> and <code>SameSite=Lax</code>; rotate it at login and revoke by deleting it server-side`,
          `JWTs: pin the algorithm (reject <code>alg: none</code>), check <code>exp</code>, <code>iss</code> and <code>aud</code>, and keep them short-lived (5-15 min) because revoking them is hard`,
          `Rotation: allow two active keys per client so they can roll without downtime, and record last-used time to find and revoke stale keys`
        ],
        use: `On every endpoint that is not deliberately public: API keys for server-to-server, sessions for your own web UI, short-lived JWTs when many services must verify a caller without a database lookup.`,
        avoid: `Do not use long-lived JWTs as sessions you cannot revoke, keep tokens in localStorage, or log raw keys and tokens anywhere.`,
        res: [
          { t: `Password Storage Cheat Sheet`, by: `OWASP`, url: `https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html`, type: `docs`, free: true, why: `Current argon2id, bcrypt and pepper guidance with exact parameters.` },
          { t: `Session Management Cheat Sheet`, by: `OWASP`, url: `https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html`, type: `docs`, free: true, why: `Cookie flags, session ID rotation, timeouts and fixation on one page.` },
          { t: `JWT attacks`, by: `PortSwigger Web Security Academy`, url: `https://portswigger.net/web-security/jwt`, type: `interactive`, free: true, why: `Hands-on labs for algorithm confusion, weak keys and unverified signatures.` }
        ]
      },
      {
        id: `sec-oauth`,
        title: `OAuth 2.0, PKCE and OpenID Connect`,
        what: `OAuth 2.0 lets a user grant an app limited access to an API without sharing a password. OpenID Connect adds an ID token so the app also learns who the user is.`,
        points: [
          `Authorization code flow: the browser brings back a one-time code, and the client exchanges it for tokens on a back channel`,
          `PKCE: send a hash of a random <code>code_verifier</code> first and the verifier at exchange, so a stolen code is useless; RFC 9700 requires it for public clients and recommends it for all`,
          `Three tokens: access token (APIs check its scopes and <code>aud</code>), refresh token (rotate on each use), ID token (identity for the client only, never sent to APIs)`,
          `Grants: client credentials for machine-to-machine, device flow for CLIs and TVs; the password grant must not be used and the implicit grant should not`,
          `Validate <code>state</code> and the ID token <code>nonce</code>, and match redirect URIs exactly, never by prefix`
        ],
        use: `When third-party apps need delegated access to your customers' data, when your SPA, mobile app or CLI signs users in, or when you add SSO through an identity provider.`,
        avoid: `Do not treat a bare access token as proof of who the user is (that is the ID token's job), and do not write your own authorization server when a mature one exists.`,
        res: [
          { t: `OAuth 2.0 Simplified`, by: `Aaron Parecki`, url: `https://www.oauth.com/`, type: `book`, free: true, why: `Readable end-to-end guide, including PKCE, native apps and OpenID Connect.` },
          { t: `RFC 9700: Best Current Practice for OAuth 2.0 Security`, by: `IETF`, url: `https://datatracker.ietf.org/doc/html/rfc9700`, type: `spec`, free: true, why: `The current rules: PKCE, exact redirect matching, refresh token rotation, retired grants.` },
          { t: `How OpenID Connect Works`, by: `OpenID Foundation`, url: `https://openid.net/developers/how-connect-works/`, type: `docs`, free: true, why: `Short official overview of ID tokens and the OIDC flows.` }
        ]
      },
      {
        id: `sec-authz`,
        title: `Authorization: what the caller may do`,
        what: `Deciding, on every request, whether this identity may perform this action on this specific object. Most API breaches are a missing check, not broken crypto.`,
        points: [
          `RBAC groups permissions into roles (admin, developer, viewer): easy to audit, but coarse as the product grows`,
          `ABAC decides from attributes (owner, plan, region); policy engines like OPA or Cedar keep rules out of handlers and unit-testable`,
          `Tenant isolation: take <code>tenant_id</code> from the authenticated principal, never from the body or path, and scope every query by it`,
          `IDOR (BOLA in API terms): <code>GET /messages/123</code> must confirm message 123 belongs to the caller; random UUIDs slow guessing but are not a control`,
          `Deny by default, enforce in one layer (middleware or repository), and test with another tenant's IDs expecting 404`
        ],
        use: `On every endpoint that reads or changes customer data, and most of all on list, export, search and bulk endpoints where one missing filter leaks everything.`,
        avoid: `Do not rely on unguessable IDs, hidden UI buttons, or a check that exists in the API handler but not in the worker, webhook or admin path to the same data.`,
        res: [
          { t: `Authorization Cheat Sheet`, by: `OWASP`, url: `https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html`, type: `docs`, free: true, why: `Deny by default, least privilege, and checks on every request.` },
          { t: `Access control vulnerabilities and privilege escalation`, by: `PortSwigger Web Security Academy`, url: `https://portswigger.net/web-security/access-control`, type: `interactive`, free: true, why: `Labs where you exploit IDOR and privilege escalation yourself.` },
          { t: `Insecure Direct Object Reference Prevention Cheat Sheet`, by: `OWASP`, url: `https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html`, type: `docs`, free: true, why: `Concrete patterns for scoping object lookups to the caller.` }
        ]
      },
      {
        id: `sec-signing`,
        title: `Signing requests and webhooks`,
        what: `A signature proves a request came from someone holding the secret and was not changed on the way. A signed timestamp and a message ID stop an attacker from replaying a captured request.`,
        points: [
          `Sign <code>id.timestamp.body</code> with HMAC-SHA256 and send it in headers (Standard Webhooks uses <code>webhook-id</code>, <code>webhook-timestamp</code>, <code>webhook-signature</code>)`,
          `Verify against the raw body bytes before JSON parsing, using a constant-time compare (<code>hmac.Equal</code> in Go, <code>hmac.compare_digest</code> in Python)`,
          `Replay protection: reject timestamps older than about 5 minutes and remember seen message IDs for that window (a Redis key with a TTL)`,
          `Rotation: during a grace period, send one signature per active secret in the same header and let receivers accept any match`,
          `For client-to-API calls, AWS SigV4 shows the full pattern: canonical request, hashed payload, derived signing key, short validity`
        ],
        use: `For every webhook you send (delivery reports, call events), every callback you receive from a provider, and any API where a bearer token alone is too weak.`,
        avoid: `Do not rely only on IP allowlists or a secret in the URL, and never verify a signature against re-serialized JSON.`,
        res: [
          { t: `Standard Webhooks specification`, by: `Standard Webhooks`, url: `https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md`, type: `spec`, free: true, why: `Open spec for signed content, headers, replay tolerance and key rotation.` },
          { t: `Receive Stripe events in your webhook endpoint`, by: `Stripe`, url: `https://docs.stripe.com/webhooks`, type: `docs`, free: true, why: `A mature real-world design: timestamped HMAC header, 5-minute replay window, secret rolling.` },
          { t: `AWS Signature Version 4 for API requests`, by: `AWS`, url: `https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_sigv.html`, type: `docs`, free: true, why: `How a large public API signs every request, not just webhooks.` }
        ]
      },
      {
        id: `sec-owasp-api`,
        title: `OWASP API Security Top 10 in practice`,
        what: `A ranked list of how APIs actually get breached. Most items are authorization and input-handling mistakes you can catch in code review.`,
        points: [
          `API1 BOLA: an object ID from the request is used without an ownership check; the most common API flaw`,
          `API3 mass assignment: binding the whole JSON body lets callers set <code>is_admin</code> or <code>balance</code>; use request structs with allowlisted fields and separate response types`,
          `API7 SSRF: a customer-supplied URL (webhook target, media link) reaches internal hosts; block private ranges after DNS resolution and require IMDSv2 (PUT-issued token) on EC2`,
          `API4 resource consumption: rate limit per key, cap page and payload sizes, and time out every outbound call`,
          `Injection left the 2023 list as its own item but still happens: parameterized SQL, no shell strings built from input, output encoding`
        ],
        use: `As a checklist for every new endpoint in design review, and as the scope of a periodic API security pass.`,
        avoid: `Do not treat it as a compliance checkbox or a one-time scanner run; most items need per-endpoint thinking about who owns what.`,
        res: [
          { t: `OWASP Top 10 API Security Risks, 2023`, by: `OWASP`, url: `https://api-security.owasp.org/editions/2023/en/0x11-t10/`, type: `docs`, free: true, why: `Each risk with attack scenarios and prevention steps.` },
          { t: `Server-side request forgery (SSRF)`, by: `PortSwigger Web Security Academy`, url: `https://portswigger.net/web-security/ssrf`, type: `interactive`, free: true, why: `Labs that show how a URL field becomes access to internal services.` },
          { t: `API testing`, by: `PortSwigger Web Security Academy`, url: `https://portswigger.net/web-security/api-testing`, type: `interactive`, free: true, why: `Mass assignment and hidden parameters, with hands-on labs.` }
        ]
      },
      {
        id: `sec-secrets`,
        title: `Secrets management and rotation`,
        what: `Keeping credentials out of code, images and logs, delivering them to services at runtime, and changing them without downtime.`,
        points: [
          `Keep secrets in AWS Secrets Manager or Vault and fetch them at startup with the service's IAM role; cache briefly and reload on rotation`,
          `Rotate without downtime: add the new secret, let consumers accept both, switch, then revoke the old (the alternating-users strategy does this for databases)`,
          `Prefer short-lived credentials: IAM roles over access keys, RDS IAM auth tokens, OIDC federation from CI instead of stored cloud keys`,
          `Scan with gitleaks in pre-commit and CI; a secret that reached git history must be rotated, because rewriting history is not enough`,
          `Keep secrets out of logs, errors and LLM prompts: redact by field name in the logger and never print whole config structs`
        ],
        use: `Whenever code needs a credential, and immediately when someone leaves, a laptop is lost, or a secret shows up in a log, ticket or repo.`,
        avoid: `Do not bake secrets into container images or config repos, and do not mistake base64 in an env file or Kubernetes Secret for encryption.`,
        res: [
          { t: `Secrets Management Cheat Sheet`, by: `OWASP`, url: `https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html`, type: `docs`, free: true, why: `Lifecycle, rotation, CI/CD and leak detection in one checklist.` },
          { t: `Lambda function rotation strategies`, by: `AWS`, url: `https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotation-strategy.html`, type: `docs`, free: true, why: `Single-user vs alternating-users rotation and their downtime trade-offs.` },
          { t: `Gitleaks`, by: `Gitleaks`, url: `https://github.com/gitleaks/gitleaks`, type: `repo`, free: true, why: `Fast secret scanner for pre-commit hooks and CI.` }
        ]
      },
      {
        id: `sec-crypto`,
        title: `Encryption in transit and at rest`,
        what: `TLS protects data moving between machines; encryption at rest protects disks, backups and sensitive fields if storage leaks. KMS holds the root keys so your code can use them but never export them.`,
        points: [
          `TLS 1.2+ on every hop, internal ones included (1.3 preferred); never ship <code>InsecureSkipVerify: true</code> or <code>verify=False</code>`,
          `mTLS: both sides present certificates, so identity comes from the cert instead of the network; ALB can verify client certs for partner links`,
          `Envelope encryption: KMS <code>GenerateDataKey</code> returns a plaintext and an encrypted data key; encrypt locally with AES-256-GCM, store the encrypted key beside the data, discard the plaintext`,
          `KMS <code>Encrypt</code> takes at most 4 KB, which is why bulk data uses data keys; key policies limit who can decrypt, and CloudTrail logs every use`,
          `Disk encryption (EBS, RDS) does not stop someone with database access; add field-level encryption for tokens, IDs and credentials`
        ],
        use: `Always for transit; at rest for anything holding customer data, credentials or recordings, with field-level encryption for the few fields that hurt most if dumped.`,
        avoid: `Do not invent your own crypto or modes (ECB, reused GCM nonces, homemade key derivation); use a vetted library such as the AWS Encryption SDK or Tink.`,
        res: [
          { t: `AWS KMS cryptography essentials: envelope encryption`, by: `AWS`, url: `https://docs.aws.amazon.com/kms/latest/developerguide/kms-cryptography.html#enveloping`, type: `docs`, free: true, why: `How data keys, root keys and envelope encryption fit together.` },
          { t: `Transport Layer Security Cheat Sheet`, by: `OWASP`, url: `https://cheatsheetseries.owasp.org/cheatsheets/Transport_Layer_Security_Cheat_Sheet.html`, type: `docs`, free: true, why: `Protocol versions, ciphers, certificates and HSTS in practical terms.` },
          { t: `Mutual authentication with TLS in Application Load Balancer`, by: `AWS`, url: `https://docs.aws.amazon.com/elasticloadbalancing/latest/application/mutual-authentication.html`, type: `docs`, free: true, why: `Verify mode vs passthrough for client certificates at the load balancer.` }
        ]
      },
      {
        id: `sec-supply-chain`,
        title: `Software supply chain security`,
        what: `Most of your binary is other people's code: libraries, base images and CI actions. Supply chain security means knowing what is in it, keeping it patched, and proving the build was not tampered with.`,
        points: [
          `Pin everything: lockfiles (<code>go.sum</code>, <code>uv.lock</code> or hashed requirements), base images by digest, CI actions by commit SHA`,
          `Scan dependencies: <code>govulncheck</code> reports only vulnerabilities your code actually calls, <code>pip-audit</code> covers Python, Dependabot or Renovate open update PRs`,
          `Scan images with Trivy in CI, fail on fixable critical CVEs, and start from minimal bases (distroless, slim) to shrink the attack surface`,
          `Generate an SBOM (CycloneDX or SPDX) per build, so "are we affected by this new CVE?" takes minutes, not days`,
          `SLSA provenance and signatures (Sigstore cosign) prove which pipeline built an artifact; also watch for typosquatted package names`
        ],
        use: `On every repo and image from day one; it is cheap in CI and very expensive to retrofit in the middle of an incident.`,
        avoid: `Do not auto-merge every dependency bump without tests, and do not let scanner noise train people to ignore alerts; triage by reachability and fix availability.`,
        res: [
          { t: `Go Vulnerability Management`, by: `Go team`, url: `https://go.dev/doc/security/vuln/`, type: `docs`, free: true, why: `How govulncheck uses call graphs to report only what affects you.` },
          { t: `SLSA: Supply-chain Levels for Software Artifacts`, by: `OpenSSF`, url: `https://slsa.dev/`, type: `spec`, free: true, why: `Levels for build integrity and provenance, explained step by step.` },
          { t: `Trivy`, by: `Aqua Security`, url: `https://github.com/aquasecurity/trivy`, type: `repo`, free: true, why: `One scanner for images, dependencies, misconfigurations, secrets and SBOMs.` }
        ]
      },
      {
        id: `sec-threat-model`,
        title: `Threat modeling with STRIDE in 30 minutes`,
        what: `A short, structured conversation before you build: sketch the system, ask what can go wrong at each boundary, and decide what to do about it.`,
        points: [
          `Four questions: what are we working on, what can go wrong, what are we going to do about it, did we do a good job?`,
          `Draw a data flow diagram (processes, data stores, external actors, trust boundaries); most threats sit where data crosses a boundary`,
          `STRIDE per element: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege (the opposites of authn, integrity, audit, confidentiality, availability, authz)`,
          `Timebox it: 10 minutes to draw, 15 to walk STRIDE at each boundary, 5 to turn the top risks into tickets with owners`,
          `Example, webhook sender: spoofed callbacks (sign them), SSRF via customer URLs (egress filtering), retry storms on slow receivers (backoff, circuit breaker)`
        ],
        use: `In design review for any feature that adds an external input, a new trust boundary, customer-supplied URLs or files, or money movement.`,
        avoid: `Do not write a 40-page document nobody reads or model the whole company at once; model one feature, keep it in the design doc, and update it when the design changes.`,
        res: [
          { t: `Threat Modeling Cheat Sheet`, by: `OWASP`, url: `https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html`, type: `docs`, free: true, why: `A practical process, including STRIDE and data flow diagrams.` },
          { t: `Threats: Microsoft Threat Modeling Tool`, by: `Microsoft`, url: `https://learn.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats`, type: `docs`, free: true, why: `Short definitions of each STRIDE category with examples.` },
          { t: `Shostack's 4 Question Frame for Threat Modeling`, by: `Adam Shostack`, url: `https://github.com/adamshostack/4QuestionFrame`, type: `repo`, free: true, why: `The four questions behind every lightweight threat model.` }
        ]
      }
    ],
    done: `You are done when you can take one of your own endpoints and, in 30 minutes, list its STRIDE threats and point to where it checks tenant ownership, verifies signatures with a replay window, and keeps secrets out of code and logs.`
  },
  {
    id: `ai-llm`,
    title: `AI and LLM engineering`,
    short: `AI and LLMs`,
    icon: `bot`,
    why: `You already build LLM agents; SDE-2 means owning their cost, latency, quality and safety in production, and defending those trade-offs with numbers in a design review.`,
    cadence: `Two topics per week, each paired with a small build in Go or Python (one script or endpoint is enough), about five weeks.`,
    topics: [
      {
        id: `ai-fundamentals`,
        title: `LLM fundamentals for engineers`,
        what: `An LLM predicts the next token from all the tokens before it. Cost, latency, context limits and randomness all follow from that one fact.`,
        points: [
          `Tokens: about 4 characters or 0.75 words of English; code, JSON and other languages use more, and tokenizers differ by model, so count with the provider's API`,
          `Context window (200K to 1M tokens today) holds input plus output; recall drops as it fills ("context rot"), so curate what goes in`,
          `Temperature: low for extraction and classification, higher for creative text; even at 0, outputs are not guaranteed identical`,
          `Cost per request = input tokens x input price + output tokens x output price; output costs 5x input on current Claude models, so long answers dominate`,
          `Latency = time to first token + output tokens / tokens per second; 500 tokens at 50 tokens/s is 10 s, so stream and keep outputs short`
        ],
        use: `Before choosing a model or committing to a latency SLA, so you can estimate cost per request and p95 latency on a napkin.`,
        avoid: `Do not treat the model as a database of facts or assume temperature 0 makes it deterministic; ground answers in your data and validate outputs.`,
        res: [
          { t: `Deep Dive into LLMs like ChatGPT`, by: `Andrej Karpathy`, url: `https://www.youtube.com/watch?v=7xTGNNLPyMI`, type: `video`, free: true, why: `How tokenization, pretraining, sampling and post-training actually work.` },
          { t: `Context windows`, by: `Anthropic`, url: `https://platform.claude.com/docs/en/build-with-claude/context-windows`, type: `docs`, free: true, why: `How input, output and thinking tokens share the window, and why context rot matters.` },
          { t: `Pricing`, by: `Anthropic`, url: `https://platform.claude.com/docs/en/about-claude/pricing`, type: `docs`, free: true, why: `Real per-token prices plus caching and batch multipliers for your cost math.` }
        ]
      },
      {
        id: `ai-prompting`,
        title: `Prompting and structured output`,
        what: `A prompt is a spec: role, task, context, constraints and examples. Structured output turns the model's reply into data your code can validate and use.`,
        points: [
          `Be explicit: task and success criteria first, context in marked sections (XML tags like <code>&lt;document&gt;</code>), and what to do when information is missing`,
          `Few-shot: 3-5 varied examples, edge cases included, teach format and judgment better than long rule lists`,
          `For hard tasks let the model reason first (extended thinking or a reasoning field), but parse only the final answer`,
          `Structured output: JSON schema mode or strict tool use (<code>strict: true</code>), then still validate with Pydantic or a Go struct and retry once with the error`,
          `Treat prompts as code: version them, review changes, and change one thing at a time with evals watching`
        ],
        use: `Whenever an LLM's output feeds code: classification, extraction, routing, form filling and tool arguments.`,
        avoid: `Do not parse free text with regexes, and do not pile on ALL-CAPS rules to patch a failure you have not reproduced in an eval.`,
        res: [
          { t: `Prompt engineering overview`, by: `Anthropic`, url: `https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/overview`, type: `docs`, free: true, why: `Techniques in order of impact, from clarity to examples to structure.` },
          { t: `Interactive prompt engineering tutorial`, by: `Anthropic`, url: `https://github.com/anthropics/prompt-eng-interactive-tutorial`, type: `tutorial`, free: true, why: `Nine notebook chapters with exercises you run yourself.` },
          { t: `Structured outputs`, by: `Anthropic`, url: `https://platform.claude.com/docs/en/build-with-claude/structured-outputs`, type: `docs`, free: true, why: `Schema-constrained JSON responses and strict tool inputs, with their limits.` }
        ]
      },
      {
        id: `ai-agents`,
        title: `Tool use and agents`,
        what: `Tool use lets the model ask your code to run a function and read the result. An agent runs that step in a loop, choosing the next action until the task is done or a limit is hit.`,
        points: [
          `The loop: send messages and tool schemas → model returns <code>tool_use</code> → you run it and append a <code>tool_result</code> → repeat until <code>stop_reason</code> is <code>end_turn</code> or a step cap`,
          `Tool design beats prompt tricks: few tools, clear names and descriptions, typed inputs, small outputs, and errors the model can act on`,
          `Planning: ask for a short plan first, or split into an orchestrator and workers; checkpoint state so a crash does not restart a 20-step run`,
          `Guardrails: step, token and time budgets, idempotent tools, and human approval before irreversible actions (sending messages, refunds, deletes)`,
          `Workflows beat agents when the steps are known: prompt chaining, routing and parallel calls are cheaper, faster and easier to test`
        ],
        use: `When the path to the goal cannot be written down in advance, such as investigating a failed call from logs, and wrong steps are cheap to undo.`,
        avoid: `Do not build an autonomous agent when a fixed pipeline of two or three LLM calls does the job; you pay in latency, cost and unpredictability.`,
        res: [
          { t: `Building effective agents`, by: `Anthropic`, url: `https://www.anthropic.com/engineering/building-effective-agents`, type: `blog`, free: true, why: `Workflows vs agents, and the five patterns worth knowing.` },
          { t: `Tool use with Claude`, by: `Anthropic`, url: `https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview`, type: `docs`, free: true, why: `The exact request and response shapes for the tool loop.` },
          { t: `Writing effective tools for AI agents`, by: `Anthropic`, url: `https://www.anthropic.com/engineering/writing-tools-for-agents`, type: `blog`, free: true, why: `How to name, scope and evaluate tools so agents use them well.` }
        ]
      },
      {
        id: `ai-rag`,
        title: `Retrieval-augmented generation (RAG)`,
        what: `Instead of hoping the model knows your data, retrieve the relevant passages at query time and put them in the prompt. Retrieval quality caps answer quality.`,
        points: [
          `Chunking: split on structure (headings, sections) into a few hundred tokens with small overlap; keep source, tenant and date on every chunk`,
          `Embeddings map text to vectors where similar meaning gives high cosine similarity; embed queries and documents with the same model`,
          `pgvector: a <code>vector</code> column and an HNSW index (<code>vector_cosine_ops</code>) in the Postgres you already run; filters apply after the index scan, so turn on iterative scans`,
          `Hybrid search: keyword search (BM25 or Postgres full-text, strong on error codes and names) plus vectors, merged with reciprocal rank fusion`,
          `Rerank the top 20-50 with a cross-encoder, pass the best 5-10 to the model, and have it cite chunk IDs so you can check grounding`
        ],
        use: `When answers must come from your own changing data (docs, tickets, runbooks) and fine-tuning would be stale or too costly.`,
        avoid: `Do not skip retrieval evals (recall@k on real questions), and if the whole corpus fits in the context window with caching, you may not need RAG yet.`,
        res: [
          { t: `pgvector`, by: `Andrew Kane`, url: `https://github.com/pgvector/pgvector`, type: `repo`, free: true, why: `The README covers HNSW vs IVFFlat, filtering, iterative scans and hybrid search.` },
          { t: `Contextual Retrieval`, by: `Anthropic`, url: `https://www.anthropic.com/engineering/contextual-retrieval`, type: `blog`, free: true, why: `Measured gains from contextual chunks, BM25 plus embeddings, and reranking.` },
          { t: `Retrieve and Re-Rank`, by: `Sentence Transformers`, url: `https://www.sbert.net/examples/sentence_transformer/applications/retrieve_rerank/README.html`, type: `docs`, free: true, why: `Bi-encoder retrieval vs cross-encoder reranking, with code.` }
        ]
      },
      {
        id: `ai-evals`,
        title: `Evals: tests for LLM features`,
        what: `Evals are the test suite for non-deterministic code: fixed inputs, a way to grade outputs, and a score you track on every prompt, model or retrieval change.`,
        points: [
          `Start with error analysis: read 50-100 real traces, note what went wrong, and group the failures; the groups become eval cases`,
          `Golden set: real, labeled examples covering common paths and known failures; every production bug adds a case`,
          `Grade with code first (exact match, valid schema, right tool called), then an LLM-as-judge with a written rubric, then humans to calibrate`,
          `LLM-as-judge: pass/fail per rubric criterion beats a 1-10 score; measure agreement with human labels and watch for position and length bias`,
          `Run a fast regression eval in CI on every prompt or model change and block merges on a drop; for agents, run several trials per task (pass@k)`
        ],
        use: `Before shipping any LLM feature, and on every prompt, model, tool or retrieval change after that.`,
        avoid: `Do not rely on vibe checks of five examples or on public benchmark scores; neither measures your task.`,
        res: [
          { t: `Your AI Product Needs Evals`, by: `Hamel Husain`, url: `https://hamel.dev/blog/posts/evals/`, type: `blog`, free: true, why: `A practical path from assertions to LLM judges, grounded in a real product.` },
          { t: `Evaluating the Effectiveness of LLM-Evaluators (aka LLM-as-Judge)`, by: `Eugene Yan`, url: `https://eugeneyan.com/writing/llm-evaluators/`, type: `blog`, free: true, why: `Direct scoring vs pairwise judges, metrics, and what research says about reliability.` },
          { t: `Demystifying evals for AI agents`, by: `Anthropic`, url: `https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents`, type: `blog`, free: true, why: `Tasks, trials, graders and pass@k for multi-step agents.` }
        ]
      },
      {
        id: `ai-cost`,
        title: `Prompt caching and cost control`,
        what: `LLM bills are tokens times price. Caching, smaller models, batching and shorter outputs cut cost and latency without changing what users see.`,
        points: [
          `Prompt caching: put the stable prefix (tools, system prompt, reference docs) first; cache reads cost 10% of normal input or less, writes about 1.25x, default lifetime 5 minutes`,
          `Anything that varies per request (timestamps, user IDs) goes after the cached prefix, or every call misses the cache`,
          `Model routing: send easy requests (classification, extraction) to a small model and escalate to a larger one on low confidence or hard cases`,
          `Batch APIs cost 50% less for work that can wait: nightly summaries, backfills, eval runs`,
          `Stream for perceived latency, cap <code>max_tokens</code>, trim old conversation turns, and track cost per request and per tenant`
        ],
        use: `Once a feature has real traffic, or from day one if each request carries a large system prompt, tool set or document.`,
        avoid: `Do not switch to a cheaper model or cut context without an eval showing quality holds; savings that break answers are not savings.`,
        res: [
          { t: `Prompt caching`, by: `Anthropic`, url: `https://platform.claude.com/docs/en/build-with-claude/prompt-caching`, type: `docs`, free: true, why: `Breakpoints, prefix order, TTLs, pricing and what invalidates the cache.` },
          { t: `Batch processing`, by: `Anthropic`, url: `https://platform.claude.com/docs/en/build-with-claude/batch-processing`, type: `docs`, free: true, why: `Half-price asynchronous requests and when they fit.` },
          { t: `Latency optimization`, by: `OpenAI`, url: `https://developers.openai.com/api/docs/guides/latency-optimization`, type: `docs`, free: true, why: `Seven provider-neutral principles for faster LLM apps.` }
        ]
      },
      {
        id: `ai-observability`,
        title: `LLM observability`,
        what: `Tracing every LLM call, retrieval and tool step with inputs, outputs, tokens, latency and cost, so you can explain any bad answer and any bill.`,
        points: [
          `One trace per user request, with spans for each LLM call, retrieval and tool call, using OpenTelemetry GenAI attributes like <code>gen_ai.usage.input_tokens</code>`,
          `Record prompt version, model, parameters, token counts, cache hits and <code>stop_reason</code>, plus inputs and outputs with PII redacted`,
          `Dashboards: p50 and p95 latency, time to first token, cost per request and per tenant, error, refusal and tool-failure rates`,
          `Capture user feedback (thumbs, edits, retries, handoffs to a human) and link it to the trace ID so bad answers become eval cases`,
          `Use an LLM tracing tool (Langfuse, Arize Phoenix) or send OTel spans to the tracing backend you already run`
        ],
        use: `From the first production user; without traces you cannot answer "why did it say that?" or "why did the bill double?".`,
        avoid: `Do not log only final answers or only aggregate token counts, and do not store raw prompts containing customer PII where everyone can read them.`,
        res: [
          { t: `Semantic conventions for generative AI`, by: `OpenTelemetry`, url: `https://github.com/open-telemetry/semantic-conventions-genai`, type: `spec`, free: true, why: `Standard span, metric and attribute names for LLM calls, agents and MCP.` },
          { t: `LLM observability and application tracing`, by: `Langfuse`, url: `https://langfuse.com/docs/observability/overview`, type: `docs`, free: true, why: `What to capture per request (prompt, response, tokens, latency, tool steps) and how traces feed evals.` },
          { t: `A Field Guide to Rapidly Improving AI Products`, by: `Hamel Husain`, url: `https://hamel.dev/blog/posts/field-guide/`, type: `blog`, free: true, why: `Why error analysis and a simple trace viewer beat dashboards alone.` }
        ]
      },
      {
        id: `ai-safety`,
        title: `LLM safety: prompt injection, PII and guardrails`,
        what: `A model cannot reliably tell your instructions from instructions hidden in the data it reads. Treat its output as untrusted input and design so a fooled model cannot do real damage.`,
        points: [
          `Prompt injection: text in a web page, email, SMS or ticket says "ignore previous instructions"; there is no complete fix, so limit what a fooled model can do`,
          `The lethal trifecta: private data + untrusted content + a way to send data out; remove at least one leg from every agent`,
          `Least privilege for tools: tenant-scoped credentials, read-only by default, allowlisted destinations, human confirmation for sends, payments and deletes`,
          `PII: redact or tokenize before prompts and logs (a detector such as Presidio), and check the provider's retention and data-region settings`,
          `Guardrails: input screening, output checks (schema, no secrets or system prompt leaks), and attack prompts in your eval suite`
        ],
        use: `Whenever an LLM reads content you do not control or can call tools with side effects.`,
        avoid: `Do not treat "never reveal these instructions" in a system prompt as a security control, and never pass model output into SQL, shell or HTML without the usual escaping.`,
        res: [
          { t: `OWASP Top 10 for LLM Applications`, by: `OWASP Gen AI Security Project`, url: `https://genai.owasp.org/llm-top-10/`, type: `docs`, free: true, why: `The 2025 list: prompt injection, excessive agency, output handling and more.` },
          { t: `The lethal trifecta for AI agents`, by: `Simon Willison`, url: `https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/`, type: `blog`, free: true, why: `The clearest mental model for when an agent can leak data.` },
          { t: `Presidio`, by: `Presidio project`, url: `https://presidio.dataprivacystack.org/`, type: `docs`, free: true, why: `Open-source PII detection and anonymization to put in front of prompts and logs.` }
        ]
      },
      {
        id: `ai-mcp`,
        title: `Model Context Protocol (MCP)`,
        what: `An open protocol that lets any AI application connect to tools and data through one standard interface, instead of a custom integration per app.`,
        points: [
          `Hosts (Claude, IDEs, your own agent) talk to MCP servers over JSON-RPC 2.0; the 2026-07-28 revision is stateless, with no initialize handshake or sessions`,
          `Servers expose tools (functions the model calls), resources (data to read) and prompts (reusable templates)`,
          `Two transports: stdio for local subprocess servers, Streamable HTTP (one POST endpoint, reply as JSON or a stream) for remote ones`,
          `Remote auth is OAuth 2.1: clients use PKCE and the <code>resource</code> parameter, and servers must reject tokens issued for anyone else (no token passthrough)`,
          `Tool descriptions and results are untrusted input: vet third-party servers like any dependency and give them least-privilege credentials`
        ],
        use: `When you want your API or internal tools usable from many AI clients without writing a separate integration for each.`,
        avoid: `Do not add MCP to a single app that only calls its own functions; plain tool definitions in the API request are simpler.`,
        res: [
          { t: `What is the Model Context Protocol (MCP)?`, by: `MCP project`, url: `https://modelcontextprotocol.io/docs/getting-started/intro`, type: `docs`, free: true, why: `Architecture and core concepts before you touch the spec.` },
          { t: `MCP specification (latest revision)`, by: `MCP project`, url: `https://modelcontextprotocol.io/specification/latest`, type: `spec`, free: true, why: `Authoritative protocol, transport and authorization rules, with a changelog.` },
          { t: `Build an MCP server`, by: `MCP project`, url: `https://modelcontextprotocol.io/docs/develop/build-server`, type: `tutorial`, free: true, why: `Step-by-step server with Python, Go and other SDKs.` }
        ]
      }
    ],
    done: `You are done when you have built a small agent that answers from your own documents through pgvector, calls at least one tool, passes a 30-case eval in CI, logs traces with token cost, and resists a prompt injection test case.`
  },
  {
    id: `testing`,
    title: `Testing and quality`,
    short: `Testing`,
    icon: `test-tube`,
    why: `At SDE-2 you change code other teams depend on, and good tests are what make that fast and safe. Messaging and voice systems are async, retry-heavy and time-dependent, which is exactly where naive tests go flaky.`,
    cadence: `One topic per weekday evening, ending each with at least one real test added to a service you own, about two weeks.`,
    topics: [
      {
        id: `test-strategy`,
        title: `What to test: pyramid, trophy and behavior`,
        what: `A test suite is an investment: each test should catch bugs you care about at the lowest cost. Its shape and focus matter more than the coverage number.`,
        points: [
          `Pyramid: many fast unit tests, fewer integration tests, very few end-to-end; Trophy: most weight on integration tests, where real bugs tend to hide`,
          `For a backend service: pure logic in unit tests, handlers plus a real database in integration tests, a few E2E smoke tests after deploy`,
          `Test behavior through public interfaces (inputs, outputs, side effects), not private methods or call order; a behavior-preserving refactor should not break tests`,
          `Coverage shows what never ran, not what was checked; mutation testing or reading the assertions tells you whether tests would catch a bug`,
          `Every bug fix starts with a failing test that reproduces it`
        ],
        use: `When starting a service, reviewing a PR's tests, or deciding what to cut from a slow or flaky suite.`,
        avoid: `Do not chase 100% coverage or mock every collaborator; tests that mirror the implementation break on every refactor and catch little.`,
        res: [
          { t: `The Practical Test Pyramid`, by: `Ham Vocke (martinfowler.com)`, url: `https://martinfowler.com/articles/practical-test-pyramid.html`, type: `blog`, free: true, why: `The canonical walkthrough of each test layer with real examples.` },
          { t: `The Testing Trophy and Testing Classifications`, by: `Kent C. Dodds`, url: `https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications`, type: `blog`, free: true, why: `The case for weighting integration tests, and what each layer buys you.` },
          { t: `Testing on the Toilet: Test Behavior, Not Implementation`, by: `Google Testing Blog`, url: `https://testing.googleblog.com/2013/08/testing-on-toilet-test-behavior-not.html`, type: `blog`, free: true, why: `The one-page rule that keeps tests alive through refactors.` }
        ]
      },
      {
        id: `test-unit`,
        title: `Unit tests in Go and Python`,
        what: `Fast tests of one unit of behavior that run in milliseconds with no network or disk. Most of the craft is structuring cases and choosing test doubles.`,
        points: [
          `Go: table-driven tests, a slice of cases run as <code>t.Run(tc.name, ...)</code> subtests, <code>t.Parallel()</code> where safe, <code>cmp.Diff</code> for readable failures`,
          `Python: pytest with plain <code>assert</code>, <code>@pytest.mark.parametrize</code> for tables, fixtures for setup with <code>yield</code> for teardown, built-in <code>tmp_path</code> and <code>monkeypatch</code>`,
          `Fakes vs mocks: a fake is a working lightweight version (an in-memory repo), a mock asserts which calls happened; prefer real objects, then fakes, and mock only true boundaries`,
          `In Go, accept small interfaces where you use them, so a test can pass an in-memory struct instead of a mocking framework`,
          `Name tests after behavior (<code>TestSend_RetriesOn5xx</code>) and keep one reason to fail per case`
        ],
        use: `For pure logic with many edge cases: parsing, pricing, validation, retry and backoff math, state machines.`,
        avoid: `Do not unit test glue code by mocking every dependency; if a test is mostly mock setup, cover that path with an integration test instead.`,
        res: [
          { t: `TableDrivenTests`, by: `Go Wiki`, url: `https://go.dev/wiki/TableDrivenTests`, type: `docs`, free: true, why: `The idiomatic Go test layout, with subtests and parallel cases.` },
          { t: `How to use fixtures`, by: `pytest`, url: `https://docs.pytest.org/en/stable/how-to/fixtures.html`, type: `docs`, free: true, why: `Scopes, yield teardown, factories and parametrized fixtures.` },
          { t: `Software Engineering at Google, Chapter 13: Test Doubles`, by: `Andrew Trenk and Dillon Bly`, url: `https://abseil.io/resources/swe-book/html/ch13.html`, type: `book`, free: true, why: `When to use real objects, fakes, stubs or interaction testing, and why.` }
        ]
      },
      {
        id: `test-integration`,
        title: `Integration tests with real dependencies`,
        what: `Tests that run your code against real Postgres, Redis or Kafka in throwaway containers, so SQL, migrations and serialization are exercised for real.`,
        points: [
          `Testcontainers starts real containers from test code with ready-made modules (Postgres, Redis, Kafka, LocalStack); its Ryuk reaper cleans up even after a crash`,
          `Start containers once per package or session (<code>TestMain</code> in Go, a session-scoped pytest fixture) and isolate tests with rolled-back transactions or per-test schemas`,
          `Run your real migrations against the container; this catches the SQL, index and constraint bugs that mocks hide`,
          `Wait on readiness (log line, open port, SQL ping) with the library's wait strategies, never a fixed sleep`,
          `Fake what you cannot run: LocalStack for AWS, <code>httptest.NewServer</code> in Go or respx in Python for third-party HTTP APIs`
        ],
        use: `For repositories, queries, migrations, caching and queue producers or consumers: anything whose correctness depends on the real dependency.`,
        avoid: `Do not point tests at one long-lived shared dev database; shared state makes tests order-dependent and flaky.`,
        res: [
          { t: `Getting started with Testcontainers`, by: `Testcontainers`, url: `https://testcontainers.com/getting-started/`, type: `docs`, free: true, why: `The idea, the lifecycle, and why real dependencies beat mocks and in-memory fakes.` },
          { t: `Testcontainers for Go`, by: `Testcontainers`, url: `https://golang.testcontainers.org/`, type: `docs`, free: true, why: `Go API, wait strategies, cleanup and the module catalog.` },
          { t: `testcontainers-python`, by: `Testcontainers`, url: `https://testcontainers-python.readthedocs.io/`, type: `docs`, free: true, why: `The same approach in Python, ready for pytest fixtures.` }
        ]
      },
      {
        id: `test-contract`,
        title: `Contract tests between services`,
        what: `Tests that check a provider still gives each consumer what it relies on, without deploying both together. They replace many slow, shared end-to-end tests.`,
        points: [
          `Consumer-driven contracts (Pact): the consumer's tests record the requests it makes and the responses it needs; the provider replays them in its own CI`,
          `A broker stores contracts and verification results, and <code>can-i-deploy</code> answers whether a version is safe to release`,
          `Schema-first alternative: keep the OpenAPI or protobuf spec in the repo and fail CI on breaking changes with oasdiff or <code>buf breaking</code>`,
          `Assert only what the consumer uses; extra provider fields must not break anyone (the tolerant reader pattern)`,
          `For public APIs and webhooks the published schema is the contract: removing a field or changing an enum breaks customers you cannot see`
        ],
        use: `When several services or teams talk over HTTP or queues and deploy independently, and end-to-end environments are slow or shared.`,
        avoid: `Do not use contract tests to check provider business logic, and skip them when one team ships both sides together from one repo.`,
        res: [
          { t: `Pact documentation`, by: `Pact Foundation`, url: `https://docs.pact.io/`, type: `docs`, free: true, why: `Consumer-driven contract testing as "contract by example", and how it differs from schemas.` },
          { t: `Consumer-Driven Contracts: A Service Evolution Pattern`, by: `Ian Robinson (martinfowler.com)`, url: `https://martinfowler.com/articles/consumerDrivenContracts.html`, type: `blog`, free: true, why: `The original argument for letting consumers define the contract.` },
          { t: `oasdiff`, by: `oasdiff`, url: `https://github.com/oasdiff/oasdiff`, type: `repo`, free: true, why: `Detects breaking changes between two OpenAPI specs, ready for CI.` }
        ]
      },
      {
        id: `test-property`,
        title: `Property-based testing and fuzzing`,
        what: `Instead of hand-picking inputs, state a rule that must hold for all inputs and let the tool generate hundreds of cases, then shrink any failure to a minimal example.`,
        points: [
          `Good properties: round trip (<code>decode(encode(x)) == x</code>), invariants (lengths, ordering, totals), oracles (compare with a slow simple version), idempotence`,
          `Python: Hypothesis <code>@given(st.text())</code> generates inputs, shrinks failures, and saves them in an example database so they rerun first`,
          `Go: <code>func FuzzX(f *testing.F)</code>, seed with <code>f.Add</code>, run <code>go test -fuzz=FuzzX</code>; failing inputs land in <code>testdata/fuzz</code> and run as regression tests`,
          `Best targets: parsers and encoders (phone numbers, SMS segment splitting, webhook payloads), validators, money and time math`,
          `Run fuzzers briefly in CI (<code>-fuzztime=30s</code>) and for longer on a schedule`
        ],
        use: `For code with a clear rule and a huge input space: parsers, encoders, validators, serializers and anything that handles untrusted input.`,
        avoid: `Do not write properties that re-implement the code under test, and do not leave fuzzing unbounded in the main CI path.`,
        res: [
          { t: `Tutorial: Getting started with fuzzing`, by: `Go team`, url: `https://go.dev/doc/tutorial/fuzz`, type: `tutorial`, free: true, why: `Write a fuzz test, find a real bug, and keep the failing input.` },
          { t: `Hypothesis documentation`, by: `Hypothesis`, url: `https://hypothesis.readthedocs.io/`, type: `docs`, free: true, why: `Strategies, settings and the example database.` },
          { t: `What is property-based testing?`, by: `Hypothesis`, url: `https://hypothesis.works/articles/what-is-property-based-testing/`, type: `blog`, free: true, why: `A short, precise definition, and how it relates to fuzzing.` }
        ]
      },
      {
        id: `test-e2e`,
        title: `End-to-end tests and flaky tests`,
        what: `E2E tests drive the whole deployed system the way a user would. They give the most confidence per test and the most pain per failure, so keep them few and reliable.`,
        points: [
          `Keep E2E to a handful of critical journeys (sign up, send a message, receive the status webhook) and run them against staging after each deploy`,
          `Common flake sources: fixed sleeps, shared test data, order dependence, real clocks, live third-party calls, unawaited async work`,
          `Fix by polling a condition with a deadline (until status is <code>delivered</code>), unique data per run and isolated environments, never by a longer sleep`,
          `Quarantine a flaky test at once with an owner and a ticket, then fix or delete it within days; a suite people rerun until green protects nothing`,
          `Make failures debuggable from CI alone: attach request IDs, logs and payloads to the failure`
        ],
        use: `For the few flows where a break means lost revenue or trust, and as a smoke test after every deploy.`,
        avoid: `Do not test edge cases through E2E or hide flakiness behind silent automatic retries; push edge cases down to unit and integration tests.`,
        res: [
          { t: `Just Say No to More End-to-End Tests`, by: `Google Testing Blog`, url: `https://testing.googleblog.com/2015/04/just-say-no-to-more-end-to-end-tests.html`, type: `blog`, free: true, why: `Why E2E-heavy suites give slow, vague feedback.` },
          { t: `Eradicating Non-Determinism in Tests`, by: `Martin Fowler`, url: `https://martinfowler.com/articles/nonDeterminism.html`, type: `blog`, free: true, why: `The classic catalog of flake causes and how to fix each one.` },
          { t: `Flaky Tests at Google and How We Mitigate Them`, by: `Google Testing Blog`, url: `https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html`, type: `blog`, free: true, why: `Flakiness at scale, with numbers, and the mitigations that worked.` }
        ]
      },
      {
        id: `test-load`,
        title: `Load and performance tests`,
        what: `Measuring how a system behaves under expected and extreme traffic: latency percentiles, throughput, error rate, and what breaks first.`,
        points: [
          `Test types: smoke, average load, stress, spike (sudden burst), soak (hours, finds leaks), breakpoint (ramp until it fails)`,
          `Use an open model (fixed arrival rate, like k6 <code>constant-arrival-rate</code>) for public APIs; closed models slow down with the system and hide latency (coordinated omission)`,
          `Report p50, p95, p99 and error rate, never just the average, next to CPU, memory, DB connections and queue depth`,
          `Set pass/fail thresholds (for example p95 &lt; 300 ms, errors &lt; 0.1%) so the test can gate a release`,
          `Micro level: Go benchmarks (<code>for b.Loop()</code>, <code>-benchmem</code>) plus pprof to find the hot path before and after a change`
        ],
        use: `Before a launch, a large customer onboarding or an infrastructure change, and to learn each service's real capacity before a traffic burst teaches you.`,
        avoid: `Do not load test production or shared staging without warning people, and do not trust numbers from a load generator that is itself CPU-bound.`,
        res: [
          { t: `Load test types`, by: `Grafana k6`, url: `https://grafana.com/docs/k6/latest/testing-guides/test-types/`, type: `docs`, free: true, why: `What each test type answers and how to shape its load.` },
          { t: `Open and closed models`, by: `Grafana k6`, url: `https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/open-vs-closed/`, type: `docs`, free: true, why: `Why arrival-rate executors avoid coordinated omission.` },
          { t: `How NOT to Measure Latency`, by: `Gil Tene`, url: `https://www.youtube.com/watch?v=lJ8ydIuPFeU`, type: `video`, free: true, why: `The talk that explains percentiles and coordinated omission.` }
        ]
      },
      {
        id: `test-async`,
        title: `Testing async code, queues and time`,
        what: `Code that sleeps, retries, schedules or consumes queues is hard to test because real time and concurrency are non-deterministic. Control the clock and wait on conditions, never on sleeps.`,
        points: [
          `Inject a clock (an interface with <code>Now</code> and <code>After</code>) instead of calling <code>time.Now</code> directly, so tests can jump ahead five minutes instantly`,
          `Go 1.25 <code>testing/synctest</code>: <code>synctest.Test</code> runs code in a bubble with a fake clock that advances only when every goroutine is blocked; <code>synctest.Wait</code> lets them settle`,
          `Python: pytest-asyncio for <code>async def</code> tests, time-machine or freezegun to control <code>datetime</code>, <code>asyncio.wait_for</code> so a hung test fails fast`,
          `Queues: test the handler as a function (message in, side effects out), add one integration test with a real broker, and deliver the same message twice to prove idempotency`,
          `When you must wait, poll a condition with a deadline (<code>require.Eventually</code> in testify) instead of sleeping`
        ],
        use: `For retries with backoff, scheduled jobs, TTLs and expiry, rate limiters, webhook redelivery and every queue consumer.`,
        avoid: `Do not use sleeps to wait for background work; they make tests slow when they pass and flaky when the machine is busy.`,
        res: [
          { t: `Testing Time (and other asynchronicities)`, by: `Damien Neil (Go blog)`, url: `https://go.dev/blog/testing-time`, type: `blog`, free: true, why: `Why fake clocks are hard and how synctest solves it.` },
          { t: `pytest-asyncio`, by: `pytest-asyncio`, url: `https://pytest-asyncio.readthedocs.io/`, type: `docs`, free: true, why: `Running async tests and fixtures under pytest.` },
          { t: `time-machine`, by: `Adam Johnson`, url: `https://github.com/adamchainz/time-machine`, type: `repo`, free: true, why: `Fast, reliable time travel for Python tests.` }
        ]
      }
    ],
    done: `You are done when a service you own has table-driven unit tests, a Testcontainers integration test on real Postgres, a fuzz or property test on a parser, and a retry test driven by a fake clock with no sleeps, all green in CI.`
  }
);
