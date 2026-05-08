import CryptoJS from "crypto-js";
import bcrypt from "bcryptjs";

export const ENCRYPTION_SECRET_KEY = 'YOTTA2024';
export const SALT_ROUNDS = 10;
export const StatusCode = {
    OK: 200,
    BAD_REQUEST: 400,
    INVALID_ENCRYPTED_INPUT: 400,
};

export class EncryptionAndDecryption {
  public static encryption(body: any): any {
    let iv = CryptoJS.enc.Hex.parse("101112131415161718191a1b1c1d1e1f")
    return CryptoJS.AES.encrypt(JSON.stringify(body), ENCRYPTION_SECRET_KEY, { mode: CryptoJS.mode.CTR, iv: iv }).toString();
  }

  public static decryption(body: any) {
    try {
      let iv = CryptoJS.enc.Hex.parse("101112131415161718191a1b1c1d1e1f")
      const bytes = CryptoJS.AES.decrypt(body, ENCRYPTION_SECRET_KEY, { mode: CryptoJS.mode.CTR, iv: iv });
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (err) {
      return StatusCode.INVALID_ENCRYPTED_INPUT;
    }
  }

  public static saltEncryption(data: any) {
    return new Promise((resolve, reject) => {
      bcrypt
        .hash(data, SALT_ROUNDS)
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  public static saltCompare(data: any, hash: any): any {
    return new Promise((resolve, reject) => {
      bcrypt
        .compare(data, hash)
        .then((result) => {
          resolve(result);
        })
        .catch((err) => {
          reject(err);
        });
    });
  }

  public static encryptionIds(body: any) {
    let iv = CryptoJS.enc.Hex.parse("101112131415161718191a1b1c1d1e1f")
    const encStr = CryptoJS.AES.encrypt(JSON.stringify(body), ENCRYPTION_SECRET_KEY, { mode: CryptoJS.mode.CTR, iv: iv }).toString();
    const encStr1 = encStr.split('+').join('-')
    const encStr2 = encStr1.split('/').join('_')
    return encStr2
  }

  public static decryptionIds(body: any) {
    try {
      const encStr1 = body.split('-').join('+')
      const encStr2 = encStr1.split('_').join('/')
      let iv = CryptoJS.enc.Hex.parse("101112131415161718191a1b1c1d1e1f")
      const bytes = CryptoJS.AES.decrypt(encStr2, ENCRYPTION_SECRET_KEY, { mode: CryptoJS.mode.CTR, iv: iv });
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
    } catch (err) {
      return StatusCode.INVALID_ENCRYPTED_INPUT;
    }
  }

  public static encryptField = (value: string | undefined): string => {
    try {
      if (!value) return "";
      return CryptoJS.AES.encrypt(value, ENCRYPTION_SECRET_KEY, { mode: CryptoJS.mode.CTR }).toString();
    } catch (error) {
      return '';
    }
  };

  public static decryptField = (value: string | undefined): string => {
    try {
      if (!value) return "";
      return CryptoJS.AES.decrypt(value, ENCRYPTION_SECRET_KEY, { mode: CryptoJS.mode.CTR }).toString(CryptoJS.enc.Utf8);
    } catch (error) {
      return '';
    }
  };
}
