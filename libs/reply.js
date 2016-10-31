/* ********************************************************************** *
 * ****************************** Node Modules
 * ********************************************************************** */

let async = require('async'),
  _ = require('lodash'),
  uuid = require('uuid');


/* ********************************************************************** *
 * ****************************** Private Methods
 * ********************************************************************** */

/**
 * Determines the correct HTTP status code for a Reply instance.
 */
let calculateReplyHttpStatusCode = function(reply, cb) {
  let httpStatusCode = undefined;

  if(reply) {
    if( ! reply.errors || ! _.isArray(reply.errors) || reply.errors.length == 0) {
      httpStatusCode = 200;
    } else {
      // Update the httpStatusCode to the highest status code value of all the errors.
      for(let i = 0; i < reply.errors.length; i++) {
        if (reply.errors[i].httpStatusCode && (httpStatusCode === undefined || reply.errors[i].httpStatusCode > httpStatusCode)) {
          httpStatusCode = reply.errors[i].httpStatusCode;
        }
      }
    }
  }

  if(cb) {
    cb(undefined, httpStatusCode);
  }
  return httpStatusCode || 500;
};


/* ********************************************************************** *
 * ****************************** Exported Class
 * ********************************************************************** */

module.exports = function(Riposte) {

  class Reply {
    /**
     * Called when a new instance is created using the new keyword.
     * @param {object|undefined} obj is an object with Reply related properties.
     * @return {object} the reply instance is returned.
     */
    constructor(obj) {
      this.fromObject(obj);
      return this;
    }

    addErrorType(errorType, cb, createErrorOptions) {
      let self = this;
      self.riposte.handle(Riposte.HANDLE_CREATE_CLIENT_ERROR, errorType, createErrorOptions, function (err, data) {
        if (err) {
          cb(err);
        } else {
          self.addErrors(data, cb, createErrorOptions);
        }
      });
      return this;
    }

    addBadRequest(cb, createErrorOptions) {
      return this.addErrorType(Riposte.ERROR_TYPE_BAD_REQUEST, cb, createErrorOptions);
    }

    addConflict(cb, createErrorOptions) {
      return this.addErrorType(Riposte.ERROR_TYPE_CONFLICT, cb, createErrorOptions);
    }

    /**
     * Add one or more errors to the Reply instance.
     * @param {array|object|undefined} errors is the one or more errors to be added.
     * @param {addErrorsCallback} cb is a callback method.
     * @return {object} the reply instance is returned.
     */
    addErrors(errors, cb, createErrorOptions) {
      let self = this;

      if ( ! errors) {
        cb(undefined, self);
      } else {
        let tasks = [];

        if ( ! _.isArray(errors)) {
          errors = [ errors ];
        }

        for (let i = 0; i < errors.length; i++) {
          tasks.push(function (next) {
            self.riposte.handle(Riposte.HANDLE_CREATE_ERROR, errors[i], createErrorOptions || self.riposte.defaultCreateErrorOptions, function (err, data) {
              if (err) {
                next(err);
              } else {
                self.errors.push(data);
                next(undefined, self);
              }
            });
          });
        }

        tasks.push(function (next) {
          self.httpStatusCode = calculateReplyHttpStatusCode(self) || 500;
          next();
        });

        async.series(tasks, function (err) {
          cb(err, self);
        });
      }

      return this;
    }

    addErrorsAndSend(errors, res, cb, options) {
      let self = this;

      if (typeof res === "function" && options === undefined) {
        options = cb;
        cb = res;
        res = undefined;
      }

      if(options === undefined) {
        options = {};
      }

      self.addErrors(errors, function (err, reply) {
        if(err) {
          cb(err);
        } else {
          reply.send(res || reply, cb, options[Riposte.OPTIONS_KEY_ERROR_TO_OBJECT])
        }
      }, options[Riposte.OPTIONS_KEY_CREATE_ERROR]);
    }

    addErrorsAndSetData(errors, data, cb, createErrorOptions) {
      let self = this;

      self.addErrors(errors, function (err) {
        if (err) {
          cb(err);
        } else {
          self.setData(data, cb);
        }
      }, createErrorOptions);
    }

    addAndSend(errors, data, res, cb, options) {
      let self = this;

      if (typeof res === "function" && options === undefined) {
        options = cb;
        cb = res;
        res = undefined;
      }

      if(options === undefined) {
        options = {};
      }

      self.addErrors(errors, function (err, reply) {
        if(err) {
          cb(err);
        } else {
          reply = reply.setData(data);
          reply.send(res || reply, cb, options[Riposte.OPTIONS_KEY_ERROR_TO_OBJECT])
        }
      }, options[Riposte.OPTIONS_KEY_CREATE_ERROR]);
    }

    addForbidden(cb, createErrorOptions) {
      return this.addErrorType(Riposte.ERROR_TYPE_FORBIDDEN, cb, createErrorOptions);
    }

    addInternalServerError(cb, createErrorOptions) {
      return this.addErrorType(Riposte.ERROR_TYPE_INTERNAL_SERVER_ERROR, cb, createErrorOptions);
    }

    addNotFound(cb, createErrorOptions) {
      return this.addErrorType(Riposte.ERROR_TYPE_NOT_FOUND, cb, createErrorOptions);
    }

    addPaymentRequired(cb, createErrorOptions) {
      return this.addErrorType(Riposte.ERROR_TYPE_PAYMENT_REQUIRED, cb, createErrorOptions);
    }

    addUnauthorized(cb, createErrorOptions) {
      return this.addErrorType(Riposte.ERROR_TYPE_UNAUTHORIZED, cb, createErrorOptions);
    }

    /**
     * Apply the Reply related properties from an object to this Reply
     * instance.  Where properties are invalid or undefined the default
     * values will be used.
     * @param {object|undefined} obj is object with Reply related properties.
     * @return {object} the updated reply instance is returned.
     */
    fromObject(obj = {}) {
      this.data = obj.data || undefined;
      this.errors = obj.errors || [];
      this.id = obj.id || uuid.v4();
      this.res = obj.res || this.res;                   // TODO: Check if this can be set to undefined as default.
      this.httpStatusCode = obj.httpStatusCode || calculateReplyHttpStatusCode(this);

      if ("riposte" in obj) {
        this.riposte = obj.riposte;
      }

      return this;
    }

    send(reply, cb, replyToObjectOptions) {
      let self = this;

      if (typeof reply === "function" && replyToObjectOptions === undefined) {
        replyToObjectOptions = cb;
        cb = reply;
        if (self.res) {
          reply = self.res;
        } else {
          reply = self;
        }
      }

      self.riposte.send(reply, cb, replyToObjectOptions);
      return this;
    }

    sendBadRequest(res, cb, options) {
      this.sendErrorType(Riposte.ERROR_TYPE_BAD_REQUEST, res, cb, options);
    }

    sendConflict(res, cb, options) {
      this.sendErrorType(Riposte.ERROR_TYPE_CONFLICT, res, cb, options);
    }

    sendErrorType(errorType, res, cb, options) {
      let self = this;

      if (typeof res === "function" && options === undefined) {
        options = cb;
        cb = res;
        res = undefined;
      }

      if(options === undefined) {
        options = {};
      }

      self.setErrorType(errorType, function(err, reply) {
        if(err) {
          cb(err);
        } else {
          reply.send(res || reply, cb, options[Riposte.OPTIONS_KEY_ERROR_TO_OBJECT])
        }
      }, options[Riposte.OPTIONS_KEY_CREATE_ERROR]);
    }

    sendForbidden(res, cb, options) {
      this.sendErrorType(Riposte.ERROR_TYPE_FORBIDDEN, res, cb, options);
    }

    sendInternalServerError(res, cb, options) {
      this.sendErrorType(Riposte.ERROR_TYPE_INTERNAL_SERVER_ERROR, res, cb, options);
    }

    sendNotFound(res, cb, options) {
      this.sendErrorType(Riposte.ERROR_TYPE_NOT_FOUND, res, cb, options);
    }

    sendPaymentRequired(res, cb, options) {
      this.sendErrorType(Riposte.ERROR_TYPE_PAYMENT_REQUIRED, res, cb, options);
    }

    sendUnauthorized(res, cb, options) {
      this.sendErrorType(Riposte.ERROR_TYPE_UNAUTHORIZED, res, cb, options);
    }

    setBadRequest(cb, createErrorOptions) {
      return this.setErrorType(Riposte.ERROR_TYPE_BAD_REQUEST, cb, createErrorOptions);
    }

    setConflict(cb, createErrorOptions) {
      return this.setErrorType(Riposte.ERROR_TYPE_CONFLICT, cb, createErrorOptions);
    }

    /**
     * Set the Reply instance's data value.
     * @param {*} data is the new data value to be set.
     * @return {object} the reply instance is returned.
     */
    setData(data, cb) {
      this.data = data;
      if (cb) {
        cb(undefined, this);
      }
      return this;
    }

    /**
     * Set the Reply instance's error list.
     * @param {array|undefined} errors is the new errors list to be set.
     * @return {object} the reply instance is returned.
     */
    setErrors(errors, cb, createErrorOptions) {
      this.errors = undefined;
      return this.addErrors(errors, cb, createErrorOptions);
    }

    setErrorType(errorType, cb, createErrorOptions) {
      this.errors = [];
      return this.addErrorType(errorType, cb, createErrorOptions);
    }

    setForbidden(cb, createErrorOptions) {
      return this.setErrorType(Riposte.ERROR_TYPE_FORBIDDEN, cb, createErrorOptions);
    }

    setInternalServerError(cb, createErrorOptions) {
      return this.setErrorType(Riposte.ERROR_TYPE_INTERNAL_SERVER_ERROR, cb, createErrorOptions);
    }

    setNotFound(cb, createErrorOptions) {
      return this.setErrorType(Riposte.ERROR_TYPE_NOT_FOUND, cb, createErrorOptions);
    }

    setPaymentRequired(cb, createErrorOptions) {
      return this.setErrorType(Riposte.ERROR_TYPE_PAYMENT_REQUIRED, cb, createErrorOptions);
    }

    setUnauthorized(cb, createErrorOptions) {
      return this.setErrorType(Riposte.ERROR_TYPE_UNAUTHORIZED, cb, createErrorOptions);
    }

    /**
     * Convert this Reply instance into an object.
     * @param  {object} options is an object containing preferences as to
     * how the Reply instance will be converted to an object.
     * @param  {resultObjectCallback} cb is a callback method.
     * @return {object} the reply instance is returned.
     */
    toObject(cb, options = {}) {
      let tasks = [],
        self = this;

      // Check for data and errors, if neither are found then return a 404 Not Found.
      if (self.data === undefined && (self.errors === undefined || self.errors.length == 0)) {
        tasks.push(function (next) {
          self.addNotFound(function (err, reply) {
            if (err) {
              next(err);
            } else {
              reply.toObject(cb, options);
            }
          }, options[Riposte.OPTIONS_KEY_CREATE_ERROR]);
        });

        // If there are errors and/or data to send.
      } else {

        // Create a response object and add the reply's data to it.  By default,
        // try to sanitize the data unless the options specifically state not to.
        tasks.push(function (next) {
          if (self.data) {
            if (options[Riposte.OPTIONS_KEY_SANITIZE_REPLY_DATA] && options[Riposte.OPTIONS_KEY_SANITIZE_REPLY_DATA]["enabled"] === false) {
              next(undefined, {data: self.data});
            } else {
              self.riposte.handle(Riposte.HANDLE_SANITIZE_REPLY_DATA, self.data, options[Riposte.OPTIONS_KEY_SANITIZE_REPLY_DATA], function (err, data) {
                if (err) {
                  next(err, {});
                } else {
                  next(undefined, {data: data});
                }
              });
            }
          } else {
            next(undefined, {});
          }
        });

        // Check for errors in the reply object.
        if (!self.errors || !_.isArray(self.errors) || self.errors.length == 0) {
          // If no errors are found, then set the status code to 200 OK.
          tasks.push(function (obj, next) {
            obj.httpStatusCode = 200;
            next(undefined, obj);
          });
        } else {
          // If there are errors we need to add them to the response object.

          // Create an errors array in the reply and set the status code to undefined.
          tasks.push(function (obj, next) {
            obj.errors = [];
            next(undefined, obj);  // The last parameter is the status code.
          });

          // Add each error to the reply object and update the status code to the highest value.
          for (let i = 0; i < self.errors.length; i++) {
            tasks.push(function (obj, next) {

              // Update the response object's HTTP status code to the highest status code value of all the errors.
              //if (self.errors[i].httpStatusCode && (obj.httpStatusCode === undefined || self.errors[i].httpStatusCode > obj.httpStatusCode)) {
              //  obj.httpStatusCode = self.errors[i].httpStatusCode;
              //}

              // Convert the reply error to an object and add it to the response object's error list.
              self.riposte.handle(Riposte.HANDLE_ERROR_TO_OBJECT, self.errors[i], options[Riposte.OPTIONS_KEY_ERROR_TO_OBJECT], function (err, errorObject) {
                if (err) {
                  next(err);
                } else {
                  obj.errors.push(errorObject);
                  next(undefined, obj);
                }
              });
            });
          }
        }
      }

      // Add the reply ID to the response object
      tasks.push(function (obj, next) {
        if (self.id && obj.id === undefined) {
          obj.id = self.id;
        }
        next(undefined, obj);
      });

      // Execute the tasks and return the results.
      async.waterfall(tasks, function (err, obj = {}) {
        if (obj.httpStatusCode === undefined) {
          obj.httpStatusCode = self.httpStatusCode;
        }
        cb(err, obj);
      });

      return this;
    }

  }

  return Reply;
};

/* ********************************************************************** *
 * ****************************** Documentation Stubs
 * ********************************************************************** */

/**
 * A callback method where an error or the result of the operation will be 
 * returned, respectively.
 *
 * @callback resultObjectCallback
 * @param {object|undefined} error describes an error that occurred.
 * @param {object|undefined} obj is the resulting object from the operation.
 */

/**
 * A callback method where a system error and the current state of the Reply instance's error list is returned, respectively.
 *
 * @callback addErrorsCallback
 * @param {object|undefined} error Describes a system error that occurred.
 * @param {array|undefined} replyErrors is the current Reply instance's error list.
 */