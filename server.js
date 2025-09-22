const express = require("express");
const admin = require("firebase-admin");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
const mongoose = require("mongoose");
const { body, validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const axios = require('axios'); // Untuk membuat HTTP request ke Firebase
const cors = require('cors');

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

// GANTI FUNGSI connectToDatabase LAMA ANDA DENGAN YANG INI

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
    console.log("✅ MongoDB connected successfully.");
    return db;
  } catch (err) {
    console.error("❌ MongoDB connection error:", err.message);
    // Jangan pakai process.exit(1), biarkan errornya ditangkap oleh pemanggil fungsi
    throw err;
  }
}

connectToDatabase();
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Fungsi untuk mengirim email notifikasi aduan baru.
 * @param {string} recipientEmail 
 * @param {object} aduanData 
 */
const sendNotificationEmail = async (recipientEmail, aduanData) => {
  const { nama, kelas, jenis_pelanggaran } = aduanData;
  const mailOptions = {
    from: `"Sistem Notifikasi" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: `🚨 Laporan Aduan dari : ${nama}`,
    html: `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=publicice-width, initial-scale=1.0">
            <title>Laporan Aduan Siswa</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                
                <!-- Header -->
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      Notifikasi Laporan Terbaru
                    </h1>
                    <p style="color: #e8eaf6; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">
                        Sistem Notifikasi SISCAT-SMANTIARA
                    </p>
                </div>

                <!-- Content -->
                <div style="padding: 40px 30px;">
                    
                    <!-- Alert Box -->
                    <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 20px; margin-bottom: 30px; border-left: 5px solid #f39c12;">
                        <div style="display: flex; align-items: center;">
                            <span style="font-size: 24px; margin-right: 15px;">⚠️</span>
                            <div>
                                <h3 style="margin: 0; color: #856404; font-size: 18px; font-weight: 600;">
                                    Laporan Terbaru Siswa
                                </h3>
                                <p style="margin: 5px 0 0; color: #856404; font-size: 14px;">
                                    Laporan aduan terkait <strong>${jenis_pelanggaran}</strong>
                                </p>
                            </div>
                        </div>
                    </div>

                    <!-- Divider -->
                    <div style="height: 2px; background: linear-gradient(to right, #667eea, #764ba2); margin: 30px 0; border-radius: 2px;"></div>

                    <!-- Detail Section -->
                    <div style="margin-bottom: 30px;">
                        <h3 style="color: #333; font-size: 20px; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center;">
                            <span style="margin-right: 10px;">📋</span>
                            Detail Aduan
                        </h3>
                        
                        <div style="background-color: #f8f9fa; border-radius: 10px; padding: 25px; border: 1px solid #e9ecef;">
                            <div style="display: grid; gap: 15px;">
                                
                                <!-- Nama Pelapor -->
                                <div style="margin-bottom:1rem; display: flex; align-items: center; padding: 12px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                    <div style="display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                                        <span style="font-size: 18px;">👤</span>
                                    </div>
                                    <div>
                                        <span style="font-size: 12px; color: #666; text-transform: uppercase; font-weight: 500; letter-spacing: 0.5px;">Nama Pelapor</span>
                                        <div style="font-size: 16px; color: #333; font-weight: 600; margin-top: 2px;">${nama}</div>
                                    </div>
                                </div>

                                <!-- Kelas -->
                                <div style="margin-bottom:1rem; display: flex; align-items: center; padding: 12px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                    <div style="display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                                        <span style="font-size: 18px;">🎓</span>
                                    </div>
                                    <div>
                                        <span style="font-size: 12px; color: #666; text-transform: uppercase; font-weight: 500; letter-spacing: 0.5px;">Kelas</span>
                                        <div style="font-size: 16px; color: #333; font-weight: 600; margin-top: 2px;">${kelas}</div>
                                    </div>
                                </div>

                                <!-- Jenis Pelanggaran -->
                                <div style="margin-bottom:1rem; display: flex; align-items: center; padding: 12px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                    <div style="display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                                        <span style="font-size: 18px;">⚡</span>
                                    </div>
                                    <div>
                                        <span style="font-size: 12px; color: #666; text-transform: uppercase; font-weight: 500; letter-spacing: 0.5px;">Jenis Pelanggaran</span>
                                        <div style="font-size: 16px; color: #333; font-weight: 600; margin-top: 2px;">${jenis_pelanggaran}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Call to Action -->
                    <div style="text-align: center; margin: 40px 0;">
                        <p style="color: #555; font-size: 16px; margin-bottom: 25px; line-height: 1.5;">
                            Silakan tindak lanjuti laporan ini dengan mengklik button dibawah
                        </p>
                        
                        <a href="https://siscat-smantiara.vercel.app/aduan-siswa" 
                           target="_blank" 
                           style="display: inline-block; 
                                  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                  color: #ffffff; 
                                  text-decoration: none; 
                                  padding: 15px 35px; 
                                  border-radius: 50px; 
                                  font-weight: 600; 
                                  font-size: 16px; 
                                  text-transform: uppercase; 
                                  letter-spacing: 0.5px; 
                                  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
                                  transition: all 0.3s ease;">
                          Cek Aduan Siswa
                        </a>
                    </div>

                    <!-- Info Box -->
                    <div style="background-color: #e3f2fd; border-radius: 8px; padding: 20px; margin-top: 30px; border-left: 4px solid #2196f3;">
                        <div style="display: flex; align-items: center;">
                            <span style="font-size: 20px; margin-right: 10px;">💡</span>
                            <div>
                                <p style="margin: 0; color: #1565c0; font-size: 14px; line-height: 1.4;">
                                     Notifikasi dikirim secara otomatis oleh sistem. 
                                    Mohon segera menindaklanjuti aduan untuk menjaga ketertiban sekolah.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div style="background-color: #f8f9fa; padding: 25px 30px; border-top: 1px solid #e9ecef; text-align: center;">
                    <div style="margin-bottom: 15px;">
                        <img src="https://1mjtjv6snj.ucarecd.net/9c3fb829-d415-4a23-a7ba-8a9e22a3df2c/images.png"style="width: 80px; height: auto;">
                    </div>
                    <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
                        <strong>SISCAT-SMANTIARA 2025</strong><br>
                        Sistem pengaduan dan pencatatan pelanggaran SMAN 3 Singaraja<br>
                        <span style="color: #999; font-size: 12px;">
                            Email ini dikirim pada ${new Date().toLocaleDateString("id-ID", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                        </span>
                    </p>
                </div>
            </div>
        </body>
        </html>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email notifikasi terkirim ke: ${recipientEmail}`);
  } catch (error) {
    console.error(`Gagal mengirim email ke ${recipientEmail}:`, error);
  }
};

/**
 * @param {string} recipientEmail 
 * @param {object} aduanData 
 */
const sendStatusUpdateEmailToStudent = async (recipientEmail, aduanData) => {
    const { nama, jenis_pelanggaran, status } = aduanData;

    let statusMessage = '';
    if (status === 'Diproses') {
        statusMessage = 'sedang dalam peninjauan dan investigasi lebih lanjut oleh pihak sekolah.';
    } else if (status === 'Selesai') {
        statusMessage = 'telah selesai ditangani. Terima kasih atas kontribusi Anda dalam menjaga keamanan sekolah.';
    } else {
        return; // Jangan kirim email untuk status lain
    }

    const mailOptions = {
        from: `"Admin SISCAT-SMANTIARA" <${process.env.EMAIL_USER}>`,
        to: recipientEmail,
        subject: `Hallo ${nama}`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <p>Terima kasih telah mengirimkan laporan melalui SISCAT-SMANTIARA</p>
                <p>Kami ingin menyampaikan bahwa laporan anda mengenai <strong>"${jenis_pelanggaran}"</strong> sudah kami terima</p>
                <p>Ini berarti laporan Anda ${statusMessage}</p>
                <p>Kami sangat menghargai keberanian dan kepedulian Anda terkait ketertiban lingkungan sekolah</p>
                <br>
                <p>Hormat kami,</p>
                <p>
                Admin SISCAT-SMANTIARA
                </p>
            </div>
        `,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email status update terkirim ke siswa: ${recipientEmail}`);
    } catch (error) {
        console.error(`Gagal mengirim email status update ke ${recipientEmail}:`, error);
    }
};
// Letakkan ini setelah fungsi sendStatusUpdateEmailToStudent

/**
 * Fungsi untuk mengirim email verifikasi ke admin baru.
 * @param {string} recipientEmail
 * @param {string} verificationLink
 */
const sendVerificationEmail = async (recipientEmail, verificationLink) => {
  const mailOptions = {
    from: `"Admin SISCAT-SMANTIARA" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: "Verifikasi Email Anda untuk SISCAT-SMANTIARA",
    html: `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-g">
            <title>Verifikasi Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 40px;">
            <div style="max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                <h2>Selamat Datang di SISCAT-SMANTIARA!</h2>
                <p>Terima kasih telah mendaftar. Silakan verifikasi alamat email Anda dengan mengklik tombol di bawah ini.</p>
                <a href="${verificationLink}" 
                   style="display: inline-block; 
                          background-color: #007bff; 
                          color: #ffffff; 
                          padding: 15px 25px; 
                          text-decoration: none; 
                          border-radius: 5px; 
                          margin-top: 20px;
                          font-weight: bold;">
                   Verifikasi Email Saya
                </a>
                <p style="margin-top: 30px; font-size: 12px; color: #888;">
                    Jika Anda tidak mendaftar untuk akun ini, Anda dapat mengabaikan email ini.
                </p>
            </div>
        </body>
        </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email verifikasi terkirim ke: ${recipientEmail}`);
  } catch (error) {
    console.error(`Gagal mengirim email verifikasi ke ${recipientEmail}:`, error);
  }
};
// Skema untuk Catatan Pelanggaran
const pelanggaranSchema = new mongoose.Schema({
  nama: { type: String, required: true, trim: true },
  kelas: { type: String, required: true, trim: true },
  jenis_pelanggaran: { type: String, required: true, trim: true },
  catatan: { type: String, required: true, trim: true },
  timestamp: { type: Date, default: Date.now },
});

// Skema untuk Aduan Siswa
const aduanSchema = new mongoose.Schema({
    nama: { type: String, required: true, trim: true },
    email: { type: String, required: false, trim: true }, // <-- TAMBAHKAN BARIS INI
    kelas: { type: String, required: true, trim: true },
    jenis_pelanggaran: { type: String, required: true, trim: true },
    detail_aduan: { type: String, required: true, trim: true },
    status: { type: String, default: 'Baru' },
    timestamp: { type: Date, default: Date.now }
});

// Helper untuk mengubah _id -> id di response JSON agar kompatibel dengan frontend
const transformJSON = (schema) => {
  schema.set("toJSON", {
    virtuals: true, // Pastikan id virtual disertakan
    transform: (doc, ret) => {
      delete ret._id; // Hapus _id
      delete ret.__v; // Hapus __v
    },
  });
};
const notificationSchema = new mongoose.Schema({
  emails: [{ type: String, required: true, trim: true }], // Menggunakan array 'emails'
  notifyOnAduan: { type: Boolean, default: true },
  notifyOnPelanggaran: { type: Boolean, default: false },
});

transformJSON(notificationSchema);
transformJSON(pelanggaranSchema);
transformJSON(aduanSchema);

const Pelanggaran = mongoose.model("Pelanggaran", pelanggaranSchema);
const Aduan = mongoose.model("Aduan", aduanSchema);
const Notification = mongoose.model("Notification", notificationSchema);

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
app.use(cors()); // Mengaktifkan Cross-Origin Resource Sharing
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
app.get("/monitor", checkAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "monitor.html")));
// Formulir aduan publik, tidak memerlukan login
app.get("/form-aduan", (req, res) => res.sendFile(path.join(__dirname, "public", "form-aduan.html")));

