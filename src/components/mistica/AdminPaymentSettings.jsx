import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Loader2, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/LanguageContext';
import { fetchPaymentSettings } from '@/lib/solanaPay';

const TEXTS = {
  en: {
    title: 'Payment Settings',
    paywallLabel: 'Paywall enabled (USDC payment required)',
    paywallHint: 'When off, the full reading is shown for free with no lock.',
    priceLabel: 'Reading price (USDC)',
    save: 'Save',
    saving: 'Saving…',
    saved: 'Saved!',
    error: 'Failed to save settings.',
  },
  pt: {
    title: 'Configurações de Pagamento',
    paywallLabel: 'Paywall ativo (pagamento USDC obrigatório)',
    paywallHint: 'Quando desligado, a leitura completa é mostrada gratuitamente sem bloqueio.',
    priceLabel: 'Preço da leitura (USDC)',
    save: 'Salvar',
    saving: 'Salvando…',
    saved: 'Salvo!',
    error: 'Falha ao salvar configurações.',
  },
};

export default function AdminPaymentSettings() {
  const { lang } = useLanguage();
  const t = TEXTS[lang];
  const [settings, setSettings] = useState(null);
  const [recordId, setRecordId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetchPaymentSettings().then((s) => {
      setSettings({ ...s, paywall_enabled: s.paywall_enabled !== false });
      base44.entities.PaymentSettings.filter({}, { limit: 1 })
        .then(({ items }) => { if (items && items.length > 0) setRecordId(items[0].id); })
        .catch(() => {});
    });
  }, []);

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-purple-700" />
      </div>
    );
  }

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const data = {
        paywall_enabled: settings.paywall_enabled,
        reading_price_usdc: settings.reading_price_usdc,
        recipient_wallet: settings.recipient_wallet,
        recipient_usdc_account: settings.recipient_usdc_account,
        usdc_mint: settings.usdc_mint,
        rpc_url: settings.rpc_url,
        label: settings.label,
      };
      if (recordId) {
        await base44.entities.PaymentSettings.update(recordId, data);
      } else {
        const created = await base44.entities.PaymentSettings.create(data);
        if (created?.id) setRecordId(created.id);
      }
      setStatus('saved');
    } catch (err) {
      console.error(err);
      setStatus('error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl shadow-sm p-6 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Settings className="w-5 h-5 text-purple-700" />
        <h2 className="font-cinzel text-xl text-purple-900">{t.title}</h2>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
          <div>
            <p className="font-cinzel text-gray-800">{t.paywallLabel}</p>
            <p className="font-garamond text-gray-500 text-sm">{t.paywallHint}</p>
          </div>
          <button
            onClick={() => setSettings(prev => ({ ...prev, paywall_enabled: !prev.paywall_enabled }))}
            className={`relative w-14 h-7 rounded-full transition-colors flex-shrink-0 ${settings.paywall_enabled ? 'bg-purple-700' : 'bg-gray-300'}`}
            aria-label={t.paywallLabel}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${settings.paywall_enabled ? 'translate-x-7' : ''}`} />
          </button>
        </div>
        <div>
          <label className="font-garamond text-gray-600 text-sm block mb-1">{t.priceLabel}</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={settings.reading_price_usdc}
            onChange={(e) => setSettings(prev => ({ ...prev, reading_price_usdc: parseFloat(e.target.value) || 0 }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md font-garamond text-gray-800"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-purple-700 text-white font-cinzel hover:bg-purple-800 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? t.saving : t.save}
          </button>
          {status === 'saved' && <span className="font-garamond text-green-600 text-sm">{t.saved}</span>}
          {status === 'error' && <span className="font-garamond text-red-500 text-sm">{t.error}</span>}
        </div>
      </div>
    </motion.div>
  );
}
