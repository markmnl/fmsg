# FMSG-001 FMSG API Standard

fmsg services use the below TCP port depending on the use case (message exchange, or request-response) and whether they are using TLS encryption.

| Port | Use Case                          | TLS  |
|------|-----------------------------------|------|
| 4930 | fmsg message exchange             | No   |
| 4931 | fmsg message exchange             | Yes  |
| 4932 | fmsg request/response             | No   |
| 4933 | fmsg request/response             | Yes  |
