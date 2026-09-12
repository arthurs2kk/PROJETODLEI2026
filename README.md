READEME - Pro Povo

A citizen platform that connects your city's problems to the municipality

📋 About the Project

Pro Povo is a web platform that facilitates communication between citizens and municipal administration. Citizens can report urban problems (potholes, lighting, garbage, water/sewage, green areas), the community votes on the most urgent ones, and the municipality tracks and responds to each report in real-time.

The platform aims to increase transparency, civic engagement, and accelerate problem resolution by giving voice to citizens and providing administrators with clear data on what needs to be fixed in the city.

Main Features
✅ Citizens: Report problems with photos, vote on reports, track status in real-time
✅ Municipality: Dedicated dashboard to manage reports, update status, and send official responses
✅ City-Scoped Admin Access: Each municipality's staff only sees and acts on their own city's reports; a superadmin role retains full cross-city access
✅ Interactive Map: Visualize up to 500 recent geolocated reports from one selected city
✅ Analytics Dashboard: Statistics by city, neighborhood, problem category, and monthly trends
✅ Official Responses: Municipality updates and responses appear in real time in the citizen interface
✅ Responsive Design: Seamless experience on desktop, tablet, and mobile devices
✅ Dark Mode: User-friendly theme toggle for comfortable viewing
✅ User Authentication: Secure login system with email verification

🛠️ Technology Stack

Report loading without Cloud Functions

The static frontend never reads the complete public report collection to build the home, report lists, city selector, map, or charts. The home reuses its limited 50-report feed for visible counters, the public list loads 30 reports at a time, the management panel loads 25 at a time, city selectors use the official IBGE municipality list, the map queries one city with a 500-marker cap, and charts use at most the 500 most recent authorized reports.

Because Realtime Database has no browser-side aggregate query such as `COUNT()`, the numbers shown on the home describe the currently loaded batch rather than a global total. Exact global counters would require a trusted backend or a separate manually maintained data source.

Vercel Web Analytics

All HTML pages include the official static-site integration, loading `/_vercel/insights/script.js` with `defer`. This project does not use Next.js or a bundler, so `@vercel/analytics/next` and an npm analytics dependency are unnecessary.

To activate collection:

1. Open the project in Vercel, go to **Analytics**, and click **Enable** if it is not already enabled.
2. Deploy the updated site to Vercel.
3. Visit the deployed site and navigate between pages, then check the Analytics dashboard. Browser Network tools should show the insights script and requests to `/_vercel/insights/view`.

The analytics endpoint is provided by Vercel after activation and deployment; it is not served by a local static server. Include the same analytics snippet in any new HTML pages.

Documentation: https://vercel.com/docs/analytics/quickstart

Frontend Architecture
HTML5 - Semantic markup and accessibility
CSS3 - Custom styling with CSS variables for theming and dark mode support
JavaScript (ES6+) - Modular code with ES6 imports/exports for clean architecture

UI Components & Visualization
Tabler Icons - Minimalist icon library for consistent visual design
Leaflet - Lightweight open-source library for interactive mapping
Chart.js - Powerful charting library for generating analytics graphics (bar, pie, line, doughnut charts)

Backend & Data Management
Firebase Authentication - Secure user login with email/password and Google OAuth
Firebase Realtime Database - Real-time NoSQL database for instant data synchronization across users, with security rules enforcing per-city write permissions for admins
Firebase Realtime Database Rules - Server-side authorization, field validation, anti-spam checks, and atomic vote consistency
Cloudinary - Cloud-based image service for uploading, storing, and optimizing user photos

External APIs & Data Sources
IBGE API - Official Brazilian census data for municipal population estimates and municipality codes (used both for "reports per capita" analytics and as the stable cityId that powers city-scoped admin access)
Nominatim (OpenStreetMap) - Free geocoding service to convert addresses to coordinates and vice versa
OpenStreetMap - Open-source map tiles for the interactive map component

Security Boundary
Realtime Database Rules are the security boundary. Report creation, cooldown updates and votes are accepted only as internally consistent atomic writes; UI checks are only a usability layer.

📁 Project Structure

