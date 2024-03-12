import fs from "fs";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLODINARY_API_SECRET,
});
const uploadCloudinary = async (localfilePath) => {
  try {
    if (!localfilePath) return null;

    const response = await cloudinary.uploader.upload(localfilePath, {
      resource_type: "auto",
    });
    console.log(response.url);
    // file has been succesfully uploaded on cloudnary
  } catch (error) {
    fs.unlinkSync(localfilePath);
    return null;
    // remove the unploaded locally saved temporary file as the upload operation got failed
  }
};

export { uploadCloudinary };
