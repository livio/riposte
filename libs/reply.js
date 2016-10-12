/* ********************************************************************** *
 * ****************************** Node Modules
 * ********************************************************************** */

let async = require('async'),
  _ = require('lodash'),
  uuid = require('uuid');


/* ********************************************************************** *
 * ****************************** Exported Class
 * ********************************************************************** */

module.exports = function(Riposte) {

  class Reply {
    /**
     * Called when a new instance is created using the new keyword.
     * @param {object|undefined} options is object with Reply related properties.
     * @return {object} the reply instance is returned.
     */
    constructor(options) {
      this.fromObject(options);
      return this;
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
      this.riposte = obj.riposte || this.riposte;       // Do not clear out references to the riposte parent class.
      this.httpStatusCode = obj.httpStatusCode || undefined;
      return this;
    }

    /**
     * Convert this Reply instance into an object.
     * @param  {object} options is an object containing preferences as to 
     * how the Reply instance will be converted to an object.
     * @param  {resultObjectCallback} cb is a callback method.
     * @return {object} the reply instance is returned.
     */
    toObject(options = {}, cb) {
      let tasks = [],
        self = this;

      // Check for data and/or errors, if neither are found then return a 404.
      if(self.data === undefined && (self.errors === undefined || self.errors.length == 0)) {
        tasks.push(function(next) {
          self.riposte.handle(Riposte.SET_REPLY_CLIENT_ERROR, 404, undefined, function (err, data) {
            self.riposte.handle(Riposte.ON_REPLY_ERROR_TO_OBJECT, data, undefined, function(err, errorObject) {
              if(err) {
                next(err);
              } else {
                //TODO: change status to statusCode once seneca fixes error #520
                next(err, {id: self.id, errors: [ errorObject ], httpStatusCode: data.httpStatusCode || 404});
              }
            });

          });
        });

      // If there are errors and/or data to send.
      } else {
        
        // Create the reply object and add the response data, then send the object to the next tasks.
        tasks.push(function(next) {
          if(self.data) {
            if(options.sanitizeData === true) {
              self.riposte.handle(Riposte.ON_SANITIZE_DATA, self.data, options, function(error, data) {
                if(error) {
                  next(error, {});
                } else {
                  next(undefined, { data: data });
                }
              });
            } else {
              next(undefined, { data: self.data });
            }
          } else {
            next(undefined, {});
          }
        });

        // If there are no errors, then set the status code and do not alter the reply object.
        if( ! self.errors || ! _.isArray(self.errors) || self.errors.length == 0) {
          tasks.push(function(reply, next) {
            reply.httpStatusCode = 200;
            next(undefined, reply);
          });

        // If there are errors add them to the reply object, then return it.
        } else {

          // Create an errors array in the reply and set the status code to undefined.
          tasks.push(function(reply, next) {
            reply.errors = [];
            next(undefined, reply);  // The last parameter is the status code.
          });

          // Add each error to the reply object and update the status code to the highest value.
          for (let i = 0; i < self.errors.length; i++) {
            tasks.push(function(reply, next) {
              //TODO: change status to statusCode once seneca fixes error #520

              if(self.httpStatusCode === undefined) {
                if (self.errors[i].httpStatusCode && (reply.httpStatusCode === undefined || self.errors[i].httpStatusCode > reply.httpStatusCode)) {
                  // TODO: For rich errors, use the get method, this may be updated in the future based on remie module.
                  if (self.errors[i].get) {
                    reply.httpStatusCode = self.errors[i].get("httpStatusCode");
                  } else {
                    reply.httpStatusCode = self.errors[i].httpStatusCode;
                  }
                }
              }
              // Convert the reply error to an object.
              self.riposte.handle(Riposte.ON_REPLY_ERROR_TO_OBJECT, self.errors[i], options, function(err, errorObject) {
                if(err) {
                  next(err);
                } else {
                  reply.errors.push(errorObject);
                  next(undefined, reply);
                }
              });
            });
          }
        }
      }

      // Add the reply ID to the reply object
      tasks.push(function (reply, next) {
        if(self.id && reply.id === undefined) {
          reply.id = self.id;
        }
        next(undefined, reply);
      });

      // Execute the tasks and return the results.
      async.waterfall(tasks, function(err, reply = {}) {
        //TODO: change status to statusCode once seneca fixes error #520
        if(reply.httpStatusCode === undefined) {
          reply.httpStatusCode = self.httpStatusCode || 500;
        }
        cb(err, reply);
      });

      return this;
    }

    addErrorsAndSetData(errors, data, cb) {
      let self = this;
      self.addErrors(errors, function(err) {
        if(err) {
          cb(err);
        } else {
          self.setData(data, function(err) {
            if(err) {
              cb(err);
            } else {
              cb();
            }
          })
        }
      });
    }

    createResponse(cb) {
      let self = this;
      return function(errors, data) {
        self.addErrorsAndSetData(errors, data, function (err, cb) {
          if(err) {
            cb(err);
          } else {
            self.toObject(undefined, cb);
          }
        });
      }
    }

    /**
     * Add one or more errors to the Reply instance.
     * @param {array|object|undefined} errors is the one or more errors to be added.
     * @param {addErrorsCallback} cb is a callback method.
     * @return {object} the reply instance is returned.
     */
    addErrors(errors, cb) {
      let self = this;
      
      if( ! errors) {
        if(cb) {
          cb(undefined, self.errors);
        }
      } else if( ! cb) {
        console.log("riposte.addErrors():  Callback is a required parameter.");
        // Callback is required.
        //self.riposte.handle(Riposte.ON_LOG, ['[%s] ' + req.method + ' ' + req.protocol + '://' + req.get('host') + req.originalUrl + '\n\nHeaders: %s\n\nBody: %s', res.reply.id, JSON.stringify(req.headers, undefined, 2), JSON.stringify(req.body, undefined, 2)]);
      } else {
        let tasks = [];

        if( ! _.isArray(errors)) {
          errors = [ errors ];
        }

        for(let i = 0; i < errors.length; i++) {
          tasks.push(function(next) {
            self.riposte.handle(Riposte.ON_REPLY_ERROR, errors[i], undefined, function(error, data) {
              if(error) {
                next(error);
              } else {
                self.errors.push(data);
                next();
              }
            });
          });
        }

        async.series(tasks, function(error) {
          cb(error, self.errors);
        });
      }
      
      return this;
    }

    add(type, data, options, cb) {
      let self = this;

      if(typeof data === "function" && cb === undefined) {
        cb = data;
        data = undefined;
        options = undefined;
      } else if(typeof options === "function" && cb === undefined) {
        cb = options;
        options = undefined;
      }
      self.riposte.handle(type, data, options, function(err, data) {
        if(err) {
          cb(err);
        } else {
          self.addErrors(data, cb);
        }
      });
    }

    addBadRequest(options, cb) {
      this.add(Riposte.SET_REPLY_CLIENT_ERROR, 400, options, cb);
    }

    addForbidden(options, cb) {
      this.add(Riposte.SET_REPLY_CLIENT_ERROR, 403, options, cb);
    }

    addInternalServerError(options, cb) {
      this.add(Riposte.SET_REPLY_SERVER_ERROR, 500, options, cb);
    }

    addNotFound(options, cb) {
      this.add(Riposte.SET_REPLY_CLIENT_ERROR, 404, options, cb);
    }

    addUnauthorized(options, cb) {
      this.add(Riposte.SET_REPLY_CLIENT_ERROR, 401, options, cb);
    }

    /*
    send(res, next) {
      let self = this;

      if(typeof res === "function" && next === undefined) {
        next = res;
        res = self.res;
      }

      if(res) {
        if(res.reply) {
          res.reply.toObject(res.replyOptions, function (err, obj) {
            if (err) {
              next(err);
            } else {
              let statusCode = obj.statusCode;
              delete obj.statusCode;

              if (self.riposte.logReplies) {
                self.riposte.handle(Riposte.ON_LOG, ['[%s] Reply with Status Code: %s\nBody: %s', obj.id, statusCode, JSON.stringify(obj, undefined, 2)], {level: self.logReplies});
              }

              res.status(statusCode).send(obj);
            }
          });
        } else {
          next(new Error("The riposte reply object was not found in the express response object parameter.  Did you forget to call \"riposte.addExpressPreMiddleware(app)\" before \"riposte.addExpressPostMiddleware(app)\"."))
        }
      } else {
        next(new Error("The express response object parameter is required, but was never defined."));
      }
    }
    */

    /**
     * Set the Reply instance's error list.
     * @param {array|undefined} errors is the new errors list to be set.
     * @return {object} the reply instance is returned.
     */
    setErrors(errors) {
      self.errors = errors;
      return this;
    }

    /**
     * Set the Reply instance's data value.
     * @param {*} data is the new data value to be set.
     * @return {object} the reply instance is returned.
     */
    setData(data, cb) {
      this.data = data;
      if(cb) {
        cb();
      } else {
        return this;
      }
    }

    set(type, data, options, cb) {
      let self = this;

      if(typeof data === "function" && cb === undefined) {
        cb = data;
        data = undefined;
        options = undefined;
      } else if(typeof options === "function" && cb === undefined) {
        cb = options;
        options = undefined;
      }
      self.riposte.handle(type, data, options, function(err, data) {
        if(err) {
          cb(err);
        } else {
          self.addErrors(data, function(err) {
            if(err) {
              cb(err);
            } else {
              self.riposte.send(self.res, cb);
              //self.send(cb);
            }
          });
        }
      });
    }

    setBadRequest(options, cb) {
      this.set(Riposte.SET_REPLY_CLIENT_ERROR, 400, options, cb);
    }

    setForbidden(options, cb) {
      this.set(Riposte.SET_REPLY_CLIENT_ERROR, 403, options, cb);
    }

    setInternalServerError(options, cb) {
      this.set(Riposte.SET_REPLY_SERVER_ERROR, 500, options, cb);
    }

    setNotFound(options, cb) {
      this.set(Riposte.SET_REPLY_CLIENT_ERROR, 404, options, cb);
    }

    setUnauthorized(options, cb) {
      this.set(Riposte.SET_REPLY_CLIENT_ERROR, 401, options, cb);
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