/* Tracks: Go and Python depth, Linux and networking, career craft. */
window.HUB_TRACKS = window.HUB_TRACKS || [];
window.HUB_TRACKS.push(...[
 {
  "id": "lang",
  "title": "Go and Python depth",
  "short": "Go and Python",
  "icon": "code",
  "why": "You write Go and Python every day. SDE-2 interviews and code reviews probe whether you understand concurrency, memory and failure behavior in both, not just the syntax.",
  "cadence": "One topic per weekday evening (about 90 minutes: read, then write a small program), about a week and a half.",
  "topics": [
   {
    "id": "lang-go-concurrency",
    "title": "Go concurrency",
    "what": "Goroutines are cheap functions scheduled by the Go runtime; channels, <code>sync</code> and <code>context</code> coordinate them. The hard part is not starting goroutines but stopping them cleanly.",
    "points": [
     "Every goroutine needs a way to exit. One blocked forever on a channel is a leak; Go 1.27 reports these in the <code>goroutineleak</code> profile",
     "Unbuffered channels hand over one value at a time; buffered channels queue up to their capacity. Only the sender closes a channel",
     "<code>select</code> with a <code>case &lt;-ctx.Done():</code> branch makes any blocking send or receive cancellable",
     "<code>errgroup.WithContext</code> cancels the shared context on the first error, and <code>g.SetLimit(n)</code> caps how many run at once",
     "Guard shared state with <code>sync.Mutex</code>, hand off ownership with channels, and run tests with <code>go test -race</code>"
    ],
    "use": "Fanning out I/O-bound work under a deadline, such as calling several downstream APIs or sending a batch of webhooks with bounded parallelism.",
    "avoid": "Do not start one unbounded goroutine per item or request, and do not use channels where a mutex around a map or counter is simpler.",
    "res": [
     {
      "t": "Go Concurrency Patterns: Pipelines and cancellation",
      "by": "The Go Blog",
      "url": "https://go.dev/blog/pipelines",
      "type": "blog",
      "free": true,
      "why": "Fan-out, fan-in and how to stop goroutines without leaking them."
     },
     {
      "t": "Go Concurrency Patterns: Context",
      "by": "The Go Blog",
      "url": "https://go.dev/blog/context",
      "type": "blog",
      "free": true,
      "why": "How cancellation and deadlines flow through a request."
     },
     {
      "t": "errgroup package",
      "by": "Go team (golang.org/x/sync)",
      "url": "https://pkg.go.dev/golang.org/x/sync/errgroup",
      "type": "docs",
      "free": true,
      "why": "The API you will use most for bounded, cancellable fan-out."
     }
    ]
   },
   {
    "id": "lang-go-perf",
    "title": "Go memory and performance",
    "what": "Go keeps values on the stack when it can and moves them to the heap when they escape, and GC cost grows with the allocation rate. Measure with benchmarks and pprof before changing code.",
    "points": [
     "Escape analysis: <code>go build -gcflags=-m</code> shows what moves to the heap (returned pointers, values stored in interfaces, captured variables)",
     "<code>GOGC</code> trades memory for CPU (default 100); <code>GOMEMLIMIT</code> is a soft memory cap, so set it below the container limit. Green Tea is the default GC since Go 1.26",
     "<code>go test -bench=. -benchmem</code> reports ns/op, B/op and allocs/op; write loops as <code>for b.Loop()</code> (Go 1.24+) and compare runs with <code>benchstat</code>",
     "pprof covers CPU, heap, goroutine, mutex and block profiles via <code>net/http/pprof</code>; <code>go tool pprof -http=:8080</code> opens a flame graph",
     "Cheap wins: preallocate with <code>make([]T, 0, n)</code>, build strings with <code>strings.Builder</code>, reuse buffers with <code>sync.Pool</code>"
    ],
    "use": "When a service's CPU, memory or p99 latency is high and you need to find the hot path with data, not guesses.",
    "avoid": "Do not hand-tune allocations in code that never shows up in a profile; clear code that allocates a little is usually fine.",
    "res": [
     {
      "t": "A Guide to the Go Garbage Collector",
      "by": "Go team",
      "url": "https://go.dev/doc/gc-guide",
      "type": "docs",
      "free": true,
      "why": "GOGC, GOMEMLIMIT, escape analysis and how to read GC cost."
     },
     {
      "t": "Diagnostics",
      "by": "Go team",
      "url": "https://go.dev/doc/diagnostics",
      "type": "docs",
      "free": true,
      "why": "Profiling, tracing and debugging tools on one map."
     },
     {
      "t": "testing package: Benchmarks",
      "by": "Go team",
      "url": "https://pkg.go.dev/testing#hdr-Benchmarks",
      "type": "docs",
      "free": true,
      "why": "How to write benchmarks that measure what you think they measure."
     }
    ]
   },
   {
    "id": "lang-go-idioms",
    "title": "Go idioms",
    "what": "Idiomatic Go is plain code: errors as values with context, small interfaces defined where they are used, and packages named for what they provide.",
    "points": [
     "Wrap errors with context, as in <code>fmt.Errorf(\"load user %d: %w\", id, err)</code>, and inspect them with <code>errors.Is</code> and <code>errors.As</code>, never by matching strings",
     "Accept interfaces, return concrete types. Define small interfaces (one or two methods, like <code>io.Reader</code>) in the package that consumes them",
     "Name packages with short nouns (<code>billing</code>, not <code>utils</code>), avoid package-level mutable state, and keep private code under <code>internal/</code>",
     "Generics fit containers and algorithms over many types (see the <code>slices</code> and <code>maps</code> packages); use an interface when behavior varies, not type",
     "Make zero values useful, pass <code>ctx</code> as the first parameter, and use a config struct or functional options when a constructor has many settings"
    ],
    "use": "Writing or reviewing Go that other people will maintain, and designing a package's exported API.",
    "avoid": "Do not port Java habits (an interface for every struct, getters and setters, deep type hierarchies), and do not <code>panic</code> on expected errors.",
    "res": [
     {
      "t": "Go Code Review Comments",
      "by": "Go team (Go Wiki)",
      "url": "https://go.dev/wiki/CodeReviewComments",
      "type": "docs",
      "free": true,
      "why": "The most common review feedback on Go code, on one page."
     },
     {
      "t": "Working with Errors in Go 1.13",
      "by": "The Go Blog",
      "url": "https://go.dev/blog/go1.13-errors",
      "type": "blog",
      "free": true,
      "why": "Wrapping with %w, errors.Is and errors.As."
     },
     {
      "t": "When To Use Generics",
      "by": "Ian Lance Taylor, The Go Blog",
      "url": "https://go.dev/blog/when-generics",
      "type": "blog",
      "free": true,
      "why": "Clear rules for when generics help and when an interface is better."
     }
    ]
   },
   {
    "id": "lang-go-prod",
    "title": "Production Go services",
    "what": "A Go service in production must stop cleanly, put a deadline on every wait and reuse connections. The zero-value defaults in <code>net/http</code> do none of this for you.",
    "points": [
     "Graceful shutdown: <code>signal.NotifyContext</code> catches SIGTERM, then <code>srv.Shutdown(ctx)</code> drains in-flight requests before the SIGKILL (ECS waits 30 s by default)",
     "<code>http.Server</code> needs <code>ReadHeaderTimeout</code>, <code>ReadTimeout</code>, <code>WriteTimeout</code> and <code>IdleTimeout</code>; zero means wait forever",
     "Share one <code>http.Client</code> that has a <code>Timeout</code>. Read each response body to the end and close it, or the connection is not reused",
     "Raise <code>Transport.MaxIdleConnsPerHost</code> (default 2) for busy downstreams; set <code>SetMaxOpenConns</code>, <code>SetMaxIdleConns</code> and <code>SetConnMaxLifetime</code> on <code>sql.DB</code>",
     "Pass <code>ctx</code> into every call (<code>http.NewRequestWithContext</code>, <code>QueryContext</code>) so a cancelled request stops its downstream work"
    ],
    "use": "Every service that runs behind a load balancer and calls other services, partner APIs or a database.",
    "avoid": "Do not use <code>http.Get</code> or <code>http.DefaultClient</code> in server code (no timeout), and do not build a new client or transport per request.",
    "res": [
     {
      "t": "The complete guide to Go net/http timeouts",
      "by": "Filippo Valsorda, Cloudflare",
      "url": "https://blog.cloudflare.com/the-complete-guide-to-golang-net-http-timeouts/",
      "type": "blog",
      "free": true,
      "why": "Which timeout covers which phase, for servers and clients."
     },
     {
      "t": "net/http: Server.Shutdown",
      "by": "Go team",
      "url": "https://pkg.go.dev/net/http#Server.Shutdown",
      "type": "docs",
      "free": true,
      "why": "Exact shutdown semantics, including that it does not wait for hijacked connections such as WebSockets."
     },
     {
      "t": "Managing connections",
      "by": "Go team",
      "url": "https://go.dev/doc/database/manage-connections",
      "type": "docs",
      "free": true,
      "why": "How the database/sql pool works and which settings to tune."
     }
    ]
   },
   {
    "id": "lang-py-async",
    "title": "Python async",
    "what": "asyncio runs many I/O-bound tasks on one thread with an event loop. Tasks only switch at <code>await</code>, so one blocking call stalls every task on the loop.",
    "points": [
     "Calling an <code>async def</code> function only creates a coroutine; it runs when awaited or wrapped in a task. Keep references to <code>create_task</code> results or tasks can vanish mid-run",
     "Blocking calls (<code>time.sleep</code>, <code>requests</code>, sync database drivers, heavy CPU) freeze the loop. Use async clients (httpx, asyncpg) or <code>asyncio.to_thread</code>",
     "<code>asyncio.TaskGroup</code> (3.11+) cancels the siblings when one task fails and raises an <code>ExceptionGroup</code>; handle it with <code>except*</code>",
     "Bound fan-out with <code>asyncio.Semaphore</code> and add deadlines with <code>async with asyncio.timeout(5):</code>",
     "Debug mode (<code>PYTHONASYNCIODEBUG=1</code>) logs callbacks slower than 100 ms; <code>python -m asyncio pstree PID</code> (3.14) prints a live process's task tree"
    ],
    "use": "Services that mostly wait on the network: webhook fan-out, many concurrent HTTP or database calls, WebSocket servers.",
    "avoid": "Do not use asyncio for CPU-bound work, and do not call sync libraries from async code without <code>to_thread</code>.",
    "res": [
     {
      "t": "Developing with asyncio",
      "by": "Python docs",
      "url": "https://docs.python.org/3/library/asyncio-dev.html",
      "type": "docs",
      "free": true,
      "why": "Debug mode, finding blocking calls and common mistakes."
     },
     {
      "t": "Coroutines and tasks",
      "by": "Python docs",
      "url": "https://docs.python.org/3/library/asyncio-task.html",
      "type": "docs",
      "free": true,
      "why": "TaskGroup, timeouts, cancellation and to_thread."
     },
     {
      "t": "uvloop",
      "by": "MagicStack",
      "url": "https://github.com/MagicStack/uvloop",
      "type": "repo",
      "free": true,
      "why": "A faster drop-in event loop built on libuv."
     }
    ]
   },
   {
    "id": "lang-py-perf",
    "title": "Python performance and the GIL",
    "what": "In the default CPython build the Global Interpreter Lock lets one thread run Python bytecode at a time, so threads help I/O but not CPU work. A free-threaded build without the GIL was experimental in 3.13 and is officially supported, but still optional, in 3.14.",
    "points": [
     "Threads suit I/O because the GIL is released while waiting; for CPU-bound work use <code>ProcessPoolExecutor</code> or <code>multiprocessing</code>",
     "Free-threaded CPython (<code>python3.14t</code>, PEP 703): experimental in 3.13, supported in 3.14 (PEP 779) at roughly 5-10% single-thread overhead",
     "Importing a C extension that is not marked free-thread safe turns the GIL back on with a warning; check with <code>sys._is_gil_enabled()</code>",
     "Profile first: <code>cProfile</code> for deterministic profiles, <code>py-spy top --pid</code> and <code>py-spy record</code> to sample a live process without restarting it",
     "Fix in this order: algorithm and data structures, fewer I/O round trips, batching, NumPy, then move the hot loop to C, Cython or Rust"
    ],
    "use": "When a Python service is CPU-bound or slow and you must choose between threads, processes, asyncio or rewriting the hot path.",
    "avoid": "Do not add threads to speed up pure-Python CPU work on the default build, and do not move production to free-threading before your key C extensions support it.",
    "res": [
     {
      "t": "What's new in Python 3.14: free-threaded Python is officially supported",
      "by": "Python docs",
      "url": "https://docs.python.org/3/whatsnew/3.14.html#whatsnew314-free-threaded-now-supported",
      "type": "docs",
      "free": true,
      "why": "Current status of the free-threaded build and its single-thread cost."
     },
     {
      "t": "Python support for free threading",
      "by": "Python docs",
      "url": "https://docs.python.org/3/howto/free-threading-python.html",
      "type": "docs",
      "free": true,
      "why": "How to install, check and run the free-threaded build."
     },
     {
      "t": "py-spy",
      "by": "Ben Frederickson",
      "url": "https://github.com/benfred/py-spy",
      "type": "repo",
      "free": true,
      "why": "Sampling profiler you can attach to a running process."
     }
    ]
   },
   {
    "id": "lang-py-typing",
    "title": "Typing and packaging in Python",
    "what": "Type hints plus a checker (mypy or pyright) catch a whole class of bugs before runtime. A lockfile makes every install of your service get the same dependency versions.",
    "points": [
     "Annotate function signatures first; use dataclasses, <code>TypedDict</code> or Pydantic models for payloads, <code>Protocol</code> for duck typing, and <code>X | None</code> for optional values",
     "Run mypy or pyright in CI; turn on strict mode module by module and treat <code>Any</code> and <code>type: ignore</code> as debt",
     "Hints do nothing at runtime. Validate external input (webhook bodies, API requests) with Pydantic or similar",
     "Keep metadata and dependencies in <code>pyproject.toml</code>; lock exact versions with <code>uv.lock</code> or <code>pip-compile --generate-hashes</code>",
     "uv covers what pip, pip-tools, virtualenv and pyenv did: <code>uv add</code>, <code>uv lock</code>, <code>uv sync</code>, <code>uv run</code>, <code>uv python install</code>"
    ],
    "use": "Any Python codebase more than one person touches, and any service built and deployed from CI.",
    "avoid": "Do not try to make a large legacy codebase strict in one pass, and do not ship with only top-level pins and no lockfile.",
    "res": [
     {
      "t": "Type hints cheat sheet",
      "by": "mypy docs",
      "url": "https://mypy.readthedocs.io/en/stable/cheat_sheet_py3.html",
      "type": "docs",
      "free": true,
      "why": "The annotations you need day to day, on one page."
     },
     {
      "t": "Static Typing with Python",
      "by": "Python typing docs",
      "url": "https://typing.python.org/en/latest/",
      "type": "docs",
      "free": true,
      "why": "Official guides and reference for the type system."
     },
     {
      "t": "uv",
      "by": "Astral",
      "url": "https://docs.astral.sh/uv/",
      "type": "docs",
      "free": true,
      "why": "Projects, lockfiles and Python versions with one fast tool."
     }
    ]
   }
  ],
  "done": "You are done when you can build a bounded, cancellable Go worker pool with errgroup, profile it with pprof, and explain when the same job in Python needs asyncio, threads or processes."
 },
 {
  "id": "linux-net",
  "title": "Linux, networking and tools",
  "short": "Linux and tools",
  "icon": "terminal",
  "why": "Most production mysteries (a hung process, a slow partner API, a certificate error, a container that will not stop) are solved at a shell. These tools let you prove a cause instead of guessing.",
  "cadence": "Two topics a week at a real terminal (a VM, a container or a spare box), about three weeks. Run every command, do not just read.",
  "topics": [
   {
    "id": "lnx-process",
    "title": "Processes, signals and file descriptors",
    "what": "Every running program is a process with a PID, a parent, open file descriptors and signal handlers. \"It will not stop\", \"too many open files\" and zombie processes all come back to these.",
    "points": [
     "<code>fork</code> then <code>exec</code> starts a program; a zombie is a child whose parent never called <code>wait</code>, and orphans are adopted by PID 1",
     "SIGTERM asks a process to exit and can be caught; SIGKILL cannot. Supervisors send SIGTERM, wait a grace period, then send SIGKILL",
     "SIGINT is Ctrl-C, SIGHUP often means reload config, and SIGQUIT makes a Go program exit with a stack dump of its goroutines",
     "Files, sockets and pipes are all file descriptors; <code>ulimit -n</code> caps them, and \"too many open files\" (EMFILE) usually means a leak, not a low limit",
     "Inspect a live process: <code>ps -ef --forest</code>, <code>ls -l /proc/PID/fd</code>, <code>lsof -p PID</code>, <code>strace -f -p PID</code>"
    ],
    "use": "When a process will not stop, hangs, leaks connections, or behaves differently under a supervisor than in your terminal.",
    "avoid": "Do not reach for <code>kill -9</code> first: it skips cleanup such as draining requests, flushing logs and closing connections.",
    "res": [
     {
      "t": "Operating Systems: Three Easy Pieces, \"Interlude: Process API\"",
      "by": "Remzi and Andrea Arpaci-Dusseau",
      "url": "https://pages.cs.wisc.edu/~remzi/OSTEP/cpu-api.pdf",
      "type": "book",
      "free": true,
      "why": "fork, exec and wait explained with small C programs."
     },
     {
      "t": "signal(7)",
      "by": "Linux man-pages",
      "url": "https://man7.org/linux/man-pages/man7/signal.7.html",
      "type": "docs",
      "free": true,
      "why": "Default actions, which signals can be caught, and how delivery works."
     },
     {
      "t": "Spying on your programs with strace",
      "by": "Julia Evans (Wizard Zines)",
      "url": "https://wizardzines.com/zines/strace/",
      "type": "book",
      "free": true,
      "why": "A free zine on watching every system call a process makes."
     }
    ]
   },
   {
    "id": "lnx-perf-basics",
    "title": "CPU, memory and I/O basics",
    "what": "When a Linux host or container is slow, ten standard commands tell you within a minute whether CPU, memory, disk or network is the bottleneck.",
    "points": [
     "Brendan Gregg's 60-second checklist: <code>uptime</code>, <code>dmesg | tail</code>, <code>vmstat 1</code>, <code>mpstat -P ALL 1</code>, <code>pidstat 1</code>, <code>iostat -xz 1</code>, <code>free -m</code>, <code>sar -n DEV 1</code>, <code>sar -n TCP,ETCP 1</code>, <code>top</code>",
     "Linux load average counts tasks waiting on disk as well as on CPU, so a high load does not always mean busy CPUs",
     "<code>vmstat 1</code>: <code>r</code> above the CPU count means CPU saturation, nonzero <code>si</code>/<code>so</code> means swapping, high <code>wa</code> means waiting on I/O",
     "Memory: read the \"available\" column of <code>free -m</code>, since page cache is reclaimable; an OOM kill leaves a line in <code>dmesg</code>",
     "USE method: for each resource check utilization, saturation and errors; saturation and errors are the easiest to read"
    ],
    "use": "The first minute on any slow or misbehaving host or container, before you open dashboards or form a theory.",
    "avoid": "Do not stop at the first odd number: the checklist narrows the search, then a targeted tool (a profiler, <code>perf</code>, a trace) confirms the cause.",
    "res": [
     {
      "t": "Linux Performance Analysis in 60,000 Milliseconds",
      "by": "Netflix Performance Engineering (Brendan Gregg)",
      "url": "https://netflixtechblog.com/linux-performance-analysis-in-60-000-milliseconds-accc10403c55",
      "type": "blog",
      "free": true,
      "why": "The ten commands with real output and what each line means."
     },
     {
      "t": "The USE Method",
      "by": "Brendan Gregg",
      "url": "https://www.brendangregg.com/usemethod.html",
      "type": "blog",
      "free": true,
      "why": "A checklist that finds resource bottlenecks fast, with a Linux version."
     },
     {
      "t": "Linux Performance",
      "by": "Brendan Gregg",
      "url": "https://www.brendangregg.com/linuxperf.html",
      "type": "docs",
      "free": true,
      "why": "Tool maps and links for going deeper on each resource."
     }
    ]
   },
   {
    "id": "lnx-net-tools",
    "title": "Networking tools",
    "what": "Five tools answer most \"is it the network?\" questions: <code>curl</code> for HTTP, <code>dig</code> for DNS, <code>ss</code> for sockets, <code>tcpdump</code> for packets and <code>mtr</code> for the path.",
    "points": [
     "<code>curl -v</code> shows DNS, connect, TLS and headers; <code>-w</code> with <code>%{time_connect}</code>, <code>%{time_appconnect}</code> and <code>%{time_starttransfer}</code> splits latency by phase",
     "<code>dig +short</code>, <code>dig @8.8.8.8</code> and <code>dig +trace</code> show what a resolver returns and why; check TTLs and CNAME chains",
     "<code>ss -tanp</code> lists TCP sockets with state and process. Piles of <code>CLOSE_WAIT</code> mean your code is not closing sockets; piles of <code>TIME_WAIT</code> on a client mean no connection reuse",
     "<code>tcpdump -nn -i any port 443 -c 200 -w cap.pcap</code> captures without name lookups; open the file in Wireshark",
     "<code>mtr -rw host</code> shows loss and latency per hop; loss at a single middle hop is usually ICMP rate limiting, not real loss"
    ],
    "use": "When a call to a partner API or a customer's webhook endpoint fails or is slow and you need to split DNS, connect, TLS and server time.",
    "avoid": "Do not trust <code>ping</code> alone (ICMP is often blocked or deprioritized), and never run <code>tcpdump</code> on a busy host without a filter and a packet count.",
    "res": [
     {
      "t": "Everything curl",
      "by": "Daniel Stenberg",
      "url": "https://everything.curl.dev/",
      "type": "book",
      "free": true,
      "why": "The full curl book, by its author."
     },
     {
      "t": "How to use dig",
      "by": "Julia Evans",
      "url": "https://jvns.ca/blog/2021/12/04/how-to-use-dig/",
      "type": "blog",
      "free": true,
      "why": "The dig options that matter and how to read its output."
     },
     {
      "t": "Let's learn tcpdump!",
      "by": "Julia Evans (Wizard Zines)",
      "url": "https://wizardzines.com/zines/tcpdump/",
      "type": "book",
      "free": true,
      "why": "A free zine on the flags and filters you need for packet capture."
     }
    ]
   },
   {
    "id": "lnx-tls",
    "title": "TLS debugging",
    "what": "Most TLS failures are an incomplete certificate chain, a hostname mismatch, an expired certificate or the wrong SNI. <code>openssl s_client</code> shows all four in one command.",
    "points": [
     "<code>openssl s_client -connect host:443 -servername host -showcerts</code> prints the chain the server actually sends and the verify result",
     "Servers must send the leaf and the intermediates; clients only hold roots. A missing intermediate can work in a browser yet fail in curl, Go and Python",
     "SNI puts the hostname in the ClientHello so one IP can serve many certificates; connect by IP without <code>-servername</code> and you may get a default certificate",
     "<code>openssl x509 -noout -text</code> shows a certificate: modern clients match the hostname against Subject Alternative Names (not the CN) and check <code>notAfter</code>",
     "Go's \"x509: certificate signed by unknown authority\" and Python's CERTIFICATE_VERIFY_FAILED usually mean a missing intermediate or a private CA"
    ],
    "use": "When a client reports a certificate error, a webhook delivery fails in the handshake, or before you rotate a certificate.",
    "avoid": "Do not \"fix\" errors with <code>curl -k</code>, <code>InsecureSkipVerify</code> or <code>verify=False</code> outside a local test; that removes the protection TLS exists for.",
    "res": [
     {
      "t": "The Illustrated TLS 1.3 Connection",
      "by": "Michael Driscoll",
      "url": "https://tls13.xargs.org/",
      "type": "interactive",
      "free": true,
      "why": "Every byte of a real handshake, explained."
     },
     {
      "t": "openssl-s_client",
      "by": "OpenSSL docs",
      "url": "https://docs.openssl.org/master/man1/openssl-s_client/",
      "type": "docs",
      "free": true,
      "why": "Every option, including -servername and -showcerts."
     },
     {
      "t": "badssl.com",
      "by": "badssl.com project",
      "url": "https://badssl.com/",
      "type": "interactive",
      "free": true,
      "why": "Test hosts with expired, wrong-host, self-signed and incomplete-chain certificates to practice on."
     }
    ]
   },
   {
    "id": "lnx-containers",
    "title": "Containers under the hood",
    "what": "A container is an ordinary Linux process with namespaces (what it can see) and cgroups (what it can use), started from a layered image. This explains OOM kills, CPU throttling and ignored SIGTERMs.",
    "points": [
     "Namespaces isolate PIDs, network, mounts, hostname, IPC and users; <code>unshare</code> creates them and <code>nsenter</code> joins them",
     "cgroups v2 set <code>memory.max</code> and <code>cpu.max</code>. Over the memory limit the process is OOM-killed (exit 137); over the CPU quota it is throttled (<code>nr_throttled</code> in <code>cpu.stat</code>)",
     "PID 1 gets no default signal actions: without a SIGTERM handler (a plain Python app, for example) it ignores SIGTERM until SIGKILL. PID 1 must also reap zombies",
     "Fix PID 1 with exec-form <code>CMD [\"./app\"]</code>, <code>exec</code> in entrypoint scripts, or an init like tini (<code>docker run --init</code>, ECS <code>initProcessEnabled</code>)",
     "Go 1.25+ sets <code>GOMAXPROCS</code> from the container CPU limit, but you still set <code>GOMEMLIMIT</code> below the memory limit yourself"
    ],
    "use": "When a containerized service ignores SIGTERM, gets OOM-killed, runs slower than on your laptop, or leaves zombie processes.",
    "avoid": "Do not treat a container as a security boundary as strong as a VM, and do not use a shell-form <code>CMD</code> that leaves <code>sh</code> as PID 1.",
    "res": [
     {
      "t": "What even is a container: namespaces and cgroups",
      "by": "Julia Evans",
      "url": "https://jvns.ca/blog/2016/10/10/what-even-is-a-container/",
      "type": "blog",
      "free": true,
      "why": "A short, clear tour of the kernel features behind containers."
     },
     {
      "t": "Containers From Scratch",
      "by": "Liz Rice, GOTO 2018",
      "url": "https://www.youtube.com/watch?v=8fi7uSYlOdc",
      "type": "video",
      "free": true,
      "why": "Builds a working container in Go on stage, one namespace at a time."
     },
     {
      "t": "tini",
      "by": "Thomas Orozco",
      "url": "https://github.com/krallin/tini",
      "type": "repo",
      "free": true,
      "why": "The README explains the PID 1 signal and zombie problems it solves."
     }
    ]
   },
   {
    "id": "lnx-git",
    "title": "Git beyond the basics",
    "what": "Git stores snapshots, and branches are movable pointers to them. Once that clicks, rebase, bisect and reflog stop being scary.",
    "points": [
     "<code>git reflog</code> records everywhere HEAD has been, so commits lost to a bad reset or rebase are usually recoverable (entries last 30-90 days by default)",
     "<code>git rebase -i</code> squashes, reorders and rewords local commits; pair <code>git commit --fixup</code> with <code>--autosquash</code>. Never rewrite a branch others have pulled",
     "<code>git bisect start</code>, mark one <code>bad</code> and one <code>good</code> commit, then <code>git bisect run ./test.sh</code> finds the breaking commit by binary search",
     "<code>git worktree add -b hotfix ../hotfix origin/main</code> checks out a second branch in another folder, so there is no stashing mid-task",
     "<code>git log -S \"text\"</code> finds the commit that added or removed a string; <code>git blame -w -C</code> ignores whitespace and follows moved code"
    ],
    "use": "Cleaning up a branch before review, finding which commit introduced a regression, recovering from a bad reset, or working on two branches at once.",
    "avoid": "Do not force-push or rebase shared branches; add a new commit or use <code>git revert</code> instead.",
    "res": [
     {
      "t": "Pro Git",
      "by": "Scott Chacon and Ben Straub",
      "url": "https://git-scm.com/book/en/v2",
      "type": "book",
      "free": true,
      "why": "The standard Git book; read the Git Tools and Git Internals chapters."
     },
     {
      "t": "git-bisect",
      "by": "Git docs",
      "url": "https://git-scm.com/docs/git-bisect",
      "type": "docs",
      "free": true,
      "why": "Manual and automated bisect, including skipping untestable commits."
     },
     {
      "t": "Learn Git Branching",
      "by": "Peter Cottle",
      "url": "https://learngitbranching.js.org/",
      "type": "interactive",
      "free": true,
      "why": "Visual exercises for rebase, cherry-pick and moving branches."
     }
    ]
   }
  ],
  "done": "You are done when, on a real Linux box, you can say within ten minutes whether a slow request is DNS, TLS, network, CPU, memory, disk or the process itself, and bisect a regression without looking up the commands."
 },
 {
  "id": "career",
  "title": "Career craft",
  "short": "Career",
  "icon": "briefcase",
  "why": "The jump to SDE-2 is judged less on raw coding and more on reviews, writing, planning and how you lift others. Interviews test the same things through behavioral rounds and design discussions.",
  "cadence": "One topic per week alongside the main roadmap, each ending in a real artifact (a review, a doc, an estimate, a story). About six weeks.",
  "topics": [
   {
    "id": "car-code-review",
    "title": "Code review",
    "what": "Code review keeps the codebase healthy and spreads knowledge. Approve when the change clearly improves the code, not when it matches how you would have written it.",
    "points": [
     "Review in order: design and approach, then correctness and tests, then naming. Let linters and formatters own style",
     "Label each comment's weight (blocking, question, \"nit:\", praise), explain why, and suggest a concrete alternative",
     "Look for what tests miss: error paths, retries and idempotency, timeouts, backward compatibility, migrations, secrets in logs",
     "Respond within one working day. Small PRs get faster and better reviews, so split large changes",
     "Receiving: answer every comment (fix it, or explain and agree), and move long threads to a call, then write the outcome back in the PR"
    ],
    "use": "Every PR you open or review. It is also the most visible, day-to-day signal of SDE-2 judgment.",
    "avoid": "Do not block on personal preference, and do not approve a large PR you only skimmed.",
    "res": [
     {
      "t": "How to do a code review",
      "by": "Google Engineering Practices",
      "url": "https://google.github.io/eng-practices/review/reviewer/",
      "type": "docs",
      "free": true,
      "why": "What to look for, how fast to respond and how to write comments."
     },
     {
      "t": "The CL author's guide to getting through code review",
      "by": "Google Engineering Practices",
      "url": "https://google.github.io/eng-practices/review/developer/",
      "type": "docs",
      "free": true,
      "why": "Small changes, good descriptions and handling reviewer pushback."
     },
     {
      "t": "Conventional Comments",
      "by": "Paul Slaughter",
      "url": "https://conventionalcomments.org/",
      "type": "docs",
      "free": true,
      "why": "A simple labeling format that makes each comment's intent clear."
     }
    ]
   },
   {
    "id": "car-writing",
    "title": "Writing",
    "what": "At SDE-2, your writing is how decisions get made when you are not in the room. Short, specific and structured beats long and complete.",
    "points": [
     "Design doc: context, goals and non-goals, proposal, alternatives considered, risks, rollout and rollback. Get it reviewed before coding",
     "PR description: what changed, why, how you tested it and the risk, with a link to the ticket",
     "Incident update: what is broken, who is affected, what we are doing, when the next update comes. Post on schedule even if nothing changed",
     "Lead with the conclusion or the ask; one idea per paragraph; replace \"slow\" and \"many\" with numbers",
     "Write for a skimmer: headings, short bullets and a table for any comparison"
    ],
    "use": "Any change that crosses teams or takes more than a few days, every PR, and every incident channel.",
    "avoid": "Do not write the design doc after the code just to tick a box, and do not bury the decision or the ask at the end.",
    "res": [
     {
      "t": "Technical Writing courses",
      "by": "Google for Developers",
      "url": "https://developers.google.com/tech-writing",
      "type": "course",
      "free": true,
      "why": "Short free courses on clear sentences, lists and document structure."
     },
     {
      "t": "Design Docs at Google",
      "by": "Malte Ubl",
      "url": "https://www.industrialempathy.com/posts/design-docs-at-google/",
      "type": "blog",
      "free": true,
      "why": "What a design doc contains and when to skip writing one."
     },
     {
      "t": "Writing good CL descriptions",
      "by": "Google Engineering Practices",
      "url": "https://google.github.io/eng-practices/review/developer/cl-descriptions.html",
      "type": "docs",
      "free": true,
      "why": "First line, body, and good and bad examples."
     }
    ]
   },
   {
    "id": "car-estimation",
    "title": "Estimation and planning",
    "what": "An estimate is a forecast with uncertainty, not a promise. Break the work down, attack the unknowns first, and update the forecast as you learn.",
    "points": [
     "Break work into tasks of a day or less; whatever you cannot break down is an unknown, so spike it first",
     "Give a range with a confidence level (\"3-5 days, fairly sure\") and state your assumptions",
     "Add the work people forget: tests, review rounds, migrations, rollout, dashboards and alerts, docs, on-call and meetings",
     "Track estimate vs actual for a few weeks to learn your personal multiplier",
     "Plan milestones that each ship something usable; cut scope before moving the date, and flag a slip the day you see it"
    ],
    "use": "Sizing a ticket, committing to a sprint, or planning a multi-week project that depends on other teams.",
    "avoid": "Do not give a single number under pressure without its assumptions, and do not pad silently.",
    "res": [
     {
      "t": "Shape Up",
      "by": "Ryan Singer, Basecamp",
      "url": "https://basecamp.com/shapeup",
      "type": "book",
      "free": true,
      "why": "Fixed time, variable scope: set an appetite, then shape the work to fit it."
     },
     {
      "t": "Evidence Based Scheduling",
      "by": "Joel Spolsky",
      "url": "https://www.joelonsoftware.com/2007/10/26/evidence-based-scheduling/",
      "type": "blog",
      "free": true,
      "why": "Use your own estimate history to forecast ship dates as ranges."
     }
    ]
   },
   {
    "id": "car-behavioral",
    "title": "Behavioral interviews",
    "what": "Behavioral rounds check whether your past actions match the level you want. Prepare six to eight true stories and adapt them to each question.",
    "points": [
     "STAR: Situation and Task in two sentences, most of the time on Action (what you did, so say \"I\"), and a Result with a number and a lesson",
     "Story bank: a hard bug or incident, a conflict, a mistake you owned, influencing without authority, a deadline trade-off, mentoring someone",
     "Map each story to a few competencies or to Amazon's Leadership Principles, such as Ownership, Dive Deep, and Have Backbone; Disagree and Commit",
     "SDE-2 signal: scope beyond your own tickets, handling ambiguity, and making others better",
     "Practice out loud at 2-3 minutes per story, and prepare the follow-ups, such as what you would do differently"
    ],
    "use": "Before any interview loop, and when writing a self-review or promotion case.",
    "avoid": "Do not say \"we\" for everything, invent stories, or offer a \"weakness\" that is really a strength.",
    "res": [
     {
      "t": "Behavioral interviews",
      "by": "Tech Interview Handbook",
      "url": "https://www.techinterviewhandbook.org/behavioral-interview/",
      "type": "docs",
      "free": true,
      "why": "How the round is judged, common questions and STAR tips."
     },
     {
      "t": "Leadership Principles",
      "by": "Amazon",
      "url": "https://www.amazon.jobs/content/en/our-workplace/leadership-principles",
      "type": "docs",
      "free": true,
      "why": "The principles behind many behavioral questions, even outside Amazon."
     },
     {
      "t": "Get your work recognized: write a brag document",
      "by": "Julia Evans",
      "url": "https://jvns.ca/blog/brag-documents/",
      "type": "blog",
      "free": true,
      "why": "A running log of your work that turns into your story bank."
     }
    ]
   },
   {
    "id": "car-mentoring",
    "title": "Mentoring and influence without authority",
    "what": "An SDE-2 makes the people around them better and moves decisions they do not own. Both run on trust, clarity and follow-through.",
    "points": [
     "Mentoring: ask before telling, pair on real tasks, let them drive, and give feedback that is specific and timely",
     "Delegate stretch work with context and a safety net, and resist taking it back when it gets hard",
     "Influence: write the proposal down, bring data (a dashboard, a cost, an incident count), and talk to key people one-on-one before the big meeting",
     "Disagree openly with reasons, then commit once a decision is made; give credit in public",
     "Trust comes from doing what you said, on time. Make your glue work (onboarding, reviews, coordination) visible so it counts"
    ],
    "use": "Onboarding a new teammate, pushing a cross-team change (a shared library, an alerting standard, a migration), or leading a small project.",
    "avoid": "Do not confuse mentoring with doing the work for someone, or influence with escalating to managers first.",
    "res": [
     {
      "t": "On Being A Senior Engineer",
      "by": "John Allspaw",
      "url": "https://www.kitchensoap.com/2012/10/25/on-being-a-senior-engineer/",
      "type": "blog",
      "free": true,
      "why": "The classic list of what makes an engineer mature, including how they lift others."
     },
     {
      "t": "Being Glue",
      "by": "Tanya Reilly",
      "url": "https://www.noidea.dog/glue",
      "type": "blog",
      "free": true,
      "why": "Why coordination and mentoring work matters, and how to make it count."
     },
     {
      "t": "StaffEng guides",
      "by": "Will Larson",
      "url": "https://staffeng.com/guides/",
      "type": "docs",
      "free": true,
      "why": "Practical guides on influence, visibility and getting into the room."
     }
    ]
   },
   {
    "id": "car-dsa",
    "title": "Keeping DSA warm",
    "what": "Interview problems come from about fifteen patterns. Recognizing the pattern quickly matters more than how many problems you have solved.",
    "points": [
     "Core patterns: two pointers, sliding window, hashing, binary search (also on the answer), BFS and DFS, topological sort, heaps for top-k, intervals, monotonic stack, union-find, dynamic programming, backtracking",
     "A curated list (Grind 75 or NeetCode 150) done well beats hundreds of random problems",
     "For each problem: state the brute force, name the pattern, give time and space complexity, then code and test edge cases out loud",
     "Stay warm with 3-4 problems a week, and redo the ones you failed after 3, 7 and 30 days",
     "Know your language's toolbox cold: Go's <code>slices.SortFunc</code> and <code>container/heap</code>, Python's <code>heapq</code>, <code>collections.Counter</code> and <code>bisect</code>"
    ],
    "use": "A steady weekly habit now, ramping to daily practice in the four to six weeks before interview loops.",
    "avoid": "Do not grind by memorizing solutions; if you cannot explain why a pattern fits, it will not transfer to a new problem.",
    "res": [
     {
      "t": "Grind 75",
      "by": "Tech Interview Handbook",
      "url": "https://www.techinterviewhandbook.org/grind75/",
      "type": "interactive",
      "free": true,
      "why": "A study plan you can size to the weeks and hours you have."
     },
     {
      "t": "Algorithms study cheatsheets",
      "by": "Tech Interview Handbook",
      "url": "https://www.techinterviewhandbook.org/algorithms/study-cheatsheet/",
      "type": "docs",
      "free": true,
      "why": "Per-topic techniques, corner cases and must-do problems."
     },
     {
      "t": "NeetCode roadmap",
      "by": "NeetCode",
      "url": "https://neetcode.io/roadmap",
      "type": "interactive",
      "free": true,
      "why": "Problems grouped by pattern, with video solutions."
     }
    ]
   }
  ],
  "done": "You are done when you have six written STAR stories, a design doc and a PR description you would show a hiring manager, and you can solve a medium problem in 30 minutes while explaining it out loud."
 }
]);
