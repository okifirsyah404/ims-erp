/** Email transaksional (verifikasi, reset kata sandi) yang dikirim backend. */
const email = {
	'verification.subject': 'Verifikasi alamat email Anda',
	'verification.greeting': 'Hai {{name}},',
	'verification.body':
		'Selamat datang di {{app}}. Silakan konfirmasi alamat email Anda dengan menekan tombol di bawah. Tautan kedaluwarsa bersama permintaan verifikasinya.',
	'verification.action': 'Verifikasi email',
	'verification.fallback':
		'Jika tombol tidak berfungsi, salin dan tempel tautan ini ke peramban Anda:',

	'resetPassword.subject': 'Atur ulang kata sandi Anda',
	'resetPassword.greeting': 'Hai {{name}},',
	'resetPassword.body':
		'Kami menerima permintaan untuk mengatur ulang kata sandi akun {{app}} Anda. Tekan tombol di bawah untuk memilih kata sandi baru. Jika Anda tidak meminta ini, abaikan email ini.',
	'resetPassword.action': 'Atur ulang kata sandi',
	'resetPassword.fallback':
		'Jika tombol tidak berfungsi, salin dan tempel tautan ini ke peramban Anda:',

	'footer.noReply':
		'Ini pesan otomatis dari {{app}}; balasan ke alamat ini tidak dipantau.',
} as const;

export default email;
