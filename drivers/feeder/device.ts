import Homey from 'homey';
import {DeviceSmartFeed} from "mypetsafe/lib/devices";
import type {MyPetSafeApp} from "../../app";

export interface WidgetState {
  name: string;
  available: boolean;
  food: 'ok' | 'low' | 'empty';
  lastFed: string | null;
  locked: boolean;
}

export const REFRESH_AFTER_FEED_MS = 5000;

export class SmartPetFeederDevice extends Homey.Device {
  private feeder?: DeviceSmartFeed;
  private refreshAfterFeedTimeout?: NodeJS.Timeout;

  public setData(feeder: DeviceSmartFeed) {
    this.feeder = feeder;
    this.setCapabilityValue('measure_battery', feeder.batteryLevel).catch(this.error);
    this.updateAlarm('alarm_low_food', feeder.foodLowStatus > 0, 'low_food').catch(this.error);
    this.updateAlarm('alarm_no_food', feeder.foodLowStatus > 1, 'no_food').catch(this.error);
    this.setCapabilityValue('alarm_power', !feeder.isAdapterInstalled).catch(this.error);
    this.setCapabilityValue('locked', feeder.isLocked).catch(this.error);
    this.updateLastFeedingTime(feeder).catch(this.error);
    this.setAvailable().catch(this.error);
  }

  /**
   * Custom capabilities don't get automatic flow cards, so fire the
   * `<prefix>_true` / `<prefix>_false` trigger ourselves when the value changes.
   */
  private async updateAlarm(capability: string, value: boolean, triggerPrefix: string) {
    const previous = this.getCapabilityValue(capability);
    await this.setCapabilityValue(capability, value);
    if (previous === null || previous === value) return;
    await this.homey.flow
      .getDeviceTriggerCard(`${triggerPrefix}_${value}`)
      .trigger(this);
  }

  /**
   * Picks the most recent feeding ourselves: PetSafe returns messages oldest first, and
   * mypetsafe <= 1.5.0's getLastFeeding() returned the first one, i.e. a week-old feeding.
   */
  private async getLatestFeeding(feeder: DeviceSmartFeed) {
    const messages = await feeder.getMessagesSince();
    let latest: (typeof messages)[number] | null = null;
    for (const message of messages) {
      if (message.message_type !== 'FEED_DONE' || !message.created_at) continue;
      if (!latest || Date.parse(message.created_at) > Date.parse(latest.created_at)) latest = message;
    }
    return latest;
  }

  private async updateLastFeedingTime(feeder: DeviceSmartFeed) {
    const message = await this.getLatestFeeding(feeder);
    if (!message?.created_at) return;
    const timezone = await this.homey.clock.getTimezone();
    const formatter = new Intl.DateTimeFormat([], {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const timeParts = formatter.formatToParts(new Date(message.created_at));
    const hour = timeParts.find(part => part.type === 'hour')!.value;
    const minute = timeParts.find(part => part.type === 'minute')!.value;
    await this.setCapabilityValue('last_feeding_time', `${hour}:${minute}`);
    await this.setStoreValue('lastFeedingAt', message.created_at);
  }

  public async getWidgetState(): Promise<WidgetState> {
    return {
      name: this.getName(),
      available: this.getAvailable(),
      food: this.isOutOfFood() ? 'empty' : this.isLowOnFood() ? 'low' : 'ok',
      lastFed: await this.getLastFedLabel(),
      locked: this.getCapabilityValue('locked') === true,
    };
  }

  /** "Last fed today at 08:30", "yesterday at …" or "on Mon 3 Nov at …", in Homey's timezone. */
  private async getLastFedLabel(): Promise<string | null> {
    const lastFeedingAt = this.getStoreValue('lastFeedingAt');
    if (!lastFeedingAt) return null;
    const timeZone = await this.homey.clock.getTimezone();
    const language = this.homey.i18n.getLanguage();
    const fed = new Date(lastFeedingAt);
    const dayKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
    const time = new Intl.DateTimeFormat(language, { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).format(fed);
    const now = new Date();
    if (dayKey(fed) === dayKey(now)) return this.homey.__('widget.last_fed_today', { time });
    if (dayKey(fed) === dayKey(new Date(now.getTime() - 86400000))) return this.homey.__('widget.last_fed_yesterday', { time });
    const date = new Intl.DateTimeFormat(language, { timeZone, weekday: 'short', day: 'numeric', month: 'short' }).format(fed);
    return this.homey.__('widget.last_fed_date', { date, time });
  }

  async onInit() {
    this.log('SmartPetFeederDevice has been initialized');
    // alarm_battery was dropped in 1.0.6: Homey doesn't allow it together with measure_battery.
    if (this.hasCapability('alarm_battery')) await this.removeCapability('alarm_battery').catch(this.error);
    await this.registerCapabilityListeners();

    // The app may already have fetched data before this device finished initializing.
    const feeder = this.findFeeder();
    if (feeder) this.setData(feeder);
  }

  private findFeeder(): DeviceSmartFeed | undefined {
    return (this.homey.app as MyPetSafeApp).feeders.find(feed => feed.id === this.getData().id);
  }

  /** Returns the feeder, fetching it first if the app hasn't loaded data yet. */
  private async getFeeder(): Promise<DeviceSmartFeed> {
    if (this.feeder) return this.feeder;
    await (this.homey.app as MyPetSafeApp).updateDeviceData();
    const feeder = this.findFeeder();
    if (!feeder) throw new Error(this.homey.__('errors.feeder_unavailable'));
    return feeder;
  }

  async onDeleted() {
    this.homey.clearTimeout(this.refreshAfterFeedTimeout);
  }

  async onAdded() {
    await (this.homey.app as MyPetSafeApp).updateDeviceData();
  }

  private async registerCapabilityListeners() {
    this.registerCapabilityListener("button_feed", async () => {
      await this.triggerFeed();
    });

    this.registerCapabilityListener("locked", async (value: boolean) => {
      const feeder = await this.getFeeder();
      // Optimistic update: re-reading straight after the PUT can return the old value.
      await feeder.lock(value);
      this.setData(feeder);
    });
  }

  /** @param amount portion size in 1/8 cups, as used by the PetSafe API */
  public async triggerFeed(amount = 1) {
    const feeder = await this.getFeeder();
    await feeder.feed(amount, false, true);
    this.setData(feeder);

    // PetSafe logs the feeding a few seconds after the meal; refresh then for the new feed time.
    this.homey.clearTimeout(this.refreshAfterFeedTimeout);
    this.refreshAfterFeedTimeout = this.homey.setTimeout(() => {
      feeder.updateData()
        .then(() => this.setData(feeder))
        .catch(this.error);
    }, REFRESH_AFTER_FEED_MS);
  }

  public isLowOnFood(): boolean {
    return this.getCapabilityValue('alarm_low_food') === true;
  }

  public isOutOfFood(): boolean {
    return this.getCapabilityValue('alarm_no_food') === true;
  }
}

module.exports = SmartPetFeederDevice;
