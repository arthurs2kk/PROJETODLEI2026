READEME - Pro Povo

A citizen platform that connects your city's problems to the municipality

Abrangência temporária dos novos relatos

Novos relatos estão limitados a **Campina Grande/PB** (IBGE `2504009`).
A busca manual e o GPS filtram o município identificado pelo Nominatim; o
cliente confere o município antes de enviar fotos, e as regras do Firebase
recusam a criação com outro `cityId` ou nome de cidade. Cadastros continuam
aceitando moradores de outras cidades: a restrição é ao local do problema.
Relatos existentes de outros municípios continuam disponíveis para consulta,
edição, votos e gestão. A API de imagens/exclusão não cria relatos e mantém
compatibilidade com esses registros, assim como os filtros e o mapa.

Para **desfazer a restrição** e voltar a aceitar municípios da Paraíba:

```sh
npm run abrangencia:relatos -- paraiba
```

Para reativar apenas Campina Grande:

```sh
npm run abrangencia:relatos -- campina-grande
```

No PowerShell com scripts bloqueados, use `npm.cmd` no lugar de `npm`.
O comando sincroniza `js/abrangencia-relatos.js` e `database.rules.json`;
não edite apenas um deles. Após qualquer mudança, rode `npm test`, os testes
de regras com o emulador e publique **o site e as regras**. As alterações locais
só protegem o banco em produção depois de publicar `database.rules.json`:

```sh
npx firebase-tools deploy --only database --project pro--povo
```

Essa validação usa o código/nome do município declarado e a identificação do
Nominatim, mantendo a checagem de coordenadas da Paraíba já existente. Não
comprova a correspondência exata entre as coordenadas e a malha municipal
contra um cliente que falsifique código, nome e localização; essa garantia
exige validação geográfica confiável no servidor.

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
✅ Email Notifications: Status changes and official responses notify the report author through EmailJS
✅ Responsive Design: Seamless experience on desktop, tablet, and mobile devices
✅ Dark Mode: User-friendly theme toggle for comfortable viewing
✅ User Authentication: Secure login system with email verification

🛠️ Technology Stack

Report loading without Cloud Functions

The static frontend never reads the complete report collection to build public screens. Home and the public list query `relatosResumo`; the details modal reads `relatosPublicos/{id}`. Public projections exclude the author's UID, name and internal image metadata. The private `relatos/{id}` record is readable only by its author and by administrators within their authorized scope. The home reuses its limited 20-report feed for visible counters, the public list loads 25 reports at a time with indexed server-side city/category/status filters, the management panel loads 25 at a time, city selectors use the official IBGE municipality list, and the map queries `relatosMapa/{cityId}` ordered by `dataCriacao` with a 500-record cap. This map projection contains only the title, category, address, city ID, status, vote count, creation timestamp and available coordinates. Administrative charts intentionally traverse the authorized scope in bounded batches because they require complete aggregates.

Because Realtime Database has no browser-side aggregate query such as `COUNT()`, the numbers shown on the home describe the currently loaded batch rather than a global total. Exact global counters would require a trusted backend or a separate manually maintained data source.

Vercel Web Analytics

All HTML pages load `js/vercel-analytics.js`, which asks the visitor to choose before injecting the official `/_vercel/insights/script.js`. Choosing **Somente essenciais** keeps Analytics disabled; choosing **Permitir estatísticas**, or expressly authorizing statistics in the account-creation checkbox, loads it and stores that preference locally. The fixed **Privacidade** button reopens the choice and allows revocation. This project does not use Next.js or a bundler, so `@vercel/analytics/next` and an npm analytics dependency are unnecessary.

To activate collection:

1. Open the project in Vercel, go to **Analytics**, and click **Enable** if it is not already enabled.
2. Deploy the updated site to Vercel.
3. Visit the deployed site, choose **Permitir estatísticas**, navigate between pages, and then check the Analytics dashboard. Browser Network tools should only show the insights script and requests to `/_vercel/insights/view` after that choice.

The analytics endpoint is provided by Vercel after activation and deployment; it is not served by a local static server. Include the shared `vercel-analytics.js` helper in any new HTML pages.

Documentation: https://vercel.com/docs/analytics/quickstart

Frontend Architecture
HTML5 - Semantic markup and accessibility
CSS3 - Custom styling with CSS variables for theming and dark mode support
JavaScript (ES6+) - Modular code with ES6 imports/exports for clean architecture

UI Components & Visualization
Tabler Icons - Minimalist icon library for consistent visual design
Leaflet - Lightweight open-source library for interactive mapping
Chart.js - Powerful charting library for generating analytics graphics (bar, pie, line, doughnut charts)

