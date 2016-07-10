import {Route} from './Route';
import * as url from 'url';
import * as net from 'net';
import * as http from 'http';
import * as formidable from 'formidable';
import {iMiddleware} from './middlewares/iMiddleware';

// Keys stored in `_errorFunctions` of the Server class
const ERROR_KEY_REQUEST = 'request';
const ERROR_KEY_RESPONSE = 'response';
const ERROR_KEY_NOTFOUND = 'notfound';
const ERROR_KEY_OVERFLOW = 'overflow';

export interface iBodyRequest extends http.IncomingMessage {
    body?: string,
    fields?: formidable.Fields,
    files?: formidable.Files,
    contentType?: string
}

/**
 * The HTTP-server class for receiving and responding to HTTP-requests
 * 
 * @export
 * @class Server
 */
export class Server {

    /**
     * http node server instance
     * 
     * @private
     * @type {http.Server}
     */
    private server: http.Server;

    /**
     * Port number to listen for
     * 
     * @private
     * @type {number}
     */
    private port: number;

    /**
     * hostname/ip in which `server` should accept connections to
     * Leave as null to listen to all IP-adresses. Example usage:
     * using the node-http server as a Reverse Proxy
     * 
     * @private
     * @type {string}
     */
    private hostname: string;

    /**
     * Status whether the http-server is started and accepts
     * connections or not
     * 
     * @private
     * @type {boolean}
     */
    private connected: boolean;

    /**
     * All routes added to the http-server, which is recognized
     * and parsed for each http-request by the requested url.
     * The routes is stored in a key-value object, where key is
     * the "parent" path which a route belongs to, e.g. "users"
     * 
     * @private
     * @type {{ [key: string]: Route }}
     */
    private routes: { [key: string]: Route };

    /**
     * Middlewares added to the http-server. All middlewares
     * are run before a route is triggered, which can be used
     * to alter the request and response http-objects
     * 
     * @private
     * @type {[iMiddleware]}
     */
    private _middlewares: [iMiddleware];

    /**
     * Error functions for custom-handling of errors. To set
     * error functions see all "on*" methods. If no error
     * functions are set, the defaults are used
     * 
     * @private
     * @type {{ [key: string]: Function }}
     */
    private _errorFunctions: { [key: string]: Function };

    /**
     * Creates an instance of Server.
     * 
     * @param {number} port number which the http-server should be made accessible
     * @param {string} [host=null] if specified, accept only connections from `hostname`
     */
    public constructor(port: number, host: string = null) {
        // Initialize variables to be populated
        this.port = port;
        this.hostname = host;
        this.routes = {};
        this._middlewares = <[iMiddleware]>[];
        this._errorFunctions = {};
        this.connected = false;

        this.server = http.createServer();

        var self = this;

        this.server.on('request', function (request: http.IncomingMessage, response: http.ServerResponse) {

            var body: string = "";
            request.on('error', function (error) {
                self._errorFunctions[ERROR_KEY_REQUEST](error, response);
            });

            response.on('error', function (error) {
                self._errorFunctions[ERROR_KEY_RESPONSE](error, response);
            });

            if (request.method != "GET" && request.headers['content-length'] != undefined) { // Should parse the body if a POST,PUT or DELETE request is made, with content-length set

                var contentTypeRaw: string = request.headers['content-type'];
                var contentType = (contentTypeRaw != undefined) ? contentTypeRaw.slice(0, contentTypeRaw.indexOf(';')) : null;

                (<iBodyRequest>request).contentType = contentType;

                if (contentType == 'multipart/form-data') {
                    var form = new formidable.IncomingForm();
                    form.parse(request, function (error, fields, files) {

                        if (error)
                            return request.emit('error', 'Error parsing request body');

                        (<iBodyRequest>request).fields = fields;
                        (<iBodyRequest>request).files = files;
                        self.routeLookup(request, response);
                    });
                }
                else {
                    request.on('data', function (data) {
                        body += data;
                        if (body.length > 1e6) { // Prevent flooding of RAM (1mb) http://stackoverflow.com/a/8640308
                            return self._errorFunctions[ERROR_KEY_OVERFLOW](response);
                        }
                    });

                    request.on('end', function () {
                        (<iBodyRequest>request).body = body;
                        self.routeLookup(request, response);
                    });
                }
            }
            else // No need to parse any body data when a GET request is made
                self.routeLookup(request, response);
        });
    }