```
PROJETODLEI2026/
├── index.html                     # Home page with hero section and top reports
├── home.js                        # Core logic: real-time report listening, voting, filtering
├── home.css                       # Global styles, theming, responsive design
├── database.rules.json            # Realtime Database authorization and validation rules
├── firebase.json                  # Firebase project configuration
├── README.md
│
├── pages/
│   ├── admPages/                  # Municipality (restricted) pages
│   │   ├── AdmLogin.html          # Restricted login page for municipality employees
│   │   ├── AdminPage.html         # Report management dashboard (city-scoped)
│   │   └── AdminGraficos.html     # Analytics and reporting dashboard (city-scoped)
│   │
│   └── userPages/                 # Public / citizen pages
│       ├── login.html             # Authentication page for citizens
│       ├── mapa.html              # Interactive map interface
│       ├── relatos.html           # Full reports table with advanced filtering
│       ├── MeusRelatos.html       # Citizen's personal report dashboard
│       ├── comoUsar.html          # Step-by-step usage guide
│       ├── privacidade.html       # Privacy policy
│       └── termos.html            # Terms of use
│
├── js/
│   ├── firebase.js                # Firebase SDK initialization and exports
│   ├── db.js                      # Database queries and atomic, rules-validated writes
│   ├── cloudinary.js              # Image upload handler and URL optimization
│   ├── cidades.js                 # City dropdown population from IBGE data + cityId resolution
│   ├── endereco.js                # Manual address search with Paraíba validation
│   ├── populacao.js               # Population data fetching, caching, and name normalization
│   ├── notificacoes.js            # Reserved notification templates (not active in the admin panel)
│   ├── escapeHtml.js              # XSS prevention utility
│   ├── cooldown.js                # Rate limiting for report submissions
│   ├── config.js                  # External link configuration (e.g. footer author link)
│   ├── footer.js                  # Footer link wiring
│   ├── theme.js                   # Dark/light mode toggle with localStorage persistence
│   ├── navbar.js                  # Shared navigation bar with user profile modal
│   │
│   ├── admJS/                     # Scripts used only by the municipality panel
│   │   ├── adminAuth.js           # Resolves admin role, active status and city scope for the logged-in user
│   │   ├── AdmLogin.js            # Admin authentication and permission verification
│   │   ├── AdminPage.js           # Report queue management, SLA tracking, response system, filters
│   │   └── AdminGraficos.js       # Dynamic chart generation, CSV/PNG export, city-scoped views
│   │
│   └── pagesJS/                   # Scripts used only by public/citizen pages
│       ├── login.js               # Login/registration logic, email verification
│       ├── relatos.js             # Table rendering, multi-column sorting, search, filters
│       ├── mapa.js                # Map initialization and markers by category
│       ├── MeusRelatos.js         # Edit/delete reports, status tracking
│       ├── legal.js               # Shared navbar wiring for legal/how-to pages
│       └── menu.js                # Mobile hamburger menu handling
│
├── css/
│   ├── cssAdm/                    # Styling used only by the municipality panel
│   │   ├── AdmLogin.css           # Admin login form styling
│   │   ├── AdminPage.css          # Admin panel styling, KPI cards, city scope badge
│   │   └── AdminGraficos.css      # Chart container styling
│   │
│   └── cssUser/                   # Styling used only by public/citizen pages
│       ├── login.css              # Form styling and animations
│       ├── relatos.css            # Table design, mobile card conversion, shared filter controls
│       ├── mapa.css               # Map container styling
│       ├── MeusRelatos.css        # Report card styling
│       ├── legal.css              # Terms/privacy page styling
│       └── tutorial.css           # "How to use" step-by-step page styling
│
└── Images/
    ├── LogoProPovo.png
    └── tutorial/                  # Screenshots used in the "How to use" guide
```

🏗️ Architecture Overview

