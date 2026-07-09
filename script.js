// Pastikan URL ini persis sama dengan GAS_URL yang ada di file script.js Anda!

let JADWAL_MAPEL = {};

function showLoading(show) {
    document.getElementById('loadingScreen').style.display = show ? 'flex' : 'none';
}

function tarikDataDariDatabase() {
    const inputNis = document.getElementById('ortuNis').value.trim();
    const inputTgl = document.getElementById('ortuTglLahir').value;
    const containerHasil = document.getElementById('hasilDataOrtu');

    if (!inputNis || !inputTgl) {
        return Swal.fire('Perhatian', 'Mohon isi Nomor NIS dan pilih Tanggal Lahir terlebih dahulu.', 'warning');
    }

    showLoading(true);

    // Konversi tanggal
    const objekTanggal = new Date(inputTgl);
    const opsiFormat = { day: 'numeric', month: 'long', year: 'numeric' };
    const ejaanTglLahir = objekTanggal.toLocaleDateString('id-ID', opsiFormat).toLowerCase();

    // Siapkan 2 penarik data secara bersamaan (Data Santri & Data Master Mapel)
    const fdSantri = new URLSearchParams(); fdSantri.append('action', 'getSantri');
    const fdMapel = new URLSearchParams(); fdMapel.append('action', 'getAllMapel');

    Promise.all([
        fetch(GAS_URL, { method: 'POST', body: fdSantri }).then(r => r.json()),
        fetch(GAS_URL, { method: 'POST', body: fdMapel }).then(r => r.json())
    ])
    .then(([responseSantri, responseMapel]) => {
        // Simpan data master mapel ke memori
        if (responseMapel.status === 'success') JADWAL_MAPEL = responseMapel.data;
        if (responseSantri.status !== 'success') throw new Error("Gagal mengambil master data.");

        // Cari santri yang cocok
        const santriTerpilih = responseSantri.data.find(s => s.nis.toString() === inputNis && s.ttl.toLowerCase().includes(ejaanTglLahir));

        if (!santriTerpilih) {
            showLoading(false);
            containerHasil.classList.add('hidden');
            return Swal.fire('Data Tidak Cocok', 'Nomor NIS atau Tanggal Lahir santri yang Anda masukkan salah.', 'error');
        }

      // Pasang Identitas
        document.getElementById('ortuNamaSantri').innerText = santriTerpilih.nama;
        document.getElementById('ortuNisSantri').innerText = santriTerpilih.nis;
        document.getElementById('ortuKelasSantri').innerText = santriTerpilih.kelas;
        
        // Pasang Tambahan Jenis Kelamin, Orang Tua & Alamat
        document.getElementById('ortuJkSantri').innerText = santriTerpilih.jk ? santriTerpilih.jk : '-';
        let namaAyah = santriTerpilih.ayah ? santriTerpilih.ayah : '-';
        let namaIbu = santriTerpilih.ibu ? santriTerpilih.ibu : '-';
        document.getElementById('ortuNamaOrtu').innerText = namaAyah + " & " + namaIbu;
        document.getElementById('ortuAlamatSantri').innerText = santriTerpilih.alamat ? santriTerpilih.alamat : '-';

		// Panggil fungsi riwayat SPP
        muatRiwayatSpp(santriTerpilih.nis);

        // Tarik Data Nilai & Pengaturan khusus untuk kelas santri terpilih
     const fdNilai = new URLSearchParams();
     fdNilai.append('action', 'getDataNilai');
     fdNilai.append('kelas', santriTerpilih.kelas);

     const fdPengaturan = new URLSearchParams();
     fdPengaturan.append('action', 'getPengaturan');
     fdPengaturan.append('kelas', santriTerpilih.kelas);

     return Promise.all([
         fetch(GAS_URL, { method: 'POST', body: fdNilai }).then(r => r.json()),
         fetch(GAS_URL, { method: 'POST', body: fdPengaturan }).then(r => r.json())
     ])
     .then(([responseNilai, responsePengaturan]) => {
         showLoading(false);
         if (responseNilai.status !== 'success') {
             return Swal.fire('Informasi', 'Data identitas benar, namun nilai kelas belum di-input guru.', 'info');
         }

         // Cek Status Rilis & Tarik Data Pengaturan
         let statusRilis = 'Sembunyi';
         let detailRapor = {}; // <-- Wadah baru untuk menampung Kepribadian & Absensi

         if (responsePengaturan.status === 'success') {
             if (responsePengaturan.umum && responsePengaturan.umum.status_rilis) {
                 statusRilis = responsePengaturan.umum.status_rilis;
             }
             if (responsePengaturan.detail) {
                 detailRapor = responsePengaturan.detail; // <-- Tangkap datanya disini
             }
         }

         // Lanjut ke proses render (Tambahkan detailRapor di akhir)
         prosesDanTampilkanData(inputNis, santriTerpilih.kelas, responseNilai.headers, responseNilai.data, statusRilis, detailRapor);
     });
		
    })
    .catch(err => {
        showLoading(false);
        Swal.fire('Koneksi Gagal', 'Gagal memuat informasi database dari server cloud.', 'error');
        console.error(err);
    });
}

