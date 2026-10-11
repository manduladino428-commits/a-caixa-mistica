import { base44 } from '@/api/base44Client';

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function base58Encode(bytes) {
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  let num = BigInt(0);
  for (let i = 0; i < bytes.length; i++) {
    num = num * BigInt(256) + BigInt(bytes[i]);
  }

  let encoded = '';
  while (num > 0) {
    const remainder = num % BigInt(58);
    num = num / BigInt(58);
    encoded = BASE58_ALPHABET[Number(remainder)] + encoded;
  }

  return '1'.repeat(zeros) + encoded;
}

export function generateReference() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base58Encode(bytes);
}

export const DEFAULT_PAYMENT_SETTINGS = {
  recipient_wallet: '2N9DPs4QrwFGpZxFmovA42ZpV5ZNK1sarRohAT7ZPmrb',
  recipient_usdc_account: 'EnuwVhNvZ2vctwvedwHZzt7wsuncww77KQUHhLVqXpyY',
  usdc_mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  rpc_url: 'https://api.mainnet-beta.solana.com',
  reading_price_usdc: 0.10,
  label: 'A Caixa Mistica',
  paywall_enabled: true,
};

export async function fetchPaymentSettings() {
  try {
    const { items } = await base44.entities.PaymentSettings.filter({}, { limit: 1 });
    if (items && items.length > 0) {
      return { ...DEFAULT_PAYMENT_SETTINGS, ...items[0] };
    }
  } catch (err) {
    console.warn('Failed to fetch payment settings, using defaults:', err);
  }
  return DEFAULT_PAYMENT_SETTINGS;
}

// Unique raw amount per payment: price in raw units + random 1..999
export function generateExpectedAmountRaw(priceUsdc) {
  return Math.round(priceUsdc * 1_000_000) + Math.floor(Math.random() * 999) + 1;
}

export function rawToUsdc(raw) {
  return (raw / 1_000_000).toFixed(6);
}

export function getExpectedRaw(payment) {
  return payment.expected_amount_raw ?? Math.round((payment.amount_usdc || 0) * 1_000_000);
}

export function buildSolanaPayUrl(settings, reference, expectedAmountRaw) {
  const { recipient_wallet, usdc_mint, reading_price_usdc, label } = settings;
  const amount = expectedAmountRaw ? rawToUsdc(expectedAmountRaw) : reading_price_usdc;
  const params = [
    `amount=${amount}`,
    `spl-token=${usdc_mint}`,
    `reference=${reference}`,
    `label=${encodeURIComponent(label)}`,
    `message=${encodeURIComponent('Premium Reading')}`,
  ];
  return `solana:${recipient_wallet}?${params.join('&')}`;
}

// === Robust RPC: try endpoints in order, fail over on HTTP error / 403 / 429 / JSON-RPC error ===
export function getRpcEndpoints(settings) {
  const endpoints = [];
  const configured = settings?.rpc_url;
  if (configured) endpoints.push(configured);
  const fallbacks = ['https://solana-rpc.publicnode.com', 'https://api.mainnet-beta.solana.com'];
  for (const f of fallbacks) {
    if (!endpoints.includes(f)) endpoints.push(f);
  }
  return endpoints;
}

async function rpcCall(rpcUrls, method, params) {
  for (const url of rpcUrls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      });
      if (response.status === 403 || response.status === 429 || !response.ok) {
        console.error(`RPC ${url} returned HTTP ${response.status}`);
        continue;
      }
      const data = await response.json();
      if (data.error) {
        console.error(`RPC ${url} JSON-RPC error:`, data.error);
        continue;
      }
      return data.result;
    } catch (err) {
      console.error(`RPC ${url} fetch failed:`, err);
      continue;
    }
  }
  return null;
}

// Cache of signature -> received raw amount (or null), avoids re-fetching on every poll
const receivedRawCache = new Map();

