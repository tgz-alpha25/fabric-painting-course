const { sendEmail } = require('../config/mailer');

exports.sendContactEmail = async (req, res) => {
  try {
    const { name, email, mobile, subject, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Name, email and message are required' });
    }

    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      replyTo: email,
      subject: `Contact Form: ${subject || 'New Message'} - from ${name}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Mobile:</b> ${mobile || 'Not provided'}</p>
        <p><b>Subject:</b> ${subject || 'General Inquiry'}</p>
        <hr/>
        <p><b>Message:</b></p>
        <p>${message.replace(/\n/g, '<br>')}</p>
      `,
    });

    res.json({ message: 'Message sent successfully!' });
  } catch (err) {
    console.error('Contact email error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
};
