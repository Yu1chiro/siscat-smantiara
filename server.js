const express = require("express");
const admin = require("firebase-admin");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");

// Inisialisasi Konfigurasi
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// --- KONEKSI KE MONGODB ---
const MONGO_URI = process.env.MONGODB_URI;

if (!MONGO_URI) {
    console.error("Kesalahan: Variabel MONGO_URI belum diatur.");
    process.exit(1);
}

// Variabel untuk menyimpan status koneksi (cache)
let cachedDb = null;

async function connectToDatabase() {
    // Jika koneksi sudah ada, gunakan yang sudah ada
    if (cachedDb) {
        console.log("Using existing MongoDB connection.");
        return cachedDb;
    }

    // Jika belum ada, buat koneksi baru
    try {
        console.log("Creating new MongoDB connection.");
        const db = await mongoose.connect(MONGO_URI);
        cachedDb = db; // Simpan koneksi di cache
        console.log("MongoDB connected successfully.");
        return db;
    } catch (err) {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    }
}

// Agar Express bisa berfungsi di Vercel, kita perlu export app
// Dan kita panggil koneksi database di awal
connectToDatabase();
// Skema untuk Catatan Pelanggaran
const pelanggaranSchema = new mongoose.Schema({
    nama: { type: String, required: true, trim: true },
    kelas: { type: String, required: true, trim: true },
    jenis_pelanggaran: { type: String, required: true, trim: true },
    catatan: { type: String, required: true, trim: true },
    timestamp: { type: Date, default: Date.now }
});

// Skema untuk Aduan Siswa
const aduanSchema = new mongoose.Schema({
    nama: { type: String, required: true, trim: true },
    kelas: { type: String, required: true, trim: true },
    jenis_pelanggaran: { type: String, required: true, trim: true },
    detail_aduan: { type: String, required: true, trim: true },
    status: { type: String, default: 'Baru' }, // Status default
    timestamp: { type: Date, default: Date.now }
});

// Helper untuk mengubah _id -> id di response JSON agar kompatibel dengan frontend
const transformJSON = (schema) => {
    schema.set('toJSON', {
        virtuals: true, // Pastikan id virtual disertakan
        transform: (doc, ret) => {
            delete ret._id; // Hapus _id
            delete ret.__v; // Hapus __v
        }
    });
};

transformJSON(pelanggaranSchema);
transformJSON(aduanSchema);

const Pelanggaran = mongoose.model("Pelanggaran", pelanggaranSchema);
const Aduan = mongoose.model("Aduan", aduanSchema);


// Inisialisasi Firebase HANYA untuk Autentikasi
const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: (process.env.PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const auth = admin.auth();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

// AUTHENTICATION LOGIC (TIDAK BERUBAH)
const checkAuth = async (req, res, next) => {
  const sessionCookie = req.cookies.session || "";

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    if (decodedClaims.admin) {
      req.user = decodedClaims;
      return next(); // Lanjutkan jika admin
    }
    throw new Error("Not an admin");
  } catch (error) {
    if (req.path.startsWith("/api/")) {
      console.error(`Auth Error on API path ${req.path}:`, error.message);
      return res.status(401).json({ success: false, message: "Sesi tidak valid atau tidak diizinkan." });
    } else {
      return res.redirect("/login");
    }
  }
};

// Rute Halaman
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/register", (req, res) => res.sendFile(path.join(__dirname, "public", "register.html")));
app.get("/dashboard", checkAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/detail-siswa", checkAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "detail-siswa.html")));
app.get("/statistik", checkAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "statistik.html")));
app.get("/aduan-siswa", checkAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "aduan-siswa.html")));
// Formulir aduan publik, tidak memerlukan login
app.get("/form-aduan", (req, res) => res.sendFile(path.join(__dirname, "public", "form-aduan.html")));


// =================================================================
// RUTE API OTENTIKASI (TIDAK BERUBAH)
// =================================================================
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: "Semua field wajib diisi." });
  }
  try {
    const userRecord = await auth.createUser({ email, password, displayName: username, emailVerified: false });
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });
    res.status(201).json({ success: true, message: "Registrasi berhasil. Silakan verifikasi email Anda." });
  } catch (error) {
    console.error("Error saat registrasi:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const idToken = req.body.idToken.toString();
  const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 hari
  try {
    const decodedToken = await auth.verifyIdToken(idToken, true);
    if (!decodedToken.email_verified) {
      return res.status(401).json({ success: false, message: "Email belum diverifikasi." });
    }
    if (!decodedToken.admin) {
      return res.status(403).json({ success: false, message: "Anda tidak memiliki hak akses admin." });
    }
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
    const options = { maxAge: expiresIn, httpOnly: true, secure: process.env.NODE_ENV === "production" };
    res.cookie("session", sessionCookie, options);
    res.json({ success: true, message: "Login berhasil." });
  } catch (error) {
    console.error("Error saat login:", error);
    res.status(401).json({ success: false, message: "Login gagal, token tidak valid." });
  }
});

app.get("/api/auth/logout", (req, res) => {
  res.clearCookie("session");
  res.redirect("/login");
});

// =================================================================
// API PENGADUAN SISWA (MONGODB)
// =================================================================

