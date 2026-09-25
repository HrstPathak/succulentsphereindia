const { getFirebaseDb } = require('../src/lib/firebase-admin');
const { sendOrderConfirmationEmail } = require('../src/lib/order-email');

(async () => {
  const orderId = process.argv[2] || process.env.ORDER_ID;
  if (!orderId) {
    console.error('Usage: node scripts/resend-order-email.js <orderId>');
    process.exit(2);
  }
  try {
    // initialize env from .env.local is handled by calling node --env-file=.env.local
    const db = getFirebaseDb();
    const doc = await db.collection('orders').doc(orderId).get();
    if (!doc.exists) {
      console.error('Order not found:', orderId);
      process.exit(3);
    }
    const data = doc.data();
    const amountOf = (value) => value && typeof value === 'object' ? value.amount : value;
    const positive = (...values) => {
      for (const value of values) {
        const parsed = Number(amountOf(value));
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
      return 0;
    };
    const lineItemTotal = (data.lineItems || []).reduce((sum, item) => {
      const explicit = Number(amountOf(item.discountedTotalPrice ?? item.originalTotalPrice));
      if (Number.isFinite(explicit) && explicit > 0) return sum + explicit;
      return sum + Number(amountOf(item.price ?? item.unitPrice) || 0) * Math.max(1, Number(item.quantity || 1));
    }, 0);
    const total = positive(data.currentTotalPrice, data.totalPrice, data.total, data.invoiceTotal, data.orderTotal, lineItemTotal);
    const mode = String(data.paymentMode || data.payment_method || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    const isCod = !['prepaid', 'pre_paid', 'paid', 'online', 'razorpay'].includes(mode) && (mode === 'cod' || mode === 'cash_on_delivery' || mode.startsWith('cod_') || String(data.financialStatus || '').toUpperCase() === 'DEPOSIT_PAID');
    const lineAttribute = (key) => {
      for (const item of data.lineItems || []) {
        const match = (item.customAttributes || []).find((attribute) => attribute && String(attribute.key) === key);
        if (match && match.value !== undefined && match.value !== null && String(match.value).trim()) return match.value;
      }
      return undefined;
    };
    const present = (...values) => {
      for (const value of values) {
        if (value === undefined || value === null || String(value).trim() === '') continue;
        const parsed = Number(amountOf(value));
        if (Number.isFinite(parsed) && parsed >= 0) return parsed;
      }
      return undefined;
    };
    const wallet = present(data.walletAmountUsed, data.walletAmountApplied, lineAttribute('wallet_amount')) ?? 0;
    const deposit = isCod
      ? Math.min(total, present(data.cod_deposit, data.codDepositAmount, data.codDeposit, data.paymentReceived, data.paidAmount, data.razorpayAmount, lineAttribute('cod_deposit'), lineAttribute('payment_received')) ?? (mode === 'cod_deposit' || String(data.financialStatus || '').toUpperCase() === 'DEPOSIT_PAID' ? 100 : 0))
      : 0;
    const codBalance = isCod
      ? Math.max(0, Math.min(total, present(data.cod_balance, data.codBalance, lineAttribute('cod_balance')) ?? (total - deposit - wallet)))
      : 0;
    const paymentMode = isCod ? (deposit > 0 ? 'cod_deposit' : 'cod') : 'prepaid';
    const orderEmail = {
      orderId,
      orderNumber: data.orderNumber,
      customerName: (data.customer?.fullName) || (data.customer?.name) || 'Customer',
      customerEmail: data.customer?.email || data.emailLower || '',
      items: (data.lineItems || []).map((li) => ({ title: li.title, quantity: li.quantity, price: li.price?.amount || li.price })),
      total,
      paymentMode,
      address: data.customer?.address1 || data.customer?.address || '',
      city: data.customer?.city || data.customer?.province || '',
      state: data.customer?.state || data.customer?.province || '',
      pincode: data.customer?.zip || data.customer?.pincode || '',
      phone: data.customer?.phone || '',
      shipping: Number(data.shipping || 0),
      discount: Number(data.discount || 0),
      codFee: Number(data.codFee || 0),
      paymentReceived: isCod ? Math.max(0, total - codBalance) : total,
      codDepositAmount: deposit,
      codBalance,
      walletAmountUsed: wallet,
    };

    console.log('Resending order email to:', orderEmail.customerEmail);
    const res = await sendOrderConfirmationEmail(orderEmail);
    console.log('Result:', res);
  } catch (err) {
    console.error('Failed to resend email', err);
    process.exit(1);
  }
})();
