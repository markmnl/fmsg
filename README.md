# msgr

Defines a message protocol where messages are relational and can be verified. Built on top of ubiquitous Internet technologies such as: TCP/IP, HTTP and DNS. Messages are sent via a msgr host to one or more recipient’s msgr host. Each message is linked to the previous using a cryptographic hash forming a hierarchical blockchain, thus enabling: 

* ownership and control – messages are exchanged at the host-to-host level (i.e. no 3rd party);
* security – recipients can verify messages are "as written" and indeed in reply to original; and:
* usability – user interface design can utilise the structured hierarchy of messages 

The protocol includes feature negotiation allowing peers to advertise and use complementary features with other peers. Overall, msgr aims to be an efficient, secure, and extensible messaging system with ownership and control at the host level.