// =================================================================
// RUTE API OTENTIKASI (TIDAK BERUBAH)
// =================================================================
// GANTI RUTE REGISTER LAMA ANDA DENGAN YANG INI

app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ success: false, message: "Semua field wajib diisi." });
  }

  try {
    // 1. Buat user (tidak berubah)
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: username,
      emailVerified: false, // <-- Status awal tetap false
    });

    // 2. Set custom claims (tidak berubah)
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });

    // --- LOGIKA BARU UNTUK KIRIM EMAIL VERIFIKASI ---
    // 3. Buat link verifikasi
    const verificationLink = await auth.generateEmailVerificationLink(email);

    // 4. Kirim email menggunakan fungsi yang baru dibuat
    await sendVerificationEmail(email, verificationLink);
    // --------------------------------------------------

    // Respon sukses (tidak berubah, karena frontend sudah menampilkan pesan yang benar)
    res.status(201).json({
      success: true,
      message:
        "Registrasi berhasil. Silakan cek email Anda untuk verifikasi.",
    });
  } catch (error) {
    console.error("Error saat registrasi:", error);
    // Memberikan pesan error yang lebih spesifik jika email sudah terdaftar
    if (error.code === 'auth/email-already-exists') {
        return res.status(409).json({ success: false, message: "Email ini sudah terdaftar. Silakan gunakan email lain." });
    }
    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
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
app.get('/api/get-token', async (req, res) => {
    // Ambil URL database dari environment variable
    const dbUrl = process.env.DATABASE_URL;

    // Cek apakah DATABASE_URL sudah diatur di file .env
    if (!dbUrl) {
        console.error('Error: DATABASE_URL tidak ditemukan di file .env');
        return res.status(500).json({ success: false, message: 'Konfigurasi server error.' });
    }

    // Buat URL lengkap untuk mengakses access_token di Firebase
    const tokenUrl = `${dbUrl}token/access_token.json`;

    try {
        // Lakukan GET request ke URL Firebase
        const response = await axios.get(tokenUrl);
        const accessToken = response.data;

        // Kirim token kembali ke client dalam format JSON
        res.status(200).json({ success: true, token: accessToken });

    } catch (error) {
        // Tangani error jika gagal mengambil data dari Firebase
        console.error('Gagal mengambil token dari Firebase:', error.message);
        res.status(500).json({ success: false, message: 'Tidak dapat terhubung ke database.' });
    }
});
// =================================================================
// API KONFIGURASI NOTIFIKASI (BARU)
// =================================================================
app.post("/api/notifications/subscribe", checkAuth, async (req, res) => {
  // Sekarang menerima sebuah array 'emails'
  const { emails, notifyOnAduan } = req.body;

  // Validasi sederhana, pastikan 'emails' adalah array dan tidak kosong
  if (!Array.isArray(emails) || emails.length === 0 || emails.some((e) => !e)) {
    return res.status(400).json({ success: false, message: "Minimal harus ada satu email yang valid." });
  }

  try {
    // Selalu update atau buat satu dokumen konfigurasi (upsert)
    await Notification.findOneAndUpdate(
      {}, // Filter kosong untuk menemukan dokumen apa saja (karena hanya ada satu)
      { emails, notifyOnAduan },
      { new: true, upsert: true, runValidators: true }
    );
    res.json({ success: true, message: "Konfigurasi notifikasi berhasil disimpan." });
  } catch (error) {
    console.error("Error di /api/notifications/subscribe:", error);
    res.status(500).json({ success: false, message: "Gagal menyimpan konfigurasi." });
  }
});

app.get("/api/notifications/config", checkAuth, async (req, res) => {
  try {
    const config = await Notification.findOne(); // Cukup cari satu dokumen
    if (!config || config.emails.length === 0) {
      return res.status(404).json({ success: false, message: "Belum ada konfigurasi email." });
    }
    res.json({ success: true, data: config });
  } catch (error) {
    console.error("Error di /api/notifications/config:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil konfigurasi." });
  }
});
// =================================================================
// API MONITORING FINAL - MENGHITUNG UKURAN STORAGE PER KOLEKSI
// =================================================================
app.get("/api/db/storage-usage", checkAuth, async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ success: false, message: "Database sedang tidak terhubung." });
    }

    let totalStorageSize = 0;
    let totalDocuments = 0;
    const db = mongoose.connection.db;

    // Fungsi untuk mendapatkan stats koleksi dengan aman
    const getCollectionStats = async (collectionName) => {
      try {
        // Cek apakah koleksi ada
        const collections = await db.listCollections({ name: collectionName }).toArray();
        if (collections.length === 0) {
          return { storageSize: 0, count: 0 }; // Koleksi belum dibuat, ukuran 0
        }
        const stats = await db.command({ collStats: collectionName });
        return { storageSize: stats.storageSize || 0, count: stats.count || 0 };
      } catch (error) {
        console.warn(`Peringatan: Tidak dapat mengambil stats untuk koleksi '${collectionName}'. Mungkin belum ada data. Error: ${error.message}`);
        return { storageSize: 0, count: 0 }; // Jika ada error, anggap ukuran 0
      }
    };

    // Dapatkan stats untuk koleksi 'pelanggarans' (dari model Pelanggaran)
    const pelanggaranStats = await getCollectionStats("pelanggarans");
    totalStorageSize += pelanggaranStats.storageSize;
    totalDocuments += pelanggaranStats.count;

    // Dapatkan stats untuk koleksi 'aduans' (dari model Aduan)
    const aduanStats = await getCollectionStats("aduans");
    totalStorageSize += aduanStats.storageSize;
    totalDocuments += aduanStats.count;

    res.json({
      success: true,
      usage: {
        // Kirim ukuran dalam bytes, perhitungan MB dilakukan di frontend
        usedStorageBytes: totalStorageSize,
        totalDocuments: totalDocuments,
      },
    });
  } catch (error) {
    console.error("Error di /api/db/storage-usage:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil statistik penggunaan storage." });
  }
});
// =================================================================
// API PENGADUAN SISWA (MONGODB)
// =================================================================
const triggerNotificationEmail = async (aduanData) => {
  try {
    const config = await Notification.findOne({ notifyOnAduan: true });

    if (config && config.emails && config.emails.length > 0) {
      console.log(`Mempersiapkan pengiriman notifikasi ke ${config.emails.length} penerima...`);

      // Menggunakan Promise.all untuk mengirim email secara paralel
      // Ini lebih efisien jika penerimanya banyak
      const emailPromises = config.emails.map(emailAddress =>
        sendNotificationEmail(emailAddress, aduanData)
      );
      
      await Promise.all(emailPromises);
      console.log("Semua email notifikasi berhasil dimasukkan ke antrian pengiriman.");

    } else {
      console.warn(
        "Peringatan: Tidak ada konfigurasi notifikasi aktif untuk aduan baru. Email tidak dikirim."
      );
    }
  } catch (emailError) {
    // Error ini penting agar proses utama tahu jika ada kegagalan
    console.error("Terjadi kegagalan fatal saat proses kirim notifikasi:", emailError);
    // Secara opsional, Anda bisa melempar error lagi jika ingin proses utama berhenti
    // throw new Error("Gagal mengirim notifikasi email.");
  }
};

