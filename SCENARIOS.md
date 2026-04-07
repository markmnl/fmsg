# fmsg Test Scenarios

Scenarios for verifying implementations comply with the fmsg specification. Participants on the same domain use A1, A2…AN; another domain uses B1, B2…BN; a third domain uses C1, C2…CN.

---

## 1. Basic Message — Single Recipient, Same Domain

A1 sends a new thread message (no pid) to A2 with topic "Hello", type text/plain;charset=UTF-8, no attachments, size > 0.

**Expected Outcome:** Host A accepts for A2 (code 200). A2 receives the message with correct topic, data, and time.

## 2. Basic Message — Single Recipient, Different Domain

A1 sends a new thread message to B1 with topic, type text/plain;charset=UTF-8, no attachments.

**Expected Outcome:** Host B accepts for B1 (code 200). DNS verification of Host A's IP against `_fmsg.a.example` passes.

## 3. Basic Message — Multiple Recipients, Same Domain

A1 sends a new thread message to A2 and A3.

**Expected Outcome:** Host A responds with code 200 for both A2 and A3.

## 4. Basic Message — Multiple Recipients, Multiple Domains

A1 sends a new thread message to A2, B1, and B2.

**Expected Outcome:** Host A accepts for A2 (code 200). Host B accepts for B1 and B2 (code 200 each). Two separate connections: one for Host A's own recipients, one to Host B.

## 5. Basic Message — Empty Data

A1 sends a new thread message to B1 with size = 0 and no attachments.

**Expected Outcome:** Host B accepts (code 200). Message has zero-length data.

## 6. Basic Message — Empty Topic

A1 sends a new thread message (no pid) to B1 with topic length = 0.

**Expected Outcome:** Host B accepts (code 200). Topic is an empty string.

## 7. Basic Message — UTF-8 Topic

A1 sends a new thread message to B1 with topic containing multi-byte UTF-8 characters (e.g. "日本語テスト").

**Expected Outcome:** Host B accepts (code 200). Topic bytes match what was sent.

## 8. Basic Message — UTF-8 Recipient Name

A1 sends a new thread message to @世界@b.example.

**Expected Outcome:** Host B accepts (code 200). Address parsed correctly with UTF-8 recipient part.

## 9. Basic Message — Maximum Address Length

A1 sends a message to a recipient whose full address is 255 bytes (the maximum for uint8 prefix).

**Expected Outcome:** Host B accepts (code 200).

## 10. Basic Message — Common Media Type

A1 sends a message to B1 with common type flag set and type = 56 (text/plain;charset=UTF-8).

**Expected Outcome:** Host B accepts (code 200). Type interpreted as text/plain;charset=UTF-8.

## 11. Basic Message — Explicit Media Type String

A1 sends a message to B1 with common type flag NOT set and type = length-prefixed US-ASCII string "text/plain;charset=UTF-8".

**Expected Outcome:** Host B accepts (code 200).

## 12. Duplicate Message — Exact Resend

A1 sends a message to B1. B1 receives with code 200. A1 sends the identical message again.

**Expected Outcome:** Second attempt rejected with code 10 (duplicate) or per-recipient code 103 (user duplicate).

## 13. Duplicate Detection via Challenge

A1 sends a message to B1 (accepted). A1 re-sends the same message. Host B issues a CHALLENGE, receives the message hash in the CHALLENGE RESPONSE, detects duplicate before downloading data.

**Expected Outcome:** Host B responds code 10 (duplicate) without downloading data, closing the connection.

## 14. Reply — Valid pid

A1 sends message M1 to B1 (accepted). B1 replies to M1 with pid = SHA-256(M1).

**Expected Outcome:** Host A verifies parent stored, responds 64 (continue), then accepts for A1 (code 200). No topic field present on reply.

## 15. Reply — Topic Absent

B1 replies to M1 with pid set. The reply message MUST NOT include a topic field.

**Expected Outcome:** Host A accepts (code 200). Binary parse succeeds with no topic field after time.

## 16. Reply — Topic Present on Reply (Invalid)

B1 replies to M1 with pid set but also includes a topic field in the binary stream.

**Expected Outcome:** Host A fails to parse or detects invalid structure. TERMINATE or REJECT code 1 (invalid).

## 17. Reply — pid Not Found

B1 sends a reply to A1 with pid referencing a message hash Host A does not have.

**Expected Outcome:** Host A responds REJECT code 6 (parent not found).

