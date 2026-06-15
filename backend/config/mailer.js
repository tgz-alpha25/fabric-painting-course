const { Resend } = require('resend');

// Create a shared email sender using Resend API
// Works on all cloud hosting (Render, Heroku, Railway, etc.)
// Requires RESEND_API_KEY environment variable
const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Send an email using Resend API (no SMTP, no port blocking issues)
 * @param {Object} options - { to, subject, html, replyTo }
 */
const sendEmail = async ({ to, subject, html, replyTo }) => {
  const from = process.env.RESEND_FROM_EMAIL || 'Fabric Painting Course <onboarding@resend.dev>';
  
  const emailOptions = {
    from,
    to,
    subject,
    html,
  };

  if (replyTo) {
    emailOptions.replyTo = replyTo;
    emailOptions.reply_to = replyTo; // supports both camelCase and snake_case formats
  }

  const { data, error } = await resend.emails.send(emailOptions);

  if (error) {
    throw new Error(`Resend error: ${JSON.stringify(error)}`);
  }

  return data;
};

module.exports = { sendEmail };
