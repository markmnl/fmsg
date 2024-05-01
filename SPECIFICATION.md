# fmsg Specification

- [Definition](#definition)
    - [Message](#message)
    - [Flags](#flags)
    - [Attachment](#attachment)
    - [Address](#address)
    - [Challenge](#challenge)
    - [Challenge Response](#challenge-response)
    - [Reject or Accept Response](#reject-or-accept-response)
- [Protocol](#protocol)
    - [Flow diagram](#protocol)
- [Host Resolution](#host-resolution)

## TODO

* REJECT response for incompatible version

## Data Types

Throughout this document the following data types are used. All types are encoded little-endian.
         
uint8       8 bit wide integer with a value in the set of all unsigned 8-bit integers (0 to 255)
uint16      16 bit wide integer with a value in the set of all unsigned 16-bit integers (0 to 65535)
uint32      32 bit wide integer with a value in the set of all unsigned 32-bit integers (0 to 4294967295)
bit         a single bit 0 or 1 within a uint8, the 0 based index of which is defined alongside in this document 
float64     a 64 bit wide number in the set of all IEEE-754 64-bit floating-point numbers
byte        alias to uint8
byte array  sequence of uint8 values the length of which is defined alongside in this document
bytes       alias to byte array
string      sequence of characters the encoding (e.g. ASCII or UTF-8) and length are defined alongside in this document

## Definition

### Message

In programmer friendly JSON a message could look like:

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

| name                | type                                    | description                                                                                                         |
|---------------------|-----------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| version             | uint8                                   | Version number message is in (currently only 1); or 255 if CHALLENGE - defined below.                               |
| origin              | uint8 + ASCII string                    | Domain name or IP address of the actual host sending the message, prefixed by unit8 size.                           |
| flags               | uint8                                   | See [flags](#flags) for each bit's meaning.                                                                         |
| [pid]               | byte array                              | SHA-256 hash of message this message is a reply to. Only present if flags has pid bit set.                          |
| from                | fmsg address                            | See [address](#address) definition.                                                                                 |
| to                  | uint8 + list of fmsg address            | See [address](#address) definition. Prefixed by uint8 count, addresses must be distinct (case-insensitive) of which there must be at least 1. |
| time                | float64                                 | POSIX epoch time message was received by host sending the message.                                                  |
| [topic]             | uint8 + UTF-8 string                    | UTF-8 free text title of the message thread, prefixed by unit8 size which may be 0. Only present on first message intiating a thread i.e. when there is no pid. |
| type                | uint8 + [ASCII string]                  | Either a common type, see [Common MIME Types](#common-mime-types), or a US-ASCII encoded MIME type: RFC 6838, of msg.                                                                       |
| size                | uint32                                  | Size of msg data in bytes must be at least 1                                                                        |
| attachments headers | uint8 + [list of attachment headers]    | See [attachment](#attachment) header definition. Prefixed by uint8 count of attachments of which there may be 0.    |
| msg data            | byte array                              | Sequence of octets.                                                                                                 |
| [attachments data]  | byte array(s)                           | Sequential sequence of octets boundries of which are defined by attachment headers size(s), if any.                |

#### Common MIME Types

If the common type flag bit is set in the flags field, then the uint8 value in the type field maps to the MIME type in the table below. A value not in the table is invalid and the entire message should be rejected with "invalid" REJECT response. 

| value | MIME type |
|-------|-----------|
| 1     | text/plain;charset=UTF-8 |
| 1     | text/html |
| 1     | text/calendar |

| 1     | image/apng |
| 1     | image/avif |
| 1     | image/gif |
| 1     | image/jpeg |
| 1     | image/png |
| 1     | image/svg+xml |
| 1     | image/webp |

| 1     | audio/mpeg |
| 1     | audio/mpeg |
| 1     | audio/mpeg |
| 1     | audio/mpeg |
| 1     | audio/mpeg |

| 1     | video/mp4 |
| 1     | video/mpeg |
| 1     | video/mp4 |
| 1     | video/mp4 |

| 255   | application/octet-stream |


### Flags

| bit index | name         | description                                                                                                                                                                                                                 |
|----------:|--------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0         | has pid      | Set if this message is in reply to another and pid field is present.                                                                                                                                                        |
| 1         | common type  | Indicates the type field is just a uint8 value and MIME type can be looked up per [Common MIME Types](#common-mime-types)                                                                                                   |
| 2         | important    | Sender indicates this message is IMPORTANT!                                                                                                                                                                                 |
| 3         | no reply     | Sender indicates any reply will be discarded.                                                                                                                                                                               |
| 4         | no challenge | Sender asks challenge skipped, hosts should be cautious accepting this, especially on the wild Internet. May be useful on trusted networks to save network and compute resources verifying many machine generated messages. |
| 5         |              |                                                                                                                                                                                                                             |
| 6         |              |                                                                                                                                                                                                                             |
| 7         | under duress | Sender indicates this message was written under duress.    

### Attachment

Attachment headers consist of the two fields size and filename:

| name     | type       | comment                                                                                            |
|----------|------------|----------------------------------------------------------------------------------------------------|
| filename | string     | UTF-8 prefixed by unit8 size.                                                                      |
| size     | unit32     | Size of attachment data. unit32 is the max theoretical size, but hosts can/should accept less.     |

* UTF-8
* any letter in any language, or any numeric characters
* the hyphen "-" or underscore "_" characters non-consecutively and not at beginning or end
* unique amongst attachments
* less than 256 bytes length

Attachment data
| name     | type       | comment                                                                                            |
|----------|------------|----------------------------------------------------------------------------------------------------|
| data     | byte array | Sequence of octets located after all other attachment headers and respective to other attachments. |

### Address

![fmsg address](pics/address.png)

Domain part is the domain name RFC-1035 owning the address. Recipient part identifies the recipient known to hosts for the domain. A leading "@" character is prepended to distinguish from email addresses. The secondary "@" seperates recipient and domain name as per norm.

Recipient part is a string of characters which must be:

* UTF-8
* any letter in any language, or any numeric characters
* the hyphen "-" or underscore "_" characters non-consecutively and not at beginning or end
* unique on host using case insensitive comparison
* less than 256 bytes length when combined with domain name and @ characters 

A whole address is encoded UTF-8 prepended with size:

| name    | type           | comment                                       |
|---------|----------------|-----------------------------------------------|
| address | uint8 + string | UTF-8 encoded string prefixed with uint8 size |


### Challenge

| name        | type     | comment                                                                            |
|-------------|----------|------------------------------------------------------------------------------------|
| version     | uint8    | Must be 255 which indicates this messages is a challenge                           |
| header hash | 32 bytes | SHA-256 hash of message header being sent/recieved up to and including type field. |


### Challenge Response

A challenge response is the next 32 bytes recieved in reply to challenge request - the existance of which indicates the sender accepted the challenge. This SHA-256 hash should be kept to ensure the complete message (including attachments) once downloaded matches.

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
| 2    | unsupported version   | the message version is not supported by the receiving host              |
| 3    | undisclosed           | no reason is given                                                      |
| 4    | too big               | total size exceeds host's maximum permitted size                        |
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

### Note

* Each of the WORDS IN CAPS on a connection line in the above flow diagram is for a defined message per definitions above.
* A new connection is opened from the recieving host to the purported sender's domain so the receiving host can verify sending host indeed exists _and_ can prove they are sending this message (in the CHALLENGE, CHALLENGE RESP exchange). 
* A host reaching the TERMINATE step should tear down connection(s) without regard for the other end because they must be either malicious or not following the protocol! 
* Where a message is being sent and connection closed in the diagram, closing only starts after message is sent/recieved, i.e. not concurrently.


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


### Considerations

Various alternatives for listing a domain's fmsg hosts were considered before arriving at the above method. Such alternatives that were considered are listed here for academic purposes only.

* Using `MX` records which was orginally meant for listing mail servers agnostic of protocol, combined with a Well Known Service `WKS` record, would have been favourable. Unfortunatly use of `WKS` is deprecated and `MX` is assumed for SMTP as of writing.
* Only using `TXT` record on recipient's domain instead of the `_fmsg` subdomain. All TXT records are retrieved on DNS query of a domain which will could well contain other `TXT` records which would be superflouous.
