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
 * Sends and receives XMPP messages from applications using either BOSH or WebSocket as the transport
 */

(function () {

    var logger = require('nlogger').logger('ClientConnection.xmpp.js'),
        EventEmitter = require('events').EventEmitter,
        xmpp = require("node-xmpp"),
        transport = require("node-xmpp-bosh"),
        serverJID, //e.g. user@localhost
        pzpJID,    //e.g. user@webinos.org/1234
        clients={}, // stores connected apps
        PZHConnection, // connection to the PZH
        rpcServer = new EventEmitter(),
        discoveryServer = new EventEmitter(),
        statusServer = new EventEmitter();

    /*
     * Handles incoming Jabber-RPCs from applications
     */
    function onJabberRPC(stanza){

        var methodCall,
            methodName,
            method,
            params,
            msg;

        // XEP-0009 Jabber-RPC request
        methodCall=stanza.getChild("query", "jabber:iq:rpc").getChild("methodCall");

        methodName=methodCall.getChild("methodName");

        method="";
        for(var i=0;i<methodName.children.length;i++)
            method=method+methodName.children[i];

        // for now RPCs payloads are only JSON
        params = JSON.parse(methodCall.getChild("params")
            .getChild("param").getChild("value").getChild("string").children[0]);

        msg={
            jsonrpc:"2.0",
            id:stanza.attrs.id,
            method: method,
            params: params
        };

        msg.fromObjectRef = clients[stanza.attrs.from];

        clients[stanza.attrs.from].rpcServer.emit("message",msg);
    }

    /*
     * Sends Jabber-RPC to application
     */
    function sendJabberRPC(rpc, to, msgid){

        var msg;

        if(typeof to.clientJID !== "undefined")
            to=to.clientJID;

        // if it is an Event it should be a "Message" stanza
        if(typeof rpc.params !== "undefined" && typeof rpc.params.webinosevent !== "undefined"){

            msg=new xmpp.Element("message",{
                from: serverJID,
                to: to
            }).c("webinosevent").t(JSON.stringify(rpc.params));

        } else
        if(typeof rpc.params !== "undefined" && typeof rpc.params.event !== "undefined"){

            msg=new xmpp.Element("message",{
                from: serverJID,
                to: to
            }).c("event").t(JSON.stringify(rpc.params));

        } else {

            // XEP-0009 Jabber-RPC response
            msg=new xmpp.Element("iq",{
                type:"result",
                from: serverJID,
                to: to,
                id: rpc.id
            });

            msg.c("query",{xmlns:"jabber:iq:rpc"})
                .c("methodResponse")
                .c("params")
                .c("param")
                .c("value")
                .c("string").t(JSON.stringify(rpc.result));
        }

        if( typeof clients[to].socket !== "undefined" ){
            clients[to].send(msg);

            logger.debug("Stanza sent: "+msg.tree());
        }else{
            logger.debug("Unable to reach "+to);
        }
    };

    /*
     * Handles incoming Stanzas from applications
     */
    function onStanza(stanza){
        var from = stanza.attrs.from,
            handler,
            element;

        for ( var i=0; i<stanza.children.length; i++ ) {
            element=stanza.children[i];

            switch(element.name){
                case "local":
                case "request":
                case "share":
                case "removed":
                    handler=clients[from].discoveryServer;
                    break;
                case "query":
                    if(stanza.name==="iq" && element.attrs.xmlns === "jabber:iq:rpc"){
                        onJabberRPC(stanza);
                        return;
                    }
                default: return;
            }

            handler.emit(element.name,element.attrs);
        };
    }

    /*
     * Sends message to application
     */
    function sendStanza(type, attrs){

        var msg=new xmpp.Element("message",{
            to:  this.clientJID,
            from: serverJID
        });

        msg.c(type,attrs);

        if( typeof clients[this.clientJID].socket !== "undefined" ){
            clients[this.clientJID].send(msg);

            logger.debug("Stanza sent: "+msg.tree());
        }else{
            logger.debug("Unable to reach "+this.clientJID);
        }

    }

    /*
     * Starts the XMPP server and transport Connection Manager
     */
    function start(connectionToPZH,webServer,jid){

        var xmppServer,connectionManager;

        PZHConnection=connectionToPZH;
        serverJID=jid.substring(0,jid.indexOf("@")+1)+"localhost";
        pzpJID=jid;

        // start XMPP server
        xmppServer = new xmpp.C2SServer({port: 5222});

        xmppServer.on("connect", function(client) {

            //TODO XEP-0030 Service discovery
            //TODO XEP-0115 Entity Capabilities

            // for now allow all users with a localhost domain
            client.on("authenticate", function(opts, cb) {
                if(opts.jid.domain==="localhost")
                    cb(false);
                else
                    cb(true);
            });

            // register a new client
            client.on("online", function() {
                var jid;

                jid= client.jid.user+"@"+client.jid.domain+"/"+client.jid.resource;

                logger.debug("Client online: "+jid);

                clients[jid]=client;

                client.serviceAddress = jid;

                client.rpcServer = new EventEmitter();
                client.rpcServer.clientJID=jid;
                client.rpcServer.send = sendJabberRPC;

                client.discoveryServer = new EventEmitter();
                client.discoveryServer.clientJID=jid;
                client.discoveryServer.send = sendStanza;

                client.statusServer = new EventEmitter();
                client.statusServer.clientJID=jid;
                client.statusServer.send = sendStanza;

                statusServer.emit("connection",client.statusServer);
                rpcServer.emit("connection",client.rpcServer);
                discoveryServer.emit("connection",client.discoveryServer);
            });

            client.on("stanza", function(stanza) {

                logger.debug("Stanza received: "+stanza.tree());

                onStanza(stanza);
            });

            client.on("disconnect", function() {
                logger.debug("Client disconnected");
            });

        });

        // start BOSH or WebSockets connection manager
        connectionManager = transport.start_bosh();

        if(clientProtocol === "xmpp.websocket")
            connectionManager = transport.start_websocket(connectionManager);

    }

    exports.start = start;
    exports.rpcConnection = rpcServer;
    exports.discoveryConnection = discoveryServer;
    exports.statusConnection = statusServer;

}());
