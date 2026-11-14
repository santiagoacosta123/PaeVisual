import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

app.post("/api/imagenes", upload.single("imagen"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No se envió imagen" });

    const resultado = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: "mi-app" }, (err, result) =>
          err ? reject(err) : resolve(result)
        )
        .end(req.file.buffer);
    });

    res.json({ url: resultado.secure_url, public_id: resultado.public_id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al subir la imagen" });
  }
});

app.delete("/api/imagenes", async (req, res) => {
  try {
    await cloudinary.uploader.destroy(req.body.public_id);
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "Error al eliminar la imagen" });
  }
});

app.listen(3000, () => console.log("Servidor en http://localhost:3000"));
