import { APIRequestContext } from '@playwright/test';
import { AppConfig } from './config';
import { EncryptionAndDecryption } from './encryption';

export interface StatusLogEntry {
    status: string;
    timestamp: string;
}

export interface TrainingDetails {
    id: number;
    name: string;
    description: string;
    status: string;
    request_id?: string;
    job_id?: string;
    status_log?: StatusLogEntry[];
    [key: string]: any;
}

export interface PollingOptions {
    intervalMs?: number;        // Polling interval (defaults to 15,000ms)
    timeoutMs?: number;         // Total timeout (defaults to 1,800,000ms / 30 mins)
    maxTransientRetries?: number; // Retries for network/5xx failures (defaults to 5)
    trainingName?: string;      // Optional name of the training job
}

export class TrainingApiHelper {
    /**
     * Compute the API base URL from the UI URL.
     * e.g., 'https://ui-uat.q0.dev' -> 'https://uiapi-uat.q0.dev'
     */
    private static getApiBaseUrl(): string {
        return AppConfig.baseUrl.replace('https://ui', 'https://uiapi');
    }

    /**
     * Polls the training status API until completion, failure, or timeout.
     * Emits structured logs for status updates.
     * 
     * @param request Playwright APIRequestContext
     * @param trainingId Decrypted integer training ID
     * @param authToken Authorization header token (Bearer JWT)
     * @param options Polling configuration options
     */
    public static async pollTrainingStatus(
        request: APIRequestContext,
        trainingId: number,
        authToken: string,
        options: PollingOptions = {}
    ): Promise<string> {
        const interval = options.intervalMs ?? 15000;
        const timeout = options.timeoutMs ?? 1800000;
        const maxRetries = options.maxTransientRetries ?? 5;

        const apiBaseUrl = this.getApiBaseUrl();
        const endpoint = `${apiBaseUrl}/Infer/api/model-training/getdatabyid`;

        // Encrypt the request payload: { id: trainingId }
        const requestPayload = { id: trainingId };
        const encryptedPayload = EncryptionAndDecryption.encryption(requestPayload);

        console.log(`[API POLL] Training: ${options.trainingName || 'Unknown'}, ID: ${trainingId}, Status: PENDING`);

        const startTime = Date.now();
        let lastReportedStatus = '';
        let lastReportedStepCount = 0;
        let transientErrorCount = 0;

        while (true) {
            // Check overall timeout
            if (Date.now() - startTime > timeout) {
                console.warn(`[API POLL] Timeout of ${timeout / 60000} minutes exceeded while waiting for Training ID: ${trainingId} to complete. Returning last known status: ${lastReportedStatus || 'TIMEOUT'}`);
                return lastReportedStatus || 'TIMEOUT';
            }

            try {
                // Perform the API POST request
                const response = await request.post(endpoint, {
                    headers: {
                        'Authorization': authToken,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    data: {
                        data: encryptedPayload
                    }
                });

                if (!response.ok()) {
                    throw new Error(`HTTP Error Status: ${response.status()} ${response.statusText()}`);
                }

                const responseJson = await response.json();
                
                // If status is not 10000 (app ok status), treat it as API error
                if (responseJson.status !== '10000') {
                    throw new Error(`Application API returned non-success code: ${responseJson.status}. Message: ${responseJson.msg}`);
                }

                if (!responseJson.details) {
                    throw new Error(`Response payload details field is empty or missing.`);
                }

                // Reset transient error count on a successful response
                transientErrorCount = 0;

                // Decrypt the details payload
                const decryptedDetails: TrainingDetails = EncryptionAndDecryption.decryption(responseJson.details);
                
                if (decryptedDetails === 400 || !decryptedDetails || typeof decryptedDetails === 'number') {
                    throw new Error(`Decryption failed for training status response payload.`);
                }

                const currentStatus = (decryptedDetails.status || '').toUpperCase();
                const logEntries = decryptedDetails.status_log || [];

                // Log status transitions and progress
                if (currentStatus !== lastReportedStatus) {
                    console.log(`[API POLL] Training: ${options.trainingName || 'Unknown'}, ID: ${trainingId}, Status: ${currentStatus}`);
                    lastReportedStatus = currentStatus;
                }

                // Final state handlers
                if (currentStatus === 'COMPLETED') {
                    return 'COMPLETED';
                }

                if (currentStatus === 'FAILED' || currentStatus === 'FAIL') {
                    return 'FAILED';
                }

            } catch (error: any) {
                transientErrorCount++;
                console.warn(`[API POLL] Warning: Transient request failure (${transientErrorCount}/${maxRetries}): ${error.message}`);
                
                if (transientErrorCount >= maxRetries) {
                    console.error(`[API POLL] Terminated polling due to excessive transient/network failures. Final error: ${error.message}. Returning last known status: ${lastReportedStatus || 'ERROR'}`);
                    return lastReportedStatus || 'ERROR';
                }

                // Wait briefly before retrying the failed check
                const backoffDelay = Math.min(2000 * Math.pow(2, transientErrorCount), interval);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                continue;
            }

            // Normal poll wait interval
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
}
