const GAS_URL = 'https://script.google.com/macros/s/AKfycbyikQ5DtbbiQC_mvM-qTrzZavRwVdsvbHItGpdO5pMIa1gllnY1WMl89iv7wAjUC2YmIA/exec';

// Gunakan URL unik pada setiap request agar browser/proxy tidak memakai ulang
// redirect sementara ContentService Google Apps Script.
function buildGasUrl() {
    const separator = GAS_URL.includes('?') ? '&' : '?';
    const nonce = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    return `${GAS_URL}${separator}__madasa_cb=${encodeURIComponent(nonce)}`;
}

function gasFetch(options = {}) {
    return fetch(buildGasUrl(), {
        ...options,
        cache: 'no-store',
        redirect: 'follow'
    });
}


function gasJsonp(action, params = {}, timeoutMs = 30000, maxRetry = 1) {
    return new Promise((resolve, reject) => {

        let permintaanSelesai = false;

        function kirimRequest(percobaanKe) {

            const callbackName =
                `__madasa_jsonp_${Date.now()}_${Math.random()
                    .toString(36)
                    .slice(2)}`;

            const url = new URL(GAS_URL);

            url.searchParams.set('action', action);
            url.searchParams.set('callback', callbackName);

            // Membuat URL selalu berbeda agar browser
            // tidak menggunakan redirect/cache lama.
            url.searchParams.set(
                '__madasa_jsonp_cb',
                `${Date.now()}_${Math.random().toString(36).slice(2)}`
            );

            Object.entries(params || {}).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    url.searchParams.set(key, String(value));
                }
            });

            const script = document.createElement('script');

            let timer = null;
            let requestIniSelesai = false;

            function hapusScript() {
                if (script.parentNode) {
                    script.parentNode.removeChild(script);
                }
            }

            function hapusCallback() {
                try {
                    delete window[callbackName];
                } catch (_) {
                    window[callbackName] = undefined;
                }
            }

            /*
             * Jangan langsung menghapus callback jika request gagal
             * atau timeout.
             *
             * Google Apps Script kadang memberikan respons terlambat.
             * Callback sementara ini akan menyerap respons tersebut
             * agar tidak muncul ReferenceError di Console.
             */
            function parkirCallback() {

                window[callbackName] = function () {
                    console.warn(
                        `[JSONP] Respons terlambat diabaikan: ${action}`
                    );
                };

                setTimeout(() => {
                    hapusCallback();
                }, 60000);
            }

            function prosesGagal(pesanError) {

                if (requestIniSelesai || permintaanSelesai) {
                    return;
                }

                requestIniSelesai = true;

                if (timer) {
                    clearTimeout(timer);
                }

                hapusScript();

                /*
                 * Pertahankan callback sementara jika respons lama
                 * dari Apps Script datang terlambat.
                 */
                parkirCallback();

                /*
                 * maxRetry = 1:
                 *
                 * Percobaan pertama gagal
                 * kemudian otomatis mencoba sekali lagi.
                 */
                if (percobaanKe < maxRetry) {

                    console.warn(
                        `[JSONP] ${action} gagal pada percobaan ` +
                        `${percobaanKe + 1}. Mencoba kembali...`
                    );

                    setTimeout(() => {
                        kirimRequest(percobaanKe + 1);
                    }, 800);

                    return;
                }

                permintaanSelesai = true;

                reject(
                    new Error(pesanError)
                );
            }

            /*
             * Fungsi ini akan dipanggil oleh Apps Script
             * apabila respons JSONP berhasil diterima.
             */
            window[callbackName] = function (payload) {

                if (requestIniSelesai || permintaanSelesai) {
                    return;
                }

                requestIniSelesai = true;
                permintaanSelesai = true;

                if (timer) {
                    clearTimeout(timer);
                }

                hapusScript();
                hapusCallback();

                resolve(payload);
            };

            script.async = true;

            script.src = url.toString();

            /*
             * Jika request script benar benar gagal,
             * misalnya script.googleusercontent.com
             * sementara menghasilkan 404.
             */
            script.onerror = function () {

                prosesGagal(
                    `Gagal membaca ${action} dari Apps Script melalui JSONP.`
                );

            };

            /*
             * Jika Apps Script tidak memberikan hasil
             * sampai batas waktu yang ditentukan.
             */
            timer = setTimeout(() => {

                prosesGagal(
                    `Permintaan ${action} ke Apps Script melebihi batas waktu.`
                );

            }, timeoutMs);

            document.head.appendChild(script);
        }

        /*
         * Percobaan pertama dimulai dari angka 0.
         */
        kirimRequest(0);
    });
}

// Ekspos helper secara eksplisit agar selalu tersedia untuk seluruh halaman klasik.
window.buildGasUrl = buildGasUrl;
window.gasFetch = gasFetch;
window.gasJsonp = gasJsonp;
