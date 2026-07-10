"use client";

import React, { useState, useEffect } from "react";
import { X, Check, ShieldAlert, Sparkles, CreditCard, HelpCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import axiosInstance from "@/lib/axiosInstance";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { getISTTimeDetails, isPaymentWindowOpen } from "@/lib/deviceDetection";

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SubscriptionModal({ isOpen, onClose }: SubscriptionModalProps) {
  const { user, updateProfile } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [timeDetails, setTimeDetails] = useState({ formattedTime: "", hours: 0 });
  const [bypassTime, setBypassTime] = useState(false);
  const [isWindowOpen, setIsWindowOpen] = useState(false);

  useEffect(() => {
    // Update IST clock every 5 seconds
    const updateTime = () => {
      const details = getISTTimeDetails();
      setTimeDetails({ formattedTime: details.formattedTime, hours: details.hours });
      setIsWindowOpen(isPaymentWindowOpen());
    };
    updateTime();
    const interval = setInterval(updateTime, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!isOpen || !user) return null;

  const handleUpgrade = async (planName: string, price: number, useMock: boolean = true) => {
    setLoadingPlan(planName);
    try {
      // 1. Time restrictions check on frontend
      const activeWindow = isWindowOpen || bypassTime;
      if (!activeWindow) {
        alert(`Transaction Denied: Payments are restricted to the 10:00 AM - 11:00 AM IST time window. Current IST time is ${timeDetails.formattedTime}.`);
        setLoadingPlan(null);
        return;
      }

      // 2. Request backend checkout session
      const checkoutRes = await axiosInstance.post("/create-checkout-session", {
        planName,
        price,
        email: user.email,
        mockPayment: useMock,
        bypassTimeCheck: bypassTime
      });

      if (useMock) {
        // Simulated payment workflow
        const verifyRes = await axiosInstance.post("/verify-payment", {
          session_id: checkoutRes.data.id,
          email: user.email,
          plan: planName,
          price
        });

        if (verifyRes.data.success) {
          alert(`🎉 Payment Successful! Upgraded to ${planName} Plan. An invoice has been sent to ${user.email}.`);
          // Refresh context state
          if (user) {
            user.subscriptionPlan = planName;
            localStorage.setItem("twitter-user", JSON.stringify(user));
            // Trigger profile reload/update
            window.location.reload();
          }
          onClose();
        }
      } else {
        // Stripe redirect workflow
        if (checkoutRes.data.url) {
          window.location.href = checkoutRes.data.url;
        }
      }
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.error || "Payment checkout failed. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  };

  const currentPlan = user.subscriptionPlan || "Free";

  const plans = [
    {
      name: "Free",
      price: 0,
      limit: "1 Tweet total limit",
      features: ["Custom profile customization", "Basic search", "Standard posting speed"],
      color: "border-gray-800 bg-transparent text-white",
      badge: "border-gray-700 text-gray-400 bg-gray-900"
    },
    {
      name: "Bronze",
      price: 100,
      limit: "Up to 3 Tweets limit",
      features: ["3 posts posting limit", "Verified-lite badge option", "Basic support replies"],
      color: "border-amber-800/60 bg-gradient-to-b from-amber-950/20 to-black text-white",
      badge: "border-amber-700/50 text-amber-500 bg-amber-950/30"
    },
    {
      name: "Silver",
      price: 300,
      limit: "Up to 5 Tweets limit",
      features: ["5 posts posting limit", "Silver premium badge", "Priority support replies", "Media rich posting"],
      color: "border-slate-500/60 bg-gradient-to-b from-slate-900/20 to-black text-white",
      badge: "border-slate-400/50 text-slate-300 bg-slate-950/30"
    },
    {
      name: "Gold",
      price: 1000,
      limit: "Unlimited Tweets",
      features: ["Unlimited tweeting limits", "Exclusive Gold verification check", "Premium support access", "Custom font styles"],
      color: "border-yellow-500/60 bg-gradient-to-b from-yellow-950/20 to-black text-white",
      badge: "border-yellow-400/50 text-yellow-500 bg-yellow-950/30"
    }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-black border border-gray-800 rounded-2xl relative my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <Sparkles className="h-6 w-6 text-blue-500" />
            <h2 className="text-2xl font-bold text-white">Upgrade Subscription Plan</h2>
          </div>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Time Alert banner */}
        <div className="mx-6 mt-6 bg-blue-950/30 border border-blue-900/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="h-5 w-5 text-blue-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-white">Controlled Transaction Policy</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Payments are only allowed between <strong>10:00 AM and 11:00 AM IST</strong>. 
                Current IST Time: <span className="font-mono font-bold text-blue-400">{timeDetails.formattedTime}</span>.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3 self-stretch sm:self-auto justify-between">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              isWindowOpen 
                ? "bg-green-950/30 border-green-800 text-green-500" 
                : "bg-red-950/30 border-red-800 text-red-500"
            }`}>
              {isWindowOpen ? "Transaction Window Open" : "Transaction Window Closed"}
            </span>

            {/* Developer Test Bypass Toggle */}
            <label className="flex items-center space-x-2 cursor-pointer bg-gray-900 px-3 py-1 border border-gray-800 rounded-full hover:bg-gray-800 transition-colors">
              <input
                type="checkbox"
                checked={bypassTime}
                onChange={() => setBypassTime(!bypassTime)}
                className="rounded border-gray-700 text-blue-600 focus:ring-blue-500 bg-black h-3 w-3"
              />
              <span className="text-[10px] text-gray-400 font-bold select-none">Bypass Time Limit (Test Mode)</span>
            </label>
          </div>
        </div>

        {/* Plans list */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {plans.map((p) => {
            const isActive = currentPlan.toLowerCase() === p.name.toLowerCase();
            return (
              <Card key={p.name} className={`flex flex-col border ${p.color} relative overflow-hidden h-full shadow-lg`}>
                {isActive && (
                  <div className="absolute top-0 right-0 bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                    Current
                  </div>
                )}
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${p.badge}`}>
                      {p.name} Plan
                    </span>
                  </div>
                  <CardTitle className="text-3xl font-bold mt-3 text-white">
                    ₹{p.price}
                    <span className="text-xs text-gray-400 font-normal">/mo</span>
                  </CardTitle>
                  <CardDescription className="text-xs font-semibold text-blue-400 mt-1">
                    {p.limit}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1 pb-6">
                  <ul className="space-y-2">
                    {p.features.map((f, idx) => (
                      <li key={idx} className="flex items-start text-xs text-gray-300">
                        <Check className="h-4 w-4 text-green-500 mr-2 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="pt-0 border-t border-gray-900/50 p-4 flex flex-col gap-2">
                  {p.price === 0 ? (
                    <Button 
                      className="w-full border-gray-800 bg-transparent text-gray-500 cursor-not-allowed" 
                      disabled
                    >
                      Default Plan
                    </Button>
                  ) : isActive ? (
                    <Button 
                      className="w-full bg-blue-600/30 border-blue-500/50 text-blue-400 cursor-not-allowed" 
                      disabled
                    >
                      Active Plan
                    </Button>
                  ) : (
                    <>
                      <Button
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs h-9 rounded-full flex items-center justify-center gap-1.5"
                        disabled={loadingPlan !== null || (!isWindowOpen && !bypassTime)}
                        onClick={() => handleUpgrade(p.name, p.price, true)}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        {loadingPlan === p.name ? "Processing..." : "Sandbox Pay"}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full border-gray-800 hover:bg-gray-900 text-white font-semibold text-xs h-9 rounded-full flex items-center justify-center gap-1.5"
                        disabled={loadingPlan !== null || (!isWindowOpen && !bypassTime)}
                        onClick={() => handleUpgrade(p.name, p.price, false)}
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Stripe Pay
                      </Button>
                    </>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