async function getReceivedRaw(rpcUrls, signature, recipientWallet, usdcMint) {
  if (receivedRawCache.has(signature)) return receivedRawCache.get(signature);
  const tx = await rpcCall(rpcUrls, 'getTransaction', [
    signature,
    { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
  ]);
  if (!tx || !tx.meta) return null; // not cached: may be temporary RPC failure
  let received = null;
  if (tx.meta.err === null) {
    const post = (tx.meta.postTokenBalances || []).find(
      (b) => b.owner === recipientWallet && b.mint === usdcMint
    );
    if (post) {
      const pre = (tx.meta.preTokenBalances || []).find((b) => b.accountIndex === post.accountIndex);
      received = Number(BigInt(post.uiTokenAmount?.amount || '0') - BigInt(pre?.uiTokenAmount?.amount || '0'));
    }
  }
  receivedRawCache.set(signature, received);
  return received;
}

function parseCreatedMs(createdDate) {
  if (!createdDate) return 0;
  const s = String(createdDate);
  const withTz = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : s + 'Z';
  const ms = Date.parse(withTz);
  return Number.isFinite(ms) ? ms : 0;
}

async function isSignatureUsedElsewhere(signature, paymentId) {
  try {
    const { items } = await base44.entities.SolanaPayment.filter(
      { tx_signature: signature },
      { limit: 5, fields: ['id'] }
    );
    return items.some((p) => p.id !== paymentId);
  } catch (err) {
    console.error('Failed to check used signatures:', err);
    return false;
  }
}

// Step B: match by unique amount on the recipient's USDC account / wallet
async function verifyByAmount(settings, payment, rpcUrls) {
  const { recipient_wallet, recipient_usdc_account, usdc_mint } = settings;
  const expectedRaw = getExpectedRaw(payment);
  if (!expectedRaw) return null;

  const addresses = [recipient_usdc_account, recipient_wallet].filter(Boolean);
  const lists = await Promise.all(
    addresses.map((addr) =>
      rpcCall(rpcUrls, 'getSignaturesForAddress', [addr, { limit: 25, commitment: 'confirmed' }])
    )
  );

  const minBlockTime = (parseCreatedMs(payment.created_date) - 120 * 1000) / 1000;
  const seen = new Set();
  const candidates = [];
  for (const list of lists) {
    for (const s of list || []) {
      if (seen.has(s.signature)) continue;
      seen.add(s.signature);
      if (s.err !== null && s.err !== undefined) continue;
      if (s.blockTime && s.blockTime < minBlockTime) continue;
      candidates.push(s.signature);
    }
  }

  for (const signature of candidates) {
    const received = await getReceivedRaw(rpcUrls, signature, recipient_wallet, usdc_mint);
    if (received !== expectedRaw) continue;
    if (await isSignatureUsedElsewhere(signature, payment.id)) continue;
    return signature;
  }
  return null;
}

// === Reusable verification: returns 'confirmed' | 'not_found' | 'invalid' ===
export async function verifyPayment(settings, solanaPayment) {
  const rpcUrls = getRpcEndpoints(settings);
  const reference = solanaPayment?.reference;

  const { recipient_wallet, usdc_mint, reading_price_usdc } = settings;

  // Step A: lookup by reference
  const signatures = reference
    ? await rpcCall(rpcUrls, 'getSignaturesForAddress', [reference, { limit: 5, commitment: 'confirmed' }])
    : null;

  if (!signatures || signatures.length === 0) {
    // Step B: fallback by unique amount
    try {
      const signature = await verifyByAmount(settings, solanaPayment, rpcUrls);
      if (signature) return { status: 'confirmed', signature };
    } catch (err) {
      console.error('Amount-based verification failed:', err);
    }
    return { status: 'not_found' };
  }

  for (const sigInfo of signatures) {
    if (sigInfo.err) continue;
    const signature = sigInfo.signature;

    const tx = await rpcCall(rpcUrls, 'getTransaction', [
      signature,
      { encoding: 'jsonParsed', commitment: 'confirmed', maxSupportedTransactionVersion: 0 },
    ]);

    if (!tx || !tx.meta) continue;

    const meta = tx.meta;
    if (meta.err !== null) continue;

    const postBalances = meta.postTokenBalances || [];
    const preBalances = meta.preTokenBalances || [];

    // Find the recipient's USDC entry in postTokenBalances
    const postEntry = postBalances.find(
      (b) => b.owner === recipient_wallet && b.mint === usdc_mint
    );
    if (!postEntry) continue;

    const postAmount = parseFloat(postEntry.uiTokenAmount?.uiAmountString ?? '0');

    // Match the same token account in preTokenBalances by accountIndex
    const preEntry = preBalances.find((b) => b.accountIndex === postEntry.accountIndex);
    const preAmount = preEntry
      ? parseFloat(preEntry.uiTokenAmount?.uiAmountString ?? '0')
      : 0;

    if (postAmount - preAmount >= reading_price_usdc - 0.000001) {
      return { status: 'confirmed', signature };
    }
  }

  return { status: 'invalid' };
}