## 18. Reply — Sender Not Participant of Parent

C1 sends a reply with pid referencing a message between A1 and B1 (C1 was not a participant).

**Expected Outcome:** Receiving host responds REJECT code 1 (invalid) because _from_ was not a participant in the parent.

## 19. Reply — Chain of Replies

A1 sends M1 to B1. B1 replies M2 (pid=hash(M1)). A1 replies M3 (pid=hash(M2)).

**Expected Outcome:** Each message accepted. Thread forms M1 → M2 → M3.

## 20. Reply — Time Travel (Reply Before Parent)

A1 sends M1 to B1 at time T. B1 replies with pid=hash(M1) but time = T − 1000.

**Expected Outcome:** Host A responds REJECT code 9 (time travel).

## 21. Reply — Time Just After Parent Minus Skew

A1 sends M1 at time T. B1 replies at time T − (MAX_TIME_SKEW − 1) (within tolerance).

**Expected Outcome:** Host A accepts — parent time minus MAX_TIME_SKEW is before reply time.

## 22. Reply — Time Exactly At Boundary

A1 sends M1 at time T. B1 replies at time exactly T − MAX_TIME_SKEW.

**Expected Outcome:** Host A responds REJECT code 9 (time travel) — parent time minus MAX_TIME_SKEW is NOT before reply time (equal fails the "must be before" check).

## 23. Time — Message Too Old

A1 sends a message to B1 with time = (now − MAX_MESSAGE_AGE − 1).

**Expected Outcome:** Host B responds REJECT code 7 (too old).

## 24. Time — Message At Age Boundary

A1 sends a message to B1 with time = (now − MAX_MESSAGE_AGE).

**Expected Outcome:** Boundary behaviour: DELTA equals MAX_MESSAGE_AGE. Since the check is "greater than", this should be accepted.

## 25. Time — Message In Future Within Skew

A1 sends a message to B1 with time = (now + MAX_TIME_SKEW − 1).

**Expected Outcome:** Host B accepts — absolute DELTA within tolerance.

## 26. Time — Message Too Far In Future

A1 sends a message to B1 with time = (now + MAX_TIME_SKEW + 1).

**Expected Outcome:** Host B responds REJECT code 8 (future time).

## 27. Time — Message At Future Boundary

A1 sends a message to B1 with time = (now + MAX_TIME_SKEW).

**Expected Outcome:** Boundary: absolute DELTA equals MAX_TIME_SKEW. Since check is "greater than", this should be accepted.

## 28. Size — Exceeds MAX_SIZE

A1 sends a message to B1 with size = MAX_SIZE + 1 and no attachments.

**Expected Outcome:** Host B responds REJECT code 4 (too big).

## 29. Size — Exactly MAX_SIZE

A1 sends a message to B1 with size = MAX_SIZE and no attachments.

**Expected Outcome:** Host B accepts header (code 64 continue).

## 30. Size — Data Plus Attachments Exceed MAX_SIZE

A1 sends a message to B1 with size = 100 and one attachment of size = MAX_SIZE.

**Expected Outcome:** Host B responds REJECT code 4 (too big).

## 31. Version — Unsupported Version Number

A1 sends a message with version = 99 to B1 (Host B only supports version 1).

**Expected Outcome:** Host B responds REJECT code 2 (unsupported version).

## 32. Version — Value 0

A1 sends a byte stream starting with version = 0.

**Expected Outcome:** Host B responds REJECT code 2 (unsupported version). Value 0 is unused.

## 33. Version — Value 128

A1 sends a byte stream starting with version = 128.

**Expected Outcome:** Host B responds REJECT code 2 (unsupported version). Value 128 is unused.

## 34. Invalid Common Type ID — Message

A1 sends a message with common type flag set and type = 200 (unmapped).

**Expected Outcome:** Host B responds REJECT code 1 (invalid).

## 35. Invalid Common Type ID — Attachment

A1 sends a message with a valid message type but an attachment whose common type flag is set with type = 200 (unmapped).

**Expected Outcome:** Host B responds REJECT code 1 (invalid).

## 36. Common Type ID 0 — Message

A1 sends a message with common type flag set and type = 0 (not in mapping table, table starts at 1).

**Expected Outcome:** Host B responds REJECT code 1 (invalid).

## 37. Empty To Field

A1 sends a message with to count = 0.

