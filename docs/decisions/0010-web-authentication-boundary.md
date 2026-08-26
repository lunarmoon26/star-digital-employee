# 0010: Protect the DSH Web Surface With an Authentication Proxy

Status: Accepted
Date: 2026-08-25

## Context

DeepSeek Harness Web is code-execution-equivalent: it can create sessions, run
turns, and mutate the workspace through the same RPC surface the browser uses.
Pinned `@deepseek-ai/dsh@0.1.1-rc.2` deliberately ships no authentication,
TLS, or origin policy on that surface. Its only protection is a browser trust
fence plus a loopback-only bind: the `dsh web` CLI refuses `--host 0.0.0.0`, and
the `/api` route enforces a Host/Origin reachability check before dispatch.

The employee therefore needs an authentication boundary in front of DSH Web for
local development and an OIDC identity contract for production, without forking
DSH.

## Decision Drivers

- DSH Web is the direct command portal and must not be reachable unauthenticated.
- The pinned DSH release must not be modified; the boundary must be a sidecar or
  an out-of-tree composition overlay.
- The supervisor bridge (ADR 0009) remains a separate owner-only socket and is
  not the browser authentication path.
- Local development must stay simple and deterministic; production must express
  organization identity, roles, and revocation through OIDC.

## Options Considered

### Add authentication inside DSH

DSH's `/api` route is the natural chokepoint, but changing it means patching the
pinned release and re-verifying the frozen graph on every upgrade. Rejected.

### Expose DSH Web directly with a token injected into the browser

There is no DSH-side token check, and a browser cannot be trusted to hold a
secret on a code-execution surface. Rejected.

### Run an authentication proxy as an in-pod sidecar

The sidecar shares the pod network namespace, enforces authentication, and
forwards only loopback. DSH stays unmodified. Accepted.

## Decision

DSH Web stays bound to loopback and unauthenticated. Every network path to it is
fronted by an authentication proxy that shares the pod network namespace and
forwards to `127.0.0.1:3080`. The proxy is the only port the pod publishes.

The proxy must satisfy this contract, derived from DSH `0.1.1-rc.2` behavior:

1. Terminate TLS and enforce OIDC (cookie or `Authorization: Bearer`) before any
   DSH request reaches the Harness.
2. Forward `POST /api/*` and static `GET`s verbatim; every `/api` POST must keep
   `Content-Type: application/json`, because DSH rejects other media types with
   `415`.
3. Upgrade and forward the two downlink WebSockets `/api/events.mux` and
   `/api/events.host`; a proxy that drops the upgrade breaks live session events.
4. Preserve the external `Host` header and declare that authority in DSH's
   `trustedHosts`, because DSH's trust fence requires `Origin` to equal `Host`
   and ignores all `X-Forwarded-*` headers.
5. DSH needs no `X-Forwarded-*` values; the proxy supplies them only for its own
   logs and policy.
6. Local development uses the same sidecar shape with a minimal shared-secret
   bearer mode (a token read from a mounted owner-only file) instead of a full
   OIDC issuer.

The chart encodes the sidecar as a second container in the Harness pod (all pod
containers share the network namespace), rendered only when enabled, with the
proxy image, OIDC issuer, client, and secret reference as values. The Harness
container never binds a non-loopback address.

## Consequences

- Positive: DSH Web gains authentication without modifying the pinned release.
- Positive: The contract is testable against DSH's documented trust-fence and
  upgrade behavior.
- Negative: One more in-pod container and a TLS/OIDC configuration surface to
  operate.
- Negative: WebSocket upgrade and authority preservation become deployment
  requirements that ordinary reverse-proxy defaults can silently break.
- Follow-up: Browser and supervisor concurrency is tested through the proxy, and
  the OIDC proxy sidecar is exercised in the kind-cluster conformance run.

## Confirmation

- The chart renders a sidecar container sharing the Harness pod, forwarding to
  loopback, and publishing only the proxy port.
- A local-dev token gate rejects an unauthenticated `/api` request and admits an
  authenticated one.
- The OIDC sidecar preserves `Host`, upgrades `/api/events.*`, and forwards
  `application/json` POSTs unchanged.
