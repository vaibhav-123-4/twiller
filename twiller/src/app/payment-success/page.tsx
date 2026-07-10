"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CheckCircle, ShieldAlert, Loader2, Home } from "lucide-react";
import Link from "next/link";
import axiosInstance from "../../lib/axiosInstance";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";

export default function PaymentSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const sessionId = searchParams.get("session_id");
  const email = searchParams.get("email");
  const plan = searchParams.get("plan");
  const price = searchParams.get("price");

  useEffect(() => {
    const verifyPayment = async () => {
      if (!sessionId || !email) {
        setError("Missing payment details.");
        setVerifying(false);
        return;
      }

      try {
        const res = await axiosInstance.post("/verify-payment", {
          session_id: sessionId,
          email,
          plan,
          price
        });

        if (res.data.success) {
          // Update local storage user details
          const localUserStr = localStorage.getItem("twitter-user");
          if (localUserStr) {
            const localUser = JSON.parse(localUserStr);
            localUser.subscriptionPlan = res.data.plan;
            localStorage.setItem("twitter-user", JSON.stringify(localUser));
          }
          setSuccess(true);
        } else {
          setError("Failed to verify payment status.");
        }
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.error || "Error verifying payment.");
      } finally {
        setVerifying(false);
      }
    };

    verifyPayment();
  }, [sessionId, email, plan, price]);

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center p-4">
      <Card className="w-full max-w-md bg-black border border-gray-800 text-white text-center">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex flex-col items-center gap-3">
            {verifying ? (
              <>
                <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
                <span>Verifying Payment...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle className="h-12 w-12 text-green-500" />
                <span className="text-green-500">Payment Successful!</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-12 w-12 text-red-500" />
                <span className="text-red-500">Verification Failed</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {verifying && (
            <p className="text-gray-400 text-sm">
              Please wait while we confirm your transaction details with the payment gateway.
            </p>
          )}

          {success && (
            <div className="space-y-4">
              <p className="text-gray-300 text-sm">
                Your subscription has been successfully upgraded to the <strong>{plan} Plan</strong>. 
                A receipt/invoice has been sent to your email <strong>{email}</strong>.
              </p>
              <Button
                onClick={() => {
                  // reload and redirect to profile
                  window.location.href = "/";
                }}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-full text-base h-12"
              >
                Go to Profile
              </Button>
            </div>
          )}

          {error && (
            <div className="space-y-4">
              <p className="text-red-400 text-sm bg-red-900/20 border border-red-800 rounded-lg p-3">
                {error}
              </p>
              <Link href="/">
                <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-full text-base h-12">
                  Return to App
                </Button>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