**Expected Outcome:** Host B responds REJECT code 1 (invalid). At least one address required.

## 38. Duplicate Addresses in To

A1 sends a message with to = [B1, B1] (same address twice).

**Expected Outcome:** Host B responds REJECT code 1 (invalid). Addresses must be distinct.

## 39. Duplicate Addresses in To — Case Folding

A1 sends a message with to = [@bob@b.example, @BOB@b.example].

**Expected Outcome:** Host B responds REJECT code 1 (invalid). Addresses must be distinct case-insensitively.

## 40. No Recipients for Receiving Host

A1 sends a message with to = [A2] to Host B.

**Expected Outcome:** Host B responds REJECT code 1 (invalid). No recipients belong to Host B's domain.

## 41. DNS Verification Failure — IP Not Authorised

A1 sends a message to B1 from an IP address not listed in `_fmsg.a.example` DNS records.

**Expected Outcome:** Host B MUST TERMINATE the connection.

## 42. DNS Verification — DNSSEC Failure

A1 sends a message to B1. The DNS response for `_fmsg.a.example` fails DNSSEC validation.

**Expected Outcome:** Host B MUST TERMINATE the connection.

## 43. Challenge — Successful Exchange

A1 sends a message to B1. Host B issues a CHALLENGE on Connection 2 with the message header hash. Host A responds with the correct message hash.

**Expected Outcome:** Challenge succeeds. Connection 2 closes. Host B continues on Connection 1.

## 44. Challenge — Header Hash Mismatch

Host B sends a CHALLENGE to Host A with an incorrect header hash (does not match any outgoing message).

**Expected Outcome:** Host A MUST TERMINATE the connection.

## 45. Challenge — Message Hash Mismatch After Download

Host A responds to a CHALLENGE with an incorrect message hash. Host B downloads the full message and computes the hash.

**Expected Outcome:** Computed hash does not match challenge response hash. Host B MUST TERMINATE.

## 46. Challenge — Version Byte Mapping

Host B sends a CHALLENGE with version byte 255 (= CHALLENGE for fmsg v1, since 256 − 255 = 1).

**Expected Outcome:** Host A recognises this as a v1 challenge and processes it.

## 47. Challenge — Unsupported Challenge Version

Host B sends a CHALLENGE with version byte 200 (= challenge for fmsg version 56). Host A only supports v1.

**Expected Outcome:** Host A MUST TERMINATE the connection.

## 48. No Challenge — Message Accepted

A1 sends a message to B1. Host B does NOT issue a challenge (NEVER mode). Host B downloads data and accepts.

**Expected Outcome:** No Connection 2 opened. Host B responds 64 then per-recipient code 200.

## 49. Add Recipients — Valid Add-To

A1 sends M1 to B1 (accepted). A1 sends add-to message: pid=hash(M1), add to from=A1, add to=[C1].

**Expected Outcome:** Host C accepts. If Host B already has M1, it responds 11 (accept add to). If Host C does not have M1, it responds 64 (continue) and receives the full message.

## 50. Add Recipients — Host Already Has Parent

A1 sends M1 to B1 and B2. A1 sends add-to for M1 adding B3. Host B already has M1.

**Expected Outcome:** Host B responds 11 (accept add to) and records add-to fields. No data transmission needed.

## 51. Add Recipients — Host Does Not Have Parent

A1 sends M1 to B1. A1 sends add-to for M1 adding C1. Host C has never seen M1.

**Expected Outcome:** Host C responds 64 (continue). Full message data transmitted. Host C accepts for C1 (code 200).

## 52. Add Recipients — add to from Not a Participant (Invalid)

A1 sends M1 to B1. C1 (not a participant) sends add-to message with pid=hash(M1), add to from=C1, add to=[B2].

**Expected Outcome:** Host B responds REJECT code 1 (invalid) because add to from (C1) is not in _from_ or _to_ of the add-to message's own fields.

## 53. Add Recipients — add to from Is From Field

A1 sends M1 to B1. A1 sends add-to where add to from = A1 (same as from field).

**Expected Outcome:** Valid. add to from is in _from_. Accepted.

## 54. Add Recipients — add to from Is In To Field

A1 sends M1 to B1 and B2. B1 sends add-to where from=A1, add to from = B1 (B1 is in _to_).

**Expected Outcome:** Valid. add to from is in _to_. However, sender's domain is B (from add to from), so Host B delivers.

## 55. Add Recipients — Missing pid (Invalid)

