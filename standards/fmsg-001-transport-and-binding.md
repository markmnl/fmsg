# FMSG-001 TCP+TLS Transport and Binding Standard

This standard defines the TCP+TLS transport binding for fmsg. It specifies host-to-host fmsg communication over TCP using TLS allowing fmsg implementations following this standard to interoperate. This standard covers both Connection 1 (message transfer) and Connection 2 (challenge) as defined in the [fmsg Specification](../SPECIFICATION.md#protocol).


## Port

fmsg TCP+TLS MUST use TCP port 4930 for both outgoing and incoming connections. Hosts MUST listen on port 4930 to accept incoming message transfers and [incoming challenges](../SPECIFICATION.md#handling-a-challenge).


## TLS Requirements

All connections MUST use TLS 1.3 or higher. Plain TCP is forbidden. Implementations MUST reject TLS versions below 1.3 and SHOULD prefer the highest mutually supported version.

Implementations MUST support at minimum:
- TLS 1.3: `TLS_AES_128_GCM_SHA256`

TLS compression MUST NOT be used.

Implementations SHOULD negotiate ALPN protocol identifier `fmsg/1`.


### Certificates

Hosts MUST present valid X.509 certificates. Certificates MUST be issued by a Certificate Authority trusted by the connecting party. Self-signed certificates MUST NOT be accepted unless explicitly configured as trusted by the implementation.

The TLS server's certificate MUST match the `fmsg.<domain>` hostname of the **server's** domain:
- **Connection 1** (Sending Host → Receiving Host): the server is the Receiving Host, certificate and SNI MUST use `fmsg.<recipient_domain>`.
- **Connection 2** (Receiving Host → Sending Host): the server is the Sending Host, certificate and SNI MUST use `fmsg.<sender_domain>`.

The TLS client MUST set SNI accordingly. Connections MUST be closed on any certificate validation or SNI mismatch failure.


## DNS

Hosts MUST resolve `fmsg.<domain>` for A and AAAA records (including via CNAME) per [Domain Resolution](../SPECIFICATION.md#domain-resolution).

If multiple IP addresses are returned, the Sending Host SHOULD attempt each in order until a responsive host is reached, per [Protocol Steps](../SPECIFICATION.md#protocol-steps).

Hosts SHOULD perform DNSSEC validation for all `fmsg` lookups. If DNSSEC validation fails, the connection MUST be terminated.


### Sender IP Verification

The Receiving Host MUST verify the source IP address of Connection 1 is in the resolved A/AAAA record set for `fmsg.<sender_domain>` before proceeding with the protocol or issuing any challenge. See [Domain Resolution](../SPECIFICATION.md#domain-resolution).


## Session Establishment

1. Resolve `fmsg.<domain>` via DNS (see above)
2. Connect to resolved IP on port 4930
3. Perform TLS handshake with appropriate SNI (see Certificates)
4. Validate certificate
5. Proceed with fmsg protocol

Failure at any step MUST terminate the connection.


## Lifecycle

Each connection carries exactly one fmsg message exchange. The connection MUST be closed after the exchange completes or is aborted per the [Protocol](../SPECIFICATION.md#protocol).


## Timeouts and Limits

Hosts SHOULD enforce:
- Maximum concurrent connections, globally and per source IP.
- Idle connection timeouts — connections with no data received within an implementation-defined period SHOULD be closed.
- Minimum data-rate thresholds — connections transferring below a configurable floor for a sustained period SHOULD be terminated.
- Rate limits on outgoing challenge connections per destination IP.

These safeguards address the connection flooding, slow-data, and challenge reflection threats described in [Security Concerns](../SPECIFICATION.md#security-concerns).


## Errors

Pre-protocol failures (DNS resolution failure, TCP failure, TLS handshake failure, certificate validation failure) MUST result in closing the TCP connection. No fmsg response code is sent since the protocol has not begun.

Mid-protocol failures (protocol violations, sender IP verification failure) MUST result in tearing down all connections with that host (TERMINATE) per the [Specification](../SPECIFICATION.md#protocol-steps).

No insecure fallback is permitted.


## Extensibility

This is *FMSG-001 TCP+TLS Transport and Binding Standard*. Future standards MAY define alternative transports. They MUST NOT alter the semantics of this binding.


## Security

Security depends on correct DNS resolution (with DNSSEC), valid PKI trust, strict TLS enforcement, and sender IP verification. Failure in any component may allow impersonation or interception. See [Security Concerns](../SPECIFICATION.md#security-concerns) for the full threat model.