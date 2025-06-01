import Homey from 'homey';
import { PetSafeClient } from "mypetsafe/lib/mypetsafe-client";
import PairSession from "homey/lib/PairSession";
import {DeviceScoopfree, DeviceSmartFeed} from "mypetsafe/lib/devices";
import {FeederDriver} from "./drivers/feeder/driver";

export class MyPetSafeApp extends Homey.App {
  private petSafeClient?: PetSafeClient;
  private updateDevicesPollingIntervalId: any;
  public feeders: DeviceSmartFeed[] = [];
  public scoopers: DeviceScoopfree[] = [];

  async onInit() {
    this.log('MyPetSafeApp has been initialized');
    await this.initPetSafeClient();
    if (!this.updateDevicesPollingIntervalId) {
      this.updateDevicesPollingIntervalId = this.homey.setInterval(this.updateDeviceData, 300000);
    }
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

  private updateDeviceData = async () => {
    this.log('updateDeviceData');
    this.feeders = await this.petSafeClient!.getFeeders();
    try {
      const feederDriver = <FeederDriver> this.homey.drivers.getDriver('feeder');
      await new Promise(resolve => setTimeout(resolve, 1000));
      feederDriver.setFeederData(this.feeders);
      return true;
    } catch (e) {
      return false;
      this.log('updateDeviceData: error setting feeder data', e);
    }
    // this.scoopers = await this.petSafeClient!.getLitterboxes();
  }

  public pairingInitializeAccount(session: PairSession) {
    var email: string | undefined;
    session.setHandler('showView', async (view) => {
      if (view === 'prepare_pair') {
        if (this.petSafeClient && this.petSafeClient.getAccessToken) {
          await session.showView('list_devices');
        } else {
          await session.showView('email');
        }
      }
    });

    session.setHandler('email_submitted', async (data: {email: string}) => {
      email = data.email;
      this.log('pair: email submitted', email);
      this.petSafeClient = new PetSafeClient(email);
      this.log('petsafeclient created, requesting code now');
      await this.petSafeClient.requestCode();
      this.log('code requested');
      return true;
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

    session.setHandler('list_devices', async () => {
      this.log('pair: list_devices');
      const foundDevices = await this.petSafeClient!.getFeeders();
      this.feeders = foundDevices;
      const mappedDevices = this.feeders.map(device => {
        return {
          name: device.friendlyName,
          data: {
            id: device.id
          },
          icon: 'default.svg'
        }
      });
      return mappedDevices;
    });
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
