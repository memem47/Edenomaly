// Run: node --experimental-default-type=module --test tests/starvation-balance.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {acquiredSizeMaintenance,feedingCapacity,lifeDrain} from '../web/simulation.js';

test('adult size upkeep remains a cost, but feeding capacity can fund it',()=>{
 const normal={growthScale:1},large={growthScale:3.8};
 assert.equal(acquiredSizeMaintenance(normal),0);
 assert.ok(acquiredSizeMaintenance(large)>acquiredSizeMaintenance({growthScale:2}));
 // Old cubic upkeep exceeded 100 energy/tick at growthScale 3.8,
 // more than a full bite could ever replenish.
 assert.ok(acquiredSizeMaintenance(large)<25);
 assert.ok(feedingCapacity(large)>feedingCapacity(normal));
});
test('starvation HP loss is reserved for genuine energy shortage',()=>{
 assert.equal(lifeDrain({energy:80}),0);
 assert.equal(lifeDrain({energy:65}),0);
 assert.ok(lifeDrain({energy:0})>lifeDrain({energy:40}));
});