function prosesDanTampilkanData(nis, kelas, headers, rows, statusRilis, detailRapor) {
    const containerHasil = document.getElementById('hasilDataOrtu');
    const tbodyNilai = document.getElementById('bodyTabelNilaiOrtu');
    tbodyNilai.innerHTML = '';

    // PERBAIKAN: Mencegah error jika Guru belum membuat database nilai sama sekali
    let barisSantri = undefined;
    if (headers && headers.length > 0) {
        const idxNis = headers.findIndex(h => h && h.toString().toUpperCase().includes('NIS'));
        if (idxNis > -1) {
            barisSantri = rows.find(row => row[idxNis] && row[idxNis].toString().replace(/'/g, "").trim() === nis.toString().trim());
        }
    }

    if (!barisSantri) {
        tbodyNilai.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">Nilai akademik semester ini belum dirilis guru kelas.</td></tr>';
        document.getElementById('ortuSakit').innerText = '0';
        document.getElementById('ortuIzin').innerText = '0';
        document.getElementById('ortuAlpa').innerText = '0';
        containerHasil.classList.remove('hidden');
        return;
    }

    let dataMap = {};
    headers.forEach((h, i) => { dataMap[h.toLowerCase()] = barisSantri[i]; });

    // SET ABSENSI
    // ==============================================================
    // SET KEPRIBADIAN & ABSENSI BARU DARI MENU PENGATURAN
    // ==============================================================
    
    // Ambil data detail santri spesifik berdasarkan NIS
    let detSantri = { akhlaq: '-', kerajinan: '-', disiplin: '-', rapi: '-', sakit: '0', izin: '0', alpa: '0', catatan: '-', keputusan: '-' };
    if (detailRapor && detailRapor[nis]) {
        detSantri = detailRapor[nis];
    }

    // Tampilkan data Absensi
    document.getElementById('ortuSakit').innerText = detSantri.sakit || '0';
    document.getElementById('ortuIzin').innerText = detSantri.izin || '0';
    document.getElementById('ortuAlpa').innerText = detSantri.alpa || '0';

    // Tampilkan data Kepribadian & Catatan Wali Kelas
    // Tampilkan data Kepribadian & Catatan Wali Kelas
    let elAkhlaq = document.getElementById('ortuAkhlaq');
    if (elAkhlaq) { 
        elAkhlaq.innerText = (detSantri.akhlaq || '-').toString().toUpperCase();
        document.getElementById('ortuRajin').innerText = (detSantri.kerajinan || '-').toString().toUpperCase();
        document.getElementById('ortuDisiplin').innerText = (detSantri.disiplin || '-').toString().toUpperCase();
        document.getElementById('ortuRapi').innerText = (detSantri.rapi || '-').toString().toUpperCase();
        
        // Ubah juga Keputusan Akhir agar kapital semua
        document.getElementById('ortuKeputusan').innerText = (detSantri.keputusan || '-').toString().toUpperCase();
        
       // Catatan Wali Kelas sesuai aslinya
        let teksCatatan = detSantri.catatan ? detSantri.catatan.toString() : "-";
        document.getElementById('ortuCatatan').innerText = teksCatatan;
    }
    // ==============================================================

    // CEK STATUS RILIS NILAI
    if (statusRilis === 'Sembunyi') {
        tbodyNilai.innerHTML = '<tr><td colspan="3" class="p-8 text-center text-gray-500"><i class="fas fa-lock text-4xl mb-3 block text-gray-300"></i>Nilai akademik semester ini belum dirilis oleh madrasah.<br><span class="text-xs">Silakan cek kembali secara berkala.</span></td></tr>';
        containerHasil.classList.remove('hidden');
        return; // Hentikan proses merender angka nilai
    }

  // ==========================================
    // LOGIKA RENDER NILAI DENGAN KATEGORI A B C
    // ==========================================
    let adaNilai = false;
    const dataMapel = JADWAL_MAPEL[kelas] || { tulis: [], praktek: [], baca: [] };

    // Fungsi kecil pembantu untuk merender 1 baris mapel (ditambah parameter nomor)
    function getBarisHTML(mapel, isGrouped, nomor = '') {
        const skor = dataMap[mapel.toLowerCase()] || '-';
        let kategori = '-';

        if (skor !== '-') {
            const numSkor = parseFloat(skor);
            if (numSkor >= 85) kategori = '<span class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded text-xs font-bold">A</span>';
            else if (numSkor >= 75) kategori = '<span class="bg-blue-100 text-blue-700 px-2.5 py-1 rounded text-xs font-bold">B</span>';
            else if (numSkor >= 65) kategori = '<span class="bg-orange-100 text-orange-700 px-2.5 py-1 rounded text-xs font-bold">C</span>';
            else kategori = '<span class="bg-red-100 text-red-700 px-2.5 py-1 rounded text-xs font-bold">D</span>';
        }

        let prefix = isGrouped ? `<span class="text-gray-500 mr-2 font-bold inline-block w-4 text-right">${nomor}.</span>` : '';
        let padding = isGrouped ? 'pl-4' : '';

        // Penambahan class 'whitespace-nowrap' pada elemen <td> pertama
        return `
            <tr class="hover:bg-gray-50/80 transition-all">
                <td class="p-3 font-semibold text-gray-700 uppercase text-xs ${padding} whitespace-nowrap">${prefix}${mapel}</td>
                <td class="p-3 text-center font-black text-base ${parseFloat(skor) < 75 ? 'text-red-500' : 'text-emerald-600'}">${skor}</td>
                <td class="p-3 text-center">${kategori}</td>
            </tr>
        `;
    }

    // Cek apakah ini kelas Ibtidaiyah/Sanawiyah yang mapelnya sudah dikategorikan di Pengaturan
    if (!kelas.includes('TK') && (dataMapel.tulis.length > 0 || dataMapel.praktek.length > 0 || dataMapel.baca.length > 0)) {
        
        // KATEGORI A: TERTULIS (Ditambah whitespace-nowrap)
        if (dataMapel.tulis && dataMapel.tulis.length > 0) {
            tbodyNilai.innerHTML += `<tr class="bg-emerald-50/50"><td colspan="3" class="p-2.5 font-bold text-emerald-800 text-xs border-y border-emerald-100 whitespace-nowrap"><i class="fas fa-pen-alt mr-2 text-emerald-600"></i>A. UJIAN TERTULIS</td></tr>`;
            dataMapel.tulis.forEach((m, index) => { tbodyNilai.innerHTML += getBarisHTML(m, true, index + 1); adaNilai = true; });
        }
        
        // KATEGORI B: PRAKTEK (Ditambah whitespace-nowrap)
        if (dataMapel.praktek && dataMapel.praktek.length > 0) {
            tbodyNilai.innerHTML += `<tr class="bg-blue-50/50"><td colspan="3" class="p-2.5 font-bold text-blue-800 text-xs border-y border-blue-100 whitespace-nowrap"><i class="fas fa-praying-hands mr-2 text-blue-600"></i>B. UJIAN PRAKTEK</td></tr>`;
            dataMapel.praktek.forEach((m, index) => { tbodyNilai.innerHTML += getBarisHTML(m, true, index + 1); adaNilai = true; });
        }
        
        // KATEGORI C: MEMBACA (Ditambah whitespace-nowrap)
        if (dataMapel.baca && dataMapel.baca.length > 0) {
            tbodyNilai.innerHTML += `<tr class="bg-purple-50/50"><td colspan="3" class="p-2.5 font-bold text-purple-800 text-xs border-y border-purple-100 whitespace-nowrap"><i class="fas fa-book-open mr-2 text-purple-600"></i>C. UJIAN MEMBACA</td></tr>`;
            dataMapel.baca.forEach((m, index) => { tbodyNilai.innerHTML += getBarisHTML(m, true, index + 1); adaNilai = true; });
        }

   } else {
        // Mode Khusus (Untuk TK) - Agregasi Semua Hari/Baris
        let subjekTK = [];
        let grandTotal = 0;
        let mapelCount = 0;

        const idxNis = headers.findIndex(h => h && h.toString().toUpperCase().includes('NIS'));
        const idxM1 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'mapel 1' || h.toString().toLowerCase() === 'm1'));
        const idxN1 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'nilai 1' || h.toString().toLowerCase() === 'n1'));
        const idxM2 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'mapel 2' || h.toString().toLowerCase() === 'm2'));
        const idxN2 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'nilai 2' || h.toString().toLowerCase() === 'n2'));
        const idxM3 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'mapel 3' || h.toString().toLowerCase() === 'm3'));
        const idxN3 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'nilai 3' || h.toString().toLowerCase() === 'n3'));

        // 1. Tarik SEMUA baris milik anak ini (Bukan cuma baris pertama)
        const semuaBarisSantriTK = rows.filter(row => row[idxNis] && row[idxNis].toString().replace(/'/g, "").trim() === nis.toString().trim());

        // 2. Kumpulkan semua mata pelajaran dari berbagai hari
        semuaBarisSantriTK.forEach(row => {
            const extractData = (iM, iN) => {
                if (iM > -1 && iN > -1) {
                    let mapel = row[iM];
                    let nilai = row[iN];
                    if (mapel && mapel !== '-' && mapel.toString().trim() !== '') {
                        subjekTK.push({ namaMapel: mapel, skor: nilai });
                        let num = parseFloat(nilai);
                        if (!isNaN(num)) {
                            grandTotal += num;
                            mapelCount++;
                        }
                    }
                }
            };
            extractData(idxM1, idxN1);
            extractData(idxM2, idxN2);
            extractData(idxM3, idxN3);
        });

        // 3. Cetak ke tabel HTML Portal Ortu
        let noUrutTK = 1;
        subjekTK.forEach(item => {
            let kategori = '-';
            let warnaTeksAngka = 'text-gray-500';
            
            if (item.skor && item.skor !== '-') {
                const numSkor = parseFloat(item.skor);
                if (!isNaN(numSkor)) {
                    if (numSkor >= 90) kategori = '<span class="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded text-xs font-bold">A</span>';
                    else if (numSkor >= 80) kategori = '<span class="bg-blue-100 text-blue-700 px-2.5 py-1 rounded text-xs font-bold">B</span>';
                    else if (numSkor >= 70) kategori = '<span class="bg-orange-100 text-orange-700 px-2.5 py-1 rounded text-xs font-bold">C</span>';
                    else kategori = '<span class="bg-red-100 text-red-700 px-2.5 py-1 rounded text-xs font-bold">D</span>';
                    warnaTeksAngka = numSkor < 75 ? 'text-red-500' : 'text-emerald-600';
                }
            }

            tbodyNilai.innerHTML += `
                <tr class="hover:bg-gray-50/80 transition-all">
                    <td class="p-3 font-semibold text-gray-700 uppercase text-xs pl-4 whitespace-nowrap">
                        <span class="text-gray-500 mr-2 font-bold inline-block w-4 text-right">${noUrutTK}.</span>${item.namaMapel}
                    </td>
                    <td class="p-3 text-center font-black text-base ${warnaTeksAngka}">${item.skor || '-'}</td>
                    <td class="p-3 text-center">${kategori}</td>
                </tr>
            `;
            noUrutTK++;
            adaNilai = true;
        });

        // 4. Paksa perhitungan Total dan Rata-Rata TK menggunakan angka gabungan
        setTimeout(() => {
            document.getElementById('ortuTotalNilai').innerText = grandTotal;
            document.getElementById('ortuRataRata').innerText = mapelCount > 0 ? (grandTotal / mapelCount).toFixed(1) : "0.0";
        }, 50);
    }

    if (!adaNilai) {
        tbodyNilai.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">Belum ada komponen mapel terinput.</td></tr>';
        document.getElementById('footerTabelNilaiOrtu').classList.add('hidden');
    } else {
        // ==========================================
        // LOGIKA TAMPILKAN TOTAL, RATA-RATA & RANKING
        // ==========================================
        const footerTabel = document.getElementById('footerTabelNilaiOrtu');
        if(footerTabel) footerTabel.classList.remove('hidden');

      // 1. Ambil Total dan Hitung Ulang Rata-rata (Anti-Bug Tanggal)
        let stringTotal = dataMap['total nilai'] || dataMap['total'] || '-';
        let numTotal = parseFloat(stringTotal);
        
        document.getElementById('ortuTotalNilai').innerText = stringTotal;
        
        let rataBenar = '-';
        if (stringTotal !== '-' && !isNaN(numTotal)) {
            if (!kelas.includes('TK')) {
                let jmlMapel = (JADWAL_MAPEL[kelas] && JADWAL_MAPEL[kelas].semua) ? JADWAL_MAPEL[kelas].semua.length : 0;
                if (jmlMapel > 0) {
                    rataBenar = (numTotal / jmlMapel).toFixed(1);
                } else {
                    // Tarik dari database jika mapel kosong
                    let valRataSheet = dataMap['rata-rata'] || dataMap['rata'] || 0;
                    rataBenar = !isNaN(parseFloat(valRataSheet)) ? parseFloat(valRataSheet).toFixed(1) : "0.0";
                }
            } else {
                // Khusus TK
                let valRataSheet = dataMap['rata-rata'] || dataMap['rata'] || 0;
                rataBenar = !isNaN(parseFloat(valRataSheet)) ? parseFloat(valRataSheet).toFixed(1) : "0.0";
            }
        }
        document.getElementById('ortuRataRata').innerText = rataBenar;

       // 2. Hitung Peringkat Kelas secara dinamis (Perbaikan Deduplikasi & TK)
        const idxTotal = headers.findIndex(h => h.toString().toLowerCase() === 'total nilai' || h.toString().toLowerCase() === 'total');
        const idxNis = headers.findIndex(h => h.toString().toLowerCase() === 'nis');
        
        let rank = '-';
        let jmlSantri = 0;
        
        if (idxNis > -1) {
            let rekapNilai = new Map();

            if (kelas.includes('TK')) {
                const idxN1 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'nilai 1' || h.toString().toLowerCase() === 'n1'));
                const idxN2 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'nilai 2' || h.toString().toLowerCase() === 'n2'));
                const idxN3 = headers.findIndex(h => h && (h.toString().toLowerCase() === 'nilai 3' || h.toString().toLowerCase() === 'n3'));

                rows.forEach(r => {
                    let nisSiswa = r[idxNis] ? r[idxNis].toString().replace(/'/g, "").trim() : null;
                    if (!nisSiswa) return;
                    
                    let totalBaris = 0;
                    [idxN1, idxN2, idxN3].forEach(idx => {
                        if (idx > -1 && r[idx] && r[idx] !== '-' && !isNaN(parseFloat(r[idx]))) {
                            totalBaris += parseFloat(r[idx]);
                        }
                    });

                    if (rekapNilai.has(nisSiswa)) {
                        rekapNilai.set(nisSiswa, rekapNilai.get(nisSiswa) + totalBaris);
                    } else {
                        rekapNilai.set(nisSiswa, totalBaris);
                    }
                });
            } else if (idxTotal > -1) {
                rows.forEach(r => {
                    let nisSiswa = r[idxNis] ? r[idxNis].toString().replace(/'/g, "").trim() : null;
                    if (nisSiswa && r[idxTotal] !== "" && !isNaN(parseFloat(r[idxTotal]))) {
                        if (!rekapNilai.has(nisSiswa)) {
                            rekapNilai.set(nisSiswa, parseFloat(r[idxTotal]));
                        }
                    }
                });
            }

            let santriDinilai = Array.from(rekapNilai, ([nisSiswa, total]) => ({ nis: nisSiswa, total: total }));
                
            // 1. Urutkan berdasarkan total nilai terbesar
            santriDinilai.sort((a, b) => b.total - a.total);
            jmlSantri = santriDinilai.length; 
            
            // 2. Terapkan Logika Ranking Kembar (Tied Ranks)
            let rankAktual = 1;
            for (let k = 0; k < santriDinilai.length; k++) {
                if (k > 0 && santriDinilai[k].total === santriDinilai[k-1].total) {
                    santriDinilai[k].rank = rankAktual; // Ranking sama jika nilai sama
                } else {
                    rankAktual = k + 1; // Lompat ke ranking semestinya
                    santriDinilai[k].rank = rankAktual;
                }
            }
            
            // 3. Cari ranking untuk santri yang sedang dicek oleh Orang Tua
            let santriIni = santriDinilai.find(s => s.nis === nis.toString().trim());
            if (santriIni) {
                rank = santriIni.rank;
            }
        }
        
        document.getElementById('ortuRanking').innerText = rank;
        document.getElementById('ortuJumlahSantri').innerText = jmlSantri;
    }

    containerHasil.classList.remove('hidden');
}
// ==========================================
// FUNGSI TARIK DATA RIWAYAT SPP KHUSUS ORTU
// ==========================================
function muatRiwayatSpp(nisSantri) {
    const wadah = document.getElementById('wadahSppOrtu');
    wadah.innerHTML = '<div class="text-center text-xs text-gray-400 py-4"><i class="fas fa-spinner fa-spin mr-1"></i> Memuat data...</div>';
    
    const fd = new URLSearchParams();
    fd.append('action', 'getSppSantri'); // Endpoint yang dibuat di APPSSCRIPT.txt
    fd.append('nis', nisSantri);

    fetch(GAS_URL, { method: 'POST', body: fd })
    .then(r => r.json())
    .then(res => {
        wadah.innerHTML = ''; 
        
        if (res.status === 'success' && res.data.length > 0) {
            res.data.forEach(item => {
                let warnaTeks = item.status.includes('LUNAS') ? 'text-emerald-600' : 
                                item.status.includes('BELUM') ? 'text-red-500' : 'text-amber-500';
                let warnaBg = item.status.includes('LUNAS') ? 'bg-emerald-50' : 
                              item.status.includes('BELUM') ? 'bg-red-50' : 'bg-amber-50';

                wadah.innerHTML += `
                    <div class="flex justify-between items-center p-2 rounded-lg border border-gray-50 text-xs ${warnaBg} mb-2">
                        <span class="font-medium text-gray-700">${item.keterangan}</span>
                        <span class="font-bold ${warnaTeks}">${item.status}</span>
                    </div>
                `;
            });
        } else {
            wadah.innerHTML = `<div class="text-center text-xs text-gray-400 py-4">Belum ada riwayat pembayaran yang tercatat.</div>`;
        }
    }).catch(e => {
        wadah.innerHTML = `<div class="text-center text-xs text-red-400 py-4">Gagal terhubung ke database.</div>`;
    });
}

