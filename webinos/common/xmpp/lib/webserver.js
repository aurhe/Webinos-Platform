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

// webserver.js
// simple webserver that serves the contents of the www/ directory
// based on nodebeginner.org project
// author: Victor Klos & Eelco Cramer
var http = require('http');
var server;
var url = require("url");
var path = require("path");
var fs = require("fs");
var logger = require('nlogger').logger('webserver.js');

var path = require('path');
var documentRoot = path.resolve(__dirname, './www');
var moduleRoot = require(path.resolve(__dirname, '../dependencies.json'));
var dependencyPath = path.join(__dirname, '../', moduleRoot.root.location, '/dependencies.json')
var dependencies = require(path.normalize(dependencyPath));
var webinosRoot = path.resolve(__dirname, '../' + moduleRoot.root.location);

var rpc = require(path.join(webinosRoot, dependencies.rpc.location));

var serverJID;

function handler(request, response) {
	logger.trace("Entering request callback");
    var pathname = url.parse(request.url).pathname;

    logger.debug("Received request for " + pathname);

    // simulate a fully configured web server
    if (pathname == "/") pathname = "index.html";
    
    // determine file to serve
    var filename = path.join(documentRoot, pathname);
    
    // the rpc stuff is not in the www tree, so get around that
	if (pathname == '/rpc/rpc.js') {
    	filename = path.join(webinosRoot, dependencies.rpc.location, "lib/rpc.js");
	}
    
	filename = path.normalize(filename);

    // now serve the file
    fs.readFile(filename, function (err, data) {
    	if (err) {
    		// Can't read file. This is not an error or warning
    		logger.debug("Can't read " + filename + " due to " + err);
    		
    		// create error response
    		response.writeHead(404, {"Content-Type": "text/plain"});
    		response.write("Error " + err + " when serving " + pathname);
    		logger.info("404 NOT FOUND for " + filename);
    	} else {
            if(pathname === "index.html" || pathname === "/benchmark.html"){
                var imports;

                // change imported libraries on the page to support the transport selected
                if( clientProtocol === "socketio" )
                    imports="<script type='text/javascript' src='/socket.io/socket.io.js'></script>\n"
                        +"    <script type='text/javascript'>pzpID='"+serverJID+"'</script>\n"
                        +"    <script type='text/javascript' src='webinos.socketio.js'></script>";
                else{
                    imports="<script type='text/javascript' src='libs/strophe.js'></script>\n"
                        +"    <script type='text/javascript' src='libs/strophe.rpc.js'></script>\n";

                    if(clientProtocol === "xmpp.bosh")
                        imports+="    <script type='text/javascript'>selectedProtocol='xmpp.bosh'</script>\n";
                    else
                        imports+="    <script type='text/javascript'>selectedProtocol='xmpp.websocket'</script>\n";

                    imports+="    <script type='text/javascript'>pzpID='"+serverJID+"'</script>\n";
                    imports+="    <script type='text/javascript' src='webinos.xmpp.js'></script>";
                }
                data=data.toString().replace("<!--TRANSPORT_PROTOCOL-->",imports);
            }

    		response.writeHead(200, {"Content-Type": mimeType(filename)});
    		response.write(data);
    		logger.info("200 OK for " + filename);
    	}
    	response.end();
    	logger.trace("Leaving request callback");
    });
}

function start(ws_port, rpcHandler, jid) {

	serverJID=jid;

	server = http.createServer(handler);

	logger.trace("Entering start()");
	logger.debug("Creating web server on port " + ws_port);
	
	server.listen(ws_port);

	logger.info("Webserver listening on port " + ws_port);
	
	logger.trace("Leaving start()");

	return server;
}

exports.start = start;

var mimeTypes = [];
mimeTypes[".png"]  = "image/png";
mimeTypes[".gif"]  = "image/gif";
mimeTypes[".htm"]  = "text/html";
mimeTypes[".html"] = "text/html";
mimeTypes[".txt"]  = "text/plain";
mimeTypes[".png"]  = "image/png";
mimeTypes[".js"]   = "application/x-javascript";
mimeTypes[".css"]  = "text/css";

function mimeType(file) {
	logger.trace("Entering mimeType function");
	var ext = path.extname(file);
	var type = mimeTypes[ext] || "text/plain";
	logger.debug("Determined mime type of ext " + ext + " to be " + type)
	logger.trace("Leaving mimeType function");
}
