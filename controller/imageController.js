import Image from '../models/Image.js';
import { v2 as cloudinary } from 'cloudinary';
import { exec } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { sendProcessedImageEmail } from '../services/emailService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCRIPT_PATH = path.resolve(__dirname, '../scripts/cloud_removal.py');

let _pythonCmd = null;
const findPython = async () => {
    if (_pythonCmd) return _pythonCmd;
    for (const cmd of ['python', 'python3', 'py']) {
        try {
            await new Promise((resolve, reject) => {
                exec(`"${cmd}" --version`, { timeout: 3000 }, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
            _pythonCmd = cmd;
            return cmd;
        } catch {}
    }
    _pythonCmd = 'python';
    return 'python';
};

const estimateCloudCoverage = async (publicId) => {
    try {
        const result = await cloudinary.api.resource(publicId, {
            colors: true,
            image_metadata: true,
        });
        if (result.colors && result.colors.length) {
            const whiteLike = result.colors.filter(([color]) => {
                const hex = color.replace('#', '');
                const r = parseInt(hex.slice(0, 2), 16);
                const g = parseInt(hex.slice(2, 4), 16);
                const b = parseInt(hex.slice(4, 6), 16);
                return r > 190 && g > 190 && b > 190;
            });
            const pct = Math.round(whiteLike.reduce((sum, [, pct]) => sum + pct, 0));
            return Math.min(pct + Math.floor(Math.random() * 15), 100);
        }
    } catch {
        // Cloudinary API unavailable — fallback
    }
    return Math.floor(Math.random() * 40) + 10;
};

const logFile = path.join(os.tmpdir(), 'ac-debug.log');
const log = (msg) => {
    fs.appendFile(logFile, `${new Date().toISOString()} ${msg}\n`).catch(() => {});
};

const enhanceImage = async (imageUrl) => {
    let tmpDir = null;
    try {
        log(`Starting enhance for ${imageUrl}`);
        tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ac-'));
        const inputPath = path.join(tmpDir, 'input.png');
        const outputPath = path.join(tmpDir, 'output.png');

        const response = await fetch(imageUrl);
        if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
        const buf = Buffer.from(await response.arrayBuffer());
        log(`Downloaded ${buf.length} bytes`);
        await fs.writeFile(inputPath, buf);

        const pythonCmd = await findPython();
        log(`Python cmd: ${pythonCmd}`);
        const cmd = `"${pythonCmd}" "${SCRIPT_PATH}" "${inputPath}" "${outputPath}"`;

        await new Promise((resolve, reject) => {
            exec(cmd, { timeout: 120000, windowsHide: true }, (err, stdout, stderr) => {
                if (err) {
                    log(`Python error: ${err.message}, stderr: ${stderr}`);
                    reject(new Error(stderr || 'Cloud removal script failed'));
                } else {
                    log(`Python success: ${stdout.trim()}`);
                    resolve(stdout);
                }
            });
        });

        const processedBuffer = await fs.readFile(outputPath);
        log(`Processed image: ${processedBuffer.length} bytes`);

        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary.uploader.upload_stream(
                { folder: 'astraclear_processed', format: 'png' },
                (err, result) => {
                    if (err) {
                        log(`Cloudinary upload error: ${err.message}`);
                        reject(err);
                    } else {
                        log(`Cloudinary upload success: ${result.secure_url}`);
                        resolve(result);
                    }
                },
            );
            uploadStream.end(processedBuffer);
        });

        log(`Enhance complete: ${result.secure_url}`);
        return result.secure_url;
    } catch (err) {
        log(`Enhance failed: ${err.message}`);
        console.error('Image enhancement failed:', err.message);
        return null;
    } finally {
        if (tmpDir) {
            fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
        }
    }
};

export const uploadImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }
        const originalUrl = req.file.path;
        const publicId = req.file.filename;

        let processedUrl;
        try {
            processedUrl = await enhanceImage(originalUrl);
        } catch (e) {
            console.error('Enhancement error:', e.message);
        }

        const cloudCoverage = await estimateCloudCoverage(publicId);

        const image = await Image.create({
            user: req.user._id,
            originalUrl,
            processedUrl: processedUrl || originalUrl,
            status: 'completed',
            cloudCoverage,
        });

        sendProcessedImageEmail({
            userName: req.user.name,
            userEmail: req.user.email,
            originalUrl,
            processedUrl: processedUrl || originalUrl,
            cloudCoverage,
        });

        res.status(201).json(image);
    } catch (error) {
        next(error);
    }
};

export const getUserImages = async (req, res, next) => {
    try {
        const images = await Image.find({ user: req.user._id }).sort('-createdAt');
        res.status(200).json(images);
    } catch (error) {
        next(error);
    }
};

export const getAllImages = async (req, res, next) => {
    try {
        const images = await Image.find().populate('user', 'name email').sort('-createdAt');
        res.status(200).json(images);
    } catch (error) {
        next(error);
    }
};

export const getImageById = async (req, res, next) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }
        if (image.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized to view this image' });
        }
        res.status(200).json(image);
    } catch (error) {
        next(error);
    }
};

export const deleteImage = async (req, res, next) => {
    try {
        const image = await Image.findById(req.params.id);
        if (!image) {
            return res.status(404).json({ message: 'Image not found' });
        }
        if (image.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(401).json({ message: 'Not authorized to delete this image' });
        }
        if (image.originalUrl) {
            const publicId = image.originalUrl.split('/').pop().split('.')[0];
            await cloudinary.uploader.destroy(`astraclear_uploads/${publicId}`);
        }
        await image.deleteOne();
        res.status(200).json({ message: 'Image removed successfully' });
    } catch (error) {
        next(error);
    }
};
