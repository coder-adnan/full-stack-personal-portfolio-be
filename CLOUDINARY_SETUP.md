# Cloudinary Setup Guide

## 1. Create a Cloudinary Account

1. Go to [Cloudinary](https://cloudinary.com/) and sign up for a free account
2. Verify your email address

## 2. Get Your Credentials

1. Log in to your Cloudinary dashboard
2. Go to the "Dashboard" section
3. Copy your:
   - Cloud Name
   - API Key
   - API Secret

## 3. Set Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME="your-cloud-name"
CLOUDINARY_API_KEY="your-api-key"
CLOUDINARY_API_SECRET="your-api-secret"
```

Replace the values with your actual Cloudinary credentials.

## 4. Features

- Images are automatically uploaded to Cloudinary's cloud storage
- Images are stored in a "blog-images" folder
- Automatic image optimization and resizing
- Support for JPG, JPEG, PNG, GIF, and WebP formats
- 10MB file size limit
- Images are automatically optimized for web delivery

## 5. Response Format

When uploading an image, the API returns:

```json
{
  "status": "success",
  "data": {
    "imageUrl": "https://res.cloudinary.com/your-cloud/image/upload/...",
    "publicId": "blog-images/filename",
    "originalName": "original-filename.jpg",
    "size": 123456,
    "format": "jpg",
    "width": 1200,
    "height": 800
  }
}
```

## 6. Benefits

- No local storage required
- Automatic CDN delivery
- Image transformations and optimizations
- Scalable cloud storage
- Better performance for users worldwide
