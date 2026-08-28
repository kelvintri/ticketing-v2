# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pengguna utama adalah IT support, agen helpdesk, dan administrator internal yang menangani antrean insiden serta permintaan layanan. End user adalah karyawan atau pengguna internal yang membutuhkan bantuan IT dan berinteraksi melalui Telegram.

## Product Purpose

Ticket.Ops adalah proyek tugas akhir berupa sistem IT ticketing. Sistem ini menggantikan proses pengisian formulir web manual dengan percakapan Telegram: end user cukup menjelaskan kebutuhan melalui chat, lalu sistem membantu menjawab, mengarahkan, atau membuat tiket yang dapat ditindaklanjuti oleh tim IT.

## Positioning

Produk memadukan alur ticketing operasional dengan asisten AI pada Telegram. AI dipakai untuk memahami permintaan, memberi bantuan berbasis knowledge base, dan membantu intake tiket; keputusan layanan dan tindakan tiket tetap berada dalam kendali agen IT.

## Operating Context

Produk berangkat dari pengalaman pengguna selama enam tahun bekerja sebagai IT support di perusahaan kontraktor. Sistem dipakai untuk memantau tiket, prioritas, status, SLA, percakapan agen–requester, artikel knowledge base, laporan operasional, dan koneksi akun Telegram melalui join code.

## Capabilities and Constraints

- SvelteKit yang dideploy sebagai Cloudflare Worker dengan Cloudflare D1 sebagai penyimpanan data.
- Tiket dapat dibuat dan dikelola melalui workspace web untuk agen; end user berinteraksi melalui Telegram.
- AI di jalur Telegram dapat membantu FAQ, pencarian knowledge base, status tiket, triage, dan handoff. Mutasi tiket tetap membutuhkan alur konfirmasi dan otorisasi aplikasi.
- Pemantauan SLA, status tiket, prioritas, assignment agen, laporan bulanan, serta role agen/admin adalah bagian dari produk.
- Bahasa antarmuka utama adalah Indonesia.

## Brand Commitments

- Nama produk: Ticket.Ops.
- Suara produk: profesional, jelas, dan membantu untuk konteks operasional IT.
- Nilai pembeda yang perlu terlihat dalam demonstrasi TA: otomasi intake melalui Telegram dan bantuan AI yang tetap diawasi agen.

## Evidence on Hand

- Implementasi aplikasi SvelteKit/Cloudflare Worker berada di workspace ini.
- Migrasi, seed data, endpoint API, dan test Gemini tersedia di repository.
- Pengalaman kerja pengguna sebagai IT support selama enam tahun adalah konteks produk yang dikonfirmasi pengguna.
- Tidak ada klaim pelanggan, benchmark, kebijakan institusi, atau standar aksesibilitas khusus yang dikonfirmasi; pekerjaan mendatang tidak boleh mengarangnya.

## Product Principles

- Kurangi friksi requester: bantuan dimulai dari percakapan Telegram, bukan form panjang.
- Jadikan status, prioritas, dan risiko SLA cepat dipahami oleh agen.
- Gunakan AI sebagai bantuan konteks dan otomasi terkontrol, bukan pengganti keputusan manusia.
- Buat bukti operasional mudah dipresentasikan untuk kebutuhan tugas akhir.
- Pertahankan data, otorisasi, dan tindakan tiket dalam batas aplikasi yang dapat diaudit.
