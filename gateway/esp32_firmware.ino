/**
 * CircularSeed FLEXISHRED-DC: ESP32 Communication Gateway Firmware
 * File: esp32_firmware.ino
 *
 * Responsibilities:
 * 1. Hosts local WiFi Access Point and Web Server serving Dashboard static files.
 * 2. Operates WebSocket server at ws://<ESP32-IP>/ws for live dashboard streaming.
 * 3. Communicates with STM32 Main Machine Controller via Hardware Serial (UART2).
 * 4. Parses binary UART telemetry packets with CRC16, converts to JSON, and broadcasts.
 * 5. Receives JSON control commands from dashboard, converts to framed UART, and relays to STM32.
 * 6. Relays STM32 command acknowledgements back to dashboard WebSocket.
 */

#include <WiFi.h>
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <ArduinoJson.h>
#include "stm32_uart_protocol.h"

// Configuration
const char* AP_SSID = "CircularSeed-Shredder";
const char* AP_PASS = "circularseed2026"; // Minimum 8 chars

#define STM32_UART Serial2
#define STM32_RX_PIN 16
#define STM32_TX_PIN 17
#define STM32_BAUD   115200

// Async Web Server & WebSocket
AsyncWebServer server(80);
AsyncWebSocket ws("/ws");

// UART Parser State Machine
enum UartRxState {
    WAIT_SYNC_0,
    WAIT_SYNC_1,
    WAIT_TYPE,
    WAIT_LEN_LOW,
    WAIT_LEN_HIGH,
    WAIT_PAYLOAD,
    WAIT_CRC_LOW,
    WAIT_CRC_HIGH
};

UartRxState rxState = WAIT_SYNC_0;
uint8_t rxType = 0;
uint16_t rxPayloadLen = 0;
uint16_t rxBytesReceived = 0;
uint8_t rxBuffer[PROTOCOL_MAX_PAYLOAD];
uint16_t rxExpectedCrc = 0;

// Forward declarations
void handleWebSocketMessage(void *arg, uint8_t *data, size_t len);
void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len);
void processUartPacket(uint8_t type, const uint8_t *payload, uint16_t len);
void sendUartCommand(uint32_t cmdId, uint8_t action);

void setup() {
    Serial.begin(115200);
    Serial.println(F("\n[ESP32 Gateway] Starting CircularSeed FLEXISHRED-DC Communication Bridge..."));

    // 1. Initialize Hardware UART to STM32
    STM32_UART.begin(STM32_BAUD, SERIAL_8N1, STM32_RX_PIN, STM32_TX_PIN);

    // 2. Setup WiFi Access Point
    WiFi.softAP(AP_SSID, AP_PASS);
    IPAddress IP = WiFi.softAPIP();
    Serial.print(F("[WiFi] Gateway AP established. IP: "));
    Serial.println(IP);

    // 3. Setup WebSocket Server
    ws.onEvent(onWsEvent);
    server.addHandler(&ws);

    // 4. Default HTTP Endpoint
    server.on("/", HTTP_GET, [](AsyncWebServerRequest *request){
        request->send(200, "text/html", 
            "<h2>CircularSeed ESP32 Gateway Active</h2>"
            "<p>Connect Dashboard client to WebSocket endpoint: <code>ws://192.168.4.1/ws</code></p>");
    });

    server.begin();
    Serial.println(F("[HTTP/WS] Server active. Listening on ws://192.168.4.1/ws"));
}

void loop() {
    ws.cleanupClients();

    // Read incoming bytes from STM32 UART
    while (STM32_UART.available() > 0) {
        uint8_t b = STM32_UART.read();

        switch (rxState) {
            case WAIT_SYNC_0:
                if (b == PROTOCOL_SYNC_BYTE_0) rxState = WAIT_SYNC_1;
                break;

            case WAIT_SYNC_1:
                if (b == PROTOCOL_SYNC_BYTE_1) rxState = WAIT_TYPE;
                else rxState = WAIT_SYNC_0;
                break;

            case WAIT_TYPE:
                rxType = b;
                rxState = WAIT_LEN_LOW;
                break;

            case WAIT_LEN_LOW:
                rxPayloadLen = b;
                rxState = WAIT_LEN_HIGH;
                break;

            case WAIT_LEN_HIGH:
                rxPayloadLen |= ((uint16_t)b << 8);
                if (rxPayloadLen > PROTOCOL_MAX_PAYLOAD) {
                    Serial.println(F("[UART] Payload len exceeded maximum. Resetting parser."));
                    rxState = WAIT_SYNC_0;
                } else {
                    rxBytesReceived = 0;
                    rxState = (rxPayloadLen == 0) ? WAIT_CRC_LOW : WAIT_PAYLOAD;
                }
                break;

            case WAIT_PAYLOAD:
                rxBuffer[rxBytesReceived++] = b;
                if (rxBytesReceived >= rxPayloadLen) {
                    rxState = WAIT_CRC_LOW;
                }
                break;

            case WAIT_CRC_LOW:
                rxExpectedCrc = b;
                rxState = WAIT_CRC_HIGH;
                break;

            case WAIT_CRC_HIGH:
                rxExpectedCrc |= ((uint16_t)b << 8);
                // Validate CRC
                uint16_t calcCrc = calculate_crc16(rxBuffer, rxPayloadLen);
                if (calcCrc == rxExpectedCrc) {
                    processUartPacket(rxType, rxBuffer, rxPayloadLen);
                } else {
                    Serial.printf("[UART] CRC mismatch! Calc: 0x%04X, Expected: 0x%04X\n", calcCrc, rxExpectedCrc);
                }
                rxState = WAIT_SYNC_0;
                break;
        }
    }
}

