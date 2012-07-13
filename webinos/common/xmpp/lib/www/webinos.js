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
 * webinos.js
 *
 * This file provides the/a webinos *interface* for the XmppDemo app to code against.
 * Far from final, goal is to give an idea and to experiment with the matter at hand.
 * (Actual implementation of functionality is done in webinos-impl.js)
 *
 * It also gives working definitions for two services:
 * - urn:services-webinos-org:geolocation
 * - urn:services-webinos-org:get42
 *
 * At least partially based on contents on redmine.
 *
 * Author: Victor Klos & Eelco Cramer (TNO)
 */

var	serviceFactory = {
			'urn:services-webinos-org:geolocation': function () { return new GeolocationService },
			'urn:services-webinos-org:get42': function () { return new Get42Service },
			'urn:services-webinos-org:event': function () { return new EventService }
}

/* taken and changed from the orginal RPC client: webinos.js */
if (typeof webinos === 'undefined') webinos = {};

webinos.rpc = new RPCHandler;
webinos.rpc.setMessageHandler(rpcConnection);

function logObj(obj, name){
	for (var myKey in obj){
		console.log(name + "["+myKey +"] = "+obj[myKey]);
		if (typeof obj[myKey] == 'object') logObj(obj[myKey], name + "." + myKey);
	}
}

/* end of RPC client: webinos.js */

// renamed this because of name clashes with RPC code.
var webinosDiscoAndBootstrap = {
    owner: null,    // stores the (addressable) owner, e.g. anna@servicelab.org
    device: null,   // stores the (addressable) device, e.g. anna@servicelab.org/mobile
    
    NS: {
        GEOLOCATION: 'urn:services-webinos-org:geolocation',
        GET42: 'urn:services-webinos-org:get42',
        EVENT: 'urn:services-webinos-org:event'
    },
    
    // let the implementation know what services to discover
    findServices: function(p, cb) {
		discoveryService.on('resolved', function(data) {
			if (data.ns != null) {
				if (!data.local && data.ns === p.api) {
					var service = serviceFactory[data.ns]();
					service.device = data.device;
					service.owner = data.owner;
					service.id = data.id;
					service.shared = data.shared;

					discoveryService.on('removed', function (data) {
						if (service.onRemove)
							service.onRemove(data);
					});

					cb(service);
				}
			}
		});

		discoveryService.send('request', { ns: p.api });
        //webinosImpl.findServices(p, cb);
    },

    // let the implementation know what services to share with others
    shareService: function(id, flag) {
		discoveryService.send('share', { 'id': id, 'flag': flag.toString() });
        //webinosImpl.shareService(ns, flag);
    },

    // should be implicit later when webinos references a plugin
    connect: function(onSuccess) {
		bootstrap.on('status', function (data) {
			$(document).trigger('onWebinosConnect', data);
			
			webinosDiscoAndBootstrap.device = data.device;
			webinosDiscoAndBootstrap.owner = data.owner;

			onSuccess();
		});
	},
	
	resolveLocalFeatures: function(cb) {
		discoveryService.on('resolved', function (data) {
			if (data.ns != null) {
				if (data.local) {
					var service = serviceFactory[data.ns]();
					service.device = data.device;
					service.owner = data.owner;
					service.id = data.id;
					service.shared = data.shared;
					
					cb(service);

					discoveryService.on('removed', function (data) {
						if (service.onRemove)
							service.onRemove(data);
					});
				}
			}
		});

		discoveryService.send('local', { filter: 'all' });
    },

    disconnect: function() {
        //webinosImpl.disconnect();
    },
    
    isMobile: function() {
        return (navigator.appVersion.indexOf("Mobi") > -1);
    }
};

/*
 * 'Class' definition of generic webinos service
 *
 * inspiration for subclassing methodology comes from http://www.webreference.com/js/column79/4.html
 */
function GenericService() {
    this.id = null;                           // (app level) unique id, e.g. for use in html user interface
    this.owner = null;                        // person that owns the device the service is running on
    this.device = null;                       // (addressable) id of device the service is running on
    this.name = "(you shouldn't see this!)";  // friendly name, to be overridden
	this.friendlyName = "(you shouldn't see this!)";
    this.ns = null;                           // name space that (globally) uniquely defines the service type

    this.shared = false;

    this.onRemove = null;                     // callback function for 'on removal'
    this.remove = genericRemove;              // function called by WebinosImpl
    this.isLocal = genericIsLocal;            // returns true is the service is running on the local device
    this.isMine = genericIsMine;              // returns true if the service runs on a device of same owner
	this.isShared = genericIsShared;
    this.invoke = function(){alert('oops!');};// execute the service, needs be overridden
}

