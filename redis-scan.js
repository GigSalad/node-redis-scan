/**
 * Given a Redis instance this class provides a couple methods for easily
 * scanning the entire keyspace.
 *
 * @name RedisScan
 * @class
 * @param {Object} redis - An instance of Node Redis:
 * https://github.com/NodeRedis/node_redis
 */
class RedisScan {

	constructor(redis) {
		this.redisClient = redis;
	}

	/**
	 * Scans the entire Redis keyspace to find matching keys. The matching
	 * keys are returned in sets via the `eachScanCallback` function which is
	 * called after each iteration of the Redis `SCAN` command. This method is
	 * useful if you want to operate on chunks and/or perform work with results
	 * at the same time as the keyspace is being scanned. That is, you want to
	 * be efficient while searching through or expecting to match on tens of
	 * thousands or even millions of keys.
	 *
	 * @name eachScan
	 *
	 * @method
	 *
	 * @param {String} pattern - A glob-style string pattern of keys to match.
	 *
	 * @param {Function} eachScanCallback - A function called after each
	 * call to the Redis `SCAN` command. Invoked with (matchingKeys). That is,
	 * this callback will be passed one parameter which is an array of strings.
	 * These strings are the Redis keys that matched the given pattern.
	 *
	 * @param {Function} [callback] - A function called after the full scan has
	 * completed and all keys have been returned.
	 */
	eachScan(pattern, eachScanCallback, callback) {
		let matchingKeysCount = 0;

		// Scanning in Redis could be implemented a few ways. Since we're
		// using the standard `scan()` method of the node-redis library we'll
		// do it with a recursive function.
		const recursiveScan = (cursor = 0) => {
			// Build a Redis `SCAN` command using the `MATCH` option.
			// See: https://redis.io/commands/scan#the-match-option
			this.redisClient.scan(cursor, 'MATCH', pattern, (err, data) => {
				if (err) {
					callback(err);
				} else {
					// node-redis returns an array with two elements. The
					// first element is the next cursor and the second is an
					// array of matching keys (which might be empty). We'll
					// destructure this into two constants.
					const [cursor, matchingKeys] = data;

					matchingKeysCount += matchingKeys.length;
					eachScanCallback(matchingKeys);

					// We're done once Redis returns 0 for the next cursor.
					if (cursor === '0') {
						callback(null, matchingKeysCount);
					} else {
						// Otherwise, call this function again AKA recurse...
						// passing the next cursor of course.
						recursiveScan(cursor);
					}
				}
			});
		};

		// Begin the scan.
		recursiveScan();
	}

	/**
	 * Scans the entire Redis keyspace to find matching keys. The matching
	 * keys are returned as an array of strings via callback. Depending on
	 * the size of your keyspace this function might not be ideal for
	 * performance. It may take tens of seconds or more for Redis databases
	 * with huge keyspaces (i.e. millions of keys or more).
	 *
	 * @name scan
	 *
	 * @method
	 *
	 * @param {String} pattern - A glob-style string pattern of keys to match.
	 *
	 * @param {Function} [callback] - A function called after the full scan
	 * of the Redis keyspace completes having searched for the given pattern.
	 * Invoked with (err, keys).
	 */
	scan(pattern, callback) {
		let keys = [];

		// Collect all our keys into a single array using the `eachScan()`
		// method from above.
		this.eachScan(pattern, (matchingKeys) => {
			keys = keys.concat(matchingKeys);
		}, (err, count) => {
			if (err) {
				callback(err);
			} else {
				callback(null, keys);
			}
		});
	}
}

module.exports = RedisScan;