A1 sends an add-to message (has add to flag set) but pid is not set (has pid flag = 0).

**Expected Outcome:** Host B responds REJECT code 1 (invalid). pid MUST exist when add to exists.

## 56. Add Recipients — Missing add to from (Invalid)

A1 sends a message with has add to flag set but add to from field is absent.

**Expected Outcome:** Parse failure or REJECT code 1 (invalid).

## 57. Add Recipients — Empty add to List

A1 sends an add-to message where add to count = 0.

**Expected Outcome:** REJECT code 1 (invalid). Must have at least one address in add to.

## 58. Add Recipients — Duplicate Addresses in add to

A1 sends add-to with add to = [C1, C1].

**Expected Outcome:** REJECT code 1 (invalid). Addresses in add to must be distinct.

## 59. Add Recipients — add to Overlaps to

A1 sends add-to with to = [B1] and add to = [B1].

**Expected Outcome:** Accepted. Overlap is permitted per specification. Allows re-delivery to recipients who lost their copy.

## 60. Add Recipients — Time Travel on Add-To

A1 sends M1 at time T. A1 sends add-to (pid=hash(M1)) with time < T − MAX_TIME_SKEW.

**Expected Outcome:** Host responds REJECT code 9 (time travel) if parent is stored.

## 61. Add Recipients — Only add to from Host Delivers

A1 sends M1 to B1. B1 wants to add C1. B1 sends add-to where add to from=B1. Host B delivers because add to from belongs to Host B's domain.

**Expected Outcome:** Host C verifies sender IP against `_fmsg.b.example` (add to from domain). Accepted if IP matches.

## 62. Attachment — Single Attachment

A1 sends a message to B1 with one attachment: type=application/pdf (common type 6), filename="doc.pdf", size=1024.

**Expected Outcome:** Host B accepts. Attachment data (1024 bytes) follows message data.

## 63. Attachment — Multiple Attachments

A1 sends a message to B1 with 3 attachments of varying sizes.

**Expected Outcome:** Host B accepts. Attachment data concatenated in header order.

## 64. Attachment — Zero Attachments Explicit

A1 sends a message with attachment count = 0.

**Expected Outcome:** Host B accepts. No attachment headers or data expected.

## 65. Attachment — Filename Validation (Valid)

Attachment with filename = "my-file_v2.pdf".

**Expected Outcome:** Accepted. Letters, digits, hyphen, underscore, dot all valid.

## 66. Attachment — Filename With Space

Attachment with filename = "my document.pdf".

**Expected Outcome:** Accepted. Single space is permitted (non-consecutive, not at start/end).

## 67. Attachment — Filename With Consecutive Dots (Invalid)

Attachment with filename = "file..pdf".

**Expected Outcome:** REJECT code 1 (invalid). Consecutive special characters not allowed.

## 68. Attachment — Filename Starting With Dot (Invalid)

Attachment with filename = ".hidden".

**Expected Outcome:** REJECT code 1 (invalid). Special characters not allowed at beginning.

## 69. Attachment — Filename Ending With Hyphen (Invalid)

Attachment with filename = "file-".

**Expected Outcome:** REJECT code 1 (invalid). Special characters not allowed at end.

## 70. Attachment — Duplicate Filenames (Invalid)

Two attachments both named "doc.pdf".

**Expected Outcome:** REJECT code 1 (invalid). Filenames must be unique (case-insensitive).

## 71. Attachment — Duplicate Filenames Case Insensitive (Invalid)

Two attachments: "Doc.PDF" and "doc.pdf".

**Expected Outcome:** REJECT code 1 (invalid). Filenames must be unique case-insensitively.

## 72. Attachment — Filename With Unicode Letters

Attachment with filename = "文書.pdf".

**Expected Outcome:** Accepted. Unicode letters are valid.

## 73. Attachment — Common Type Flag Per-Attachment

Message with common type flag NOT set (explicit string type), but attachment has its own common type flag SET.

**Expected Outcome:** Accepted. Attachment type flags are independent of message type flag.

## 74. Attachment — Explicit Type String on Attachment

Attachment with common type flag not set, type = "application/x-custom".

**Expected Outcome:** Accepted.

## 75. Deflate — Message Data Compressed

A1 sends message with deflate flag (bit 5) set. Data is zlib-compressed.

**Expected Outcome:** Host B accepts. Message hash computed over decompressed data.