    private routeLookup(request: http.IncomingMessage, response: http.ServerResponse) {
        // Load middlewares
        var length = this.middlewares.length;
        for (let i = 0; i < length; ++i)
            if (!this.middlewares[i].alter(request, response))
                return; // Should stop processing of dataif a middleware fails, to prevent setting headers if already changed by a middleware throwing an error

        // Find the route which should try to parse the requested URL
        var firstSlashPos = request.url.indexOf('/', 1);
        var routeKey = request.url.substring(1, firstSlashPos);
        var routeUrl = request.url.substring(firstSlashPos);
        var route = this.routes[routeKey];

        if (route !== undefined)
            route.parse(routeUrl, request, response);
        else // 404 error
            this._errorFunctions[ERROR_KEY_NOTFOUND](response);
    }

    /**
     * Whether teh server is listening for connections or not. Will
     * only be true as long as the `listen` method is called
     * 
     * @readonly
     * @type {boolean}
     */
    public get isListening(): boolean {
        return this.connected;
    }

    /**
     * Set functions to run on triggered events, either by the 
     * server 
     * 
     * @param {string} event to listen for
     * @param {Function} func function to run on event triggered
     * @returns (description)
     */
    public on(event: string, func: Function) {
        switch (event) {

            case 'clientError':
            case 'close':
            case 'upgrade':
                break;

            case ERROR_KEY_RESPONSE:
                this._errorFunctions[ERROR_KEY_RESPONSE] = func;
                return true;

            case ERROR_KEY_REQUEST:
                this._errorFunctions[ERROR_KEY_REQUEST] = func;
                return true;

            case ERROR_KEY_NOTFOUND:
                this._errorFunctions[ERROR_KEY_NOTFOUND] = func;
                return true;

            default:
                throw new Error("Event: " + event + " not recognized");
        }

        this.server.on(event, func);
    }

    /**
     * Function to run on a "clientError"
     * https://nodejs.org/api/http.html#http_event_clienterror
     */
    public set onClientError(func: (error, socket: net.Socket) => void) {
        this.server.on("clientError", func);
    }

    /**
     * Function to run when the server closes for new connections
     * https://nodejs.org/api/http.html#http_event_close
     */
    public set onClose(func: () => void) {
        this.server.on('close', func);
    }

    /**
     * Function to run when "upgrade" emitted by client
     * https://nodejs.org/api/http.html#http_event_upgrade_1
     */
    public set onUpgrade(func: () => void) {
        this.server.on('upgrade', func);
    }

    /**
     * Function to run if a request throws an error
     */
    public set onRequestError(func: (error: any, response: http.ServerResponse) => void) {
        if (this._errorFunctions[ERROR_KEY_REQUEST] != undefined)
            throw new Error("Request error function already set");
        this._errorFunctions[ERROR_KEY_REQUEST] = func;
    }

    /**
     * Function to run if a response throws an error
     */
    public set onResponseError(func: (error: any, response: http.ServerResponse) => void) {
        if (this._errorFunctions[ERROR_KEY_RESPONSE] != undefined)
            throw new Error("Response error function already set");
        this._errorFunctions[ERROR_KEY_RESPONSE] = func;
    }

    /**
     * Function to run if a route is not found (404 http method)
     */
    public set onNotFoundError(func: (response: http.ServerResponse) => void) {
        if (this._errorFunctions[ERROR_KEY_NOTFOUND] != undefined)
            throw new Error("Not-Found error function already set");
        this._errorFunctions[ERROR_KEY_NOTFOUND] = func;
    }

