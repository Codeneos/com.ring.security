'use strict';

const { ZwaveDevice } = require('homey-zwavedriver');
const delay = time => new Promise(res=>setTimeout(res,time));

const COMMAND_CLASS_INDICATOR_ID = 0x87;
const COMMAND_INDICATOR_SET_ID = 0x01;
// Indicator IDs
const INDICATOR_ID_NOT_ARMED = 0x02;
const INDICATOR_ID_OK = 0x08;
const INDICATOR_ID_NOT_OK = 0x09;
const INDICATOR_ID_ARMED_HOME = 0x0A;
const INDICATOR_ID_ARMED_AWAY = 0x0B;
const INDICATOR_ID_BYPASS = 0x10;
const INDICATOR_ID_ENTRY_DELAY = 0x11;
const INDICATOR_ID_EXIT_DELAY = 0x12;
// Indicator Values
const INDICATOR_VALUE_OFF = 0x00;
const INDICATOR_VALUE_ON = 0xFF;
//Property IDs
const PROPERTY_ID_MULTILEVEL = 0x01;
const PROPERTY_ID_BINARY = 0x02;
// Indicator commandos
const INDICATOR_DISARMED = { id: INDICATOR_ID_NOT_ARMED,property: PROPERTY_ID_BINARY,value: INDICATOR_VALUE_ON, }
const INDICATOR_OK = { id: INDICATOR_ID_OK,property: PROPERTY_ID_BINARY,value: INDICATOR_VALUE_ON, }
const INDICATOR_NOT_OK = { id: INDICATOR_ID_NOT_OK,property: PROPERTY_ID_BINARY,value: INDICATOR_VALUE_ON, }
const INDICATOR_ARMED_HOME = { id: INDICATOR_ID_ARMED_HOME,property: PROPERTY_ID_BINARY,value: INDICATOR_VALUE_ON, }
const INDICATOR_ARMED_AWAY = { id: INDICATOR_ID_ARMED_AWAY,property: PROPERTY_ID_BINARY,value: INDICATOR_VALUE_ON, }
const INDICATOR_ARMED_BYPASS = { id: INDICATOR_ID_BYPASS,property: PROPERTY_ID_BINARY,value: INDICATOR_VALUE_ON, }
const INDICATOR_ENTRY_DELAY = { id: INDICATOR_ID_ENTRY_DELAY,property: PROPERTY_ID_BINARY,value: INDICATOR_VALUE_ON, }
const INDICATOR_EXIT_DELAY = { id: INDICATOR_ID_EXIT_DELAY,property: PROPERTY_ID_BINARY,value: INDICATOR_VALUE_ON, }

class RingDevice extends ZwaveDevice {