// Endpoint untuk mengirim aduan (publik, tidak perlu login)
app.post("/api/aduan/kirim",
  [
    body("nama").trim().escape(),
    body("kelas").trim().escape(),
    body("jenis_pelanggaran").trim().escape(),
    body("detail_aduan").trim().escape(),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: "Input tidak valid.", errors: errors.array() });
    }

    try {
      const { nama, kelas, detail_aduan, jenis_pelanggaran, email } = req.body;
      if (!nama || !kelas || !detail_aduan || !jenis_pelanggaran || !email) {
        return res.status(400).json({ success: false, message: "Semua field wajib diisi." });
      }

      // 1. Simpan aduan ke database
      const newAduan = new Aduan({ nama, kelas, detail_aduan, jenis_pelanggaran, email, status: 'Baru' });
      await newAduan.save();
      console.log("Aduan baru berhasil disimpan ke database.");

      // 2. Panggil dan TUNGGU proses notifikasi selesai
      await triggerNotificationEmail(newAduan);

      // 3. Setelah SEMUA proses selesai, baru kirim respons
      res.status(201).json({ success: true, message: "Laporan aduan berhasil di kirim! Kami akan segera memproses aduan Anda." });

    } catch (error) {
      console.error("Error di /api/aduan/kirim:", error);
      res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
    }
  });
