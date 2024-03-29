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
- [Domain Name Resolution](#domain-name-resolution)

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
    "type": "text/plain;charset=UTF-8",
    "msg": "The quick brown fox jumps over the lazy dog.",
    "attachments": [
        {
            "filename": "doc.pdf",
            "size": 1024
        }
    ]
}
```

On the wire messages are encoded thus:

| name                | type                                    | description                                                                                                         |
|---------------------|-----------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| version             | uint8                                   | Version number message is in (currently only 1); or 255 if CHALLENGE - defined below.                               |
| origin              | uint8 + ASCII string                    | Domain name of the actual host sending the message, prefixed by unit8 size.                                         |
| flags               | uint8                                   | See [flags](#flags) for each bit's meaning.                                                                         |
| pid                 | byte array                              | SHA-256 hash of message this message is a reply to. Only present if flags has pid bit set.                          |
| from                | fmsg address                            | See [address](#address) definition.                                                                                 |
| to                  | uint8 + list of fmsg address            | See [address](#address) definition. Prefixed by uint8 count, addresses must be distinct of which there must be at least 1. |
| time                | float64                                 | POSIX epoch time message was received by host sending the message.                                                  |
| topic               | uint8 + UTF-8 string                    | UTF-8 free text describing content, prefixed by unit8 size making max length 255 characters, may be 0.              |
| type                | uint8 + ASCII string                    | US-ASCII encoded MIME type: RFC 6838, of msg.                                                                       |
| msg                 | unint32 + byte array                    | Sequence of octets prefixed by uint32 size which must be greater than 0.                                            |
| attachments headers | uint8 + list of fmsg attachment headers | See [attachment](#attachment) header definition. Prefixed by uint8 count of attachments of which there may be 0.    |
| attachments data    | byte array                              | Sequential binary blobs defined in attachment headers, if any.                                                      |


### Flags

| bit index | name         | description                                                                                                                                                                                                                 |
|----------:|--------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| 0         | has pid      | Set if this message is in reply to another and pid field is present.                                                                                                                                                        |
| 1         | important    | Sender indicates this message is IMPORTANT!                                                                                                                                                                                 |
| 2         | no reply     | Sender indicates any reply will be discarded.                                                                                                                                                                               |
| 3         | no challenge | Sender asks challenge skipped, hosts should be cautious accepting this, especially on the wild Internet. May be useful on trusted networks to save network and compute resources verifying many machine generated messages. |
| 4         |              |                                                                                                                                                                                                                             |
| 5         |              |                                                                                                                                                                                                                             |
| 6         |              |                                                                                                                                                                                                                             |
| 7         | under duress | Sender indicates this message was written under duress.    

### Attachment

Attachment headers consist of the two fields and precede sequential data blobs they are for. Filename must be:

* UTF-8
* any letter in any language, or any numeric characters
* the hyphen "-" or underscore "_" characters non-consecutively and not at beginning or end
* unique amongst attachments
* less than 256 bytes length

| name     | type       | comment                                                                                            |
|----------|------------|----------------------------------------------------------------------------------------------------|
| filename | string     | UTF-8 prefixed by unit8 size making max length of this field 255 characters.                       |
| size     | unit32     | Size of attachment making the max theoretical size, but hosts can/should accept less.              |
|          |            |                                                                                                    |
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
| 1    | undisclosed           | no reason is given                                                      |
| 2    | too big               | message size exceeds host's maximum permitted size                      |
| 3    | insufficent resources | such as disk space to store the message                                 |
| 4    | parent not found      | parent referenced by pid not found                                      |
| 5    | past time             | timestamp in the message is too far in the past for this host to accept |
| 6    | future time           | timestamp in message is too far in the future for this host to accept   |
| 7    | time travel           | timestamp in message is before parent timestamp                         |
| 8    | duplicate             | message has already been received                                       |
|      |                       |                                                                         |
| 100  | user unknown          | the recipient message is addressed to is unknown by this host           |
| 101  | user full             | insufficent resources for specific recipient                            |
|      |                       |                                                                         |
| 255  | accept                | message received                                                        |


## Protocol

A message is sent from the sender's host to each unique recipient host (i.e. only each domain once). Sending a message either wholly succeeds or fails per recipient. During the sending from one host to another several steps are performed depicted in the below flow diagram. 
Two connection-orientated, reliable, in-order and duplex transports are required to perform the full flow. Transmission Control Protocol (TCP) is an obvious choice, on top of which Transport Layer Security (TLS) may meet your encryption needs.

![fmsg flow diagram](pics/flow.png)

*Protocol flow diagram*

### Note

* Each of the WORDS IN CAPS on a connection line in the above flow diagram is for a defined message per definitions above.
* A new connection is opened from the recieving host to the purported sender's domain so the receiving host can verify sending host indeed exists _and_ can prove they are sending this message (in the CHALLENGE, CHALLENGE RESP exchange). 
* A host reaching the TERMINATE step should tear down connection(s) without regard for the other end because they must be either malicious or not following the protocol! 
* Where a message is being sent and connection closed in the diagram, closing only starts after message is sent/recieved, i.e. not concurrently.


## Domain Name Resolution

fmsg hosts for a domain are listed in a `TXT` record on the subdomain: `fmsghosts`, of the recipient's domain. For example: `@user@example.com`'s domain `example.com` will have the subdomain `fmsghosts.example.com`. The `TXT` record is formatted thus:

* ASCII encoded
* First value is: "fmsg"
* Followed by one up to five values each of which must be either an A, AAAA record type or IP address

If the `fmsghosts` subdomain does not exist the recipients domain name should be tried directly instead; otherwise the domain names listed should be tried in the order they appear.

An example TXT record listing fmsg hosts for `fmsghosts.example.com`:
```
fmsghosts.example.com.   IN   TXT   "fmsg" "fmsg1.example.com" "fmsg2.example.com" "fmsg3.example.com"
```

Aside, using `MX` records which was designed for listing mail servers agnostic of protocol, combined with a Well Known Service `WKS` record, would have been favourable. Unfortunatly use of `WKS` is deprecated and `MX` is assumed for SMTP.
