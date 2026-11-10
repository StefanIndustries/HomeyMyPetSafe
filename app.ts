import Homey from 'homey';
import { PetSafeClient } from "mypetsafe/lib/mypetsafe-client";
import PairSession from "homey/lib/PairSession";
import {DeviceScoopfree, DeviceSmartFeed} from "mypetsafe/lib/devices";
import {FeederDriver} from "./drivers/feeder/driver";
import type {SmartPetFeederDevice, WidgetState} from "./drivers/feeder/device";

export class MyPetSafeApp extends Homey.App {
  public petSafeClient?: PetSafeClient;
  private updateDevicesPollingIntervalId: any;
  public feeders: DeviceSmartFeed[] = [];
  public scoopers: DeviceScoopfree[] = [];

  async onInit() {
    this.log('MyPetSafeApp has been initialized');
    await this.initPetSafeClient();
    if (!this.updateDevicesPollingIntervalId) {
      this.updateDevicesPollingIntervalId = this.homey.setInterval(this.updateDeviceData, 300000);
    }
    // Fetch once right away instead of waiting for the first 5-minute poll.
    this.updateDeviceData().catch(this.error);

    this.homey.dashboards.getWidget('feeder').registerSettingAutocompleteListener('device', async (query: string) => {
      return this.getFeederDevices()
        .map(device => ({ name: device.getName(), id: String(device.getData().id) }))
        .filter(result => result.name.toLowerCase().includes(query.trim().toLowerCase()));
    });
  }

  private getFeederDevices(): SmartPetFeederDevice[] {
    return this.homey.drivers.getDriver('feeder').getDevices() as SmartPetFeederDevice[];
  }

  /**
   * The feeder a widget shows. Without a selection, the only paired feeder is used,
   * so the widget works without configuration.
   */
  private getWidgetDevice(deviceId?: string): SmartPetFeederDevice {
    const devices = this.getFeederDevices();
    if (!deviceId) {
      if (devices.length === 1) return devices[0];
      throw new Error(this.homey.__(devices.length === 0 ? 'widget.errors.no_devices' : 'widget.errors.select_device'));
    }
    // The widget sends the id as a query string, so compare as strings: PetSafe ids can be numbers.
    const device = devices.find(d => String(d.getData().id) === String(deviceId));
    if (!device) throw new Error(this.homey.__('widget.errors.device_not_found'));
    return device;
  }

  public async getWidgetState(deviceId?: string): Promise<WidgetState> {
    return this.getWidgetDevice(deviceId).getWidgetState();
  }

  public async feedFromWidget(deviceId?: string): Promise<void> {
    await this.getWidgetDevice(deviceId).triggerFeed();
  }

  private async initPetSafeClient() {
    this.log('initPetSafeClient');
    const accessToken = this.homey.settings.get("accessToken");
    const email = this.homey.settings.get("email");
    if (accessToken && email && accessToken !== "" && email !== "") {
      this.log('initPetSafeClient: tokens found');
      const idToken = this.homey.settings.get("idToken");
      const refreshToken = this.homey.settings.get("refreshToken");
      const session = this.homey.settings.get("session");
      this.petSafeClient = new PetSafeClient(email, idToken, refreshToken, accessToken, session);
      this.petSafeClient.onTokenRefreshed(() => this.updateTokensInStorage());
    } else {
      this.log('initPetSafeClient: no tokens found');
    }
  }

  public updateDeviceData = async () => {
    this.log('updateDeviceData');
    if (!this.petSafeClient) return false;
    try {
      this.feeders = await this.petSafeClient.getFeeders();
      await this.homey.drivers.getDriver('feeder').ready();
      const feederDriver = <FeederDriver> this.homey.drivers.getDriver('feeder');
      feederDriver.setFeederData(this.feeders);
      return true;
    } catch (e) {
      this.error('updateDeviceData: error updating feeder data', e);
      return false;
    }
    // this.scoopers = await this.petSafeClient!.getLitterboxes();
  }

  public pairingInitializeAccount(session: PairSession) {
    let email = '';
    let emailError: string | undefined;

    session.setHandler('showView', async (view) => {
      if (view === 'prepare_pair') {
        if (this.petSafeClient && this.petSafeClient.getAccessToken) {
          await session.showView('list_devices');
        } else {
          await session.showView('email');
        }
      }

      // Homey's own Continue button can't be intercepted in a custom view, so the
      // code is requested here, once Homey has moved on to the pincode view.
      if (view === 'pincode') {
        emailError = await this.requestPairingCode(email);
        if (emailError) await session.showView('email');
      }
    });

    // The email view reports what the user typed; nothing is sent to PetSafe yet.
    session.setHandler('email_changed', async (data: {email: string}) => {
      email = data.email.trim();
      return true;
    });

    // The email view asks for this when it opens, to refill the field and show any error.
    session.setHandler('email_view_loaded', async () => {
      const result = {email, error: emailError};
      emailError = undefined;
      return result;
    });

    session.setHandler("pincode", async (pincode) => {
      this.log('pair: pincode submitted');
      const pinCodeAsString = pincode.join("");
      await this.petSafeClient!.requestTokensFromCode(pinCodeAsString);
      this.homey.settings.set("email", email);
      this.updateTokensInStorage();
      this.petSafeClient!.onTokenRefreshed(() => this.updateTokensInStorage());
      return true;
    });
  }

  /** Requests a pairing code by email. Returns a translated error message, or undefined on success. */
  private async requestPairingCode(email: string): Promise<string | undefined> {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return this.homey.__('errors.invalid_email');
    }
    try {
      this.petSafeClient = new PetSafeClient(email);
      await this.petSafeClient.requestCode();
      this.log('pair: code requested');
      return undefined;
    } catch (e) {
      this.error('pair: requesting code failed', e);
      return this.homey.__('errors.request_code_failed');
    }
  }

  private updateTokensInStorage() {
    if (this.petSafeClient) {
      this.homey.settings.set("accessToken", this.petSafeClient!.getAccessToken);
      this.homey.settings.set("idToken", this.petSafeClient!.getIdToken);
      this.homey.settings.set("refreshToken", this.petSafeClient!.getRefreshToken);
      this.homey.settings.set("session", this.petSafeClient!.getSession);
    }
  }
}

module.exports = MyPetSafeApp;