// =========================================================
// PWA (PROGRESSIVE WEB APP) KHUSUS PORTAL WALI SANTRI
// =========================================================
let deferredPromptOrtu;
const installPromptOrtu = document.getElementById('pwaInstallPromptOrtu');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Ubah menjadi ./sw.js agar fokus pada scope folder informasi saja
        navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('PWA Portal Ortu aktif!'))
        .catch(err => console.log('PWA Portal Ortu gagal: ', err));
    });
}
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); 
    deferredPromptOrtu = e;
    if (installPromptOrtu) { 
        // Munculkan notifikasi install setelah 1.5 detik
        setTimeout(() => { 
            installPromptOrtu.classList.remove('translate-x-[150%]', 'opacity-0'); 
            installPromptOrtu.classList.add('translate-x-0', 'opacity-100'); 
        }, 1500); 
    }
});

function tutupNotifPWAOrtu() { 
    if(installPromptOrtu) { 
        installPromptOrtu.classList.remove('translate-x-0', 'opacity-100'); 
        installPromptOrtu.classList.add('translate-x-[150%]', 'opacity-0'); 
    } 
}

function installPWAOrtu() {
    if (deferredPromptOrtu) {
        deferredPromptOrtu.prompt();
        deferredPromptOrtu.userChoice.then((choiceResult) => { 
            if (choiceResult.outcome === 'accepted') { tutupNotifPWAOrtu(); } 
            deferredPromptOrtu = null; 
        });
    }
}