app.get("/api/aduan/stats", async (req, res) => {
  try {
    const statusCounts = await Aduan.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }, { $project: { status: "$_id", count: 1, _id: 0 } }]);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const monthlyTrend = await Aduan.aggregate([
      { $match: { timestamp: { $gte: thirtyDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", count: 1, _id: 0 } },
    ]);

    res.json({ success: true, statusCounts, monthlyTrend });
  } catch (error) {
    console.error("Error di /api/aduan/stats:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil statistik aduan." });
  }
});
// Endpoint untuk melihat daftar aduan (memerlukan login admin)
app.get("/api/aduan/list", async (req, res) => {
  try {
    const aduanList = await Aduan.find().sort({ timestamp: -1 }); // Urutkan dari yang terbaru
    res.json(aduanList);
  } catch (error) {
    console.error("Error di /api/aduan/list:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil data aduan." });
  }
});
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

        // --- TRIGGER PENGIRIMAN EMAIL KE SISWA ---
        // Cek jika aduan punya email dan statusnya relevan (Diproses/Selesai)
        if (updatedAduan.email && (updatedAduan.status === 'Diproses' || updatedAduan.status === 'Selesai')) {
            await sendStatusUpdateEmailToStudent(updatedAduan.email, updatedAduan);
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
app.get("/api/pelanggaran/list", async (req, res) => {
  try {
    const pelanggaranList = await Pelanggaran.find().sort({ timestamp: -1 });
    res.json(pelanggaranList);
  } catch (error) {
    console.error("Error di /api/pelanggaran/list:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil data pelanggaran." });
  }
});

// Endpoint untuk mengubah data pelanggaran (memerlukan login admin)
app.put("/api/pelanggaran/update/:id", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, kelas, jenis_pelanggaran, catatan } = req.body;
    const updatedPelanggaran = await Pelanggaran.findByIdAndUpdate(id, { nama, kelas, jenis_pelanggaran, catatan }, { new: true, runValidators: true });
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
// module.exports = app;
// Server Listener
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
