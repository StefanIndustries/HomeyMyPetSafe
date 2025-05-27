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
  }

  async onPair(session: PairSession) {
    this.log('starting a new pair session');
    this.app.pairingInitializeAccount(session);
  }
}

module.exports = FeederDriver;