## 76. Deflate — Attachment Data Compressed

A1 sends message with an attachment whose deflate flag (bit 1) is set. Attachment data is zlib-compressed.

**Expected Outcome:** Host B accepts. Attachment hash computed over decompressed data.

## 77. Deflate — Message and Attachment Both Compressed

Both message deflate flag and attachment deflate flag set.

**Expected Outcome:** Host B accepts. All hashes computed over decompressed data.

## 78. Deflate — Flag Set But Data Not Compressed

Message deflate flag set but data is not valid zlib/deflate.

**Expected Outcome:** Host B fails to decompress. Implementation-defined error handling (TERMINATE or reject).

## 79. Important Flag

A1 sends a message with important flag (bit 3) set.

**Expected Outcome:** Host B accepts. Flag preserved in stored message.

## 80. No Reply Flag

A1 sends a message with no reply flag (bit 4) set.

**Expected Outcome:** Host B accepts. If B1 attempts to reply, the reply should be discarded by Host A.

## 81. No Reply — Reply Attempted

A1 sends M1 to B1 with no reply flag set. B1 sends a reply with pid=hash(M1).

**Expected Outcome:** Host A may accept or discard the reply. The flag indicates sender will discard replies; enforcement is sender-side.

## 82. Reserved Flag Bits Set

A1 sends a message with flag bits 6 and 7 set (reserved/TBD).

**Expected Outcome:** Implementation-defined. A strict implementation may reject; a lenient one may ignore unknown bits.

## 83. Per-Recipient — User Unknown

A1 sends a message to B1 where B1 does not exist on Host B.

**Expected Outcome:** Host B responds code 100 (user unknown) or 105 (user undisclosed) for B1.

## 84. Per-Recipient — User Full

A1 sends a message to B1 whose storage quota is exceeded.

**Expected Outcome:** Host B responds code 101 (user full) or 105 (user undisclosed) for B1.

## 85. Per-Recipient — User Not Accepting

A1 sends a message to B1 who is configured to not accept new messages.

**Expected Outcome:** Host B responds code 102 (user not accepting) or 105 (user undisclosed) for B1.

## 86. Per-Recipient — Mixed Results

A1 sends a message to B1 (exists, has space), B2 (unknown), B3 (full).

**Expected Outcome:** Host B responds: 200 for B1, 100 for B2, 101 for B3 (in to-field order). Or 105 substituted for any rejection.

## 87. Per-Recipient — User Undisclosed Instead of Specific Code

A1 sends a message to B1 (unknown). Host B is configured to hide rejection reasons.

**Expected Outcome:** Host B responds code 105 (user undisclosed) instead of 100.

## 88. Per-Recipient — User Duplicate

A1 sends M1 to B1 (accepted as 200). A1 re-sends M1. Host B downloads it in full this time.

**Expected Outcome:** Host B responds per-recipient code 103 (user duplicate) for B1.

## 89. Insufficient Resources — Global

Host B's disk is full. A1 sends any message to B1.

**Expected Outcome:** Host B responds REJECT code 5 (insufficient resources) for all recipients.

## 90. Undisclosed — Global Rejection

Host B rejects A1's message without disclosing reason.

**Expected Outcome:** Host B responds REJECT code 3 (undisclosed).

## 91. Sending Host — from Must Belong to Sender Domain

Host A attempts to deliver a message where _from_ belongs to a different domain (b.example) and _has add to_ is not set.

**Expected Outcome:** Host A MUST NOT deliver this message. The sending constraint requires _from_ or _add to from_ to belong to Host A's domain.

## 92. Sending Host — Excludes Own Domain From Recipients

A1 sends a message to A2 and B1. Host A delivers to Host B only (excluding its own domain from the outbound connection set).

**Expected Outcome:** Host A handles A2 locally. Connection to Host B only includes B1 in recipient processing.

## 93. Connection Retry — First IP Unresponsive

Host B has two IPs from DNS. The first is unresponsive.

**Expected Outcome:** Host A attempts the second IP and delivers successfully.

## 94. Connection Retry — All IPs Unresponsive

All IPs for Host B are unresponsive.

**Expected Outcome:** Host A retries with backoff. After max delivery window, message considered undeliverable.

## 95. Malformed Header — Unparseable Types

A1 sends a byte stream to B1 where the header bytes cannot be decoded into valid field types (e.g. truncated address).

**Expected Outcome:** Host B MUST TERMINATE the connection (parse failure).

