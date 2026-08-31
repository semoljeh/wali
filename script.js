// Pastikan URL ini persis sama dengan GAS_URL yang ada di file config.js/script.js Anda!

// =========================================================
// WELCOME SCREEN (SAPAAN WALI SANTRI) - TAMPIL SETIAP SAAT
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
    const panelWelcome = document.getElementById('welcomeOrtu');
    
    // --- PANGGIL PENGUMUMAN PUBLIK DI SINI ---
    muatPengumumanPublik();
    
    // CEK APAKAH ADA SESI TERSIMPAN DI MEMORI BROWSER (MENGGUNAKAN LOCALSTORAGE)
    const savedNis = localStorage.getItem('ortuActiveNis');
    const savedTgl = localStorage.getItem('ortuActiveTgl');

    if (savedNis && savedTgl) {
        // Jika ada memori, sembunyikan Welcome Screen & tarik data
        if (document.getElementById('ortuNis')) document.getElementById('ortuNis').value = savedNis;
        if (document.getElementById('ortuTglLahir')) document.getElementById('ortuTglLahir').value = savedTgl;
        
        if (panelWelcome) {
            panelWelcome.style.display = 'none'; 
            panelWelcome.classList.add('hidden');
            panelWelcome.classList.add('opacity-0');
        }
        tarikDataDariDatabase();
    } else {
        // Jika tidak ada memori, biarkan Welcome Screen menutupi layar
        if (panelWelcome) {
            panelWelcome.style.display = ''; // Dikosongkan agar mengikuti bawaan CSS
            panelWelcome.classList.remove('hidden');
            setTimeout(() => {
                panelWelcome.classList.remove('opacity-0');
            }, 50);
        }
    }
});

function tutupWelcomeOrtu() {
    const panelWelcome = document.getElementById('welcomeOrtu');
    if (panelWelcome && panelWelcome.style.display !== 'none') {
        panelWelcome.classList.add('opacity-0');
        setTimeout(() => {
            panelWelcome.classList.add('hidden');
            panelWelcome.style.display = 'none';
        }, 700); 
    }
}

let JADWAL_MAPEL = {};

function showLoading(show) {
    document.getElementById('loadingScreen').style.display = show ? 'flex' : 'none';
    
    const btn = document.getElementById('btnMasukOrtu');
    if (btn) {
        if (show) {
            btn.disabled = true;
            btn.classList.add('opacity-75', 'cursor-not-allowed');
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> <span>Memproses...</span>';
        } else {
            btn.disabled = false;
            btn.classList.remove('opacity-75', 'cursor-not-allowed');
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Masuk ke Portal</span>';
        }
    }
}

