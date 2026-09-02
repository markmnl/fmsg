# fmsg Host Implementations

| Implementation                                      | Description                  |
|-----------------------------------------------------|------------------------------|
| [fmsgd](https://github.com/markmnl/fmsgd)           | fmsg host written in Go!     |


# fmsg Ancillary Service Implementations

| Implementation                                         | Description                          |
|--------------------------------------------------------|--------------------------------------|
| [fmsg-docker](https://github.com/markmnl/fmsg-docker)  | Docker compose all-in-one fmsg stack |
| [fmsgid](https://github.com/markmnl/fmsgid)            | Implementation of the [fmsg Id Standard](standards/fmsg-002-id.md) - HTTP API providing address and qutoas lookup.     |
| [fmsg-webapi](https://github.com/markmnl/fmsg-webapi)  | Implementation of the [fmsg Web API Standard](standards/fmsg-003-webapi.md) - HTTP API providing message sending and retrival via an integrated fmsgd host     |
| [fmsg-cli](https://github.com/markmnl/fmsg-cli)        | Command line interface to fmsg Web API     |
| [fmsg-groot](https://github.com/markmnl/fmsg-groot)    | Demo bot that replies “I am Groot” to every message |


 


# fmsg Adaptors

Adaptors connect existing agent frameworks and applications to fmsg so they can send and receive messages using their own fmsg address.

| Implementation                                             | Description                          |
|------------------------------------------------------------|--------------------------------------|
| [hermes-fmsg](https://github.com/markmnl/hermes-fmsg)      | fmsg platform plugin for [Hermes Agent](https://github.com/NousResearch/hermes-agent) - gives a Hermes agent its own address with fmsg threads mapped to Hermes sessions |
| [openclaw-fmsg](https://github.com/markmnl/openclaw-fmsg)  | fmsg channel plugin for [OpenClaw](https://openclaw.ai) - receives messages over WebSocket with inbox catch-up, maps fmsg message trees to OpenClaw sessions and carries attachments both ways |
