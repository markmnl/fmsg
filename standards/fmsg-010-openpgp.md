# FMSG-010 OpenPGP Standard

## Status

| Revision | Date       | Summary |
| -------- | ---------- | ------- |
| v0.1.0   | 2026-09-16 | Initial draft |

This optional standard carries signed or encrypted content in ordinary fmsg
messages using [OpenPGP/MIME (RFC 3156)](https://www.rfc-editor.org/rfc/rfc3156).
Clients perform the cryptographic operations. It changes neither the
[core specification](../SPECIFICATION.md) nor host behaviour, message hashes,
or client APIs.

**MUST**, **MUST NOT**, **SHOULD**, and **MAY** have the meanings in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).
OpenPGP packets and algorithms MUST follow
[RFC 9580](https://www.rfc-editor.org/rfc/rfc9580); its cryptographic requirements
take precedence over older algorithms shown in RFC 3156 examples.

## Message Format

The fmsg _type_ is the complete OpenPGP/MIME media type, including its
parameters. The _common type_ flag MUST be clear; the ASCII value MUST fit
the core's 255-byte limit and MUST NOT contain folded header lines.
The _data_ is the corresponding multipart body, without an outer MIME header
block. MIME part headers and boundaries use CRLF line endings.

| Operation | fmsg _type_ (example boundary) | MIME body |
| --------- | ----------------------------- | --------- |
| Sign | `multipart/signed;protocol="application/pgp-signature";micalg=pgp-sha256;boundary="fmsg-pgp"` | Content followed by its detached signature, per RFC 3156 §5. `micalg` MUST match the signature's hash algorithm. |
| Encrypt | `multipart/encrypted;protocol="application/pgp-encrypted";boundary="fmsg-pgp"` | An `application/pgp-encrypted` control part containing `Version: 1`, followed by an `application/octet-stream` encrypted part, per RFC 3156 §4. |

Senders MUST choose boundaries that do not occur as delimiter lines in their
parts. RFC 3156's ASCII armor and signed-content canonicalisation rules apply.
Signature verification MUST use the signed MIME entity's bytes, including
its content headers, rather than a decoded or reserialised version.

The outer fmsg attachment count MUST be zero. Files belong inside the MIME
content, normally as `multipart/mixed`, so their contents, media types, and
filenames receive the same protection as the body. To both sign and encrypt,
clients MUST encrypt a complete `multipart/signed` MIME entity, including its
content headers, using RFC 3156 §6.1.

Hosts carry and hash the resulting fmsg message as usual. OpenPGP decryption
is never part of the core message-hash calculation.

## Keys and Verification

Clients MUST establish which public keys they trust for each fmsg address,
for example by checking full fingerprints through an authenticated channel.
A key's user ID, a downloaded key, or successful fmsg delivery alone MUST NOT
establish that binding. This standard defines no key directory or discovery
API. Public keys MAY be exchanged as `application/pgp-keys` content per
RFC 3156 §7; private keys stay with the client.

Clients MUST check key validity, expiry, revocation, and permitted use under
their OpenPGP trust policy. Replacement keys require an authenticated trust
update. A client MUST NOT attribute signed content to the fmsg _from_ address
unless the signature verifies with a key trusted for that address.

Encryption MUST cover every address in _to_ and SHOULD also cover the sender
so they can read their sent copy. If a trusted usable recipient key is missing,
the client MUST stop the encrypted send and report why; it MUST NOT silently
send plaintext or omit that recipient. Algorithms MUST be compatible with all
recipient keys under RFC 9580.

Clients MUST require integrity-protected encryption and successful integrity
verification before releasing decrypted content. Invalid signatures MUST be
reported as invalid; signatures from untrusted keys MUST be shown as
unverified. Decryption alone MUST NOT be presented as proof of authorship.
Clients without OpenPGP support MAY offer the MIME body for export.

## Limits and Adding Recipients

Only the MIME content is protected. The fmsg addresses, _time_, _pid_, flags,
and outer _topic_ remain visible and are not covered by the OpenPGP signature.
For encrypted threads, senders SHOULD use an empty or non-sensitive outer
topic. Message sizes and traffic patterns also remain visible.

A valid content signature does not authenticate the fmsg envelope or bind the
content to this thread: signed content can be copied into another message.
Clients MUST distinguish content verification from envelope authentication.
Applications needing a signed statement about recipients or context must put
that statement inside the signed content and check it explicitly.

Core add-to messages copy the original body unchanged. Adding an address
therefore does not grant it the ability to decrypt. Clients MUST NOT rewrite
the ciphertext or add OpenPGP recipient packets to an add-to copy. To share
content with someone lacking a decryption key, a participant must send a new
encrypted message to the intended recipients, following the core participant
rules. This creates a new message hash. Removing a recipient or rotating keys
does not revoke access to content they can already decrypt.
