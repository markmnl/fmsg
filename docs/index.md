<p class="landing-eyebrow">Open distributed messaging protocol</p>

# fmsg

<p class="landing-lead">
  A binary message format and protocol for immutable, relational messages that
  every host can verify.
</p>

fmsg addresses look like `@user@domain`. Messages travel between independently
operated hosts, and each reply references its parent by cryptographic hash to
form a verifiable message graph.

<div class="document-actions landing-actions">
  <a class="primary-action" href="SPECIFICATION/">Read the specification</a>
  <a href="white-paper/">Read the white paper</a>
  <a href="https://github.com/markmnl/fmsg">View source on GitHub</a>
</div>

## Core documents

<div class="landing-grid">
  <a class="landing-card" href="SPECIFICATION/">
    <span class="landing-card-label">Normative</span>
    <strong>Full specification</strong>
    <span>The message definition, host protocol, domain resolution, and security considerations.</span>
  </a>
  <a class="landing-card" href="SPEC/">
    <span class="landing-card-label">Implementation aid</span>
    <strong>Concise specification</strong>
    <span>A compact reference for implementers, derived from the full specification.</span>
  </a>
  <a class="landing-card" href="white-paper/">
    <span class="landing-card-label">Introduction</span>
    <strong>White paper</strong>
    <span>The motivation, model, and design of fmsg at a higher level.</span>
  </a>
</div>

## Standards

The core specification defines messages and host-to-host protocol semantics.
FMSG standards define interoperable transports, supporting APIs, and protocol
bindings around that core.

<div class="landing-grid standards-grid">
  <a class="landing-card" href="standards/fmsg-001-transport-and-binding/">
    <span class="landing-card-label">FMSG-001</span>
    <strong>TCP+TLS transport</strong>
    <span>Secure host-to-host transport, port binding, DNS, and connection requirements.</span>
  </a>
  <a class="landing-card" href="standards/fmsg-002-id/">
    <span class="landing-card-label">FMSG-002</span>
    <strong>Address API</strong>
    <span>Address lookup, acceptance status, metadata, and quota reporting.</span>
  </a>
  <a class="landing-card" href="standards/fmsg-003-webapi/">
    <span class="landing-card-label">FMSG-003</span>
    <strong>Web API</strong>
    <span>Authenticated HTTP and WebSocket access for fmsg clients.</span>
  </a>
  <a class="landing-card" href="standards/fmsg-004-a2a-binding/">
    <span class="landing-card-label">FMSG-004 · Draft</span>
    <strong>A2A binding</strong>
    <span>An Agent2Agent protocol binding carried over fmsg messages.</span>
  </a>
  <a class="landing-card" href="standards/fmsg-007-mcp-binding/">
    <span class="landing-card-label">FMSG-007 · Draft</span>
    <strong>MCP binding</strong>
    <span>How a Model Context Protocol server gives an AI agent an fmsg address.</span>
  </a>
</div>

[Browse the standards overview](STANDARDS.md){ .section-link }

## For AI agents

Any MCP-capable agent can have its own fmsg address. Install
[fmsg-mcp](https://github.com/markmnl/fmsg-mcp), the reference implementation
of [FMSG-007](standards/fmsg-007-mcp-binding.md), and point it at an fmsg Web
API and API key:

```sh
claude mcp add fmsg --scope user \
  --env FMSG_API_URL=https://api.example.com \
  --env FMSG_API_KEY=fmsgk_... \
  -- npx -y @markmnl/fmsg-mcp
```

The same server runs as a hosted endpoint where every user connects with their
own key, so an fmsg host can offer `mcp.<domain>` to all of its users. Agents
that speak A2A can use the [FMSG-004](standards/fmsg-004-a2a-binding.md)
binding instead.

## Implementations

The open-source ecosystem includes a host daemon, client-facing Web API,
address and quota service, command-line client, a Docker Compose stack for
running them together, and adaptors that connect agent frameworks to fmsg.

[Explore fmsg implementations](IMPLEMENTATIONS.md){ .section-link }

## Project

fmsg is an open protocol developed in public. Read the
[project background](show-hn.md), inspect the
[source repository](https://github.com/markmnl/fmsg), or contribute through
GitHub.
