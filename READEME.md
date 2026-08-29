README - Pro Povo

A citizen platform that connects your city's problems to the municipality

📋 About the Project

Pro Povo is a web platform that facilitates communication between citizens and municipal administration. Citizens can report urban problems (potholes, lighting, garbage, water/sewage, green areas), the community votes on the most urgent ones, and the municipality tracks and responds to each report in real-time.

The platform aims to increase transparency, civic engagement, and accelerate problem resolution by giving voice to citizens and providing administrators with clear data on what needs to be fixed in the city.

Main Features
✅ Citizens: Report problems with photos, vote on reports, track status in real-time
✅ Municipality: Dedicated dashboard to manage reports, update status, and send official responses
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
Firebase Realtime Database - Real-time NoSQL database for instant data synchronization across users
Cloudinary - Cloud-based image service for uploading, storing, and optimizing user photos
External APIs & Data Sources
IBGE API - Official Brazilian census data for municipal population estimates (enables "reports per capita" analytics)
Nominatim (OpenStreetMap) - Free geocoding service to convert addresses to coordinates and vice versa
OpenStreetMap - Open-source map tiles for the interactive map component
Email Notifications
EmailJS - Service that enables sending emails directly from the browser without a backend server
📁 Project Structure
pro-povo/
├── index.html                 # Home page with hero section and top reports
├── home.js                    # Core logic: real-time report listening, voting, filtering
├── home.css                   # Global styles, theming, responsive design
│
├── login.html                 # Authentication page for citizens
├── login.js                   # Login/registration logic, email verification
├── login.css                  # Form styling and animations
│
├── relatos.html               # Full reports table with advanced filtering
├── relatos.js                 # Table rendering, multi-column sorting, search
├── relatos.css                # Table design, mobile card conversion
│
├── mapa.html                  # Interactive map interface
├── mapa.js                    # Map initialization, marker clustering by category
├── mapa.css                   # Map container styling
│
├── MeusRelatos.html           # Citizen's personal report dashboard
├── MeusRelatos.js             # Edit/delete reports, status tracking
├── MeusRelatos.css            # Report card styling
│
├── AdminPage.html             # Municipality management dashboard
├── AdminPage.js               # Report queue management, SLA tracking, response system
├── AdminPage.css              # Admin panel styling, KPI cards
│
├── AdminGraficos.html         # Analytics and reporting dashboard
├── AdminGraficos.js           # Dynamic chart generation, CSV/PNG export
├── AdminGraficos.css          # Chart container styling
│
├── AdmLogin.html              # Restricted login page for municipality employees
├── AdmLogin.js                # Admin authentication and permission verification
├── AdmLogin.css               # Admin login form styling
│
├── firebase.js                # Firebase SDK initialization and exports
├── db.js                      # Database query functions and transactions
├── cloudinary.js              # Image upload handler and URL optimization
├── cidades.js                 # City dropdown population from IBGE data
├── endereco.js                # Address autocomplete with Nominatim debouncing
├── populacao.js               # Population data fetching and caching
├── notificacoes.js            # Email notification templates and sending logic
├── escapeHtml.js              # XSS prevention utility
├── cooldown.js                # Rate limiting for report submissions
├── theme.js                   # Dark/light mode toggle with localStorage persistence
├── navbar.js                  # Shared navigation bar with user profile modal
├── menu.js                    # Mobile hamburger menu handling
│
└── Images/                    # Static assets
    └── LogoProPovo.png
🏗️ Architecture Overview
Data Flow
Report Creation: Citizen fills form → Cloudinary uploads photo → Firebase stores report metadata
Real-Time Updates: Firebase listeners broadcast changes → All connected clients update instantly
Admin Actions: Admin updates status → Email notification sent to citizen via EmailJS
Analytics: Reports are queried, aggregated with IBGE population data → Charts generated
Key Modules
Authentication Module (login.js, navbar.js) - Handles user registration, login, password recovery, and profile management
Report Management Module (home.js, relatos.js, MeusRelatos.js) - Create, read, update, delete operations with real-time sync
Admin Module (AdminPage.js, AdminGraficos.js) - Report queue, SLA tracking, status updates, and analytics
Geolocation Module (endereco.js, mapa.js) - Address search, map visualization, and location-based filtering
Notification Module (notificacoes.js) - Automated email alerts on status changes
🔑 Core Features Explained
Citizen Features

Report Creation

Rich form with address autocomplete powered by Nominatim
Photo upload with client-side validation (format, size)
Automatic categorization (potholes, lighting, garbage, water, green areas, other)
Geolocation capture and storage for map visualization

Voting System

One-time vote per report per user (prevents vote manipulation)
Vote tracking in separate Firebase collection
Decentralized voting - no admin intervention needed

Report Tracking

Personal dashboard showing all submitted reports
Real-time status updates (open → in progress → resolved)
View municipality's official responses
Edit or delete reports only while status is "open"
Municipality Features

Report Management Dashboard

Queue-style interface showing all incoming reports
Advanced filtering by city, status, category
SLA tracking with visual alerts for overdue reports (10+ days without update)
One-click status updates with instant citizen notification

Response System

Add official responses to reports
Responses visible to all citizens (transparent accountability)
Track response timestamps for performance metrics

Analytics Suite

Cities Report: Top cities by reports-per-capita (normalized against IBGE population data)
Neighborhoods Report: Drill-down analysis by neighborhood within selected city
Problem Categories: Pie chart showing distribution of problem types
Resolution Status: Doughnut chart showing open/in-progress/resolved split
Monthly Evolution: Line chart tracking report volume over time
🎯 Key Differentiators

✅ Real-Time Synchronization - All changes propagate instantly across connected users
✅ No Backend Required - Fully serverless using Firebase
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
Photo URL (Cloudinary), status, vote count
Author info, creation date, resolution date
Municipality's official response (if any)

usuarios - Citizen accounts

Name, email, city of residence
Registration date, email verification status

votos - Vote tracking

Maps report ID to user ID (ensures one vote per user)

admins - Municipality employee access control

Simple boolean flag for permission checking

limitesEnvio - Rate limiting cache

Prevents users from submitting multiple reports too quickly
📊 Analytics Capabilities

The platform provides municipalities with actionable intelligence:

Identify problem hotspots by city and neighborhood
Prioritize by urgency using community voting
Trend analysis to spot emerging issues
Performance metrics with SLA tracking
Exportable data for reports and presentations
🎨 Design Philosophy
Clean & Minimal - Reduced cognitive load with clear visual hierarchy
Mobile-First - Optimized for smartphone access (most citizens use phones)
Accessible - WCAG-compliant colors, keyboard navigation, semantic HTML
Fast - Lazy image loading, CSS-only animations, Firebase real-time efficiency
Trustworthy - Transparent responses, visible vote counts, public data
✨ Technology Rationale
Technology	Why Used
Firebase	Serverless (no backend maintenance), real-time updates, built-in auth
Cloudinary	Automatic image optimization, CDN delivery, free tier generous
Nominatim	Free geocoding without API keys, OpenStreetMap community data
IBGE API	Official Brazilian census data, regularly updated population figures
Chart.js	Lightweight, declarative, extensive chart types
Leaflet	Small bundle size, fast rendering, OpenStreetMap integration
📈 Project Impact

This platform demonstrates:

Civic Tech - Technology enabling citizen participation in local governance
Open Data - Using public IBGE data to provide fair comparisons
Transparency - Making municipal processes visible to all citizens
Scalability - Serverless architecture handles growth without infrastructure costs

Pro Povo — Making your city more transparent, one report at a time. 🌍