import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { mkdir, open, unlink } from "node:fs/promises";
import path from "node:path";
import multer from "multer";
import { ApiError } from "../utils/api-error.js";

const uploadDirectory = fileURLToPath(new URL("../../public/images", import.meta.url));
const maxFileSize = 5 * 1024 * 1024;
const maxFiles = 5;
const allowedExtensions = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".pdf", "application/pdf"],
]);

const storage = multer.diskStorage({
  destination: async (_req, _file, callback) => {
    try {
      await mkdir(uploadDirectory, { recursive: true });
      callback(null, uploadDirectory);
    } catch (error) {
      callback(error);
    }
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(path.basename(file.originalname)).toLowerCase();
    callback(null, `${randomUUID()}${extension}`);
  },
});

const multerUpload = multer({
  storage,
  limits: { fileSize: maxFileSize, files: maxFiles },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(path.basename(file.originalname)).toLowerCase();
    if (!allowedExtensions.has(extension) || allowedExtensions.get(extension) !== file.mimetype) {
      return callback(new ApiError(415, "Only JPEG, PNG, GIF, WebP, and PDF files are allowed"));
    }
    return callback(null, true);
  },
});

const removeUploadedFiles = async (files = []) => {
  await Promise.allSettled(files.map((file) => unlink(file.path)));
};

const removeTaskAttachments = async (attachments = []) => {
  const paths = attachments.flatMap(({ url }) => {
    if (typeof url !== "string" || !url.startsWith("/images/")) return [];
    const filename = path.basename(url);
    if (filename !== url.slice("/images/".length)) return [];
    if (!/^[0-9a-f-]{36}\.(jpg|jpeg|png|gif|webp|pdf)$/.test(filename)) return [];
    return [path.join(uploadDirectory, filename)];
  });
  await Promise.allSettled(paths.map((filePath) => unlink(filePath)));
};

const hasValidSignature = async (file) => {
  const handle = await open(file.path, "r");
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const header = buffer.subarray(0, bytesRead);
    switch (file.mimetype) {
      case "image/jpeg":
        return header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
      case "image/png":
        return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
      case "image/gif":
        return header.subarray(0, 6).toString("ascii").match(/^GIF8[79]a$/) !== null;
      case "image/webp":
        return header.length >= 12
          && header.subarray(0, 4).toString("ascii") === "RIFF"
          && header.subarray(8, 12).toString("ascii") === "WEBP";
      case "application/pdf":
        return header.subarray(0, 5).toString("ascii") === "%PDF-";
      default:
        return false;
    }
  } finally {
    await handle.close();
  }
};

export const uploadTaskAttachments = (req, res, next) => {
  multerUpload.array("attachments", maxFiles)(req, res, async (error) => {
    if (!error) {
      try {
        const signaturesAreValid = await Promise.all((req.files ?? []).map(hasValidSignature));
        if (signaturesAreValid.some((isValid) => !isValid)) {
          await removeUploadedFiles(req.files);
          return next(new ApiError(415, "Attachment content does not match its file type"));
        }
      } catch (signatureError) {
        await removeUploadedFiles(req.files);
        return next(signatureError);
      }
      return next();
    }

    await removeUploadedFiles(req.files);
    if (error instanceof multer.MulterError) {
      const statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const message = error.code === "LIMIT_FILE_SIZE"
        ? `Each attachment must be ${maxFileSize / (1024 * 1024)} MB or smaller`
        : error.code === "LIMIT_UNEXPECTED_FILE"
          ? `Upload up to ${maxFiles} files using the attachments field`
          : "Attachment upload is invalid";
      return next(new ApiError(statusCode, message));
    }
    return next(error);
  });
};

export { maxFiles, maxFileSize, removeTaskAttachments, removeUploadedFiles, uploadDirectory };
