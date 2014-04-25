/**************************************************************************************************
 *
 * Copyright (c) 2014 Digium, Inc.
 * All Rights Reserved. Licensed Software.
 *
 * @authors : Erin Spiceland <espiceland@digium.com>
 */

/*global brightstream: false */
/**
 * The purpose of the class is so that User and Endpoint can share the same presence. This will probably be
 * merged into Endpoint when User is merged into Client.
 * @author Erin Spiceland <espiceland@digium.com>
 * @class
 * @constructor
 * @augments brightstream.EventEmitter
 * @param {object} params
 * @param {string} params.client
 * @param {string} params.id
 * @returns {brightstream.Presentable}
 */
brightstream.Presentable = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! brightstream.Presentable
     * @name client
     * @private
     * @type {string}
     */
    var client = params.client;
    var that = brightstream.EventEmitter(params);
    delete that.client;
    /**
     * @memberof! brightstream.Presentable
     * @name className - A name to identify the type of this object.
     * @type {string}
     */
    that.className = 'brightstream.Presentable';
    /**
     * @memberof! brightstream.Presentable
     * @name presence
     * @type {string}
     */
    that.presence = 'unavailable';

    var clientObj = brightstream.getClient(client);

    /**
     * Set the presence on the object and the session
     * @memberof! brightstream.Presentable
     * @method brightstream.Presentable.setPresence
     * @param {object} params
     * @param {string} params.presence
     * @param {string} params.connectionId
     * @fires brightstream.Presentable#presence
     * @private
     */
    that.setPresence = function (params) {
        var connection;
        params = params || {};
        params.presence = params.presence || 'available';
        params.connectionId = params.connectionId || that.connectionId;

        if (that.className === 'brightstream.User' || that.className === 'brightstream.Connection') {
            that.presence = params.presence;
            if (that.className === 'brightstream.Connection') {
                that.getEndpoint().resolvePresence();
            }
        } else if (!params.connectionId) {
            throw new Error("Can't set Endpoint presence without a connectionId.");
        } else {
            connection = that.getConnection({connectionId: params.connectionId});
            if (connection) {
                connection.presence = params.presence;
            } else {
                connection = clientObj.getConnection({
                    connectionId: params.connectionId,
                    skipCreate: false,
                    endpointId: that.id
                });
                connection.presence = params.presence;
            }
            that.resolvePresence();
        }

        /**
         * This event indicates that the presence for this endpoint has been updated.
         * @event brightstream.Presentable#presence
         * @type {brightstream.Event}
         * @property {string} presence
         * @property {string} name - the event name.
         * @property {brightstream.Presentable} target
         */
        that.fire('presence', {
            presence: that.presence
        });
    };

    /**
     * Get the presence.
     * @memberof! brightstream.Presentable
     * @method brightstream.Presentable.getPresence
     * @returns {string} A string representing the current presence of this endpoint.
     */
    that.getPresence = function () {
        return that.presence;
    };

    return that;
}; // End brightstream.Presentable

/**
 * Represents remote Endpoints. Endpoints are users of this application that are not the one logged into this
 * instance of the application. An Endpoint could be logged in from multiple other instances of this app, each of
 * which is represented by a Connection. The currently logged-in user can interact with endpoints by calling them or
 * sending them messages. An endpoint can be a person using an app from a browser or a script using the APIs on
 * a server.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments brightstream.Presentable
 * @param {object} params
 * @param {string} params.id
 * @returns {brightstream.Endpoint}
 */
