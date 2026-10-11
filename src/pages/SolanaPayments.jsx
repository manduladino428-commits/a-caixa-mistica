import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Lock, ArrowLeft, ExternalLink, Wallet, RefreshCw, Copy } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { verifyPayment, fetchPaymentSettings, rawToUsdc } from '@/lib/solanaPay';
import { useAuth } from '@/lib/AuthContext';
import { Link } from 'react-router-dom';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  expired: 'bg-gray-200 text-gray-600',
};

export default function SolanaPayments() {
  const { user: ctxUser, isLoadingAuth } = useAuth();
  const [currentUser, setCurrentUser] = useState(ctxUser);
  const [checkingAuth, setCheckingAuth] = useState(!ctxUser);
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [reverifyingId, setReverifyingId] = useState(null);

  useEffect(() => {
    if (!ctxUser) {
      base44.auth.me()
        .then((u) => setCurrentUser(u))
        .catch(() => setCurrentUser(null))
        .finally(() => setCheckingAuth(false));
    }
  }, [ctxUser]);

  const isAdmin = currentUser && currentUser.role === 'admin';

  useEffect(() => {
    if (!isAdmin) return;
    loadPayments();
  }, [isAdmin]);

  const loadPayments = async () => {
    try {
      setLoading(true);
      const { items } = await base44.entities.SolanaPayment.filter(
        {},
        { sort: '-created_date', limit: 100 }
      );
      setPayments(items);
    } catch (err) {
      console.error('Failed to load payments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReverify = async (payment) => {
    setReverifyingId(payment.id);
    try {
      const settings = await fetchPaymentSettings();
      const result = await verifyPayment(settings, payment);
      if (result.status === 'confirmed') {
        await base44.entities.SolanaPayment.update(payment.id, {
          status: 'confirmed',
          tx_signature: result.signature,
          confirmed_date: new Date().toISOString(),
        });
      }
      await loadPayments();
    } catch (err) {
      console.error('Re-verify failed:', err);
    } finally {
      setReverifyingId(null);
    }
  };

  if (isLoadingAuth || checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-purple-700" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
        <Lock className="w-16 h-16 text-purple-700 mb-4" />
        <h1 className="font-cinzel text-2xl text-purple-900 mb-2">Access restricted</h1>
        <p className="font-garamond text-gray-600 mb-6">This area is for administrators only.</p>
        <Link to="/" className="inline-flex items-center gap-2 text-purple-700 hover:text-purple-900 font-garamond">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-5xl mx-auto py-6">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-2">
          <Wallet className="w-6 h-6 text-purple-700" />
          <h1 className="font-cinzel text-3xl text-purple-900">Solana Payments</h1>
        </div>
        <p className="font-garamond text-gray-600">All USDC payment records</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-700" />
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-12">
          <p className="font-garamond text-gray-500">No payments yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-purple-50 text-left">
                  <th className="px-4 py-3 font-cinzel text-sm text-purple-900">Date</th>
                  <th className="px-4 py-3 font-cinzel text-sm text-purple-900">User</th>
                  <th className="px-4 py-3 font-cinzel text-sm text-purple-900">Amount</th>
                  <th className="px-4 py-3 font-cinzel text-sm text-purple-900">Reference</th>
                  <th className="px-4 py-3 font-cinzel text-sm text-purple-900">Status</th>
                  <th className="px-4 py-3 font-cinzel text-sm text-purple-900">Transaction</th>
                  <th className="px-4 py-3 font-cinzel text-sm text-purple-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-garamond text-sm text-gray-600 whitespace-nowrap">
                      {new Date(p.created_date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-garamond text-sm text-gray-600">
                      {p.user_email || '—'}
                    </td>
                    <td className="px-4 py-3 font-garamond text-sm text-gray-600">
                      {p.expected_amount_raw ? rawToUsdc(p.expected_amount_raw) : p.amount_usdc} USDC
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs text-gray-500" title={p.reference}>
                          {p.reference ? `${p.reference.slice(0, 4)}…${p.reference.slice(-4)}` : '—'}
                        </span>
                        {p.reference && (
                          <button
                            onClick={() => navigator.clipboard?.writeText(p.reference)}
                            className="text-gray-400 hover:text-purple-700"
                            title="Copy reference"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2.5 py-1 rounded-full text-xs font-cinzel ${
                          STATUS_STYLES[p.status] || 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.tx_signature ? (
                        <a
                          href={`https://solscan.io/tx/${p.tx_signature}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-900 font-garamond text-sm"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="font-garamond text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {(p.status === 'pending' || p.status === 'expired') && (
                        <button
                          onClick={() => handleReverify(p)}
                          disabled={reverifyingId === p.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-100 text-purple-700 text-xs font-cinzel hover:bg-purple-200 disabled:opacity-50 transition-colors"
                        >
                          {reverifyingId === p.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3 h-3" />
                          )}
                          Re-verify
                        </button>
                      )}
                    </td>
                    </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-center mt-8">
        <button
          onClick={loadPayments}
          className="inline-flex items-center gap-2 px-6 py-2 rounded-lg bg-purple-700 text-white font-garamond hover:bg-purple-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>
    </motion.div>
  );
}
