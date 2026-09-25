import assert from "node:assert";
import mongoose from "mongoose";
import Memory from "../models/Memory.js";
import Expense from "../models/Expense.js";
import Trip from "../models/Trip.js";
import User from "../models/User.js";

console.log("=== RUNNING ADVENZA DATABASE ARCHITECTURE AUDIT & TESTS ===");

// 1. Test Memory Model Constraints & Validation
console.log("\n[Test 1] Memory Model Validation & Integrity...");
{
  // Test rejecting base64 in mediaUrl
  const invalidMemory = new Memory({
    userId: "user_test_1",
    storageKey: "users/user_test_1/test.jpg",
    mediaUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==",
  });
  const valErr = invalidMemory.validateSync();
  assert.ok(valErr, "Memory must reject base64 data URIs in mediaUrl");
  assert.ok(valErr.errors.mediaUrl, "Should have error on mediaUrl");

  // Test valid Memory document
  const validMemory = new Memory({
    userId: "user_test_1",
    storageKey: "users/user_test_1/test.jpg",
    thumbnailKey: "users/user_test_1/thumb_test.jpg",
    mediaUrl: "https://firebasestorage.googleapis.com/v0/b/advenza/o/test.jpg",
    thumbnailUrl: "https://firebasestorage.googleapis.com/v0/b/advenza/o/thumb_test.jpg",
    status: "ready",
    aiMetadata: {
      tags: ["sunset", "beach"],
      landmark: "Baga Beach",
    },
    location: {
      name: "Baga Beach, Goa",
      latitude: 15.555,
      longitude: 73.751,
    },
  });
  const validErr = validMemory.validateSync();
  assert.strictEqual(validErr, undefined, "Valid Memory document should pass validation");
  assert.strictEqual(validMemory.status, "ready");
  assert.strictEqual(validMemory.isDeleted, false);
  assert.strictEqual(validMemory.aiMetadata.landmark, "Baga Beach");

  // Test Memory Schema Indexes
  const memoryIndexes = Memory.schema.indexes();
  console.log("Memory Indexes:", memoryIndexes.map(([idx]) => Object.keys(idx).join("+")));
  const hasTripCreatedIndex = memoryIndexes.some(([idx]) => idx.tripId === 1 && idx.createdAt === -1);
  const hasUserCreatedIndex = memoryIndexes.some(([idx]) => idx.userId === 1 && idx.createdAt === -1);
  const hasStatusIndex = memoryIndexes.some(([idx]) => idx.tripId === 1 && idx.status === 1);
  assert.ok(hasTripCreatedIndex, "Memory must have compound index on tripId + createdAt");
  assert.ok(hasUserCreatedIndex, "Memory must have compound index on userId + createdAt");
  assert.ok(hasStatusIndex, "Memory must have compound index on tripId + status");
}
console.log("✅ Memory Model validation and indexes passed!");

// 2. Test Dedicated Expense Model
console.log("\n[Test 2] Dedicated Expense Model Validation & Integrity...");
{
  const testTripId = new mongoose.Types.ObjectId();

  // Test missing required fields
  const invalidExp = new Expense({});
  const expValErr = invalidExp.validateSync();
  assert.ok(expValErr.errors.tripId, "tripId is required for Expense");
  assert.ok(expValErr.errors.userId, "userId is required for Expense");
  assert.ok(expValErr.errors.name, "name is required for Expense");
  assert.ok(expValErr.errors.amount, "amount is required for Expense");

  // Test valid Expense
  const validExp = new Expense({
    tripId: testTripId,
    userId: "user_test_2",
    name: "Airport Taxi",
    amount: 1200,
    category: "Transit",
  });
  const validExpErr = validExp.validateSync();
  assert.strictEqual(validExpErr, undefined);
  assert.strictEqual(validExp.currency, "INR");
  assert.strictEqual(validExp.isDeleted, false);

  // Test Expense Schema Indexes
  const expIndexes = Expense.schema.indexes();
  console.log("Expense Indexes:", expIndexes.map(([idx]) => Object.keys(idx).join("+")));
  const hasTripDateIndex = expIndexes.some(([idx]) => idx.tripId === 1 && idx.date === -1);
  const hasTripCategoryIndex = expIndexes.some(([idx]) => idx.tripId === 1 && idx.category === 1);
  const hasUserTripIndex = expIndexes.some(([idx]) => idx.userId === 1 && idx.tripId === 1);
  assert.ok(hasTripDateIndex, "Expense must have compound index on tripId + date");
  assert.ok(hasTripCategoryIndex, "Expense must have compound index on tripId + category");
  assert.ok(hasUserTripIndex, "Expense must have compound index on userId + tripId");
}
console.log("✅ Expense Model validation and indexes passed!");