    /**
     * Function to run if a request provides too much data
     */
    public set onOverflowError(func: (response: http.ServerResponse) => void) {
        if (this._errorFunctions[ERROR_KEY_OVERFLOW] != undefined)
            throw new Error('Overflow error function already set');
        this._errorFunctions[ERROR_KEY_OVERFLOW] = func;
    }

    /**
     * Adds a new route for the http-server for accepting http-requests
     * requires the "routeName" to be set
     * 
     * @param {Route} route object to add
     */
    public addRoute(route: Route) {
        if (this.routes[route.routeName] === undefined)
            this.routes[route.routeName] = route;
        else
            throw new Error('Route ' + route.routeName
                + ' already added. plz fix');
    }

    /**
     * Adds a new route for the http-server for accepting http-requests
     * Adds a routename to a route object. See also `addRoute`
     * 
     * @param {string} path (routeName which `route` will be made accessible
     * @param {Route} route object to add
     */
    public add(path: string, route: Route) {
        route.routeName = path;
        this.addRoute(route);
    }

    /**
     * Appends a middleware 
     * 
     * @param {iMiddleware} middleware to be added
     */
    public use(middleware: iMiddleware) {
        this._middlewares.push(middleware);
    }

    /**
     * Retrieve all registered middlewares
     * 
     * @readonly
     * @type {[iMiddleware]}
     */
    public get middlewares(): [iMiddleware] {
        return this._middlewares;
    }

    /**
     * Retrieve the function to call when a route is not found
     * Used by "Route"
     * 
     * @readonly
     * @type {Function}
     */
    public get notfound(): Function {
        return this._errorFunctions[ERROR_KEY_NOTFOUND];
    }

    /**
     * Start the http-server, for accepting incomming connections on the
     * given port and hostname
     */
    public listen() {

        if (Object.keys(this.routes).length == 0)
            throw new Error("No routes added, and no connections will therefore be accepted.");

        if (this._errorFunctions[ERROR_KEY_REQUEST] == undefined)
            this._errorFunctions[ERROR_KEY_REQUEST] = function (error: any, response: http.ServerResponse) {
                console.error(error.stack);
                response.setHeader('Content-Type', 'text/html');
                response.statusCode = 400;
                response.statusMessage = 'Bad Request';
                response.write('Error: ' + error);
                response.write('The Request Error function is not set. It can be set using the appropriate function (onRequestError)');
                response.end();
            }

        if (this._errorFunctions[ERROR_KEY_RESPONSE] == undefined)
            this._errorFunctions[ERROR_KEY_RESPONSE] = function (error: any, response: http.ServerResponse) {
                console.error(error.stack);
                response.setHeader('Content-Type', 'text/html');
                response.statusCode = 444; // nging specific error code
                response.statusMessage = 'No Response';
                response.write('The Response Error function is not set. It can be set using the appropriate function (onResponseError)');
                response.end();
            }

        if (this._errorFunctions[ERROR_KEY_NOTFOUND] == undefined)
            this._errorFunctions[ERROR_KEY_NOTFOUND] = function (response: http.ServerResponse) {
                response.setHeader('Content-Type', 'text/html');
                response.statusCode = 404;
                response.statusMessage = 'Not Found';
                response.write('The Not Found Error function is not set. It can be set using the appropriate function (onNotFoundError)');
                response.end();
            }

        if (this._errorFunctions[ERROR_KEY_OVERFLOW] == undefined)
            this._errorFunctions[ERROR_KEY_OVERFLOW] = function (response: http.ServerResponse) {
                response.setHeader('Content-Type', 'text/html');
                response.statusCode = 413;
                response.statusMessage = 'Request Entity Too Large';
                response.write('The Overflow Error function is not set. It can be set using the appropriate function (onOverflowError)');
                response.end();
            }

        Route.onError = <(response: http.ServerResponse) => void>this._errorFunctions[ERROR_KEY_NOTFOUND];

        this.server.listen(this.port, this.hostname);
        console.log("STARTED SERVER ON PORT: " + this.port + " AND LISTENING ON: " + this.hostname);
        this.connected = true;
    }
}