function tarikDataDariDatabase() {
    const inputNis = document.getElementById('ortuNis').value.trim();
    const inputTgl = document.getElementById('ortuTglLahir').value;
    const containerHasil = document.getElementById('hasilDataOrtu');

    if (!inputNis || !inputTgl) {
        return Swal.fire('Perhatian', 'Mohon isi Nomor NIS dan pilih Tanggal Lahir terlebih dahulu.', 'warning');
    }

    // SIMPAN NIS & TANGGAL LAHIR KE MEMORI BROWSER PERMANEN (LOCALSTORAGE)
    localStorage.setItem('ortuActiveNis', inputNis);
    localStorage.setItem('ortuActiveTgl', inputTgl);

    showLoading(true);

    const objekTanggal = new Date(inputTgl);
    const opsiFormat = { day: 'numeric', month: 'long', year: 'numeric' };
    const ejaanTglLahir = objekTanggal.toLocaleDateString('id-ID', opsiFormat).toLowerCase();

    const fdSantri = new URLSearchParams(); fdSantri.append('action', 'getSantri');
    const fdMapel = new URLSearchParams(); fdMapel.append('action', 'getAllMapel');

    Promise.all([
        fetch(GAS_URL, { method: 'POST', body: fdSantri }).then(r => r.json()),
        fetch(GAS_URL, { method: 'POST', body: fdMapel }).then(r => r.json())
    ])
    .then(([responseSantri, responseMapel]) => {
        if (responseMapel.status === 'success') JADWAL_MAPEL = responseMapel.data;
        if (responseSantri.status !== 'success') throw new Error("Gagal mengambil master data.");

        const santriTerpilih = responseSantri.data.find(s => s.nis.toString() === inputNis && s.ttl.toLowerCase().includes(ejaanTglLahir));

        if (!santriTerpilih) {
            showLoading(false);
            if (containerHasil) containerHasil.classList.add('hidden');
            
            // Hapus memori jika ternyata datanya salah agar tidak nyangkut saat di-refresh
            localStorage.removeItem('ortuActiveNis');
            localStorage.removeItem('ortuActiveTgl');
            
            const panelWelcome = document.getElementById('welcomeOrtu');
            if (panelWelcome) {
                panelWelcome.style.display = 'flex';
                panelWelcome.classList.remove('hidden');
                setTimeout(() => panelWelcome.classList.remove('opacity-0'), 50);
            }
            return Swal.fire('Data Tidak Cocok', 'Nomor NIS atau Tanggal Lahir santri yang Anda masukkan salah.', 'error');
        }

document.getElementById('ortuNamaSantri').innerText = santriTerpilih.nama;
        document.getElementById('ortuNisSantri').innerText = santriTerpilih.nis;
        document.getElementById('ortuKelasSantri').innerText = santriTerpilih.kelas;
        
        document.getElementById('ortuJkSantri').innerText = santriTerpilih.jk ? santriTerpilih.jk : '-';
        let namaAyah = santriTerpilih.ayah ? santriTerpilih.ayah : '-';
        let namaIbu = santriTerpilih.ibu ? santriTerpilih.ibu : '-';
        document.getElementById('ortuNamaOrtu').innerText = namaAyah + " & " + namaIbu;
        document.getElementById('ortuAlamatSantri').innerText = santriTerpilih.alamat ? santriTerpilih.alamat : '-';

        // --- KODE AUTO FOTO SANTRI UNTUK PORTAL ORTU ---
        const imgFotoSantri = document.getElementById('ortuFotoSantri');
        if (imgFotoSantri) {
            let fotoUrl = santriTerpilih.foto || '';
            if (fotoUrl && fotoUrl.trim() !== '') {
                let finalUrl = fotoUrl;
                if (fotoUrl.includes('drive.google.com')) {
                    let fileId = '';
                    if (fotoUrl.includes('id=')) fileId = fotoUrl.split('id=')[1].split('&')[0];
                    else if (fotoUrl.includes('/d/')) fileId = fotoUrl.split('/d/')[1].split('/')[0];
                    
                    // Memakai trik Thumbnail API agar gambar Drive bisa tampil (Bypass CORS)
                    if (fileId) finalUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w500`;
                }
                imgFotoSantri.src = finalUrl;
            } else {
                // Jika foto tidak ada, otomatis buat inisial dari nama asli santri
                let inisialNama = encodeURIComponent(santriTerpilih.nama || 'Santri');
                imgFotoSantri.src = `https://ui-avatars.com/api/?name=${inisialNama}&background=065f46&color=fff`;
            }
        }
        // -----------------------------------------------

        // Panggil SPP
        muatRiwayatSpp(santriTerpilih.nis);

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

            let statusRilis = 'Sembunyi';
            let detailRapor = {}; 

           if (responsePengaturan.status === 'success') {
                if (responsePengaturan.umum && responsePengaturan.umum.status_rilis) {
                    statusRilis = responsePengaturan.umum.status_rilis;
                }
                if (responsePengaturan.detail) {
                    detailRapor = responsePengaturan.detail; 
                }
            }

// PROSES RENDER DATA
            prosesDanTampilkanData(inputNis, santriTerpilih.kelas, responseNilai.headers, responseNilai.data, statusRilis, detailRapor);
            
            // MENUTUP WELCOME SCREEN SETELAH RENDER SELESAI
            tutupWelcomeOrtu();

            // MUNCULKAN BANNER PWA SETELAH SEMUA SELESAI
            tampilkanPromptPWAOrtu();
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
    if(tbodyNilai) tbodyNilai.innerHTML = '';

    let barisSantri = undefined;
    if (headers && headers.length > 0) {
        const idxNis = headers.findIndex(h => h && h.toString().toUpperCase().includes('NIS'));
        if (idxNis > -1) {
            barisSantri = rows.find(row => row[idxNis] && row[idxNis].toString().replace(/'/g, "").trim() === nis.toString().trim());
        }
    }

    if (!barisSantri) {
        if(tbodyNilai) tbodyNilai.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">Nilai akademik semester ini belum dirilis guru kelas.</td></tr>';
        if(document.getElementById('ortuSakit')) document.getElementById('ortuSakit').innerText = '0';
        if(document.getElementById('ortuIzin')) document.getElementById('ortuIzin').innerText = '0';
        if(document.getElementById('ortuAlpa')) document.getElementById('ortuAlpa').innerText = '0';
        containerHasil.classList.remove('hidden');
        return;
    }

    let dataMap = {};
    headers.forEach((h, i) => { dataMap[h.toLowerCase()] = barisSantri[i]; });

    let detSantri = { akhlaq: '-', kerajinan: '-', disiplin: '-', rapi: '-', sakit: '0', izin: '0', alpa: '0', catatan: '-', keputusan: '-' };
    if (detailRapor && detailRapor[nis]) {
        detSantri = detailRapor[nis];
    }

    if(document.getElementById('ortuSakit')) document.getElementById('ortuSakit').innerText = detSantri.sakit || '0';
    if(document.getElementById('ortuIzin')) document.getElementById('ortuIzin').innerText = detSantri.izin || '0';
    if(document.getElementById('ortuAlpa')) document.getElementById('ortuAlpa').innerText = detSantri.alpa || '0';

    let elAkhlaq = document.getElementById('ortuAkhlaq');
    if (elAkhlaq) { 
        elAkhlaq.innerText = (detSantri.akhlaq || '-').toString().toUpperCase();
        document.getElementById('ortuRajin').innerText = (detSantri.kerajinan || '-').toString().toUpperCase();
        document.getElementById('ortuDisiplin').innerText = (detSantri.disiplin || '-').toString().toUpperCase();
        document.getElementById('ortuRapi').innerText = (detSantri.rapi || '-').toString().toUpperCase();
        document.getElementById('ortuKeputusan').innerText = (detSantri.keputusan || '-').toString().toUpperCase();
        
        let teksCatatan = detSantri.catatan ? detSantri.catatan.toString() : "-";
        document.getElementById('ortuCatatan').innerText = teksCatatan;
    }

    if (statusRilis === 'Sembunyi') {
        if(tbodyNilai) tbodyNilai.innerHTML = '<tr><td colspan="3" class="p-8 text-center text-gray-500"><i class="fas fa-lock text-4xl mb-3 block text-gray-300"></i>Nilai akademik semester ini belum dirilis oleh madrasah.<br><span class="text-xs">Silakan cek kembali secara berkala.</span></td></tr>';
        containerHasil.classList.remove('hidden');
        return; 
    }

    let adaNilai = false;
    const dataMapel = JADWAL_MAPEL[kelas] || { tulis: [], praktek: [], baca: [] };

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

        return `
            <tr class="hover:bg-gray-50/80 transition-all">
                <td class="p-3 font-semibold text-gray-700 uppercase text-xs ${padding} whitespace-nowrap">${prefix}${mapel}</td>
                <td class="p-3 text-center font-black text-base ${parseFloat(skor) < 75 ? 'text-red-500' : 'text-emerald-600'}">${skor}</td>
                <td class="p-3 text-center">${kategori}</td>
            </tr>
        `;
    }

    if(tbodyNilai) {
        if (!kelas.includes('TK') && (dataMapel.tulis.length > 0 || dataMapel.praktek.length > 0 || dataMapel.baca.length > 0)) {
            
            if (dataMapel.tulis && dataMapel.tulis.length > 0) {
                tbodyNilai.innerHTML += `<tr class="bg-emerald-50/50"><td colspan="3" class="p-2.5 font-bold text-emerald-800 text-xs border-y border-emerald-100 whitespace-nowrap"><i class="fas fa-pen-alt mr-2 text-emerald-600"></i>A. UJIAN TERTULIS</td></tr>`;
                dataMapel.tulis.forEach((m, index) => { tbodyNilai.innerHTML += getBarisHTML(m, true, index + 1); adaNilai = true; });
            }
            
            if (dataMapel.praktek && dataMapel.praktek.length > 0) {
                tbodyNilai.innerHTML += `<tr class="bg-blue-50/50"><td colspan="3" class="p-2.5 font-bold text-blue-800 text-xs border-y border-blue-100 whitespace-nowrap"><i class="fas fa-praying-hands mr-2 text-blue-600"></i>B. UJIAN PRAKTEK</td></tr>`;
                dataMapel.praktek.forEach((m, index) => { tbodyNilai.innerHTML += getBarisHTML(m, true, index + 1); adaNilai = true; });
            }
            
            if (dataMapel.baca && dataMapel.baca.length > 0) {
                tbodyNilai.innerHTML += `<tr class="bg-purple-50/50"><td colspan="3" class="p-2.5 font-bold text-purple-800 text-xs border-y border-purple-100 whitespace-nowrap"><i class="fas fa-book-open mr-2 text-purple-600"></i>C. UJIAN MEMBACA</td></tr>`;
                dataMapel.baca.forEach((m, index) => { tbodyNilai.innerHTML += getBarisHTML(m, true, index + 1); adaNilai = true; });
            }

       } else {
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

            const semuaBarisSantriTK = rows.filter(row => row[idxNis] && row[idxNis].toString().replace(/'/g, "").trim() === nis.toString().trim());

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

            setTimeout(() => {
                if(document.getElementById('ortuTotalNilai')) document.getElementById('ortuTotalNilai').innerText = grandTotal;
                if(document.getElementById('ortuRataRata')) document.getElementById('ortuRataRata').innerText = mapelCount > 0 ? (grandTotal / mapelCount).toFixed(1) : "0.0";
            }, 50);
        }

        if (!adaNilai) {
            tbodyNilai.innerHTML = '<tr><td colspan="3" class="p-4 text-center text-gray-400">Belum ada komponen mapel terinput.</td></tr>';
            const footerTabel = document.getElementById('footerTabelNilaiOrtu');
            if (footerTabel) footerTabel.classList.add('hidden');
        } else {
            const footerTabel = document.getElementById('footerTabelNilaiOrtu');
            if(footerTabel) footerTabel.classList.remove('hidden');

            let stringTotal = dataMap['total nilai'] || dataMap['total'] || '-';
            let numTotal = parseFloat(stringTotal);
            
            if(document.getElementById('ortuTotalNilai')) document.getElementById('ortuTotalNilai').innerText = stringTotal;
            
            let rataBenar = '-';
            if (stringTotal !== '-' && !isNaN(numTotal)) {
                if (!kelas.includes('TK')) {
                    let jmlMapel = (JADWAL_MAPEL[kelas] && JADWAL_MAPEL[kelas].semua) ? JADWAL_MAPEL[kelas].semua.length : 0;
                    if (jmlMapel > 0) {
                        rataBenar = (numTotal / jmlMapel).toFixed(1);
                    } else {
                        let valRataSheet = dataMap['rata-rata'] || dataMap['rata'] || 0;
                        rataBenar = !isNaN(parseFloat(valRataSheet)) ? parseFloat(valRataSheet).toFixed(1) : "0.0";
                    }
                } else {
                    let valRataSheet = dataMap['rata-rata'] || dataMap['rata'] || 0;
                    rataBenar = !isNaN(parseFloat(valRataSheet)) ? parseFloat(valRataSheet).toFixed(1) : "0.0";
                }
            }
            if(document.getElementById('ortuRataRata')) document.getElementById('ortuRataRata').innerText = rataBenar;

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
                    
                santriDinilai.sort((a, b) => b.total - a.total);
                jmlSantri = santriDinilai.length; 
                
                let rankAktual = 1;
                for (let k = 0; k < santriDinilai.length; k++) {
                    if (k > 0 && santriDinilai[k].total === santriDinilai[k-1].total) {
                        santriDinilai[k].rank = rankAktual; 
                    } else {
                        rankAktual = k + 1; 
                        santriDinilai[k].rank = rankAktual;
                    }
                }
                
                let santriIni = santriDinilai.find(s => s.nis === nis.toString().trim());
                if (santriIni) {
                    rank = santriIni.rank;
                }
            }
            
            if(document.getElementById('ortuRanking')) document.getElementById('ortuRanking').innerText = rank;
            if(document.getElementById('ortuJumlahSantri')) document.getElementById('ortuJumlahSantri').innerText = jmlSantri;
        }
    }

    containerHasil.classList.remove('hidden');
}

function formatRp(angka) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(angka);
}

function muatRiwayatSpp(nisSantri) {
    const wadah = document.getElementById('wadahSppOrtu');
    const elTagihan = document.getElementById('ortuTagihanSpp');
    const elSisa = document.getElementById('ortuSisaSpp');
    
    if (!wadah) return;

    wadah.innerHTML = '<div class="text-center text-xs text-gray-400 py-4"><i class="fas fa-spinner fa-spin mr-1"></i> Memuat data...</div>';
    if (elTagihan) elTagihan.innerText = '-';
    if (elSisa) elSisa.innerText = '-';
    
    const fdSpp = new URLSearchParams();
    fdSpp.append('action', 'getSppSantri');
    fdSpp.append('nis', nisSantri);

    const fdSetting = new URLSearchParams();
    fdSetting.append('action', 'getSettingSpp');

    Promise.all([
        fetch(GAS_URL, { method: 'POST', body: fdSpp }).then(r => r.json()),
        fetch(GAS_URL, { method: 'POST', body: fdSetting }).then(r => r.json())
    ])
    .then(([resSpp, resSetting]) => {
        wadah.innerHTML = ''; 
        
        let totalTagihan = 0;
        if (resSetting && resSetting.status === 'success') {
            let nominal = parseFloat(resSetting.nominal) || 0;
            let bulan = parseFloat(resSetting.bulan) || 0;
            totalTagihan = nominal * bulan;
        }

        let totalTerbayar = 0;

        if (resSpp.status === 'success' && resSpp.data.length > 0) {
            resSpp.data.forEach(item => {
                let nom = parseFloat(item.nominal) || 0;
                totalTerbayar += nom;

                let warnaTeks = item.status === 'LUNAS' ? 'text-emerald-600' : 'text-amber-600';
                let warnaBg = item.status === 'LUNAS' ? 'bg-emerald-50 border-emerald-100' : 'bg-amber-50 border-amber-100';

                wadah.innerHTML += `
                    <div class="flex justify-between items-center p-2.5 rounded-lg border text-xs ${warnaBg} mb-2 shadow-sm">
                        <div>
                            <span class="font-bold text-gray-700 block mb-0.5">${item.keterangan}</span>
                            <span class="font-semibold text-blue-600">${formatRp(nom)}</span>
                        </div>
                        <span class="font-bold px-2 py-1 bg-white rounded-md ${warnaTeks} border shadow-sm">${item.status}</span>
                    </div>
                `;
            });
        } else {
            wadah.innerHTML = `<div class="text-center text-xs text-gray-400 py-4 italic">Belum ada riwayat pembayaran yang tercatat.</div>`;
        }

        let sisaTunggakan = Math.max(0, totalTagihan - totalTerbayar);
        
        if (elTagihan) elTagihan.innerText = formatRp(totalTagihan);
        if (elSisa) {
            if (sisaTunggakan === 0) {
                elSisa.innerHTML = '<i class="fas fa-check-circle mr-1"></i> LUNAS';
                elSisa.className = "text-sm font-black text-emerald-600";
            } else {
                elSisa.innerText = formatRp(sisaTunggakan);
                elSisa.className = "text-sm font-black text-red-500";
            }
        }
    }).catch(e => {
        wadah.innerHTML = `<div class="text-center text-xs text-red-400 py-4">Gagal terhubung ke database.</div>`;
        console.error(e);
    });
}


let deferredPromptOrtu;
const installPromptOrtu = document.getElementById('pwaInstallPromptOrtu');

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
        .then(reg => console.log('PWA Portal Ortu aktif!'))
        .catch(err => console.log('PWA Portal Ortu gagal: ', err));
    });
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); 
    deferredPromptOrtu = e; // Simpan event PWA, tapi jangan tampilkan dulu
});

