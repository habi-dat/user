node-ssha256
============

Node Module to create ssha256 hashes

Installation
------------

```sh
npm install node-ssha256
```

Usage
-----

Create a base64 encoded hash
```javascript
var ssha256 = require('node-ssha256');
message = "hallo"
hash = ssha256.create(message);
```

Check if message matches hash
```javascript
var ssha256 = require('node-ssha256');
message = "hallo"
hash = "{SSHA256}WosKbpN2dI/q4/wtG5AW82jFPeFNqXGbSfmd/ooJrRpiYWVh"
if(ssha256.check(message)) {
    // message matched
} else {
    // not matching
}
```
