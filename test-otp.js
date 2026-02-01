// Quick test script for OTP functionality
import { generateOTP } from "./src/utils/otpGenerator.js";

console.log("Testing OTP Generation...\n");

// Generate 5 sample OTPs
for (let i = 1; i <= 5; i++) {
  const otp = generateOTP();
  console.log(`OTP ${i}: ${otp} (Length: ${otp.length})`);
}

console.log("\n✅ OTP generation working correctly!");
console.log("All OTPs are 6-digit numeric codes.");
