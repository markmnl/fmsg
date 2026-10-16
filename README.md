# fmsg

![icon](pics/icon.png) A binary message definition and protocol where messages are relational and verifiable by all peers. Messages are sent via a fmsg host to one or more recipients. Each message in a thread is linked to the previous using a cryptographic hash forming a directed acyclic graph.

This repository serves as a host and index for fmsg related documents listed below, including the white paper, specification and standards.

fmsg host-to-host transport uses TCP port 4930, [registered with IANA](https://www.iana.org/assignments/service-names-port-numbers/service-names-port-numbers.xhtml?search=fmsg) under the service name `fmsg` (see [FMSG-001](standards/fmsg-001-transport-and-binding.md)).



| Document                                      | Short Description |
|-----------------------------------------------|-------------------|
| [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md)      | List of fmsg implementations including ancillary services, APIs and apps. |
| [SPECIFICATION.md](SPECIFICATION.md)          | Core fmsg specification describing message communication between fmsg hosts. |
| [STANDARDS.md](STANDARDS.md)                  | Common standards surrounding fmsg setups such as API contracts.  |
| [fmsg.pdf](fmsg.pdf)  | Paper introducing fmsg including motivations and overview.  |



