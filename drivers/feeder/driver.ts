import Homey from 'homey';
import PairSession from "homey/lib/PairSession";
import {MyPetSafeApp} from "../../app";
import {DeviceSmartFeed} from "mypetsafe/lib/devices";
import {SmartPetFeederDevice} from "./device";

export class FeederDriver extends Homey.Driver {
  private readonly app = this.homey.app as MyPetSafeApp;
  private feeders: DeviceSmartFeed[] = [];

  public setFeederData(feeders: DeviceSmartFeed[]) {
    this.feeders = feeders;
    this.getDevices().forEach(device => {
      const feeder = this.feeders.find(feed => feed.id === device.getData().id);
      if (feeder) {
        const homeyFeeder = device as SmartPetFeederDevice;
        homeyFeeder.setData(feeder);
      }
    });
  }

  async onInit() {
    this.log('FeederDriver has been initialized');

    this.homey.flow.getActionCard('feed_now').registerRunListener(async (args, state) => {
      const device = args.device as SmartPetFeederDevice;
      await device.triggerFeed();
    });
  }

  async onPair(session: PairSession) {
    this.log('starting a new pair session');
    this.app.pairingInitializeAccount(session);

    session.setHandler('list_devices', async () => {
      this.log('pair: list_devices');
      const foundDevices = await this.app.petSafeClient!.getFeeders();
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
}

module.exports = FeederDriver;