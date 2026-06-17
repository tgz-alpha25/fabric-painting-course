const { getDb } = require('../config/firebase');
const { getActiveCloudinaryConfig, generateSecureVideoUrl } = require('../config/cloudinary');

const COURSE_VIDEOS = [
  { id: 'class1', classNumber: 1, title: 'Class 1 - Material Requirement', description: 'Learn all the essential materials needed for fabric painting.' },
  { id: 'class2', classNumber: 2, title: 'Class 2 - Basic Lines', description: 'Master the fundamental line techniques in fabric painting.' },
  { id: 'class3', classNumber: 3, title: 'Class 3 - Basic Lines Model 2', description: 'Advanced line models and pattern techniques.' },
  { id: 'class4', classNumber: 4, title: 'Class 4 - Basic Circles and Brush Handling', description: 'Circle techniques and proper brush handling skills.' },
  { id: 'class5', classNumber: 5, title: 'Class 5 - Free Hand Flower and Leaf Drawing', description: 'Create beautiful freehand flowers and leaves.' },
  { id: 'class6', classNumber: 6, title: 'Class 6 - Butter Sheet Tracing and Cloth Tracing', description: 'Professional tracing techniques for fabric.' },
  { id: 'class7', classNumber: 7, title: 'Class 7 - Fabric Painting Outline', description: 'Perfect your outlining skills for fabric painting.' },
  { id: 'class8', classNumber: 8, title: 'Class 8 - Wet and Wet Method & Blending Method', description: 'Master wet-on-wet and blending techniques.' },
  { id: 'class9', classNumber: 9, title: 'Class 9 - Fabric Painting 3D Basic', description: 'Introduction to 3D effects in fabric painting.' },
  { id: 'class10', classNumber: 10, title: 'Class 10 - Fabric Painting 3D Advanced', description: 'Advanced 3D techniques for stunning depth effects.' },
  { id: 'class11', classNumber: 11, title: 'Class 11 - Stock Painting', description: 'Stock painting methods and applications.' },
  { id: 'class12', classNumber: 12, title: 'Class 12 - Pichwal Painting', description: 'Traditional Pichwal painting art form on fabric.' },
  { id: 'class13', classNumber: 13, title: 'Class 13 - Kalamkari Painting Basic', description: 'Introduction to the ancient Kalamkari art form.' },
  { id: 'class14', classNumber: 14, title: 'Class 14 - Kalamkari Painting Advanced', description: 'Advanced Kalamkari patterns and techniques.' },
  { id: 'class15', classNumber: 15, title: 'Class 15 - Salt Effect Painting', description: 'Create unique textures using salt effect technique.' },
  { id: 'class16', classNumber: 16, title: 'Class 16 - Tanjore Painting Basic', description: 'Learn the basics of traditional Tanjore painting.' },
  { id: 'class17', classNumber: 17, title: 'Class 17 - Tanjore Painting Advanced Level', description: 'Master advanced Tanjore painting with gold work.' },
  { id: 'class18', classNumber: 18, title: 'Class 18 - Pre & Post Care Fabric Painting', description: 'Essential care and maintenance for painted fabric.' },
  { id: 'class19', classNumber: 19, title: 'Class 19 - Measurement Method', description: 'Three types of neck & two types of sleeve measurement.' },
];

// GET all videos (playlist) - no streaming URL, just metadata
exports.getVideoList = async (req, res) => {
  try {
    const db = getDb();
    const videosSnapshot = await db.collection('videos').orderBy('classNumber', 'asc').get();

    let videos = COURSE_VIDEOS;

    if (!videosSnapshot.empty) {
      videos = videosSnapshot.docs
        .filter((doc) => doc.id !== 'demo')
        .map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            classNumber: data.classNumber,
            title: data.title,
            description: data.description,
            thumbnail: data.thumbnail || null,
            duration: data.duration || 0,
            hasPublicId: !!(data.cloudinaryPublicIds && Object.keys(data.cloudinaryPublicIds).length),
          };
        });
    }

    res.json({ videos });
  } catch (err) {
    console.error('Get video list error:', err);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
};

// GET secure streaming URL for a specific video
exports.getVideoStream = async (req, res) => {
  try {
    const { videoId } = req.params;
    const db = getDb();

    // Get video data
    const videoDoc = await db.collection('videos').doc(videoId).get();

    if (!videoDoc.exists) {
      return res.status(404).json({ error: 'Video not found' });
    }

    const videoData = videoDoc.data();

    // Get active cloudinary config
    const config = await getActiveCloudinaryConfig();

    // Get publicId for this account
    const publicId =
      videoData.cloudinaryPublicIds?.[config.accountId] ||
      videoData.cloudinaryPublicIds?.default ||
      Object.values(videoData.cloudinaryPublicIds || {})[0];

    if (!publicId) {
      return res.status(404).json({ error: 'Video not configured yet' });
    }

    // Generate secure signed HLS URL
    const streamUrl = await generateSecureVideoUrl(publicId, config);

    // Track watch history — skip for demo video
    if (videoId !== 'demo') {
      const historyRef = db
        .collection('watchHistory')
        .doc(req.user.uid)
        .collection('videos')
        .doc(videoId);

      const historyDoc = await historyRef.get();

      if (historyDoc.exists) {
        await historyRef.update({
          watchCount: (historyDoc.data().watchCount || 0) + 1,
          lastWatched: new Date(),
          title: videoData.title,
        });
      } else {
        await historyRef.set({
          videoId,
          title: videoData.title,
          watchCount: 1,
          totalWatchTime: 0,
          lastWatched: new Date(),
          firstWatched: new Date(),
          progress: 0,
        });
      }
    }

    res.json({
      streamUrl,
      title: videoData.title,
      duration: videoData.duration,
      // Token expires in 1 hour — client must re-request after that
      expiresIn: 3600,
    });
  } catch (err) {
    console.error('Get stream error:', err);
    res.status(500).json({ error: 'Failed to get stream' });
  }
};

// UPDATE watch progress
exports.updateProgress = async (req, res) => {
  try {
    const { videoId } = req.params;
    const { progress, watchTime } = req.body;
    const db = getDb();

    const historyRef = db
      .collection('watchHistory')
      .doc(req.user.uid)
      .collection('videos')
      .doc(videoId);

    await historyRef.set(
      {
        progress: Math.min(100, Math.max(0, progress)),
        totalWatchTime: watchTime,
        lastWatched: new Date(),
      },
      { merge: true }
    );

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update progress' });
  }
};