  async onNodeInit() {
    // this.enableDebug();
    // this.printNode();
    // const commandClassIndicator = this.getCommandClass('INDICATOR');
    // this.log("Indicator",commandClassIndicator);

    // register the measure_battery capability with COMMAND_CLASS_BATTERY
    this.registerCapability('measure_battery', 'BATTERY');

    // register flow cards
    // Triggers
    this.sendPincodeTrigger = this.homey.flow.getDeviceTriggerCard('4AK1SZ-0EU0-sendPincode');
    this.sendEmergencyTrigger = this.homey.flow.getDeviceTriggerCard('4AK1SZ-0EU0-sendEmergencyKey');
    // Conditions
    // Actions

    // register listener for Heimdall events
    this.homey.app.heimdallApp
      .on('realtime', (result,detail) => {
          this.updateKeypadFromHeimdall(result,detail);
      })

    // register listener for NOTIFICATION REPORT
    this.registerReportListener('NOTIFICATION', 'NOTIFICATION_REPORT', report =>  {
      switch (report['Notification Type']) {
        case "Power Management":
          if ( report['Event (Parsed)'] == "AC mains disconnected" || report['Event'] == 2 ) {
            // The AC Mains power is lost
            this.log("Power Management: The AC Mains connection to the Keypad is lost");
            if ( this.getSetting('usetamper') ) {
              this.setCapabilityValue('alarm_tamper', true)
              this.log("Use Tamper alarm is true, AC Mains is lost: Tamper Alarm is activated");
            }
          } else if ( report['Event (Parsed)'] == "AC mains reconnected" || report['Event'] == 3 ) {
            // The AC Mains power is restored
            this.log("Power Management: The AC Mains connection to the Keypad is restored");
            this.setCapabilityValue('alarm_tamper', false)
          }
        break;

        default:
          // this.log("Notificaton default:",report);
      }
    });

    // register listener for ENTRY CONTROL NOTIFICATION
    this.registerReportListener('ENTRY_CONTROL', 'ENTRY_CONTROL_NOTIFICATION', report => {    
      if ( report['Event Type'] == "CACHING" ) return;
      if ( report['Event Data Length'] > 0 ) {
        this.codeString = this.getCodeFromReport(report);
      } else {
        this.codeString = "";
      }

      // TESTCODE TESTCODE TESTCODE TESTCODE TESTCODE 
      // TESTCODE TESTCODE TESTCODE TESTCODE TESTCODE 
      // TESTCODE TESTCODE TESTCODE TESTCODE TESTCODE 
      /*
      if ( report['Event Type'] == "CANCEL" ) {
        console.log("Command CANCEL entered");
        //this.setIndicator(INDICATOR_DISARMED);
        this.node.sendCommand(
          this.IndicatorSet([INDICATOR_DISARMED])
        );
      }
      
      if ( report['Event Type'] == "ENTER" ) {
        console.log("Command ENTER entered");
        this.valueToSend = { id: this.codeString,property: PROPERTY_ID_BINARY,value: 0x00, }
        console.log("value", this.valueToSend)
        //this.setIndicator(this.valueToSend);
        this.node.sendCommand(
          this.IndicatorSet([this.valueToSend,])
        );
        return;
      }
      */
      // TESTCODE TESTCODE TESTCODE TESTCODE TESTCODE 
      // TESTCODE TESTCODE TESTCODE TESTCODE TESTCODE 
      // TESTCODE TESTCODE TESTCODE TESTCODE TESTCODE 

      if ( report['Event Type'] == "POLICE" || report['Event Type'] == "FIRE" || report['Event Type'] == "ALERT_MEDICAL" ) {
        // Trigger flowcard that sends the emergency key
        var tokens = { actionkey: report['Event Type']};
        this.sendEmergencyTrigger.trigger(this, tokens, {})
          .then((result) => {
          })
          .catch((error) => {
            this.log('sendEmergencyTrigger error:', error)
            return this.homey.error(error);
          })
        // Send systemwide event
        this.homey.app.systemEvent("Ring Security", report['Event Type']);

      } else {
        // Trigger flowcard that sends the entered pincode and the action key
        var tokens = { pincode: this.codeString, actionkey: report['Event Type']};
        this.sendPincodeTrigger.trigger(this, tokens, {})
          .then((result) => {
          }) 
          .catch((error) => {
            this.log('sendPincodeTrigger error:', error)
            return this.homey.error(error);
          })
      }

      // Perform remote actions
      // send information to Heimdall when the user has the integration enabled
      if ( this.homey.app.heimdall.valid && this.getSetting('useheimdall') ) {
        let postBody = {
          "APIKEY": this.homey.app.heimdall.apikey,
          "actionReadable": this.homey.__("keypad.buttons.readable."+report['Event Type']),
          "action": this.homey.__("keypad.buttons.action."+report['Event Type']),
          "value": this.codeString,
          "diagnostics": {
              "sourceApp": "Ring Security App",
              "sourceFile": "drivers/4AK1SZ-0EO0/device.js",
              "sourceDevice": this.getName()
          }
        }
        this.homey.app.heimdallApp.post('/keypad/action',postBody)
          .then((result) => {
            this.log('Heimdall API success reply: ', result);
            this.updateKeypadFromHeimdall('Heimdall API Success',result);
          })
          .catch((error) => {
            this.error('Heimdall API ERROR reply: ', error);
            this.updateKeypadFromHeimdall('Heimdall API Error',error);
          });
      }
      this.codeString = "";
    });

    this.log(`Ring Keypad (2nd Gen) "${this.getName()}" capabilities have been initialized`);
  }

