# Firebase Authentication Specification

## Login method
Use Firebase Authentication with Google Sign-In.

## First login
1. User signs in with Google.
2. App checks users/{uid} in Firestore.
3. If missing, create profile.
4. Assign default role: admin for first user, viewer/auditor for later users depending on admin settings.

## User roles
- Admin: full access
- Auditor: upload, validate, generate reports
- Viewer: view dashboards and reports only

## Protected routes
All internal pages require authentication.

## Firestore security expectation
Users can only access data for their companyId. Role checks should restrict delete/settings actions.
