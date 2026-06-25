import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    text: { type: String, default: '' },
    imageUrl: { type: String, default: null },
}, { timestamps: true });

export default mongoose.model('Message', messageSchema);
