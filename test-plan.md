# Qzero Automation Test Plan

## Application Overview
Comprehensive test plan for the Qzero application (https://ui-beta.q0.dev). This includes Login, Registration, and Dashboard functionalities.

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

---
## Test Execution Summary Report - Q0 Automation
**Date**: 2026-05-06
**Environment**: Beta (https://ui-beta.q0.dev)
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
