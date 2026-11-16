/** Teks alur tanda tangan (ERP-0048 / ERP-0049). */
const signatures = {
	'registerTitle': 'Tanda tangan dokumen',
	'registerDescription':
		'Setiap tanda tangan yang tercatat pada dokumen, lengkap dengan metode dan alamat IP-nya.',

	'requestTitle': 'Minta tanda tangan',
	'requestDescription': 'Minta pengguna internal menandatangani dokumen.',
	'newRequest': 'Permintaan baru',
	'newRequestHint': 'Pilih dokumen, lalu orang-orang yang harus menandatanganinya.',
	'documentPlaceholder': 'Pilih dokumen',
	'signers': 'Penandatangan',
	'signersHint': 'Hanya anggota organisasi Anda yang dapat diminta.',
	'note': 'Catatan',
	'notePlaceholder': 'Pesan opsional untuk setiap penandatangan',
	'expiryDays': 'Kedaluwarsa dalam (hari)',
	'sendRequest': 'Kirim permintaan',
	'requestCreated': 'Permintaan tanda tangan terkirim',
	'requestCancelled': 'Permintaan tanda tangan dibatalkan',
	'requestedOf': 'Diminta kepada {{name}}',

	'outgoing': 'Permintaan yang saya kirim',
	'outgoingHint': 'Permintaan yang Anda buat, terbaru lebih dulu.',
	'outgoingEmpty': 'Anda belum meminta siapa pun menandatangani.',
	'cancelRequest': 'Batalkan',

	'mineTitle': 'Tanda tangan saya',
	'mineDescription': 'Gambar tanda tangan Anda dan permintaan yang ditujukan kepada Anda.',
	'imageTitle': 'Gambar tanda tangan',
	'imageHint': 'PNG atau JPG, maksimal 2 MB. Dipakai pada dokumen yang Anda tandatangani.',
	'imageEmpty': 'Belum ada gambar tanda tangan.',
	'uploadImage': 'Unggah gambar',
	'replaceImage': 'Ganti gambar',
	'removeImage': 'Hapus gambar',
	'imageUploaded': 'Gambar tanda tangan tersimpan',
	'imageRemoved': 'Gambar tanda tangan dihapus',

	'incoming': 'Menunggu tanda tangan saya',
	'incomingHint': 'Permintaan yang ditujukan kepada Anda, terbaru lebih dulu.',
	'incomingEmpty': 'Tidak ada yang menunggu tanda tangan Anda.',
	'history': 'Riwayat tanda tangan saya',
	'historyEmpty': 'Anda belum menandatangani apa pun.',

	'sign': 'Tanda tangani',
	'decline': 'Tolak',
	'signHint':
		'Pilih cara Anda menandatangani. Mencatat tanda tangan basah atau stempel berarti Anda menandatangani salinan cetaknya.',
	'declineTitle': 'Tolak permintaan ini',
	'declineReason': 'Alasan',
	'declineReasonPlaceholder': 'Beri tahu pemohon apa yang salah',
	'signed': 'Dokumen ditandatangani',
	'declined': 'Permintaan ditolak',
	'declineRequired': 'Alasan wajib diisi',

	'entries': 'Daftar tanda tangan',
	'count': '{{count}} tanda tangan',
	'empty': 'Belum ada tanda tangan tercatat.',
	'document': 'Dokumen',
	'signer': 'Penandatangan',
	'method': 'Metode',
	'signedAt': 'Ditandatangani',
	'ipAddress': 'Alamat IP',
	'allMethods': 'Semua metode',
	'expiresAt': 'Kedaluwarsa',
	'requestedBy': 'Diminta oleh {{name}}',
	'signaturesOnDocument': 'Tanda tangan pada dokumen ini',

	'methodOption.electronic': 'Elektronik',
	'methodOption.wet_ink': 'Tinta basah',
	'methodOption.stamp': 'Stempel',

	'status.pending': 'Menunggu',
	'status.signed': 'Ditandatangani',
	'status.declined': 'Ditolak',
	'status.expired': 'Kedaluwarsa',
	'status.cancelled': 'Dibatalkan',
} as const;

export default signatures;
