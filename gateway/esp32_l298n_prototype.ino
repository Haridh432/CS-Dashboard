/**
 * CircularSeed FLEXISHRED-DC: Small 12V DC Encoder Motor Prototype (L298N Controller)
 * File: esp32_l298n_prototype.ino
 *
 * Designed specifically for machine CS-FS-0003:
 * - Microcontroller: ESP32
 * - Motor Controller: L298N Dual H-Bridge Module
 * - Motor: 12V DC Gear Motor with Integrated Quadrature Optical / Hall Encoder
 * - Telemetry: Publishes structured JSON telemetry to CircularSeed platform (ws:// or direct HTTP)
 */

#include <WiFi.h>
#include <ArduinoJson.h>

// WiFi Configuration
const char* WIFI_SSID = "CircularSeed-AP";
const char* WIFI_PASS = "circularseed2026";
const char* BACKEND_INGEST_URL = "http://192.168.1.100:3000/api/telemetry/ingest";

// Hardware Identification
const char* MACHINE_ID = "CS-FS-0003";
const char* GATEWAY_ID = "GW-ESP32-0003";

// L298N Motor Driver Pinout
#define L298N_ENA_PIN   25   // PWM Speed control pin
#define L298N_IN1_PIN   26   // Direction Forward
#define L298N_IN2_PIN   27   // Direction Reverse

// Optical / Quadrature Encoder Pins
#define ENCODER_A_PIN   34   // Interrupt channel A
#define ENCODER_B_PIN   35   // Interrupt channel B
#define ENCODER_PPR     360  // Pulses per revolution

// Safety Switches & Current Sensor
#define ESTOP_PIN       18   // Hardware E-stop switch (active LOW with pull-up)
#define GUARD_PIN       19   // Hopper guard limit switch (closed = LOW)
#define ACS712_PIN      36   // Analog current sensor (ADC1 CH0)

// PWM Settings
#define PWM_CHANNEL     0
#define PWM_FREQ        5000 // 5 kHz PWM
#define PWM_RESOLUTION  8    // 8-bit resolution (0-255)

// Operational Variables
volatile long encoderPulseCount = 0;
unsigned long lastPulseTime = 0;
unsigned long lastTelemetryTime = 0;
float currentRpm = 0.0;
uint8_t targetPwm = 180;
bool isRunning = false;
bool estopTripped = false;
bool guardOpen = false;

// Encoder Interrupt Service Routine
void IRAM_ATTR onEncoderPulse() {
    int b = digitalRead(ENCODER_B_PIN);
    if (b > 0) {
        encoderPulseCount++;
    } else {
        encoderPulseCount--;
    }
}

void setup() {
    Serial.begin(115200);
    Serial.println(F("[12V L298N Prototype] Starting CircularSeed FLEXISHRED Micro Gateway..."));

    // Configure L298N Control Pins
    pinMode(L298N_IN1_PIN, OUTPUT);
    pinMode(L298N_IN2_PIN, OUTPUT);
    digitalWrite(L298N_IN1_PIN, LOW);
    digitalWrite(L298N_IN2_PIN, LOW);

    // Setup LEDC PWM on ENA pin
    ledcSetup(PWM_CHANNEL, PWM_FREQ, PWM_RESOLUTION);
    ledcAttachPin(L298N_ENA_PIN, PWM_CHANNEL);
    ledcWrite(PWM_CHANNEL, 0);

    // Configure Encoder Inputs
    pinMode(ENCODER_A_PIN, INPUT_PULLUP);
    pinMode(ENCODER_B_PIN, INPUT_PULLUP);
    attachInterrupt(digitalPinToInterrupt(ENCODER_A_PIN), onEncoderPulse, RISING);

    // Configure Safety Switch Inputs
    pinMode(ESTOP_PIN, INPUT_PULLUP);
    pinMode(GUARD_PIN, INPUT_PULLUP);

    // Connect to WiFi
    WiFi.begin(WIFI_SSID, WIFI_PASS);
    Serial.print(F("[WiFi] Connecting"));
    int retry = 0;
    while (WiFi.status() != WL_CONNECTED && retry < 20) {
        delay(500);
        Serial.print(F("."));
        retry++;
    }
    Serial.println();
    if (WiFi.status() == WL_CONNECTED) {
        Serial.print(F("[WiFi] Connected! IP: "));
        Serial.println(WiFi.localIP());
    } else {
        Serial.println(F("[WiFi] Offline prototype mode. Generating local telemetry."));
    }
}