Progressive Web App (PWA)

O Pro Povo pode ser instalado pelo navegador no Android, desktop e iOS. O
manifesto fica em `manifest.webmanifest`, o registro e a interface de instalação
em `js/pwa.js`, e o service worker na raiz em `sw.js` para controlar todo o site.
As chamadas `/api`, os endpoints da Vercel e recursos externos não entram no
cache. Quando uma navegação não pode ser atendida pela rede nem pelo cache, o
aplicativo mostra `offline.html` em vez de simular dados atualizados.

Ao alterar arquivos pré-carregados ou a estratégia de cache, incremente
`CACHE_VERSION` em `sw.js`. Para testar localmente, use um servidor HTTP em
`localhost` (abrir os arquivos diretamente com `file://` não registra service
workers). Em produção, mantenha HTTPS; a Vercel já oferece esse requisito.

No Android/Chrome, a opção de instalação aparece quando o navegador conclui os
critérios de instalação. No Safari do iPhone/iPad, use **Compartilhar > Adicionar
à Tela de Início**. O botão exibido pelo site explica esse caminho no iOS.

Backend & Data Management
Firebase Authentication - Secure user login with email/password and Google OAuth
Firebase Realtime Database - Real-time NoSQL database for instant data synchronization across users, with security rules enforcing per-city write permissions for admins
Firebase Realtime Database Rules - Server-side authorization, field validation, anti-spam checks, and atomic vote consistency
Cloudinary - Cloud-based image service for uploading, storing, and optimizing user photos
EmailJS - Browser-based transactional email delivery for status and official-response notifications

EmailJS notification setup

The admin panel sends an email only after Realtime Database confirms the status
change or official response. Create a free account at https://www.emailjs.com/ and:

1. Connect an email provider under **Email Services**.
2. Create one template under **Email Templates**.
3. Set **To Email** to `{{to_email}}`.
4. Use these variables in the subject/body as desired: `{{to_name}}`,
   `{{relato_titulo}}`, `{{status_label}}`, `{{mensagem}}` and `{{relato_url}}`.
5. Copy the Public Key, Service ID and Template ID into the three constants at
   the top of `js/notificacoes.js`.

The Public Key is intended for browser use. Never put an EmailJS Private Key,
an email password or SMTP credentials in the repository. The free plan has a
monthly request limit, so the admin panel reports email failures without undoing
the already-confirmed report update.

Cloudinary image lifecycle

Image uploads currently use the original direct browser flow with the
`ProPovo` unsigned upload preset. The browser sends the file straight to
Cloudinary with a report-specific `public_id` that does not contain the user UID, then stores the returned HTTPS URL
and `fotoPublicId` in Realtime Database. The API secret is never exposed to the
browser.

Deleting a report calls the authenticated `/api/relatos` Vercel Function. It
checks the Firebase ID token and report ownership or administrator scope, removes
the Cloudinary asset with the server-only API secret, and then removes the report,
votes and private contact. A failed database creation is compensated immediately
through the authenticated API, which removes the pending asset with the server-only
Cloudinary credentials.

Vercel environment variables for image deletion

Para testar a exclusão localmente, use `npm run dev:vercel` (ou
`npm.cmd run dev:vercel` no PowerShell) e abra o endereço informado pelo comando.
Na primeira execução, autentique-se na Vercel e vincule ao projeto existente.
O Live Server na porta 5500 serve apenas arquivos estáticos e retorna 405 para
`POST /api/relatos`; ele não executa as funções da pasta `api`.
Configure as variáveis abaixo também no ambiente **Development** da Vercel,
que o `vercel dev` carrega automaticamente. A exclusão usa os serviços definidos
nessas variáveis: se apontarem para produção, ela remove dados reais.
O script de Analytics fica desativado em localhost para evitar o 404 local.

The browser does not need these variables for unsigned upload. The Vercel Function
needs them to authenticate requests and delete images:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`
- `FIREBASE_DATABASE_URL`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`
- `CLOUDINARY_UPLOAD_PRESET`

Create the Firebase credentials in **Firebase Console > Project Settings > Service
Accounts > Generate new private key**. Copy `client_email`, `private_key` and
`project_id` from that JSON into Vercel; never commit the downloaded JSON. The
Cloudinary key and secret are available under **Cloudinary Console > Settings >
API Keys**.

Existing reports need the four derived filter keys before deploying the frontend
that queries combined filters. With the same Firebase Admin environment variables,
first inspect the migration without writing anything:

`npm run migrate:relato-filtros`

After creating a Realtime Database backup and checking the reported counts, apply
the additive migration with:

