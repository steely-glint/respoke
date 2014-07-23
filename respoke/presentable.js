/**
 * Copyright (c) 2014, D.C.S. LLC. All Rights Reserved. Licensed Software.
 * @ignore
 */

var respoke = require('./respoke');

/**
 * The purpose of the class is so that Client and Endpoint can share the same presence.
 * @class respoke.Presentable
 * @constructor
 * @augments respoke.EventEmitter
 * @link https://www.respoke.io/min/respoke.min.js
 * @param {object} params
 * @param {string} params.instanceId
 * @param {string} params.id
 * @returns {respoke.Presentable}
 */
module.exports = function (params) {
    "use strict";
    params = params || {};
    /**
     * @memberof! respoke.Presentable
     * @name instanceId
     * @private
     * @type {string}
     */
    var instanceId = params.instanceId;
    var that = respoke.EventEmitter(params);
    delete that.instanceId;
    /**
     * A name to identify the type of this object.
     * @memberof! respoke.Presentable
     * @name className
     * @type {string}
     */
    that.className = 'respoke.Presentable';
    /**
     * Represents the presence status. Typically a string, but other types are supported.
     * Defaults to `'unavailable'`.
     * @memberof! respoke.Presentable
     * @name presence
     * @type {string|number|object|Array}
     */
    that.presence = 'unavailable';

    /**
     * @memberof! respoke.DirectConnection
     * @name client
     * @type {respoke.Client}
     * @private
     */
    var client = respoke.getClient(instanceId);

    /**
     * Set the presence on the object and the session
     * @memberof! respoke.Presentable
     * @method respoke.Presentable.setPresence
     * @param {object} params
     * @param {string|number|object|Array} [params.presence=available]
     * @param {string} params.connectionId
     * @fires respoke.Presentable#presence
     * @private
     */
    that.setPresence = function (params) {
        var connection;
        params = params || {};
        params.presence = params.presence || 'available';
        params.connectionId = params.connectionId || that.connectionId;

        if (that.className === 'respoke.Client' || that.className === 'respoke.Connection') {
            that.presence = params.presence;
            if (that.className === 'respoke.Connection') {
                that.getEndpoint().resolvePresence();
            }
        } else if (that.className === 'respoke.Endpoint') {
            if (!params.connectionId) {
                throw new Error("Can't set Endpoint presence without a connectionId.");
            }

            connection = that.getConnection({connectionId: params.connectionId}) || client.getConnection({
                connectionId: params.connectionId,
                skipCreate: false,
                endpointId: that.id
            });

            connection.presence = params.presence;
            that.resolvePresence();
        }

        /**
         * This event indicates that the presence for this endpoint has been updated.
         * @event respoke.Presentable#presence
         * @type {respoke.Event}
         * @property {string|number|object|Array} presence
         * @property {string} name - the event name.
         * @property {respoke.Presentable} target
         */
        that.fire('presence', {
            presence: that.presence
        });
    };

    /**
     * Get the presence.
     * @memberof! respoke.Presentable
     * @method respoke.Presentable.getPresence
     * @returns {string|number|object|Array} the current presence of this endpoint.
     */
    that.getPresence = function () {
        return that.presence;
    };

    return that;
}; // End respoke.Presentable