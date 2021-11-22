# msgr

Defines a message protocol where messages are relational and can be verified. Built on top of ubiquitous Internet technologies such as TCP/IP, HTTP and DNS. Messages are sent via a msgr host to one or more recipient’s msgr host. Each message is linked to the previous using a cryptographic hash forming a hierarchical blockchain. Key motivations: 

* ownership and control – messages are exchanged at the host level;
* security – recipients can verify messages are "as written" and replies have the original; and:
* usability – user interface design can utilise the structured hierarchy of messages 

Hosts can advertise complementary features peers can use.

Overall, msgr aims to be an efficient, secure and extensible messaging system with ownership and control at the host level.