`npm run migrate:relato-filtros -- --apply`

The script never changes report content or IDs; it only creates or repairs the
derived filter-key fields in batches of 200 reports.

After the filter keys exist, inspect and then create the lightweight public
records used by home and the public report list:

`npm run migrate:relatos-resumo`

`npm run migrate:relatos-resumo -- --apply`

The first command is a dry run. The second writes `relatosResumo` in batches of
200 without removing or changing the complete records in `relatos`.

Before deploying the rules that make complete reports private, prepare the public
detail records for existing reports:

`npm run migrate:relatos-publicos`

`npm run migrate:relatos-publicos -- --apply`

The first command only reports the number of pending records. Run the second only
after a Realtime Database backup. It copies displayed fields to `relatosPublicos`
without copying `autorId`, `autorNome` or `fotoPublicId`.

Old Cloudinary paths contain the author's UID. Inspect and then migrate them with:

`npm run migrate:fotos-sem-uid`

`npm run migrate:fotos-sem-uid -- --apply`

The apply command also requires `CLOUDINARY_API_KEY` and
`CLOUDINARY_API_SECRET`. It renames the image assets and updates their stored URLs.

Map index migration

For the map rollout, inspect the new projection without changing production data:

`npm run migrate:relatos-mapa`

`npm run migrate:relatos-mapa -- --dry-run`

Both commands only read `relatos` and `relatosMapa`. Authentication uses the same
Firebase Admin environment variables as the other migrations, or Application
Default Credentials (for example, an existing `GOOGLE_APPLICATION_CREDENTIALS`
path loaded directly by the SDK). Keep credential files outside the repository;
the script never prints credentials, report IDs, addresses or individual records.
`FIREBASE_PROJECT_ID` and `FIREBASE_DATABASE_URL` select the target; defaults are
the existing `pro--povo` project and its default Realtime Database.

The report shows counts for new, outdated, synchronized and invalid records,
missing coordinates, and orphaned index entries. Invalid records and orphaned
entries require review and prevent applying the migration; exit code 2 from a
dry run means review is needed. Values are not coerced or silently filled in.
Legacy numeric city IDs retain their original type in the projection, and absent
coordinates remain absent. Records without both coordinates cannot render a map
marker. The migration does not change `relatos`, `relatosResumo` or any contact
data, and does not delete orphaned entries automatically.

For an installation whose filter keys and public summaries are already populated,
use this rollout sequence without rerunning their migrations:

1. Inspect the map dry run and resolve invalid source records or orphaned entries
   through a separate reviewed repair, if any. Retest the dry run.
2. Schedule a maintenance window, pause report submissions, edits, votes, status
   changes and deletions, and take a Realtime Database backup. A UI banner alone
   cannot stop old tabs; enforce the pause at the write boundary and the deletion
   API while deploying.
3. Only after the dry run is reviewed and production application is authorized,
   run `npm run migrate:relatos-mapa -- --apply`.
4. Repeat the dry run. Expect zero creates, updates, invalid records and orphans.
   Resolve reported concurrency conflicts before continuing.
5. Deploy the rules, deletion API and frontend that maintain the map index
   together, while writes remain paused. The new rules require atomic source and
   map updates; old clients cannot make writes that leave the index stale.
6. Verify creating, editing, voting, changing status and deleting a report, then
   restore normal writes. Verify the selected city's map loads from
   `relatosMapa/{cityId}` and fetching details uses `relatosPublicos/{id}`.

`--apply` is idempotent and handles at most 200 pending projections per batch.
Each batch uses a transaction at the database root so its comparison of the
source and existing index is atomic. It reads and transmits the root tree, while
changing only the selected `relatosMapa` entries; unchanged branches are
preserved. This is an exceptional migration for a small database, not an ongoing
sync mechanism. Root transactions have database-wide bandwidth, size and
contention costs. Review that cost before applying to a large database. Any
concurrent source or index change causes that entry to be skipped instead of
overwriting a fresh vote/edit or recreating an already deleted report. A fresh
dry run is required after such conflicts. The dry-run path never performs root
reads or transactions.

Presentation demo data

The demo seed prepares 120 fictional reports spread across Campina Grande. Run
the command without `--apply` first to validate the options without changing the
database:

`npm run seed:demo`

To write the reports, pass a Firebase service-account file kept outside this
repository:

`npm run seed:demo -- --apply --credentials "C:\path\serviceAccount.json"`

Every generated ID starts with `teste-mapa-calor-`, and every description ends
with a discreet fictional-scenario notice. To remove only the 120 demo reports
and all their public projections, votes and municipal priorities, run:

