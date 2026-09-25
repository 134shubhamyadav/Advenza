import mongoose from "mongoose";
import Memory from "../models/Memory.js";
import { config } from "../config/env.js";

async function check() {
  await mongoose.connect(config.MONGODB_URI);
  const docs = await Memory.find({}).lean();
  console.log("Total memories in DB:", docs.length);
  docs.forEach((doc, i) => {
    console.log(
      `[${i + 1}] id: ${doc._id}, place: ${JSON.stringify(doc.place)}, mediaUrl: ${doc.mediaUrl?.substring(0, 30)}, tripId: ${doc.tripId}`
    );
  });
  await mongoose.disconnect();
}
check().catch(console.error);
