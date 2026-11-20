# CircularSeed FLEXISHRED-DC Dashboard

An easy-to-use, real-time machine monitoring dashboard for **CircularSeed FLEXISHRED-DC Plastic Shredders**.

🔗 **Live Website:** [https://haridh432.github.io/CS-Dashboard/](https://haridh432.github.io/CS-Dashboard/)

---

## 🌟 What is this project?

This web dashboard allows users to monitor and track CircularSeed plastic shredding machines in real time.

Whether you are a **CEO** overseeing the entire fleet, an **Operator** running a machine on the factory floor, or a **Customer** checking your machine's status, the dashboard provides a tailored view for your needs.

---

## 🚀 Key Features

- **Live Telemetry:** Watch machine metrics update in real time:
  - ⚡ DC Bus Voltage & Current Draw
  - 🔄 Motor RPM & Temperature
  - 🔋 Power consumption & Total Energy used
  - 🛑 Emergency Stop & Safety Guard status
- **Firebase Authentication:**
  - **Sign In:** Secure login with your email and password.
  - **Create Account:** Register a new account directly from the website.
- **Three User Roles:**
  - 👑 **CEO:** Full overview of all machines in the fleet with summary stats.
  - ⚙️ **Operator:** Focused view of your active machine with operational metrics.
  - 🏢 **Customer:** View machines assigned to your company.
- **Role Switcher:** Easily switch between CEO, Operator, and Customer views right from the user profile pill in the top header.
- **Works Anywhere:** Runs directly in any web browser without needing to install anything.

---

## 💻 Tech Stack

- **Frontend:** Vanilla JavaScript (ES6 Modules), HTML5, CSS3
- **Authentication:** Firebase Auth
- **Real-Time Database:** Firebase Realtime Database (`machines/CS001`)
- **Hardware Gateway:** ESP32 Microcontroller (UART / WiFi)
- **Local Server (Optional):** Node.js & Express with WebSockets

---

## 🏁 Quick Start

### Option 1: Open the Live Dashboard (Easiest)
Simply visit: **[https://haridh432.github.io/CS-Dashboard/](https://haridh432.github.io/CS-Dashboard/)**

1. Click **Create Account** to register a new user, or **Sign In** if you already have an account.
2. Select your role (**Operator**, **Customer**, or **CEO**).
3. The dashboard will load and connect automatically to live machine data.

### Option 2: Run Locally on Your Computer

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Haridh432/CS-Dashboard.git
   cd CS-Dashboard
   ```

2. **Start the local server:**
   ```bash
   npm start
   ```

3. **Open in your browser:**
   Open [http://localhost:3000](http://localhost:3000)

---

## 📂 Project Structure

```
CS-Dashboard/
├── index.html           # Main dashboard web page
├── style.css            # Styles and responsive design
├── firebase.js          # Firebase Auth & Realtime Database connection
├── app.js               # Application routing and user role handling
├── api.js               # Data management and API helpers
├── websocket.js         # WebSocket client for local gateway
├── components/          # Dashboard UI components
│   ├── FleetOverview.js # CEO fleet cards & status counters
│   ├── OperatorView.js  # Operator live machine view
│   ├── CustomerView.js  # Customer organization view
│   ├── MachineDetail.js # Detailed gauges, charts & sensors
│   ├── MachineCard.js   # Reusable machine card
│   └── StatusBadge.js   # Status indicator badge (Running, Stopped, etc.)
└── gateway/             # ESP32 microcontroller firmware files
```

---

## 🔒 Safety First

The dashboard is designed for industrial equipment safety:
- **Physical Safety Loops:** The software Stop button does not replace the hardware Emergency Stop button.
- **No Guesswork:** If a sensor is disconnected or not installed, it shows `NOT CONFIGURED` rather than misleading zeros.
- **Live vs Simulation:** The dashboard clearly marks whether data comes from live hardware or a test simulation.

---

## 📄 License

Copyright © 2026 CircularSeed. All rights reserved.