`npm run seed:demo -- --remove --apply --credentials "C:\path\serviceAccount.json"`

If a different amount was created with `--count`, repeat the same value when
removing it. The seed never modifies reports whose IDs do not use its prefix.

Deployment order:

1. In Cloudinary, keep `ProPovo` set to **Unsigned** and restrict its
   accepted formats and maximum file size.
2. During the data-index rollout, briefly pause report submissions, votes and
   administrative changes, then back up the Realtime Database.
3. For initial setup, run the filter-key migration, the public-summary migration
   and then the map-index migration described above. Review every dry run before
   applying. For an existing installation adding only the map index, follow the
   map rollout sequence instead.
4. Deploy the Realtime Database rules that keep complete reports private and
   require every public detail, summary and map index to stay synchronized:
   `npx firebase-tools deploy --only database --project pro--povo` (run
   `npx firebase-tools login` first if necessary).
5. Configure the EmailJS service, template and three public identifiers described
   above.
6. Deploy the repository to Vercel and resume submissions.
7. Test creating and deleting one report with an image, then change its status
   and save an official response to verify both emails.

Image upload works from a plain static server. Image deletion requires either the
deployed Vercel site or a local Vercel development server because it calls
`/api/relatos`.

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
├── api/relatos.js                 # Authenticated Vercel Function for image lifecycle
├── database.rules.json            # Realtime Database authorization and validation rules
├── firebase.json                  # Firebase project configuration
├── .env.example                   # Environment-variable names without real secrets
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
│   ├── endereco.js                # Manual/GPS address lookup with Paraíba validation
│   ├── populacao.js               # Population data fetching, caching, and name normalization
│   ├── notificacoes.js            # Active EmailJS status/response notifications
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
Report Creation: Citizen fills form → Cloudinary uploads photo → client atomically writes report + private contact + cooldown → Realtime Database Rules validate identity, verified email, fields, timestamp and rate limit before Firebase commits the write
Real-Time Updates: Firebase listeners broadcast changes → All connected clients update instantly
Admin Access Resolution: On login, adminAuth.js reads the admin's role and cityId once, and every subsequent panel query/action is scoped accordingly
Admin Actions: Admin updates status or response → Realtime Database rules confirm that the admin's city matches the report's city (or that they are a superadmin) → citizen interface updates in real time → the panel reads only that report's protected contact and asks EmailJS to notify the author
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
Manual address search or user-triggered current-location lookup powered by Nominatim
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
✅ Rules-First Security Boundary - Realtime Database Rules protect application data; Cloudinary uses a restricted unsigned preset with report-scoped public IDs and server-side deletion
✅ City-Isolated Admin Access - Realtime Database security rules, not just the UI, enforce that a municipality's staff can only act on their own city's reports
✅ Population-Normalized Analytics - Compares cities fairly by report density, not absolute count
✅ XSS Protection - All user input sanitized to prevent malicious code injection
✅ Rate Limiting - Citizens must wait between report submissions (prevents spam)
✅ Responsive & Accessible - Works on all devices with keyboard navigation support
✅ Dark Mode - Reduces eye strain with persistent theme preference
✅ Email Notifications - Sent from the authenticated admin workflow through EmailJS, with protected per-report contact data

🔄 Data Model

Core Collections

relatos - Individual problem reports
Title, category, description, location (address + coordinates)
City name and cityId (IBGE municipality code), and neighborhood — used both for public filtering and for scoping admin access
Photo URL (Cloudinary), status, vote count
Author info, creation date, resolution date
Municipality's official response (if any)

relatosResumo - Lightweight public listing records
Title, category, a description preview of at most 240 characters, address and optional photo URL
City/filter keys, status, votes and creation date
Kept synchronized atomically with report creation, editing, voting, status changes and deletion

relatosPublicos - Public detail records
Displayed report fields, coordinates, status, votes and official response
Never contains `autorId`, `autorNome`, `fotoPublicId`, email or other private identifiers

usuarios - Citizen accounts
Name, email, city of residence
Registration date, email verification status

contatosRelatos - Private notification contacts
Maps a report ID to its verified author email, name and cityId. It is not publicly readable; only the author, the responsible city's admin and superadmins can read the matching entry

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
Nominatim | Manual address search and user-triggered reverse geocoding, restricted to validated Paraíba municipalities
IBGE API | Official Brazilian census data, regularly updated population figures, and stable municipality codes used as the cityId for admin scoping
Chart.js | Lightweight, declarative, extensive chart types
Leaflet | Small bundle size, fast rendering, OpenStreetMap integration

🔐 Security Architecture

