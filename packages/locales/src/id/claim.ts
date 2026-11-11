/** Halaman klaim undangan publik (`/invite/:token`) — tanpa sesi. */
const claim = {
	// Status halaman.
	'invalidTitle': 'Undangan tidak tersedia',
	'invalid':
		'Tautan undangan ini tidak valid, kedaluwarsa, atau sudah pernah digunakan. Minta administrator Anda mengirim undangan baru.',
	'backToLogin': 'Kembali ke halaman masuk',

	// Formulir klaim.
	'form.title': 'Siapkan akun Anda',
	'form.description':
		'Hai {{name}} — undangan ini untuk {{email}}. Pilih nama pengguna dan kata sandi untuk menyelesaikan penyiapan akun Anda.',
	'form.username': 'Nama pengguna',
	'form.usernameInvalid':
		'Gunakan 3-30 huruf, angka, tanda hubung, atau garis bawah.',
	'form.usernameAvailable': 'Nama pengguna tersedia.',
	'form.usernameTaken': 'Nama pengguna sudah digunakan.',
	'form.password': 'Kata sandi',
	'form.passwordShort': 'Kata sandi minimal 8 karakter.',
	'form.phone': 'Nomor telepon',
	'form.phoneInvalid': 'Masukkan nomor telepon yang valid.',
	'form.submit': 'Buat akun',
	'form.claiming': 'Membuat akun…',
} as const;

export default claim;
