# Node Redis key scanner

A simple ES6 Redis key scanner for Node 8 and newer. This is a small class that allows you to do one thing quickly and easily: scan a Redis keyspace for a given pattern.

See the [Redis SCAN command documentation](https://redis.io/commands/scan) for information about how to write patterns for matching, the guarantees, caveats, etc.

# Install

```
yarn add node-redis-scan
```

# Use

Instantiate this class with a [Node Redis client](https://github.com/NodeRedis/node_redis) and then perform keyspace scans in one of two ways...

### The `scan()` method

The `scan()` method provides the easiest way to scan your keyspace with a single callback that will be passed all matching keys. Depending on the size of your keyspace (millions of keys and beyond) this process might take many seconds or longer.

**Parameters**

|Name|Type|Description|
|-|-|-|
|`pattern`|string|The Redis glob-style string pattern to match keys against.|
|`callback`|function|Invoked with (err, matchingKeys).|

**Example**

```js
const redis = require('redis');
const redisScan = require('node-redis-scan');

const client = redis.createClient();
const scanner = new redisScan(client);

scanner.scan('some-pattern*', (err, matchingKeys) => {
    if (err) throw(err);

    // matchingKeys will be an array of strings if matches were found
    // otherwise it will be an empty array.
    console.log(matchingKeys);
});
```

### The `eachScan()` method

The `eachScan()` method is useful if you want to perform work with matched keys at the same time as the keyspace is being scanned. When you’re scanning an enormous keyspace this is likely a more efficient way to operate. Unforunately this approach doesn’t help in cases where you need to have all matching keys prior to performing the next step in your application.

Matching keys are passed to the intermediate callback fuction after each iteration of the Redis `SCAN` command. The final callback is passed a count of how many matching keys were returned.

**Parameters**

|Name|Type|Description|
|-|-|-|
|`pattern`|string|The Redis glob-style string pattern to match keys against.|
|`eachScanCallback`|function|Invoked with (matchingKeys).|
|`callback`|function|Invoked with (err, matchCount).|

**Example**

```js
const redis = require('redis');
const redisScan = require('node-redis-scan');

const client = redis.createClient();
const scanner = new redisScan(client);

scanner.eachScan('some-pattern*', (matchingKeys) => {
    // Depending on the pattern being scanned for, many or most calls to
    // this function will be passed an empty array.
    if (matchingKeys.length) {
        // matchingKeys found after this iteration of the SCAN command.
        console.log(matchingKeys);
    }
}, (err, matchCount) => {
    if (err) throw(err);

    // matchCount will be an integer count of how many total keys
    // were found and passed to the intermediate callback.
    console.log(`Found ${matchCount} keys.`);
});
```

# Test

Tests are run via [Istanbul](https://github.com/istanbuljs/nyc) and [Mocha](https://github.com/mochajs/mocha). Clone the project then run:

```
yarn test
```

# Contribute

Simply open an issue or send a pull request. Not sure how to do that? Check out [Github’s fast and free course on how to contribute to a project](https://egghead.io/courses/how-to-contribute-to-an-open-source-project-on-github).

# License

Licensed under the [Apache License 2.0](http://www.apache.org/licenses/LICENSE-2.0.html).
