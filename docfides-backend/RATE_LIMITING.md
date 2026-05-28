# Rate Limiting Implementation - Email Verification

## Ringkasan
Implementasi rate limiting untuk mencegah abuse pada sistem verifikasi email dengan mekanisme rate limiting berlapis.

---

## 🔒 Mekanisme Rate Limiting

### 1. **Request OTP Rate Limiting**

**Aturan:**
- **Max 3 request per jam** - Mencegah spam request OTP
- **Cooldown 20 menit** antar request dari email yang sama

**Flow:**
```
Email request OTP
    ↓
Cek: Ada request sebelumnya dalam 20 menit terakhir?
    ├─ YES → Reject dengan pesan cooldown time
    └─ NO → Cek: Ada 3+ request dalam 1 jam terakhir?
        ├─ YES → Reject dengan pesan limit tercapai
        └─ NO → Generate & send OTP
```

**Error Response:**
```json
// Cooldown active
{
  "message": "Terlalu banyak permintaan OTP. Coba lagi dalam 15 menit"
}

// Limit per jam tercapai
{
  "message": "Batas maksimal permintaan OTP sudah tercapai (3/jam). Coba lagi nanti."
}
```

---

### 2. **Verify OTP Rate Limiting dengan Lockout**

**Aturan:**
- **Max 5 attempt** untuk verify OTP yang benar
- **Auto-lockout 30 menit** setelah 5 attempt gagal
- **Attempt counter di-reset** jika verification berhasil

**Flow:**
```
User submit OTP
    ↓
Cek: Akun dalam status terkunci?
    ├─ YES → Cek: Unlock time sudah lewat?
    │   ├─ NO → Return error dengan remaining lockout time
    │   └─ YES → Unlock akun, lanjut
    └─ NO → Lanjut
        ↓
Cek: OTP benar?
    ├─ YES → Clear counter, set verified=true, return success
    └─ NO → Increment attempt counter
        ├─ Attempt < 5 → Return error + remaining attempts
        └─ Attempt = 5 → Lock akun 30 menit, return error
```

**Error Response:**

```json
// Akun terkunci
{
  "message": "Terlalu banyak percobaan gagal. Akun terkunci selama 25 menit lagi."
}

// OTP salah dengan sisa attempt
{
  "message": "OTP salah. Sisa percobaan: 3"
}

// Attempt habis (auto-lockout)
{
  "message": "Terlalu banyak percobaan gagal. Akun terkunci untuk sementara."
}
```

---

## 📊 Database Fields

**EmailVerification Table:**
```sql
-- Existing
id          UUID PRIMARY KEY
email       VARCHAR UNIQUE
otp         VARCHAR
expiresAt   TIMESTAMP
verified    BOOLEAN DEFAULT false
createdAt   TIMESTAMP

-- New (Rate Limiting)
attemptCount    INTEGER DEFAULT 0           -- Jumlah verify attempt
lastAttemptAt   TIMESTAMP NULL              -- Waktu attempt terakhir
isLocked        BOOLEAN DEFAULT false       -- Status lock
lockedUntil     TIMESTAMP NULL              -- Waktu unlock
lastRequestAt   TIMESTAMP NULL              -- Waktu request OTP terakhir
```

---

## 🛠️ Configuration

Semua configuration tersimpan di `RateLimitService`:

```typescript
REQUEST_OTP_MAX_PER_HOUR = 3         // Max 3 request per jam
REQUEST_OTP_COOLDOWN_MINUTES = 20    // Cooldown 20 menit
VERIFY_OTP_MAX_ATTEMPTS = 5          // Max 5 attempt verify
VERIFY_OTP_LOCKOUT_MINUTES = 30      // Lockout 30 menit
```

