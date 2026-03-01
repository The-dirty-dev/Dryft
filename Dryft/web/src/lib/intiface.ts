/**
 * Intiface Central Connection Service for Web
 *
 * Connects to Intiface Central running on the user's machine via WebSocket.
 * Intiface Central handles all Bluetooth/USB device communication.
 *
 * Architecture:
 * ┌─────────────┐    WebSocket    ┌─────────────────┐    BLE/USB    ┌──────────┐
 * │  Dryft Web  │ ◄──────────────► │ Intiface Central │ ◄────────────► │ Devices  │
 * └─────────────┘   localhost:12345 └─────────────────┘                └──────────┘
 */

export interface IntifaceDevice {
  index: number;
  name: string;
  address?: string;
  messageTypes: {
    ScalarCmd?: { stepCount: number; actuatorType: string }[];
    RotateCmd?: { stepCount: number }[];
    LinearCmd?: { stepCount: number }[];
    BatteryLevelCmd?: boolean;
  };
}

type DeviceAddedCallback = (device: IntifaceDevice) => void;
type DeviceRemovedCallback = (deviceIndex: number) => void;
type DisconnectedCallback = () => void;
type ErrorCallback = (error: string) => void;

interface ButtplugMessage {
  [key: string]: any;
}

const DEFAULT_INTIFACE_URL = 'ws://127.0.0.1:12345';

/**
 * Check if running in Electron desktop app
 */
function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).drift?.isElectron;
}

/**
 * Get Electron API if available
 */
function getElectronApi(): typeof window.drift | null {
  if (isElectron()) {
    return (window as any).drift;
  }
  return null;
}

class IntifaceService {
  private socket: WebSocket | null = null;
  private messageId = 1;
  private pendingMessages: Map<number, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
  private devices: Map<number, IntifaceDevice> = new Map();

  // Callbacks
  private onDeviceAdded: DeviceAddedCallback | null = null;
  private onDeviceRemoved: DeviceRemovedCallback | null = null;
  private onDisconnected: DisconnectedCallback | null = null;
  private onError: ErrorCallback | null = null;

  // Connection state
  private _isConnected = false;
  private _isScanning = false;

  /**
   * Set callbacks for device events
   */
  setCallbacks(callbacks: {
    onDeviceAdded?: DeviceAddedCallback;
    onDeviceRemoved?: DeviceRemovedCallback;
    onDisconnected?: DisconnectedCallback;
    onError?: ErrorCallback;
  }) {
    this.onDeviceAdded = callbacks.onDeviceAdded || null;
    this.onDeviceRemoved = callbacks.onDeviceRemoved || null;
    this.onDisconnected = callbacks.onDisconnected || null;
    this.onError = callbacks.onError || null;
  }

  /**
   * Connect to Intiface Central
   */
  async connect(url: string = DEFAULT_INTIFACE_URL): Promise<boolean> {
    if (this._isConnected) {
      return true;
    }

    return new Promise((resolve) => {
      try {
        this.socket = new WebSocket(url);

        this.socket.onopen = async () => {
          console.log('[Intiface] WebSocket connected');

          // Perform Buttplug handshake
          try {
            await this.sendMessage({
              RequestServerInfo: {
                Id: this.getNextMessageId(),
                ClientName: 'Dryft Web',
                MessageVersion: 3,
              },
            });

            this._isConnected = true;

            // Notify Electron about connection status
            const electron = getElectronApi();
            if (electron) {
              electron.setIntifaceStatus(true);
              electron.hapticNotification('intiface-connected', '');
            }

            resolve(true);
          } catch (err) {
            console.error('[Intiface] Handshake failed:', err);
            this.disconnect();
            resolve(false);
          }
        };

        this.socket.onclose = () => {
          console.log('[Intiface] WebSocket closed');
          this.handleDisconnect();
          resolve(false);
        };

        this.socket.onerror = (error) => {
          console.error('[Intiface] WebSocket error:', error);
          this.onError?.('Connection failed. Is Intiface Central running?');
          resolve(false);
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        // Connection timeout
        setTimeout(() => {
          if (!this._isConnected) {
            this.disconnect();
            resolve(false);
          }
        }, 5000);
      } catch (err) {
        console.error('[Intiface] Connection error:', err);
        resolve(false);
      }
    });
  }

  /**
   * Disconnect from Intiface Central
   */
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    this.handleDisconnect();
  }

