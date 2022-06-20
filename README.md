# msgr

A message definition and protocol where messages are relational and verifiable by all peers. Messages are sent via a msgr host to one or more recipients. Each message is linked to the previous using a cryptographic hash forming a hierarchical blockchain.

A key motivation for msgr is to replace email keeping the good parts (like the ability to send messages directly to an address); cutting out the bad (like inefficiency and inconsistency of clients concatenating email chains in different ways); and, designing for a modern Internet – where users are highly connected and messages may be frequent – between machines, people, or combination thereof. The high level objectives of msgr are:

* Verifiable – peers cryptographically verify messages are "as written", sent by sender, and in the case of replies: sender has original.
* Ownership and control – messages are direct at the host level without routing via a third party.
* Efficency – verifibility avoids duplication of messages and mitigates spam. Size of messages is as small as practically possible.
* Usability – user interfaces can utilise the structured hierarchy of messages.
* Extensibility – hosts can advertise complementary features avaliable.

Overall; msgr aims to be an joyful, efficient, secure and extensible messaging system with ownership and control at the host level.


## Definition

In programmer friendly JSON a message looks like:

```JSON
{
    "version": 1,
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
|version| byte | Version number message is in (currently only 1) |
|flags| byte | See msgr flags for each bit's meaning.|
|pid| bytes | SHA-256 hash of message this message is a reply to. Only present if flags has pid bit set.|
|from| msgr address | See msgr address deifnition.|
|to| uint8 + list of msgr address | See msgr address definition. Prefixed by uint8 count, addresses must be distinct of which there must be at least 1.|
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

![msgr address](address.png)

Domain part is the domain name RFC-1035 msgr host is located. Recepient part identifies the recepient known to the host message is from or to. A leading @ character is prepended to distinguish from email addresses. The secondary @ seperates recepient and domain name as per norm.

Recepient part is a string of characters which must be:

* UTF-8
* case insensitive comparison
* any letter in any language, or any numeric characters
* the hyphen "-" or underscore "_" characters non-consecutively
* less than 256 characters

A whole address is encoded UTF-8 prepended with size:

|name|type|comment|
|:----|:----|:----|
|address|uint16 + string|UTF-8 encoded string prefixed with uint16 size|

### Challenge

|name|type|comment|
|:----|:----|:----|
|header hash|32 bytes|SHA-256 hash of message header being sent/recieved up to and including type field.|

### Challenge Response

|name|type|comment|
|:----|:----|:----|
| timestamp | float64 | POSIX epoch time message was sent from client. |
| msg hash | 32 bytes | SHA-256 hash of entire message being sent/recieved. |

### Reject or Accept Response

|name|type|comment|
|:----|:----|:----|
| count | byte | the number of recepients and hence codes for in message for this host |
| codes | bytes | a code, see below, for each recepient in message for this host in order |

#### Reject or Accept Response Codes

|code | name                  | description                                                             |
|----:|-----------------------|-------------------------------------------------------------------------|
| 1   | undisclosed           | no reason is given                                                      |
| 2   | too big               | message size exceeds host's maximum tolerance                           |
| 3   | insufficent resources | such as disk space to store the message or network quota                |
| 4   | parent unavaliable    | the parent is unavaliable at this time to verify pid supplied           |
| 5   | past time             | timestamp in the message is too far in the past for this host to accept |
| 6   | future time           | timestamp in message is too far in the future for this host to accept   |
| 7   | user unknown          | the user is unknown by this host                                        |
|     |                       |                                                                         |
| 255 | accept                | message recieved     


## Protocol

A message is sent from the sender's host to each unique recepient host (i.e. each unqiue domain). Sending a message either wholly succeeds or fails to each recepient. During the sending from one host to another several steps are performed depicted in the below flow diagram. A connection-orientated, reliable, in-order and duplex transport is required to perform the full flow. Transmission Control Protocol (TCP) is an obvious choice, on top of which Transport Layer Security (TLS) may meet your encryption needs.

![msgr flow diagram](flow.png)

*Protocol flow diagram*

### Note

* Each of the WORDS IN CAPS on a connection line in the above flow diagram is for a defined message per definitions above.
* A new connection is opened from the recieving host to the purported sender's domain so the receiving host can verify sending host indeed exists _and_ can prove they are sending this message (in the CHALLENGE, CHALLENGE RESP exchange). 
* A host reaching the TERMINATE step should tear down connection(s) without regard for the other end because they must be either malicious or not following the protocol! 
* Where a message is being sent and connection closed, closing only starts after message is sent/recieved, i.e. not concurrently.



