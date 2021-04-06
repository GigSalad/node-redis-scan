const assert = require('assert').strict;
const redis = require('redis');
const redisScan = require('../redis-scan');
const { v4: uuidv4 } = require('uuid');

describe('Redis scan tests', function() {

	// Set a high Mocha timeout to account for potentially long scan times
	// which is possible and likely with a large existing Redis keyspace.
	this.timeout(60000); // 1 minute in ms

	let client = null;
	let scanner = null;
	let testKeys = [];
	let testValues = [];
	let testKeysValues = [];

	// We want a unique key prefix and suffix to let us avoid touching
	// any other objects stored in this instance of Redis.
	const keyPrefix = 'node-redis-scan-test';
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
			key = `${keyPrefix}:${i}:${keySuffix}`;
			value = `Test key ${i}`;

			// Use the format `mset()` expects:
			// [key1, value1, key2, value2, ...etc]
			testKeysValues.push(key, value);

			// Keep track of keys and values explicitly for later use.
			testKeys.push(key);
			testValues.push(value);
		}

		// Store the test keys...
		client.multi()
			.mset(testKeysValues)
			.hmset(`${keyPrefix}:hash-test:${keySuffix}`, testKeysValues)
			.sadd(`${keyPrefix}:set-test:${keySuffix}`, testValues)
			.zadd(`${keyPrefix}:sorted-set-test:${keySuffix}`, testValues.map(value => [1, value]).flat())
			.exec(done);
	});

	// Post-test teardown
	after(function(done) {
		if (!client.connected) {
			// Likely not connected if the tests succeeded, so reconnect
			client = redis.createClient();
		}

		// Ensure the hash, set, and sorted set also get removed
		testKeys.push(
			`${keyPrefix}:hash-test:${keySuffix}`,
			`${keyPrefix}:set-test:${keySuffix}`,
			`${keyPrefix}:sorted-set-test:${keySuffix}`
		);

		// Remove all the test keys and disconnect.
		client.del(testKeys, () => {
			client.quit();
			done();
		});
	});

	// Tests:

	describe('Full scan...', function() {
		const scanPattern = `${keyPrefix}:90*:${keySuffix}`;

		it(`Should find 11 keys matching pattern ${scanPattern}`, function(done) {
			scanner.scan(scanPattern, function(err, matchingKeys) {
				if (err) return done(err);

				assert.strictEqual(matchingKeys.length, 11);
				done();
			});
		});
	});

	describe('Full scan with custom count option...', function() {
		const scanPattern = `${keyPrefix}:*20:${keySuffix}`;
		const count = 200;

		it(`Should find 10 keys using count option of ${count} matching pattern ${scanPattern}`, function(done) {
			scanner.scan(scanPattern, {count}, (err, matchingKeys) => {
				if (err) return done(err);

				assert.strictEqual(matchingKeys.length, 10);
				done();
			});
		});
	});

	describe('Full scan with custom type option...', function() {
		const scanPattern = `${keyPrefix}:*:${keySuffix}`;
		const type = 'hash';

		it(`Should find 1 key using type option of ${type} matching pattern ${scanPattern}`, function(done) {
			scanner.scan(scanPattern, {type}, (err, matchingKeys) => {
				if (err) return done(err);

				assert.strictEqual(matchingKeys.length, 1);
				done();
			});
		});
	});

	describe('Full scan with custom limit option...', function() {
		const scanPattern = `${keyPrefix}:*:${keySuffix}`;
		const limit = 5;

		it(`Should find 5 or more keys using a limit of ${limit} matching pattern ${scanPattern}`, function(done) {
			scanner.scan(scanPattern, {limit}, (err, matchingKeys) => {
				if (err) return done(err);

				assert.strictEqual(matchingKeys.length >= 5, true);
				done();
			});
		});
	});

	describe('Full hash scan...', function() {
		const hScanPattern = `${keyPrefix}:90*:${keySuffix}`;

		it(`Should find 22 hash keys and values matching pattern ${hScanPattern}`, function(done) {
			scanner.hscan(`${keyPrefix}:hash-test:${keySuffix}`, hScanPattern, function(err, matches) {
				if (err) return done(err);

				assert.strictEqual(matches.length, 22);
				done();
			})
		});
	});

	describe('Full set scan...', function() {
		const key = `${keyPrefix}:set-test:${keySuffix}`;
		const sScanPattern = `*90*`;

		it(`Should find 11 set values matching pattern ${sScanPattern} inside key ${key}`, function(done) {
			scanner.sscan(key, sScanPattern, function(err, matchingValues) {
				if (err) return done(err);

				assert.strictEqual(matchingValues.length, 20);
				done();
			})
		});
	});

	describe('Full sorted set scan...', function() {
		const key = `${keyPrefix}:sorted-set-test:${keySuffix}`;
		const zScanPattern = `*90*`;

		it(`Should find 40 sorted set values with scores matching pattern ${zScanPattern} inside key ${key}`, function(done) {
			scanner.zscan(key, zScanPattern, function(err, matchingValuesWithScores) {
				if (err) return done(err);

				assert.strictEqual(matchingValuesWithScores.length, 40);
				done();
			})
		});
	});

	describe('Each scan...', function() {
		const scanPattern = `${keyPrefix}:*20:${keySuffix}`;

		it(`Should find 10 keys matching pattern ${scanPattern}`, function(done) {
			scanner.eachScan(scanPattern, (matchingKeys) => {
				// Intentionally do nothing with any matches
			}, (err, matchCount) => {
				if (err) return done(err);

				assert.strictEqual(matchCount, 10);
				done();
			});
		});
	});

	describe('Each scan with custom count option...', function() {
		const scanPattern = `${keyPrefix}:*20:${keySuffix}`;
		const count = 200;

		it(`Should find 10 keys using count option of ${count} matching pattern ${scanPattern}`, function(done) {
			scanner.eachScan(scanPattern, {count}, (matchingKeys) => {
				// Intentionally do nothing with any matches
			}, (err, matchCount) => {
				if (err) return done(err);

				assert.strictEqual(matchCount, 10);
				done();
			});
		});
	});

	describe('Each scan with custom type option...', function() {
		const scanPattern = `${keyPrefix}:*:${keySuffix}`;
		const type = 'hash';

		it(`Should find 1 key using type option of ${type} matching pattern ${scanPattern}`, function(done) {
			scanner.eachScan(scanPattern, {type}, (matchingKeys) => {
				// Intentionally do nothing with any matches
			}, (err, matchCount) => {
				if (err) return done(err);

				assert.strictEqual(matchCount, 1);
				done();
			});
		});
	});

	describe('Each scan with custom limit option...', function() {
		const scanPattern = `${keyPrefix}:*:${keySuffix}`;
		const limit = 5;

		it(`Should find 5 or more keys using a limit of ${limit} matching pattern ${scanPattern}`, function(done) {
			scanner.eachScan(scanPattern, {limit}, (matchingKeys) => {
				// Intentionally do nothing with any matches
			}, (err, matchCount) => {
				if (err) return done(err);

				assert.strictEqual(matchCount >= 5, true);
				done();
			});
		});
	});

	describe('Each scan with cancellation after 1 scan callback...', function() {
		const scanPattern = `${keyPrefix}:*:${keySuffix}`;
		let callbackCount = 0;

		it(`Should cancel after first scan iteration and only call 'eachScanCallback' function parameter one time`, function(done) {
			scanner.eachScan(scanPattern, (matchingKeys) => {
				// Returning `true` to signal cancellation
				callbackCount++;
				return true;
			}, (err, matchCount) => {
				if (err) return done(err);

				assert.strictEqual(callbackCount, 1);
				done();
			});
		});
	});

	describe('Each hash scan...', function() {
		const key = `${keyPrefix}:hash-test:${keySuffix}`;
		const scanPattern = `${keyPrefix}:*20:${keySuffix}`;

		it(`Should find 20 hash keys and values matching pattern ${scanPattern} inside key ${key}`, function(done) {
			scanner.eachHScan(key, scanPattern, (matches) => {
				// Intentionally do nothing with any matches
			}, (err, matchCount) => {
				if (err) return done(err);

				assert.strictEqual(matchCount, 20);
				done();
			});
		});
	});

	describe('Each set scan...', function() {
		const key = `${keyPrefix}:set-test:${keySuffix}`;
		const scanPattern = `*20*`;

		it(`Should find 20 set values matching pattern ${scanPattern} inside key ${key}`, function(done) {
			scanner.eachSScan(key, scanPattern, (matchingValues) => {
				// Intentionally do nothing with any matches
			}, (err, matchCount) => {
				if (err) return done(err);

				assert.strictEqual(matchCount, 20);
				done();
			});
		});
	});

	describe('Each sorted set scan...', function() {
		const key = `${keyPrefix}:sorted-set-test:${keySuffix}`;
		const scanPattern = `*20*`;

		it(`Should find 40 set values with scores matching pattern ${scanPattern} inside key ${key}`, function(done) {
			scanner.eachZScan(key, scanPattern, (matchingValuesWithScores) => {
				// Intentionally do nothing with any matches
			}, (err, matchCount) => {
				if (err) return done(err);

				assert.strictEqual(matchCount, 40);
				done();
			});
		});
	});

	describe('Error on scan...', function() {
		it('Should pass error to callback when connection is closed', function(done) {
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
