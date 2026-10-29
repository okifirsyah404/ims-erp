import { emailOTP } from 'better-auth/plugins/email-otp';
import { betterAuthLogger } from '../logger.auth.js';

export const betterAuthEmailOTPPlugin = emailOTP({
  sendVerificationOTP: async ({ email, otp }) => {
    betterAuthLogger.log(`Sending OTP ${otp} to email ${email}`);
  },
  expiresIn: 5 * 60 * 1000, // 5 minutes
  otpLength: 8,
  resendStrategy: 'rotate',
  rateLimit: {
    max: 10,
    window: 5 * 60 * 1000, // 5 minutes
  },
});
