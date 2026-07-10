import mongoose from "mongoose";
const UserSchema = mongoose.Schema({
  username: { type: String, required: true },
  displayName: { type: String, required: true },
  avatar: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  bio: { type: String, default: "" },
  location: { type: String, default: "" },
  website: { type: String, default: "" },
  joinedDate: { type: Date, default: Date.now() },
  phoneNumber: { type: String, default: "" },
  subscriptionPlan: { type: String, default: "Free" },
  lastPasswordResetRequest: { type: Date, default: null },
  tempPassword: { type: String, default: "" },
  loginHistory: [
    {
      browser: String,
      os: String,
      deviceCategory: String,
      ipAddress: String,
      timestamp: { type: Date, default: Date.now }
    }
  ],
  currentOTP: { type: String, default: "" },
  otpExpires: { type: Date, default: null }
});

export default mongoose.model("User", UserSchema);
