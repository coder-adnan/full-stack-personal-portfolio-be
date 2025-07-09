"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cloudinaryStorage = void 0;
const cloudinary_1 = require("cloudinary");
const multer_storage_cloudinary_1 = require("multer-storage-cloudinary");
// Configure Cloudinary
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
// Configure Cloudinary storage for multer
exports.cloudinaryStorage = new multer_storage_cloudinary_1.CloudinaryStorage({
    cloudinary: cloudinary_1.v2,
    params: {
        folder: "blog-images",
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
        transformation: [
            { width: 1200, height: 800, crop: "limit" }, // Resize large images
            { quality: "auto:good" }, // Optimize quality
        ],
    },
});
exports.default = cloudinary_1.v2;
