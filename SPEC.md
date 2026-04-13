# fmsg — Concise Implementation Specification

_NOTE_ This is a distilled version of the full specification attempting to capture all neccssary information such that implementations following should be correct. More context may be needed at times to explain the logic, please refer to the full [fmsg SPECIFICATION](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md).

All integers are little-endian. "case-insensitive" means Unicode default case folding on UTF-8 strings. "TERMINATE" means tear down all connections with the remote host immediately.

---

## 1. Addresses

Format: `@recipient@domain` — UTF-8, prefixed by uint8 byte length.

Recipient part: Unicode letters/numbers (`\p{L}`, `\p{N}`), plus `-` `_` `.` non-consecutively and not at start/end. Whole address < 256 bytes.

## 2. Message Binary Format

All fields are read sequentially. `[ ]` = conditionally present.

| # | Field | Type | Condition / Notes |
|---|-------|------|-------------------|
| 1 | version | uint8 | 1–127 = message version. 129–255 = CHALLENGE (version = 256 − value). 0 and 128 unused. |
| 2 | flags | uint8 | Bit field, see §3. |
| 3 | [pid] | 32 bytes | SHA-256 of parent message. Present iff flag bit 0 set. |
| 4 | from | address | Sender address. |
| 5 | to | uint8 count + addresses | ≥ 1 distinct (case-insensitive) addresses. |
| 6 | [add to from] | address | Present iff flag bit 1 set. Must be in _from_ or _to_. |
| 7 | [add to] | uint8 count + addresses | Present iff flag bit 1 set. ≥ 1 distinct addresses. |
| 8 | time | float64 | POSIX epoch, stamped by sending host. |
| 9 | [topic] | uint8 length + UTF-8 | Present iff pid is NOT present. Length may be 0. |
| 10 | type | uint8 + [US-ASCII string] | If flag bit 2 (common type) set: uint8 is a Common Media Type ID (see §4). Otherwise: uint8 is length of subsequent ASCII Media Type string. |
| 11 | size | uint32 | Byte length of data on the wire (after compression, if zlib-deflate set). |
| 12 | attachment headers | uint8 count + [headers] | Count may be 0. Each header: see §5. |
| 13 | data | bytes | Exactly _size_ bytes. |
| 14 | [attachments data] | bytes | Concatenated attachment payloads, sizes defined by headers. |

**Message header** = fields 1–12. **Message header hash** = SHA-256(message header). **Message hash** = SHA-256(entire message, fields 1–14).

The hash MUST be computed over the full message bytes: message header fields exactly as transmitted, followed by message data and any attachments data. When the zlib-deflate flag is set for message data or an attachment's data, that data MUST be decompressed prior to inclusion in the hash computation.

**Sender** = _from_ when _has add to_ not set; _add to from_ when set.

**Participants** = all addresses in _from_, _to_, _add to from_ (if any), _add to_ (if any).

## 3. Flags (uint8 bit field)

| Bit | Name | Description |
|----:|------|-------------|
| 0 | has pid | pid field present; message is a reply. |
| 1 | has add to | add to from + add to fields present; message adds recipients to an existing message. |
| 2 | common type | type field is a 1-byte Common Media Type ID instead of length-prefixed string. |
| 3 | important | Sender flags message as important. |
| 4 | no reply | Sender will discard any reply. |
| 5 | zlib-deflate | Message data compressed with zlib/deflate (RFC 1950/1951). |
| 6–7 | reserved | Must be 0. |

## 4. Common Media Types

When flag bit 2 is set, the type field is a single uint8 mapping to:

