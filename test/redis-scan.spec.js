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
	let testValues = [];
	let testKeysValues = [];

	// We want a unique key suffix to let us avoid touching any other
	// objects stored in this Redis database.
	const keySuffix = uuidv4();
	const keyPrefix = 'redis-scan-test';

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

				assert.equal(matchingKeys.length, 11);
				done();
			});
		});
	});

	describe('Full hash scan...', function() {
		const hScanPattern = `${keyPrefix}:90*:${keySuffix}`;

		it(`Should find 22 hash keys and values matching pattern ${hScanPattern}`, function(done) {
			scanner.hscan(`${keyPrefix}:hash-test:${keySuffix}`, hScanPattern, function(err, matches) {
				if (err) return done(err);

				assert.equal(matches.length, 22);
				done();
			})
		});
	});

	describe('Full set scan...', function() {
		const sScanPattern = `*90*`;

		it(`Should find 11 set values matching pattern ${sScanPattern}`, function(done) {
			scanner.sscan(`${keyPrefix}:set-test:${keySuffix}`, sScanPattern, function(err, matchingValues) {
				if (err) return done(err);

				assert.equal(matchingValues.length, 20);
				done();
			})
		});
	});

	describe('Full sorted set scan...', function() {
		const zScanPattern = `*90*`;

		it(`Should find 40 sorted set values with scores matching pattern ${zScanPattern}`, function(done) {
			scanner.zscan(`${keyPrefix}:sorted-set-test:${keySuffix}`, zScanPattern, function(err, matchingValuesWithScores) {
				if (err) return done(err);

				assert.equal(matchingValuesWithScores.length, 40);
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

				assert.equal(matchCount, 10);
				done();
			});
		});
	});

	describe('Each scan with custom COUNT option...', function() {
		const scanPattern = `${keyPrefix}:*20:${keySuffix}`;

		it(`Should find 10 keys using count options of 200 matching pattern ${scanPattern}`, function(done) {
			scanner.eachScan(scanPattern, {count: 200}, (matchingKeys) => {
				// Intentionally do nothing with any matches
			}, (err, matchCount) => {
				if (err) return done(err);

				assert.equal(matchCount, 10);
				done();
			});
		});
	});

	describe('Each hash scan...', function() {
		const scanPattern = `${keyPrefix}:*20:${keySuffix}`;

		it(`Should find 20 hash keys and values matching pattern ${scanPattern}`, function(done) {
			scanner.eachHScan(`${keyPrefix}:hash-test:${keySuffix}`, scanPattern, (matches) => {
				// Intentionally do nothing with any matches
			}, (err, matchCount) => {
				if (err) return done(err);

				assert.equal(matchCount, 20);
				done();
			});
		});
	});

	describe('Each set scan...', function() {
		const scanPattern = `*20*`;

		it(`Should find 20 set values matching pattern ${scanPattern}`, function(done) {
			scanner.eachSScan(`${keyPrefix}:set-test:${keySuffix}`, scanPattern, (matchingValues) => {
				// Intentionally do nothing with any matches
			}, (err, matchCount) => {
				if (err) return done(err);

				assert.equal(matchCount, 20);
				done();
			});
		});
	});

	describe('Each sorted set scan...', function() {
		const scanPattern = `*20*`;

		it(`Should find 40 set values with scores matching pattern ${scanPattern}`, function(done) {
			scanner.eachZScan(`${keyPrefix}:sorted-set-test:${keySuffix}`, scanPattern, (matchingValuesWithScores) => {
				// Intentionally do nothing with any matches
			}, (err, matchCount) => {
				if (err) return done(err);

				assert.equal(matchCount, 40);
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
