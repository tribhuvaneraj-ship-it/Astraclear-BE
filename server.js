import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { v2 as cloudinary } from 'cloudinary';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import imageRoutes from './routes/imageRoutes.js';
import chatRoutes from './routes/chatRoutes.js';
import errorHandler from './middleware/errorMiddleware.js';
import { sendProcessedImageEmail } from './services/emailService.js';

dotenv.config();

// Configure Cloudinary after env vars are loaded
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

connectDB();

const app = express();

// Security middleware
app.use(helmet());

const allowedOrigins = [
    'http://localhost:5173',
    'https://astraclear-1969.web.app',
    process.env.CLIENT_URL,
].filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

app.use(express.json({ limit: '10kb' }));
app.use(mongoSanitize());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/messages', chatRoutes);

// Health Check
app.get('/api/health', (req, res) => res.json({ message: 'AstraClear AI Server Running' }));

// Test email endpoint
app.post('/api/test-email', express.json({ limit: '10kb' }), async (req, res) => {
    try {
        await sendProcessedImageEmail({
            userName: req.body.name || 'Test User',
            userEmail: req.body.email || 'test@example.com',
            originalUrl: 'https://res.cloudinary.com/dght1efh0/image/upload/v1/astraclear_uploads/test',
            processedUrl: 'https://res.cloudinary.com/dght1efh0/image/upload/v1/astraclear_processed/test',
            cloudCoverage: 45,
        });
        res.json({ message: 'Email sent successfully' });
    } catch (e) {
        res.status(500).json({ message: 'Email failed', error: e.message });
    }
});

app.use(errorHandler);

const PORT = process.env.PORT || 5000;

const server = createServer(app);
const io = new Server(server, {
    cors: corsOptions,
});

io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        next();
    } catch {
        next(new Error('Invalid token'));
    }
});

io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.userId}`);
    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.userId}`);
    });
});

app.set('io', io);

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));