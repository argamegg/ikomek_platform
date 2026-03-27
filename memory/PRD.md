# iKomek 109 - Product Requirements Document

## Original Problem Statement
Build a "Smart City Service App" for Astana called "iKomek 109" - a cross-platform mobile app using Expo/React Native with FastAPI backend and MongoDB database.

## Core Requirements
- Map system centered on Astana with demo complaint points
- 3 User Roles: Citizen, Operator, Admin
- Multi-language: Russian, Kazakh, English
- Auth: Login/Register with JWT
- Request creation, tracking, and chat
- News system with categorized city alerts
- Clean, modern UI with primary ORANGE color

## Architecture
- **Frontend**: Expo (React Native) with TypeScript, Expo Router
- **Backend**: FastAPI (Python) with Motor (async MongoDB)
- **Database**: MongoDB
- **State**: React Context (AuthContext)
- **i18n**: i18next with RU/KZ/EN

## What's Been Implemented (March 2026)
- [x] Full-stack foundation (Expo + FastAPI + MongoDB)
- [x] Database seeding (50 demo requests, 3 users, 3 news)
- [x] Citizen UI: Login, News, Map, Create, Requests, Profile tabs
- [x] Tab navigation with floating action button
- [x] User roles backend (citizen/operator/admin)
- [x] Multi-language support (i18next: RU, KZ, EN)
- [x] Chat/messaging endpoints (backend)
- [x] Project documentation (README.md, setup.sh)

## Prioritized Backlog
### P0 - Critical
- [ ] Role-Based UI: Operator Dashboard (manage requests, change status, notes)
- [ ] Role-Based UI: Admin Dashboard (analytics, user management, news management)
- [ ] Routing logic to redirect by role after login

### P1 - Important
- [ ] Chat system UI (Citizen <-> Operator per request)
- [ ] Enhanced request creation flow (multi-step: address -> details -> category -> photos -> submit)

### P2 - Nice to Have
- [ ] Onboarding flow (multi-screen welcome)
- [ ] Map enhancements (heatmap, clustering)
- [ ] Animations & micro-interactions

## Demo Accounts
| Role | Email | Password |
|------|-------|----------|
| Citizen | demo@ikomek.kz | demo123 |
| Operator | operator@ikomek.kz | operator123 |
| Admin | admin@ikomek.kz | admin123 |