// Buat fungsi khusus untuk memanggil banner PWA
function tampilkanPromptPWAOrtu() {
    const installPromptOrtu = document.getElementById('pwaInstallPromptOrtu');
    if (deferredPromptOrtu && installPromptOrtu) { 
        setTimeout(() => { 
            installPromptOrtu.classList.remove('-translate-y-[150%]', 'opacity-0'); 
            installPromptOrtu.classList.add('translate-y-0', 'opacity-100'); 
        }, 1000); // Banner akan turun 1 detik setelah dipanggil
    }
}

function tutupNotifPWAOrtu() { 
    if(installPromptOrtu) { 
        // Hapus class tengah, kembalikan posisi ke atas
        installPromptOrtu.classList.remove('translate-y-0', 'opacity-100'); 
        installPromptOrtu.classList.add('-translate-y-[150%]', 'opacity-0'); 
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


const daftarKutipan = [
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

    elemenKutipan.style.opacity = 0;
    
    setTimeout(() => {
        const indeksAcak = Math.floor(Math.random() * daftarKutipan.length);
        elemenKutipan.innerText = `"${daftarKutipan[indeksAcak]}"`;
        elemenKutipan.style.opacity = 1;
    }, 500); 
}

document.addEventListener("DOMContentLoaded", () => {
    rotasiKutipan();
    setInterval(rotasiKutipan, 12000); // Ganti teks setiap 12 detik
});

// =========================================================
// FUNGSI KELUAR / CEK SANTRI LAIN (DENGAN AUTO-CLEAR CACHE)
// =========================================================
function keluarPortal() {
    Swal.fire({
        title: 'Kembali?',
        text: "Anda akan keluar dan sistem akan membersihkan memori agar aplikasi tetap optimal.",
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#059669',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Ya, Keluar',
        cancelButtonText: 'Batal',
        customClass: { popup: 'rounded-2xl', confirmButton: 'rounded-xl', cancelButton: 'rounded-xl' }
    }).then((result) => {
        if (result.isConfirmed) {
            
            Swal.fire({
                title: 'Membersihkan Data...',
                text: 'Mohon tunggu sebentar.',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });

            // MENGHAPUS LOCALSTORAGE
            localStorage.removeItem('ortuActiveNis');
            localStorage.removeItem('ortuActiveTgl');
            localStorage.clear(); 

            // Bersihkan Cache Storage (PWA)
            if ('caches' in window) {
                caches.keys().then((names) => {
                    for (let name of names) {
                        caches.delete(name);
                    }
                });
            }

            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    for(let registration of registrations) {
                        registration.unregister();
                    }
                });
            }

            setTimeout(() => {
                window.location.href = window.location.href.split('?')[0] + '?v=' + new Date().getTime();
            }, 1000);
            
        }
    });
}