**Untuk mengubah aturan**, edit file: [rate-limit.service.ts](src/module/email/rate-limit.service.ts#L4-L7)

---

## 📝 Use Case Examples

### ✅ Scenario 1: Normal Flow (OTP Berhasil Diverifikasi)
```
1. User request OTP → Email dikirim
2. User input OTP yang benar → Verified
3. User langsung register → Akun buat berhasil
4. Attempt counter: 0 (reset)
```

### ✅ Scenario 2: Typo OTP (Berhasil di Retry)
```
1. User request OTP → Email dikirim (attemptCount=0)
2. User input OTP salah → Error "Sisa percobaan: 4" (attemptCount=1)
3. User input OTP benar → Verified (attemptCount=0 reset)
```

### ❌ Scenario 3: Brute Force Attack (Auto-Lockout)
```
1. Request OTP (1st) → Email dikirim
2. Attempt salah (1/5) → "Sisa percobaan: 4"
3. Attempt salah (2/5) → "Sisa percobaan: 3"
4. Attempt salah (3/5) → "Sisa percobaan: 2"
5. Attempt salah (4/5) → "Sisa percobaan: 1"
6. Attempt salah (5/5) → LOCKED 30 menit
7. Any attempt → "Akun terkunci selama 25 menit lagi"
8. After 30 min → Akun unlock otomatis
```

### ❌ Scenario 4: Spam OTP Request (Cooldown)
```
1. Request OTP (1st) → OK, sent
2. Request OTP (2nd) after 5 min → Error "Coba lagi dalam 15 menit"
3. Request OTP (3rd) after 20 min → OK (cooldown passed)
4. Request OTP (4th) after 5 min → Error "Coba lagi dalam 15 menit"
5. Request OTP (5th) after 25 min → Error "Batas 3/jam tercapai"
```

---

## 🧪 Test Cases

### Test: Request OTP Cooldown
```bash
# 1st request - OK
POST /auth/request-otp
{ "email": "user@example.com" }
# Response: 200 OK

# 2nd request (after 5 min) - FAIL
POST /auth/request-otp
{ "email": "user@example.com" }
# Response: 400 "Terlalu banyak permintaan OTP. Coba lagi dalam 15 menit"

# 3rd request (after 20 min) - OK
POST /auth/request-otp
{ "email": "user@example.com" }
# Response: 200 OK
```

### Test: Verify OTP Lockout
```bash
# Request OTP
POST /auth/request-otp
{ "email": "user@example.com" }
# Response: 200 OK, OTP dikirim ke email

# 1st wrong attempt
POST /auth/verify-otp
{ "email": "user@example.com", "otp": "000000" }
# Response: 400 "OTP salah. Sisa percobaan: 4"

# 5th wrong attempt  
POST /auth/verify-otp
{ "email": "user@example.com", "otp": "999999" }
# Response: 400 "Terlalu banyak percobaan gagal. Akun terkunci untuk sementara."

# 6th attempt (lockout active)
POST /auth/verify-otp
{ "email": "user@example.com", "otp": "123456" }
# Response: 400 "Terlalu banyak percobaan gagal. Akun terkunci selama 30 menit lagi."

# After 30 minutes - Akun unlock otomatis
POST /auth/verify-otp
{ "email": "user@example.com", "otp": "123456" }
# Response: 200 OK (jika OTP benar) atau retry attempt counter reset
```

---

## 🔍 Logging & Monitoring

Service menggunakan `Logger` untuk tracking:

```typescript
// Success
this.logger.debug(`OTP email sent successfully to ${email}`);
this.logger.debug(`Email ${email} verified successfully`);

// Error
this.logger.error(`Failed to send OTP email to ${email}`);
this.logger.error('Unexpected error in requestOtp', error);
```

**Monitor file logs** untuk:
- Email send failures
- Suspicious verification patterns (banyak failed attempts)
- Rate limit violations

---

## 🚀 Production Checklist

- [x] Rate limiting rules diterapkan
- [x] Database migration completed
- [x] Logger implementation untuk audit trail
- [x] Error handling comprehensive
- [ ] Add monitoring/alerting untuk suspicious activities
- [ ] Add API endpoint untuk unlock akun (admin only)
- [ ] Add email notification untuk lockout events
- [ ] Load testing untuk rate limit effectiveness

---

## 📚 Related Files

- [RateLimitService](src/module/email/rate-limit.service.ts)
- [AuthService](src/module/auth/auth.service.ts)
- [AuthModule](src/module/auth/auth.module.ts)
- [Prisma Schema](prisma/schema.prisma)
- [Migration](prisma/migrations/20260406125727_add_rate_limiting_fields/)
