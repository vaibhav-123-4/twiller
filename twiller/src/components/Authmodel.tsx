"use client";

import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

import LoadingSpinner from './loading-spinner';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Separator } from './ui/separator';
import { useAuth } from '@/context/AuthContext';
import TwitterLogo from './Twitterlogo';
import { getDeviceDetails, isMobileLoginAllowed } from '@/lib/deviceDetection';
import axiosInstance from '@/lib/axiosInstance';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'signup';
  prefilledOtpEmail?: string;
  showOtpOnOpen?: boolean;
}

export default function AuthModal({ isOpen, onClose, initialMode = 'login', prefilledOtpEmail = "", showOtpOnOpen = false }: AuthModalProps) {
  const { login, signup, isLoading, verifyOtpCode } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    displayName: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Task 3: Google Chrome OTP verification state
  const [showOtpScreen, setShowOtpScreen] = useState(showOtpOnOpen);
  const [otpCode, setOtpCode] = useState("");
  const [otpEmail, setOtpEmail] = useState(prefilledOtpEmail);
  const [otpError, setOtpError] = useState("");

  useEffect(() => {
    if (showOtpOnOpen) {
      setShowOtpScreen(true);
    }
    if (prefilledOtpEmail) {
      setOtpEmail(prefilledOtpEmail);
    }
  }, [showOtpOnOpen, prefilledOtpEmail]);

  if (!isOpen) return null;

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (mode === 'signup') {
      if (!formData.username.trim()) {
        newErrors.username = 'Username is required';
      } else if (formData.username.length < 3) {
        newErrors.username = 'Username must be at least 3 characters';
      } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
        newErrors.username = 'Username can only contain letters, numbers, and underscores';
      }

      if (!formData.displayName.trim()) {
        newErrors.displayName = 'Display name is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || isLoading) return;

    setErrors({});
    setOtpError("");

    // Enforce Mobile Restriction (frontend check)
    const device = getDeviceDetails();
    if (device.deviceCategory === "mobile" && !isMobileLoginAllowed()) {
      setErrors({ general: "Mobile login is restricted. Access is only allowed between 10:00 AM and 1:00 PM IST." });
      return;
    }

    try {
      if (mode === 'login') {
        const res = await login(formData.email, formData.password);
        if (res?.requiresOtp) {
          setOtpEmail(res.email || formData.email);
          setShowOtpScreen(true);
          return;
        }
      } else {
        await signup(formData.email, formData.password, formData.username, formData.displayName);
      }
      onClose();
      setFormData({ email: '', password: '', username: '', displayName: '' });
      setErrors({});
    } catch (error: any) {
      setErrors({ general: error.message || 'Authentication failed. Please try again.' });
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || isLoading) return;

    setOtpError("");
    try {
      await verifyOtpCode(otpEmail, otpCode.trim());
      onClose();
      setShowOtpScreen(false);
      setOtpCode("");
      setFormData({ email: '', password: '', username: '', displayName: '' });
      setErrors({});
    } catch (error: any) {
      setOtpError(error.message || "Invalid OTP code.");
    }
  };

  const handleResendOtp = async () => {
    try {
      setOtpError("");
      await axiosInstance.post("/generate-otp", { email: otpEmail });
      alert("Verification code has been resent to your email.");
    } catch (err: any) {
      setOtpError(err.response?.data?.error || "Failed to resend OTP.");
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setErrors({});
    setFormData({ email: '', password: '', username: '', displayName: '' });
    setShowOtpScreen(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-black border-gray-800 text-white">
        <CardHeader className="relative pb-6">
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 top-4 text-white hover:bg-gray-900"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <TwitterLogo size="xl" className="text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">
              {mode === 'login' ? 'Sign in to X' : 'Create your account'}
            </CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {errors.general && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-3 text-red-400 text-sm">
              {errors.general}
            </div>
          )}

          {showOtpScreen ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otpCode" className="text-white">Enter Verification Code</Label>
                <p className="text-gray-400 text-sm leading-relaxed">
                  We've sent a 6-digit OTP code to your registered email <strong>{otpEmail}</strong> to verify your identity.
                </p>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    id="otpCode"
                    type="text"
                    placeholder="Enter 6-digit OTP"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="pl-10 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500 font-mono tracking-widest text-center text-lg h-12"
                    maxLength={6}
                    disabled={isLoading}
                    required
                  />
                </div>
                {otpError && (
                  <p className="text-red-400 text-sm">{otpError}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-full text-base h-12"
                disabled={isLoading || otpCode.length < 6}
              >
                {isLoading ? "Verifying..." : "Verify Code"}
              </Button>

              <div className="flex justify-between text-sm mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-blue-400 hover:text-blue-300 font-semibold p-0 hover:bg-transparent"
                  onClick={handleResendOtp}
                >
                  Resend OTP
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="text-gray-400 hover:text-white font-semibold p-0 hover:bg-transparent"
                  onClick={() => {
                    setShowOtpScreen(false);
                    setOtpCode("");
                  }}
                >
                  Back to Login
                </Button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="displayName" className="text-white">Display Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                      <Input
                        id="displayName"
                        type="text"
                        placeholder="Your display name"
                        value={formData.displayName}
                        onChange={(e) => handleInputChange('displayName', e.target.value)}
                        className="pl-10 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                        disabled={isLoading}
                      />
                    </div>
                    {errors.displayName && (
                      <p className="text-red-400 text-sm">{errors.displayName}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-white">Username</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">@</span>
                      <Input
                        id="username"
                        type="text"
                        placeholder="username"
                        value={formData.username}
                        onChange={(e) => handleInputChange('username', e.target.value)}
                        className="pl-8 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                        disabled={isLoading}
                      />
                    </div>
                    {errors.username && (
                      <p className="text-red-400 text-sm">{errors.username}</p>
                    )}
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="pl-10 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                    disabled={isLoading}
                  />
                </div>
                {errors.email && (
                  <p className="text-red-400 text-sm">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={(e) => handleInputChange('password', e.target.value)}
                    className="pl-10 pr-10 bg-transparent border-gray-600 text-white placeholder-gray-400 focus:border-blue-500"
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {errors.password && (
                  <p className="text-red-400 text-sm">{errors.password}</p>
                )}
                {mode === 'login' && (
                  <div className="text-right">
                    <Link
                      href="/forgot-password"
                      className="text-xs text-blue-400 hover:underline hover:text-blue-300"
                      onClick={onClose}
                    >
                      Forgot password?
                    </Link>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 rounded-full text-lg"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center space-x-2 justify-center">
                    <LoadingSpinner size="sm" />
                    <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                  </div>
                ) : (
                  mode === 'login' ? 'Sign in' : 'Create account'
                )}
              </Button>
            </form>
          )}

          <div className="relative">
            <Separator className="bg-gray-700" />
            <span className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black px-2 text-gray-400 text-sm">
              OR
            </span>
          </div>

          <div className="text-center">
            <p className="text-gray-400">
              {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
              <Button
                variant="link"
                className="text-blue-400 hover:text-blue-300 font-semibold pl-1"
                onClick={switchMode}
                disabled={isLoading}
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </Button>
            </p>
          </div>

          {mode === 'signup' && (
            <div className="text-center text-xs text-gray-400">
              By signing up, you agree to our Terms of Service and Privacy Policy, including Cookie Use.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}