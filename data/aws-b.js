/* AWS service guide, part B: groups 5-9, AWS decision guides, and page-level sections.
   Numbers checked against AWS docs and pricing pages as of 2026-10-01. */
window.HUB_AWS = window.HUB_AWS || { groups: [], guides: [] };

window.HUB_AWS.groups.push(
  {
    name: `Messaging and events`,
    services: [
      {
        name: `SQS`,
        what: `Fully managed message queue: producers send, workers poll, process, then delete. Standard queues give nearly unlimited throughput with at-least-once delivery and best-effort order; FIFO queues keep strict order per message group and drop duplicate sends within 5 minutes.`,
        use: `Your default for background jobs and for soaking up spikes between services, such as one send job per outbound message or webhook deliveries with retries. Reach for FIFO only when order per key (one account, one conversation) really matters.`,
        avoid: `When several consumers each need every message (put SNS or EventBridge in front), when you need to replay history (Kinesis or MSK), or when a job has many steps, timers and state (Step Functions or a workflow engine).`,
        gotchas: [
          `Delivery is at least once. If a worker runs past the visibility timeout (default 30 seconds), another worker gets the same message, so make handlers idempotent and extend visibility for long jobs.`,
          `On a standard queue, a message keeps its original enqueue time when it moves to the DLQ, so a DLQ with the same retention deletes it early. Give the DLQ a longer retention than the source queue.`,
          `One noisy tenant can starve everyone on a shared queue. Setting <code>MessageGroupId</code> (say, the tenant ID) on a standard queue turns on fair queues, which favor quiet tenants when one hogs in-flight messages; those requests bill at an extra fair-queue rate.`
        ],
        limits: [
          `Max message 1 MiB (1,048,576 bytes); bigger payloads go to S3 through the Extended Client Library (up to 2 GB).`,
          `Retention 60 seconds to 14 days (default 4 days); visibility timeout up to 12 hours; delay up to 15 minutes.`,
          `FIFO: 300 TPS per API action per partition, 3,000 messages/s with batches of 10; high-throughput mode reaches 70,000 TPS in the largest Regions.`
        ],
        res: [
          { t: `Amazon SQS message quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/quotas-messages.html` },
          { t: `Amazon SQS fair queues`, by: `AWS`, url: `https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/sqs-fair-queues.html` }
        ]
      },
      {
        name: `SNS`,
        what: `Managed pub/sub. A publisher sends one message to a topic and SNS pushes a copy to every subscriber: SQS queues, Lambda functions, HTTPS endpoints, email, SMS or mobile push.`,
        use: `Fan-out: one event, several independent consumers, each behind its own SQS queue so they fail and retry separately (SNS → SQS). Subscription filter policies let each queue receive only the messages it cares about.`,
        avoid: `For content routing across many teams and accounts, EventBridge is the better router; for replay, use Kinesis or MSK. For real SMS traffic, go straight to AWS End User Messaging: SNS SMS starts with a $1.00 default spend threshold and 20 messages per second.`,
        gotchas: [
          `HTTPS subscribers get a retry policy capped at 3,600 seconds in total (hard limit); after that SNS drops the message unless the subscription has a DLQ. SQS and Lambda subscribers are retried for up to 23 days.`,
          `Default max message is 256 KiB. You can raise a topic to 1 MiB with <code>MaximumMessageSize</code>, but then it only allows SQS, Lambda and Firehose subscribers, 100 at most.`,
          `Filtering on message attributes is free; filtering on the message body is billed per GB scanned for every subscription that has a filter.`
        ],
        limits: [
          `Standard topic: up to 12,500,000 subscriptions; FIFO topic: 100.`,
          `Publish quota per account: 30,000 messages/s in us-east-1 (soft), far lower in most other Regions.`,
          `FIFO topic: 300 messages/s per message group; 3,000 messages/s or 20 MB/s per topic by default.`
        ],
        res: [
          { t: `Amazon SNS endpoints and quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/general/latest/gr/sns.html` },
          { t: `Amazon SNS message delivery retries`, by: `AWS`, url: `https://docs.aws.amazon.com/sns/latest/dg/sns-message-delivery-retries.html` }
        ]
      },
      {
        name: `EventBridge`,
        what: `Serverless event router. Producers put JSON events on a bus, and rules or subscribers match on content and deliver to targets such as SQS, Lambda, Step Functions or HTTP APIs; Pipes (point to point) and Scheduler (cron and one-time jobs) live in the same service.`,
        use: `Integration events between teams and accounts, where producers should not know their consumers, plus reacting to AWS service events. Scheduler also covers delayed one-off jobs (remind in 3 days) that SQS delays, capped at 15 minutes, cannot.`,
        avoid: `Not a work queue or a high-volume stream: use SQS or Kinesis. On a Classic bus there is no ordering, each rule reaches at most 5 targets, and PutEvents is throttled per Region (10,000 requests/s in us-east-1 by default).`,
        gotchas: [
          `Since September 2026 there are two custom bus types with different APIs. The new Custom Event Bus keeps events 1-365 days, orders per event group, dedupes within 5 minutes and lets each subscriber replay; the Custom Event Bus - Classic has rules and targets and keeps nothing unless you add an archive.`,
          `Classic targets retry for 24 hours and up to 185 times, then drop the event unless the target has a DLQ. Subscribers on the new bus default to 5 attempts or 300 seconds, so set the retry policy and DLQ yourself.`,
          `A PutEvents call can succeed while single entries fail. Check <code>FailedEntryCount</code> (Classic) or each entry's result, and resend only the failures.`
        ],
        limits: [
          `PutEvents (Classic): up to 10 entries per request, whole request under 1 MB (1,048,576 bytes); one event can use the full 1 MB.`,
          `Classic: 300 rules per bus by default (adjustable), 5 targets per rule.`,
          `New Custom Event Bus: up to 500,000 events/s per bus, retention 1-365 days, up to 100 entries per publish.`
        ],
        res: [
          { t: `What is the EventBridge Custom Event Bus?`, by: `AWS`, url: `https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-custom-bus-what-is.html` },
          { t: `Amazon EventBridge quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-quota.html` }
        ]
      },
      {
        name: `Kinesis Data Streams`,
        what: `A managed, ordered and replayable log split into shards. Records with the same partition key land on the same shard in order, and several consumers can read the same data independently for up to 365 days.`,
        use: `High-volume event streams that several consumers read at their own pace, such as message or call events feeding billing, analytics and fraud checks, when you want serverless operations instead of running Kafka. On-demand mode suits spiky traffic; provisioned suits steady, predictable load.`,
        avoid: `Per-message work with retries and DLQs belongs in SQS: a stream has no per-record ack, and with default settings one bad record can block a Lambda consumer's shard for up to a week. If the team already runs Kafka or needs its ecosystem, use MSK.`,
        gotchas: [
          `A hot partition key is capped at one shard's write limit (1 MB/s or 1,000 records/s) no matter how many shards you add. Use high-cardinality keys and keep strict order only where you need it.`,
          `Shared-throughput consumers split 2 MB/s and 5 GetRecords calls per second per shard. With more than a couple of readers, use enhanced fan-out (2 MB/s per consumer per shard).`,
          `The KCL creates DynamoDB tables for leases, worker metrics and coordination and never deletes them. Clean them up when you retire a consumer, or keep paying for them.`
        ],
        limits: [
          `Per shard: 1 MB/s or 1,000 records/s in, 2 MB/s out.`,
          `Retention 24 hours by default, up to 365 days (8,760 hours).`,
          `Records up to 10 MiB; on-demand streams start at 4 MB/s write and scale to 10 GB/s in the largest Regions (200 MB/s elsewhere).`
        ],
        res: [
          { t: `Kinesis Data Streams quotas and limits`, by: `AWS`, url: `https://docs.aws.amazon.com/streams/latest/dev/service-sizes-and-limits.html` },
          { t: `Develop enhanced fan-out consumers with dedicated throughput`, by: `AWS`, url: `https://docs.aws.amazon.com/streams/latest/dev/enhanced-consumers.html` }
        ]
      },
      {
        name: `Amazon MSK`,
        what: `Managed Apache Kafka. AWS runs the brokers and controllers; you still own topics, partitions, consumer groups and client tuning.`,
        use: `When you need Kafka itself: existing Kafka clients and tooling, Kafka Connect, compacted topics or portability off AWS. MSK Serverless for small or unknown load; provisioned Standard or Express brokers for large, steady throughput.`,
        avoid: `For a job queue or simple fan-out, SQS and SNS are far less work. If nobody on the team has run Kafka and you only need an ordered, replayable stream on AWS, Kinesis is simpler.`,
        gotchas: [
          `Provisioned clusters bill broker-hours around the clock, and adding brokers or moving partitions is real work. Express brokers help (storage you never size, up to 20x faster scaling) but run only in 3-AZ clusters and do not fully support the Kafka Streams API.`,
          `MSK Serverless requires IAM access control and does not support Kafka ACLs, so every client must be set up for IAM auth.`,
          `Replication between brokers is free, but producers and consumers talking to brokers in other AZs pay normal data transfer.`
        ],
        limits: [
          `Serverless cluster: 200 MBps in, 400 MBps out, 5 MBps in per partition, 2,400 partitions, 8 MiB max message.`,
          `Express broker: up to 3x the throughput of a Standard broker (about 500 MBps of writes on m7g.16xlarge).`,
          `Standard brokers: 90 per account, and 30 per cluster (ZooKeeper) or 60 (KRaft) by default.`
        ],
        res: [
          { t: `Amazon MSK Express brokers`, by: `AWS`, url: `https://docs.aws.amazon.com/msk/latest/developerguide/msk-broker-types-express.html` },
          { t: `Amazon MSK quota`, by: `AWS`, url: `https://docs.aws.amazon.com/msk/latest/developerguide/limits.html` }
        ]
      },
      {
        name: `Step Functions`,
        what: `Managed state machines. You describe steps, branches, retries, waits and parallel maps in Amazon States Language (JSON), and it runs and records every execution.`,
        use: `Orchestrating multi-step processes across AWS services with retries and timeouts, like an onboarding or number-provisioning flow, including waiting days for a callback with <code>.waitForTaskToken</code>. Standard for long, auditable, exactly-once runs; Express for short, high-volume, idempotent work.`,
        avoid: `For fire-and-forget jobs, SQS plus a worker is cheaper and simpler. For complex business logic you want to write and unit test as code, a code-first engine like Temporal beats a large JSON state machine.`,
        gotchas: [
          `The type is fixed at creation. Express runs at most 5 minutes, is at-least-once when started async, and does not support <code>.sync</code> or callback tasks.`,
          `Inputs and outputs cap at 256 KiB per state. Pass S3 keys or IDs, not payloads.`,
          `Standard bills per state transition and fails an execution whose history reaches 25,000 events, so a tight polling loop is both costly and fatal. Use Wait states instead of busy polls, and child executions for long loops.`
        ],
        limits: [
          `Standard: up to 1 year per execution, exactly-once, history kept 90 days after it closes.`,
          `Express: up to 5 minutes per execution, billed per request and GB-second.`,
          `Standard in us-east-1: $0.000025 per state transition, 4,000 free per month.`
        ],
        res: [
          { t: `Choosing workflow type in Step Functions`, by: `AWS`, url: `https://docs.aws.amazon.com/step-functions/latest/dg/choosing-workflow-type.html` },
          { t: `Step Functions service quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/step-functions/latest/dg/service-quotas.html` }
        ]
      }
    ]
  },
  {
    name: `Observability and operations`,
    services: [
      {
        name: `CloudWatch`,
        what: `AWS's built-in metrics, logs, alarms and dashboards. AWS services publish metrics to it automatically; you add custom metrics, application logs and alarms that notify SNS or drive scaling.`,
        use: `The default for AWS service metrics (ALB 5xx, SQS <code>ApproximateAgeOfOldestMessage</code>), alarms that page or scale, and container logs queried with Logs Insights. Emit metrics inside structured logs with the Embedded Metric Format, so no separate metrics code is needed.`,
        avoid: `High-cardinality metrics (per customer, per phone number) get expensive as classic custom metrics; send OpenTelemetry metrics or use Managed Prometheus. And do not use it as a years-long log archive: set retention and export to S3.`,
        gotchas: [
          `Every unique combination of dimensions is a separate billed metric. One customer ID dimension can turn a single metric into thousands overnight.`,
          `Log groups keep data forever by default. Set retention everywhere, and put rarely read logs in the Infrequent Access class (lower ingestion price, but no metric filters, subscription filters or Live Tail, and the class cannot be changed later).`,
          `Metrics cannot be deleted; they expire 15 months after the last data point. Data at under 60-second resolution is kept only 3 hours before it is rolled up.`
        ],
        limits: [
          `Metric retention: 1-minute data 15 days, 5-minute data 63 days, 1-hour data 455 days.`,
          `Logs in us-east-1: $0.50 per GB ingested (Standard) or $0.25 (Infrequent Access), $0.03 per GB-month stored.`,
          `Custom metrics: $0.30 per metric per month for the first 10,000; up to 30 dimensions each.`
        ],
        res: [
          { t: `CloudWatch metrics concepts`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/cloudwatch_concepts.html` },
          { t: `Amazon CloudWatch pricing`, by: `AWS`, url: `https://aws.amazon.com/cloudwatch/pricing/` }
        ]
      },
      {
        name: `X-Ray`,
        what: `AWS's distributed tracing backend. It stores traces, draws the service map and lets you find slow or failing requests; with Transaction Search, spans also land in CloudWatch Logs.`,
        use: `When a request crosses several services (ALB → API → queue → worker) and you need to see where time and errors go. Feed it OpenTelemetry data through ADOT or the CloudWatch agent.`,
        avoid: `Do not start new instrumentation on the X-Ray SDKs or daemon: they have been in maintenance mode (security fixes only) since February 25, 2026. If you already run a vendor APM, Jaeger or Tempo, X-Ray adds little.`,
        gotchas: [
          `Tracing is sampled and the default rate is conservative, so the one failed request a customer reports may have no trace. Raise sampling on important routes; AWS even suggests tracing every call that modifies state.`,
          `X-Ray accepts at most 2,600 segments per second per Region, and that quota is not adjustable. Chatty fan-out services hit it sooner than you expect.`,
          `Transaction Search ingests 100% of spans as logs in the <code>aws/spans</code> log group. Great for search, but it bills as CloudWatch Logs ingestion.`
        ],
        limits: [
          `Traces and service map data kept 30 days.`,
          `Segment document up to 64 KB; 50 indexed annotations per trace.`,
          `$0.000005 per trace recorded; the first 100,000 traces each month are free.`
        ],
        res: [
          { t: `Migrating from X-Ray instrumentation to OpenTelemetry instrumentation`, by: `AWS`, url: `https://docs.aws.amazon.com/xray/latest/devguide/xray-sdk-migration.html` },
          { t: `CloudWatch Transaction Search`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-Transaction-Search.html` }
        ]
      },
      {
        name: `AWS Distro for OpenTelemetry (ADOT)`,
        what: `AWS's tested and supported distribution of OpenTelemetry: SDKs, auto-instrumentation agents and a collector. Instrument once and send metrics and traces to CloudWatch, X-Ray, Managed Prometheus or OpenSearch.`,
        use: `The default instrumentation for new Go and Python services now that X-Ray is moving to OpenTelemetry. On ECS, run the ADOT collector next to your tasks and point the SDKs at it.`,
        avoid: `On EC2 or on-prem hosts that already run the CloudWatch agent, that agent can collect OpenTelemetry traces too, so skip a second collector. If you are all-in on a vendor APM, use its agent or OTLP endpoint instead.`,
        gotchas: [
          `The collector is now part of your production path. Give it memory and batching and alarm on dropped data, or telemetry vanishes right when an incident starts.`,
          `Cardinality is still your bill: attributes like user ID or phone number on metrics multiply series in CloudWatch and Prometheus alike. Put them on spans and logs instead.`,
          `Async hops break traces unless context travels with the message. Check that trace context is propagated through SQS message attributes (they count toward the 10 per message), or every worker starts a new, disconnected trace.`
        ],
        limits: [
          `OTLP metrics sent to CloudWatch: $0.50 per GB ingested, including 15 months of storage and no per-series charge.`,
          `CloudWatch OpenTelemetry metrics accept up to 150 labels per metric.`
        ],
        res: [
          { t: `AWS Distro for OpenTelemetry and AWS X-Ray`, by: `AWS`, url: `https://docs.aws.amazon.com/xray/latest/devguide/xray-services-adot.html` },
          { t: `OpenTelemetry in Amazon CloudWatch`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/CloudWatch-OpenTelemetry-Sections.html` }
        ]
      },
      {
        name: `Amazon Managed Service for Prometheus`,
        what: `Serverless, Prometheus-compatible metrics store. You remote-write samples into a workspace and query them with PromQL; AWS scales it and replicates data across three AZs.`,
        use: `When you already use Prometheus exporters, PromQL and alert rules, especially on Kubernetes, and want long retention without running Thanos or Cortex yourself. Pair it with Managed Grafana for dashboards.`,
        avoid: `For a handful of AWS metrics and alarms, CloudWatch is simpler and already there. Its agentless managed collector covers EKS (plus MSK and OpenSearch), so on ECS you still run your own collector, such as ADOT.`,
        gotchas: [
          `You pay per sample ingested, so scrape interval and label cardinality are the bill. Scraping every 15 seconds instead of every 30 doubles it.`,
          `Queries bill by samples processed, so auto-refreshing dashboards over long time ranges add up.`,
          `Alerts go through a managed Alertmanager inside the workspace that sends to SNS or PagerDuty, not through CloudWatch alarms. Plan routing and silences there.`
        ],
        limits: [
          `Retention 150 days by default, configurable up to 1,095 days (3 years).`,
          `Active series: 50 million per workspace by default (adjustable, max 1.5 billion).`,
          `Ingestion: up to 1,666,666 samples/s per workspace by default.`
        ],
        res: [
          { t: `What is Amazon Managed Service for Prometheus?`, by: `AWS`, url: `https://docs.aws.amazon.com/prometheus/latest/userguide/what-is-Amazon-Managed-Service-Prometheus.html` },
          { t: `Amazon Managed Service for Prometheus service quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/prometheus/latest/userguide/AMP_quotas.html` }
        ]
      },
      {
        name: `Amazon Managed Grafana`,
        what: `Managed Grafana workspaces. AWS runs, patches and scales Grafana; you build dashboards over CloudWatch, Managed Prometheus, X-Ray, OpenSearch and other sources.`,
        use: `One place to put Prometheus metrics next to CloudWatch data, with single sign-on through IAM Identity Center or a SAML provider, when you do not want to operate Grafana.`,
        avoid: `For a small team happy with CloudWatch dashboards, it is one more bill and one more login. If you need the newest Grafana release or unusual plugins right away, self-hosted Grafana gives more control.`,
        gotchas: [
          `Priced per active user per workspace, and every workspace pays for at least one editor even if nobody logs in. API users and service accounts bill like people.`,
          `People sign in through IAM Identity Center or SAML, not IAM users, so set up SSO first.`,
          `Enterprise plugins add $45 per active user per workspace on top of the base license.`
        ],
        limits: [
          `$9 per active editor or admin and $5 per active viewer, per workspace per month.`,
          `5 workspaces per Region by default (adjustable).`
        ],
        res: [
          { t: `What is Amazon Managed Grafana?`, by: `AWS`, url: `https://docs.aws.amazon.com/grafana/latest/userguide/what-is-Amazon-Managed-Service-Grafana.html` },
          { t: `Amazon Managed Grafana pricing`, by: `AWS`, url: `https://aws.amazon.com/grafana/pricing/` }
        ]
      },
      {
        name: `CloudTrail`,
        what: `The audit log of AWS API calls: who did what, from where, to which resource. Management events are recorded by default; data events such as S3 object reads or Lambda invokes are opt-in.`,
        use: `Security investigations and compliance. Create an organization trail into a locked-down S3 bucket in a separate log account, and alert on risky calls such as IAM policy changes.`,
        avoid: `It is not application logging or real-time detection: trail logs land in S3 about every 5 minutes on average, with no guarantee. Use your own logs and metrics for app behavior.`,
        gotchas: [
          `Data events are off by default and billed separately ($0.10 per 100,000 delivered). Turning them on for a busy S3 bucket can cost more than the bucket.`,
          `Only one copy of management events is free. A second trail, say one per team, bills $2.00 per 100,000 events.`,
          `CloudTrail Lake closed to new customers on May 31, 2026. To run SQL over trail logs, query the S3 trail with Athena.`
        ],
        limits: [
          `Event history: the last 90 days of management events per Region, free.`,
          `If the trail cannot deliver (for example the bucket is unreachable), CloudTrail retries for 30 days and still bills those events.`
        ],
        res: [
          { t: `Working with CloudTrail event history`, by: `AWS`, url: `https://docs.aws.amazon.com/awscloudtrail/latest/userguide/view-cloudtrail-events.html` },
          { t: `AWS CloudTrail pricing`, by: `AWS`, url: `https://aws.amazon.com/cloudtrail/pricing/` }
        ]
      },
      {
        name: `Systems Manager (Parameter Store, Session Manager)`,
        what: `An operations toolbox. Parameter Store is a hierarchical key-value store for config and simple secrets (SecureString uses KMS); Session Manager gives IAM-controlled shell access to hosts and containers without SSH keys, bastions or open inbound ports.`,
        use: `Parameter Store for plain config (endpoints, feature defaults, tuning knobs) read at startup and cached. Session Manager, and ECS Exec which is built on it, for break-glass access to EC2 hosts and containers, with sessions logged to S3 or CloudWatch Logs.`,
        avoid: `Do not read Parameter Store on every request: by default the whole account and Region share 40 TPS for parameter reads. For secrets that rotate, use Secrets Manager; for live config changes with gradual rollout and automatic rollback, use AppConfig.`,
        gotchas: [
          `A scale-out where every new task reads parameters at boot can blow through 40 TPS and fail the deploy with throttling errors. Cache, batch reads, or turn on higher throughput (billed per API call).`,
          `Advanced parameters cannot be downgraded to standard, and each costs $0.05 a month.`,
          `Session Manager can log every command and its output, so never type secrets into a session.`
        ],
        limits: [
          `Standard tier: 10,000 parameters of up to 4 KB, free; Advanced: 100,000 of up to 8 KB.`,
          `Reads: 40 TPS by default; higher throughput allows GetParameter up to 10,000 TPS.`,
          `Up to 100 versions kept per parameter.`
        ],
        res: [
          { t: `Managing Parameter Store throughput`, by: `AWS`, url: `https://docs.aws.amazon.com/systems-manager/latest/userguide/parameter-store-throughput.html` },
          { t: `AWS Systems Manager Session Manager`, by: `AWS`, url: `https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html` }
        ]
      }
    ]
  },
  {
    name: `Security and identity`,
    services: [
      {
        name: `IAM`,
        what: `Controls who can do what on which AWS resource. Workloads assume roles for short-lived credentials, and policies allow or deny actions with conditions on tags, networks or organization.`,
        use: `Give every workload its own role (one ECS task role per service) with least privilege scoped to specific resources, and no long-lived access keys. Add permission boundaries and SCPs as guardrails when teams create their own roles.`,
        avoid: `Do not hand out IAM users with access keys to apps or people; use roles, and IAM Identity Center for humans. Do not use IAM for your product's customer login; that is Cognito or your own auth.`,
        gotchas: [
          `An explicit deny anywhere (identity policy, resource policy, SCP) beats every allow. When access fails, hunt for the deny first.`,
          `IAM is eventually consistent: a role or policy you just created may not work everywhere for a short time. Do not create and use it in the same hot path.`,
          `Role chaining (assuming a role with another role's credentials) caps the session at 1 hour, whatever the role's maximum session setting.`
        ],
        limits: [
          `Managed policy up to 6,144 characters; a role's inline policies up to 10,240 characters in total.`,
          `20 managed policies per role by default (25 max); 1,000 roles per account by default (10,000 max).`,
          `STS: 600 requests/s per account per Region, shared by AssumeRole, GetCallerIdentity and similar calls.`
        ],
        res: [
          { t: `IAM and AWS STS quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_iam-quotas.html` },
          { t: `Security best practices in IAM`, by: `AWS`, url: `https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html` }
        ]
      },
      {
        name: `KMS`,
        what: `Managed encryption keys. Services such as S3, EBS, RDS, SQS and Secrets Manager use KMS keys to protect their data keys, and key policies decide who may use each key.`,
        use: `Customer managed keys when you need control over who can decrypt, separate keys per data class, or a kill switch (disable the key). For app-level encryption, use envelope encryption: call GenerateDataKey, encrypt locally, and store the wrapped key next to the data.`,
        avoid: `Do not call Encrypt on bulk data; it takes at most 4,096 bytes. Think twice before a key per tenant or per object: each key costs $1 a month and every call counts against shared request quotas.`,
        gotchas: [
          `Heavy SSE-KMS traffic or per-request Decrypt calls hit the shared per-second quota and get throttled. Cache data keys (the AWS Encryption SDK supports this) instead of calling KMS every time.`,
          `Deleting a key has a 7-30 day waiting period (default 30), and a deleted key cannot be recovered, nor can data encrypted only under it. When unsure, disable the key instead.`,
          `Automatic rotation keeps old key material for decryption, so nothing needs re-encrypting. The period is 90-2,560 days (default 365), and each of the first two rotations adds $1 a month.`
        ],
        limits: [
          `Encrypt: up to 4,096 bytes of plaintext.`,
          `Symmetric crypto requests: 10,000/s shared by default; 100,000/s in us-east-1, us-west-2 and eu-west-1.`,
          `$1 per key per month; 20,000 free requests per month.`
        ],
        res: [
          { t: `AWS KMS request quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/kms/latest/developerguide/requests-per-second.html` },
          { t: `Rotate AWS KMS keys`, by: `AWS`, url: `https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html` }
        ]
      },
      {
        name: `Secrets Manager`,
        what: `Stores secrets encrypted with KMS, versions them, and rotates them on a schedule using a Lambda function or rotation managed by the owning service.`,
        use: `Database passwords, third-party API keys and signing keys: anything that must rotate or be audited. Aurora and RDS can manage master-user password rotation for you.`,
        avoid: `For plain config or values that never rotate, standard Parameter Store is free. Do not call GetSecretValue per request; cache in process or use the AWS Workload Credentials Provider (formerly the Secrets Manager Agent).`,
        gotchas: [
          `Rotation breaks clients that cache the old value forever. Use the alternating-users strategy for high availability, or refetch the secret and retry on an auth failure.`,
          `ECS injects a secret into an environment variable only at container start. After a rotation, running tasks keep the old value until you force a new deployment.`,
          `The Workload Credentials Provider refreshes its cache every 300 seconds by default and has no invalidation, so it can serve a stale secret right after rotation.`
        ],
        limits: [
          `Rotation as often as every 4 hours; the longest rotation period is 999 days.`,
          `Secret value up to 65,536 bytes; GetSecretValue up to 10,000 requests/s.`,
          `$0.40 per secret per month plus $0.05 per 10,000 API calls.`
        ],
        res: [
          { t: `Secrets Manager rotation schedules`, by: `AWS`, url: `https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotate-secrets_schedule.html` },
          { t: `Lambda function rotation strategies`, by: `AWS`, url: `https://docs.aws.amazon.com/secretsmanager/latest/userguide/rotation-strategy.html` }
        ]
      },
      {
        name: `Certificate Manager (ACM)`,
        what: `Issues and auto-renews public TLS certificates for integrated AWS services such as load balancers, CloudFront and API Gateway at no charge, and tracks imported or private certificates.`,
        use: `Any TLS you terminate on a load balancer, CloudFront or API Gateway. Use DNS validation so renewals happen with no human involved.`,
        avoid: `Standard ACM certificates cannot be exported to your own servers or containers. For TLS inside a container or on-prem, use exportable public certificates (paid) or your own CA.`,
        gotchas: [
          `Certificates for CloudFront must live in us-east-1, whatever Region your app runs in.`,
          `Public certificates now last 198 days and renew 45 days before expiry, but only if the certificate is in use and its DNS CNAME record still exists. Delete that record in a cleanup and renewal fails.`,
          `Imported certificates never auto-renew. Alarm on their expiry dates.`
        ],
        limits: [
          `Validity 198 days; DNS-validated renewal starts 45 days before expiry.`,
          `2,500 certificates per Region per account by default; 10 domain names per certificate by default.`,
          `Exportable public certificates: $7 per domain name, $79 per wildcard name.`
        ],
        res: [
          { t: `Renewal for domains validated by DNS`, by: `AWS`, url: `https://docs.aws.amazon.com/acm/latest/userguide/dns-renewal-validation.html` },
          { t: `ACM public certificate characteristics and limitations`, by: `AWS`, url: `https://docs.aws.amazon.com/acm/latest/userguide/acm-certificate-characteristics.html` }
        ]
      },
      {
        name: `WAF`,
        what: `Layer 7 web application firewall for CloudFront, ALB, API Gateway, Cognito and more. Rules match on IPs, headers, body, geography or request rate, then block, count, CAPTCHA or allow.`,
        use: `Public endpoints that attract abuse: rate-based rules on login, OTP and signup routes, plus AWS managed rule groups for common exploits. Ship new rules in Count mode, watch the logs, then switch to Block.`,
        avoid: `It is not a DDoS plan on its own (that is Shield plus CloudFront) and not per-customer quota enforcement, which belongs in your API. Do not count on it to inspect large bodies behind an ALB.`,
        gotchas: [
          `Behind an ALB, WAF inspects only the first 8 KB of the body (CloudFront and API Gateway can go up to 64 KB). Choose the oversize handling (Continue, Match or No match) on purpose, or padded requests slip past body rules.`,
          `Rate-based rules count over a window of 60, 120, 300 or 600 seconds (default 300) and act near, not exactly at, your limit. They are flood control, not precise quotas.`,
          `A web ACL above 1,500 WCUs costs extra per request, and Bot Control and CAPTCHA are priced separately.`
        ],
        limits: [
          `Up to 5,000 WCUs per web ACL; 10 rate-based rules per web ACL.`,
          `Rate limit minimum of 10 requests per window; up to 10,000 IPs rate limited per rule.`,
          `Billed per web ACL, per rule and per million requests.`
        ],
        res: [
          { t: `AWS WAF quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/waf/latest/developerguide/limits.html` },
          { t: `Rate-based rule high-level settings in AWS WAF`, by: `AWS`, url: `https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based-high-level-settings.html` }
        ]
      },
      {
        name: `Shield`,
        what: `DDoS protection. Shield Standard covers every AWS customer against common network and transport layer attacks at no extra charge; Shield Advanced is a paid subscription with application layer mitigation, cost protection and a response team.`,
        use: `Standard is always on; get the most from it by fronting public traffic with CloudFront, Route 53 and Global Accelerator. Buy Advanced when an attack's downtime costs more than the subscription, such as a public API your customers' logins depend on.`,
        avoid: `Most teams do not need Advanced: CloudFront, WAF rate rules and autoscaling handle common floods. Skip it if you cannot commit to a year.`,
        gotchas: [
          `Advanced needs a 1-year commitment and adds data transfer out usage fees on top of the monthly fee; one subscription price covers all subscribed accounts in a consolidated billing family.`,
          `Reaching the Shield Response Team requires Business or Enterprise Support.`,
          `Advanced covers standard WAF fees on protected resources, but not Bot Control, CAPTCHA or web ACLs above 1,500 WCUs.`
        ],
        limits: [
          `Advanced: $3,000 per month on a 1-year term, plus data transfer usage fees.`,
          `Advanced includes up to 50 billion WAF requests per month on protected resources.`
        ],
        res: [
          { t: `AWS Shield Standard overview`, by: `AWS`, url: `https://docs.aws.amazon.com/waf/latest/developerguide/ddos-standard-summary.html` },
          { t: `AWS Shield Advanced overview`, by: `AWS`, url: `https://docs.aws.amazon.com/waf/latest/developerguide/ddos-advanced-summary.html` }
        ]
      },
      {
        name: `Cognito`,
        what: `Managed sign-up and sign-in for your app's end users (user pools) that issues tokens, plus identity pools that exchange those logins for temporary AWS credentials.`,
        use: `Customer login with social or SAML/OIDC federation, MFA and passkeys when you would rather not run an identity service, plus client-credentials tokens for machine-to-machine calls.`,
        avoid: `If your login flows need heavy customization or you already run a solid identity provider, Cognito's fixed model will fight you. For employee access to AWS accounts, use IAM Identity Center.`,
        gotchas: [
          `Required attributes (and some sign-in settings) cannot be changed after a user pool is created. Decide them up front.`,
          `Sign-ins and token refreshes share one quota: 120 requests/s by default across all user pools in the account and Region. Ask for an increase before a launch.`,
          `The 10,000 free MAUs apply only to Lite and Essentials; Plus has no free tier, and SAML or OIDC federated users get just 50 free MAUs.`
        ],
        limits: [
          `Free tier: 10,000 MAUs per month on Lite or Essentials (50 for SAML or OIDC federated users).`,
          `UserAuthentication category: 120 requests/s by default, adjustable.`
        ],
        res: [
          { t: `User pool feature plans`, by: `AWS`, url: `https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-sign-in-feature-plans.html` },
          { t: `Quotas in Amazon Cognito`, by: `AWS`, url: `https://docs.aws.amazon.com/cognito/latest/developerguide/quotas.html` }
        ]
      }
    ]
  },
  {
    name: `Communications`,
    services: [
      {
        name: `SES`,
        what: `Managed email sending and receiving over API or SMTP, with DKIM and DMARC support, shared or dedicated IPs, suppression lists and event publishing for sends, deliveries, bounces and complaints.`,
        use: `Transactional email (receipts, alerts, password resets) and notifications at volume. Publish delivery, bounce and complaint events through a configuration set to SNS, Firehose or EventBridge, and feed them back into your suppression logic.`,
        avoid: `It is a sending pipe, not a marketing suite: for campaigns and journeys, use a dedicated tool. Never send to bought or stale lists; high bounce and complaint rates get the account paused.`,
        gotchas: [
          `Every new account starts in a per-Region sandbox: verified recipients only, 200 messages per 24 hours, 1 per second. Request production access well before launch.`,
          `Keep bounces under 2% and complaints under 0.1%. At 5% bounces or 0.1% complaints the account goes under review; at 10% or 0.5%, sending can be paused.`,
          `Since July 21, 2026, new accounts start on the Essentials plan ($0.16 per 1,000 emails for the first 10 million) instead of a la carte ($0.10 per 1,000). Check which one you are on.`
        ],
        limits: [
          `Max message 40 MB with the v2 API or SMTP (10 MB with v1); up to 50 recipients per message.`,
          `Up to 10,000 verified identities per Region.`,
          `A la carte: $0.10 per 1,000 emails plus $0.12 per GB of attachments.`
        ],
        res: [
          { t: `Request production access (moving out of the Amazon SES sandbox)`, by: `AWS`, url: `https://docs.aws.amazon.com/ses/latest/dg/request-production-access.html` },
          { t: `Amazon SES sending review process FAQs`, by: `AWS`, url: `https://docs.aws.amazon.com/ses/latest/dg/faqs-enforcement.html` }
        ]
      },
      {
        name: `AWS End User Messaging (SMS and voice)`,
        what: `AWS's application-to-person messaging service, formerly Amazon Pinpoint SMS and voice. It sends SMS, MMS, RCS and text-to-speech voice messages and manages phone numbers, sender IDs, registrations, opt-outs and delivery events.`,
        use: `OTPs, alerts and notifications to phones from AWS, using phone pools with failover, configuration sets that stream delivery events to CloudWatch, Firehose or SNS, and SMS Protect against SMS pumping.`,
        avoid: `It is not a programmable voice platform: voice here means one-way text-to-speech messages, not IVRs, call bridging or SIP. For live call control, use the Chime SDK PSTN audio service or Amazon Connect Customer (the renamed Amazon Connect).`,
        gotchas: [
          `Throughput is per origination ID and country, in message parts per second: a US toll-free number gets 3 MPS, a US short code 100 MPS, and 10DLC depends on the registered campaign. Spreading load across many toll-free numbers is snowshoeing and gets filtered by carriers.`,
          `Registration is the long pole: a US short code takes about 12 weeks and US toll-free about 15 days, and many countries require sender ID registration. Start before you write code.`,
          `You pay per 140-byte message part: one character outside the GSM 03.38 set, like an emoji, drops a part from 160 to 70 characters and can double the cost.`
        ],
        limits: [
          `New accounts: sandbox with a $1.00 monthly SMS spend limit and up to 10 verified destination numbers.`,
          `One part holds 160 GSM characters or 70 otherwise (153 or 67 when split); max 1,530 GSM or 630 non-GSM characters per message.`,
          `Amazon Pinpoint's engagement features end on October 30, 2026; the SMS and voice APIs continue as End User Messaging.`
        ],
        res: [
          { t: `What are the Message Parts per Second (MPS) limits`, by: `AWS`, url: `https://docs.aws.amazon.com/sms-voice/latest/userguide/sms-limitations-mps.html` },
          { t: `Amazon Pinpoint end of support`, by: `AWS`, url: `https://docs.aws.amazon.com/pinpoint/latest/userguide/migrate.html` }
        ]
      }
    ]
  },
  {
    name: `Analytics and infrastructure as code`,
    services: [
      {
        name: `Athena`,
        what: `Serverless SQL over data in S3 (and federated sources), with table definitions in the Glue Data Catalog. You pay per data scanned, or buy capacity reservations for steady use.`,
        use: `Ad hoc and scheduled analysis of logs and events landed in S3: CloudTrail and ALB logs, message or call records exported from your databases. Store Parquet, partition by date, and use partition projection for heavily partitioned tables.`,
        avoid: `Not for user-facing, low-latency queries or dashboards with many concurrent users; use Redshift or another OLAP store. Never for OLTP.`,
        gotchas: [
          `You pay for bytes scanned. In AWS's own example, converting 3 TB of text to compressed Parquet cuts a one-column query from $15 to $1.25.`,
          `Millions of tiny files make queries slow and add S3 request charges. Compact small files into larger ones before querying.`,
          `One bad query can scan the whole lake. Set per-query and per-workgroup data limits in workgroups.`
        ],
        limits: [
          `$5 per TB scanned, 10 MB minimum per query.`,
          `DML query timeout can be raised to at most 240 minutes.`,
          `Reads at most 1 million partitions in a single scan.`
        ],
        res: [
          { t: `Use partition projection with Amazon Athena`, by: `AWS`, url: `https://docs.aws.amazon.com/athena/latest/ug/partition-projection.html` },
          { t: `Amazon Athena pricing`, by: `AWS`, url: `https://aws.amazon.com/athena/pricing/` }
        ]
      },
      {
        name: `Redshift`,
        what: `AWS's columnar, massively parallel data warehouse for SQL analytics over large datasets, as provisioned clusters or Redshift Serverless billed by RPU-hours.`,
        use: `BI dashboards and heavy joins over billions of rows where Athena gets slow or costly, with many analysts at once. Zero-ETL integrations replicate Aurora PostgreSQL, RDS or DynamoDB data into it with no pipeline to run.`,
        avoid: `Not for OLTP or single-row lookups, and overkill for a few ad hoc queries a week; use Athena for those.`,
        gotchas: [
          `Serverless bills per second with a 60-second minimum, and an open transaction or idle session keeps RPUs running. Always COMMIT or ROLLBACK, set session timeouts, and cap max RPU-hours.`,
          `Cancelled queries still bill for the time they ran, and capacity can stay scaled up for a while after load drops.`,
          `Python UDFs are no longer supported after June 30, 2026. Port old ones before you migrate workloads.`
        ],
        limits: [
          `Serverless base capacity from 4 RPUs (default 128); 1 RPU has 16 GB of memory.`,
          `Minimum charge 60 seconds, metered per second; storage billed separately per GB-month.`
        ],
        res: [
          { t: `Billing for Amazon Redshift Serverless`, by: `AWS`, url: `https://docs.aws.amazon.com/redshift/latest/mgmt/serverless-billing.html` },
          { t: `Redshift zero-ETL integrations`, by: `AWS`, url: `https://docs.aws.amazon.com/redshift/latest/mgmt/zero-etl-using.html` }
        ]
      },
      {
        name: `Glue`,
        what: `Serverless data integration: the Data Catalog (table metadata shared by Athena, EMR and Redshift Spectrum), crawlers that infer schemas, and Spark ETL jobs in PySpark or Scala.`,
        use: `The catalog for your S3 data lake, and scheduled batch ETL that turns raw JSON exports into partitioned Parquet.`,
        avoid: `For small or frequent transforms, a Lambda function or a small container task is cheaper than DPU-hours. If you know your schema, define tables in IaC and skip crawlers.`,
        gotchas: [
          `Crawlers infer schemas and can guess wrong when file layouts drift. Prefer explicit table definitions for anything in production.`,
          `Every partition is a catalog object. The first million objects and million requests per month are free, and heavily partitioned tables use that up fast.`,
          `Jobs and interactive sessions bill per DPU-hour by the second; a forgotten interactive session (5 DPUs by default) keeps billing.`
        ],
        limits: [
          `$0.44 per DPU-hour for ETL jobs and crawlers, billed per second; 1 DPU is 4 vCPU and 16 GB.`,
          `Data Catalog: first 1 million objects and 1 million requests free each month.`
        ],
        res: [
          { t: `What is AWS Glue?`, by: `AWS`, url: `https://docs.aws.amazon.com/glue/latest/dg/what-is-glue.html` },
          { t: `AWS Glue pricing`, by: `AWS`, url: `https://aws.amazon.com/glue/pricing/` }
        ]
      },
      {
        name: `CloudFormation`,
        what: `AWS's native infrastructure as code: declarative YAML or JSON templates deployed as stacks, with dependency ordering, change sets, rollback on failure and drift detection.`,
        use: `AWS-native IaC with no state file to manage, stack sets across accounts, or as the output of CDK. It is what CDK deploys under the hood.`,
        avoid: `If your team already runs Terraform across AWS and other providers, do not split IaC without a reason. Avoid one giant stack; split by lifecycle (network, data, services).`,
        gotchas: [
          `Changes made outside CloudFormation cause drift, and a later rollback can fail (UPDATE_ROLLBACK_FAILED), for example when it tries to restore a database someone deleted by hand.`,
          `Some property changes replace the resource, which means a new database or bucket. Review a change set before every update to a stateful stack.`,
          `A template holds at most 500 resources and 51,200 bytes inline (1 MB from S3), so big apps need nested or multiple stacks.`
        ],
        limits: [
          `500 resources, 200 parameters and 200 outputs per template.`,
          `2,000 stacks per account by default.`,
          `No charge for AWS::* resources; handler operations for third-party resource types are billed.`
        ],
        res: [
          { t: `Understand CloudFormation quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/cloudformation-limits.html` },
          { t: `Update CloudFormation stacks using change sets`, by: `AWS`, url: `https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/using-cfn-updating-stacks-changesets.html` }
        ]
      },
      {
        name: `CDK`,
        what: `Define infrastructure in TypeScript, JavaScript, Python, Java, C#/.NET or Go. CDK synthesizes CloudFormation templates and deploys them.`,
        use: `When your team prefers code to YAML: loops, functions, typed constructs with sensible defaults, and unit tests for infrastructure. A good fit for app teams that own their own stacks on AWS.`,
        avoid: `If your org standardizes on Terraform (existing modules and state, more than one cloud), adding CDK splits your tooling. It is AWS-only and inherits every CloudFormation limit.`,
        gotchas: [
          `Renaming or moving a construct changes its logical ID, and CloudFormation replaces the resource with a new, empty database or bucket. Keep stateful resources in their own stack and unit test that their IDs stay stable.`,
          `By default, data resources are retained and logs kept forever when you delete a stack, which leaves orphaned buckets and a growing bill. Set removal and log retention policies on purpose.`,
          `Each account and Region must be bootstrapped (the CDKToolkit stack with an S3 bucket, an ECR repository and IAM roles) before the first deploy.`
        ],
        limits: [
          `CDK v1 reached end of support on June 1, 2023; use v2.`
        ],
        res: [
          { t: `What is the AWS CDK?`, by: `AWS`, url: `https://docs.aws.amazon.com/cdk/v2/guide/home.html` },
          { t: `Best practices for developing and deploying cloud infrastructure with the AWS CDK`, by: `AWS`, url: `https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html` }
        ]
      }
    ]
  }
);

window.HUB_AWS.guides.push(
  {
    id: `aws-messaging`,
    area: `AWS`,
    title: `SQS vs SNS vs EventBridge vs Kinesis`,
    question: `How should these services talk asynchronously?`,
    options: [
      { name: `SQS`, pick: `One pool of workers should do each unit of work once, with retries and a DLQ, such as a send job per message or webhook deliveries. Standard for throughput; FIFO when order per key matters.`, avoid: `Several independent consumers need the same message, or you need to replay history.`, cost: `What you pay: per request, where each 64 KB of payload counts as one (a 1 MiB message is 16 requests); empty receives count too, so use long polling.` },
      { name: `SNS`, pick: `One event must reach several consumers right away, each through its own SQS queue (fan-out), with simple attribute filters per subscription.`, avoid: `Consumers need content routing across accounts, ordering across the topic, or replay.`, cost: `What you pay: per publish and per delivery in 64 KB chunks; deliveries to SQS and Lambda have no per-message charge, only data transfer.` },
      { name: `EventBridge`, pick: `Integration events between teams and accounts routed on content, AWS service events, and scheduled or delayed triggers. The new Custom Event Bus adds retention, per-group ordering and replay.`, avoid: `Work queues or raw high-volume streams; a Classic bus has no ordering and at most 5 targets per rule.`, cost: `What you pay: Classic charges per million events published (64 KB chunks); the new bus charges per GB in and out plus retention storage.` },
      { name: `Kinesis or MSK`, pick: `Ordered, replayable streams that many consumers read at their own pace, such as event sourcing, analytics feeds and change data capture. Kinesis for serverless AWS; MSK when you want Kafka.`, avoid: `Per-message retries, DLQs and fan-out to a few services; a queue or topic is simpler.`, cost: `What you pay: provisioned shards or brokers by the hour even when idle (Kinesis on-demand bills mainly per GB), plus consumer code that tracks checkpoints.` }
    ],
    rule: `Queue for work, topic for fan-out, bus for routing between teams, stream for ordered history you can replay.`,
    signals: [
      `Exactly one worker should handle each job, with retries → SQS.`,
      `Adding a consumer must not touch the producer → SNS to SQS, or EventBridge.`,
      `Consumers need to re-read last week's events → Kinesis or MSK (or the new EventBridge bus with retention).`,
      `Order matters per customer → SQS FIFO with the customer as message group, or a Kinesis partition key per customer.`
    ],
    related: []
  },
  {
    id: `aws-workflow`,
    area: `AWS`,
    title: `Step Functions vs SQS workers vs Temporal`,
    question: `Who drives a multi-step process, and where does its state live?`,
    options: [
      { name: `Step Functions`, pick: `A handful to a few dozen steps across AWS services, with retries, timeouts, parallel branches and waits of days (Standard runs up to a year), and you want every run visible in the console.`, avoid: `The logic is complex and changes often; big JSON state machines are hard to test and review, and chatty loops add cost.`, cost: `What you pay: Standard bills per state transition ($0.000025 each in us-east-1); Express bills per request and GB-second; state payloads cap at 256 KiB.` },
      { name: `SQS workers (choreography)`, pick: `Each step is simple and independent: queue → worker → next queue, with DLQs. Cheapest and fastest to build for two to four steps.`, avoid: `You need the state of one order across steps, compensations, or long timers; you end up hand-building a workflow engine.`, cost: `What you pay: almost nothing in AWS fees, but the flow lives in many services, so debugging a stuck run means stitching logs together.` },
      { name: `Code-first engine (Temporal)`, pick: `Long-running business workflows written as ordinary Go or Python code with durable state, retries and timers, and a team willing to run the cluster or pay for a managed one.`, avoid: `A small team with a few simple flows; you add a new cluster or vendor and a programming model with determinism rules.`, cost: `What you pay: servers and a database to run it, or a cloud subscription, plus the learning curve for the whole team.` }
    ],
    rule: `SQS workers for simple chains, Step Functions to orchestrate AWS services with visibility, and a code-first engine when the workflow really is business logic.`,
    signals: [
      `You keep adding status columns and cron jobs to find stuck jobs → you need an orchestrator.`,
      `Most steps call AWS APIs directly (Lambda, ECS tasks, DynamoDB) → Step Functions.`,
      `Branching logic with many edge cases you want to unit test → code-first engine.`,
      `Two steps and a retry → SQS and a DLQ.`
    ],
    related: []
  },
  {
    id: `aws-config-secrets`,
    area: `AWS`,
    title: `Secrets Manager vs Parameter Store vs env vars`,
    question: `Where should config and secrets live, and how do apps read them?`,
    options: [
      { name: `Secrets Manager`, pick: `Credentials that must rotate or be audited: database passwords, third-party API keys, signing keys. Built-in rotation (as often as every 4 hours) and managed rotation for RDS and Aurora.`, avoid: `Plain config that is not secret, or values read on every request without a cache.`, cost: `What you pay: $0.40 per secret per month plus $0.05 per 10,000 API calls, and you have to build caching and refresh.` },
      { name: `Parameter Store`, pick: `Non-secret config and simple secrets that rarely change: hierarchical names per environment and service, a free standard tier, and references to Secrets Manager secrets.`, avoid: `High read rates without caching (40 TPS by default, shared across the account and Region), values over 4 KB (8 KB on advanced), or secrets that need rotation.`, cost: `What you pay: free for standard; $0.05 per advanced parameter per month; higher throughput costs $0.05 per 10,000 calls.` },
      { name: `Environment variables`, pick: `Non-secret, per-deployment settings (log level, Region, defaults) in the task definition, or secrets that ECS injects from Secrets Manager at container start.`, avoid: `Anything that must change without a redeploy: injected secrets do not refresh after rotation, and every process and debugging tool in the container can read the environment.`, cost: `What you pay: nothing in fees, but every change is a deployment and you lose audit history and rotation.` }
    ],
    rule: `Secrets in Secrets Manager, plain config in Parameter Store or env vars, and cache everything you read at runtime.`,
    signals: [
      `It is a password, token or API key → Secrets Manager.`,
      `It changes per environment but never at runtime → env var, or Parameter Store read at startup.`,
      `Deploys hit throttling errors from SSM during scale-out → cache, or enable higher throughput.`,
      `Ops must flip it live with gradual rollout and rollback → AppConfig feature flags.`
    ],
    related: []
  },
  {
    id: `aws-observability`,
    area: `AWS`,
    title: `CloudWatch vs Managed Prometheus and Grafana vs self-hosted`,
    question: `Where should metrics, logs and alerts live?`,
    options: [
      { name: `CloudWatch`, pick: `The default for AWS-vended metrics, alarms that drive scaling and paging, and logs with Logs Insights. It now also takes OpenTelemetry metrics and answers PromQL queries.`, avoid: `High-cardinality custom metrics as classic metrics, or years of verbose logs at Standard ingestion rates.`, cost: `What you pay: classic custom metrics from $0.30 per metric per month; logs $0.50 per GB ingested (Standard, us-east-1); OpenTelemetry metrics $0.50 per GB.` },
      { name: `Managed Prometheus + Managed Grafana`, pick: `Teams already on Prometheus exporters, PromQL and Grafana, especially on Kubernetes, who want long retention (up to 3 years) without running the storage.`, avoid: `Small setups where CloudWatch already covers it; logs still need another home.`, cost: `What you pay: per sample ingested, per GB stored and per query sample processed, plus $9 per Grafana editor and $5 per viewer each month.` },
      { name: `Self-hosted (Prometheus, Loki, Grafana or OpenSearch)`, pick: `Very large volume where managed per-GB pricing hurts, or strict control over retention and tooling, with people who can run it.`, avoid: `Small teams: storage, upgrades, high availability and backups become a second product.`, cost: `What you pay: EC2, EBS and S3 plus on-call time; the smallest line on the bill and the most team time.` }
    ],
    rule: `Start with CloudWatch for AWS metrics, alarms and logs; add Managed Prometheus and Grafana when PromQL and cardinality matter; self-host only at a scale you can staff.`,
    signals: [
      `You alarm on AWS service metrics (ALB 5xx, SQS age of oldest message) → CloudWatch.`,
      `A dashboard needs a per-customer breakdown → OpenTelemetry metrics or Prometheus, not classic metric dimensions.`,
      `The CloudWatch Logs bill beats compute → set retention, use Infrequent Access, or ship to S3.`,
      `You already run Prometheus in Kubernetes → remote-write to Managed Prometheus.`
    ],
    related: []
  }
);

window.HUB_AWS.map = [
  [`Static assets and CDN`, `CloudFront + S3`, `S3 holds the files; CloudFront caches them at the edge and reaches the bucket through origin access control, so the bucket stays private.`],
  [`DNS`, `Route 53`, `Hosted zones plus routing policies: latency and geolocation for multi-Region, failover with health checks.`],
  [`L7 load balancing`, `ALB`, `HTTP and HTTPS with host and path routing, ACM certificates and WAF in front; the default for web and API services.`],
  [`L4 load balancing`, `NLB`, `TCP, UDP, TLS or QUIC with a static IP per AZ; for non-HTTP protocols such as SIP, or clients that allowlist IPs.`],
  [`Public API front door`, `API Gateway (or ALB + WAF)`, `API Gateway for REST, HTTP or WebSocket APIs with auth and per-stage throttling; ALB with WAF when you only need routing and TLS.`],
  [`Containers`, `ECS on Fargate or EC2, or EKS`, `ECS for most services: Fargate removes hosts, EC2 capacity is cheaper at steady load; EKS only if you want Kubernetes.`],
  [`Functions`, `Lambda`, `Event glue and short, spiky tasks (up to 15 minutes per invocation); not for long-lived connections or steady heavy load.`],
  [`VMs`, `EC2 + Auto Scaling`, `Full control of the OS and network stack, special hardware, or software that needs a host.`],
  [`Relational DB`, `Aurora or RDS (PostgreSQL)`, `The system of record with transactions; Aurora when you want storage that grows on its own and many read replicas.`],
  [`Key-value store`, `DynamoDB`, `Known access patterns by key at any scale: sessions, idempotency keys, status by ID.`],
  [`Cache`, `ElastiCache (Valkey or Redis OSS)`, `Hot reads, rate-limit counters and short-lived state; serverless or node-based clusters.`],
  [`Search`, `OpenSearch Service`, `Full-text and log search with aggregations; keep the source of truth somewhere else.`],
  [`Object storage`, `S3`, `Files, exports, backups and the data lake; pick storage classes by access pattern.`],
  [`Block and shared file storage`, `EBS / EFS`, `EBS is a disk for one instance, backed up with snapshots; EFS is an elastic NFS file system many instances share.`],
  [`Background job queue`, `SQS`, `Standard for throughput; FIFO when order per group matters. Give every queue a DLQ.`],
  [`Pub/sub fan-out`, `SNS → SQS`, `One publish, one queue per consumer, each retrying on its own.`],
  [`Event bus`, `EventBridge`, `Content-based routing between teams and accounts, AWS service events and schedules.`],
  [`Streams`, `Kinesis Data Streams or MSK (+ Firehose)`, `Ordered, replayable, multi-consumer logs: Kinesis for serverless, MSK for Kafka; Firehose lands streams in S3.`],
  [`Workflows`, `Step Functions`, `Multi-step orchestration with retries, waits and visibility; Express for short, high-volume flows.`],
  [`Secrets and config`, `Secrets Manager, Parameter Store, AppConfig`, `Rotating secrets in Secrets Manager, static config in Parameter Store, live flags with rollback in AppConfig.`],
  [`Metrics and alarms`, `CloudWatch (or Managed Prometheus + Grafana)`, `CloudWatch for AWS metrics and alarms; Prometheus when you need PromQL and high cardinality.`],
  [`Logs`, `CloudWatch Logs → S3`, `Query recent logs with Logs Insights; set retention and archive to S3 for Athena.`],
  [`Tracing`, `X-Ray via ADOT (OpenTelemetry)`, `Instrument with OpenTelemetry; the X-Ray SDKs are in maintenance mode.`],
  [`Email and SMS`, `SES / End User Messaging`, `SES for email; End User Messaging for SMS, MMS and voice messages, with number registration and opt-outs.`]
];

window.HUB_AWS.costTraps = [
  [`NAT Gateway data processing`, `Every GB through a NAT gateway pays a processing fee on top of normal transfer ($0.045 per GB plus $0.045 per hour in the us-east-2 example), so private subnets pulling images, logs and S3 objects through NAT pay it on everything. Add free gateway endpoints for S3 and DynamoDB, use interface endpoints for chatty AWS APIs when the math works, and run a NAT gateway per AZ to avoid cross-AZ hops.`],
  [`Cross-AZ traffic`, `Data moving between AZs in a Region is billed per GB and metered on both sides of the transfer. A chatty service calling a cache, database or Kafka broker in another AZ pays on every call. Keep hot paths AZ-local where you can and watch the <code>DataTransfer-Regional-Bytes</code> usage type in your bill.`],
  [`CloudWatch Logs ingestion`, `Ingestion costs $0.50 per GB (Standard, us-east-1) and log groups never expire by default, so debug logging at scale can outgrow the compute bill. Log less, sample noisy paths, set retention on every group, use the Infrequent Access class ($0.25 per GB) for rarely read logs, and archive to S3.`],
  [`Custom metric cardinality`, `Each unique dimension combination is its own metric at $0.30 a month (first 10,000 tier). A customer or phone-number dimension turns one metric into thousands. Keep dimensions low-cardinality, put IDs in logs, or send OpenTelemetry metrics billed per GB.`],
  [`Idle provisioned capacity`, `Kinesis shards bill per shard-hour, MSK brokers per broker-hour, NAT gateways per hour and every public IPv4 address $0.005 an hour, busy or idle. Prefer on-demand or serverless modes for spiky and dev workloads, right-size monthly, and delete what nobody uses.`],
  [`S3 requests on many tiny objects`, `Every PUT, GET and LIST is billed per 1,000 requests, lifecycle transitions are billed per object, and Standard-IA charges each object as at least 128 KB for at least 30 days. Batch small records into larger objects (Firehose does this) and do not lifecycle tiny objects to colder classes.`],
  [`Forgotten snapshots and leftovers`, `EBS snapshots keep billing for storage until you delete them, Fast Snapshot Restore bills per snapshot per AZ-hour until you turn it off, and idle Elastic IPs bill the same as used ones. Automate snapshot expiry with Data Lifecycle Manager or AWS Backup and tag everything with an owner.`],
  [`SQS short polling`, `Every SQS API call is a billed request, including receives that return nothing, and each 64 KB of payload counts as another request. Idle workers short-polling in a loop pay for empty answers. Use long polling (up to 20 seconds) and batch sends and deletes (up to 10 messages).`]
];

window.HUB_AWS.pillars = [
  [`Operational excellence`, `Run and improve the system: automate changes, watch it, respond to events, and fix the process after each incident.`],
  [`Security`, `Protect data and systems: least-privilege access, encryption, and controls that detect bad activity.`],
  [`Reliability`, `Keep doing the job correctly and recover fast when parts fail: redundancy, tested recovery, and designs that expect failure.`],
  [`Performance efficiency`, `Pick the right resource types and sizes, measure them, and stay efficient as demand changes.`],
  [`Cost optimization`, `Spend only on what delivers value: know where money goes, right-size, and scale with demand instead of buying for peak.`],
  [`Sustainability`, `Use less: raise utilization so the workload needs fewer resources and less energy.`]
];
