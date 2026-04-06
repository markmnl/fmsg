# fmsg Specification

- [Terminology](#terminology)
    - [Terms](#terms)
- [Overview](#overview)
- [Definition](#definition)
    - [Message Types](#message-types)
    - [Data Types](#data-types)
    - [Message](#message)
    - [Notes on Message Definition](#notes-on-message-definition)
    - [Notes on Time](#notes-on-time)
    - [Flags](#flags)
        - [Common Media Types](#common-media-types)
    - [Attachment](#attachment)
        - [Attachment Flags](#attachment-flags)
    - [Address](#address)
    - [Challenge](#challenge)
    - [Challenge Response](#challenge-response)
    - [Reject or Accept Response](#reject-or-accept-response)
- [Protocol](#protocol)
    - [Protocol Steps](#protocol-steps)
        - [1. Connection and Header Exchange](#1-connection-and-header-exchange)
        - [2. The Automatic Challenge](#2-the-automatic-challenge)
        - [3. Integrity Verification, Per-Recipient Response and Disposition](#3-integrity-verification-per-recipient-response-and-disposition)
        - [4. Sending a Message](#4-sending-a-message)
    - [Handling a Challenge](#handling-a-challenge)
    - [Verifying Original Message Stored](#verifying-original-message-stored)
- [Domain Resolution](#domain-resolution)
    - [Notes on Domain Resolution](#notes-on-domain-resolution)
    - [Practical Concerns](#practical-concerns)
- [Security Concerns](#security-concerns)
    - [Connection Flooding](#connection-flooding)
    - [Oversized or Slow Data Attacks](#oversized-or-slow-data-attacks)
    - [Challenge Reflection and Amplification](#challenge-reflection-and-amplification)
    - [DNS Spoofing and Cache Poisoning](#dns-spoofing-and-cache-poisoning)
    - [Message Replay](#message-replay)
    - [Sender Enumeration](#sender-enumeration)
    - [Resource Exhaustion via Storage](#resource-exhaustion-via-storage)
    - [Monitoring and Logging](#monitoring-and-logging)



## Terminology

_"fmsg"_ is the name given to the protocol and message definitions described in this document. The name "fmsg" is neither an abbreviation nor acronym, instead is thought of as "f-message". The "f" is inspired from popular programming languages such as C's `printf` where the "f" stands for "formatted", "msg" is a common shortening of "message" conveying the meaning while keeping the whole name succinct; "fmsg".

This document occasionally employs normative language (e.g., “MUST”, “SHOULD”, “MAY”) in the style of an RFC to better describe protocol behaviour and requirements. However, this specification is not currently an official RFC and does not claim standards-track status. The use of such terminology is intended to improve clarity in defining the protocol, rather than to imply formal standardisation. Future evolution of this work may align with the RFC process, at which point these terms would be interpreted in accordance with such established conventions.


### Terms

_"address"_ an fmsg address in the form `@user@example.com`, see: [Address](#address).

_"case-insensitive"_ byte-wise equality comparison after applying Unicode default case folding (locale-independent) to both UTF-8 strings.

_"client"_ the end participant/application that sends and recieves messages via their _host_.

_"DNS"_ is for the Domain Name System.

_"host"_ is an fmsg implementation which can send and receive fmsg messages to and from other hosts following the definitions and protocol of this specification.

_"message"_ refers to an entire message described in [Message](#message) definition.

_"message hash"_ the SHA-256 digest of a message.

_"message header"_ refers to the fields up to and including the attachment headers field in a message.

_"message header hash"_ the SHA-256 digest of a message header.

_"participants"_ all recipients plus the sender

_"recipient"_ an address in a message's _to_ or _add to_ fields

_"recipients"_ the set of all addresses in a message's _to_ and _add to_ fields

_"sender"_ the address in a message's _from_ field

_"thread"_ is a linked hierarchy of messages where messages relate to previous messages using the _pid_ field

_"user"_ alias of participant

_"UTF-8"_ is for the unicode standard: Unicode Transformation Format – 8-bit.


## Overview

Before diving into the technical details, the following principles outline how fmsg works at a high level.

**Messages are immutable.** Messages can never be changed once sent.

**Messages form threads.** Every reply references the previous message it is responding to via a cryptographic hash. This creates a linked chain of messages — a thread — where each message's parentage is verifiable by all participants. The first message in a thread has no parent reference and instead carries a topic.

**One message at a time.** A host sends a single message per connection to a receiving host. The message is either rejected outright for all recipients (e.g. the message is malformed or too large) or accepted and rejected on a per-recipient basis (e.g. a recipient's message store is full while another's accepts the message).

**Binary and compact.** Messages are encoded in a binary format with explicitly sized fields. There are no null terminators or delimiters — every field's length is known, keeping messages compact and resistant to common parsing vulnerabilities.

**Only participants can reply.** To reply to a message a sender must have been a participant of that message. This is enforced structurally: the hash used to reference a parent depends on whether the sender was in the original recipient list, the original sender or was added later, and the Receiving Host verifies this linkage.

**Rejection tells you why.** When a message is rejected the Receiving Host includes a reason code. This allows the Sending Host to determine whether re-sending is worthwhile (e.g. the recipient was temporarily full), pointless (e.g. the message is a duplicate), or indicative of a problem that needs attention (e.g. the message was deemed invalid).

**Sender verification is built in.** A Receiving Host verifies that the sending host's IP address is authorised by the sender's domain via DNS. An optional challenge mechanism provides additional assurance by requiring the sender to prove knowledge of the message content while it is being transmitted.


## Definition

### Message Types

Four message types are defined by fmsg: MESSAGE, CHALLENGE, CHALLENGE RESPONSE and "REJECT or ACCEPT RESPONSE". These structures are aggregates of [Data Types](#data-types) and are described in the [Definition](#definition) section.


### Data Types

Throughout this document the following data types are used. All types are always encoded little-endian.

| name       | description                                                                                                          |
|------------|----------------------------------------------------------------------------------------------------------------------|
| uint8      | 8 bit wide unsigned integer with a value in the set 0 to 255                                                         |
| uint16     | 16 bit wide unsigned integer with a value in the set 0 to 65535                                                      | 
| uint32     | 32 bit wide unsigned integer with a value in the set 0 to 4294967295                                                 |
| bit        | single bit 0 or 1 within one of the uint types, the 0 based index of which is defined alongside in this document     |
| float64    | 64 bit wide number in the set of all IEEE-754 64-bit floating-point numbers                                          |
| byte       | a uint8                                                                                                              |
| byte array | sequence of uint8 values the length of which is defined alongside in this document                                   |
| bytes      | a byte array                                                                                                         |
| string     | sequence of characters the length and encoding (e.g. US-ASCII, UTF-8...) of which is defined alongside in this document |


String lengths are always explicitly defined and null terminating characters are not used. This is a design decision because it prevents a class of buffer over-run bugs (search "Heartbleed bug"), simplifies message size calculation, and, inherently limits the length of strings while adding no extra data than a null terminating character would (since all strings lengths here are defined by one uint8).


### Message

In programmer friendly JSON a message could look like (once decoded from the binary format defined below):

```JSON
{
    "version": 1,
    "important": false,
    "noreply": false,
    "pid": null,
    "from": "@user@example.com",
    "to": [
        "@世界@example.com",
        "@chris@example.edu"
    ],
    "time": 1654503265.679954,
    "topic": "Hello fmsg!",
    "type": "text/plain;charset=UTF-8",
    "size": 45,
    "data": "The quick brown fox jumps over the lazy dog.",
    "attachments": [
        {
            "type": "application/pdf",
            "filename": "doc.pdf",
            "size": 1024
        }
    ]
}
```

On the wire messages are encoded thus:

| field               | type                                 | description                                                                                                                                                     |
|---------------------|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| version             | uint8                                | A value greater than 0 and less than 128 is the fmsg version number; a value greater than 128 and less than 256 means this message is a [CHALLENGE](#challenge) defined below. |
| flags               | uint8                                | Bit field. See [flags](#flags) for each bit's meaning.                                                                                                          |
| [pid]               | byte array                           | Reference to the previous message hash. Only present if flags has pid bit set.                                                                                  |
| from                | fmsg address                         | Sender's address.                                                                                                                                               |
| to                  | uint8 + list of fmsg addresses       | Recipient addresses. Prefixed by uint8 count, addresses MUST be distinct (case-insensitive) of which there MUST be at least one.                                |
| [add to from]       | fmsg address                         | Address adding recipients. MUST exist if flags has _add to_ bit set, otherwise MUST not exist.                                                                                           |
| [add to]            | uint8 + list of fmsg addresses       | Additional recipient addresses. MUST exist if flags has _add to_ bit set, otherwise MUST not exist. Prefixed by uint8 count, addresses MUST be distinct (case-insensitive) of which there MUST be at least one. |
| time                | float64                              | POSIX epoch time message was ready for sending by host sending the message.                                                                                              |
| [topic]             | uint8 + UTF-8 string                 | UTF-8 free text title of the first message in a thread. Only present if _pid_ is not set. Prefixed by uint8 size which may be 0.                                |
| type                | uint8 + [US-ASCII string]            | Either a common type, see [Common Media Types](#common-media-types), or a US-ASCII encoded Media Type: RFC 6838.                                                |
| size                | uint32                               | Size of data in bytes, 0 or greater                                                                                                                             |
| attachment headers  | uint8 + [list of attachment headers] | See [attachment](#attachment) header definition. Prefixed by uint8 count of attachments of which there may be 0.                                                |
| data                | byte array                           | The message body of type defined in type field and size in the size field                                                                                       |
| [attachments data]  | byte array(s)                        | Sequential sequence of octet boundaries of which are defined by attachment headers size(s), if any.                                                             |


### Notes on Message Definition

* Square brackets "[ ]" indicate fields or part thereof may not exist on a message. Where the brackets surround the name, e.g. _pid_, the whole field may not be present (which in the case of pid is only valid if the message is the first in a thread). Where they surround part of the type, that part may not be present, e.g. list of attachment headers will not be present if uint8 prefix is 0.
* _topic_ MUST be present only on the first message in a thread, i.e. when _pid_ does not exist. When _pid_ exists the entire _topic_ field MUST NOT be included. This makes _topic_ immutable because it cannot be changed by subsequent replies. (Presentations of message threads MAY use a local mutable field for display purposes).
* It is not possible to accept a message _from_ an address that wasn't a participant in the message referenced by _pid_ following the [Protocol Steps](#protocol-steps).


### Notes on Adding Recipients

Adding recipients is achieved by sending a whole new distinct message that is an exact duplicate of the message to which recipients are being added except:
    * The _has add to_ flag bit is set
    * _pid_ references the message which recipients are being added to.
    * _add to from_ exists and is the address of the participant in the previous message adding the additional recipients.
    * _add to_ exists and is addresses of the new recipients being added.
    * _time_ is the POSIX epoch time of this new message with added recipients was ready for sending.


### Notes on Time

Only one time field is present on a message and this time is stamped by the sending host when it acquired the message to be sent. (Implementations MAY associate additional timestamps with messages, such as the time message was delivered).

fmsg includes some time checking and controls, rejecting messages too far in future or past compared to current time of the receiver, and, checking replies cannot claim to be sent before their parent (See [Reject or Accept Response](#reject-or-accept-response)). Of course this all relies on accuracy of clocks being used, so some leniency is granted determined by the receiving host. Bearing in mind a host may not be reachable for some time so greater leniancy SHOULD be given to messages from the past. Since the time field is stamped by the sending host – one need only concern themselves that their clock is accurate.


### Flags

| bit index | name         | description                                                                                                                                                                                                                 |
|----------:|--------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0         | has pid      | Set if this message is in reply to another and pid field is present.                                                                                                                                                        |
| 1         | has add to   | Set if "add to" field is included i.e. this message is copy of an existing message with recipients added                                                       |
| 2         | common type  | Indicates the type field is just a uint8 value and Media Type can be looked up per [Common Media Types](#common-media-types)                                                                                                |
| 3         | important    | Sender indicates this message is IMPORTANT!                                                                                                                                                                                 |
| 4         | no reply     | Sender indicates any reply will be discarded.                                                                                                                                                                               |
| 5         | deflate      | Message data is compressed using the zlib structure (defined in RFC 1950), with the deflate compression algorithm (defined in RFC 1951).                                                                                    |
| 6         | TBD          | Unused, reserved for future use                                                                        |
| 7         | TBD          | Unused, reserved for future use    |


#### Common Media Types

If the common type flag bit is set, the type field consists of one uint8 value which maps to a complete Media Type string, including any parameters, exactly as listed in the table below. If the common type bit is not set, the first uint8 is the length of the subsequent US-ASCII encoded complete Media Type string, including any parameters, per RFC 6838. If the common type flag bit is set and and the value has no mapping in the table below — the message is invalid and should be rejected with REJECT code 1 (invalid).

For reference the current IANA list of Media Types is located [here](https://www.iana.org/assignments/media-types/media-types.xhtml).

<details>
  <summary>Numerical identifier to common Media Types mapping.</summary>

| number | Media Type                                                                |
|--------|---------------------------------------------------------------------------|
| 1      | application/epub+zip                                                      |
| 2      | application/gzip                                                          |
| 3      | application/json                                                          |
| 4      | application/msword                                                        |
| 5      | application/octet-stream                                                  |
| 6      | application/pdf                                                           |
| 7      | application/rtf                                                           |
| 8      | application/vnd.amazon.ebook                                              |
| 9      | application/vnd.ms-excel                                                  |
| 10     | application/vnd.ms-powerpoint                                             |
| 11     | application/vnd.oasis.opendocument.presentation                           |
| 12     | application/vnd.oasis.opendocument.spreadsheet                            |
| 13     | application/vnd.oasis.opendocument.text                                   |
| 14     | application/vnd.openxmlformats-officedocument.presentationml.presentation |
| 15     | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet         |
| 16     | application/vnd.openxmlformats-officedocument.wordprocessingml.document   |
| 17     | application/x-tar                                                         |
| 18     | application/xhtml+xml                                                     |
| 19     | application/xml                                                           |
| 20     | application/zip                                                           |
| 21     | audio/aac                                                                 |
| 22     | audio/midi                                                                |
| 23     | audio/mpeg                                                                |
| 24     | audio/ogg                                                                 |
| 25     | audio/opus                                                                |
| 26     | audio/vnd.wave                                                            |
| 27     | audio/webm                                                                |
| 28     | font/otf                                                                  |
| 29     | font/ttf                                                                  |
| 30     | font/woff                                                                 |
| 31     | font/woff2                                                                |
| 32     | image/apng                                                                |
| 33     | image/avif                                                                |
| 34     | image/bmp                                                                 |
| 35     | image/gif                                                                 |
| 36     | image/heic                                                                |
| 37     | image/jpeg                                                                |
| 38     | image/png                                                                 |
| 39     | image/svg+xml                                                             |
| 40     | image/tiff                                                                |
| 41     | image/webp                                                                |
| 42     | model/3mf                                                                 |
| 43     | model/gltf-binary                                                         |
| 44     | model/obj                                                                 |
| 45     | model/step                                                                |
| 46     | model/stl                                                                 |
| 47     | model/vnd.usdz+zip                                                        |
| 48     | text/calendar                                                             |
| 49     | text/css                                                                  |
| 50     | text/csv                                                                  |
| 51     | text/html                                                                 |
| 52     | text/javascript                                                           |
| 53     | text/markdown                                                             |
| 54     | text/plain;charset=US-ASCII                                               |
| 55     | text/plain;charset=UTF-16                                                 |
| 56     | text/plain;charset=UTF-8                                                  |
| 57     | text/vcard                                                                |
| 58     | video/H264                                                                |
| 59     | video/H265                                                                |
| 60     | video/H266                                                                |
| 61     | video/ogg                                                                 |
| 62     | video/VP8                                                                 |
| 63     | video/VP9                                                                 |
| 64     | video/webm                                                                |

</details>


### Attachment

Each attachment header consists of four fields: flags, type, filename and size:

| name     | type                   | comment                                                                                            |
|----------|------------------------|----------------------------------------------------------------------------------------------------|
| flags    | uint8                  | Bit field. See attachment flags below.                                                             |
| type     | uint8 + [ASCII string] | Either a common type, see [Common Media Types](#common-media-types), or a US-ASCII encoded Media Type: RFC 6838. Encoding determined by this attachment's own _common type_ flag. |
| filename | string                 | UTF-8 prefixed by uint8 size.                                                                      |
| size     | uint32                 | Size of attachment data. uint32 is the max theoretical size, but hosts can/should accept less.     |

#### Attachment Flags

| bit index | name        | description                                                                                                                        |
|----------:|-------------|------------------------------------------------------------------------------------------------------------------------------------|
| 0         | common type | Indicates this attachment's type field is just a uint8 value and Media Type can be looked up per [Common Media Types](#common-media-types). |
| 1         | deflate     | Attachment data is compressed using the zlib structure (defined in RFC 1950), with the deflate compression algorithm (defined in RFC 1951). |
| 2 — 7     | TBD         | Unused, reserved for future use                                                                                                    |

filename MUST be:

* UTF-8
* any letter in any language, or any numeric characters (`\p{L}` and `\p{N}` Unicode Standard Annex #44 and #18)
* the hyphen "-", underscore "_", single space " " or dot "." characters non-consecutively and not at beginning or end
* unique amongst attachments, case-insensitive
* less than 256 bytes length

Attachment data

| name     | type       | comment                                                                                            |
|----------|------------|----------------------------------------------------------------------------------------------------|
| data     | byte array | Sequence of octets located after all attachment headers, boundaries of each attachment are defined by corresponding size in attachment header(s) |


### Address

![fmsg address](pics/address.png)

Domain part is the domain name RFC-1035 owning the address. Recipient part identifies the recipient known to hosts for the domain. A leading "@" character is prepended to distinguish from email addresses. The secondary "@" separates recipient and domain name as per norm.

Recipient part is a string of characters which MUST be:

* UTF-8
* any letter in any language, or any numeric characters (`\p{L}` and `\p{N}` Unicode Standard Annex #44 and #18)
* the hyphen "-", underscore "_" or dot "." characters non-consecutively and not at beginning or end
* unique on host using case-insensitive comparison
* less than 256 bytes length when combined with domain name and @ characters 

A whole address is encoded UTF-8 prepended with size:

| name    | type           | comment                                       |
|---------|----------------|-----------------------------------------------|
| address | uint8 + string | UTF-8 encoded string prefixed with uint8 size |


### Challenge

| name        | type     | comment                                                                            |
|-------------|----------|------------------------------------------------------------------------------------|
| version     | uint8    | Challenge version, decrements from 255 corresponding to fmsg protocol version, 255 is CHALLENGE for fmsg protocol version 1, 254 would be CHALLENGE for fmsg protocol version 2 etc. |
| header hash | 32 bytes | SHA-256 digest of message header being sent/received up to and including attachment headers. |


### Challenge Response

A challenge response is the next 32 bytes received in reply to challenge request – the existence of which indicates the sender accepted the challenge. This SHA-256 hash MUST be kept to ensure the complete message (including attachments) once downloaded matches.

| name     | type          | comment                                                              |
|----------|---------------|----------------------------------------------------------------------|
| msg hash | 32 byte array | SHA-256 hash of entire message.                                      | 


### Reject or Accept Response

A code less than 100 indicates rejection or acceptance for all recipients and will be the only value. Other codes are per recipient in the same order as the as in the _to_ then _add to_ fields of the message after excluding recipients for other domains.

| name  | type       | comment                             |
|-------|------------|-------------------------------------|
| codes | byte array | a single or sequence of uint8 codes |


| code | name                  | description                                                             |
|-----:|-----------------------|-------------------------------------------------------------------------|
| 1    | invalid               | the message header fails verification checks, i.e. not in spec          |
| 2    | unsupported version   | the version is not supported by the receiving host                      |
| 3    | undisclosed           | no reason is given                                                      |
| 4    | too big               | total size exceeds host's maximum permitted size of messages            |
| 5    | insufficient resources | such as disk space to store the message                                |
| 6    | parent not found      | parent referenced by pid SHA-256 not found and is required              |
| 7    | too old               | timestamp is too far in the past for this host to accept                |
| 8    | future time           | timestamp is too far in the future for this host to accept              |
| 9    | time travel           | timestamp is before parent timestamp                                    |
| 10   | duplicate             | message has already been received for all recipients on this host       |
| 11   | accept add to         | additional recipients received, discontinue                             |
| 12   | continue              | header recieved, continue message transmission                          |
|      |                       |                                                                         |
| 100  | user unknown          | the recipient message is addressed to is unknown by this host           |
| 101  | user full             | insufficent resources for specific recipient                            |
| 102  | user not accepting    | user is known but not accepting new messages at this time               |
| 103  | user duplicate        | message has already been received for this recipient                    |
| 105  | user undisclosed      | no reason is given for not accepting messages to addressed recipient    |
|      |                       |                                                                         |
| 200  | accept                | message received for recipient                                          |



## Protocol

A message is sent from the sender's host to each unique recipient host (i.e. each domain only once even if multiple recipients at the same domain). Sending a message either succeeds or fails per recipient of the host for the domain being sent to. During the sending from one host to another several steps are performed depicted in the below diagram. Two connection-orientated, reliable, in-order and duplex transports are required to perform the full flow. Transmission Control Protocol (TCP) is an obvious choice, on top of which Transport Layer Security (TLS) may meet your encryption needs.

<p align="center">
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="pics/flow-dark.png">
  <source media="(prefers-color-scheme: light)" srcset="pics/flow-light.png">
  <img alt="fmsg protocol flow diagram" src="pics/flow-dark.png">
</picture>
</p>

*Protocol flow diagram*

_NB_ Host reaching the TERMINATE step MUST tear down any connection(s) with the remote host, because they are not following the protocol!

### Protocol Steps

The below steps are described following the example `@A@example.com` is sending a message to `@B@example.edu` for clarity. There could be more recipients on the same or different domains in a message being sent, the steps include how to handle those recipients in-situ; otherwise each recipient host performs the same steps without regards to other recipient hosts. If at any step TERMINATE is reached the message exchange is aborted. If at any step completing the message exchange is reached no further steps are performed.

_NOTE_ Responding with the applicable REJECT code helps sending hosts and their clients to know when re-sending may be worthwhile trying (e.g. "user full"), re-sending would not be worthwhile (e.g. "duplicate") or there is an issue with either side that warrants further investigation (e.g. "invalid" suggests something wrong with the implementation, "future time" is likely due to one or both hosts' clocks being incorrect). Especially helpful to a sender is REJECT code 6 (parent not found) — the Sending Host can then indicate to it's clients the Receiving Host has lost the previous message. A sender could then add the recipient as additional recipients to continue the thread from that message (because _add to_ recipients do not require the previous message to exist); or re-send previous messages in the thread.

The following varibles corresponding to host defined configuration are used in the below steps.

| Variable           | Example Value | Description                        |
|--------------------|--------------|-------------------------------------|
| MAX_SIZE           | 1048576      | Maximum allowed message data and attachment data size in bytes       |
| MAX_MESSAGE_AGE    | 700000       | Maximum age since message _time_ field for message to be accepted (seconds)      |
| MAX_TIME_SKEW      | 20           | Maximum tolerance for message _time_ field to be ahead of current time (seconds)   |


#### 1. Connection and Header Exchange

1. The Sending Host (Host A) initiates a connection (Connection 1) to the first Receiving Host (Host B) authorised IP address determined by [Domain Resolution](#domain-resolution).
    1. If the first IP address is unresponsive within an implementation-defined timeout, and multiple IP addresses were returned during domain resolution, Host A SHOULD attempt to connect to each address in the order provided, one at a time, until a responsive host is reached. Preserving the order of IP addresses allows the Sending Host to benefit from any load balancing, latency optimisation, or geographic routing applied during domain resolution.
    2. If no responsive Receiving Host is found, Host A SHOULD retry delivery after an implementation-defined delay. Implementations SHOULD apply a back-off strategy (e.g. exponential back-off) to subsequent retry attempts.
    3. Host A SHOULD continue retrying delivery until a maximum delivery window has elapsed, after which the message MAY be considered undeliverable. Implementations MAY provide a mechanism for clients or operators to manually trigger or influence retry behaviour.
2. Once connection is established Host A starts transmitting the message to Host B.
3. Host B downloads the first byte 
    1. If the value is less than 128 and a supported fmsg version, continue.
    2. If the value is greater than 128 and 256 minus the value is a supported fmsg version — this is an incoming CHALLENGE and should be processed per [Handling a Challenge](#handling-a-challenge).
    3. Otherwise Host B sends REJECT code 2 (unsupported version) on Connection 1 then closes the connection completing the message exchange.
4. Host B downloads the remaining message header and parses the fields. If parsing fails because types cannot be decoded, Receiving Host MUST TERMINATE the message exchange.
    1. The following conditions MUST be met otherwise Host B MUST respond REJECT code 1 (invalid) and close the connection completing the message exchange:
        1. There must be at least one address in _to_.
        2. All recipients in _to_ are distinct using case-insensitive comparison.
        3. All recipients in _add to_, if any, are distinct using case-insensitive comparison.
        4. There must be at least one recipient in _to_ or _add to_ for Host B (example.edu domain).
        5. _type_ number when _common type_ [Flag](#flags) is set, exists in [Common Media Type](#common-media-types) mapping.
        6. Each attachment _type_ number, when that attachment's _common type_ flag is set, exists in [Common Media Type](#common-media-types) mapping.
    2. Receiving Host B MUST perform a DNS lookup on the _fmsg subdomain of the from address in the message header (_fmsg.example.com) to verify that the IP address of the incoming connection is in those authorised by the sending domain. If the incoming IP address is not in the authorised set, Host B MUST TERMINATE the message exchange.
    3. If _size_ plus all _attachment size_ is greater than MAX_SIZE, Host B MUST respond REJECT code 4 (too big) then close the connection completing the message exchange.
    4. Current POSIX epoch time minus message _time_ gives DELTA — representing seconds since message sent (to senders host for sending on).
        1. If DELTA is greater than MAX_MESSAGE_AGE, Host B MUST respond REJECT code 7 (too old) then close the connection completing the message exchange.
        2. If DELTA is negative and absolute DELTA is greater than MAX_TIME_SKEW, Host B MUST respond REJECT code 8 (future time) then close the connection completing the message exchange.
    5. The _pid_ field requirements depends on the existence and contents of _add to_ field:
        1. If neither _pid_ nor _add to_ exist, the message is the first in a thread and the message exchange continues normally.
        2. If _pid_ exists and _add to_ does not.
            1. The message _pid_ refers to MUST be verified to be stored already on Host B per [Verifying Original Message Stored](#verifying-original-message-stored); otherwise Host B MUST respond with REJECT code 6 (parent not found)
            2. The stored message for _pid_'s _time_ minus MAX_TIME_SKEW MUST be before _time_ on the incoming message header; otherwise Host B MUST respond with REJECT code 9 (time travel)
            
            _NOTE_ Verifying Message Stored checks the host has the parent message, not that every recipient still has it in their message store. Implementations SHOULD consider restoring the parent message to a recipient's message store if that _recipient_ no longer has the message, so that the incoming reply has proper thread context for all recipients.
        3. Else _add to_ exists;
            1. _pid_ field MUST exist too, otherwise Host B MUST respond REJECT code 1 (invalid) and close the connection completing the message exchange.
            2. The original message refered to by _pid_ is found to be stored per [Verifying Original Message Stored](#verifying-original-message-stored);
            2. If original message refered to by _pid_ is found to be stored;
                1. The stored message for _pid_'s _time_ minus MAX_TIME_SKEW MUST be before _time_ on the incoming message header; otherwise Host B MUST respond with REJECT code 9 (time travel).
                2. At this stage Host B has been informed additional recipients have been added to a message it already has accepted. Host B MUST record these new _add to_ recipients such that the message hash can be faithfully computed with and without this batch of additional recipients as per [Verifying Original Message Stored](#verifying-original-message-stored) and [Verifying Message With Added Recipients Stored](#verifying-message-with-added-recipients-stored). This is because either the original message or message with the just added recipients could be referred to by subsequent messages. Host B MUST then respond with ACCEPT code 11 (additional recipients received) then MUST gracefully close the connection. 
            
                   _NOTE I_ After responding with REJECT code 11 (additional recipients received), _gracefull_ closure of the connection is important so Host A can read and record Host B's response.
                   _NOTE II_ When responding with ACCEPT code 11 (additional recipients received), implementations MAY consider restoring the referenced message to a recipient's message store if that specific recipient no longer has the message (since we have already verified Host B _has_ the message and implementations might allow recipients to delete their copies of messages).                   
            3. Otherwise the original message has not been found to be stored (possible because Host B is being sent the message for the first time by way of _add to_, or the message referenced by _pid_ is no longer held);
                1. Message download continues in full.


#### 2. The Automatic Challenge

A recipient fmsg host is responsible for challenging a sender for detail of the message being sent, while it is being sent, before deciding whether to continue downloading the message. A sender MUST be listening and respond to such a challenge on the same IP address as the outgoing message.

For example, a host MAY implement different challenge modes of operation such as:

1. NEVER, recipient host never sends a CHALLENGE.
2. ALWAYS, recipient host will always send a CHALLENGE during the message exchange.
3. HAS_NOT_PARTICIPATED, recipient host will send a CHALLENGE when _pid_ does not exist or none of the linked messages in the thread following each message's _pid_ are from a recipient on Host B's domain.
4. DIFFERENT_DOMAIN, recipient host will always send a CHALLENGE during the message exchange if the message _from_ is for a different domain.

To issue a CHALLENGE a Receiving Host follows these steps:

1. Before continuing to download the remaining data on Connection 1, Host B MUST initiate a separate new connection (Connection 2) back to Host A using the same incoming IP address of Connection 1.
2. Host B sends a CHALLENGE to Host A, supplying the message header hash of the message header received on Connection 1.
3. Host A MUST verify the authenticity of the challenge by checking the header hash matches the message currently being sent to Host B. 
    — If not matched then Host A MUST TERMINATE the message exchange.
5. Host A transmits a CHALLENGE RESP on Connection 2 consisting of the message hash.
6. Host B downloads the CHALLENGE-RESP which MUST be kept to later verify the message once fully downloaded.
7. Host A and Host B close Connection 2 and continue the message exchange on Connection 1. 

##### Notes on Challenge Mode

The automatic challenge is an important component of fmsg's message integrity and sender verification guarantees. So why the optionality, why not always automatically challenge if hosts need to implement handling it anyway? The intention is to allow trading protocol guarantees for efficiency which may be desirable depending on the use case.

The NEVER challenge mode discussed above could be useful on trusted private networks supporting a high volume of messages.

A HAS_NOT_PARTICIPATED challenge mode could be a useful middle ground where the first message in a thread has the extra checking and controls of an automatic challenge. The automatic challenge can help mitigate spam by performing strong sender verification and requiring the sender to listen, calculate the message digests and respond accordingly. Subsequent messages in a thread providing a valid pid where one of the messages in the thread is _from_ Host B's domain provides proof of prior participation in the thread, which combined with checking the IP address is authorised for the domain already, gives a level of sender verification. Additionally, the receiving fmsg host could already have a level of message integrity guarantees, for example if the byte stream being read is over TLS. The combination of these guarantees might be sufficient for a recipient host to opt-out of challenging.

Challenging particularly useful for messages with _add to_ recipients for Host B's domain. In that case, Host B may not have the parent message referenced by _pid_ and therefore cannot verify it is stored — bypassing a check that normally provides thread integrity and an anti-spam signal. Without a challenge, such messages are effectively indistinguishable from unsolicited messages arriving for the first time.

Ultimately, whether to challenge or not is at the discretion of the reciving host.


#### 3. Integrity Verification, Per-Recipient Response and Disposition

1. Host B performs some checks before continuing to download the remaining message being transmitted on Connection 1.
    1. If the CHALLENGE, CHALLENGE-RESP exchange was completed, the message hash received in the CHALLENGE-RESP SHOULD be used to check if the message is already stored for **all** recipients on Host B per [Verifying Original Message Stored](#verifying-original-message-stored).
        1. If the message is found to be already stored for all recipients on Host B, Host B MUST respond REJECT code 10 (duplicate) then close the connection completing the message exchange.
2. Host B continues downloading the remaining message i.e. message _data_ and _attachments data_.
3. Upon downloading the exact size of the message, if the CHALLENGE, CHALLENGE-RESP exchange was completed, the message hash received in the CHALLENGE-RESP MUST exactly match the computed message hash; otherwise Host B MUST TERMINATE the message exchange.
4. Host B transmits an "ACCEPT or REJECT RESPONSE" code to Host A for each individual recipient belonging to Host B.
    1. Host B iterates through each address for its domain (example.edu) in the order they appear in _to_ then in _add to_ (if any). Note for any REJECT code specific to a user, 105 (user undisclosed) MAY be used instead — so Host B does not have to disclose the reason message was not accepted for that address. For each recipient:
        1. Host B looks up implementation specific data for the recipient address such as quotas and whether the address is accepting new messages.
        2. If the message has already been received for this recipient, Host B MUST respond either REJECT code 103 (user duplicate) OR REJECT code 105 (user undisclosed).
        3. If the address is unknown to Host B, Host B MUST respond either REJECT code 100 (user unknown) OR REJECT code 105 (user undisclosed). 
        4. Else if accepting the message would exceed user quotas such as size or count limits, Host B MUST respond either REJECT code 101 (user full) OR REJECT code 105 (user undisclosed).
        5. Else if the address is not accepting new messages, Host B MUST respond either REJECT code 102 (user not accepting) OR REJECT code 105 (user undisclosed).
        6. Otherwise, Host B MUST respond ACCEPT code 200 (accepted) for the recipient address 
    2. Host A MUST record the "ACCEPT or REJECT RESPONSE" code received per recipient for Host B's domain.
5. Host A and Host B close Connection 1, completing the message exchange.


#### 4. Sending a Message

A Sending Host (Host A) delivers a message to each unique recipient domain exactly once, regardless of how many recipients share that domain. This section describes the steps Host A performs for each recipient domain. If multiple recipient domains exist, Host A performs these steps independently for each domain without regard to the others.

1. Host A determines the set of recipient domains by collecting the unique domain parts from all addresses in _to_ and _add to_ (if any), excluding Host A's own domain.
2. For each recipient domain, Host A resolves the authorised IP addresses via [Domain Resolution](#domain-resolution).
    1. Host A initiates a connection (Connection 1) to the first authorised IP address for the Receiving Host (Host B).
    2. If the first IP address is unresponsive within an implementation-defined timeout, and multiple IP addresses were returned during domain resolution, Host A SHOULD attempt to connect to each address in the order provided, one at a time, until a responsive host is reached.
    3. If no responsive Receiving Host is found, Host A SHOULD retry delivery after an implementation-defined delay. Implementations SHOULD apply a back-off strategy (e.g. exponential back-off) to subsequent retry attempts.
    4. Host A SHOULD continue retrying delivery until a maximum delivery window has elapsed, after which the message MAY be considered undeliverable for the affected recipients. Implementations MAY provide a mechanism for clients or operators to manually trigger or influence retry behaviour.
3. Before transmitting, Host A MUST register the _message header hash_ of the outgoing message so that incoming [CHALLENGE](#challenge) requests on Connection 2 can be matched to this message per [Handling a Challenge](#handling-a-challenge).
4. Host A transmits the complete message to Host B on Connection 1, encoding all fields in the order defined in [Message](#message):
    1. _version_, _flags_, [_pid_], _from_, _to_, [_add to_], _time_, [_topic_], _type_, _size_, _attachment headers_, _data_, [_attachments data_].
5. Host A waits for Host B's response. During this time Host B may open Connection 2 to issue a CHALLENGE which Host A MUST handle per [Handling a Challenge](#handling-a-challenge).
6. Host A reads the "REJECT or ACCEPT RESPONSE" from Host B on Connection 1.
    1. If the first byte is a code less than 100, this is a rejection for all recipients on Host B's domain. Host A records this code against every recipient address on Host B's domain.
        — If the code indicates a transient condition (e.g. 3 undisclosed, 5 insufficient resources), Host A SHOULD retry delivery after an implementation-defined delay.
        — If the code indicates a permanent condition (e.g. 1 invalid, 2 unsupported version, 4 too big, 10 duplicate), Host A SHOULD NOT retry delivery.
    2. Otherwise, the response contains one code per recipient on Host B's domain in the order they appear in _to_ then _add to_, excluding recipients for other domains. Host A reads the remaining codes and records each against the corresponding recipient address.
        — For each recipient with ACCEPT code 200, delivery is complete for that address.
        — For each recipient with a per-user REJECT code (100 user unknown, 101 user full, 102 user not accepting, 103 user duplicate, 105 user undisclosed), Host A records the code. Whether to retry is at the discretion of the implementation; codes 101 (user full) MAY warrant a retry after a delay whereas 100 (user unknown) or 103 (user duplicate) typically would not.
7. Host A removes the _message header hash_ from its outgoing record.
8. Host A and Host B close Connection 1, completing the message exchange for this recipient domain.


### Handling a Challenge

A Sending Host MUST be listening for incoming connections on the same IP address it uses to send outgoing messages. While a message is being transmitted on Connection 1, the Receiving Host may open Connection 2 back to the Sending Host to issue a [CHALLENGE](#challenge). The Sending Host handles this as follows:

1. Host B downloads the first byte 
    1. If the value is less than 128 and a supported fmsg version — this is an incoming message and should be processed per [Connection and Header Exchange](#1-Connection-and-Header-Exchange).
    2. If the value is greater than 128 and 256 minus the value is a supported fmsg version, this is a CHALLENGE we support, continue.
    3. Otherwise Host B sends REJECT code 2 (unsupported version) on Connection 1 then closes the connection completing the message exchange.
2. Host A downloads the next 32 bytes — the _header hash_ supplied by Host B.
3. Host A MUST verify the authenticity of the challenge by checking the _header hash_ exactly matches the _message header hash_ of a message Host A is currently transmitting to Host B.
    — If no currently outgoing message matches the supplied _header hash_, Host A MUST TERMINATE the connection. The challenge does not correspond to any message Host A is sending and may be spurious or malicious.
4. Host A computes the _message hash_ (SHA-256 digest of the entire message) and transmits a [CHALLENGE RESPONSE](#challenge-response) on Connection 2 consisting of the _message hash_.
5. Host A and Host B close Connection 2. The message exchange continues on Connection 1.

_NOTE_ A Sending Host MUST maintain a record of messages currently being transmitted, keyed by their _message header hash_, so that incoming challenges can be matched to the correct outgoing message. This record SHOULD be created before transmission begins and removed once the message exchange completes or is aborted. Implementors should be mindful of concurrent access to this header hash store, as they are likely sending and receiving concurrently.


### Verifying Original Message Stored

A host verifies that an original message (without _add to_ recipients) is stored given a SHA-256 digest if and only if:
* The provided digest exactly matches the SHA-256 digest computed over the message bytes as received that was previously accepted by the host, i.e. for which the host responded with "REJECT or ACCEPT CODE" 200 (accept); and
* The corresponding message currently exists on the host and can be retrieved.


### Verifying Message With Added Recipients Stored

A host verifies that a message with _add to_ recipients is stored given a SHA-256 digest if and only if:
* The provided digest exactly matches the SHA-256 digest computed over message bytes with a specific batch of _add to_ recipients included that the host previously accepted, and, the add to flag set, i.e. a message for which the host previously responded with "REJECT or ACCEPT CODE" 11 (additional recipients received), or, "REJECT or ACCEPT CODE" 200 (accept); and
* The corresponding message currently exists on the host and can be retrieved.

_NOTE_ Multiple messages with _add to_ may arrive for the same _pid_ over time, each carrying a different batch of additional recipients. The host MUST record the _add to_ recipients from each individually accepted message such that the exact message bytes can be reconstructed for hash verification. Computing the hash requires reconstructing the message witsh the specific _add to_ batch that was present in the accepted message, not all _add to_ recipients accumulated across batches nor any other combination of _add to_ recipients than those previously accepted.


## Domain Resolution

Hosts MUST obtain and verify authorised IP addresses by resolving the subdomain `_fmsg` of the domain name in an fmsg address and evaluating the resulting A and AAAA records (including those obtained via CNAME aliasing). For example if `@alice@example.com` is sending a message to `@bob@example.edu`, Alice's authorised fmsg host IP addresses are obtained by resolving `_fmsg.example.com`, and Bob's from `_fmsg.example.edu`.

Sending and receiving hosts SHOULD perform DNSSEC validation for _fmsg lookups when supported. If DNSSEC validation fails, the connection MUST be terminated.

Before opening the second connection to send CHALLENGE, the Receiving Host MUST independently resolve the senders authorised IP set from the `_fmsg` subdomain and verify the originating IP address of the incoming connection is in that set. If verification fails the connection MUST be terminated without challenging. This ensures the fmsg host sending a message is listed by the senders domain and prevents orchestrating a denial-of-service style attack by falsifying an address to trigger many fmsg hosts challenging an unsuspecting host.

### Notes on Domain Resolution

Various alternatives were considered before arriving at using the `_fmsg` subdomain method. For instance an MX record combined with a WKS record on the domain would align with original intent of RFC 974 allowing message exchange services to be located for a domain along with WKS specifying the protocol. However the intent of MX records has been superceded and is now assumed to be SMTP and WKS is obsolote. Using a TXT record as SPF does was considered too, but that leads to a growing problem of proliferation of TXT records. So the `_fmsg` subdomain method was chosen as the way for the receiver to verify that the originating host of a message is explicitly authorised by the owning domain. Also, because the incoming IP address and sender's domain (the _from_ address) will be known to the receiving host, only one domain lookup is needed.

### Practical Concerns

Verifying the sender's IP address requires the Receiving Host to observe the true originating IP address of the connection. This implies that fmsg hosts must be directly routable, or that any intervening infrastructure preserves and conveys the originating IP address. Care must therefore be taken when fmsg hosts operate behind network address translators (NAT), layer-4 load balancers, or proxying infrastructure.


## Security Concerns

This section identifies threats relevant to fmsg deployments and recommends safeguards for implementors and operators. Many of these overlap — a single malicious actor may exploit multiple vectors simultaneously — so a layered approach is strongly encouraged.

### Connection Flooding

An attacker can open many TCP connections to a host without sending valid message data, exhausting file descriptors, memory or connection-table capacity.

**Safeguards:**
* Hosts SHOULD enforce a maximum number of concurrent connections, in total and per source IP address.
* Hosts SHOULD apply short timeouts for idle or slow connections. If no valid version byte is received within a brief period the connection SHOULD be closed.
* Operating system level controls such as SYN cookies and connection rate limiting SHOULD be enabled.

### Oversized or Slow Data Attacks

A sender may begin transmitting a message header declaring a small size then either send data indefinitely, or send data extremely slowly ("slowloris" style), tying up resources.

**Safeguards:**
* Hosts MUST enforce the declared _size_ plus _attachment sizes_ and MUST NOT read beyond the expected total. MAX_SIZE provides an upper bound that should be checked before downloading any data.
* Hosts SHOULD enforce minimum data-rate thresholds. A connection where the transfer rate drops below a configurable floor for a sustained period SHOULD be terminated.

### Challenge Reflection and Amplification

A malicious host could forge the _from_ address in a message to contain a victim's domain, causing the Receiving Host to open Connection 2 back to the victim as part of the automatic challenge — effectively using the Receiving Host as a reflector.

**Safeguards:**
* The specification already requires the Receiving Host to verify the originating IP address of Connection 1 against the DNS records for the _from_ domain **before** issuing a challenge (see [Domain Resolution](#domain-resolution)). This is the primary defence and MUST NOT be skipped.
* Hosts SHOULD rate limit outgoing challenge connections per destination IP address to limit amplification even if DNS verification is somehow bypassed.

### DNS Spoofing and Cache Poisoning

If an attacker can poison DNS responses for `_fmsg.<domain>`, they can redirect messages to a host they control or cause a legitimate host to accept messages from an unauthorised IP.

**Safeguards:**
* Hosts SHOULD perform DNSSEC validation for all `_fmsg` lookups. If DNSSEC validation fails the connection MUST be terminated as specified in [Domain Resolution](#domain-resolution).
* Hosts SHOULD use trusted resolvers and minimise DNS cache TTLs for `_fmsg` records to reduce the window of exposure to poisoned entries.

### Message Replay

An attacker who has captured a valid message off the wire could attempt to re-deliver it to the same or different hosts.

**Safeguards:**
* The automatic challenge is the primary defence against replay: a replaying attacker cannot produce a valid CHALLENGE RESPONSE without possessing the original message in full and being resident at the authorised sender IP.
* Even without a challenge, hosts SHOULD maintain a record of recently accepted message hashes and reject duplicates (REJECT code 10 for all recipients, or per-recipient code 103).
* The time validity window (MAX_MESSAGE_AGE, MAX_TIME_SKEW) limits how long a captured message remains deliverable.

### Sender Enumeration

An attacker could craft messages addressed to many candidate recipient names to discover which addresses exist on a host, using REJECT code 100 (user unknown) vs 200 (accept) as an oracle.

**Safeguards:**
* Hosts MAY respond with REJECT code 105 (user undisclosed) for all per-user rejections, as the specification already permits. This prevents the attacker from distinguishing between unknown, full, and not-accepting addresses.
* Hosts SHOULD rate limit incoming messages from any single source IP or domain.

### Resource Exhaustion via Storage

An attacker could send a high volume of valid messages or very large messages to fill storage on the receiving host, preventing legitimate messages from being accepted.

**Safeguards:**
* Operators SHOULD configure MAX_SIZE to a value appropriate for their deployment.
* Implementations SHOULD support per-user quotas on message count and total storage. When quotas are exceeded the host responds REJECT code 101 (user full).
* Implementations SHOULD support global storage thresholds. When critically low the host responds REJECT code 5 (insufficient resources) to all incoming messages.

### Monitoring and Logging

Hosts SHOULD record the following for each message exchange to support detection and investigation of abuse:

* Originating IP address
* Domain from the _from_ field
* REJECT or ACCEPT response codes sent
* Whether a CHALLENGE was issued and whether it succeeded
* Timestamp

Operators SHOULD review these logs for anomalous patterns such as high rejection rates from a single domain or IP, repeated invalid messages, or spikes in connection volume. Automated alerting on such patterns is recommended.
