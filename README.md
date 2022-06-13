# msgr

A message definition and protocol where messages are relational and verifiable by all peers. Messages are sent via a msgr host to one or more recipients. Each message is linked to the previous using a cryptographic hash forming a hierarchical blockchain.

A key motivation for msgr is to replace email keeping the good parts (like the ability to send messages directly to an address); cutting out the bad (like inefficiency and inconsistency of clients concatenating email chains in different ways); and, designing for a modern Internet – where users are highly connected and messages may be frequent – between machines, people, or combination thereof. The high level objectives of msgr are:

* Verifiable – peers cryptographically verify messages are "as written", sent by sender, and sender has parent (in case of replies).
* Ownership and control – messages are direct at the host level without routing via a third party.
* Efficency – verifibility avoids duplication of messages. Size of messages is as small as practically possible.
* Usability – user interfaces can utilise the structured hierarchy of messages.
* Extensibility – hosts can advertise complementary features avaliable.

Overall; msgr aims to be an joyful, efficient, secure and extensible messaging system with ownership and control at the host level.


## Definition

In programmer friendly JSON a message looks like:

```JSON
{
    "flags": 0,
    "pid": null,
    "from": "@markmnl@msgr.org",
    "to": [
        "@tim@example.com",
        "@chris@example.com"
    ],
    "time": 1654503265.679954,
    "topic": "Hello msgr!",
    "type": "text/plain;charset=UTF-8",
    "msg": "The quick brown fox jumps over the lazy dog."
}
```

On the wire messages are encoded thus:

|name|type|description|
|----|----|----|
|flags| byte | See msgr flags for each bit's meaning.|
|pid| bytes | SHA-256 hash of message this message is a reply to. Only present if flags has pid bit set.|
|from| msgr address | See msgr address deifnition.|
|to| uint8 + list of msgr address | See msgr address definition. Prefixed by uint8 count of addresses of which there must be at least 1.|
|timestamp| float64 | POSIX epoch time message was sent from client.|
|topic| uint8 + UTF-8 string | UTF-8 prefixed by unit8 size making max length 255 characters.|
|type| uint8 + UTF-8 string | US-ASCII encoded MIME type: RFC 6838, of msg.|
|msg| unint32 + bytes | Sequence of octets prefixed by uint32 size making the max theoretical size but hosts can/should accept less.|
|attachments headers| uint8 + list of msgr attachment headers | See msgr attachment header definition. Prefixed by uint8 count of attachments of which there may be 0.|
|attachments data| bytes | Sequential binary blobs defined in attachment headers, if any.|

### Flags

|bit index|name|description|
|----:|:----|:----|
|0|has pid|Set if this message is in reply to another and pid field is present.|
|1|important|Sender indicates this message is IMPORTANT!|
|2|no reply|Sender indicates any reply will be discarded.|
|3|no verify|Sender asks verfication skipped, hosts should be cautious accepting this, especially on the wild Internet. May be useful on trusted networks to save network and compute resources verifying many machine generated messages.|
|4| | |
|5| | |
|6| | |
|7|under duress|Sender indicates this message was written under duress.|

### Attachment

|name|type|comment|
|:----|:----|:----|
|filename|string|UTF-8 prefixed by unit8 size making max length of this field 255 characters.|
|size|unit32|Size of attachment making the max theoretical size, but hosts can/should accept less.|
| | | |
|data|byte array|Sequence of octets located after all other attachment headers and respective to other attachments.|


### Address
### Challenge
### Challenge Response
### Reject/Accept


## Protocol

A message is sent from the sender's host to each recepiant's host. Sending a message either wholly succeeds or fails. During the sending from one host to another several steps are performed described in the below flow diagram. A connection-orientated, reliable, in-order and duplex transport is required to perform the full flow. Transmission Control Protocol (TCP) is an obvious choice, on top of which Transport Layer Security (TLS) may meet your encryption needs.

![msgr flow diagram](flow.png) 
*Protocol flow diagram*

### Note

* Each of the WORDS IN CAPS on a connection line in the above flow diagram is for a defined message per message definitions above.
* A host reaching the TERMINATE step should tear down connection(s) without regard for the other end because they must be either malicious or not following the protocol! 
* Closing a connection only starts after message is sent/recieved, i.e. not concurrently.

