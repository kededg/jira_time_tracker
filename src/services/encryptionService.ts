import * as crypto from 'crypto';

/**
 * Сервис для шифрования и дешифрования данных.
 */
export class EncryptionService {
    private algorithm = 'aes-256-cbc';
    private key: Buffer;

    constructor(private secret: string) {
        // Генерация ключа на основе секрета
        this.key = crypto.createHash('sha256').update(secret).digest();
    }

    /**
     * Шифрует данные.
     * @param {string} text Текст для шифрования.
     * @returns {string} Зашифрованный текст в формате base64.
     */
    encrypt(text: string): string {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
        let encrypted = cipher.update(text, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return `${iv.toString('base64')}:${encrypted}`;
    }

    /**
     * Дешифрует данные.
     * @param {string} encryptedText Зашифрованный текст в формате base64.
     * @returns {string} Расшифрованный текст.
     */
    decrypt(encryptedText: string): string {
        const [iv, encrypted] = encryptedText.split(':');
        const decipher = crypto.createDecipheriv(this.algorithm, this.key, Buffer.from(iv, 'base64'));
        let decrypted = decipher.update(encrypted, 'base64', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    }
}