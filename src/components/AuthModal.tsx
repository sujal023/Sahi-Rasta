import React, { useState } from 'react';
import { KeyRound, Phone, ShieldCheck, UserCheck, X } from 'lucide-react';
import { sendOtpApi, verifyOtpApi } from '../utils/api';
import { HostUser } from '../types/route';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: HostUser) => void;
  lang?: 'en' | 'hi';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess, lang = 'en' }) => {
  const [phone, setPhone] = useState<string>('9810123456');
  const [name, setName] = useState<string>('Rajesh Sharma');
  const [otp, setOtp] = useState<string>('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [demoCodeHint, setDemoCodeHint] = useState<string>('');

  if (!isOpen) return null;

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      setError(lang === 'hi' ? 'कृपया मान्य 10 अंकों का फोन नंबर दर्ज करें' : 'Please enter a valid 10-digit phone number');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const fullPhone = phone.startsWith('+91') ? phone : `+91 ${phone.replace(/\D/g, '')}`;
      const res = await sendOtpApi(fullPhone);
      if (res.success) {
        setDemoCodeHint(res.testOtp || '123456');
        setOtp(res.testOtp || '123456');
        setStep('otp');
      } else {
        setError(res.message || 'Failed to send OTP');
      }
    } catch {
      setStep('otp');
      setDemoCodeHint('123456');
      setOtp('123456');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length < 4) {
      setError(lang === 'hi' ? 'कृपया 6 अंकों का OTP दर्ज करें' : 'Please enter the 6-digit OTP code');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const fullPhone = phone.startsWith('+91') ? phone : `+91 ${phone.replace(/\D/g, '')}`;
      const res = await verifyOtpApi(fullPhone, otp, name);
      if (res.success && res.user) {
        onSuccess(res.user);
        onClose();
      } else {
        setError(res.error || 'Verification failed. Try 123456');
      }
    } catch {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 mb-4">
          <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {lang === 'hi' ? 'मेज़बान साइन इन' : 'Host Sign In'}
            </h3>
            <p className="text-xs text-slate-500">
              {lang === 'hi' ? 'फोन नंबर और OTP से लॉगिन करें' : 'Phone Number & OTP (Fast & Secure)'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'hi' ? 'आपका नाम' : 'Host Name'}
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sharma Ji / Rajesh"
                className="w-full text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {lang === 'hi' ? 'मोबाइल नंबर (भारत)' : 'Mobile Phone Number (+91)'}
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 text-sm font-semibold text-slate-400">+91</span>
                <input
                  type="tel"
                  value={phone.replace(/^\+91\s*/, '')}
                  onChange={e => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="98101 23456"
                  className="w-full text-sm border border-slate-300 rounded-xl pl-13 pr-3.5 py-2.5 font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {lang === 'hi' ? 'हम तुरंत एक 6-अंकीय सत्यापन कोड भेजेंगे' : 'We will send a 6-digit SMS verification code'}
              </p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm shadow-md transition-colors flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
            >
              <Phone className="w-4 h-4" />
              {loading
                ? (lang === 'hi' ? 'भेज रहा है...' : 'Sending OTP...')
                : (lang === 'hi' ? 'OTP प्राप्त करें' : 'Send Verification OTP')}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  {lang === 'hi' ? '6-अंकीय OTP कोड' : 'Enter 6-Digit OTP Code'}
                </label>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-xs text-orange-600 hover:underline"
                >
                  {lang === 'hi' ? 'नंबर बदलें' : 'Change Phone'}
                </button>
              </div>

              <div className="relative">
                <input
                  type="text"
                  maxLength={6}
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full text-center tracking-widest text-xl font-bold font-mono border border-slate-300 rounded-xl py-3 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  required
                  autoFocus
                />
              </div>

              {demoCodeHint && (
                <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-800 flex items-center justify-between">
                  <span>Demo OTP code: <strong>{demoCodeHint}</strong></span>
                  <button
                    type="button"
                    onClick={() => setOtp(demoCodeHint)}
                    className="text-xs font-bold underline ml-2"
                  >
                    Auto Fill
                  </button>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm shadow-md transition-colors flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50"
            >
              <KeyRound className="w-4 h-4" />
              {loading
                ? (lang === 'hi' ? 'सत्यापित हो रहा है...' : 'Verifying...')
                : (lang === 'hi' ? 'सत्यापित करें और आगे बढ़ें' : 'Verify & Continue')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
