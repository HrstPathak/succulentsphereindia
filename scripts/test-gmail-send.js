const nodemailer = require('nodemailer');
(async () => {
  try {
    const user = process.env.GMAIL_USER;
    const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s/g, '');
    const to = process.env.TEST_EMAIL_TO || user;
    if (!user || !pass) {
      console.error('Missing GMAIL_USER or GMAIL_APP_PASSWORD in env');
      process.exit(2);
    }
    console.log('Using from:', user, 'to:', to);
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
    const res = await transporter.sendMail({ from: `${process.env.GMAIL_FROM_NAME || 'Succulent Sphere'} <${user}>`, to, subject: 'Test email from Succulent Sphere', text: 'This is a test email to verify Gmail SMTP settings.' });
    console.log('sendMail result:', res);
    process.exit(0);
  } catch (err) {
    console.error('send failed', err);
    process.exit(1);
  }
})();