import Homey from 'homey';
import {DeviceSmartFeed} from "mypetsafe/lib/devices";

export class SmartPetFeederDevice extends Homey.Device {
  private feeder?: DeviceSmartFeed;

  public setData(feeder: DeviceSmartFeed) {
    this.feeder = feeder;
    this.setCapabilityValue('measure_battery', feeder.batteryLevel).catch(this.error);
    this.setCapabilityValue('alarm_low_food', feeder.foodLowStatus > 0).catch(this.error);
    this.setCapabilityValue('alarm_no_food', feeder.foodLowStatus > 1).catch(this.error);
    this.setCapabilityValue('alarm_power', !feeder.isAdapterInstalled).catch(this.error);
    this.setCapabilityValue('alarm_battery', !feeder.isBatteriesInstalled || feeder.batteryLevel < 10).catch(this.error);
    this.setCapabilityValue('locked', !feeder.isLocked).catch(this.error);
    feeder.getLastFeeding().then(async (message) => {
      const messageCreatedAt = message?.created_at!;
      const timezone = await this.homey.clock.getTimezone();
      const formatter = new Intl.DateTimeFormat([], {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const timeParts = formatter.formatToParts(new Date(messageCreatedAt));
      const hour = timeParts.find(part => part.type === 'hour')!.value;
      const minute = timeParts.find(part => part.type === 'minute')!.value;
      this.setCapabilityValue('last_feeding_time', `${hour}:${minute}`).catch(this.error);
    });
    this.setAvailable().catch(this.error);
  }

  async onInit() {
    this.log('SmartPetFeederDevice has been initialized');
    await this.setUnavailable('Initializing, this takes ~5 minutes...');
    await this.registerCapabilityListeners();
  }

  private async registerCapabilityListeners() {
    this.registerCapabilityListener("button_feed", async (value) => {
      await this.triggerFeed();
    });

    this.registerCapabilityListener("locked", async (value) => {
      if (this.feeder === undefined) return;
      await this.feeder?.putSetting('child_lock', value, true);
      this.setData(this.feeder);
    });
  }

  public async triggerFeed() {
    if (this.feeder === undefined) return;
    await this.feeder.feed(1, false, true);
    this.setData(this.feeder);
  }
}

module.exports = SmartPetFeederDevice;