/**
 * Converts STM32 binary telemetry packet to JSON and broadcasts to all WebSocket clients.
 */
void processUartPacket(uint8_t type, const uint8_t *payload, uint16_t len) {
    if (type == MSG_TYPE_TELEMETRY && len == sizeof(TelemetryPayload)) {
        const TelemetryPayload *t = (const TelemetryPayload*)payload;

        // Build JSON document matching Section 5 protocol
        StaticJsonDocument<1024> doc;
        doc["type"] = "telemetry";
        doc["sequence"] = t->sequence;
        doc["timestamp"] = "LIVE";

        // Machine
        JsonObject machine = doc.createNestedObject("machine");
        const char *stateStr = "READY";
        if (t->machine_state == MACHINE_STATE_RUNNING) stateStr = "RUNNING";
        else if (t->machine_state == MACHINE_STATE_STOPPED) stateStr = "STOPPED";
        else if (t->machine_state == MACHINE_STATE_FAULT) stateStr = "FAULT";
        machine["state"] = stateStr;
        machine["run_id"] = t->run_id;
        machine["runtime_s"] = t->runtime_seconds;

        // DC Power
        JsonObject dcPower = doc.createNestedObject("dc_power");
        dcPower["voltage_v"] = isnan(t->dc_bus_voltage_v) ? (JsonVariant)nullptr : t->dc_bus_voltage_v;
        dcPower["current_a"] = isnan(t->dc_current_a) ? (JsonVariant)nullptr : t->dc_current_a;
        dcPower["power_w"] = isnan(t->dc_power_w) ? (JsonVariant)nullptr : t->dc_power_w;
        dcPower["energy_wh"] = t->energy_wh;
        dcPower["lifetime_energy_kwh"] = t->lifetime_energy_kwh;

        // Motors array
        JsonArray motors = doc.createNestedArray("motors");
        // Motor 1
        JsonObject m1 = motors.createNestedObject();
        m1["id"] = "M1";
        m1["rpm"] = (isnan(t->m1_rpm) || t->m1_rpm < 0) ? (JsonVariant)nullptr : t->m1_rpm;
        m1["temperature_c"] = isnan(t->m1_temp_c) ? (JsonVariant)nullptr : t->m1_temp_c;
        m1["current_a"] = isnan(t->m1_current_a) ? (JsonVariant)nullptr : t->m1_current_a;
        m1["state"] = (t->m1_state == 1) ? "RUNNING" : ((t->m1_state == 2) ? "FAULT" : "STOPPED");
        m1["fault"] = (t->m1_state == 2) ? "FAULT" : "NORMAL";

        // Motor 2
        JsonObject m2 = motors.createNestedObject();
        m2["id"] = "M2";
        m2["rpm"] = (isnan(t->m2_rpm) || t->m2_rpm < 0) ? (JsonVariant)nullptr : t->m2_rpm;
        m2["temperature_c"] = isnan(t->m2_temp_c) ? (JsonVariant)nullptr : t->m2_temp_c;
        m2["current_a"] = isnan(t->m2_current_a) ? (JsonVariant)nullptr : t->m2_current_a;
        m2["state"] = (t->m2_state == 1) ? "RUNNING" : ((t->m2_state == 2) ? "FAULT" : "STOPPED");
        m2["fault"] = (t->m2_state == 2) ? "FAULT" : "NORMAL";

        // Battery
        JsonObject battery = doc.createNestedObject("battery");
        battery["configured"] = (t->battery_configured == 1);
        battery["voltage_v"] = isnan(t->battery_voltage_v) ? (JsonVariant)nullptr : t->battery_voltage_v;
        battery["soc_percent"] = isnan(t->battery_soc_pct) ? (JsonVariant)nullptr : t->battery_soc_pct;
        battery["current_a"] = isnan(t->battery_current_a) ? (JsonVariant)nullptr : t->battery_current_a;
        battery["temperature_c"] = isnan(t->battery_temp_c) ? (JsonVariant)nullptr : t->battery_temp_c;
        battery["status"] = (t->battery_configured == 1) ? "DISCHARGING" : "NOT_CONFIGURED";

        // Safety
        JsonObject safety = doc.createNestedObject("safety");
        safety["estop_active"] = (t->estop_active == 1);
        safety["guard_closed"] = (t->guard_closed == 1);
        safety["overload"] = (t->overload_flag == 1);
        safety["overtemperature"] = (t->overtemp_flag == 1);
        safety["jam_detected"] = (t->jam_detected == 1);
        safety["comms_error"] = false;
        safety["fault_code"] = (t->fault_code != 0) ? t->fault_code : (JsonVariant)nullptr;

        String output;
        serializeJson(doc, output);
        ws.textAll(output);
    } 
    else if (type == MSG_TYPE_COMMAND_ACK && len == sizeof(CommandAckPayload)) {
        const CommandAckPayload *ack = (const CommandAckPayload*)payload;

        StaticJsonDocument<256> doc;
        doc["type"] = "command_ack";
        char cmdIdStr[16];
        snprintf(cmdIdStr, sizeof(cmdIdStr), "CMD-%04lu", (unsigned long)ack->command_id);
        doc["command_id"] = cmdIdStr;
        doc["status"] = (ack->status == ACK_STATUS_ACCEPTED) ? "ACCEPTED" : "REJECTED";
        doc["message"] = (ack->status == ACK_STATUS_ACCEPTED) ? "STM32 executed command" : "Rejected by safety interlock";

        String output;
        serializeJson(doc, output);
        ws.textAll(output);
    }
}

