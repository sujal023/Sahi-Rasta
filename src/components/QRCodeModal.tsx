import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, Share2, X, ExternalLink } from 'lucide-react';
import { GaliRoute } from '../types/route';

interface QRCodeModalProps {
  route: GaliRoute;
  isOpen: boolean;
  onClose: () => void;
  lang?: 'en' | 'hi';
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ route, isOpen, onClose, lang = 'en' }) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/?route=${route.slug || route.id}`
    : `https://galiguide.app/r/${route.slug || route.id}`;

  useEffect(() => {
    if (isOpen && shareUrl) {
      QRCode.toDataURL(shareUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('Error generating QR code', err));
    }
  }, [isOpen, shareUrl]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleWhatsAppShare = () => {
    const text = lang === 'hi'
      ? `*${route.title}* पहुँचने के लिए गली गाइड का सटीक रास्ता:\n${route.startLandmark.name} से शुरू करें और नीले बिंदु का पालन करें।\n\nसीधा लिंक खोलें: ${shareUrl}`
      : `*Navigation to ${route.title}* via Gali Guide:\nStart at ${route.startLandmark.name} and follow the exact host path.\n\nOpen link: ${shareUrl}`;

    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center">
          <span className="text-xs font-semibold text-orange-600 uppercase tracking-wider">
            {lang === 'hi' ? 'शेयर और क्यूआर कोड' : 'Share & QR Code'}
          </span>
          <h3 className="text-lg font-bold text-slate-900 mt-1 line-clamp-1">{route.title}</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {lang === 'hi' ? 'आगंतुक बिना ऐप डाउनलोड किए लिंक खोल सकते हैं' : 'Visitors open directly without app install'}
          </p>
        </div>

        {/* QR Code Container */}
        <div className="my-5 flex flex-col items-center justify-center p-3 bg-slate-50 rounded-xl border border-slate-200">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="Route QR Code" className="w-52 h-52 rounded-lg shadow-xs" />
          ) : (
            <div className="w-52 h-52 flex items-center justify-center text-xs text-slate-400">
              Generating QR...
            </div>
          )}
          <p className="text-[11px] text-slate-500 mt-2 font-mono text-center">
            Scan to navigate with live GPS
          </p>
        </div>

        {/* Share buttons */}
        <div className="space-y-2.5">
          <button
            onClick={handleWhatsAppShare}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md transition-colors active:scale-[0.99]"
          >
            <Share2 className="w-4 h-4" />
            {lang === 'hi' ? 'व्हाट्सएप पर शेयर करें' : 'Share on WhatsApp'}
          </button>

          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="flex-1 text-xs bg-slate-100 border border-slate-200 rounded-lg px-3 py-2.5 text-slate-600 font-mono select-all focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 py-2.5 px-3 rounded-lg border border-slate-300 hover:bg-slate-100 text-xs font-semibold text-slate-700 transition-colors shrink-0"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? (lang === 'hi' ? 'कॉपी हो गया' : 'Copied!') : (lang === 'hi' ? 'कॉपी' : 'Copy')}
            </button>
          </div>

          <a
            href={shareUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 py-1 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {lang === 'hi' ? 'नया टैब में खोलें' : 'Preview visitor view in new tab'}
          </a>
        </div>
      </div>
    </div>
  );
};
