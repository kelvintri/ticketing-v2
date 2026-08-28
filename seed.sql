INSERT OR IGNORE INTO "Agent" ("id", "email", "name", "passwordHash", "role", "active") VALUES
  ('agent-admin', 'admin@helpdesk.local', 'Administrator Helpdesk', '$2b$10$hwYJdFdwDFhGyMfWkoiZ5eFUGpusq1paqL0MZfNRTsU7k.GHf7T/a', 'ADMIN', 1),
  ('agent-support-1', 'agent@helpdesk.local', 'Agen Support 1', '$2b$10$NWUYsjDtzHO5x5UHok9a/el1kaYCauAW3XsBs.ZkEjAr9NjmqGf2W', 'AGENT', 1);

INSERT OR IGNORE INTO "Category" ("id", "name") VALUES
  ('category-hardware', 'Hardware'),
  ('category-software', 'Software'),
  ('category-network', 'Network'),
  ('category-account', 'Account & Access'),
  ('category-other', 'Other');

INSERT OR IGNORE INTO "SlaRule" ("id", "priority", "firstResponseMinutes", "resolutionMinutes") VALUES
  ('sla-low', 'LOW', 240, 1440),
  ('sla-medium', 'MEDIUM', 120, 480),
  ('sla-high', 'HIGH', 60, 240),
  ('sla-urgent', 'URGENT', 30, 120);

INSERT OR IGNORE INTO "KnowledgeArticle" ("id", "title", "body", "keywords", "categoryId", "active", "updatedAt") VALUES
  ('article-printer', 'Printer tidak terdeteksi oleh komputer', 'Periksa kabel USB/power printer, pastikan printer dalam keadaan menyala. Buka Settings > Devices > Printers, klik ''Add a printer''. Jika tidak muncul, restart layanan Print Spooler (services.msc) lalu coba lagi. Untuk printer jaringan, pastikan komputer dan printer berada di jaringan yang sama.', 'printer, tidak terdeteksi, cetak, print spooler, printer jaringan', 'category-hardware', 1, CURRENT_TIMESTAMP),
  ('article-wifi', 'Wifi kantor lambat atau sering putus', 'Coba lupakan jaringan lalu sambungkan kembali. Pastikan jarak dengan access point tidak terlalu jauh dan tidak banyak penghalang. Jika masalah terjadi di banyak perangkat, laporkan ke tim IT karena kemungkinan gangguan ada pada access point atau bandwidth.', 'wifi, internet lambat, koneksi putus, access point, jaringan', 'category-network', 1, CURRENT_TIMESTAMP),
  ('article-email-password', 'Lupa password email kantor', 'Hubungi tim IT melalui tiket dengan kategori Account & Access. Siapkan identitas karyawan untuk verifikasi. Setelah diverifikasi, password akan direset dan Anda diminta mengganti password saat login pertama.', 'lupa password, email, reset password, akun', 'category-account', 1, CURRENT_TIMESTAMP),
  ('article-install', 'Cara install software resmi perusahaan', 'Software resmi dapat diunduh dari portal internal IT. Jalankan installer, lalu aktivasi lisensi menggunakan akun SSO perusahaan. Jangan menginstal software bajakan atau dari sumber tidak dikenal karena melanggar kebijakan keamanan.', 'install, software, lisensi, aplikasi, portal IT', 'category-software', 1, CURRENT_TIMESTAMP),
  ('article-monitor', 'Komputer menyala tapi layar tidak tampil', 'Periksa kabel monitor dan pastikan monitor menyala. Coba ganti kabel video (HDMI/VGA/DisplayPort). Jika menggunakan PC desktop, pastikan kabel terpasang di port kartu grafis, bukan motherboard. Bila masih gagal, kemungkinan kerusakan RAM atau kartu grafis.', 'monitor, layar gelap, no signal, display, komputer mati', 'category-hardware', 1, CURRENT_TIMESTAMP),
  ('article-email-send', 'Email masuk tapi tidak bisa mengirim', 'Periksa konfigurasi SMTP pada aplikasi email (port 587 dengan TLS). Pastikan kuota email tidak penuh. Jika menggunakan webmail dan tetap gagal, kemungkinan ada pemblokiran outgoing oleh server — buat tiket ke tim IT.', 'email, mengirim, smtp, outgoing, webmail', 'category-software', 1, CURRENT_TIMESTAMP),
  ('article-vpn', 'VPN tidak bisa connect saat WFH', 'Pastikan kredensial VPN masih aktif dan belum kedaluwarsa. Coba ganti protokol koneksi (IKEv2/OpenVPN). Periksa firewall atau antivirus yang memblokir koneksi. Restart perangkat lalu coba lagi sebelum membuat tiket.', 'vpn, wfh, remote, koneksi, ikev2', 'category-network', 1, CURRENT_TIMESTAMP),
  ('article-lockout', 'Akun terkunci setelah salah password berulang', 'Akun terkunci otomatis setelah 5 kali percobaan password gagal selama 15 menit. Tunggu masa penguncian berakhir atau hubungi tim IT untuk membuka kunci lebih cepat dengan verifikasi identitas.', 'akun terkunci, lockout, salah password, verifikasi', 'category-account', 1, CURRENT_TIMESTAMP),
  ('article-laptop', 'Laptop cepat panas dan kipas berisik', 'Gunakan laptop di permukaan keras yang rata agar sirkulasi udara lancar. Bersihkan ventilasi dari debu secara berkala. Tutup aplikasi berat yang tidak dipakai. Jika panas berlebihan berlanjut, kemungkinan pasta termal perlu diganti — bawa ke tim IT.', 'laptop panas, kipas, overheat, termal, performa', 'category-hardware', 1, CURRENT_TIMESTAMP),
  ('article-access', 'Cara request akses aplikasi internal baru', 'Ajukan tiket dengan kategori Account & Access, cantumkan nama aplikasi dan kebutuhan bisnis. Persetujuan atasan langsung diperlukan sebelum akses diberikan. Akses biasanya aktif maksimal 2 hari kerja setelah disetujui.', 'akses, aplikasi internal, request, persetujuan, sso', 'category-account', 1, CURRENT_TIMESTAMP);

INSERT OR IGNORE INTO "User" ("id", "name", "department", "joinCode") VALUES
  ('user-budi', 'Budi Santoso', 'Keuangan', 'BUD123'),
  ('user-siti', 'Siti Rahma', 'SDM', 'SIT456'),
  ('user-andi', 'Andi Wijaya', 'Operasional', 'AND789');
