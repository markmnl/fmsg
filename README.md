# msgr

A message definition and protocol where messages are relational and verifiable by all peers. Messages are sent via a msgr host to one or more recipients. Each message is linked to the previous using a cryptographic hash forming a hierarchical blockchain.

A key motivation for msgr is to replace email keeping the good parts (like the ability to send an unsolicited message directly to an address); cutting out the bad (like inefficiency and inconsistency of clients concatenating email chains in different ways); and, designing for a modern Internet where messages may be between machines or people, or combination thereof. The high level objectives of msgr are:

* Ownership and control – messages are direct instead of via a 3rd party
* Verifiable – peers can verify messages are "as written"
* Usability – user experiences can utilise the structured hierarchy of messages
* Extensibility – hosts can advertise complementary features avaliable

Overall; msgr aims to be an efficient, secure and extensible messaging system with ownership and control at the host level.


## Definition

In programmer friendly JSON a message would looke like:

```JSON
{
    "pid": null,
    "from": "@markmnl@msgr.org",
    "to": [
        "@tim@example.com",
        "@chris@example.com"
    ],
    "time": 1579706539,
    "topic": "Hello msgr!",
    "type": "text/html",
    "msg": "&lt;!DOCTYPE html&gt;\n&lt;html&gt;\n\n&lt;head&gt;\n    &lt;style&gt;\n        /* CSS inline as clients SHOULD not download content to display */\n        body {\n            background-color: black;\n            color: gainsboro;\n        }\n    &lt;/style&gt;\n&lt;/head&gt;\n\n&lt;body&gt;\n    &lt;h1&gt;msgr&lt;/h1&gt;\n    &lt;p&gt;A message definition and protocol where messages are relational and verifiable by all peers. Messages are sent\n        via a msgr yada yada\n    &lt;/p&gt;\n    &lt;ul&gt;\n        &lt;li&gt;Ownership and control â€“ messages are direct instead of via a 3rd party&lt;/li&gt;\n        &lt;li&gt;Verifiable â€“ peers can verify messages are &quot;as written&quot;&lt;/li&gt;\n        &lt;li&gt;Usability â€“ user experiences can utilise the structured hierarchy of messages&lt;/li&gt;\n        &lt;li&gt;Extensibility â€“ hosts can advertise complementary features avaliable&lt;/li&gt;\n    &lt;/ul&gt;\n\n&lt;/body&gt;\n\n&lt;/html&gt;"
}
```


### Address



## Protocol