function infoPembayaran() {
    Swal.fire({
        title: '<span class="text-teal-700 font-bold text-lg sm:text-xl">Informasi Pembayaran</span>',
        html: `
            <div class="text-left text-xs sm:text-sm text-gray-600 space-y-3 mt-1 sm:mt-2 leading-relaxed">
                <p>Assalamu'alaikum Bapak/Ibu Wali Santri,</p>
                <div class="bg-emerald-50 p-3 sm:p-4 rounded-xl border border-emerald-200 shadow-sm">
                    <h6 class="font-bold text-emerald-800 mb-2 sm:mb-3 border-b border-emerald-200 pb-2 flex items-center text-xs sm:text-sm">
                        <i class="fas fa-file-invoice-dollar mr-2"></i> Rincian Biaya Syahriah (SPP)
                    </h6>
                    <ul class="text-gray-700 space-y-2">
                        <li class="flex flex-col sm:flex-row justify-between sm:items-center gap-0.5 sm:gap-0">
                            <span>Biaya Bulanan:</span>
                            <strong class="text-emerald-700 text-sm sm:text-base">Rp 15.000 <span class="text-[10px] sm:text-xs font-normal">/bulan</span></strong>
                        </li>
                        <li class="flex flex-col sm:flex-row justify-between sm:items-start pt-1 gap-0.5 sm:gap-0">
                            <span>Lunas 1 Tahun:</span>
                            <div class="text-left sm:text-right">
                                <strong class="text-emerald-700 text-sm sm:text-base">Rp 165.000</strong>
                                <p class="text-[9px] sm:text-[10px] text-emerald-600 italic leading-tight">(Total bayar 11 bulan)</p>
                            </div>
                        </li>
                    </ul>
                    <div class="mt-3 sm:mt-4 bg-white p-2 sm:p-2.5 rounded-lg border border-emerald-100 text-[10px] sm:text-[11px] text-center shadow-sm">
                        <i class="fas fa-gift text-emerald-500 mr-1"></i> Khusus <span class="line-through decoration-red-500 decoration-2 font-bold text-gray-500">BULAN RAMADHAN</span> santri dibebaskan dari biaya SPP.
                    </div>
                </div>
                <div class="bg-amber-50 p-3 sm:p-4 rounded-xl border border-amber-200 shadow-sm mt-2 sm:mt-3">
                    <p class="font-bold text-gray-800 text-xs sm:text-sm mb-1.5 flex items-center">
                        <i class="fas fa-hand-holding-usd text-amber-500 text-base sm:text-lg mr-2"></i> Metode Pembayaran
                    </p>
                    <p class="text-[11px] sm:text-xs text-gray-700 leading-relaxed">
                        Mohon maaf, fasilitas transfer bank belum tersedia. Mohon bayar <strong>tunai kepada Bendahara Madrasah</strong>.
                    </p>
                </div>
            </div>
        `,
        confirmButtonColor: '#059669',
        confirmButtonText: 'Terima Kasih',
        width: '92%',
        padding: '1.25em',
        customClass: { popup: 'rounded-2xl max-w-md', confirmButton: 'rounded-xl text-sm px-5 py-2 font-bold shadow-md' },
        didOpen: () => { history.pushState({ swalModal: true }, null, location.href); },
        willClose: () => { if (history.state && history.state.swalModal) history.back(); }
    });
}