| ID | Media Type | ID | Media Type |
|----|------------|----|------------|
| 1 | application/epub+zip | 33 | image/avif |
| 2 | application/gzip | 34 | image/bmp |
| 3 | application/json | 35 | image/gif |
| 4 | application/msword | 36 | image/heic |
| 5 | application/octet-stream | 37 | image/jpeg |
| 6 | application/pdf | 38 | image/png |
| 7 | application/rtf | 39 | image/svg+xml |
| 8 | application/vnd.amazon.ebook | 40 | image/tiff |
| 9 | application/vnd.ms-excel | 41 | image/webp |
| 10 | application/vnd.ms-powerpoint | 42 | model/3mf |
| 11 | application/vnd.oasis.opendocument.presentation | 43 | model/gltf-binary |
| 12 | application/vnd.oasis.opendocument.spreadsheet | 44 | model/obj |
| 13 | application/vnd.oasis.opendocument.text | 45 | model/step |
| 14 | application/vnd.openxmlformats-officedocument.presentationml.presentation | 46 | model/stl |
| 15 | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | 47 | model/vnd.usdz+zip |
| 16 | application/vnd.openxmlformats-officedocument.wordprocessingml.document | 48 | text/calendar |
| 17 | application/x-tar | 49 | text/css |
| 18 | application/xhtml+xml | 50 | text/csv |
| 19 | application/xml | 51 | text/html |
| 20 | application/zip | 52 | text/javascript |
| 21 | audio/aac | 53 | text/markdown |
| 22 | audio/midi | 54 | text/plain;charset=US-ASCII |
| 23 | audio/mpeg | 55 | text/plain;charset=UTF-16 |
| 24 | audio/ogg | 56 | text/plain;charset=UTF-8 |
| 25 | audio/opus | 57 | text/vcard |
| 26 | audio/vnd.wave | 58 | video/H264 |
| 27 | audio/webm | 59 | video/H265 |
| 28 | font/otf | 60 | video/H266 |
| 29 | font/ttf | 61 | video/ogg |
| 30 | font/woff | 62 | video/VP8 |
| 31 | font/woff2 | 63 | video/VP9 |
| 32 | image/apng | 64 | video/webm |

An unmapped ID MUST be rejected (code 1 invalid).

## 5. Attachment Header

Each attachment header, in order:

| Field | Type | Notes |
|-------|------|-------|
| flags | uint8 | Bit 0 = common type (same lookup as §4). Bit 1 = zlib-deflate. Bits 2–7 reserved. |
| type | uint8 + [ASCII string] | Same encoding rule as message type, using this attachment's own common type flag. |
| filename | uint8 length + UTF-8 | < 256 bytes. Unicode letters/numbers, plus `-` `_` ` ` `.` non-consecutively, not at start/end. Unique per message (case-insensitive). |
| size | uint32 | Byte length of this attachment's data on the wire (after compression, if zlib-deflate set). |

Attachment data payloads follow all headers, concatenated in order.

## 6. Challenge (sent on Connection 2)

| Field | Type |
|-------|------|
| version | uint8 | 255 = challenge for fmsg v1, 254 = v2, etc. |
| header hash | 32 bytes | SHA-256 of message header being challenged. |

## 7. Challenge Response

| Field | Type |
|-------|------|
| msg hash | 32 bytes | SHA-256 of entire message. |

## 8. Response Codes

Single-value codes (sent as first/only byte):

| Code | Name | Meaning |
|-----:|------|---------|
| 1 | invalid | Message header fails validation. |
| 2 | unsupported version | Version not supported. |
| 3 | undisclosed | No reason given. |
| 4 | too big | Exceeds MAX_SIZE. |
| 5 | insufficient resources | e.g. disk full. |
| 6 | parent not found | pid references unknown message. |
| 7 | too old | Timestamp too far in past. |
| 8 | future time | Timestamp too far in future. |
| 9 | time travel | Timestamp before parent's timestamp. |
| 10 | duplicate | Already received for all recipients. |
| 11 | accept add to | Add-to accepted; parent already stored; no _add to_ recipients on this host. Stop. |
| 64 | continue | Header accepted; send data. |
| 65 | skip data | Add-to accepted; parent already stored; _add to_ recipients on this host. Skip data, per-recipient codes follow. |

