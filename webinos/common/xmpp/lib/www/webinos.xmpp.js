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
* Copyright 2012 Present Technologies
*******************************************************************************/

/*
 * Sends and receives XMPP messages from the PZP using either BOSH or WebSocket as the transport
 */

var rpcConnection = new MessageHandler("/jrpc-server"),
    discoveryService = new MessageHandler("/disco"),
    bootstrap = new MessageHandler("/bootstrap"),
    serverJID=pzpID.substring(0,pzpID.indexOf('@')+1)+'localhost', //e.g. user@localhost
    clientJID = serverJID+"/"+Math.floor(Math.random()*100000),    //e.g. user@localhost/1234
    connection;

// select the transport to be used
if(selectedProtocol === "xmpp.bosh")
    connection = new Strophe.Connection({protocol : new Strophe.Bosh("http://localhost:5280/http-bind")});
else
    connection = new Strophe.Connection({protocol : new Strophe.WebSocket("ws://localhost:5280")});

// show log messages from Strophe.js
Strophe.log = function (level, msg) {
    console.log("Strophe "+level+": "+msg);
};

// show all xml messages received and sent
connection.xmlInput = function (elem) {
    console.log("Received: ",elem);
};
connection.xmlOutput = function (elem) {
    console.log("Sent: ",elem);
};

// start the connection with the PZP
connection.connect(clientJID, "webinos", function(status){
    switch(status){
        case Strophe.Status.CONNECTING: console.log("Strophe status: connecting"); break;
        case Strophe.Status.AUTHENTICATING: console.log("Strophe status: authenticating"); break;
        case Strophe.Status.CONNECTED: console.log("Strophe status: connected"); break;
        case Strophe.Status.DISCONNECTED: console.log("Strophe status: disconnected"); break;
    }
});

// handle incoming stanzas
connection.addHandler(function (stanza){
    var msg,element,name,handler;

    for ( var i=0; i< stanza.childNodes.length; i++ ){
        element=stanza.childNodes[i];
        msg={};
        name=element.tagName;

        for ( var j=0; j< element.attributes.length; j++ )
            msg[element.attributes[j].name]=element.attributes[j].value;

        switch(name){
            case "status":
                handler=bootstrap;
                break;
            case "resolved":
            case "removed":
                handler=discoveryService;
                break;
            case "event":
            case "webinosevent":
                handler=rpcConnection;
                msg.params=JSON.parse(element.textContent);
                name = "message";
                break;
            default: return false;
        }

        for ( var j=0; j< handler.events[name].length; j++ )
            handler.events[name][j](msg);
    }

    return true;

},null,"message");

// handle incoming Jabber-RPCs
connection.rpc.addResponseHandler(function(id, from, result, error) {

    var rpc = {
        jsonrpc:"2.0",
        id:id,
        result:JSON.parse(result)
    };

    if(typeof rpcConnection.events.message !== "undefined")
        for(var i=0;i<rpcConnection.events.message.length;i++)
            rpcConnection.events.message[i](rpc);

    return true;
});

function MessageHandler(resource){
    this.events = {};
    this.resource=resource;
}

MessageHandler.prototype.on = function (event, callback){
    if(typeof this.events[event] === "undefined")
        this.events[event]=[];
    this.events[event].push(callback);
};

MessageHandler.prototype.send = function (type, message){
    var msg=new $msg({
        to: serverJID,
        from: clientJID
    });

    msg.c(type,message);

    connection.send(msg);
};

rpcConnection.write = function(rpc, from, msgid){ // only used by rpc.js executeRPC
    connection.rpc.sendRequest(rpc.id, serverJID, rpc.method, JSON.stringify(rpc.params));
};
