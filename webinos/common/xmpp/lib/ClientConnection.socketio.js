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
 * Sends and receives JSON messages from applications using Socket.io
 */

(function () {

    var io,
        logger = require('nlogger').logger('ClientConnection.socketio.js'),
        rpcServer = new MessageHandler("/jsonrpc"),
        discoveryServer = new MessageHandler("/disco"),
        statusServer = new MessageHandler("/bootstrap");

    function MessageHandler(resource){
        this.connection = {};
        this.resource = resource;
    }

    MessageHandler.prototype.on = function (event, callback){
        if(event === "connection"){
            var namespace=io.of(this.resource);
            namespace.handler = this;
            namespace.on('connection',function(socket){
                this.handler.connection=socket;
                callback(this.handler);
            });
        }else
            this.connection.on(event, function(message){
                logger.debug("Message received: "+message);
                if(typeof message!=="undefined"){
                    if(this.namespace.name === "/jsonrpc")
                        message=JSON.parse(message);
                    callback(message);
                }
            });
    };

    MessageHandler.prototype.send = function (type, message){

        //TODO handle multiple clients

        if(this.resource === "/jsonrpc"){ //type is not used for RPCs
            message=type;
            this.connection.send(JSON.stringify(message));
        }else
            this.connection.emit(type,message);
        logger.debug("Message sent: "+message);
    }

    function start(PZHConnection,webServer){
        io = require('socket.io').listen(webServer);
    }

    exports.start = start;
    exports.rpcConnection = rpcServer;
    exports.discoveryConnection = discoveryServer;
    exports.statusConnection = statusServer;

}());
