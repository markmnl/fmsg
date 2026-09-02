# FMSG-005 Reactions Standard

## Status

| Revision | Date       | Summary       |
|----------|------------|---------------|
| v0.1.0   | 2026-09-02 | Initial draft |

This standard defines how a participant reacts to a message with a single
emoji. A reaction is an ordinary plain-text fmsg message, recognised by its
shape rather than by a dedicated type, constrained so that it can be verified,
delivered, and stored by any conforming host, and so that no message can be
built on top of it.

This revision requires fmsg Specification v0.6.0 or later for the _terminal_
flag.

## Requirements Language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**,
**SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **NOT RECOMMENDED**, **MAY**, and
**OPTIONAL** in this document are to be interpreted as described in BCP 14
([RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174)) when, and only when, they
appear in all capitals.

## Scope

This standard defines:

- the shape of a reaction message on the wire;
- which emoji a reaction may carry;
- who a reaction is delivered to;
- how a participant's effective reaction on a message is determined, including
  changing and clearing it; and
- how hosts and clients that do not implement this standard behave.

It does not change the host-to-host protocol, define a client API, or require
a host to understand reactions in order to carry them. The client API for
reactions is defined by [FMSG-003](fmsg-003-webapi.md) v0.2.0 and later.

## Normative References

- [fmsg Specification](../SPECIFICATION.md) v0.6.0 or later
- [UTS #51: Unicode Emoji](https://www.unicode.org/reports/tr51/)
- [RFC 3629: UTF-8](https://www.rfc-editor.org/rfc/rfc3629)

## Terminology

**subject** is the message a reaction refers to via _pid_. It may be a
thread's first message, a reply, or an add-to batch message.

**reactor** is the address in a reaction message's _from_ field.

**reaction message** is an fmsg message meeting the requirements in
[Reaction Message](#reaction-message).

**effective reaction** is the reaction, if any, that a reactor currently has
on a subject, determined per [Effective Reaction](#effective-reaction).

Other terms have the meanings given in the fmsg Specification.

## Introduction

This section is non-normative.

Reactions are lightweight acknowledgements such as 👍 or ❤️ attached to a
message rather than sent as a reply. Modelling them as messages rather than as
a separate side channel means they inherit everything fmsg already provides:
reliable store-and-forward delivery with retries, duplicate detection, the
participant rule (only a participant of the subject can react to it), the
challenge, and immutable, hash-verifiable storage.

The one property reactions need that an ordinary reply lacks is that nothing
can be built on top of them: a reaction cannot be replied to, reacted to, or
have recipients added. The Specification's _terminal_ flag provides exactly
that, and every host enforces it whether or not it knows what a reaction is.

Because messages are immutable, changing or removing a reaction is done by
sending a newer reaction whose data replaces the earlier one.

A reaction has no Media Type of its own. Its data is UTF-8 text, and a Media
Type describes representation, not intent; the intent is already carried by
the flags. A reaction is therefore any terminal, no-reply, plain-text reply
whose whole body is a single emoji. A person who sends exactly that as a reply
meant it as a reaction, and clients that know nothing of this standard render
it as the short text message it is.

## Reaction Message

A message is a reaction message if and only if it has all of the following
properties. There is no separate reaction type: a message is recognised as a
reaction by its shape, and a message lacking any property is an ordinary
message, see [Recognising Reactions](#recognising-reactions).

### Flags

| Flag bit | Name | Requirement |
|---------:|------|-------------|
| 0 | has pid | MUST be set. |
| 1 | has add to | MUST NOT be set. |
| 2 | common type | MUST be set. |
| 3 | important | MUST NOT be set. |
| 4 | no reply | MUST be set. |
| 5 | zlib-deflate | MUST NOT be set. |
| 6 | terminal | MUST be set. |

_terminal_ is what prevents chaining. _no reply_ is set in addition so that
hosts and clients that predate the _terminal_ flag, but recognise _no reply_,
still present the reaction as something not to be replied to.

### Fields

| Field | Requirement |
|-------|-------------|
| _pid_ | The message hash of the subject. |
| _from_ | The reactor. Per the Specification the reactor MUST be a participant of the subject. |
| _to_ | Every participant of the subject other than the reactor, see [Recipients](#recipients). |
| _topic_ | Absent, because _pid_ is present. |
| _type_ | Common Media Type ID 56, `text/plain;charset=UTF-8`. |
| _size_ | 0, or the byte length of _data_, which MUST NOT exceed 64. |
| _attachment headers_ | Count MUST be 0. |
| _data_ | Empty, or exactly one emoji encoded as UTF-8, see [Emoji](#emoji). |

### Emoji

Non-empty _data_ MUST be the UTF-8 encoding of exactly one element of the
Unicode `RGI_Emoji` set defined by UTS #51, that is a single Recommended for
General Interchange emoji: a basic emoji, keycap sequence, flag sequence, tag
sequence, modifier sequence, or ZWJ sequence. Fully-qualified sequences
SHOULD be used.

Implementations SHOULD validate against the `RGI_Emoji` set of the most recent
Unicode version they support. Because that set grows over time, an
implementation encountering non-empty _data_ that is a single extended
grapheme cluster (UAX #29) whose code points all have the `Emoji`,
`Emoji_Component`, or `Emoji_Modifier` property, or are ZWJ or a variation
selector, SHOULD treat it as a reaction it cannot render rather than as an
ordinary message.

Empty _data_ (_size_ 0) means the reactor has no reaction on the subject, see
[Effective Reaction](#effective-reaction).

### Recipients

_to_ MUST contain every participant of the subject except the reactor, so that
all participants observe the reaction. The subject's participants are its
_from_, every address in its _to_, and, when the subject is an add-to batch
message, its _add to from_ and every address in its _add to_.

Where the reactor is the only participant of the subject this standard cannot
apply, because a message requires at least one recipient; a reaction to a
message one sent only to oneself is not sent.

## Effective Reaction

A reactor has at most one effective reaction on a subject.

Among all reaction messages held by a host whose _from_ is the reactor and
whose _pid_ is the subject, the one with the greatest _time_ determines the
effective reaction. If two such messages share the same _time_, the one whose
message hash is greater when compared as an unsigned big-endian integer
determines it. If that message's _data_ is empty, the reactor has no effective
reaction on the subject. Otherwise its _data_ is the effective reaction.

Changing a reaction is therefore sending a new reaction message with the new
emoji, and clearing a reaction is sending one with empty _data_. Earlier
reaction messages remain stored and verifiable; they simply no longer
determine the effective reaction.

Because the Specification rejects a reply whose _time_ precedes its parent's,
every reaction message has a _time_ after the subject's.

## Sending

A reaction message is created, sent, retried, and recorded exactly as any
other message per the Specification. Nothing about its delivery is different.

A client or host MUST NOT create a reaction whose subject has the _terminal_
flag bit set. In particular a reaction cannot itself be the subject of a
reaction. The Specification's Sending Host rule enforces this for hosts that
implement v0.6.0.

## Receiving

A Receiving Host applies the Specification unchanged. This standard adds no
header validation: a host need not recognise reactions to accept, challenge,
store, and deliver one, because on the wire a reaction is a plain-text
terminal reply.

### Recognising Reactions

A host or client that implements this standard determines whether a stored
message is a reaction by testing it against [Reaction Message](#reaction-message)
after the message is stored. A message meeting every property is a reaction
and contributes to the effective reaction of its reactor on its subject. Any
other message, including a terminal plain-text reply whose data is not a
single emoji, is an ordinary message and MUST NOT contribute to any effective
reaction.

There is consequently no malformed reaction and nothing to reject on the wire:
a message either has the shape of a reaction or is simply a reply.

Implementations SHOULD treat a _type_ encoded as the string
`text/plain;charset=UTF-8` with the _common type_ flag bit not set as
equivalent to Common Media Type ID 56 when recognising reactions; senders
MUST use ID 56. Implementations MAY ignore the [Recipients](#recipients)
requirement when recognising a stored reaction, since a host cannot always
know a subject's full participant set.

## Presentation

This section is non-normative.

Clients that implement this standard are expected to:

- render, on each message, the set of effective reactions grouped by emoji
  with the reactors of each, rather than rendering reaction messages as
  replies in the thread;
- offer a way to add, change, and clear the viewer's own reaction on any
  message they are a participant of that is not terminal;
- keep the viewer's own reactions consistent across devices by reading the
  stored reaction messages rather than local state; and
- treat an incoming reaction message as a low-priority event that does not
  warrant the notification an ordinary message would.

Clients that do not implement this standard see a short plain-text reply
containing an emoji, or an empty one, with _no reply_ set. That is the intended
degradation, and it is why reactions carry no type of their own.

## Interoperability

| Peer | Behaviour |
|------|-----------|
| Host implementing Specification v0.6.0 and this standard | Accepts, stores, and delivers the reaction; exposes it to its clients as a reaction. |
| Host implementing Specification v0.6.0 only | Accepts, stores, and delivers the reaction as an ordinary terminal message. Its clients see it as a small message. Nobody can reply to it. |
| Host implementing a Specification version before v0.6.0 | Rejects the reaction with code 1 (invalid) because the _terminal_ bit is a reserved bit set. The reactor's host records the rejection like any other and its clients can show that the recipient host does not support reactions. |

## Security Considerations

- **Volume:** each reaction is a stored message and a connection per recipient
  domain. The Specification's per-connection and per-IP rate limits and
  per-user storage quotas apply. Hosts MAY apply stricter rate limits to
  messages having the shape of a reaction.
- **Rendering:** implementations MUST NOT place _data_ that is not a single
  `RGI_Emoji` in a reaction slot. The shape test is what prevents arbitrary
  text from being displayed as a reaction.
- **Participant rule:** reactions inherit the Specification's participant
  check, so an address that is not a participant of the subject cannot react
  to it, and a host cannot be tricked into showing one.
- **Disclosure:** a reaction discloses to all participants of the subject that
  the reactor reacted and with what. It discloses nothing they could not
  already infer from being participants.

## Examples

This section is non-normative.

A reaction by `@bob@example.com` to a message from `@alice@example.com` sent
to Bob and `@chris@example.edu`:

```JSON
{
    "version": 1,
    "important": false,
    "noreply": true,
    "terminal": true,
    "pid": "3f8a…c21e",
    "from": "@bob@example.com",
    "to": [
        "@alice@example.com",
        "@chris@example.edu"
    ],
    "time": 1788393600.120384,
    "type": "text/plain;charset=UTF-8",
    "size": 4,
    "data": "👍",
    "attachments": []
}
```

On the wire _type_ is the single byte 56 with the _common type_ flag bit set.

Bob later clears the reaction by sending the same message with a later
_time_, _size_ 0, and no data.
