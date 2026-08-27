# FMSG-004 A2A Protocol Binding Standard

## Status

This document is an initial draft. It defines an A2A protocol binding over fmsg
and is not an official binding of the A2A Project.

| Revision | Date       | Summary       |
|----------|------------|---------------|
| v0.1.0   | 2026-08-09 | Initial threaded draft |
| v0.2.0   | 2026-08-27 | Native attachment mapping; sibling events; detached delivery on parent loss |

This revision binds A2A protocol version 1.0 to fmsg wire protocol version 1.
A future revision is required to support a breaking version of either protocol.

## Requirements Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and
**OPTIONAL** in this document are to be interpreted as described in BCP 14
([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they
appear in all capitals.

## Abstract

The Agent2Agent (A2A) protocol defines operations and data structures for
communication between agents. fmsg provides federated, store-and-forward,
immutable message delivery between addresses. This standard maps A2A operations
to request, response, and stream-event envelopes carried as fmsg messages.

An A2A client sends each operation to the fmsg address advertised by an A2A
server. The first operation is an fmsg thread root. Later operations may reply
to earlier results so that task continuations form chains, related tasks branch
from a context anchor, and task controls form side branches. A2A task and
context identifiers remain authoritative for application continuity; fmsg
parent hashes provide transport history, correlation, and integrity. Binary
part content travels as native fmsg attachments rather than as base64 text.
When an fmsg parent is no longer available, delivery restarts in a new fmsg
thread and the A2A identifiers carry the task and context across threads.

This binding does not change the A2A data model, task state machine, Agent Card
discovery rules, or extension semantics.

## Introduction

This section is non-normative.

A2A and fmsg solve different parts of agent communication. A2A gives agents a
shared vocabulary: start a task, continue it, report progress, return results,
or cancel it. fmsg provides a way to deliver those operations between
authenticated addresses using durable, store-and-forward, cryptographically
linked messages.

For example, an assistant can ask a research agent to investigate a question.
The research agent creates an A2A task, the assistant adds a follow-up question,
and the agent sends progress updates before returning its result. With this
binding, the agents still speak standard A2A, but the exchange travels through
fmsg addresses such as `@research-agent@example.com` instead of requiring this
interaction to use another A2A transport.

Using fmsg means an agent does not have to be online at the same moment as its
peer. Requests can survive temporary outages, task continuations form
verifiable fmsg chains, related tasks can branch from a shared context, and
status checks or cancellations can appear as side branches without changing
the A2A task itself. Should a host no longer hold an earlier message, the
exchange continues in a new fmsg thread and the A2A identifiers keep the
relationship intact. Files exchanged as A2A parts are ordinary fmsg
attachments, visible to any fmsg client that can read the thread.

In short, A2A gives agents a shared language; fmsg gives their conversation a
durable, federated, and verifiable delivery system. An adapter can therefore
place fmsg underneath an existing A2A client or server without changing the
application's task-handling code.

## Normative References

- [A2A Protocol Specification 1.0](https://a2a-protocol.org/latest/specification/)
- [fmsg Specification](../SPECIFICATION.md)
- [FMSG-001 TCP+TLS Transport and Binding Standard](fmsg-001-transport-and-binding.md)
- [Protocol Buffers JSON Mapping](https://protobuf.dev/programming-guides/json/)
- [RFC 3986: Uniform Resource Identifier](https://www.rfc-editor.org/rfc/rfc3986)
- [RFC 6838: Media Type Specifications](https://www.rfc-editor.org/rfc/rfc6838)

An implementation claiming conformance to this standard MUST also conform to
the versions of A2A and fmsg identified in [Status](#status).

## Terminology

**A2A client** is the agent or application initiating an A2A operation.

**A2A server** is the remote agent processing an A2A operation.

**client address** is the fmsg address from which a request is sent and to which
responses are addressed.

**server address** is the fmsg address advertised by the A2A server.

**request message** is an fmsg message carrying one A2A request envelope. It is
either a thread root or a reply to a conversational result.

**response message** is an fmsg reply carrying the single non-streaming result
or error for a request.

**event message** is an fmsg reply carrying one item of an A2A streaming result.

**mapped part** is an A2A `Part` whose `raw` content is carried as an fmsg
attachment of the same message rather than inline in the JSON payload.

**attachment reference** is the `fmsg-attachment` URI placed in a mapped
part's `url` member to name its attachment.

**context anchor** is the first successful conversational response or event
known to establish an A2A context for a client/server address pair.

**task head** is the most recent successful conversational response or event
known for an A2A task by one endpoint. Concurrent operations may create more
than one valid branch from an earlier task head.

**detached root** is a request sent as an fmsg thread root although its A2A
scope names an existing task or context, because no usable fmsg parent is
available to the client.

**detached result** is a response or event sent as an fmsg thread root because
the request message cannot be used as its parent.

**transport principal** is the fmsg sender address accepted by the receiving
host after fmsg host and domain verification. This is distinct from an
end-to-end cryptographic identity for the person or process using that address.

## Binding Identification

The provisional protocol binding identifier for this revision is:

```text
https://github.com/markmnl/fmsg/blob/main/standards/fmsg-004-a2a-binding.md
```

An Agent Card advertising this binding MUST place that exact value in the
`protocolBinding` field of its `AgentInterface`. Implementations MUST compare
the value as a case-sensitive string and MUST NOT assume that another identifier
is equivalent.

If this binding is adopted under a standards organization, a later revision MAY
assign a new identifier. Implementations MUST NOT silently treat the old and new
identifiers as equivalent unless that revision explicitly defines compatibility.

## Agent Endpoint URI

The `url` of an `AgentInterface` using this binding MUST be an absolute URI with
the `fmsg` scheme and this form:

```text
fmsg:<address>
```

For an ASCII address the canonical form is, for example:

```text
fmsg:@research-agent@example.com
```

The scheme name MUST be lowercase. The decoded scheme-specific part MUST be one
valid fmsg address. Octets outside the URI unreserved and permitted path
characters MUST be percent-encoded using the address's UTF-8 representation.
Percent-encoded octets MUST use uppercase hexadecimal digits. URI decoders MUST
decode percent-encoding exactly once before validating the fmsg address.

The URI MUST NOT contain an authority marker (`//`), query, or fragment. Clients
MUST reject a selected fmsg interface whose endpoint does not meet these rules.

The `tenant` value, when present in the selected `AgentInterface`, remains an
opaque A2A routing value. The client MUST copy it exactly into the `tenant`
field of every A2A request payload. It does not alter the fmsg address.

## Agent Card Declaration and Discovery

Agent Cards remain JSON documents discovered through the mechanisms defined by
A2A, including an HTTPS well-known URI, a registry, or direct configuration.
This binding does not define Agent Card discovery over fmsg.

An interface declaration for this draft has this form:

```json
{
  "url": "fmsg:@research-agent@example.com",
  "protocolBinding": "https://github.com/markmnl/fmsg/blob/main/standards/fmsg-004-a2a-binding.md",
  "protocolVersion": "1.0"
}
```

An Agent Card MUST accurately declare `streaming`, `pushNotifications`, and
`extendedAgentCard` capabilities for this interface. If capabilities differ
between an HTTP interface and an fmsg interface, the server SHOULD publish
separate Agent Cards so that a client cannot infer unsupported capability from
the union of interfaces.

## fmsg Message Profile

### Common Requirements

Every request, response, and event defined here MUST be the data of one fmsg
message with media type:

```text
application/vnd.fmsg.a2a+json
```

The message data MUST be UTF-8 JSON and MUST contain exactly one binding
envelope. Byte order marks are forbidden. Senders SHOULD use the shortest
reasonable representation and receivers MUST ignore insignificant JSON
whitespace.

Binary A2A content is carried as native fmsg attachments as defined in
[Attachment Mapping](#attachment-mapping). A message MUST NOT carry any
attachment other than those that mapping produces.

The fmsg `important` flag MAY be set. The `zlib-deflate` flag MAY be used on
the message data and on any attachment and is processed at the fmsg layer
before JSON parsing. The `has add to` flag MUST NOT be set. Each message MUST
have exactly one recipient.

### Request Message

A request message MUST:

- have `from` equal to the client address;
- have one `to` value equal to the server address;
- have the `no reply` flag clear; and
- contain a request envelope.

A root request MUST have no `pid` and MUST have a topic of
`A2A <requestId>`. A threaded request MUST have `pid` equal to the hash of the
selected parent and MUST contain no topic. The topic carries no authority. A
receiver MUST use the envelope `requestId` and MUST reject a root request whose
topic does not match it or a threaded request that contains a topic.

### Response Message

A response message MUST:

- have `from` equal to the server address;
- have one `to` value equal to the request's `from` address;
- have `pid` equal to the request message hash and no topic, or be a detached
  result as defined in [Detached Results](#detached-results);
- contain a response envelope; and
- use the same `requestId` and `operation` as the request.

The `no reply` flag MUST be clear on a successful `SendMessage` response because
it can become a context anchor or task head. It MAY be set on errors and on
responses to non-conversational operations. A response is authoritative only
when both its fmsg relationship and envelope correlation are valid.

### Event Message

If streaming is supported, each event message MUST meet the response message
requirements except that it contains an event envelope. Every event of a
stream therefore replies to the request message, not to the preceding event:
the events are siblings under the request, ordered by the envelope `sequence`
and not by fmsg linkage. Delivery of one event never depends on another, so a
single undeliverable event cannot strand the remainder of a stream.

A `SendStreamingMessage` event carrying a task ID MUST have the `no reply` flag
clear because it can become a task head. Other events MAY set it;
`SubscribeToTask` events are side branches.

### Detached Results

A server MUST send a result as a reply to the request message whenever it can.
If the sending host reports fmsg REJECT code 6 (parent not found), the
client's host no longer holds the request and the reply can never be
delivered. The server MUST then resend the result as a detached result: an
fmsg thread root with no `pid`, a topic of `A2A <requestId>`, and otherwise
identical data and attachments. A server that can no longer reply to the
request message, because its own host no longer holds it, MUST send the
result as a detached result directly. Once any result for a request has been
sent detached, every later event for that request MUST also be sent detached.

A detached result is authenticated by fmsg transport verification of its
`from` address and correlated by its topic and envelope; it cannot be linked
to the request by hash. A client MUST accept a detached result whose `from`,
recipient, topic, `requestId`, and `operation` match a request it sent, and
MUST apply the same duplicate and sequence rules as for a reply. A detached
result MAY become a task head or context anchor exactly as a reply would.

## Envelope

### Field Rules

All envelope property names are case-sensitive. Unknown envelope properties
MUST be ignored unless a later binding revision makes them required. A receiver
MUST reject duplicate JSON object property names.

`bindingVersion` MUST be the string `"0.2"` for this revision.

`a2aVersion` MUST be a supported A2A major and minor version and MUST equal the
`A2A-Version` service parameter. This revision permits only `"1.0"`.

`requestId` MUST be a UUID represented in the lowercase canonical textual form
defined by RFC 9562. The request creator generates it. It is transport
correlation and is not an A2A `messageId`, `taskId`, or `contextId`.

`operation` MUST be one operation name listed in [Operation Mapping](#operation-mapping).
Operation names are case-sensitive.

### Request Envelope

```json
{
  "bindingVersion": "0.2",
  "a2aVersion": "1.0",
  "kind": "request",
  "requestId": "018f3f6e-7c1a-7e95-8f23-6ed8b985a781",
  "operation": "SendMessage",
  "serviceParameters": {
    "a2a-version": "1.0"
  },
  "payload": {}
}
```

The properties shown above are REQUIRED. `kind` MUST be `"request"`.
`serviceParameters` and `payload` MUST be JSON objects. `payload` MUST be the
ProtoJSON representation of the request type specified for the operation.

An optional `credentials` property MAY be present as defined in
[Application Authentication](#application-authentication).

### Response Envelope

A successful response contains `payload`:

```json
{
  "bindingVersion": "0.2",
  "a2aVersion": "1.0",
  "kind": "response",
  "requestId": "018f3f6e-7c1a-7e95-8f23-6ed8b985a781",
  "operation": "SendMessage",
  "payload": {}
}
```

An unsuccessful response contains `error`:

```json
{
  "bindingVersion": "0.2",
  "a2aVersion": "1.0",
  "kind": "response",
  "requestId": "018f3f6e-7c1a-7e95-8f23-6ed8b985a781",
  "operation": "GetTask",
  "error": {
    "code": "A2A_TASK_NOT_FOUND",
    "message": "The task does not exist or is not accessible",
    "details": []
  }
}
```

`kind` MUST be `"response"`. Exactly one of `payload` or `error` MUST exist.
For a successful operation returning `google.protobuf.Empty`, `payload` MUST be
an empty JSON object.

### Event Envelope

```json
{
  "bindingVersion": "0.2",
  "a2aVersion": "1.0",
  "kind": "event",
  "requestId": "018f3f6e-7c1a-7e95-8f23-6ed8b985a781",
  "operation": "SubscribeToTask",
  "sequence": 0,
  "final": false,
  "payload": {}
}
```

`kind` MUST be `"event"`. `sequence` MUST be an integer from 0 through
9,007,199,254,740,991. The first event MUST have sequence 0 and each following
event MUST increment it by one. `final` MUST be a Boolean. Exactly one of
`payload` or `error` MUST exist. A successful `payload` MUST be the ProtoJSON
representation of `StreamResponse`.

Exactly one event MUST have `final: true`, and it MUST be the last event. A
stream error is an event containing `error` and `final: true`. A server MUST NOT
send an event after the final event.

## A2A Data Representation

The `payload` property uses A2A 1.0 ProtoJSON without binding-specific changes:

- field names MUST use lower camel case;
- enum values MUST use their symbolic ProtoJSON names;
- timestamps MUST be ISO 8601 UTC strings accepted by ProtoJSON;
- `bytes` values MUST use ProtoJSON base64 encoding, except that `Part.raw` is
  carried as defined in [Attachment Mapping](#attachment-mapping);
- 64-bit integer values MUST follow ProtoJSON string representation rules;
- absent optional fields MUST remain absent; and
- oneof constraints and A2A required-field constraints MUST be enforced.

A receiver MUST validate the payload against the request or response type for
the named operation. Binding metadata MUST NOT be inserted into an A2A object's
`metadata` field unless it is also application-visible A2A metadata.

An implementation MAY support A2A extensions. Extension identifiers and their
metadata remain inside the A2A data model, and extension activation MUST also be
declared through the `A2A-Extensions` service parameter as required by A2A.

## Attachment Mapping

A2A carries file content by reference in `Part.url` or by value in `Part.raw`.
`Part.raw` is the only `bytes` field in the A2A 1.0 data model; the gRPC
binding transports it as octets and the JSON binding as base64 text. fmsg
carries binary content natively as attachments, so this binding transports
`Part.raw` as an attachment of the fmsg message that carries its envelope.

The mapping is a transport representation only. The A2A layer on either side
observes an ordinary `Part` whose `raw` member holds the content; it never
observes an attachment or an attachment reference.

### Mapped Parts

A sender MUST map every `Part` with a non-empty `raw` value, wherever it
occurs in the payload, to one fmsg attachment, subject to
[Count Limit and Inline Fallback](#count-limit-and-inline-fallback). For each
mapped part the sender MUST:

- write the `raw` octets as the attachment data, setting the attachment
  `zlib-deflate` flag at its discretion;
- name the attachment `a2a-part-<n>`, where `<n>` is the zero-based ordinal of
  the mapped part in decimal without leading zeros, numbered in the order the
  references appear in the serialized message data;
- set the attachment type as defined in [Attachment Type](#attachment-type);
- omit `raw` from the serialized `Part`; and
- set the `Part` `url` member to the attachment reference
  `fmsg-attachment:a2a-part-<n>`.

Every other `Part` member, including `filename`, `mediaType`, and `metadata`,
MUST be serialized unchanged. Because the reference occupies the `url` member
of the `content` oneof, the payload remains valid A2A ProtoJSON and the
[A2A Data Representation](#a2a-data-representation) rules continue to apply.

A `raw` value of zero length MUST remain inline as `"raw": ""`.

Attachments belong to the fmsg message that carries them. A response and each
event of a stream carries only the attachments for its own payload; a chunked
`TaskArtifactUpdateEvent` therefore carries only that chunk's octets.

### Attachment Reference

An attachment reference is a URI whose scheme is `fmsg-attachment` and whose
scheme-specific part is the filename of an attachment in the same fmsg
message. The scheme name MUST be lowercase. The reference MUST NOT contain an
authority marker (`//`), query, fragment, or percent-encoding.

The `fmsg-attachment` scheme is reserved by this binding. A sender MUST reject
at its A2A API boundary any application-supplied `Part.url` that uses it, and
a receiver MUST treat every `Part.url` that uses it as an attachment
reference. A receiver MUST NOT attempt to retrieve an attachment reference as
a network resource.

### Attachment Type

The attachment type MUST equal `Part.mediaType` when that value is present,
non-empty, US-ASCII, and shorter than 256 octets; otherwise it MUST be
`application/octet-stream`. Whether the fmsg type field is encoded as a common
media type ID or as a string is an fmsg-layer detail with no meaning in this
binding.

`Part.mediaType` in the JSON payload remains the A2A value. The attachment
type exists so that fmsg hosts and clients can apply media policy, display,
and storage handling to the content without parsing the envelope.

### Count Limit and Inline Fallback

An fmsg message carries at most 255 attachments. A sender MUST map parts in
serialization order until that limit is reached; every remaining `raw` part
MUST be serialized inline using ProtoJSON base64 encoding.

A receiver MUST accept an inline `raw` value wherever a `Part` is valid,
regardless of how many attachments the message carries. Inline encoding is a
fallback, not an alternative: a sender MUST NOT use it for a part that this
section requires to be mapped.

### Receiver Processing

Before validating the payload against its A2A type, a receiver MUST:

1. resolve every attachment reference to the attachment whose filename matches
   it, compared case-insensitively as fmsg requires;
2. verify that every attachment on the message is referenced exactly once;
3. verify that each referenced attachment's type is either
   `application/octet-stream` or equal to the referencing part's `mediaType`
   after ASCII case folding; and
4. replace the `url` member of each referencing `Part` with a `raw` member
   holding the attachment's expanded data.

A message failing any of these checks MUST be rejected with
`FMSG_A2A_ATTACHMENT_INVALID`. A receiver resolves attachments by reference
only; it MUST NOT depend on the `a2a-part-<n>` naming for ordering or
correctness. This allows a later revision to relax attachment naming without
changing receivers.

### Integrity and Size

The fmsg message hash covers attachment data, so a mapped part has the same
integrity, correlation, and replay properties as inline content. Attachment
data counts toward fmsg `MAX_SIZE` and `MAX_EXPANDED_SIZE` together with the
message data, without base64 expansion.

### Example

A client sends a photograph for analysis. The fmsg message carries one
attachment named `a2a-part-0` of type `image/jpeg` whose data is the JPEG
octets, and this message data:

```json
{
  "bindingVersion": "0.2",
  "a2aVersion": "1.0",
  "kind": "request",
  "requestId": "018f3f75-2d0c-7a3e-9b41-7f2c5e8d9a10",
  "operation": "SendMessage",
  "serviceParameters": {
    "a2a-version": "1.0"
  },
  "payload": {
    "message": {
      "messageId": "018f3f76-4b1e-7d92-8c53-1a9e6f7b2c44",
      "role": "ROLE_USER",
      "parts": [
        {
          "text": "What is in this photograph?",
          "mediaType": "text/plain"
        },
        {
          "url": "fmsg-attachment:a2a-part-0",
          "filename": "photo.jpg",
          "mediaType": "image/jpeg"
        }
      ]
    }
  }
}
```

The receiving binding restores the second part before the A2A server sees it.
The server observes a `Part` whose `raw` member holds the JPEG octets, with
`filename` `photo.jpg` and `mediaType` `image/jpeg`, exactly as it would over
any other A2A binding.

## Service Parameters

A2A service parameters have no native fmsg header location and therefore MUST
be carried in the request envelope's `serviceParameters` object. Each value MUST
be a string. Keys MUST be serialized in lowercase and compared
case-insensitively. A receiver MUST reject two keys that become equal after
ASCII case folding.

The following parameters are defined by A2A:

| Envelope key     | Requirement | Meaning |
|------------------|-------------|---------|
| `a2a-version`    | REQUIRED    | A2A major and minor version; MUST equal `a2aVersion` |
| `a2a-extensions` | OPTIONAL    | Comma-separated extension identifiers requested by the client |

Binding revisions MAY define additional service parameters prefixed
`fmsg-a2a-`. This revision defines none. Unrecognized optional parameters MUST
be ignored. A server MUST apply A2A's required-extension validation before
executing an operation.

## Operation Mapping

Every implementation MUST recognize every operation in this table. Support for
capability-gated operations is conditional as described below.

| `operation` | Request `payload` | Successful response `payload` |
|-------------|-------------------|---------------------------------|
| `SendMessage` | `SendMessageRequest` | `SendMessageResponse` |
| `SendStreamingMessage` | `SendMessageRequest` | Sequence of event envelopes containing `StreamResponse` |
| `GetTask` | `GetTaskRequest` | `Task` |
| `ListTasks` | `ListTasksRequest` | `ListTasksResponse` |
| `CancelTask` | `CancelTaskRequest` | `Task` |
| `SubscribeToTask` | `SubscribeToTaskRequest` | Sequence of event envelopes containing `StreamResponse` |
| `CreateTaskPushNotificationConfig` | `TaskPushNotificationConfig` | `TaskPushNotificationConfig` |
| `GetTaskPushNotificationConfig` | `GetTaskPushNotificationConfigRequest` | `TaskPushNotificationConfig` |
| `ListTaskPushNotificationConfigs` | `ListTaskPushNotificationConfigsRequest` | `ListTaskPushNotificationConfigsResponse` |
| `DeleteTaskPushNotificationConfig` | `DeleteTaskPushNotificationConfigRequest` | `google.protobuf.Empty` as `{}` |
| `GetExtendedAgentCard` | `GetExtendedAgentCardRequest` | `AgentCard` |

The server MUST preserve the operation semantics, validation, task-state rules,
history-length behavior, pagination behavior, idempotency, and authorization
rules defined by A2A.

### Non-streaming Operations

Each non-streaming request produces exactly one response message. For
`SendMessage`, `configuration.returnImmediately` retains its A2A meaning. If it
is false or absent, the server MUST delay its response until the task reaches a
terminal or interrupted state. If true, the server returns the current result
as soon as A2A permits. Store-and-forward delivery does not implicitly change
this field.

### Streaming Operations

A server advertising `capabilities.streaming: true` for this interface MUST
support both `SendStreamingMessage` and `SubscribeToTask` through event
envelopes. A server not advertising streaming MUST return
`A2A_UNSUPPORTED_OPERATION` in a normal response envelope.

Before the first event, a streaming request MAY fail with one normal error
response envelope. After the first event, any failure MUST be the error in a
final event envelope. A server MUST NOT send both a response envelope and an
event envelope for the same streaming request.

fmsg provides reliable message delivery but not a live byte stream, and sibling
events may be delivered in any order. The `sequence` field defines application
ordering. Clients MUST buffer out-of-order events within an
implementation-defined bounded window. A missing sequence after an
implementation-defined timeout terminates the local stream with a binding
transport error; clients MAY recover task state using `GetTask` or a new
`SubscribeToTask` request.

Receiving a terminal or interrupted `TaskStatusUpdateEvent` does not replace the
required final event. Stream completion is signalled only by `final: true`.

### Push Notifications

Push notification configuration operations retain their A2A semantics. The
`TaskPushNotificationConfig.url` is the callback URL used by the A2A server;
this standard does not reinterpret it as an fmsg address. A server not
advertising `capabilities.pushNotifications: true` MUST return the appropriate
A2A unsupported-operation or push-notification-not-supported error.

Credentials inside `TaskPushNotificationConfig.authentication` are subject to
the persistence warning in [Credential Persistence](#credential-persistence).

### Extended Agent Card

A server not advertising `capabilities.extendedAgentCard: true` MUST return
`A2A_UNSUPPORTED_OPERATION`. A server advertising it MUST authenticate and
authorize the requester according to A2A and this standard before returning an
extended card.

## Error Representation

An error object MUST have non-empty string properties `code` and `message`.
`details` MUST be a JSON array when present. It MAY contain structured A2A error
details and MUST NOT contain credentials or information the caller is not
authorized to know.

### A2A Errors

The following binding codes map to A2A 1.0 error types:

| Binding `code` | A2A error type |
|----------------|----------------|
| `A2A_TASK_NOT_FOUND` | `TaskNotFoundError` |
| `A2A_TASK_NOT_CANCELABLE` | `TaskNotCancelableError` |
| `A2A_PUSH_NOTIFICATION_NOT_SUPPORTED` | `PushNotificationNotSupportedError` |
| `A2A_UNSUPPORTED_OPERATION` | `UnsupportedOperationError` |
| `A2A_CONTENT_TYPE_NOT_SUPPORTED` | `ContentTypeNotSupportedError` |
| `A2A_INVALID_AGENT_RESPONSE` | `InvalidAgentResponseError` |
| `A2A_EXTENDED_AGENT_CARD_NOT_CONFIGURED` | `ExtendedAgentCardNotConfiguredError` |
| `A2A_EXTENSION_SUPPORT_REQUIRED` | `ExtensionSupportRequiredError` |
| `A2A_VERSION_NOT_SUPPORTED` | `VersionNotSupportedError` |

Generic authentication, authorization, validation, not-found, rate-limit, and
internal failures MUST use `UNAUTHENTICATED`, `PERMISSION_DENIED`,
`INVALID_ARGUMENT`, `NOT_FOUND`, `RESOURCE_EXHAUSTED`, or `INTERNAL` as
appropriate. A server MUST NOT use `NOT_FOUND` in a way that reveals a resource
the transport principal is not authorized to discover.

### Binding Errors

Errors detected after the server receives a correlatable request SHOULD be
returned with one of these codes:

| Binding `code` | Meaning |
|----------------|---------|
| `FMSG_A2A_INVALID_ENVELOPE` | Envelope JSON or required binding field is invalid |
| `FMSG_A2A_UNSUPPORTED_BINDING_VERSION` | `bindingVersion` is unsupported |
| `FMSG_A2A_UNKNOWN_OPERATION` | `operation` is not recognized |
| `FMSG_A2A_REQUEST_ID_CONFLICT` | A reused request ID has different request content |
| `FMSG_A2A_CORRELATION_FAILED` | fmsg relationship and envelope correlation disagree |
| `FMSG_A2A_ATTACHMENT_INVALID` | Attachment references, attachment set, or attachment types violate [Attachment Mapping](#attachment-mapping) |

If the body cannot be parsed enough to determine a trustworthy `requestId`, the
server MUST NOT send a response. It SHOULD record the failure without logging
the body.

### fmsg Delivery Failures

fmsg rejection and transport failures occur before an A2A server necessarily
processes a request. Except for REJECT code 6 (parent not found), which the
client handles as defined in [Thread Topology](#thread-topology), a client
binding MUST report them as transport errors and MUST NOT fabricate an A2A
response. The error SHOULD retain the fmsg response code, affected address, and
whether retry may be useful.

A client-side response timeout is also a transport error. Timing out does not
cancel the remote operation. A caller wanting cancellation MUST subsequently
send `CancelTask` when it has a task identifier.

## Thread Topology

A2A identifiers define application continuity and MUST be present wherever A2A
requires them. The fmsg graph records how one address pair transported that
continuity; it does not replace the A2A data model.

A client that has a usable canonical parent MUST choose request parents as
follows:

- `SendMessage` and `SendStreamingMessage` carrying a `taskId` reply to a known
  task head;
- those operations carrying a `contextId` but no `taskId` reply to the stable
  context anchor, allowing related tasks to branch;
- `GetTask`, `CancelTask`, `SubscribeToTask`, and task push-notification
  configuration operations reply to a known head of the named task;
- `ListTasks` with a `contextId` replies to that context anchor; and
- unscoped operations are roots.

Control operations and `SubscribeToTask` are side branches. Their responses and
events MUST NOT become the task head. A successful `SendMessage` response and
each successful `SendStreamingMessage` event carrying a task ID, processed in
sequence order, MUST become the sender's known task head. The first such result
observed for a context establishes its context anchor. The anchor MUST NOT move
while it remains usable; if it becomes unusable, the next such result for the
context establishes a new anchor. Whether a result was delivered as a reply or
as a detached result does not affect its eligibility.

An implementation can know only the portion of a graph available to its local
fmsg account. If the canonical parent is unknown, deleted, has `no reply` set,
or cannot be used, the client MUST send the operation as a detached root. A
server MUST accept a valid detached root even when its payload names an existing
task or context. This permits another authorized client address or an endpoint
that lost local graph state to continue using the A2A identifiers.

A threaded request rejected by the server's host with fmsg REJECT code 6
(parent not found) was never received by the A2A server: the server's host no
longer holds the parent. The client MUST resend that request as a detached
root with the same `requestId` and content, and MUST treat the lost parent as
unusable thereafter. The fmsg specification's other recoveries for code 6 do
not apply here, because `add to` is forbidden by this binding and a client
cannot resend a message the server authored. Restarting an fmsg thread this
way does not affect the A2A task or context, whose identifiers remain in every
payload.

A threaded request parent MUST be a successful `SendMessage` response or
`SendStreamingMessage` event sent by the selected server to the requesting
client. Its A2A task or context identifier MUST match the scope of the new
request. A server MUST reject a threaded request whose parent direction, media
type, envelope kind, operation, or A2A identity does not meet these rules with
`FMSG_A2A_CORRELATION_FAILED`. Receivers SHOULD accept an older valid task node
because concurrent operations can legitimately branch from the same head.

## Correlation, Replay, and Idempotency

The tuple `(server address, client address, requestId)` identifies one binding
request. A server MUST retain sufficient request state for at least its
documented maximum retry interval.

On first receipt, the server MUST associate the tuple with a digest of the
request envelope and with every response or event it emits. The digest SHOULD
be SHA-256 over an implementation's deterministic encoding of the parsed
envelope after attachment restoration, so that it covers the content of every
mapped part. It MUST exclude fmsg fields such as transmission time.

If the tuple is received again:

- with equivalent request content, the server MUST NOT execute the operation a
  second time and SHOULD replay the stored response or events as new fmsg
  replies to the newly received duplicate request; or
- with different content, the server MUST return
  `FMSG_A2A_REQUEST_ID_CONFLICT` and MUST NOT execute it.

The server MUST also apply A2A `messageId` idempotency semantics. A new binding
`requestId` does not authorize replaying an A2A message with the same
`messageId` as new work.

A client MUST match a response or event by all of:

- fmsg `pid` equal to the request message hash, or, for a detached result, no
  `pid` and a topic of `A2A <requestId>`;
- fmsg `from` equal to the selected server address;
- fmsg recipient equal to the original client address;
- matching `requestId`; and
- matching `operation`.

The client MUST ignore an exact duplicate response or event. Reuse of an event
sequence number with different content is a correlation failure and MUST
terminate the local stream.

A2A `taskId` and `contextId` alone define A2A continuity. Implementations MUST
NOT infer either identifier from an fmsg `pid` or message hash, and a detached
root MUST NOT be interpreted as starting a new A2A task when its payload names
an existing one.

## Authentication and Authorization

### Transport Authentication

The receiving fmsg host verifies the sending host and sender domain as required
by fmsg and FMSG-001. The A2A server MUST use the request's fmsg `from` address
as the transport principal and MUST authorize every operation and task against
that principal.

A server MUST NOT trust an address copied into the JSON payload as the caller's
identity. A response MUST be sent only to the authenticated request sender.

Transport authentication establishes which federated fmsg address sent the
message. It does not prove that a particular human or process controlled that
address, and it does not provide end-to-end payload encryption or signatures.

An Agent Card MAY have no A2A `securityRequirements` when authorization by fmsg
transport principal is sufficient. Operators MUST document their trust model.

### Application Authentication

When an Agent Card declares an A2A security requirement for this interface, a
request MAY contain a `credentials` object. Each property name MUST equal a key
in the Agent Card's `securitySchemes` map. Its value MUST be an object with a
required string `value` and an optional array of string `scopes`:

```json
{
  "credentials": {
    "agentOAuth": {
      "value": "opaque-short-lived-credential",
      "scopes": ["tasks:write"]
    }
  }
}
```

API-key, HTTP authentication, OAuth 2.0, and OpenID Connect credentials are
carried as the opaque `value`; their HTTP `header`, `query`, or `cookie`
locations do not apply to this binding. Mutual TLS cannot be conveyed by this
object and is unsupported unless a later standard defines verifiable
end-to-end delegation. A client MUST NOT select this interface if it cannot
satisfy one complete advertised security requirement.

The server MUST validate credentials before processing the A2A payload and MUST
bind successful authentication to the fmsg transport principal. Credentials do
not permit a response to be redirected to another address.

### Credential Persistence

fmsg messages are immutable and may be retained by sending and receiving hosts.
Therefore application credentials placed in an envelope are also retained.

Implementations:

- MUST NOT transmit passwords, refresh tokens, or long-lived API keys;
- MUST NOT log credential values;
- MUST redact `credentials` from diagnostics;
- SHOULD use audience-restricted, narrowly scoped, short-lived proof tokens;
- SHOULD use one-time credentials where the authentication system supports
  them; and
- MUST NOT advertise a security scheme over this binding when its safe use
  depends on credential secrecy beyond what the deployment provides.

End-to-end encrypted fmsg content is outside this revision. Deployments needing
strong credential or payload confidentiality MUST add an independently
specified end-to-end protection layer or MUST NOT use this binding for that
traffic.

## Execution and Delivery Semantics

Sending an fmsg request and receiving an fmsg acceptance code confirms message
delivery to the receiving host, not successful execution of the A2A operation.
Only a valid response or final event conveys the A2A result.

A client adapter MAY present a blocking API by waiting for correlated inbound
fmsg messages. It MUST make its local timeout and retry policy configurable.
That policy MUST NOT alter A2A `returnImmediately` semantics.

Requests and responses may be delayed, duplicated at an API boundary, or arrive
after a local timeout. Both peers MUST persist enough correlation state to
handle those cases. Implementations SHOULD process inbound messages in fmsg
message-time order, but MUST use the explicit event sequence for streams.

## Size and Media Handling

The complete fmsg message, comprising the JSON envelope and every mapped
attachment, is subject to fmsg's message size, expanded-size, attachment
count, quota, and media-type limits. An adapter SHOULD check the destination's
known limits before sending but MUST still handle an fmsg rejection, including
one caused by a receiving host's attachment media-type policy.

An A2A server MUST validate every `Part.mediaType` against the selected skill's
declared input modes. It MUST treat URLs in `Part.url`, filenames, structured
data, and `raw` content, whether restored from an attachment or decoded from
base64, as untrusted input.

Mapped parts carry `raw` content without base64 expansion; only inline
fallback parts incur it.

## Security Considerations

Implementers MUST consider at least the following:

- **Authorization:** Every task lookup, list, cancellation, subscription, push
  configuration, and extended-card request must be scoped to the authenticated
  transport principal and any application credential.
- **Payload confidentiality:** TLS protects fmsg hops, not stored content or
  content end to end. Sensitive A2A data may remain in host storage.
- **Replay:** fmsg duplicate detection does not replace binding `requestId` and
  A2A `messageId` idempotency across newly encoded messages.
- **Resource exhaustion:** JSON depth, object count, attachment count and
  expanded size, decoded base64 size, stream reordering buffers, concurrent
  requests, and retained replay state require explicit limits.
- **Parser safety:** Receivers must reject duplicate JSON keys, invalid UTF-8,
  malformed ProtoJSON, and values outside declared numeric bounds.
- **Response confusion:** Both fmsg parent linkage and envelope identifiers must
  be checked before accepting a response.
- **Detached results:** A detached result has no hash linkage to its request.
  Its authenticity rests entirely on fmsg transport verification of `from`, so
  a client must never accept one from an address other than the selected
  server address, and must apply duplicate and sequence checks as usual.
- **Error privacy:** Errors must not disclose whether unauthorized task IDs,
  agent skills, extended-card data, or other principals exist.
- **Agent Card integrity:** Clients should retrieve Agent Cards over HTTPS and
  verify an Agent Card signature when one is present.
- **URL retrieval:** Servers resolving an A2A `Part.url` must defend against
  server-side request forgery and apply scheme, host, redirect, and size policy.
- **Attachment references:** An `fmsg-attachment` reference names content in
  the same fmsg message only. It must never be fetched as a network resource,
  and a message whose references and attachments do not correspond exactly
  must be rejected before any A2A processing.

The security requirements of A2A, fmsg, and FMSG-001 remain applicable.

## Conformance

### Client Conformance

A conforming client implementation MUST:

- parse and validate the selected fmsg `AgentInterface`;
- construct the fmsg profile and request envelope defined here;
- map and restore `Part.raw` content as defined in
  [Attachment Mapping](#attachment-mapping);
- support every non-capability-gated operation in the operation table;
- validate fmsg and envelope correlation for every result;
- implement duplicate response handling and configurable timeouts;
- accept detached results and resend a threaded request as a detached root on
  fmsg REJECT code 6; and
- expose fmsg delivery failures separately from A2A errors.

A client claiming streaming support MUST additionally implement event ordering,
duplicate handling, final-event processing, and bounded recovery behavior.

### Server Conformance

A conforming server implementation MUST:

- advertise an accurate Agent Card interface and capabilities;
- validate the fmsg profile, envelope, service parameters, and A2A payload;
- map and restore `Part.raw` content as defined in
  [Attachment Mapping](#attachment-mapping);
- recognize every operation in the operation table;
- preserve A2A operation and task semantics;
- authorize operations using the fmsg transport principal;
- implement request replay protection and idempotent duplicate handling;
- send detached results when a reply cannot be delivered; and
- return the response and error representations defined here.

A server MAY return the prescribed unsupported errors for streaming, push
notifications, and extended Agent Cards only when the corresponding capability
is not advertised.

### Minimum Interoperability Tests

An implementation pair claiming interoperability SHOULD demonstrate:

1. Agent Card selection and fmsg endpoint parsing.
2. `SendMessage` returning a direct A2A `Message`.
3. `SendMessage` returning a `Task`, followed by `GetTask`.
4. A task continuation forming an fmsg chain and a new task branching from the
   stable context anchor.
5. `ListTasks` pagination and authorization scoping.
6. Successful and rejected `CancelTask` operations.
7. A2A raw bytes carried as fmsg attachments in a request and a response,
   restored unchanged, and an inline base64 `raw` value accepted.
8. A message with an unresolvable, unreferenced, or mistyped attachment being
   rejected.
9. An A2A-specific error and an fmsg delivery rejection remaining distinct.
10. Duplicate `requestId` with identical content executing once.
11. Duplicate `requestId` with changed content being rejected.
12. A forged or mismatched fmsg `pid`, sender, request ID, or operation being
    rejected.
13. Detached-root continuation when local graph state is unavailable.
14. A threaded request rejected with fmsg code 6 being resent as a detached
    root, and a result rejected with code 6 being delivered as a detached
    result.
15. A task control side branch that does not advance the task head.
16. If streaming is advertised, sibling events delivered out of order, duplicate
    events, a missing event, and final-event handling.
17. If push notifications are advertised, all configuration operations.
18. If an extended Agent Card is advertised, authenticated retrieval and denial
    to an unauthorized transport principal.

## Complete Example

An Agent Card contains an interface such as:

```json
{
  "name": "Research Agent",
  "description": "Answers research questions",
  "supportedInterfaces": [
    {
      "url": "fmsg:@research-agent@example.com",
      "protocolBinding": "https://github.com/markmnl/fmsg/blob/main/standards/fmsg-004-a2a-binding.md",
      "protocolVersion": "1.0"
    }
  ],
  "version": "1.0.0",
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "extendedAgentCard": false
  },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain"],
  "skills": [
    {
      "id": "answer",
      "name": "Answer questions",
      "description": "Researches and answers a question",
      "tags": ["research"]
    }
  ]
}
```

The client `@assistant@example.net` sends a root fmsg message to
`@research-agent@example.com` with topic
`A2A 018f3f6e-7c1a-7e95-8f23-6ed8b985a781` and this data:

```json
{
  "bindingVersion": "0.2",
  "a2aVersion": "1.0",
  "kind": "request",
  "requestId": "018f3f6e-7c1a-7e95-8f23-6ed8b985a781",
  "operation": "SendMessage",
  "serviceParameters": {
    "a2a-version": "1.0"
  },
  "payload": {
    "message": {
      "messageId": "018f3f70-56e9-7cb6-a640-4a195f5f6ae2",
      "role": "ROLE_USER",
      "parts": [
        {
          "text": "What is the capital of Australia?",
          "mediaType": "text/plain"
        }
      ]
    },
    "configuration": {
      "returnImmediately": false
    }
  }
}
```

The server sends an fmsg reply to `@assistant@example.net` with `pid` equal to
the request hash, the `no reply` flag clear, and this data:

```json
{
  "bindingVersion": "0.2",
  "a2aVersion": "1.0",
  "kind": "response",
  "requestId": "018f3f6e-7c1a-7e95-8f23-6ed8b985a781",
  "operation": "SendMessage",
  "payload": {
    "message": {
      "messageId": "018f3f73-1fe4-784a-9f01-0060ae5b13d2",
      "contextId": "018f3f72-8c77-71b0-afbc-67693837d03b",
      "role": "ROLE_AGENT",
      "parts": [
        {
          "text": "Canberra is the capital of Australia.",
          "mediaType": "text/plain"
        }
      ]
    }
  }
}
```

Receipt of this response completes the binding exchange and establishes the
context anchor. A later `SendMessage` containing only that `contextId` replies
to this response and can create a new task branch. If a response instead
returned a task ID, a later `SendMessage` containing that `taskId` would reply
to the latest known result for that task, extending its chain. Each new request
still has its own request ID, and every A2A identifier remains explicit in its
A2A payload.
