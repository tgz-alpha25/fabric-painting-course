import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  FaPlay, FaPalette, FaLeaf, FaStar, FaWhatsapp, FaCheck,
  FaBrush, FaGraduationCap, FaCertificate, FaUsers, FaLock
} from 'react-icons/fa';
import './Landing.css';

const WHATSAPP_URL = `https://wa.me/${process.env.REACT_APP_WHATSAPP_NUMBER}`;

const FEATURES = [
  { icon: <FaBrush />, title: '19 Expert Classes', desc: 'From basics to advanced Tanjore & Kalamkari painting' },
  { icon: <FaGraduationCap />, title: 'Learn at Your Pace', desc: 'Lifetime access for 6 months from activation' },
  { icon: <FaCertificate />, title: 'Professional Techniques', desc: 'Wet-on-wet, 3D painting, Pichwal, stock painting & more' },
  { icon: <FaUsers />, title: 'Expert Guidance', desc: 'Detailed video instructions for every technique' },
];

const TESTIMONIALS = [
  { name: 'Priya Sharma', city: 'Chennai', text: 'Best fabric painting course! The Kalamkari classes were amazing.', rating: 5 },
  { name: 'Meena Patel', city: 'Coimbatore', text: 'Very detailed explanations. I learned Tanjore painting from scratch!', rating: 5 },
  { name: 'Lakshmi R', city: 'Madurai', text: 'The 3D painting techniques were a game-changer for my artwork.', rating: 5 },
];

const Landing = () => {
  const { user, openAuth } = useAuth();
  const [videoModalOpen, setVideoModalOpen] = useState(false);

  const handleDemoVideo = () => {
    if (!user) {
      openAuth('login');
    } else {
      setVideoModalOpen(true);
    }
  };

  return (
    <div className="landing">
      {/* HERO SECTION */}
      <section className="hero">
        <div className="hero-bg">
          <div className="hero-pattern" />
        </div>
        <div className="container hero-content">
          <div className="hero-text">
            <span className="hero-eyebrow">
              <FaPalette /> Professional Fabric Painting Course
            </span>
            <h1 className="hero-title">
              Master the Art of<br />
              <em>Fabric Painting</em>
            </h1>
            <p className="hero-desc">
              19 comprehensive video classes covering traditional Kalamkari, Tanjore,
              Pichwal, 3D painting and more — taught by an expert artist.
            </p>
            <div className="hero-actions">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg">
                <FaWhatsapp /> Buy Course
              </a>
              <button className="btn btn-outline btn-lg" onClick={handleDemoVideo}>
                <FaPlay /> Watch Demo
              </button>
            </div>
            <div className="hero-stats">
              <div className="stat"><b>19</b><span>Classes</span></div>
              <div className="stat-divider" />
              <div className="stat"><b>6</b><span>Months Access</span></div>
              <div className="stat-divider" />
              <div className="stat"><b>500+</b><span>Students</span></div>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image-stack">
              <div className="hero-card hero-card-1">
                <FaPalette />
                <span>Kalamkari Art</span>
              </div>
              <div className="hero-card hero-card-2">
                <FaBrush />
                <span>Tanjore Painting</span>
              </div>
              <div className="hero-card hero-card-3">
                <FaLeaf />
                <span>Fabric Painting</span>
              </div>
              <div className="hero-main-visual">
                <div className="brush-animation">
                  <FaBrush className="big-brush" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT YOU'LL LEARN */}
      <section className="section features-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Why Choose This Course?</h2>
            <p className="section-subtitle">Everything you need to master fabric painting — step by step</p>
          </div>
          <div className="features-grid">
            {FEATURES.map((f, i) => (
              <div className="feature-card" key={i}>
                <div className="feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* COURSE HIGHLIGHTS */}
      <section className="section highlights-section">
        <div className="container">
          <div className="highlights-layout">
            <div className="highlights-text">
              <h2 className="section-title">What's Inside the Course</h2>
              <p className="section-subtitle">A structured journey from beginner to professional</p>
              <ul className="highlights-list">
                {[
                  'Material requirements & setup guide',
                  'Basic to advanced brush techniques',
                  'Wet-on-wet & blending methods',
                  '3D basic & advanced painting',
                  'Traditional Pichwal painting',
                  'Kalamkari painting (basic & advanced)',
                  'Salt effect & texture techniques',
                  'Tanjore painting with gold work',
                  'Pre & post care for fabric',
                  'Neck & sleeve measurement methods',
                ].map((item, i) => (
                  <li key={i}><FaCheck className="check-icon" />{item}</li>
                ))}
              </ul>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg" style={{ marginTop: 24 }}>
                <FaWhatsapp /> Enroll Now via WhatsApp
              </a>
            </div>
            <div className="highlights-demo">
              <div className="demo-card">
                <div className="demo-thumb">
                  <button className="play-btn-large" onClick={handleDemoVideo}>
                    <FaPlay />
                  </button>
                  <div className="demo-overlay">
                    <span>Watch Demo Class</span>
                    {!user && <span className="demo-login-hint"><FaLock /> Login to watch</span>}
                  </div>
                </div>
                <div className="demo-info">
                  <h4>Free Demo: Class 1 - Material Requirement</h4>
                  <p>Get a taste of the course quality</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section testimonials-section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Student Reviews</h2>
          </div>
          <div className="testimonials-grid">
            {TESTIMONIALS.map((t, i) => (
              <div className="testimonial-card" key={i}>
                <div className="stars">
                  {[...Array(t.rating)].map((_, j) => <FaStar key={j} />)}
                </div>
                <p>"{t.text}"</p>
                <div className="testimonial-author">
                  <div className="author-avatar">{t.name[0]}</div>
                  <div>
                    <b>{t.name}</b>
                    <span>{t.city}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="section cta-section">
        <div className="container">
          <div className="cta-box">
            <h2>Ready to Start Your Fabric Painting Journey?</h2>
            <p>Join hundreds of students learning from the comfort of their home</p>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn btn-accent btn-lg">
              <FaWhatsapp /> Contact Us on WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Demo Video Modal */}
      {videoModalOpen && (
        <div className="video-modal-overlay" onClick={() => setVideoModalOpen(false)}>
          <div className="video-modal-box" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setVideoModalOpen(false)}>✕</button>
            <video controls controlsList="nodownload" onContextMenu={(e) => e.preventDefault()}
              style={{ width: '100%', borderRadius: 8 }}>
              <source src="/demo.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
        </div>
      )}
    </div>
  );
};

export default Landing;