const waWidget = document.getElementById('wa-widget');
const waLink = document.getElementById('wa-link');

if (waWidget && waLink) {
    let isDragging = false;
    let isMoved = false; 
    let startX, startY;

    waWidget.addEventListener('mousedown', function(e) {
        isDragging = true; isMoved = false;
        startX = e.clientX - waWidget.getBoundingClientRect().left;
        startY = e.clientY - waWidget.getBoundingClientRect().top;
        waWidget.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        isMoved = true; e.preventDefault(); 
        let newX = Math.max(0, Math.min(e.clientX - startX, window.innerWidth - waWidget.offsetWidth));
        let newY = Math.max(0, Math.min(e.clientY - startY, window.innerHeight - waWidget.offsetHeight));
        waWidget.style.left = newX + 'px'; waWidget.style.top = newY + 'px';
        waWidget.style.bottom = 'auto'; waWidget.style.right = 'auto';  
    });

    document.addEventListener('mouseup', function() { isDragging = false; waWidget.style.cursor = 'grab'; });

    waWidget.addEventListener('touchstart', function(e) {
        isDragging = true; isMoved = false;
        let touch = e.touches[0];
        startX = touch.clientX - waWidget.getBoundingClientRect().left;
        startY = touch.clientY - waWidget.getBoundingClientRect().top;
    }, {passive: false});

    document.addEventListener('touchmove', function(e) {
        if (!isDragging) return;
        isMoved = true; e.preventDefault(); 
        let touch = e.touches[0];
        let newX = Math.max(0, Math.min(touch.clientX - startX, window.innerWidth - waWidget.offsetWidth));
        let newY = Math.max(0, Math.min(touch.clientY - startY, window.innerHeight - waWidget.offsetHeight));
        waWidget.style.left = newX + 'px'; waWidget.style.top = newY + 'px';
        waWidget.style.bottom = 'auto'; waWidget.style.right = 'auto';
    }, {passive: false});

    document.addEventListener('touchend', function() { isDragging = false; });
    waLink.addEventListener('click', function(e) { if (isMoved) e.preventDefault(); });
}

