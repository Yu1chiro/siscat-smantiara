const express = require("express");
const admin = require("firebase-admin");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
const path = require("path");
const { Pool } = require("pg");
const { body, validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const axios = require("axios");
const cors = require("cors");

// Inisialisasi Konfigurasi
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// --- KONEKSI KE NEONDB (POSTGRESQL) ---
const pool = new Pool({
  connectionString: process.env.DATABASE_NEON,
  ssl: {
    rejectUnauthorized: false,
  },
});

// Tes koneksi database
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error("❌ Gagal terhubung ke NeonDB:", err);
  } else {
    console.log("✅ Berhasil terhubung ke NeonDB pada:", res.rows[0].now);
  }
});


// Bagian Nodemailer dan Firebase Admin tetap sama (tidak diubah)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

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
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Laporan Aduan Siswa</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                      Notifikasi Laporan Terbaru
                    </h1>
                    <p style="color: #e8eaf6; margin: 10px 0 0; font-size: 16px; opacity: 0.9;">
                        Sistem Notifikasi SIPCAT-SMANTIARA
                    </p>
                </div>
                <div style="padding: 40px 30px;">
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
                    <div style="height: 2px; background: linear-gradient(to right, #667eea, #764ba2); margin: 30px 0; border-radius: 2px;"></div>
                    <div style="margin-bottom: 30px;">
                        <h3 style="color: #333; font-size: 20px; font-weight: 600; margin-bottom: 20px; display: flex; align-items: center;">
                            <span style="margin-right: 10px;">📋</span>
                            Detail Aduan
                        </h3>
                        <div style="background-color: #f8f9fa; border-radius: 10px; padding: 25px; border: 1px solid #e9ecef;">
                            <div style="display: grid; gap: 15px;">
                                <div style="margin-bottom:1rem; display: flex; align-items: center; padding: 12px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                    <div style="display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                                        <span style="font-size: 18px;">👤</span>
                                    </div>
                                    <div>
                                        <span style="font-size: 12px; color: #666; text-transform: uppercase; font-weight: 500; letter-spacing: 0.5px;">Nama Pelapor</span>
                                        <div style="font-size: 16px; color: #333; font-weight: 600; margin-top: 2px;">${nama}</div>
                                    </div>
                                </div>
                                <div style="margin-bottom:1rem; display: flex; align-items: center; padding: 12px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                                    <div style="display: flex; align-items: center; justify-content: center; margin-right: 15px;">
                                        <span style="font-size: 18px;">🎓</span>
                                    </div>
                                    <div>
                                        <span style="font-size: 12px; color: #666; text-transform: uppercase; font-weight: 500; letter-spacing: 0.5px;">Kelas</span>
                                        <div style="font-size: 16px; color: #333; font-weight: 600; margin-top: 2px;">${kelas}</div>
                                    </div>
                                </div>
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
                    <div style="text-align: center; margin: 40px 0;">
                        <p style="color: #555; font-size: 16px; margin-bottom: 25px; line-height: 1.5;">
                            Silakan tindak lanjuti laporan ini dengan mengklik button dibawah
                        </p>
                        <a href="https://sipcat-smantiara.vercel.app/aduan-siswa" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 35px; border-radius: 50px; font-weight: 600; font-size: 16px; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: all 0.3s ease;">
                          Cek Aduan Siswa
                        </a>
                    </div>
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
                <div style="background-color: #f8f9fa; padding: 25px 30px; border-top: 1px solid #e9ecef; text-align: center;">
                    <div style="margin-bottom: 15px;">
                        <img src="https://1mjtjv6snj.ucarecd.net/9c3fb829-d415-4a23-a7ba-8a9e22a3df2c/images.png"style="width: 80px; height: auto;">
                    </div>
                    <p style="margin: 0; color: #666; font-size: 14px; line-height: 1.5;">
                        <strong>SIPCAT-SMANTIARA 2025</strong><br>
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

