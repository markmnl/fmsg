# msgr

A message definition and protocol where messages are relational and verifiable by all peers. Messages are sent via a msgr host to one or more recipients. Each message is linked to the previous using a cryptographic hash forming a hierarchical blockchain.

A key motivation for msgr is to replace email keeping the good parts (like the ability to send an unsolicited message directly to an address); cutting out the bad (like inefficiency and inconsistency of clients concatenating email chains in different ways); and, designing for a modern Internet where messages may be between machines or people, or combination thereof. The high level objectives of msgr are:

* Ownership and control – messages are direct at the host level.
* Verifiable – peers can verify messages are "as written", and on reciept verify sender sent the message.
* Usability – user experiences can utilise the structured hierarchy of messages
* Extensibility – hosts can advertise complementary features avaliable

Overall; msgr aims to be an efficient, secure and extensible messaging system with ownership and control at the host level.


## Definition

In programmer friendly JSON a message looks like:

```JSON
{
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
|timestamp| float64 | POSIX epoch time message was sent.|
|topic| uint8 + UTF-8 string | UTF-8 prefixed by unit8 size making max length 255 characters.|
|type| uint8 + UTF-8 string | US-ASCII encoded MIME type: RFC 6838, of msg.|
|msg| bytes | Sequence of octets prefixed by uint32 size making the max theoretical size but hosts can/should accept less.|
|attachments headers| uint8 + list of msgr attachment headers | See msgr attachment header definition. Prefixed by uint8 count of attachments of which there may be 0.|
|attachments data| bytes | Binary blobs defined in attachment headers, if any.|

### msgr flags

|bit index|name|description|
|----:|:----|:----|
|0|has pid|Set if this message is in reply to .|
|1|important|Sender indicates this message is IMPORTANT!|
|2|no reply|Sender indicates any reply will be discarded.|
|3|no verify|Sender asks verfication skipped, hosts should be cautious accepting this, especially on the wild Internet. May be useful on trusted networks to save network and compute resources verifying many machine generated messages.|
|4| | |
|5| | |
|6| | |
|7|written under duress|Sender indicates this message was written under duress.|

### msgr attachment

|name|type|comment|
|:----|:----|:----|
|filename|string|UTF-8 prefixed by unit8 size making max length of this field 255 characters.|
|type|mime type|US-ASCII encoded MIME type: RFC 6838 of msg.|
|size|unit32|Size of attachment making the max theoretical size, but hosts can/should accept less.|
| | | |
|data|byte array|Sequence of octets|


### msgr address



## Protocol










