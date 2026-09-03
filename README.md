READEME - Pro Povo

A citizen platform that connects your city's problems to the municipality

📋 About the Project

Pro Povo is a web platform that facilitates communication between citizens and municipal administration. Citizens can report urban problems (potholes, lighting, garbage, water/sewage, green areas), the community votes on the most urgent ones, and the municipality tracks and responds to each report in real-time.

The platform aims to increase transparency, civic engagement, and accelerate problem resolution by giving voice to citizens and providing administrators with clear data on what needs to be fixed in the city.

Main Features
✅ Citizens: Report problems with photos, vote on reports, track status in real-time
✅ Municipality: Dedicated dashboard to manage reports, update status, and send official responses
✅ City-Scoped Admin Access: Each municipality's staff only sees and acts on their own city's reports; a superadmin role retains full cross-city access
✅ Interactive Map: Visualize all geolocated problems across Paraíba state
✅ Analytics Dashboard: Statistics by city, neighborhood, problem category, and monthly trends
✅ Smart Notifications: Automatic email alerts when report status changes or municipality responds
✅ Responsive Design: Seamless experience on desktop, tablet, and mobile devices
✅ Dark Mode: User-friendly theme toggle for comfortable viewing
✅ User Authentication: Secure login system with email verification

🛠️ Technology Stack

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
Cloudinary - Cloud-based image service for uploading, storing, and optimizing user photos

External APIs & Data Sources
IBGE API - Official Brazilian census data for municipal population estimates and municipality codes (used both for "reports per capita" analytics and as the stable cityId that powers city-scoped admin access)
Nominatim (OpenStreetMap) - Free geocoding service to convert addresses to coordinates and vice versa
OpenStreetMap - Open-source map tiles for the interactive map component

Email Notifications
EmailJS - Service that enables sending emails directly from the browser without a backend server

📁 Project Structure

```
PROJETODLEI2026/
├── index.html                     # Home page with hero section and top reports
├── home.html                      # Additional/alternate home entry point
├── home.js                        # Core logic: real-time report listening, voting, filtering
├── home.css                       # Global styles, theming, responsive design
├── READEME.md
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
│   ├── db.js                      # Database query functions and transactions (incl. city-scoped queries)
│   ├── cloudinary.js              # Image upload handler and URL optimization
│   ├── cidades.js                 # City dropdown population from IBGE data + cityId resolution
│   ├── endereco.js                # Address autocomplete with Nominatim debouncing
│   ├── populacao.js               # Population data fetching, caching, and name normalization
│   ├── notificacoes.js            # Email notification templates and sending logic
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
│       ├── mapa.js                # Map initialization, marker clustering by category
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
Report Creation: Citizen fills form → Cloudinary uploads photo → Firebase stores report metadata (including its cityId)
Real-Time Updates: Firebase listeners broadcast changes → All connected clients update instantly
Admin Access Resolution: On login, adminAuth.js reads the admin's role and cityId once, and every subsequent panel query/action is scoped accordingly
Admin Actions: Admin updates status → Realtime Database security rules confirm the admin's city matches the report's city (or that they are a superadmin) → Email notification sent to citizen via EmailJS
Analytics: Reports are queried (already city-scoped when applicable), aggregated with IBGE population data → Charts generated

Key Modules
Authentication Module (login.js, navbar.js) - Handles user registration, login, password recovery, and profile management
Admin Access Module (adminAuth.js) - Central place that resolves whether the logged-in user is an admin, whether they are a superadmin or a city-scoped admin, and which city/organization they belong to
Report Management Module (home.js, relatos.js, MeusRelatos.js) - Create, read, update, delete operations with real-time sync
Admin Module (AdmLogin.js, AdminPage.js, AdminGraficos.js) - Report queue, SLA tracking, status updates, responses, and analytics — all automatically scoped to the admin's city unless they are a superadmin
Geolocation Module (endereco.js, mapa.js) - Address search, map visualization, and location-based filtering

🔑 Core Features Explained

Citizen Features

Report Creation
Rich form with address autocomplete powered by Nominatim
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
A scope badge at the top of the panel always shows whether the current view is "All cities" or the specific city being managed
Advanced filtering by city (superadmin only), neighborhood, category and status
SLA tracking with visual alerts for overdue reports (10+ days without update)
One-click status updates with instant citizen notification

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
All analytics views are automatically scoped to a city admin's own city; a superadmin can browse every city

🎯 Key Differentiators
✅ Real-Time Synchronization - All changes propagate instantly across connected users
✅ No Backend Required - Fully serverless using Firebase
✅ City-Isolated Admin Access - Realtime Database security rules, not just the UI, enforce that a municipality's staff can only act on their own city's reports
✅ Population-Normalized Analytics - Compares cities fairly by report density, not absolute count
✅ XSS Protection - All user input sanitized to prevent malicious code injection
✅ Rate Limiting - Citizens must wait between report submissions (prevents spam)
✅ Responsive & Accessible - Works on all devices with keyboard navigation support
✅ Dark Mode - Reduces eye strain with persistent theme preference
✅ Email Notifications - Citizens stay informed without opening the app

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
Prevents users from submitting multiple reports too quickly

📊 Analytics Capabilities

The platform provides municipalities with actionable intelligence:
Identify problem hotspots by city and neighborhood
Prioritize by urgency using community voting
Trend analysis to spot emerging issues
Performance metrics with SLA tracking
Exportable data for reports and presentations
Every metric is automatically scoped to a city admin's own municipality, so staff never see (or export) another city's data

🎨 Design Philosophy
Clean & Minimal - Reduced cognitive load with clear visual hierarchy
Mobile-First - Optimized for smartphone access (most citizens use phones)
Accessible - WCAG-compliant colors, keyboard navigation, semantic HTML
Fast - Lazy image loading, CSS-only animations, Firebase real-time efficiency
Trustworthy - Transparent responses, visible vote counts, public data, and clear scope indicators in the admin panel

✨ Technology Rationale

Technology | Why Used
Firebase | Serverless (no backend maintenance), real-time updates, built-in auth, and security rules expressive enough to enforce per-city admin isolation
Cloudinary | Automatic image optimization, CDN delivery, free tier generous
Nominatim | Free geocoding without API keys, OpenStreetMap community data
IBGE API | Official Brazilian census data, regularly updated population figures, and stable municipality codes used as the cityId for admin scoping
Chart.js | Lightweight, declarative, extensive chart types
Leaflet | Small bundle size, fast rendering, OpenStreetMap integration

📈 Project Impact

This platform demonstrates:
Civic Tech - Technology enabling citizen participation in local governance
Open Data - Using public IBGE data to provide fair comparisons
Transparency - Making municipal processes visible to all citizens
Multi-Tenant Security - Practical, rules-enforced data isolation between municipalities sharing the same platform
Scalability - Serverless architecture handles growth without infrastructure costs

Pro Povo — Making your city more transparent, one report at a time. 🌍