// =================================================================
// ### FUNGSI BARU DIMULAI ###
// Fungsi untuk mengirim email konfirmasi ke siswa setelah submit aduan
// =================================================================
const sendSubmissionConfirmationEmail = async (recipientEmail, aduanData) => {
  const { nama, jenis_pelanggaran } = aduanData;
  const mailOptions = {
    from: `"SIPCAT-SMANTIARA" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: `Laporan Aduan Anda Telah Kami terima`,
    html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h3>Halo ${nama},</h3>
            <p>Terima kasih telah berpartisipasi dalam menjaga ketertiban sekolah.</p>
            <p>Laporan Anda terkait <strong>"${jenis_pelanggaran}"</strong> telah berhasil kami terima dan akan segera ditinjau oleh tim kami.</p>
            <p>Anda akan menerima notifikasi email selanjutnya ketika laporan Anda mulai diproses atau telah selesai ditangani.</p>
            <br>
            <p>Hormat kami,</p>
            <p><strong>SIPCAT-SMANTIARA</strong></p>
        </div>
    `,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email konfirmasi submit terkirim ke siswa: ${recipientEmail}`);
  } catch (error) {
    console.error(`Gagal mengirim email konfirmasi submit ke ${recipientEmail}:`, error);
  }
};
// ### FUNGSI BARU SELESAI ###


const sendStatusUpdateEmailToStudent = async (recipientEmail, aduanData) => {
  const { nama, jenis_pelanggaran, status } = aduanData;
  let statusMessage = "";
  if (status === "Diproses") {
    statusMessage = "sedang dalam peninjauan dan investigasi lebih lanjut oleh pihak sekolah.";
  } else if (status === "Selesai") {
    statusMessage = "telah selesai ditangani. Terima kasih atas kontribusi Anda dalam menjaga keamanan sekolah.";
  } else {
    return;
  }
  const mailOptions = {
    from: `"SIPCAT-SMANTIARA" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: `Hallo ${nama}`,
    html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                <p>Terima kasih telah mengirimkan laporan melalui SIPCAT-SMANTIARA</p>
                <p>Ini berarti laporan Anda mengenai  <strong>"${jenis_pelanggaran}"</strong> ${statusMessage}</p>
                <p>Kami sangat menghargai keberanian dan kepedulian Anda terkait ketertiban lingkungan sekolah</p>
                <br>
                <p>Hormat kami,</p>
                <p>
                Admin
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

const sendVerificationEmail = async (recipientEmail, verificationLink) => {
  const mailOptions = {
    from: `"SIPCAT-SMANTIARA" <${process.env.EMAIL_USER}>`,
    to: recipientEmail,
    subject: "Verifikasi Email Anda untuk SIPCAT-SMANTIARA",
    html: `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-g">
            <title>Verifikasi Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 40px;">
            <div style="max-width: 600px; margin: auto; border: 1px solid #ddd; padding: 20px; border-radius: 10px;">
                <h2>Selamat Datang di SIPCAT-SMANTIARA!</h2>
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
app.use(cors());
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
      return next();
    }
    throw new Error("Not an admin");
  } catch (error) {
    if (req.path.startsWith("/api/")) {
      return res.status(401).json({ success: false, message: "Sesi tidak valid atau tidak diizinkan." });
    } else {
      return res.redirect("/login");
    }
  }
};

// Rute Halaman (TIDAK BERUBAH)
app.get("/login", (req, res) => res.sendFile(path.join(__dirname, "public", "login.html")));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));
app.get("/register", (req, res) => res.sendFile(path.join(__dirname, "public", "register.html")));
app.get("/dashboard", checkAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "dashboard.html")));
app.get("/detail-siswa", checkAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "detail-siswa.html")));
app.get("/statistik", checkAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "statistik.html")));
app.get("/aduan-siswa", checkAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "aduan-siswa.html")));
app.get("/monitor", checkAuth, (req, res) => res.sendFile(path.join(__dirname, "public", "monitor.html")));
app.get("/form-aduan", (req, res) => res.sendFile(path.join(__dirname, "public", "form-aduan.html")));

// RUTE API OTENTIKASI (TIDAK BERUBAH)
app.post("/api/auth/register", async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: "Semua field wajib diisi." });
  }
  try {
    const userRecord = await auth.createUser({
      email,
      password,
      displayName: username,
      emailVerified: false,
    });
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });
    const verificationLink = await auth.generateEmailVerificationLink(email);
    await sendVerificationEmail(email, verificationLink);
    res.status(201).json({
      success: true,
      message: "Registrasi berhasil. Silakan cek email Anda untuk verifikasi.",
    });
  } catch (error) {
    console.error("Error saat registrasi:", error);
    if (error.code === "auth/email-already-exists") {
      return res.status(409).json({ success: false, message: "Email ini sudah terdaftar. Silakan gunakan email lain." });
    }
    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const idToken = req.body.idToken.toString();
  const expiresIn = 60 * 60 * 24 * 5 * 1000;
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

app.get("/api/get-token", async (req, res) => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return res.status(500).json({ success: false, message: "Konfigurasi server error." });
  }
  const tokenUrl = `${dbUrl}token/access_token.json`;
  try {
    const response = await axios.get(tokenUrl);
    res.status(200).json({ success: true, token: response.data });
  } catch (error) {
    res.status(500).json({ success: false, message: "Tidak dapat terhubung ke database." });
  }
});

// =================================================================
// API KONFIGURASI NOTIFIKASI (DISESUAIKAN DENGAN POSTGRESQL)
// =================================================================
app.post("/api/notifications/subscribe", checkAuth, async (req, res) => {
  const { emails, notifyOnAduan } = req.body;
  if (!Array.isArray(emails) || emails.length === 0 || emails.some((e) => !e)) {
    return res.status(400).json({ success: false, message: "Minimal harus ada satu email yang valid." });
  }
  try {
    const query = `
      INSERT INTO notifications (id, emails, notifyOnAduan)
      VALUES (1, $1, $2)
      ON CONFLICT (id) DO UPDATE
      SET emails = $1, notifyOnAduan = $2
    `;
    await pool.query(query, [emails, notifyOnAduan]);
    res.json({ success: true, message: "Konfigurasi notifikasi berhasil disimpan." });
  } catch (error) {
    console.error("Error di /api/notifications/subscribe:", error);
    res.status(500).json({ success: false, message: "Gagal menyimpan konfigurasi." });
  }
});

app.get("/api/notifications/config", checkAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM notifications WHERE id = 1");
    const config = result.rows[0];
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
// API MONITORING (DISESUAIKAN DENGAN POSTGRESQL)
// =================================================================
app.get("/api/db/storage-usage", checkAuth, async (req, res) => {
  try {
    let totalStorageSize = 0;
    let totalDocuments = 0;

    const getCollectionStats = async (tableName) => {
        const sizeResult = await pool.query(`SELECT pg_total_relation_size('${tableName}') AS size`);
        const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);
        
        const storageSize = parseInt(sizeResult.rows[0].size, 10) || 0;
        const count = parseInt(countResult.rows[0].count, 10) || 0;
        
        return { storageSize, count };
    };

    const pelanggaranStats = await getCollectionStats('pelanggarans');
    totalStorageSize += pelanggaranStats.storageSize;
    totalDocuments += pelanggaranStats.count;

    const aduanStats = await getCollectionStats('aduans');
    totalStorageSize += aduanStats.storageSize;
    totalDocuments += aduanStats.count;

    res.json({
      success: true,
      usage: {
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
// API PENGADUAN SISWA (DISESUAIKAN DENGAN POSTGRESQL)
// =================================================================
const triggerNotificationEmail = async (aduanData) => {
  try {
    const result = await pool.query("SELECT * FROM notifications WHERE id = 1 AND notifyOnAduan = TRUE");
    const config = result.rows[0];

    if (config && config.emails && config.emails.length > 0) {
      console.log(`Mempersiapkan pengiriman notifikasi ke ${config.emails.length} penerima...`);
      const emailPromises = config.emails.map((emailAddress) => sendNotificationEmail(emailAddress, aduanData));
      await Promise.all(emailPromises);
      console.log("Semua email notifikasi berhasil dikirim.");
    } else {
      console.warn("Peringatan: Tidak ada konfigurasi notifikasi aktif untuk aduan baru.");
    }
  } catch (emailError) {
    console.error("Terjadi kegagalan saat proses kirim notifikasi:", emailError);
  }
};

// ================================================================
// ### PERUBAHAN DI SINI ###
// Endpoint diubah agar memanggil notifikasi untuk admin DAN siswa
// ================================================================
// GANTI BLOK app.post("/api/aduan/kirim", ...) LAMA ANDA DENGAN YANG INI
app.post("/api/aduan/kirim", [body("nama").trim().escape(), body("kelas").trim().escape(), body("jenis_pelanggaran").trim().escape(), body("detail_aduan").trim().escape()], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: "Input tidak valid.", errors: errors.array() });
  }
  try {
    // Ambil 'no_hp' dari body request
    const { nama, kelas, detail_aduan, jenis_pelanggaran, email, no_hp } = req.body;

    if (!nama || !kelas || !detail_aduan || !jenis_pelanggaran) {
      return res.status(400).json({ success: false, message: "Nama, kelas, jenis pelanggaran, dan detail aduan wajib diisi." });
    }
    
    // Sesuaikan query INSERT untuk menyertakan kolom 'no_hp'
    const query = `
      INSERT INTO aduans (nama, kelas, detail_aduan, jenis_pelanggaran, email, no_hp)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    // Tambahkan 'no_hp' ke dalam array values
    const result = await pool.query(query, [nama, kelas, detail_aduan, jenis_pelanggaran, email || null, no_hp || null]);
    const newAduan = result.rows[0];

    // --- LOGIKA PENGIRIMAN EMAIL PARALEL ---
    const emailTasks = [];
    // 1. Tambahkan tugas untuk mengirim notifikasi ke admin
    emailTasks.push(triggerNotificationEmail(newAduan));
    
    // 2. Jika siswa menyertakan email, tambahkan tugas untuk mengirim konfirmasi ke siswa
    if (newAduan.email) {
        emailTasks.push(sendSubmissionConfirmationEmail(newAduan.email, newAduan));
    }
    
    // 3. Jalankan semua tugas email secara bersamaan
    await Promise.all(emailTasks);

    res.status(201).json({ success: true, message: "Laporan aduan berhasil dikirim! Kami akan segera memproses aduan Anda." });
  } catch (error) {
    console.error("Error di /api/aduan/kirim:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server." });
  }
});

