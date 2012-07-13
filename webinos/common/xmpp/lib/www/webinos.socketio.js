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
 * Sends and receives JSON messages from the PZP using Socket.io
 */

var rpcConnection = new MessageHandler("/jsonrpc"),
    discoveryService = new MessageHandler("/disco"),
    bootstrap = new MessageHandler("/bootstrap");

function MessageHandler(resource){
    this.resource = resource;
    this.connection = io.connect(resource);
}

MessageHandler.prototype.on = function (event, callback){
    this.connection.on(event, function(message){
        if(this.name === "/jsonrpc")
            message = JSON.parse(message);
        callback(message);
    });
};

MessageHandler.prototype.send = function (type, message){
    this.connection.emit(type, message);
};

rpcConnection.write = function(text, responseto, msgid) { // only used by rpc.js executeRPC
    this.connection.send(JSON.stringify(text));
};
