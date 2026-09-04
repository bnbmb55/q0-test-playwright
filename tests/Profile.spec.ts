import { test, expect } from '../fixtures/base';
import { DataGenerator } from '../utils/dataGenerator';
import { EncryptionAndDecryption } from '../utils/encryption';
import * as path from 'path';

test.describe('Profile Management Tests', () => {
    test.setTimeout(180000);
    // This flow registers a user and uploads a real file; do not duplicate it on retry.
    test.describe.configure({ retries: 0 });

    test('TC-PROF-01: Verify Organization User Profile details and Image Upload', async ({ 
        page, 
        loginPage, 
        registrationPage, 
        dashboardPage, 
        profilePage 
    }) => {
        const registrationData = {
            email: DataGenerator.generateRandomEmail(),
            password: DataGenerator.generateComplexPassword(),
            name: DataGenerator.generateRandomName(),
            mobile: DataGenerator.generateRandomMobile(),
            orgName: DataGenerator.generateRandomOrgName()
        };

        // Step 1: Registration Step 1
        await loginPage.navigate();
        await loginPage.goToSignUp();
        await registrationPage.step1FillEmailAndProceed(registrationData.email);
        await registrationPage.step1FillPasswords(registrationData.password);
        const link = await registrationPage.step1SubmitAndGetLink();

        // Step 2: Complete Registration
        await page.goto(link);
        await registrationPage.completeOrganisationRegistration(
            registrationData.orgName, 
            registrationData.name, 
            registrationData.mobile
        );

        // Step 3: Login
        await loginPage.navigate();
        await loginPage.login(registrationData.email, registrationData.password);
        await dashboardPage.verifyDashboardVisible();

        // Step 4: Navigate to Settings & Verify Details
        const userDataPromise = page.waitForResponse(response =>
            response.url().includes('/Infer/api/members/getdatabyid/') && response.status() === 200
        );

        await dashboardPage.goToSettings();

        const userDataResponse = await userDataPromise;
        const userDataBody = await userDataResponse.json();
        let apiData = userDataBody.details || userDataBody.data || userDataBody;
        if (typeof apiData === 'string') apiData = EncryptionAndDecryption.decryption(apiData);

        // Assertions
        expect(apiData.email).toBe(registrationData.email);
        expect(apiData.full_name || apiData.name).toContain(registrationData.name);
        
        await profilePage.verifyProfileDetails(registrationData.name, registrationData.orgName);

        // Step 5: Upload Image
        const absoluteImagePath = path.resolve(DataGenerator.ASSETS.PROFILE_PIC);
        await profilePage.uploadProfilePicture(absoluteImagePath);

        // Step 6: Sign Out
        await dashboardPage.signOut(registrationData.name);
    });
});
