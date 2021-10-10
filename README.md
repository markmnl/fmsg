# msgr

Defines a message protocol where messages can be verified for authenticity. Built on top of ubiquitous Internet technologies such as: HTTP, DNS and JSON. Messages are sent via a msgr server directly to one or more recipient’s msgr server. Each message is linked to the previous using a cryptographic hash identifier forming a hierarchical blockchain. Thus enabling: 
ownership – messages are exchanged at the server-to-server level on the network;
security – recipients can verify new messages in a thread are from the original thread; and:
usability – user interface design can utilise the hierarchy of messages 
The protocol includes feature negotiation allowing peers to advertise and use other features with eachother. Overall msgr provides an efficient, secure, and extensible messaging system with ownership and control at the server level.