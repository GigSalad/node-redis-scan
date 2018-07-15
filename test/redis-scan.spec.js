const assert = require('assert');
const redis = require('redis');
const redisScan = require('../redis-scan');
const uuidv4 = require('uuid/v4');

describe('Redis scan tests', function() {

	// Set a high Mocha timeout to account for potentially long scan times
	// which is possible/likely with a huge existing Redis keyspace.
	this.timeout(60000); // 1 minute in ms

	let client = null;
	let scanner = null;
	let testKeys = [];
	let testKeysValues = [];

	// We want a unique key suffix to let us avoid touching any other
	// objects stored in this Redis database.
	const keySuffix = uuidv4();

	// Pre-test setup
	before(function(done) {
		// We assume Redis is running on default host and port, etc.
		client = redis.createClient();
		scanner = new redisScan(client);

		let key = '';
		let value = '';

		// Create 1000 test keys
		for (let i = 0; i < 1000; i++) {
			key = `redis-scan-test:${i}:${keySuffix}`;
			value = `Test key ${i}`;

			// Use the format `mset()` expects:
			// [key1, value1, key2, value2, ...etc]
			testKeysValues.push(key, value);

			// Also keep track of keys explicitly to delete them later.
			testKeys.push(key);
		}

		// Store those test keys...
		client.mset(testKeysValues, done);
	});

	// Post-test teardown
	after(function(done) {
		if (!client.connected) {
			// Likely not connected if the tests succeeded, so reconnect
			client = redis.createClient();
		}

		// Remove all the test keys and disconnect.
		client.del(testKeys, () => {
			client.quit();
			done();
		});
	});

	// Tests:

	describe('Full scan...', function() {
		const scanPattern = `redis-scan-test:90*:${keySuffix}`;

		it(`Should find 11 keys matching pattern ${scanPattern}`, function(done) {
			scanner.scan(scanPattern, function(err, matchingKeys) {
				if (err) return done(err);

				assert.equal(matchingKeys.length, 11);
				done();
			});
		});
	});

	describe('Each scan...', function() {
		const scanPattern = `redis-scan-test:*20:${keySuffix}`;

		it(`Should find 10 keys matching pattern ${scanPattern}`, function(done) {
			scanner.eachScan(scanPattern, (matchingKeys) => {
				// Intentionally do nothing with any matches
			}, (err, matchCount) => {
				if (err) return done(err);

				assert.equal(matchCount, 10);
				done();
			});
		});
	});

	describe('Error on scan...', function() {
		it('Should pass error to callback', function(done) {
			// Close Redis connection to cause errors
			client.quit();

			scanner.scan('*', function(err, matchingKeys) {
				if (err) {
					done();
				} else {
					done(new Error);
				}
			});
		});
	});

});