  private handleDisconnect() {
    const wasConnected = this._isConnected;
    this._isConnected = false;
    this._isScanning = false;
    this.devices.clear();
    this.pendingMessages.forEach(({ reject }) => reject(new Error('Disconnected')));
    this.pendingMessages.clear();
    this.onDisconnected?.();

    // Notify Electron about disconnection
    if (wasConnected) {
      const electron = getElectronApi();
      if (electron) {
        electron.setIntifaceStatus(false);
        electron.hapticNotification('intiface-disconnected', '');
      }
    }
  }

  /**
   * Start scanning for devices
   */
  async startScanning(): Promise<void> {
    if (!this._isConnected || this._isScanning) {
      return;
    }

    try {
      await this.sendMessage({
        StartScanning: {
          Id: this.getNextMessageId(),
        },
      });
      this._isScanning = true;
      console.log('[Intiface] Started scanning');
    } catch (err) {
      console.error('[Intiface] Failed to start scanning:', err);
      throw err;
    }
  }

  /**
   * Stop scanning for devices
   */
  async stopScanning(): Promise<void> {
    if (!this._isConnected || !this._isScanning) {
      return;
    }

    try {
      await this.sendMessage({
        StopScanning: {
          Id: this.getNextMessageId(),
        },
      });
      this._isScanning = false;
      console.log('[Intiface] Stopped scanning');
    } catch (err) {
      console.error('[Intiface] Failed to stop scanning:', err);
    }
  }

  /**
   * Get all connected devices
   */
  getDevices(): IntifaceDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Get a specific device by index
   */
  getDevice(index: number): IntifaceDevice | undefined {
    return this.devices.get(index);
  }

  /**
   * Send a vibrate command to a device
   */
  async vibrate(deviceIndex: number, intensity: number, motorIndex?: number): Promise<void> {
    const device = this.devices.get(deviceIndex);
    if (!device?.messageTypes.ScalarCmd) {
      throw new Error('Device does not support vibration');
    }

    const speeds: { Index: number; Scalar: number; ActuatorType: string }[] = [];

    if (motorIndex !== undefined) {
      speeds.push({ Index: motorIndex, Scalar: intensity, ActuatorType: 'Vibrate' });
    } else {
      // Vibrate all motors
      device.messageTypes.ScalarCmd.forEach((actuator, index) => {
        if (actuator.actuatorType === 'Vibrate') {
          speeds.push({ Index: index, Scalar: intensity, ActuatorType: 'Vibrate' });
        }
      });
    }

    await this.sendMessage({
      ScalarCmd: {
        Id: this.getNextMessageId(),
        DeviceIndex: deviceIndex,
        Scalars: speeds,
      },
    });
  }

  /**
   * Send a rotate command to a device
   */
  async rotate(deviceIndex: number, speed: number, clockwise: boolean = true): Promise<void> {
    const device = this.devices.get(deviceIndex);
    if (!device?.messageTypes.RotateCmd) {
      throw new Error('Device does not support rotation');
    }

    const rotations = device.messageTypes.RotateCmd.map((_, index) => ({
      Index: index,
      Speed: speed,
      Clockwise: clockwise,
    }));

    await this.sendMessage({
      RotateCmd: {
        Id: this.getNextMessageId(),
        DeviceIndex: deviceIndex,
        Rotations: rotations,
      },
    });
  }

  /**
   * Send a linear command (for strokers)
   */
  async linear(deviceIndex: number, position: number, duration: number): Promise<void> {
    const device = this.devices.get(deviceIndex);
    if (!device?.messageTypes.LinearCmd) {
      throw new Error('Device does not support linear movement');
    }

    const vectors = device.messageTypes.LinearCmd.map((_, index) => ({
      Index: index,
      Duration: duration,
      Position: position,
    }));

    await this.sendMessage({
      LinearCmd: {
        Id: this.getNextMessageId(),
        DeviceIndex: deviceIndex,
        Vectors: vectors,
      },
    });
  }

  /**
   * Stop all device activity
   */
  async stopDevice(deviceIndex: number): Promise<void> {
    await this.sendMessage({
      StopDeviceCmd: {
        Id: this.getNextMessageId(),
        DeviceIndex: deviceIndex,
      },
    });
  }

  /**
   * Stop all devices
   */
  async stopAllDevices(): Promise<void> {
    await this.sendMessage({
      StopAllDevices: {
        Id: this.getNextMessageId(),
      },
    });
  }