Per-recipient codes (one byte per recipient on this host, in message order):

| Code | Name | Meaning |
|-----:|------|---------|
| 100 | user unknown | Address not known. |
| 101 | user full | Recipient quota exceeded. |
| 102 | user not accepting | Recipient not accepting messages. |
| 103 | user duplicate | Already received for this recipient. |
| 105 | user undisclosed | No reason disclosed. MAY replace any 100–103. |
| 200 | accept | Message stored for this recipient. |

## 9. Domain Resolution

Resolve `fmsg.<domain>` for A/AAAA records. The sender's domain is:
- The domain of _add to from_ when _has add to_ is set.
- The domain of _from_ otherwise.

The Receiving Host MUST verify the incoming connection IP is in the resolved set for the sender's domain. DNSSEC SHOULD be validated; on failure TERMINATE.

## 10. Protocol Flow

One message per connection. Two TCP connections used: Connection 1 (message transfer) and Connection 2 (optional challenge). Host A = Sending Host, Host B = Receiving Host.

### 10.1 Host Configuration

| Variable | Description |
|----------|-------------|
| MAX_SIZE | Max total bytes of data + attachment data. |
| MAX_MESSAGE_AGE | Max seconds a message time may be in the past. |
| MAX_TIME_SKEW | Max seconds a message time may be in the future. |

### 10.2 Sending (Host A perspective)

Host A delivers iff _from_ or _add to from_ belongs to Host A's domain. For each unique recipient domain:

1. Resolve recipient domain IPs via `fmsg.<domain>`. Connect to first responsive IP (Connection 1). Retry with backoff if unreachable.
2. Register the message header hash and Host B's IP in an outgoing record (for matching challenges).
3. Transmit the message header on Connection 1.
4. Wait for response. During this wait, be ready to handle a CHALLENGE on Connection 2 (see §10.5).
5. Read one byte from Connection 1:
   - **1–10**: Rejected for all recipients. Record and close.
   - **11**: Accept add-to (only valid when _has add to_ set). Record and close.
   - **64**: Continue — transmit data + attachment data (exact declared sizes).
   - **65**: Skip data (only valid when _has add to_ set). Do NOT transmit data.
   - **Other**: TERMINATE.
6. After transmitting data (code 64) or immediately (code 65), read one byte per recipient on this host (in message field order: _to_ then _add to_). Each byte is a per-recipient response code.
7. Record results. Remove Host B's IP from outgoing record; remove entry if no IPs remain. Close Connection 1.

### 10.3 Receiving — Header Exchange (Host B perspective)

1. Read first byte on Connection 1:
   - 1–127 and supported → message version, continue.
   - 129–255 and (256 − value) supported → incoming CHALLENGE, handle per §10.5.
   - Otherwise → respond code 2 (unsupported version), close.
2. Parse remaining header. If unparseable → TERMINATE.
3. Validate (all must pass, else respond code 1 invalid and close):
   - _to_ has ≥ 1 distinct address.
   - If _has add to_: _add to from_ exists and is in _from_ or _to_; _add to_ has ≥ 1 distinct address.
   - ≥ 1 recipient in _to_ or _add to_ belongs to Host B's domain.
   - Common type IDs (message and attachment) are mapped.
4. DNS-verify sender IP: resolve `fmsg.<sender domain>`, check Connection 1 source IP is in result set. Fail → TERMINATE.
5. If _size_ + attachment sizes > MAX_SIZE → respond code 4, close.
6. Compute DELTA = now − _time_:
   - DELTA > MAX_MESSAGE_AGE → respond code 7, close.
   - DELTA < −MAX_TIME_SKEW → respond code 8, close.