brightstream.Endpoint = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! brightstream.Endpoint
     * @name client
     * @private
     * @type {string}
     */
    var client = params.client;
    var that = brightstream.Presentable(params);
    var clientObj = brightstream.getClient(client);
    var signalingChannel = clientObj.getSignalingChannel();
    delete that.client;
    delete that.connectionId;
    /**
     * A name to identify the type of this object.
     * @memberof! brightstream.Endpoint
     * @name className
     * @type {string}
     */
    that.className = 'brightstream.Endpoint';
    /**
     * A direct connection to this endpoint. This can be used to send direct messages.
     * @memberof! brightstream.Endpoint
     * @name directConnection
     * @type {brightstream.DirectConnection}
     */
    that.directConnection = null;

    /**
     * @memberof! brightstream.Endpoint
     * @name connections
     * @type {Array<brightstream.Connection>}
     */
    that.connections = [];
    clientObj.listen('disconnect', function disconnectHandler() {
        that.connections = [];
    });

    /**
     * Send a message to the endpoint through the infrastructure.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.sendMessage
     * @param {object} params
     * @param {string} params.message
     * @param {string} [params.connectionId]
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @returns {Promise}
     */
    that.sendMessage = function (params) {
        params = params || {};

        return signalingChannel.sendMessage({
            connectionId: params.connectionId,
            message: params.message,
            recipient: that,
            onSuccess: params.onSuccess,
            onError: params.onError
        });
    };

    /**
     * Create a new Call for a voice and/or video call.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.call
     * @param {object} params
     * @param {RTCServers} [params.servers]
     * @param {RTCConstraints} [params.constraints]
     * @param {function} [params.onLocalVideo] - Callback for receiving an HTML5 Video element with the local
     * audio and/or video attached.
     * @param {function} [params.onRemoteVideo] - Callback for receiving an HTML5 Video element with the remote
     * audio and/or video attached.
     * @param {function} [params.onHangup] - Callback for being notified when the call has been hung up
     * @param {function} [params.onStats] - Callback for receiving statistical information.
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {function} [params.previewLocalMedia] - A function to call if the developer wants to perform an action
     * between local media becoming available and calling approve().
     * @param {string} [params.connectionId] - The connection ID of the remoteEndpoint, if it is not desired to call
     * all connections belonging to this endpoint.
     * @returns {brightstream.Call}
     */
    that.call = function (params) {
        var call = null;
        var clientObj = brightstream.getClient(client);
        var combinedCallSettings = clientObj.getCallSettings();
        var user = clientObj.user;
        params = params || {};

        log.trace('Endpoint.call');
        log.debug('Default callSettings is', combinedCallSettings);
        if (params.initiator === undefined) {
            params.initiator = true;
        }

        if (!that.id) {
            log.error("Can't start a call without endpoint ID!");
            return;
        }

        // Apply call-specific callSettings to the app's defaults
        combinedCallSettings.constraints = params.constraints || combinedCallSettings.constraints;
        combinedCallSettings.servers = params.servers || combinedCallSettings.servers;
        log.debug('Final callSettings is', combinedCallSettings);

        params.callSettings = combinedCallSettings;
        params.client = client;
        params.remoteEndpoint = that;

        params.signalOffer = function (signalParams) {
            signalParams.signalType = 'offer';
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalingChannel.sendSDP(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't place a call.", err.message, err.stack);
                signalParams.call.hangup();
            });
        };
        params.signalAnswer = function (signalParams) {
            signalParams.signalType = 'answer';
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalingChannel.sendSDP(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't answer the call.", err.message, err.stack);
                signalParams.call.hangup({signal: false});
            });
        };
        params.signalConnected = function (signalParams) {
            signalParams.target = 'call';
            signalParams.connectionId = signalParams.connectionId;
            signalParams.recipient = that;
            signalingChannel.sendConnected(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send connected.", err.message, err.stack);
                signalParams.call.hangup();
            });
        };
        params.signalModify = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalingChannel.sendModify(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send modify.", err.message, err.stack);
            });
        };
        params.signalCandidate = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalingChannel.sendCandidate(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send candidate.", err.message, err.stack);
            });
        };
        params.signalTerminate = function (signalParams) {
            signalParams.target = 'call';
            signalParams.recipient = that;
            signalingChannel.sendBye(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send hangup.", err.message, err.stack);
            });
        };
        params.signalReport = function (signalParams) {
            signalParams.report.target = 'call';
            log.debug("Not sending report");
            log.debug(signalParams.report);
        };
        call = brightstream.Call(params);

        if (params.initiator === true) {
            call.answer();
        }
        user.addCall({
            call: call,
            endpoint: that
        });

        // Don't use params.onHangup here. Will overwrite the developer's callback.
        call.listen('hangup', function hangupListener(evt) {
            user.removeCall({id: call.id});
        }, true);
        return call;
    };

    /**
     * Create a new DirectConnection.  This method creates a new Call as well, attaching this DirectConnection to
     * it for the purposes of creating a peer-to-peer link for sending data such as messages to the other endpoint.
     * Information sent through a DirectConnection is not handled by the cloud infrastructure.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.getDirectConnection
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @param {function} [params.onOpen] - A callback for receiving notification of when the DirectConnection is
     * open and ready to be used.
     * @param {function} [params.onClose] - A callback for receiving notification of when the DirectConnection
     * is closed and the two Endpoints are disconnected.
     * @param {function} [params.onMessage] - A callback for receiving messages sent through the DirectConnection.
     * @param {RTCServers} [params.servers] - Additional ICE/STUN/TURN servers to use in connecting.
     * @param {string} [params.connectionId] - An optional connection ID to use for this connection. This allows
     * the connection to be made to a specific instance of an endpoint in the case that the same endpoint is logged
     * in from multiple locations.
     * @returns {brightstream.DirectConnection} The DirectConnection which can be used to send data and messages
     * directly to the other endpoint.
     */
    that.getDirectConnection = function (params) {
        params = params || {};
        var clientObj = brightstream.getClient(client);
        var combinedConnectionSettings = clientObj.getCallSettings();
        var deferred = brightstream.makeDeferred(params.onSuccess, params.onError);
        var user = clientObj.user;
        var call;

        if (that.directConnection) {
            deferred.resolve(that.directConnection);
            return deferred.promise;
        }

        log.trace('Endpoint.getDirectConnection', params);
        if (params.initiator === undefined) {
            params.initiator = true;
        }

        if (!that.id) {
            deferred.reject(new Error("Can't start a direct connection without endpoint ID!"));
            return deferred.promise;
        }

        // Apply connection-specific callSettings to the app's defaults
        combinedConnectionSettings.servers = params.servers || combinedConnectionSettings.servers;

        params.connectionSettings = combinedConnectionSettings;
        params.client = client;
        params.remoteEndpoint = that;

        params.signalOffer = function (signalParams) {
            signalParams.signalType = 'offer';
            signalParams.target = 'directConnection';
            signalParams.recipient = that;
            signalingChannel.sendSDP(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't place a call.", err.message, err.stack);
                signalParams.call.hangup();
            });
        };
        params.signalConnected = function (signalParams) {
            signalParams.target = 'directConnection';
            signalParams.recipient = that;
            signalingChannel.sendConnected(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send connected.", err.message, err.stack);
                signalParams.call.hangup();
            });
        };
        params.signalAnswer = function (signalParams) {
            signalParams.target = 'directConnection';
            signalParams.recipient = that;
            signalParams.signalType = 'answer';
            signalingChannel.sendSDP(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't answer the call.", err.message, err.stack);
                signalParams.call.hangup({signal: false});
            });
        };
        params.signalCandidate = function (signalParams) {
            signalParams.target = 'directConnection';
            signalParams.recipient = that;
            signalingChannel.sendCandidate(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send candidate.", err.message, err.stack);
            });
        };
        params.signalTerminate = function (signalParams) {
            signalParams.target = 'directConnection';
            signalParams.recipient = that;
            signalingChannel.sendBye(signalParams).done(null, function errorHandler(err) {
                log.error("Couldn't send bye.", err.message, err.stack);
            });
        };
        params.signalReport = function (signalParams) {
            signalParams.report.target = 'directConnection';
            log.debug("Not sending report");
            log.debug(signalParams.report);
        };
        params.directConnectionOnly = true;

        call = brightstream.Call(params);
        call.listen('direct-connection', function directConnectionHandler(evt) {
            that.directConnection = evt.directConnection;
            if (params.initiator !== true) {
                if (!clientObj.user.hasListeners('direct-connection') &&
                        !clientObj.hasListeners('direct-connection') &&
                        !call.hasListeners('direct-connection')) {
                    that.directConnection.reject();
                    deferred.reject(new Error("Got an incoming direct connection with no handlers to accept it!"));
                    return deferred.promise;
                }

                deferred.resolve(that.directConnection);
                that.directConnection.listen('close', function closeHandler(evt) {
                    that.directConnection = undefined;
                }, true);
            }
        }, true);

        if (params.initiator === true) {
            call.answer(params);
        }
        return deferred.promise;
    };

    /**
     * Find the presence out of all known connections with the highest priority (most availability)
     * and set it as the endpoint's resolved presence.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.resolvePresence
     * @private
     */
    that.resolvePresence = function () {
        var options = ['chat', 'available', 'away', 'dnd', 'xa', 'unavailable'];
        var idList;

        /**
         * Sort the connections array by the priority of the value of the presence of that
         * connectionId. This will cause the first element in the list to be the id of the
         * session with the highest priority presence so we can access it by the 0 index.
         * TODO: If we don't really care about the sorting and only about the highest priority
         * we could use Array.prototype.every to improve this algorithm.
         */
        idList = that.connections.sort(function sorter(a, b) {
            var indexA = options.indexOf(a.presence);
            var indexB = options.indexOf(b.presence);
            // Move it to the end of the list if it isn't one of our accepted presence values
            indexA = indexA === -1 ? 1000 : indexA;
            indexB = indexB === -1 ? 1000 : indexB;
            return indexA < indexB ? -1 : (indexB < indexA ? 1 : 0);
        });

        if (idList[0]) {
            that.presence = idList[0].presence;
        } else {
            that.presence = 'unavailable';
        }
    };

    /**
     * Get the Connection with the specified id. The connection ID is optional if only one connection exists.
     * @memberof! brightstream.Endpoint
     * @method brightstream.Endpoint.getConnection
     * @private
     * @param {object} params
     * @param {string} [params.connectionId]
     * @return {brightstream.Connection}
     */
    that.getConnection = function (params) {
        var connection;
        if (that.connections.length === 1 &&
                (!params.connectionId || that.connections[0] === params.connectionId)) {
            return that.connections[0];
        }

        if (!params || !params.connectionId) {
            throw new Error("Can't find a connection without the connectionId.");
        }

        that.connections.every(function eachConnection(conn) {
            if (conn.id === params.connectionId) {
                connection = conn;
                return false;
            }
            return true;
        });

        return connection;
    };

    return that;
}; // End brightstream.Endpoint

