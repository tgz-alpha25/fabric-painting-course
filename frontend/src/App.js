import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Layout/Navbar';
import Footer from './components/Layout/Footer';
import AuthModal from './components/Auth/AuthModal';
import Landing from './pages/Landing';
import Course from './pages/Course';
import Contact from './pages/Contact';
import Admin from './pages/Admin';
import ApproveDevice from './pages/ApproveDevice';
import './styles/global.css';

// Security: block right-click, F12, common keyboard shortcuts
const SecurityWrapper = ({ children }) => {
  useEffect(() => {
    // Block right-click
    const noContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', noContextMenu);

    // Block F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S, Ctrl+A, etc.
    const blockKeys = (e) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key)) ||
        (e.ctrlKey && ['U', 'S', 'P', 'A'].includes(e.key)) ||
        e.key === 'PrintScreen'
      ) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener('keydown', blockKeys);

    // Block drag of images/videos
    const noDrag = (e) => {
      if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
        e.preventDefault();
      }
    };
    document.addEventListener('dragstart', noDrag);

    // Detect DevTools (basic)
    const devToolsCheck = setInterval(() => {
      const threshold = 160;
      if (window.outerWidth - window.innerWidth > threshold || window.outerHeight - window.innerHeight > threshold) {
        // DevTools likely open — optionally blur content
        document.body.style.filter = 'blur(10px)';
      } else {
        document.body.style.filter = '';
      }
    }, 1000);

    return () => {
      document.removeEventListener('contextmenu', noContextMenu);
      document.removeEventListener('keydown', blockKeys);
      document.removeEventListener('dragstart', noDrag);
      clearInterval(devToolsCheck);
    };
  }, []);

  return children;
};

// Layout wrapper (hides footer on admin and course pages)
const AppLayout = () => {
  const location = useLocation();
  const isAdmin = location.pathname === '/admin';
  const isCourse = location.pathname === '/course';
  const isApprove = location.pathname === '/approve-device';

  return (
    <>
      {!isAdmin && !isApprove && <Navbar />}
      <AuthModal />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/course" element={<Course />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/approve-device" element={<ApproveDevice />} />
      </Routes>
      {!isAdmin && !isCourse && !isApprove && <Footer />}
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <SecurityWrapper>
        <Router>
          <AppLayout />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                fontFamily: 'Inter, sans-serif',
                fontSize: '14px',
                borderRadius: '10px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              },
              success: { iconTheme: { primary: '#059669', secondary: '#D1FAE5' } },
              error: { iconTheme: { primary: '#DC2626', secondary: '#FEE2E2' } },
            }}
          />
        </Router>
      </SecurityWrapper>
    </AuthProvider>
  );
}

export default App;
