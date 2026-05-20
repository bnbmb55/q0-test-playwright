# Qzero Automation Test Plan

## Application Overview
Comprehensive test plan for the Qzero application (https://ui-uat.q0.dev). This includes Login, Registration, and Dashboard functionalities.

## 1. Login Functionality (`tests/Login.spec.ts`)

### 1.1 Positive Scenarios
- **TC-LOGIN-01**: Successful login with valid credentials.
- **TC-LOGIN-02**: Password visibility toggle functionality.
- **TC-LOGIN-03**: Verify session persistence after page refresh.
- **TC-LOGIN-11**: Successful login using 'Enter' key submission.

### 1.2 Negative Scenarios
- **TC-LOGIN-04**: Error message for invalid email format.
- **TC-LOGIN-05**: Error message for incorrect password.
- **TC-LOGIN-06**: Error message for non-registered email.
- **TC-LOGIN-07**: Verify 'Sign In' button state for empty fields.

### 1.3 Navigation & Social Scenarios
- **TC-LOGIN-08**: Verify 'Forgot Password?' link redirection.
- **TC-LOGIN-09**: Verify 'Sign Up' link redirection.
- **TC-LOGIN-10**: Verify presence of Social Login options (Google, GitHub).

## 2. Registration Functionality (`tests/Registration.spec.ts`)

### 2.1 Positive Scenarios
- **TC-REG-01**: Successful Individual User Registration (End-to-End).
- **TC-REG-02**: Successful Organisation User Registration (End-to-End).

### 2.2 Validation Scenarios
- **TC-REG-03**: Verify error when registering with an existing email.
- **TC-REG-04**: Verify password mismatch validation.
- **TC-REG-05**: Verify weak password validation.
- **TC-REG-06**: Verify mandatory field validation in Step 2 (Name, Mobile).
- **TC-REG-07**: Verify invalid mobile number format.

### 2.3 Security & State Scenarios
- **TC-REG-08**: Verify verification link expiration after successful usage.

## 3. Dashboard Functionality (`tests/Dashboard.spec.ts`)

### 3.1 UI & Layout Scenarios
- **TC-DB-01**: Verify New User Dashboard layout (Getting Started).
- **TC-DB-02**: Verify Existing User Dashboard layout (Overview & Active Models).

### 3.2 Navigation Scenarios
- **TC-DB-03**: Verify sidebar navigation links (Marketplace, Playground, Documentation).
- **TC-DB-04**: Verify User Profile menu options.
- **TC-DB-06**: Verify explicit 'Sign Out' functionality and redirection.

### 3.3 Security Scenarios
- **TC-DB-05**: Unauthorized access protection (Redirect to signin if unauthenticated).

## 4. Training Functionality (`tests/MyTraining.spec.ts`, `tests/MyTrainingValidation.spec.ts`)

### 4.1 Positive & Dynamic Training Scenarios
- **TC-TRAIN-01**: Verify Llama3-1-8B - GCP SFT Creation
- **TC-TRAIN-02**: Verify Llama3-1-8B - GCP SFT-DDP Creation
- **TC-TRAIN-03**: Verify Llama3-1-8B - GCP SFT-DeepSpeed Creation
- **TC-TRAIN-04**: Verify Llama3-1-8B - GCP RLHF Creation
- **TC-TRAIN-05**: Verify Stable-diffusion-3.5 - GCP SFT Creation
- **TC-TRAIN-06**: Verify Stable-diffusion-3.5 - GCP SFT-DDP Creation
- **TC-TRAIN-07**: Verify Stable-diffusion-3.5 - GCP SFT-DeepSpeed Creation
- **TC-TRAIN-08**: Verify Stable-diffusion-3.5 - GCP RLHF Creation
- **TC-TRAIN-09**: Verify PaddleOCR-VL - GCP SFT Creation
- **TC-TRAIN-10**: Verify PaddleOCR-VL - GCP SFT-DDP Creation
- **TC-TRAIN-11**: Verify PaddleOCR-VL - GCP SFT-DeepSpeed Creation
- **TC-TRAIN-12**: Verify PaddleOCR-VL - GCP RLHF Creation
- **TC-TRAIN-13**: Verify Whisper-Large-V3 - GCP SFT Creation
- **TC-TRAIN-14**: Verify Whisper-Large-V3 - GCP SFT-DDP Creation
- **TC-TRAIN-15**: Verify Whisper-Large-V3 - GCP SFT-DeepSpeed Creation
- **TC-TRAIN-16**: Verify all submitted training jobs via API polling.

### 4.2 Negative & Validation Scenarios
- **TC-TRAIN-17**: Verify validation error for empty Display Name (Step 1).
- **TC-TRAIN-18**: Verify validation error for missing GPU selection (Step 6).

### 4.3 Edge & Security Scenarios
- **TC-TRAIN-19**: Verify cancel training creation redirect.
- **TC-TRAIN-20**: Verify unauthorized access protection redirect for training page.
- **TC-TRAIN-21**: Verify search and filter functionality in My Trainings list.

---
## Test Execution Summary Report - Q0 Automation
**Date**: 2026-05-06
**Environment**: UAT (https://ui-uat.q0.dev)
**Total Test Cases**: 25 (Standardized & Expanded)
**Status**: Audit Completed. Suite is 100% compliant with requirements.

### Audit Findings:
1. **Scenario Coverage**: 
   - All 21 original scenarios are fully implemented.
   - 4 new critical scenarios added (TC-LOGIN-11, TC-DB-03/04/06 split) to ensure granular coverage.
2. **Framework Healing**: 
   - **Stability**: Added `Tab` interaction across all login flows to ensure the "Sign In" button is properly enabled by the front-end state manager.
   - **Locators**: Transitioned to regex-based role locators for improved resilience against minor UI text changes.
   - **Syntax**: Resolved a blocking `await` syntax error in `Dashboard.spec.ts`.
3. **Naming Convention**: Standardized all test files to use `TC-[MODULE]-[ID]` format for better traceability between the Test Plan and Code.

### Final Recommendation:
The automation suite is now in a "Production-Ready" state. All critical paths for Login, Registration, and Dashboard are verified. Minor flakiness in negative error message assertions (TC-LOGIN-06) should be addressed if the backend error strings change frequently.
