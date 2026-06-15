import React from 'react';
import { Link } from 'react-router-dom';
import { FaBrush, FaWhatsapp, FaInstagram, FaTelegram, FaYoutube, FaHeart } from 'react-icons/fa';
import './Footer.css';

const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-brand">
          <div className="footer-logo">
            <FaBrush />
            <span>Fabric Art Course</span>
          </div>
          <p>Master the art of fabric painting with 19 expert-led video classes. From basics to traditional Tanjore & Kalamkari.</p>
          <div className="footer-socials">
            <a href={`https://wa.me/${process.env.REACT_APP_WHATSAPP_NUMBER}`} target="_blank" rel="noopener noreferrer"><FaWhatsapp /></a>
            <a href={process.env.REACT_APP_INSTAGRAM_URL || '#'} target="_blank" rel="noopener noreferrer"><FaInstagram /></a>
            <a href={process.env.REACT_APP_TELEGRAM_URL || '#'} target="_blank" rel="noopener noreferrer"><FaTelegram /></a>
            <a href={process.env.REACT_APP_YOUTUBE_URL || '#'} target="_blank" rel="noopener noreferrer"><FaYoutube /></a>
          </div>
        </div>
        <div className="footer-links-col">
          <h4>Quick Links</h4>
          <Link to="/">Home</Link>
          <Link to="/course">Course</Link>
          <Link to="/contact">Contact Us</Link>
        </div>
        <div className="footer-links-col">
          <h4>Course</h4>
          <span>19 Video Classes</span>
          <span>6 Months Access</span>
          <span>Traditional Art Forms</span>
          <span>Expert Instruction</span>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© {year} Fabric Art Painting Course. Made with <FaHeart style={{ color: 'var(--primary-light)', display: 'inline' }} /></p>
      </div>
    </footer>
  );
};

export default Footer;
