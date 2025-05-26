import Homey from 'homey';
import PairSession from "homey/lib/PairSession";
import {PetSafeClient} from "mypetsafe/lib/mypetsafe-client";

module.exports = class MyDriver extends Homey.Driver {
  psClient: PetSafeClient | undefined;
  email: string | undefined;
  accessToken: string | undefined;
  idToken: string | undefined;
  refreshToken: string | undefined;
  session: string | undefined;

  async onInit() {
    this.log('MyDriver has been initialized');
    this.accessToken = this.homey.settings.get("accessToken");
    this.email = this.homey.settings.get("email");
    if (this.accessToken && this.email && this.accessToken !== "" && this.email !== "") {
      this.idToken = this.homey.settings.get("idToken");
      this.refreshToken = this.homey.settings.get("refreshToken");
      this.session = this.homey.settings.get("session");
      this.psClient = new PetSafeClient(this.email!, this.idToken, this.refreshToken, this.accessToken, this.session);
    }
  }

  async onPair(session: PairSession) {
    this.log('starting a new pair session');

    session.setHandler('showView', async (view) => {
      if (view === 'prepare_pair') {
        if (this.psClient && this.psClient.getAccessToken) {
          await session.showView('list_devices');
        } else {
          await session.showView('email');
        }
      }
    });

    session.setHandler('email_submitted', async (data: {email: string}) => {
      this.email = data.email;
      this.log('pair: email submitted', this.email);
      this.psClient = new PetSafeClient(this.email);
      this.log('petsafeclient created, requesting code now');
      await this.psClient.requestCode();
      this.log('code requested');
      return true;
    });

    session.setHandler("pincode", async (pincode) => {
      this.log('pair: pincode submitted');
      const pinCodeAsString = pincode.join("");
      await this.psClient!.requestTokensFromCode(pinCodeAsString);
      this.homey.settings.set("accessToken", this.psClient!.getAccessToken);
      this.homey.settings.set("idToken", this.psClient!.getIdToken);
      this.homey.settings.set("refreshToken", this.psClient!.getRefreshToken);
      this.homey.settings.set("session", this.psClient!.getSession);
      return true;
    });

    session.setHandler('list_devices', async () => {
      this.log('pair: list_devices');
      const foundDevices = await this.psClient!.getFeeders();
      const mappedDevices = foundDevices.map(device => {
        return {
          name: device.friendlyName,
          data: {
            id: device.id
          },
          icon: 'default.svg'
        }
      });
      return foundDevices;
    });
  }

};
