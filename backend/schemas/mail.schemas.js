import { z } from "zod";

export const sendMailSchema = z.object({
  to: z
    .string({ required_error: "Recipient email address is required" })
    .trim()
    .email({ message: "Please provide a valid recipient email address" })
    .max(255, { message: "Email address cannot exceed 255 characters" }),
  subject: z
    .string({ required_error: "Subject is required" })
    .trim()
    .min(1, { message: "Subject cannot be empty" })
    .max(250, { message: "Subject cannot exceed 250 characters" }),
  message: z
    .string({ required_error: "Message content is required" })
    .trim()
    .min(1, { message: "Message content cannot be empty" })
    .max(10000, { message: "Message content cannot exceed 10,000 characters" }),
  recipientName: z.string().trim().max(100).optional(),
  tripTitle: z.string().trim().max(150).optional(),
  tripId: z.string().trim().optional(),
});
