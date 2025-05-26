import Homey from 'homey';

class MyPetSafeApp extends Homey.App {

  /**
   * onInit is called when the app is initialized.
   */
  async onInit() {
    this.log('MyPetSafeApp has been initialized');
  }

}

module.exports = MyPetSafeApp;
