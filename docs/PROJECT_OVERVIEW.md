# Project Overview

## What This Project Is

iKOMEK 109 is a full-stack smart city service platform for Astana. It is designed to help residents report urban problems, track request progress, receive city updates, and communicate with municipal operators through one shared digital system.

The repository combines three connected applications:

- a FastAPI backend
- a mobile frontend built with Expo and React Native
- a web frontend built with React and Vite

All three parts are intended to work together around one backend API and one MongoDB database.

## Main Idea And Purpose

The goal of the project is to digitize the flow of reporting and resolving city problems.

Instead of citizens calling different departments or using disconnected tools, the platform gives them one place to:

- submit city issues
- attach photos and location data
- track status changes
- talk to operators
- receive public alerts and news

At the same time, operators and administrators get tools to:

- review requests
- update request status
- communicate with citizens
- publish alerts or news
- monitor platform activity

In short, this project is a municipal service platform that connects residents, operators, and administration inside one system.

## What The System Contains

### 1. Backend

Location: `apps/backend`

This is the main service layer of the project. It handles business logic, API routes, authentication, request processing, data persistence, and integration between clients and the database.

Core responsibilities:

- user registration and authentication
- JWT-based authorization
- role handling for citizen, operator, and admin
- request creation and management
- news and alerts management
- analytics endpoints for admin features
- shared API contract used by mobile and web

Main entrypoint:

- `apps/backend/server.py`

### 2. Mobile Frontend

Location: `apps/mobile-app`

This is the mobile client for citizens and other platform users. It is built with Expo and React Native and is designed to work against the same backend as the web app.

Core responsibilities:

- sign in and sign up flows
- request creation from mobile
- location access and map-related interactions
- viewing request history
- profile and account actions
- multilingual mobile experience

### 3. Web Frontend

Location: `apps/web-app`

This is the browser-based interface for the same platform. It includes public-facing product pages, citizen flows, and role-based views for operators and admins.

Core responsibilities:

- public landing and city information pages
- citizen request management from desktop
- operator workflow screens
- admin analytics screens
- map-based issue exploration
- multilingual desktop interface

## User Roles In The System

The platform is built around three main user roles.

### Citizen

A resident can:

- create a new request
- choose a category
- set a location
- attach description and files
- view their own requests
- follow status changes
- read city news and alerts

### Operator

An operator can:

- review incoming requests
- update progress and statuses
- communicate with citizens
- work with request queues

### Admin

An admin can:

- view analytics
- monitor system activity
- manage higher-level platform operations

## Main Functional Areas

Based on the current repository and implemented flows, the project includes these major areas:

- authentication and authorization
- request submission and tracking
- request categories and reasons
- city news and alerts
- map-based issue presentation
- operator request handling
- admin analytics
- multilingual interface support
- shared backend contract for mobile and web

## Typical User Flow

The main business flow looks like this:

1. A citizen signs in through mobile or web.
2. The user creates a city issue request.
3. The request is saved in MongoDB through the FastAPI backend.
4. Operators review and update the request.
5. The citizen sees progress changes in the same system.
6. Public information such as news and alerts can be displayed alongside operational data.

This means the project is not just a website or a mobile app. It is a shared service ecosystem with one data source and multiple clients.

## Technology Stack

### Backend Stack

- Python
- FastAPI
- Uvicorn
- MongoDB
- Motor
- PyMongo
- Pydantic
- JWT authentication
- Passlib and bcrypt
- python-dotenv
- python-jose
- python-multipart

Supporting and utility packages present in the backend environment include:

- boto3
- cryptography
- pandas
- numpy
- typer
- requests

Quality and development tools in the backend environment include:

- pytest
- black
- isort
- flake8
- mypy

### Mobile Stack

- Expo
- React Native
- TypeScript
- Expo Router
- React Navigation
- AsyncStorage
- Axios
- i18next
- Expo Location
- Expo Image Picker
- React Native Maps
- Reanimated

### Web Stack

- React
- TypeScript
- Vite
- React Router
- TanStack React Query
- Axios
- Framer Motion
- i18next
- OpenLayers
- Lucide React
- Zod

## Architecture Summary

At a high level, the architecture is:

```text
Mobile App   --->|
                |--> FastAPI Backend --> MongoDB
Web App      --->|
```

Important architectural idea:

- the mobile app and web app are separate frontends
- both use the same backend
- both rely on the same business data
- backend logic is the single source of truth

This is important because it avoids duplicating platform logic in two different clients.

## Repository Structure

```text
ikomek-project/
├── apps/
│   ├── backend/
│   │   ├── server.py
│   │   ├── requirements.txt
│   │   └── README.md
│   ├── mobile-app/
│   │   ├── app/
│   │   ├── assets/
│   │   ├── src/
│   │   ├── app.json
│   │   ├── package.json
│   │   └── README.md
│   └── web-app/
│       ├── public/
│       ├── src/
│       ├── package.json
│       └── README.md
├── docs/
│   ├── PROJECT_OVERVIEW.md
│   └── RUNNING.md
├── scripts/
│   └── start_system.py
├── tests/
├── memory/
└── README.md
```

## Configuration And Startup

The system expects environment configuration for each application.

### Backend

Expected file:

- `apps/backend/.env`

Main variables:

- `MONGO_URL`
- `DB_NAME`
- `JWT_SECRET`

### Mobile

Expected file:

- `apps/mobile-app/.env`

Main variable:

- `EXPO_PUBLIC_BACKEND_URL`

### Web

Expected file:

- `apps/web-app/.env`

Main variable:

- `VITE_API_BASE_URL`

## Running The System

The project can be started with the helper launcher:

```bash
python3 scripts/start_system.py
```

This script is intended to start:

- backend
- web frontend
- mobile Expo server

There is also a dedicated guide:

- `docs/RUNNING.md`

## Demo And Development Notes

The repository includes demo-oriented capabilities such as seeded accounts and sample data flows. This is useful for:

- local testing
- demonstrations
- design iteration
- frontend-backend integration work

The system also includes multilingual support for:

- Russian
- Kazakh
- English

## What Is Already Strong In This Project

From the current repository structure and integration state, the strongest parts of the project are:

- clear separation between backend, mobile, and web
- one shared backend for both clients
- role-based platform model
- support for real municipal workflows
- multilingual product direction
- map and city-issue orientation
- ability to run the system locally as a full stack

## What Kind Of Project This Is

This is a civic-tech and municipal service platform.

It is suitable for:

- diploma or graduation projects
- smart city prototypes
- municipal digital service pilots
- citizen request management systems
- public issue reporting platforms

## Short Summary

iKOMEK 109 is a multi-platform city service system where residents can report problems, operators can process them, and admins can monitor the platform. It uses a FastAPI backend with MongoDB, plus mobile and web frontends that share the same API and data model.
