# CircularSeed Role-Based Machine Monitoring Platform (FLEXISHRED-DC)

Industrial-grade real-time machine monitoring and fleet operations platform for **CircularSeed FLEXISHRED-DC Plastic Shredders**.

---

## 1. System Architecture

```
+---------------------------------------------------------------------------------------+
|                              FLEXISHRED-DC MACHINE FLEET                              |
|                                                                                       |
|  [CS-FS-0001: 48V Pro Dual BLDC]     [CS-FS-0002: 48V Std Dual BLDC]                  |
|  [CS-FS-0003: 12V L298N Prototype]   [CS-FS-0004: 48V Pro Solar Intake]               |
|  [CS-FS-0005: 48V Std Rotor Jam]     [CS-FS-0006: Offline Unit]                       |
+───────────────────────────────────────────────┼───────────────────────────────────────+
                                                │ Hardware UART / WiFi Telemetry
                                                ▼
+───────────────────────────────────────────────────────────────────────────────────────+
|                           ESP32 WIRELESS / ETHERNET GATEWAY                           |
|       • Direct STM32 CRC16 Binary Bridge (`gateway/esp32_firmware.ino`)               |
|       • 12V DC L298N Optical Encoder Gateway (`gateway/esp32_l298n_prototype.ino`)    |
+───────────────────────────────────────────────┼───────────────────────────────────────+
                                                │ REST API / WebSocket Ingestion
                                                ▼
+───────────────────────────────────────────────────────────────────────────────────────+
|                       AUTHENTICATED NODE.JS & EXPRESS BACKEND                         |
|                                                                                       |
|  • Security & Session: JWT Tokens, bcrypt password hashing, CORS, Helmet              |
|  • Database: SQLite (via `node:sqlite` DatabaseSync) in `data/circularseed.db`        |
|  • Strict RBAC: Tenant isolation (Customers strictly restricted to their own org)     |
|  • Real-Time WebSocket Server (`/ws`): Machine-specific & Fleet subscriptions         |
|  • Authoritative Simulation Engine: 1 Hz telemetry tick & interactive fault sandbox   |
+───────────────────────────────────────────────┼───────────────────────────────────────+
                                                │ WebSocket Telemetry & REST API
                                                ▼
+───────────────────────────────────────────────────────────────────────────────────────+
|                             ROLE-BASED WEB DASHBOARD (SPA)                            |
|                                                                                       |
|  [CEO Dashboard: /ceo/dashboard]                                                      |
|   • 5 Summary Stat Cards: Total, Running, Idle/Stopped, Active Faults, Disconnected   |
|   • Minimal Machine Cards Grid with Live Search, Status/Customer/Model Filters & Sort  |
|   • Compact Fleet Health Watchdog: Active faults, stale machines, and recent events   |
|                                                                                       |
|  [Customer Dashboard: /customer/dashboard]                                            |
|   • Tenant-Scoped: Strictly displays only machines assigned to customer's org        |
|   • Customer Summary & Minimal Cards Grid (Read-only monitoring; commands disabled)   |
|                                                                                       |
|  [Operator Dashboard: /operator/dashboard]                                            |
|   • Single-unit auto-load or compact multi-unit machine selector                      |
|   • Current operational telemetry (RPM, Voltage, Current, Safety Interlocks)          |
|   • Validated Machine Controls (Start, Stop, Speed PWM setting, Fault Reset)          |
|                                                                                       |
|  [Detailed Machine Dashboard: /machines/{machineId}]                                  |
|   • Section A: Machine Overview & Control                                             |
|   • Section B: Motor Monitoring (Dual BLDC or 12V L298N Prototype with Encoder)       |
|   • Section C: 48V / 12V DC Power & Accumulated Energy Wh / kWh                       |
|   • Section D: Battery & Solar Subsystem (with NOT CONFIGURED handling)               |
|   • Section E: Safety & Interlock Circuits (E-Stop, Guard, Overload, Jam, Comms)      |
|   • Section F: Historical Data & Trend Charts (1h, 24h, 7d, all ranges via SVG)      |
|   • Section G: Maintenance Records & Export (CSV, JSON)                               |
+---------------------------------------------------------------------------------------+
```

---

## 2. Role-Based Access Control (RBAC) Matrix

| Feature | CEO / Administrator | Customer | Machine Operator |
| :--- | :---: | :---: | :---: |
| **Target Route** | `/ceo/dashboard` | `/customer/dashboard` | `/operator/dashboard` |
| **Machine Scope** | All registered machines | Organization-assigned only | User-assigned machines only |
| **Fleet Statistics** | Full manufactured fleet stats | Organization summary only | Assigned machine status |
| **Machine Detail View** | Full detail (Sections A–G) | Full detail (Sections A–G) | Full operational detail |
| **Operational Controls** | Authorized (Start/Stop/Speed) | **DENIED (Read-Only)** | Authorized (Assigned units) |
| **Simulation Sandbox** | Enabled (Demo mode) | Disabled | Enabled (Demo mode) |
| **Maintenance Export** | CSV & JSON | CSV & JSON | Read-only |
| **Cross-Org Access** | Full fleet visibility | **Strictly blocked (HTTP 403)** | Blocked to assigned units |

---

## 3. Demo Accounts & Credentials

The platform is pre-seeded with sample development accounts:

| Role | Email | Password | Assigned Scope |
| :--- | :--- | :--- | :--- |
| **CEO / Admin** | `ceo@circularseed.com` | `CircularCEO#2025` | Complete fleet (all 6 machines across all organizations) |
| **Customer 1** | `customer@acme-plastics.com` | `Customer#Acme2025` | Acme Plastics Corp (`CS-FS-0001`, `0002`, `0003`) |
| **Customer 2** | `customer@green-cycle.com` | `Customer#Green2025` | GreenCycle Industries (`CS-FS-0004`, `0005`) |
| **Operator 1** | `operator@circularseed.com` | `Operator#Flexishred1` | Assigned to `CS-FS-0001` (opens directly to live operating view) |
| **Operator 2** | `operator2@circularseed.com` | `Operator#Flexishred2` | Assigned to `CS-FS-0002` & `CS-FS-0003` (selector view) |