app.get("/api/aduan/stats", async (req, res) => {
  try {
    const statusQuery = "SELECT status, COUNT(*) as count FROM aduans GROUP BY status";
    const trendQuery = `
        SELECT DATE(timestamp) as date, COUNT(*) as count 
        FROM aduans 
        WHERE timestamp >= NOW() - INTERVAL '30 days' 
        GROUP BY DATE(timestamp) 
        ORDER BY DATE(timestamp)
    `;
    const [statusResult, trendResult] = await Promise.all([
        pool.query(statusQuery),
        pool.query(trendQuery)
    ]);
    res.json({
        success: true,
        statusCounts: statusResult.rows,
        monthlyTrend: trendResult.rows
    });
  } catch (error) {
    console.error("Error di /api/aduan/stats:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil statistik aduan." });
  }
});


app.get("/api/aduan/list", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM aduans ORDER BY timestamp DESC");
    res.json(result.rows);
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
    const query = "UPDATE aduans SET status = $1 WHERE id = $2 RETURNING *";
    const result = await pool.query(query, [status, id]);
    
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Data aduan tidak ditemukan" });
    }

    const updatedAduan = result.rows[0];
    if (updatedAduan.email && (updatedAduan.status === "Diproses" || updatedAduan.status === "Selesai")) {
      await sendStatusUpdateEmailToStudent(updatedAduan.email, updatedAduan);
    }
    res.json({ success: true, message: `Status aduan berhasil diubah menjadi "${status}"` });
  } catch (error) {
    console.error("Error di /api/aduan/update-status:", error);
    res.status(500).json({ success: false, message: "Gagal mengubah status aduan." });
  }
});

