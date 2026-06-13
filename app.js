/* ============================================
   UNNES LMS — Shared App Utilities
   Database: Firebase Firestore
   ============================================ */

const DB_VERSION = 4; // Bumping version for Firebase

// ---- Firebase Firestore Wrappers ----
async function dbGetAll(collectionName) {
  const snapshot = await firestoreDb.collection(collectionName).get();
  const results = [];
  snapshot.forEach(doc => results.push(doc.data()));
  return results;
}

async function dbGet(collectionName, id) {
  const docRef = await firestoreDb.collection(collectionName).doc(id.toString()).get();
  if (docRef.exists) {
    return docRef.data();
  }
  return null;
}

async function dbPut(collectionName, data) {
  const id = data.nim || data.id;
  if (!id) throw new Error("Data must have 'nim' or 'id' to be saved.");
  await firestoreDb.collection(collectionName).doc(id.toString()).set(data);
  return data;
}

async function dbPutAll(collectionName, items) {
  const batch = firestoreDb.batch();
  items.forEach(item => {
    const id = item.nim || item.id;
    const docRef = firestoreDb.collection(collectionName).doc(id.toString());
    batch.set(docRef, item);
  });
  await batch.commit();
}

async function dbDelete(collectionName, id) {
  await firestoreDb.collection(collectionName).doc(id.toString()).delete();
}

