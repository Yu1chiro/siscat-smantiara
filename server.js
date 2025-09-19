const express = require('express');
const admin = require('firebase-admin');
const cookieParser = require('cookie-parser');
const dotenv = require('dotenv');
const path = require('path');

// Import library untuk Google Sheets
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');
const { v4: uuidv4 } = require('uuid');


// Inisialisasi Konfigurasi
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;


// Inisialisasi Firebase HANYA untuk Autentikasi
const serviceAccount = {
  type: process.env.TYPE,
  project_id: process.env.PROJECT_ID,
  private_key_id: process.env.PRIVATE_KEY_ID,
  private_key: process.env.PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email: process.env.CLIENT_EMAIL,
  client_id: process.env.CLIENT_ID,
  auth_uri: process.env.AUTH_URI,
  token_uri: process.env.TOKEN_URI,
  auth_provider_x509_cert_url: process.env.AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.CLIENT_X509_CERT_URL,
  universe_domain: process.env.UNIVERSE_DOMAIN,
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();

// Inisialisasi Klien Google Sheets (CARA BARU - v4)
const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);

// Fungsi async untuk inisialisasi otentikasi
const initializeAuth = async () => {
  try {
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    });
    console.log("Otentikasi Google Sheets berhasil.");
  } catch (error) {
    console.error("GAGAL OTENTIKASI Google Sheets:", error);
    // Hentikan aplikasi jika otentikasi gagal, karena tidak ada yang akan berfungsi
    process.exit(1); 
  }
};

// Panggil fungsi inisialisasi
initializeAuth();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));


// AUTHENTICATION LOGIC (TIDAK BERUBAH)
const checkAuth = async (req, res, next) => {
  const sessionCookie = req.cookies.session || '';
  
  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
    if (decodedClaims.admin) {
      req.user = decodedClaims;
      return next(); // Lanjutkan jika admin
    }
    throw new Error('Not an admin'); // Buat error jika bukan admin
  } catch (error) {
    // Cek apakah ini request API atau request halaman
    if (req.path.startsWith('/api/')) {
      // Jika request API, kirim respons JSON
      console.error(`Auth Error on API path ${req.path}:`, error.message);
      return res.status(401).json({ success: false, message: 'Sesi tidak valid atau tidak diizinkan.' });
    } else {
      // Jika request halaman, redirect ke halaman login
      return res.redirect('/login');
    }
  }
};
// Rute Halaman
app.get('/login', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'login.html')); });
app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });
app.get('/register', (req, res) => { res.sendFile(path.join(__dirname, 'public', 'register.html')); });
app.get('/dashboard', checkAuth, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'dashboard.html')); });
app.get('/detail-siswa', checkAuth, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'detail-siswa.html')); });
app.get('/statistik', checkAuth, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'statistik.html')); });
app.get('/form-aduan', checkAuth, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'form-aduan.html')); });
app.get('/aduan-siswa', checkAuth, (req, res) => { res.sendFile(path.join(__dirname, 'public', 'aduan-siswa.html')); });
// =================================================================
// RUTE API OTENTIKASI (PENAMBAHAN LOG ERROR)
// =================================================================
app.post('/api/auth/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
  }
  try {
    const userRecord = await auth.createUser({ email, password, displayName: username, emailVerified: false });
    await auth.setCustomUserClaims(userRecord.uid, { admin: true });
    res.status(201).json({ success: true, message: 'Registrasi berhasil. Silakan verifikasi email Anda.' });
  } catch (error) {
    console.error("Error saat registrasi:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
    const idToken = req.body.idToken.toString();
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 hari
    try {
        const decodedToken = await auth.verifyIdToken(idToken, true);
        if (!decodedToken.email_verified) {
            return res.status(401).json({ success: false, message: 'Email belum diverifikasi.' });
        }
        if (!decodedToken.admin) {
            return res.status(403).json({ success: false, message: 'Anda tidak memiliki hak akses admin.' });
        }
        const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
        const options = { maxAge: expiresIn, httpOnly: true, secure: process.env.NODE_ENV === 'production' };
        res.cookie('session', sessionCookie, options);
        res.json({ success: true, message: 'Login berhasil.' });
    } catch (error) {
        console.error('Error saat login:', error);
        res.status(401).json({ success: false, message: 'Login gagal, token tidak valid.' });
    }
});

app.get('/api/auth/logout', (req, res) => {
  res.clearCookie('session');
  res.redirect('/login');
});


// =================================================================
// REVISI API PENGADUAN SISWA (PENAMBAHAN LOG ERROR & OTENTIKASI)
// =================================================================

