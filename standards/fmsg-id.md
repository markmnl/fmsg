# fmsg Id Standard

fmsg Id standard describes an API for a fmsg host to lookup the identity of a recipient to:

1. Verify the user indeed exists
2. Check user is accepting messages
3. Get user message limits and actuals
4. Get user meta data such as display name and any host specific tags


GET /user/{address}

```
{
    "name": "jsmith",
    "address": "@jsmith@example.com",
    "displayName" "John Smith",
    "acceptingNew": true,

    "limitRecvSizeTotal": -1,
    "limitRecvSizePerMsg": 1024,
    "limitRecvSizePer1d": 102400,
    "limitRecvCountPer1d": 500,

    "limitSendSizeTotal": -1,
    "limitSendSizePerMsg": -1,
    "limitSendSizePer1d": -1,
    "limitSendCountPer1d": -1,

    "recvSizeTotal": 92835135,
    "recvSizePerPer1d": 0,
    "recvCountPer1d": 0,

    "sendSizeTotal": 23459872,
    "sendSizePer1d": 23423,
    "sendCountPer1d": 4,

    "tags": []
}
```

POST /user/recv/{address}
POST /user/sent/{address}

```
{
    "timestamp": 123,
    "size": 456
}
```


