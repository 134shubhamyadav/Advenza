<!-- ================================================================= -->
<!--               🌍 ✈️ ADVENZA (TRAVEL INTELLIGENCE) 🚆 🚗            -->
<!--       Autonomous Multi-Agent AI Travel Intelligence Platform       -->
<!-- ================================================================= -->

<div align="center">

  <br />

  <p align="center">
    <a href="#">
      <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,14,24&height=220&section=header&text=ADVENZA&fontSize=70&fontColor=ffffff&fontAlignY=40&desc=Autonomous%20AI%20Travel%20Intelligence%20%7C%20Multi-Modal%20Transit%20%7C%20OSRM%20Roads&descAlignY=62&descSize=18&descAlign=50" alt="Advenza Animated Header" width="100%" />
    </a>
  </p>

  <p align="center">
    <a href="https://github.com/134shubhamyadav/Advenza">
      <img src="https://readme-typing-svg.demolab.com?font=Plus+Jakarta+Sans&weight=800&size=24&duration=2400&pause=1100&color=38BDF8&center=true&vCenter=true&multiline=false&width=800&height=50&lines=✈️+Autonomous+Multi-Agent+AI+Travel+Intelligence;🚆+Grounded+Indian+Railways+Timetables+%26+Fares;🚗+Project-OSRM+Road+Distances%2C+Tolls+%26+Fuel+Mathematics;🏨+Zero-Cost+Own-Home+Lodging+Constraints;💰+Deterministic+Budgeting+with+Zero+LLM+Arithmetic+Drift;🗺️+Dynamic+Destination+Grounding+Across+Global+Regions" alt="Advenza Animated Travel Intelligence Tagline" />
    </a>
  </p>

  <p align="center">
    <strong>Advenza is an autonomous, full-stack AI travel planning and destination intelligence platform.</strong><br />
    Synthesizing multi-modal transit corridors, OpenStreetMap physical grounding, and deterministic budget mathematics into truth-certified, day-wise itineraries.
  </p>

  <p align="center">
    <img src="https://img.shields.io/badge/Release-V1%20Launch%20Ready-emerald?style=for-the-badge&logo=rocket" alt="V1 Launch Ready" />
    <img src="https://img.shields.io/badge/Architecture-Multi--Agent%20Autonomous%20Network-blue?style=for-the-badge&logo=deepnote" alt="Multi-Agent Network" />
    <img src="https://img.shields.io/badge/Frontend-TanStack%20Start%20%2B%20React%2019-61DAFB?style=for-the-badge&logo=react" alt="React 19 Frontend" />
    <img src="https://img.shields.io/badge/Backend-Node.js%20%2B%20Express%20%2B%20MongoDB-339933?style=for-the-badge&logo=nodedotjs" alt="Node.js Backend" />
  </p>

</div>

---

## 🏛️ Local Project Architecture & Directory Structure

Advenza is built with a strictly decoupled **Full-Stack Monorepo Architecture** separating the React 19 SSR frontend from the Express/MongoDB/AI backend services:

