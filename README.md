# CircularSeed Dashboard

Minimal industrial web dashboard for the CircularSeed plastic shredder machine.
This dashboard serves as the monitoring and operator interface.

## Technology
- Pure HTML5
- Pure CSS3
- Vanilla JavaScript
- No external frameworks or dependencies

## How to Run
Since this project uses no build tools or external dependencies, you can simply open `index.html` in any modern web browser:
1. Double-click `index.html` OR
2. Run a simple local server (e.g. `python -m http.server 8000` or VS Code Live Server) and navigate to the project directory.

## Mock Data Mode (Default)
By default, the dashboard runs in Mock Data mode.
In `app.js`, you will find:
```javascript
const USE_MOCK_DATA = true;
const REALTIME_MODE = false;
```
When `USE_MOCK_DATA` is `true`, the dashboard generates realistic sample values locally and updates the UI every 1 second. The connection status will display as "DEMO".

## Real-Time WebSocket Mode
To connect the dashboard to a real STM32 gateway or backend server:
1. Open `app.js`.
2. Change the configuration:
```javascript
const USE_MOCK_DATA = false;
const REALTIME_MODE = true;
```
3. The dashboard will attempt to connect to `ws://localhost:8080` via WebSocket. 
4. The connection status will update to `CONNECTING`, `CONNECTED`, or `DISCONNECTED` based on the WebSocket state.

### Expected JSON Data Format
When using WebSocket mode, the frontend expects messages in the following JSON format:

```json
{
  "type": "machine_update",
  "data": {
    "machine": {
      "state": "RUNNING",
      "runId": "CS-000124",
      "runtime": 222
    },
    "power": {
      "voltage": 48.2,
      "current": 12.4,
      "power": 598,
      "energy": 1.82
    },
    "motor": {
      "rpm": 850,
      "temperature": 48,
      "current": 12.4,
      "load": 64
    },
    "battery": {
      "voltage": 51.2,
      "soc": 78,
      "current": 12.4,
      "status": "DISCHARGING"
    },
    "processing": {
      "material": "Mixed Plastic",
      "inputWeight": 5.0,
      "processedWeight": 4.2,
      "processingTime": 222,
      "throughput": 14.2,
      "outputSize": 10
    },
    "safety": {
      "emergencyStop": "NORMAL",
      "jam": "NORMAL",
      "thermal": "NORMAL",
      "interlock": "NORMAL",
      "batteryProtection": "NORMAL",
      "activeFault": "NONE"
    },
    "solar": {
      "connected": false,
      "voltage": 0,
      "current": 0,
      "power": 0
    }
  }
}
```

## Machine Controls & Safety
The frontend only sends basic commands (`START`, `STOP`, `REVERSE`, `RESET_FAULT`) to the backend. The STM32 microcontroller remains the final authority for all machine states and safety validations (Emergency Stop, Interlock, Thermal Status, etc.). The dashboard never assumes a command is safe to execute.