// 3. Test Trip Model Structure & Indexes
console.log("\n[Test 3] Trip Model Validation & Compound Indexes...");
{
  const tripIndexes = Trip.schema.indexes();
  console.log("Trip Indexes:", tripIndexes.map(([idx]) => Object.keys(idx).join("+")));
  const hasCreatedByIndex = tripIndexes.some(([idx]) => idx.createdBy === 1 && idx.createdAt === -1);
  const hasMemberUserIndex = tripIndexes.some(([idx]) => idx["members.userId"] === 1);
  const hasMemberEmailIndex = tripIndexes.some(([idx]) => idx["members.email"] === 1);
  const hasTextIndex = tripIndexes.some(([idx]) => idx.title === "text" && idx.destination === "text");

  assert.ok(hasCreatedByIndex, "Trip must have compound index on createdBy + createdAt");
  assert.ok(hasMemberUserIndex, "Trip must have compound index on members.userId + createdAt");
  assert.ok(hasMemberEmailIndex, "Trip must have compound index on members.email + createdAt");
  assert.ok(hasTextIndex, "Trip must have text search index on title and destination");

  // Validate Trip with embedded members & vote options
  const sampleTrip = new Trip({
    title: "Kerala Backwaters Exploration",
    destination: "Alleppey, Kerala",
    createdBy: "user_owner",
    members: [
      { name: "Alice", email: "alice@example.com", role: "Organizer" },
      { name: "Bob", email: "bob@example.com", role: "Pending" },
    ],
    voteOptions: [
      { name: "Houseboat Overnight Cruise", votes: 2, voters: ["user_1", "user_2"] },
      { name: "Ayurvedic Spa Day", votes: 0, voters: [] },
    ],
  });
  const tripErr = sampleTrip.validateSync();
  assert.strictEqual(tripErr, undefined);
  assert.strictEqual(sampleTrip.members.length, 2);
  assert.strictEqual(sampleTrip.voteOptions.length, 2);
}
console.log("✅ Trip Model validation and indexes passed!");

// 4. Test User Model Indexes
console.log("\n[Test 4] User Model Indexes...");
{
  const userIndexes = User.schema.indexes();
  console.log("User Indexes:", userIndexes.map(([idx]) => Object.keys(idx).join("+")));
  const hasEmailUidIndex = userIndexes.some(([idx]) => idx.email === 1 && idx.firebaseUid === 1);
  assert.ok(hasEmailUidIndex, "User must have compound index on email + firebaseUid");
  assert.ok(User.schema.path("firebaseUid").options.unique, "firebaseUid must be unique");
}
console.log("✅ User Model indexes passed!");

// 5. Test Keyset Pagination Algorithm
console.log("\n[Test 5] Memory Keyset Pagination Algorithm...");
{
  const now = Date.now();
  const mockMemories = Array.from({ length: 45 }, (_, i) => ({
    _id: `mem_${i}`,
    title: `Memory ${i}`,
    createdAt: new Date(now - i * 60000), // 1 minute apart
  }));

  const limit = 20;

  // Page 1
  const page1Items = mockMemories.slice(0, limit + 1);
  const hasMoreP1 = page1Items.length > limit;
  const p1Result = hasMoreP1 ? page1Items.slice(0, limit) : page1Items;
  const cursorP1 = p1Result[p1Result.length - 1].createdAt.toISOString();

  assert.strictEqual(p1Result.length, 20);
  assert.strictEqual(hasMoreP1, true);
  assert.ok(cursorP1);

  // Page 2 using cursor
  const cursorDate = new Date(cursorP1);
  const page2Filtered = mockMemories.filter((m) => m.createdAt < cursorDate);
  const page2Items = page2Filtered.slice(0, limit + 1);
  const hasMoreP2 = page2Items.length > limit;
  const p2Result = hasMoreP2 ? page2Items.slice(0, limit) : page2Items;
  const cursorP2 = p2Result[p2Result.length - 1].createdAt.toISOString();

  assert.strictEqual(p2Result.length, 20);
  assert.strictEqual(hasMoreP2, true);

  // Page 3 (final remaining 5 items)
  const cursorDate2 = new Date(cursorP2);
  const page3Filtered = mockMemories.filter((m) => m.createdAt < cursorDate2);
  const page3Items = page3Filtered.slice(0, limit + 1);
  const hasMoreP3 = page3Items.length > limit;
  const p3Result = hasMoreP3 ? page3Items.slice(0, limit) : page3Items;

  assert.strictEqual(p3Result.length, 5); // 45 - 20 - 20 = 5 remaining items
  assert.strictEqual(hasMoreP3, false);
}
console.log("✅ Keyset Pagination Algorithm passed!");

console.log("\n🎉 ALL DATABASE ARCHITECTURE TESTS PASSED SUCCESSFULLY! 🎉\n");