*(Credentials can be auto-filled directly from the login screen via the "Demo Accounts" accordion panel).*

---

## 4. Quickstart: Installation and Running Locally

### Prerequisites
- Node.js (v18.0.0 or higher; built-in SQLite `node:sqlite` supported on Node 22+)
- Modern web browser (Chrome, Edge, Firefox, Safari)

### Installation
```bash
# Clone repository
git clone https://github.com/circularseed/circularseed-platform.git
cd circularseed-platform

# Install production dependencies
npm install
```

### Running the Platform Server
```bash
# Start backend Express & WebSocket server (port 3000)
npm start
```

Open your browser to:
- **Application Portal:** [http://localhost:3000](http://localhost:3000)
- **CEO Fleet Dashboard:** [http://localhost:3000/ceo/dashboard](http://localhost:3000/ceo/dashboard)
- **Customer Dashboard:** [http://localhost:3000/customer/dashboard](http://localhost:3000/customer/dashboard)
- **Operator Dashboard:** [http://localhost:3000/operator/dashboard](http://localhost:3000/operator/dashboard)

---

## 5. Registered Machines Registry

| Machine ID | Model | Organization | Hardware Configuration | State |
| :--- | :--- | :--- | :--- | :---: |
| **`CS-FS-0001`** | FLEXISHRED-DC Pro | Acme Plastics Corp | Dual 48V BLDC, Battery + Solar equipped, Interlocks | **RUNNING** |
| **`CS-FS-0002`** | FLEXISHRED-DC Std | Acme Plastics Corp | Dual 48V BLDC, 48V DC bus, Battery NOT CONFIGURED | **READY** |
| **`CS-FS-0003`** | FLEXISHRED-DC Micro | Acme Plastics Corp | **Small 12V DC Motor with L298N H-Bridge Driver & Optical Quadrature Encoder** | **STOPPED** |
| **`CS-FS-0004`** | FLEXISHRED-DC Pro | GreenCycle Industries | Dual 48V BLDC, 48V DC bus, Solar generation configured | **RUNNING** |
| **`CS-FS-0005`** | FLEXISHRED-DC Std | GreenCycle Industries | Dual 48V BLDC, Overload & Rotor Jam tripped | **FAULT** |
| **`CS-FS-0006`** | FLEXISHRED-DC Pro | CircularSeed Internal | Dual 48V BLDC, Disconnected testbed | **OFFLINE** |

---

## 6. Small 12V DC Motor Prototype (L298N Driver) Integration

The platform includes first-class support for CircularSeed's small 12 V DC encoder motor prototype:

- **Machine ID:** `CS-FS-0003`
- **Firmware source:** [`gateway/esp32_l298n_prototype.ino`](gateway/esp32_l298n_prototype.ino)
- **Wiring pinout:**
  - `ENA` &rarr; ESP32 GPIO 25 (PWM Speed Channel 0)
  - `IN1` &rarr; ESP32 GPIO 26 (Direction Forward)
  - `IN2` &rarr; ESP32 GPIO 27 (Direction Reverse)
  - `Encoder A` &rarr; ESP32 GPIO 34 (Interrupt Service Routine, rising edge)
  - `Encoder B` &rarr; ESP32 GPIO 35 (Quadrature direction reading)
  - `E-Stop Switch` &rarr; ESP32 GPIO 18 (Active LOW)
  - `Hopper Guard` &rarr; ESP32 GPIO 19 (Limit switch, active LOW)
  - `Current Sensor` &rarr; ESP32 GPIO 36 (ACS712 5A DC Hall-effect shunt)
- **Dashboard Features:**
  - Speed PWM adjustment slider (0–255 range)
  - Real-time optical encoder RPM measurement
  - Driver H-Bridge thermal monitoring
  - Instant hardware halt upon E-stop button depression or hopper guard opening

---

## 7. Running Automated Tests

Run the test suite to verify authentication, RBAC, tenant isolation, safety interlocks, and telemetry APIs:

```bash
node tests/auth_rbac.test.js
```

All 13 automated test assertions cover:
1. Valid CEO login and JWT issuance
2. Invalid password rejection
3. Server-side token validation
4. Customer login with organization binding
5. Full fleet scoping for CEO
6. Strict cross-tenant isolation (Acme customer blocked from GreenCycle machines)
7. Single-machine operator scoping
8. Multi-machine operator scoping
9. Customer machine command restriction (Read-only enforcement)
10. Operator command dispatch on assigned machine
11. Safety Interlock rejection (START blocked when E-Stop or Guard is open)
12. Dynamic fleet summary calculations
13. Historical telemetry database retrieval

---

## 8. Safety & Compliance Architecture

1. **Independent Safety Interlocks**: Missing safety telemetry is **never interpreted as proof that a machine is safe**.
2. **Dashboard Stop is Operational**: The web dashboard Stop button is a software command. It **never replaces or bypasses the physical emergency-stop loop**.
3. **No Fabricated Telemetry**: Sensors not installed or disconnected display `N/A` or `NOT CONFIGURED` rather than misleading zeros.
4. **Stale Data Watchdog**: Telemetry delayed for more than 3.5 seconds is marked `STALE DATA` and control buttons are immediately locked.
5. **No Blind Mode Switching**: Telemetry packets are explicitly marked `DEMO` or `LIVE` to prevent simulation data from being mistaken for real hardware.