/**
 * Represents remote Connections which belong to an endpoint. An Endpoint can be authenticated from multiple devices,
 * browsers, or tabs. Each of these separate authentications is a Connection. The currently logged-in user can interact
 * with connections by calling them or sending them messages.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments brightstream.Presentable
 * @param {object} params
 * @param {string} params.id
 * @returns {brightstream.Connection}
 */
brightstream.Connection = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! brightstream.Connection
     * @name client
     * @private
     * @type {string}
     */
    var client = params.client;
    var that = brightstream.Presentable(params);
    var clientObj = brightstream.getClient(client);

    /**
     * @memberof! brightstream.Connection
     * @name id
     * @type {string}
     */
    that.id = that.id || that.connectionId;
    if (!that.id) {
        throw new Error("Can't make a connection without an id.");
    }
    delete that.client;
    delete that.connectionId;

    /**
     * A name to identify the type of this object.
     * @memberof! brightstream.Connection
     * @name className
     * @type {string}
     */
    that.className = 'brightstream.Connection';

    /**
     * Send a message to this connection of an endpoint only through the infrastructure.
     * @memberof! brightstream.Connection
     * @method brightstream.Connection.sendMessage
     * @param {object} params
     * @param {string} params.message
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @returns {Promise}
     */
    that.sendMessage = function (params) {
        params = params || {};
        params.connectionId = that.id;
        return that.getEndpoint().sendMessage(params);
    };

    /**
     * Create a new Call for a voice and/or video call this particular connection, only. The Call cannot be answered
     * by another connection of this Endpoint.
     * @memberof! brightstream.Connection
     * @method brightstream.Connection.call
     * @param {object} params
     * @param {RTCServers} [params.servers]
     * @param {RTCConstraints} [params.constraints]
     * @param {function} [params.onLocalVideo] - Callback for receiving an HTML5 Video element with the local
     * audio and/or video attached.
     * @param {function} [params.onRemoteVideo] - Callback for receiving an HTML5 Video element with the remote
     * audio and/or video attached.
     * @param {function} [params.onHangup] - Callback for being notified when the call has been hung up
     * @param {function} [params.onStats] - Callback for receiving statistical information.
     * @param {boolean} [params.receiveOnly] - whether or not we accept media
     * @param {boolean} [params.sendOnly] - whether or not we send media
     * @param {boolean} [params.directConnectionOnly] - flag to enable skipping media & opening direct connection.
     * @param {boolean} [params.forceTurn] - If true, media is not allowed to flow peer-to-peer and must flow through
     * relay servers. If it cannot flow through relay servers, the call will fail.
     * @param {boolean} [params.disableTurn] - If true, media is not allowed to flow through relay servers; it is
     * required to flow peer-to-peer. If it cannot, the call will fail.
     * @param {function} [params.previewLocalMedia] - A function to call if the developer wants to perform an action
     * between local media becoming available and calling approve().
     * @returns {brightstream.Call}
     */
    that.call = function (params) {
        params = params || {};
        params.connectionId = that.id;
        return that.getEndpoint().call(params);
    };

    /**
     * Create a new DirectConnection with this particular connection, only. The DirectConnection cannot be answered
     * by another connection of this Endpoint.  This method creates a new Call as well, attaching this
     * DirectConnection to it for the purposes of creating a peer-to-peer link for sending data such as messages to
     * the other endpoint. Information sent through a DirectConnection is not handled by the cloud infrastructure.
     * @memberof! brightstream.Connection
     * @method brightstream.Connection.getDirectConnection
     * @param {object} params
     * @param {function} [params.onSuccess] - Success handler for this invocation of this method only.
     * @param {function} [params.onError] - Error handler for this invocation of this method only.
     * @param {function} [params.onOpen] - A callback for receiving notification of when the DirectConnection is
     * open and ready to be used.
     * @param {function} [params.onClose] - A callback for receiving notification of when the DirectConnection
     * is closed and the two Endpoints are disconnected.
     * @param {function} [params.onMessage] - A callback for receiving messages sent through the DirectConnection.
     * @param {RTCServers} [params.servers] - Additional ICE/STUN/TURN servers to use in connecting.
     * @returns {brightstream.DirectConnection} The DirectConnection which can be used to send data and messages
     * directly to the other endpoint.
     */
    that.getDirectConnection = function (params) {
        params = params || {};
        params.connectionId = that.id;
        return that.getEndpoint().getDirectConnection(params);
    };

    /**
     * Get the Endpoint that this Connection belongs to.
     * @memberof! brightstream.Connection
     * @method brightstream.Connection.getEndpoint
     * @returns {brightstream.Endpoint}
     */
    that.getEndpoint = function () {
        return clientObj.getEndpoint({id: that.endpointId});
    };

    return that;
}; // End brightstream.Connection

