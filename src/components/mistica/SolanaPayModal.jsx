import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, CheckCircle2, AlertCircle, ExternalLink, Wallet } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { generateReference, buildSolanaPayUrl, verifyPayment, generateExpectedAmountRaw, rawToUsdc, DEFAULT_PAYMENT_SETTINGS } from '@/lib/solanaPay';

const SolanaPaymentEntity = base44.entities.SolanaPayment;

const TEXTS = {
  en: {
    title: 'Pay with USDC on Solana',
    subtitle: 'Premium Reading Unlock',
    scanWith: 'Scan with Phantom or any Solana wallet',
    openInPhantom: 'Open in Phantom',
    waiting: 'Waiting for payment…',
    confirmed: 'Payment confirmed on Solana ✨',
    unlocking: 'Unlocking your premium reading…',
    viewTx: 'View transaction',
    expired: 'Payment expired',
    expiredDesc: 'The payment window has closed. Please try again.',
    close: 'Close',
    invalid: 'Payment not valid',
    invalidDesc: 'Payment not valid, please contact support',
  },
  pt: {
    title: 'Pague com USDC na Solana',
    subtitle: 'Desbloqueio de Leitura Premium',
    scanWith: 'Escaneie com Phantom ou qualquer carteira Solana',
    openInPhantom: 'Abrir no Phantom',
    waiting: 'Aguardando pagamento…',
    confirmed: 'Pagamento confirmado na Solana ✨',
    unlocking: 'Desbloqueando sua leitura premium…',
    viewTx: 'Ver transação',
    expired: 'Pagamento expirado',
    expiredDesc: 'A janela de pagamento foi fechada. Tente novamente.',
    close: 'Fechar',
    invalid: 'Pagamento inválido',
    invalidDesc: 'Pagamento inválido, entre em contato com o suporte',
  },
};

export default function SolanaPayModal({ isOpen, onClose, settings, userEmail, readingId, onConfirmed }) {
  const { lang } = useLanguage();
  const t = TEXTS[lang];
  const [payUrl, setPayUrl] = useState(null);
  const [status, setStatus] = useState('waiting');
  const [txSignature, setTxSignature] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [displayAmount, setDisplayAmount] = useState(null);
  const pollRef = useRef(null);
  const recordIdRef = useRef(null);

  const config = settings || DEFAULT_PAYMENT_SETTINGS;
  const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setStatus('waiting');
    setTxSignature(null);
    setErrorMsg(null)
    recordIdRef.current = null;
    const startTime = Date.now();

    const ref = generateReference();
    const expectedRaw = generateExpectedAmountRaw(config.reading_price_usdc);
    setDisplayAmount(rawToUsdc(expectedRaw));
    setPayUrl(buildSolanaPayUrl(config, ref, expectedRaw));
    const paymentInfo = { reference: ref, expected_amount_raw: expectedRaw, amount_usdc: config.reading_price_usdc, created_date: new Date(startTime).toISOString() };

    SolanaPaymentEntity.create({ reference: ref, user_email: userEmail || null, reading_id: readingId || null, amount_usdc: config.reading_price_usdc, expected_amount_raw: expectedRaw, status: 'pending' })
      .then((record) => { if (record && record.id) recordIdRef.current = record.id; })
      .catch((err) => console.error('Failed to create payment record:', err));

    const updateRecord = (data) => { if (recordIdRef.current) SolanaPaymentEntity.update(recordIdRef.current, data).catch(() => {}); };

    const poll = async () => {
      if (cancelled) return;
      if (Date.now() - startTime > 10 * 60 * 1000) { setStatus('expired'); updateRecord({ status: 'expired' }); return; }
      try {
        const result = await verifyPayment(config, { ...paymentInfo, id: recordIdRef.current });
        if (result.status === 'confirmed') {
          setStatus('confirmed'); setTxSignature(result.signature);
          updateRecord({ status: 'confirmed', tx_signature: result.signature, confirmed_date: new Date().toISOString() });
          return;
        }
        if (result.status === 'invalid') { setStatus('invalid'); setErrorMsg(t.invalidDesc); return; }
      } catch (err) { console.error('Polling error:', err); }
      pollRef.current = setTimeout(poll, 3000);
    };
    pollRef.current = setTimeout(poll, 3000);
    return () => { cancelled = true; if (pollRef.current) clearTimeout(pollRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (status === 'confirmed' && txSignature) {
      const t2 = setTimeout(() => { onConfirmed && onConfirmed(txSignature); }, 2500);
      return () => clearTimeout(t2);
    }
  }, [status, txSignature, onConfirmed]);

  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="relative bg-gradient-to-br from-purple-900 to-indigo-900 px-6 py-5 text-white">
          <button onClick={onClose} className="absolute right-3 top-3 text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
          <div className="flex items-center gap-2 mb-1"><Wallet className="w-5 h-5 text-amber-300" /><h2 className="font-cinzel text-lg font-semibold">{t.title}</h2></div>
          <p className="font-garamond text-white/70 text-sm">{t.subtitle}</p>
        </div>
        <div className="p-6 space-y-4">
          {status === 'waiting' && (
            <>
              <div className="text-center">
                <p className="font-cinzel text-2xl text-gray-900">{displayAmount || config.reading_price_usdc} <span className="text-base text-gray-500">USDC</span></p>
                <p className="font-garamond text-gray-500 text-sm mt-1">{t.scanWith}</p>
              </div>
              <div className="flex justify-center p-4 bg-white rounded-xl border-2 border-gray-100">
                {payUrl ? <QRCodeSVG value={payUrl} size={220} level="M" /> : <div className="w-[220px] h-[220px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600" /></div>}
              </div>
              {isMobile && payUrl && <a href={payUrl} className="block w-full text-center py-3 rounded-xl bg-purple-700 text-white font-cinzel font-semibold hover:bg-purple-800 transition-colors">{t.openInPhantom}</a>}
              <div className="flex items-center justify-center gap-2 text-gray-500"><Loader2 className="w-4 h-4 animate-spin" /><span className="font-garamond text-sm">{t.waiting}</span></div>
            </>
          )}
          {status === 'confirmed' && (
            <div className="text-center py-6 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto" />
              <p className="font-cinzel text-xl text-gray-900">{t.confirmed}</p>
              <p className="font-garamond text-gray-500 text-sm">{t.unlocking}</p>
              {txSignature && <a href={`https://solscan.io/tx/${txSignature}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-purple-700 hover:text-purple-900 font-garamond text-sm">{t.viewTx} <ExternalLink className="w-3.5 h-3.5" /></a>}
            </div>
          )}
          {status === 'expired' && (
            <div className="text-center py-6 space-y-4">
              <AlertCircle className="w-14 h-14 text-amber-500 mx-auto" />
              <p className="font-cinzel text-lg text-gray-900">{t.expired}</p>
              <p className="font-garamond text-gray-500 text-sm">{t.expiredDesc}</p>
              <button onClick={onClose} className="px-6 py-2 rounded-xl bg-purple-700 text-white font-cinzel text-sm hover:bg-purple-800 transition-colors">{t.close}</button>
            </div>
          )}
          {status === 'invalid' && (
            <div className="text-center py-6 space-y-4">
              <AlertCircle className="w-14 h-14 text-red-500 mx-auto" />
              <p className="font-cinzel text-lg text-gray-900">{t.invalid}</p>
              <p className="font-garamond text-gray-500 text-sm">{errorMsg || t.invalidDesc}</p>
              <button onClick={onClose} className="px-6 py-2 rounded-xl bg-purple-700 text-white font-cinzel text-sm hover:bg-purple-800 transition-colors">{t.close}</button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
