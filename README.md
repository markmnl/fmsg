# fmsg

![icon](pics/icon.png) A binary message definition and protocol where messages are relational and verifiable by all peers. Messages are sent via a fmsg host to one or more recipients. Each message in a thread is linked to the previous using a cryptographic hash forming a directed acyclic graph.

This repository serves as a host and index for fmsg related documents listed below, including the white paper, specification and standards.

**Website:** [https://fmsg.org](https://fmsg.org) 


| Document                                      | Short Description |
|-----------------------------------------------|-------------------|
| [IMPLEMENTATIONS.md](IMPLEMENTATIONS.md)      | List of fmsg implementations including ancillary services, APIs and apps. |
| [SPECIFICATION.md](SPECIFICATION.md)          | Core fmsg specification describing message communication between fmsg hosts. |
| [STANDARDS.md](STANDARDS.md)                  | Common standards surrounding fmsg setups such as API contracts.  |
| [FMSG_WHITE_PAPER.pdf](FMSG_WHITE_PAPER.pdf)  | Paper introducing fmsg including motivations and overview.  |

## For AI agents

Any MCP-capable agent (Claude Code, Claude Desktop, Cursor, VS Code and others) can get its own fmsg address with [fmsg-mcp](https://github.com/markmnl/fmsg-mcp), the reference implementation of [FMSG-007](standards/fmsg-007-mcp-binding.md):

```sh
claude mcp add fmsg --scope user \
  --env FMSG_API_URL=https://api.example.com \
  --env FMSG_API_KEY=fmsgk_... \
  -- npx -y @markmnl/fmsg-mcp
```

The same server can run as a hosted endpoint where each user connects with their own API key. Agents that speak A2A can use the [FMSG-004](standards/fmsg-004-a2a-binding.md) binding instead.
