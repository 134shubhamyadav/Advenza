import mongoose from "mongoose";
import Trip from "../models/Trip.js";
import { config } from "../config/env.js";
import { fetchDestinationImage } from "../services/media/destination-image.service.js";

async function testTripDestinationChange() {
  await mongoose.connect(config.MONGODB_URI);
  console.log("Connected to MongoDB Atlas");

  // 1. Create a trip with destination Varanasi
  const varanasiImage = await fetchDestinationImage("Varanasi");
  const trip = new Trip({
    title: "Sacred Ghats Tour",
    destination: "Varanasi",
    createdBy: "test_user_dest",
    heroImage: varanasiImage,
  });
  const savedTrip = await trip.save();
  console.log("Created trip:", savedTrip._id);
  console.log("Initial destination:", savedTrip.destination);
  console.log("Initial heroImage destination:", savedTrip.heroImage.destination);
  console.log("Initial heroImage URL:", savedTrip.heroImage.url.substring(0, 80));

  // 2. Simulate editing destination to Nashik
  const prevDest = savedTrip.destination;
  const newDest = "Nashik";
  savedTrip.destination = newDest;

  if (newDest.toLowerCase().trim() !== prevDest.toLowerCase().trim() || !savedTrip.heroImage?.url) {
    savedTrip.heroImage = await fetchDestinationImage(newDest);
  }
  const updatedTrip = await savedTrip.save();

  console.log("\nAfter destination edit to Nashik:");
  console.log("Updated destination:", updatedTrip.destination);
  console.log("Updated heroImage destination:", updatedTrip.heroImage.destination);
  console.log("Updated heroImage URL:", updatedTrip.heroImage.url.substring(0, 80));

  const changed = updatedTrip.heroImage.destination === "Nashik" && updatedTrip.heroImage.url !== varanasiImage.url;
  console.log("\nDestination change verified:", changed ? "SUCCESS!" : "FAILED!");

  // Cleanup
  await Trip.findByIdAndDelete(savedTrip._id);
  console.log("Cleaned up test trip");
  await mongoose.disconnect();
}

testTripDestinationChange().catch(console.error);
