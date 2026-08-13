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
    const orderEmail = {
      orderId,
      orderNumber: data.orderNumber,
      customerName: (data.customer?.fullName) || (data.customer?.name) || 'Customer',
      customerEmail: data.customer?.email || data.emailLower || '',
      items: (data.lineItems || []).map((li) => ({ title: li.title, quantity: li.quantity, price: li.price?.amount || li.price })) ,
      total: Number(data.totalPrice?.amount || data.total || 0),
      paymentMode: data.paymentMode || 'prepaid',
      address: data.customer?.address1 || data.customer?.address || '',
      city: data.customer?.city || data.customer?.province || '',
      state: data.customer?.state || data.customer?.province || '',
      pincode: data.customer?.zip || data.customer?.pincode || '',
      phone: data.customer?.phone || '',
      shipping: Number(data.shipping || 0),
      discount: Number(data.discount || 0),
      codFee: Number(data.codFee || 0),
      paymentReceived: Number(data.paymentReceived || data.razorpayAmount || data.currentTotalPrice?.amount || 0),
    };

    console.log('Resending order email to:', orderEmail.customerEmail);
    const res = await sendOrderConfirmationEmail(orderEmail);
    console.log('Result:', res);
  } catch (err) {
    console.error('Failed to resend email', err);
    process.exit(1);
  }
})();
