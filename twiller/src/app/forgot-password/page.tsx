"use client";

import React, { useState } from "react";
import { ArrowLeft, Mail, Phone, Lock, Copy, Check } from "lucide-react";
import Link from "next/link";
import axiosInstance from "../../lib/axiosInstance";
import TwitterLogo from "../../components/Twitterlogo";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card";
import { Label } from "../../components/ui/label";

export default function ForgotPasswordPage() {
  const [searchKey, setSearchKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState<{ message: string; tempPassword?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchKey.trim()) return;

    setIsLoading(true);
    setError("");
    setSuccessData(null);
    setCopied(false);

    try {
      const res = await axiosInstance.post("/forgot-password", { searchKey: searchKey.trim() });
      setSuccessData(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to initiate password reset. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (successData?.tempPassword) {
      navigator.clipboard.writeText(successData.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col justify-center items-center p-4">
      <Link href="/" className="absolute top-6 left-6 flex items-center text-gray-400 hover:text-white transition-colors">
        <ArrowLeft className="mr-2 h-5 w-5" />
        Back to Home
      </Link>

      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6">
          <TwitterLogo size="xl" className="text-white" />
        </div>

        <Card className="bg-black border border-gray-800 text-white">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-center">Reset password</CardTitle>
            <p className="text-gray-400 text-sm text-center mt-1">
              Enter your registered email or phone number to receive a temporary password.
            </p>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 text-sm mb-4 leading-relaxed">
                {error}
              </div>
            )}

            {!successData ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="searchKey" className="text-white">Email or Phone Number</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                    <Input
                      id="searchKey"
                      type="text"
                      placeholder="Enter registered email or phone"
                      value={searchKey}
                      onChange={(e) => setSearchKey(e.target.value)}
                      className="pl-10 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                      disabled={isLoading}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-full text-base h-12"
                  disabled={isLoading || !searchKey.trim()}
                >
                  {isLoading ? "Generating password..." : "Reset password"}
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="bg-green-950/20 border border-green-800 rounded-lg p-4 text-green-400 text-sm">
                  {successData.message}
                </div>

                {successData.tempPassword && (
                  <div className="space-y-2">
                    <Label className="text-gray-400 text-xs uppercase tracking-wider">Temporary Password</Label>
                    <div className="flex items-center bg-gray-900/50 border border-gray-800 rounded-lg p-3">
                      <Lock className="text-blue-400 mr-2 h-5 w-5" />
                      <span className="font-mono text-lg font-bold flex-1 tracking-wider text-white select-all">
                        {successData.tempPassword}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-white"
                        onClick={handleCopy}
                      >
                        {copied ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                      </Button>
                    </div>
                    <p className="text-xs text-yellow-500 leading-relaxed">
                      ⚠️ Copy this temporary password to log in. You can change it once logged in.
                    </p>
                  </div>
                )}

                <div className="text-center">
                  <Link href="/">
                    <Button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-full text-base h-12">
                      Go to Login
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
