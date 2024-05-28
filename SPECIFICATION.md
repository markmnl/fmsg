# fmsg Specification

- [Terminology](#terminology)
    - [Terms](#terms)
    - [Message Types](#message-types)
    - [Data Types](#data-types)
- [Definition](#definition)
    - [Message](#message)
        - [Common MIME Types](#common-mime-types)
    - [Flags](#flags)
    - [Attachment](#attachment)
    - [Address](#address)
    - [Challenge](#challenge)
    - [Challenge Response](#challenge-response)
    - [Reject or Accept Response](#reject-or-accept-response)
- [Protocol](#protocol)
    - [Flow diagram](#protocol)
- [Host Resolution](#host-resolution)
    - [Host Resolution Considerations](#host-resolution)
- [Security Considerations](#security-considerations)



## Terminology

_"fmsg"_ is the name given to the protocol and message definitions described in this document. The capitalisation of fmsg is obstinately lowercase, even at the start of a sentence. The name "fmsg" is neither an abbreviation nor acronym, although is thought of as "f-message". Where did the name come from? The "f" owes inspiration from functions in programming languages such as C's `printf()` where the "f" stands for "formatted", "fast" and "falcon" were also in the author’s mind at the time. The "msg" part is a common shortening of "message" conveying the meaning while keeping the whole name succinct; "fmsg".


### Terms

_"DNS"_ is for the Domain Name System

_"host"_ is an fmsg implementation which can send and receive fmsg messages to and from other hosts.

_"message"_ refers to an entire message described in [Message Defintion](#message).

_"message header"_ refers to the fields up to and including the size field in a _message_.

_"UTF-8"_ is for the unicode standard: Unicode Transformation Format – 8-bit.


### Message Types

fmsg defines four message types: MESSAGE, CHALLENGE, CHALLENGE RESPONSE and "REJECT or ACCEPT RESPONSE", often written here all capitals. These structures are aggregates of [Data Types](#data-types) and are described in the [Definition](#definition) section.


### Data Types

Throughout this document the following data types are used. All types are encoded little-endian.

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
| string     | sequence of characters the encoding (e.g. ASCII, UTF-8...) and length of which is defined alongside in this document |


### Notes on Data Types

* Lengths of strings are always explicitly defined and null terminating characters are not used. This is a design decision becuase it prevents a class of buffer over-run bugs (search "Heartbleed bug"), simplifies message size calculation, and, inherently limits the length of strings while adding no extra data than a null terminating character would since all strings lengths here are defined by one uint8.


## Definition

### Message

In programmer friendly JSON a message could look like (once decoded from the binary format defined below):

```JSON
{
    "version": 1,
    "origin": "host1.fmsg.org",
    "flags": 0
    "pid": null,
    "from": "@markmnl@fmsg.org",
    "to": [
        "@世界@example.com",
        "@chris@fmsg.org"
    ],
    "time": 1654503265.679954,
    "topic": "Hello fmsg!",
    "type": 1,
    "size": 45,
    "msg": "The quick brown fox jumps over the lazy dog.",
    "attachments": [
        {
            "size": 1024,
            "filename": "doc.pdf"
        }
    ]
}
```

On the wire messages are encoded thus:

| name                | type                                 | description                                                                                                                                                     |
|---------------------|--------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| version             | uint8                                | Version number message is in (currently only 1); or 255 if CHALLENGE - defined below.                                                                           |
| origin              | uint8 + ASCII string                 | Domain name or IP address of the actual host sending the message, prefixed by unit8 size.                                                                       |
| flags               | uint8                                | See [flags](#flags) for each bit's meaning.                                                                                                                     |
| [pid]               | byte array                           | SHA-256 hash of message this message is a reply to. Only present if flags has pid bit set.                                                                      |
| from                | fmsg address                         | See [address](#address) definition.                                                                                                                             |
| to                  | uint8 + list of fmsg address         | See [address](#address) definition. Prefixed by uint8 count, addresses must be distinct (case-insensitive) of which there must be at least 1.                   |
| time                | float64                              | POSIX epoch time message was received by host sending the message.                                                                                              |
| [topic]             | uint8 + UTF-8 string                 | UTF-8 free text title of the message thread, prefixed by unit8 size which may be 0. Only present on first message intiating a thread i.e. when there is no pid. |
| type                | uint8 + [ASCII string]               | Either a common type, see [Common MIME Types](#common-mime-types), or a US-ASCII encoded MIME type: RFC 6838, of msg.                                           |
| size                | uint32                               | Size of msg data in bytes must be at least 1                                                                                                                    |
| attachments headers | uint8 + [list of attachment headers] | See [attachment](#attachment) header definition. Prefixed by uint8 count of attachments of which there may be 0.                                                |
| data                | byte array                           | The message body of type defined in type field.                                                                                                                 |
| [attachments data]  | byte array(s)                        | Sequential sequence of octets boundries of which are defined by attachment headers size(s), if any.                                                             |


### Notes on Message Definition

* Square brackets "[ ]" indicate fields or part thereof may not exist on all messages. Where the brackets surround the name, e.g. pid, the whole field my not be present (which in the case of pid is only valid if the message is not a reply). Where they surround part of the type, that part may not be present, e.g. list attachment headers will not be present if unit8 prefix is 0.


### Notes on Time

Only one time field is present on a message and this time is stamped by the sending host when it acquired the message. Implementations could associate any additional data they want with messages, in the case of timestamps this could be time message sent on to remote host, but only the one time field is transmitted in a message which must be time received by sending host.

Some time checking and controls are in the protocol, rejecting messages too far in future or past compared to current time of the receiver, and, checking replies cannot claim to be sent before their parent (See [Reject or Accept Response](#reject-or-accept-response)). Of course this all relies on accuracy of clocks being used so some leniancy is granted determined by the receiving host. Futhermore a host may not be reachable for some time so greater leniancy should be given to messages from the past. Since the time field is stamped by the sending host - they need only concern themselves that their clock is accurate.


### Flags

| bit index | name         | description                                                                                                                                                                                                                 |
|----------:|--------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0         | has pid      | Set if this message is in reply to another and pid field is present.                                                                                                                                                        |
| 1         | common type  | Indicates the type field is just a uint8 value and MIME type can be looked up per [Common MIME Types](#common-mime-types)                                                                                                   |
| 2         | important    | Sender indicates this message is IMPORTANT!                                                                                                                                                                                 |
| 3         | no reply     | Sender indicates any reply will be discarded.                                                                                                                                                                               |
| 4         | no challenge | Sender asks challenge skipped, hosts should be cautious accepting this, especially on the wild Internet. May be useful on trusted networks to save network and compute resources verifying many machine generated messages. |
| 5         | deflate      | Message data is compressed using the zlib structure (defined in RFC 1950), with the deflate compression algorithm (defined in RFC 1951).                                                                                    |
| 6         | gzip         | Message data is compressed using the Lempel-Ziv coding (LZ77), with a 32-bit CRC.                                                                                                                                          |
| 7         | under duress | Sender indicates this message was written under duress.    


#### Common MIME Types

If the common type flag bit is set in the flags field, then type field consists of one uint8 value which maps to the MIME type in the table below. A value not in the table is invalid and the entire message should be rejected with "invalid" REJECT response. If the common type bit is not set the first uint8 is the length of the subsequent bytes US-ASCII encoded MIME type per RFC 6838. 

For reference the current IANA list of Media Types is located [here](https://www.iana.org/assignments/media-types/media-types.xhtml).

<details>
<summary>Media Types to number table</summary>
| number | MIME Type                                       |
|--------|-------------------------------------------------|
| 1      | application/epub+zip                            |
| 2      | application/json                                |
| 3      | application/msword                              |
| 4      | application/octet-stream                        |
| 5      | application/pdf                                 |
| 6      | application/rtf                                 |
| 7      | application/vnd.amazon.ebook                    |
| 8      | application/vnd.ms-excel                        |
| 9      | application/vnd.ms-fontobject                   |
| 10     | application/vnd.ms-powerpoint                   |
| 11     | application/vnd.oasis.opendocument.base         |
| 12     | application/vnd.oasis.opendocument.chart        |
| 13     | application/vnd.oasis.opendocument.formula      |
| 14     | application/vnd.oasis.opendocument.graphics     |
| 15     | application/vnd.oasis.opendocument.image        |
| 16     | application/vnd.oasis.opendocument.presentation |
| 17     | application/vnd.oasis.opendocument.spreadsheet  |
| 18     | application/vnd.oasis.opendocument.text         |
| 19     | application/vnd.oasis.opendocument.text-master  |
| 20     | application/vnd.oasis.opendocument.text-web     |
| 21     | application/xhtml+xml                           |
| 22     | application/xml                                 |
| 23     | application/zip                                 |
| 24     | audio/aac                                       |
| 25     | audio/midi                                      |
| 26     | audio/ogg                                       |
| 27     | audio/webm                                      |
| 28     | font/otf                                        |
| 29     | font/ttf                                        |
| 30     | font/woff                                       |
| 31     | font/woff2                                      |
| 32     | image/apng                                      |
| 33     | image/avif                                      |
| 34     | image/bmp                                       |
| 35     | image/gif                                       |
| 36     | image/jpeg                                      |
| 37     | image/png                                       |
| 38     | image/svg+xml                                   |
| 39     | image/tiff                                      |
| 40     | image/webp                                      |
| 41     | text/calendar                                   |
| 42     | text/csv                                        |
| 43     | text/html                                       |
| 44     | text/plain;charset=ASCII                        |
| 45     | text/plain;charset=UTF-16                       |
| 46     | text/plain;charset=UTF-16BE                     |
| 47     | text/plain;charset=UTF-16LE                     |
| 48     | text/plain;charset=UTF-8                        |
| 49     | video/3gpp                                      |
| 50     | video/3gpp2                                     |
| 51     | video/H264                                      |
| 52     | video/H264-RCDO                                 |
| 53     | video/H264-SVC                                  |
| 54     | video/H265                                      |
| 55     | video/H266                                      |
| 56     | video/ogg                                       |
| 57     | video/VP8                                       |
| 58     | video/VP9                                       |
| 59     | video/webm                                      |
</details>


### Attachment

Attachment headers consist of the two fields, filename and size:

| name     | type       | comment                                                                                            |
|----------|------------|----------------------------------------------------------------------------------------------------|
| filename | string     | UTF-8 prefixed by unit8 size.                                                                      |
| size     | unit32     | Size of attachment data. unit32 is the max theoretical size, but hosts can/should accept less.     |

* UTF-8
* any letter in any language, or any numeric characters
* the hyphen "-" or underscore "_" characters non-consecutively and not at beginning or end
* unique amongst attachments, case-sensitive
* less than 256 bytes length

Attachment data

| name     | type       | comment                                                                                            |
|----------|------------|----------------------------------------------------------------------------------------------------|
| data     | byte array | Sequence of octets located after all attachment headers, boundaries of each attachment are defined by corresponding size in attachment header(s) |

### Address

![fmsg address](pics/address.png)

Domain part is the domain name RFC-1035 owning the address. Recipient part identifies the recipient known to hosts for the domain. A leading "@" character is prepended to distinguish from email addresses. The secondary "@" seperates recipient and domain name as per norm.

Recipient part is a string of characters which must be:

* UTF-8
* any letter in any language, or any numeric characters
* the hyphen "-" or underscore "_" characters non-consecutively and not at beginning or end
* unique on host using case-insensitive comparison
* less than 256 bytes length when combined with domain name and @ characters 

A whole address is encoded UTF-8 prepended with size:

| name    | type           | comment                                       |
|---------|----------------|-----------------------------------------------|
| address | uint8 + string | UTF-8 encoded string prefixed with uint8 size |


### Challenge

| name        | type     | comment                                                                            |
|-------------|----------|------------------------------------------------------------------------------------|
| version     | uint8    | Must be 255 which indicates this messages is a challenge                           |
| header hash | 32 bytes | SHA-256 hash of message header being sent/received up to and including type field. |


### Challenge Response

A challenge response is the next 32 bytes received in reply to challenge request - the existance of which indicates the sender accepted the challenge. This SHA-256 hash should be kept to ensure the complete message (including attachments) once downloaded matches.

| name     | type          | comment                                                              |
|----------|---------------|----------------------------------------------------------------------|
| msg hash | 32 byte array | SHA-256 hash of entire message body and attachments.                 |


### Reject or Accept Response

A code less than 100 indicates rejection for all recipients and will be the only value. Other codes are per recipient in the same order as the as in the to field of the message excluding recipients for other domains.

| name  | type       | comment                             |
|-------|------------|-------------------------------------|
| codes | byte array | a single or sequence of unit8 codes |


| code | name                  | description                                                             |
|-----:|-----------------------|-------------------------------------------------------------------------|
| 1    | invalid               | the message is malformed, i.e. not in spec, and cannot be decoded       |
| 2    | unsupported version   | the version is not supported by the receiving host              |
| 3    | undisclosed           | no reason is given                                                      |
| 4    | too big               | total size exceeds host's maximum permitted size of messages            |
| 5    | insufficent resources | such as disk space to store the message                                 |
| 6    | parent not found      | parent referenced by pid not found                                      |
| 7    | past time             | timestamp in the message is too far in the past for this host to accept |
| 8    | future time           | timestamp in message is too far in the future for this host to accept   |
| 9    | time travel           | timestamp in message is before parent timestamp                         |
| 10   | duplicate             | message has already been received                                       |
| 11   | must challenge        | no challenge was requested but is required                              |
|      |                       |                                                                         |
| 100  | user unknown          | the recipient message is addressed to is unknown by this host           |
| 101  | user full             | insufficent resources for specific recipient                            |
|      |                       |                                                                         |
| 255  | accept                | message received                                                        |


## Protocol

A message is sent from the sender's host to each unique recipient host (i.e. each domain only once even if multiple recipients with the same domain). Sending a message either wholly succeeds or fails per recipient. During the sending from one host to another several steps are performed depicted in the below flow diagram. 
Two connection-orientated, reliable, in-order and duplex transports are required to perform the full flow. Transmission Control Protocol (TCP) is an obvious choice, on top of which Transport Layer Security (TLS) may meet your encryption needs.

![fmsg flow diagram](pics/flow.png)

*Protocol flow diagram*

### Notes

* A new connection is opened from the receiving host to the purported sender (defined in origin field of the message header) so the receiving host can verify sending host indeed exists _and_ can prove they are sending this message (in the CHALLENGE, CHALLENGE RESP exchange). Before opening the second connection hosts are encouraged to lookup origin does indeed exist at the IP address recieved from. 
* A host reaching the TERMINATE step should tear down connection(s) without regard for the other end because they must be either malicious or not following the protocol! 
* Where a message is being sent and connection closed in the diagram, closing only starts after message is sent/received, i.e. not concurrently.


## Host Resolution

fmsg hosts for a domain are listed in a `TXT` record on the subdomain: `_fmsg`, of the recipient's domain. For example: `@user@example.com`'s domain `example.com` would have the subdomain `_fmsg.example.com`. The `TXT` record is formatted thus:

* ASCII encoded
* First value is `"fmsg"`
* Followed by one or more values each of which must be:
    * A DNS record
    * AAAA DNS record 
    * IPv4 unicast address in the dotted decimal format e.g.: `192.168.0.1`
    * IPv6 unicast address in conventional format per [RFC1884](https://www.rfc-editor.org/rfc/rfc1884#page-4), e.g.: `1080::8:800:200C:417A`

An example TXT record listing fmsg hosts for `_fmsg.example.com`:
```
_fmsg.example.com.   IN   TXT   "fmsg" "fmsg1.example.com" "fmsg2.example.com" "fmsg3.example.com"
```

When multiple fmsg hosts are returned in the `TXT` then connection to the host from the sender should be tried in the order they appear.

If the `_fmsg` subdomain does not exist the recipients domain should be tried directly instead. 


### Host Resolution Considerations

Various alternatives for listing a domain's fmsg hosts were considered before arriving at the above method. Such alternatives that were considered are listed here for academic purposes only.

* Using `MX` records which was orginally meant for listing mail servers agnostic of protocol, combined with a Well Known Service `WKS` record, would have been favourable. Unfortunatly use of `WKS` is deprecated and `MX` is assumed for SMTP as of writing.
* Only using `TXT` record on recipient's domain instead of the `_fmsg` subdomain. All TXT records are retrieved on DNS query of a domain which could well contain other `TXT` records which would be superflouous.


## Security Considerations
