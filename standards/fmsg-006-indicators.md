# FMSG-006 Indicators Standard

## Status

| Revision | Date       | Summary       |
|----------|------------|---------------|
| v0.1.0   | 2026-09-02 | Initial draft |

This standard defines indicators: short-lived, unreliable signals such as
"composing a reply" that a participant of a message shows to the message's
other participants. Indicators travel host to host as UDP datagrams, are never
acknowledged, and are never stored.

## Requirements Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and
**OPTIONAL** in this document are to be interpreted as described in BCP 14
([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they
appear in all capitals.

## Scope

This standard defines:

- the indicator datagram and its UDP binding;
- how the indicating participant is identified without placing an address on
  the wire;
- the verification a receiving host performs before accepting a datagram;
- the sending host's fan-out and rate limits;
- how a participant's indicator state is derived and when it expires; and
- a recommended vocabulary of indicator emoji.

It does not change the fmsg host-to-host protocol or the message format, does
not define a client API, and does not require a host to implement it. A host
that does not implement this standard is unaffected: it does not listen, and
datagrams sent to it are lost, which is the defined outcome. Client API
exposure of indicators is expected in a future revision of
[FMSG-003](fmsg-003-webapi.md).

## Normative References

- [fmsg Specification](../SPECIFICATION.md) v0.6.0 or later
- [FMSG-001 TCP+TLS Transport and Binding Standard](fmsg-001-transport-and-binding.md)
- [FMSG-005 Reactions Standard](fmsg-005-reactions.md)
- [RFC 768: User Datagram Protocol](https://www.rfc-editor.org/rfc/rfc768)
- [RFC 2827 (BCP 38): Network Ingress Filtering](https://www.rfc-editor.org/rfc/rfc2827)
- [UTS #51: Unicode Emoji](https://www.unicode.org/reports/tr51/)

## Terminology

**subject** is the message an indicator refers to via its message hash. It may
be a thread's first message, a reply, or an add-to batch message.

**indicating participant** is the participant of the subject whose state the
indicator conveys.

**indicator state** is the emoji, if any, that an indicating participant
currently shows on a subject, determined per
[Indicator State](#indicator-state).

**participant index** is the position of an address among the subject's wire
fields, defined in [Participant Index](#participant-index).

Other terms have the meanings given in the fmsg Specification.

## Introduction

This section is non-normative.

Messaging clients show that someone is composing a reply, that an agent is
working on one, or that a file is being attached. These signals are useful for
a few seconds and worthless afterwards. Carrying them as fmsg messages would
give them delivery guarantees, storage, and hashes they do not need and would
fill every host's store with noise. Indicators are instead sent as single UDP
datagrams: fire and forget, verified enough to prevent forgery, fanned out to
whoever is connected at that moment, and then discarded.

An indicator is the ephemeral twin of a reaction. [FMSG-005](fmsg-005-reactions.md)
defines a participant's durable state on a message as a single emoji, empty to
clear, latest wins. An indicator is the same shape with a lifetime: a single
emoji that is a participant's transient state on a message, expiring unless
refreshed. A client that recognises ✍️ shows the familiar composing bubble; one
that does not still shows the emoji beside the participant's name. New kinds of
indicator therefore need no change to this standard.

No address appears in a datagram. The indicating participant is named by their
position among the subject's participants, which only a host holding the
subject can resolve. The subject's hash is likewise meaningful only to hosts
that hold it. A datagram observed on the network reveals which two hosts are
exchanging one and nothing more.

## Datagram

All integers are little-endian. Fields are read sequentially.

| # | Field | Type | Notes |
|---|-------|------|-------|
| 1 | version | uint8 | 1 for this revision. |
| 2 | hash | 32 bytes | Message hash of the subject, per the Specification's Computing Message Hash. |
| 3 | index | uint16 | Participant index of the indicating participant, see [Participant Index](#participant-index). |
| 4 | ttl | uint8 | Seconds the state remains valid unless refreshed. 0 clears the state immediately. |
| 5 | data | uint8 length + UTF-8 | The indicator emoji, or empty to clear. Length MUST NOT exceed 64. |

A datagram is exactly these fields; any trailing bytes make it invalid. A
receiving host MUST silently drop a datagram it cannot parse, whose version it
does not support, whose data length exceeds 64, or whose non-empty data is not
a single emoji per [Emoji](#emoji).

An empty data field with any _ttl_ clears the indicating participant's state.
A _ttl_ of 0 with non-empty data is treated the same as empty data: the state
is cleared.

### Emoji

Non-empty _data_ MUST be the UTF-8 encoding of exactly one element of the
Unicode `RGI_Emoji` set defined by UTS #51, subject to the same rules and the
same leniency as FMSG-005 [Emoji](fmsg-005-reactions.md#emoji). Implementations
compare emoji as exact byte strings; ✍ and ✍️ are different indicators.

### Participant Index

The participants of the subject are the addresses in its wire fields, in
field order:

1. _from_;
2. each address in _to_, in order;
3. if the subject has _has add to_ set, _add to from_;
4. if the subject has _has add to_ set, each address in _add to_, in order.

The participant index is the zero-based position in that sequence: _from_ is
0, the first _to_ address is 1, and so on. Because _add to from_ repeats an
address already in _from_ or _to_, and an address MAY appear in both _to_ and
_add to_, one address can have several indices. They are equivalent; a sender
SHOULD use the lowest. A receiving host MUST drop a datagram whose index is
out of range for the subject.

A host holds every recipient of a stored message exactly as transmitted (the
Specification's Verifying Message Stored), so any host holding the subject can
resolve an index. A host that does not hold the subject cannot, and drops the
datagram.

## UDP Binding

Indicators are sent as UDP datagrams to port 4930, the same port number
FMSG-001 assigns to TCP. A host implementing this standard MUST listen on UDP
port 4930 on every address in its `fmsg.<domain>` A and AAAA record set, and
MUST send indicators from an address in that set, because receivers verify the
source address against it.

The Sending Host resolves `fmsg.<domain>` per the Specification's Domain
Resolution and sends one datagram to one resolved address. It MAY alternate
between addresses on successive datagrams. Nothing is ever sent in reply. A
sending host MUST ignore ICMP errors beyond using them to pause sending to
that host.

Datagrams are not encrypted. Implementations MUST NOT place anything other
than the fields above in a datagram.

## Sending

A participant's client tells its host that the participant has a state on a
subject. The host is the Sending Host only when the indicating participant's
address belongs to its domain; a host MUST NOT send an indicator for an address
it does not host.

The Sending Host MUST send the datagram to every unique participant domain of
the subject other than its own domain. The subject's participant domains are
the domains of every address in the sequence defined by
[Participant Index](#participant-index). Participants on the Sending Host's own
domain are informed through the host's client API directly, never over the
wire.

### Refresh and Clear

A client SHOULD refresh a continuing state before its _ttl_ lapses, and SHOULD
send a clearing datagram when the state ends, for example when the composed
reply is sent or discarded. Both are best effort: a receiving host expires the
state on its own when no refresh arrives.

### Rate Limits

Indicators are cheap to send and cheap to drop, so limits are enforced on the
sending side, per receiving host, before anything reaches the network. A
Sending Host MUST:

- send at most one datagram per (subject, participant index) every
  INDICATOR_MIN_INTERVAL seconds, coalescing more frequent state changes into
  the latest; and
- send at most INDICATOR_HOST_RATE datagrams per second to any one receiving
  domain, dropping the excess.

| Variable | Description | Recommended |
|----------|-------------|-------------|
| INDICATOR_MIN_INTERVAL | Minimum seconds between datagrams for one participant on one subject. | 2 |
| INDICATOR_HOST_RATE | Maximum datagrams per second to one receiving domain. | 20 |
| INDICATOR_TTL_MAX | Longest _ttl_ a host accepts; larger values are clamped. | 120 |

A clearing datagram (empty data) SHOULD be exempt from INDICATOR_MIN_INTERVAL
so that an ended state clears promptly.

## Receiving

A Receiving Host performs the following steps for each datagram and MUST drop
the datagram silently at the first step that fails. Steps are ordered so the
cheapest checks run first.

1. Enforce a per-source-address rate limit; drop the excess.
2. Parse the datagram per [Datagram](#datagram).
3. Look up the subject by _hash_ among the messages the host has stored,
   including add-to batch messages by batch hash (the Specification's
   Verifying Message Stored). Not found: drop.
4. Resolve _index_ per [Participant Index](#participant-index). Out of range:
   drop.
5. Resolve `fmsg.<domain>` for the domain of the address at _index_, per the
   Specification's Domain Resolution, and verify the datagram's source address
   is in the resolved set. DNS results SHOULD be cached. Not in set: drop.
6. Clamp _ttl_ to INDICATOR_TTL_MAX.
7. Deliver the indicator to every participant of the subject hosted on this
   domain other than the indicating participant, through the host's client
   API, and then discard it.

A Receiving Host MUST NOT store an indicator beyond what delivery to currently
connected clients requires, MUST NOT send anything in response, and MUST NOT
generate a push notification or any other durable notification from an
indicator.

Because the hash is known only to hosts holding the subject and the source
address must match the indicating participant's domain, forging an indicator
requires both possession of the message and a spoofed source address that
survives ingress filtering (BCP 38). That is the level of assurance an
unacknowledged, unencrypted, disposable signal warrants, and no more.

## Indicator State

An indicating participant has at most one state on a subject. The most
recently received datagram from that participant on that subject determines
it: its _data_ is the state, empty means none, and the state expires _ttl_
seconds after receipt unless a later datagram replaces it. Datagrams may be
lost or reordered; a client displays whatever the latest received datagram
says and relies on expiry to correct anything stale.

State is held wherever it is displayed, normally in the client. Hosts need not
track it.

## Recommended Indicators

This section is non-normative. Any single emoji is a valid indicator; the
following meanings are recommended so that clients interoperate for the common
cases and can style them specially. Suggested TTLs assume the sender refreshes
at INDICATOR_MIN_INTERVAL.

| Emoji | Meaning | Suggested TTL |
|-------|---------|---------------|
| ✍️ | Composing a reply to the subject | 6 s |
| ⏳ | Processing: an agent is working on a reply | 60 s |
| 🎙️ | Recording a voice reply | 10 s |
| 📎 | Attaching a file to a reply | 15 s |
| 👀 | Viewing the subject | 30 s |

Clients SHOULD show an indicator they do not recognise as the emoji itself
beside the participant's address, and SHOULD render ✍️ as a composing
indication. Clients SHOULD treat sending 👀 as opt-in, since it discloses
attention rather than activity.

## Interoperability

| Peer | Behaviour |
|------|-----------|
| Host implementing this standard | Verifies and fans out to its connected participants. |
| Host not implementing this standard | Does not listen on UDP 4930; datagrams are discarded by the network stack. The sender neither knows nor needs to. |
| Host holding the subject but not the indicating participant's message hash form | Cannot occur: a host that holds the subject holds its hash. |

Indicators require no change to the Specification or to FMSG-001. Firewalls
in front of a host implementing this standard need UDP 4930 open inbound on
the addresses in `fmsg.<domain>`, and outbound from them.

## Security Considerations

- **Forgery:** mitigated by the hash-as-capability and source-address checks
  in [Receiving](#receiving). A host on the same domain as a participant could
  forge that participant's indicators; it could also forge their messages, so
  this adds no new trust.
- **Amplification and reflection:** none. A host never responds to a datagram,
  never resolves DNS before the cheaper hash lookup fails, and rate-limits per
  source address.
- **Disclosure:** the wire carries a hash, an index and an emoji. An observer
  learns that two hosts exchanged an indicator, which the TCP connection for
  the eventual reply would reveal anyway. A host that later obtains the
  subject could correlate captured datagrams with it; the emoji is the only
  content exposed, and senders SHOULD NOT convey anything sensitive through
  their choice of it.
- **Presence leakage:** 👀 and similar states disclose attention. Clients
  SHOULD require the user to opt in to sending them.
- **Resource use:** the per-datagram work before the hash lookup is parsing
  only; the lookup is one indexed query. Hosts SHOULD bound the number of
  indicators fanned out per second per client.

## Examples

This section is non-normative.

Alice at `example.com` sent a message to Bob at `example.edu` and Carol at
`example.org`. Bob starts composing a reply. His host sends, to
`fmsg.example.com` and `fmsg.example.org`, a datagram whose fields are:

```
version  1
hash     <message hash of Alice's message>
index    1          (Bob is the first address in to)
ttl      6
data     "✍️"       (length 6, bytes E2 9C 8D EF B8 8F)
```

Alice's host looks up the hash, finds the message, resolves index 1 to Bob,
resolves `fmsg.example.edu`, confirms the source address, and forwards
"Bob ✍️" to Alice's connected clients. Bob's host repeats the datagram every
two seconds while he types. When he sends the reply, his host sends the same
datagram with an empty data field and Alice's client removes the indication;
had that datagram been lost, the indication would have lapsed six seconds
after the last refresh.