window.addEventListener('pagehide', function() {
    if ('caches' in window) {
        caches.keys().then(function(cacheNames) {
            cacheNames.forEach(function(cacheName) { caches.delete(cacheName); });
        });
    }
});

function bukaPanelPengumuman() {
    const panel = document.getElementById('panelBottomPengumuman');
    const backdrop = document.getElementById('backdropPengumuman');
    if (panel && backdrop) {
        backdrop.classList.remove('hidden');
        history.pushState({ panelPengumumanTerbuka: true }, null, location.href);
        setTimeout(() => { backdrop.classList.remove('opacity-0'); panel.classList.remove('translate-y-full'); }, 10);
    }
}

function tutupPanelPengumuman(dariTombolBack = false) {
    const panel = document.getElementById('panelBottomPengumuman');
    const backdrop = document.getElementById('backdropPengumuman');
    if (panel && backdrop) {
        backdrop.classList.add('opacity-0'); panel.classList.add('translate-y-full'); 
        setTimeout(() => { backdrop.classList.add('hidden'); }, 300);
        if (!dariTombolBack && history.state && history.state.panelPengumumanTerbuka) history.back(); 
    }
}



function muatPengumumanPublik() {
    const wadah = document.getElementById('wadahPengumumanPublik');
    if (!wadah) return;

    wadah.innerHTML = '<div class="text-center text-xs text-gray-400 py-10"><i class="fas fa-spinner fa-spin mr-1"></i> Sedang memuat informasi dari server...</div>';
    const fdPengumuman = new URLSearchParams(); fdPengumuman.append('action', 'getPengumuman');

    const kategoriTetap = [
        { id: "Lomba", badge: "bg-orange-100 text-orange-600 border-orange-200", jdlKosong: "Informasi Perlombaan", isiKosong: "Belum ada agenda perlombaan terdekat." },
        { id: "Libur", badge: "bg-red-100 text-red-600 border-red-200", jdlKosong: "Jadwal Libur Madrasah", isiKosong: "Belum ada jadwal libur dalam waktu dekat." },
        { id: "Ujian", badge: "bg-purple-100 text-purple-600 border-purple-200", jdlKosong: "Pelaksanaan Ujian", isiKosong: "Belum ada jadwal ujian semester atau evaluasi terdekat." },
        { id: "Akademik", badge: "bg-blue-100 text-blue-600 border-blue-200", jdlKosong: "Info Akademik & Rapor", isiKosong: "Belum ada pengumuman terkait akademik atau pembagian rapor." },
        { id: "Kegiatan", badge: "bg-emerald-100 text-emerald-600 border-emerald-200", jdlKosong: "Kegiatan & Haflah", isiKosong: "Belum ada agenda kegiatan madrasah atau peringatan Haflah terdekat." }
    ];

    fetch(GAS_URL, { method: 'POST', body: fdPengumuman })
        .then(response => response.json())
        .then(res => {
            wadah.innerHTML = ''; 
            let dataServer = (res.status === 'success' && res.data) ? res.data : [];

            kategoriTetap.forEach(kat => {
                let adaPengumuman = dataServer.filter(item => item.kategori && item.kategori.toUpperCase().includes(kat.id.toUpperCase()));
                if (adaPengumuman.length > 0) {
                    adaPengumuman.forEach(item => {
                        const safeJdl = item.judul ? item.judul.replace(/'/g, "\\'") : "";
                        const safeTgl = item.tanggal ? item.tanggal.replace(/'/g, "\\'") : "";
                        const safeIsi = item.isi ? item.isi.replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "") : "";
                        wadah.innerHTML += `
                            <div class="p-4 bg-white border border-gray-200 rounded-xl flex flex-col sm:flex-row gap-3 shadow-sm relative mb-3">
                                <div class="sm:w-36 shrink-0 border-b sm:border-b-0 sm:border-r border-gray-100 pb-2.5 pr-12 sm:pr-3 flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-start">
                                    <span class="inline-block px-2 py-0.5 border text-[9px] font-bold rounded mb-0 sm:mb-2 uppercase tracking-wide ${kat.badge}">${item.kategori}</span>
                                    <p class="text-[11px] font-bold text-gray-500"><i class="far fa-calendar-alt mr-1"></i> ${item.tanggal}</p>
                                </div>
                                <div class="flex-1 pt-1.5 sm:pt-0 pr-8 sm:pr-10">
                                    <h6 class="text-sm font-bold text-emerald-800 mb-1 leading-tight">${item.judul}</h6>
                                   <p class="text-xs text-gray-600 leading-relaxed whitespace-pre-line">${item.isi}</p>
                                </div>
                                <button onclick="bagikanKeWA('${safeJdl}', '${safeTgl}', '${safeIsi}')" class="absolute top-2 right-3 sm:top-1/2 sm:-translate-y-1/2 w-8 h-8 flex items-center justify-center bg-gray-50 hover:bg-[#25D366] text-gray-400 hover:text-white rounded-full transition-all shadow-sm"><i class="fab fa-whatsapp"></i></button>
                            </div>
                        `;
                    });
               } else {
                    wadah.innerHTML += `
                        <div class="p-4 bg-gray-50 border border-dashed border-gray-300 rounded-xl flex flex-col sm:flex-row gap-3 relative mb-3">
                            <div class="sm:w-36 shrink-0 border-b sm:border-b-0 sm:border-r border-gray-200 pb-2.5 pr-12 sm:pr-3 flex flex-row sm:flex-col justify-between sm:justify-start items-center sm:items-start">
                                <span class="inline-block px-2 py-0.5 border text-[9px] font-bold rounded mb-0 sm:mb-2 uppercase tracking-wide ${kat.badge}">${kat.id}</span>
                                <p class="text-[10px] font-bold text-gray-500"><i class="far fa-clock mr-1"></i> Menunggu Jadwal</p>
                            </div>
                            <div class="flex-1 pt-1.5 sm:pt-0 pr-8 sm:pr-10">
                                <h6 class="text-sm font-bold text-gray-700 mb-1 leading-tight">${kat.jdlKosong}</h6>
                               <p class="text-xs text-gray-500 leading-relaxed italic whitespace-pre-line">${kat.isiKosong}</p>
                            </div>
                        </div>
                    `;
                }
            });
        }).catch(err => { wadah.innerHTML = '<div class="text-center text-xs text-red-400 py-10">Gagal memuat pengumuman.</div>'; });
}

function bagikanKeWA(judul, tanggal, isi) {
    const teksWA = `📢 *${judul}*\n🗓️ ${tanggal}\n\n${isi}\n\n🌐 _Portal Informasi Madrasah Darussalam_`;
    window.open(`https://wa.me/?text=${encodeURIComponent(teksWA)}`, '_blank');
}

// =========================================================
// FUNGSI POP-UP FOTO BESAR (LIGHTBOX) & BYPASS BACK BUTTON
// =========================================================
function bukaFotoBesar() {
    const imgSrc = document.getElementById('ortuFotoSantri').src;
    
    // Opsional: Jika masih pakai foto inisial UI-Avatars, tidak perlu diperbesar
    if (!imgSrc || imgSrc.includes('ui-avatars.com')) return; 
    
    const modal = document.getElementById('modalFotoBesar');
    const imgView = document.getElementById('fotoBesarView');
    
    if (modal && imgView) {
        // Jika linknya dari Thumbnail Drive w500, kita ubah ke w1000 agar HD saat diperbesar
        let highResSrc = imgSrc;
        if (highResSrc.includes('sz=w500')) {
            highResSrc = highResSrc.replace('sz=w500', 'sz=w1000');
        }
        
        imgView.src = highResSrc;
        modal.classList.remove('hidden');
        
        // --- MANIPULASI TOMBOL BACK HP ---
        // Merekam state ke history agar tombol "Back" HP bisa menangkapnya
        history.pushState({ lightboxTerbuka: true }, null, location.href);
        
        // Jalankan animasi pop-up
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            imgView.classList.remove('scale-95');
            imgView.classList.add('scale-100');
        }, 10);
    }
}