## 96. Data Length Mismatch — Sender Sends Too Few Bytes

A1 declares size = 1000 but only sends 500 bytes of data then stops.

**Expected Outcome:** Host B detects incomplete data (connection stalls or closes prematurely). TERMINATE.

## 97. Data Length Mismatch — Sender Sends Too Many Bytes

A1 declares size = 100 but attempts to send 200 bytes.

**Expected Outcome:** Host B reads exactly 100 bytes. Remaining bytes are not read. Per-recipient responses follow after exactly the declared size.

## 98. Sender Must Register Header Hash Before Sending

A1 sends a message without registering the message header hash. Host B issues a CHALLENGE.

**Expected Outcome:** Host A has no record to match the challenge against. Host A MUST TERMINATE (no match found).

## 99. Sender Removes Header Hash After Exchange

A1 completes message exchange. Verify the message header hash is removed from the outgoing record.

**Expected Outcome:** No stale entries remain. A subsequent challenge with that hash has no match.

## 100. Concurrent Message Exchanges — Challenge Matching

Host A sends two messages simultaneously to Host B and Host C. Host B issues a CHALLENGE.

**Expected Outcome:** Host A matches the CHALLENGE header hash to the correct outgoing message (to Host B), not the one to Host C.

## 101. Challenge — Receiving Host Verifies Sender IP Before Challenging

Host B receives a message from A1. Before opening Connection 2, Host B resolves `_fmsg.a.example` and confirms Connection 1 source IP is in the set.

**Expected Outcome:** Challenge only proceeds if IP verification passes. If it fails, Host B MUST NOT open Connection 2.

## 102. Challenge Reflection Prevention