app.post('/api/aduan/kirim', checkAuth, async (req, res) => { // DITAMBAHKAN checkAuth
  try {
    const { nama, kelas, detail_aduan, jenis_pelanggaran } = req.body;
    if (!nama || !kelas || !detail_aduan || !jenis_pelanggaran) {
      return res.status(400).json({ success: false, message: 'Semua field wajib diisi.' });
    }
    await doc.loadInfo();
    const sheet = doc.sheetsByTitle['aduan'];
    const newRow = { id: uuidv4(), nama, kelas, detail_aduan, status: 'Pending', timestamp: new Date().toISOString(), jenis_pelanggaran };
    await sheet.addRow(newRow);
    res.status(201).json({ success: true, message: 'Aduan Anda telah berhasil dikirim.' });
  } catch (error) {
    console.error("Error di /api/aduan/kirim:", error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan pada server.' });
  }
});

app.get('/api/aduan/list',  async (req, res) => { // DITAMBAHKAN checkAuth
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['aduan'];
        const rows = await sheet.getRows();
        const data = rows.map(row => row.toObject());
        res.json(data);
    } catch (error) {
        console.error("Error di /api/aduan/list:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data aduan.' });
    }
});

app.patch('/api/aduan/update-status/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) {
            return res.status(400).json({ success: false, message: 'Status wajib diisi.' });
        }
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['aduan'];
        const rows = await sheet.getRows();
        const rowToUpdate = rows.find(row => row.get('id') === id);
        if (!rowToUpdate) {
            return res.status(404).json({ success: false, message: 'Data aduan tidak ditemukan' });
        }
        rowToUpdate.set('status', status);
        await rowToUpdate.save();
        res.json({ success: true, message: `Status aduan berhasil diubah menjadi "${status}"` });
    } catch (error) {
        console.error("Error di /api/aduan/update-status:", error);
        res.status(500).json({ success: false, message: 'Gagal mengubah status aduan.' });
    }
});

app.delete('/api/aduan/delete/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['aduan'];
        const rows = await sheet.getRows();
        const rowToDelete = rows.find(row => row.get('id') === id);
        if (!rowToDelete) return res.status(404).json({ success: false, message: 'Data aduan tidak ditemukan' });
        await rowToDelete.delete();
        res.json({ success: true, message: 'Data aduan berhasil dihapus.' });
    } catch (error) {
        console.error("Error di /api/aduan/delete:", error);
        res.status(500).json({ success: false, message: 'Gagal menghapus data aduan.' });
    }
});

// =================================================================
// REVISI API PELANGGARAN (PENAMBAHAN LOG ERROR & OTENTIKASI)
// =================================================================

app.post('/api/pelanggaran/add', checkAuth, async (req, res) => {
    try {
        const { nama, kelas, jenis_pelanggaran, catatan } = req.body;
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['pelanggaran'];
        const newRow = { id: uuidv4(), nama, kelas, jenis_pelanggaran, catatan, timestamp: new Date().toISOString() };
        await sheet.addRow(newRow);
        res.status(201).json({ success: true, message: 'Data berhasil ditambahkan', data: newRow });
    } catch (error) {
        console.error("Error di /api/pelanggaran/add:", error);
        res.status(500).json({ success: false, message: 'Gagal menambahkan data.' });
    }
});

app.get('/api/pelanggaran/list',  async (req, res) => { // DITAMBAHKAN checkAuth
    try {
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['pelanggaran'];
        const rows = await sheet.getRows();
        const data = rows.map(row => row.toObject());
        res.json(data);
    } catch (error) {
        console.error("Error di /api/pelanggaran/list:", error);
        res.status(500).json({ success: false, message: 'Gagal mengambil data.' });
    }
});

app.put('/api/pelanggaran/update/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { nama, kelas, jenis_pelanggaran, catatan } = req.body;
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['pelanggaran'];
        const rows = await sheet.getRows();
        const rowToUpdate = rows.find(row => row.get('id') === id);
        if (!rowToUpdate) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        rowToUpdate.set('nama', nama);
        rowToUpdate.set('kelas', kelas);
        rowToUpdate.set('jenis_pelanggaran', jenis_pelanggaran);
        rowToUpdate.set('catatan', catatan);
        await rowToUpdate.save();
        res.json({ success: true, message: 'Data berhasil diupdate.' });
    } catch (error) {
        console.error("Error di /api/pelanggaran/update:", error);
        res.status(500).json({ success: false, message: 'Gagal mengupdate data.' });
    }
});

app.delete('/api/pelanggaran/delete/:id', checkAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await doc.loadInfo();
        const sheet = doc.sheetsByTitle['pelanggaran'];
        const rows = await sheet.getRows();
        const rowToDelete = rows.find(row => row.get('id') === id);
        if (!rowToDelete) return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
        await rowToDelete.delete();
        res.json({ success: true, message: 'Data berhasil dihapus.' });
    } catch (error) {
        console.error("Error di /api/pelanggaran/delete:", error);
        res.status(500).json({ success: false, message: 'Gagal menghapus data.' });
    }
});
// Server Listener
app.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});