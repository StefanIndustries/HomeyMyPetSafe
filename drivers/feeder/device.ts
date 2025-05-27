import Homey from 'homey';
import {DeviceSmartFeed} from "mypetsafe/lib/devices";

export class SmartPetFeederDevice extends Homey.Device {
  private feeder?: DeviceSmartFeed;

  public setData(feeder: DeviceSmartFeed) {
    this.feeder = feeder;
    this.setCapabilityValue('measure_battery', feeder.batteryLevel).catch(this.error);
    this.setCapabilityValue('alarm_battery', feeder.batteryLevel < 10).catch(this.error);
  }

  async onInit() {
    this.log('SmartPetFeederDevice has been initialized');
  }
}

module.exports = SmartPetFeederDevice;