/*
 * Geolocation Service, defined as subclass of GenericService
 *
 * When an app invokes this service, a query request is sent to the 
 * service (address). The result is passed back through a callback.
 *
 * See the XMPP logging for the details.
 */
function GeolocationService() {
    this.ns = "urn:services-webinos-org:geolocation";
    this.name = "geolocation";
	this.friendlyName = "location service";
    this.invoke = geolocationInvoke;          // as seen from app
    this.onResult = null;                     // callback function for 'on result'
    this.result = function(lat, lon) {        // called by webinosImpl when result is avail
        if (this.onResult) (this.onResult)(lat, lon);
    };
    this.onError = null;                      // callback function for 'on result'
    this.error = function(err) {              // called by webinosImpl when query failed
        if (this.onError) (this.onError)(err);
    };
}
// This statement defines the class hierarchy
GeolocationService.prototype = new GenericService;

function geolocationInvoke(id) {
	// add the id to the name of the feature to make sure the right 'feature' is invoked.
	var rpc = webinos.rpc.createRPC(this.ns + "@" + id, "invoke", arguments); // RPCservicename, function
	var onSuccess = this.onResult;
	
	webinos.rpc.executeRPC(rpc,
		function (result){onSuccess(result);},
		function (error){}
	);
}

////////////////////////// END Geolocation Service //////////////////////////

/*
 * Get42 Service, defines as subclass of GenericService
 */
function Get42Service() {
    this.ns = "urn:services-webinos-org:get42";
    this.name = "get42";
	this.friendlyName = "get 42 service";
    this.invoke = get42Invoke;
}
// This statement defines the class hierarchy
Get42Service.prototype = new GenericService;

function get42Invoke(id) {
	// add the id to the name of the feature to make sure the right 'feature' is invoked.
	var rpc = webinos.rpc.createRPC(this.ns + "@" + id, "invoke", arguments); // RPCservicename, function
	var onSuccess = this.onResult;
	
	webinos.rpc.executeRPC(rpc,
		function (result){onSuccess(result);},
		function (error){}
	);
}

///////////////////////// END Get42Service /////////////////////////


/*
 * Event Service, defines as subclass of GenericService
 */
function EventService() {
    this.ns = "urn:services-webinos-org:event";
    this.name = "event";
    this.friendlyName = "event service";

    this.api = this.ns;
    this.displayName = 'Event' + this.id;
    this.description = this.friendlyName;

    this.invoke = eventInvoke;
    this.onResult = null;
    this.result = function(event) {
        if (this.onResult) (this.onResult)(event);
    };
    this.onError = null;
    this.error = function(err) {
        if (this.onError) (this.onError)(err);
    };

    eventListeners.push(this);
}

// store all registered event listener because each event can have more than one receiver
var eventListeners=[];

// handle RPC messages sent to the app
rpcConnection.on('message', function (message) {

    // if it is a event find which listeners should receive it
    if(typeof message.params !== "undefined"
        && ( typeof message.params.event !== "undefined" || typeof message.params.webinosevent !== "undefined")) {
        for(var i=0;i<eventListeners.length;i++)
            if((typeof message.params.event !== "undefined" && eventListeners[i].device === message.params.event.addressing.to[0].id)
                || (typeof message.params.webinosevent !== "undefined" && eventListeners[i].device === message.params.webinosevent.addressing.to[0].id))
                eventListeners[i].onResult(message.params);
    } else
        webinos.rpc.handleMessage(message);
});

EventService.prototype = new GenericService;

function eventInvoke(id,method,params) {

    var rpc = webinos.rpc.createRPC(this.ns+ "@" + id, "invoke", {
        method:method,
        params:params
    });
    var onSuccess = this.onResult;

    webinos.rpc.executeRPC(rpc,
        function (result){
            onSuccess(result);
        },
        function (error){}
    );
}

/*
 * Generic Service methods, no need to override these
 */
function genericRemove() {
    if (this.onRemove) (this.onRemove)(this);
}
function genericIsLocal() {
    return (this.device == webinosDiscoAndBootstrap.device);
}
function genericIsMine() {
    return (this.owner == webinosDiscoAndBootstrap.owner);
}
function genericIsShared() {
	return this.shared;
}