function tutupFotoBesar(dariTombolBack = false) {
    const modal = document.getElementById('modalFotoBesar');
    const imgView = document.getElementById('fotoBesarView');
    
    if (modal && !modal.classList.contains('hidden')) {
        modal.classList.add('opacity-0');
        if (imgView) {
            imgView.classList.remove('scale-100');
            imgView.classList.add('scale-95');
        }
        
        // Sembunyikan div setelah animasi selesai
        setTimeout(() => {
            modal.classList.add('hidden');
            if (imgView) imgView.src = '';
        }, 300);
        
        // Jika ditutup manual (klik X / background), mundurkan history agar rapi
        if (!dariTombolBack && history.state && history.state.lightboxTerbuka) {
            history.back(); 
        }
    }
}

// =========================================================
// PENANGKAP TOMBOL KEMBALI DI HP (POPSTATE EVENT GLOBAL)
// =========================================================
window.addEventListener('popstate', function (event) {
    // 1. Jika peringatan/pop-up (SweetAlert) terbuka, tutup peringatannya
    if (typeof Swal !== 'undefined' && Swal.isVisible()) {
        Swal.close();
        return;
    }
    
    // 2. Jika foto besar (Lightbox) terbuka, tutup fotonya tanpa keluar web
    const modalFoto = document.getElementById('modalFotoBesar');
    if (modalFoto && !modalFoto.classList.contains('hidden')) {
        tutupFotoBesar(true);
        return;
    }

    // 3. Jika modal login (jika ada) terbuka, biarkan
    const modalLogin = document.getElementById('modalLogin');
    if (modalLogin && !modalLogin.classList.contains('hidden')) return;

    // 4. Jika panel pengumuman terbuka, tutup panelnya
    const panelPengumuman = document.getElementById('panelBottomPengumuman');
    if (panelPengumuman && !panelPengumuman.classList.contains('translate-y-full')) {
        tutupPanelPengumuman(true);
        return;
    }
});