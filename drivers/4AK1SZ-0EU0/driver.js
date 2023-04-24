'use strict';

const Homey = require('homey');

class RingDriver extends Homey.Driver {

    onInit() {

        this.homey.flow.getActionCard('4AK1SZ-0EU0-activateSiren')
            .registerRunListener( async ( args, state ) => {
                this.activateSiren(args.sirenMode);
                return Promise.resolve( true );
            })

        this.homey.flow.getActionCard('4AK1SZ-0EU0-deactivateSiren')
            .registerRunListener( async ( args, state ) => {
                this.deactivateSiren();
                return Promise.resolve( true );
            }) 

        this.homey.flow.getActionCard('4AK1SZ-0EU0-soundChime')
            .registerRunListener( async (args, state) => {
            this.soundChime(args.chime,args.volume);
            return Promise.resolve( true );
            }); 

    }
}

module.exports = RingDriver;