import Message from '../models/Message.js';

export const getMessages = async (req, res, next) => {
    try {
        const messages = await Message.find()
            .populate('user', 'name')
            .sort({ createdAt: 1 })
            .limit(100);
        res.status(200).json(messages);
    } catch (error) {
        next(error);
    }
};

export const sendMessage = async (req, res, next) => {
    try {
        const { text } = req.body;
        const imageUrl = req.file ? req.file.path : null;

        if (!text?.trim() && !imageUrl) {
            return res.status(400).json({ message: 'Message text or image is required' });
        }

        const message = await Message.create({
            user: req.user._id,
            username: req.user.name,
            text: text?.trim() || '',
            imageUrl,
        });

        const populated = await message.populate('user', 'name');

        const io = req.app.get('io');
        if (io) {
            io.emit('new_message', populated);
        }

        res.status(201).json(populated);
    } catch (error) {
        next(error);
    }
};
