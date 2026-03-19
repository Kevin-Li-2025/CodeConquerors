# AccessCity

Accessibility-first routing engine for urban navigation. It uses a combination of OSM road graphs, PostGIS spatial data, and real-time hazard reports to calculate paths based on street safety and physical accessibility.

Project Goal: Support **SDG 11 (Sustainable Cities)** by providing safe transport for persons with disabilities (Target 11.2) and improving public safety via community hazard tracking (Target 11.7).

---

## 🏛 Architecture

AccessCity follows a modular monolithic pattern, utilizing a .NET and React Native stack with dedicated spatial infrastructure.

![Architecture Diagram](docs/images/architecture.png)

---

## 📊 Case Study: AccessCity vs. Google Maps

We compared routing results for a standard trip in Birmingham (**New St Station to Bullring Shopping Centre**) where a temporary construction hazard was reported.

| Feature | Google Maps | AccessCity |
| :--- | :--- | :--- |
| **Route Distance** | ~0.4 km | ~4.5 km (Safe Detour) |
| **Obstacle Awareness** | None (Direct path) | Detected "Construction" at Dudley St |
| **Accessibility Profile** | General Pedestrian | Specific (Manual Wheelchair) |
| **Safety Heuristic** | Shortest Time | Weighted Safety & Surface Quality |

**Result**: While Google Maps suggests the shortest path, it leads users directly through unmonitored construction zones. AccessCity identifies the hazard and reroutes the user, prioritizing safety and pavement quality over distance.

---

## 🌍 SDG 11 Alignment

Direct technical implementation of UN targets:
- **Target 11.2 (Safe & Accessible Transport)**: Implementation of profile-specific routing constraints (Manual vs. Electric Wheelchair) to ensure safe navigation for vulnerable populations.
- **Target 11.7 (Inclusive Public Space)**: Real-time hazard reporting and risk-weighted path-finding to mitigate physical and environmental risks in public areas.

---

## 🧪 Testing

- **Unit Tests**: 45+ tests for routing cost-functions, risk math, and DTO validation.
- **Integration Tests**: 40+ tests using `WebApplicationFactory` for auth flows, hazard persistence, and PostGIS performance.
- **Spatial Validation**: Automated verification of profile-based detours (e.g., ensuring wheelchair profiles bypass stairs).

**Commands:**
```bash
dotnet test
```

---

## ⚙️ Setup

### 1. Infrastructure (Docker)
```bash
docker-compose up -d
```

### 2. Backend (Port 5005)
```bash
cd AccessCity.API
dotnet run
```

### 3. Frontend (Web/Expo)
```bash
cd AccessCity.App
npm install
npm run web
```

---

## 🛠 Repository Layout

- `AccessCity.API`: API Layer & Controllers.
- `AccessCity.Domain`: Core Entities & Logic.
- `AccessCity.Infrastructure`: PostGIS Repositories & Clients.
- `AccessCity.App`: Mobile/Web Frontend.
- `AccessCity.Tests`: XUnit Test Suite.
