import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FaBrush, FaBars, FaTimes, FaUserCircle, FaSignOutAlt } from 'react-icons/fa';
import './Navbar.css';

const Navbar = () => {
  const { user, logout, openAuth } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location]);

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = () => {
    logout();
    setShowLogoutConfirm(false);
    setProfileOpen(false);
    setMenuOpen(false);
  };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/course', label: 'Course' },
    { to: '/contact', label: 'Contact Us' },
  ];

  return (
    <>
      <nav className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
        <div className="container navbar-inner">
          {/* Logo */}
          <Link to="/" className="navbar-logo">
            <div className="logo-icon"><FaBrush /></div>
            <div className="logo-text">
              <span className="logo-name">Fabric Art</span>
              <span className="logo-sub">Painting Course</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <ul className="navbar-links desktop-links">
            {navLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Auth area */}
          <div className="navbar-auth">
            {user ? (
              <div className="profile-menu-wrapper">
                <button className="profile-btn" onClick={() => setProfileOpen(!profileOpen)}>
                  <FaUserCircle size={22} />
                  <span className="profile-name">{user.name?.split(' ')[0]}</span>
                </button>
                {profileOpen && (
                  <div className="profile-dropdown">
                    <div className="dropdown-header">
                      <p className="dropdown-name">{user.name}</p>
                      <p className="dropdown-email">{user.email}</p>
                    </div>
                    <button className="dropdown-item" onClick={handleLogoutClick}>
                      <FaSignOutAlt /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <button className="btn btn-primary btn-sm" onClick={() => openAuth('login')}>
                Login
              </button>
            )}

            {/* Mobile hamburger */}
            <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
              {menuOpen ? <FaTimes size={20} /> : <FaBars size={20} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <div className={`mobile-menu ${menuOpen ? 'open' : ''}`}>
          <ul>
            {navLinks.map((link) => (
              <li key={link.to}>
                <Link to={link.to} className={`mobile-nav-link ${location.pathname === link.to ? 'active' : ''}`}>
                  {link.label}
                </Link>
              </li>
            ))}
            {!user && (
              <li>
                <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => { openAuth('login'); setMenuOpen(false); }}>
                  Login / Register
                </button>
              </li>
            )}
            {user && (
              <li>
                <button className="mobile-nav-link logout-btn" onClick={handleLogoutClick}>
                  <FaSignOutAlt /> Sign Out
                </button>
              </li>
            )}
          </ul>
        </div>
      </nav>

      {/* Custom Logout Confirmation Modal — rendered via portal to document.body */}
      {showLogoutConfirm && ReactDOM.createPortal(
        <div className="confirm-modal-overlay" onClick={() => setShowLogoutConfirm(false)}>
          <div className="confirm-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-modal-icon">
              <FaSignOutAlt />
            </div>
            <h3>Confirm Sign Out</h3>
            <p>Are you sure you want to sign out of your account?</p>
            <div className="confirm-modal-actions">
              <button className="btn btn-ghost" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-primary danger-bg" onClick={handleConfirmLogout}>
                Sign Out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Navbar;
