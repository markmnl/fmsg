# FMSG-003 Web API Standard

## Status

| Revision | Date       | Summary       |
|----------|------------|---------------|
| v0.1.0   | 2026-08-07 | Initial draft |

This standard defines an authenticated HTTP and WebSocket API through which one
fmsg identity creates, sends, receives, and manages messages on an fmsg host. It
also defines optional API-access grants and Web Push subscriptions.

## Requirements Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and
**OPTIONAL** in this document are to be interpreted as described in BCP 14
([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they
appear in all capitals.

## Scope

The fmsg host-to-host protocol does not define a client API. This standard
provides that client API without exposing the host's database or filesystem.
It defines:

- bearer-token authentication and identity scoping;
- optional API keys and API-access grants;
- draft, message, recipient, attachment, and read-state operations;
- delivery-status reporting;
- plain-text thread rendering;
- live event delivery over WebSocket; and
- optional Web Push subscription management.

This standard does not define identity-provider login, user registration,
database schemas, host-to-host message transport, or a user interface.

## Normative References

- [fmsg Specification](../SPECIFICATION.md)
- [FMSG-002 Id Standard](fmsg-002-id.md)
- [RFC 6455: The WebSocket Protocol](https://www.rfc-editor.org/rfc/rfc6455)
- [RFC 7517: JSON Web Key](https://www.rfc-editor.org/rfc/rfc7517)
- [RFC 7519: JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)
- [RFC 8037: CFRG Elliptic Curve JOSE](https://www.rfc-editor.org/rfc/rfc8037)
- [RFC 8030: Generic Event Delivery Using HTTP Push](https://www.rfc-editor.org/rfc/rfc8030)
- [RFC 8292: VAPID for Web Push](https://www.rfc-editor.org/rfc/rfc8292)

## Terminology

**authenticated identity** is the single fmsg address in whose scope a request
is processed.

**owner identity** is the fmsg address authenticated directly through the
configured identity provider. It may own API-access grants.

**API-access grant** authorizes a programmatic client to act as one fmsg
address. It is identified by an `agent` name and is either a derived
sub-account or a delegated identity.

**derived sub-account** is an address derived from an owner and agent name in
the form `@owner_agent@domain`.

**delegated identity** is an independently named address that an operator has
authorized an owner to manage.

**participant** is the message sender, a primary recipient in `to`, or a
recipient in an `add_to` batch, except where a route explicitly narrows this
definition.

**draft** is a locally stored message whose `time` is `null`. A sent or
received message has a non-null `time` and is immutable through this API.

## Transport and Base Path

All HTTP routes defined here use the `/fmsg` base path. Production deployments
MUST expose the API through HTTPS, either directly or through a trusted reverse
proxy. Plain HTTP MAY be used on a protected local network behind a TLS
terminator or for development.

Requests and responses containing JSON MUST use `application/json`. Successful
download and thread routes use the media types specified by those routes.
Servers SHOULD accept `application/json` with an optional UTF-8 charset
parameter.

Servers MAY apply deployment-specific size limits, rate limits, CORS policies,
connection limits, and timeouts. A server MUST apply those policies consistently
within one authenticated identity and MUST return an appropriate HTTP error.

## Common Conventions

### Identity Scope

Every protected request operates as exactly one authenticated identity. An
owner does not implicitly see or modify the messages of its grants. To operate
as a grant, the owner MUST explicitly use the act-as mechanism, or the grant
MUST authenticate with its own first-party token.

Address comparison MUST follow the case-insensitive comparison rules in the
fmsg specification. Responses SHOULD preserve the stored spelling of an
address.

### Identifiers

Message IDs, parent IDs, and add-to batch IDs are positive signed 64-bit
integers local to one API deployment. A `pid` in this API is a message ID, not
the SHA-256 parent hash used on the fmsg wire. The host maps between them when
encoding or decoding fmsg messages.

An `:id` path parameter MUST be a positive base-10 integer. An invalid value
MUST produce `400 Bad Request`.

### Time Values

The fields `time`, `time_read`, and add-to batch `time` are JSON numbers
containing POSIX seconds since the Unix epoch, with a fractional component when
available. Draft message `time` and unread `time_read` values are `null`.

Delivery `time_delivered` and grant `key_expires_at` values are RFC 3339 UTC
strings. Absent delivery times are `null`.

### Errors

Unless a successful route returns non-JSON content or no content, errors MUST
be JSON objects of this form:

```json
{ "error": "human-readable description" }
```

The description is not a stable machine-readable code. Clients MUST primarily
interpret the HTTP status. Common statuses are:

| Status | Meaning |
|--------|---------|
| `400 Bad Request` | Invalid path, query, JSON, address, or field relationship |
| `401 Unauthorized` | Missing, malformed, expired, revoked, or invalid authentication |
| `403 Forbidden` | Authenticated identity lacks permission or its source IP is denied |
| `404 Not Found` | Resource is absent or intentionally undisclosed |
| `409 Conflict` | Resource state prevents the requested transition |
| `413 Content Too Large` | Body, attachment, or complete message exceeds a configured limit |
| `500 Internal Server Error` | Unexpected processing failure |
| `503 Service Unavailable` | A required address/status service is unavailable |

Servers SHOULD avoid distinguishing a resource that does not exist from one
that an unauthorised caller must not discover.

## Authentication

Except for `POST /fmsg/token`, every HTTP route in this standard requires:

```http
Authorization: Bearer <JWT>
```

The WebSocket route also permits its documented query parameters. A server
MUST support at least one of the two JWT profiles below and MAY support both.
After JWT verification, the server MUST verify through the address/status
service defined by FMSG-002 that the effective address exists and is currently
authorized to use the API. A temporary failure of that service MUST fail
closed.

### Identity-Provider JWT Profile

An external identity provider issues a JWT whose configured claim contains the
owner's fmsg address. The public API remains provider-neutral: issuer, audience,
JWKS URL, and address-claim name are deployment configuration.

The server MUST verify:

- an Ed25519 signature using JOSE algorithm `EdDSA` and a key selected from the
  configured JWKS;
- the configured issuer in `iss`;
- `exp`, and `iat` and `nbf` when present;
- the configured audience in `aud` when the deployment requires one; and
- a valid fmsg address in the configured address claim.

The JWT header MUST contain a usable `kid` when the JWKS has multiple or
rotating keys. Servers MAY allow a small documented clock-skew tolerance.
Whether a deployment accepts an ID token or access token is an identity-provider
policy outside this standard.

### First-Party API JWT Profile

When API-access grants are enabled, `POST /fmsg/token` exchanges an opaque API
key for a short-lived JWT signed by the API with Ed25519/`EdDSA`. The JWT MUST
contain:

| Claim | Meaning |
|-------|---------|
| `sub` | Granted fmsg address and effective authenticated identity |
| `owner` | Owner fmsg address |
| `api_key_id` | Identifier of the backing API key |
| `iss` | Configured first-party issuer |
| `aud` | Configured first-party audience |
| `iat` | Issue time |
| `exp` | Expiry time |

For every protected request, the server MUST revalidate that the backing grant
exists, its key is current and unexpired, and the source address is allowed by
the grant's CIDR policy. Deleting or rotating a grant therefore invalidates an
old JWT before its `exp` when its key identifier is no longer current.

### Act-As

An identity-provider-authenticated owner MAY request one of its grants as the
effective identity with:

```http
X-FMSG-Act-As: @owner_agent@example.com
```

The server MUST verify that the address is covered by an API-access grant owned
by the JWT identity and that the granted address exists and remains authorized.
Act-as MUST NOT be accepted with a first-party API JWT.

Only the effective identity is visible to message and subscription routes.
Grant-management routes always require direct identity-provider authentication
as the owner and MUST reject first-party tokens and act-as identities.

## Route Summary

Core routes are always present. Grant and Web Push routes are conditional.

| Method | Path | Requirement | Description |
|--------|------|-------------|-------------|
| `GET` | `/fmsg` | Core | List received messages |
| `GET` | `/fmsg/sent` | Core | List authored messages and drafts |
| `POST` | `/fmsg` | Core | Create a draft |
| `GET` | `/fmsg/:id` | Core | Retrieve message metadata |
| `PUT` | `/fmsg/:id` | Core | Replace a draft |
| `DELETE` | `/fmsg/:id` | Core | Delete a draft |
| `POST` | `/fmsg/:id/send` | Core | Send a draft |
| `POST` | `/fmsg/:id/read` | Core | Mark a received message read |
| `POST` | `/fmsg/:id/add-to` | Core | Add recipients |
| `GET` | `/fmsg/:id/data` | Core | Download message data |
| `GET` | `/fmsg/:id/thread` | Core | Render direct ancestor lineage |
| `POST` | `/fmsg/:id/attach` | Core | Upload an attachment |
| `GET` | `/fmsg/:id/attach/:filename` | Core | Download an attachment |
| `DELETE` | `/fmsg/:id/attach/:filename` | Core | Delete an attachment |
| `GET` | `/fmsg/ws` | Core | Receive live events over WebSocket |
| `POST` | `/fmsg/token` | Grants | Exchange an API key for a JWT |
| `GET` | `/fmsg/sub-accounts` | Grants | List owned API-access grants |
| `POST` | `/fmsg/sub-accounts` | Grants | Create a derived sub-account grant |
| `GET` | `/fmsg/sub-accounts/:agent` | Grants | Retrieve one grant |
| `PATCH` | `/fmsg/sub-accounts/:agent` | Grants | Replace a grant's allowed CIDRs |
| `POST` | `/fmsg/sub-accounts/:agent/rotate-key` | Grants | Rotate a grant API key |
| `DELETE` | `/fmsg/sub-accounts/:agent` | Grants | Delete a grant |
| `POST` | `/fmsg/push/subscribe` | Web Push | Create or refresh a subscription |
| `DELETE` | `/fmsg/push/subscribe` | Web Push | Delete a subscription |

## Message Representation

A message metadata object has this shape:

```json
{
  "version": 1,
  "has_pid": false,
  "has_add_to": true,
  "important": false,
  "no_reply": false,
  "deflate": false,
  "pid": null,
  "from": "@alice@example.com",
  "to": ["@bob@example.com"],
  "to_delivery": [
    {
      "addr": "@bob@example.com",
      "time_delivered": "2026-08-07T01:02:03Z",
      "response_code": null
    }
  ],
  "add_to": [
    {
      "batch_id": 42,
      "add_to_from": "@bob@example.com",
      "to": ["@carol@example.com"],
      "to_delivery": [
        {
          "addr": "@carol@example.com",
          "time_delivered": null,
          "response_code": 100
        }
      ],
      "time": 1786064523.123456
    }
  ],
  "time": 1786064400.654321,
  "topic": "Hello",
  "type": "text/plain;charset=UTF-8",
  "size": 11,
  "short_text": "hello world",
  "read": false,
  "time_read": null,
  "attachments": [
    { "filename": "notes.pdf", "size": 12345 }
  ]
}
```

The fields are:

| Field | Type | Meaning |
|-------|------|---------|
| `version` | integer | fmsg protocol version |
| `has_pid` | Boolean | Whether `pid` is non-null |
| `has_add_to` | Boolean | Whether `add_to` contains at least one batch |
| `important` | Boolean | Sender importance indication |
| `no_reply` | Boolean | Sender indicates replies will be discarded |
| `deflate` | Boolean | Stored data was detected as compressed content for fmsg wire handling |
| `pid` | integer or null | Parent message ID in this API deployment |
| `from` | string | Sender fmsg address |
| `to` | string array | Primary recipients |
| `to_delivery` | object array | Delivery state corresponding to `to` |
| `add_to` | object array | Recipient-addition batches |
| `time` | number or null | Sent/received POSIX time; null for a draft |
| `topic` | string | Root topic; empty on replies |
| `type` | string | Complete body media type |
| `size` | integer | Stored body size in bytes |
| `short_text` | string, omitted | Optional UTF-8 preview for a `text/*` body |
| `read` | Boolean | Effective recipient's read state |
| `time_read` | number or null | Effective recipient's first-read time |
| `attachments` | object array | Attachment names and sizes; never their contents |

List and WebSocket message objects additionally contain an integer `id`. A
single `GET /fmsg/:id` response does not contain `id`.

`short_text` MAY be omitted. When enabled, it MUST appear only for a body whose
media type is `text/*` and whose preview is valid UTF-8. It MUST be truncated
only at a UTF-8 code-point boundary. Clients MUST use the data-download route
when they require the complete body.

### Delivery Objects

Each primary or added recipient has one delivery object:

```json
{
  "addr": "@bob@example.com",
  "time_delivered": null,
  "response_code": 101
}
```

`time_delivered` is non-null after confirmed remote delivery or successful
local storage. `response_code` is the fmsg per-recipient response code after a
failed attempt. While pending, both are null. Once delivered,
`response_code` MUST be null.

### Add-To Batches

Each successful add-to call creates one stable batch containing its actor,
time, added addresses, and per-address delivery states. The `add_to_from`
identity and batch time are server-generated. Batches MUST NOT be merged merely
because their actor or recipients are equal.

## Message Routes

### `GET /fmsg`

Returns messages for which the authenticated identity is a primary or added
recipient, ordered by message ID descending.

Query parameters:

| Name | Default | Rules |
|------|---------|-------|
| `limit` | `20` | Positive integer; values over 100 are limited to 100 |
| `offset` | `0` | Non-negative integer |

The response is a JSON array of message objects with `id`. An empty result MUST
be `[]`, not `null`. Body and attachment contents are excluded.

Read fields represent only the effective authenticated identity.

### `GET /fmsg/sent`

Returns messages whose `from` equals the authenticated identity, ordered by ID
descending. Both drafts and sent messages are included. It uses the same
pagination and response shape as `GET /fmsg`.

### `POST /fmsg`

Creates a draft. The request is JSON:

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `version` | integer | yes | Currently `1` |
| `from` | string | yes | MUST equal the authenticated identity |
| `to` | string array | yes | At least one valid fmsg address |
| `pid` | integer | no | Existing parent message ID |
| `topic` | string | no | Root topic; MUST be empty when `pid` is present |
| `type` | string | yes | Complete body media type |
| `size` | integer | yes | Client's body byte count; server-computed value is authoritative |
| `important` | Boolean | no | Defaults to false |
| `no_reply` | Boolean | no | Defaults to false |
| `data` | string | no | UTF-8 message body; defaults to empty |

Recipients can be added only through the add-to route. A supplied `add_to`
property MUST NOT add recipients.

The server MUST derive the stored `size` from the UTF-8 bytes of `data`, rather
than trust the request's `size`. The body and total message size MUST remain
within deployment limits.

Success is `201 Created`:

```json
{ "id": 123 }
```

### `GET /fmsg/:id`

Returns the message metadata object. The authenticated identity MUST be a
participant. Success is `200 OK`.

### `PUT /fmsg/:id`

Replaces a draft's editable message fields and primary recipients. The
authenticated identity MUST equal its `from`, and `from` in the replacement
body MUST remain that identity. The body has the same shape and validation as
`POST /fmsg`.

Existing attachments remain and count toward the total-size limit. Added
recipient batches are not replaced through this route. A sent message MUST be
rejected with `403 Forbidden`.

Success is:

```json
{ "id": 123 }
```

### `DELETE /fmsg/:id`

Deletes a draft, its primary recipients, add-to state, attachment metadata, and
stored files. Only its sender may delete it. Sent messages are immutable and
MUST be rejected with `403 Forbidden`.

Success is `204 No Content`.

### `POST /fmsg/:id/send`

Transitions a draft to sent by assigning the server's current POSIX time. Only
the sender may send it. A second send MUST return `409 Conflict`.

Before sending a reply, the server MUST reject with `409 Conflict` when a
remote recipient domain cannot accept it because the domain was never a
recipient of the parent or all concluded parent deliveries to that domain
failed. A parent delivery still pending does not make the reply invalid. The
error SHOULD tell the caller to add the recipients to the parent or start a new
thread.

Success is:

```json
{ "id": 123, "time": 1786064400.654321 }
```

HTTP success means the API accepted the message for local or federated
delivery. It does not mean every remote recipient has accepted it. Clients use
delivery objects and WebSocket events to observe later outcomes.

### `POST /fmsg/:id/read`

Marks the message read for the authenticated recipient. The sender cannot mark
its own sent copy read unless it is independently a recipient. The operation is
idempotent: a repeated call MUST return the original first-read time.

If the identity is not a primary or added recipient, the server MUST return
`404 Not Found`.

Success is:

```json
{ "id": 123, "time_read": 1786064450.123456 }
```

### `POST /fmsg/:id/add-to`

Adds recipients as one new batch. The authenticated identity MUST be either the
sender or a primary recipient in `to`. Being only an earlier add-to recipient
does not authorize this route.

Request:

```json
{ "add_to": ["@carol@example.com", "@dave@example.com"] }
```

The array MUST be non-empty, contain valid addresses, and contain no
case-insensitive duplicates. An address already present in an earlier add-to
batch MUST be rejected. An original primary recipient MAY be added again, as
permitted by the fmsg protocol's re-delivery semantics.

The server MUST atomically create the batch, its recipient rows, and any
participant-domain notifications required by the fmsg protocol.

Success is:

```json
{ "id": 123, "added": 2 }
```

## Content Routes

### `GET /fmsg/:id/data`

Downloads the complete stored body. The authenticated identity MUST be a
participant. Success is the raw bytes with `Content-Disposition: attachment`
and a suitable `Content-Type`. Missing stored data returns `404 Not Found`.

### `GET /fmsg/:id/thread`

Returns the requested message's direct `pid` ancestor lineage followed by the
message itself, root first, as `text/plain; charset=utf-8`. The authenticated
identity MUST be a participant of the requested message.

Each entry begins:

```text
--- <from-address> <RFC3339-UTC-time-or-draft> ---
```

The entry then contains:

- its body for `text/*` and `application/json` content visible to the caller;
- `[message not visible to you]` when the caller is not a participant of that
  ancestor; or
- `[non-text message: <type>, <size> bytes]` for other media types.

Entries are separated by one blank line and the response ends with a newline.
The server MUST NOT reveal an invisible ancestor's body. Servers MUST bound the
ancestor walk; this revision RECOMMENDS a maximum of 100 hops.

## Attachment Routes

Attachment filenames are UTF-8 values subject to the fmsg specification. A
server MUST remove or reject path components and MUST prevent filesystem path
traversal. Attachment content counts toward per-attachment and total-message
size limits.

### `POST /fmsg/:id/attach`

Uploads one attachment to a draft owned by the authenticated identity. The
request MUST be `multipart/form-data` with one file field named `file`.

Success is `201 Created`:

```json
{ "filename": "notes.pdf", "size": 12345 }
```

The returned filename is the logical attachment name clients use in later
routes. A sent message or non-owner request returns `403 Forbidden`; an
oversized attachment or total message returns `413 Content Too Large`.

### `GET /fmsg/:id/attach/:filename`

Downloads one attachment for a participant. `:filename` MUST be URL-encoded as
one path segment. Success returns the raw file with
`Content-Disposition: attachment`. Invalid filenames return `400 Bad Request`;
missing messages or attachments return `404 Not Found`.

### `DELETE /fmsg/:id/attach/:filename`

Deletes an attachment from a draft owned by the authenticated identity. Success
is `204 No Content`. Attachments of sent messages are immutable.

## API-Access Grant Routes

All routes in this section are OPTIONAL as a group. Except for token exchange,
they require direct identity-provider authentication as the owner.

An `agent` path or request value MUST be 1 through 64 UTF-8 bytes, contain only
Unicode letters, Unicode digits, dots, or hyphens, and contain neither `_` nor
`@`. An `allowed_cidrs` array MUST contain at least one valid IPv4 or IPv6 CIDR.
`key_expires_at` MUST be a future RFC 3339 timestamp.

### `POST /fmsg/token`

Exchanges an opaque API key for a first-party JWT. The API key is sent only in:

```http
Authorization: Bearer fmsgk_<key-id>_<secret>
```

The server MUST verify the stored key hash in constant time, its expiry, source
CIDR policy, grant, and granted address status. It MUST NOT store plaintext API
keys.

Success is `200 OK`:

```json
{
  "access_token": "eyJ...",
  "token_type": "Bearer",
  "expires_in": 43200,
  "expires_at": "2026-12-31T12:00:00Z"
}
```

`expires_in` is seconds from issuance. A denied source CIDR returns
`403 Forbidden`; malformed, invalid, or expired keys return `401 Unauthorized`.

### Grant Object

```json
{
  "agent": "bot",
  "addr": "@alice_bot@example.com",
  "grant_type": "derived_sub_account",
  "key_id": "abc",
  "allowed_cidrs": ["203.0.113.0/24"],
  "key_expires_at": "2026-12-31T00:00:00Z"
}
```

`grant_type` MUST be `derived_sub_account` or `delegated_identity`.
`display_name` and `key_id` MAY be omitted when empty. An `api_key` property is
returned only when a new key is created or rotated and MUST NOT appear in list
or get responses.

### `GET /fmsg/sub-accounts`

Lists the owner's grants:

```json
{
  "max_sub_accounts": 5,
  "sub_accounts": [
    {
      "agent": "bot",
      "addr": "@alice_bot@example.com",
      "grant_type": "derived_sub_account",
      "key_id": "abc",
      "allowed_cidrs": ["203.0.113.0/24"],
      "key_expires_at": "2026-12-31T00:00:00Z"
    }
  ]
}
```

### `POST /fmsg/sub-accounts`

Creates a derived sub-account and returns its plaintext API key once:

```json
{
  "agent": "bot",
  "allowed_cidrs": ["203.0.113.0/24"],
  "key_expires_at": "2026-12-31T00:00:00Z"
}
```

The derived address is formed by appending `_` and `agent` to the owner's local
part. For example, owner `@alice@example.com` and agent `bot` produce
`@alice_bot@example.com`. The server MUST register the derived address with the
configured address service when it does not exist, without overwriting an
existing address.

Success is `201 Created` and a grant object with a one-time `api_key`:

```json
{
  "agent": "bot",
  "addr": "@alice_bot@example.com",
  "grant_type": "derived_sub_account",
  "key_id": "abc",
  "allowed_cidrs": ["203.0.113.0/24"],
  "key_expires_at": "2026-12-31T00:00:00Z",
  "api_key": "fmsgk_abc_secret"
}
```

Delegated identities MUST NOT be created through this self-service route. Their
provisioning and proof of owner authority are operator concerns outside this
HTTP standard.

### `GET /fmsg/sub-accounts/:agent`

Returns the owner's grant with the standard grant-object shape. A missing grant
returns `404 Not Found`.

### `PATCH /fmsg/sub-accounts/:agent`

Replaces, rather than merges, the grant's source CIDRs without rotating its key:

```json
{ "allowed_cidrs": ["203.0.113.0/24", "2001:db8::/32"] }
```

Success returns the updated grant object.

### `POST /fmsg/sub-accounts/:agent/rotate-key`

Invalidates the previous API key and creates a replacement. Request:

```json
{ "key_expires_at": "2027-03-31T00:00:00Z" }
```

Success returns `agent`, `addr`, `grant_type`, the new `key_id`, expiry, and the
new plaintext `api_key` once. It does not change `allowed_cidrs`.

### `DELETE /fmsg/sub-accounts/:agent`

Deletes the grant and revokes future key exchange. Existing first-party JWTs
backed by that grant MUST fail their next protected request. Success is
`204 No Content`.

## WebSocket Events

### Connection

`GET /fmsg/ws` performs an RFC 6455 upgrade. Non-browser clients SHOULD
authenticate with the normal `Authorization` header. Browser clients MAY use:

```text
wss://api.example.com/fmsg/ws?access_token=<JWT>
```

An identity-provider-authenticated browser owner MAY request act-as through the
`act_as` query parameter. If both `X-FMSG-Act-As` and `act_as` are present, the
header takes precedence. Query credentials can appear in logs and browser
history; deployments and clients MUST take reasonable measures to prevent
their disclosure and SHOULD prefer headers wherever possible.

Authentication and act-as validation happen before upgrade. Failure returns an
ordinary HTTP JSON error. A server MUST validate browser origins according to
its configured policy.

### Frames and Events

The server sends JSON text frames:

```json
{
  "type": "new_msg",
  "data": {
    "id": 123,
    "version": 1,
    "has_pid": false,
    "has_add_to": false,
    "important": false,
    "no_reply": false,
    "deflate": false,
    "pid": null,
    "from": "@alice@example.com",
    "to": ["@bob@example.com"],
    "to_delivery": [
      {
        "addr": "@bob@example.com",
        "time_delivered": "2026-08-07T01:02:03Z",
        "response_code": null
      }
    ],
    "add_to": [],
    "time": 1786064400.654321,
    "topic": "Hello",
    "type": "text/plain",
    "size": 11,
    "short_text": "hello world",
    "read": false,
    "time_read": null,
    "attachments": []
  }
}
```

`data` has the same identity-scoped shape as an item from the applicable
message list.

| Event `type` | Recipient of event | Meaning |
|--------------|--------------------|---------|
| `new_msg` | Message recipient | A sent or federated message became available |
| `delivered` | Message sender | Delivery state changed; `data` is the refreshed message |
| `recipients_added` | Message participant | An add-to batch was recorded; `data` is the refreshed message |

Clients MUST ignore unknown event types. The server SHOULD send WebSocket ping
frames and disconnect clients that do not respond or cannot consume events
within bounded resources. Client application frames have no meaning in this
revision; clients need send only WebSocket control responses.

The event stream is a live notification channel, not a durable log. It has no
cursor, acknowledgement, or replay operation. After connecting or reconnecting,
a client MUST use the list and get routes to synchronize authoritative state.

## Web Push

The Web Push routes and notifications in this section are OPTIONAL as a group.
They require VAPID-configured Web Push support.

### `POST /fmsg/push/subscribe`

Creates or refreshes a subscription scoped to `(authenticated identity,
endpoint)`. Request is compatible with a browser `PushSubscription.toJSON()`
value. `expirationTime` MAY be present and is ignored by this revision.

```json
{
  "endpoint": "https://push.example.net/send/abc",
  "expirationTime": null,
  "keys": {
    "p256dh": "BPx...",
    "auth": "k9..."
  }
}
```

`endpoint`, `keys.p256dh`, and `keys.auth` are REQUIRED. Reposting the same
endpoint MUST replace its keys. Success is `201 Created` with an empty body.

### `DELETE /fmsg/push/subscribe`

```json
{ "endpoint": "https://push.example.net/send/abc" }
```

Deletion is idempotent and scoped to the authenticated identity. Success is
`204 No Content`, including for an unknown endpoint.

### Push Payload

When `new_msg` occurs, the server MAY send an encrypted Web Push independently
of whether a WebSocket client is connected:

```json
{
  "title": "@sender@example.com",
  "body": "message preview text",
  "threadId": 42,
  "url": "/messages?thread=42",
  "tag": "thread-42",
  "icon": "/icon-192.png"
}
```

`threadId` MUST identify the root message of the thread. `url`, `tag`, and
`icon` are deployment presentation values and clients MUST NOT treat them as
authorization. The service worker decides whether and how to display the
notification. A push service response indicating an expired or absent
subscription SHOULD cause the server to delete that subscription.

## Security Considerations

Implementations MUST address at least:

- **TLS:** JWTs, API keys, message content, and push keys must be protected in
  transit.
- **JWT validation:** Algorithms must be pinned to EdDSA for the profiles in
  this revision; `alg` supplied by a token must never select an unsafe method.
- **Key rotation:** JWKS and first-party signing-key rotation must avoid an
  interval in which valid or newly issued tokens cannot be checked.
- **Grant revocation:** Protected requests using first-party tokens must
  revalidate their backing grant and CIDR policy.
- **Proxy trust:** Source-IP CIDR enforcement is secure only when client IPs are
  derived from direct connections or explicitly trusted proxies.
- **Identity isolation:** Every query, download, mutation, event, and push
  subscription must be scoped to exactly one effective identity.
- **Act-as:** The server must verify ownership of the grant on every act-as
  request and must never accept a caller-supplied address without that check.
- **Draft immutability boundary:** All body, recipient, attachment, update, and
  delete operations must recheck sender ownership and unsent state.
- **File safety:** Filenames and stored paths must not escape configured
  storage; downloads must occur only after participant authorization.
- **Upload exhaustion:** Body, attachment, complete-message, multipart,
  decompression, request-rate, and concurrent-upload limits are required.
- **WebSocket isolation:** Events must be generated after authorization for the
  connected identity; slow clients must not block delivery to others.
- **Query credentials:** WebSocket query tokens can be recorded by intermediaries
  and should be short-lived and redacted from access logs.
- **Push endpoints:** Push subscription endpoints and keys are sensitive and
  must not be exposed across identities.
- **Error privacy:** Errors and thread placeholders must not reveal message
  content or resource existence beyond the authenticated identity's rights.

## Conformance

### Server Conformance

A conforming server MUST:

- implement all core routes and common conventions;
- implement at least one JWT profile;
- enforce one-identity visibility, participant checks, and draft immutability;
- preserve fmsg parent, add-to, delivery, and address semantics;
- return the documented message and error representations; and
- implement WebSocket resynchronization semantics by keeping HTTP state
  authoritative.

A server claiming grant support MUST implement all grant routes and both the
first-party JWT and act-as behavior. A server claiming Web Push support MUST
implement both subscription routes and the defined payload semantics.

### Client Conformance

A conforming client MUST:

- authenticate through a supported profile;
- never assume an owner can see a grant's messages without explicit act-as;
- treat delivery acceptance separately from draft send acceptance;
- tolerate omitted `short_text`, unknown JSON fields, and unknown WebSocket
  event types;
- use content routes rather than list responses for complete bodies and files;
- resynchronize over HTTP after a WebSocket connection is established or
  restored; and
- protect bearer tokens, API keys, and push subscription secrets.

### Minimum Interoperability Tests

An implementation pair SHOULD demonstrate:

1. Valid, expired, wrong-issuer, wrong-audience, and wrong-algorithm JWTs.
2. One identity cannot list, retrieve, download, mutate, or receive events for
   another identity's messages.
3. Draft create, replace, attachment upload/delete, send, and post-send
   immutability.
4. Root and reply creation, including an undeliverable reply-domain conflict.
5. Primary and add-to recipient visibility and per-recipient read state.
6. Atomic add-to batches and refreshed `recipients_added` events.
7. Pending, failed, local, and successful remote delivery states plus
   `delivered` events.
8. Thread rendering with visible text, JSON, non-text, and invisible ancestors.
9. Message/attachment size rejection and path-traversal attempts.
10. WebSocket authentication, act-as, origin rejection, heartbeat, unknown
    events, disconnect, and HTTP resynchronization.
11. If grants are supported: create, get, list, CIDR replacement, rotation,
    deletion, source denial, token exchange, and revocation of an issued JWT.
12. If Web Push is supported: create, refresh, idempotent delete, root-thread
    payload grouping, and removal of dead subscriptions.
