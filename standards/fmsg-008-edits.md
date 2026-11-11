# FMSG-008 Edits Standard

## Status

| Revision | Date       | Summary       |
|----------|------------|---------------|
| v0.1.0   | 2026-11-11 | Initial draft |

This standard defines how the author of a message edits its data after it has
been sent, for example to correct a typo or rephrase a sentence. An edit is an
ordinary fmsg message that describes, as a short list of copy and insert
operations, how to derive the edited data from the data of the message it
replies to. Clients implementing this standard display the edited data in
place of the original.

Nothing is changed in the host-to-host protocol and no stored message is
altered: the original stays stored, immutable, and verifiable by its hash.

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

- the shape of an edit message on the wire;
- the edit document carried as its data, and how it is applied;
- who may edit a message and who an edit is delivered to;
- how the effective edit of a message is determined, including replacing and
  reverting it; and
- how hosts and clients that do not implement this standard behave.

It does not change the host-to-host protocol, define a client API, or require
a host to understand edits in order to carry them. It covers a message's
_data_ only: a message's _topic_, attachments, flags, recipients, and _type_
cannot be edited by this revision.

## Normative References

- [fmsg Specification](../SPECIFICATION.md) v0.6.0 or later
- [RFC 6838: Media Type Specifications and Registration Procedures](https://www.rfc-editor.org/rfc/rfc6838)

## Terminology

**subject** is the message an edit refers to via _pid_. It may be a thread's
first message, a reply, or an add-to batch message.

**editor** is the address in an edit message's _from_ field.

**subject data** is the subject's _data_ after decompression, that is, the
bytes covered by the subject's message hash.

**edit document** is the non-empty _data_ of an edit message after
decompression, see [Edit Document](#edit-document).

**edit message** is an fmsg message meeting the requirements in
[Edit Message](#edit-message).

**effective edit** is the edit, if any, currently in force on a subject,
determined per [Effective Edit](#effective-edit).

**edited data** is the result of applying the effective edit to the subject
data.

Other terms have the meanings given in the fmsg Specification.

## Introduction

This section is non-normative.

Messages in fmsg are immutable: a message's hash covers every byte of it, and
replies reference that hash. An edit therefore cannot alter the message. It is
instead a new message, sent by the same author as a reply to the original,
saying how the original's data should now read. The original and the edit are
both stored and verifiable, so every participant can always see what was
written first, what it was changed to, and when.

Modelling edits as messages means they inherit what fmsg already provides:
reliable store-and-forward delivery with retries, duplicate detection, the
participant rule, the challenge, and hash-verifiable storage. The _terminal_
flag makes an edit a leaf, so nothing can reply to, react to, or edit an edit.

Most messaging systems that support editing send the complete replacement
text, because a diff is only safe when both sides hold exactly the same base.
fmsg has that guarantee for free: an edit's _pid_ is the SHA-256 of the exact
message being edited, and a host cannot accept a reply whose parent it does
not hold. An edit can therefore be a delta against the subject data, a few
bytes to fix a typo in a message of any size, and it applies deterministically
everywhere.

The delta is deliberately minimal: a sequence of operations that either copy
a byte range from the subject data or insert literal bytes. It works on the
bytes of any Media Type, takes a few lines of code to apply, and a full
replacement is simply a single insert.

Because an edit is terminal, edits do not chain. Every edit of a message is a
reply to that message and a delta against its original data, and the newest
one wins. This is the same model [FMSG-005](fmsg-005-reactions.md) uses for a
participant's effective reaction.

Unlike a reaction, an edit has a Media Type of its own. A reaction is
recognisable by its shape, a lone emoji; an edit's data is an opaque delta and
needs a type to say so.

## Edit Message

A message is an edit message if and only if it has all of the properties in
[Flags](#flags) and [Fields](#fields), its editor is permitted per
[Editor](#editor), and its _data_ is either empty or a well-formed
[Edit Document](#edit-document) for its subject. A message lacking any of
these is an ordinary message, see [Recognising Edits](#recognising-edits).

### Flags

| Flag bit | Name | Requirement |
|---------:|------|-------------|
| 0 | has pid | MUST be set. |
| 1 | has add to | MUST NOT be set. |
| 2 | common type | MUST NOT be set. |
| 3 | important | MUST NOT be set. |
| 4 | no reply | MUST be set. |
| 5 | zlib-deflate | MAY be set when _data_ is not empty. |
| 6 | terminal | MUST be set. |

_terminal_ is what prevents chaining. _no reply_ is set in addition so that
clients which do not implement this standard present the edit as something not
to be replied to.

### Fields

| Field | Requirement |
|-------|-------------|
| _pid_ | The message hash of the subject. |
| _from_ | The editor, see [Editor](#editor). |
| _to_ | Every participant of the subject other than the editor, see [Recipients](#recipients). |
| _topic_ | Absent, because _pid_ is present. |
| _type_ | The Media Type string `application/vnd.fmsg.edit`. |
| _size_ | 0, or the on-wire byte length of _data_. |
| _attachment headers_ | Count MUST be 0. |
| _data_ | Empty, or an edit document, see [Edit Document](#edit-document). |

Senders MUST encode _type_ exactly as `application/vnd.fmsg.edit`, in lower
case and without parameters. When recognising edits, implementations MUST
compare _type_ case-insensitively.

### Editor

The editor MUST be the subject's _from_, compared case-insensitively. Only the
author of a message's data can edit it.

When the subject is an add-to batch message, its _from_ is the _from_ of the
original message, not its _add to from_: the participant who added recipients
did not write the data and cannot edit it.

### Recipients

_to_ MUST contain every participant of the subject except the editor, so that
all participants observe the edit. The subject's participants are its _from_,
every address in its _to_, and, when the subject is an add-to batch message,
its _add to from_ and every address in its _add to_.

Where the editor is the only participant of the subject this standard cannot
apply, because a message requires at least one recipient.

### Edit Document

An edit document describes how to produce the edited data from the subject
data. All integers are little-endian, as in the Specification.

| Field | Type | Notes |
|-------|------|-------|
| result size | uint32 | Byte length of the edited data. |
| operations | zero or more operations | Read sequentially until the end of the edit document. |

Each operation begins with a one-byte code:

| Code | Name | Following fields | Effect |
|-----:|------|------------------|--------|
| 0 | copy | offset uint32, length uint32 | Appends _length_ bytes of the subject data starting at byte _offset_. |
| 1 | insert | length uint32, then _length_ bytes | Appends the _length_ literal bytes. |

Offsets and lengths count bytes of the subject data, not characters.

An edit document is well-formed for a subject if and only if:

- it is at least 4 bytes long and its operations end exactly at its last byte;
- every operation code is 0 or 1;
- every operation's _length_ is at least 1;
- for every copy, _offset_ + _length_ does not exceed the byte length of the
  subject data; and
- the sum of all operation lengths equals _result size_.

The edited data is the concatenation, in order, of the bytes each operation
appends. An edit document with _result size_ 0 and no operations is
well-formed and edits the data to empty.

A complete replacement of the data is a single insert. Senders SHOULD send
whichever well-formed edit document is smallest, and SHOULD set
_zlib-deflate_ only when it reduces the on-wire size.

The edited data has the subject's _type_. A sender MUST produce edited data
that is valid for that type, for example well-formed UTF-8 when the subject's
type is `text/plain;charset=UTF-8`, and MUST NOT split a multi-byte character
across a copy boundary in a way that leaves the result malformed.

Empty _data_ (_size_ 0) is not an edit document. It means the subject has no
edit in force, see [Effective Edit](#effective-edit).

## Effective Edit

A subject has at most one effective edit.

Among all edit messages held by a host whose _pid_ is the subject, the one
with the greatest _time_ determines the effective edit. If two such messages
share the same _time_, the one whose message hash is greater when compared as
an unsigned big-endian integer determines it. If that message's _data_ is
empty, the subject has no effective edit and its data is the subject data.
Otherwise the edited data is the result of applying that message's edit
document to the subject data.

Editing a message again is therefore sending a new edit message, whose edit
document is again a delta against the original subject data, never against an
earlier edit. Reverting to the original is sending an edit message with empty
_data_. Earlier edit messages remain stored and verifiable; they simply no
longer determine the effective edit.

Because the Specification rejects a reply whose _time_ precedes its parent's,
every edit message has a _time_ after the subject's.

### Add-to Batches

An edit applies to its subject only. An add-to batch message is a distinct
message with a distinct hash, carrying the same data as the original it added
recipients to, and a recipient added by a batch is a participant of that batch
only.

An editor who wants every reader to see an edit MUST therefore send one edit
message for the original and one for each add-to batch of it that the editor
holds, each with _pid_ set to that message's hash and _to_ set per
[Recipients](#recipients) for that message. Because the data is identical, the
same edit document serves all of them.

Likewise, when recipients are added to a message that has an effective edit,
the editor's client or host SHOULD send an edit message for the new batch once
it holds it, so that the added recipients see the edited data.

## Sending

An edit message is created, sent, retried, and recorded exactly as any other
message per the Specification. Nothing about its delivery is different.

A client or host MUST NOT create an edit whose subject has the _terminal_ flag
bit set. In particular an edit, or a reaction, cannot itself be edited. The
Specification's Sending Host rule enforces this for hosts that implement
v0.6.0.

A client or host MUST NOT create an edit on behalf of an address that is not
the subject's _from_.

## Receiving

A Receiving Host applies the Specification unchanged. This standard adds no
header validation: a host need not recognise edits to accept, challenge,
store, and deliver one, because on the wire an edit is a terminal reply with a
Media Type the host does not need to understand.

### Recognising Edits

A host or client that implements this standard determines whether a stored
message is an edit by testing it against [Edit Message](#edit-message) after
the message is stored, using the stored subject. A message meeting every
property is an edit and takes part in determining the effective edit of its
subject. Any other message, including one of type `application/vnd.fmsg.edit`
whose _from_ is not the subject's _from_ or whose data is not a well-formed
edit document for the subject, is an ordinary message and MUST NOT take part
in determining any effective edit.

There is consequently nothing to reject on the wire: a message either is an
edit or is simply a reply.

Implementations MAY ignore the [Recipients](#recipients) requirement when
recognising a stored edit, since a host cannot always know a subject's full
participant set.

### Applying Edits

An implementation MUST check _result size_ against a limit of its own
choosing before allocating or applying an edit document, and when
_zlib-deflate_ is set MUST bound decompression as the Specification requires.
A host SHOULD use a limit no lower than its `MAX_EXPANDED_SIZE`.

An effective edit whose _result size_ exceeds the implementation's limit
remains the effective edit; it is not skipped in favour of an earlier one. The
implementation presents the subject data and SHOULD indicate that a newer
edit exists which it cannot apply.

An implementation MUST treat edited data with the same care as any received
message data. It MUST NOT assume the edited data is valid for the subject's
_type_ and MUST handle edited data that is not, for example malformed UTF-8,
as it would handle a received message with such data.

## Presentation

This section is non-normative.

Clients that implement this standard are expected to:

- render the edited data in place of the subject data, rather than rendering
  edit messages as replies in the thread;
- mark an edited message as edited, with the _time_ of the effective edit;
- let the viewer see the original data, and ideally earlier edits, since all
  of them remain stored;
- offer the author a way to edit and to revert their own messages that are not
  terminal;
- derive the edited view from the stored edit messages rather than local
  state, so that it is consistent across devices; and
- treat an incoming edit message as a low-priority event that does not warrant
  the notification an ordinary message would.

Replies and reactions reference the subject by its hash, which an edit does
not change. A reply or reaction whose _time_ precedes the effective edit's was
made to an earlier version of the data; clients may wish to show that.

Clients that do not implement this standard see a small terminal message of a
type they do not recognise, with _no reply_ set, and continue to show the
original data. Nothing is lost or misrepresented; the reader simply does not
see the correction.

## Interoperability

| Peer | Behaviour |
|------|-----------|
| Host implementing Specification v0.6.0 and this standard | Accepts, stores, and delivers the edit; exposes the edited data to its clients. |
| Host implementing Specification v0.6.0 only | Accepts, stores, and delivers the edit as an ordinary terminal message. Its clients see a message of unrecognised type and the unedited original. Nobody can reply to it. |
| Host implementing a Specification version before v0.6.0 | Rejects the edit with code 1 (invalid) because the _terminal_ bit is a reserved bit set. The editor's host records the rejection like any other and its clients can show that the recipient host does not support edits. |

## Security Considerations

- **Not a retraction:** an edit does not remove or alter the original, which
  every recipient host retains and any participant can read. Editing a message
  to hide what it said hides it only from readers who do not look. Clients
  MUST NOT present an edit as having deleted the original content.
- **Changed meaning:** an edit can change what earlier replies and reactions
  appear to respond to. Clients MUST indicate that a message has been edited
  wherever they display edited data in place of the original.
- **Author only:** implementations MUST NOT apply an edit whose _from_ is not
  the subject's _from_. The Specification's participant check alone admits any
  participant as the sender of a reply; the [Editor](#editor) test is what
  prevents one participant from rewriting another's message. _from_ is
  authenticated by the Specification's sender domain verification.
- **Resource use:** a copy operation is 9 bytes and can append up to the whole
  subject data, so a small edit document can describe very large edited data.
  The _result size_ check in [Applying Edits](#applying-edits) MUST be made
  before any allocation, and each copy MUST be bounds-checked against the
  subject data.
- **Volume:** each edit is a stored message and a connection per recipient
  domain. The Specification's per-connection and per-IP rate limits and
  per-user storage quotas apply. Hosts MAY apply stricter rate limits to
  messages of type `application/vnd.fmsg.edit`.
- **Disclosure:** an edit discloses to all participants of the subject that
  the author edited it, when, and how. The edit document reveals which bytes
  changed.

## Examples

This section is non-normative.

`@alice@example.com` sends `@bob@example.com` and `@chris@example.edu` a
plain-text message whose data is the 25 bytes:

```
I'll see you their at 5pm
```

Alice corrects "their" to "there". The edited data is also 25 bytes. The edit
document copies the first 16 bytes (`I'll see you the`), inserts `re`, and
copies the last 7 bytes (` at 5pm`) starting at offset 18:

```
19 00 00 00                   result size 25
00  00 00 00 00  10 00 00 00  copy offset 0 length 16
01  02 00 00 00  72 65        insert length 2 "re"
00  12 00 00 00  07 00 00 00  copy offset 18 length 7
```

That is 29 bytes, carried as the data of this message:

```JSON
{
    "version": 1,
    "important": false,
    "noreply": true,
    "terminal": true,
    "pid": "3f8a…c21e",
    "from": "@alice@example.com",
    "to": [
        "@bob@example.com",
        "@chris@example.edu"
    ],
    "time": 1794355200.120384,
    "type": "application/vnd.fmsg.edit",
    "size": 29,
    "attachments": []
}
```

For a message this short a delta saves almost nothing over a single insert of
the whole text, which would be 34 bytes. The saving grows with the size of the
subject: the same three operations correct the same typo in a message of any
length.

Alice later reverts to the original by sending the same message with a later
_time_, _size_ 0, and no data.
