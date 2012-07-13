/*******************************************************************************
 *  Code contributed to the webinos project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 *******************************************************************************/

/*
 * Handles Event Service calls from local and remote.
 *
 * Based on the Get42Feature.js code
 */

var sys = require('util');
var GenericFeature = require('./GenericFeature.js');
var logger = require('nlogger').logger('EventFeature.js');

var NS = "urn:services-webinos-org:event";

var moduleRoot = require('../dependencies.json');
var dependencies = require('../' + moduleRoot.root.location + '/dependencies.json');
var webinosRoot = '../' + moduleRoot.root.location;

var event = require(webinosRoot + dependencies.api.events.location);

function EventFeature(rpcHandler) {
    GenericFeature.GenericFeature.call(this, rpcHandler);

    this.service = new event.Service(rpcHandler);
    this.api = NS;
    this.displayName = 'Event' + this.id;
    this.description = 'Event Feature.';
    this.ns = this.api;

    this.on('invoked-from-remote', function(featureInvoked, stanza) {
        logger.trace('on(invoked-from-remote)');
        logger.debug('The EventFeature is invoked from remote. Answering it...');
        logger.debug('Received the following XMPP stanza: ' + stanza);

        var query = stanza.getChild('query');
        var params = query.getText();

        if (params == null || params == '') {
            params = "{}";
        } else {
            logger.trace('Query="' + params + '"');
        }

        var payload = JSON.parse(params);
        var conn = this.uplink;

        var successCB = function(result) {
            logger.debug("The answer is: " + JSON.stringify(result));
            logger.debug("Sending it back via XMPP...");
            conn.answer(stanza, JSON.stringify(result));
        };

        if(payload.method === "dispatchWebinosEvent"){
            this.service.WebinosEvent.dispatchWebinosEvent(payload.params, successCB);
        }

        logger.trace('ending on(invoked-from-remote)');
    });

    this.on('invoked-from-local', function(featureInvoked, params, successCB, errorCB, objectRef) {
        logger.trace('on(invoked-from-local)');

        if( typeof objectRef === "undefined" )
            objectRef = this;

        switch(params.method){
            case "addWebinosEventListener":
                this.service.addWebinosEventListener(params.params, successCB, errorCB, objectRef);
                break;
            case "removeWebinosEventListener":
                this.service.removeWebinosEventListener(params.params, successCB, errorCB, objectRef);
                break;
            case "dispatchWebinosEvent":
                this.service.WebinosEvent.dispatchWebinosEvent(params.params, successCB, errorCB, objectRef);
        }

        logger.trace('ending on(invoked-from-local)');
    });

    rpcHandler.registry.registerObject(this);
}

sys.inherits(EventFeature, GenericFeature.GenericFeature);
exports.EventFeature = EventFeature;
exports.NS = NS;