```
Advenza/
├── backend/                               # Express + MongoDB + AI Orchestration Server
│   ├── config/                            # Environment configuration (env.js)
│   ├── controllers/                       # REST API controllers
│   │   ├── ai.controller.js               # Multi-agent AI generation & chat
│   │   ├── budget.controller.js           # Expense math & settlement engine
│   │   ├── invitation.controller.js       # Group invite & collaboration logic
│   │   ├── mail.controller.js             # Brevo email delivery service
│   │   ├── travel.controller.js           # Station lookup & transport queries
│   │   ├── trip.controller.js             # Trip CRUD & day schedule management
│   │   └── user.controller.js             # User profile & preferences
│   ├── data/                              # Local dataset assets
│   │   ├── airports/                      # Operational Indian airports database
│   │   └── railways/                      # Indian Railways database components
│   ├── middleware/                        # Express middleware (auth, rateLimiters, errorHandler)
│   ├── models/                            # Mongoose schemas (User, Trip, Expense, Invitation, Conversation)
│   ├── routes/                            # Modular Express router endpoints
│   ├── schemas/                           # Zod validation schemas for requests
│   ├── services/                          # Core domain services
│   │   ├── ai/                            # 8-Agent Autonomous Research Orchestrator
│   │   │   ├── orchestrator/              # Destination, Transport, Verification & Judge agents
│   │   │   └── providers/                 # Groq, NVIDIA NIM, OpenAI & Gemini adapters
│   │   ├── travel/                        # Transport Research, Airport lookup, OSRM road engine
│   │   └── places/                        # OpenStreetMap Nominatim spatial disambiguation
│   ├── utils/                             # Loggers, math helpers, and API clients
│   └── server.js                          # Express application entry point
│
├── frontend/                              # TanStack Start + React 19 Frontend
│   ├── public/                            # Static assets, logos, infographics
│   ├── src/
│   │   ├── components/                    # Reusable React UI components
│   │   │   ├── app-shell.tsx              # Main navigation shell & layout
│   │   │   ├── brand-logo.tsx             # Advenza dynamic branding
│   │   │   ├── require-auth.tsx           # Route protection guard
│   │   │   ├── budget/                    # Budget estimate cards & expense trackers
│   │   │   ├── travel/                    # Travel loaders & station selectors
│   │   │   │   ├── trip-generation-loader.tsx # 5-stage milestone generation loader
│   │   │   │   └── transit-scenes/        # Animated vector transit progress simulations
│   │   │   │       ├── FlightProgressBar.tsx    # 12-Stage continuous flight simulation
│   │   │   │       ├── VandeBharatProgressBar.tsx # Vande Bharat EMU train with OHE catenary
│   │   │   │       ├── BusProgressBar.tsx       # Volvo 9600 multi-axle sleeper bus
│   │   │   │       ├── HighwayProgressBar.tsx   # Grand Tourer SUV highway drive
│   │   │   │       ├── FerryProgressBar.tsx     # Coastal catamaran ferry with waves & wake
│   │   │   │       ├── ModeSceneRenderer.tsx    # Dynamic mode scene router
│   │   │   │       └── index.ts                 # Clean barrel export
│   │   │   └── ui/                        # Accessible UI primitives (Radix UI)
│   │   ├── context/                       # Authentication context (Firebase / JWT)
│   │   ├── lib/                           # Utility functions, API fetchers & query keys
│   │   ├── routes/                        # TanStack Router file-based route definitions
│   │   │   ├── index.tsx                  # Premium landing page
│   │   │   ├── dashboard.tsx              # User dashboard & trip portfolio
│   │   │   ├── trips.new.tsx              # 6-Step interactive trip creation wizard
│   │   │   ├── trips.$tripId.tsx          # Comprehensive itinerary timeline & details
│   │   │   ├── budget.tsx                 # Real-time expense tracker & split manager
│   │   │   ├── risk.tsx                   # AI Risk & Weather Radar
│   │   │   ├── simulator.tsx              # Plan B & What-If scenario generator
│   │   │   ├── chat.tsx                   # Conversational AI travel copilot
│   │   │   ├── pricing.tsx                # Humor-infused early beta subscription page
│   │   │   ├── login.tsx & signup.tsx     # Auth views
│   │   │   └── packing.tsx                # Context-aware smart packing checklist
│   │   └── router.tsx                     # TanStack router configuration
│   └── package.json
│
└── package.json                           # Root workspace orchestrator
```

---

## 🧭 Product Definition & Capabilities

Advenza is an **autonomous AI-powered travel planning and destination intelligence operating system**. It automates end-to-end trip research, chronological day-wise scheduling, multi-modal transport cost calculation, and deterministic budget math.

### What Advenza Delivers:
1. **6-Step Trip Decision Wizard:** Destination disambiguation, duration insights, dates, budget tier, travel pace, and review.
2. **Autonomous Multi-Agent Network:** 8 decoupled AI research agents that eliminate hallucination by cross-verifying geographical landmarks, transit corridors, and lodging limits.
3. **Multi-Modal Transit Simulations:** 5 continuous GPU-accelerated vector progress scenes representing Flight, Vande Bharat train, Volvo bus, Highway car drive, and Coastal ferry.
4. **Authoritative Indian Railways Integration:** Official telescopic fare tables and gateway station resolution.
5. **Highway Geometry & Fuel Physics:** Live Project-OSRM road network routing, FASTag toll calculations, and fuel consumption math.
6. **Deterministic ₹0-Drift Budgeting:** Absolute mathematical summation enforcing strict **₹0 lodging** for own-home/relative stays.
7. **Free Early Beta Model:** Unlimited access to all research agents and simulations with no paywalls or credit cards required.

---

## 🌟 Core Pillars of Advenza

### 1. 🤖 8-Agent Autonomous AI Research Network
Rather than relying on a single monolithic prompt that invents fake attractions and routes, Advenza runs a coordinated multi-agent orchestration pipeline:
1. **Destination Research Agent:** Discovers genuine geographical landmarks, cultural heritage sites, and dining specialties via OpenStreetMap spatial anchors.
2. **Transportation Research Agent:** Evaluates multi-modal corridors (Trains, Flights, Buses, Road Trips), resolves major transit hubs, and estimates journey durations and fares.
3. **Accommodation Intelligence Agent:** Analyzes lodging by star rating, calculates multi-occupancy room sharing, and enforces strict **₹0 lodging** for own-home stays.
4. **Budget Intelligence Engine:** Replaces AI arithmetic with deterministic Node.js mathematical summation, flagging shortfalls or surpluses against user ceilings.
5. **Safety, Risk & Weather Agent:** Evaluates neighborhood security ratings, monsoon/cyclone advisories, and emergency dispatch numbers.
6. **Verification Agent:** Quantitative 6-factor auditor testing spatial consistency, distance feasibility, and deduplication.
7. **Final AI Judge Agent:** Evidence-based adjudication synthesizing the final dossier based on physical coordinates and timetable truth.
8. **Master Mission Orchestrator:** Manages bounded asynchronous promises, streaming progress telemetry directly to the frontend.

