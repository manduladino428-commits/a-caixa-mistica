import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Lock, Eye } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';
import { DEFAULT_PAYMENT_SETTINGS } from '@/lib/solanaPay';

const TEXTS = {
  en: {
    readingReady: 'Your reading is ready',
    title: 'Premium Reading',
    desc: 'Your personalized mystical reading has been generated. Unlock the full reading — past, present, daily reflection, numerology, and color of the day.',
    past: 'Past',
    present: 'Present',
    dailyReflection: 'Daily Reflection',
    unlockToReveal: 'Unlock to reveal',
    unlockBtn: 'Unlock with USDC (Solana)',
    freePreview: 'Continue with free preview',
    alreadyPaid: 'Already paid? Check payment',
    checking: 'Checking payment…',
    notFound: 'No confirmed payment found yet.',
    invalid: 'Payment not valid, please contact support.',
  },
  pt: {
    readingReady: 'Sua leitura está pronta',
    title: 'Leitura Premium',
    desc: 'Sua leitura mística personalizada foi gerada. Desbloqueie a leitura completa — passado, presente, reflexão do dia, numerologia e cor do dia.',
    past: 'Passado',
    present: 'Presente',
    dailyReflection: 'Reflexão do Dia',
    unlockToReveal: 'Desbloqueie para revelar',
    unlockBtn: 'Desbloquear com USDC (Solana)',
    freePreview: 'Continuar com prévia gratuita',
    alreadyPaid: 'Já pagou? Verificar pagamento',
    checking: 'Verificando pagamento…',
    notFound: 'Nenhum pagamento confirmado ainda.',
    invalid: 'Pagamento inválido, entre em contato com o suporte.',
  },
};

export default function PremiumUnlockScreen({ readingData, stoneName, uploadedImage, paymentSettings, onUnlock, onSkip, onCheckPayment, checkStatus }) {
  const { lang } = useLanguage();
  const t = TEXTS[lang];
  const config = paymentSettings || DEFAULT_PAYMENT_SETTINGS;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto space-y-6">
      {uploadedImage && (
        <div className="flex justify-center">
          <img src={uploadedImage} alt="Your stone" className="w-full max-w-xs h-auto object-contain rounded-lg shadow-md" />
        </div>
      )}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-100 text-purple-800 text-sm font-cinzel mb-3">
          <Sparkles className="w-4 h-4" />{stoneName || t.readingReady}
        </div>
        <h2 className="font-cinzel text-2xl text-gray-900 mb-2">{t.title}</h2>
        <p className="font-garamond text-gray-600 text-sm max-w-md mx-auto">{t.desc}</p>
      </div>
      {readingData && (
        <div className="relative bg-white rounded-xl shadow-md p-6 overflow-hidden">
          <div className="filter blur-sm select-none pointer-events-none space-y-3">
            <div><p className="font-cinzel text-sm text-purple-700 mb-1">{t.past}</p><p className="font-garamond text-gray-700 text-sm line-clamp-2">{readingData.passado}</p></div>
            <div><p className="font-cinzel text-sm text-purple-700 mb-1">{t.present}</p><p className="font-garamond text-gray-700 text-sm line-clamp-2">{readingData.presente}</p></div>
            <div><p className="font-cinzel text-sm text-purple-700 mb-1">{t.dailyReflection}</p><p className="font-garamond text-gray-700 text-sm line-clamp-2">{readingData.reflexao_do_dia}</p></div>
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-white/40 via-white/60 to-white/90 flex flex-col items-center justify-center gap-3">
            <Lock className="w-10 h-10 text-purple-700" />
            <p className="font-cinzel text-sm text-purple-800">{t.unlockToReveal}</p>
          </div>
        </div>
      )}
      <div className="flex flex-col items-center gap-3">
        <button onClick={onUnlock} className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-cinzel font-semibold shadow-lg hover:scale-105 transition-all duration-200">
          <Lock className="w-5 h-5" />{t.unlockBtn}
        </button>
        <p className="font-garamond text-gray-500 text-sm">{config.reading_price_usdc} USDC · Solana blockchain</p>
        {onSkip && (
          <button onClick={onSkip} className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-600 font-garamond text-sm mt-2">
            <Eye className="w-4 h-4" />{t.freePreview}
          </button>
        )}
        {onCheckPayment && (
          <div className="flex flex-col items-center gap-1.5 mt-3">
            <button onClick={onCheckPayment} disabled={checkStatus === 'checking'} className="text-purple-600 hover:text-purple-800 font-garamond text-sm underline disabled:opacity-50">
              {checkStatus === 'checking' ? t.checking : t.alreadyPaid}
            </button>
            {checkStatus === 'not_found' && <span className="font-garamond text-xs text-gray-400">{t.notFound}</span>}
            {checkStatus === 'invalid' && <span className="font-garamond text-xs text-red-400">{t.invalid}</span>}
          </div>
        )}
      </div>
    </motion.div>
  );
}
