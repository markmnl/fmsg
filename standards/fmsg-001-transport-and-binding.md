# FMSG-001 TCP+TLS Transport and Binding Standard

This standard defines the TCP+TLS transport binding for fmsg. It specifies host-to-host fmsg communication over TCP using TLS allowing implementors of this standard to interoperate.


## Port

fmsg TCP+TLS MUST use TCP port 4930.


## TLS Requirements

All connections MUST use TLS. Plain TCP is forbidden.

Implementations MUST support TLS 1.2 or higher and SHOULD prefer TLS 1.3.


### Certificates

Hosts MUST present valid X.509 certificates. Clients MUST validate certificates using standard PKI rules, including hostname verification against `fmsg.<domain>`.

Connections MUST be closed on any validation failure.

TLS identity MUST match the resolved `fmsg.<domain>` hostname.

Clients MUST set SNI to `fmsg.<domain>`.

TLS compression MUST NOT be used. Implementations SHOULD prefer modern AEAD cipher suites with forward secrecy.


## Session Establishment

1. Resolve `fmsg.<domain>` via DNS per Domain Resolution in the specification.
2. Connect to resolved IP on port 4930
3. Perform TLS handshake with SNI `fmsg.<domain>`
4. Validate certificate
5. Proceed with fmsg protocol

Failure at any step MUST terminate the connection.


## Lifecycle

Each connection is a single session. Connections MAY be closed at any time. Session reuse is not defined by this binding.


## Errors

Connections MUST be terminated on:

DNS resolution failure
TCP failure
TLS handshake failure
Certificate validation failure
SNI mismatch
Protocol violations

No insecure fallback is permitted.


## Extensibility

This is *FMSG-001 TCP+TLS Transport and Binding Standard*, future standards MAY define alternative transports. They MUST NOT alter the semantics of this binding.


## Security

Security depends on correct DNS resolution, valid PKI trust, and strict TLS enforcement. Failure in any component may allow impersonation or interception.