  /**
   * Get battery level (0-1)
   */
  async getBatteryLevel(deviceIndex: number): Promise<number> {
    const device = this.devices.get(deviceIndex);
    if (!device?.messageTypes.BatteryLevelCmd) {
      throw new Error('Device does not support battery level');
    }

    const response = await this.sendMessage({
      BatteryLevelCmd: {
        Id: this.getNextMessageId(),
        DeviceIndex: deviceIndex,
      },
    });

    return response.BatteryLevelReading?.BatteryLevel ?? 0;
  }

  /**
   * Connection status
   */
  get isConnected(): boolean {
    return this._isConnected;
  }

  get isScanning(): boolean {
    return this._isScanning;
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private getNextMessageId(): number {
    return this.messageId++;
  }

  private async sendMessage(message: ButtplugMessage): Promise<any> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected');
    }

    return new Promise((resolve, reject) => {
      const messageKey = Object.keys(message)[0];
      const messageId = message[messageKey].Id;

      this.pendingMessages.set(messageId, { resolve, reject });

      // Set timeout for response
      setTimeout(() => {
        if (this.pendingMessages.has(messageId)) {
          this.pendingMessages.delete(messageId);
          reject(new Error('Message timeout'));
        }
      }, 10000);

      this.socket!.send(JSON.stringify([message]));
    });
  }

  private handleMessage(data: string) {
    try {
      const messages = JSON.parse(data) as ButtplugMessage[];

      for (const msg of messages) {
        const messageType = Object.keys(msg)[0];
        const payload = msg[messageType];

        switch (messageType) {
          case 'Ok':
          case 'ServerInfo':
            this.handleResponse(payload.Id, msg);
            break;

          case 'Error':
            this.handleError(payload);
            break;

          case 'DeviceAdded':
            this.handleDeviceAdded(payload);
            break;

          case 'DeviceRemoved':
            this.handleDeviceRemoved(payload);
            break;

          case 'BatteryLevelReading':
            this.handleResponse(payload.Id, msg);
            break;

          case 'ScanningFinished':
            this._isScanning = false;
            console.log('[Intiface] Scanning finished');
            break;

          default:
            console.log('[Intiface] Unknown message:', messageType, payload);
        }
      }
    } catch (err) {
      console.error('[Intiface] Failed to parse message:', err);
    }
  }

  private handleResponse(messageId: number, response: any) {
    const pending = this.pendingMessages.get(messageId);
    if (pending) {
      this.pendingMessages.delete(messageId);
      pending.resolve(response);
    }
  }

  private handleError(payload: { Id: number; ErrorCode: number; ErrorMessage: string }) {
    console.error('[Intiface] Error:', payload.ErrorMessage);

    const pending = this.pendingMessages.get(payload.Id);
    if (pending) {
      this.pendingMessages.delete(payload.Id);
      pending.reject(new Error(payload.ErrorMessage));
    }

    this.onError?.(payload.ErrorMessage);
  }

  private handleDeviceAdded(payload: any) {
    const device: IntifaceDevice = {
      index: payload.DeviceIndex,
      name: payload.DeviceName,
      messageTypes: {},
    };

    // Parse device capabilities
    if (payload.DeviceMessages) {
      if (payload.DeviceMessages.ScalarCmd) {
        device.messageTypes.ScalarCmd = payload.DeviceMessages.ScalarCmd;
      }
      if (payload.DeviceMessages.RotateCmd) {
        device.messageTypes.RotateCmd = payload.DeviceMessages.RotateCmd;
      }
      if (payload.DeviceMessages.LinearCmd) {
        device.messageTypes.LinearCmd = payload.DeviceMessages.LinearCmd;
      }
      if (payload.DeviceMessages.BatteryLevelCmd) {
        device.messageTypes.BatteryLevelCmd = true;
      }
    }

    this.devices.set(device.index, device);
    console.log('[Intiface] Device added:', device.name);
    this.onDeviceAdded?.(device);

    // Show native notification in Electron
    const electron = getElectronApi();
    if (electron) {
      electron.hapticNotification('device-connected', device.name);
    }
  }

  private handleDeviceRemoved(payload: { DeviceIndex: number }) {
    const device = this.devices.get(payload.DeviceIndex);
    const deviceName = device?.name || 'Device';
    this.devices.delete(payload.DeviceIndex);
    console.log('[Intiface] Device removed:', payload.DeviceIndex);
    this.onDeviceRemoved?.(payload.DeviceIndex);

    // Show native notification in Electron
    const electron = getElectronApi();
    if (electron) {
      electron.hapticNotification('device-disconnected', deviceName);
    }
  }
}

// Export singleton instance
export const intifaceService = new IntifaceService();
export default intifaceService;