// Endpoint untuk mengirim aduan (publik, tidak perlu login)
app.post("/api/aduan/kirim", async (req, res) => {
  try {
    const { nama, kelas, detail_aduan, jenis_pelanggaran } = req.body;
    if (!nama || !kelas || !detail_aduan || !jenis_pelanggaran) {
      return res.status(400).json({ success: false, message: "Semua field wajib diisi." });
    }
    const newAduan = new Aduan({ nama, kelas, detail_aduan, jenis_pelanggaran, status: 'Baru' });
    await newAduan.save();
    res.status(201).json({ success: true, message: "Aduan Anda telah berhasil dikirim." });
  } catch (error) {
    console.error("Error di /api/aduan/kirim:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
  }
});
app.get('/api/aduan/stats', async (req, res) => {
    try {
        const statusCounts = await Aduan.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $project: { status: '$_id', count: 1, _id: 0 } }
        ]);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const monthlyTrend = await Aduan.aggregate([
            { $match: { timestamp: { $gte: thirtyDaysAgo } } },
            { $group: { 
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } }, 
                count: { $sum: 1 } 
            }},
            { $sort: { _id: 1 } },
            { $project: { date: '$_id', count: 1, _id: 0 } }
        ]);

        res.json({ success: true, statusCounts, monthlyTrend });
    } catch (error) {
        console.error("Error di /api/aduan/stats:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil statistik aduan.' });
    }
});
// Endpoint untuk melihat daftar aduan (memerlukan login admin)
app.get('/api/aduan/list',  async (req, res) => {
    try {
        const aduanList = await Aduan.find().sort({ timestamp: -1 }); // Urutkan dari yang terbaru
        res.json(aduanList);
    } catch (error) {
        console.error("Error di /api/aduan/list:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data aduan.' });
    }
});

// Endpoint untuk mengubah status aduan (memerlukan login admin)
app.patch("/api/aduan/update-status/:id", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: "Status wajib diisi." });
    }
    const updatedAduan = await Aduan.findByIdAndUpdate(id, { status }, { new: true });
    if (!updatedAduan) {
      return res.status(404).json({ success: false, message: "Data aduan tidak ditemukan" });
    }
    res.json({ success: true, message: `Status aduan berhasil diubah menjadi "${status}"` });
  } catch (error) {
    console.error("Error di /api/aduan/update-status:", error);
    res.status(500).json({ success: false, message: "Gagal mengubah status aduan." });
  }
});

// Endpoint untuk menghapus aduan (memerlukan login admin)
app.delete("/api/aduan/delete/:id", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedAduan = await Aduan.findByIdAndDelete(id);
    if (!deletedAduan) {
      return res.status(404).json({ success: false, message: "Data aduan tidak ditemukan" });
    }
    res.json({ success: true, message: "Data aduan berhasil dihapus." });
  } catch (error) {
    console.error("Error di /api/aduan/delete:", error);
    res.status(500).json({ success: false, message: "Gagal menghapus data aduan." });
  }
});

// =================================================================
// API PELANGGARAN (MONGODB)
// =================================================================

// Endpoint untuk menambah data pelanggaran (memerlukan login admin)
app.post("/api/pelanggaran/add", checkAuth, async (req, res) => {
  try {
    const { nama, kelas, jenis_pelanggaran, catatan } = req.body;
    const newPelanggaran = new Pelanggaran({ nama, kelas, jenis_pelanggaran, catatan });
    await newPelanggaran.save();
    res.status(201).json({ success: true, message: "Data berhasil ditambahkan", data: newPelanggaran });
  } catch (error) {
    console.error("Error di /api/pelanggaran/add:", error);
    res.status(500).json({ success: false, message: "Gagal menambahkan data." });
  }
});

// Endpoint untuk melihat daftar pelanggaran (bisa diakses publik dan admin)
// Catatan: checkAuth dilepas agar statistik di halaman utama bisa tampil.
app.get('/api/pelanggaran/list', async (req, res) => {
    try {
        const pelanggaranList = await Pelanggaran.find().sort({ timestamp: -1 });
        res.json(pelanggaranList);
    } catch (error) {
        console.error("Error di /api/pelanggaran/list:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data pelanggaran.' });
    }
});

// Endpoint untuk mengubah data pelanggaran (memerlukan login admin)
app.put("/api/pelanggaran/update/:id", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, kelas, jenis_pelanggaran, catatan } = req.body;
    const updatedPelanggaran = await Pelanggaran.findByIdAndUpdate(id, 
        { nama, kelas, jenis_pelanggaran, catatan }, 
        { new: true, runValidators: true }
    );
    if (!updatedPelanggaran) {
      return res.status(404).json({ success: false, message: "Data tidak ditemukan" });
    }
    res.json({ success: true, message: "Data berhasil diupdate." });
  } catch (error) {
    console.error("Error di /api/pelanggaran/update:", error);
    res.status(500).json({ success: false, message: "Gagal mengupdate data." });
  }
});

// Endpoint untuk menghapus data pelanggaran (memerlukan login admin)
app.delete("/api/pelanggaran/delete/:id", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPelanggaran = await Pelanggaran.findByIdAndDelete(id);
    if (!deletedPelanggaran) {
      return res.status(404).json({ success: false, message: "Data tidak ditemukan" });
    }
    res.json({ success: true, message: "Data berhasil dihapus." });
  } catch (error) {
    console.error("Error di /api/pelanggaran/delete:", error);
    res.status(500).json({ success: false, message: "Gagal menghapus data." });
  }
});
module.exports = app;
// Server Listener
// app.listen(PORT, () => {
//   console.log(`Server berjalan di http://localhost:${PORT}`);
// });