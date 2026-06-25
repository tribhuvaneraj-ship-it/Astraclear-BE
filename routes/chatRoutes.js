import express from 'express';
import { getMessages, sendMessage } from '../controller/chatController.js';
import { protect } from '../middleware/authMiddleware.js';
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

const router = express.Router();

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => ({
        folder: 'astraclear_chat',
        allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
        public_id: `chat_${Date.now()}`,
    }),
});

const upload = multer({ storage });

router.get('/', protect, getMessages);

router.post('/', protect, upload.single('chatImage'), sendMessage);

export default router;
