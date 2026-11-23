/** Public invitation-claim page (`/invite/:token`) — no session required. */
const claim = {
	// Page-level states.
	'invalidTitle': 'Invitation not available',
	'invalid':
		'This invitation link is invalid, expired, or has already been used. Ask your administrator to send a new invitation.',
	'backToLogin': 'Back to sign in',

	// Claim form.
	'form.title': 'Set up your account',
	'form.description':
		'Hi {{name}} — this invitation is for {{email}}. Choose a username and password to finish setting up your account.',
	'form.username': 'Username',
	'form.usernameInvalid':
		'Use 3-30 letters, numbers or underscores.',
	'form.usernameAvailable': 'Username is available.',
	'form.usernameTaken': 'Username is already taken.',
	'form.password': 'Password',
	'form.passwordShort': 'Password must be at least 8 characters.',
	'form.phone': 'Phone number',
	'form.phoneCountry': 'Country code',
	'form.phoneCountryPlaceholder': 'Country',
	'form.phoneCountryEmpty': 'No country found.',
	'form.phonePlaceholder': '812 3456 7890',
	'form.phoneInvalid': 'Enter a valid phone number.',
	'form.submit': 'Create account',
	'form.claiming': 'Creating account…',

	// Personal data on the claim form (ERP-0121).
	'personal.title': 'Your personal data',
	'personal.description': 'Used for your employee record and your employment agreement.',
	'personal.nationalId': 'National ID number (NIK)',
	'personal.birthPlace': 'Place of birth',
	'personal.birthDate': 'Date of birth',
	'personal.gender': 'Gender',
	'personal.genderOption.male': 'Male',
	'personal.genderOption.female': 'Female',
	'personal.maritalStatus': 'Marital status',
	'personal.maritalOption.single': 'Single',
	'personal.maritalOption.married': 'Married',
	'personal.maritalOption.divorced': 'Divorced',
	'personal.maritalOption.widowed': 'Widowed',
	'personal.optional': 'optional',
	'personal.choose': 'Choose',
	'personal.address': 'Residence address',
	'personal.postalCode': 'Postal code',
	'personal.invalid.nationalId': 'The NIK has 16 digits.',
	'personal.invalid.birth': 'Fill in your place and date of birth.',
	'personal.invalid.gender': 'Choose your gender.',
	'personal.invalid.address': 'Fill in the address and choose the village.',
	'personal.invalid.postalCode': 'The postal code has 5 digits.',
} as const;

export default claim;