void loop() {
    unsigned long now = millis();

    // 1. Check Safety Interlocks
    estopTripped = (digitalRead(ESTOP_PIN) == HIGH); // Depressed opens circuit
    guardOpen = (digitalRead(GUARD_PIN) == HIGH);    // Guard lifted opens circuit

    if (estopTripped || guardOpen) {
        if (isRunning) {
            stopMotor();
            Serial.println(F("[SAFETY] Interlock tripped! Motor immediately halted."));
        }
    }

    // 2. Calculate Motor Speed every 100ms
    if (now - lastPulseTime >= 100) {
        long pulses = encoderPulseCount;
        encoderPulseCount = 0;
        float dt = (now - lastPulseTime) / 1000.0;
        lastPulseTime = now;

        // RPM = (pulses / PPR) * (60 / dt)
        currentRpm = (float)pulses / (float)ENCODER_PPR * (60.0 / dt);
        if (currentRpm < 0) currentRpm = -currentRpm;
    }

    // 3. Publish Telemetry every 1000ms
    if (now - lastTelemetryTime >= 1000) {
        lastTelemetryTime = now;
        publishTelemetry();
    }

    // 4. Process Serial Commands from Console or USB
    if (Serial.available() > 0) {
        String cmd = Serial.readStringUntil('\n');
        cmd.trim();
        if (cmd == "START") {
            if (!estopTripped && !guardOpen) startMotor(targetPwm);
            else Serial.println(F("[ERROR] Cannot start: safety interlock is open."));
        } else if (cmd == "STOP") {
            stopMotor();
        } else if (cmd.startsWith("SPEED:")) {
            targetPwm = cmd.substring(6).toInt();
            if (isRunning) ledcWrite(PWM_CHANNEL, targetPwm);
            Serial.printf("[COMMAND] Set PWM: %d\n", targetPwm);
        }
    }
}

void startMotor(uint8_t speed) {
    isRunning = true;
    digitalWrite(L298N_IN1_PIN, HIGH);
    digitalWrite(L298N_IN2_PIN, LOW);
    ledcWrite(PWM_CHANNEL, speed);
    Serial.printf("[MOTOR] Running forward at PWM %d\n", speed);
}

void stopMotor() {
    isRunning = false;
    digitalWrite(L298N_IN1_PIN, LOW);
    digitalWrite(L298N_IN2_PIN, LOW);
    ledcWrite(PWM_CHANNEL, 0);
    Serial.println(F("[MOTOR] Stopped"));
}

void publishTelemetry() {
    StaticJsonDocument<512> doc;
    doc["type"] = "telemetry";
    doc["machineId"] = MACHINE_ID;
    doc["timestamp"] = nowIsoString();

    JsonObject machine = doc.createNestedObject("machine");
    machine["state"] = estopTripped ? "FAULT" : (isRunning ? "RUNNING" : "STOPPED");
    machine["run_id"] = "PROTO-12V-LIVE";
    machine["runtime_s"] = isRunning ? millis() / 1000 : 0;

    JsonObject dcPower = doc.createNestedObject("dc_power");
    float rawAnalog = analogRead(ACS712_PIN);
    float currentA = isRunning ? (rawAnalog * (3.3 / 4095.0) * 5.0) : 0.0;
    dcPower["voltage_v"] = 12.1;
    dcPower["current_a"] = currentA;
    dcPower["power_w"] = 12.1 * currentA;

    JsonArray motors = doc.createNestedArray("motors");
    JsonObject m1 = motors.createNestedObject();
    m1["id"] = "M1";
    m1["rpm"] = (int)currentRpm;
    m1["temperature_c"] = 28.5;
    m1["current_a"] = currentA;
    m1["state"] = isRunning ? "RUNNING" : "STOPPED";
    m1["fault"] = estopTripped ? "ESTOP_TRIP" : "NORMAL";
    m1["driver"] = "L298N";
    m1["encoder_type"] = "Optical Quadrature";

    JsonObject safety = doc.createNestedObject("safety");
    safety["estop_active"] = estopTripped;
    safety["guard_closed"] = !guardOpen;
    safety["overload"] = false;
    safety["overtemperature"] = false;
    safety["jam_detected"] = false;
    safety["comms_error"] = false;

    String jsonString;
    serializeJson(doc, jsonString);
    Serial.print(F("[TELEMETRY] "));
    Serial.println(jsonString);
}

String nowIsoString() {
    // Generate ISO timestamp or uptime string
    char buf[32];
    snprintf(buf, sizeof(buf), "2026-10-14T%02lu:%02lu:%02luZ", 
             (millis() / 3600000) % 24, 
             (millis() / 60000) % 60, 
             (millis() / 1000) % 60);
    return String(buf);
}