  // called from the Heimdall event listener and Heimdall API reply.
  async updateKeypadFromHeimdall(result,detail) {
    if ( !this.getSetting('useheimdall') ) { 
      this.log("Heimdall integaration disabled, do nothing with events from Heimdall")
      return 
    }

    let value = 0;
    switch ( result ) {
      case "Surveillance Mode":
        switch (detail) {
          case "partially_armed":
            this.setIndicator(INDICATOR_ARMED_HOME);
            this.homey.app.heimdall.cancelCountdown = true;
            this.activeSensorWarning = false;
            break;
          case "armed":
            this.setIndicator(INDICATOR_ARMED_AWAY);
            this.homey.app.heimdall.cancelCountdown = true;
            this.activeSensorWarning = false;
            break;
          case "disarmed":
            this.setIndicator(INDICATOR_DISARMED);
            this.homey.app.heimdall.cancelCountdown = true;
            this.activeSensorWarning = false;
            break;
        }
        this.homey.app.heimdall.surveillancemode = detail;
        this.log("The Surveillance Mode is set to: " + detail);
        break;

      case "Arming Delay": case "Alarm Delay":
        //Work in Progress
        /*
        this.homey.app.heimdall.cancelCountdown = false;
        let longDelay = Math.floor(detail/225); // How many times must the longest countdown run?
        let restDelay  = detail-longDelay*225; // how much time left after longest countdown?
        let nextCodeMultiplier = Math.floor(restDelay/15); //how many time does 15 seconds fit in the restDelay
        let nextCode = nextCodeMultiplier*16+6; // run the longest possible delay for the restDelay
        let startLastDelay = (restDelay - nextCodeMultiplier * 15)+1; // run the countdown again to match its endtime with the end of the arming/alarm delay
        let lastDelay = restDelay - startLastDelay; // duration before arming/alarm alert.

        // run the longest countdown untill the restDelay fits an available countdown duration
        for (let i=0; i<longDelay; i++) {
          //this.log("code send:", 246, "Countdown for 225");
          this.setIndicator(246);
          await delay(224000);
        }
        // run the duration of the restDelay if the countdown is still valid
        if ( !this.homey.app.heimdall.cancelCountdown ) {
          this.setIndicator(nextCode);
        }
        await delay(startLastDelay*1000);
        // run the duration of the restDelay, <startLastDelay> seconds after first to match endtime
        if ( !this.homey.app.heimdall.cancelCountdown ) {
          this.setIndicator(nextCode);
        }
        await delay(lastDelay*1000);
        // last alert before arming/alarm
        if ( !this.homey.app.heimdall.cancelCountdown ) {
          if ( this.getSetting('soundBeforeDelayedArm') && result == "Arming Delay" ) {
            this.setIndicator(36);
          } else {
            this.setIndicator(24);
          }
        }
        await delay(500);
        this.homey.app.heimdall.cancelCountdown = false;
        */
        break;

      case "Sensor State at Arming":
        if ( this.activeSensorWarning || this.getSetting('ignoreActiveSensorWarning') ) return;
        this.log("Sensor State at Arming:", detail)
        if ( detail = "Active" ) {
          this.activeSensorWarning = true;
          await delay(1100);
          this.setIndicator(INDICATOR_ARMED_BYPASS);
        }
        break;

      case "Last Door function":
        this.log("Last Door function:", detail)
        // Work in Progress
        /*
        if ( this.getSetting('soundBeforeDelayedArm') ) {
          if ( !this.homey.app.heimdall.cancelCountdown ) {
            this.setIndicator(36);
          }
          await delay(200);
          if ( !this.homey.app.heimdall.cancelCountdown ) {
            this.setIndicator(22);
          }
          await delay(7800);
          if ( !this.homey.app.heimdall.cancelCountdown ) {
            this.setIndicator(36);
          }
        } else {
          this.setIndicator(22);
        }
        this.homey.app.heimdall.cancelCountdown = true;
        */
        break;
        
      case "Alarm Status":
        this.log("Received an Alarm State of:", detail)
        // Work in Progress
        /*
        if ( detail ) {
          if ( this.getSetting('usesiren') != "0" ) { 
            this.setIndicator(this.getSetting('usesiren'));
          }
        } else {
          this.setIndicator(51);
          await delay(500);
          switch ( this.homey.app.heimdall.surveillancemode) {
            case "partially_armed":
              this.setIndicator(49);
              break;
            case "armed":
              this.setIndicator(50);
              break;
          }
        }
        */
        break;
      
      case "Heimdall API Success": case"Heimdall API Error":
        if ( result == "Heimdall API Error" || detail == "Invalid code entered. Logline written, no further action" ) {
          this.setIndicator(INDICATOR_NOT_OK);
        }
        return;
        break;

      default:
        // console.log(result, detail)

    }
  }
  
  async setIndicator(value) {
    this.log("Value received to send to indicator: ", value);
    this.node.sendCommand(
      this.IndicatorSet([value,])
    );
  }

  IndicatorSet(indicators) {
    return {
      commandClassId: COMMAND_CLASS_INDICATOR_ID,
      commandId: COMMAND_INDICATOR_SET_ID,
      params: Buffer.from([
        // Indicator 0 Value
        INDICATOR_VALUE_OFF,
        // Indicator Object Count (5 bits)
        indicators.length,
        ...indicators.flatMap((indicator) => [
          indicator.id,
          indicator.property,
          indicator.value,
        ]),
      ]),
    };
  }

  // functions
  getCodeFromReport(report) {
    let codeString = "";
    let codeEntered = report['Event Data'].toJSON();
    for (var i = 0; i < codeEntered.data.length; i++) {
      codeString += String.fromCharCode(codeEntered.data[i]);
    }
    return codeString;
  }

}

module.exports = RingDevice;