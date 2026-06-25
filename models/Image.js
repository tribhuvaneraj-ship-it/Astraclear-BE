import mongoose from 'mongoose';

const imageSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    originalUrl: { type: String, required: true },
    processedUrl: { type: String, default: null },
    status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    coordinates: { lat: Number, lng: Number },
    cloudCoverage: { type: Number, default: 0 } // Percentage
}, { timestamps: true });

export default mongoose.model('Image', imageSchema);