# FMSG-008 Message Signing Standard

## Status

| Revision | Date       | Summary                                                        |
| -------- | ---------- | -------------------------------------------------------------- |
| v0.1.0   | 2026-09-12 | Ed25519 signatures carried as an attachment, keys in DNS, policy |

This standard defines how the author of a message signs it, how keys are
published under the author's domain, and how any host or client holding the
message verifies authorship, at any later time, without contacting the sender.
It builds on the [fmsg Specification](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md)
and requires no change to the message definition or protocol: the signature is
an [Attachment](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md#attachment)
and is therefore covered by the [message hash](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md#computing-message-hash)
and by every reply's `pid`.

The core specification verifies that a message came from a host the sender's
domain authorised. It does not prove which address authored the message, and a
host can originate messages from any address on its domain. This standard adds
that proof, following the approach of [DKIM](https://www.rfc-editor.org/rfc/rfc6376)
but over a canonical form of the binary message.

The capitalized requirement words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, **REQUIRED**, and **OPTIONAL** have
the meanings defined by [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and [RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

## Conventions

- Integers and strings are encoded as in the core [Data Types](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md#data-types): little-endian, strings prefixed by a uint8 length, no terminators.
- "author" is the address in `from`. On an add-to message the author is still `from`; `add to from` is not attested by this standard.
- "verifier" is any party holding a stored message: a Receiving Host at exchange time, a client, or an auditor later.
- Recipient parts are compared case-insensitively per the core [Terms](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md#terms).

## Algorithms

| id | Algorithm | Signature | Public key | Reference                                       |
| -- | --------- | --------- | ---------- | ----------------------------------------------- |
| 1  | Ed25519   | 64 bytes  | 32 bytes   | [RFC 8032](https://www.rfc-editor.org/rfc/rfc8032) |

Id 1 is REQUIRED. Ids 2–255 are reserved. A verifier encountering an unknown id
MUST report the signature as unverifiable, not invalid. Ed25519 is applied
directly to the signing input; no pre-hashing.

## Signature Attachment

A signed message carries exactly one signature attachment. It MUST be the last
attachment in both `attachment headers` and `attachments data`. More than one,
or one not in last position, is invalid.

Attachment header:

| Field    | Value                                              |
| -------- | -------------------------------------------------- |
| flags    | `0` (no common type, no zlib-deflate)              |
| type     | US-ASCII `application/fmsg-signature`              |
| filename | UTF-8 `signature.fmsgsig`                          |
| size     | Length of the attachment data below                |

Attachment data:

| Field       | Type                      | Description                                                                                                                                          |
| ----------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| sig version | uint8                     | MUST be `1`.                                                                                                                                         |
| alg         | uint8                     | Algorithm id.                                                                                                                                        |
| selector    | uint8 + US-ASCII string   | 1–63 characters: letters, digits, hyphen; not beginning or ending with a hyphen.                                                                     |
| origin time | float64                   | The `time` of the message as originally sent by the author.                                                                                          |
| origin ref  | uint8 tag + payload       | Tag `0`: first message in a thread, followed by `topic` as uint8 + UTF-8 string. Tag `1`: a reply, followed by the 32-byte `pid` of the parent.        |
| signature   | byte array                | Length per `alg`.                                                                                                                                    |

`origin time` and `origin ref` duplicate the header's `time` and `topic`/`pid`
on an ordinary message. They are carried so that an add-to copy, whose header
replaces `time`, drops `topic` and rewrites `pid` per
[Notes on Adding Recipients](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md#notes-on-adding-recipients),
still contains the values the author signed.

Clients SHOULD NOT display the signature attachment as a user file and MUST NOT
allow users to attach a file named `signature.fmsgsig`. Clients SHOULD display
the verification result instead.

## Signing Input

The signature is computed over a canonical serialisation of the message's
content, not over the raw header bytes: raw bytes change under add-to, and vary
with encoding choices (common type or explicit, compressed or not) that do not
change what the author said.

The signing input is the concatenation, in order, of:

| #  | Field            | Type                    | Value                                                                                                                                         |
| -- | ---------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | prefix           | 17 bytes US-ASCII       | `fmsg-signature-v1`, no terminator (domain separation).                                                                                      |
| 2  | version          | uint8                   | fmsg protocol version from the message.                                                                                                       |
| 3  | signed flags     | uint8                   | Message `flags` with bits 0 (has pid), 1 (has add to), 2 (common type) and 5 (zlib-deflate) cleared. Bits 3, 4, 6 and 7 retained.             |
| 4  | origin ref       | tag + payload           | Exactly as in the signature attachment.                                                                                                       |
| 5  | from             | address                 | As encoded in the header.                                                                                                                     |
| 6  | to               | uint8 + addresses       | As encoded in the header, in order.                                                                                                           |
| 7  | origin time      | float64                 | Exactly as in the signature attachment.                                                                                                       |
| 8  | type             | uint8 + US-ASCII string | Complete Media Type. If the message common type flag is set, the mapped string from [Common Media Types](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md#common-media-types), exactly as listed. |
| 9  | data length      | uint32                  | Decompressed length if zlib-deflate is set, otherwise `size`.                                                                                 |
| 10 | data hash        | 32 bytes                | SHA-256 of message data, after decompression if zlib-deflate is set.                                                                          |
| 11 | attachment count | uint8                   | Number of attachments excluding the signature attachment.                                                                                     |
| 12 | per attachment   |                         | For each attachment excluding the signature attachment, in order: `type` as complete Media Type string (uint8 + US-ASCII, resolved from the common type table if that attachment's common type flag is set); `filename` (uint8 + UTF-8); decompressed length (uint32); SHA-256 of decompressed data (32 bytes). |

The signature attachment, its header, `add to from` and `add to` are never
part of the signing input. `important`, `no reply` and `terminal` are retained
in signed flags because they change the meaning or handling of the message;
bit 7 is retained so a future assignment cannot be toggled on a signed message.

## Signing

1. Assemble the message without the signature attachment. `origin time` is the message `time`; `origin ref` is `topic` (tag 0) when the message has no `pid`, otherwise `pid` (tag 1).
2. Compute the signing input.
3. Sign it with the private key of a published selector.
4. Append the signature attachment last.

The key's scope MUST match the author: a domain-scoped key requires `from` to
be in the key's domain; an address-scoped key additionally requires `from` to
have that recipient part.

A host MAY sign with a domain-scoped key on behalf of its users. A client MAY
sign with a key scoped to its own address. A message carries one signature;
domains wanting per-address authorship SHOULD publish address-scoped keys and
have clients sign.

The signer MUST use the same `time` the host will transmit. Where a host stamps
`time` at acquisition, host and client MUST agree on the value before signing;
the RECOMMENDED arrangement is that the client sets `time` and the host
preserves it.

## Key Publication

Keys are published as DNS TXT records at `<selector>._fmsgkey.<domain>`, for
example `agent-2026a._fmsgkey.example.com`. The record contains
semicolon-separated `tag=value` pairs. Whitespace around pairs is ignored. Tags
are case-sensitive. Unknown tags MUST be ignored.

| Tag | Required | Value                                                                                                                                              |
| --- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v` | yes      | `fmsgsig1`                                                                                                                                         |
| `k` | yes      | Algorithm name: `ed25519` for id 1.                                                                                                                |
| `p` | yes      | Base64 ([RFC 4648](https://www.rfc-editor.org/rfc/rfc4648) §4) public key. Empty means revoked.                                                     |
| `s` | no       | Scope. Absent or `*`: any address in the domain. Otherwise a recipient part, matched case-insensitively against `from`.                            |
| `x` | no       | Not-after, POSIX epoch integer. Messages with `origin time` after this MUST NOT verify with this key.                                              |
| `n` | no       | Human-readable note; ignored by verifiers.                                                                                                         |

```
agent-2026a._fmsgkey.example.com. IN TXT "v=fmsgsig1; k=ed25519; s=sales-agent; p=MCowBQYDK2VwAyEA..."
```

A domain MAY publish any number of selectors. A record SHOULD remain published
for as long as messages signed with it are to remain verifiable. To rotate,
publish a new selector; when the old key is no longer used for signing, either
leave its record in place or set `x` to the time signing stopped. To revoke,
remove the record or empty `p`; all messages signed with the key become
unverifiable.

Resolvers SHOULD perform DNSSEC validation for `_fmsgkey` lookups, per
[Domain Resolution](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md#domain-resolution).
Verifiers MAY cache records for their TTL.

An [FMSG-002](https://github.com/markmnl/fmsg/blob/main/standards/fmsg-002-id.md)
service MAY additionally serve keys to the domain's own hosts and clients. DNS
remains authoritative for verifiers on other domains. That interface is not
defined here.

## Policy

A domain MAY publish its signing policy as a TXT record at `_fmsgsig.<domain>`:

| Tag | Required | Value                                                                                                                    |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------ |
| `v` | yes      | `fmsgsig1`                                                                                                               |
| `p` | yes      | `required`: every message from the domain is signed. `optional`: some are. `none`: the domain does not sign.            |
| `u` | no       | `required`: every message is signed with a key scoped to its `from` address, not merely a domain key. Default `optional`. |

Absence of the record is equivalent to `p=none`. Policy affects only how a
verifier interprets an absent or failing signature; it does not change signing
or verification.

## Verification

Result is one of:

| Result            | Meaning                                                                                              |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `verified-user`   | Valid under a key scoped to `from`'s recipient part.                                                 |
| `verified-domain` | Valid under a domain-scoped key.                                                                     |
| `unsigned`        | No signature attachment.                                                                             |
| `unverifiable`    | Signature present but key unobtainable, algorithm unknown, or message data unavailable.              |
| `invalid`         | Signature present, checked, and failed.                                                              |

Procedure:

1. Locate the signature attachment by filename. Absent → `unsigned`. More than one, or not last → `invalid`.
2. Parse the attachment data. `sig version` ≠ 1 or unknown `alg` → `unverifiable`. Malformed → `invalid`.
3. If has add to is not set: `origin time` MUST equal header `time` and `origin ref` MUST match the header (`topic` when no `pid`, else `pid`). Otherwise → `invalid`.
4. If has add to is set: take `origin time` and `origin ref` from the attachment. If the verifier also holds the original message the add-to references, it MAY check the original's `time` and `topic`/`pid` equal these; mismatch → `invalid`.
5. Resolve `<selector>._fmsgkey.<domain of from>`. Resolution failure, absent record, wrong `v`, `k` not matching `alg`, or empty `p` → `unverifiable`.
6. `x` present and `origin time` > `x` → `invalid`.
7. `s` present and not `*`: MUST equal the recipient part of `from`. Otherwise → `invalid`.
8. Compute the signing input from the stored message.
9. Verify `signature` with the public key. Failure → `invalid`.
10. `verified-user` if `s` names a recipient part, else `verified-domain`.

A verifier MUST NOT report `invalid` for failures caused by its own inability
to obtain a key or decompress data; those are `unverifiable`.

### Receiving Hosts

The signing input needs message and attachment data, available only after the
Receiving Host has downloaded them ([Protocol Steps](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md#3-continue-per-recipient-response-and-disposition) 3.2).
A Receiving Host that verifies at exchange time does so before sending
per-recipient codes.

A Receiving Host MAY reject on signature grounds, taking policy into account.
Whole-message reject codes have already passed at this point, so rejection is
per recipient with `105` (user undisclosed). A Receiving Host MUST NOT use `1`
(invalid) for a signature failure; the message is well-formed under the core
specification. Hosts SHOULD record the result with the message and make it
available to clients.

A Receiving Host MUST NOT reject on `unverifiable` unless policy is `required`
and the host made a reasonable attempt to resolve the key.

### Add-to Messages

An add-to message's attachments data is identical to the original's, so the
signature attachment travels unchanged. A host receiving the add-to as a full
delivery (code 64, never having held the original) verifies from the add-to
copy alone using `origin time` and `origin ref` from the attachment. A host
accepting with code 11 or 65 verifies against its stored original.

The signature attests that `from` authored the content, its recipients and its
place in the thread. It does not attest the act of adding recipients; that
remains bound by the core domain and IP checks. A future revision MAY define an
add-to signature.

## Interaction with the Core Specification

- The signature attachment is included in [Computing Message Hash](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md#computing-message-hash). Every reply's `pid` commits to it; a stripped or altered signature yields a different hash and cannot be the parent of any reply made to the signed message.
- The CHALLENGE RESPONSE hash covers the signature attachment. No change.
- The signature attachment MUST NOT be compressed. Other parts may be; the signing input hashes decompressed content.
- Hosts unaware of this standard store and forward the signature as an ordinary attachment. Nothing breaks.

## Extensibility

Future revisions MAY assign algorithm ids 2–255, add attachment data fields
after `signature` (verifiers MUST ignore trailing bytes they do not understand
only if a later `sig version` says so; under version 1 trailing bytes are
invalid), define an add-to signature, or define HTTPS key publication for
domains with many address-scoped keys. They MUST NOT alter the signing input
for `sig version` 1.

## Security

**Key compromise.** A domain-scoped key forges any address in the domain; an
address-scoped key forges one address. Domains SHOULD prefer address-scoped
keys for addresses whose messages are acted on automatically. Revocation is
effective once cached records expire; domains expecting to need rapid
revocation SHOULD use short TTLs.

**Downgrade by omission.** A party able to originate from an authorised host
can omit the signature. Policy `required` is the defence: verifiers may then
treat unsigned messages from the domain as unattributed.

**Replay.** `origin time` is signed, so a message cannot be re-dated. The core
[time window and duplicate detection](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md#message-replay)
otherwise apply. Re-delivery via add-to is legitimate by design.

**DNS.** Key discovery inherits DNS trust; DNSSEC is strongly RECOMMENDED. A
poisoned record makes forgeries verify; a suppressed one makes legitimate
messages `unverifiable`, which under `required` is a denial of service.
Verifiers SHOULD distinguish resolution failure from a definitive negative.

**Long-term verifiability.** Authorship is verifiable only while the key record
is published. Domains SHOULD retain old selectors with `x` set rather than
remove them.

**Not encryption.** This standard provides authorship and integrity only.

See [Security Concerns](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md#security-concerns)
for the core threat model.
