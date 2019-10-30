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
	 * @param {String} pattern - A Redis glob-style string pattern of keys to
	 * match. See: https://redis.io/commands/scan#the-match-option
	 *
	 * @param {Object} [options = {method: 'scan', key: '', count: 0}] - An
	 * optional object representing options for controlling the scan.
	 * Available options:
	 * * `method` - The string name of the method for this scan.
	 * Used for performing scans of a hash ('hscan'), set ('sscan'), or sorted
	 * set ('zscan').
	 * * `key` - The string key name used for HSCAN, SSCAN, or ZSCAN.
	 * * `count` - A number representing the amount of "work" we want to do
	 * with each iteration of the given SCAN command. Increase this to hundreds
	 * or thousands to speed up scans of huge keyspaces.
	 * See: https://redis.io/commands/scan#the-count-option
	 *
	 * @param {Function} eachScanCallback - A function called after each
	 * call to the Redis `SCAN` command. Invoked with (matchingKeys).
	 *
	 * @param {Function} [callback] - A function called after the full scan has
	 * completed and all keys have been returned.
	 */
	eachScan(pattern, options, eachScanCallback, callback) {
		if (!callback) {
			callback = eachScanCallback;
			eachScanCallback = options;
			options = {};
		}

		const method = options.method || 'scan';
		const key = options.key || '';
		const count = options.count || 0;

		let matchesCount = 0;

		// Because we're using the `scan()` method of the node-redis library
		// a recursive function seems easiest here.
		const recursiveScan = (cursor = 0) => {
			// Build `SCAN` command parameters using the `MATCH` option
			// and a possible key.
			let parameters = [cursor, 'MATCH', pattern];
			if (key) {
				parameters = [key, cursor, 'MATCH', pattern];
			}

			// Add any custom `COUNT` scan option.
			if (count > 0) {
				parameters.push('COUNT', count);
			}

			this.redisClient[method](...parameters, (err, data) => {
				if (err) {
					callback(err);
				} else {
					// Scan calls return an array with two elements. The
					// first element is the next cursor and the second is an
					// array of matches (which might be empty). We'll
					// destructure this into two variables.
					const [cursor, matches] = data;

					matchesCount += matches.length;
					eachScanCallback(matches);

					// We're done once Redis returns 0 for the next cursor.
					if (cursor === '0') {
						callback(null, matchesCount);
					} else {
						// Otherwise, call this function again AKA recurse
						// and pass the next cursor.
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
	 * @param {String} pattern - A Redis glob-style string pattern of keys to
	 * match.
	 *
	 * @param {Object} [options] - See eachScan options parameter documentation.
	 *
	 * @param {Function} [callback] - A function called after the full scan
	 * of the Redis keyspace completes having searched for the given pattern.
	 * Invoked with (err, keys).
	 */
	scan(pattern, options, callback) {
		if (!callback) {
			callback = options;
			options = {};
		}

		let keys = [];

		// Collect all our keys into a single array using the `eachScan()`
		// method from above.
		this.eachScan(pattern, options, (matchingKeys) => {
			keys = keys.concat(matchingKeys);
		}, (err) => {
			if (err) {
				callback(err);
			} else {
				callback(null, keys);
			}
		});
	}

	/**
	 * Scans a Redis hash keyspace to find matching hash keys and values. The
	 * matching keys and values are returned, in sequence, as an array of
	 * strings via callback.
	 *
	 * @name hscan
	 *
	 * @method
	 *
	 * @param {String} key
	 * @param {String} pattern
	 * @param {Function} [callback]
	 */
	hscan(key, pattern, callback) {
		this.scan(pattern, {method: 'hscan', key: key}, callback);
	}

	/**
	 * Scans a Redis hash keyspace to find matching hash keys and values. The
	 * matching keys are returned in sets via the `eachScanCallback` function
	 * which is called after each iteration of the Redis `HSCAN` command.
	 *
	 * @name eachHScan
	 *
	 * @method
	 *
	 * @param {String} key
	 * @param {String} pattern
	 * @param {Function} eachScanCallback
	 * @param {Function} [callback]
	 */
	eachHScan(key, pattern, eachScanCallback, callback) {
		this.eachScan(pattern, {method: 'hscan', key: key}, eachScanCallback, callback);
	}

	/**
	 * Scans a Redis set to find matching set elements. The matching elements
	 * are returned as an array of strings via callback.
	 *
	 * @name sscan
	 *
	 * @method
	 *
	 * @param {String} key
	 * @param {String} pattern
	 * @param {Function} [callback]
	 */
	sscan(key, pattern, callback) {
		this.scan(pattern, {method: 'sscan', key: key}, callback);
	}

	/**
	 * Scans a Redis set to find matching elements. The matching elements
	 * are returned in sets via the `eachScanCallback` function which is
	 * called after each iteration of the Redis `SSCAN` command.
	 *
	 * @name eachSScan
	 *
	 * @method
	 *
	 * @param {String} key
	 * @param {String} pattern
	 * @param {Function} eachScanCallback
	 * @param {Function} [callback]
	 */
	eachSScan(key, pattern, eachScanCallback, callback) {
		this.eachScan(pattern, {method: 'sscan', key: key}, eachScanCallback, callback);
	}

	/**
	 * Scans a Redis sorted set to find matching elements. The matching
	 * elements are returned with their scores as an array of strings
	 * via callback.
	 *
	 * @name zscan
	 *
	 * @method
	 *
	 * @param {String} key
	 * @param {String} pattern
	 * @param {Function} [callback]
	 */
	zscan(key, pattern, callback) {
		this.scan(pattern, {method: 'zscan', key: key}, callback);
	}

	/**
	 * Scans a Redis sorted set to find matching elements. The matching
	 * elements are returned with their scores in sets via the `eachScanCallback`
	 * function which is called after each iteration of the Redis `ZSCAN` command.
	 *
	 * @name eachZScan
	 *
	 * @method
	 *
	 * @param {String} key
	 * @param {String} pattern
	 * @param {Function} eachScanCallback
	 * @param {Function} [callback]
	 */
	eachZScan(key, pattern, eachScanCallback, callback) {
		this.eachScan(pattern, {method: 'zscan', key: key}, eachScanCallback, callback);
	}
}

module.exports = RedisScan;