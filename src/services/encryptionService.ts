import * as crypto from 'crypto';

/**
 * Service for encryption and decryption of data.
 */
export class EncryptionService {
    private algorithm = 'aes-256-cbc';
    private key: Buffer;

    constructor(private secret: string) {
        // Generating a key based on the secret
        this.key = crypto.createHash('sha256').update(secret).digest();
    }

    /**
     * Encrypts data.
     * @param {string} text Text to be encrypted.
     * @returns {string} Encrypted text in base64 format.
     */
    encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return `${iv.toString('base64')}:${encrypted}`;
    }

    /**
     * Decrypts data.
     * @param {string} encryptedText Encrypted text in base64 format.
     * @returns {string} Decrypted text.
     */
    decrypt(encryptedText: string): string {
        const [iv, encrypted] = encryptedText.split(':');
        const decipher = crypto.createDecipheriv(this.algorithm, this.key, Buffer.from(iv, 'base64'));
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}