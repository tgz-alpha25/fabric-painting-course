require('dotenv').config();
const { getDb } = require('./config/firebase');

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

const seedVideos = async () => {
  try {
    const db = getDb();
    console.log('Starting to seed 19 course videos into Firestore...');

    const batch = db.batch();

    COURSE_VIDEOS.forEach((video) => {
      const docRef = db.collection('videos').doc(video.id);
      
      const videoData = {
        classNumber: video.classNumber,
        title: video.title,
        description: video.description,
        cloudinaryPublicIds: {
          account1: `courses/class${video.classNumber}` // Pre-fills default ID like courses/class1
        },
        duration: 1800, // Default to 30 mins (1800 seconds)
        thumbnail: '',
        order: video.classNumber
      };

      batch.set(docRef, videoData, { merge: true });
      console.log(`Prepared: ${video.title}`);
    });

    await batch.commit();
    console.log('Successfully seeded all 19 videos into Firestore! Database is ready.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to seed videos:', err);
    process.exit(1);
  }
};

seedVideos();