// ============================================
// App Object — main API
// ============================================
const App = {
  // ---- Auth (session uses localStorage, OK for session) ----
  getUser() {
    const u = localStorage.getItem('unnes_user');
    return u ? JSON.parse(u) : null;
  },

  setUser(user) {
    localStorage.setItem('unnes_user', JSON.stringify(user));
  },

  logout() {
    localStorage.removeItem('unnes_user');
    window.location.href = 'index.html';
  },

  requireAuth(role) {
    const user = this.getUser();
    if (!user) { window.location.href = 'index.html'; return null; }
    if (role && user.role !== role) {
      window.location.href = user.role === 'student' ? 'student-dashboard.html' : 'lecturer-dashboard.html';
      return null;
    }
    return user;
  },

  // ---- Users (IndexedDB) ----
  async getUsers() {
    return await dbGetAll('users');
  },

  async getStudents() {
    const users = await dbGetAll('users');
    return users.filter(u => u.role === 'student');
  },

  async registerUser(userData) {
    const existing = await dbGet('users', userData.nim);
    if (existing) return { error: 'NIM/NIP sudah terdaftar' };
    await dbPut('users', userData);
    return { success: true };
  },

  async loginUser(nim, password) {
    const user = await dbGet('users', nim);
    if (!user || user.password !== password) return { error: 'NIM/NIP atau password salah' };
    this.setUser(user);
    return { success: true, user };
  },

  // ---- Exams (IndexedDB) ----
  async getExams() {
    return await dbGetAll('exams');
  },

  async addExam(exam) {
    exam.id = 'exam_' + Date.now();
    exam.createdAt = new Date().toISOString();
    await dbPut('exams', exam);
    return exam;
  },

  async updateExam(exam) {
    await dbPut('exams', exam);
    return exam;
  },

  async getExamById(id) {
    return await dbGet('exams', id);
  },

  async deleteExam(id) {
    await dbDelete('exams', id);
    return true;
  },

  // ---- Results (IndexedDB) ----
  async getResults() {
    return await dbGetAll('results');
  },

  async addResult(result) {
    result.id = 'result_' + Date.now();
    result.submittedAt = new Date().toISOString();
    await dbPut('results', result);
    return result;
  },

  async updateResult(result) {
    await dbPut('results', result);
    return result;
  },

  // ---- Chats (IndexedDB) ----
  async getChatsByExam(examId) {
    const allChats = await dbGetAll('chats');
    return allChats.filter(c => c.examId === examId);
  },

  async addChat(chat) {
    chat.id = 'chat_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    chat.timestamp = new Date().toISOString();
    await dbPut('chats', chat);
    return chat;
  },

  // ---- Toast ----
  toast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const icons = { success: '✓', warning: '⚠', danger: '✕', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  },

  // ---- Utilities ----
  formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  formatTime(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  },

  formatDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} menit`;
    return `${h} jam ${m > 0 ? m + ' menit' : ''}`;
  },

  // ---- Init Navbar User ----
  initNavUser() {
    const user = this.getUser();
    if (!user) return;
    const avatar = document.querySelector('.nav-user-avatar');
    const name = document.querySelector('.nav-user-name');
    if (avatar) avatar.textContent = user.name.charAt(0).toUpperCase();
    if (name) name.textContent = user.name;
  },

  // ---- Migrate old localStorage data to IndexedDB (safe) ----
  async migrateFromLocalStorage() {
    const oldUsers = localStorage.getItem('unnes_users');
    const oldExams = localStorage.getItem('unnes_exams');
    const oldResults = localStorage.getItem('unnes_results');

    if (oldUsers || oldExams || oldResults) {
      console.log('[App] Migrating localStorage data to IndexedDB...');

      if (oldUsers) {
        try {
          const users = JSON.parse(oldUsers);
          let migratedCount = 0;
          for (const u of users) {
            const existing = await dbGet('users', u.nim);
            if (!existing) {
              await dbPut('users', u);
              // Verify the write succeeded
              const verify = await dbGet('users', u.nim);
              if (verify) migratedCount++;
            } else {
              migratedCount++; // Already exists, counts as success
            }
          }
          // Only remove localStorage if ALL items migrated successfully
          if (migratedCount === users.length) {
            localStorage.removeItem('unnes_users');
            console.log(`[App] Migrated ${migratedCount} users successfully`);
          } else {
            console.warn(`[App] Only ${migratedCount}/${users.length} users migrated, keeping localStorage backup`);
          }
        } catch (err) {
          console.error('[App] Failed to migrate users, keeping localStorage backup:', err);
        }
      }

      if (oldExams) {
        try {
          const exams = JSON.parse(oldExams);
          let migratedCount = 0;
          for (const e of exams) {
            const existing = await dbGet('exams', e.id);
            if (!existing) {
              await dbPut('exams', e);
              const verify = await dbGet('exams', e.id);
              if (verify) migratedCount++;
            } else {
              migratedCount++;
            }
          }
          if (migratedCount === exams.length) {
            localStorage.removeItem('unnes_exams');
            console.log(`[App] Migrated ${migratedCount} exams successfully`);
          } else {
            console.warn(`[App] Only ${migratedCount}/${exams.length} exams migrated, keeping localStorage backup`);
          }
        } catch (err) {
          console.error('[App] Failed to migrate exams, keeping localStorage backup:', err);
        }
      }

      if (oldResults) {
        try {
          const results = JSON.parse(oldResults);
          let migratedCount = 0;
          for (const r of results) {
            const existing = await dbGet('results', r.id);
            if (!existing) {
              await dbPut('results', r);
              const verify = await dbGet('results', r.id);
              if (verify) migratedCount++;
            } else {
              migratedCount++;
            }
          }
          if (migratedCount === results.length) {
            localStorage.removeItem('unnes_results');
            console.log(`[App] Migrated ${migratedCount} results successfully`);
          } else {
            console.warn(`[App] Only ${migratedCount}/${results.length} results migrated, keeping localStorage backup`);
          }
        } catch (err) {
          console.error('[App] Failed to migrate results, keeping localStorage backup:', err);
        }
      }

      // Clean old seed flags only if all migrations passed
      if (!localStorage.getItem('unnes_users') && !localStorage.getItem('unnes_exams') && !localStorage.getItem('unnes_results')) {
        localStorage.removeItem('unnes_seeded');
        localStorage.removeItem('unnes_seeded_v2');
      }

      console.log('[App] Migration complete');
    }
  },

  // ---- Seed Demo Data (into IndexedDB) ----
  async seedDemoData() {
    // First migrate any old localStorage data
    await this.migrateFromLocalStorage();

    // Check if lecturer exists (key seed indicator)
    const lecturer = await dbGet('users', '123');

    // NOTE: No longer deleting any existing data on startup.
    // Old demo cleanup was removed because it aggressively deleted
    // user data every time any page was loaded.

    if (lecturer) {
      // Already seeded — run auto-backup and return
      await this.autoBackup();
      return;
    }

    // Demo users (hanya dosen, tanpa mahasiswa demo)
    await dbPutAll('users', [
      { nim: '123', name: 'Dr. Budi Santoso', email: 'budi@mail.unnes.ac.id', role: 'lecturer', prodi: 'Teknologi Pendidikan', password: '123', phone: '081298765432', registeredAt: '2026-01-15T08:00:00' },
    ]);

    // Demo exams
    await dbPutAll('exams', [
      {
        id: 'exam_1',
        title: 'UTS Algoritma & Pemrograman',
        course: 'Algoritma & Pemrograman',
        lecturer: 'Dr. Budi Santoso',
        lecturerId: '123',
        duration: 90,
        date: '2026-03-05T08:00:00',
        endDate: '2026-03-05T09:30:00',
        proctoring: true,
        status: 'upcoming',
        createdAt: '2026-02-20T10:00:00',
        questions: [
          { id: 'q1', type: 'multiple', text: 'Apa output dari kode berikut?\n\nfor i in range(5):\n    print(i, end=" ")', options: ['0 1 2 3 4', '1 2 3 4 5', '0 1 2 3 4 5', '1 2 3 4'], answer: 0, points: 10 },
          { id: 'q2', type: 'multiple', text: 'Kompleksitas waktu dari algoritma Binary Search adalah...', options: ['O(n)', 'O(log n)', 'O(n²)', 'O(n log n)'], answer: 1, points: 10 },
          { id: 'q3', type: 'multiple', text: 'Manakah yang bukan merupakan tipe data primitif di Python?', options: ['int', 'float', 'array', 'bool'], answer: 2, points: 10 },
          { id: 'q4', type: 'multiple', text: 'Apa perbedaan utama antara list dan tuple di Python?', options: ['List menggunakan kurung siku, tuple kurung biasa', 'List bisa diubah (mutable), tuple tidak', 'Kedua jawaban benar', 'Tidak ada perbedaan'], answer: 2, points: 10 },
          { id: 'q5', type: 'essay', text: 'Jelaskan konsep rekursi dan berikan contoh implementasinya dalam Python untuk menghitung faktorial!', answer: '', points: 20 },
        ]
      },
      {
        id: 'exam_demo_10q',
        title: 'Ujian Uji Coba Lintas Platform (10 Soal)',
        course: 'Sistem Informasi',
        lecturer: 'Panel Admin Dosen',
        lecturerId: '123',
        duration: 60,
        date: '2026-03-02T08:00:00',
        endDate: '2026-03-02T22:00:00',
        proctoring: true,
        status: 'upcoming',
        createdAt: '2026-03-01T10:00:00',
        questions: [
          { id: 'q1', type: 'multiple', text: 'Elemen HTML mana yang digunakan untuk membuat paragraf?', options: ['<p>', '<h1>', '<div>', '<span>'], answer: 0, points: 10 },
          { id: 'q2', type: 'multiple', text: 'Apa fungsi dari CSS?', options: ['Mengelola database', 'Mengatur tampilan halaman web', 'Memberi logika pemrograman', 'Menjalankan server'], answer: 1, points: 10 },
          { id: 'q3', type: 'multiple', text: 'Di mana sebaiknya file CSS eksternal di-link ke dalam dokumen HTML?', options: ['Di dalam <body>', 'Di akhir dokumen', 'Di dalam <head>', 'Tidak perlu di-link'], answer: 2, points: 10 },
          { id: 'q4', type: 'multiple', text: 'Sintaks JavaScript yang benar untuk mengubah isi elemen HTML dengan id="demo" adalah:', options: ['document.getElementByName("demo").innerHTML = "Hello";', '#demo.innerHTML = "Hello";', 'document.getElementById("demo").innerHTML = "Hello";', 'document.getElementById("demo").value = "Hello";'], answer: 2, points: 10 },
          { id: 'q5', type: 'multiple', text: 'Bagaimana cara mendeklarasikan variabel di JavaScript (ES6)?', options: ['v', 'var, let, const', 'variable', 'define'], answer: 1, points: 10 },
          { id: 'q6', type: 'multiple', text: 'Fungsi JSON.stringify() digunakan untuk...', options: ['Mengubah JSON ke objek JavaScript', 'Menghapus key dari objek JSON', 'Membaca file JSON', 'Mengubah objek JavaScript menjadi string JSON'], answer: 3, points: 10 },
          { id: 'q7', type: 'multiple', text: 'Manakah dari berikut ini yang merupakan framework/library JavaScript untuk antarmuka pengguna?', options: ['Laravel', 'Django', 'React', 'Flask'], answer: 2, points: 10 },
          { id: 'q8', type: 'multiple', text: 'Apa tipe database dari IndexedDB yang ada pada browser?', options: ['Relational Database (SQL)', 'Graph Database', 'NoSQL Key-Value Store', 'Document Store'], answer: 2, points: 10 },
          { id: 'q9', type: 'multiple', text: 'Aturan CSS mana yang membuat sebuah grid menjadi flexbox?', options: ['display: flex;', 'display: grid;', 'float: left;', 'position: absolute;'], answer: 0, points: 10 },
          { id: 'q10', type: 'essay', text: 'Coba jelaskan alur bagaimana fitur Live Proctoring mendeteksi wajah mahasiswa menggunakan kamera secara singkat!', answer: '', points: 10 }
        ]
      },
      {
        id: 'exam_2',
        title: 'UTS Basis Data',
        course: 'Basis Data',
        lecturer: 'Dr. Budi Santoso',
        lecturerId: '123',
        duration: 120,
        date: '2026-03-10T10:00:00',
        endDate: '2026-03-10T12:00:00',
        proctoring: true,
        status: 'upcoming',
        createdAt: '2026-02-22T10:00:00',
        questions: [
          { id: 'q1', type: 'multiple', text: 'SQL merupakan singkatan dari...', options: ['Structured Query Language', 'Simple Query Language', 'Standard Query Logic', 'System Query Language'], answer: 0, points: 10 },
          { id: 'q2', type: 'multiple', text: 'Perintah SQL untuk menampilkan semua data dari tabel mahasiswa adalah...', options: ['GET * FROM mahasiswa', 'SELECT * FROM mahasiswa', 'SHOW * FROM mahasiswa', 'DISPLAY * FROM mahasiswa'], answer: 1, points: 10 },
          { id: 'q3', type: 'multiple', text: 'Normalisasi bertujuan untuk...', options: ['Mempercepat query', 'Mengurangi redundansi data', 'Menambah kolom', 'Menghapus tabel'], answer: 1, points: 10 },
          { id: 'q4', type: 'essay', text: 'Jelaskan perbedaan antara INNER JOIN, LEFT JOIN, dan RIGHT JOIN beserta contoh kasus penggunaannya!', answer: '', points: 30 },
        ]
      },
      {
        id: 'exam_3',
        title: 'Kuis Jaringan Komputer',
        course: 'Jaringan Komputer',
        lecturer: 'Dr. Budi Santoso',
        lecturerId: '123',
        duration: 45,
        date: '2026-02-25T13:00:00',
        endDate: '2026-02-25T13:45:00',
        proctoring: false,
        status: 'completed',
        createdAt: '2026-02-18T10:00:00',
        questions: [
          { id: 'q1', type: 'multiple', text: 'Layer ke-3 pada model OSI adalah...', options: ['Transport', 'Network', 'Data Link', 'Session'], answer: 1, points: 25 },
          { id: 'q2', type: 'multiple', text: 'Protokol yang digunakan untuk mengirim email adalah...', options: ['HTTP', 'FTP', 'SMTP', 'DNS'], answer: 2, points: 25 },
        ]
      }
    ]);

    console.log('[App] Demo data seeded into IndexedDB');
    // Create initial backup after seeding
    await this.autoBackup();
  },

  // ============================================
  // Data Protection — Backup & Restore
  // ============================================

  // ---- Auto-backup to localStorage (runs on every page load) ----
  async autoBackup() {
    try {
      const users = await dbGetAll('users');
      const exams = await dbGetAll('exams');
      const results = await dbGetAll('results');
      const chats = await dbGetAll('chats');

      // Only backup if there's actual data
      if (users.length === 0 && exams.length === 0 && results.length === 0) return;

      const backup = {
        version: DB_VERSION,
        timestamp: new Date().toISOString(),
        data: { users, exams, results, chats }
      };

      localStorage.setItem('unnes_lms_backup', JSON.stringify(backup));
      console.log(`[App] Auto-backup saved: ${users.length} users, ${exams.length} exams, ${results.length} results, ${chats.length} chats`);
    } catch (err) {
      console.warn('[App] Auto-backup failed:', err);
    }
  },

  // ---- Restore from auto-backup (if IndexedDB is empty but backup exists) ----
  async restoreFromBackup() {
    const backupStr = localStorage.getItem('unnes_lms_backup');
    if (!backupStr) {
      console.log('[App] No backup found to restore');
      return { restored: false, reason: 'no_backup' };
    }

    try {
      const backup = JSON.parse(backupStr);
      const { users, exams, results, chats } = backup.data;
      let restoredCounts = { users: 0, exams: 0, results: 0, chats: 0 };

      if (users && users.length > 0) {
        for (const u of users) {
          const existing = await dbGet('users', u.nim);
          if (!existing) { await dbPut('users', u); restoredCounts.users++; }
        }
      }
      if (exams && exams.length > 0) {
        for (const e of exams) {
          const existing = await dbGet('exams', e.id);
          if (!existing) { await dbPut('exams', e); restoredCounts.exams++; }
        }
      }
      if (results && results.length > 0) {
        for (const r of results) {
          const existing = await dbGet('results', r.id);
          if (!existing) { await dbPut('results', r); restoredCounts.results++; }
        }
      }
      if (chats && chats.length > 0) {
        for (const c of chats) {
          const existing = await dbGet('chats', c.id);
          if (!existing) { await dbPut('chats', c); restoredCounts.chats++; }
        }
      }

      console.log(`[App] Restored from backup (${backup.timestamp}):`, restoredCounts);
      return { restored: true, counts: restoredCounts, backupDate: backup.timestamp };
    } catch (err) {
      console.error('[App] Failed to restore backup:', err);
      return { restored: false, reason: 'error', error: err.message };
    }
  },

  // ---- Export ALL data as downloadable JSON file ----
  async exportData() {
    try {
      const users = await dbGetAll('users');
      const exams = await dbGetAll('exams');
      const results = await dbGetAll('results');
      const chats = await dbGetAll('chats');

      const exportObj = {
        appName: 'UNNES_LMS',
        version: DB_VERSION,
        exportedAt: new Date().toISOString(),
        data: { users, exams, results, chats }
      };

      const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `UNNES_LMS_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('[App] Data exported successfully');
      this.toast('Data berhasil diekspor sebagai file JSON', 'success');
      return true;
    } catch (err) {
      console.error('[App] Export failed:', err);
      this.toast('Gagal mengekspor data: ' + err.message, 'danger');
      return false;
    }
  },

  // ---- Import data from JSON file ----
  async importData(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const importObj = JSON.parse(e.target.result);

          // Validate format
          if (!importObj.appName || importObj.appName !== 'UNNES_LMS' || !importObj.data) {
            this.toast('File tidak valid. Pastikan file berasal dari ekspor UNNES LMS.', 'danger');
            return resolve(false);
          }

          // Create backup before importing
          await this.autoBackup();

          const { users, exams, results, chats } = importObj.data;
          let importedCounts = { users: 0, exams: 0, results: 0, chats: 0 };

          if (users) {
            for (const u of users) {
              await dbPut('users', u);
              importedCounts.users++;
            }
          }
          if (exams) {
            for (const ex of exams) {
              await dbPut('exams', ex);
              importedCounts.exams++;
            }
          }
          if (results) {
            for (const r of results) {
              await dbPut('results', r);
              importedCounts.results++;
            }
          }
          if (chats) {
            for (const c of chats) {
              await dbPut('chats', c);
              importedCounts.chats++;
            }
          }

          console.log('[App] Data imported:', importedCounts);
          this.toast(`Berhasil mengimpor: ${importedCounts.users} user, ${importedCounts.exams} ujian, ${importedCounts.results} hasil`, 'success');
          resolve(true);
        } catch (err) {
          console.error('[App] Import failed:', err);
          this.toast('Gagal mengimpor data: ' + err.message, 'danger');
          resolve(false);
        }
      };
      reader.onerror = () => {
        this.toast('Gagal membaca file', 'danger');
        resolve(false);
      };
      reader.readAsText(file);
    });
  },

  // ---- Get backup info ----
  getBackupInfo() {
    const backupStr = localStorage.getItem('unnes_lms_backup');
    if (!backupStr) return null;
    try {
      const backup = JSON.parse(backupStr);
      return {
        timestamp: backup.timestamp,
        userCount: backup.data.users ? backup.data.users.length : 0,
        examCount: backup.data.exams ? backup.data.exams.length : 0,
        resultCount: backup.data.results ? backup.data.results.length : 0,
        chatCount: backup.data.chats ? backup.data.chats.length : 0,
      };
    } catch { return null; }
  },

  // ---- Delete All Students (with backup first) ----
  async deleteAllStudents() {
    // Auto-backup before destructive operation
    await this.autoBackup();

    const users = await dbGetAll('users');
    const students = users.filter(u => u.role === 'student');
    const batch = firestoreDb.batch();
    for (const s of students) {
      const ref = firestoreDb.collection('users').doc(s.nim.toString());
      batch.delete(ref);
    }
    
    // Also delete all results
    const results = await dbGetAll('results');
    for (const r of results) {
      const ref = firestoreDb.collection('results').doc(r.id.toString());
      batch.delete(ref);
    }
    
    await batch.commit();
    console.log(`[App] Deleted ${students.length} student(s) and all results (backup saved)`);
    return students.length;
  },

  // ---- Clear ALL data and re-seed (with backup first) ----
  async clearAllData() {
    // Auto-backup before destructive operation
    await this.autoBackup();

    const collections = ['users', 'exams', 'results', 'chats'];
    for (const name of collections) {
      const snapshot = await firestoreDb.collection(name).get();
      const batch = firestoreDb.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
    console.log('[App] All data cleared (backup saved)');
    await this.seedDemoData();
  }
};

// Auto-seed on load + attempt restore if DB is empty
App.initPromise = (async () => {
  await App.seedDemoData();

  // If DB appears empty after seed (e.g. IndexedDB was wiped), try restoring from backup
  const users = await dbGetAll('users');
  const exams = await dbGetAll('exams');
  if (users.length <= 1 && exams.length <= 4) {
    // Only demo data exists — check if there's a richer backup
    const backupInfo = App.getBackupInfo();
    if (backupInfo && (backupInfo.userCount > 1 || backupInfo.resultCount > 0)) {
      console.log('[App] Detected data loss — attempting auto-restore from backup...');
      const result = await App.restoreFromBackup();
      if (result.restored) {
        console.log('[App] Auto-restore successful:', result.counts);
      }
    }
  }
})();