/**
 * Represents the currently logged-in Endpoint.
 * @author Erin Spiceland <espiceland@digium.com>
 * @constructor
 * @augments brightstream.Presentable
 * @param {object} params
 * @param {string} params.client
 * @param {string} params.token
 * @returns {brightstream.User}
 */
brightstream.User = function (params) {
    "use strict";
    params = params || {};
    var client = params.client;
    var that = brightstream.Presentable(params);
    /**
     * A simple POJO to store some methods we will want to override but reference later.
     * @memberof! brightstream.User
     * @name superClass
     * @private
     * @type {object}
     */
    var superClass = {
        setPresence: that.setPresence
    };
    delete that.client;
    that.className = 'brightstream.User';

    /**
     * Array of calls in progress.
     * @memberof! brightstream.User
     * @name calls
     * @private
     * @type {array}
     */
    var calls = [];
    var signalingChannel = brightstream.getClient(client).getSignalingChannel();

    /**
     * Overrides Presentable.setPresence to send presence to the server before updating the object.
     * @memberof! brightstream.User
     * @method brightstream.User.setPresence
     * @param {object} params
     * @param {string} params.presence
     * @param {function} [params.onSuccess]
     * @param {function} [params.onError]
     * @return {Promise}
     */
    that.setPresence = function (params) {
        params = params || {};
        params.presence = params.presence || "available";
        log.info('sending my presence update ' + params.presence);

        return signalingChannel.sendPresence({
            presence: params.presence,
            onSuccess: function successHandler(p) {
                superClass.setPresence(params);
                if (typeof params.onSuccess === 'function') {
                    params.onSuccess(p);
                }
            },
            onError: params.onError
        });
    };

    /**
     * Get all current calls.
     * @memberof! brightstream.User
     * @method brightstream.User.getCalls
     * @returns {Array<brightstream.Call>}
     */
    that.getCalls = function () {
        return calls;
    };

    /**
     * Get the Call with the endpoint specified.
     * @memberof! brightstream.User
     * @method brightstream.User.getCall
     * @param {object} params
     * @param {string} [params.id] - Call ID.
     * @param {string} [params.endpointId] - Endpoint ID. Warning: don't use this method if you are placing multiple
     * calls to the same endpoint. Use user.getCalls instead.
     * @param {boolean} params.create - whether or not to create a new call if the specified endpointId isn't found
     * @returns {brightstream.Call}
     */
    that.getCall = function (params) {
        var call = null;
        var endpoint = null;
        var callSettings = null;
        var clientObj = brightstream.getClient(client);

        calls.every(function findCall(one) {
            if (params.id && one.id === params.id) {
                call = one;
                return false;
            }

            if (!params.id && params.endpointId && one.remoteEndpoint.id === params.endpointId) {
                call = one;
                return false;
            }
            return true;
        });

        if (call === null && params.create === true) {
            endpoint = clientObj.getEndpoint({id: params.endpointId});
            try {
                callSettings = clientObj.getCallSettings();
                call = endpoint.call({
                    callSettings: callSettings,
                    id: params.id,
                    initiator: false
                });
            } catch (e) {
                log.error("Couldn't create Call: " + e.message);
            }
        }
        return call;
    };

    /**
     * Associate the call with this user.
     * @memberof! brightstream.User
     * @method brightstream.User.addCall
     * @param {object} params
     * @param {brightstream.Call} params.call
     * @fires brightstream.User#call
     * @private
     */
    that.addCall = function (params) {
        if (calls.indexOf(params.call) === -1) {
            calls.push(params.call);
            if (params.call.className === 'brightstream.Call') {
                if (!params.call.initiator && !that.hasListeners('call')) {
                    log.warn("Got an incoming call with no handlers to accept it!");
                    params.call.reject();
                    return;
                }
                /**
                 * This event provides notification for when an incoming call is being received.  If the user wishes
                 * to allow the call, the app should call evt.call.answer() to answer the call.
                 * @event brightstream.User#call
                 * @type {brightstream.Event}
                 * @property {brightstream.Call} call
                 * @property {brightstream.Endpoint} endpoint
                 * @property {string} name - the event name.
                 * @property {brightstream.User} target
                 */
                that.fire('call', {
                    endpoint: params.endpoint,
                    call: params.call
                });
            }
        }
    };

    /**
     * Remove the call or direct connection.
     * @memberof! brightstream.User
     * @method brightstream.User.removeCall
     * @param {object} params
     * @param {string} [params.id] Call or DirectConnection id
     * @param {brightstream.Call} [call] Call or DirectConnection
     * @todo TODO rename this something else or make it an event listener.
     */
    that.removeCall = function (params) {
        var match = false;
        if (!params.id && !params.call) {
            throw new Error("Must specify endpointId of Call to remove or the call itself.");
        }

        // Loop backward since we're modifying the array in place.
        for (var i = calls.length - 1; i >= 0; i -= 1) {
            if (calls[i].id === params.id ||
                    (params.call && calls[i] === params.call)) {
                calls.splice(i);
                match = true;
            }
        }

        if (!match) {
            log.warn("No call removed.");
        }
    };

    /**
     * Set presence to available.
     * @memberof! brightstream.User
     * @method brightstream.User.setOnline
     * @param {object} params
     * @param {string} params.presence - The presence to set.
     * @returns {Promise}
     */
    that.setOnline = function (params) {
        params = params || {};
        params.presence = params.presence || 'available';
        return that.setPresence(params);
    };

    return that;
}; // End brightstream.User