/**
 * Handles incoming WebSocket packets from Browser Dashboard.
 */
void handleWebSocketMessage(void *arg, uint8_t *data, size_t len) {
    AwsFrameInfo *info = (AwsFrameInfo*)arg;
    if (info->final && info->index == 0 && info->len == len && info->opcode == WS_TEXT) {
        StaticJsonDocument<256> doc;
        DeserializationError err = deserializeJson(doc, data, len);
        if (err) return;

        const char *type = doc["type"];
        if (type && strcmp(type, "command") == 0) {
            const char *cmdIdStr = doc["command_id"];
            const char *action = doc["action"];

            uint32_t numId = 1;
            if (cmdIdStr && strlen(cmdIdStr) > 4) {
                numId = atoi(cmdIdStr + 4);
            }

            uint8_t actionCode = CMD_ACTION_STOP;
            if (action && strcmp(action, "START") == 0) actionCode = CMD_ACTION_START;
            else if (action && strcmp(action, "RESET_FAULT") == 0) actionCode = CMD_ACTION_RESET_FAULT;

            // Transmit binary command packet over UART to STM32
            sendUartCommand(numId, actionCode);
        } else if (type && strcmp(type, "ping") == 0) {
            // Echo pong
            ws.textAll("{\"type\":\"pong\"}");
        }
    }
}

/**
 * Transmits framed command packet to STM32 via UART2.
 */
void sendUartCommand(uint32_t cmdId, uint8_t action) {
    CommandPayload cmd;
    cmd.command_id = cmdId;
    cmd.action = action;

    uint16_t len = sizeof(CommandPayload);
    uint16_t crc = calculate_crc16((const uint8_t*)&cmd, len);

    STM32_UART.write(PROTOCOL_SYNC_BYTE_0);
    STM32_UART.write(PROTOCOL_SYNC_BYTE_1);
    STM32_UART.write(MSG_TYPE_COMMAND);
    STM32_UART.write((uint8_t)(len & 0xFF));
    STM32_UART.write((uint8_t)((len >> 8) & 0xFF));
    STM32_UART.write((const uint8_t*)&cmd, len);
    STM32_UART.write((uint8_t)(crc & 0xFF));
    STM32_UART.write((uint8_t)((crc >> 8) & 0xFF));
    STM32_UART.flush();
}

void onWsEvent(AsyncWebSocket *server, AsyncWebSocketClient *client, AwsEventType type, void *arg, uint8_t *data, size_t len) {
    if (type == WS_EVT_CONNECT) {
        Serial.printf("[WebSocket] Client #%u connected from %s\n", client->id(), client->remoteIP().toString().c_str());
    } else if (type == WS_EVT_DISCONNECT) {
        Serial.printf("[WebSocket] Client #%u disconnected\n", client->id());
    } else if (type == WS_EVT_DATA) {
        handleWebSocketMessage(arg, data, len);
    }
}