Data Flow
Report Creation: Citizen fills form → Cloudinary uploads photo → client atomically writes report + cooldown → Realtime Database Rules validate identity, verified email, fields, timestamp and rate limit before Firebase commits either write
Real-Time Updates: Firebase listeners broadcast changes → All connected clients update instantly
Admin Access Resolution: On login, adminAuth.js reads the admin's role and cityId once, and every subsequent panel query/action is scoped accordingly
Admin Actions: Admin updates status → Realtime Database rules confirm that the admin's city matches the report's city (or that they are a superadmin) → citizen interface updates in real time
Analytics: Up to 500 recent reports are queried (already city-scoped when applicable), aggregated with IBGE population data → Sample-based charts generated

Key Modules
Authentication Module (login.js, navbar.js) - Handles user registration, login, password recovery, and profile management
Admin Access Module (adminAuth.js) - Central place that resolves whether the logged-in user is an admin, whether they are a superadmin or a city-scoped admin, and which city/organization they belong to
Report Management Module (home.js, relatos.js, MeusRelatos.js) - Create, read, update, delete operations with real-time sync
Admin Module (AdmLogin.js, AdminPage.js, AdminGraficos.js) - Report queue, SLA tracking, status updates, responses, and analytics — all automatically scoped to the admin's city unless they are a superadmin
Geolocation Module (endereco.js, mapa.js) - Address search, map visualization, and location-based filtering

🔑 Core Features Explained

Citizen Features

Report Creation
Manual, user-triggered address search powered by Nominatim
Photo upload with client-side validation (format, size)
Automatic categorization (potholes, lighting, garbage, water, green areas, other)
Geolocation capture and storage for map visualization, including the report's cityId

Voting System
One-time vote per report per user (prevents vote manipulation)
Vote tracking in separate Firebase collection
Decentralized voting - no admin intervention needed

Report Tracking
Personal dashboard showing all submitted reports
Real-time status updates (open → in progress → resolved)
View municipality's official responses
Edit or delete reports only while status is "open"

Report Browsing (relatos.html)
Search by title/address, plus filters by city, neighborhood, category and status
Neighborhood options are dynamically scoped to the currently selected city

Municipality Features

Access Roles
Superadmin - full access across every municipality (also the legacy/default role for any admin account created before this feature existed)
City Admin - scoped to a single municipality, identified by its IBGE cityId; can only view and act on reports belonging to their own city
Every write action a city admin performs (status change, official response, deletion) is validated both in the UI and in the Realtime Database security rules, so the restriction holds even if the client were bypassed

Report Management Dashboard
Queue-style interface showing incoming reports (all cities for a superadmin, one city for a city admin)
Reports load in pages of 25, with explicit refresh and "load older" controls
A scope badge at the top of the panel always shows whether the current view is "All cities" or the specific city being managed
Advanced filtering by city (superadmin only), neighborhood, category and status
SLA tracking with visual alerts for overdue reports (10+ days without update)
One-click status updates reflected instantly in the citizen interface

Response System
Add official responses to reports
Responses visible to all citizens (transparent accountability)
Track response timestamps for performance metrics

Analytics Suite
Cities Report: Top cities by reports-per-capita (normalized against IBGE population data) — only shown to superadmins, since it compares cities against each other
Neighborhoods Report: Drill-down analysis by neighborhood within a selected city — automatically locked to a city admin's own city
Problem Categories: Pie chart showing distribution of problem types
Resolution Status: Doughnut chart showing open/in-progress/resolved split
Monthly Evolution: Line chart tracking report volume over time
All analytics views use a sample of up to 500 recent reports and are automatically scoped to a city admin's own city; a superadmin's sample can include every city

🎯 Key Differentiators
✅ Real-Time Synchronization - All changes propagate instantly across connected users
✅ Backend-Free Security Boundary - Realtime Database Rules protect privileged fields and validate cross-path atomic operations without Cloud Functions
✅ City-Isolated Admin Access - Realtime Database security rules, not just the UI, enforce that a municipality's staff can only act on their own city's reports
✅ Population-Normalized Analytics - Compares cities fairly by report density, not absolute count
✅ XSS Protection - All user input sanitized to prevent malicious code injection
✅ Rate Limiting - Citizens must wait between report submissions (prevents spam)
✅ Responsive & Accessible - Works on all devices with keyboard navigation support
✅ Dark Mode - Reduces eye strain with persistent theme preference
⚠️ Email Notifications - Intentionally disabled until implemented in a trusted backend with explicit consent and a configured provider

