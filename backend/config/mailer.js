/**
 * Send an email using Brevo HTTP API (no SMTP, no port blocking issues)
 * @param {Object} options - { to, subject, html, replyTo }
 */
const sendEmail = async ({ to, subject, html, replyTo }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || 'tgz.github@gmail.com';
  const senderName = process.env.BREVO_SENDER_NAME || 'Fabric Painting Course';

  if (!apiKey) {
    throw new Error('BREVO_API_KEY environment variable is not defined.');
  }

  const payload = {
    sender: { name: senderName, email: senderEmail },
    to: [{ email: to }],
    subject: subject,
    htmlContent: html,
  };

  if (replyTo) {
    payload.replyTo = { email: replyTo };
  }

  // Use Node.js native global fetch
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'api-key': apiKey,
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Brevo error: ${JSON.stringify(data)}`);
  }

  return data;
};

module.exports = { sendEmail };