### 2. 🚆 5 Mode-Specific Animated Transit Simulations
During trip synthesis, the frontend plays high-fidelity, mode-specific vector progress animations:
* **✈️ Flight (`FlightProgressBar`):** Full 12-stage commercial airliner simulation (Gate 12A $\to$ Taxi $\to$ $V_r$ Takeoff Rotation on main wheels $\to$ Liftoff $\to$ Gear Retraction $\to$ FL360 Cruise above cloud sea $\to$ Golden Sunset Descent $\to$ PAPI/ALS Approach $\to$ Touchdown on 27R $\to$ Night Gate Arrival).
* **🚆 Train (`VandeBharatProgressBar`):** Aerodynamic Vande Bharat Express with high-speed track sleepers, 25kV OHE catenary overhead masts, pantograph electrical sparks, and dual-aspect signal gantries.
* **🚌 Bus (`BusProgressBar`):** Volvo 9600 multi-axle sleeper coach with panoramic windows, spinning alloy wheels, highway lane markings, roadside streetlamps, and green highway boards.
* **🚗 Car (`HighwayProgressBar`):** Modern SUV / Grand Tourer cruising along winding mountain and coastal highways with guardrails and pine trees.
* **⛴️ Ferry (`FerryProgressBar`):** Multi-deck coastal catamaran cruise with continuous mathematical sine-wave ocean wakes, churning foam, sweeping lighthouse beacon, and seagulls.

### 3. 💵 Deterministic Budget Intelligence
* **Zero LLM Arithmetic Drift:** AI models are strictly prohibited from calculating final costs.
* **Exact Mathematical Formula:**
  $$\text{Total Cost} = \text{Transport} + \text{Transfers} + \text{Lodging} + (\text{Food} \times \text{Days} \times \text{Travelers}) + \text{Activities} + 7\% \text{ Contingency Buffer}$$
* **Zero-Cost Lodging Constraint:** Staying at one's own home, native residence, or with relatives deterministically charges ₹0 for lodging, reserving the traveler's budget for transit, food, and activities.

---

## ⚡ Multi-LLM Resilience & Provider Failover

Advenza includes a resilient AI routing system with automatic multi-tier fallback across major inference providers:

```
[Tier 1: Groq (Llama-3.3-70b / Qwen-2.5-32b)]
       │
       ▼ (Fallback on Rate Limit / 429)
[Tier 2: NVIDIA NIM (Llama-3.1-70b-instruct / Nemotron)]
       │
       ▼ (Fallback on 5xx / Timeout)
[Tier 3: OpenAI (GPT-4o-mini / GPT-4o)]
       │
       ▼ (Fallback on Outage)
[Tier 4: Gemini API (Gemini-2.0-Flash / Gemini-1.5-Pro)]
       │
       ▼ (Fallback on Exhaustion)
[Tier 5: Together AI / OpenRouter / Mistral / Cerebras]
```

---

## 🚀 Quickstart & Installation

### Prerequisites
* **Node.js:** v20.x or higher (v24.x recommended)
* **npm:** v10.x or higher
* **MongoDB:** Local instance or free MongoDB Atlas cluster

### 1. Clone & Install
```bash
git clone https://github.com/134shubhamyadav/Advenza.git
cd Advenza

# Install root, backend, and frontend packages
npm install
npm install --prefix backend
npm install --prefix frontend
```

### 2. Configure Environment Variables
```bash
cp backend/.env.example backend/.env
# Edit backend/.env and provide MONGODB_URI and GROQ_API_KEY (or other LLM key)
```

### 3. Launch Development Environment
```bash
# Starts both frontend (http://localhost:3000) and backend (http://localhost:5000)
npm run dev
```

### 4. Build for Production
```bash
# Type check and build client and SSR bundles
npm run build:frontend
```

---

<div align="center">

  <br />

  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,14,24&height=120&section=footer" alt="Advenza Animated Footer" width="100%" />

  <br />

  <sub>Crafted with passion for authentic, truthful, and high-velocity travel intelligence.</sub><br />
  <sub>Distributed under the MIT License • Advenza Engineering Team</sub>

</div>
