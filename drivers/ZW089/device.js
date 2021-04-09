'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');

class AeotecDevice extends ZwaveDevice {
	
	async onNodeInit() {
		// this.enableDebug();
		// this.printNode();

		// register the measure_battery capability with COMMAND_CLASS_BATTERY
		this.registerCapability('measure_battery', 'BATTERY');
	}
	
}

module.exports = AeotecDevice;