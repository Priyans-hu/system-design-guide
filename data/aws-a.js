/* AWS service guide, part A: compute, networking and edge, storage, databases and caches, plus five decision guides. Facts checked against AWS docs as of 2026-10-01. */
window.HUB_AWS = window.HUB_AWS || { groups: [], guides: [] };
window.HUB_AWS.groups.push(
  {
    name: `Compute`,
    services: [
      {
        name: `EC2`,
        what: `Virtual machines you rent on demand. You pick the instance type, image (AMI), disks and network, and you own the OS: patching, agents, hardening and capacity planning.`,
        use: `Reach for raw EC2 when you need host-level control: GPUs, custom kernels or AMIs, instance store disks, licensed software, or a stateful system (Kafka, a self-run database) that needs specific hardware. It is also the capacity under ECS and EKS nodes.`,
        avoid: `Do not hand-manage instances for ordinary stateless web services or workers. Package them as containers on ECS (Fargate first) and let the platform replace hosts for you.`,
        gotchas: [
          `Spot is the cheapest capacity but can be reclaimed with a two-minute notice. Catch the EventBridge warning or poll instance metadata, drain, and only run stateless or checkpointed work there.`,
          `On-Demand capacity is capped by a per-Region vCPU quota. A new Region or a load test can fail to launch until you raise it, so request increases ahead of time.`,
          `Instance store disks are wiped when the instance stops, hibernates or terminates. Keep anything valuable on EBS, S3 or a database.`
        ],
        limits: [
          `Spot: up to 90% off On-Demand, with a 2-minute interruption notice`,
          `Savings Plans: up to 72% off On-Demand for a 1- or 3-year hourly commitment (Compute Savings Plans also cover Fargate and Lambda)`,
          `Linux On-Demand billing is per second with a 60-second minimum`
        ],
        res: [
          { t: `Spot Instance interruption notices`, by: `AWS`, url: `https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-instance-termination-notices.html` },
          { t: `EC2 On-Demand Instance Pricing`, by: `AWS`, url: `https://aws.amazon.com/ec2/pricing/on-demand/` }
        ]
      },
      {
        name: `EC2 Auto Scaling`,
        what: `Keeps a group of EC2 instances at a desired size, replaces unhealthy ones, and scales out and in with target tracking, step, scheduled or predictive policies.`,
        use: `Any EC2 fleet you run: ECS or EKS capacity, self-managed services, batch workers. Start with one target tracking policy (for example average CPU) and spread the group over at least two AZs.`,
        avoid: `Skip it when you do not manage instances at all (Fargate, Lambda). It is not a fix for slow boots: if an instance needs minutes to become ready, scaling will always lag the spike, so bake AMIs or keep headroom.`,
        gotchas: [
          `By default the group only uses EC2 status checks. Turn on ELB health checks, or an instance whose app has hung keeps serving errors and is never replaced.`,
          `Default instance warmup is not enabled out of the box. Turn it on so booting instances do not skew the metrics and trigger extra scale-outs.`,
          `Scale-in does not wait for your work to finish. Add a termination lifecycle hook to drain connections or finish jobs; it holds the instance for one hour by default.`
        ],
        limits: [
          `Default cooldown 300 seconds (used by simple scaling policies)`,
          `Lifecycle hook: 1-hour default wait; the global max is 48 hours or 100 times the heartbeat timeout, whichever is smaller`,
          `Health check grace period: 300 seconds by default in the console, 0 seconds via API or CLI`
        ],
        res: [
          { t: `Health checks for instances in an Auto Scaling group`, by: `AWS`, url: `https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-health-checks.html` },
          { t: `Set the default instance warmup for an Auto Scaling group`, by: `AWS`, url: `https://docs.aws.amazon.com/autoscaling/ec2/userguide/ec2-auto-scaling-default-instance-warmup.html` }
        ]
      },
      {
        name: `ECS (EC2 and Fargate)`,
        what: `AWS's own container orchestrator. You define task definitions and services; tasks run on Fargate (no hosts to manage), on EC2 instances you manage, or on ECS Managed Instances (EC2 that AWS provisions and patches).`,
        use: `Default home for containerized services and queue workers on AWS. Start on Fargate; move a service to EC2 capacity when you need GPUs, specific instance types, privileged containers or cheaper bin-packing at steady load.`,
        avoid: `Skip it if the org is standardized on Kubernetes tooling (Helm, operators, one platform across clouds), which points to EKS, or for small event handlers that sit idle most of the day, which fit Lambda.`,
        gotchas: [
          `On EC2 capacity each <code>awsvpc</code> task gets its own ENI. A c5.large fits only 2 such tasks by default; turn on <code>awsvpcTrunking</code> and it fits 10.`,
          `Fargate Spot gives a two-minute warning (<code>SIGTERM</code>) and never falls back to On-Demand by itself. Keep a regular Fargate base in the capacity provider strategy and shut down cleanly on <code>SIGTERM</code>.`,
          `Turn on the deployment circuit breaker with rollback, so a broken task definition reverts to the last completed deployment instead of churning failed tasks.`
        ],
        limits: [
          `Fargate task size up to 32 vCPU and 244 GB of memory (Linux, platform 1.4.0 or later)`,
          `Fargate ephemeral storage: 20 GiB included, configurable up to 200 GiB`,
          `5,000 tasks per service (1,000 when the service uses service discovery)`
        ],
        res: [
          { t: `Amazon ECS task definition differences for Fargate`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonECS/latest/developerguide/fargate-tasks-services.html` },
          { t: `Increasing Amazon ECS Linux container instance network interfaces`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonECS/latest/developerguide/container-instance-eni.html` }
        ]
      },
      {
        name: `EKS`,
        what: `Managed Kubernetes. AWS runs and scales the control plane; you run the workers (EC2 nodes, Fargate, or EKS Auto Mode) and the cluster add-ons such as the VPC CNI.`,
        use: `Pick EKS when you already run Kubernetes, depend on its ecosystem (Helm charts, operators, custom controllers, service mesh), or want one platform across AWS and on-premises nodes.`,
        avoid: `For a small team running a handful of services only on AWS, EKS adds upgrade work, add-on care and a control plane fee for little gain. ECS covers the same needs with less to operate.`,
        gotchas: [
          `Each Kubernetes minor version gets 14 months of standard support. Fall behind and extended support (on by default) costs six times the standard control plane fee, and when that ends AWS upgrades the cluster for you.`,
          `The VPC CNI gives every Pod a real VPC IP address. Size subnets for pod count, not node count, or you run out of IPs.`,
          `You still own node AMIs, add-on versions and upgrade testing unless you use EKS Auto Mode, which adds a fee on top of the EC2 price.`
        ],
        limits: [
          `Control plane: $0.10 per cluster-hour in standard support, $0.60 in extended support`,
          `Support window per Kubernetes version: 14 months standard plus 12 months extended`,
          `An in-place upgrade can be rolled back to the previous minor version within 7 days`
        ],
        res: [
          { t: `Understand the Kubernetes version lifecycle on EKS`, by: `AWS`, url: `https://docs.aws.amazon.com/eks/latest/userguide/kubernetes-versions.html` },
          { t: `Amazon EKS Pricing`, by: `AWS`, url: `https://aws.amazon.com/eks/pricing/` }
        ]
      },
      {
        name: `Lambda`,
        what: `Functions that run in response to events or requests. You set memory (CPU scales with it), AWS handles scaling, and you pay per request plus GB-seconds of run time.`,
        use: `Event glue and spiky, low duty-cycle work: processing S3 uploads, SQS or stream consumers, cron jobs, webhooks, and light APIs behind API Gateway.`,
        avoid: `Avoid it for jobs longer than 15 minutes, steady high-throughput services (you pay for every busy GB-second), or work that needs big in-memory state or long-lived connections. Run those on ECS, and long workflows on Step Functions.`,
        gotchas: [
          `Concurrency is shared by every function in the account and Region. One runaway function can throttle the rest; use reserved concurrency to protect critical functions or cap noisy ones.`,
          `Each execution environment opens its own database connections, so a burst can exhaust Postgres. Put RDS Proxy in front, or cap the function with reserved concurrency.`,
          `Attaching a function to your VPC cuts it off from the internet unless the VPC has a route out through a NAT gateway.`
        ],
        limits: [
          `Max run time 900 seconds (15 minutes) per invocation`,
          `Payload 6 MB each way for synchronous calls, 1 MB for asynchronous calls`,
          `1,000 concurrent executions per Region by default; each function adds at most 1,000 environments every 10 seconds`
        ],
        res: [
          { t: `Lambda quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/lambda/latest/dg/gettingstarted-limits.html` },
          { t: `Configuring reserved concurrency for a function`, by: `AWS`, url: `https://docs.aws.amazon.com/lambda/latest/dg/configuration-concurrency.html` }
        ]
      },
      {
        name: `ECR`,
        what: `Private container registry integrated with IAM, ECS, EKS and Lambda. It adds vulnerability scanning, replication, lifecycle rules and pull-through caching of public registries.`,
        use: `Store every image you deploy on AWS here. Add pull-through cache rules for Docker Hub and other upstreams so deploys do not depend on a public registry being up.`,
        avoid: `It is not a general artifact store for zips or packages; keep build artifacts in S3. Never deploy a mutable tag like <code>latest</code>.`,
        gotchas: [
          `Image pulls from private subnets go through NAT and pay per GB. Add the ECR interface endpoints plus an S3 gateway endpoint, because ECR serves image layers from S3.`,
          `Without lifecycle policies every CI image stays forever and storage keeps growing. Expire untagged images and keep only the last few releases.`,
          `Turn on tag immutability and deploy by git SHA or digest, so a rollback runs exactly the bits you tested.`
        ],
        limits: [
          `100,000 images per repository (adjustable)`,
          `Max layer size 52,000 MiB`,
          `Pull-through cache checks upstream for a newer version of a cached tag at least once every 24 hours`
        ],
        res: [
          { t: `Amazon ECR service quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonECR/latest/userguide/service-quotas.html` },
          { t: `Amazon ECR interface VPC endpoints (AWS PrivateLink)`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonECR/latest/userguide/vpc-endpoints.html` }
        ]
      }
    ]
  },
  {
    name: `Networking and edge`,
    services: [
      {
        name: `VPC (subnets, security groups, NACLs)`,
        what: `Your isolated network in one Region. Each subnet sits in one AZ, route tables make it public or private, security groups filter traffic per resource (stateful), and NACLs filter per subnet (stateless).`,
        use: `Every workload lives in one. Standard layout: public subnets for load balancers and NAT, private subnets for apps, isolated subnets for databases, repeated across at least two AZs.`,
        avoid: `Do not use NACLs as your main firewall; they are stateless and coarse, so keep them as guard rails. Do not build VPCs with overlapping CIDRs if they may ever need to talk to each other.`,
        gotchas: [
          `Make security groups the real control and reference groups instead of IP ranges (app SG → DB SG). NACLs are stateless, so they must allow the return traffic too.`,
          `Plan non-overlapping CIDRs across VPCs, accounts and on-premises from day one. VPC peering refuses any overlap, even if you only meant to use the non-overlapping part.`,
          `Every public IPv4 address costs $0.005 per hour, attached or idle. Keep workloads in private subnets and put only load balancers and NAT in public ones.`
        ],
        limits: [
          `Security groups: 60 inbound and 60 outbound rules each; 5 groups per network interface (up to 16)`,
          `5 IPs in every subnet are reserved (the first four and the last); subnets range from /28 to /16`,
          `DNS: each network interface can send 1,024 packets per second to the Route 53 Resolver, and this cannot be raised`
        ],
        res: [
          { t: `Amazon VPC quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/vpc/latest/userguide/amazon-vpc-limits.html` },
          { t: `Infrastructure security in Amazon VPC (security groups vs NACLs)`, by: `AWS`, url: `https://docs.aws.amazon.com/vpc/latest/userguide/infrastructure-security.html` }
        ]
      },
      {
        name: `NAT Gateway`,
        what: `Managed NAT for private subnets: resources can open outbound connections to the internet or other networks, but nothing can connect in. Zonal by default; a newer regional mode expands across AZs on its own.`,
        use: `Outbound calls from private subnets to third-party APIs, package mirrors and SaaS webhooks. Use one zonal NAT gateway per AZ, or one regional NAT gateway to get multi-AZ without per-AZ routes and public subnets.`,
        avoid: `Do not push S3 or DynamoDB traffic through it; free gateway endpoints do that. For heavy AWS API traffic (ECR, CloudWatch, STS), interface endpoints usually cost less per GB.`,
        gotchas: [
          `A zonal NAT gateway is tied to one AZ. If that AZ fails, private subnets in other AZs that route through it lose egress, so give each AZ its own gateway.`,
          `You pay per GB processed on top of the hourly fee, whatever the destination. Image pulls and log shipping through NAT quietly become a top line item.`,
          `Each IP handles 55,000 simultaneous connections to one destination (IP, port and protocol). Heavy fan-in to a single partner endpoint needs extra IPs.`
        ],
        limits: [
          `Bandwidth 5 Gbps, scaling automatically to 100 Gbps; 1 million packets per second, scaling to 10 million`,
          `55,000 connections per IP per unique destination; up to 8 IPs on a zonal gateway, 32 per AZ on a regional one`,
          `Pricing example (US East, Ohio): $0.045 per hour plus $0.045 per GB processed`
        ],
        res: [
          { t: `NAT gateway basics`, by: `AWS`, url: `https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateway-basics.html` },
          { t: `Regional NAT gateways for automatic multi-AZ expansion`, by: `AWS`, url: `https://docs.aws.amazon.com/vpc/latest/userguide/nat-gateways-regional.html` }
        ]
      },
      {
        name: `VPC endpoints and PrivateLink`,
        what: `Private paths from your VPC to AWS services, or to services in other VPCs, with no internet gateway or NAT. Gateway endpoints are route table entries for S3 and DynamoDB; interface endpoints are ENIs with private IPs, built on PrivateLink.`,
        use: `Add S3 and DynamoDB gateway endpoints to every VPC. Add interface endpoints for AWS APIs you call heavily from private subnets, and publish your own service to other accounts as a PrivateLink endpoint service behind an NLB.`,
        avoid: `Do not create an interface endpoint for every AWS service by reflex; each one bills per AZ per hour. PrivateLink exposes one service, so when two VPCs need general network reachability use peering or Transit Gateway instead.`,
        gotchas: [
          `Gateway endpoints only cover S3 and DynamoDB, and they only work for subnets whose route tables include the endpoint route.`,
          `Interface endpoints bill per AZ per hour plus per GB processed. Create them for the few APIs you call heavily, not for all of them.`,
          `Enable private DNS (it needs the VPC's DNS hostnames and DNS resolution settings on) so SDKs keep the normal service hostnames but traffic goes through the endpoint.`
        ],
        limits: [
          `Gateway endpoints: no charge`,
          `Interface and Gateway Load Balancer endpoints: 50 per VPC by default`,
          `Endpoint bandwidth 10 Gbps per AZ, scaling automatically to 100 Gbps`
        ],
        res: [
          { t: `Gateway endpoints`, by: `AWS`, url: `https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html` },
          { t: `AWS PrivateLink quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-limits-endpoints.html` }
        ]
      },
      {
        name: `Route 53`,
        what: `AWS's DNS service: public and private hosted zones, domain registration, health checks, and routing policies such as weighted, latency, failover, geolocation and multivalue.`,
        use: `Public DNS for your domains, private zones for internal names, weighted records for canaries and migrations, and latency or failover records for multi-Region setups.`,
        avoid: `Do not count on DNS for fast failover: some clients and resolvers cache answers for a long time. When cutover time matters, put Global Accelerator's static IPs in front.`,
        gotchas: [
          `Use alias records for AWS targets. They work at the zone apex (example.com), track the target's changing IPs, and alias A/AAAA queries to targets like ELB, CloudFront and API Gateway are free.`,
          `You cannot set a TTL on an alias that points to an AWS resource; Route 53 uses that resource's default.`,
          `Multivalue answer returns up to eight healthy records at random. It spreads load across IPs, but it is not a load balancer.`
        ],
        limits: [
          `SLA: 100% monthly uptime for hosted zones`,
          `Defaults: 500 hosted zones per account, 10,000 records per zone, 200 active health checks`,
          `$0.50 per hosted zone per month (first 25) and $0.40 per million standard queries (first billion a month)`
        ],
        res: [
          { t: `Choosing a routing policy`, by: `AWS`, url: `https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/routing-policy.html` },
          { t: `Choosing between alias and non-alias records`, by: `AWS`, url: `https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/resource-record-sets-choosing-alias-non-alias.html` }
        ]
      },
      {
        name: `CloudFront`,
        what: `AWS's CDN. It caches content at edge locations, terminates TLS near users, and fronts S3, ALBs, API Gateway, or ALBs, NLBs and EC2 instances in private subnets through VPC origins.`,
        use: `Put it in front of anything public: static sites and assets from S3 (locked down with OAC), cacheable API responses, downloads and video. VPC origins let the ALB stay private with CloudFront as the only way in.`,
        avoid: `Raw TCP or UDP traffic belongs on Global Accelerator, not CloudFront. For internal service-to-service calls inside one Region it adds cost and config for no gain.`,
        gotchas: [
          `The ACM certificate for your custom domain must be in us-east-1, whatever Region your origin runs in.`,
          `Ship versioned file names (app.3f9c1.js) instead of relying on invalidations. Browsers and corporate proxies keep old copies that an invalidation never reaches.`,
          `Use origin access control (OAC), not the legacy OAI, to keep S3 private. OAC supports SSE-KMS, PUT and DELETE requests, and all Regions.`
        ],
        limits: [
          `Origin response timeout 30 seconds by default (configurable 1-120 seconds)`,
          `Default quota per distribution: 250,000 requests per second and 150 Gbps`,
          `Always free each month: 1 TB of data out and 10,000,000 requests; fetches from AWS origins are free`
        ],
        res: [
          { t: `Amazon CloudFront quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/cloudfront-limits.html` },
          { t: `Restrict access to an Amazon S3 origin`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html` }
        ]
      },
      {
        name: `Elastic Load Balancing (ALB, NLB)`,
        what: `Managed load balancers. ALB works at layer 7 (HTTP, HTTP/2, gRPC, WebSockets) with host and path routing; NLB works at layer 4 (TCP, UDP, TLS, QUIC) with a static IP per AZ and millions of requests per second.`,
        use: `Default to ALB for HTTP services on ECS, EKS or EC2. Use NLB for raw TCP or UDP, fixed IPs that partners allowlist, client IP preservation, or as the front of a PrivateLink endpoint service.`,
        avoid: `Do not chain load balancers without a reason, and do not put an ALB in front of non-HTTP protocols. For a Lambda API that needs keys and quotas, API Gateway fits better.`,
        gotchas: [
          `Set your server's keep-alive idle timeout higher than the ALB's (60 seconds by default). If the app closes idle connections first, the ALB can send a request down a dead connection and return a 502.`,
          `ALB IPs change as it scales (its DNS TTL is 60 seconds), so never hardcode or allowlist them. Use NLB Elastic IPs or Global Accelerator for fixed addresses.`,
          `Deregistration delay defaults to 300 seconds, which makes rolling deploys crawl. Set it just above your longest request.`
        ],
        limits: [
          `ALB idle timeout 60 seconds by default (1-4,000 seconds)`,
          `NLB idle timeout 350 seconds by default for TCP (60-6,000 seconds); 120 seconds for UDP flows`,
          `ALB defaults: 1,000 targets and 100 rules per load balancer`
        ],
        res: [
          { t: `Edit attributes for your Application Load Balancer`, by: `AWS`, url: `https://docs.aws.amazon.com/elasticloadbalancing/latest/application/edit-load-balancer-attributes.html` },
          { t: `Network Load Balancers`, by: `AWS`, url: `https://docs.aws.amazon.com/elasticloadbalancing/latest/network/network-load-balancers.html` }
        ]
      },
      {
        name: `API Gateway`,
        what: `Managed front door for APIs: REST APIs (full featured), HTTP APIs (cheaper, fewer features) and WebSocket APIs, with auth, throttling and native Lambda integration.`,
        use: `Serverless APIs on Lambda, and public APIs that need API keys, usage plans, per-client throttling or request validation. WebSocket APIs give you managed connections for chat or live updates without servers.`,
        avoid: `Skip it for high, steady service-to-service traffic (per-request pricing adds up; use an ALB), for requests that run past 29 seconds, or for payloads over 10 MB (upload to S3 with a presigned URL instead).`,
        gotchas: [
          `The default throttle is per account per Region and shared by every API and stage. One noisy API can throttle the rest, so set stage and method limits.`,
          `HTTP APIs lack REST API features such as API keys, per-client throttling, request validation, AWS WAF integration and private endpoints. Pick the type before clients depend on the URL.`,
          `Long work does not belong in the request. Accept it, enqueue it (SQS), return 202, and let the client poll or get a callback.`
        ],
        limits: [
          `Integration timeout 50 ms to 29 seconds for REST APIs (raisable for Regional and private APIs); 30 seconds max for HTTP APIs`,
          `10,000 requests per second per account per Region, with a burst bucket of 5,000; payloads up to 10 MB`,
          `WebSocket APIs: 2-hour max connection, 128 KB messages sent in frames of up to 32 KB`
        ],
        res: [
          { t: `Choose between REST APIs and HTTP APIs`, by: `AWS`, url: `https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api-vs-rest.html` },
          { t: `Amazon API Gateway quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/apigateway/latest/developerguide/limits.html` }
        ]
      },
      {
        name: `Global Accelerator`,
        what: `Two static anycast IPs that bring users onto the AWS network at the nearest edge, then route TCP or UDP to healthy ALB, NLB, EC2 or Elastic IP endpoints in one or more Regions.`,
        use: `Non-HTTP global apps (gaming over UDP, VoIP, IoT over MQTT) and HTTP apps that need fixed IPs or fast, deterministic Region failover without waiting for DNS caches.`,
        avoid: `It caches nothing, so websites, APIs and downloads over HTTP belong on CloudFront. Skip it for single-Region apps whose clients do not need static IPs.`,
        gotchas: [
          `You pay the hourly fee even while an accelerator is disabled, plus a DT-Premium per-GB fee on top of normal data transfer.`,
          `The Global Accelerator API only runs in us-west-2 (Oregon). Point your SDK or Terraform provider there.`,
          `TCP keepalive packets do not keep a connection open; at least one byte of data must flow within the 340-second window or the connection is dropped.`
        ],
        limits: [
          `2 static anycast IPv4 addresses per accelerator (4 addresses with dual-stack)`,
          `$0.025 per accelerator-hour plus DT-Premium per GB`,
          `Idle timeout 340 seconds for TCP, 30 seconds for UDP`
        ],
        res: [
          { t: `How AWS Global Accelerator works`, by: `AWS`, url: `https://docs.aws.amazon.com/global-accelerator/latest/dg/introduction-how-it-works.html` },
          { t: `AWS Global Accelerator FAQs`, by: `AWS`, url: `https://aws.amazon.com/global-accelerator/faqs/` }
        ]
      }
    ]
  },
  {
    name: `Storage`,
    services: [
      {
        name: `S3`,
        what: `Object storage with 11 nines of durability and strong read-after-write consistency. Storage classes trade price for access speed, from Standard (milliseconds) down to Glacier Deep Archive (hours to restore).`,
        use: `Default home for files, uploads, backups, logs, data lakes and static assets. Default to Standard; use Intelligent-Tiering when access is unknown, Standard-IA for data read about monthly, Glacier classes for archives, and Express One Zone for single-digit millisecond hot data in one AZ.`,
        avoid: `It is not a file system or a low-latency database: even through Mountpoint it cannot modify existing files or lock them, and small-object reads take roughly 100-200 ms. Use EFS for shared files, and EBS or a database for random I/O.`,
        gotchas: [
          `A prefix scales up to higher request rates gradually, so expect 503 Slow Down while it ramps. Retry with backoff and spread hot keys across prefixes.`,
          `Event notifications are at-least-once and can arrive a minute or more late. Make consumers idempotent, and never write back to the prefix that triggers the function (infinite loop).`,
          `A presigned URL signed with role credentials (an ECS task role, a Lambda role) dies when that session expires, even if you asked for 7 days.`
        ],
        limits: [
          `Single PUT up to 5 GB; multipart upload up to 10,000 parts of 5 MiB-5 GiB, for objects up to 48.8 TiB`,
          `At least 3,500 writes and 5,500 reads per second per partitioned prefix`,
          `Minimums: IA classes 30 days and 128 KB billable size; Glacier Instant and Flexible Retrieval 90 days; Deep Archive 180 days`
        ],
        res: [
          { t: `Understanding and managing Amazon S3 storage classes`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html` },
          { t: `Best practices design patterns: optimizing Amazon S3 performance`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html` }
        ]
      },
      {
        name: `EBS`,
        what: `Network-attached block volumes for EC2, scoped to one AZ and usually attached to one instance. gp3 is the general default; io2 Block Express is for the most demanding databases.`,
        use: `Boot disks and single-node stateful systems on EC2: self-managed databases, Kafka or search data disks, anything that needs steady low-latency IOPS. Default to gp3 and tune IOPS and throughput separately from size.`,
        avoid: `Skip it when several machines need the same files (EFS) or when data must survive an AZ loss on its own (S3, or replicate in the app). Multi-Attach exists only for io1 and io2 and needs a cluster-aware file system.`,
        gotchas: [
          `A volume lives in one AZ. An instance in another AZ cannot attach it; you copy it over through a snapshot.`,
          `A volume restored from a snapshot pulls blocks from S3 on first read, so early I/O is slow. Initialize it or use fast snapshot restore before a database goes live on it.`,
          `You cannot shrink a volume, and you can modify one at most 4 times in a rolling 24 hours. Grow the file system yourself after resizing.`
        ],
        limits: [
          `gp3: 3,000 IOPS and 125 MiB/s included; up to 80,000 IOPS, 2,000 MiB/s and 64 TiB`,
          `io2 Block Express: up to 256,000 IOPS, 4,000 MiB/s and 99.999% durability`,
          `Multi-Attach: one io1 or io2 volume on up to 16 Nitro instances in the same AZ`
        ],
        res: [
          { t: `Amazon EBS volume types`, by: `AWS`, url: `https://docs.aws.amazon.com/ebs/latest/userguide/ebs-volume-types.html` },
          { t: `Amazon EBS General Purpose SSD volumes`, by: `AWS`, url: `https://docs.aws.amazon.com/ebs/latest/userguide/general-purpose.html` }
        ]
      },
      {
        name: `EFS`,
        what: `Managed NFS (v4.0 and v4.1) file system that many EC2 instances, containers and Lambda functions can mount at once. It grows and shrinks on its own, and Regional file systems store data across multiple AZs.`,
        use: `Shared files that several tasks or instances must read and write as a normal file tree: uploads processed by many workers, CMS content, ML models, shared config. Keep the default Elastic throughput mode.`,
        avoid: `Not for databases or metadata-heavy work like builds, git checkouts or node_modules, since every operation costs milliseconds. If the app can use object APIs, use S3.`,
        gotchas: [
          `Bursting throughput scales with how much you store, so a small file system runs out of burst credits. Use Elastic (recommended) or Provisioned throughput.`,
          `Lifecycle management moves files to Infrequent Access after 30 days without access by default. Reads from IA are slower (tens of milliseconds) and billed per GB.`,
          `A client tops out at 500 MiB/s unless the file system uses Elastic throughput and the client mounts with amazon-efs-utils 2.0+ or the EFS CSI driver, which lifts it to 1,500 MiB/s.`
        ],
        limits: [
          `First-byte latency about 1 ms for reads and 2.7 ms for writes (Standard class)`,
          `25,000 connections per file system; a single file can be up to 47.9 TiB`,
          `Elastic throughput up to 60 GiB/s read and 5 GiB/s write per file system in the largest Regions (20 and 1 elsewhere)`
        ],
        res: [
          { t: `Amazon EFS performance specifications`, by: `AWS`, url: `https://docs.aws.amazon.com/efs/latest/ug/performance.html` },
          { t: `Amazon EFS quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/efs/latest/ug/limits.html` }
        ]
      }
    ]
  },
  {
    name: `Databases and caches`,
    services: [
      {
        name: `RDS`,
        what: `Managed relational databases (PostgreSQL, MySQL, MariaDB, Oracle, SQL Server, Db2) on instances you size. AWS runs backups, patching, Multi-AZ failover and read replicas.`,
        use: `The default system of record for business data: accounts, orders, billing, anything that needs transactions, constraints and ad hoc queries. Run Multi-AZ in production and add a read replica for reporting.`,
        avoid: `When you need many low-lag readers, faster failover or a warm second Region, Aurora fits better. For simple key lookups at huge, spiky scale, use DynamoDB.`,
        gotchas: [
          `Read replicas are asynchronous, so a read right after a write can miss it. Send read-your-writes traffic to the primary.`,
          `A Multi-AZ instance's standby cannot serve reads; it only buys failover. A Multi-AZ DB cluster gives two readable standbys with semisynchronous replication.`,
          `Allocated storage grows but never shrinks, even after storage autoscaling. Set a maximum storage threshold, and use Blue/Green deployments (switchover typically under a minute) for major upgrades.`
        ],
        limits: [
          `Storage up to 64 TiB for PostgreSQL, MySQL, MariaDB and Db2`,
          `Up to 15 read replicas per primary`,
          `Automated backup retention 0-35 days, with point-in-time restore inside that window`
        ],
        res: [
          { t: `Multi-AZ DB cluster deployments for Amazon RDS`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/multi-az-db-clusters-concepts.html` },
          { t: `Quotas and constraints for Amazon RDS`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_Limits.html` }
        ]
      },
      {
        name: `Aurora`,
        what: `AWS's MySQL- and PostgreSQL-compatible engine that separates compute from a shared storage volume replicated to six storage nodes across three AZs. Adds Serverless v2 autoscaling and cross-Region Global Database.`,
        use: `Pick Aurora over RDS when you need many readers with low lag, faster failover, storage that grows on its own, Serverless v2 for spiky or dev databases, or a warm secondary Region through Global Database.`,
        avoid: `For a small, steady database, price it against RDS first; RDS is simpler. For multi-Region active-active writes, Global Database will not do it (secondaries are read-only and write forwarding just relays to the primary); look at DynamoDB Global Tables or Aurora DSQL.`,
        gotchas: [
          `Aurora Standard bills every I/O. When I/O reaches 25% or more of your Aurora spend, switch to I/O-Optimized (you can switch to it once every 30 days).`,
          `Serverless v2 at 0 ACUs pauses. The first connection waits about 15 seconds (30 or more after a day idle), so keep a floor above 0 for user-facing paths.`,
          `A Global Database failover during a real outage loses the last seconds of writes (RPO in seconds, RTO in minutes). Only a planned switchover is lossless.`
        ],
        limits: [
          `Up to 15 Aurora Replicas with lag usually well under 100 ms; failover typically under 60 seconds, often under 30`,
          `Serverless v2: 0-256 ACUs, each about 2 GiB of memory plus matching CPU`,
          `Global Database: up to 10 secondary Regions, replication lag typically under a second`
        ],
        res: [
          { t: `How Aurora serverless works`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-serverless-v2.how-it-works.html` },
          { t: `Using Amazon Aurora Global Database`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html` }
        ]
      },
      {
        name: `DynamoDB`,
        what: `Serverless key-value and document database with single-digit millisecond latency at any scale. Streams emit item-level changes, Global Tables replicate across Regions, and DAX adds an in-memory read cache.`,
        use: `Known access patterns by key at high or spiky scale: sessions, idempotency keys, carts, device or job state. Use Streams for change-driven work (outbox, projections) and Global Tables for multi-Region active-active.`,
        avoid: `Avoid it when product and analytics keep inventing new queries, joins or reports. Every new access pattern means a new GSI or another copy of the data; Postgres (RDS or Aurora) handles that better.`,
        gotchas: [
          `One hot partition key is capped at 3,000 reads and 1,000 writes per second, however much capacity the table has. Use high-cardinality keys and shard writes for hot items.`,
          `On-demand is not infinitely elastic: new tables start around 4,000 writes and 12,000 reads per second, and going past double the previous peak within 30 minutes can throttle. Pre-warm before launches.`,
          `GSIs are eventually consistent, TTL deletes land within a few days (filter expired items in queries), and Global Tables in the default mode resolve conflicts with last writer wins.`
        ],
        limits: [
          `Item size up to 400 KB`,
          `Query and Scan return at most 1 MB per call; transactions up to 100 items and 4 MB`,
          `Streams keep records for 24 hours; strongly consistent (MRSC) Global Tables need exactly three Regions`
        ],
        res: [
          { t: `Constraints in Amazon DynamoDB`, by: `AWS`, url: `https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Constraints.html` },
          { t: `How DynamoDB global tables work`, by: `AWS`, url: `https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/V2globaltables_HowItWorks.html` }
        ]
      },
      {
        name: `ElastiCache`,
        what: `Managed in-memory store running Valkey, Redis OSS or Memcached, either serverless or on nodes you size. Node-based Valkey 9.0+ clusters can add a Multi-AZ transaction log for durability.`,
        use: `Default cache in front of Postgres, Aurora or slow APIs: cache-aside reads, sessions, rate limits, leaderboards, pub/sub. Pick Valkey (cheaper than Redis OSS) and serverless unless you need node-level control or durability.`,
        avoid: `Do not make a non-durable cluster the only copy of data you cannot rebuild. If losing writes is unacceptable, turn on durability (Valkey 9.0+) or use MemoryDB; if the data lives in DynamoDB, look at DAX.`,
        gotchas: [
          `The default eviction policy is <code>volatile-lru</code>: only keys with a TTL get evicted. Fill memory with TTL-less keys and writes start failing with out-of-memory errors.`,
          `Without durability, replication is asynchronous and a failover can drop the latest writes. With no replicas at all, a node failure loses its data.`,
          `Serverless runs in cluster mode only, so the client must be cluster-aware. It has no keyspace notifications, and a single hash slot tops out at 30K-90K ECPUs per second.`
        ],
        limits: [
          `Node-based cluster mode: up to 500 shards with 1-5 replicas each (90 nodes per cluster by default)`,
          `Serverless: up to 5,000 GiB per cache and 32 GiB per hash slot`,
          `Valkey costs 20% less than Redis OSS on nodes and 33% less on serverless, with a 100 MB serverless minimum`
        ],
        res: [
          { t: `Choosing between deployment options`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/WhatIs.deployment.html` },
          { t: `Durability in ElastiCache`, by: `AWS`, url: `https://docs.aws.amazon.com/AmazonElastiCache/latest/dg/durability.html` }
        ]
      },
      {
        name: `MemoryDB`,
        what: `Durable in-memory database compatible with Valkey and Redis OSS. Writes are stored in a Multi-AZ transaction log before they are acknowledged, so it can be a primary database, not just a cache.`,
        use: `When Valkey or Redis data structures are your system of record and acknowledged writes must survive failures: counters, leaderboards, session or game state. Also for multi-Region active-active with MemoryDB Multi-Region.`,
        avoid: `Not for a plain cache; you pay for durability you do not need. For single-Region durable workloads AWS now also points to ElastiCache for Valkey with durability, so price both.`,
        gotchas: [
          `Only the primary is strongly consistent. Reads from replicas with <code>READONLY</code> are eventually consistent.`,
          `Multi-Region replicates asynchronously with last-writer-wins conflict resolution, has no automatic failover or RPO/RTO SLA, and does not support TTLs.`,
          `Writes wait for the transaction log, so they take single-digit milliseconds instead of the microseconds a plain cache gives you.`
        ],
        limits: [
          `Microsecond reads, single-digit millisecond writes`,
          `Multi-Region: up to 5 Regions, up to 99.999% availability, replication typically within a second`,
          `Data written on Valkey: the first 10 TB each month cost $0 per GB`
        ],
        res: [
          { t: `What is MemoryDB`, by: `AWS`, url: `https://docs.aws.amazon.com/memorydb/latest/devguide/what-is-memorydb.html` },
          { t: `MemoryDB Multi-Region prerequisites and limitations`, by: `AWS`, url: `https://docs.aws.amazon.com/memorydb/latest/devguide/multi-region.prereq.html` }
        ]
      },
      {
        name: `OpenSearch Service`,
        what: `Managed OpenSearch clusters (and legacy Elasticsearch versions) for full-text search, log analytics and vector search. OpenSearch Serverless bills compute in OCUs of 6 GiB each and can scale idle collection groups to zero.`,
        use: `Full-text and faceted search over product or content catalogs, log and trace analytics, and vector or hybrid search. Keep the source of truth elsewhere and index into it.`,
        avoid: `Not a primary database; you will rebuild indexes from Postgres or S3 when mappings change or data drifts. For simple filtering on a few fields, a Postgres index is simpler to run.`,
        gotchas: [
          `Daily indexes with default shard counts create thousands of tiny shards that eat heap and destabilize the cluster. Size shards by data volume, not by habit.`,
          `Run three dedicated master nodes across three AZs (Multi-AZ with Standby sets this up). Without dedicated masters, an upgrade can leave the cluster unresponsive while it elects a master.`,
          `Avoid T2 and t3.small instances in production; they become unstable under sustained heavy load.`
        ],
        limits: [
          `Target shard size: 10-30 GiB for search, 30-50 GiB for logs`,
          `Keep 25 shards or fewer per GiB of heap; heap is 50% of RAM, capped at 32 GiB by default`,
          `Max HTTP request payload 10 MiB or 100 MiB, depending on instance type`
        ],
        res: [
          { t: `Operational best practices for Amazon OpenSearch Service`, by: `AWS`, url: `https://docs.aws.amazon.com/opensearch-service/latest/developerguide/bp.html` },
          { t: `Amazon OpenSearch Service quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/opensearch-service/latest/developerguide/limits.html` }
        ]
      },
      {
        name: `DocumentDB`,
        what: `MongoDB API-compatible document database (4.0, 5.0 and 8.0) with a shared cluster volume that keeps six copies of the data across three AZs, plus up to 15 read replicas.`,
        use: `When you have MongoDB-shaped JSON documents and drivers but want an AWS-managed, VPC-native service with six-way storage replication and managed failover.`,
        avoid: `If you depend on MongoDB features beyond the compatible API, test first or stay on MongoDB itself. For new projects with no Mongo code, DynamoDB (key access) or Postgres with JSONB (flexible queries) is often simpler.`,
        gotchas: [
          `Compatible is not identical: some operators, index behaviors and APIs differ. Run your real query suite against it before migrating.`,
          `Before engine 8.0.2, retryable writes are not supported and default drivers error out until you set <code>retryWrites=false</code>.`,
          `Elastic Clusters (the sharded option) speak the MongoDB 5.0 wire protocol and are not supported on engine 8.0.`
        ],
        limits: [
          `Document size up to 16 MiB`,
          `Cluster storage up to 256 TiB on engine 8.0 and later (128 TiB before)`,
          `Up to 15 read replicas per cluster`
        ],
        res: [
          { t: `Functional differences: Amazon DocumentDB and MongoDB`, by: `AWS`, url: `https://docs.aws.amazon.com/documentdb/latest/devguide/functional-differences.html` },
          { t: `Amazon DocumentDB quotas`, by: `AWS`, url: `https://docs.aws.amazon.com/documentdb/latest/devguide/limits.html` }
        ]
      }
    ]
  }
);
window.HUB_AWS.guides.push(
  {
    id: `aws-compute`,
    area: `AWS`,
    title: `EC2 vs ECS vs EKS vs Lambda`,
    question: `Where should this code run?`,
    options: [
      { name: `ECS (Fargate or EC2 capacity)`, pick: `Your default for long-running containerized services and queue workers. Start on Fargate so there are no hosts to patch; move a service to EC2 capacity when you need GPUs, specific instance types or cheaper bin-packing at steady load.`, avoid: `When the org is standardized on Kubernetes tooling, or the work is a small event handler that sits idle most of the day.`, cost: `What you pay: nothing for ECS itself. Fargate bills vCPU, memory and storage per second while tasks run (Fargate Spot up to 70% off); EC2 capacity bills whole instances whether they are full or not.` },
      { name: `EKS`, pick: `When you already run Kubernetes, depend on its ecosystem (Helm, operators, custom controllers, service mesh), or need one platform across AWS and on-premises.`, avoid: `When a small team just needs to run a dozen services on AWS. You take on a version upgrade every 14 months or so, add-on care and pod IP planning for little gain.`, cost: `What you pay: $0.10 per cluster-hour ($0.60 on extended support) plus the nodes, and an Auto Mode fee on top of EC2 if you use it.` },
      { name: `Lambda`, pick: `Event glue and spiky, low duty-cycle work: S3 and SQS triggers, cron jobs, webhooks, light APIs. It scales from zero with nothing to patch.`, avoid: `Jobs over 15 minutes, steady high-throughput services, long-lived connections or big in-memory caches, and bursts that would open thousands of database connections.`, cost: `What you pay: per request plus GB-seconds of run time. Idle is free (1 million requests and 400,000 GB-seconds a month are free), but a function that is busy all day can cost more than a container doing the same work.` },
      { name: `EC2 (with Auto Scaling)`, pick: `When you need host-level control: GPUs, custom AMIs or kernels, instance store, licensed software, or stateful systems like Kafka or a self-run database.`, avoid: `For ordinary stateless services, where containers remove AMI baking, OS patching and host-level debugging.`, cost: `What you pay: per-second billing for Linux (60-second minimum) whether the instance is busy or idle. Savings Plans cut up to 72%, and Spot up to 90% for interruptible work.` }
    ],
    rule: `Default to ECS on Fargate for services and Lambda for event glue; choose EKS or raw EC2 only when you can name the feature that needs them.`,
    signals: [
      `Runs longer than 15 minutes or holds long-lived connections → ECS, not Lambda.`,
      `Near-zero traffic most of the day with short bursts → Lambda.`,
      `The team already operates Kubernetes or needs Helm charts and operators → EKS.`,
      `Needs GPUs, custom AMIs or specific instance types → EC2 capacity (ECS on EC2 or plain EC2).`
    ],
    related: []
  },
  {
    id: `aws-entry`,
    area: `AWS`,
    title: `ALB vs NLB vs API Gateway vs CloudFront`,
    question: `What should sit in front of the service?`,
    options: [
      { name: `ALB`, pick: `The default entry for HTTP, gRPC and WebSocket services on ECS, EKS or EC2: host and path routing, TLS termination, health checks, and long requests (idle timeout up to 4,000 seconds).`, avoid: `When clients need fixed IPs, the protocol is not HTTP, or you need per-customer API keys and quotas.`, cost: `What you pay: an hourly fee plus LCUs, billed on whichever is highest of new connections, active connections, bytes processed and rule evaluations.` },
      { name: `NLB`, pick: `TCP, UDP, TLS passthrough or QUIC; a static IP per AZ that partners can allowlist; client IP preservation; very high connection rates; or the front of a PrivateLink endpoint service.`, avoid: `When you need HTTP-aware routing, redirects or header rules. Put an ALB behind it only if you truly need both layers.`, cost: `What you pay: an hourly fee plus NLCUs measured per minute. You give up all layer 7 features.` },
      { name: `API Gateway`, pick: `Lambda-backed or public APIs that need API keys, usage plans, per-client throttling, request validation or managed WebSocket connections.`, avoid: `High, steady service-to-service traffic, requests longer than 29 seconds, or payloads over 10 MB.`, cost: `What you pay: per request. The US East pricing examples show $3.50 per million for REST APIs and $1.00 per million for HTTP APIs, plus data out.` },
      { name: `CloudFront`, pick: `In front of anything public and global: static assets from S3 with OAC, cacheable API responses, TLS near users, WAF at the edge, and private ALBs through VPC origins.`, avoid: `Raw TCP or UDP traffic (use Global Accelerator) and internal service-to-service traffic.`, cost: `What you pay: per GB delivered and per request (or a flat-rate plan). Fetches from AWS origins are free, and 1 TB plus 10 million requests a month are always free.` }
    ],
    rule: `Put CloudFront at the edge of anything public, an ALB in front of HTTP services, an NLB when you need layer 4 or fixed IPs, and API Gateway when you need API management or a Lambda backend.`,
    signals: [
      `Partners must allowlist fixed IPs → NLB with Elastic IPs, or Global Accelerator.`,
      `Per-customer API keys, quotas or request validation → API Gateway REST API.`,
      `Requests routinely run past 29 seconds → ALB, not API Gateway.`,
      `Global users and cacheable content → CloudFront in front of whichever you pick.`
    ],
    related: []
  },
  {
    id: `aws-database`,
    area: `AWS`,
    title: `RDS vs Aurora vs DynamoDB`,
    question: `Which AWS database should hold this data?`,
    options: [
      { name: `RDS (PostgreSQL or MySQL)`, pick: `The default relational store for a single-Region product with steady load: transactions, constraints, joins and ad hoc queries on standard engines, with Multi-AZ for failover.`, avoid: `When you need many low-lag read replicas, faster failover, more than 64 TiB of storage, or a warm secondary Region.`, cost: `What you pay: instance hours plus provisioned storage and IOPS. Allocated storage never shrinks, so do not over-provision.` },
      { name: `Aurora (PostgreSQL or MySQL)`, pick: `When you need up to 15 replicas with lag well under 100 ms, failover typically under 60 seconds (often under 30), storage that grows on its own, Serverless v2 for spiky or dev loads, or cross-Region replicas through Global Database.`, avoid: `Small steady databases where RDS is enough, and multi-Region active-active writes (Global Database secondaries are read-only).`, cost: `What you pay: instance or ACU hours plus storage. Aurora Standard also bills per I/O; I/O-Optimized drops I/O charges and pays off once I/O is 25% or more of your Aurora spend.` },
      { name: `DynamoDB`, pick: `Known key-based access patterns at high or spiky scale with no servers: sessions, idempotency keys, carts, job state, and Global Tables for multi-Region active-active.`, avoid: `Ad hoc queries, joins, reporting, or items over 400 KB. Every new access pattern costs a new GSI or another copy of the data.`, cost: `What you pay: per request on demand (or provisioned capacity) plus storage. Every GSI adds its own write capacity and storage, and Global Tables bill replicated writes.` }
    ],
    rule: `Start on RDS Postgres, move to Aurora when you need its replicas, failover or Global Database, and choose DynamoDB when access is by key, known up front, and at a scale you do not want to operate.`,
    signals: [
      `Needs joins, ad hoc filters or reports → RDS or Aurora.`,
      `Read load needs many replicas with lag well under 100 ms → Aurora.`,
      `Must keep serving after a Region loss with only seconds of data loss → Aurora Global Database or DynamoDB Global Tables.`,
      `Spiky traffic that is mostly get and put by key → DynamoDB on-demand.`
    ],
    related: []
  },
  {
    id: `aws-cache`,
    area: `AWS`,
    title: `ElastiCache vs MemoryDB vs DAX`,
    question: `Which in-memory layer fits?`,
    options: [
      { name: `ElastiCache (Valkey)`, pick: `The default cache in front of Postgres, Aurora or slow APIs: cache-aside reads, sessions, rate limits, leaderboards, pub/sub. Serverless for unknown or spiky load, node-based for control.`, avoid: `As the only copy of data you cannot rebuild, unless you run node-based Valkey 9.0+ with durability turned on.`, cost: `What you pay: node-hours, or serverless GB-hours plus ECPUs. Valkey is 20% cheaper than Redis OSS on nodes and 33% cheaper on serverless.` },
      { name: `MemoryDB`, pick: `Valkey or Redis as the system of record, where acknowledged writes must survive failures, and multi-Region active-active through MemoryDB Multi-Region.`, avoid: `Plain caching. For single-Region durable needs, compare it with ElastiCache Valkey plus durability first.`, cost: `What you pay: node-hours plus data written (on Valkey the first 10 TB a month cost nothing) and snapshot storage.` },
      { name: `DAX`, pick: `Read-heavy DynamoDB workloads that need microsecond reads or relief for hot keys, with almost no code change (API-compatible clients for Go, Python, Java, Node.js and .NET).`, avoid: `Strongly consistent reads (passed straight to DynamoDB), write-heavy tables, low repeat-read rates (it works best above 90% hits), or data that is not in DynamoDB.`, cost: `What you pay: DAX node-hours on top of DynamoDB, partly offset by fewer table reads.` }
    ],
    rule: `Cache with ElastiCache Valkey, speed up DynamoDB reads with DAX, and reach for MemoryDB (or durable ElastiCache) only when the in-memory store is the source of truth.`,
    signals: [
      `Data can be rebuilt from the database on a miss → ElastiCache.`,
      `Losing an acknowledged write is unacceptable → MemoryDB, or ElastiCache Valkey 9.0+ with synchronous durability.`,
      `The backing store is DynamoDB and the same keys are read over and over → DAX.`,
      `Writes must be accepted in several Regions at once → MemoryDB Multi-Region.`
    ],
    related: []
  },
  {
    id: `aws-storage`,
    area: `AWS`,
    title: `S3 vs EBS vs EFS`,
    question: `Where should these bytes live?`,
    options: [
      { name: `S3`, pick: `The default for files, uploads, backups, logs, data lakes and static assets: 11 nines of durability, no capacity planning, lifecycle rules to cheaper classes, and direct browser uploads with presigned URLs.`, avoid: `When an app needs a mounted file system with in-place edits or locks, or millisecond random reads and writes like a database.`, cost: `What you pay: GB-month by storage class, per request, and data out to the internet. Transfer to CloudFront or to AWS services in the same Region is free.` },
      { name: `EBS`, pick: `One instance's disk: boot volumes, self-managed databases, Kafka or search data disks. gp3 by default, io2 Block Express for extreme IOPS.`, avoid: `When several machines need the same files, or when data must survive an AZ loss without snapshots or app-level replication.`, cost: `What you pay: provisioned GB-month (size, not usage) plus IOPS and throughput above the 3,000 IOPS and 125 MiB/s that gp3 includes.` },
      { name: `EFS`, pick: `A shared NFS file tree that many instances, containers or Lambda functions mount at once across AZs: shared uploads, CMS content, ML models.`, avoid: `Databases, build directories and other metadata-heavy work, since each operation takes milliseconds. If the app can use object APIs, use S3.`, cost: `What you pay: GB-month actually stored per class (Standard, IA, Archive) plus per-GB charges for reads, writes and tiering.` }
    ],
    rule: `Objects go to S3, a single machine's disk is EBS gp3, and EFS is only for file trees that several machines must share.`,
    signals: [
      `Many writers need the same files through a normal file system → EFS.`,
      `A database or anything that needs steady low-latency IOPS → EBS.`,
      `Written once, read many times over HTTP or by many services → S3.`,
      `Must survive an AZ outage with nothing to manage → S3 or a Regional EFS file system, not EBS.`
    ],
    related: []
  }
);
