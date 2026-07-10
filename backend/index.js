import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import User from "./models/user.js";
import Tweet from "./models/tweet.js";

dotenv.config();

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Helper: Get current date in IST
const getISTDate = () => {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (3600000 * 5.5)); // IST is UTC+5.5
};

// Helper: Parse User-Agent for Browser, OS, and Device Category
const parseUserAgent = (userAgentString) => {
  let browser = "Other";
  let os = "Other";
  let deviceCategory = "desktop";

  const ua = userAgentString || "";

  // OS Detection
  if (/windows/i.test(ua)) os = "Windows";
  else if (/macintosh|mac os x/i.test(ua)) os = "macOS";
  else if (/android/i.test(ua)) os = "Android";
  else if (/iphone|ipad|ipod/i.test(ua)) os = "iOS";
  else if (/linux/i.test(ua)) os = "Linux";

  // Browser Detection
  const isMicrosoft = /edg|edge|trident|msie/i.test(ua);
  const isChrome = /chrome|crios/i.test(ua) && !isMicrosoft;
  const isSafari = /safari/i.test(ua) && !isChrome && !isMicrosoft;
  const isFirefox = /firefox|fxios/i.test(ua);

  if (isMicrosoft) browser = "Microsoft Browser";
  else if (isChrome) browser = "Google Chrome";
  else if (isSafari) browser = "Safari";
  else if (isFirefox) browser = "Firefox";

  // Device Category Detection
  const isMobile = /mobile|android|iphone|ipod/i.test(ua);
  if (isMobile) {
    deviceCategory = "mobile";
  } else {
    deviceCategory = "desktop";
  }

  return { browser, os, deviceCategory };
};

// Helper: Get SMTP Transporter (Ethereal test accounts generated if not configured)
let transporter;
const getTransporter = async () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log("✉️ Ethereal Email test account created:", testAccount.user);
    } catch (err) {
      console.error("❌ Failed to create ethereal test email account, logging emails to console instead.");
      transporter = {
        sendMail: async (mailOptions) => {
          console.log("====== MOCK EMAIL SENT ======");
          console.log("To:", mailOptions.to);
          console.log("Subject:", mailOptions.subject);
          console.log("Body:", mailOptions.html || mailOptions.text);
          console.log("=============================");
          return { messageId: "mock-id-" + Math.random().toString() };
        }
      };
    }
  }
  return transporter;
};

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Twiller backend is running successfully");
});

const port = process.env.PORT || 5000;
const url = process.env.MONOGDB_URL;

