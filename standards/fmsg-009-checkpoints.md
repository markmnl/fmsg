# FMSG-009 Checkpoint Standard

## Status

| Revision | Date       | Summary |
| -------- | ---------- | ------- |
| v0.1.0   | 2026-09-12 | Draft: message-hash logs, C2SP checkpoints and independent witnesses |

This optional standard commits fmsg message hashes to an append-only Merkle
log. Independent witnesses retain and co-sign checkpoints so that a later
compromise of the host cannot silently replace previously witnessed history
for a verifier retaining the corresponding evidence and trust configuration.
It changes neither the [core protocol](../SPECIFICATION.md) nor message hashes.

The assurance is that a particular message hash was committed by the time a
trusted witness observed the checkpoint. It does not establish authorship,
send or delivery time, complete logging of all traffic, or continued storage
of message contents. It is useful even when all conversation participants are
on one domain, provided the witness is independently administered.

## References and Conventions

The requirement words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**,
**RECOMMENDED**, and **MAY** have the meanings in
[RFC 2119](https://www.rfc-editor.org/rfc/rfc2119) and
[RFC 8174](https://www.rfc-editor.org/rfc/rfc8174).

This revision uses these formats and protocols directly:

- [RFC 9162 §2.1](https://www.rfc-editor.org/rfc/rfc9162#section-2.1): SHA-256 Merkle trees and proofs, using the same tree construction as RFC 6962.
- [C2SP signed-note v1.0.0](https://c2sp.org/signed-note@v1.0.0): signed text and verifier keys.
- [C2SP tlog-checkpoint v1.0.0](https://c2sp.org/tlog-checkpoint@v1.0.0): checkpoint format.
- [C2SP tlog-cosignature v1.0.1](https://c2sp.org/tlog-cosignature@v1.0.1): timestamped Ed25519 witness signatures.
- [C2SP tlog-witness v1.0.0](https://c2sp.org/tlog-witness@v1.0.0): checkpoint submission and consistency checking.

C2SP encodings apply unchanged, including newline-terminated text and the
big-endian witness timestamp. Core fmsg integer encodings do not apply to
these artifacts. This standard has no dependency on message signing.

## Log

A host MUST durably append a message hash before:

- responding `200` for the first accepting recipient or `11` for an accepted add-to batch; or
- first making an outgoing message, including an add-to batch, available for transmission.

Appending and recording the corresponding event MUST be recoverable together
across a crash. Retries of the same event MUST NOT create extra leaves. A
separate event, such as local acceptance of a sent message or a later
re-delivery, MAY create another occurrence of the same hash. Events are
serialised in their committed order; leaves MUST NOT be removed or reordered.
Deleting message contents does not remove their leaf.

A host MAY maintain multiple logs. It MUST document their routing rules and
assign every covered event to at least one log. Each log's origin is
`<domain>/fmsg/<name>`, where `<name>` is 1–63 lowercase ASCII letters, digits
or hyphens, with no leading or trailing hyphen. A host with one log SHOULD use
`main`. Clients are configured with the origin and API base URL of their log.
An origin MUST NOT be reused for a reset log.

Each entry is exactly the 32-byte [message hash](../SPECIFICATION.md#computing-message-hash).
The zero-based leaf index identifies an occurrence, not a distinct message.
Tree hashing is:

```
leaf hash = SHA-256(0x00 || message hash)
node hash = SHA-256(0x01 || left || right)
```

The root is `MTH` per RFC 9162 §2.1.1, including `SHA-256` of the empty string
for an empty log. Hosts MUST retain the leaves and tree information needed to
serve inclusion and consistency proofs for their published checkpoints.

## Keys and Trust

Log and witness keys are configured as C2SP verifier keys: Ed25519 signature
type `0x01` for logs and timestamped Ed25519 type `0x04` for witnesses. Keys
SHOULD be dedicated to their role. There is no DNS key-discovery requirement.

A verifier MUST obtain the log origin, trusted log keys, trusted witness keys,
and its witness acceptance policy through trusted configuration. Keys included
only in an API response or evidence bundle MUST NOT establish trust. The log
operator's assertion alone is insufficient to establish witness independence.
Witnesses likewise configure the log origins and public keys they accept.

A result described as externally witnessed MUST satisfy the verifier's policy,
which MUST require at least one witness independent of the log operator.
Deployments SHOULD use at least two independently administered witnesses.
Multiple keys belonging to one witness MUST NOT count as separate witnesses.

Key changes require an authenticated configuration update. Rotation MUST
preserve the origin and existing log history. Verifiers MUST retain previously
accepted public keys and trust decisions with archived evidence; replacing or
removing a current key does not itself erase that evidence. Compromise of a
witness key requires reassessing evidence dependent on that witness.

## Checkpoints

A checkpoint MUST use the C2SP checkpoint format, with exactly three body lines:
the configured log origin, decimal tree size, and base64 root hash. This revision
defines no extension lines or host timestamp. The log signs the body using the
C2SP Ed25519 note format; witnesses add C2SP timestamped cosignature lines to the
same body. Body bytes MUST remain unchanged when signatures are added.

The host MUST produce a checkpoint within `CHECKPOINT_INTERVAL` seconds of the
first leaf not yet checkpointed, or when `CHECKPOINT_LEAVES` such leaves have
accumulated, whichever occurs first. RECOMMENDED values are 10 seconds and 1000
leaves. No periodic checkpoint is required when no new leaves exist. A request
at an already checkpointed size returns the existing checkpoint.

Checkpoint production MUST use a consistent snapshot of the committed log.
Sizes MUST NOT decrease as new checkpoints are produced, and a size MUST have
only one root. Hosts MUST retain each checkpoint and its collected cosignatures.
Producing a checkpoint does not imply that a witness has accepted it.

## Witness Exchange

Hosts MUST submit checkpoints and consistency proofs using C2SP's
`POST <submission prefix>/add-checkpoint` over HTTPS. Operators configure the
witness endpoints. Checkpoint, proof and witness operations are HTTP operations,
not fmsg message events, and MUST NOT automatically generate fmsg messages.
Consequently they do not add leaves or trigger more checkpoints. An ordinary
message containing an exported checkpoint is still logged like any message.

Witnesses MUST implement C2SP signature verification, consistency checking,
conflict responses, and atomic persistence of their latest checkpoint before
returning a cosignature. An older submission MUST NOT roll back witness state.
Hosts MUST handle state conflicts by submitting a proof from the witness's
reported size, using a newer local checkpoint when necessary.

Hosts MUST validate returned cosignatures against configured witness keys and
the exact submitted checkpoint body before retaining or serving them. A witness
SHOULD retain the checkpoints it has co-signed for later audit. Failed requests
or proofs MUST NOT replace either party's last verified checkpoint. They are
verification or availability failures, not automatically proof of a fork.

A host MUST continue local logging and checkpointing while witnesses are
unreachable, retry submissions, and expose that the latest checkpoint lacks
sufficient cosignatures. Missing witnessing MUST NOT be presented as success.
Witness clocks SHOULD be synchronised; verifiers SHOULD reject timestamps
beyond their configured tolerance for future clock skew.

## Client API

Where [FMSG-003](fmsg-003-webapi.md) is available these routes use its HTTPS base
URL and authentication; otherwise the operator configures an HTTPS base URL and
access policy. Checkpoint creation is an operator operation. Inclusion proofs
MUST be restricted to callers authorised for the corresponding message or log;
checkpoint and consistency access MAY also be restricted.

JSON uses `application/json`. `checkpoint` is the complete signed-note UTF-8
text, with newlines escaped by JSON and available cosignatures included. Hashes
use standard padded base64 (RFC 4648 §4); query values MUST be URL-encoded.
Sizes and indices, including query parameters, are canonical unsigned decimal
strings in the range 0 through 2^64−1, avoiding JSON integer precision loss.

| Method | Route | Returns |
| ------ | ----- | ------- |
| `GET` | `/fmsglog/{log}/checkpoint` | `{ "checkpoint": ... }` for the latest produced checkpoint. `?size=N` selects a retained checkpoint. |
| `POST` | `/fmsglog/{log}/checkpoint` | Creates a checkpoint for the current committed size, or returns the existing one, in the same shape. Witnessing is asynchronous. |
| `GET` | `/fmsglog/{log}/inclusion?hash=H&size=N` | `{ "leaf_index": "i", "tree_size": "N", "hashes": [ ... ] }`, per RFC 9162 §2.1.3. The lowest matching index is used unless `index=i` is supplied. |
| `GET` | `/fmsglog/{log}/consistency?from=M&to=N` | `{ "hashes": [ ... ] }`, per RFC 9162 §2.1.4. |

`{log}` is the origin's `<name>`. Unknown checkpoints, unavailable tree sizes,
or absent leaves return `404`; malformed parameters, an index outside the
requested tree, a selected leaf not matching the requested hash, or `M > N`
return `400`. Proof queries use the exact requested sizes, never a silently
substituted latest size. A `404` is not a cryptographic proof of absence.

## Verification and Retained Evidence

A verifier checking a message MUST:

1. Compute its core message hash and verify the checkpoint's origin and log signature against trusted configuration.
2. Verify the inclusion proof for that hash, index and tree size against the checkpoint root per RFC 9162 §2.1.3.2.
3. If it retains another checkpoint for this origin, verify consistency from the smaller tree to the larger per RFC 9162 §2.1.4.2; equal sizes require equal roots. An older checkpoint MUST NOT replace the latest retained state.
4. Verify the witness cosignatures over the same checkpoint body and require its configured witness policy before reporting an externally witnessed result.

Missing or invalid signatures or proofs prevent the corresponding verification.
A valid log signature and inclusion proof without sufficient trusted witness
cosignatures MAY be reported as **unwitnessed**, but MUST NOT receive the external
assurance. Different signed roots at the same size and origin are evidence of
inconsistent log statements. Failure to obtain or verify a proof between
different sizes alone does not prove those checkpoints are inconsistent.

To claim commitment by time `T`, the verifier's witness policy MUST be satisfied
using only cosignatures timestamped no later than `T`, subject to its clock
assumptions. The claim depends on an honest witness in the accepted set. A
message's own timestamp supplies no independent time bound.

Verifiers MUST retain the message or its hash, leaf index, inclusion proof,
checkpoint with accepted cosignatures, relevant consistency proofs and prior
checkpoints, and the accepted trust configuration for any assurance they intend
to preserve. A checkpoint alone is insufficient to later prove a particular
message's inclusion if the log stops serving proofs. Evidence bundles may be
exported, but their embedded keys still require independent trust.

## Limits and Security

**Scope of evidence.** Inclusion commits a hash; it does not prove authorship,
acceptance, delivery, completeness, or message availability. Hosts are required
to log the events above, but this revision supplies no inclusion promise or
cryptographic proof of omission. A missing message or proof can reflect
retention policy, access controls or an outage; it does not alone prove deletion
or rewriting by the operator.

**Split views and compromise.** Retained checkpoints and consistency proofs
constrain later history. Different clients accepting disjoint witness sets can
still see different histories; preventing this requires policies whose accepted
sets overlap in an honest witness. A witness controlled by the log operator
adds no independent protection. A compromised log key cannot make altered
history consistent with an independently retained earlier root, but trust in
witness keys and their clocks remains an assumption.

**Privacy.** Hashes conceal raw contents but permit matching known messages;
they are not a guarantee of anonymity or secrecy. Witnesses also learn tree
sizes and checkpoint timing. Proof access controls and checkpoint batching
SHOULD reflect these disclosures.

Inclusion promises, witness discovery and message-retention auditing are deferred
to later revisions. This revision standardises only the message-hash log,
checkpoint and witness binding, proof access, and verification evidence.
