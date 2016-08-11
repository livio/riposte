/* ********************************************************************** *
 * ****************************** Node Modules
 * ********************************************************************** */

let async = require('async'),
  _ = require('lodash');


/* ********************************************************************** *
 * ****************************** Exported Class
 * ********************************************************************** */

module.exports = function(Riposte) {

  class Reply {
    /**
     * Called when a new instance is created using the new keyword.
     * @param {object|undefined} obj is object with Reply related properties. 
     * @param {object} riposte is the Riposte instance to be used.
     * @return {object} the reply instance is returned.
     */
    constructor(obj, riposte) {
      this.fromObject(obj);
      if(riposte) {
        this.riposte = riposte;
      }
      return this;
    }

    /**
     * Apply the Reply related properties from an object 
     * to this Reply instance.  Where properties are invalid or undefined 
     * the default values will be used.
     * @param {object|undefined} obj is object with Reply related properties. 
     * @return {object} the reply instance is returned.
     */
    fromObject(obj = {}) {
      this.errors = obj.errors || [];
      this.riposte = obj.riposte || undefined;
      this.data = obj.data || undefined;
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

      // Check for data and/or errors.
      if(self.data === undefined && (self.errors === undefined || self.errors.length == 0)) {
        // When there isn't any data or errors to send, send a 404 error.
        tasks.push(function(next) {
          self.riposte.handle(Riposte.HANDLER_TYPE_404, undefined, undefined, function(err, replyError) {
            next(err, { errors: [ replyError ]});
          });
        });

      // If there are errors or data to send.  
      } else {
        
        // Create the reply object and add the, optionally sanitized, response data.
        tasks.push(function(next) {
          if(self.data) {
            if(options.sanitizeData === true) {
              self.riposte.handle(Riposte.HANDLER_TYPE_SANITIZE, undefined, undefined, function(error, data) {
                if(error) {
                  next(error, {});
                } else {
                  next(undefined, { data: self.data });
                }
              });
            } else {
              next(undefined, { data: self.data });
            }
          } else {
            next(undefined, {});
          }
        });

        // Check if there are errors.
        if( ! self.errors || ! _.isArray(self.errors) || self.errors.length == 0) {
          // If there aren't errors, return the reply object and a "200 OK" status code.
          tasks.push(function(reply, next) {
            next(undefined, reply, 200);
          });

        // If there are errors.  
        } else {

          // Create an errors array in the reply and set the status code to undefined.
          tasks.push(function(reply, next) {
            reply.errors = [];
            next(undefined, reply, undefined);
          });

          // Add each error to the reply object and update the status code to the highest value.
          for (let i = 0; i < self.errors.length; i++) {
            tasks.push(function(reply, statusCode, next) {
              if (self.errors[i].statusCode && (statusCode === undefined || self.errors[i].statusCode > statusCode)) {
                statusCode = self.errors[i].get("statusCode");
              }
              self.riposte.handle(Riposte.HANDLER_TYPE_ERROR_TO_OBJECT, self.errors[i], undefined, function(err, errorObject) {
                if(err) {
                  next(err);
                } else {
                  reply.errors.push(errorObject);
                  next(undefined, reply, statusCode);
                }
              });
            });
          }

          // Finally, ensure the status code is defined, defaulting to "500 Internal Server Error".  Then return the reply.
          tasks.push(function(reply, statusCode, next) {
            if(statusCode === undefined) {
              next(undefined, reply, 500);
            } else {
              next(undefined, reply, statusCode);
            }
          });
        }
      }

      // Execute the tasks and return the results.
      async.waterfall(tasks, cb);

      return this;
    }

    /**
     * Add one or more errors to the Reply instance.
     * @param {array|object|undefined} errors is the one or more errors to be added.
     * @param {addErrorsCallback} cb is a callback method.
     * @return {object} the reply instance is returned.
     */
    addErrors(errors, cb) {
      if(errors) {
        let self = this,
        tasks = []; 

        if( ! _.isArray(errors)) {
          errors = [ errors ];
        }

        for(let i = 0; i < errors.length; i++) {
          tasks.push(function(next) {
            self.riposte.handle(Riposte.HANDLER_TYPE_CREATE_ERROR, errors[i], undefined, function(error, data) {
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
      } else {
        cb(undefined, self.errors);
      }

      return this;
    }

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

  }

  return Reply;
}

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