🔄 Data Model

Core Collections

relatos - Individual problem reports
Title, category, description, location (address + coordinates)
City name and cityId (IBGE municipality code), and neighborhood — used both for public filtering and for scoping admin access
Photo URL (Cloudinary), status, vote count
Author info, creation date, resolution date
Municipality's official response (if any)

usuarios - Citizen accounts
Name, email, city of residence
Registration date, email verification status

votos - Vote tracking
Maps report ID to user ID (ensures one vote per user)

admins - Municipality employee access control
New format: an object per admin — { papel: "superadmin" | "admin", cityId, organizacaoId, ativo }
Legacy format: a plain boolean true is still accepted and treated as an unrestricted superadmin, for backward compatibility with accounts created before city-scoping existed

organizacoes - Municipality (prefeitura) registry
One entry per municipality: { nome, cityId, cidadeNome, ativo }
Multiple admins can belong to the same organization; an admin's organizacaoId is used only to look up and display the municipality's name, while cityId is what security rules actually check

limitesEnvio - Rate limiting cache
Stores each user's last accepted submission time; Rules require it to be updated atomically with the report and enforce a five-minute interval using Firebase's server time

📊 Analytics Capabilities

The platform provides municipalities with actionable intelligence:
Identify problem hotspots by city and neighborhood
Prioritize by urgency using community voting
Trend analysis to spot emerging issues
Performance metrics with SLA tracking
Exportable data for reports and presentations
Every metric is calculated from up to 500 recent reports and automatically scoped to a city admin's own municipality, so staff never see (or export) another city's data

🎨 Design Philosophy
Clean & Minimal - Reduced cognitive load with clear visual hierarchy
Mobile-First - Optimized for smartphone access (most citizens use phones)
Accessible - WCAG-compliant colors, keyboard navigation, semantic HTML
Fast - Lazy image loading, CSS-only animations, Firebase real-time efficiency
Trustworthy - Transparent responses, visible vote counts, public data, and clear scope indicators in the admin panel

✨ Technology Rationale

Technology | Why Used
Firebase | Real-time updates, built-in authentication, and server-evaluated rules that enforce field integrity, vote consistency and per-city admin isolation
Cloudinary | Automatic image optimization, CDN delivery, free tier generous
Nominatim | Manual, user-triggered address search for the MVP, restricted to validated Paraíba municipalities
IBGE API | Official Brazilian census data, regularly updated population figures, and stable municipality codes used as the cityId for admin scoping
Chart.js | Lightweight, declarative, extensive chart types
Leaflet | Small bundle size, fast rendering, OpenStreetMap integration

🔐 Security Architecture

The application does not depend on Cloud Functions or a dedicated application server. Firebase Authentication identifies users, while Realtime Database Security Rules enforce authorization, data validation, report-submission intervals, vote consistency and municipal access boundaries.

Technical considerations of the backend-free design:

- Home counters describe only its limited feed, and city selectors use the IBGE municipality list; browsers do not read all reports to calculate either one.
- The Cloudinary unsigned upload preset cannot be cryptographically signed in a static frontend. Restrict formats, size, folder and transformations in the Cloudinary console, and treat abuse prevention there as an operational control.
- Coordinates and the IBGE municipality pair are format/range checked, but a static client cannot prove that a user did not intentionally choose another valid municipality. A trusted reference dataset in Firebase Rules or a backend would be required for stronger geographic attestation.
- App Check can be added as defense in depth against scripted clients, but it does not replace Authentication or Security Rules.

Legacy administrative records remain supported for compatibility, while the current data model uses structured roles and IBGE municipality identifiers.

📈 Project Impact

This platform demonstrates:
Civic Tech - Technology enabling citizen participation in local governance
Open Data - Using public IBGE data to provide fair comparisons
Transparency - Making municipal processes visible to all citizens
Multi-Tenant Security - Practical, rules-enforced data isolation between municipalities sharing the same platform
Scalability - Public and administrative listings are paginated, charts use a bounded sample, and the map is city-scoped with a marker cap

Pro Povo — Making your city more transparent, one report at a time. 🌍
