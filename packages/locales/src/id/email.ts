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

	// Undangan aplikasi (invitation.type = 'app'): undangan membuat akun di
	// aplikasi — tanpa konteks organisasi.
	'appInvitation.subject': 'Anda diundang membuat akun {{app}} Anda',
	'appInvitation.greeting': 'Hai {{name}},',
	'appInvitation.body':
		'Anda diundang untuk membuat akun di {{app}}. Terima undangan ini untuk menyiapkan akun Anda dan mulai menggunakan aplikasi.',
	'appInvitation.action': 'Buat akun',
	'appInvitation.fallback':
		'Jika tombol tidak berfungsi, salin dan tempel tautan ini ke peramban Anda:',

	// Undangan portal pelanggan (ERP-0022): tautan untuk membuat kata sandi
	// pertama di portal pelanggan.
	'portalInvitation.subject': 'Akun portal pelanggan {{app}} Anda',
	'portalInvitation.greeting': 'Hai {{name}},',
	'portalInvitation.body':
		'Akun Anda di portal pelanggan {{app}} sudah dibuat. Di sana Anda dapat memantau proyek, garansi, dan tiket servis Anda. Buat kata sandi untuk masuk. Tautan berlaku 3 hari.',
	'portalInvitation.action': 'Buat kata sandi',
	'portalInvitation.fallback':
		'Jika tombol tidak berfungsi, salin dan tempel tautan ini ke peramban Anda:',

	// Kode pendaftaran portal pelanggan (ERP-0022): memverifikasi email
	// pelanggan individu yang mendaftar.
	'portalSignupCode.subject': '{{code}} adalah kode portal {{app}} Anda',
	'portalSignupCode.greeting': 'Hai {{name}},',
	'portalSignupCode.body': 'Gunakan kode ini untuk menyelesaikan pembuatan akun portal pelanggan {{app}} Anda.',
	'portalSignupCode.expiry': 'Kode berlaku 10 menit. Jika Anda tidak mendaftar, abaikan email ini.',
	'portalRfqClaimCode.subject': '{{code}} adalah kode Anda untuk menambahkan RFQ {{reference}}',
	'portalRfqClaimCode.greeting': 'Hai {{name}},',
	'portalRfqClaimCode.body': 'Ada permintaan untuk menambahkan permintaan penawaran {{reference}} Anda ke akun portal pelanggan {{app}}. Masukkan kode ini di portal untuk memastikan itu Anda.',
	'portalRfqClaimCode.expiry': 'Kode berlaku 15 menit. Jika bukan Anda, abaikan email ini; permintaan Anda tidak berubah.',
	'portalLoginCode.subject': '{{code}} adalah kode masuk {{app}} Anda',
	'portalLoginCode.greeting': 'Hai {{name}},',
	'portalLoginCode.body': 'Gunakan kode ini untuk menyelesaikan masuk ke akun portal pelanggan {{app}} Anda.',
	'portalLoginCode.expiry': 'Kode berlaku 10 menit. Jika Anda tidak mencoba masuk, segera ganti password Anda.',

	// Undangan organisasi (invitation.type = 'org'): undangan bergabung ke
	// organisasi tertentu dengan peran.
	'organizationInvitation.subject':
		'Anda diundang untuk bergabung dengan {{organization}}',
	'organizationInvitation.greeting': 'Hai {{name}},',
	'organizationInvitation.intro':
		'Anda diundang untuk bergabung dengan {{organization}} di {{app}} sebagai {{role}}. Terima undangan ini untuk membuat akun Anda dan mulai berkolaborasi.',
	'organizationInvitation.expires':
		'Undangan ini kedaluwarsa pada {{expiresAt}}.',
	'organizationInvitation.action': 'Terima undangan',
	'organizationInvitation.fallback':
		'Jika tombol tidak berfungsi, salin dan tempel tautan ini ke peramban Anda:',

	'footer.noReply':
		'Ini pesan otomatis dari {{app}}; balasan ke alamat ini tidak dipantau.',
} as const;

export default email;