app.delete("/api/aduan/delete/:id", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM aduans WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Data aduan tidak ditemukan" });
    }
    res.json({ success: true, message: "Data aduan berhasil dihapus." });
  } catch (error) {
    console.error("Error di /api/aduan/delete:", error);
    res.status(500).json({ success: false, message: "Gagal menghapus data aduan." });
  }
});

// =================================================================
// API PELANGGARAN (DISESUAIKAN DENGAN POSTGRESQL)
// =================================================================
app.post("/api/pelanggaran/add", checkAuth, async (req, res) => {
  try {
    const { nama, kelas, jenis_pelanggaran, catatan, customTimestamp } = req.body;
    
    const query = customTimestamp
      ? "INSERT INTO pelanggarans (nama, kelas, jenis_pelanggaran, catatan, timestamp) VALUES ($1, $2, $3, $4, $5) RETURNING *"
      : "INSERT INTO pelanggarans (nama, kelas, jenis_pelanggaran, catatan) VALUES ($1, $2, $3, $4) RETURNING *";
      
    const values = customTimestamp
      ? [nama, kelas, jenis_pelanggaran, catatan, customTimestamp]
      : [nama, kelas, jenis_pelanggaran, catatan];

    const result = await pool.query(query, values);
    res.status(201).json({ success: true, message: "Data berhasil ditambahkan", data: result.rows[0] });
  } catch (error) {
    console.error("Error di /api/pelanggaran/add:", error);
    res.status(500).json({ success: false, message: "Gagal menambahkan data." });
  }
});

app.get("/api/pelanggaran/list", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM pelanggarans ORDER BY timestamp DESC");
    res.json(result.rows);
  } catch (error) {
    console.error("Error di /api/pelanggaran/list:", error);
    res.status(500).json({ success: false, message: "Gagal mengambil data pelanggaran." });
  }
});

app.put("/api/pelanggaran/update/:id", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { nama, kelas, jenis_pelanggaran, catatan } = req.body;
    const query = `
      UPDATE pelanggarans 
      SET nama = $1, kelas = $2, jenis_pelanggaran = $3, catatan = $4 
      WHERE id = $5 
      RETURNING *
    `;
    const result = await pool.query(query, [nama, kelas, jenis_pelanggaran, catatan, id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Data tidak ditemukan" });
    }
    res.json({ success: true, message: "Data berhasil diupdate." });
  } catch (error) {
    console.error("Error di /api/pelanggaran/update:", error);
    res.status(500).json({ success: false, message: "Gagal mengupdate data." });
  }
});

app.delete("/api/pelanggaran/delete/:id", checkAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query("DELETE FROM pelanggarans WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: "Data tidak ditemukan" });
    }
    res.json({ success: true, message: "Data berhasil dihapus." });
  } catch (error) {
    console.error("Error di /api/pelanggaran/delete:", error);
    res.status(500).json({ success: false, message: "Gagal menghapus data." });
  }
});

// Server Listener
app.listen(PORT, () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
});