import Homey from 'homey';
import {DeviceSmartFeed} from "mypetsafe/lib/devices";

export class SmartPetFeederDevice extends Homey.Device {
  private feeder?: DeviceSmartFeed;

  public setData(feeder: DeviceSmartFeed) {
    this.feeder = feeder;
    this.log(feeder.toJSON());
    this.setCapabilityValue('measure_battery', feeder.batteryLevel).catch(this.error);
    this.setCapabilityValue('alarm_low_food', feeder.foodLowStatus > 0).catch(this.error);
    this.setCapabilityValue('alarm_no_food', feeder.foodLowStatus > 1).catch(this.error);
    this.setCapabilityValue('alarm_power', !feeder.isAdapterInstalled).catch(this.error);
    this.setCapabilityValue('alarm_battery', !feeder.isBatteriesInstalled || feeder.batteryLevel < 10).catch(this.error);
    feeder.getLastFeeding().then(message => {
      this.setCapabilityValue('last_feeding_time', message?.created_at).catch(this.error);
    });
    this.setAvailable().catch(this.error);
  }

  async onInit() {
    this.log('SmartPetFeederDevice has been initialized');
    await this.setUnavailable('Initializing, this takes ~5 minutes...')
  }
}

module.exports = SmartPetFeederDevice;