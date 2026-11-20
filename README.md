# CircularSeed FLEXISHRED-DC • Machine Monitoring Platform

[![Live Demo](https://img.shields.io/badge/Live_Dashboard-GitHub_Pages-00A5D6?style=for-the-badge&logo=github)](https://haridh432.github.io/CS-Dashboard/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth_%26_RTDB-FFA000?style=for-the-badge&logo=firebase)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-Proprietary-slate?style=for-the-badge)](#)

Industrial-grade, role-based real-time machine monitoring and fleet operations platform for **CircularSeed FLEXISHRED-DC Plastic Shredders**.

The platform provides live telemetry streaming, safety interlock monitoring, operational status, and role-scoped dashboards (CEO, Operator, Customer) powered by **Firebase Authentication** and **Firebase Realtime Database**, with optional Node.js Express/WebSocket edge gateway connectivity for direct ESP32 hardware bridges.

---

## 1. System Architecture

```
+───────────────────────────────────────────────────────────────────────────────────────────+
|                               FLEXISHRED-DC MACHINE FLEET                                 |
|                                                                                           |
|  [CS001: Live Production Shredder]       [CS-FS-0002: 48V Std Dual BLDC]                  |
|  [CS-FS-0003: 12V L298N Prototype]       [CS-FS-0004: 48V Pro Solar Intake]               |
+─────────────────────────────────────────────┬─────────────────────────────────────────────+
                                              │ Live Sensor Telemetry (WiFi / UART)
                                              ▼
+───────────────────────────────────────────────────────────────────────────────────────────+
|                                  FIREBASE REALTIME CLOUD                                  |
|                                                                                           |
|  • Project ID: circularseed-d0ced                                                         |
|  • Firebase Authentication: Modular SDK v11 (Email/Password, Token Lifecycle)             |
|  • Firebase Realtime Database: asia-southeast1                                           |
|    - `machines/CS001`: Live telemetry streaming (Voltage, Current, Power, RPM, Temp, etc)  |
|    - `users/{uid}`: Authoritative user profiles, assigned roles, and organizations        |
+─────────────────────────────────────────────┬─────────────────────────────────────────────+
                                              │ Realtime Synchronization
                                              ▼
+───────────────────────────────────────────────────────────────────────────────────────────+
|                             ROLE-BASED WEB APPLICATION (SPA)                              |
|                          (GitHub Pages or Local Node.js Gateway)                          |
|                                                                                           |
|  [Authentication & Onboarding]                                                            |
|   • Firebase Email & Password Authentication                                              |
|   • "Create Account" (Sign Up) with Role Selection (CEO, Operator, Customer)              |
|   • Dynamic Header Role Switcher for instant testing and role re-assignment               |
|                                                                                           |
|  [CEO Dashboard: /ceo/dashboard]                                                          |
|   • 5 Real-time Fleet Stat Counters: Total, Running, Idle/Stopped, Faults, Offline       |
|   • Minimal Fleet Cards Grid with Live Search, Status/Customer Filters, and Sort          |
|   • Realtime Telemetry Auto-Sync directly to machine cards                                |
|                                                                                           |
|  [Customer Dashboard: /customer/dashboard]                                                |
|   • Tenant-Scoped: Organization machines, aggregated runtime, and operational metrics     |
|   • Read-only safety and status monitoring (commands locked)                             |
|                                                                                           |
|  [Operator Dashboard: /operator/dashboard]                                                |
|   • Active operating machine view with rapid multi-machine selector bar                   |
|   • Live operational metrics (RPM, Bus Voltage, Current, Motor Temp, Safety Interlocks)   |
|   • Machine control actions (Start, Stop, Speed adjustment, Fault Reset)                  |
|                                                                                           |
|  [Detailed Machine Dashboard: /machines/{machineId}]                                      |
|   • Section A: Machine Status Hero & Operational Controls                                 |
|   • Section B: Motor Monitoring (Live RPM gauge, BLDC / L298N Prototype)                  |
|   • Section C: DC Power Subsystem (Bus Voltage, Current, Wattage, Accumulated Energy)     |
|   • Section D: Battery & Solar Subsystem (with NOT CONFIGURED detection)                  |
|   • Section E: Safety & Interlock Loop (Emergency Stop, Hopper Guard, Overload, Jam)      |
|   • Section F: Telemetry Visualizer & Historical Trend Charts                             |
|   • Section G: Maintenance Logs & Export (CSV, JSON)                                      |
+───────────────────────────────────────────────────────────────────────────────────────────+
```

---

## 2. Firebase Integration

### A. Firebase Authentication & Account Management
The application uses the official **Firebase Modular SDK v11** for secure, serverless client authentication:
- **Sign In (`signInWithEmailAndPassword`)**: Validates email and password, initializes user session, and loads user role and settings.
- **Create Account (`createUserWithEmailAndPassword`, `updateProfile`)**: Allows new users to register directly on the platform with:
  - Full Name
  - Email Address
  - Account Role (`OPERATOR`, `CUSTOMER`, `CEO`)
  - Password (min 6 characters)
- **Profile Persistence (`/users/{uid}`)**: When a user registers or changes roles, their authoritative profile is stored in Firebase Realtime Database and cached in `localStorage` for instant offline-resilient startup.
- **Header Role Switcher**: Users can click the User Pill / Role Badge in the top navigation bar to open an on-the-fly role switcher menu (`CEO`, `OPERATOR`, `CUSTOMER`) for live testing and view transition.
- **Sign Out (`signOut`)**: Gracefully clears temporary dashboard state and returns the user to the login screen.

### B. Firebase Realtime Database (RTDB) Telemetry
Live telemetry from machine `CS001` is read in real time from:
```
https://circularseed-d0ced-default-rtdb.asia-southeast1.firebasedatabase.app/machines/CS001
```

#### Realtime Schema:
| Key | Type | Description |
| :--- | :--- | :--- |
| `status` | String | Operating state (`RUNNING`, `STOPPED`, `READY`, `FAULT`, `OFFLINE`) |
| `voltage` / `Voltage` | Number | DC bus voltage (e.g. `98.0` V) |
| `current` | Number | Motor current draw (e.g. `2.0` A) |
| `power` | Number | Active wattage consumption (`V × A`) |
| `rpm` | Number | Motor shaft rotational speed (e.g. `1224` RPM) |
| `motorTemperature` | Number | Motor winding / casing temperature (e.g. `25.8` °C) |
| `runtime` | Number | Cumulative operational runtime in minutes |
| `energy` | Number | Accumulated energy consumption in kWh |
| `emergencyStop` | Boolean | Physical Emergency-Stop button state (`true` = tripped) |
| `jam` | Boolean | Rotor mechanical jam condition detection |
| `fault` | String | Operational fault code (`NORMAL`, `OVERLOAD`, `MOTOR_OVERTEMP`, etc.) |
| `wifi` | Boolean | Wireless network connectivity status |
| `lastUpdate` | Number / String | Last telemetry heartbeat timestamp |

Both **FleetOverview** cards and the **MachineDetail** dashboard automatically listen to `onValue` events, updating live values and animated status pills without page reloads.

---

## 3. Role-Based Access Control (RBAC) Matrix

| Feature | CEO / Administrator | Machine Operator | Customer |
| :--- | :---: | :---: | :---: |
| **Default Route** | `/ceo/dashboard` | `/operator/dashboard` | `/customer/dashboard` |
| **Machine Scope** | Complete fleet (all units) | Assigned operational units | Organization-assigned units only |
| **Fleet Statistics** | Total, Running, Idle, Faults, Offline | Assigned machine operational stats | Organization summary & runtime |
| **Detailed Machine View** | Full detail (Sections A–G) | Full detail & live controls | Read-only telemetry (Sections A–G) |
| **Operational Controls** | Authorized (Start/Stop/Speed) | Authorized (Assigned units) | **LOCKED (Read-Only)** |
| **Role Switching** | Full access | Full access | Full access |
| **Telemetry Export** | CSV & JSON | CSV & JSON | Read-only CSV/JSON |

---

## 4. Hardware Gateway & ESP32 Firmware

The repository includes ready-to-flash Arduino/ESP32 firmware inside the [`gateway/`](gateway/) directory:

### 1. Standard STM32 / WiFi Gateway (`gateway/esp32_firmware.ino`)
- Connects to industrial STM32 motor controllers over UART with CRC16 packet validation.
- Streams JSON telemetry to Firebase Realtime Database or backend WebSockets at 1–5 Hz.

### 2. 12V DC L298N Prototype (`gateway/esp32_l298n_prototype.ino`)
Specifically designed for CircularSeed's small-scale prototype testbed:
- **Motor Driver:** L298N Dual H-Bridge (`ENA`, `IN1`, `IN2` on GPIOs 25, 26, 27).
- **Encoder:** Optical quadrature encoder (`A`, `B` on GPIOs 34, 35) with interrupt-driven RPM calculation.
- **Safety Interlocks:**
  - Hardware E-Stop button (GPIO 18, active LOW).
  - Mechanical hopper limit switch (GPIO 19, active LOW).
  - ACS712 5A Hall-effect current shunt (GPIO 36).
- **Instant Cut-off:** Immediate hardware cut-off upon emergency button press or hopper opening.

---

## 5. Local Setup & Running Locally

### Prerequisites
- Node.js (v18.0.0 or higher)
- Modern web browser (Chrome, Edge, Firefox, Safari)

### Installation
```bash
# Clone the repository
git clone https://github.com/Haridh432/CS-Dashboard.git
cd CS-Dashboard

# Install backend dependencies (optional for local gateway)
npm install
```

### Running the Dashboard

#### Option A: Direct Static Access (GitHub Pages / File Server)
The client application is completely standalone and communicates directly with Firebase Auth and Firebase Realtime Database.
You can open `index.html` in any modern web browser or serve it with:
```bash
npx serve .
```
Or access the live deployment directly at:
**[https://haridh432.github.io/CS-Dashboard/](https://haridh432.github.io/CS-Dashboard/)**

#### Option B: Local Express & WebSocket Server
To run the local edge server with WebSocket gateway on port 3000:
```bash
npm start
```
Then visit:
- **Application Portal:** [http://localhost:3000](http://localhost:3000)
- **CEO Dashboard:** [http://localhost:3000/ceo/dashboard](http://localhost:3000/ceo/dashboard)
- **Operator Dashboard:** [http://localhost:3000/operator/dashboard](http://localhost:3000/operator/dashboard)
- **Customer Dashboard:** [http://localhost:3000/customer/dashboard](http://localhost:3000/customer/dashboard)

---

## 6. Running Automated Tests

A comprehensive test suite verifies authentication, RBAC authorization, tenant boundaries, safety interlocks, and telemetry parsing:

```bash
node tests/auth_rbac.test.js
```

Test assertions cover:
1. Valid user authentication and token handling
2. Invalid credential rejection and error formatting
3. Customer organization-tenant isolation
4. Full fleet visibility scoping for CEO role
5. Operator scoping to assigned machines
6. Customer command restriction (strict read-only enforcement)
7. Operator command dispatching on assigned hardware
8. Safety interlock protection (START blocked when E-Stop or Hopper Guard is open)
9. Dynamic fleet summary telemetry calculation
10. Historical telemetry database retrieval

---

## 7. Safety & Compliance Architecture

1. **Independent Physical Safety Loops:** Software commands never replace or bypass physical emergency-stop circuits. If an emergency-stop is triggered in hardware, software cannot force a motor start.
2. **Missing Telemetry Fail-Safe:** Disconnected or missing telemetry is never interpreted as proof of safety. The dashboard defaults to a locked, safe state.
3. **No Fabricated Telemetry:** Sensors not present on a machine model explicitly show `NOT CONFIGURED` or `N/A` rather than misleading zero readings.
4. **Stale Data Watchdog:** Telemetry delayed by more than 3.5 seconds is marked `STALE DATA` and control dispatches are automatically gated.
5. **Clear Telemetry Provenance:** Telemetry streams indicate whether data originates from live hardware (`LIVE`) or a development simulation sandbox.

---

## 8. License

Copyright &copy; 2026 CircularSeed. Proprietary & Confidential. All rights reserved.