window.addEventListener('appinstalled', (evt) => { 
    tutupNotifPWAOrtu(); 
});

// =========================================================
// ROTASI QUOTES WALI SANTRI
// =========================================================
const daftarKutipan = [
    // --- Tentang Madrasah Darussalam ---
    "Madrasah Darussalam, oase ilmu di gurun zaman, tempat menanam benih-benih takwa.",
    "Di bawah panji Darussalam, generasi Rabbani ditempa untuk menjadi penerus perjuangan umat.",
    "Di sini, ilmu dunawi berpadu dengan hikmah ukhrawi dalam simfoni pendidikan yang harmonis.",
    "Cahaya ilmu memancar dari setiap bilik Darussalam, menerangi jiwa para santri.",
    "Darussalam, lebih dari sekadar sekolah, ini adalah keluarga besar yang saling menguatkan dalam kebaikan.",
    "Semoga Allah selalu meridhoi setiap langkah dan usaha Madrasah Darussalam.",
    "Terpancarlah cahaya kebenaran dari setiap sudut Darussalam, rumah ilmu dan akhlak mulia.",
    "Di Darussalam, kami mendidik hati dan akal, mencetak generasi yang cerdas dan saleh.",
    "Keberkahan mengalir dari doa-doa para Kyai dan Guru Darussalam yang tak pernah putus.",
    "Darussalam, benteng akidah di tengah badai zaman, penjaga tradisi dan nilai luhur.",
    "Setiap santri yang melangkah keluar adalah duta kebaikan, membawa nama harum Madrasah Darussalam.",
    
    // --- Tentang Peran Wali Santri ---
    "Wali Santri adalah mitra sejati Madrasah, pilar pendukung yang tak ternilai harganya.",
    "Kerjasama harmonis antara wali santri dan asatidz adalah kunci kesuksesan pendidikan santri.",
    "Doa ibu dan bapak di rumah adalah kekuatan utama yang membimbing langkah para santri di Madrasah.",
    "Wali Santri yang cerdas memahami bahwa pendidikan anak adalah investasi terbaik untuk dunia dan akhirat.",
    "Bersama, kita bahu-membahu membangun peradaban dari dalam keluarga, dengan Darussalam sebagai pilar utama.",
    "Keikhlasan dan dukungan wali santri adalah bahan bakar yang menggerakkan roda kemajuan Madrasah Darussalam.",
    "Hadirnya wali santri di setiap momen penting memperkuat semangat dan tekad Madrasah.",
    "Jadikan rumah sebagai madrasah pertama bagi anak-anak, dan percayakan Darussalam sebagai pilar utama.",
    "Mari kita jaga marwah dan nama baik Madrasah Darussalam, demi kebaikan bersama.",
    "Wali Santri yang solid, Madrasah yang hebat, Santri yang saleh.",
    "Terima kasih, wali santri, atas kepercayaan dan dukungan yang tak terhingga.",

    // --- Hubungan Alumni, Santri, Wali Santri dengan Guru ---
    "Alumni Darussalam adalah cerminan dari didikan luhur para asatidz dan Kyai.",
    "Tali silaturahmi tak pernah putus antara alumni, santri, wali santri, dan guru, dalam satu keluarga besar.",
    "Santri menghormati guru, alumni mengenang guru, wali santri mempercayai guru.",
    "Di mana pun alumni berada, nama guru selalu tertanam di dada, sebagai pedoman hidup.",
    "Keberhasilan alumni adalah kebanggaan dan bukti berkah dari ilmu yang diajarkan oleh para asatidz.",
    "Santri teladan adalah cermin bakti wali santri kepada para guru dan Madrasah.",
    "Hormatilah guru, maka ilmu akan berkah dan hidup akan terarah menuju keridhaan Allah.",
    "Dukungan wali santri kepada guru, demi kemaslahatan bersama para santri dan kemajuan Madrasah.",
    "Jaringan alumni yang kuat, saling dukung demi kemajuan almamater dan peradaban umat.",
    "Guru adalah pelita yang menerangi jalan, alumni adalah cahaya yang menyinari dunia, santri adalah generasi penerus perjuangan.",
    "Saling mendoakan dalam kebaikan, itulah kuncinya."
];

