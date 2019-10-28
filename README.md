# Node Redis key scanner

A simple ES6 Redis key scanner for Node 8 and newer. This is a small class that allows you to do one thing quickly and easily: scan a Redis key space for keys that match a given pattern.

See the [Redis SCAN command documentation](https://redis.io/commands/scan) for information about how to write patterns for matching, the guarantees, caveats, etc.

# Install
With Yarn:
```
yarn add node-redis-scan
```
Or with NPM:
```
npm install node-redis-scan
```

# Use

Instantiate this class with a [Node Redis client](https://github.com/NodeRedis/node_redis) and then perform key space scans! Redis also supports scanning through hashes, sets, and sorted sets with the `HSCAN`, `SSCAN`, and `ZSCAN` commands, respectively. This functionality is available by calling the appropriately named functions listed below.

### The `scan()` method

The `scan()` method provides the easiest way to scan your key space with a single callback that will be passed all matching keys. Depending on the size of your key space (millions of keys and beyond) this process might take many seconds or longer.

**Parameters**

|Name|Type|Description|
|-|-|-|
|`pattern`|string|The Redis glob-style string pattern to match keys against.|
|`options`|object _(optional)_|An object for configuring the precise scan parameters. Available options:<br><ul><li>`method` - String name for which underlying Redis scan method we want to use. Defaults to 'scan' and can be set to one of 'hscan', 'sscan', or 'zscan'.</li><li>`key` - The string name of the applicable key. Required if the `method` is set to 'hscan', 'sscan', or 'zscan'.</li><li>`count` - A number representing how much work Redis should do with each iteration of the given scan command. This is useful if you want to scan a huge key space faster. The trade off is lengthening the brief segments of time that Redis is locked doing work scanning. See the [Redis COUNT option documentation](https://redis.io/commands/scan#the-count-option).</li></ul>|
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

// Or, with a custom COUNT option...
scanner.scan('*another-pattern', {count: 1000}, (err, matchingKeys) => {
    if (err) throw(err);

    console.log(matchingKeys);
});
```

### The `eachScan()` method

The `eachScan()` method is useful if you want to perform work with matched keys at the same time as the key space is being scanned. When you’re scanning an enormous key space this is likely a more efficient way to operate: you can begin handling matched keys asynchronously, before the entire scan has finished. Unfortunately this approach doesn’t help in situations where you need to have every matching key prior to performing the next step in your operation/application.

Matching keys are passed to the intermediate callback function after each iteration of the Redis `SCAN` command. The final callback is passed a count of how many matching keys were returned.

**Parameters**

|Name|Type|Description|
|-|-|-|
|`pattern`|string|The Redis glob-style string pattern to match keys against.|
|`options`|object _(optional)_|An object for configuring the precise scan parameters. Available options:<br><ul><li>`method` - String name for which underlying Redis scan method we want to use. Defaults to 'scan' and can be set to one of 'hscan', 'sscan', or 'zscan'.</li><li>`key` - The string name of the applicable key. Required if the `method` is set to 'hscan', 'sscan', or 'zscan'.</li><li>`count` - A number representing how much work Redis should do with each iteration of the given scan command. This is useful if you want to scan a huge key space faster. The trade off is lengthening the brief segments of time that Redis is locked doing work scanning. See the [Redis COUNT option documentation](https://redis.io/commands/scan#the-count-option).</li></ul>|
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
        // Matching keys found after this iteration of the SCAN command.
        console.log(matchingKeys);
    }
}, (err, matchCount) => {
    if (err) throw(err);

    // matchCount will be an integer count of how many total keys
    // were found and passed to the intermediate callback.
    console.log(`Found ${matchCount} keys.`);
});
```

### The `hscan()` and `eachHScan()` methods

Using `hscan()` will return all matching keys along with their values from the given hash. Note that the nature of `HSCAN` is to return the keys _and_ their values.

**Example**

```js
// Create a new instance, then:

scanner.hscan('name-of-hash', 'some-pattern*', (err, matchingKeysValues) => {
    if (err) return done(err);

    // matchingKeysValues will be an array of strings if matches were found
    // in the hash, otherwise it will be an empty array.
    console.log(matchingKeysValues);
});

// When working with an enormous hash you might prefer the
// `eachHScan()` approach, which is similar to `eachScan()`
// in that it lets you work with matches as they are returned.

scanner.eachHScan('name-of-hash', 'some-pattern*', (matchingKeysValues) => {
    // Depending on the pattern being scanned for, many or most calls to
    // this function will be passed an empty array.
    if (matchingKeysValues.length) {
        // Matching keys and values of the hash found after this
        // iteration of the HSCAN command.
        console.log(matchingKeys);
    }
}, (err, matchCount) => {
    if (err) throw(err);

    // matchCount will be an integer count of how many total keys
    // and values were found and passed to the intermediate callback.
    console.log(`Found ${matchCount} keys and values.`);
});
```

### The `sscan()` and `eachSScan()` methods

Using `sscan()` will return all matching members from the given set.

**Example**

```js
// Create a new instance, then:

scanner.sscan('name-of-set', 'some-pattern*', (err, matches) => {
    if (err) return done(err);

    // matches will be an array of strings if matches were found
    // in the set, otherwise it will be an empty array.
    console.log(matches);
});

// When working with an enormous set you might prefer the
// `eachSScan()` approach, which is similar to `eachScan()`
```

### The `zscan()` and `eachZScan()` methods

Using `zscan()` will return all matching members along with their scores from a given sorted set. Note that the nature of `ZSCAN` is to return the members _and_ their scores.

**Example**

```js
// Create a new instance, then:

scanner.zscan('name-of-sorted-set', 'some-pattern*', (err, matchingMembersScores) => {
    if (err) return done(err);

    // matchingMembersScores will be an array of strings if matches were found
    // in the sorted set, otherwise it will be an empty array.
    console.log(matchingMembersScores);
});

// When working with an enormous sorted set you might prefer the
// `eachZScan()` approach, which is similar to `eachScan()`
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
