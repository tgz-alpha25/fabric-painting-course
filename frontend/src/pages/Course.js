import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';
import Hls from 'hls.js';
import toast from 'react-hot-toast';
import {
  FaPlay, FaLock, FaChevronDown, FaChevronUp, FaSpinner
} from 'react-icons/fa';
import './Course.css';

const COURSE_VIDEOS = [
  { id: 'class1', classNumber: 1, title: 'Class 1 - Material Requirement', description: 'Essential materials for fabric painting.' },
  { id: 'class2', classNumber: 2, title: 'Class 2 - Basic Lines', description: 'Fundamental line techniques.' },
  { id: 'class3', classNumber: 3, title: 'Class 3 - Basic Lines Model 2', description: 'Advanced line models and patterns.' },
  { id: 'class4', classNumber: 4, title: 'Class 4 - Basic Circles & Brush Handling', description: 'Circle techniques and proper brush handling.' },
  { id: 'class5', classNumber: 5, title: 'Class 5 - Free Hand Flower & Leaf', description: 'Beautiful freehand flowers and leaves.' },
  { id: 'class6', classNumber: 6, title: 'Class 6 - Butter Sheet & Cloth Tracing', description: 'Professional tracing techniques.' },
  { id: 'class7', classNumber: 7, title: 'Class 7 - Fabric Painting Outline', description: 'Perfect your outlining skills.' },
  { id: 'class8', classNumber: 8, title: 'Class 8 - Wet & Wet / Blending Method', description: 'Master wet-on-wet and blending.' },
  { id: 'class9', classNumber: 9, title: 'Class 9 - 3D Painting Basic', description: 'Introduction to 3D effects.' },
  { id: 'class10', classNumber: 10, title: 'Class 10 - 3D Painting Advanced', description: 'Advanced 3D depth techniques.' },
  { id: 'class11', classNumber: 11, title: 'Class 11 - Stock Painting', description: 'Stock painting methods.' },
  { id: 'class12', classNumber: 12, title: 'Class 12 - Pichwal Painting', description: 'Traditional Pichwal art form.' },
  { id: 'class13', classNumber: 13, title: 'Class 13 - Kalamkari Basic', description: 'Ancient Kalamkari art introduction.' },
  { id: 'class14', classNumber: 14, title: 'Class 14 - Kalamkari Advanced', description: 'Advanced Kalamkari patterns.' },
  { id: 'class15', classNumber: 15, title: 'Class 15 - Salt Effect Painting', description: 'Unique textures with salt.' },
  { id: 'class16', classNumber: 16, title: 'Class 16 - Tanjore Painting Basic', description: 'Traditional Tanjore basics.' },
  { id: 'class17', classNumber: 17, title: 'Class 17 - Tanjore Advanced Level', description: 'Advanced Tanjore with gold work.' },
  { id: 'class18', classNumber: 18, title: 'Class 18 - Pre & Post Care', description: 'Fabric care and maintenance.' },
  { id: 'class19', classNumber: 19, title: 'Class 19 - Measurement Method', description: '3 neck types & 2 sleeve types.' },
];