function rotasiKutipan() {
    const elemenKutipan = document.getElementById('kutipanTeks');
    if (!elemenKutipan) return;

    // Hilangkan teks (fade out)
    elemenKutipan.style.opacity = 0;
    
    setTimeout(() => {
        // Pilih angka acak dari 0 sampai 32
        const indeksAcak = Math.floor(Math.random() * daftarKutipan.length);
        
        // Ubah teks
        elemenKutipan.innerText = `"${daftarKutipan[indeksAcak]}"`;
        
        // Tampilkan teks kembali (fade in)
        elemenKutipan.style.opacity = 1;
    }, 500); // Waktu 500ms ini menyesuaikan dengan durasi animasi di HTML (duration-500)
}

// Jalankan ketika halaman selesai dimuat
document.addEventListener("DOMContentLoaded", () => {
    rotasiKutipan();
    // Ganti kutipan otomatis setiap 10 detik (12000 milidetik)
    setInterval(rotasiKutipan, 12000);
});

// =========================================================
// SCRIPT UNTUK EFEK GESER WIDGET WA (DRAG & DROP)
// =========================================================
const waWidget = document.getElementById('wa-widget');
const waLink = document.getElementById('wa-link');

if (waWidget && waLink) {
    let isDragging = false;
    let isMoved = false; 
    let startX, startY;

    // --- KUNCI UTAMANYA: Matikan drag bawaan browser agar logo bisa ditarik bebas ---
    waWidget.addEventListener('dragstart', function(e) {
        e.preventDefault();
    });

    // --- FUNGSI UNTUK DESKTOP (MOUSE) ---
    waWidget.addEventListener('mousedown', function(e) {
        isDragging = true;
        isMoved = false;
        startX = e.clientX - waWidget.getBoundingClientRect().left;
        startY = e.clientY - waWidget.getBoundingClientRect().top;
        waWidget.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        isMoved = true; 
        e.preventDefault(); 
        
        let newX = e.clientX - startX;
        let newY = e.clientY - startY;

        // Membatasi agar logo tidak keluar dari batas layar
        newX = Math.max(0, Math.min(newX, window.innerWidth - waWidget.offsetWidth));
        newY = Math.max(0, Math.min(newY, window.innerHeight - waWidget.offsetHeight));

        waWidget.style.left = newX + 'px';
        waWidget.style.top = newY + 'px';
        waWidget.style.bottom = 'auto'; 
        waWidget.style.right = 'auto';  
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
        waWidget.style.cursor = 'grab';
    });

    // --- FUNGSI UNTUK HP / SMARTPHONE (TOUCH) ---
    waWidget.addEventListener('touchstart', function(e) {
        isDragging = true;
        isMoved = false;
        let touch = e.touches[0];
        startX = touch.clientX - waWidget.getBoundingClientRect().left;
        startY = touch.clientY - waWidget.getBoundingClientRect().top;
    }, {passive: false});

    document.addEventListener('touchmove', function(e) {
        if (!isDragging) return;
        isMoved = true;
        e.preventDefault(); 
        let touch = e.touches[0];
        
        let newX = touch.clientX - startX;
        let newY = touch.clientY - startY;

        // Membatasi agar logo tidak keluar dari batas layar HP
        newX = Math.max(0, Math.min(newX, window.innerWidth - waWidget.offsetWidth));
        newY = Math.max(0, Math.min(newY, window.innerHeight - waWidget.offsetHeight));

        waWidget.style.left = newX + 'px';
        waWidget.style.top = newY + 'px';
        waWidget.style.bottom = 'auto';
        waWidget.style.right = 'auto';
    }, {passive: false});

    document.addEventListener('touchend', function() {
        isDragging = false;
    });

    // --- PENCEGAH KLIK TIDAK SENGAJA ---
    waLink.addEventListener('click', function(e) {
        if (isMoved) {
            e.preventDefault(); 
        }
    });
}