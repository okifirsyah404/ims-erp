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
	'form.phoneCountry': 'Kode negara',
	'form.phoneCountryPlaceholder': 'Negara',
	'form.phoneCountryEmpty': 'Negara tidak ditemukan.',
	'form.phonePlaceholder': '812 3456 7890',
	'form.phoneInvalid': 'Masukkan nomor telepon yang valid.',
	'form.submit': 'Buat akun',
	'form.claiming': 'Membuat akun…',

	// Personal data on the claim form (ERP-0121).
	'personal.title': 'Data diri',
	'personal.description': 'Dipakai untuk data karyawan dan Perjanjian Kerja Anda.',
	'personal.nationalId': 'Nomor KTP (NIK)',
	'personal.birthPlace': 'Tempat lahir',
	'personal.birthDate': 'Tanggal lahir',
	'personal.gender': 'Jenis kelamin',
	'personal.genderOption.male': 'Laki-laki',
	'personal.genderOption.female': 'Perempuan',
	'personal.maritalStatus': 'Status pernikahan',
	'personal.maritalOption.single': 'Belum menikah',
	'personal.maritalOption.married': 'Menikah',
	'personal.maritalOption.divorced': 'Cerai hidup',
	'personal.maritalOption.widowed': 'Cerai mati',
	'personal.optional': 'opsional',
	'personal.choose': 'Pilih',
	'personal.address': 'Alamat domisili',
	'personal.postalCode': 'Kode pos',
	'personal.invalid.nationalId': 'NIK terdiri dari 16 digit.',
	'personal.invalid.birth': 'Isi tempat dan tanggal lahir.',
	'personal.invalid.gender': 'Pilih jenis kelamin.',
	'personal.invalid.address': 'Isi alamat dan pilih kelurahan/desa.',
	'personal.invalid.postalCode': 'Kode pos terdiri dari 5 digit.',
} as const;

export default claim;