The application does not require a dedicated server for its current user flow.
Firebase Authentication and Realtime Database Security Rules enforce ordinary
authorization, data validation, report-submission intervals, vote consistency
and municipal access boundaries.

Technical considerations of this design:

- Home counters describe only its limited feed, and city selectors use the IBGE municipality list; browsers do not read all reports to calculate either one.
- Cloudinary accepts direct browser uploads through the unsigned `ProPovo` preset with user/report-scoped public IDs. Restrict formats and file size in Cloudinary; authenticated deletion always runs through the server-side API.
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

### Mapa de gestão e prioridades municipais

O painel administrativo (`AdminPage.html`) possui abas de relatos, mapa e
prioridades. O mapa oferece visualizações por categoria, situação, apoio da
população (tamanho dos círculos) e concentração de registros em células fixas
de aproximadamente 300 m. Concentração representa quantidade de relatos,
sem inferir gravidade nem população afetada. Busca, cidade (superadmin), bairro,
categoria, situação e período são combinados nas três abas.

A lista de relatos mantém a paginação de 25 registros. Ao abrir o mapa ou as
prioridades, todos os lotes do escopo autorizado são consultados antes de exibir
essas visões, incluindo prioridades antigas. Os indicadores representam os
relatos consultados, independentemente dos filtros. Use **Atualizar** para
buscar mudanças feitas em outros acessos.

Existe uma lista de prioridades compartilhada por município em
`prioridadesMunicipais/{cityId}/{relatoId}`. Cada entrada guarda apenas ordem,
autor e data da inclusão; não duplica os dados públicos do relato. É possível
adicionar/remover pela lista ou por um ponto no mapa e reordenar com setas na
aba Prioridades, sem filtros ativos. Superadmins selecionam um município para
reordenar. A seleção não muda status nem votos e fica restrita aos admins
ativos do município e superadmins, inclusive quando consultada fora da interface.
Alterações nas prioridades são sincronizadas entre os acessos. Exclusões pela
API removem também a entrada correspondente na lista.

O mapa público mantém os pontos por categoria, endereço e situação. Quando há
apenas uma cidade ativa, ela é carregada automaticamente. Não apresenta as
prioridades internas nem as ferramentas administrativas.

Para disponibilizar esta versão, publique **o site, a função de exclusão e as
regras do Realtime Database**. Sem as regras atualizadas, a lista de prioridades
não estará disponível; a interface apresenta um aviso. Não há migração de dados
para criar a primeira lista. Validação: `npm test` e `npm run test:rules` com o
emulador configurado em `127.0.0.1:9012`.

### Refinamento de usabilidade do painel

A análise crítica, as justificativas das melhorias e as
instruções dos testes isolados de interface estão em
[docs/analise-ui-prefeitura.md](docs/analise-ui-prefeitura.md).

### Compatibilidade dos relatos públicos antigos

A listagem pública reconhece `cityId` em texto e em número nos registros
legados. Ao filtrar somente por cidade, combina duas consultas indexadas e
limitadas antes de ordenar e paginar. Os filtros compostos continuam usando
seus índices de texto. O cache da primeira página tem uma nova versão para
descartar resultados antigos incompletos imediatamente.

Essa correção não exige migração nem alteração das regras do banco. A leitura
continua restrita aos resumos públicos e mantém os tipos originais armazenados.
Os testes cobrem a correspondência com o mapa, a paginação sem duplicações,
o isolamento por cidade, os filtros compostos, o cache e falhas de consulta.

### Compatibilidade das APIs com o runtime da Vercel

O `firebase-admin@14.5.0` depende de `jwks-rsa@4.1.0`, que tenta carregar
`jose@6` (ESM) com `require()`. Em runtimes que desabilitam esse carregamento
síncrono, as APIs encerram com `ERR_REQUIRE_ESM` antes de executar o handler.
O problema está registrado em https://github.com/auth0/node-jwks-rsa/issues/507.

O `postinstall` executa `scripts/compat-jwks-rsa.cjs`: aplica uma correção
restrita ao carregamento de `jose` com `import()` nas duas entradas afetadas.
As versões e a lógica de verificação criptográfica são preservadas. O script
confere a versão e o código esperado e interrompe a instalação caso mudem;
ao atualizar `jwks-rsa`, revise e remova o patch quando a correção oficial existir.
Não desative scripts de instalação no deploy.

`npm run test:runtime` reproduz a restrição do runtime e verifica a inicialização
das duas APIs, a resolução de chaves e a rejeição de assinaturas falsas, sem
rede nem credenciais. Esse teste também faz parte de `npm test`.
