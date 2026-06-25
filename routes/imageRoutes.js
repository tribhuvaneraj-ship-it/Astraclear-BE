import express from 'express';
import { 
    uploadImage, 
    getUserImages, 
    getAllImages, 
    getImageById, 
    deleteImage 
} from '../controller/imageController.js';
import { protect, admin } from '../middleware/authMiddleware.js';

// Cloudinary & Multer Imports for File Streaming
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

const router = express.Router();

// -----------------------------------------
// 1. CLOUDINARY & MULTER CONFIGURATION
// -----------------------------------------
// NOTE: cloudinary.config() is called in server.js after dotenv loads env vars

// Set up where and how files are saved in Cloudinary
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => ({
        folder: 'astraclear_uploads',
        allowed_formats: ['jpg', 'jpeg', 'png', 'tiff'],
        public_id: `sat_${Date.now()}`,
    }),
});

const upload = multer({ storage });


// -----------------------------------------
// 2. PUBLIC/PROTECTED ROUTES
// -----------------------------------------

// @route   POST /api/images
// @desc    Upload a new satellite image (Triggers AI simulation)
// @access  Private (User)
router.post('/', protect, upload.single('image'), uploadImage);

// @route   GET /api/images/my-images
// @desc    Get processing history for the logged-in user
// @access  Private (User)
router.get('/my-images', protect, getUserImages);


// -----------------------------------------
// 3. DYNAMIC PARAMETER ROUTES (/::id)
// -----------------------------------------

// @route   GET /api/images/:id
// @desc    Get single image details (Needed for Before/After Comparison UI)
// @access  Private (User)
router.get('/:id', protect, getImageById);

// @route   DELETE /api/images/:id
// @desc    Delete an image and its Cloudinary files
// @access  Private (User or Admin)
router.delete('/:id', protect, deleteImage);


// -----------------------------------------
// 4. ADMIN ROUTES
// -----------------------------------------

// @route   GET /api/images
// @desc    Get all images across all users (Admin Analytics Dashboard)
// @access  Private (Admin only)
// NOTE: This must be placed AFTER the '/my-images' route, 
// otherwise Express will treat 'my-images' as an :id parameter.
router.get('/', protect, admin, getAllImages);


export default router;