7. Evaluate pid / add-to:
   - **No pid, no add-to** (new thread): respond 64 (continue).
   - **pid set, no add-to** (reply):
     - Verify parent stored (§11). Not found → respond code 6, close.
     - Parent time − MAX_TIME_SKEW must be before incoming time. Fail → respond code 9, close.
     - _from_ must be a participant of the parent. Fail → respond code 1, close.
     - Respond 64 (continue).
   - **add-to set** (adding recipients):
     - pid MUST also be set. Fail → respond code 1, close.
     - Check if parent stored (§11):
       - **Stored**: check time travel (code 9 if fail).
         - If any _add to_ recipient belongs to Host B's domain → respond 65 (skip data), then per-recipient codes per §10.4.
         - Otherwise → record add-to fields, respond 11 (accept add to), close.
       - **Not stored**: respond 64 (continue) — treat as full message delivery.

### 10.4 Receiving — Data Download and Per-Recipient Response

1. If challenge was completed, use the message hash from the challenge response to check for duplicates across all recipients on Host B. If duplicate for all → respond code 10, close.
2. If code 65 was sent, skip to step 4 (data already stored). Otherwise download data + attachments (exactly declared sizes).
3. If challenge was completed, verify computed message hash matches the challenge response hash. For code 65, compute from received header + stored data. Mismatch → TERMINATE.
4. For each recipient on Host B's domain (in _to_ order, then _add to_ order), send one response byte:
   - Already received → 103 (or 105).
   - Unknown address → 100 (or 105).
   - Quota exceeded → 101 (or 105).
   - Not accepting → 102 (or 105).
   - Otherwise → 200 (accept).
5. Close Connection 1.

### 10.5 Challenge Flow

The challenge is optional (Receiving Host's discretion). It runs on a separate Connection 2 while Connection 1 is paused after the header exchange.

**Receiving Host (Host B) initiates:**
1. Open Connection 2 to Host A's IP (the source IP of Connection 1). DNS verification of sender IP must already have passed.
2. Send CHALLENGE: version byte + 32-byte message header hash.

**Sending Host (Host A) handles:**
1. Read first byte on incoming connection:
   - 1–127 → incoming message, handle normally.
   - 129–255 → CHALLENGE, continue.
   - Other → TERMINATE connection.
2. Read 32-byte header hash. Match against outgoing record by header hash AND challenger's IP. No match → TERMINATE.
3. Send CHALLENGE RESPONSE: 32-byte SHA-256 of entire message.

**Host B receives** the 32-byte message hash from Host A. Both close Connection 2. Exchange continues on Connection 1.

Host A MUST maintain a record of outgoing messages keyed by message header hash, including each Receiving Host's IP. Used to match challenges and verify the challenger's IP. Create before transmission; remove a host's IP on completion/abort; remove the entry when no IPs remain.

## 11. Verifying Message Stored

A message is verified as stored iff:
- A SHA-256 digest matches a previously accepted message (code 200 or 11).
- That message currently exists and is retrievable.

For accept-add-to (code 11) messages, the hash is computed by combining the add-to message header with the original message's data and attachment data.

Each add-to batch produces a distinct hash. Only the exact batch that had an accepted response (200 or 11) matches.

## 12. Adding Recipients

An add-to message is a duplicate of the original message with these differences:
- Flag bit 1 (_has add to_) set.
- _pid_ = hash of the message being added to.
- _add to from_ = participant initiating the add (must be in original _from_ or _to_).
- _add to_ = new recipient addresses.
- _time_ = new timestamp.
- _topic_ is NOT present (pid is set).

## 13. Security Requirements

- Enforce MAX_SIZE before downloading data.
- Enforce per-connection and per-IP rate limits.
- Apply idle/slow-connection timeouts.
- Verify sender IP via DNS BEFORE issuing any challenge.
- Rate-limit outgoing challenge connections.
- Use DNSSEC where supported. Fail → TERMINATE.
- Track accepted message hashes to reject duplicates.
- Support per-user storage quotas.
- Use code 105 (user undisclosed) to prevent sender enumeration.
- Log: timestamp, source IP, sender domain, response codes, challenge outcomes, termination reasons.
