import { vs as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINAY_API_SECRET
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) return null;
        //upload file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto"
        })
        console.log("File uploaded successfully On Cloudinary", response.url);
        return response
    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved temp file as the uplad failed
        return null;
    }
}

export default uploadOnCloudinary;