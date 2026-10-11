import React from 'react';
import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import { useLanguage } from '@/lib/LanguageContext';

const TEXTS = {
  en: {
    title: 'Unlock your full reading',
    desc: 'Present, Daily Reflection, Number and Color of the Day',
    btn: 'Unlock with USDC (Solana)',
  },
  pt: {
    title: 'Desbloqueie sua leitura completa',
    desc: 'Presente, Reflexão do Dia, Número e Cor do Dia',
    btn: 'Desbloquear com USDC (Solana)',
  },
};

export default function FreePreviewUnlockCard({ onUnlock, priceUsdc }) {
  const { lang } = useLanguage();
  const t = TEXTS[lang];
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-2xl mx-auto">
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 rounded-xl p-6 text-center space-y-4 shadow-md">
        <div className="w-14 h-14 rounded-full bg-purple-700 flex items-center justify-center mx-auto">
          <Lock className="w-7 h-7 text-white" />
        </div>
        <h3 className="font-cinzel text-xl text-purple-900">{t.title}</h3>
        <p className="font-garamond text-gray-600">{t.desc}</p>
        <button
          onClick={onUnlock}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-gradient-to-r from-purple-700 to-indigo-700 text-white font-cinzel font-semibold shadow-lg hover:scale-105 transition-all duration-200"
        >
          <Lock className="w-5 h-5" />{t.btn}
        </button>
        {priceUsdc != null && <p className="font-garamond text-gray-500 text-sm">{priceUsdc} USDC · Solana</p>}
      </div>
    </motion.div>
  );
}