Attacker sends message with forged _from_ (victim's domain). Receiving Host resolves `_fmsg.victim.example` and finds the connection IP is NOT in the set.

**Expected Outcome:** Receiving Host TERMINATES without issuing a challenge. Victim is never contacted.

## 103. Three-Domain Thread

A1 sends M1 to B1 and C1. B1 replies M2 (pid=hash(M1)) to A1 and C1. C1 replies M3 (pid=hash(M2)) to A1 and B1.

**Expected Outcome:** All messages accepted. Thread: M1 → M2 → M3. Each host verifies parent stored and sender participation.

## 104. Long Thread Chain

A1 and B1 exchange 10 messages alternating replies, each referencing the previous.

**Expected Outcome:** All accepted. Each pid verified. Thread forms a chain of 10 messages.

## 105. Reply — Participant From add to

A1 sends M1 to B1. A1 adds C1 via add-to (pid=hash(M1)). C1 replies to the add-to message hash.

**Expected Outcome:** C1 is a participant (via add to). Reply accepted.

## 106. Reply — add to Recipient Cannot Add Further Recipients

A1 sends M1 to B1. A1 adds C1 via add-to. C1 attempts to add D1 via add-to with add to from=C1.

**Expected Outcome:** REJECT code 1 (invalid). C1 is only in _add to_, not in _from_ or _to_. add to from must be in _from_ or _to_.

## 107. Add Recipients — Multiple Batches

A1 sends M1 to B1. A1 adds C1 (batch 1). A1 adds D1 (batch 2, pid=hash(M1) again).

**Expected Outcome:** Both batches accepted independently. Each produces a distinct message hash for future reference.

## 108. Verify Message Stored — Hash of Add-To Message

After batch 1 add-to is accepted (code 11), the stored hash is computed from the add-to header + original data. A subsequent reply referencing this hash should be found.

**Expected Outcome:** Parent found. Reply accepted.

## 109. Verify Message Stored — Original Hash Still Valid

After add-to batch is recorded, a reply referencing the original message hash (without add-to) should still be found.

**Expected Outcome:** Parent found. Both the original hash and the add-to hash are independently valid.

## 110. Sending a Message — Host A Reads Continue Then Sends Data

A1 sends header to Host B. Host B responds 64 (continue).

**Expected Outcome:** Host A proceeds to transmit exactly _size_ + sum(attachment sizes) bytes. Host B reads and responds per-recipient.

## 111. Sending a Message — Unexpected Response Code

Host B responds with code 50 (not defined) after header exchange.

**Expected Outcome:** Host A MUST TERMINATE. Code is not 1–10, 11, or 64.

## 112. Sending a Message — Code 11 Without add to (Invalid)

Host B responds code 11 but message has no _has add to_ flag.

**Expected Outcome:** Host A MUST TERMINATE. Code 11 is only valid when additional recipients are present.

## 113. Per-Recipient Response Count Matches Recipients

A1 sends to B1, B2, B3. After data transmission, Host A reads exactly 3 response bytes.

**Expected Outcome:** 3 bytes received, one per recipient in to-field order for Host B's domain.

## 114. Per-Recipient Response Order — to Then add to

A1 sends message with to=[B1, B2] and add to=[B3]. After data, Host A reads 3 bytes: B1, B2, B3 in that order.

**Expected Outcome:** Response bytes are in the order addresses appear in _to_ then _add to_ for Host B's domain.

## 115. Handling Incoming Connection — Message vs Challenge Disambiguation

Host A is listening. An incoming connection arrives with first byte = 1 (message version 1).

**Expected Outcome:** Host A processes this as an incoming message per Connection and Header Exchange.

## 116. Handling Incoming Connection — Challenge Recognised

Host A is listening. An incoming connection arrives with first byte = 255 (CHALLENGE for v1).

**Expected Outcome:** Host A processes this as an incoming challenge.

## 117. Handling Incoming Connection — Unrecognised First Byte

Host A is listening. An incoming connection arrives with first byte = 128.

**Expected Outcome:** Host A MUST TERMINATE the connection.

## 118. Attachment — Size Zero

A1 sends a message with one attachment where size = 0.

**Expected Outcome:** Accepted. Attachment header valid, zero bytes of attachment data.

## 119. Attachment — Filename Exactly 255 Bytes

Attachment with a UTF-8 filename that is exactly 255 bytes.

**Expected Outcome:** Accepted. Less than 256 bytes requirement met.

## 120. Attachment — Filename 256 Bytes (Invalid)

Attachment with a UTF-8 filename that is 256 bytes.

**Expected Outcome:** Filename length overflows uint8 prefix. Parse error or REJECT code 1 (invalid).

## 121. Multiple Recipients Same Domain — Single Connection

A1 sends a message to B1, B2, B3. Host A opens one connection to Host B.

**Expected Outcome:** One connection used for all three recipients on the same domain. Three per-recipient response bytes.

## 122. add to from DNS Verification

B1 sends add-to message (add to from=B1) to Host C. Host C resolves `_fmsg.b.example` and verifies Connection 1 IP.

**Expected Outcome:** DNS check uses _add to from_ domain (b.example), not _from_ domain. Connection accepted if IP matches.

## 123. from DNS Verification — Normal Message

A1 sends message (no add to) to B1. Host B resolves `_fmsg.a.example`.

**Expected Outcome:** DNS check uses _from_ domain (a.example). Connection accepted if IP matches.

## 124. Slow Connection — Idle Timeout

A1 opens connection to Host B but sends no data.

**Expected Outcome:** Host B closes connection after implementation-defined idle timeout.

## 125. Slow Connection — Slow Data Rate

A1 sends header then transmits data at an extremely slow rate.

**Expected Outcome:** Host B may terminate if transfer rate drops below minimum threshold.

## 126. Large Message — Exactly MAX_SIZE

A1 sends a message with size = MAX_SIZE, no attachments.

**Expected Outcome:** Host B accepts header (code 64), downloads data, per-recipient responses.

## 127. 255 Recipients in to

A1 sends a message with 255 recipients (max for uint8 count prefix).

**Expected Outcome:** Accepted. 255 per-recipient response bytes expected from each receiving host.

## 128. 255 Attachments

A1 sends a message with 255 attachments (max for uint8 count prefix).

**Expected Outcome:** Accepted if total size within MAX_SIZE. 255 attachment headers parsed, data concatenated.

## 129. Float64 Time — Sub-Second Precision

A1 sends a message with time = 1654503265.679954 (microsecond precision float64).

**Expected Outcome:** Host B accepts. Time field parsed as IEEE-754 float64 with fractional seconds preserved.

## 130. Float64 Time — Negative Time (Invalid Era)

A1 sends a message with time = −1000.0.

**Expected Outcome:** DELTA is very large (now − (−1000)). Likely exceeds MAX_MESSAGE_AGE. REJECT code 7 (too old).

## 131. Challenge During Add-To When Parent Not Stored

A1 sends add-to for M1 to Host C (which doesn't have M1). Host C issues a CHALLENGE.

**Expected Outcome:** Host A responds to challenge. Host C responds 64, downloads full message, verifies hash if challenged, per-recipient responses.

## 132. Add-To Accept — No Data Transmission

A1 sends add-to header to Host B (which has M1). Host B responds 11.

**Expected Outcome:** Host A does NOT transmit data or attachment data. Connection closes immediately after code 11.

## 133. Verify Stored — Message Deleted By All Recipients

Host B accepted M1 for B1. B1 deletes their copy. A1 sends reply (pid=hash(M1)).

**Expected Outcome:** Host B must still have the message at host level for verification. If host-level copy exists, parent found. If not, REJECT code 6.

## 134. Reply With Attachments

B1 replies to M1 with data + 2 attachments.

**Expected Outcome:** Accepted. Attachments transmitted after data. pid verified, participant check passes.

## 135. New Thread With Attachments

A1 sends first message in thread to B1 with topic, data, and 3 attachments.

**Expected Outcome:** Accepted. Topic stored. Attachments stored. All sizes match declared.

## 136. Common Media Type — All 64 Values

Send 64 separate messages, each using a different common type ID (1–64).

**Expected Outcome:** All accepted. Each type ID maps to the correct Media Type string.

## 137. Explicit Type String — Maximum Length

Send a message with common type flag NOT set and a Media Type string of 255 bytes (max uint8 length).

**Expected Outcome:** Accepted. Type string parsed correctly.

## 138. Explicit Type String — Zero Length

Send a message with common type flag NOT set and type length = 0.

**Expected Outcome:** Implementation-defined. An empty media type string may be considered invalid.

## 139. Address — Hyphen, Underscore, Dot In Recipient

Send to @a-b_c.d@b.example.

**Expected Outcome:** Accepted. All special characters valid when non-consecutive and not at start/end.

## 140. Address — Consecutive Hyphens (Invalid)

Send to @a--b@b.example.

**Expected Outcome:** REJECT code 1 (invalid) or code 100 (user unknown). Address fails recipient validation.

## 141. Address — Leading Dot (Invalid)

Send to @.user@b.example.

**Expected Outcome:** Invalid recipient part. Special characters not allowed at beginning.

## 142. POSIX Time — Very Large Value

A1 sends a message with time well into the future (e.g. year 2100).

**Expected Outcome:** REJECT code 8 (future time) — DELTA is very negative, absolute value exceeds MAX_TIME_SKEW.

## 143. Thread Integrity — Tampered pid

A1 sends a reply with pid that is 32 bytes but does not match any known message hash.

**Expected Outcome:** REJECT code 6 (parent not found).

## 144. Binary Parsing — Truncated Message Header

A1 opens connection and sends only 5 bytes then closes.

**Expected Outcome:** Host B fails to parse header. TERMINATE.

## 145. Binary Parsing — Extra Bytes After Declared Data

A1 sends correct header, correct data (matching size), correct attachment data, then sends extra unexpected bytes.

**Expected Outcome:** Host B has already read the exact expected amount. Extra bytes are not consumed. Host B sends per-recipient responses and closes.

## 146. Deflate — Hash Consistency Across Senders

A1 sends M1 to B1 with deflate. B1 computes hash over decompressed data. B1 replies to M1.

**Expected Outcome:** Both hosts agree on the message hash (computed over decompressed data). pid = SHA-256(decompressed M1) matches.

## 147. Deflate — Only Message Data, Not Attachments

Message deflate flag set, but attachment deflate flags NOT set.

**Expected Outcome:** Message data decompressed for hashing. Attachment data NOT decompressed for hashing (not compressed).

## 148. Deflate — Only Attachment, Not Message Data

Message deflate flag NOT set, but attachment deflate flag set.

**Expected Outcome:** Message data used as-is for hashing. Attachment data decompressed for hashing.

## 149. Challenge — Concurrent Challenges From Different Hosts

Host A sends messages to Host B and Host C simultaneously. Both issue CHALLENGEs.

**Expected Outcome:** Host A matches each CHALLENGE header hash to the correct outgoing message and responds with the correct message hash for each.

## 150. Full Exchange — End-to-End With All Features

A1 sends a new thread message to B1 and C1 with topic, important flag, deflate, 2 attachments (one deflated). Host B challenges. Host C does not. Both accept.

**Expected Outcome:** All fields correctly encoded, challenge succeeds, hashes match, per-recipient code 200 from both hosts.
