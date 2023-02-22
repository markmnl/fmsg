# Work in progress...

![icon](pics/icon.png) A message definition and protocol where messages are relational and verifiable by all peers. Messages are sent via a fmsg host to one or more recipients. Each message in a thread is linked to the previous using a cryptographic hash forming a hierarchical structure.

The lofty ambition of fmsg is to supersede electronic mail (email) keeping the good parts (like the ability to send messages directly to an address), and solving the bad (like spam and the inefficiency and inconsistency of clients concatenating email chains in different ways). The high level objectives of fmsg are:

* Verifiability – hosts cryptographically verify messages are "as written", the sending host can prove they are indeed sending the message, and, in the case of replies the sender has original.
* Ownership and control – messages are direct at the host level without routing via a third party. Anyone or entity can setup a host at their domain.
* Efficency – relational structure avoids duplication of messages, this combined with verifiability mitigates spam. Size of messages is as small as practically possible.
* Usability – user interfaces can utilise the structured hierarchy of messages.


Overall; fmsg aims to be a joyful, efficient and secure messaging system with ownership and control at the host level.