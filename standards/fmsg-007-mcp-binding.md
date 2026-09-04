# FMSG-007 MCP Binding Standard

## Status

| Revision | Date       | Summary       |
|----------|------------|---------------|
| v0.1.0   | 2026-09-04 | Initial draft |

This standard defines how a [Model Context Protocol](https://modelcontextprotocol.io)
(MCP) server exposes an fmsg address to an AI agent: how the agent's identity
is established, how messages and threads are referenced, which tools and
resources are offered and what they guarantee, and the safety rules such a
server follows. It binds MCP protocol revision 2025-06-18 and later to
[FMSG-003](fmsg-003-webapi.md) v0.2.0. It is written from one implementation
and is expected to change as others appear.

## Requirements Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and
**OPTIONAL** in this document are to be interpreted as described in BCP 14
([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they
appear in all capitals.

## Scope

This standard defines:

- the two deployment profiles of an fmsg MCP server, local (stdio) and hosted
  (Streamable HTTP), and how a caller's fmsg identity is established in each;
- how messages, threads, times and addresses are represented at the MCP
  boundary;
- the MCP resources an fmsg MCP server exposes;
- a core set of tools, their arguments and the guarantees of their results;
- behavioural rules that keep an agent's actions consistent with fmsg
  semantics (thread participants, terminal and no-reply messages, reactions);
  and
- safety requirements: tool annotations, secret redaction, content framing and
  credential handling.

It does not change the fmsg protocol, [FMSG-003](fmsg-003-webapi.md) or MCP
itself, does not define how an MCP host presents tools to a person, and does
not fix the wording of tool descriptions or the rendering of results. An MCP
server that exposes fmsg through a different or narrower tool set (for example
one dedicated to sharing an agent's session as a thread) is not required to
conform; conformance is what lets prompts, skills and documentation written
against one fmsg MCP server work against another.

## Normative References

- [Model Context Protocol specification](https://modelcontextprotocol.io/specification/)
  revision 2025-06-18 or later, including Streamable HTTP transport and tool
  annotations
- [fmsg Specification](../SPECIFICATION.md)
- [FMSG-003 Web API Standard](fmsg-003-webapi.md) v0.2.0
- [FMSG-005 Reactions Standard](fmsg-005-reactions.md)
- [RFC 6750](https://www.rfc-editor.org/rfc/rfc6750) (bearer token usage)
- [RFC 3339](https://www.rfc-editor.org/rfc/rfc3339) (timestamps)

## Terminology

- **fmsg MCP server** (the *server*): an MCP server conforming to this
  standard. It is an FMSG-003 client.
- **host**: the MCP host application (an agent runtime such as a coding
  assistant or desktop assistant) and its embedded MCP client.
- **caller**: the fmsg identity a tool call acts as. Over stdio there is one
  caller per server process; over Streamable HTTP each request carries its own.
- **Web API**: the FMSG-003 service the server talks to.
- **API key**: an FMSG-003 first-party API key (`fmsgk_…`) granting one
  address.
- **message reference**: the value a tool accepts or returns to identify a
  message (see [Message References](#message-references)).
- **participants** of a message: its sender, its `to` recipients and every
  address in its add-to batches (both the adder and the added).
- **lineage** of a message: the messages from the thread root to that message
  following `pid`, as returned by the FMSG-003 thread endpoint.

## Introduction

This section is non-normative.

MCP is the common way agent runtimes discover and call tools. An fmsg MCP
server turns an fmsg address into such a tool set: an agent can read its
inbox, follow a conversation, send and reply, react, exchange attachments, and
wait for the next message to arrive. Because fmsg is federated, the agent can
converse with any address on any host, whether it belongs to a person or to
another agent.

Two ways of running such a server matter in practice. A developer's own agent
runs the server locally and configures it with one API key; this is the stdio
profile. A host operator runs one server for all of its users and each user's
agent connects over HTTP with that user's own key; this is the Streamable HTTP
profile. This standard makes the two interchangeable from the agent's point of
view.

The standard is deliberately narrow. It fixes what an agent (or a prompt
written for an agent) relies on: tool names, argument names, the shape of
results, and the rules that stop an agent doing something fmsg would reject or
a person would not expect. Everything else, including descriptions, rendering
and limits, is left to implementations, and the Web API remains the authority
on what a host accepts.

## Deployment Profiles

A server MUST support the stdio profile and MAY support the Streamable HTTP
profile. In both profiles every Web API request is made with a bearer token
obtained by exchanging the caller's API key at `POST /fmsg/token`
(FMSG-003 §Authentication), refreshed before expiry.

### stdio Profile

A server run over stdio acts as exactly one caller for its lifetime. It MUST
read its configuration from the environment using these names:

| Variable | Requirement | Meaning |
|----------|-------------|---------|
| `FMSG_API_URL` | REQUIRED | Base URL of the Web API |
| `FMSG_API_KEY` | REQUIRED | API key of the address the server acts as |
| `FMSG_DEFAULT_DOMAIN` | OPTIONAL | Domain used to resolve a bare short name `name` to `@name@domain` |
| `FMSG_DIRECTORY` | OPTIONAL | Path to a JSON object mapping short names to full addresses |

A server MAY accept further variables; they SHOULD use the `FMSG_` prefix.

A server SHOULD start and answer `initialize` and `tools/list` even when
`FMSG_API_URL` or `FMSG_API_KEY` is absent, so that hosts and directories can
inspect it; each tool call MUST then fail with an error naming the missing
variables. A server MUST NOT write anything but MCP protocol messages to
standard output.

### Streamable HTTP Profile

A server run as a hosted endpoint serves many callers. It:

- MUST expose the MCP endpoint at the path `/mcp` unless deployed under a
  different path deliberately; the hostname `mcp.<domain>` is RECOMMENDED for
  a host operator serving the addresses of `<domain>`;
- MUST require an `Authorization: Bearer <api key>` header on every request,
  where the token is an FMSG-003 API key of the caller, and MUST answer a
  request without a valid key with `401` and a `WWW-Authenticate: Bearer`
  challenge (RFC 6750);
- MUST establish the caller's address by exchanging that key at the Web API,
  MUST act only as that address for the request, and MUST NOT let one caller's
  identity, cache or tokens be observable by another;
- MUST NOT be configured with a single `FMSG_API_KEY` shared by all callers;
- SHOULD validate the `Host` header against an operator-configured allowlist
  when bound to a non-loopback address;
- MAY cache the Web API client per caller, keyed by a hash of the key, and
  MUST NOT store or log the key itself;
- SHOULD expose `GET /healthz` returning `200` for liveness checks.

Authorization by OAuth 2.1, as used by hosts that cannot send a static bearer
header, is reserved for a future revision of this standard.

## Message References

A message reference is the FMSG-003 message `id` rendered as a **decimal
string**. Servers MUST accept and return references as strings, MUST preserve
the full 64-bit value (the value MUST NOT pass through an IEEE-754 double), and
MUST reject a reference that is not a string of decimal digits.

Where the Web API supplies a message's SHA-256 (`message_sha256` in the thread
endpoint), a server SHOULD include it in results as `sha256`, and an agent
SHOULD prefer it when quoting a message to a party on another host, because
the numeric `id` is local to one host. A future revision may make the hash an
accepted reference.

Times are rendered as RFC 3339 strings in UTC; a server MAY additionally
return the FMSG-003 POSIX value as `time_posix`. A draft has a null time.

Addresses are rendered in the form `@user@domain` in lower case. Wherever a
tool accepts an address a server MAY also accept a short name and resolve it
through the directory or default domain; results MUST contain the resolved
full addresses, never the short names.

## Resources

A server MUST register these MCP resource templates:

| URI template | Content |
|--------------|---------|
| `fmsg://message/{id}` | One message: headers and, for text-like types, its body |
| `fmsg://thread/{id}` | The lineage of the message from the thread root |

Both return `text/markdown`. Neither is enumerable: `resources/list` MUST NOT
attempt to list every message. `{id}` is a message reference.

## Tools

Tool names are lower snake case. The tools below are **core**: a conforming
server MUST implement them with the given names and argument names. Every
other tool in this section is **recommended**: a server SHOULD implement it,
and if it does, MUST use the given names.

Every tool result MUST carry a human-readable text content block and MUST
carry `structuredContent` with at least the fields named below. Failures MUST
be returned as tool results with `isError: true` and a message the agent can
act on; the Web API's own error text MUST be included verbatim, since it names
the reason a host rejected something.

### Core tools

**`whoami`** — no arguments. Result: `address` (the caller's address),
`api_url`, `transport` (`stdio` or `http`).

**`list_messages`** — arguments `limit` (integer, default 20), `offset`
(integer, default 0), `include_reactions` (boolean, default false). Lists
received messages newest first. Result: `messages` (array of *message items*),
`count`, `next_offset` (integer or null).

**`get_message`** — arguments `id` (message reference), `max_body_bytes`
(integer). Result: `message` (a message item), `body` (string, or null when the
type is not text-like), `body_truncated` (boolean).

**`get_thread`** — arguments `id` (message reference), `max_messages`
(integer). Result: `root_id`, `trigger_id`, `complete` (boolean: false when a
message on the lineage is not visible to the caller or was omitted),
`participants` (all participants of the target message except the caller),
`reply_target_id`, `terminal` (boolean), `messages` (array, root first, each
with `id`, `pid`, `visible`, `from`, `to`, `time`, `topic`, `type`, `size`,
`body`, `body_truncated`, `attachments`).

**`send_message`** — arguments `to` (array of addresses, at least one),
`topic` (string), `body` (string), `type` (media type, default
`text/markdown; charset=utf-8`), `important`, `no_reply` (booleans),
`attachments` (array of `{filename, data_base64, content_type}`). Starts a new
thread and sends immediately. Result: `id`, `time`, `from`, `to`, `topic`,
`attachments`, `redactions` (integer).

**`reply`** — arguments `id` (the message replied to), `body`, `recipients`
(array, optional), `type`, `important`, `no_reply`, `allow_no_reply` (boolean,
default false), `attachments`. Sends a reply linked by `pid` immediately.
Result: as `send_message` plus `parent_id`.

A *message item* has at least: `id`, `pid` (or null), `from`, `to`, `topic`,
`time`, `read` (boolean or null), `important`, `no_reply`, `terminal`
(booleans), `type`, `size`, `preview` (string), `attachments`
(`{filename, size}` array), `reactions` (`{emoji, from[]}` array), and
`sha256` when available.

### Recommended tools

**`list_sent`** — as `list_messages` over sent messages, each item with
`delivery` (array of `{addr, status, time, code, via}` where `status` is
`delivered`, `pending` or `failed`).

**`delivery_status`** — argument `id`. Result: `id`, `sent_at`, `recipients`
(the `delivery` array above, including recipients added later).

**`add_recipients`** — arguments `id`, `add_to` (array of addresses). Result:
`id`, `added` (integer), `add_to` (resolved addresses).

**`react`** — arguments `id`, `emoji` (string, or null/empty to clear). Result:
`id`, `reaction_id` (or null), `cleared` (boolean).

**`mark_read`** — argument `ids` (array). Result: `marked`, `failed` (arrays).

**`download_attachment`** — arguments `id`, `filename`, and either an inline
size cap or, in the stdio profile only, `save_to` (absolute path). Returns the
bytes as an embedded `resource` content block (base64) or writes the file.
Result: `id`, `filename`, `size`, `content_type`, `saved_to` (or null). A
hosted server MUST reject `save_to`.

**`resolve_address`** — argument `name`. Result: `address`, `resolution`
(`literal`, `directory` or `default_domain`). Sends nothing.

**`wait_for_message`** — arguments `after_id` (message reference, optional),
`thread_of` (message reference, optional), `from` (address, optional),
`timeout_seconds`, `settle_seconds` (integers). Blocks until a qualifying
received message arrives, using the FMSG-003 WebSocket where available and
polling otherwise, then returns it. Result: `status` (`message` or `timeout`),
`after_id` (the value to pass on the next call), `thread_root_id`,
`reply_target_id`, `messages` (message items with `body`, oldest first),
`transport` (`websocket` or `poll`). Messages arriving on the same thread
within `settle_seconds` of the first MUST be returned together; the caller's
own messages, reaction messages and `no_reply` messages MUST NOT qualify. A
server MUST cap a single call well below common host tool-call limits (230
seconds is RECOMMENDED) and return `timeout` rather than fail when the cap is
reached.

## Behavioural Rules

- **Reply-all by default.** When `reply` is called without `recipients`, the
  recipients MUST be the participants of the message replied to, minus the
  caller. The set is taken from the message itself, not from the thread root.
- **Terminal messages.** A server MUST refuse `reply`, `add_recipients` and
  `react` on a message whose `terminal` flag is set, before contacting the Web
  API, and SHOULD say so in `get_thread` results.
- **No-reply messages.** A server MUST refuse `reply` to a message whose
  `no_reply` flag is set unless the call carries `allow_no_reply: true`, and
  `wait_for_message` MUST NOT return such messages.
- **Reactions.** Messages that are themselves reactions (FMSG-005:
  `reaction` non-null) MUST be excluded from `list_messages` and
  `wait_for_message` unless explicitly requested.
- **Atomic send.** `send_message` and `reply` MUST create the draft, upload
  every attachment and send in one tool call, and MUST delete the draft if a
  later step fails, so that a failed call leaves nothing behind.
- **Host authority on limits.** A server MUST NOT impose its own message,
  attachment or thread limits in place of the Web API's, and MUST NOT warn
  about assumed limits of other hosts. Size and acceptance rejections are the
  Web API's to report; a server surfaces them verbatim, including per-recipient
  delivery codes.
- **Identity per request.** A tool MUST act only as the caller established by
  the profile in use; it MUST NOT accept an argument that changes the sending
  address.

## Safety Requirements

- **Annotations.** Tools that only read MUST be annotated `readOnlyHint: true`.
  `send_message`, `reply` and `add_recipients` MUST be annotated
  `destructiveHint: true`, and their descriptions MUST state that sent fmsg
  messages cannot be edited or recalled. These are what hosts use to decide
  when to ask a person before acting.
- **Immediate send.** Sending is not made conditional on a server-side
  confirmation step; the host's tool-approval flow is the confirmation.
  A server MAY offer a preview mechanism in addition.
- **Secret redaction.** Before sending, a server MUST replace any substring
  matching the FMSG-003 API key format (`fmsgk_` followed by key material) in
  the topic and body with a placeholder, SHOULD do the same for other
  well-known credential formats (JWTs, hosting-provider tokens, private key
  blocks), and MUST report the number of replacements in the result.
- **Content framing.** Message content returned to the agent (bodies, thread
  context, attachment names) MUST be presented as data from other parties and
  MUST be preceded by a statement that it is not an instruction to the agent.
- **Credentials.** A server MUST NOT include API keys or access tokens in tool
  results, resources, logs or error text. Error text MUST pass through the same
  redaction as outbound messages.
- **Downloads.** In the stdio profile a server MAY write attachments to disk
  only at a path the caller supplies, and SHOULD allow the operator to confine
  such writes to a directory.

## Prompts

A server MAY register MCP prompts. Where it offers them, the names `chat`
(arm a wait, reply, wait loop within a thread, with caps on replies and idle
time) and `reply` (load a thread, summarise it, draft a reply for approval)
are RECOMMENDED so that they surface consistently across hosts.

## Conformance

A server conforms to this standard when it:

1. supports the stdio profile with the environment variables above;
2. implements every core tool with the given names, argument names and result
   fields, and each recommended tool it offers with the given names;
3. registers the `fmsg://message/{id}` and `fmsg://thread/{id}` resources;
4. represents message references as decimal strings without loss;
5. follows every rule in [Behavioural Rules](#behavioural-rules) and
   [Safety Requirements](#safety-requirements); and
6. if it offers the Streamable HTTP profile, meets every requirement of that
   profile.

### Minimum interoperability test

Against two federated hosts, with the server acting as an address on the
first:

1. a request without a bearer key to a hosted server is answered `401`
   (Streamable HTTP profile only);
2. `whoami` reports the configured address;
3. `send_message` to an address on the second host succeeds and the message
   arrives there;
4. a reply sent from the second host is returned by `wait_for_message` with
   `reply_target_id` set;
5. `get_thread` on that reply shows both messages with the first host's
   address as the sole participant besides the caller;
6. `react` on the reply succeeds; and
7. `delivery_status` on the sent message reports the recipient as
   `delivered`.

### Reference implementation

[fmsg-mcp](https://github.com/markmnl/fmsg-mcp) (npm `@markmnl/fmsg-mcp`) is
the reference implementation of this standard; its end-to-end suite in
[fmsg-docker](https://github.com/markmnl/fmsg-docker) performs the test above.

## Security Considerations

An fmsg MCP server places an agent, and through it a language model, in
control of a messaging identity. Three risks dominate.

**Prompt injection through message content.** Every message an agent reads
was written by someone else, possibly another agent. The content framing
requirement and the read-only annotations exist so that a host can keep such
content from being mistaken for instructions and can require a person's
approval before anything is sent. Servers SHOULD keep the framing text short
and consistent so hosts can recognise it.

**Credential exposure.** An API key grants an address. Hosted servers see many
keys; they MUST treat them as secrets in transit only, never persisting them.
The redaction rules stop an agent from leaking its own key, or another key it
has seen, into an immutable message.

**Irreversible actions.** fmsg messages cannot be edited or recalled once sent,
and recipients added cannot be removed. The destructive annotations and the
atomic send rule limit the damage of a wrong call to one complete, intentional
message.

Hosted servers additionally face the usual concerns of a public HTTP service:
TLS termination in front, `Host` validation to defeat DNS rebinding on
loopback binds, and long-poll timeouts for `wait_for_message` configured on
any intermediary.

## Example

A host calls `send_message` over Streamable HTTP as `@alice@example.com`:

```http
POST /mcp HTTP/1.1
Host: mcp.example.com
Authorization: Bearer fmsgk_…
Content-Type: application/json
Accept: application/json, text/event-stream

{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"send_message",
 "arguments":{"to":["@bob@example.net"],"topic":"Lunch?","body":"Thursday at noon?"}}}
```

The result carries both renderings:

```json
{"jsonrpc":"2.0","id":7,"result":{
  "content":[{"type":"text","text":"Sent message 2502 \"Lunch?\" to @bob@example.net at 2026-09-04T01:15:03.512Z."}],
  "structuredContent":{"id":"2502","time":"2026-09-04T01:15:03.512Z","from":"@alice@example.com",
    "to":["@bob@example.net"],"topic":"Lunch?","parent_id":null,"attachments":[],"redactions":0}}}
```

Bob's agent, waiting with `wait_for_message`, receives the message with its
thread context and replies with `reply` to `reply_target_id`; the reply
reaches Alice's host as a message whose `pid` is Bob's copy of `2502`.
