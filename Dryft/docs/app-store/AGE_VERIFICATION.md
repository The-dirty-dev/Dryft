# Age Verification System

## Overview

Dryft requires all users to verify they are 18 years of age or older before accessing the platform's full features. This document outlines our age verification system and compliance measures.

## Verification Methods

### 1. Credit/Debit Card Verification
**Fastest method - Instant verification**

- User enters valid credit/debit card
- We perform a $0 authorization (no charge)
- Card must be in user's name
- Card must not be prepaid/gift card
- Verification status: Instant

**Technical Implementation:**
- Stripe Identity + Stripe Payments
- Card holder name matched against account
- BIN checking to reject prepaid cards

### 2. Government ID Verification
**Most secure - 1-24 hour processing**

- User uploads government-issued photo ID
- Supported documents:
  - Driver's license
  - Passport
  - National ID card
  - State ID
- Selfie verification for liveness check
- AI + human review process

**Technical Implementation:**
- Integration with [Jumio/Onfido/Veriff]
- Document authenticity verification
- Face match between ID and selfie
- Date of birth extraction and validation

### 3. Third-Party Age Verification Services
**Alternative option**

- Integration with existing verification services
- User may already be verified through other platforms
- Supported services:
  - AgeID
  - Yoti
  - 1Account

## Verification Flow

```
┌─────────────────┐
│  User Sign Up   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Basic Features  │ ← Limited access
│ (No matching)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Verification    │
│ Required Prompt │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌──────┐
│ Card  │ │  ID  │
└───┬───┘ └──┬───┘
    │        │
    ▼        ▼
┌─────────────────┐
│ Verification    │
│ Processing      │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌──────┐
│ Pass  │ │ Fail │
└───┬───┘ └──┬───┘
    │        │
    ▼        ▼
┌───────┐ ┌──────────┐
│ Full  │ │ Retry or │
│Access │ │ Appeal   │
└───────┘ └──────────┘
```

## Access Levels

### Unverified Users
- Can create account
- Can set up profile
- Can browse store (no purchases)
- **Cannot:**
  - Discover/match with users
  - Send/receive messages
  - Access VR features
  - Make purchases

### Verified Users
- Full access to all features
- Can discover and match
- Can message matches
- Can access VR environments
- Can purchase virtual items
- Can use haptic features

## Data Handling

### What We Store
- Verification status (verified/unverified)
- Verification method used
- Verification timestamp
- Verification provider reference ID

### What We Do NOT Store
- ID document images
- Full card numbers
- Social security numbers
- Document OCR data

### Data Retention
- Verification status: Account lifetime
- Provider reference: 90 days (for disputes)
- Failed verification attempts: 30 days

## Compliance

### Legal Requirements
- COPPA (Children's Online Privacy Protection Act)
- State age verification laws (e.g., Louisiana Act 440)
- GDPR Article 8 (parental consent under 16)
- UK Age Appropriate Design Code

### Platform Requirements
- Apple App Store 17+ rating requirements
- Google Play Mature 17+ requirements
- Meta Quest Store adult content policies

## Fraud Prevention

### Detection Measures
1. **Device Fingerprinting**
   - Track device across verification attempts
   - Flag devices with multiple failed attempts

2. **Velocity Checks**
   - Limit verification attempts per device
   - Limit verification attempts per IP

3. **Document Fraud Detection**
   - AI-powered document authenticity
   - Liveness detection for selfies
   - Cross-reference with known fraud databases

4. **Behavioral Analysis**
   - Unusual account creation patterns
   - Geographic anomalies
   - Time-based patterns

### Response to Fraud
- Immediate account suspension
- IP/device blocking
- Report to verification provider
- Law enforcement referral if warranted

## Appeals Process

Users who fail verification can:

1. **Retry with different method**
   - Card verification → ID verification
   - Different card

2. **Contact Support**
   - Email: verification@dryft.site
   - Provide additional documentation
   - Human review within 48 hours

3. **Formal Appeal**
   - Written appeal to legal@dryft.site
   - Response within 5 business days

## Monitoring & Reporting

### Metrics Tracked
- Verification success rate
- Method distribution
- Average verification time
- Fraud detection rate
- Appeal success rate

### Regular Audits
- Monthly compliance review
- Quarterly third-party audit
- Annual penetration testing

## Integration Code Reference

### Backend Endpoints
```
POST /v1/age-gate/verify/card     - Card verification
POST /v1/age-gate/verify/id       - ID verification
GET  /v1/age-gate/status          - Check verification status
POST /v1/age-gate/appeal          - Submit appeal
```

### Mobile Implementation
- `VerificationStatusScreen.tsx` - Status display
- `CardVerificationScreen.tsx` - Card flow
- `IDVerificationScreen.tsx` - ID flow

### VR Implementation
- Verification required before joining sessions
- Status checked on app launch
- Redirect to mobile for verification process

## Emergency Procedures

### Suspected Underage User
1. Immediate account suspension
2. Block from all interactions
3. Preserve evidence
4. Review verification records
5. Report to NCMEC if content involved
6. Permanent ban on confirmation

### Verification System Failure
1. Activate maintenance mode
2. Disable new user access to full features
3. Existing verified users maintain access
4. Emergency fix deployment
5. Post-incident review
