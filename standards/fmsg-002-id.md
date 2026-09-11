# FMSG-002 Id Standard

## Status

| Revision | Date | Summary |
|----------|------|---------|
| v0.1.0 | 2026-09-11 | Address lookup, quotas, usage reporting, and optional provisioning |

This standard defines an HTTP address and quota service for fmsg hosts and
[FMSG-003 client APIs](fmsg-003-webapi.md), independent of the configured
identity provider.

[fmsgid](https://github.com/markmnl/fmsgid) is an existing example implementation.

The capitalized requirement words **MUST**, **MUST NOT**, **SHOULD**,
**SHOULD NOT**, **RECOMMENDED**, **MAY**, **REQUIRED**, and **OPTIONAL** have
the meanings defined by [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119)
and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

## Transport and Access

The deployment configures the service base URL. All routes use `/fmsgid`.
Access MUST be restricted to trusted host components and provisioning callers,
with authority limited to their permitted domains and operations. The
service-credential mechanism is deployment-specific.

Connections over untrusted networks MUST use HTTPS with certificate
verification. Plain HTTP MAY be used on a protected local network or behind
a trusted TLS terminator. Lookup addresses can appear in URL access logs;
operators SHOULD restrict or redact those logs.

Address lookup and provisioning do not authenticate a user or establish
ownership. FMSG-003 callers MUST validate credentials and establish the
effective address before consulting this service.

## Conventions

- Addresses MUST follow the core [Address](../SPECIFICATION.md#address)
  syntax and byte-length limit. Lookup, provisioning, and accounting MUST
  compare identities using Unicode default case folding. Responses MAY
  preserve registered spelling. Lookup addresses MUST be URL-encoded as
  one path segment.
- JSON bodies MUST use `application/json`. Field names are case-sensitive;
  clients MUST ignore unrecognized response properties.
- Sizes and counts are JSON integers. Usage MUST be non-negative; limits
  MUST be `-1` for unlimited or non-negative. Zero is a real limit. Callers
  MUST preserve integer precision and avoid overflow in quota calculations.
- Required fields MUST be present with the documented types. Services MUST
  reject unsupported numeric values rather than truncate or wrap them.
  Missing or malformed quota fields MUST NOT be interpreted as unlimited.

## Operations

| Method | Route | Purpose | Success |
|--------|-------|---------|---------|
| `GET` | `/fmsgid/{address}` | Lookup address details. | `200` with JSON. |
| `POST` | `/fmsgid/send` | Record a send event. | `200`. |
| `POST` | `/fmsgid/recv` | Record a receive event. | `200`. |
| `POST` | `/fmsgid` | Optionally provision an address. | `201` if created; `200` if already present. |

Provisioning is OPTIONAL; an unsupported provisioning route MAY return `404`
or `405`. Other operations are REQUIRED. Successful writes require no
response body. Administrative updates, deletion, and usage reversal are
outside this revision.

## Address Lookup

`GET /fmsgid/{address}` returns `200` for a known identity, including one with
`acceptingNew: false`, or `404` for an unknown identity. Lookup MUST NOT change
state. The response MUST contain all fields below except the optional `tags`.
An address without accounting history has zero usage.

| Field | Type | Meaning |
|-------|------|---------|
| `address` | string | Registered spelling of the identity. |
| `displayName` | string | Display label; empty when unset. |
| `acceptingNew` | boolean | Whether the address accepts new messages, subject to quotas. |
| `tags` | array of strings or null, optional | Deployment-defined metadata; omitted, null, and empty mean no tags. |

| Receive limit | Send limit | Maximum |
|---------------|------------|---------|
| `limitRecvSizeTotal` | `limitSendSizeTotal` | Cumulative accounted bytes. |
| `limitRecvSizePerMsg` | `limitSendSizePerMsg` | Accounted bytes per message event. |
| `limitRecvSizePer1d` | `limitSendSizePer1d` | Accounted bytes in the daily window. |
| `limitRecvCountPer1d` | `limitSendCountPer1d` | Event count in the daily window. |

| Receive usage | Send usage | Value |
|---------------|------------|-------|
| `recvSizeTotal` | `sendSizeTotal` | Recorded bytes over the retained accounting history. |
| `recvSizePer1d` | `sendSizePer1d` | Recorded bytes in the daily window. |
| `recvCountPer1d` | `sendCountPer1d` | Recorded event count in the daily window. |

```json
{
  "address": "@alice@example.com",
  "displayName": "Alice",
  "acceptingNew": true,
  "limitRecvSizeTotal": -1,
  "limitRecvSizePerMsg": 10240,
  "limitRecvSizePer1d": 102400,
  "limitRecvCountPer1d": 1000,
  "limitSendSizeTotal": -1,
  "limitSendSizePerMsg": 10240,
  "limitSendSizePer1d": 102400,
  "limitSendCountPer1d": 1000,
  "recvSizeTotal": 300,
  "recvSizePer1d": 300,
  "recvCountPer1d": 1,
  "sendSizeTotal": 300,
  "sendSizePer1d": 200,
  "sendCountPer1d": 1,
  "tags": []
}
```

## Quota Semantics

At service time `T`, `Per1d` covers the rolling 86,400-second window
`T - 86400 < ts <= T`. All daily counters in a response MUST use that same
window. Totals accumulate recorded usage; deleting a message does not reverse
its report. Services MUST document retention, resets, and adjustments that
can change totals. Live storage accounting requires a documented
reconciliation policy.

For a proposed event of size `s`, the host MUST check every applicable limit
in the event's direction. A limit `L` permits a candidate `x` when
`L == -1` or `x <= L`:

| Limit | Candidate value |
|-------|-----------------|
| Per-message size | `s` |
| Total size | Total usage + `s` |
| Daily size | Daily usage + `s` |
| Daily count | Daily count + `1` |

A zero-byte event still increments the count. Lookup does not reserve quota;
hosts requiring strict limits MUST coordinate concurrent admission and
reporting. Cached lookups MUST have bounded lifetimes, with their staleness
accounted for in enforcement.

Hosts MUST follow the core specification's acceptance rules and order of
checks. Address-service results inform these per-recipient outcomes:

| Result | fmsg response code |
|--------|--------------------|
| Unknown address | `100` (user unknown), or `105` (user undisclosed). |
| Receive quota exceeded | `101` (user full), or `105`. |
| `acceptingNew: false` | `102` (user not accepting), or `105`. |
| Known, enabled, and within quota | Eligible for `200` (accept), subject to all other protocol checks. |

## Usage Reporting

`POST /fmsgid/send` and `POST /fmsgid/recv` accept the same JSON body; the route
selects the direction:

```json
{
  "address": "@alice@example.com",
  "ts": 1789084800.125,
  "size": 456
}
```

| Field | Type | Requirement |
|-------|------|-------------|
| `address` | string | REQUIRED; valid, registered fmsg identity. |
| `ts` | number | REQUIRED; finite Unix epoch seconds, with fractional seconds allowed. |
| `size` | integer | REQUIRED; non-negative accounted bytes. |

A report MUST be recorded before returning `200`. It adds bytes to that
identity's total for the selected direction, and bytes plus one event to
daily usage while `ts` is in the window. Reporting MUST NOT create an address,
change policy, or affect another identity or direction. Actual usage MUST NOT
be discarded merely because a limit was exceeded or the address was disabled.

Hosts and services MUST use a consistent byte-accounting policy for limits,
admission checks, and reports. The RECOMMENDED size is message data plus
attachments after decompression, excluding headers and transport overhead.
Alternative policies MUST be documented.

Receive events account for successful acceptance per recipient, excluding
failed or duplicate delivery attempts. A send event SHOULD account for one
logical outgoing message, rather than each remote domain or retry. Hosts MUST
define charging for add-to batches and local delivery, and avoid double
reporting between components.

Callers SHOULD timestamp events using a trusted host clock and preserve that
timestamp on delayed reports. Services SHOULD reject unreasonable future
timestamps. Failed reports SHOULD be retained for reconciliation.

Accounting POSTs have no standardized idempotency guarantee or event ID.
Callers MUST NOT blindly repeat a request after an ambiguous failure: it may
already have been recorded. Any deduplication or retry mechanism MUST be
separately documented; timestamps alone do not establish event identity.

## Optional Provisioning

`POST /fmsgid` creates an address with service-configured defaults:

```json
{
  "address": "@alice@example.com",
  "display_name": "Alice"
}
```

`address` is REQUIRED; `display_name` is OPTIONAL and defaults to empty.
Provisioning MUST be idempotent under case-folded identity: return `201` when
created, or `200` when already present. An existing identity's spelling,
display name, enabled status, quotas, and usage MUST remain unchanged.
Callers SHOULD look up the resulting defaults. This route MUST NOT accept
extra quota or status properties as authority to modify policy.

## Errors

Error bodies MAY be empty. Clients MUST use the HTTP status rather than
assume a particular error-body format.

| Status | Meaning |
|--------|---------|
| `400` | Invalid address, JSON, required field, or value. |
| `401` / `403` | Caller authentication or authorization failed. |
| `404` | Unknown address on lookup or reporting. |
| `409` | Conflicting report under a documented deduplication policy. |
| `413` / `429` | Request-size or API-rate limit exceeded. |
| `500` / `503` | Service failure or unavailability. |

Callers SHOULD use bounded timeouts. A timeout, malformed success payload,
or service error MUST NOT become an "unknown address" or successful
acceptance check. Services MUST NOT expose credentials or internal database
and connection details in error responses.
