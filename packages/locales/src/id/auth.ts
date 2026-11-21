import type auth from '../en/auth';

/** Indonesian — mirrors `en/auth` keys exactly (values are free-form). */
const auth_: Record<keyof typeof auth, string> = {
	'login.title': 'Selamat datang kembali',
	'login.subtitle': 'Masuk ke akun {{app}} Anda',
	'login.identifier': 'Email atau username',
	'login.identifierPlaceholder': 'm@example.com atau johndoe',
	// Still used by the forgot-password form (email-only flow).
	'login.email': 'Email',
	'login.emailPlaceholder': 'm@example.com',
	'login.password': 'Kata sandi',
	'login.forgotPassword': 'Lupa kata sandi Anda?',
	'login.submit': 'Masuk',
	'login.submitting': 'Sedang masuk…',
	'login.invalidCredentials': 'Email/username atau kata sandi salah',
	'login.orContinueWith': 'Atau lanjutkan dengan',
	'login.googleSignIn': 'Masuk dengan Google',
	'login.googleNotRegistered':
		'Akun Google ini belum terdaftar. Akses hanya melalui undangan: minta administrator untuk mengundang Anda.',
	'login.accountNotActive':
		'Akun Anda belum aktif. Terima undangan yang dikirim ke email Anda terlebih dahulu, atau hubungi administrator.',
	'login.noAccess': 'Akun ini tidak memiliki akses ke ERP. Hubungi administrator.',
	'login.googleNotLinked':
		'Akun dengan email ini sudah ada, tetapi Google belum terhubung. Masuk dengan kata sandi, lalu hubungkan Google di pengaturan Akun.',
	'login.banned': 'Akun ini diblokir. Hubungi administrator.',
	'login.googleFailed': 'Masuk dengan Google gagal. Silakan coba lagi.',

	'forgot.title': 'Lupa kata sandi Anda?',
	'forgot.subtitle':
		'Masukkan email Anda dan kami akan mengirimkan tautan reset',
	'forgot.sent':
		'Jika akun dengan email tersebut ada, tautan reset kata sandi telah dikirim. Periksa kotak masuk Anda.',
	'forgot.submit': 'Kirim tautan reset',
	'forgot.submitting': 'Mengirim…',
	'forgot.backToLogin': 'Kembali ke halaman masuk',

	'reset.title': 'Reset kata sandi Anda',
	'reset.subtitle': 'Pilih kata sandi baru untuk akun Anda',
	'reset.newPassword': 'Kata sandi baru',
	'reset.confirmPassword': 'Konfirmasi kata sandi',
	'reset.passwordHint': 'Minimal 8 karakter.',
	'reset.submit': 'Reset kata sandi',
	'reset.submitting': 'Mereset…',
	'reset.requestNewLink': 'Minta tautan reset baru',
	'reset.mismatch': 'Kata sandi tidak cocok',
	'reset.invalidLink': 'Tautan reset tidak valid atau kedaluwarsa',
};

export default auth_;
