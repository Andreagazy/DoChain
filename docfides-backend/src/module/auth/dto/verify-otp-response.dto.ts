export class VerifyOtpResponseDto {
  message?: string;
  remainingAttempts?: number; // Sisa percobaan (jika gagal)
  nextRetryAt?: string; // Waktu bisa retry (jika terkunci)
}
