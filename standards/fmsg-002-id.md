# FMSG-002 Id Standard

## Status

| Revision | Date       | Summary |
|----------|------------|---------|
| v0.1.0   | 2026-09-11 | Expanded draft: address lookup, quota and usage semantics, accounting, and optional provisioning; replaces the unversioned `/addr` sketch |

This standard defines the HTTP address and quota service used by an fmsg host
and its client API. It is independent of the identity provider used by a
deployment. The [implementation compatibility notes](#implementation-compatibility)
distinguish this contract from limitations in existing implementations.

## Requirements Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and
**OPTIONAL** in this document are to be interpreted as described in BCP 14
([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they
appear in all capitals.

## Scope and Roles

An **address service** answers whether an address is known, whether it accepts
new messages, its configured limits, and its recorded usage. It accepts
accounting reports from trusted host components. It MAY also provide the
address-provisioning operation defined here.

A **caller** is a host component authorized to use the service, such as a
host-to-host daemon, a [FMSG-003 Web API](fmsg-003-webapi.md), or a provisioning
process. A caller's authority MUST be restricted to the domains and operations
it is allowed to manage.

An **identity provider** authenticates users through a deployment's chosen
login mechanism. An address service does not perform that login, issue user
JWTs, or prove that a person owns an address. In FMSG-003, JWT validation and
selection of the effective fmsg address precede the address-service check;
a successful lookup MUST NOT substitute for authenticating the API caller.

This standard does not specify a database schema, a shared message store,
identity-provider synchronization, an administrative UI, or a public directory
of every address. CSV import and other provisioning integrations are
implementation choices. Hosts MAY use other mechanisms for address and quota
checks without implementing FMSG-002; the core fmsg protocol does not mandate
this HTTP service.

## References

- [fmsg Specification](../SPECIFICATION.md), especially [Address](../SPECIFICATION.md#address) and per-recipient acceptance rules.
- [FMSG-003 Web API Standard](fmsg-003-webapi.md), for authenticated client access and API-access grants.
- [RFC 8259: The JavaScript Object Notation (JSON) Data Interchange Format](https://www.rfc-editor.org/rfc/rfc8259).

## Transport and Trust Boundary

The service base URL is configured by the deployment. It MUST NOT be derived
from a user-supplied URL, an identity-provider brand, or the address being
looked up. FMSG-001's `fmsg.<domain>` discovery and TCP port 4930 apply to
host-to-host messaging, not to this service.

Routes use the `/fmsgid` base path. For a configured base URL of
`https://directory.example.com`, the lookup route is
`https://directory.example.com/fmsgid/{address}`.

Connections crossing an untrusted network MUST use HTTPS with server
certificate verification. Plain HTTP MAY be used on a protected local network
or behind a trusted TLS terminator. The service MUST restrict access to
trusted callers; network isolation, mutually authenticated TLS, a gateway, or
service credentials MAY provide that boundary. This revision does not specify
a common service-credential format or require forwarding an end user's JWT.

Provisioning and accounting writes MUST NOT be exposed to unauthenticated,
untrusted callers. Lookup also exposes address existence, activity and policy;
deployments SHOULD restrict it rather than make it publicly enumerable.
Addresses in URL paths can appear in access logs even with HTTPS. Operators
SHOULD restrict or redact those logs. This revision retains GET lookup and
does not define a request-body alternative.

## Common Conventions

### Addresses

Every `address` is a complete fmsg address such as `@alice@example.com`, not a
bare username or email address. Validation MUST follow the core
[Address](../SPECIFICATION.md#address) rules, including UTF-8 syntax and the
whole-address byte-length limit.

Identity comparison MUST use Unicode default case folding, as defined by the
core specification, consistently for lookup, provisioning, and accounting.
ASCII lowercasing alone is insufficient. For example, `@Alice@EXAMPLE.COM`
and `@alice@example.com` refer to one identity. A service MAY preserve the
registered spelling in the response's `address`; clients MUST compare it by
identity rather than byte-for-byte spelling.

A lookup caller MUST encode the address as one URL path segment. For example,
`GET /fmsgid/%40alice%40example.com` addresses the same identity as
`GET /fmsgid/@alice@example.com`. The decoded address is validated and folded;
URL escaping is not an identity-normalization operation.

### JSON and Numbers

JSON request and response bodies MUST use `application/json`. Field names are
case-sensitive. The lookup representation uses camelCase, while provisioning
uses `display_name` and accounting uses `ts`; these spellings are intentional.

Size and count fields are JSON integers. Limits MUST be either `-1` (unlimited)
or non-negative integers; usage MUST be non-negative. `0` is a real limit,
not an alias for unlimited. Clients MUST preserve integer precision and MUST
NOT interpret missing or malformed quota fields as unlimited. Implementations
MUST document any supported numeric bounds and reject unsupported request
values rather than wrap or truncate them.

Clients MUST ignore unrecognized response properties. Servers MAY accept
additional request properties, but clients MUST NOT rely on an extension's
behavior unless it is supported by their configured service. Required request
properties MUST be present with the documented type; an omitted value is not
the same as an explicit zero.

### Errors and Availability

An error MAY have an empty body. Clients MUST use the HTTP status, rather than
relying on an implementation-specific JSON error shape. Services MUST NOT
return database errors, credentials, or internal connection details to callers.

| Status | Meaning |
|--------|---------|
| `400 Bad Request` | Invalid address, malformed JSON, missing required property, or invalid field value. |
| `401 Unauthorized` / `403 Forbidden` | The deployment's access-control layer rejected the caller. These do not describe the target address's message-acceptance status. |
| `404 Not Found` | On lookup or accounting, the valid address is not registered. |
| `409 Conflict` | An accounting implementation detected a conflicting or duplicate report; see [Retries](#retries). |
| `413 Content Too Large` | The request exceeds the service's supported request size. |
| `429 Too Many Requests` | The caller exceeded an API rate limit; this is distinct from an address's message quota. |
| `500 Internal Server Error` / `503 Service Unavailable` | The operation could not be completed. |

A timeout, invalid success payload, access-control failure, or server error
MUST NOT be interpreted as "unknown address" or "accepting messages". Callers
SHOULD use bounded timeouts and explicit retry policies. A failed lookup must
remain a service failure rather than a fabricated recipient-policy result.

## Operations

| Method | Route | Purpose | Successful response |
|--------|-------|---------|---------------------|
| `GET` | `/fmsgid/{address}` | Lookup policy, metadata, and usage. | `200` with an address-detail object. |
| `POST` | `/fmsgid/send` | Record one send accounting event. | `200` with no required body. |
| `POST` | `/fmsgid/recv` | Record one receive accounting event. | `200` with no required body. |
| `POST` | `/fmsgid` | Optionally provision an address without modifying an existing identity. | `201` if created; `200` if already present. |

The first three operations form the core service. Provisioning is OPTIONAL;
a service that does not expose it MAY return `404` or `405` on that route.
There is no standardized list, update, delete, quota-reset, or usage-reversal
operation in this revision.

## Address Lookup

`GET /fmsgid/{address}` returns `200 OK` for a registered identity, including
one with `acceptingNew: false`, or `404` for a valid but unknown identity.
Lookup MUST NOT create an address or modify its usage.

The response MUST include `address`, `displayName`, `acceptingNew`, all eight
limit fields, and all six usage fields below. An address with no accounting
history has zero usage, not missing or null counters.

| Field | Type | Meaning |
|-------|------|---------|
| `address` | string | Registered spelling of the requested identity. |
| `displayName` | string | Human-readable label; an empty string means no label is set. It is not an identity key. |
| `acceptingNew` | boolean | Whether the address is enabled to accept new messages. `true` does not override quota checks. |
| `tags` | array of strings or null, optional | Deployment-defined metadata. Omitted, null, and an empty array all mean no tags. No authorization semantics are standardized. |

| Receive limit | Send limit | Meaning |
|---------------|------------|---------|
| `limitRecvSizeTotal` | `limitSendSizeTotal` | Maximum cumulative accounted bytes. |
| `limitRecvSizePerMsg` | `limitSendSizePerMsg` | Maximum accounted bytes for one chargeable message event. |
| `limitRecvSizePer1d` | `limitSendSizePer1d` | Maximum accounted bytes in the rolling one-day window. |
| `limitRecvCountPer1d` | `limitSendCountPer1d` | Maximum event count in that window. |

| Receive usage | Send usage | Meaning |
|---------------|------------|---------|
| `recvSizeTotal` | `sendSizeTotal` | Sum of recorded sizes for that direction over the retained accounting history. |
| `recvSizePer1d` | `sendSizePer1d` | Sum of recorded sizes for that direction in the one-day window. |
| `recvCountPer1d` | `sendCountPer1d` | Number of recorded events for that direction in the one-day window. |

Example:

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

`acceptingNew` is not a statement about credentials, domain ownership, or
retention of existing messages. FMSG-003 also uses this status when admitting
client requests; its authorization rules remain defined by FMSG-003.

### Accounting Windows and Storage

For a lookup evaluated at service time `T`, `Per1d` means the preceding
86,400 seconds, with `T - 86400 < ts <= T`. It is a rolling window, not a
calendar date or a reset at local midnight. All daily counters in a response
MUST use the same window. A report at the lower boundary is excluded; a
future-dated report MUST NOT enter daily usage before its timestamp.

Total usage is cumulative accounting, not a measurement of files currently
on disk. Deleting a message through FMSG-003 does not itself reverse an
accounting report. Services MUST document retention, resets, or other
administrative adjustments that can change totals; they MUST NOT silently
present a truncated history as lifetime usage. Deployments needing live
storage quotas must define how storage changes are reconciled with their
accounting policy.

### Evaluating Limits

For a proposed event of size `s`, a host using this service MUST check the
applicable direction's limits. A limit `L` permits a candidate value `x` iff
`L == -1` or `x <= L`.

| Dimension | Candidate value |
|-----------|-----------------|
| Per-message size | `s` |
| Total size | reported total size + `s` |
| Daily size | reported daily size + `s` |
| Daily count | reported daily count + `1` |

Equality with a limit is allowed; exceeding any finite limit fails the quota
check. Unlimited on one dimension does not disable the others. A zero-byte
event still adds one to the count. Callers MUST avoid overflow when comparing
usage with limits.

Lookup is a snapshot, not an atomic quota reservation. Concurrent callers,
cached responses, or delayed accounting can admit more work than a later
snapshot permits. Hosts needing strict enforcement MUST coordinate admission
and reporting, or provide a separately agreed reservation mechanism. No such
mechanism is defined here. Callers MAY cache lookups for a bounded,
deployment-defined interval, but MUST account for the resulting delay in
status and quota changes; cached data is not a reservation.

### Host-to-Host Results

When deciding a recipient's disposition, a host MUST follow the core
specification's order of checks and response-code rules. Relevant outcomes
include:

| Address-service result | Recipient outcome |
|------------------------|-------------------|
| Unknown address (`404`) | `100` (user unknown), or `105` (user undisclosed). |
| A finite receive quota would be exceeded | `101` (user full), or `105`. |
| Known address with `acceptingNew: false` | `102` (user not accepting), or `105`. |
| Known, enabled address within quota | Eligible for `200` (accept), subject to every other protocol check. |

HTTP statuses and fmsg response bytes are different namespaces. Service
failure is not evidence for any of the recipient-policy rejections above.
This standard does not bypass duplicate, participant, terminal-message,
message-validation, or transport checks in the core specification.

## Usage Reporting

`POST /fmsgid/send` and `POST /fmsgid/recv` use the same request shape. The
route selects the direction; there is no `type` request field.

```json
{
  "address": "@alice@example.com",
  "ts": 1789084800.125,
  "size": 456
}
```

| Field | Type | Requirement |
|-------|------|-------------|
| `address` | string | REQUIRED; a valid, registered fmsg identity, compared using the same case folding as lookup. |
| `ts` | number | REQUIRED; finite Unix epoch seconds in UTC, with fractional seconds allowed. This is not milliseconds or an RFC 3339 string. |
| `size` | integer | REQUIRED; non-negative accounted bytes, under the deployment's documented size policy. |

A successful report MUST be recorded before the service responds `200`.
It contributes its size to that identity's direction-specific total, and its
size and one event to daily usage while its timestamp is in the window.
Reports MUST NOT change the other direction's usage or another identity's
usage. Recording usage MUST NOT implicitly provision an unknown identity.

Accounting records actual chargeable activity. A report MUST NOT be silently
discarded merely because it makes a quota exceed its limit or the address has
since been disabled. Admission checks happen before the activity; reporting
is not a request to reserve permission to send or receive.

### What to Report

The host and address service MUST agree on a byte-accounting policy, and use
it consistently for limits, admission checks, and reports. Following the core
specification's quota guidance, the RECOMMENDED size is the sum of message
data and attachment data after decompression, excluding message headers and
transport overhead. Alternative policies MUST be documented; compressed
wire bytes MUST NOT be compared against limits defined in expanded bytes.

A receive event represents successful acceptance for one recipient identity;
a failed attempt or duplicate delivery is not a new receive event. A send
event SHOULD represent acceptance of one logical outgoing message by the
sender's host, rather than one event per remote domain or retry. Hosts MUST
define how add-to batches and other chargeable operations fit their policy,
including local-only delivery, and avoid double reporting when multiple
components share the message store. A notification that adds no new storage
for a recipient does not by itself imply a full-message storage charge.

Callers SHOULD timestamp the chargeable operation using a trusted host clock,
not the later HTTP retry time or an untrusted timestamp supplied by a client.
A delayed report retains the original event timestamp. Services SHOULD bound
acceptable timestamp skew and reject unreasonable future timestamps. Reporting
failures SHOULD be retained for reconciliation rather than silently lost.

### Retries

This revision defines no event identifier, idempotency key, deduplication
algorithm, or exactly-once guarantee for accounting. Two reports can share an
address, timestamp, and size without proving that they are the same event.

Callers MUST NOT assume that repeating a POST after a timeout is safe: the
first request may have been committed even if its response was lost. Services
MAY provide separately documented deduplication or idempotency extensions.
If a service rejects a recognized duplicate or conflicting report with `409`,
the caller MUST resolve it according to that service's documented policy;
`409` alone does not prove the intended event was successfully accounted for.

## Optional Address Provisioning

`POST /fmsgid` provisions an address with service-configured defaults:

```json
{
  "address": "@alice@example.com",
  "display_name": "Alice"
}
```

`address` is REQUIRED. `display_name` is OPTIONAL and defaults to an empty
string. The operation MUST be idempotent under the address's case-folded
identity:

- If the identity is absent, create it and return `201 Created`.
- If the identity already exists, return `200 OK` without changing its
  spelling, display name, enabled status, quotas, or usage.
- Invalid input returns `400`; callers lacking provisioning authority are
  rejected by the deployment's access-control layer.

No response body is required. Callers SHOULD perform a lookup after creation
to obtain the effective defaults, rather than assume specific quotas or an
enabled status. This route MUST NOT treat unrecognized quota or status
properties as authority to change policy.

Provisioning is not proof of ownership and MUST NOT be offered as unrestricted
self-service registration. A component provisioning a derived address for a
FMSG-003 API-access grant must first establish its authority to do so. Policy
updates, disabling, deletion, and synchronization with an identity provider
are outside this route and this revision.

## Implementation Compatibility

This section is non-normative. The public
[fmsgid implementation](https://github.com/markmnl/fmsgid) and its host callers
informed the paths and field names in this draft; listing an implementation
is not a claim of full conformance.

The old unversioned sketch used `/addr/{address}`, `/addr/recv`, `/addr/sent`,
`timestamp`, `recvSizePerPer1d`, and an undefined `name` response property.
Those are not aliases defined by this revision. The implemented names are
`/fmsgid/{address}`, `/fmsgid/recv`, `/fmsgid/send`, `ts`, and
`recvSizePer1d`; no separate `name` property is required. Null `tags` from
existing implementations remains acceptable.

The following gaps were identified in the public implementations during the
2026-09-11 review and require implementation work, not alternative meanings
for the fields above:

- In fmsgid revision `5a74176`, the order of aggregate columns in
  [`sqlActuals`](https://github.com/markmnl/fmsgid/blob/5a74176/src/sql.go)
  differs from the order of destinations in
  [`getAddressDetail`](https://github.com/markmnl/fmsgid/blob/5a74176/src/fmsgid.go).
  Consequently several send/receive size and count values are assigned to
  the wrong response fields. Daily aggregation also lacks the upper time
  boundary specified here.
- In that revision, accounting writes do not apply the lookup/provisioning
  case folding or validate all required fields. Address validation on the
  other routes is also weaker than the core address grammar. Unknown
  identities and duplicate timestamps can surface as database `500` errors.
  The database key `(address_lower, ts)` is an implementation constraint,
  not a standard event identifier or idempotency guarantee.
- The [daemon at revision `13d6fc8`](https://github.com/markmnl/fmsgd/blob/13d6fc8/cmd/fmsgd/host.go)
  charges message data size only for receive accounting;
  per-message limits, expanded attachment accounting, and send reporting
  need alignment with the chosen policy. The
  [Web API's local delivery path at revision `1a0cff1`](https://github.com/markmnl/fmsg-webapi/blob/1a0cff1/internal/handlers/messages.go)
  checks existence and enabled status but does not implement
  the complete quota and accounting flow. Service lookup alone therefore
  does not establish end-to-end quota enforcement.

## Conformance Checks

Implementations should exercise at least these cases when claiming support
for this revision:

1. Valid, malformed, and unknown addresses; mixed-case and non-ASCII
   case-fold-equivalent identities across all supported operations.
2. A known disabled address returns a complete `200` lookup with
   `acceptingNew: false`, not `404`.
3. A newly provisioned address has zero usage. Re-provisioning it, including
   with different casing or display metadata, preserves its existing state.
4. Every limit and usage field has the documented type and direction. Test
   with asymmetric sizes and counts so a swapped aggregate cannot pass.
5. For a lookup at `T`, reports of send 100 bytes at `T - 90000`, send 200
   bytes at `T - 3600`, and receive 300 bytes at `T - 60` produce the six
   usage values shown in the lookup example. Also test the exact lower
   boundary and future timestamps.
6. `-1`, `0`, exact-limit admission, one-over-limit rejection, and independent
   count and size limits, including a zero-byte event.
7. Missing, null, negative, fractional-size, malformed, and out-of-range
   accounting inputs are rejected without modifying usage.
8. Send and receive reports affect only the correct address and direction;
   reporting never creates an address or overwrites policy.
9. Duplicate/conflicting reports, lost responses, and reconciliation follow
   the documented retry policy without assuming timestamps are unique IDs.
10. Unavailable or malformed lookup responses cannot become a successful
    identity or quota check. Unauthorized callers cannot provision addresses
    or forge accounting, and caches respect their documented bounds.
