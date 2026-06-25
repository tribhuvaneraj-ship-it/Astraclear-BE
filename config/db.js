import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongoServer;

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: 5000,
            connectTimeoutMS: 5000,
        });
        console.log(`MongoDB Atlas Connected: ${mongoose.connection.host}`);
    } catch (err) {
        console.warn(`Atlas connection failed: ${err.message}`);
        console.log('Starting in-memory MongoDB...');
        mongoServer = await MongoMemoryServer.create();
        const uri = mongoServer.getUri();
        await mongoose.connect(uri);
        console.log(`MongoDB In-Memory Connected: ${mongoose.connection.host}`);
    }
};

export default connectDB;