const CoursePage = () => {
  const { user, openAuth } = useAuth();
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [streamUrl, setStreamUrl] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(false);
  const [hasAccess, setHasAccess] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState({});
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const progressTimer = useRef(null);

  // Check access on mount
  useEffect(() => {
    if (!user) return;
    checkAccess();
  }, [user]);

  const checkAccess = async () => {
    try {
      await api.get('/videos');
      setHasAccess(true);
    } catch (err) {
      if (err.response?.data?.code === 'NO_ACCESS' || err.response?.data?.code === 'ACCESS_DENIED') {
        setHasAccess(false);
      } else if (err.response?.data?.code === 'ACCESS_EXPIRED') {
        setHasAccess('expired');
      }
    }
  };

  const loadVideo = useCallback(async (video) => {
    if (!user) { openAuth('login'); return; }
    if (hasAccess !== true) return;

    setSelectedVideo(video);
    setLoadingVideo(true);
    setStreamUrl(null);

    try {
      const res = await api.get(`/videos/${video.id}/stream`);
      setStreamUrl(res.data.streamUrl);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to load video';
      toast.error(msg);
    } finally {
      setLoadingVideo(false);
    }
  }, [user, hasAccess, openAuth]);

  // HLS player setup
  useEffect(() => {
    if (!streamUrl || !videoRef.current) return;

    // Destroy old HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (streamUrl.includes('.m3u8') && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        // Prevent caching of segments to stop downloads
        fragLoadingMaxRetry: 3,
      });
      hls.loadSource(streamUrl);
      hls.attachMedia(videoRef.current);
      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      videoRef.current.src = streamUrl;
    } else {
      videoRef.current.src = streamUrl;
    }

    videoRef.current.play().catch(() => {});

    // Track progress every 10s
    progressTimer.current = setInterval(() => {
      if (videoRef.current && selectedVideo) {
        const progress = videoRef.current.duration
          ? Math.round((videoRef.current.currentTime / videoRef.current.duration) * 100)
          : 0;
        api.post(`/videos/${selectedVideo.id}/progress`, {
          progress,
          watchTime: Math.round(videoRef.current.currentTime),
        }).catch(() => {});
      }
    }, 10000);

    return () => {
      clearInterval(progressTimer.current);
      if (hlsRef.current) hlsRef.current.destroy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamUrl]);

  const toggleGroup = (group) => {
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const groups = [
    { label: 'Foundation', range: [1, 4] },
    { label: 'Techniques', range: [5, 10] },
    { label: 'Traditional Art', range: [11, 14] },
    { label: 'Special Methods', range: [15, 17] },
    { label: 'Finishing & Care', range: [18, 19] },
  ];

  if (!user) {
    return (
      <div className="course-auth-gate">
        <div className="gate-content">
          <FaLock size={48} />
          <h2>Login to Access the Course</h2>
          <p>Please sign in or create an account to view the course content.</p>
          <button className="btn btn-primary btn-lg" onClick={() => openAuth('login')}>
            Login / Register
          </button>
        </div>
      </div>
    );
  }

  if (hasAccess === false) {
    return (
      <div className="course-auth-gate">
        <div className="gate-content">
          <FaLock size={48} />
          <h2>Course Access Required</h2>
          <p>You don't have access to the course videos yet. Please purchase the course to get access.</p>
          <a href={`https://wa.me/${process.env.REACT_APP_WHATSAPP_NUMBER}`}
            target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg">
            Buy Course on WhatsApp
          </a>
        </div>
      </div>
    );
  }

  if (hasAccess === 'expired') {
    return (
      <div className="course-auth-gate">
        <div className="gate-content expired">
          <FaLock size={48} />
          <h2>Your Access Has Expired</h2>
          <p>Your 6-month course access period has ended. Contact us to renew.</p>
          <a href={`https://wa.me/${process.env.REACT_APP_WHATSAPP_NUMBER}`}
            target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg">
            Renew Access
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="course-page">
      <div className="course-layout">
        {/* VIDEO PLAYER */}
        <div className="course-main">
          <div className="video-player-wrapper">
            {!selectedVideo ? (
              <div className="video-placeholder">
                <div className="placeholder-content">
                  <FaPlay size={48} />
                  <h3>Select a class to begin</h3>
                  <p>Choose from 19 fabric painting classes</p>
                </div>
              </div>
            ) : loadingVideo ? (
              <div className="video-placeholder">
                <div className="placeholder-content">
                  <FaSpinner size={48} className="spin-icon" />
                  <p>Loading secure stream...</p>
                </div>
              </div>
            ) : (
              <video
                ref={videoRef}
                className="course-video"
                controlsList="nodownload noremoteplayback"
                onContextMenu={(e) => e.preventDefault()}
                disablePictureInPicture
                playsInline
                controls
              />
            )}
          </div>

          {selectedVideo && (
            <div className="video-info">
              <h2 className="video-title">{selectedVideo.title}</h2>
              <p className="video-desc">{selectedVideo.description}</p>
            </div>
          )}
        </div>

        {/* PLAYLIST SIDEBAR */}
        <div className="course-sidebar">
          <div className="sidebar-header">
            <h3>Course Content</h3>
            <span className="class-count">19 Classes</span>
          </div>

          <div className="playlist">
            {groups.map((group) => {
              const groupVideos = COURSE_VIDEOS.filter(
                (v) => v.classNumber >= group.range[0] && v.classNumber <= group.range[1]
              );
              const isCollapsed = collapsedGroups[group.label];

              return (
                <div className="playlist-group" key={group.label}>
                  <button className="group-header" onClick={() => toggleGroup(group.label)}>
                    <span className="group-label">{group.label}</span>
                    <span className="group-meta">{groupVideos.length} classes</span>
                    {isCollapsed ? <FaChevronDown /> : <FaChevronUp />}
                  </button>

                  {!isCollapsed && (
                    <div className="group-videos">
                      {groupVideos.map((video) => (
                        <button
                          key={video.id}
                          className={`playlist-item ${selectedVideo?.id === video.id ? 'active' : ''}`}
                          onClick={() => loadVideo(video)}
                        >
                          <div className="item-number">{video.classNumber}</div>
                          <div className="item-info">
                            <span className="item-title">{video.title}</span>
                            <span className="item-desc">{video.description}</span>
                          </div>
                          {selectedVideo?.id === video.id && loadingVideo ? (
                            <FaSpinner className="item-icon spin-icon" />
                          ) : (
                            <FaPlay className="item-icon play-icon" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoursePage;
