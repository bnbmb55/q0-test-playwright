export class DataGenerator {
    public static generateRandomEmail(): string {
        const timestamp = Date.now();
        return `testuser_${timestamp}@yopmail.com`;
    }

    public static generateComplexPassword(length: number = 12): string {
        const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const lowercase = "abcdefghijklmnopqrstuvwxyz";
        const numbers = "0123456789";
        const special = "!@#$%^&*()_+~`|}{[]:;?><,./-=";
        
        const allChars = uppercase + lowercase + numbers + special;
        let password = "";
        
        // Ensure at least one of each
        password += uppercase[Math.floor(Math.random() * uppercase.length)];
        password += lowercase[Math.floor(Math.random() * lowercase.length)];
        password += numbers[Math.floor(Math.random() * numbers.length)];
        password += special[Math.floor(Math.random() * special.length)];
        
        for (let i = 4; i < length; i++) {
            password += allChars[Math.floor(Math.random() * allChars.length)];
        }
        
        return password.split('').sort(() => 0.5 - Math.random()).join('');
    }

    public static generateRandomName(): string {
        const firstNames = ["Vivek", "Tanmay", "Bharat", "Rahul", "Anjali", "Priya", "Amit", "Suresh"];
        const lastNames = ["Yadav", "Patil", "Sharma", "Verma", "Singh", "Gupta", "Malhotra"];
        const first = firstNames[Math.floor(Math.random() * firstNames.length)];
        const last = lastNames[Math.floor(Math.random() * lastNames.length)];
        return `${first} ${last}`;
    }

    public static generateRandomMobile(): string {
        // Generates a 10-digit mobile number starting with 7, 8, or 9
        const firstDigit = ["7", "8", "9"][Math.floor(Math.random() * 3)];
        let mobile = firstDigit;
        for (let i = 0; i < 9; i++) {
            mobile += Math.floor(Math.random() * 10).toString();
        }
        return mobile;
    }

    public static generateRandomOrgName(): string {
        const prefixes = ["Global", "Nexus", "Quantum", "Synergy", "Apex", "Horizon"];
        const suffixes = ["Solutions", "Technologies", "Industries", "Corp", "Systems", "Hub"];
        const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
        const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
        return `${prefix} ${suffix} ${Math.floor(Math.random() * 1000)}`;
    }

    public static readonly GOOGLE_USER = {
        email: 'vivekyadavuwi@gmail.com',
        password: 'Ganesha@5050'
    };

    public static readonly GITHUB_USER = {
        email: 'larryrathod2@gmail.com',
        password: 'Ganesha@5050'
    };
}
