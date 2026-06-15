import React, { useState } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';
import {
  FaWhatsapp, FaTelegram, FaInstagram, FaYoutube,
  FaEnvelope, FaPhone, FaPaperPlane
} from 'react-icons/fa';
import './Contact.css';

const SOCIAL_LINKS = [
  {
    icon: <FaWhatsapp />, label: 'WhatsApp', color: '#25D366',
    href: `https://wa.me/${process.env.REACT_APP_WHATSAPP_NUMBER}`,
    desc: 'Chat with us directly'
  },
  {
    icon: <FaTelegram />, label: 'Telegram', color: '#2CA5E0',
    href: process.env.REACT_APP_TELEGRAM_URL || '#',
    desc: 'Join our Telegram channel'
  },
  {
    icon: <FaInstagram />, label: 'Instagram', color: '#E1306C',
    href: process.env.REACT_APP_INSTAGRAM_URL || '#',
    desc: 'Follow our artwork gallery'
  },
  {
    icon: <FaYoutube />, label: 'YouTube', color: '#FF0000',
    href: process.env.REACT_APP_YOUTUBE_URL || '#',
    desc: 'Watch free tutorials'
  },
];

const ContactPage = () => {
  const [form, setForm] = useState({ name: '', email: '', mobile: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/contact', form);
      toast.success('Message sent! We will get back to you soon.');
      setForm({ name: '', email: '', mobile: '', subject: '', message: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="contact-page">
      <div className="contact-hero">
        <div className="container">
          <h1 className="section-title">Get in Touch</h1>
          <p className="section-subtitle">We'd love to hear from you. Reach us through any channel below.</p>
        </div>
      </div>

      <div className="container contact-layout">
        {/* SOCIAL LINKS */}
        <div className="contact-left">
          <h2 className="contact-section-title">Find Us On</h2>
          <div className="social-cards">
            {SOCIAL_LINKS.map((s) => (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
                className="social-card" style={{ '--social-color': s.color }}>
                <div className="social-icon">{s.icon}</div>
                <div className="social-info">
                  <span className="social-label">{s.label}</span>
                  <span className="social-desc">{s.desc}</span>
                </div>
                <div className="social-arrow">→</div>
              </a>
            ))}
          </div>

          <div className="contact-direct">
            <h3>Direct Contact</h3>
            <a href={`https://wa.me/${process.env.REACT_APP_WHATSAPP_NUMBER}`}
              className="direct-item" target="_blank" rel="noopener noreferrer">
              <FaPhone /> {process.env.REACT_APP_WHATSAPP_NUMBER || 'Contact via WhatsApp'}
            </a>
            <a href={`mailto:${process.env.REACT_APP_ADMIN_EMAIL || 'info@fabricart.in'}`}
              className="direct-item">
              <FaEnvelope /> {process.env.REACT_APP_ADMIN_EMAIL || 'info@fabricart.in'}
            </a>
          </div>
        </div>

        {/* CONTACT FORM */}
        <div className="contact-right">
          <div className="contact-form-card">
            <h2 className="contact-section-title">Send a Message</h2>
            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-row-2">
                <div className="input-group">
                  <label className="input-label">Your Name *</label>
                  <input className="input-field" type="text" placeholder="Full name" required
                    value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </div>
                <div className="input-group">
                  <label className="input-label">Mobile</label>
                  <input className="input-field" type="tel" placeholder="Phone number"
                    value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">Email Address *</label>
                <input className="input-field" type="email" placeholder="your@email.com" required
                  value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Subject</label>
                <input className="input-field" type="text" placeholder="What is it about?"
                  value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </div>
              <div className="input-group">
                <label className="input-label">Message *</label>
                <textarea className="input-field contact-textarea" rows={5}
                  placeholder="Write your message here..." required
                  value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              <button className="btn btn-primary" type="submit" disabled={loading}
                style={{ width: '100%', justifyContent: 'center' }}>
                {loading
                  ? <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  : <><FaPaperPlane /> Send Message</>}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactPage;
