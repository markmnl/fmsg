# msgr

Defines a message protocol where messages are relational and can be verified for authenticity. Built on top of ubiquitous Internet technologies such as: TCP/IP, HTTP and DNS. Messages are sent via a msgr server directly to one or more recipient’s msgr server. Each message is linked to the previous using a cryptographic hash identifier forming a hierarchical blockchain, thus enabling: 

* ownership – messages are exchanged at the server-to-server level on the network;
* security – recipients can verify new messages in a thread are from the original thread; and:
* usability – user interface design can utilise the hierarchy of messages 

The protocol includes feature negotiation allowing peers to advertise and use complementary features with other peers. Overall, msgr provides an efficient, secure, and extensible messaging system with ownership and control at the server level.