mongoose
  .connect(url)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(port, () => {
      console.log(`🚀 Server running on port ${port}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });

//Register
app.post("/register", async (req, res) => {
  try {
    const existinguser = await User.findOne({ email: req.body.email });
    if (existinguser) {
      return res.status(200).send(existinguser);
    }
    const newUser = new User(req.body);
    await newUser.save();
    return res.status(201).send(newUser);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// loggedinuser
app.get("/loggedinuser", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).send({ error: "Email required" });
    }
    const user = await User.findOne({ email: email });
    return res.status(200).send(user);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// update Profile
app.patch("/userupdate/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const updated = await User.findOneAndUpdate(
      { email },
      { $set: req.body },
      { new: true, upsert: false }
    );
    return res.status(200).send(updated);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// Tweet API

// POST
app.post("/post", async (req, res) => {
  try {
    const { author } = req.body;
    if (!author) {
      return res.status(400).send({ error: "Author required" });
    }
    const user = await User.findById(author);
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    // Count current tweets by this author
    const tweetCount = await Tweet.countDocuments({ author });

    const plan = user.subscriptionPlan || "Free";
    let allowed = 1;
    if (plan === "Bronze") allowed = 3;
    else if (plan === "Silver") allowed = 5;
    else if (plan === "Gold") allowed = Infinity;

    if (tweetCount >= allowed) {
      return res.status(403).send({
        error: `Posting limit reached. Under the ${plan} Plan, you are allowed up to ${allowed} tweet${allowed === 1 ? "" : "s"}. Please upgrade your subscription.`
      });
    }

    const tweet = new Tweet(req.body);
    await tweet.save();
    const populatedTweet = await Tweet.findById(tweet._id).populate("author");
    return res.status(201).send(populatedTweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// get all tweet
app.get("/post", async (req, res) => {
  try {
    const tweet = await Tweet.find().sort({ timestamp: -1 }).populate("author");
    return res.status(200).send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
//  LIKE TWEET
app.post("/like/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (!tweet.likedBy.includes(userId)) {
      tweet.likes += 1;
      tweet.likedBy.push(userId);
      await tweet.save();
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});
// retweet 
app.post("/retweet/:tweetid", async (req, res) => {
  try {
    const { userId } = req.body;
    const tweet = await Tweet.findById(req.params.tweetid);
    if (!tweet.retweetedBy.includes(userId)) {
      tweet.retweets += 1;
      tweet.retweetedBy.push(userId);
      await tweet.save();
    }
    res.send(tweet);
  } catch (error) {
    return res.status(400).send({ error: error.message });
  }
});

// Task 1: Create Stripe Checkout Session or Mock Session
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { planName, price, email, bypassTimeCheck } = req.body;

    // Time restriction check: 10:00 AM - 11:00 AM IST
    const istDate = getISTDate();
    const hours = istDate.getHours();
    
    const isTimeValid = hours === 10;
    const shouldBypass = bypassTimeCheck || process.env.BYPASS_TIME_CHECK === "true";

    if (!isTimeValid && !shouldBypass) {
      return res.status(403).send({
        error: "Transactions restricted. Payments are allowed only between 10:00 AM and 11:00 AM IST."
      });
    }

    // Mock gateway if stripe is not configured or mock is requested
    if (!stripe || req.body.mockPayment) {
      return res.status(200).send({
        id: "mock_session_" + Math.random().toString(36).substr(2, 9),
        url: `/payment-success?session_id=mock_${planName}_${price}&email=${email}&plan=${planName}&price=${price}`,
        isMock: true
      });
    }

    // Otherwise use real Stripe
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "inr",
            product_data: {
              name: `${planName} Plan Subscription`,
            },
            unit_amount: price * 100, // Stripe expects amount in paise (INR cents)
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/payment-success?session_id={CHECKOUT_SESSION_ID}&email=${email}&plan=${planName}&price=${price}`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:3000"}/profile`,
      customer_email: email,
    });

    res.status(200).send({ id: session.id, url: session.url });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Verify and finalize payment
app.post("/verify-payment", async (req, res) => {
  try {
    const { session_id, email, plan, price } = req.body;
    if (!email) {
      return res.status(400).send({ error: "Email is required" });
    }

    // Time restriction check: 10:00 AM - 11:00 AM IST
    const istDate = getISTDate();
    const hours = istDate.getHours();
    const isTimeValid = hours === 10;
    const shouldBypass = process.env.BYPASS_TIME_CHECK === "true" || session_id.startsWith("mock");

    if (!isTimeValid && !shouldBypass) {
      return res.status(403).send({
        error: "Transactions restricted. Payments are allowed only between 10:00 AM and 11:00 AM IST."
      });
    }

    let finalPlan = plan;
    let finalPrice = price;

    if (session_id.startsWith("mock")) {
      const parts = session_id.split("_");
      finalPlan = parts[1] || plan;
      finalPrice = parts[2] || price;
    } else if (stripe) {
      const session = await stripe.checkout.sessions.retrieve(session_id);
      if (session.payment_status !== "paid") {
        return res.status(400).send({ error: "Payment not completed" });
      }
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    user.subscriptionPlan = finalPlan;
    await user.save();

    // Send Invoice Email via NodeMailer
    const transporter = await getTransporter();
    const invoiceId = "INV-" + Math.floor(100000 + Math.random() * 900000);
    const mailOptions = {
      from: '"Twiller Billing" <billing@twiller.com>',
      to: email,
      subject: `Your Twiller Invoice - ${finalPlan} Plan Upgrade`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #ffffff; color: #333333;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #1DA1F2; margin: 0;">Twiller Premium</h1>
            <p style="color: #888888; font-size: 14px; margin: 5px 0 0 0;">INVOICE OF PAYMENT</p>
          </div>
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
          <p>Hello <strong>${user.displayName}</strong> (@${user.username}),</p>
          <p>Thank you for your purchase! Your subscription plan has been successfully upgraded.</p>
          
          <div style="background-color: #f7f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 6px 0; color: #666666; font-size: 14px;">Invoice Number</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right; font-size: 14px;">${invoiceId}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #666666; font-size: 14px;">Subscription Plan</td>
                <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #1DA1F2; font-size: 14px;">${finalPlan} Plan</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #666666; font-size: 14px;">Billing Cycle</td>
                <td style="padding: 6px 0; text-align: right; font-size: 14px;">Monthly</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #666666; font-size: 14px;">Payment Gateway</td>
                <td style="padding: 6px 0; text-align: right; font-size: 14px;">${session_id.startsWith("mock") ? "Mock Sandbox" : "Stripe"}</td>
              </tr>
              <tr style="border-top: 1px solid #dddddd;">
                <td style="padding: 10px 0 0 0; font-weight: bold; font-size: 16px;">Amount Paid</td>
                <td style="padding: 10px 0 0 0; font-weight: bold; text-align: right; color: #2e7d32; font-size: 18px;">₹${finalPrice}</td>
              </tr>
            </table>
          </div>
          
          <p>Under the <strong>${finalPlan} Plan</strong>, your tweet limit has been increased. Enjoy the platform!</p>
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
          <p style="color: #888888; font-size: 12px; text-align: center; margin: 0;">This email serves as an official receipt. If you have questions, please reach out to support.</p>
        </div>
      `
    };

    transporter.sendMail(mailOptions).then(info => {
      console.log("Invoice email sent:", info.messageId);
      if (info.messageId && info.messageId.includes("ethereal")) {
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
      }
    }).catch(err => {
      console.error("Failed to send invoice email:", err);
    });

    res.status(200).send({ success: true, plan: finalPlan, user });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Task 2: Forgot Password Recovery
app.post("/forgot-password", async (req, res) => {
  try {
    const { searchKey } = req.body;
    if (!searchKey) {
      return res.status(400).send({ error: "Email or Phone number is required" });
    }

    const user = await User.findOne({
      $or: [{ email: searchKey }, { phoneNumber: searchKey }]
    });

    if (!user) {
      return res.status(404).send({ error: "No user found with the registered email or phone number." });
    }

    // Rate-limit check: Once per calendar day (IST)
    const now = getISTDate();
    if (user.lastPasswordResetRequest) {
      const lastRequest = new Date(user.lastPasswordResetRequest);
      const lastRequestIST = new Date(lastRequest.getTime() + (lastRequest.getTimezoneOffset() * 60000) + (3600000 * 5.5));
      
      const isSameDay = 
        now.getFullYear() === lastRequestIST.getFullYear() &&
        now.getMonth() === lastRequestIST.getMonth() &&
        now.getDate() === lastRequestIST.getDate();

      if (isSameDay) {
        return res.status(429).send({ error: "You can use this option only one time per day." });
      }
    }

    // Password Generator: random password using only uppercase/lowercase letters
    const generatePassword = (length = 10) => {
      const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
      let pass = "";
      for (let i = 0; i < length; i++) {
        pass += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return pass;
    };

    const tempPass = generatePassword(10);
    user.tempPassword = tempPass;
    user.lastPasswordResetRequest = new Date();
    await user.save();

    // Send temp password via NodeMailer
    const transporter = await getTransporter();
    const mailOptions = {
      from: '"Twiller Security" <accounts@twiller.com>',
      to: user.email,
      subject: "Temporary Account Password Recovery",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #ffffff; color: #333333;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #1DA1F2; margin: 0;">Account Password Reset</h2>
          </div>
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
          <p>Hello <strong>${user.displayName}</strong>,</p>
          <p>We received a request to recover your account. Below is your letters-only temporary password:</p>
          
          <div style="font-size: 24px; font-weight: bold; background-color: #f0f8ff; border: 1px dashed #1DA1F2; text-align: center; padding: 15px; margin: 20px 0; color: #333; letter-spacing: 2px; border-radius: 8px;">
            ${tempPass}
          </div>
          
          <p style="color: #b71c1c; font-weight: bold; font-size: 14px;">Security Notice:</p>
          <ul style="color: #555555; font-size: 14px; padding-left: 20px;">
            <li>Please use this temporary password to log in and update your password immediately.</li>
            <li>You can initiate this password recovery process only once per day.</li>
          </ul>
          
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
          <p style="color: #888888; font-size: 12px; text-align: center; margin: 0;">If you did not request a password reset, please ignore this email or secure your account.</p>
        </div>
      `
    };

    transporter.sendMail(mailOptions).then(info => {
      console.log("Password recovery email sent:", info.messageId);
      if (info.messageId && info.messageId.includes("ethereal")) {
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
      }
    }).catch(err => {
      console.error("Failed to send password recovery email:", err);
    });

    res.status(200).send({
      success: true,
      message: "Temporary password generated and sent to your registered email.",
      tempPassword: tempPass
    });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Task 3: Generate OTP for Google Chrome Users
app.post("/generate-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).send({ error: "Email is required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    user.currentOTP = otp;
    user.otpExpires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await user.save();

    // Send OTP via email
    const transporter = await getTransporter();
    const mailOptions = {
      from: '"Twiller Security" <security@twiller.com>',
      to: email,
      subject: "Your Twiller Login Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px; background-color: #ffffff; color: #333333;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #1DA1F2; margin: 0;">Verification Code Required</h2>
            <p style="color: #888888; font-size: 14px; margin: 5px 0 0 0;">TWO-FACTOR AUTHENTICATION</p>
          </div>
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
          <p>Hello <strong>${user.displayName}</strong>,</p>
          <p>We detected a login attempt from a Google Chrome browser. To confirm your identity, please enter the following verification code:</p>
          
          <div style="font-size: 32px; font-weight: bold; text-align: center; color: #1DA1F2; letter-spacing: 5px; margin: 20px 0; background-color: #f7f9fa; padding: 15px; border-radius: 8px;">
            ${otp}
          </div>
          
          <p style="color: #666666; font-size: 13px;">This verification code is valid for 5 minutes. If you did not attempt to sign in, please update your security settings immediately.</p>
          <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
          <p style="color: #888888; font-size: 12px; text-align: center; margin: 0;">This is a security notification from Twiller.</p>
        </div>
      `
    };

    transporter.sendMail(mailOptions).then(info => {
      console.log("OTP verification email sent:", info.messageId);
      if (info.messageId && info.messageId.includes("ethereal")) {
        console.log("Preview URL:", nodemailer.getTestMessageUrl(info));
      }
    }).catch(err => {
      console.error("Failed to send OTP email:", err);
    });

    res.status(200).send({ success: true, message: "OTP verification code sent." });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Task 3: Verify OTP
app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).send({ error: "Email and OTP are required" });
    }
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    if (!user.currentOTP || user.currentOTP !== otp) {
      return res.status(400).send({ error: "Invalid verification code." });
    }

    if (user.otpExpires && new Date() > user.otpExpires) {
      return res.status(400).send({ error: "Verification code has expired." });
    }

    // Clear OTP
    user.currentOTP = "";
    user.otpExpires = null;
    await user.save();

    res.status(200).send({ success: true, message: "Verification successful." });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// Task 3: Record login history and enforce Mobile time restrictions
app.post("/login-history", async (req, res) => {
  try {
    const { email, clientDeviceCategory } = req.body;
    if (!email) {
      return res.status(400).send({ error: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }

    // Parse User-Agent
    const userAgent = req.headers["user-agent"] || "";
    const parsedUA = parseUserAgent(userAgent);

    // Use client-detected device category if provided (laptop vs desktop vs mobile),
    // otherwise default to User-Agent parsed value
    const finalDeviceCategory = clientDeviceCategory || parsedUA.deviceCategory;

    // IP Address detection
    let ipAddress = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
    if (typeof ipAddress === "string") {
      ipAddress = ipAddress.split(",")[0].trim();
    }
    // Clean IPv6 loopback
    if (ipAddress === "::1" || ipAddress === "::ffff:127.0.0.1") {
      ipAddress = "127.0.0.1";
    }

    // Mobile Time window restriction: 10:00 AM - 1:00 PM IST
    if (finalDeviceCategory === "mobile") {
      const istDate = getISTDate();
      const hours = istDate.getHours();
      const isTimeValid = hours >= 10 && hours < 13;
      const shouldBypass = process.env.BYPASS_TIME_CHECK === "true";

      if (!isTimeValid && !shouldBypass) {
        return res.status(403).send({
          error: "Mobile access blocked. Login from mobile devices is restricted to 10:00 AM - 1:00 PM IST."
        });
      }
    }

    // Add session to user's history
    user.loginHistory.unshift({
      browser: parsedUA.browser,
      os: parsedUA.os,
      deviceCategory: finalDeviceCategory,
      ipAddress: ipAddress,
      timestamp: new Date()
    });

    if (user.loginHistory.length > 50) {
      user.loginHistory = user.loginHistory.slice(0, 50);
    }

    await user.save();
    res.status(200).send({ success: true, loginHistory: user.loginHistory });
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});