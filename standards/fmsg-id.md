# fmsg Id Standard

fmsg Id standard describes an API for a fmsg host to lookup the identity of a recipient to:

1. Verify the user indeed exists
2. Check user is accepting messages
3. Get user message quotas and actuals
4. Get user meta data such as display name and host specific tags


GET /user/{name}

```
{
    "name": "jsmith",
    "address": "@jsmith@example.com",
    "displayName" "John Smith",
    "acceptNew": true,
    "quotaRecvSizeTotal": -1,
    "quotaRecvSizePerMsg": 1024,
    "quotaRecvSizePerPer1d": 102400,
    "quotaRecvCountPer1d": 500,
    "quotaSendSizeTotal": -1,
    "quotaSendSizePerMsg": -1,
    "quotaSendSizePer1d": -1,
    "quotaSendCountPer1d": -1,
    "recvSizeTotal": 92835135,
    "recvSizePerPer1d": 0,
    "recvCountPer1d": 0,
    "sendSizeTotal": 23459872,
    "sendSizePer1d": 23423,
    "sendCountPer1d": 4,
    "tags": []
}
```

POST /user/name/msg

```
{
    "timestamp": 123,
    "size": 456
}
```


