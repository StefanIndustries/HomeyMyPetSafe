import Homey from 'homey/lib/Homey';
import {MyPetSafeApp} from "../../app";

interface WidgetApiArgs {
  homey: Homey;
  query: Record<string, string | undefined>;
  body: { deviceId?: string };
}

module.exports = {
  async getState({ homey, query }: WidgetApiArgs) {
    return (homey.app as MyPetSafeApp).getWidgetState(query.deviceId || undefined);
  },

  async feed({ homey, body }: WidgetApiArgs) {
    await (homey.app as MyPetSafeApp).feedFromWidget(body.deviceId || undefined);
    return { ok: true };
  },
};
