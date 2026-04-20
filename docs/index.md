# fmsg

GitHub: <https://github.com/markmnl/fmsg>

Show HN Article <https://markmnl.github.io/fmsg/show-hn>


# Documents

| Document                                  | Short Description |
|-------------------------------------------|-------------------|
| [SPECIFICATION.md](https://github.com/markmnl/fmsg/blob/main/SPECIFICATION.md) | Core fmsg specification describing message communication between fmsg hosts. |
| [SPEC.md](https://github.com/markmnl/fmsg/blob/main/SPEC.md) | Concise version of the specification. |
| [STANDARDS.md](https://github.com/markmnl/fmsg/blob/main/STANDARDS.md) | Common standards surrounding fmsg setups such as API contracts. |


# Standards

| Standard  | Short Description                                      |
|-----------|--------------------------------------------------------|
| [FMSG-001](https://github.com/markmnl/fmsg/blob/main/standards/fmsg-001-transport-and-binding.md) | TCP+TLS Transport and Binding Standard |
| [FMSG-002](https://github.com/markmnl/fmsg/blob/main/standards/fmsg-002-id.md) | HTTP API spec for recipient lookup and quota limits |
| [FMSG-003](https://github.com/markmnl/fmsg/blob/main/standards/fmsg-003-webapi.md) | HTTP API spec for client to perform CRUD operations on messages for a specific address |


# Host Implementations

| Implementation                                      | Description                  |
|-----------------------------------------------------|------------------------------|
| [fmsgd](https://github.com/markmnl/fmsgd)           | fmsg host written in Go!     |


# Ancillary Service Implementations

| Implementation                                         | Description                          |
|--------------------------------------------------------|--------------------------------------|
| [fmsg-docker](https://github.com/markmnl/fmsg-docker)  | Docker compose all-in-one fmsg stack |
| [fmsgid](https://github.com/markmnl/fmsgid)            | Implementation of the FMSG-002 Id Standard - HTTP API providing address and quota lookup |
| [fmsg-webapi](https://github.com/markmnl/fmsg-webapi)  | Implementation of the FMSG-003 Web API Standard - HTTP API providing message sending and retrieval via an integrated fmsgd host |
| [fmsg-cli](https://github.com/markmnl/fmsg-cli)        | Command line interface to fmsg Web API |

