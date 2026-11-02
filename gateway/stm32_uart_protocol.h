/**
 * CircularSeed FLEXISHRED-DC: STM32 <-> ESP32 UART Communication Protocol
 * File: stm32_uart_protocol.h
 * 
 * Framing: [SYNC_0 (0xAA)] [SYNC_1 (0x55)] [MSG_TYPE (1B)] [PAYLOAD_LEN (2B)] [PAYLOAD (NB)] [CRC16 (2B)]
 */

#ifndef STM32_UART_PROTOCOL_H
#define STM32_UART_PROTOCOL_H

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

#define PROTOCOL_SYNC_BYTE_0    0xAA
#define PROTOCOL_SYNC_BYTE_1    0x55
#define PROTOCOL_MAX_PAYLOAD    256

// Message Types
typedef enum {
    MSG_TYPE_TELEMETRY    = 0x01, // STM32 -> ESP32 periodic telemetry (1-5 Hz)
    MSG_TYPE_COMMAND      = 0x02, // ESP32 -> STM32 control command
    MSG_TYPE_COMMAND_ACK  = 0x03, // STM32 -> ESP32 command acknowledgement
    MSG_TYPE_HEARTBEAT    = 0x04  // Bidirectional link health
} ProtocolMsgType;

// Machine State Enum (STM32 authoritative)
typedef enum {
    MACHINE_STATE_READY   = 0,
    MACHINE_STATE_RUNNING = 1,
    MACHINE_STATE_STOPPED = 2,
    MACHINE_STATE_FAULT   = 3
} MachineState;

// Command Actions
typedef enum {
    CMD_ACTION_STOP        = 0,
    CMD_ACTION_START       = 1,
    CMD_ACTION_RESET_FAULT = 2
} CommandAction;

// Command Status
typedef enum {
    ACK_STATUS_REJECTED = 0,
    ACK_STATUS_ACCEPTED = 1,
    ACK_STATUS_PENDING  = 2
} AckStatus;

// Packed Telemetry Payload (STM32 -> ESP32)
#pragma pack(push, 1)
typedef struct {
    uint32_t sequence;           // Packet sequence number
    uint32_t runtime_seconds;    // Machine run seconds
    uint8_t  machine_state;      // MachineState
    char     run_id[12];         // e.g. "CS-000124\0"

    // DC Power measurements
    float    dc_bus_voltage_v;   // e.g. 48.2 V
    float    dc_current_a;       // e.g. 12.4 A
    float    dc_power_w;         // e.g. 598.0 W
    uint32_t energy_wh;          // Session energy
    float    lifetime_energy_kwh;// Non-volatile lifetime energy

    // Motor 1
    float    m1_rpm;             // NaN or negative if sensor uninstalled
    float    m1_temp_c;          // Motor 1 temperature or NaN
    float    m1_current_a;       // Motor 1 current
    uint8_t  m1_state;           // 0: STOPPED, 1: RUNNING, 2: FAULT

    // Motor 2
    float    m2_rpm;             // NaN or negative if sensor uninstalled
    float    m2_temp_c;          // Motor 2 temperature or NaN
    float    m2_current_a;       // Motor 2 current
    uint8_t  m2_state;           // 0: STOPPED, 1: RUNNING, 2: FAULT

    // Optional Battery (if installed)
    uint8_t  battery_configured; // 0 = False, 1 = True
    float    battery_voltage_v;  // NaN if unconfigured
    float    battery_soc_pct;    // NaN if unconfigured
    float    battery_current_a;  // NaN if unconfigured
    float    battery_temp_c;     // NaN if unconfigured
    uint8_t  battery_status;     // 0: Standby, 1: Discharging, 2: Charging

    // Safety and Interlock bits
    uint8_t  estop_active;       // 1 = Estop button depressed (Physical hardware loop)
    uint8_t  guard_closed;       // 1 = Hopper interlock switch closed
    uint8_t  overload_flag;      // 1 = DC Overcurrent threshold tripped
    uint8_t  overtemp_flag;      // 1 = Thermal switch tripped
    uint8_t  jam_detected;       // 1 = Rotor stall/jam algorithm tripped
    uint16_t fault_code;         // Bitmask or error code enum
} TelemetryPayload;

// Command Packet (ESP32 -> STM32)
typedef struct {
    uint32_t command_id;         // Numeric ID or CRC of client CMD ID
    uint8_t  action;             // CommandAction
} CommandPayload;

// Command Acknowledgement (STM32 -> ESP32)
typedef struct {
    uint32_t command_id;         // Matching command ID
    uint8_t  status;             // AckStatus (0=REJECTED, 1=ACCEPTED)
    uint16_t reject_reason_code; // Error code if rejected
} CommandAckPayload;
#pragma pack(pop)

// Standard CRC-16-CCITT (Polynomial 0x1021)
static inline uint16_t calculate_crc16(const uint8_t *data, size_t len) {
    uint16_t crc = 0xFFFF;
    for (size_t i = 0; i < len; i++) {
        crc ^= (uint16_t)data[i] << 8;
        for (int j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc <<= 1;
            }
        }
    }
    return crc;
}

#ifdef __cplusplus
}
#endif

#endif // STM32_UART_PROTOCOL_H
